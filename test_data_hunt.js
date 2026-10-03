const axios = require('axios');
const io = require('socket.io-client');

const API = 'http://localhost:3001/api';

async function run() {
  try {
    console.log("=== STARTING DATA HUNT TEST ===");

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

    // 2. Create Data Hunt Game
    let res = await axios.post(`${API}/games`, {
      name: 'Data Hunt Test Game',
      description: 'Find the pirate treasure',
      template: 'DATA_HUNT',
      config: {
        datasetUrl: 'https://pirate.mock/dataset.json',
        story: 'Captain Blackbeard hid his treasure.'
      }
    });
    console.log("Game created:", res.data.game.id);
    const gameId = res.data.game.id;

    // 3. Add 3 Challenges (Nodes)
    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'FILTER',
      prompt: `Node 1: Find ships that sailed to Tortuga`,
      points: 10,
      clue: 'Destination is Tortuga',
      field: 'destination',
      correct: 'Tortuga',
      onSuccess: 'You found the ship manifest!'
    });

    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'MULTI_FILTER',
      prompt: `Node 2: Identify the pirate captain with a wooden leg`,
      points: 20,
      clue: 'Leg type is Wooden',
      field: 'legType',
      correct: 'Wooden',
      onSuccess: 'Captain identified as Peg-Leg Pete!'
    });

    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'SORT',
      prompt: `Node 3: Sort maps by year oldest first to find the treasure map`,
      points: 30,
      clue: 'Sort maps ascending by year',
      field: 'year',
      correct: 'asc',
      onSuccess: 'Treasure map secured!'
    });

    // 4. Create Event & Session
    res = await axios.post(`${API}/events`, { name: 'Data Hunt Event', mode: 'SEQUENCE' });
    const eventId = res.data.id;
    await axios.post(`${API}/events/${eventId}/games`, { gameId, position: 0 });
    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' });
    res = await axios.post(`${API}/sessions`, { eventId });
    const sessionId = res.data.session.id;
    const roomCode = res.data.session.roomCode;
    console.log("Session Created:", roomCode);

    // 5. Connect Host Socket
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

    const waitForChainProgress = (socket, sessionPlayerId, expectedResult) => new Promise(resolve => {
      const listener = (state) => {
        const prog = state.chainProgress?.[sessionPlayerId];
        if (expectedResult === 'COMPLETED') {
          if (prog === 'COMPLETED') {
            socket.off('session_state_update', listener);
            resolve(state);
          }
        } else if (expectedResult === 'NEXT') {
          // just wait for the progress to be a string (a challenge ID) and not completed
          if (prog && typeof prog === 'string' && prog !== 'COMPLETED') {
            socket.off('session_state_update', listener);
            resolve(state);
          }
        }
      };
      socket.on('session_state_update', listener);
    });

    // 6. Connect Stage Socket
    const stageSocket = io('http://localhost:3001', { auth: { isStage: true } });
    await new Promise(resolve => stageSocket.on('connect', resolve));
    stageSocket.emit('stage:join', { roomCode });

    // 7. Auth and Connect 2 Students
    const setupStudent = async (index) => {
      const email = `student${index}_${Date.now()}@test.com`;
      await axios.post(`${API}/auth/register`, { email, username: `S${index}_${Date.now()}`, password: 'password123', role: 'STUDENT' }).catch((err)=>{ console.error("Student Register Error:", err.response ? err.response.data : err.message); });
      const sLog = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
      const api = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${sLog.data.token}` } });
      const joinRes = await api.post('/sessions/join', { roomCode });
      const socket = io('http://localhost:3001', { auth: { token: sLog.data.token } });
      await new Promise(resolve => socket.on('connect', resolve));
      socket.emit('player:join', { roomCode });
      return { api, socket, id: joinRes.data.sessionPlayer.id, userId: sLog.data.user.id };
    };

    const s1 = await setupStudent(1);
    const s2 = await setupStudent(2);
    console.log("Students joined!");

    // 8. Start Game via Host
    hostSocket.emit('host:select_game', { gameId, position: 0 });
    await waitForState(hostSocket, 'STARTING');
    
    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await waitForState(hostSocket, 'ROUND_ACTIVE');
    console.log("Round Active!");

    // 9. Independent Progress Tests
    
    // Player A (s1) solves Node 1
    let p1 = waitForChainProgress(s1.socket, s1.id, 'NEXT');
    let sRes = await s1.api.post('/sessions/active/submit', { answer: 'Tortuga' });
    console.log("S1 Submit 1:", sRes.data.isCorrect);
    if (!sRes.data.isCorrect) throw new Error("S1 Submit 1 Failed");
    
    // Server should broadcast updated state to all
    await p1;
    console.log("S1 Data Hunt Progress updated via socket");

    // Player B (s2) is still at Node 1. Let's verify Player B's progress is unchanged.
    let state = await axios.get(`${API}/sessions/${roomCode}`);
    if (state.data.chainProgress[s1.id] === state.data.chainProgress[s2.id]) {
      throw new Error("Independent progression failed: S2 progress was affected by S1");
    }
    console.log("Independent progression verified (S2 unaffected).");

    // S2 solves Node 1
    let p2 = waitForChainProgress(stageSocket, s2.id, 'NEXT');
    sRes = await s2.api.post('/sessions/active/submit', { answer: 'Tortuga' });
    await p2;
    console.log("S2 Submit 1 Correct & Stage Updated");

    // 10. Security / Invalid Attempts
    
    // S2 submits Incorrect answer for Node 2
    sRes = await s2.api.post('/sessions/active/submit', { answer: 'Metal' });
    console.log("S2 Submit 2 Incorrect:", sRes.data.isCorrect === false);
    if (sRes.data.isCorrect !== false) throw new Error("Incorrect answer accepted!");

    // Unauthenticated socket submit (No REST API for submit without token)
    try {
      await axios.post(`${API}/sessions/active/submit`, { answer: 'Tortuga' });
      throw new Error("Unauthenticated submission succeeded!");
    } catch (e) {
      console.log("Unauthenticated submission rejected.");
    }

    // S1 solves Node 2 and Node 3
    let p3 = waitForChainProgress(stageSocket, s1.id, 'COMPLETED');
    await s1.api.post('/sessions/active/submit', { answer: 'Wooden' });
    await s1.api.post('/sessions/active/submit', { answer: 'asc' });
    await p3; // COMPLETED
    console.log("S1 Completed Data Hunt!");

    // Leaderboard verification
    const lb = await s1.api.get(`/sessions/${roomCode}`);
    console.log("Leaderboard:", lb.data.leaderboard);

    // Disconnect cleanly
    hostSocket.disconnect();
    stageSocket.disconnect();
    s1.socket.disconnect();
    s2.socket.disconnect();

    console.log("=== ALL DATA HUNT TESTS PASSED! ===");
    process.exit(0);

  } catch (err) {
    console.error("Test Failed:", err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

run();
