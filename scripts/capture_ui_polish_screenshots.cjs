/**
 * scripts/capture_ui_polish_screenshots.cjs
 * 
 * Captures clean, high-resolution before/after screenshots of:
 * 1. Student Terminal Shell (Desktop 1920x1080 & Mobile 390x844)
 * 2. GM Host Question Stage (Locked Preview vs. Revealed State)
 * 3. Student Gameplay (Solo Cockpit Desktop, Mobile Responsive, Submitted State)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const API = 'http://localhost:3001/api';
const BASE_URL = 'http://localhost:5173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function seedAuth(page, token, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate(({ t, u }) => {
    localStorage.setItem('terminal_token', t);
    localStorage.setItem('token', t);
    localStorage.setItem('terminal_user', JSON.stringify(u));
    localStorage.setItem('terminal_player', JSON.stringify(u));
  }, { t: token, u: user });
}

async function main() {
  console.log('--- CAPTURING UI POLISH SCREENSHOTS ---');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const ts = Date.now();

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // AUTHENTICATE TEST ACCOUNTS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('[1] Setting up isolated GM and Student accounts...');
    
    // Auth GM
    const gmLogin = await axios.post(`${API}/auth/login`, {
      login: 'demo@terminal.dev',
      password: 'terminal123',
    });
    const gmToken = gmLogin.data.token;
    const gmUser = gmLogin.data.user;
    const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };

    // Register Student
    const studUname = `stud_${ts}`;
    const studEmail = `${studUname}@terminal.dev`;
    const studPass = 'password123';
    const studReg = await axios.post(`${API}/auth/register`, {
      username: studUname,
      email: studEmail,
      password: studPass,
      role: 'PLAYER',
      name: 'Agent Phoenix',
    });
    const studToken = studReg.data.token;
    const studUser = studReg.data.user;

    // ══════════════════════════════════════════════════════════════════════════
    // 1. STUDENT TERMINAL SHELL
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n[2] Capturing Student Terminal Shell (Desktop & Mobile)...');
    const termContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const termPage = await termContext.newPage();

    await seedAuth(termPage, studToken, studUser);
    await termPage.goto(`${BASE_URL}/terminal`);
    await termPage.waitForSelector('text=OPERATOR IDENTITY', { timeout: 10000 });
    await sleep(1500);

    await termPage.screenshot({
      path: path.join(SHOTS_DIR, '01_student_terminal_desktop.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 01_student_terminal_desktop.png (1920x1080)');

    // Mobile viewport
    await termPage.setViewportSize({ width: 390, height: 844 });
    await sleep(800);
    await termPage.screenshot({
      path: path.join(SHOTS_DIR, '01b_student_terminal_mobile.png'),
      fullPage: false,
    });
    console.log('  ✓ Captured 01b_student_terminal_mobile.png (390x844)');

    await termContext.close();

    // ══════════════════════════════════════════════════════════════════════════
    // 2. CREATE GAME & SESSION FOR HOST & GAMEPLAY
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n[3] Setting up Game with Python Code Snippet & Live Session...');

    const createRes = await axios.post(`${API}/games`, {
      name: `Tactical Cyber Assessment ${ts}`,
      description: 'Spatial layout and locked review validation game',
      template: 'QUIZ',
      maxPlayers: 20,
      teamsEnabled: false,
      speedBonus: false,
    }, gmHeaders);

    const gameId = createRes.data.game.id;

    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'SINGLE_CHOICE',
      prompt: "What is the output of the following bitwise operation in Python 3?\n\ndef compute_mask(a, b):\n    return (a ^ b) & 0x0F\n\nresult = compute_mask(14, 9)\nprint(result)\n\nSelect the exact numeric return value:",
      options: ['7', '5', '11', '0'],
      answer: '7',
      explanation: '14 is 1110 in binary, 9 is 1001. 14 ^ 9 = 0111 (7). 7 & 0x0F = 7. Thus the return value is 7.',
      timerSecs: 30,
      points: 40,
      position: 0,
    }, gmHeaders);

    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'SINGLE_CHOICE',
      prompt: "Which data structure provides O(1) amortized insertion in Python?",
      options: ['list.append()', 'list.insert(0)', 'tuple concatenation', 'sorted() list'],
      answer: 'list.append()',
      explanation: 'Python lists are dynamic arrays with over-allocation, yielding O(1) amortized time for append operations.',
      timerSecs: 30,
      points: 30,
      position: 1,
    }, gmHeaders);
    await axios.post(`${API}/games/${gameId}/publish`, {}, gmHeaders);

    const sessRes = await axios.post(`${API}/sessions`, { gameId }, gmHeaders);
    const roomCode = sessRes.data.session.roomCode;
    console.log(`  Room Code: ${roomCode}`);

    // Context for GM Host
    const gmContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const gmPage = await gmContext.newPage();
    await seedAuth(gmPage, gmToken, gmUser);
    await gmPage.goto(`${BASE_URL}/sessions/${roomCode}/host`);
    await gmPage.waitForSelector('text=LIVE GAME HOST', { timeout: 10000 });
    await sleep(1500);

    // Context for Student
    const studContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const studPage = await studContext.newPage();
    await seedAuth(studPage, studToken, studUser);
    await studPage.goto(`${BASE_URL}/join/${roomCode}`);
    await studPage.waitForSelector('button:has-text("ENTER SESSION")', { timeout: 10000 });
    await studPage.click('button:has-text("ENTER SESSION")');
    await sleep(1500);

    // GM starts game
    console.log('\n[4] GM starting game to Question 1...');
    await gmPage.click('button:has-text("START GAME")');
    await sleep(2500);

    // ══════════════════════════════════════════════════════════════════════════
    // 3. CAPTURE STUDENT GAMEPLAY (DESKTOP & MOBILE)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n[5] Capturing Student Gameplay (Desktop & Mobile)...');
    await studPage.screenshot({
      path: path.join(SHOTS_DIR, '02_student_gameplay_desktop.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 02_student_gameplay_desktop.png (1920x1080 Cockpit HUD)');

    await studPage.setViewportSize({ width: 390, height: 844 });
    await sleep(800);
    await studPage.screenshot({
      path: path.join(SHOTS_DIR, '02b_student_gameplay_mobile.png'),
      fullPage: false,
    });
    console.log('  ✓ Captured 02b_student_gameplay_mobile.png (390x844 Mobile telemetry)');

    // Restore desktop size
    await studPage.setViewportSize({ width: 1920, height: 1080 });
    await sleep(500);

    // Capture GM Host Active Question Stage
    await gmPage.screenshot({
      path: path.join(SHOTS_DIR, '03_gm_host_question_active.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 03_gm_host_question_active.png (Reserved Height Question Stage)');

    // Student Submits Answer
    console.log('\n[6] Student submitting answer...');
    await studPage.click('button:has-text("7")');
    await sleep(400);
    await studPage.click('button:has-text("SUBMIT ANSWER")');
    await sleep(1200);

    await studPage.screenshot({
      path: path.join(SHOTS_DIR, '02c_student_answer_submitted.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 02c_student_answer_submitted.png (Neutral locked receipt)');

    // ══════════════════════════════════════════════════════════════════════════
    // 4. GM HOST LOCKED PREVIEW VS REVEALED STATE
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n[7] Driving game to final review stage...');
    await axios.post(`${API}/sessions/${roomCode}/lock`, {}, gmHeaders);
    await sleep(400);
    await axios.post(`${API}/sessions/${roomCode}/next`, {}, gmHeaders);
    await sleep(600);
    await axios.post(`${API}/sessions/${roomCode}/lock`, {}, gmHeaders);
    await sleep(400);
    await axios.post(`${API}/sessions/${roomCode}/next`, {}, gmHeaders); // RESULTS state
    await sleep(2500);

    // GM Host Locked Answer Preview
    console.log('[8] Capturing GM Host Question Stage BEFORE Reveal (LOCKED PREVIEW)...');
    await gmPage.screenshot({
      path: path.join(SHOTS_DIR, '04_gm_question_stage_locked.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 04_gm_question_stage_locked.png (ANSWERS SEALED badge, stable height)');

    // GM Reveals Answers
    console.log('[9] GM revealing answers and explanations...');
    const revealBtn = await gmPage.$('button:has-text("REVEAL ANSWERS & EXPLANATIONS")');
    if (revealBtn) {
      await revealBtn.click();
    } else {
      await axios.post(`${API}/sessions/${roomCode}/reveal`, {}, gmHeaders);
    }
    await sleep(2000);

    // GM Host Revealed Answer State
    console.log('[10] Capturing GM Host Question Stage AFTER Reveal (REVEALED STATE)...');
    await gmPage.screenshot({
      path: path.join(SHOTS_DIR, '05_gm_question_stage_revealed.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 05_gm_question_stage_revealed.png (Smooth reveal, stable leaderboard)');

    // Student Post-Game Review Screen
    await sleep(1000);
    await studPage.screenshot({
      path: path.join(SHOTS_DIR, '06_student_review_revealed.png'),
      fullPage: true,
    });
    console.log('  ✓ Captured 06_student_review_revealed.png (Student review with explanation)');

    console.log('\n================================================================');
    console.log('   ALL POLISHED UI SCREENSHOTS CAPTURED SUCCESSFULLY!           ');
    console.log('================================================================');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

main();
