/**
 * E2E Validation Script for Requirement 16:
 * GAME-ROOM CHAT LIFECYCLE / MEMORY MANAGEMENT
 */

const { io } = require('socket.io-client');
const http = require('http');

const API_BASE = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  }
}

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function createAuthenticatedSocket(token) {
  return new Promise((resolve, reject) => {
    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('===============================================================');
  console.log('STARTING E2E TEST: GAME-ROOM CHAT LIFECYCLE & MEMORY MANAGEMENT');
  console.log('===============================================================\n');

  // 1. Authenticate players and root admin
  const rootLogin = await request('POST', '/auth/login', { login: 'root', password: 'Root-Soumya' });
  assert(rootLogin.status === 200, 'Root admin logged in');
  const rootToken = rootLogin.data.token;

  // Student users for the test team
  const players = [
    { username: 'room_p1', usn: 'RP01', email: 'room_p1@terminal.test', name: 'Player One' },
    { username: 'room_p2', usn: 'RP02', email: 'room_p2@terminal.test', name: 'Player Two' }
  ];

  const playerTokens = [];
  for (const p of players) {
    let login = await request('POST', '/auth/login', { login: p.username, password: 'Password123!' });
    if (login.status !== 200) {
      await request('POST', '/auth/register', {
        name: p.name,
        usn: p.usn,
        email: p.email,
        branch: 'CSE',
        section: 'A',
        password: 'Password123!',
        username: p.username
      });
      login = await request('POST', '/auth/login', { login: p.username, password: 'Password123!' });
    }
    assert(login.status === 200, `Authenticated student ${p.username}`);
    playerTokens.push(login.data.token);
  }

  // Cleanup: leave/disband previous team
  for (const t of playerTokens) {
    try { await request('POST', '/teams/leave', {}, t); } catch {}
    try { await request('POST', '/teams/disband', {}, t); } catch {}
  }

  // 2. Create real Team "Aura Tactical"
  console.log('\n── STEP 1: CREATE REAL TEAM AURA ──');
  const createTeam = await request('POST', '/teams/create', { name: 'Aura Tactical' }, playerTokens[0]);
  assert(createTeam.status === 201, 'Created Team Aura Tactical');
  const teamId = createTeam.data.team.id;

  const joinTeam = await request('POST', '/teams/join', { name: 'Aura Tactical' }, playerTokens[1]);
  assert(joinTeam.status === 200, 'Player 2 joined Team Aura Tactical (2/4)');

  // 3. Create Event and Game Room A (Session A)
  console.log('\n── STEP 2: CREATE GAME ROOM A ──');
  // Get an existing published event or create one
  const eventsRes = await request('GET', '/events', null, rootToken);
  let event = Array.isArray(eventsRes.data) && eventsRes.data.find(e => e.status === 'PUBLISHED');
  let eventId = event?.id;
  if (!eventId) {
    const newEv = await request('POST', '/events', { name: `Aura Combat ${Date.now()}`, mode: 'SEQUENCE' }, rootToken);
    eventId = newEv.data.id || newEv.data.event?.id;
    await request('PUT', `/events/${eventId}`, { status: 'PUBLISHED' }, rootToken);
  }

  const sessionARes = await request('POST', '/sessions', { eventId }, rootToken);
  if (sessionARes.status !== 201) {
    console.error('Session creation failed:', sessionARes);
  }
  assert(sessionARes.status === 201, 'Created Game Room A (Session)');
  const sessionA = sessionARes.data.session;
  const roomCodeA = sessionA.roomCode;
  console.log(`  Room Code A: ${roomCodeA}`);

  // Both players join Game Room A
  const joinRoomA1 = await request('POST', '/sessions/join', { roomCode: roomCodeA }, playerTokens[0]);
  const joinRoomA2 = await request('POST', '/sessions/join', { roomCode: roomCodeA }, playerTokens[1]);
  assert(joinRoomA1.status === 200, `Player 1 joined Game Room ${roomCodeA}`);
  assert(joinRoomA2.status === 200, `Player 2 joined Game Room ${roomCodeA}`);

  // Connect sockets
  let socket1 = await createAuthenticatedSocket(playerTokens[0]);
  let socket2 = await createAuthenticatedSocket(playerTokens[1]);
  socket1.emit('player:join', { roomCode: roomCodeA });
  socket2.emit('player:join', { roomCode: roomCodeA });
  await wait(300);

  // 4. Send 10+ messages in Game Room A Lobby
  console.log('\n── STEP 3: SEND 10+ MESSAGES IN ROOM A LOBBY ──');
  const receivedBy2InRoomA = [];
  socket2.on('team:message', (msg) => {
    receivedBy2InRoomA.push(msg);
  });

  const roomAMessages = [
    'ready for mission?',
    'gear check complete',
    'take route B',
    'watch the flanks',
    'packet sniffer online',
    'target coordinate locked',
    'holding position in lobby',
    'ping 12ms optimal',
    'standing by for GM start',
    'let\'s win this arena'
  ];

  for (const text of roomAMessages) {
    socket1.emit('team:send_message', { content: text, teamId, roomCode: roomCodeA });
    await wait(80);
  }
  await wait(500);

  assert(receivedBy2InRoomA.length >= 10, 'Player 2 received all 10 messages in real time in Room A');
  assert(receivedBy2InRoomA[0].roomCode === roomCodeA, 'Message payload is scoped to roomCode A');

  // Verify persistence for Room A
  const msgHistoryA = await request('GET', `/teams/messages?roomCode=${roomCodeA}`, null, playerTokens[1]);
  assert(msgHistoryA.status === 200, 'GET /teams/messages?roomCode=A returns 200');
  assert(msgHistoryA.data.messages.length >= 10, 'All 10 Room A messages persisted in DB during active session');

  // 5. Refresh / Reconnect test
  console.log('\n── STEP 4: REFRESH / RECONNECT (PERSISTENCE PRESERVED DURING GAME) ──');
  socket1.disconnect();
  socket2.disconnect();
  await wait(300);

  // Reconnect
  socket1 = await createAuthenticatedSocket(playerTokens[0]);
  socket2 = await createAuthenticatedSocket(playerTokens[1]);
  socket1.emit('player:join', { roomCode: roomCodeA });
  socket2.emit('player:join', { roomCode: roomCodeA });
  await wait(300);

  // Recover chat from DB after refresh/reconnect
  const recoverA = await request('GET', '/teams/messages', null, playerTokens[0]);
  assert(recoverA.status === 200, 'Reconnected player fetches active session messages');
  assert(recoverA.data.messages.length >= 10, 'All Room A messages cleanly recovered after disconnect/reconnect');
  assert(recoverA.data.roomCode === roomCodeA, 'Recovered messages are confirmed from Room A');

  // 6. Gameplay active: Send more messages while game is active
  console.log('\n── STEP 5: GAMEPLAY ACTIVE - SEND IN-GAME TACTICAL CHAT ──');
  let gameReceivedMsg = null;
  socket2.once('team:message', (m) => { gameReceivedMsg = m; });

  socket1.emit('team:send_message', { content: 'IN_GAME_ALERT: Flag acquired at point Charlie', teamId });
  await wait(300);
  assert(gameReceivedMsg !== null && gameReceivedMsg.content.includes('IN_GAME_ALERT'), 'Live in-game tactical chat transmitted');

  // 7. Finish Game A -> Triggers PURGE
  console.log('\n── STEP 6: FINISH GAME A -> PURGE GAME ROOM CHAT ──');
  let chatClearedEventReceived = false;
  socket2.once('team:chat_cleared', (data) => {
    chatClearedEventReceived = true;
  });

  // GM ends session A
  const endSessionA = await request('PUT', `/sessions/${sessionA.id}/status`, { status: 'ENDED' }, rootToken);
  assert(endSessionA.status === 200, 'Game Room A status set to ENDED');
  await wait(500);

  assert(chatClearedEventReceived, 'Client received `team:chat_cleared` socket event on game termination');

  // 8. Return to Student Terminal: Verify Room A chat is completely GONE
  console.log('\n── STEP 7: RETURN TO TERMINAL - VERIFY ROOM A CHAT IS GONE ──');
  const postEndCheck = await request('GET', `/teams/messages?roomCode=${roomCodeA}`, null, playerTokens[0]);
  assert(postEndCheck.status === 200, 'GET /teams/messages returns 200');
  assert(postEndCheck.data.messages.length === 0, 'Room A chat has been completely purged from database (0 messages remain)');

  const terminalCheck = await request('GET', '/teams/messages', null, playerTokens[1]);
  assert(terminalCheck.data.messages.length === 0, 'Normal Student Terminal chat is completely empty (no accumulated old messages)');

  // 9. Start Game Room B with the SAME team
  console.log('\n── STEP 8: START GAME ROOM B WITH SAME TEAM -> FRESH EMPTY CHAT ──');
  const sessionBRes = await request('POST', '/sessions', { eventId }, rootToken);
  assert(sessionBRes.status === 201, 'Created Game Room B');
  const sessionB = sessionBRes.data.session;
  const roomCodeB = sessionB.roomCode;
  console.log(`  Room Code B: ${roomCodeB}`);

  // Both players join Game Room B
  await request('POST', '/sessions/join', { roomCode: roomCodeB }, playerTokens[0]);
  await request('POST', '/sessions/join', { roomCode: roomCodeB }, playerTokens[1]);

  socket1.emit('player:join', { roomCode: roomCodeB });
  socket2.emit('player:join', { roomCode: roomCodeB });
  await wait(300);

  // Verify Room B starts completely empty
  const roomBInitial = await request('GET', `/teams/messages?roomCode=${roomCodeB}`, null, playerTokens[0]);
  assert(roomBInitial.data.messages.length === 0, 'New Game Room B begins with COMPLETELY EMPTY team chat');

  // 10. Send new messages in Room B
  console.log('\n── STEP 9: SEND MESSAGES IN ROOM B (NO LEAKAGE FROM ROOM A) ──');
  let roomBReceived = null;
  socket2.once('team:message', (m) => { roomBReceived = m; });

  socket1.emit('team:send_message', { content: 'ROOM_B_MESSAGE: Fresh deployment initiated', teamId, roomCode: roomCodeB });
  await wait(400);

  assert(roomBReceived !== null && roomBReceived.content === 'ROOM_B_MESSAGE: Fresh deployment initiated', 'Room B message received in real time');
  assert(roomBReceived.roomCode === roomCodeB, 'Message scoped to Room B');

  // Verify DB messages for Room B: contains ONLY Room B messages, never Room A
  const roomBHistory = await request('GET', `/teams/messages?roomCode=${roomCodeB}`, null, playerTokens[1]);
  assert(roomBHistory.data.messages.length === 1, 'Room B history has exactly 1 message');
  assert(roomBHistory.data.messages[0].content === 'ROOM_B_MESSAGE: Fresh deployment initiated', 'Room B contains only its own message');
  const roomAOldCheck = roomBHistory.data.messages.some(m => roomAMessages.includes(m.content));
  assert(!roomAOldCheck, 'Zero messages from Room A leaked into Room B (Clean isolation)');

  // 11. Verify Team integrity
  console.log('\n── STEP 10: VERIFY TEAM INTEGRITY & PERSISTENCE ──');
  const teamCheck = await request('GET', '/teams/current', null, playerTokens[0]);
  assert(teamCheck.status === 200 && teamCheck.data.team.name === 'Aura Tactical', 'Team Aura Tactical still intact in database');
  assert(teamCheck.data.team.membersCount === 2, 'Team membership preserved (2/4 members)');

  // Clean up Room B
  await request('PUT', `/sessions/${sessionB.id}/status`, { status: 'ENDED' }, rootToken);

  socket1.disconnect();
  socket2.disconnect();

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
