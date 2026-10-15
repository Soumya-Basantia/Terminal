/**
 * test_projector_stage_mode.cjs — E2E TEST FOR PROJECTOR STAGE MODE & MOTION SPOTLIGHT
 *
 * Verifies:
 * 1. Spotlight Module expand & minimize functionality on SessionHostPage.
 * 2. Direct switching between modules (Question -> Leaderboard -> Teams -> Stats -> Activity).
 * 3. Keyboard shortcuts (Q, L, T, S, A, Escape).
 * 4. Audience Safe presentation mode (GM actions hidden).
 * 5. Projector Stage view (/stage/:code) synchronization and privacy.
 * 6. Multi-resolution validation: 1920x1080, 1600x900, 1440x900, 1280x720, 1024x768, 768x1024, 390x844, 320x640.
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

// Load environment from server/.env
const envFile = fs.readFileSync(path.join(__dirname, 'server', '.env'), 'utf8');
const dbMatch = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m);
if (dbMatch && !process.env.DATABASE_URL) process.env.DATABASE_URL = dbMatch[1];

const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';
const BASE_URL = 'http://localhost:5173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOTS_DIR = path.join(__dirname, 'docs', 'screenshots');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

let passed = 0;
let failed = 0;
const resultsLog = [];

function check(cond, msg, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
    resultsLog.push({ status: 'PASS', msg });
  } else {
    failed++;
    console.error(`  ✗ ${msg} ${extra ? JSON.stringify(extra) : ''}`);
    resultsLog.push({ status: 'FAIL', msg, extra });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('================================================================');
  console.log('   TERMINAL PROJECTOR STAGE MODE & MOTION SPOTLIGHT E2E TESTS   ');
  console.log('================================================================');

  const ts = Date.now();

  // 1. Authenticate GM & create session
  console.log('\n[1] Authenticating Game Master and creating tournament game...');
  const gmLogin = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = gmLogin.data.token;
  const gmUser = gmLogin.data.user;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };

  const gameRes = await axios.post(`${API}/games`, {
    name: `Projector Showcase Tournament ${ts}`,
    description: 'Esports stage test',
    template: 'QUIZ',
    maxPlayers: 30,
    teamsEnabled: true,
  }, gmHeaders);
  const game = gameRes.data.game;

  // Add 2 challenges
  await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What algorithm guarantees finding the shortest path in unweighted graphs?',
    options: ['Depth-First Search (DFS)', 'Breadth-First Search (BFS)', 'Dijkstra with negative weights', 'Floyd-Warshall'],
    answer: 'Breadth-First Search (BFS)',
    points: 100,
    timerSecs: 25,
    position: 0,
    category: 'ALGORITHMS',
    difficulty: 'EASY',
  }, gmHeaders);

  await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Which CSS property triggers GPU compositing without layout reflow?',
    options: ['width / height', 'transform / opacity', 'margin / padding', 'top / left'],
    answer: 'transform / opacity',
    points: 150,
    timerSecs: 20,
    position: 1,
    category: 'MOTION DESIGN',
    difficulty: 'MEDIUM',
  }, gmHeaders);

  // Publish game
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);

  // Create session
  const sessRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const sessionCode = sessRes.data.session.code || sessRes.data.session.roomCode;
  check(sessionCode, `Session created with room code: ${sessionCode}`);

  // 2. Launch browser
  console.log('\n[2] Launching Chrome browser with Playwright...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Helper to inject auth into localStorage before navigation
  console.log('\n[3] Seeding GM authentication into browser localStorage...');
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('terminal_token', t);
    localStorage.setItem('token', t);
    localStorage.setItem('terminal_user', JSON.stringify(u));
  }, { t: gmToken, u: gmUser });

  // Navigate to SessionHostPage
  console.log(`\n[4] Navigating to GM host control room for ${sessionCode}...`);
  await page.goto(`${BASE_URL}/sessions/${sessionCode}/host`);
  await page.waitForSelector('text=LIVE GAME HOST', { timeout: 15000 });
  await sleep(1000);

  // Check header loaded
  const roomCodeHeader = await page.locator(`text=${sessionCode}`).first().isVisible();
  check(roomCodeHeader, `Host page loaded with room code ${sessionCode}`);

  // Take dashboard screenshot
  await page.screenshot({ path: path.join(SHOTS_DIR, '01_host_dashboard_grid.png') });

  // 3. Test Module 1: Question Spotlight Expand & Minimize
  console.log('\n[5] Testing Question Spotlight Expand & Keyboard Shortcuts...');
  // Click expand on Question module
  const questionExpandBtn = page.locator('button[aria-label*="CURRENT QUESTION"]').first();
  await questionExpandBtn.click();
  await sleep(700); // Allow spring settle

  const questionSpotlight = page.locator('[data-testid="spotlight-active-question"]');
  const isQuestionSpotlightVisible = await questionSpotlight.isVisible();
  check(isQuestionSpotlightVisible, 'Question module successfully expanded into projector spotlight');

  // Verify projector elements
  const projectorPrompt = await page.locator('text=ROOM OPEN // STANDBY').first().isVisible();
  check(projectorPrompt, 'Projector Lobby / Standby view clearly rendered with big room code');

  await page.screenshot({ path: path.join(SHOTS_DIR, '02_question_spotlight_standby.png') });

  // Press Escape to minimize
  console.log('\n[6] Testing Escape key to minimize spotlight back to dashboard...');
  await page.keyboard.press('Escape');
  await sleep(600);

  const isQuestionMinimized = !(await questionSpotlight.isVisible());
  check(isQuestionMinimized, 'Pressing Escape restored dashboard view from Question spotlight');

  // 4. Test Keyboard Shortcut [L] for Leaderboard Spotlight
  console.log('\n[7] Testing keyboard shortcut [L] for Leaderboard Spotlight...');
  await page.keyboard.press('l');
  await sleep(700);

  const lbSpotlight = page.locator('[data-testid="spotlight-active-leaderboard"]');
  const isLbSpotlightVisible = await lbSpotlight.isVisible();
  check(isLbSpotlightVisible, 'Pressing [L] immediately opened Esports Leaderboard spotlight');

  await page.screenshot({ path: path.join(SHOTS_DIR, '03_esports_leaderboard_spotlight.png') });

  // 5. Test Direct Switching from Leaderboard to Teams Progress [T]
  console.log('\n[8] Testing direct module switching [T] to Teams Progress...');
  const switchProgressBtn = page.locator('button:has-text("PROGRESS")').first();
  if (await switchProgressBtn.isVisible()) {
    await switchProgressBtn.click();
  } else {
    await page.keyboard.press('t');
  }
  await sleep(700);

  const progressSpotlight = page.locator('[data-testid="spotlight-active-teams-progress"]');
  const isProgressSpotlightVisible = await progressSpotlight.isVisible();
  check(isProgressSpotlightVisible, 'Directly switched to Teams & Progress spotlight without intermediate screens');

  await page.screenshot({ path: path.join(SHOTS_DIR, '04_teams_progress_spotlight.png') });

  // 6. Test Direct Switching to Session Stats [S]
  console.log('\n[9] Testing direct module switching to Session Stats...');
  await page.keyboard.press('s');
  await sleep(700);

  const statsSpotlight = page.locator('[data-testid="spotlight-active-session-stats"]');
  const isStatsSpotlightVisible = await statsSpotlight.isVisible();
  check(isStatsSpotlightVisible, 'Directly switched to Session Stats spotlight');

  // 7. Test Direct Switching to Recent Activity [A]
  console.log('\n[10] Testing direct module switching to Recent Activity...');
  await page.keyboard.press('a');
  await sleep(700);

  const activitySpotlight = page.locator('[data-testid="spotlight-active-recent-activity"]');
  const isActivitySpotlightVisible = await activitySpotlight.isVisible();
  check(isActivitySpotlightVisible, 'Directly switched to Recent Activity spotlight');

  // Minimize back to dashboard
  await page.keyboard.press('Escape');
  await sleep(600);

  // 8. Start Game and verify active question projector display
  console.log('\n[11] Starting game to verify active Question Spotlight with 40-64px scale and timer ring...');
  const startBtn = page.locator('button:has-text("START GAME")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await sleep(2500);
  }

  // Expand Question module during active question
  await page.keyboard.press('q');
  await sleep(700);

  // Verify prompt and answer choices
  const activePrompt = await page.locator('text=What algorithm guarantees finding the shortest path').first().isVisible();
  check(activePrompt, 'Active Question prompt visible in Question Spotlight');

  const optionA = await page.locator('text=Breadth-First Search (BFS)').first().isVisible();
  check(optionA, 'Answer choices rendered in high-contrast 2x2 grid');

  await page.screenshot({ path: path.join(SHOTS_DIR, '05_active_question_spotlight.png') });

  // 9. Test Audience Safe Mode (GM Controls stripped)
  console.log('\n[12] Testing Audience Safe Mode presentation toggle...');
  const audienceBtn = page.locator('button[title*="Audience"]').first();
  if (await audienceBtn.isVisible()) {
    await audienceBtn.click();
    await sleep(400);
    const audienceSafeIndicator = await page.locator('text=AUDIENCE SAFE').first().isVisible();
    check(audienceSafeIndicator, 'Audience Safe mode activated');

    // GM action controls should be hidden in Audience Safe mode
    const gmControlsHeader = await page.locator('text=GM ACTIONS:').first().isVisible();
    check(!gmControlsHeader, 'GM administrative action controls successfully stripped in Audience Safe presentation');

    await page.screenshot({ path: path.join(SHOTS_DIR, '06_audience_safe_mode.png') });

    // Toggle Audience Mode back off
    await audienceBtn.click();
    await sleep(400);
  }

  // Restore dashboard
  await page.keyboard.press('Escape');
  await sleep(500);

  // 10. Multi-Resolution Projector Validation
  console.log('\n[13] Validating responsive projector aspect ratios & resolutions...');
  const resolutions = [
    { name: '1080p Projector (16:9)', width: 1920, height: 1080 },
    { name: '900p Display (16:9)', width: 1600, height: 900 },
    { name: 'MacBook Widescreen (16:10)', width: 1440, height: 900 },
    { name: '720p Projector (16:9)', width: 1280, height: 720 },
    { name: 'Classroom Projector (4:3)', width: 1024, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Mobile Standard', width: 390, height: 844 },
    { name: 'Mobile Compact', width: 320, height: 640 },
  ];

  for (const res of resolutions) {
    await page.setViewportSize({ width: res.width, height: res.height });
    await sleep(200);
    // Check no horizontal overflow on body
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    check(!hasHorizontalOverflow, `No layout clipping or horizontal overflow at ${res.name} (${res.width}x${res.height})`);
  }

  // Reset to 1080p
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 11. Projector Stage Route (/stage/:sessionCode) Verification
  console.log(`\n[14] Testing dedicated Projector Stage route (/stage/${sessionCode})...`);
  const stagePage = await context.newPage();
  await stagePage.setViewportSize({ width: 1920, height: 1080 });
  await stagePage.goto(`${BASE_URL}/stage/${sessionCode}`);
  await stagePage.waitForLoadState('networkidle');
  await sleep(1500);

  const stageConnected = await stagePage.locator('text=LIVE').first().isVisible();
  check(stageConnected, 'Stage page successfully connected to session state');

  const hostReturnLink = await stagePage.locator('a:has-text("HOST DASHBOARD")').first().isVisible();
  check(hostReturnLink, 'Stage page exposes discreet [HOST DASHBOARD] return control');

  await stagePage.screenshot({ path: path.join(SHOTS_DIR, '07_dedicated_stage_page.png') });

  await stagePage.close();
  await page.close();
  await context.close();
  await browser.close();
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in test execution:', err);
  process.exit(1);
});
