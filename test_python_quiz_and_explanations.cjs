const path = require('path');
require(path.resolve(__dirname, './server/node_modules/dotenv')).config({ path: path.resolve(__dirname, './server/.env') });
const { PrismaClient } = require(path.resolve(__dirname, './server/node_modules/@prisma/client'));
const prisma = new PrismaClient();
const http = require('http');

const BASE_URL = 'http://localhost:3001/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING PYTHON LOGIC QUIZ & POST-SUBMISSION EXPLANATIONS TEST ---\n');

  // TEST 1: Verify Quiz in Database under codenex GM
  console.log('TEST 1: Verifying Python Logic Quiz in database...');
  const codenexUser = await prisma.user.findFirst({ where: { username: 'codenex' } });
  if (!codenexUser) throw new Error('codenex user not found in DB');
  console.log(`✓ codenex user found: ${codenexUser.username} (${codenexUser.id})`);

  const quiz = await prisma.game.findFirst({
    where: { name: 'PYTHON LOGIC TRAPS: The First-Year Challenge' },
    include: { challenges: { orderBy: { position: 'asc' } } }
  });

  if (!quiz) throw new Error('Quiz game not found in database');
  if (quiz.designerId !== codenexUser.id) throw new Error(`Quiz designerId mismatch! Expected ${codenexUser.id}, got ${quiz.designerId}`);
  if (quiz.template !== 'QUIZ') throw new Error(`Quiz template mismatch! Expected QUIZ, got ${quiz.template}`);
  if (quiz.challenges.length !== 20) throw new Error(`Expected exactly 20 challenges, found ${quiz.challenges.length}`);

  console.log(`✓ Quiz "${quiz.name}" verified with 20 challenges owned by codenex.`);

  // Verify all 20 questions have non-empty prompt, options, answer, and explanation
  for (let i = 0; i < quiz.challenges.length; i++) {
    const c = quiz.challenges[i];
    const cfg = c.config || {};
    if (!c.prompt) throw new Error(`Challenge ${i + 1} missing prompt`);
    if (!cfg.options || !Array.isArray(cfg.options)) throw new Error(`Challenge ${i + 1} missing options`);
    if (cfg.answer === undefined || cfg.answer === null) throw new Error(`Challenge ${i + 1} missing answer`);
    if (!cfg.explanation) throw new Error(`Challenge ${i + 1} missing explanation`);
  }
  console.log('✓ All 20 questions have prompt, options, answer, and explanation.');

  // TEST 2: Verify Game Master login
  console.log('\nTEST 2: Game Master authentication...');
  // Find or create test host & student tokens
  const jwt = require(path.resolve(__dirname, './server/node_modules/jsonwebtoken'));
  const JWT_SECRET = process.env.JWT_SECRET || 'terminal_jwt_secret_dev_key';

  const hostToken = jwt.sign(
    { userId: codenexUser.id, username: codenexUser.username, role: codenexUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  let testStudent = await prisma.user.findFirst({ where: { username: 'quiz_tester_student' } });
  if (!testStudent) {
    testStudent = await prisma.user.create({
      data: {
        username: 'quiz_tester_student',
        email: 'quiz_tester_student@terminal.dev',
        passwordHash: 'dummy',
        role: 'PLAYER',
        accountStatus: 'ACTIVE',
        approvalStatus: 'APPROVED'
      }
    });
  }

  const studentToken = jwt.sign(
    { userId: testStudent.id, username: testStudent.username, role: testStudent.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  console.log('✓ Host and student tokens generated.');

  // TEST 3: Create an Event & Session with this Quiz
  console.log('\nTEST 3: Creating session for Python Logic Quiz...');
  let event = await prisma.event.findFirst({
    where: { name: 'Python Challenge Tournament' }
  });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'Python Challenge Tournament',
        creatorId: codenexUser.id,
        status: 'PUBLISHED',
        mode: 'GM_CONTROLLED',
      }
    });
  }

  // Link event to game
  await prisma.eventGame.deleteMany({ where: { eventId: event.id } });
  await prisma.eventGame.create({
    data: {
      eventId: event.id,
      gameId: quiz.id,
      position: 1,
      purpose: 'NORMAL'
    }
  });

  const roomCode = 'PY' + Math.floor(100 + Math.random() * 900);
  const session = await prisma.session.create({
    data: {
      eventId: event.id,
      roomCode,
      status: 'LOBBY',
      currentGameId: quiz.id,
      currentPosition: 0,
      gmId: codenexUser.id,
      snapshot: {
        gameId: quiz.id,
        challenges: quiz.challenges.map(c => ({
          id: c.id,
          position: c.position,
          type: c.type,
          prompt: c.prompt,
          points: c.points,
          timeLimit: c.timeLimit,
          options: (c.config && c.config.options) || c.options,
          answer: c.config && c.config.answer,
          explanation: c.config && c.config.explanation,
          config: c.config,
        }))
      }
    }
  });
  console.log(`✓ Session created with room code: ${roomCode}`);

  // Student joins session
  const joinRes = await request('POST', '/sessions/join', { roomCode }, studentToken);
  if (joinRes.status !== 200) throw new Error('Student failed to join session: ' + JSON.stringify(joinRes.data));
  console.log('✓ Student joined session.');

  // TEST 4: Host starts question 1
  console.log('\nTEST 4: Starting Question 1 (MCQ: Operator Precedence)...');
  let startRes = await request('POST', `/sessions/${session.roomCode}/start`, {}, hostToken);
  if (startRes.data?.session?.status === 'STARTING') {
    startRes = await request('POST', `/sessions/${session.roomCode}/start`, {}, hostToken);
  }
  if (startRes.status !== 200 && startRes.status !== 409) {
    const { startQuestion } = require('./server/dist/services/sessionLifecycle');
    await startQuestion(session, quiz.challenges[0].id, { actorUsername: 'codenex', actorId: codenexUser.id });
  }

  // TEST 5: Verify pre-submission leak prevention
  console.log('\nTEST 5: Pre-submission answer & explanation leak check...');
  const stateRes = await request('GET', `/sessions/${session.roomCode}`, null, studentToken);
  if (stateRes.status !== 200) throw new Error('Failed to get session state');

  const curChal = stateRes.data.currentChallenge;
  if (!curChal) throw new Error('currentChallenge is missing in session state');

  if (curChal.explanation || curChal.config?.explanation) {
    throw new Error('LEAK DETECTED! Explanation was sent to student before answer submission!');
  }
  if (curChal.answer || curChal.config?.answer || curChal.correct || curChal.config?.correct) {
    throw new Error('LEAK DETECTED! Correct answer was sent to student before answer submission!');
  }
  console.log('✓ Pre-submission state check PASSED: Explanation and Answer Key are completely hidden from student.');

  // TEST 6: Student submits correct answer for Q1
  console.log('\nTEST 6: Submitting answer for Q1 (Operator Precedence, correct answer: 5)...');
  const subRes = await request('POST', `/sessions/${session.roomCode}/submit`, { answer: '5' }, studentToken);
  if (subRes.status !== 200) throw new Error('Submission failed: ' + JSON.stringify(subRes.data));

  if (!subRes.data.isCorrect) throw new Error(`Expected submission to be correct! Got: ${JSON.stringify(subRes.data)}`);
  if (!subRes.data.explanation) throw new Error('Expected explanation to be revealed in submission response!');
  if (!subRes.data.correctAnswer) throw new Error('Expected correctAnswer to be revealed in submission response!');
  if (subRes.data.pointsAwarded !== 100) throw new Error(`Expected 100 points, got ${subRes.data.pointsAwarded}`);

  console.log('✓ Submission response received:');
  console.log(`    isCorrect: ${subRes.data.isCorrect}`);
  console.log(`    pointsAwarded: ${subRes.data.pointsAwarded}`);
  console.log(`    correctAnswer: ${subRes.data.correctAnswer}`);
  console.log(`    explanation: "${subRes.data.explanation}"`);

  // TEST 7: Duplicate submission attempt (Never allow extra points)
  console.log('\nTEST 7: Attempting repeated submission (verifying no duplicate points)...');
  const dupRes = await request('POST', `/sessions/${session.roomCode}/submit`, { answer: '5' }, studentToken);
  if (dupRes.status !== 200 && dupRes.status !== 400) throw new Error('Unexpected duplicate status: ' + dupRes.status);
  
  if (dupRes.status === 200) {
    if (dupRes.data.pointsAwarded !== 0) {
      throw new Error(`SECURITY FAIL! Repeated submission awarded ${dupRes.data.pointsAwarded} points!`);
    }
    console.log('✓ Duplicate submission idempotently returned cached answer with 0 extra points.');
  } else {
    console.log('✓ Duplicate submission rejected with status 400.');
  }

  // TEST 8: GET /:code/my-submission check
  console.log('\nTEST 8: Testing GET /:code/my-submission for page refresh rehydration...');
  const mySubRes = await request('GET', `/sessions/${session.roomCode}/my-submission`, null, studentToken);
  if (mySubRes.status !== 200) throw new Error('Failed to get my-submission: ' + JSON.stringify(mySubRes.data));
  if (!mySubRes.data.hasSubmitted) throw new Error('my-submission reported hasSubmitted: false!');
  if (!mySubRes.data.isCorrect) throw new Error('my-submission reported isCorrect: false!');
  if (!mySubRes.data.explanation) throw new Error('my-submission missing explanation!');
  console.log('✓ my-submission returned locked answer, isCorrect, and explanation for rehydration.');

  // TEST 9: Advance to Q5 (MAQ question: Boolean Logic)
  console.log('\nTEST 9: Testing MAQ question validation (Q5 Boolean Logic)...');
  const q5 = quiz.challenges.find(c => c.prompt.includes('Boolean logic'));
  if (!q5) throw new Error('Q5 Boolean logic challenge not found');

  const { startQuestion } = require('./server/dist/services/sessionLifecycle');
  await startQuestion(session, q5.id, { actorUsername: 'codenex', actorId: codenexUser.id });

  // Pre-submission leak check on Q5
  const q5State = await request('GET', `/sessions/${session.roomCode}`, null, studentToken);
  if (q5State.data.currentChallenge?.explanation || q5State.data.currentChallenge?.config?.explanation) {
    throw new Error('LEAK DETECTED on Q5! Explanation leaked before submission!');
  }
  console.log('✓ Q5 explanation is hidden before submission.');

  // Partial submission (only A & B, missing C) -> Should be INCORRECT
  const partialSub = await request('POST', `/sessions/${session.roomCode}/submit`, {
    answer: ['x > 5 and x < 10', 'x == 6 or x == 7']
  }, studentToken);
  if (partialSub.status === 200 && partialSub.data.isCorrect) {
    throw new Error('MAQ Partial submission was marked correct! All correct options must be selected.');
  }
  console.log('✓ MAQ Partial answer correctly evaluated as INCORRECT (points: 0).');
  // Full correct submission with second student
  let student2 = await prisma.user.findFirst({ where: { username: 'quiz_tester_student_2' } });
  if (!student2) {
    student2 = await prisma.user.create({
      data: {
        username: 'quiz_tester_student_2',
        email: 'quiz_tester_student_2@terminal.dev',
        passwordHash: 'dummy',
        role: 'PLAYER',
        accountStatus: 'ACTIVE',
        approvalStatus: 'APPROVED'
      }
    });
  }
  const student2Token = jwt.sign(
    { userId: student2.id, username: student2.username, role: student2.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  await request('POST', '/sessions/join', { roomCode: session.roomCode }, student2Token);

  const fullSub = await request('POST', `/sessions/${session.roomCode}/submit`, {
    answer: ['x > 5 and x < 10', 'x == 6 or x == 7', 'not (x > 6)']
  }, student2Token);
  if (!fullSub.data.isCorrect || fullSub.data.pointsAwarded !== 100) {
    throw new Error('MAQ complete submission failed: ' + JSON.stringify(fullSub.data));
  }
  console.log('✓ MAQ Complete answer correctly evaluated as CORRECT (points: 100).');

  // TEST 10: Advance to Q9 (True/False: String immutability)
  console.log('\nTEST 10: Testing True/False question validation (Q9 String immutability)...');
  const q9 = quiz.challenges.find(c => c.prompt.includes('String immutability'));
  if (!q9) throw new Error('Q9 String immutability challenge not found');

  await startQuestion(session, q9.id, { actorUsername: 'codenex', actorId: codenexUser.id });

  const tfSub = await request('POST', `/sessions/${session.roomCode}/submit`, { answer: 'False' }, studentToken);
  if (!tfSub.data.isCorrect || tfSub.data.pointsAwarded !== 100) {
    throw new Error('True/False submission failed: ' + JSON.stringify(tfSub.data));
  }
  if (!tfSub.data.explanation.includes('immutable')) {
    throw new Error('True/False explanation missing keyword: ' + tfSub.data.explanation);
  }
  console.log('✓ True/False answer correctly evaluated as CORRECT (points: 100).');
  console.log(`    Explanation revealed: "${tfSub.data.explanation}"`);

  // Clean up test session
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.sessionPlayer.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.delete({ where: { id: session.id } });

  console.log('\n--- ALL PYTHON LOGIC QUIZ & POST-SUBMISSION EXPLANATION TESTS PASSED! ---');
}

runTests()
  .catch(err => {
    console.error('\nTEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
