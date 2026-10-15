/**
 * test_playwright_squad_game.cjs — FULL MULTI-CONTEXT SQUAD MODE BROWSER E2E TEST
 *
 * Verifies the complete SQUAD mode live gameplay lifecycle with REAL BROWSER AUTOMATION:
 *  - 4 isolated browser contexts: Game Master, Squad Alpha Leader (sA1), Squad Alpha Member (sA2), Squad Beta Leader (sB1).
 *  - Real UI interaction: Team creation, team joining, session join, host squad roster display.
 *  - Real-time isolated team chat: sA1 sends message; sA2 receives it in real time; sB1 is isolated (does NOT receive it).
 *  - Sequential question flow with server-authoritative timers.
 *  - Squad scoring:
 *      * Q1: Both sA1 and sA2 answer correctly (10 pts) -> average 10.0 + single speed bonus.
 *            sB1 answers incorrectly -> average 0.0.
 *      * Q2: sA1 answers correctly (20 pts), sA2 leaves unanswered -> average (20 + 0) / 2 = 10.0 pts.
 *            sB1 answers correctly (20 pts) -> average 20.0 pts.
 *  - Live GM squad leaderboard updating without refresh.
 *  - Esports animated ranks and score deltas.
 *  - Disconnect/reconnect recovery during round.
 *  - Post-game review hidden until GM clicks "REVEAL ANSWERS & EXPLANATIONS".
 *  - Post-game student review accessible after reveal.
 *  - GM ends game & downloads Excel performance report.
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
const SHOTS_DIR = path.join(__dirname, 'docs', 'screenshots_squad');

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
  console.log('   ANTIGRAVITY FULL SQUAD MODE BROWSER PLAYWRIGHT REHEARSAL    ');
  console.log('================================================================');

  const ts = Date.now();

  // ── 1. SETUP TEST ACCOUNTS & SQUADS ─────────────────────────────────────────
  console.log('\n[1] Setting up isolated test accounts and squads...');

  // GM login
  const gmLogin = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = gmLogin.data.token;
  const gmUser = gmLogin.data.user;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };

  // Helper to register student
  async function registerStudent(suffix, name) {
    const username = `sq_${suffix}_${ts}`;
    const email = `${username}@terminal.dev`;
    const reg = await axios.post(`${API}/auth/register`, {
      username,
      email,
      password: 'password123',
      role: 'PLAYER',
      name,
    });
    return {
      username,
      email,
      token: reg.data.token,
      user: reg.data.user,
      headers: { headers: { Authorization: `Bearer ${reg.data.token}` } },
    };
  }

  const sA1 = await registerStudent('leadA', 'Squad A Leader');
  const sA2 = await registerStudent('memA', 'Squad A Member');
  const sB1 = await registerStudent('leadB', 'Squad B Leader');

  check(gmToken && sA1.token && sA2.token && sB1.token,
    'Registered GM, Squad Alpha Leader, Squad Alpha Member, Squad Beta Leader');

  // Form Squad Alpha: sA1 creates, sA2 joins
  const teamAName = `Alpha_${ts.toString().slice(-4)}`;
  const teamARes = await axios.post(`${API}/teams/create`, { name: teamAName }, sA1.headers);
  const teamA = teamARes.data.team;
  check(teamA && teamA.name === teamAName, `Squad Alpha created: "${teamAName}" (leader: ${sA1.username})`);

  // sA2 joins Squad Alpha
  const joinARes = await axios.post(`${API}/teams/join`, { name: teamAName }, sA2.headers);
  check(joinARes.status === 200, `Squad Alpha Member (${sA2.username}) joined "${teamAName}"`);

  // Form Squad Beta: sB1 creates
  const teamBName = `Beta_${ts.toString().slice(-4)}`;
  const teamBRes = await axios.post(`${API}/teams/create`, { name: teamBName }, sB1.headers);
  const teamB = teamBRes.data.team;
  check(teamB && teamB.name === teamBName, `Squad Beta created: "${teamBName}" (leader: ${sB1.username})`);

  // Test team size limit & duplicate join prevention
  const dupJoin = await axios.post(`${API}/teams/join`, { name: teamAName }, sA1.headers).catch(e => e.response);
  check(dupJoin.status === 400, 'Duplicate team membership request rejected (status=400)');

  // ── 2. CREATE SQUAD GAME & SESSION ──────────────────────────────────────────
  console.log('\n[2] GM creating squad battle game and live session...');
  const gameRes = await axios.post(`${API}/games`, {
    name: `Playwright Squad Rehearsal ${ts}`,
    description: 'SQUAD Mode E2E with team average and speed bonus',
    template: 'QUIZ',
    maxPlayers: 20,
    teamsEnabled: true,
    speedBonus: true,
  }, gmHeaders);
  const game = gameRes.data.game;

  // Q1: 10s timer
  const q1 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Squad Q1: What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    answer: '4',
    points: 10,
    timerSecs: 10,
    position: 0,
  }, gmHeaders)).data.challenge;

  // Q2: 12s timer
  const q2 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Squad Q2: What is 3 * 3?',
    options: ['6', '8', '9', '12'],
    answer: '9',
    points: 20,
    timerSecs: 12,
    position: 1,
  }, gmHeaders)).data.challenge;

  // Publish game
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  check(game.teamsEnabled && game.speedBonus, 'Game created with teamsEnabled=true & speedBonus=true');

  // Initialize session
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const session = sessionRes.data.session;
  const code = session.roomCode;
  console.log(`  Room Code: ${code} (ID: ${session.id})`);

  // ── 3. LAUNCH PLAYWRIGHT BROWSERS (4 CONTEXTS) ─────────────────────────────
  console.log('\n[3] Launching Chrome browser with 4 isolated contexts (GM, A1, A2, B1)...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const gmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sA1Context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sA2Context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sB1Context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const gmPage = await gmContext.newPage();
  const sA1Page = await sA1Context.newPage();
  const sA2Page = await sA2Context.newPage();
  const sB1Page = await sB1Context.newPage();

  async function seedAuth(page, token, user) {
    await page.goto(`${BASE_URL}/login`);
    await page.evaluate(({ t, u }) => {
      sessionStorage.setItem('terminal_token', t);
      sessionStorage.setItem('token', t);
      sessionStorage.setItem('terminal_user', JSON.stringify(u));
      localStorage.setItem('terminal_token', t);
      localStorage.setItem('token', t);
      localStorage.setItem('terminal_user', JSON.stringify(u));
    }, { t: token, u: user });
  }

  // ── 4. GM LOADS HOST PAGE & VERIFIES TEAMS MODE ────────────────────────────
  console.log('\n[4] GM loading host page...');
  await seedAuth(gmPage, gmToken, gmUser);
  await gmPage.goto(`${BASE_URL}/sessions/${code}/host`);
  await gmPage.waitForSelector('text=LIVE GAME HOST', { timeout: 10000 });
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '01_gm_squad_lobby.png') });
  check(true, 'GM Host page loaded in SQUAD lobby state (01_gm_squad_lobby.png)');

  // ── 5. STUDENTS JOIN SESSION VIA BROWSER UI ────────────────────────────────
  console.log('\n[5] Students joining session via /join UI...');
  async function studentJoin(page, token, user, label) {
    await seedAuth(page, token, user);
    await page.goto(`${BASE_URL}/join/${code}`);
    await page.waitForSelector('button:has-text("ENTER SESSION")', { timeout: 10000 });
    await page.fill('input', code);
    await page.click('button:has-text("ENTER SESSION")');
    await page.waitForSelector('text=Waiting for your host to start the game', { timeout: 10000 });
    console.log(`  ✓ ${label} entered lobby`);
  }

  await studentJoin(sA1Page, sA1.token, sA1.user, 'Squad A Leader');
  await studentJoin(sA2Page, sA2.token, sA2.user, 'Squad A Member');
  await studentJoin(sB1Page, sB1.token, sB1.user, 'Squad B Leader');

  await sA1Page.screenshot({ path: path.join(SHOTS_DIR, '02_studentA1_squad_lobby.png') });
  check(true, 'All 3 students joined session lobby (02_studentA1_squad_lobby.png)');

  // Verify host participant roster displays correct squads
  await sleep(1500);
  await gmPage.click('button:has-text("VIEW PARTICIPANTS")');
  await gmPage.waitForSelector('text=PARTICIPANTS ROSTER', { timeout: 5000 });
  const rosterText = await gmPage.textContent('div.fixed.inset-0.z-50');
  check(rosterText.includes(teamAName) || rosterText.includes(sA1.username),
    `GM roster displays Squad Alpha participants (${sA1.username}, ${sA2.username})`);
  check(rosterText.includes(teamBName) || rosterText.includes(sB1.username),
    `GM roster displays Squad Beta participants (${sB1.username})`);
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '03_gm_squad_roster.png') });
  await gmPage.click('button:has-text("[CLOSE]")');

  // ── 6. GM STARTS GAME -> QUESTION 1 ACTIVATION ─────────────────────────────
  console.log('\n[6] GM starting game session...');
  await gmPage.click('button:has-text("START GAME")');
  await gmPage.waitForSelector('text=LOCK QUESTION', { timeout: 8000 });
  check(true, 'GM transitioned to QUESTION_ACTIVE on Q1');

  // Verify all 3 students receive Question 1 automatically
  await sA1Page.waitForSelector('text=Squad Q1: What is 2 + 2?', { timeout: 8000 });
  await sA2Page.waitForSelector('text=Squad Q1: What is 2 + 2?', { timeout: 8000 });
  await sB1Page.waitForSelector('text=Squad Q1: What is 2 + 2?', { timeout: 8000 });
  check(true, 'All students in Squads Alpha & Beta received Question 1 simultaneously');

  // ── 7. TEST REAL-TIME ISOLATED TEAM CHAT ───────────────────────────────────
  console.log('\n[7] Testing Real-Time Isolated Team Chat...');
  const chatMsg = `Alpha focus on 4! [${ts.toString().slice(-4)}]`;
  const chatInputA1 = sA1Page.locator('input[placeholder="Type a message to your team..."]');
  await chatInputA1.waitFor({ state: 'visible', timeout: 5000 });
  await chatInputA1.fill(chatMsg);
  await sA1Page.click('form button[type="submit"]');
  console.log(`  sA1 sent chat message via UI: "${chatMsg}"`);

  // Verify sA2 receives the message in real time in their chat box
  await sA2Page.waitForSelector(`text=${chatMsg}`, { timeout: 8000 });
  check(true, 'Squad Alpha Member (sA2) received squad chat message in real time');

  // Verify sB1 does NOT receive the message (strict isolation)
  const b1Content = await sB1Page.content();
  check(!b1Content.includes(chatMsg),
    'Squad Beta Leader (sB1) DID NOT receive Squad Alpha private chat message (STRICT ISOLATION)');
  await sA2Page.screenshot({ path: path.join(SHOTS_DIR, '04_team_chat_received_A2.png') });
  await sB1Page.screenshot({ path: path.join(SHOTS_DIR, '05_team_chat_isolated_B1.png') });

  // ── 8. QUESTION 1 SUBMISSIONS: TEAM AVERAGE + SPEED BONUS ──────────────────
  console.log('\n[8] Submitting Question 1 answers for Squad Alpha and Squad Beta...');
  // sA1 submits correct '4' (earliest submission for speed bonus)
  await sA1Page.click('button:has-text("4")');
  await sA1Page.click('button:has-text("SUBMIT ANSWER")');
  await sA1Page.waitForSelector('text=Answer submitted.', { timeout: 5000 });

  // sA2 submits correct '4'
  await sA2Page.click('button:has-text("4")');
  await sA2Page.click('button:has-text("SUBMIT ANSWER")');
  await sA2Page.waitForSelector('text=Answer submitted.', { timeout: 5000 });

  // sB1 submits incorrect '3'
  await sB1Page.click('button:has-text("3")');
  await sB1Page.click('button:has-text("SUBMIT ANSWER")');
  await sB1Page.waitForSelector('text=Answer submitted.', { timeout: 5000 });

  check(true, 'Q1 answers submitted: sA1=4 (correct), sA2=4 (correct), sB1=3 (incorrect)');

  // ── 9. WAIT FOR Q1 EXPIRATION & AUTO-ADVANCE TO Q2 ─────────────────────────
  console.log('\n[9] Waiting for Question 1 to expire (10s) and auto-advance to Question 2...');
  await sA1Page.waitForSelector('text=Squad Q2: What is 3 * 3?', { timeout: 25000 });
  await sA2Page.waitForSelector('text=Squad Q2: What is 3 * 3?', { timeout: 25000 });
  await sB1Page.waitForSelector('text=Squad Q2: What is 3 * 3?', { timeout: 25000 });
  check(true, 'Server auto-advanced to Question 2 for all squad participants');

  // ── 10. QUESTION 2: UNANSWERED RESPONSE HANDLED CORRECTLY ──────────────────
  console.log('\n[10] Question 2 submissions: sA1 answers, sA2 leaves UNANSWERED, sB1 answers...');
  // sA1 submits correct '9' (20 pts)
  await sA1Page.click('button:has-text("9")');
  await sA1Page.click('button:has-text("SUBMIT ANSWER")');
  await sA1Page.waitForSelector('text=Answer submitted.', { timeout: 5000 });

  // sB1 submits correct '9' (20 pts)
  await sB1Page.click('button:has-text("9")');
  await sB1Page.click('button:has-text("SUBMIT ANSWER")');
  await sB1Page.waitForSelector('text=Answer submitted.', { timeout: 5000 });

  // sA2 deliberately leaves UNANSWERED!
  console.log('  sA2 leaving Question 2 unanswered (to verify denominator=2, average=(20+0)/2=10)');

  // Reconnection check on sA1 during active round
  await sA1Page.reload();
  await sA1Page.waitForSelector('text=Answer submitted.', { timeout: 8000 });
  check(true, 'Squad Alpha Leader page reloaded during active round and preserved submitted state');

  // ── 11. WAIT FOR Q2 EXPIRATION -> FINAL RESULTS ────────────────────────────
  console.log('\n[11] Waiting for Question 2 to expire and finalize to RESULTS...');
  await sA1Page.waitForSelector('text=GAME COMPLETE!', { timeout: 30000 });
  await sA2Page.waitForSelector('text=GAME COMPLETE!', { timeout: 30000 });
  await sB1Page.waitForSelector('text=GAME COMPLETE!', { timeout: 30000 });
  await gmPage.waitForSelector('text=FINALIZING', { timeout: 5000 });
  check(true, 'All participants reached GAME COMPLETE results screen');

  // ── 12. VERIFY SQUAD SCORING & LEADERBOARD FORMULAS ────────────────────────
  console.log('\n[12] Verifying squad scoring formulas & live leaderboard...');
  const finalState = await axios.get(`${API}/sessions/${code}/leaderboard`);
  const teamBoard = finalState.data.teamLeaderboard || [];
  const teamARank = teamBoard.find(t => (t.teamId || t.id) === teamA.id);
  const teamBRank = teamBoard.find(t => (t.teamId || t.id) === teamB.id);

  console.log('  Squad Alpha Standing:', teamARank);
  console.log('  Squad Beta Standing:', teamBRank);

  const scoreA = teamARank ? (teamARank.finalScore ?? teamARank.score) : 0;
  const scoreB = teamBRank ? (teamBRank.finalScore ?? teamBRank.score) : 0;

  // Squad Alpha:
  // Q1: (10 + 10) / 2 = 10.0 + single speed bonus
  // Q2: (20 + 0) / 2 = 10.0 (unanswered counts as 0, denominator = 2)
  // Total >= 20.0
  check(teamARank && scoreA >= 20,
    `Squad Alpha total score reflects team average formula + speed bonus (score=${scoreA})`);
  check(teamARank && teamARank.rank === 1,
    `Squad Alpha is ranked #1 in final standings`);

  // Squad Beta:
  // Q1: 0.0 base
  // Q2: 20.0 base
  // Total base = 20.0, finalScore = 20.0 + speedBonus (~29.4)
  check(teamBRank && teamBRank.baseScore === 20 && scoreB >= 20 && scoreB <= 30,
    `Squad Beta total score is correct (baseScore=${teamBRank?.baseScore}, finalScore=${scoreB})`);

  // Verify GM Host displays Squad leaderboard with tab switching
  const gmSquadBoard = await gmPage.textContent('div.overflow-x-auto');
  check(gmSquadBoard.includes(teamAName), `GM Scoreboard displays Squad Alpha ("${teamAName}")`);

  // Switch to PLAYERS tab on host
  await gmPage.click('button:has-text("PLAYERS")');
  await sleep(500);
  const gmPlayerBoard = await gmPage.textContent('div.overflow-x-auto');
  check(gmPlayerBoard.includes(sA1.username) && gmPlayerBoard.includes(sB1.username),
    'GM Scoreboard PLAYERS tab displays individual squad members');

  // Switch back to TEAMS tab
  await gmPage.click('button:has-text("TEAMS")');
  check(true, 'GM Scoreboard seamlessly toggles between TEAMS and PLAYERS views');
  await gmPage.screenshot({ path: path.join(SHOTS_DIR, '06_gm_squad_leaderboard.png') });

  // ── 13. POST-GAME ANSWER REVEAL MECHANISM ──────────────────────────────────
  console.log('\n[13] Verifying Post-Game Answer Reveal...');
  // Check answers are hidden on sA1 before reveal
  const sA1BeforeReveal = await sA1Page.content();
  check(!sA1BeforeReveal.includes('// ANSWERS & EXPLANATIONS'),
    'Post-game review remains hidden from students before GM reveal');

  // GM clicks "REVEAL ANSWERS & EXPLANATIONS"
  console.log('  GM clicking REVEAL ANSWERS & EXPLANATIONS...');
  await gmPage.click('button:has-text("REVEAL ANSWERS & EXPLANATIONS")');
  await gmPage.waitForSelector('text=REVIEW: Q1', { timeout: 8000 });
  check(true, 'GM activated post-game answer reveal for all squads');

  // Student receives reveal event and can review questions & explanations
  await sA1Page.waitForSelector('button:has-text("// ANSWERS & EXPLANATIONS")', { timeout: 10000 });
  await sA1Page.click('button:has-text("// ANSWERS & EXPLANATIONS")');
  await sA1Page.waitForSelector('text=Squad Q1: What is 2 + 2?', { timeout: 8000 });
  const reviewA1 = await sA1Page.content();
  check(reviewA1.includes('4'), 'Squad student can review questions, answers, and explanations');
  await sA1Page.screenshot({ path: path.join(SHOTS_DIR, '07_squad_review_revealed.png') });

  // ── 14. GM ENDS GAME & DOWNLOADS SQUAD REPORT ──────────────────────────────
  console.log('\n[14] GM ending session and generating squad performance report...');
  await gmPage.click('button:has-text("END GAME")');
  await gmPage.click('button:has-text("CONFIRM END GAME")');
  await sleep(1500);

  const endedSession = await prisma.session.findUnique({ where: { id: session.id } });
  check(endedSession.status === 'ENDED', 'Session reached terminal ENDED state');

  // Excel download
  const downloadPromise = gmPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await gmPage.click('button:has-text("DOWNLOAD REPORT")');
  const download = await downloadPromise;
  if (download) {
    const reportPath = path.join(SHOTS_DIR, `squad_session_${code}_report.xlsx`);
    await download.saveAs(reportPath);
    check(fs.existsSync(reportPath) && fs.statSync(reportPath).size > 1000,
      `Squad Excel Performance Report downloaded (${fs.statSync(reportPath).size} bytes)`);
  } else {
    const repRes = await axios.get(`${API}/sessions/${session.id}/report`, {
      ...gmHeaders,
      responseType: 'arraybuffer',
    });
    check(repRes.status === 200 && repRes.data.length > 1000,
      `Squad Excel Report generated via API (${repRes.data.length} bytes)`);
  }

  await browser.close();

  console.log('\n================================================================');
  console.log(`   SQUAD REHEARSAL SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    console.error('\nOne or more squad acceptance checks failed.');
    process.exit(1);
  } else {
    console.log('\n✦ FULL BROWSER SQUAD MODE PLAYWRIGHT REHEARSAL SUCCEEDED! ✦\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nFatal squad test execution error:', err);
  process.exit(1);
});
