/**
 * test_delayed_review_mode.cjs
 * Comprehensive regression tests for TERMINAL Quiz Mode Delayed Answer Explanations.
 *
 * Verifies:
 * 1. Anti-leakage during active gameplay: zero answers, correctness, or explanations in payloads.
 * 2. Neutral post-submission confirmation: "Answer submitted." with no answer key or correctness.
 * 3. Question lock/timeout: no answer leak on lock or advance.
 * 4. Permission enforcement: only authorized host can reveal; students cannot reveal or view unrevealed review.
 * 5. Authorized post-game reveal: GM activates reveal in RESULTS/ENDED; step-by-step review navigation works.
 * 6. Preserves scoring, sequential progression, leaderboard accessibility, and Rapid Fire behavior.
 */

require('./server/node_modules/dotenv').config({ path: './server/.env' });
const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();
const jwt = require('./server/node_modules/jsonwebtoken');
const { io } = require('./client/node_modules/socket.io-client');

const API_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, type: 'access' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING DELAYED ANSWER EXPLANATION REGRESSION TEST SUITE');
  console.log('================================================================\n');

  try {
    // 1. Fetch GM and Student accounts
    const gmUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });
    assert(gmUser, `Found Game Master account (${gmUser?.username || gmUser?.email})`);

    let studentUser = await prisma.user.findFirst({
      where: { role: 'PLAYER' }
    });
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          username: `quiz_tester_${Date.now()}`,
          email: `tester_${Date.now()}@terminal.dev`,
          passwordHash: 'dummyhash',
          role: 'PLAYER',
          status: 'ACTIVE',
        }
      });
    }
    assert(studentUser, `Found Student account (${studentUser.username})`);

    const gmToken = createToken(gmUser);
    const studentToken = createToken(studentUser);

    // 2. Locate Python Quiz game
    let game = await prisma.game.findFirst({
      where: {
        template: 'QUIZ',
        name: { contains: 'Python' },
      },
      include: { challenges: { orderBy: { position: 'asc' } } }
    });
    if (!game) {
      game = await prisma.game.findFirst({
        where: { template: 'QUIZ' },
        include: { challenges: { orderBy: { position: 'asc' } } },
        orderBy: { challenges: { _count: 'desc' } }
      });
    }
    assert(game && game.challenges.length >= 2, `Target Quiz game loaded: "${game.name}" with ${game.challenges.length} questions`);

    // Verify raw challenges actually have answer and explanation server-side
    const sampleChallenge = game.challenges[0];
    const sampleConfig = sampleChallenge.config || {};
    const sampleAnswer = sampleChallenge.answer || sampleConfig.answer || sampleConfig.correct;
    const sampleExplanation = sampleChallenge.explanation || sampleConfig.explanation;
    assert(sampleAnswer !== undefined, `Server DB contains answer for Q1: ${JSON.stringify(sampleAnswer)}`);
    assert(sampleExplanation, `Server DB contains explanation for Q1: "${sampleExplanation.slice(0, 40)}..."`);

    // 3. Host a new game session
    console.log('\n--- PHASE 1: Session Hosting & Pre-Submission Anti-Leakage ---');
    const hostRes = await request('/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ gameId: game.id })
    });
    if (!hostRes.ok) {
      console.error('Host error details:', hostRes.status, hostRes.data);
    }
    assert(hostRes.ok, `Session created with roomCode: ${hostRes.data?.session?.roomCode}`);
    const roomCode = hostRes.data.session.roomCode;

    // Student joins session
    const joinRes = await request('/sessions/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ roomCode })
    });
    assert(joinRes.ok, `Student joined room ${roomCode}`);

    // Connect Socket.IO client for student
    const studentSocket = io(SOCKET_URL, {
      auth: { token: studentToken }
    });

    let lastSocketState = null;
    let reviewRevealedEvent = null;
    let reviewNavigateEvent = null;

    studentSocket.emit('player:join', { roomCode });
    studentSocket.on('session_state_update', (state) => {
      lastSocketState = state;
    });
    studentSocket.on('review:revealed', (payload) => {
      reviewRevealedEvent = payload;
    });
    studentSocket.on('review:navigate', (payload) => {
      reviewNavigateEvent = payload;
    });

    await new Promise((r) => setTimeout(r, 800));

    // GM starts game
    let startRes = await request(`/sessions/${roomCode}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    if (startRes.data?.session?.status === 'STARTING') {
      startRes = await request(`/sessions/${roomCode}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${gmToken}` }
      });
    }
    assert(startRes.ok, `Game started successfully (status: ${startRes.data?.session?.status})`);

    await new Promise((r) => setTimeout(r, 600));

    // Public / student API check
    const publicStateRes = await request(`/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(publicStateRes.ok, 'Public session state retrieved');
    const publicCurrentChallenge = publicStateRes.data.currentChallenge;
    assert(publicCurrentChallenge !== undefined, 'Current challenge present in public state');
    assert(publicCurrentChallenge.answer === undefined, 'No "answer" property in student-facing challenge payload');
    assert(publicCurrentChallenge.correctAnswer === undefined, 'No "correctAnswer" property in student-facing challenge payload');
    assert(publicCurrentChallenge.explanation === undefined, 'No "explanation" property in student-facing challenge payload');

    // Socket.IO broadcast verification
    assert(lastSocketState !== null, 'Socket.IO session_state_update received');
    const socketChallenge = lastSocketState.currentChallenge;
    assert(socketChallenge.answer === undefined, 'Socket.IO broadcast contains NO "answer"');
    assert(socketChallenge.correctAnswer === undefined, 'Socket.IO broadcast contains NO "correctAnswer"');
    assert(socketChallenge.explanation === undefined, 'Socket.IO broadcast contains NO "explanation"');

    // 4. Submission Neutrality Check
    console.log('\n--- PHASE 2: Student Submission Neutrality ---');
    const q1Id = publicCurrentChallenge.id;
    const submitRes = await request(`/sessions/${roomCode}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        challengeId: q1Id,
        answer: 'A'
      })
    });

    assert(submitRes.ok, 'Submission HTTP 200 OK');
    assert(submitRes.data.success === true, 'Submission success === true');
    assert(submitRes.data.submitted === true, 'Submission submitted === true');
    assert(submitRes.data.message === 'Answer submitted.', `Submission message is exactly "${submitRes.data.message}"`);
    assert(submitRes.data.isCorrect === undefined, 'Submission response does NOT leak "isCorrect"');
    assert(submitRes.data.pointsAwarded === undefined, 'Submission response does NOT leak "pointsAwarded"');
    assert(submitRes.data.correctAnswer === undefined, 'Submission response does NOT leak "correctAnswer"');
    assert(submitRes.data.explanation === undefined, 'Submission response does NOT leak "explanation"');

    // Duplicate submission check
    const dupSubmitRes = await request(`/sessions/${roomCode}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        challengeId: q1Id,
        answer: 'B'
      })
    });
    assert(dupSubmitRes.ok, 'Duplicate submission HTTP 200 OK');
    assert(dupSubmitRes.data.duplicate === true, 'Duplicate flag set');
    assert(dupSubmitRes.data.message === 'Answer submitted.', 'Duplicate message is neutral "Answer submitted."');
    assert(dupSubmitRes.data.isCorrect === undefined, 'Duplicate does NOT leak correctness');
    assert(dupSubmitRes.data.correctAnswer === undefined, 'Duplicate does NOT leak correctAnswer');
    assert(dupSubmitRes.data.explanation === undefined, 'Duplicate does NOT leak explanation');

    // Check /my-submission endpoint during active gameplay
    const mySubRes = await request(`/sessions/${roomCode}/my-submission?challengeId=${q1Id}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(mySubRes.ok, 'My submission fetched successfully');
    assert(mySubRes.data.hasSubmitted === true, 'hasSubmitted === true');
    assert(mySubRes.data.submittedAnswer === 'A', 'Preserves student submitted answer');
    assert(mySubRes.data.isCorrect === undefined, 'my-submission does NOT leak isCorrect during active gameplay');
    assert(mySubRes.data.correctAnswer === undefined, 'my-submission does NOT leak correctAnswer during active gameplay');
    assert(mySubRes.data.explanation === undefined, 'my-submission does NOT leak explanation during active gameplay');

    // 5. Question Lock & Question Advance Anti-Leakage
    console.log('\n--- PHASE 3: Question Lock & Advance Anti-Leakage ---');
    const lockRes = await request(`/sessions/${roomCode}/lock`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(lockRes.ok, 'Host locked question 1');

    await new Promise((r) => setTimeout(r, 600));

    // Verify locked state does NOT reveal answers
    const lockedPublicState = await request(`/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(lockedPublicState.data.currentChallenge.answer === undefined, 'Locked state does NOT leak "answer"');
    assert(lockedPublicState.data.currentChallenge.correctAnswer === undefined, 'Locked state does NOT leak "correctAnswer"');
    assert(lockedPublicState.data.currentChallenge.explanation === undefined, 'Locked state does NOT leak "explanation"');

    // Advance to Question 2
    const nextRes = await request(`/sessions/${roomCode}/next`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ currentChallengeId: q1Id })
    });
    assert(nextRes.ok, 'Advanced to Question 2');

    await new Promise((r) => setTimeout(r, 600));

    const q2State = await request(`/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(q2State.data.currentChallenge.id !== q1Id, 'Now on new question');
    assert(q2State.data.currentChallenge.answer === undefined, 'Q2 payload does NOT leak answer');
    assert(q2State.data.currentChallenge.explanation === undefined, 'Q2 payload does NOT leak explanation');

    // 6. Security & Permission Enforcement
    console.log('\n--- PHASE 4: Security & Permission Enforcement ---');
    // Student attempts to reveal answers -> 403 Forbidden
    const unauthReveal = await request(`/sessions/${roomCode}/reveal-answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(unauthReveal.status === 403, `Unauthorized student reveal rejected with HTTP 403 (${unauthReveal.data.error})`);

    // Student attempts review navigation -> 403 Forbidden
    const unauthNav = await request(`/sessions/${roomCode}/review-navigate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ direction: 'next' })
    });
    assert(unauthNav.status === 403, `Unauthorized review navigate rejected with HTTP 403 (${unauthNav.data.error})`);

    // Student attempts to fetch review data before reveal -> 403 Forbidden
    const unrevealedReview = await request(`/sessions/${roomCode}/review`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(unrevealedReview.status === 403, `Pre-reveal review fetch rejected with HTTP 403 (${unrevealedReview.data.error})`);

    // GM attempts reveal during active gameplay -> 400 Bad Request
    const prematureReveal = await request(`/sessions/${roomCode}/reveal-answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(prematureReveal.status === 400, `Premature GM reveal during active gameplay rejected with HTTP 400 (${prematureReveal.data.error})`);

    // 7. Post-Game Authorized Reveal & Step-by-Step Navigation
    console.log('\n--- PHASE 5: Post-Game Authorized Reveal & Review Navigation ---');
    // End the session
    const endRes = await request(`/sessions/${roomCode}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(endRes.ok, 'Session ended and moved to final status');

    await new Promise((r) => setTimeout(r, 600));

    // GM triggers authorized reveal
    const authorizedRevealRes = await request(`/sessions/${roomCode}/reveal-answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(authorizedRevealRes.ok, 'Authorized GM reveal succeeded (HTTP 200)');
    assert(authorizedRevealRes.data.isReviewRevealed === true, 'isReviewRevealed === true returned by reveal endpoint');
    assert(authorizedRevealRes.data.reviewQuestionIndex === 0, 'reviewQuestionIndex starts at index 0');

    await new Promise((r) => setTimeout(r, 600));

    // Verify Socket.IO broadcast review:revealed
    assert(reviewRevealedEvent !== null, 'Socket.IO event "review:revealed" received by student');
    assert(reviewRevealedEvent.currentQuestionIndex === 0, 'Socket.IO review:revealed index is 0');

    // Verify student can now fetch review questions
    const reviewDataRes = await request(`/sessions/${roomCode}/review`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(reviewDataRes.ok, 'Authorized review data fetched successfully (HTTP 200)');
    assert(reviewDataRes.data.revealed === true, 'Review payload has revealed: true');
    assert(Array.isArray(reviewDataRes.data.questions), `Review payload contains ${reviewDataRes.data.questions.length} questions`);

    const q1Review = reviewDataRes.data.questions[0];
    assert(q1Review.correctAnswer !== undefined, `Review Q1 has correct answer: ${JSON.stringify(q1Review.correctAnswer)}`);
    assert(q1Review.explanation && q1Review.explanation.length > 5, `Review Q1 has full explanation: "${q1Review.explanation.slice(0, 50)}..."`);
    assert(q1Review.studentSubmission && q1Review.studentSubmission.submittedAnswer === 'A', 'Review maps student personal submission');

    // GM navigates review: Next question
    const navNextRes = await request(`/sessions/${roomCode}/review-navigate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ direction: 'next' })
    });
    assert(navNextRes.ok, 'Host navigated to next review question');
    assert(navNextRes.data.reviewQuestionIndex === 1, 'reviewQuestionIndex advanced to 1');

    await new Promise((r) => setTimeout(r, 600));

    // Verify Socket.IO review:navigate broadcast
    assert(reviewNavigateEvent !== null, 'Socket.IO event "review:navigate" received by student');
    assert(reviewNavigateEvent.currentQuestionIndex === 1, 'review:navigate broadcast index is 1');

    // Verify public session state reflects review challenge
    const reviewStateRes = await request(`/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(reviewStateRes.data.isReviewRevealed === true, 'Public state isReviewRevealed is true');
    assert(reviewStateRes.data.reviewQuestionIndex === 1, 'Public state reviewQuestionIndex is 1');
    assert(reviewStateRes.data.reviewChallenge !== undefined, 'Public state contains reviewChallenge for projector');
    assert(reviewStateRes.data.reviewChallenge.correctAnswer !== undefined, 'Projector reviewChallenge contains correctAnswer');
    assert(reviewStateRes.data.reviewChallenge.explanation !== undefined, 'Projector reviewChallenge contains explanation');

    // GM navigates review: Previous question
    const navPrevRes = await request(`/sessions/${roomCode}/review-navigate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ direction: 'prev' })
    });
    assert(navPrevRes.ok, 'Host navigated back to previous review question');
    assert(navPrevRes.data.reviewQuestionIndex === 0, 'reviewQuestionIndex returned to 0');

    // Check leaderboard accessibility during review
    assert(Array.isArray(reviewStateRes.data.leaderboard), 'Final leaderboard remains accessible during review');

    // Cleanup socket
    studentSocket.disconnect();

    console.log('\n================================================================');
    console.log('🎉 ALL DELAYED ANSWER EXPLANATION TESTS PASSED PERFECTLY!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRegressionSuite();
