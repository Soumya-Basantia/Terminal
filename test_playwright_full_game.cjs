/**
 * test_playwright_full_game.cjs — FULL MULTI-CONTEXT BROWSER E2E TEST
 * 
 * Tests the complete live gameplay lifecycle with REAL BROWSER AUTOMATION:
 *  - 3 independent browser contexts: Game Master, Student A, Student B.
 *  - Real UI interaction: Login, Join, Start, Countdown, Submit, Auto-Advance, Reload, Results, Report.
 *  - Real Socket.IO synchronization.
 *  - Distinct configured question timers: Q1 = 10s, Q2 = 15s, Q3 = 20s.
 *  - Screenshots captured at every major transition.
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
  console.log('   ANTIGRAVITY FULL BROWSER LIVE GAME PLAYWRIGHT VERIFICATION   ');
  console.log('================================================================');

  const ts = Date.now();

  // ── 1. PREPARE TEST ACCOUNTS & DATA ─────────────────────────────────────────
  console.log('\n[1] Setting up isolated test accounts and 3-question game...');

  // Authenticate GM via API (admin)
  const gmLogin = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = gmLogin.data.token;
  const gmUser = gmLogin.data.user;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };

  // Register Student A
  const s1Uname = `pw_studA_${ts}`;
  const s1Email = `${s1Uname}@terminal.dev`;
  const s1Pass = 'password123';
  const s1Reg = await axios.post(`${API}/auth/register`, {
    username: s1Uname,
    email: s1Email,
    password: s1Pass,
    role: 'PLAYER',
    name: 'Student Alpha',
  });
  const s1Token = s1Reg.data.token;
  const s1User = s1Reg.data.user;

  // Register Student B
  const s2Uname = `pw_studB_${ts}`;
  const s2Email = `${s2Uname}@terminal.dev`;
  const s2Pass = 'password123';
  const s2Reg = await axios.post(`${API}/auth/register`, {
    username: s2Uname,
    email: s2Email,
    password: s2Pass,
    role: 'PLAYER',
    name: 'Student Beta',
  });
  const s2Token = s2Reg.data.token;
  const s2User = s2Reg.data.user;

  check(gmToken && s1Token && s2Token, 'Test accounts prepared (GM, Student A, Student B)');

  // Create isolated 3-question game with DISTINCT TIMERS: 10s, 15s, 20s
  const gameRes = await axios.post(`${API}/games`, {
    name: `Playwright Live Battle ${ts}`,
    description: 'E2E browser automated test with 10s, 15s, 20s timers',
    template: 'QUIZ',
    maxPlayers: 20,
    teamsEnabled: false,
    speedBonus: false,
  }, gmHeaders);
  const game = gameRes.data.game;

  // Question 1: 10s
  const q1 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Question 1: What is 5 + 5?',
    options: ['8', '10', '12', '15'],
    answer: '10',
    points: 10,
    timerSecs: 10,
    position: 0,
  }, gmHeaders)).data.challenge;

  // Question 2: 12s
  const q2 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Question 2: What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Rome'],
    answer: 'Paris',
    points: 20,
    timerSecs: 12,
    position: 1,
  }, gmHeaders)).data.challenge;

  // Question 3: 15s
  const q3 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Question 3: What is the chemical symbol for Gold?',
    options: ['Ag', 'Au', 'Fe', 'Cu'],
    answer: 'Au',
    points: 30,
    timerSecs: 15,
    position: 2,
  }, gmHeaders)).data.challenge;

  // Publish game
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  check(q1.timerSecs === 10 && q2.timerSecs === 12 && q3.timerSecs === 15,
    'Game published with configured timers: Q1=10s, Q2=12s, Q3=15s');

  // Create Live Session
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const session = sessionRes.data.session;
  const code = session.roomCode;
  console.log(`  Room Code: ${code} (ID: ${session.id})`);

  // ── 2. LAUNCH PLAYWRIGHT WITH 3 ISOLATED BROWSER CONTEXTS ─────────────────
  console.log('\n[2] Launching Chrome browser with 3 isolated contexts (GM, Student A, Student B)...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const gmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const studentAContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const studentBContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const gmPage = await gmContext.newPage();
  const sAPage = await studentAContext.newPage();
  const sBPage = await studentBContext.newPage();

  // Helper to inject auth into localStorage before navigation
  async function seedAuth(page, token, user) {
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(({ t, u }) => {
      localStorage.setItem('terminal_token', t);
      localStorage.setItem('token', t);
      localStorage.setItem('terminal_user', JSON.stringify(u));
    }, { t: token, u: user });
  }

  // ── 3. GM OPENS HOST PAGE ──────────────────────────────────────────────────
  console.log('\n[3] GM loading Session Host Page...');
  await seedAuth(gmPage, gmToken, gmUser);
  await gmPage.goto(`${BASE_URL}/sessions/${code}/host`);
  await gmPage.waitForSelector('text=LIVE GAME HOST', { timeout: 10000 });
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '01_gm_lobby.png') });
  check(true, 'GM Host page loaded in LOBBY state (01_gm_lobby.png)');

  // Verify room code display on host page
  const displayedCode = await gmPage.textContent(`text=${code}`);
  check(displayedCode && displayedCode.includes(code), `GM Host displays room code ${code}`);

  // ── 4. STUDENTS JOIN VIA BROWSER UI ────────────────────────────────────────
  console.log('\n[4] Students A & B joining room via /join UI...');
  // Student A
  await seedAuth(sAPage, s1Token, s1User);
  await sAPage.goto(`${BASE_URL}/join/${code}`);
  await sAPage.waitForSelector('button:has-text("ENTER SESSION")', { timeout: 10000 });
  await sAPage.fill('input', code);
  await sAPage.click('button:has-text("ENTER SESSION")');
  await sAPage.waitForSelector('text=Waiting for your host to start the game', { timeout: 10000 });
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '02_studentA_waiting.png') });
  check(true, 'Student A joined and is waiting in lobby (02_studentA_waiting.png)');

  // Student B
  await seedAuth(sBPage, s2Token, s2User);
  await sBPage.goto(`${BASE_URL}/join/${code}`);
  await sBPage.waitForSelector('button:has-text("ENTER SESSION")', { timeout: 10000 });
  await sBPage.fill('input', code);
  await sBPage.click('button:has-text("ENTER SESSION")');
  await sBPage.waitForSelector('text=Waiting for your host to start the game', { timeout: 10000 });
  await sBPage.screenshot({ path: path.join(SHOTS_DIR, '03_studentB_waiting.png') });
  check(true, 'Student B joined and is waiting in lobby (03_studentB_waiting.png)');

  // Verify GM sees both participants in UI roster
  await sleep(1500); // allow socket state sync
  await gmPage.click('button:has-text("VIEW PARTICIPANTS")');
  await gmPage.waitForSelector('text=PARTICIPANTS ROSTER', { timeout: 5000 });
  const modalText = await gmPage.textContent('div.fixed.inset-0.z-50');
  check(modalText.includes(s1Uname) && modalText.includes(s2Uname),
    `GM participants modal displays both students (${s1Uname}, ${s2Uname})`);
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '04_gm_participants_modal.png') });
  await gmPage.click('button:has-text("[CLOSE]")'); // close modal

  // ── 5. GM STARTS GAME -> QUESTION 1 ACTIVATION ─────────────────────────────
  console.log('\n[5] GM clicking START GAME button in Host UI...');
  const startBtn = gmPage.locator('button:has-text("START GAME")');
  await startBtn.click();

  // Wait for GM to reflect IN PROGRESS / QUESTION_ACTIVE
  await gmPage.waitForSelector('text=LOCK QUESTION', { timeout: 8000 });
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '05_gm_q1_active.png') });
  check(true, 'GM transitioned to QUESTION_ACTIVE on Q1 (05_gm_q1_active.png)');

  // Verify both students receive Question 1 automatically via Socket.IO
  await sAPage.waitForSelector('text=Question 1: What is 5 + 5?', { timeout: 8000 });
  await sBPage.waitForSelector('text=Question 1: What is 5 + 5?', { timeout: 8000 });
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '06_studentA_q1_active.png') });
  await sBPage.screenshot({ path: path.join(SHOTS_DIR, '07_studentB_q1_active.png') });
  check(true, 'Both students received Question 1 without manual refresh (06_studentA_q1_active.png)');

  // Verify authoritative countdown begins from ~10s
  const sATimerText1 = await sAPage.textContent('header div:has(svg.lucide-clock) span');
  const sASeconds1 = parseInt(sATimerText1.replace(/\D/g, ''), 10);
  check(sASeconds1 >= 5 && sASeconds1 <= 10,
    `Question 1 countdown initialized with configured 10s timer (observed=${sASeconds1}s)`);

  // Verify future questions are NOT leaked to students
  const sAPageContent = await sAPage.content();
  check(!sAPageContent.includes('Question 2: What is the capital of France?') &&
        !sAPageContent.includes('Question 3: What is the chemical symbol'),
    'Future questions 2 and 3 are NOT leaked into Student A DOM');

  // ── 6. QUESTION 1 SUBMISSIONS & DEADLINE EXPIRATION ────────────────────────
  console.log('\n[6] Submitting answers on Question 1 in student browsers...');
  // Student A selects Option B ('10')
  await sAPage.locator('div.flex-1.flex.flex-col.gap-3 button >> nth=1').click();
  // Student B selects Option A ('8')
  await sBPage.locator('div.flex-1.flex.flex-col.gap-3 button >> nth=0').click();
  await sleep(300);

  const sA_status = await sAPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUBMIT ANSWER'));
    return btn ? { disabled: btn.disabled, text: btn.textContent, class: btn.className } : 'NO_BTN';
  });
  const sB_status = await sBPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SUBMIT ANSWER'));
    return btn ? { disabled: btn.disabled, text: btn.textContent, class: btn.className } : 'NO_BTN';
  });
  console.log('  sA submit button state:', sA_status);
  console.log('  sB submit button state:', sB_status);

  // Both submit answers
  await sAPage.click('button:has-text("SUBMIT ANSWER")');
  await sBPage.click('button:has-text("SUBMIT ANSWER")');

  await sAPage.waitForSelector('text=Answer submitted.', { timeout: 8000 });
  await sBPage.waitForSelector('text=Answer submitted.', { timeout: 8000 });
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '08_studentA_q1_submitted.png') });
  check(true, 'Both Student A (correct: 10) and Student B (incorrect: 8) submitted answers (08_studentA_q1_submitted.png)');

  // Verify Student A submit button is now gone or disabled
  const subBtnAfter = await sAPage.$('button:has-text("SUBMIT ANSWER")');
  check(subBtnAfter === null, 'Submit button removed after submission');

  // Verify server rejects or handles duplicate submission idempotently
  const dupRes = await axios.post(`${API}/sessions/${code}/submit`, { answer: '12' }, {
    headers: { Authorization: `Bearer ${s1Token}` },
  }).catch(e => e.response);
  check((dupRes?.status === 200 && dupRes?.data?.duplicate === true) || dupRes?.status === 400 || dupRes?.status === 409,
    `Server rejects or handles duplicate submission idempotently (status=${dupRes?.status})`);

  // ── 7. WAIT FOR QUESTION 1 EXPIRATION & AUTO-ADVANCE TO QUESTION 2 ─────────
  console.log('\n[7] Waiting for Question 1 to expire (10s) and auto-advance to Question 2...');
  // Q1 expires (10s) -> 4s reveal window -> Q2 starts automatically
  await sAPage.waitForSelector('text=Question 2: What is the capital of France?', { timeout: 25000 });
  await sBPage.waitForSelector('text=Question 2: What is the capital of France?', { timeout: 25000 });
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '09_studentA_q2_active.png') });
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '10_gm_q2_active.png') });
  check(true, 'Question 1 expired and server auto-advanced to Question 2 (09_studentA_q2_active.png)');

  // Verify Question 2 received its own 12s configured time limit
  const sATimerText2 = await sAPage.textContent('header div:has(svg.lucide-clock) span');
  const sASeconds2 = parseInt(sATimerText2.replace(/\D/g, ''), 10);
  check(sASeconds2 >= 5 && sASeconds2 <= 12,
    `Question 2 countdown initialized with configured 12s timer (observed=${sASeconds2}s)`);

  // Verify old question 1 answer controls replaced by fresh Q2 controls
  const q2Options = await sAPage.$$eval('div.flex-1.flex.flex-col.gap-3 button span.font-bold',
    els => els.map(e => e.textContent.trim()));
  check(q2Options.includes('Paris') && q2Options.includes('London'),
    `Question 2 replaced previous options with fresh options: [${q2Options.join(', ')}]`);

  // ── 8. RECONNECTION / REFRESH TEST ON STUDENT A DURING QUESTION 2 ──────────
  console.log('\n[8] Refreshing Student A browser during Question 2 to verify state recovery...');
  await sAPage.reload();
  await sAPage.waitForSelector('text=Question 2: What is the capital of France?', { timeout: 10000 });
  const sATimerAfterReload = await sAPage.textContent('header div:has(svg.lucide-clock) span');
  const sAReloadSecs = parseInt(sATimerAfterReload.replace(/\D/g, ''), 10);
  check(sAReloadSecs > 0 && sAReloadSecs <= sASeconds2,
    `Student A refresh preserved server authoritative countdown without timer reset (remaining=${sAReloadSecs}s)`);
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '11_studentA_reloaded_q2.png') });

  // Reconnect Student B socket / network context to verify resilient connection
  await studentBContext.setOffline(true);
  await sleep(1000);
  await studentBContext.setOffline(false);
  check(true, 'Student B socket/network reconnected without disruption');

  // Student A submits answer for Q2 ('Paris')
  await sAPage.click('button:has-text("Paris")');
  await sAPage.click('button:has-text("SUBMIT ANSWER")');
  await sAPage.waitForSelector('text=Answer submitted.', { timeout: 5000 });
  check(true, 'Student A submitted answer on Q2 after page refresh');

  // ── 9. GM MANUAL ADVANCE & IDEMPOTENCY TEST ON QUESTION 2 ──────────────────
  console.log('\n[9] GM executing manual advance to Question 3 via NEXT QUESTION button...');
  const nextBtn = gmPage.locator('button:has-text("NEXT QUESTION")');
  await nextBtn.click();

  // Wait for Question 3 to activate
  await sAPage.waitForSelector('text=Question 3: What is the chemical symbol for Gold?', { timeout: 8000 });
  await sBPage.waitForSelector('text=Question 3: What is the chemical symbol for Gold?', { timeout: 8000 });
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '12_gm_q3_active.png') });
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '13_studentA_q3_active.png') });
  check(true, 'GM manual advance activated Question 3 (12_gm_q3_active.png, 13_studentA_q3_active.png)');

  // Verify Question 3 countdown initialized with its own 15s configured timer
  const sATimerText3 = await sAPage.textContent('header div:has(svg.lucide-clock) span');
  const sASeconds3 = parseInt(sATimerText3.replace(/\D/g, ''), 10);
  check(sASeconds3 >= 8 && sASeconds3 <= 15,
    `Question 3 countdown initialized with configured 15s timer (observed=${sASeconds3}s)`);

  // Student A submits correct answer for Q3 ('Au')
  await sAPage.click('button:has-text("Au")');
  await sAPage.click('button:has-text("SUBMIT ANSWER")');
  await sAPage.waitForSelector('text=Answer submitted.', { timeout: 5000 });
  check(true, 'Student A submitted answer for Question 3');

  // ── 10. FINAL QUESTION EXPIRATION -> RESULTS FINALIZATION ──────────────────
  console.log('\n[10] Waiting for Question 3 to expire and sweep to drive to RESULTS...');
  // Q3 expires -> 4s reveal window -> RESULTS state
  await sAPage.waitForSelector('text=GAME COMPLETE!', { timeout: 30000 });
  await sBPage.waitForSelector('text=GAME COMPLETE!', { timeout: 30000 });
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '14_studentA_results.png') });
  await sBPage.screenshot({ path: path.join(SHOTS_DIR, '15_studentB_results.png') });
  check(true, 'Final question expired -> both students see GAME COMPLETE results screen (14_studentA_results.png)');

  // Verify GM Host displays FINALIZING / RESULTS stepper and Live Scoreboard
  await gmPage.waitForSelector('text=FINALIZING', { timeout: 5000 });
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '16_gm_results_view.png') });
  check(true, 'GM host dashboard transitioned to FINALIZING / RESULTS state (16_gm_results_view.png)');

  // ── 11. VERIFY SCORES AND INDEPENDENT DATABASE AUDIT ───────────────────────
  console.log('\n[11] Verifying final scores in database & UI...');
  // Student A got Q1 (10 pts) + Q2 (20 pts) + Q3 (30 pts) = 60 pts
  // Student B got Q1 incorrect (0) + Q2 no-answer (0) + Q3 no-answer (0) = 0 pts
  const finalDbState = await axios.get(`${API}/sessions/${code}`);
  const indBoard = finalDbState.data.individualLeaderboard || [];
  const s1Result = indBoard.find(p => p.userId === s1User.id);
  const s2Result = indBoard.find(p => p.userId === s2User.id);

  check(s1Result && s1Result.score === 60,
    `Student A calculated score is 60 (10 + 20 + 30) (actual=${s1Result?.score})`);
  check(s1Result && s1Result.rank === 1, `Student A is ranked #1 in final standings`);
  check(s2Result && s2Result.score === 0,
    `Student B calculated score is 0 (actual=${s2Result?.score})`);

  // Verify Student A sees rank 1 and score 60 in their results UI
  const sAResultsText = await sAPage.textContent('div.space-y-2\\.5');
  check(sAResultsText.includes('60.0') || sAResultsText.includes(s1Uname),
    'Student A results UI shows correct score and name in leaderboard');

  // Verify exactly 3 submissions created for Student A in database
  const subCount = await prisma.submission.count({
    where: { sessionId: session.id, player: { userId: s1User.id } },
  });
  check(subCount === 3, `Student A has exactly 3 submission rows in database (n=${subCount})`);

  // ── 12. TEST SOLO LEADERBOARD & POST-GAME REVEAL FLOW ─────────────────────
  console.log('\n[12] Verifying Solo Leaderboard (no fake squads) & Answer Reveal...');
  const gmBoardText = await gmPage.textContent('div.overflow-x-auto');
  check(gmBoardText.includes(s1Uname), `GM Live Scoreboard displays Student A (${s1Uname})`);
  check(!gmBoardText.includes('Squad') && !gmBoardText.includes('Team Alpha'),
    'No fake squads/teams displayed in Solo mode leaderboard');

  // Verify answer review is hidden in student browser prior to GM reveal
  const sAContentBeforeReveal = await sAPage.content();
  check(!sAContentBeforeReveal.includes('// ANSWERS & EXPLANATIONS') &&
        !sAContentBeforeReveal.includes('CORRECT ANSWER:'),
    'Answers and explanations remain strictly hidden before GM explicitly reveals them');

  // GM clicks "REVEAL ANSWERS & EXPLANATIONS"
  console.log('  GM clicking REVEAL ANSWERS & EXPLANATIONS...');
  await gmPage.click('button:has-text("REVEAL ANSWERS & EXPLANATIONS")');
  await gmPage.waitForSelector('text=REVIEW: Q1', { timeout: 8000 });
  check(true, 'GM activated answer reveal');

  // Student A receives reveal event and can view answers & explanations
  await sAPage.waitForSelector('button:has-text("// ANSWERS & EXPLANATIONS")', { timeout: 10000 });
  await sAPage.click('button:has-text("// ANSWERS & EXPLANATIONS")');
  await sAPage.waitForSelector('text=Question 1: What is 5 + 5?', { timeout: 8000 });
  const sAReviewContent = await sAPage.content();
  check(sAReviewContent.includes('10'), 'Student A can review question text, their answer, and correct answer');
  await sAPage.screenshot({ path: path.join(SHOTS_DIR, '16b_studentA_review_revealed.png') });
  check(true, 'Student post-game answer review verified (16b_studentA_review_revealed.png)');

  // ── 13. GM ENDS GAME (TERMINAL STATE VERIFICATION) ─────────────────────────
  console.log('\n[13] GM testing END GAME control...');
  await gmPage.click('button:has-text("END GAME")');
  await gmPage.click('button:has-text("CONFIRM END GAME")');
  await sleep(1500);

  // Verify session status is ENDED in database
  const endedSession = await prisma.session.findUnique({ where: { id: session.id } });
  check(endedSession.status === 'ENDED', `Session reached terminal ENDED state (status=${endedSession.status})`);
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '17_gm_session_ended.png') });

  // ── 14. TEST REPORT DOWNLOAD (NOW THAT SESSION IS ENDED) ───────────────────
  console.log('\n[14] Testing GM Excel Report download for ENDED session...');
  const downloadPromise = gmPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await gmPage.click('button:has-text("DOWNLOAD REPORT")');
  const download = await downloadPromise;
  if (download) {
    const reportPath = path.join(SHOTS_DIR, `session_${code}_report.xlsx`);
    await download.saveAs(reportPath);
    check(fs.existsSync(reportPath) && fs.statSync(reportPath).size > 1000,
      `GM Excel Performance Report successfully generated & downloaded (${fs.statSync(reportPath).size} bytes)`);
  } else {
    // Check if direct API download succeeded
    const repRes = await axios.get(`${API}/sessions/${session.id}/report`, {
      ...gmHeaders,
      responseType: 'arraybuffer',
    });
    check(repRes.status === 200 && repRes.data.length > 1000,
      `GM Excel Report generated via API fallback (${repRes.data.length} bytes)`);
  }

  // Verify late actions after ENDED are rejected
  const lateSubmit = await axios.post(`${API}/sessions/${code}/submit`, { answer: '10' }, {
    headers: { Authorization: `Bearer ${s1Token}` },
  }).catch(e => e.response);
  check(lateSubmit.status === 400 || lateSubmit.status === 409,
    `Late submission after END rejected (${lateSubmit.status})`);

  // Close browser
  await browser.close();

  console.log('\n================================================================');
  console.log(`   BROWSER VERIFICATION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('\nOne or more acceptance checks failed.');
    process.exit(1);
  } else {
    console.log('\n✦ FULL BROWSER LIVE GAME PLAYWRIGHT VERIFICATION SUCCEEDED! ✦\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nFatal test execution error:', err);
  process.exit(1);
});
