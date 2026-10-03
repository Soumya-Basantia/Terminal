const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';

async function runTest() {
  console.log("=== STARTING PHASE 7C.1 UX AUDIT TEST ===");

  try {
    // 0. Setup Super Admin
    const gmEmail = `gm_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, { email: gmEmail, username: `GM_${Date.now()}`, password: 'password123', role: 'HOST' })
      .catch(e => { console.error("GM Register err:", e.response?.data); });
    
    let res = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = res.data.token;
    const gmId = res.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });
    
    const hostApi = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${gmToken}` } });

    // 1. Create Games
    let g1 = await hostApi.post('/games', { name: 'Game 1', template: 'QUIZ' });
    let g2 = await hostApi.post('/games', { name: 'Game 2', template: 'QUIZ' });
    
    await hostApi.post(`/games/${g1.data.game.id}/challenges`, { type: 'MULTIPLE_CHOICE', prompt: 'Q1', points: 10, options: ['A', 'B'], answer: 'A' });
    await hostApi.post(`/games/${g2.data.game.id}/challenges`, { type: 'MULTIPLE_CHOICE', prompt: 'Q1', points: 10, options: ['C', 'D'], answer: 'C' });

    // 2. Event Creation & 3. Publishing
    let ev = await hostApi.post('/events', { name: 'UX Test Event', mode: 'SEQUENCE' });
    const eventId = ev.data.id;
    await hostApi.post(`/events/${eventId}/games`, { gameId: g1.data.game.id, purpose: 'NORMAL', position: 0, enabled: true });
    await hostApi.post(`/events/${eventId}/games`, { gameId: g2.data.game.id, purpose: 'FINAL', position: 1, enabled: true });
    await hostApi.put(`/events/${eventId}`, { status: 'PUBLISHED' });

    console.log("1-3: Event Created & Published");

    // 4. Session creation
    let sess = await hostApi.post('/sessions', { eventId });
    const roomCode = sess.data.session.roomCode;
    console.log("4: Session created:", roomCode);

    // 5. Connect GM Socket
    const hostSocket = io('http://localhost:3001', { auth: { token: gmToken } });
    await new Promise(r => hostSocket.on('connect', r));
    hostSocket.emit('host:join', { roomCode });

    const getLatestState = (socket) => new Promise(resolve => {
      socket.once('session_state_update', resolve);
    });

    let state = await getLatestState(hostSocket);
    console.log("5: GM joined session");

    // 6. Connect Student
    const studentEmail = `student_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, { email: studentEmail, username: `S_${Date.now()}`, password: 'password123', role: 'STUDENT' });
    let sRes = await axios.post(`${API}/auth/login`, { email: studentEmail, password: 'password123' });
    const studentToken = sRes.data.token;
    
    const studentApi = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${studentToken}` } });
    await studentApi.post('/sessions/join', { roomCode });
    
    let studentSocket = io('http://localhost:3001', { auth: { token: studentToken } });
    await new Promise(r => studentSocket.on('connect', r));
    studentSocket.emit('player:join', { roomCode });
    console.log("6: Student joined session");

    // Wait for student state update
    await getLatestState(studentSocket);

    // 14. Unauthorized Action Check (Student trying host action)
    const originalStatus = state.session.status;
    studentSocket.emit('host:change_status', { status: 'STARTING' });
    await new Promise(r => setTimeout(r, 200)); // wait for potentially unauthorized action
    let lbRes = await studentApi.get(`/sessions/${roomCode}`);
    if (lbRes.data.session.status !== originalStatus) {
       throw new Error("Student was able to change status!");
    }
    console.log("14: Student unauthorized actions rejected");

    // Start Event & Game Selection (Sequence)
    hostSocket.emit('host:change_status', { status: 'STARTING' });
    await getLatestState(hostSocket);

    let p = getLatestState(hostSocket);
    hostSocket.emit('host:select_game', { gameId: g1.data.game.id, position: 0 });
    state = await p;
    console.log("7: Sequence transition (Game 1 started)");
    
    // Play Game 1
    hostSocket.emit('host:select_challenge', { challengeId: state.currentGame.challenges[0].id });
    await getLatestState(hostSocket);
    
    await studentApi.post('/sessions/active/submit', { answer: 'A' });
    
    p = getLatestState(hostSocket);
    hostSocket.emit('host:change_status', { status: 'RESULTS' });
    state = await p;
    
    // 9. Replay Game 1
    p = getLatestState(hostSocket);
    hostSocket.emit('host:replay_game');
    state = await p;
    console.log("9: Replay triggered (currentRun =", state.session.currentRun, ")");
    
    hostSocket.emit('host:select_challenge', { challengeId: state.currentGame.challenges[0].id });
    await getLatestState(hostSocket);
    
    // 16. Score Preservation
    await studentApi.post('/sessions/active/submit', { answer: 'A' }); // Student answers correct again
    
    let scoreCheck = await studentApi.get(`/sessions/${roomCode}`);
    let studentScore = scoreCheck.data.leaderboard[0].score;
    if (studentScore !== 20) throw new Error(`Score preservation failed! Expected 20, got ${studentScore}`);
    console.log("16: Score preservation working across replays");

    // 10. Skip (Move to Game 2)
    p = getLatestState(hostSocket);
    hostSocket.emit('host:skip_game');
    state = await p;
    console.log("10: Skip triggered, now at game pos:", state.session.currentPosition);
    if (state.session.currentPosition !== 1) throw new Error("Skip did not move to pos 1");

    // Play Game 2
    hostSocket.emit('host:select_challenge', { challengeId: state.currentGame.challenges[0].id });
    await getLatestState(hostSocket);
    
    await studentApi.post('/sessions/active/submit', { answer: 'C' });
    
    hostSocket.emit('host:change_status', { status: 'RESULTS' });
    await getLatestState(hostSocket);

    // 15. Socket Reconnect
    studentSocket.disconnect();
    studentSocket = io('http://localhost:3001', { auth: { token: studentToken } });
    await new Promise(r => studentSocket.on('connect', r));
    studentSocket.emit('player:join', { roomCode });
    
    state = await getLatestState(studentSocket);
    if (!state.session.currentGameId) throw new Error("Student reconnect did not receive session state");
    console.log("15: Socket reconnect state restored");

    // 11. Event End
    p = getLatestState(hostSocket);
    hostSocket.emit('host:end_event');
    state = await p;
    if (state.session.status !== 'ENDED') throw new Error("Event did not end");
    console.log("11: Event ended");

    // 12. Final Results
    p = getLatestState(hostSocket);
    hostSocket.emit('host:set_stage_mode', { mode: 'FINAL_RESULTS' });
    state = await p;
    if (state.session.stageMode !== 'FINAL_RESULTS') throw new Error("Stage mode not set to FINAL_RESULTS");
    console.log("12: Final results stage mode activated");

    hostSocket.disconnect();
    studentSocket.disconnect();
    
    console.log("=== UX AUDIT TESTS PASSED ===");
    process.exit(0);

  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

runTest();
