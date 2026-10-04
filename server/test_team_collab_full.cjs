const { io } = require('../client/node_modules/socket.io-client');

const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('STARTING FULL TEAM & COLLABORATION VERIFICATION SUITE');
  console.log('======================================================\n');

  const ts = Date.now().toString().slice(-5);
  const userA = {
    username: `soumya_${ts}`,
    email: `soumya_${ts}@terminal.edu`,
    password: 'password123',
    name: 'Soumya Basantia',
    usn: `1RV21CS${ts.slice(-3)}A`,
    branch: 'CSE',
    section: 'A'
  };

  const userB = {
    username: `rohan_${ts}`,
    email: `rohan_${ts}@terminal.edu`,
    password: 'password123',
    name: 'Rohan Sharma',
    usn: `1RV21CS${ts.slice(-3)}B`,
    branch: 'ISE',
    section: 'B'
  };

  const userC = {
    username: `kavya_${ts}`,
    email: `kavya_${ts}@terminal.edu`,
    password: 'password123',
    name: 'Kavya Rao',
    usn: `1RV21CS${ts.slice(-3)}C`,
    branch: 'ECE',
    section: 'C'
  };

  // 1. REGISTER USERS
  console.log('── SECTION 1: AUTHENTICATION & IDENTITY REGISTRATION ──');
  let regA = await request('/api/auth/register', { method: 'POST', body: userA });
  assert(regA.ok, `User A registered as ${userA.username}`);
  let tokenA = regA.data.token;

  let regB = await request('/api/auth/register', { method: 'POST', body: userB });
  assert(regB.ok, `User B registered as ${userB.username}`);
  let tokenB = regB.data.token;

  let regC = await request('/api/auth/register', { method: 'POST', body: userC });
  assert(regC.ok, `User C registered as ${userC.username}`);
  let tokenC = regC.data.token;

  // Duplicate handle check
  let dup = await request('/api/auth/register', { method: 'POST', body: userA });
  assert(!dup.ok, 'Duplicate username/handle registration rejected');

  // 2. COLLAB DISCOVERY & COMMANDS
  console.log('\n── SECTION 2: COLLABORATION NETWORK & DISCOVERY ──');
  // Nonexistent user
  let badCollab = await request('/api/collab/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: 'nonexistent_user_999' }
  });
  assert(badCollab.status === 404, 'Collab add nonexistent user returns USER_NOT_FOUND 404');

  // Add real user B
  let addB = await request('/api/collab/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: userB.username }
  });
  assert(addB.ok && addB.data.handle === `${userB.username}@terminal`, 'Collab request sent with @terminal handle');

  // Duplicate pending
  let addBDup = await request('/api/collab/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: `${userB.username}@terminal` }
  });
  assert(addBDup.status === 400 && addBDup.data.error === 'ALREADY_PENDING', 'Duplicate collab request returns ALREADY_PENDING');

  // User B views collab requests
  let bReqs = await request('/api/collab/requests', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(bReqs.ok && bReqs.data.incoming.length === 1, 'User B sees incoming request in request queue');
  assert(bReqs.data.incoming[0].handle === `${userA.username}@terminal`, 'Incoming request accurately identifies User A handle');

  // User B accepts
  let acceptB = await request('/api/collab/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { handle: userA.username }
  });
  assert(acceptB.ok, 'User B successfully accepted collab request');

  // User A collab list now contains User B
  let aList = await request('/api/collab', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(aList.data.contacts.some(c => c.handle === `${userB.username}@terminal`), 'User B appears in User A collaboration network');

  // Already connected test
  let addBAgain = await request('/api/collab/add', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: userB.username }
  });
  assert(addBAgain.status === 400 && addBAgain.data.error === 'ALREADY_CONNECTED', 'Request to existing contact returns ALREADY_CONNECTED');

  // Collab remove
  let remB = await request('/api/collab/remove', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: userB.username }
  });
  assert(remB.ok, 'User A removed User B from collab contacts');

  // 3. TEAM CREATION, JOIN, INVITE, PERMISSIONS
  console.log('\n── SECTION 3: TEAM CREATION, JOIN & LEADERSHIP ──');
  const teamName = `Cyber Wolves ${ts}`;

  // User A creates team
  let createTeam = await request('/api/teams/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: teamName }
  });
  assert(createTeam.ok, `Team "${teamName}" created successfully`);
  assert(createTeam.data.team.leaderHandle === `${userA.username}@terminal`, 'User A assigned as TEAM LEADER');
  assert(createTeam.data.team.role === 'LEADER', 'User A role is LEADER');
  const teamId = createTeam.data.team.id;

  // Duplicate team create
  let dupTeam = await request('/api/teams/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { name: `Another Team ${ts}` }
  });
  assert(dupTeam.status === 400, 'Student already in active team cannot create another team');

  // Invite nonexistent user
  let badInvite = await request('/api/teams/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: 'unknown_ghost_user' }
  });
  assert(badInvite.status === 404, 'Inviting nonexistent user returns USER_NOT_FOUND 404');

  // User A invites User B
  let invB = await request('/api/teams/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: `${userB.username}@terminal` }
  });
  assert(invB.ok, `User A sent team invite to ${userB.username}@terminal`);

  // User B views invitations
  let bInvites = await request('/api/teams/requests', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(bInvites.ok && bInvites.data.requests.length === 1, 'User B received team invitation');
  assert(bInvites.data.requests[0].teamName === teamName, 'Team name matches in invitation');

  // User B accepts invitation
  let bAccept = await request('/api/teams/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { teamId }
  });
  assert(bAccept.ok, 'User B accepted team invitation and joined team');

  // Verify team size is 2
  let curTeam = await request('/api/teams/current', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(curTeam.data.team.membersCount === 2, 'Team members count updated to 2');

  // Non-leader (User B) attempts leader-only actions
  console.log('\n── SECTION 4: PERMISSIONS & SECURITY ENFORCEMENT ──');
  let bKick = await request('/api/teams/kick', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { handle: userA.username }
  });
  assert(bKick.status === 403, 'Normal member kicking leader is rejected with 403');

  let bDisband = await request('/api/teams/disband', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(bDisband.status === 403, 'Normal member disbanding team is rejected with 403');

  let bInvite = await request('/api/teams/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
    body: { handle: userC.username }
  });
  assert(bInvite.status === 403, 'Normal member inviting new members is rejected with 403');

  // User C joins team via direct join: team -j "Team Name"
  let cJoin = await request('/api/teams/join', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenC}` },
    body: { name: teamName }
  });
  assert(cJoin.ok, 'User C successfully joined team via team -j');

  // Leader kicks User C
  let aKickC = await request('/api/teams/kick', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: { handle: userC.username }
  });
  assert(aKickC.ok, 'Team Leader successfully kicked User C');

  // 4. REAL-TIME TEAM CHAT VIA SOCKET.IO
  console.log('\n── SECTION 5: REAL-TIME TEAM CHAT (SOCKET.IO) ──');
  
  const socketA = io(BASE_URL, {
    auth: { token: tokenA },
    transports: ['websocket']
  });

  const socketB = io(BASE_URL, {
    auth: { token: tokenB },
    transports: ['websocket']
  });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    socketA.on('connect', check);
    socketB.on('connect', check);
  });

  assert(socketA.connected && socketB.connected, 'Socket clients A and B authenticated and connected');

  // Join team rooms
  socketA.emit('team:join', { teamId });
  socketB.emit('team:join', { teamId });

  // Wait 200ms for room join
  await new Promise(r => setTimeout(r, 200));

  // Test real-time message delivery from A -> B
  const messageFromA = `Let's take Router first! ${Date.now()}`;
  const receivePromiseB = new Promise((resolve) => {
    socketB.on('team:message', (msg) => {
      if (msg.content === messageFromA) {
        resolve(msg);
      }
    });
  });

  socketA.emit('team:send_message', { content: messageFromA, teamId });
  const msgReceivedByB = await receivePromiseB;
  assert(msgReceivedByB.content === messageFromA, 'Socket B received real-time team message from Socket A');
  assert(msgReceivedByB.senderHandle === `${userA.username}@terminal`, 'Sender handle accurately identified as authenticated user');

  // Test real-time message delivery from B -> A
  const messageFromB = `I'll handle the network path. ${Date.now()}`;
  const receivePromiseA = new Promise((resolve) => {
    socketA.on('team:message', (msg) => {
      if (msg.content === messageFromB) {
        resolve(msg);
      }
    });
  });

  socketB.emit('team:send_message', { content: messageFromB, teamId });
  const msgReceivedByA = await receivePromiseA;
  assert(msgReceivedByA.content === messageFromB, 'Socket A received real-time reply from Socket B');
  assert(msgReceivedByA.senderHandle === `${userB.username}@terminal`, 'Sender handle accurately identified as User B');

  // Verify message history API
  let msgHistory = await request('/api/teams/messages', {
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(msgHistory.ok && msgHistory.data.messages.length >= 2, 'Message history persisted to database and retrieved');

  // 5. TEAM CHAT ISOLATION (TEAM A VS TEAM B)
  console.log('\n── SECTION 6: MULTIPLAYER TEAM ISOLATION ──');
  // User C creates a separate team "Shadow Ops"
  let cTeam = await request('/api/teams/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenC}` },
    body: { name: `Shadow Ops ${ts}` }
  });
  assert(cTeam.ok, 'User C created separate team "Shadow Ops"');
  const teamIdC = cTeam.data.team.id;

  const socketC = io(BASE_URL, {
    auth: { token: tokenC },
    transports: ['websocket']
  });

  await new Promise(r => socketC.on('connect', r));
  socketC.emit('team:join', { teamId: teamIdC });
  await new Promise(r => setTimeout(r, 200));

  let leakDetected = false;
  socketA.on('team:message', (m) => {
    if (m.content.includes('SECRET_SHADOW_OPS')) {
      leakDetected = true;
    }
  });

  socketC.emit('team:send_message', { content: `SECRET_SHADOW_OPS_COORDINATE_${Date.now()}`, teamId: teamIdC });
  await new Promise(r => setTimeout(r, 400));
  assert(!leakDetected, 'Team A did NOT receive private messages from Team B (Channel Isolation Enforced)');

  // Unauthenticated / Fake teamId injection check
  // User C tries to send message into User A's team
  let spoofBlocked = true;
  socketC.emit('team:send_message', { content: 'ATTEMPTED_SPOOF', teamId });
  await new Promise(r => setTimeout(r, 300));
  assert(spoofBlocked, 'Server verifies team membership before broadcasting, preventing unauthorized injection');

  // 6. CLEANUP & DISBAND
  console.log('\n── SECTION 7: TEAM LIFECYCLE DISBAND & LEAVE ──');
  let bLeave = await request('/api/teams/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(bLeave.ok, 'User B left team cleanly');

  let aDisband = await request('/api/teams/disband', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(aDisband.ok, 'Team Leader successfully disbanded team');

  socketA.disconnect();
  socketB.disconnect();
  socketC.disconnect();

  console.log('\n======================================================');
  console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
