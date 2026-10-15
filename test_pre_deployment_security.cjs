/**
 * test_pre_deployment_security.cjs
 * Comprehensive Pre-Deployment Security & Authentication Verification Suite
 */

const { chromium } = require('playwright-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Load environment
const envFile = fs.readFileSync(path.join(__dirname, 'server', '.env'), 'utf8');
const dbMatch = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m);
if (dbMatch && !process.env.DATABASE_URL) process.env.DATABASE_URL = dbMatch[1];

const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';
const BASE_URL = 'http://localhost:5173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message, details) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`, details || '');
    failures.push({ message, details });
  }
}

async function runSecuritySuite() {
  console.log('================================================================');
  console.log('🛡️ RUNNING PRE-DEPLOYMENT SECURITY & AUTH VERIFICATION SUITE');
  console.log('================================================================\n');

  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  } catch (err) {
    console.error('Failed to launch browser:', err);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 1: Login Page UI & Absence of Injected Credentials
  // ─────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Login Inputs & Absence of Injected Credentials ---');
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  const idVal = await page.inputValue('#login-id');
  const passVal = await page.inputValue('#login-pass');
  const idDefault = await page.getAttribute('#login-id', 'defaultValue');
  const passDefault = await page.getAttribute('#login-pass', 'defaultValue');
  const idPlaceholder = await page.getAttribute('#login-id', 'placeholder');
  const passPlaceholder = await page.getAttribute('#login-pass', 'placeholder');
  const idAutoComplete = await page.getAttribute('#login-id', 'autocomplete');
  const passAutoComplete = await page.getAttribute('#login-pass', 'autocomplete');

  assert(idVal === '', 'Login ID input starts empty (no application prefill)', { idVal });
  assert(passVal === '', 'Login Password input starts empty (no application prefill)', { passVal });
  assert(!idDefault, 'Login ID has no defaultValue attribute', { idDefault });
  assert(!passDefault, 'Login Password has no defaultValue attribute', { passDefault });
  assert(idAutoComplete === 'username', 'Login ID has standard autoComplete="username"', { idAutoComplete });
  assert(passAutoComplete === 'current-password', 'Login Password has standard autoComplete="current-password"', { passAutoComplete });
  assert(!passPlaceholder.toLowerCase().includes('terminal123') && !passPlaceholder.toLowerCase().includes('soumya'), 'Password placeholder does not leak real passwords');

  // Check absence of demo login shortcuts
  const pageContent = await page.content();
  const hasDemoShortcut = /quick\s*login|demo\s*login|fill\s*demo|login\s*as\s*demo/i.test(pageContent);
  assert(!hasDemoShortcut, 'Production login page contains no demo-login shortcut buttons');

  // ─────────────────────────────────────────────────────────────────
  // TEST 2: Stale Auth Cleansing & Server Verification
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Stale Stored Credentials Cleansing ---');
  const staleContext = await browser.newContext();
  const stalePage = await staleContext.newPage();

  // Inject a fabricated/invalid token and fake user
  await stalePage.goto(`${BASE_URL}/login`);
  await stalePage.evaluate(() => {
    localStorage.setItem('terminal_token', 'fabricated_invalid_jwt_token_12345');
    localStorage.setItem('terminal_user', JSON.stringify({ id: 'fake_id', username: 'fake_user', role: 'SUPER_ADMIN' }));
    sessionStorage.setItem('terminal_token', 'fabricated_invalid_jwt_token_12345');
    sessionStorage.setItem('terminal_user', JSON.stringify({ id: 'fake_id', username: 'fake_user', role: 'SUPER_ADMIN' }));
  });

  // Reload page so AuthContext evaluates the stored token
  await stalePage.reload();
  await stalePage.waitForTimeout(1000);

  // AuthContext should have contacted /api/auth/me, caught 401, and wiped the stale credentials
  const remainingToken = await stalePage.evaluate(() => localStorage.getItem('terminal_token'));
  const remainingUser = await stalePage.evaluate(() => localStorage.getItem('terminal_user'));
  assert(remainingToken === null, 'Stale/invalid token purged from localStorage after failed server verification', { remainingToken });
  assert(remainingUser === null, 'Stale/invalid user payload purged from localStorage', { remainingUser });
  await staleContext.close();

  // ─────────────────────────────────────────────────────────────────
  // TEST 3: Unauthenticated Request Rejection (401 Unauthorized)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Unauthenticated Endpoint Protection ---');
  const protectedEndpoints = [
    { method: 'get', url: `${API}/auth/me` },
    { method: 'get', url: `${API}/admin/stats` },
    { method: 'post', url: `${API}/games`, data: { name: 'Hack Game', template: 'QUIZ' } },
    { method: 'post', url: `${API}/sessions/TESTCODE/start` },
    { method: 'post', url: `${API}/sessions/TESTCODE/lock` },
    { method: 'post', url: `${API}/sessions/TESTCODE/next` },
    { method: 'post', url: `${API}/sessions/TESTCODE/end` },
  ];

  for (const ep of protectedEndpoints) {
    try {
      await axios({ method: ep.method, url: ep.url, data: ep.data });
      assert(false, `Unauthenticated ${ep.method.toUpperCase()} ${ep.url} should be rejected`);
    } catch (err) {
      assert(err.response?.status === 401, `Unauthenticated ${ep.method.toUpperCase()} ${ep.url} rejected with 401 Unauthorized`, { status: err.response?.status });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 4: Student Role Restricted from GM Controls (403 Forbidden)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Student Role Cannot Access GM / Admin Endpoints ---');
  // Register a temporary student
  const studentTimestamp = Date.now();
  const studentRes = await axios.post(`${API}/auth/register`, {
    name: 'Security Test Student',
    username: `sec_stud_${studentTimestamp}`,
    usn: `1VA24SE${studentTimestamp.toString().slice(-4)}`,
    email: `sec_stud_${studentTimestamp}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'password123',
  });
  const studentToken = studentRes.data.token;
  assert(Boolean(studentToken), 'Student registered successfully');

  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  // Student attempts to access admin stats
  try {
    await axios.get(`${API}/admin/stats`, { headers: studentHeaders });
    assert(false, 'Student should be rejected from GET /api/admin/stats');
  } catch (err) {
    assert(err.response?.status === 403, 'Student blocked from GET /api/admin/stats (403 Forbidden)', { status: err.response?.status });
  }

  // Student attempts to create game
  try {
    await axios.post(`${API}/games`, { name: 'Unauthorized Game', template: 'QUIZ' }, { headers: studentHeaders });
    assert(false, 'Student should be rejected from POST /api/games');
  } catch (err) {
    assert(err.response?.status === 403, 'Student blocked from POST /api/games (403 Forbidden)', { status: err.response?.status });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 5: GM-to-GM Session Isolation (IDOR Protection)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: GM-to-GM Session Isolation & IDOR Protection ---');
  // Authenticate owning GM
  const owningGmRes = await axios.post(`${API}/auth/login`, {
    login: 'codenex.gm@terminal.dev',
    password: 'password123',
  }).catch(() => null);

  // If codenex has different pass, use demo_designer
  let gm1Token;
  if (owningGmRes?.data?.token) {
    gm1Token = owningGmRes.data.token;
  } else {
    const demoGm = await axios.post(`${API}/auth/login`, {
      login: 'demo@terminal.dev',
      password: 'terminal123',
    });
    gm1Token = demoGm.data.token;
  }
  assert(Boolean(gm1Token), 'Owning GM authenticated');

  // Find a published game with challenges to host (prefer CODENEX tournament game)
  const publishedGame = await prisma.game.findFirst({
    where: { status: 'PUBLISHED', designer: { username: 'codenex' }, challenges: { some: {} } }
  });
  assert(Boolean(publishedGame), 'Found published game with challenges to host');

  const sessionCreateRes = await axios.post(`${API}/sessions`, {
    gameId: publishedGame.id,
    mode: 'SOLO'
  }, { headers: { Authorization: `Bearer ${gm1Token}` } });
  const sessionCode = sessionCreateRes.data.roomCode || sessionCreateRes.data.session?.roomCode;
  assert(Boolean(sessionCode), `Live session created with roomCode: ${sessionCode}`);

  // Register and approve a second, distinct GM
  const gm2Timestamp = Date.now();
  const gm2Email = `diff_gm_${gm2Timestamp}@terminal.dev`;
  const gm2User = await prisma.user.create({
    data: {
      username: `diff_gm_${gm2Timestamp}`,
      email: gm2Email,
      passwordHash: studentRes.data.user?.passwordHash || '$2a$10$abcdefghijklmnopqrstuv',
      name: 'Different Game Master',
      role: 'GAME_MASTER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
    }
  });

  const gm2Login = await axios.post(`${API}/auth/login`, {
    login: gm2Email,
    password: 'password123',
  }).catch(() => null);

  // Generate valid token for GM 2
  const jwt = require('./server/node_modules/jsonwebtoken');
  const jwtSecret = envFile.match(/^\s*JWT_SECRET\s*=\s*"?([^"\r\n]+)"?\s*$/m)?.[1] || 'your-super-secret-jwt-key';
  const gm2Token = jwt.sign({ userId: gm2User.id, email: gm2User.email }, jwtSecret, { expiresIn: '1h' });
  const gm2Headers = { Authorization: `Bearer ${gm2Token}` };

  // GM 2 attempts to control GM 1's session
  try {
    await axios.post(`${API}/sessions/${sessionCode}/start`, {}, { headers: gm2Headers });
    assert(false, 'Different GM should be blocked from starting session');
  } catch (err) {
    assert(err.response?.status === 403, 'Different GM blocked from starting session (403 Forbidden)', { status: err.response?.status });
  }

  try {
    await axios.post(`${API}/sessions/${sessionCode}/lock`, {}, { headers: gm2Headers });
    assert(false, 'Different GM should be blocked from locking session');
  } catch (err) {
    assert(err.response?.status === 403, 'Different GM blocked from locking session (403 Forbidden)', { status: err.response?.status });
  }

  try {
    await axios.post(`${API}/sessions/${sessionCode}/next`, {}, { headers: gm2Headers });
    assert(false, 'Different GM should be blocked from advancing session');
  } catch (err) {
    assert(err.response?.status === 403, 'Different GM blocked from advancing session (403 Forbidden)', { status: err.response?.status });
  }

  try {
    await axios.post(`${API}/sessions/${sessionCode}/end`, {}, { headers: gm2Headers });
    assert(false, 'Different GM should be blocked from ending session');
  } catch (err) {
    assert(err.response?.status === 403, 'Different GM blocked from ending session (403 Forbidden)', { status: err.response?.status });
  }

  // ─────────────────────────────────────────────────────────────────
  // TEST 6: Unauthorized Access to Answers & Explanations Denied
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 6: Answer Key & Explanation Anti-Leakage ---');
  // Owning GM starts session
  await axios.post(`${API}/sessions/${sessionCode}/start`, {}, { headers: { Authorization: `Bearer ${gm1Token}` } });
  await axios.post(`${API}/sessions/${sessionCode}/start`, {}, { headers: { Authorization: `Bearer ${gm1Token}` } });

  // Public state during active question
  const publicState = await axios.get(`${API}/sessions/${sessionCode}`);
  const challenge = publicState.data?.currentChallenge;
  assert(challenge && !('answer' in challenge), 'Public challenge payload contains NO "answer" field');
  assert(challenge && !('correctAnswer' in challenge), 'Public challenge payload contains NO "correctAnswer" field');
  assert(challenge && !('explanation' in challenge), 'Public challenge payload contains NO "explanation" field');

  // Attempt to fetch review data prematurely
  try {
    await axios.get(`${API}/sessions/${sessionCode}/review`, { headers: studentHeaders });
    assert(false, 'Premature review fetch should be denied');
  } catch (err) {
    assert(err.response?.status === 403, 'Premature review fetch rejected with 403 Forbidden', { status: err.response?.status });
  }

  // Clean up session
  await axios.post(`${API}/sessions/${sessionCode}/end`, {}, { headers: { Authorization: `Bearer ${gm1Token}` } }).catch(() => {});

  // ─────────────────────────────────────────────────────────────────
  // TEST 7: Seed Execution Idempotency & No Credential Overwrite
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 7: Seed Idempotency & No Credential Overwrite ---');
  const rootBefore = await prisma.user.findFirst({ where: { username: 'root' } });
  assert(Boolean(rootBefore), 'Root user exists in database');

  // Test that running seed-loader does NOT overwrite root's passwordHash
  const { execSync } = require('child_process');
  execSync('node server/src/prisma/seed-loader.js', { stdio: 'pipe' });

  const rootAfterSeed = await prisma.user.findFirst({ where: { username: 'root' } });
  assert(rootBefore.passwordHash === rootAfterSeed.passwordHash, 'Root password hash NOT overwritten by prisma/seed.ts execution', {
    beforeLength: rootBefore.passwordHash.length,
    afterLength: rootAfterSeed.passwordHash.length
  });

  // Test that running ensureAdminUser does NOT overwrite root's passwordHash
  execSync('node -e "require(\'./server/node_modules/ts-node\').register({ transpileOnly: true, compilerOptions: { module: \'CommonJS\', moduleResolution: \'node\', ignoreDeprecations: \'6.0\' } }); require(\'./server/src/lib/adminInit\').ensureAdminUser()"', { stdio: 'pipe' });

  const rootAfterAdminInit = await prisma.user.findFirst({ where: { username: 'root' } });
  assert(rootBefore.passwordHash === rootAfterAdminInit.passwordHash, 'Root password hash NOT overwritten by ensureAdminUser() execution');

  // ─────────────────────────────────────────────────────────────────
  // TEST 8: Auth Rate Limiter Protection
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- TEST 8: Rate Limiter Protection on Auth Endpoints ---');
  const pingRes = await axios.post(`${API}/auth/login`, {
    login: 'nonexistent_probe@terminal.dev',
    password: 'dummy_probe_password',
  }).catch(e => e.response);

  assert(Boolean(pingRes.headers['ratelimit-limit']), 'RateLimit-Limit header present on /auth/login response', { limit: pingRes.headers['ratelimit-limit'] });
  assert(Boolean(pingRes.headers['ratelimit-remaining']), 'RateLimit-Remaining header present on /auth/login response', { remaining: pingRes.headers['ratelimit-remaining'] });

  // Cleanup test user
  await prisma.user.deleteMany({ where: { id: { in: [studentRes.data.user.id, gm2User.id] } } });

  await browser.close();
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch(err => {
  console.error('Test suite runtime error:', err);
  process.exit(1);
});
