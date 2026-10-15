const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('./server/node_modules/bcryptjs');

const prisma = new PrismaClient();
const API = 'http://localhost:3001/api';

async function runAuthRegression() {
  console.log('================================================================');
  console.log('   GM AUTHORIZATION REGRESSION TEST SUITE                      ');
  console.log('================================================================');

  const ts = Date.now();

  // 1. Setup Identities
  console.log('\n[Setup] Authenticating Owning GM, Different GM, and Student...');
  
  // Owning GM
  const owningGmRes = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const owningGm = owningGmRes.data.user;
  const owningHeaders = { headers: { Authorization: `Bearer ${owningGmRes.data.token}` } };
  console.log(`✓ Owning GM: ${owningGm.username} (${owningGm.id})`);

  // Different GM
  const diffGmUser = await prisma.user.create({
    data: {
      name: `Different GM ${ts}`,
      username: `diffgm_${ts}`,
      email: `diffgm_${ts}@campus.edu`,
      passwordHash: await bcrypt.hash('Password123!', 10),
      role: 'GAME_MASTER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
    }
  });
  const diffGmRes = await axios.post(`${API}/auth/login`, {
    login: diffGmUser.email,
    password: 'Password123!',
  });
  const diffHeaders = { headers: { Authorization: `Bearer ${diffGmRes.data.token}` } };
  console.log(`✓ Different GM: ${diffGmUser.username} (${diffGmUser.id})`);

  // Student
  const studentReg = await axios.post(`${API}/auth/register`, {
    name: `Student ${ts}`,
    username: `regstudent_${ts}`,
    usn: `1VA24CS${String(ts).slice(-3)}`,
    email: `regstudent_${ts}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'Password123!',
  });
  const student = studentReg.data.user;
  const studentHeaders = { headers: { Authorization: `Bearer ${studentReg.data.token}` } };
  console.log(`✓ Student: ${student.username} (${student.id})`);

  // 2. Create game with 2 questions and a live session
  const gameRes = await axios.post(`${API}/games`, {
    name: `Auth Regression Game ${ts}`,
    template: 'QUIZ',
    description: 'Testing GM authorization regression',
    maxPlayers: 20,
    teamsEnabled: false,
    speedBonus: false,
  }, owningHeaders);
  const game = gameRes.data.game;

  // Question 1
  await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Question 1',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, owningHeaders);

  // Question 2
  await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Question 2',
    options: ['X', 'Y', 'Z'],
    answer: 'X',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, owningHeaders);

  await axios.post(`${API}/games/${game.id}/publish`, {}, owningHeaders);

  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, owningHeaders);
  const session = sessionRes.data.session;
  const roomCode = session.roomCode;
  const sessionId = session.id;
  console.log(`✓ Session created: ${roomCode} (ID: ${sessionId}, gmId: ${session.gmId})`);

  // Student joins session
  await axios.post(`${API}/sessions/join`, { roomCode }, studentHeaders);

  // Helper for expecting HTTP status
  async function expectStatus(promise, expectedStatus, description) {
    try {
      const res = await promise;
      if (res.status === expectedStatus) {
        console.log(`  ✓ ${description} -> ${res.status} OK`);
        return res;
      }
      throw new Error(`${description}: Expected ${expectedStatus}, got ${res.status}`);
    } catch (err) {
      if (err.response?.status === expectedStatus) {
        console.log(`  ✓ ${description} -> ${err.response.status} (as expected)`);
        return err.response;
      }
      throw new Error(`${description}: Expected ${expectedStatus}, got ${err.response?.status || err.message}`);
    }
  }

  // ============================================================================
  // TEST SECTION 1: POST /api/sessions/:code/start
  // ============================================================================
  console.log('\n--- [Endpoint 1] POST /api/sessions/:code/start ---');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/start`), 401, 'Unauthenticated caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/start`, {}, studentHeaders), 403, 'Student caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/start`, {}, diffHeaders), 403, 'Different GM caller');
  await expectStatus(axios.post(`${API}/sessions/INVALID99/start`, {}, owningHeaders), 404, 'Invalid room code');

  // Valid Owning GM start
  const startRes1 = await expectStatus(axios.post(`${API}/sessions/${roomCode}/start`, {}, owningHeaders), 200, 'Owning GM start (LOBBY -> STARTING)');
  console.log(`    Status transitioned to: ${startRes1.data.session.status}`);

  const startRes2 = await expectStatus(axios.post(`${API}/sessions/${roomCode}/start`, {}, owningHeaders), 200, 'Owning GM start (STARTING -> QUESTION_ACTIVE)');
  console.log(`    Status transitioned to: ${startRes2.data.session.status}`);

  // Invalid transition when already QUESTION_ACTIVE
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/start`, {}, owningHeaders), 409, 'Owning GM start while already QUESTION_ACTIVE');

  // ============================================================================
  // TEST SECTION 2: POST /api/sessions/:code/lock
  // ============================================================================
  console.log('\n--- [Endpoint 2] POST /api/sessions/:code/lock ---');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/lock`), 401, 'Unauthenticated caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/lock`, {}, studentHeaders), 403, 'Student caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/lock`, {}, diffHeaders), 403, 'Different GM caller');
  await expectStatus(axios.post(`${API}/sessions/INVALID99/lock`, {}, owningHeaders), 404, 'Invalid room code');

  // Valid Owning GM lock
  const lockRes = await expectStatus(axios.post(`${API}/sessions/${roomCode}/lock`, {}, owningHeaders), 200, 'Owning GM lock');
  console.log(`    Status transitioned to: ${lockRes.data.session.status}`);

  // Replay lock when already locked -> 409
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/lock`, {}, owningHeaders), 409, 'Owning GM replay lock when already locked');

  // ============================================================================
  // TEST SECTION 3: POST /api/sessions/:code/next
  // ============================================================================
  console.log('\n--- [Endpoint 3] POST /api/sessions/:code/next ---');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/next`), 401, 'Unauthenticated caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/next`, {}, studentHeaders), 403, 'Student caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/next`, {}, diffHeaders), 403, 'Different GM caller');
  await expectStatus(axios.post(`${API}/sessions/INVALID99/next`, {}, owningHeaders), 404, 'Invalid room code');

  // Valid Owning GM advance to next challenge
  const nextRes1 = await expectStatus(axios.post(`${API}/sessions/${roomCode}/next`, {}, owningHeaders), 200, 'Owning GM advance to Q2');
  console.log(`    Status transitioned to: ${nextRes1.data.session.status} (challenge: ${nextRes1.data.session.currentChallengeId})`);

  // Lock Q2 so we can advance again
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/lock`, {}, owningHeaders), 200, 'Owning GM lock Q2');

  // Valid Owning GM advance past final challenge -> RESULTS
  const nextRes2 = await expectStatus(axios.post(`${API}/sessions/${roomCode}/next`, {}, owningHeaders), 200, 'Owning GM advance past final challenge -> RESULTS');
  console.log(`    Status transitioned to: ${nextRes2.data.session.status} (finished: ${nextRes2.data.finished})`);

  // Idempotent advance when already RESULTS -> 200
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/next`, {}, owningHeaders), 200, 'Owning GM replay next when already RESULTS (idempotent)');

  // ============================================================================
  // TEST SECTION 4: POST /api/sessions/:code/end
  // ============================================================================
  console.log('\n--- [Endpoint 4] POST /api/sessions/:code/end ---');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/end`), 401, 'Unauthenticated caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/end`, {}, studentHeaders), 403, 'Student caller');
  await expectStatus(axios.post(`${API}/sessions/${roomCode}/end`, {}, diffHeaders), 403, 'Different GM caller');
  await expectStatus(axios.post(`${API}/sessions/INVALID99/end`, {}, owningHeaders), 404, 'Invalid room code');

  // Valid Owning GM end
  const endRes1 = await expectStatus(axios.post(`${API}/sessions/${roomCode}/end`, {}, owningHeaders), 200, 'Owning GM end');
  console.log(`    Status: ${endRes1.data.session.status}, alreadyEnded: ${endRes1.data.alreadyEnded}`);

  // Replay end -> 200 idempotent (alreadyEnded: true)
  const endRes2 = await expectStatus(axios.post(`${API}/sessions/${roomCode}/end`, {}, owningHeaders), 200, 'Owning GM replay end (idempotent)');
  if (!endRes2.data.alreadyEnded) {
    throw new Error('Replay end must return alreadyEnded: true');
  }

  // ============================================================================
  // TEST SECTION 5: PUT /api/sessions/:id/status
  // ============================================================================
  console.log('\n--- [Endpoint 5] PUT /api/sessions/:id/status ---');
  await expectStatus(axios.put(`${API}/sessions/${sessionId}/status`, { status: 'LOBBY' }), 401, 'Unauthenticated caller');
  await expectStatus(axios.put(`${API}/sessions/${sessionId}/status`, { status: 'LOBBY' }, studentHeaders), 403, 'Student caller');
  await expectStatus(axios.put(`${API}/sessions/${sessionId}/status`, { status: 'LOBBY' }, diffHeaders), 403, 'Different GM caller');
  await expectStatus(axios.put(`${API}/sessions/${sessionId}/status`, { status: 'INVALID_STATUS' }, owningHeaders), 400, 'Malformed status string');
  
  // Re-open from ENDED -> illegal transition -> 409
  await expectStatus(axios.put(`${API}/sessions/${sessionId}/status`, { status: 'LOBBY' }, owningHeaders), 409, 'Illegal transition from ENDED -> LOBBY (terminal state)');
  await expectStatus(axios.put(`${API}/sessions/${sessionId}/status`, { status: 'QUESTION_ACTIVE' }, owningHeaders), 409, 'Illegal transition from ENDED -> QUESTION_ACTIVE (terminal state)');

  // Clean up
  await prisma.user.delete({ where: { id: diffGmUser.id } }).catch(() => {});

  console.log('\n================================================================');
  console.log('✓ ALL 25 AUTHORIZATION & LIFECYCLE REGRESSION CHECKS PASSED!     ');
  console.log('================================================================\n');
}

runAuthRegression()
  .catch((err) => {
    console.error('\n❌ REGRESSION TEST FAILED:', err.message);
    if (err.response?.data) console.error('Response data:', err.response.data);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
