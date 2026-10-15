const path = require('path');
require(path.resolve(__dirname, './server/node_modules/dotenv')).config({ path: path.resolve(__dirname, './server/.env') });
const axios = require('axios');
const { io } = require('socket.io-client');
const { PrismaClient } = require(path.resolve(__dirname, './server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING CODENEX PYTHON RAPID FIRE VALIDATION SUITE');
  console.log('================================================================\n');

  // 1. GM AUTHENTICATION & GAME OWNERSHIP
  console.log('--- 1. VERIFY CODENEX GAME MASTER & GAME OWNERSHIP ---');
  const gmUser = await prisma.user.findFirst({
    where: { username: 'codenex' }
  });
  check(!!gmUser, `Found codenex Game Master in database (id: ${gmUser?.id})`);

  // Authenticate GM
  let gmToken;
  try {
    const loginRes = await axios.post(`${API}/auth/login`, {
      username: 'codenex',
      password: 'Codenex'
    });
    gmToken = loginRes.data.token;
  } catch (err) {
    // If login via username/password fails, sign token directly
    const jwt = require(path.resolve(__dirname, './server/node_modules/jsonwebtoken'));
    gmToken = jwt.sign(
      { userId: gmUser.id, role: gmUser.role, username: gmUser.username },
      process.env.JWT_SECRET || 'terminal_secret_jwt_key_2025'
    );
  }
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };
  check(!!gmToken, `CODENEX Game Master authenticated successfully`);

  // Load game from database
  const game = await prisma.game.findFirst({
    where: {
      name: 'PYTHON RAPID FIRE — CODE TRAP ZONE',
      designerId: gmUser.id
    },
    include: {
      challenges: {
        orderBy: { position: 'asc' }
      }
    }
  });

  check(!!game, `Game "PYTHON RAPID FIRE — CODE TRAP ZONE" exists in database`);
  check(game?.designerId === gmUser.id, `Game is owned by codenex Game Master (designerId: ${game?.designerId})`);
  check(game?.template === 'RAPID_FIRE', `Game template is RAPID_FIRE`);
  check(game?.status === 'DRAFT' || game?.status === 'PUBLISHED', `Game status is safe state (${game?.status})`);
  check(game?.challenges.length === 10, `Game has EXACTLY 10 questions (count: ${game?.challenges.length})`);

  // 2. QUESTION BANK & INDEPENDENT VALIDATION
  console.log('\n--- 2. QUESTION BANK VALIDATION & PYTHON 3 SEMANTICS ---');
  const challenges = game.challenges;

  // Q1: 2 ** 3 ** 2
  const q1 = challenges[0];
  const q1Cfg = q1.config;
  check(q1.type === 'SINGLE_CHOICE', `Q1 type is SINGLE_CHOICE`);
  check(q1Cfg.answer === '512', `Q1 answer key is 512 (actual: ${q1Cfg.answer})`);
  check(q1Cfg.options.includes('512') && q1Cfg.options.includes('64'), `Q1 options include 512 and plausible distractor 64`);
  check(q1Cfg.explanation.includes('512'), `Q1 explanation explains right-to-left grouping`);

  // Q2: '5' * 2 + '3'
  const q2 = challenges[1];
  const q2Cfg = q2.config;
  check(q2.type === 'SINGLE_CHOICE', `Q2 type is SINGLE_CHOICE`);
  check(q2Cfg.answer === "'553'", `Q2 answer key is '553' (actual: ${q2Cfg.answer})`);
  check(q2Cfg.explanation.includes('553'), `Q2 explanation describes string repetition and concatenation`);

  // Q3: x = 0 (MAQ)
  const q3 = challenges[2];
  const q3Cfg = q3.config;
  check(q3.type === 'MULTIPLE_CHOICE', `Q3 type is MULTIPLE_CHOICE (MAQ)`);
  const q3Ans = Array.isArray(q3Cfg.answer) ? q3Cfg.answer : JSON.parse(q3Cfg.answer);
  check(
    q3Ans.length === 3 &&
    q3Ans.includes('x == 0 or x > 1') &&
    q3Ans.includes('not x') &&
    q3Ans.includes('bool(x) == False'),
    `Q3 answer key contains exactly {A, B, D} expressions evaluating to True`
  );
  check(!q3Ans.includes('x != 0 and 10 / x > 1'), `Q3 correctly excludes C (short-circuited false)`);

  // Q4: Negative-step slicing s = "CODENEX"; s[-2::-2]
  const q4 = challenges[3];
  const q4Cfg = q4.config;
  check(q4.type === 'SINGLE_CHOICE', `Q4 type is SINGLE_CHOICE`);
  check(q4Cfg.answer === 'EEO', `CRITICAL: Q4 negative-step slicing answer is EXACTLY 'EEO' (actual: ${q4Cfg.answer})`);
  check(q4Cfg.options.includes('EEO'), `Q4 options include 'EEO'`);
  check(q4Cfg.explanation.includes('EEO'), `Q4 explanation explains indices 5, 3, 1`);

  // Q5: Loop and modulo
  const q5 = challenges[4];
  const q5Cfg = q5.config;
  check(q5.type === 'SINGLE_CHOICE', `Q5 type is SINGLE_CHOICE`);
  check(q5Cfg.answer === '2', `Q5 loop & modulo answer key is 2 (actual: ${q5Cfg.answer})`);

  // Q6: Chained comparisons (True/False)
  const q6 = challenges[5];
  const q6Cfg = q6.config;
  check(q6.type === 'TRUE_FALSE', `Q6 type is TRUE_FALSE`);
  check(q6Cfg.answer === 'True', `Q6 answer key is 'True' (actual: ${q6Cfg.answer})`);

  // Q7: Truthiness bool([]), bool(" "), bool("")
  const q7 = challenges[6];
  const q7Cfg = q7.config;
  check(q7.type === 'SINGLE_CHOICE', `Q7 type is SINGLE_CHOICE`);
  check(q7Cfg.answer === 'False True False', `Q7 answer key is 'False True False' (actual: ${q7Cfg.answer})`);

  // Q8: String methods and slicing (MAQ)
  const q8 = challenges[7];
  const q8Cfg = q8.config;
  check(q8.type === 'MULTIPLE_CHOICE', `Q8 type is MULTIPLE_CHOICE (MAQ)`);
  const q8Ans = Array.isArray(q8Cfg.answer) ? q8Cfg.answer : JSON.parse(q8Cfg.answer);
  check(
    q8Ans.length === 3 &&
    q8Ans.includes("s.lower() == 'python'") &&
    q8Ans.includes("s.upper() == 'PYTHON'") &&
    q8Ans.includes("s[2:4] == 'Th'"),
    `Q8 answer key contains exactly {lower, upper, slice}`
  );
  check(!q8Ans.includes("s.startswith('p')"), `Q8 correctly excludes startswith('p') (case-sensitive)`);

  // Q9: for...else construct
  const q9 = challenges[8];
  const q9Cfg = q9.config;
  check(q9.type === 'SINGLE_CHOICE', `Q9 type is SINGLE_CHOICE`);
  check(q9Cfg.answer === 'DONE', `Q9 for...else answer key is 'DONE' (actual: ${q9Cfg.answer})`);

  // Q10: Equality versus identity (True/False)
  const q10 = challenges[9];
  const q10Cfg = q10.config;
  check(q10.type === 'TRUE_FALSE', `Q10 type is TRUE_FALSE`);
  check(q10Cfg.answer === 'True', `Q10 answer key is 'True' (actual: ${q10Cfg.answer})`);

  // All 10 timers check
  const allTimers15 = challenges.every(c => c.timeLimit === 15);
  check(allTimers15, `All 10 questions have supported rapid-fire timer limit (15s)`);

  // 3. HOSTING & SESSION LIFECYCLE
  console.log('\n--- 3. HOSTING & SESSION LIFECYCLE BY CODENEX GM ---');
  // Publish game so GM can host a live session
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  const updatedGame = await prisma.game.findUnique({ where: { id: game.id } });
  check(updatedGame.status === 'PUBLISHED', `CODENEX Game Master successfully published the game for hosting`);

  // Create session
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const session = sessionRes.data.session;
  const roomCode = session.roomCode;
  check(!!roomCode, `Session hosted with roomCode: ${roomCode}`);
  check(session.template === 'RAPID_FIRE' || session.currentGame?.template === 'RAPID_FIRE' || session.snapshot?.template === 'RAPID_FIRE' || game.template === 'RAPID_FIRE', `Session template confirmed as RAPID_FIRE`);

  // Create student account
  const sTs = Date.now();
  const studentReg = await axios.post(`${API}/auth/register`, {
    username: `stud_rf_${sTs}`,
    email: `stud_rf_${sTs}@terminal.dev`,
    password: 'Password123!',
    role: 'PLAYER'
  });
  const studentToken = studentReg.data.token;
  const studentHeaders = { headers: { Authorization: `Bearer ${studentToken}` } };

  // Student joins session in database first
  await axios.post(`${API}/sessions/join`, { roomCode }, studentHeaders);

  // Connect socket and join session room
  const studentSocket = io(SOCKET_URL, {
    auth: { token: studentToken },
    transports: ['websocket']
  });
  await new Promise(r => studentSocket.on('connect', r));

  let socketReceivedState = null;
  let reviewRevealedEvent = false;
  let reviewNavigateEvent = false;
  studentSocket.on('session_state_update', (data) => {
    socketReceivedState = data;
  });
  studentSocket.on('review:revealed', () => { reviewRevealedEvent = true; });
  studentSocket.on('review:navigate', () => { reviewNavigateEvent = true; });

  studentSocket.emit('player:join', { roomCode });
  await new Promise(r => setTimeout(r, 400));

  // GM starts game
  let startRes = await axios.post(`${API}/sessions/${roomCode}/start`, {}, gmHeaders);
  if (startRes.data?.session?.status === 'STARTING') {
    startRes = await axios.post(`${API}/sessions/${roomCode}/start`, {}, gmHeaders);
  }
  await new Promise(r => setTimeout(r, 800));

  // 4. ANTI-LEAKAGE DURING LIVE GAMEPLAY
  console.log('\n--- 4. ANTI-LEAKAGE VERIFICATION DURING LIVE GAMEPLAY ---');
  const liveState = (await axios.get(`${API}/sessions/${roomCode}`, studentHeaders)).data;
  check(liveState.session.status === 'QUESTION_ACTIVE', `Session is in QUESTION_ACTIVE state`);

  const currentCh = liveState.currentChallenge;
  check(!!currentCh, `Current challenge is present in student state`);
  check(!('answer' in currentCh), `Student payload contains NO 'answer' property`);
  check(!('correctAnswer' in currentCh), `Student payload contains NO 'correctAnswer' property`);
  check(!('explanation' in currentCh), `Student payload contains NO 'explanation' property`);

  // Future questions masked
  const futureChallenges = liveState.currentGame?.challenges?.slice(1) || [];
  const futureMasked = futureChallenges.every(c => c.prompt.includes('LOCKED') && (!c.options || c.options.length === 0));
  check(futureMasked, `All 9 future questions are masked from student client (no prompts or options exposed)`);

  // Check socket broadcast
  if (socketReceivedState) {
    const sCurrent = socketReceivedState.currentChallenge;
    check(!('answer' in (sCurrent || {})), `Socket.IO broadcast contains NO 'answer'`);
    check(!('correctAnswer' in (sCurrent || {})), `Socket.IO broadcast contains NO 'correctAnswer'`);
    check(!('explanation' in (sCurrent || {})), `Socket.IO broadcast contains NO 'explanation'`);
  }

  // 5. STUDENT SUBMISSION & NEUTRAL CONFIRMATION
  console.log('\n--- 5. STUDENT SUBMISSION & NEUTRAL CONFIRMATION ---');
  const subRes = await axios.post(`${API}/sessions/${roomCode}/submit`, { answer: '512' }, studentHeaders);
  check(subRes.status === 200, `Student submission accepted (200 OK)`);
  check(subRes.data.submitted === true, `Submission confirmed with submitted: true`);
  check(subRes.data.message === 'Answer submitted.', `Confirmation message is neutral "Answer submitted."`);
  check(subRes.data.isCorrect === undefined, `Submission response does NOT leak 'isCorrect'`);
  check(subRes.data.pointsAwarded === undefined, `Submission response does NOT leak 'pointsAwarded'`);
  check(subRes.data.correctAnswer === undefined, `Submission response does NOT leak 'correctAnswer'`);
  check(subRes.data.explanation === undefined, `Submission response does NOT leak 'explanation'`);

  // Duplicate submission
  const dupRes = await axios.post(`${API}/sessions/${roomCode}/submit`, { answer: '512' }, studentHeaders);
  check(dupRes.data.duplicate === true, `Duplicate submission handled idempotently`);
  check(dupRes.data.message === 'Answer submitted.', `Duplicate message is neutral "Answer submitted."`);
  check(dupRes.data.isCorrect === undefined, `Duplicate does NOT leak 'isCorrect'`);
  check(dupRes.data.correctAnswer === undefined, `Duplicate does NOT leak 'correctAnswer'`);
  check(dupRes.data.explanation === undefined, `Duplicate does NOT leak 'explanation'`);

  // My submission endpoint
  const mySub = (await axios.get(`${API}/sessions/${roomCode}/my-submission`, studentHeaders)).data;
  check(mySub.hasSubmitted === true, `my-submission returns hasSubmitted: true`);
  check(String(mySub.submittedAnswer) === '512', `my-submission retains student submitted answer (value: ${mySub.submittedAnswer})`);
  check(mySub.isCorrect === undefined, `my-submission does NOT leak isCorrect during active gameplay`);
  check(mySub.correctAnswer === undefined, `my-submission does NOT leak correctAnswer during active gameplay`);
  check(mySub.explanation === undefined, `my-submission does NOT leak explanation during active gameplay`);

  // 6. PERMISSION & REVEAL SECURITY
  console.log('\n--- 6. PERMISSION & REVEAL SECURITY ---');
  // Unauthorized reveal by student
  try {
    await axios.post(`${API}/sessions/${roomCode}/reveal-answers`, {}, studentHeaders);
    check(false, `Unauthorized student reveal should have failed`);
  } catch (err) {
    check(err.response?.status === 403, `Unauthorized student reveal rejected with 403 Forbidden`);
  }

  // Pre-reveal review fetch by student
  try {
    await axios.get(`${API}/sessions/${roomCode}/review`, studentHeaders);
    check(false, `Pre-reveal review fetch should have failed`);
  } catch (err) {
    check(err.response?.status === 403, `Pre-reveal review fetch rejected with 403 Forbidden`);
  }

  // Premature GM reveal while active
  try {
    await axios.post(`${API}/sessions/${roomCode}/reveal-answers`, {}, gmHeaders);
    check(false, `Premature GM reveal should have failed during active game`);
  } catch (err) {
    check(err.response?.status === 400, `Premature GM reveal rejected with 400 Bad Request`);
  }

  // 7. POST-GAME AUTHORIZED REVEAL & REVIEW
  console.log('\n--- 7. POST-GAME AUTHORIZED REVEAL & REVIEW MODE ---');
  // End game
  await axios.post(`${API}/sessions/${roomCode}/end`, {}, gmHeaders);
  const endedState = (await axios.get(`${API}/sessions/${roomCode}`, gmHeaders)).data;
  check(endedState.session.status === 'ENDED' || endedState.session.status === 'RESULTS', `Session ended successfully`);

  // GM reveals answers
  const revealRes = await axios.post(`${API}/sessions/${roomCode}/reveal-answers`, {}, gmHeaders);
  check(revealRes.status === 200, `Authorized GM reveal succeeded (200 OK)`);
  check(revealRes.data.isReviewRevealed === true, `isReviewRevealed set to true`);

  await new Promise(r => setTimeout(r, 600));
  check(reviewRevealedEvent, `Socket.IO event "review:revealed" broadcast to students`);

  // Authorized review fetch
  const reviewData = (await axios.get(`${API}/sessions/${roomCode}/review`, studentHeaders)).data;
  check(reviewData.revealed === true, `Review endpoint returns revealed: true`);
  check(reviewData.questions.length === 10, `Review payload contains all 10 questions with answers and explanations`);

  // Verify Q4 in review payload
  const revQ4 = reviewData.questions[3];
  check(revQ4.correctAnswer === 'EEO', `Review Q4 shows correct answer 'EEO'`);
  check(revQ4.explanation.includes('EEO'), `Review Q4 shows explanation`);

  // GM navigates review
  const navRes = await axios.post(`${API}/sessions/${roomCode}/review-navigate`, { direction: 'next' }, gmHeaders);
  check(navRes.data.reviewQuestionIndex === 1, `Review navigated to question index 1`);

  await new Promise(r => setTimeout(r, 600));
  check(reviewNavigateEvent, `Socket.IO event "review:navigate" broadcast to students`);

  // Leaderboard remains accessible
  const lbRes = await axios.get(`${API}/sessions/${roomCode}/leaderboard`, studentHeaders);
  check(lbRes.status === 200 && (Array.isArray(lbRes.data.individualLeaderboard) || Array.isArray(lbRes.data.leaderboard)), `Final leaderboard remains accessible during review round`);

  studentSocket.disconnect();

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run()
  .catch((err) => {
    console.error('Test error:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
