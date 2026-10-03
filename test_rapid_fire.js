const { PrismaClient } = require('@prisma/client');
const { io } = require('socket.io-client');
const axios = require('axios');
const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log("=== STARTING RAPID FIRE TEST ===");

  // 1. Create Host
  const salt = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7);
  const hostRes = await axios.post(`${API_URL}/auth/register`, {
    username: 'hostrf_' + salt, email: 'hostrf_' + salt + '@test.com', password: 'password', role: 'HOST'
  });
  const hostToken = hostRes.data.token;
  const hostId = hostRes.data.user.id;
  await prisma.user.update({ where: { id: hostId }, data: { role: 'SUPER_ADMIN' } });
  const hostAuth = { headers: { Authorization: `Bearer ${hostToken}` } };

  // 2. Create Student
  const studentRes = await axios.post(`${API_URL}/auth/register`, {
    username: 'sturf_' + salt, email: 'sturf_' + salt + '@test.com', password: 'password', role: 'PLAYER'
  });
  const studentToken = studentRes.data.token;
  const studentAuth = { headers: { Authorization: `Bearer ${studentToken}` } };

  // 3. Use an approved Club & create a Rapid Fire Game
  const club = await prisma.club.findUnique({ where: { slug: 'codenex' } });
  if (!club) throw new Error('CODENEX is missing; run the database seed first');
  const clubId = club.id;

  const gameRes = await axios.post(`${API_URL}/games`, {
    clubId,
    name: 'Tech Blitz',
    description: 'Rapid fire test',
    template: 'RAPID_FIRE',
    config: { speedBonus: 5, streakBonus: true, maxStreakBonus: 20, allowLateAnswers: false }
  }, hostAuth);
  const gameId = gameRes.data.game.id;

  // Add 3 Challenges (Short timers)
  await axios.post(`${API_URL}/games/${gameId}/challenges`, {
    prompt: 'Q1', type: 'MULTIPLE_CHOICE', points: 10, timerSecs: 5, position: 0,
    options: ['A', 'B', 'C', 'D'], answer: 'A'
  }, hostAuth);
  
  await axios.post(`${API_URL}/games/${gameId}/challenges`, {
    prompt: 'Q2', type: 'MULTIPLE_CHOICE', points: 10, timerSecs: 5, position: 1,
    options: ['A', 'B', 'C', 'D'], answer: 'B'
  }, hostAuth);
  
  await axios.post(`${API_URL}/games/${gameId}/challenges`, {
    prompt: 'Q3', type: 'MULTIPLE_CHOICE', points: 10, timerSecs: 5, position: 2,
    options: ['A', 'B', 'C', 'D'], answer: 'C'
  }, hostAuth);

  // 4. Create Event
  const eventRes = await axios.post(`${API_URL}/events`, {
    clubId, name: 'RF Event ' + Date.now(), mode: 'SEQUENCE'
  }, hostAuth);
  const eventId = eventRes.data.id;
  await axios.post(`${API_URL}/events/${eventId}/games`, { gameId, position: 0, purpose: 'NORMAL' }, hostAuth);
  await axios.put(`${API_URL}/events/${eventId}`, { status: 'PUBLISHED' }, hostAuth);

  // 5. Create Session
  const sessionRes = await axios.post(`${API_URL}/sessions`, { eventId }, hostAuth);
  const roomCode = sessionRes.data.session.roomCode;
  
  console.log(`Room Code: ${roomCode}`);

  let currentState = null;
  const waitForState = (socket, expectedStatus) => new Promise(resolve => {
    const listener = (state) => {
      currentState = state;
      if (!expectedStatus || state.session.status === expectedStatus) {
        socket.off('session_state_update', listener);
        resolve(state);
      }
    };
    socket.on('session_state_update', listener);
  });



  // 6. Connect Sockets
  const hostSocket = io(SOCKET_URL, { auth: { token: hostToken } });
  await new Promise(resolve => hostSocket.on('connect', resolve));
  
  // Keep state updated even without waitForState
  hostSocket.on('session_state_update', (state) => {
    currentState = state;
  });
  
  const studentSocket = io(SOCKET_URL, { auth: { token: studentToken } });
  await new Promise(resolve => studentSocket.on('connect', resolve));
  
  // 7. Join Student via REST & socket
  await axios.post(`${API_URL}/sessions/join`, { roomCode }, studentAuth);
  
  let pHostLobby = waitForState(hostSocket, 'LOBBY');
  hostSocket.emit('host:join', { roomCode });
  await pHostLobby;
  
  let pStudentLobby = waitForState(studentSocket, 'LOBBY');
  studentSocket.emit('player:join', { roomCode });
  await pStudentLobby;
  
  await wait(500);
  
  // 8. Host selects game & activates round
  let pNextState = waitForState(hostSocket, null);
  hostSocket.emit('host:select_game', { gameId, position: 0 });
  await pNextState;
  await wait(1500);
  // Wait, select_game triggers state update!
  if (!currentState || !currentState.currentGame) {
    console.error("State after select_game:", currentState);
    throw new Error("No currentGame in state!");
  }
  const q1Id = currentState.currentGame.challenges[0].id;
  
  let pQuestionActive = waitForState(hostSocket, 'QUESTION_ACTIVE');
  hostSocket.emit('host:select_challenge', { challengeId: q1Id });
  await pQuestionActive;
  await wait(200);

  // 10. Student submits correctly (Fast -> Speed Bonus)
  let subRes = await axios.post(`${API_URL}/sessions/active/submit`, { answer: 'A' }, studentAuth);
  console.log("Sub 1 (Correct, Fast):", subRes.data);
  if (!subRes.data.isRapidFire) throw new Error("Missing isRapidFire flag");
  if (subRes.data.pointsAwarded < 11) throw new Error("Expected speed bonus");
  
  // Duplicate submission
  try {
    await axios.post(`${API_URL}/sessions/active/submit`, { answer: 'B' }, studentAuth);
    throw new Error("Duplicate submission succeeded!");
  } catch (err) {
    if (err.response?.status !== 400) throw new Error("Unexpected duplicate err: " + err.message);
  }

  console.log("Waiting for Q1 to lock...");
  await wait(5500); // 5s limit for Q1 + padding
  if (currentState.session.status !== 'QUESTION_LOCKED') {
    throw new Error("Server timer failed to lock question");
  }

  // 11. Student tries late submission
  try {
    await axios.post(`${API_URL}/sessions/active/submit`, { answer: 'A' }, studentAuth);
    throw new Error("Late submission succeeded!");
  } catch (err) {
    if (err.response?.status !== 400) throw new Error("Unexpected late err: " + err.message);
  }

  console.log("Waiting for auto-transition to Q2...");
  await wait(4500); // 4s result timer + padding
  if (currentState.session.status !== 'QUESTION_ACTIVE' || currentState.session.currentChallengeId === q1Id) {
    console.log("Current status:", currentState.session.status);
    throw new Error("Server timer failed to auto-transition to Q2");
  }

  // 12. Student submits Q2 correctly
  subRes = await axios.post(`${API_URL}/sessions/active/submit`, { answer: 'B' }, studentAuth);
  console.log("Sub 2 (Correct):", subRes.data);
  // streak is 2, bonus points usually don't trigger till 3.
  if (subRes.data.streak !== 2) throw new Error("Streak should be 2");

  await wait(5500); // Let Q2 lock
  await wait(4500); // Let Q3 start

  // 13. Student submits Q3 correctly -> STREAK!
  subRes = await axios.post(`${API_URL}/sessions/active/submit`, { answer: 'C' }, studentAuth);
  console.log("Sub 3 (Correct):", subRes.data);
  if (subRes.data.streak !== 3) throw new Error("Streak should be 3");

  await wait(5500); // Let Q3 lock
  await wait(4500); // End game

  if (currentState.session.status !== 'RESULTS') {
    throw new Error("Game didn't auto-end properly");
  }

  console.log("=== RAPID FIRE TEST PASSED ===");
  hostSocket.disconnect();
  studentSocket.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error("Test failed:", err.response ? err.response.data : err);
  process.exit(1);
});
