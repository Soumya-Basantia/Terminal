const axios = require('axios');
const io = require('socket.io-client');

const API = 'http://localhost:3001/api';

async function run() {
  try {
    console.log("=== STARTING EVENT GAME FLOW TEST ===");

    const gmEmail = `gm_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    }).catch((err) => { console.error("GM Register Error:", err.response ? err.response.data : err.message); });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });

    axios.defaults.headers.common['Authorization'] = `Bearer ${gmToken}`;

    // 1. Create 3 Quiz Games
    const gameIds = [];
    for (let i=1; i<=3; i++) {
      let res = await axios.post(`${API}/games`, {
        name: `Quiz ${i}`,
        description: 'Test',
        template: 'QUIZ'
      });
      const gId = res.data.game.id;
      gameIds.push(gId);
      await axios.post(`${API}/games/${gId}/challenges`, {
        type: 'MULTIPLE_CHOICE',
        prompt: `Q${i}`,
        points: 10,
        options: ['A', 'B'],
        answer: 'A'
      });
    }

    // 2. Create Event (RANDOM mode)
    let res = await axios.post(`${API}/events`, { name: 'Flow Event', mode: 'RANDOM' });
    const eventId = res.data.id;
    for (let i=0; i<3; i++) {
      await axios.post(`${API}/events/${eventId}/games`, { gameId: gameIds[i], position: i, purpose: 'NORMAL' });
    }
    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' });
    
    // 3. Create Session
    res = await axios.post(`${API}/sessions`, { eventId });
    const roomCode = res.data.session.roomCode;
    console.log("Session Created:", roomCode);

    // 4. Connect Host Socket
    const hostSocket = io('http://localhost:3001', { auth: { token: gmToken } });
    await new Promise(resolve => hostSocket.on('connect', resolve));
    hostSocket.emit('host:join', { roomCode });

    const waitForState = (socket, expectedStatus) => new Promise(resolve => {
      const listener = (state) => {
        if (state.session.status === expectedStatus) {
          socket.off('session_state_update', listener);
          resolve(state);
        }
      };
      socket.on('session_state_update', listener);
    });

    const getLatestState = (socket) => new Promise(resolve => {
      socket.once('session_state_update', resolve);
    });

    // 5. Connect 1 Student
    const email = `student_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, { email, username: `S_${Date.now()}`, password: 'password123', role: 'STUDENT' });
    const sLog = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
    const api = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${sLog.data.token}` } });
    await api.post('/sessions/join', { roomCode });
    const studentSocket = io('http://localhost:3001', { auth: { token: sLog.data.token } });
    await new Promise(resolve => studentSocket.on('connect', resolve));
    studentSocket.emit('player:join', { roomCode });
    
    // Test 1: Random Game Selection
    console.log("Test: Random Game");
    let statePromise = getLatestState(hostSocket);
    hostSocket.emit('host:random_game');
    let state = await statePromise;
    console.log("Random Game Selected:", state.currentGame.name);
    if (!state.session.currentGameId) throw new Error("Random game not selected");

    const firstRun = state.session.currentRun;
    
    // Start Question
    statePromise = waitForState(hostSocket, 'QUESTION_ACTIVE');
    hostSocket.emit('host:select_challenge', { challengeId: state.currentGame.challenges[0].id });
    state = await statePromise;
    
    // Student submits
    await api.post('/sessions/active/submit', { answer: 'A' });
    
    // Test 2: Replay Game
    console.log("Test: Replay Game");
    statePromise = getLatestState(hostSocket);
    hostSocket.emit('host:replay_game');
    state = await statePromise;
    console.log("Replay Game Selected, run:", state.session.currentRun);
    if (state.session.currentRun === firstRun) throw new Error("currentRun not incremented on replay");
    if (!state.session.currentGameId) throw new Error("Game ID cleared on replay");

    // Start Question again
    statePromise = waitForState(hostSocket, 'QUESTION_ACTIVE');
    hostSocket.emit('host:select_challenge', { challengeId: state.currentGame.challenges[0].id });
    state = await statePromise;
    
    // Student submits again
    await api.post('/sessions/active/submit', { answer: 'A' });

    // Verify Score Preservation
    let lb = await api.get(`/sessions/${roomCode}`);
    console.log("Score preserved:", lb.data.leaderboard[0].score);
    if (lb.data.leaderboard[0].score < 20) throw new Error("Score not preserved across replays");

    // Test 3: Skip Game
    console.log("Test: Skip Game");
    statePromise = getLatestState(hostSocket);
    hostSocket.emit('host:skip_game');
    state = await statePromise;
    console.log("Skipped to Game position:", state.session.currentPosition);
    if (state.session.currentPosition === 0) throw new Error("Skip did not increment position");
    
    // Test 4: End Event
    console.log("Test: End Event");
    statePromise = getLatestState(hostSocket);
    hostSocket.emit('host:end_event');
    state = await statePromise;
    if (state.session.status !== 'ENDED') throw new Error("Event did not end");
    console.log("Event Ended.");

    hostSocket.disconnect();
    studentSocket.disconnect();

    console.log("=== ALL EVENT FLOW TESTS PASSED! ===");
    process.exit(0);

  } catch (err) {
    console.error("Test Failed:", err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

run();
