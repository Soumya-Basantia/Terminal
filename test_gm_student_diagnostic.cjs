const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

async function runDiagnostic() {
  console.log('================================================================');
  console.log('   REPRODUCIBLE DIAGNOSTIC: GM / STUDENT INTEGRATION & AUTH     ');
  console.log('================================================================');

  const ts = Date.now();

  // 1. Authenticate GM and Student, plus an isolated Other GM
  console.log('\n[Step 1] Authenticating GM, Student, and Second GM...');
  
  // Owning GM
  const gmRes = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gm = gmRes.data.user;
  const gmToken = gmRes.data.token;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };
  console.log(`✓ Owning GM authenticated: ${gm.username} (${gm.id})`);

  // Student
  const studentReg = await axios.post(`${API}/auth/register`, {
    name: `Diag Student ${ts}`,
    username: `student_${ts}`,
    usn: `1VA24CS${String(ts).slice(-3)}`,
    email: `student_${ts}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'Password123!',
  });
  const student = studentReg.data.user;
  const studentToken = studentReg.data.token;
  const studentHeaders = { headers: { Authorization: `Bearer ${studentToken}` } };
  console.log(`✓ Student registered & authenticated: ${student.username} (${student.id})`);

  // Second GM (for different GM guard check)
  const bcrypt = require('./server/node_modules/bcryptjs');
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const otherGmUser = await prisma.user.create({
    data: {
      name: `Other GM ${ts}`,
      username: `othergm_${ts}`,
      email: `othergm_${ts}@campus.edu`,
      passwordHash,
      role: 'GAME_MASTER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
    }
  });
  const otherGmLogin = await axios.post(`${API}/auth/login`, {
    login: otherGmUser.email,
    password: 'Password123!',
  });
  const otherGmToken = otherGmLogin.data.token;
  const otherGmHeaders = { headers: { Authorization: `Bearer ${otherGmToken}` } };
  console.log(`✓ Second GM created & logged in: ${otherGmUser.username} (${otherGmUser.id})`);

  // 2. Create a game and session as the owning GM
  console.log('\n[Step 2] Creating game & live session as Owning GM...');
  const gameRes = await axios.post(`${API}/games`, {
    name: `Diag Game ${ts}`,
    template: 'QUIZ',
    description: 'Integration test quiz',
    maxPlayers: 50,
    teamsEnabled: false,
    speedBonus: false,
  }, gmHeaders);
  const game = gameRes.data.game;

  // Add a challenge
  await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    answer: '4',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, gmHeaders);

  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);

  // Host session
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const session = sessionRes.data.session;
  console.log(`✓ Session created: roomCode = ${session.roomCode}, gmId = ${session.gmId}`);

  if (session.gmId !== gm.id) {
    throw new Error(`Session gmId mismatch: expected ${gm.id}, got ${session.gmId}`);
  }

  // 3 & 4. Join session as Student via POST /api/sessions/join & verify participant persistence
  console.log('\n[Step 3 & 4] Joining session as student & verifying DB persistence...');
  const joinRes1 = await axios.post(`${API}/sessions/join`, { roomCode: session.roomCode }, studentHeaders);
  if (joinRes1.status !== 200) throw new Error('Student join failed');

  // Verify DB record
  let playersInDb = await prisma.sessionPlayer.findMany({
    where: { sessionId: session.id, userId: student.id }
  });
  console.log(`✓ Participants in DB after 1st join: ${playersInDb.length}`);
  if (playersInDb.length !== 1) {
    throw new Error(`Expected exactly 1 participant in DB, found ${playersInDb.length}`);
  }

  // Idempotent re-join
  await axios.post(`${API}/sessions/join`, { roomCode: session.roomCode }, studentHeaders);
  playersInDb = await prisma.sessionPlayer.findMany({
    where: { sessionId: session.id, userId: student.id }
  });
  console.log(`✓ Participants in DB after 2nd (idempotent) join: ${playersInDb.length}`);
  if (playersInDb.length !== 1) {
    throw new Error(`Expected exactly 1 participant in DB after re-join, found ${playersInDb.length}`);
  }

  // 5. Verify Host can retrieve the updated participant count
  console.log('\n[Step 5] Verifying GM Host retrieves updated participant count...');
  const hostStateRes = await axios.get(`${API}/sessions/${session.roomCode}/host`, gmHeaders);
  console.log(`✓ Host GET /:roomCode/host returned playerCount = ${hostStateRes.data.playerCount}`);
  if (hostStateRes.data.playerCount !== 1) {
    throw new Error(`Expected host playerCount = 1, got ${hostStateRes.data.playerCount}`);
  }
  const roster = hostStateRes.data.playerRoster || [];
  const foundInRoster = roster.find(p => p.userId === student.id);
  if (!foundInRoster) {
    throw new Error(`Student ${student.id} not found in host playerRoster`);
  }
  console.log(`✓ Student visible in host playerRoster: ${foundInRoster.handle} (status: ${foundInRoster.status})`);

  // 3 (Diagnosis). Verify Authorization Guards on POST /:code/start
  console.log('\n[Step 3 (Diagnosis)] Testing authorization guards on POST /:code/start:');
  
  // (a) Unauthenticated caller
  try {
    await axios.post(`${API}/sessions/${session.roomCode}/start`);
    throw new Error('Unauthenticated caller should have been rejected');
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('  ✓ (a) Unauthenticated caller: 401 Unauthorized as required');
    } else {
      throw new Error(`Expected 401, got ${err.response?.status}`);
    }
  }

  // (b) Student caller
  try {
    await axios.post(`${API}/sessions/${session.roomCode}/start`, {}, studentHeaders);
    throw new Error('Student caller should have been rejected');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('  ✓ (b) Student caller: 403 Forbidden as required');
    } else {
      throw new Error(`Expected 403, got ${err.response?.status}`);
    }
  }

  // (c) Different GM caller
  try {
    await axios.post(`${API}/sessions/${session.roomCode}/start`, {}, otherGmHeaders);
    throw new Error('Different GM caller should have been rejected');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('  ✓ (c) Different GM caller: 403 Forbidden as required');
    } else {
      throw new Error(`Expected 403, got ${err.response?.status}`);
    }
  }

  // 6 & 7. Connect sockets & Start session as owning GM
  console.log('\n[Step 6 & 7] Connecting sockets and starting session as Owning GM...');
  
  // Student socket
  const studentSocket = io(SOCKET_URL, {
    auth: { token: studentToken }
  });
  await new Promise(r => studentSocket.on('connect', r));
  console.log('✓ Student socket connected');
  studentSocket.emit('player:join', { roomCode: session.roomCode });

  // GM socket
  const gmSocket = io(SOCKET_URL, {
    auth: { token: gmToken }
  });
  await new Promise(r => gmSocket.on('connect', r));
  console.log('✓ GM socket connected');
  gmSocket.emit('host:join', { roomCode: session.roomCode });

  // Set up student listener for active question
  let receivedQuestion = null;
  const questionPromise = new Promise((resolve) => {
    studentSocket.on('session_state_update', (data) => {
      const activeChalId = data.session?.currentChallengeId;
      if (activeChalId && (data.session?.status === 'QUESTION_ACTIVE' || data.session?.status === 'ROUND_ACTIVE')) {
        const chal = data.currentGame?.challenges?.find(c => c.id === activeChalId);
        receivedQuestion = chal;
        resolve(chal);
      }
    });
    studentSocket.on('challenge:started', (data) => {
      receivedQuestion = data;
      resolve(data);
    });
  });

  // Owning GM starts the session
  console.log('[6] Owning GM calling POST /:code/start...');
  const start1 = await axios.post(`${API}/sessions/${session.roomCode}/start`, {}, gmHeaders);
  console.log(`  ✓ Start 1 responded: status = ${start1.data.session.status}`);

  if (start1.data.session.status === 'STARTING') {
    // Single-click flow: trigger start again to transition STARTING -> QUESTION_ACTIVE
    const start2 = await axios.post(`${API}/sessions/${session.roomCode}/start`, {}, gmHeaders);
    console.log(`  ✓ Start 2 responded: status = ${start2.data.session.status}`);
  }

  // Wait for student socket to receive question
  console.log('[7] Waiting for student to receive active question via socket...');
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for student question')), 5000));
  const activeQuestion = await Promise.race([questionPromise, timeout]);

  console.log(`✓ Student successfully received active question: "${activeQuestion.prompt || activeQuestion.title}"`);

  // Clean up
  studentSocket.disconnect();
  gmSocket.disconnect();
  await prisma.user.delete({ where: { id: otherGmUser.id } }).catch(() => {});

  console.log('\n================================================================');
  console.log('✓ ALL 7 DIAGNOSTIC & VERIFICATION CRITERIA PASSED SUCCESSFULLY! ');
  console.log('================================================================\n');
}

runDiagnostic()
  .catch((err) => {
    console.error('\n❌ DIAGNOSTIC FAILED:', err.message);
    if (err.response?.data) console.error('Response data:', err.response.data);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
