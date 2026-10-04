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
  console.log('TESTING TEAM SIZE = 4 (SERVER-SIDE ENFORCEMENT) & LIVE CHAT');
  console.log('===============================================================\n');

  const testSquad = [
    { username: 'cap_u1', usn: 'CAP01', email: 'cap1@terminal.test', name: 'Member One' },
    { username: 'cap_u2', usn: 'CAP02', email: 'cap2@terminal.test', name: 'Member Two' },
    { username: 'cap_u3', usn: 'CAP03', email: 'cap3@terminal.test', name: 'Member Three' },
    { username: 'cap_u4', usn: 'CAP04', email: 'cap4@terminal.test', name: 'Member Four' },
    { username: 'cap_u5', usn: 'CAP05', email: 'cap5@terminal.test', name: 'Member Five' },
  ];

  const tokens = [];

  // Register / login all 5 users
  for (const u of testSquad) {
    let login = await request('POST', '/auth/login', { login: u.username, password: 'Password123!' });
    if (login.status !== 200) {
      await request('POST', '/auth/register', {
        name: u.name,
        usn: u.usn,
        email: u.email,
        branch: 'CSE',
        section: 'A',
        password: 'Password123!',
        username: u.username
      });
      login = await request('POST', '/auth/login', { login: u.username, password: 'Password123!' });
    }
    assert(login.status === 200, `Authenticated user ${u.username}`);
    tokens.push(login.data.token);
  }

  // Cleanup: leave/disband any existing teams
  for (const token of tokens) {
    try { await request('POST', '/teams/leave', {}, token); } catch {}
    try { await request('POST', '/teams/disband', {}, token); } catch {}
  }

  console.log('\n--- 1. TEAM CAPACITY ENFORCEMENT (MAX 4) ---');
  // User 1 creates team "Delta Squad"
  const createRes = await request('POST', '/teams/create', { name: 'Delta Squad' }, tokens[0]);
  assert(createRes.status === 201, 'User 1 created team "Delta Squad"');
  assert(createRes.data.team.maxSize === 4, 'API reports maxSize = 4 on creation');
  assert(createRes.data.team.membersCount === 1, 'Members count is 1 / 4');

  // Verify GET /teams/current
  const cur1 = await request('GET', '/teams/current', null, tokens[0]);
  assert(cur1.status === 200, 'GET /teams/current returns 200');
  assert(cur1.data.team.maxSize === 4, 'GET /teams/current reports maxSize = 4');
  assert(cur1.data.team.membersCount === 1, 'Current team has 1 member (1/4)');

  // User 2 joins
  const join2 = await request('POST', '/teams/join', { name: 'Delta Squad' }, tokens[1]);
  assert(join2.status === 200, 'User 2 joined team (2/4)');
  assert(join2.data.team.membersCount === 2, 'Members count is 2 / 4');

  // User 3 joins
  const join3 = await request('POST', '/teams/join', { name: 'Delta Squad' }, tokens[2]);
  assert(join3.status === 200, 'User 3 joined team (3/4)');
  assert(join3.data.team.membersCount === 3, 'Members count is 3 / 4');

  // User 4 joins (Exact capacity reached!)
  const join4 = await request('POST', '/teams/join', { name: 'Delta Squad' }, tokens[3]);
  assert(join4.status === 200, 'User 4 joined team (4/4 - EXACT CAPACITY)');
  assert(join4.data.team.membersCount === 4, 'Members count is exactly 4 / 4');

  // User 5 attempts to join Delta Squad -> MUST BE REJECTED with 400
  const join5 = await request('POST', '/teams/join', { name: 'Delta Squad' }, tokens[4]);
  assert(join5.status === 400, 'User 5 join rejected by server with HTTP 400');
  assert(join5.data.error.includes('capacity') || join5.data.error.includes('4 members') || join5.data.error.includes('full'), 'Rejection message verifies team is full at 4 members');

  // User 1 (Leader) attempts to invite User 5 -> MUST BE REJECTED with 400
  const invite5 = await request('POST', '/teams/invite', { handle: 'cap_u5@terminal' }, tokens[0]);
  assert(invite5.status === 400, 'Invite to User 5 rejected by server because team is at capacity');

  console.log('\n--- 2. REAL-TIME TEAM CHAT (SOCKET.IO) ---');
  const socket1 = await createAuthenticatedSocket(tokens[0]);
  const socket2 = await createAuthenticatedSocket(tokens[1]);
  const socket5 = await createAuthenticatedSocket(tokens[4]);

  socket1.emit('team:join', { teamId: createRes.data.team.id });
  socket2.emit('team:join', { teamId: createRes.data.team.id });
  await wait(200);

  let user2ReceivedMsg = null;
  socket2.once('team:message', (msg) => {
    user2ReceivedMsg = msg;
  });

  let user5ReceivedMsg = null;
  socket5.once('team:message', (msg) => {
    user5ReceivedMsg = msg;
  });

  // User 1 sends message
  socket1.emit('team:send_message', { content: 'Squad operational on objective Alpha' });
  await wait(500);

  assert(user2ReceivedMsg !== null, 'User 2 received real-time chat message via Socket.IO');
  assert(user2ReceivedMsg.content === 'Squad operational on objective Alpha', 'Message content matches verbatim');
  assert(user2ReceivedMsg.senderHandle === 'cap_u1@terminal', 'Sender handle is verified authenticated user 1');
  assert(user5ReceivedMsg === null, 'User 5 (outside team) did NOT receive message (cross-team isolation enforced)');

  // Verify persistence via GET /teams/messages
  const msgHistory = await request('GET', '/teams/messages', null, tokens[1]);
  assert(msgHistory.status === 200, 'GET /teams/messages returns 200');
  const found = (msgHistory.data.messages || []).some(m => m.content === 'Squad operational on objective Alpha');
  assert(found, 'Message is saved in real database and returned in message history');

  // Disconnect sockets
  socket1.disconnect();
  socket2.disconnect();
  socket5.disconnect();

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
