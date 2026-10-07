/**
 * test_host_restart.cjs — RESTART-SAFE AUTO-LOCK ACCEPTANCE (P0 TESTS 8/9)
 *
 * Spawns its OWN backend instance on PORT 3011 so it can stop/restart it at
 * will. The MASTER server on 3001 must be STOPPED while this runs (its sweep
 * shares the same database and would otherwise claim the test sessions).
 *
 * Scenario A — restart BEFORE expiry:
 *   start a 20s question, submit one correct answer, kill the server, restart.
 *   The sweep must auto-lock the expired question WITHOUT any host action,
 *   keep the pre-restart score, never double-score, and (with the reveal
 *   window) auto-advance the whole chain to RESULTS.
 *
 * Scenario B — expired ON STARTUP:
 *   start a question, force questionEndsAt into the past via the DB, kill
 *   the server, restart. The very first sweep pass must reconcile the
 *   expired question immediately (no GM interaction).
 *
 * Run:  (1) stop the master server
 *       (2) node test_host_restart.cjs
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const envFile = fs.readFileSync(path.join(__dirname, 'server', '.env'), 'utf8');
const dbMatch = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m);
if (dbMatch && !process.env.DATABASE_URL) process.env.DATABASE_URL = dbMatch[1];

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SERVER_DIR = path.join(__dirname, 'server');
const PORT = 3011;
const API = `http://localhost:${PORT}/api`;
const HEALTH = `http://localhost:${PORT}/api/health`;

let passed = 0;
let failed = 0;
let lastFail = '';
function ok(m) { passed++; console.log(`  ✓ ${m}`); }
function bad(m, e) { failed++; lastFail = m; console.log(`  ✗ ${m}${e ? '\n    ' + JSON.stringify(e) : ''}`); }
function check(c, m, e) { return c ? ok(m) : bad(m, e); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function poll(fn, pred, timeoutMs, intervalMs = 1000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (pred(v)) return v;
    if (Date.now() - t0 > timeoutMs) return v;
    await sleep(intervalMs);
  }
}

let child = null;
let bootLog = '';
function startServer() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['dist/index.js'], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    bootLog = '';
    child.stdout.on('data', (d) => (bootLog += d));
    child.stderr.on('data', (d) => (bootLog += d));
    const t0 = Date.now();
    const iv = setInterval(async () => {
      try {
        const r = await axios.get(HEALTH, { timeout: 1500 });
        if (r.status === 200) { clearInterval(iv); resolve(); return; }
      } catch { /* not up yet */ }
      if (Date.now() - t0 > 30000) { clearInterval(iv); reject(new Error('server failed to start:\n' + bootLog)); }
    }, 1000);
  });
}
async function stopServer() {
  if (!child) return;
  const p = new Promise((res) => {
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 5000);
    child.once('exit', () => { clearTimeout(t); res(); });
  });
  try { child.kill('SIGTERM'); } catch {}
  await p;
  child = null;
}

async function main() {
  console.log('================================================================');
  console.log('   RESTART-SAFE AUTO-LOCK — P0 TESTS 8 + 9 (dedicated PORT 3011)');
  console.log('================================================================');
  console.log(`  (master :3001 must be stopped — its sweep shares this database)\n`);

  const ts = Date.now();

  await startServer();
  const gmRes = await axios.post(`${API}/auth/login`, { login: 'demo@terminal.dev', password: 'terminal123' });
  const gmHeaders = { headers: { Authorization: `Bearer ${gmRes.data.token}` } };
  ok(`Dedicated server up on :${PORT}; GM authenticated`);

  const student = await axios.post(`${API}/auth/register`, {
    name: `Restart Agent ${ts}`, username: `restart_stud_${ts}`,
    usn: `1MS24CS${String(ts).slice(-4)}S`, email: `restart_stud_${ts}@campus.edu`,
    branch: 'CSE', section: 'A', password: 'Password123!',
  });
  const studHeaders = { headers: { Authorization: `Bearer ${student.data.token}` } };

  async function makeHostedGame(name) {
    const game = (await axios.post(`${API}/games`, { name, template: 'RAPID_FIRE', maxPlayers: 20 }, gmHeaders)).data.game;
    const q = (await axios.post(`${API}/games/${game.id}/challenges`, {
      type: 'SINGLE_CHOICE', prompt: `${name} Q1`, options: ['A', 'B', 'C', 'D'],
      answer: 'A', points: 10, timerSecs: 20, difficulty: 'EASY',
    }, gmHeaders)).data.challenge;
    await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
    const s = (await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders)).data.session;
    return { game, challenge: q, session: s };
  }
  async function getSession(code) { return (await axios.get(`${API}/sessions/${code}`)).data.session; }

  // ── SCENARIO A — restart BEFORE expiry ───────────────────────────────────
  console.log('\n[SCENARIO A] restart BEFORE expiry → auto-lock after restart');
  {
    const { challenge: q1, session: s } = await makeHostedGame(`RSTA ${ts}`);
    const code = s.roomCode;
    await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); // QUESTION_ACTIVE, 20s deadline
    const sub = (await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders)).data;
    check(sub.isCorrect === true, `Pre-restart submission scored on q1 (before kill)`);

    await stopServer();
    await sleep(3000); // deadline (20s from start) is NOT yet expired — ~15s remain
    await startServer();

    const locked = await poll(async () => getSession(code),
      (x) => x.status === 'QUESTION_LOCKED', 30000, 1000);
    check(locked.status === 'QUESTION_LOCKED',
      `Expired question auto-locked AFTER server restart (status=${locked.status}) — NO host action`);
    const sysLock = await prisma.auditLog.findMany({
      where: { targetId: s.id, targetType: 'SESSION', action: 'QUESTION_LOCKED', adminUsername: 'SYSTEM' },
    });
    check(sysLock.length >= 1, `Restart-safe auto-lock audited with actor SYSTEM (n=${sysLock.length})`);

    const rows = await prisma.submission.count({ where: { sessionId: s.id, challengeId: q1.id } });
    check(rows === 1, `Pre-restart score survived the restart (submission rows=${rows})`);
    const late = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders).then(d => ({ ok: true })).catch(e => ({ ok: false, status: e.response?.status }));
    check(late.ok === false && late.status === 400, `Late submit after restart-lock rejected (status=${late.status})`);
    const rows2 = await prisma.submission.count({ where: { sessionId: s.id, challengeId: q1.id } });
    check(rows2 === 1, `Restart-safe auto-lock did NOT double-score (rows=${rows2})`);

    const resultsA = await poll(async () => getSession(code),
      (x) => x.status === 'RESULTS', 25000, 1000);
    check(resultsA.status === 'RESULTS', `Reveal window + sweep drove the chain to RESULTS after restart`);
  }

  // ── SCENARIO B — expired ON STARTUP (starts already past deadline) ───────
  console.log('\n[SCENARIO B] expired BEFORE restart → reconciled on first sweep');
  {
    const { session: s } = await makeHostedGame(`RSTB ${ts}`);
    const code = s.roomCode;
    await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); // QUESTION_ACTIVE

    // Force the authoritative deadline into the past (status untouched).
    await prisma.session.update({
      where: { id: s.id },
      data: { questionEndsAt: new Date(Date.now() - 4000), autoAdvanceAt: null },
    });

    await stopServer();
    await startServer(); // FIRST sweep pass must reconcile immediately

    const locked = await poll(async () => getSession(code),
      (x) => x.status === 'QUESTION_LOCKED', 15000, 1000);
    check(locked.status === 'QUESTION_LOCKED',
      `Expired-on-startup question auto-locked by the FIRST sweep pass (status=${locked.status}) — no GM action`);
    const sysLock = await prisma.auditLog.findMany({
      where: { targetId: s.id, targetType: 'SESSION', action: 'QUESTION_LOCKED', adminUsername: 'SYSTEM' },
    });
    check(sysLock.length >= 1, `Startup reconcile audited with actor SYSTEM (n=${sysLock.length})`);

    const resultsB = await poll(async () => getSession(code),
      (x) => x.status === 'RESULTS', 25000, 1000);
    check(resultsB.status === 'RESULTS', `Startup-reconciled session completed to RESULTS without host interaction`);
  }

  await stopServer();
  await prisma.$disconnect();

  console.log(`\n================================================================`);
  console.log(`   RESULT: ${passed} PASSED / ${failed} FAILED`);
  console.log(`================================================================`);
  if (failed > 0) { console.log(`   First failure: ${lastFail}`); process.exit(1); }
  console.log('   RESTART-SAFE AUTO-LOCK ACCEPTANCE: PASS ✦');
}

main().catch(async (err) => {
  console.error('\nFATAL:', err.message);
  try { await stopServer(); } catch {}
  await prisma.$disconnect();
  process.exit(1);
});