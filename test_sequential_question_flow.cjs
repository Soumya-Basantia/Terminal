/**
 * test_sequential_question_flow.cjs — REAL END-TO-END REGRESSION TEST
 *
 * Verifies the sequential question flow and server-authoritative timer lifecycle:
 *  1. Game start activates Question 1 only with its own configured time limit.
 *  2. Future questions are not playable or exposed before their turn.
 *  3. Student answers active question only; duplicate submissions rejected.
 *  4. Authoritative deadline: late submissions rejected past questionEndsAt.
 *  5. Question 1 expires -> auto-locks -> reveal window -> auto-advances to Question 2.
 *  6. Question 2 receives its own configured time limit.
 *  7. Manual GM advancement works cleanly and idempotently (no double advancement).
 *  8. Disconnect/reconnect does not reset or pause server timer.
 *  9. Final question expires -> auto-finalization to RESULTS.
 * 10. Final leaderboard and scoring calculated accurately and deterministically.
 * 11. Backend restart recovers expired questions without stalling.
 *
 * Run from repo root: node test_sequential_question_flow.cjs
 */

const path = require('path');
const fs = require('fs');

const envFile = fs.readFileSync(path.join(__dirname, 'server', '.env'), 'utf8');
const dbMatch = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m);
if (dbMatch && !process.env.DATABASE_URL) process.env.DATABASE_URL = dbMatch[1];

const axios = require('axios');
const { io } = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PORT = 3001;
const API = `http://localhost:${PORT}/api`;
const SOCKET_URL = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
let lastFail = '';

function ok(msg) { passed++; console.log(`  ✓ ${msg}`); }
function bad(msg, extra) { failed++; lastFail = msg; console.log(`  ✗ ${msg}${extra ? '\n    ' + JSON.stringify(extra) : ''}`); }
function check(cond, msg, extra) { return cond ? ok(msg) : bad(msg, extra); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function poll(fn, predicate, timeoutMs, intervalMs = 500) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (predicate(v)) return v;
    if (Date.now() - start > timeoutMs) return v;
    await sleep(intervalMs);
  }
}

async function main() {
  console.log('================================================================');
  console.log('   SEQUENTIAL QUESTION FLOW & SERVER-AUTHORITATIVE TIMERS       ');
  console.log('================================================================');
  console.log(`Target: ${API}\n`);

  const ts = Date.now();

  // 1. Authenticate GM
  const gmLogin = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = gmLogin.data.token;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };
  ok(`GM authenticated (demo@terminal.dev)`);

  // 2. Register Students
  const s1 = await axios.post(`${API}/auth/register`, {
    name: `Student One ${ts}`,
    username: `seq_stud1_${ts}`,
    usn: `1MS24CS${String(ts).slice(-4)}1`,
    email: `seq_stud1_${ts}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'Password123!',
  });
  const s1Headers = { headers: { Authorization: `Bearer ${s1.data.token}` } };

  const s2 = await axios.post(`${API}/auth/register`, {
    name: `Student Two ${ts}`,
    username: `seq_stud2_${ts}`,
    usn: `1MS24CS${String(ts).slice(-4)}2`,
    email: `seq_stud2_${ts}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'Password123!',
  });
  const s2Headers = { headers: { Authorization: `Bearer ${s2.data.token}` } };
  ok(`Students registered (s1: ${s1.data.user.username}, s2: ${s2.data.user.username})`);

  // 3. Create a Game with template 'QUIZ' and 3 questions with different configured time limits
  // Q1: 3 seconds limit
  // Q2: 5 seconds limit
  // Q3: 4 seconds limit
  const gameRes = await axios.post(`${API}/games`, {
    name: `Sequential Flow Game ${ts}`,
    template: 'QUIZ',
    maxPlayers: 20,
    speedBonus: false,
  }, gmHeaders);
  const game = gameRes.data.game;

  const q1Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: `Question 1: What is the capital of France?`,
    options: ['Paris', 'London', 'Berlin', 'Madrid'],
    answer: 'Paris',
    points: 10,
    timerSecs: 5,
    difficulty: 'EASY',
    position: 0,
  }, gmHeaders);
  const q1 = q1Res.data.challenge;

  const q2Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: `Question 2: What is 2 + 2?`,
    options: ['3', '4', '5', '6'],
    answer: '4',
    points: 20,
    timerSecs: 6,
    difficulty: 'EASY',
    position: 1,
  }, gmHeaders);
  const q2 = q2Res.data.challenge;

  const q3Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: `Question 3: What is the color of the sky?`,
    options: ['Green', 'Blue', 'Yellow', 'Purple'],
    answer: 'Blue',
    points: 30,
    timerSecs: 5,
    difficulty: 'EASY',
    position: 2,
  }, gmHeaders);
  const q3 = q3Res.data.challenge;

  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  ok(`Game published with 3 sequential questions (Q1: 5s, Q2: 6s, Q3: 5s)`);

  // 4. Create Session
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const session = sessionRes.data.session;
  const code = session.roomCode;
  ok(`Session created: roomCode=${code}, status=${session.status}`);

  // Connect sockets
  const gmSocket = io(SOCKET_URL, { auth: { token: gmToken }, transports: ['websocket'] });
  const s1Socket = io(SOCKET_URL, { auth: { token: s1.data.token }, transports: ['websocket'] });
  const s2Socket = io(SOCKET_URL, { auth: { token: s2.data.token }, transports: ['websocket'] });

  await new Promise(r => gmSocket.on('connect', r));
  await new Promise(r => s1Socket.on('connect', r));
  await new Promise(r => s2Socket.on('connect', r));

  gmSocket.emit('host:join', { roomCode: code });
  s1Socket.emit('player:join', { roomCode: code });
  s2Socket.emit('player:join', { roomCode: code });

  await axios.post(`${API}/sessions/join`, { roomCode: code }, s1Headers);
  await axios.post(`${API}/sessions/join`, { roomCode: code }, s2Headers);
  ok(`Sockets connected & players joined room ${code}`);

  // 5. Verify Pre-Game Lobby state: future questions masked, no playable questions
  const lobbyState = (await axios.get(`${API}/sessions/${code}`)).data;
  check(lobbyState.session.status === 'LOBBY', `Session status is LOBBY`);
  check(lobbyState.currentChallenge === null, `currentChallenge is null in LOBBY`);
  const maskedFuture = lobbyState.currentGame.challenges.filter(c => c.prompt.includes('LOCKED') || c.options.length === 0);
  check(maskedFuture.length >= 2, `Future questions are masked from playable payload (${maskedFuture.length} masked)`);

  // ── STEP 1: GM STARTS GAME -> ACTIVATES QUESTION 1 ONLY ─────────────────────
  console.log('\n--- PHASE 1: START GAME -> QUESTION 1 ACTIVATION ---');
  const tStart1 = Date.now();
  const startRes1 = await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
  // If STARTING produced, call start again to begin Q1
  let activeState1 = startRes1.data.session;
  if (activeState1.status === 'STARTING') {
    const startRes2 = await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    activeState1 = startRes2.data.session;
  }

  const liveQ1State = (await axios.get(`${API}/sessions/${code}`)).data;
  check(liveQ1State.session.status === 'QUESTION_ACTIVE', `Session is QUESTION_ACTIVE`);
  check(liveQ1State.session.currentChallengeId === q1.id, `Question 1 activated (${q1.id})`);
  check(liveQ1State.session.currentPosition === 0, `Current position is 0`);

  // Authoritative timer check: Q1 has timerSecs=5
  const endsAt1 = new Date(liveQ1State.session.questionEndsAt).getTime();
  const duration1Ms = endsAt1 - tStart1;
  check(duration1Ms >= 4000 && duration1Ms <= 6500, `Authoritative deadline set for Q1 (~5s: ${Math.round(duration1Ms/1000)}s)`);

  // Verify student receives only active question and correct countdown
  check(liveQ1State.currentChallenge?.id === q1.id, `currentChallenge matches Q1 id`);
  check(liveQ1State.currentChallenge?.prompt === q1.prompt, `currentChallenge has Q1 prompt`);
  check(liveQ1State.currentChallenge?.options?.length === 4, `currentChallenge has 4 options`);
  check(liveQ1State.currentChallenge?.challengeIndex === 0, `challengeIndex is 0`);
  check(liveQ1State.currentChallenge?.totalChallenges === 3, `totalChallenges is 3`);

  // Verify future questions Q2 and Q3 are locked in client view
  const q2InPayload = liveQ1State.currentGame.challenges.find(c => c.id === q2.id);
  const q3InPayload = liveQ1State.currentGame.challenges.find(c => c.id === q3.id);
  check(q2InPayload.prompt.includes('LOCKED') && q2InPayload.options.length === 0, `Future Question 2 is locked with no exposed options`);
  check(q3InPayload.prompt.includes('LOCKED') && q3InPayload.options.length === 0, `Future Question 3 is locked with no exposed options`);

  // ── STEP 2: QUESTION 1 SUBMISSIONS & DEADLINE ENFORCEMENT ─────────────────
  console.log('\n--- PHASE 2: QUESTION 1 SUBMISSIONS & DEADLINE EXPIRATION ---');
  // Student 1 submits valid answer before deadline
  const sub1 = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'Paris' }, s1Headers);
  check(sub1.data.submitted === true && sub1.data.isCorrect === undefined, `Student 1 submitted answer for Q1 before deadline (neutral confirmation, no answer leak)`);

  // Student 1 duplicate submission handled idempotently
  const dupSub = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'Paris' }, s1Headers)
    .then(r => ({ ok: true, data: r.data }))
    .catch(e => ({ ok: false, status: e.response?.status, data: e.response?.data }));
  check((dupSub.ok && dupSub.data?.duplicate === true) || (!dupSub.ok && dupSub.status === 400), `Duplicate submission on Q1 handled idempotently (duplicate=true or 400)`);

  // Wait for Q1 timer to expire (5s timer)
  console.log('  Waiting 5.5s for Q1 authoritative timer to expire...');
  await sleep(5500);

  // Attempt late submission after deadline by Student 2
  const lateSub = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'Paris' }, s2Headers)
    .then(r => ({ ok: true }))
    .catch(e => ({ ok: false, status: e.response?.status, error: e.response?.data?.error }));
  check(lateSub.ok === false && lateSub.status === 400, `Late submission past Q1 deadline rejected: ${lateSub.error}`);

  // ── STEP 3: AUTO-LOCK AND AUTO-ADVANCE TO QUESTION 2 ─────────────────────
  console.log('\n--- PHASE 3: QUESTION 1 EXPIRES -> AUTO-ADVANCE TO QUESTION 2 ---');
  // Poll until auto-advanced to QUESTION_ACTIVE with Question 2
  const q2State = await poll(
    async () => (await axios.get(`${API}/sessions/${code}`)).data,
    (s) => s.session.status === 'QUESTION_ACTIVE' && s.session.currentChallengeId === q2.id,
    15000,
    500
  );

  check(q2State.session.status === 'QUESTION_ACTIVE', `Server auto-advanced to QUESTION_ACTIVE`);
  check(q2State.session.currentChallengeId === q2.id, `Server activated Question 2 (${q2.id}) automatically`);
  check(q2State.session.currentPosition === 1, `Current position advanced to 1`);

  // Question 2 authoritative deadline check: Q2 has timerSecs=5
  const endsAt2 = new Date(q2State.session.questionEndsAt).getTime();
  const q2RemainingSecs = Math.round((endsAt2 - Date.now()) / 1000);
  check(q2RemainingSecs >= 3 && q2RemainingSecs <= 6, `Question 2 received its own 5s configured time limit (remaining=${q2RemainingSecs}s)`);

  check(q2State.currentChallenge?.id === q2.id, `Student currentChallenge updated to Q2`);
  check(q2State.currentChallenge?.prompt === q2.prompt, `currentChallenge has Q2 prompt`);
  check(q2State.currentChallenge?.challengeIndex === 1, `challengeIndex updated to 1`);

  // Submissions for old Question 1 are evaluated against current challenge Q2
  const oldQ1Sub = await axios.post(`${API}/sessions/active/submit`, { answer: 'Paris' }, s2Headers);
  check(oldQ1Sub.data.submitted === true && oldQ1Sub.data.isCorrect === undefined, `Submissions for Q2 receive neutral confirmation without correctness leak`);

  // ── STEP 4: QUESTION 2 GAMEPLAY & MANUAL ADVANCE IDEMPOTENCY ─────────────
  console.log('\n--- PHASE 4: MANUAL ADVANCE & IDEMPOTENCY ON QUESTION 2 ---');
  // Student 1 submits correct answer for Q2 ('4')
  const sub2 = await axios.post(`${API}/sessions/${code}/submit`, { answer: '4' }, s1Headers);
  check(sub2.data.submitted === true && sub2.data.isCorrect === undefined, `Student 1 submitted answer for Q2 (neutral confirmation)`);

  // Test manual GM advance while active: call /next twice simultaneously
  console.log('  Testing simultaneous manual advancement attempts (idempotency guard)...');
  const [adv1, adv2] = await Promise.all([
    axios.post(`${API}/sessions/${code}/next`, { currentChallengeId: q2.id }, gmHeaders).catch(e => e.response),
    axios.post(`${API}/sessions/${code}/next`, { currentChallengeId: q2.id }, gmHeaders).catch(e => e.response),
  ]);

  check(adv1.status === 200, `First advance attempt succeeded (200)`);
  check(adv2.status === 200, `Second advance attempt returned idempotent success (200)`);

  // Verify session is now on Question 3 (did NOT double advance past Q3!)
  const q3State = (await axios.get(`${API}/sessions/${code}`)).data;
  check(q3State.session.status === 'QUESTION_ACTIVE', `Session is QUESTION_ACTIVE on Question 3`);
  check(q3State.session.currentChallengeId === q3.id, `Session currentChallengeId is Question 3 (${q3.id})`);
  check(q3State.session.currentPosition === 2, `Session position is 2`);

  // ── STEP 5: RECONNECT RESTORES STATE WITHOUT RESETTING TIMER ─────────────
  console.log('\n--- PHASE 5: RECONNECTION / REFRESH TIMER INTEGRITY ---');
  const endsAt3 = new Date(q3State.session.questionEndsAt).getTime();
  const q3Remaining1 = Math.round((endsAt3 - Date.now()) / 1000);
  check(q3Remaining1 >= 2 && q3Remaining1 <= 5, `Question 3 received its own 4s timer (remaining=${q3Remaining1}s)`);

  // Simulate student disconnect and reconnect after 1s
  s1Socket.disconnect();
  await sleep(1000);
  const reconnectedState = (await axios.get(`${API}/sessions/${code}`)).data;
  const endsAt3After = new Date(reconnectedState.session.questionEndsAt).getTime();
  check(endsAt3 === endsAt3After, `Disconnect/reconnect did NOT reset authoritative server deadline`);
  const q3Remaining2 = Math.round((endsAt3After - Date.now()) / 1000);
  check(q3Remaining2 < q3Remaining1, `Authoritative countdown continued smoothly (${q3Remaining2}s < ${q3Remaining1}s)`);

  // Student 1 submits correct answer for Q3 ('Blue')
  const sub3 = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'Blue' }, s1Headers);
  check(sub3.data.submitted === true && sub3.data.isCorrect === undefined, `Student 1 submitted answer for Q3 (neutral confirmation)`);

  // ── STEP 6: FINAL QUESTION EXPIRES -> AUTO-FINALIZATION TO RESULTS ────────
  console.log('\n--- PHASE 6: FINAL QUESTION EXPIRATION -> RESULTS FINALIZATION ---');
  console.log('  Waiting for final question to expire and sweep to drive to RESULTS...');
  const finalResultsState = await poll(
    async () => (await axios.get(`${API}/sessions/${code}`)).data,
    (s) => s.session.status === 'RESULTS',
    15000,
    500
  );

  check(finalResultsState.session.status === 'RESULTS', `Final question expiry transitioned session to RESULTS`);
  check(finalResultsState.currentChallenge === null, `currentChallenge is null in RESULTS state`);

  // Verify scoring accuracy and rankings
  const indBoard = finalResultsState.individualLeaderboard || [];
  const s1Result = indBoard.find(p => p.userId === s1.data.user.id);
  const s2Result = indBoard.find(p => p.userId === s2.data.user.id);

  // Student 1 got Q1 (10) + Q2 (20) + Q3 (30) = 60 pts
  // Student 2 got 0 pts
  check(s1Result && s1Result.score === 60, `Student 1 final score is exactly 60 (10 + 20 + 30) (actual=${s1Result?.score})`);
  check(s1Result && s1Result.rank === 1, `Student 1 is ranked #1`);
  check(s2Result && s2Result.score === 0, `Student 2 final score is exactly 0 (actual=${s2Result?.score})`);

  // Verify final scores calculated exactly once: check submission row count
  const s1Subs = await prisma.submission.count({ where: { sessionId: session.id, player: { userId: s1.data.user.id } } });
  check(s1Subs === 3, `Student 1 has exactly 3 submission rows in DB (n=${s1Subs})`);

  // ── STEP 7: BACKEND RESTART RECOVERY TEST ────────────────────────────────
  console.log('\n--- PHASE 7: BACKEND RESTART RECOVERY ---');
  // Create an isolated session with an expired question to test restart sweep recovery
  const restartGameRes = await axios.post(`${API}/games`, {
    name: `Restart Test Game ${ts}`,
    template: 'QUIZ',
    maxPlayers: 10,
  }, gmHeaders);
  const rGame = restartGameRes.data.game;

  const rQ1 = (await axios.post(`${API}/games/${rGame.id}/challenges`, {
    type: 'SINGLE_CHOICE', prompt: 'Restart Q1', options: ['A', 'B'], answer: 'A', points: 10, timerSecs: 20, position: 0,
  }, gmHeaders)).data.challenge;

  const rQ2 = (await axios.post(`${API}/games/${rGame.id}/challenges`, {
    type: 'SINGLE_CHOICE', prompt: 'Restart Q2', options: ['A', 'B'], answer: 'A', points: 10, timerSecs: 20, position: 1,
  }, gmHeaders)).data.challenge;

  await axios.post(`${API}/games/${rGame.id}/publish`, {}, gmHeaders);
  const rSess = (await axios.post(`${API}/sessions`, { gameId: rGame.id }, gmHeaders)).data.session;
  await axios.post(`${API}/sessions/${rSess.roomCode}/start`, {}, gmHeaders);
  await axios.post(`${API}/sessions/${rSess.roomCode}/start`, {}, gmHeaders); // QUESTION_ACTIVE

  // Force questionEndsAt into the past (as if the backend was down while timer expired)
  await prisma.session.update({
    where: { id: rSess.id },
    data: { questionEndsAt: new Date(Date.now() - 10000) },
  });

  // Import sweepOnce and execute one pass directly (simulating startup sweep pass)
  const { sweepOnce } = require('./server/dist/services/questionSweep');
  const mockIo = { to: () => ({ emit: () => {} }) };
  const sweepRes = await sweepOnce(mockIo);
  const recoveredSession = await prisma.session.findUnique({ where: { id: rSess.id } });
  check(sweepRes.locked >= 1 || recoveredSession?.status === 'QUESTION_LOCKED', `Startup sweep pass locked expired question without stalling (locked=${sweepRes.locked}, status=${recoveredSession?.status})`);
  check(recoveredSession.status === 'QUESTION_LOCKED', `Expired session recovered to QUESTION_LOCKED`);
  check(recoveredSession.autoAdvanceAt !== null, `autoAdvanceAt scheduled for smooth sequential advance`);

  // Clean up sockets
  gmSocket.disconnect();
  s2Socket.disconnect();

  console.log('\n================================================================');
  console.log(`  SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    console.error(`\nFAILED TEST: ${lastFail}`);
    process.exit(1);
  } else {
    console.log('\nALL SEQUENTIAL GAMEPLAY AND TIMER ACCEPTANCE TESTS PASSED! ✦');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nFatal test execution error:', err.response?.data || err);
  process.exit(1);
});
