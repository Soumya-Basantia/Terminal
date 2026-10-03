const axios = require('axios');
const io = require('socket.io-client');

const API = 'http://localhost:3001/api';

async function run() {
  try {
    console.log("=== STARTING LOGIC HEIST TEST ===");

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

    // 2. Create Logic Heist Game
    let res = await axios.post(`${API}/games`, {
      name: 'Logic Heist Test',
      description: 'Testing vault nodes',
      template: 'LOGIC_HEIST'
    });
    console.log("Game created:", res.data.game.id);
    const gameId = res.data.game.id;

    // 3. Add Challenges (Heist specific types)
    // C1: VARIABLE_SIMULATION
    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'VARIABLE_SIMULATION',
      prompt: `A = 5\nB = 3\nCODE = A + B`,
      points: 10,
      answer: '8'
    });

    // C2: BLOCK_CONSTRUCTION
    await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'BLOCK_CONSTRUCTION',
      prompt: `Move 2 spaces right.`,
      points: 20,
      options: ['MOVE RIGHT', 'MOVE LEFT', 'STOP'],
      answer: 'MOVE RIGHT,MOVE RIGHT'
    });

    // 4. Create Event & Session
    res = await axios.post(`${API}/events`, { name: 'Heist Event', mode: 'SEQUENCE' });
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

    // 6. Connect Stage Socket
    const stageSocket = io('http://localhost:3001', { auth: { isStage: true } });
    await new Promise(resolve => stageSocket.on('connect', resolve));
    stageSocket.emit('stage:join', { roomCode });

    // 7. Auth and Connect 1 Student
    const setupStudent = async (index) => {
      const email = `student${index}_${Date.now()}@test.com`;
      await axios.post(`${API}/auth/register`, { email, username: `S${index}_${Date.now()}`, password: 'password123', role: 'STUDENT' }).catch(()=>{});
      const sLog = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
      const token = sLog.data.token;
      
      const res = await axios.post(`${API}/sessions/join`, { roomCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sessionPlayerId = res.data.sessionPlayer.id;

      const socket = io('http://localhost:3001', { auth: { token } });
      await new Promise(resolve => socket.on('connect', resolve));
      socket.emit('player:join', { roomCode });

      return { socket, token, sessionPlayerId };
    };

    const s1 = await setupStudent(1);
    console.log("Student 1 joined.");

    // 8. Start Game
    hostSocket.emit('host:select_game', { gameId, position: 0 });
    await waitForState(hostSocket, 'STARTING');
    console.log("Game is STARTING");

    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await waitForState(hostSocket, 'ROUND_ACTIVE');
    console.log("Round Active!");

    const api = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${s1.token}` } });

    // Node 1 (VARIABLE_SIMULATION)
    let sRes = await api.post('/sessions/active/submit', { answer: '8' });
    if (!sRes.data.isCorrect) {
      console.log("S1 Submit 1 data:", sRes.data);
      throw new Error("S1 Submit 1 Failed");
    }
    console.log("Node 1 solved");
    console.log("Node 1 solved");
    
    // Server should broadcast updated state
    await new Promise(resolve => setTimeout(resolve, 500));

    // Node 2 (BLOCK_CONSTRUCTION)
    sRes = await api.post('/sessions/active/submit', { answer: 'MOVE RIGHT,MOVE RIGHT' });
    if (!sRes.data.isCorrect) throw new Error("S1 Submit 2 Failed");
    console.log("Node 2 solved");

    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log("Checking DB for submissions...");
    const submissions = await prisma.submission.findMany({
      where: { playerId: s1.sessionPlayerId }
    });
    console.log(`Submissions for S1: ${submissions.length}`);
    const correctCount = submissions.filter(s => s.isCorrect).length;
    console.log(`Correct: ${correctCount}`);

    if (correctCount === 2) {
      console.log("LOGIC HEIST TEST PASSED!");
      process.exit(0);
    } else {
      console.error("Test failed, did not get 2 correct submissions.");
      process.exit(1);
    }

  } catch (error) {
    console.error("Test failed with error:", error.response?.data || error.message);
    process.exit(1);
  }
}

run();
