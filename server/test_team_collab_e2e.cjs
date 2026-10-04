/**
 * COMPLETE Dynamic End-to-End Test for TERMINAL Collaboration & Team System
 * Covers Phases 1 - 15 with real HTTP API, real Prisma DB, and real Socket.IO clients.
 */

const { io } = require('socket.io-client');
const http = require('http');

const API_BASE = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

// Test statistics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
    testResults.push({ message, passed: false });
    throw new Error(message);
  } else {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
    testResults.push({ message, passed: true });
  }
}

// HTTP request helper using native Node http
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const postData = body ? JSON.stringify(body) : null;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
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
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Socket creation helper
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

async function runAllPhases() {
  console.log('===============================================================');
  console.log('STARTING DYNAMIC E2E TEST OF TERMINAL COLLAB + TEAM SYSTEM');
  console.log('===============================================================\n');

  // Test credentials
  const users = {
    A: {
      username: 'alice_e2e',
      email: 'alice_e2e@terminal.test',
      usn: '1MS21CS901',
      name: 'Alice Operative',
      password: 'Password123!',
      branch: 'CSE',
      section: 'A',
      handle: 'alice_e2e@terminal',
    },
    B: {
      username: 'bob_e2e',
      email: 'bob_e2e@terminal.test',
      usn: '1MS21CS902',
      name: 'Bob Operative',
      password: 'Password123!',
      branch: 'ISE',
      section: 'B',
      handle: 'bob_e2e@terminal',
    },
    C: {
      username: 'charlie_e2e',
      email: 'charlie_e2e@terminal.test',
      usn: '1MS21CS903',
      name: 'Charlie Operative',
      password: 'Password123!',
      branch: 'ECE',
      section: 'C',
      handle: 'charlie_e2e@terminal',
    },
  };

  const tokens = {};
  const userRecords = {};
  const sockets = {};

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 1: CREATE REAL TEST USERS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('── PHASE 1: CREATE REAL TEST USERS ──');

    for (const key of ['A', 'B', 'C']) {
      const u = users[key];
      // Attempt login first; if 401 or user not found, register
      let loginRes = await request('POST', '/auth/login', {
        login: u.username,
        password: u.password,
      });

      if (loginRes.status !== 200) {
        // Register user
        const regRes = await request('POST', '/auth/register', {
          name: u.name,
          usn: u.usn,
          email: u.email,
          branch: u.branch,
          section: u.section,
          password: u.password,
          username: u.username,
        });

        assert(
          regRes.status === 201 || regRes.status === 200,
          `Register student ${key} (${u.handle}) -> status ${regRes.status}`
        );

        // Re-login to get clean token
        loginRes = await request('POST', '/auth/login', {
          login: u.username,
          password: u.password,
        });
      }

      assert(loginRes.status === 200, `Authenticated student ${key} (${u.handle})`);
      tokens[key] = loginRes.data.token;
      userRecords[key] = loginRes.data.user;
      assert(!!tokens[key], `Token exists for student ${key}`);
      assert(userRecords[key].username === u.username, `User record username matches for ${key}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 2: AUTHENTICATION & IDENTITY VERIFICATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 2: AUTHENTICATION & IDENTITY VERIFICATION ──');

    for (const key of ['A', 'B', 'C']) {
      const meRes = await request('GET', '/auth/me', null, tokens[key]);
      assert(meRes.status === 200, `/auth/me returns 200 for student ${key}`);
      assert(
        meRes.data.user.email === users[key].email,
        `Identity verified from JWT session for student ${key}`
      );
    }

    // Identity Anti-Spoofing: unauthenticated or bad token must be rejected
    const badAuthRes = await request('GET', '/auth/me', null, 'fake-invalid-token');
    assert(badAuthRes.status === 401, 'Server rejects invalid/forged authentication token');

    // Clean up any old teams/collaborations from previous test runs
    for (const key of ['A', 'B', 'C']) {
      try {
        await request('POST', '/teams/leave', {}, tokens[key]);
      } catch {}
      try {
        await request('POST', '/teams/disband', {}, tokens[key]);
      } catch {}
    }
    // Clean up collab relations between A and B
    try {
      await request('POST', '/collab/remove', { handle: users.B.handle }, tokens.A);
    } catch {}
    try {
      await request('POST', '/collab/remove', { handle: users.A.handle }, tokens.B);
    } catch {}

    // Connect Sockets for A and B
    sockets.A = await createAuthenticatedSocket(tokens.A);
    sockets.B = await createAuthenticatedSocket(tokens.B);
    sockets.C = await createAuthenticatedSocket(tokens.C);
    assert(sockets.A.connected, 'Socket A connected and authenticated');
    assert(sockets.B.connected, 'Socket B connected and authenticated');
    assert(sockets.C.connected, 'Socket C connected and authenticated');

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 3: COLLABORATION REQUEST FLOW
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 3: COLLABORATION REQUEST FLOW ──');

    // A checks collab network & directory
    const aCollabInitial = await request('GET', '/collab', null, tokens.A);
    assert(aCollabInitial.status === 200, 'Student A accesses /collab endpoint');
    const bInDir = (aCollabInitial.data.directory || []).some(
      (u) => u.handle === users.B.handle
    );
    assert(bInDir, 'Student B appears in campus registered directory');

    // Prepare socket listener on B for collab:request
    let bReceivedCollabRequest = null;
    sockets.B.once('collab:request', (data) => {
      bReceivedCollabRequest = data;
    });

    // A adds B
    const addRes = await request('POST', '/collab/add', { handle: users.B.handle }, tokens.A);
    assert(addRes.status === 200, `A adds B (${users.B.handle}) -> status 200`);

    await wait(300);
    assert(
      bReceivedCollabRequest !== null && bReceivedCollabRequest.fromHandle === users.A.handle,
      'Student B received real-time socket notification `collab:request` from Alice'
    );

    // Duplicate request must be rejected
    const dupAddRes = await request('POST', '/collab/add', { handle: users.B.handle }, tokens.A);
    assert(
      (dupAddRes.status === 400 || dupAddRes.status === 409) && dupAddRes.data.error === 'ALREADY_PENDING',
      'Server rejects duplicate collaboration request with ALREADY_PENDING'
    );

    // A checks outgoing, B checks incoming
    const aReqs = await request('GET', '/collab/requests', null, tokens.A);
    const bReqs = await request('GET', '/collab/requests', null, tokens.B);
    assert(
      (aReqs.data.outgoing || []).some((r) => r.handle === users.B.handle),
      'A sees outgoing request to B'
    );
    assert(
      (bReqs.data.incoming || []).some((r) => r.handle === users.A.handle),
      'B sees incoming request from A'
    );

    // Prepare socket listener on A for collab:accepted
    let aReceivedCollabAccepted = null;
    sockets.A.once('collab:accepted', (data) => {
      aReceivedCollabAccepted = data;
    });

    // B accepts A's request
    const acceptRes = await request(
      'POST',
      '/collab/accept',
      { handle: users.A.handle },
      tokens.B
    );
    assert(acceptRes.status === 200, `B accepts A's request -> status 200`);

    await wait(300);
    assert(
      aReceivedCollabAccepted !== null,
      'Student A received real-time socket notification `collab:accepted`'
    );

    // Both sides verify active collaborator in contacts
    const aCollabAfter = await request('GET', '/collab', null, tokens.A);
    const bCollabAfter = await request('GET', '/collab', null, tokens.B);
    assert(
      (aCollabAfter.data.contacts || []).some((c) => c.handle === users.B.handle),
      'A sees B as confirmed collaborator'
    );
    assert(
      (bCollabAfter.data.contacts || []).some((c) => c.handle === users.A.handle),
      'B sees A as confirmed collaborator'
    );

    // Test collab remove
    let aReceivedCollabRemoved = null;
    sockets.A.once('collab:removed', (data) => {
      aReceivedCollabRemoved = data;
    });

    const removeRes = await request(
      'POST',
      '/collab/remove',
      { handle: users.A.handle },
      tokens.B
    );
    assert(removeRes.status === 200, 'B removes A from collaboration network');
    await wait(300);
    assert(
      aReceivedCollabRemoved !== null,
      'A receives real-time socket event `collab:removed`'
    );

    // Re-add and re-accept to establish ongoing collaboration for the rest of tests
    const reAdd = await request('POST', '/collab/add', { handle: users.B.handle }, tokens.A);
    assert(reAdd.status === 200, 'A re-adds B after removal (verifying clean cleanup)');
    const reAccept = await request(
      'POST',
      '/collab/accept',
      { handle: users.A.handle },
      tokens.B
    );
    assert(reAccept.status === 200, 'B re-accepts A after removal');

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 4: TEAM CREATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 4: TEAM CREATION ──');

    const createTeamRes = await request(
      'POST',
      '/teams/create',
      { name: 'Alpha Squad' },
      tokens.A
    );
    assert(createTeamRes.status === 201, 'Student A creates team "Alpha Squad"');
    const teamA = createTeamRes.data.team;
    assert(teamA.name === 'Alpha Squad', 'Team name matches in DB/REST response');
    assert(teamA.leaderHandle === users.A.handle, 'Student A is assigned as LEADER');
    assert(teamA.id && teamA.id.length > 5, 'Team has valid database ID');

    // Verify GET /teams/current for A
    const aCurrentTeam = await request('GET', '/teams/current', null, tokens.A);
    assert(aCurrentTeam.status === 200 && aCurrentTeam.data.team !== null, 'GET /teams/current returns Alpha Squad for A');
    assert(aCurrentTeam.data.team.leaderHandle === users.A.handle, 'Leader is verified as Alice');

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 5: TEAM JOIN (team -j "Alpha Squad")
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 5: TEAM JOIN (team -j "Alpha Squad") ──');

    let aReceivedJoinEvent = null;
    sockets.A.once('team:member_joined', (data) => {
      aReceivedJoinEvent = data;
    });

    const bJoinRes = await request(
      'POST',
      '/teams/join',
      { name: 'Alpha Squad' },
      tokens.B
    );
    assert(bJoinRes.status === 200, 'Student B joins "Alpha Squad" via team -j');

    await wait(300);
    assert(
      aReceivedJoinEvent !== null && aReceivedJoinEvent.handle === users.B.handle,
      'Student A received real-time socket notification `team:member_joined` for Bob'
    );

    // Verify membership on both clients
    const aTeamStatus = await request('GET', '/teams/current', null, tokens.A);
    const bTeamStatus = await request('GET', '/teams/current', null, tokens.B);
    assert(aTeamStatus.data.team.membersCount === 2, 'Alpha Squad has 2 members according to A');
    assert(bTeamStatus.data.team.membersCount === 2, 'Alpha Squad has 2 members according to B');
    assert(
      bTeamStatus.data.team.members.some((m) => m.handle === users.B.handle && !m.isLeader),
      'Bob is registered as member in roster'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 6: TEAM INVITATION FLOW (team invite & team accept)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 6: TEAM INVITATION FLOW ──');

    // Kick B to test invite flow cleanly
    const kickRes = await request('POST', '/teams/kick', { handle: users.B.handle }, tokens.A);
    assert(kickRes.status === 200, 'Leader A kicks B to prepare clean invite test');

    // Verify B is now solo
    const bSoloCheck = await request('GET', '/teams/current', null, tokens.B);
    assert(bSoloCheck.data.team === null, 'Bob is now confirmed solo agent');

    // Set up socket listener on B for team:invitation
    let bReceivedInviteEvent = null;
    sockets.B.once('team:invitation', (data) => {
      bReceivedInviteEvent = data;
    });

    // A invites Bob
    const inviteRes = await request('POST', '/teams/invite', { handle: users.B.handle }, tokens.A);
    assert(inviteRes.status === 200, 'Leader A invites Bob to Alpha Squad');

    await wait(300);
    assert(
      bReceivedInviteEvent !== null && bReceivedInviteEvent.teamName === 'Alpha Squad',
      'Student B received real-time socket event `team:invitation`'
    );

    // B checks team requests
    const bTeamReqs = await request('GET', '/teams/requests', null, tokens.B);
    assert(
      (bTeamReqs.data.requests || []).some((r) => r.teamName === 'Alpha Squad'),
      'Bob sees Alpha Squad invitation in GET /teams/requests'
    );

    // B accepts invitation
    let aReceivedAcceptEvent = null;
    sockets.A.once('team:member_joined', (data) => {
      aReceivedAcceptEvent = data;
    });

    const bAcceptTeamRes = await request('POST', '/teams/accept', { teamId: teamA.id }, tokens.B);
    assert(bAcceptTeamRes.status === 200, 'Bob accepts team invitation');

    await wait(300);
    assert(
      aReceivedAcceptEvent !== null,
      'Leader A received real-time socket update on invitation acceptance'
    );

    // Both show identical roster
    const aCheckAfterAccept = await request('GET', '/teams/current', null, tokens.A);
    const bCheckAfterAccept = await request('GET', '/teams/current', null, tokens.B);
    assert(
      aCheckAfterAccept.data.team.id === bCheckAfterAccept.data.team.id,
      'Both A and B report same team ID'
    );
    assert(aCheckAfterAccept.data.team.membersCount === 2, 'Roster shows 2 members');

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 7: TEAM REQUEST REJECTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 7: TEAM REQUEST REJECTION ──');

    // A invites Charlie
    const inviteCRes = await request(
      'POST',
      '/teams/invite',
      { handle: users.C.handle },
      tokens.A
    );
    assert(inviteCRes.status === 200, 'Leader A invites Charlie to Alpha Squad');

    // C checks requests
    const cReqs = await request('GET', '/teams/requests', null, tokens.C);
    assert(
      (cReqs.data.requests || []).some((r) => r.teamName === 'Alpha Squad'),
      'Charlie sees pending invite from Alpha Squad'
    );

    // C rejects invite
    const cRejectRes = await request('POST', '/teams/reject', { teamId: teamA.id }, tokens.C);
    assert(cRejectRes.status === 200, 'Charlie rejects Alpha Squad invite');

    // Verify Charlie did not join and Alpha Squad member count remains 2
    const cTeamCheck = await request('GET', '/teams/current', null, tokens.C);
    assert(cTeamCheck.data.team === null, 'Charlie did not join Alpha Squad (remains solo)');
    const aTeamCheckAfterReject = await request('GET', '/teams/current', null, tokens.A);
    assert(
      aTeamCheckAfterReject.data.team.membersCount === 2,
      'Alpha Squad roster remains unaffected (2 members)'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 8: REAL-TIME TEAM CHAT (10+ Alternating Messages)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 8: REAL-TIME TEAM CHAT (10+ Alternating Messages) ──');

    // Both A and B join the socket room for team chat
    sockets.A.emit('team:join', { teamId: teamA.id });
    sockets.B.emit('team:join', { teamId: teamA.id });
    await wait(300);

    const receivedByA = [];
    const receivedByB = [];

    sockets.A.on('team:message', (msg) => {
      receivedByA.push(msg);
    });
    sockets.B.on('team:message', (msg) => {
      receivedByB.push(msg);
    });

    // Send 10 alternating messages in real time
    const expectedMessages = [];
    for (let i = 1; i <= 10; i++) {
      if (i % 2 !== 0) {
        // Alice sends
        const text = `Alice message #${i} - tactical ping`;
        expectedMessages.push({ sender: users.A.handle, content: text });
        sockets.A.emit('team:send_message', { content: text, teamId: teamA.id });
      } else {
        // Bob sends
        const text = `Bob message #${i} - acknowledged copy`;
        expectedMessages.push({ sender: users.B.handle, content: text });
        sockets.B.emit('team:send_message', { content: text, teamId: teamA.id });
      }
      await wait(150);
    }

    await wait(500);

    assert(receivedByA.length >= 10, `Alice received all ${receivedByA.length} chat messages in real time`);
    assert(receivedByB.length >= 10, `Bob received all ${receivedByB.length} chat messages in real time`);

    // Verify ordering and content
    for (let i = 0; i < 10; i++) {
      assert(
        receivedByB[i].content === expectedMessages[i].content,
        `Message ${i + 1} content match: "${expectedMessages[i].content}"`
      );
      assert(
        receivedByB[i].senderHandle === expectedMessages[i].sender,
        `Message ${i + 1} sender match: ${expectedMessages[i].sender}`
      );
    }

    // Verify DB persistence of messages via REST
    const msgHistoryRes = await request('GET', '/teams/messages', null, tokens.A);
    assert(msgHistoryRes.status === 200, 'Fetched /teams/messages from DB');
    const dbMsgs = msgHistoryRes.data.messages || [];
    assert(dbMsgs.length >= 10, `DB has persisted ${dbMsgs.length} messages`);
    // Verify deterministic chronological ordering in DB
    const last10 = dbMsgs.slice(-10);
    for (let i = 0; i < 10; i++) {
      assert(
        last10[i].content === expectedMessages[i].content,
        `DB message history order index ${i} matches transmitted message`
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 9: TEAM CHAT SECURITY & CROSS-TEAM ISOLATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 9: TEAM CHAT SECURITY & CROSS-TEAM ISOLATION ──');

    // Charlie creates "Beta Squad"
    const betaRes = await request('POST', '/teams/create', { name: 'Beta Squad' }, tokens.C);
    assert(betaRes.status === 201, 'Charlie creates second team "Beta Squad"');
    const betaTeam = betaRes.data.team;

    // C joins Beta Squad socket channel
    sockets.C.emit('team:join', { teamId: betaTeam.id });
    await wait(300);

    const receivedByBeta = [];
    sockets.C.on('team:message', (msg) => {
      receivedByBeta.push(msg);
    });

    const aOldCount = receivedByA.length;
    const bOldCount = receivedByB.length;

    // C sends secret message in Beta Squad
    sockets.C.emit('team:send_message', {
      content: 'CLASSIFIED BETA OPERATIVE REPORT',
      teamId: betaTeam.id,
    });
    await wait(300);

    assert(receivedByBeta.length === 1, 'Charlie received message in Beta Squad');
    assert(
      receivedByA.length === aOldCount,
      'Alice in Alpha Squad DID NOT receive Beta Squad message (Cross-team isolation verified)'
    );
    assert(
      receivedByB.length === bOldCount,
      'Bob in Alpha Squad DID NOT receive Beta Squad message (Cross-team isolation verified)'
    );

    // SECURITY: A attempts unauthorized join to Beta Squad channel
    let aJoinError = null;
    sockets.A.once('team:error', (err) => {
      aJoinError = err;
    });
    sockets.A.emit('team:join', { teamId: betaTeam.id });
    await wait(300);
    assert(
      aJoinError !== null,
      'Server rejected Alice attempting to join Beta Squad channel (Unauthorized join blocked)'
    );

    // SECURITY: A attempts unauthorized message to Beta Squad
    let aSendError = null;
    sockets.A.once('team:error', (err) => {
      aSendError = err;
    });
    sockets.A.emit('team:send_message', {
      content: 'Alice injecting message to Beta',
      teamId: betaTeam.id,
    });
    await wait(300);
    assert(
      aSendError !== null,
      'Server rejected Alice attempting to send to Beta Squad (Unauthorized message blocked)'
    );

    // SECURITY: C attempts unauthorized message to Alpha Squad
    let cSendError = null;
    sockets.C.once('team:error', (err) => {
      cSendError = err;
    });
    sockets.C.emit('team:send_message', {
      content: 'Charlie injecting message to Alpha',
      teamId: teamA.id,
    });
    await wait(300);
    assert(
      cSendError !== null,
      'Server rejected Charlie attempting to send to Alpha Squad (Unauthorized message blocked)'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 10 & 11: SOCKET RECONNECT & MISSED MESSAGE CATCH-UP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 10 & 11: SOCKET RECONNECT & MISSED MESSAGE CATCH-UP ──');

    // Disconnect Alice's socket
    sockets.A.disconnect();
    await wait(300);
    assert(!sockets.A.connected, "Alice's socket disconnected intentionally");

    // While Alice is offline, Bob sends a message
    const offlineMessage = 'Alice are you there? Bob transmission while you are offline.';
    sockets.B.emit('team:send_message', { content: offlineMessage, teamId: teamA.id });
    await wait(400);

    // Reconnect Alice
    sockets.A = await createAuthenticatedSocket(tokens.A);
    assert(sockets.A.connected, 'Alice reconnected socket successfully with JWT token');

    // Alice rejoins team channel
    sockets.A.emit('team:join', { teamId: teamA.id });
    await wait(200);

    // Alice fetches message history
    const aReconnectedMsgs = await request('GET', '/teams/messages', null, tokens.A);
    const msgsList = aReconnectedMsgs.data.messages || [];
    assert(
      msgsList.some((m) => m.content === offlineMessage),
      'Alice retrieved missed message sent while offline from persistent database'
    );

    // Subsequent real-time messages still work normally without duplicates
    let aGotNewLive = null;
    sockets.A.once('team:message', (m) => {
      aGotNewLive = m;
    });
    sockets.B.emit('team:send_message', {
      content: 'Post-reconnect real-time test message',
      teamId: teamA.id,
    });
    await wait(300);
    assert(
      aGotNewLive !== null && aGotNewLive.content === 'Post-reconnect real-time test message',
      'Real-time team chat continues functioning properly after reconnection'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 12: LEADERSHIP TRANSFER & PERMISSIONS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 12: LEADERSHIP TRANSFER & PERMISSIONS ──');

    // Disband Beta Squad so Charlie can join Alpha Squad
    await request('POST', '/teams/disband', {}, tokens.C);

    // A invites Charlie to Alpha Squad
    await request('POST', '/teams/invite', { handle: users.C.handle }, tokens.A);
    await request('POST', '/teams/accept', { teamId: teamA.id }, tokens.C);

    // Alpha Squad now has A (Leader), B (Member), C (Member)
    const threeMemberCheck = await request('GET', '/teams/current', null, tokens.A);
    assert(threeMemberCheck.data.team.membersCount === 3, 'Alpha Squad has 3 members (A, B, C)');

    // PERMISSION CHECK: Ordinary member B tries leader-only actions
    const bInviteFail = await request(
      'POST',
      '/teams/invite',
      { handle: 'some_other_user@terminal' },
      tokens.B
    );
    assert(bInviteFail.status === 403, 'Server rejects ordinary member attempting team invite (403)');

    const bKickFail = await request(
      'POST',
      '/teams/kick',
      { handle: users.C.handle },
      tokens.B
    );
    assert(bKickFail.status === 403, 'Server rejects ordinary member attempting team kick (403)');

    const bDisbandFail = await request('POST', '/teams/disband', {}, tokens.B);
    assert(bDisbandFail.status === 403, 'Server rejects ordinary member attempting team disband (403)');

    // LEADERSHIP TRANSFER TEST: Leader A leaves the team
    const aLeaveRes = await request('POST', '/teams/leave', {}, tokens.A);
    assert(aLeaveRes.status === 200, 'Leader Alice leaves Alpha Squad');

    // Verify Alpha Squad still exists and leadership was transferred to remaining member
    const bAfterLeave = await request('GET', '/teams/current', null, tokens.B);
    assert(bAfterLeave.data.team !== null, 'Alpha Squad still exists after leader departure');
    assert(
      bAfterLeave.data.team.leaderHandle === users.B.handle ||
        bAfterLeave.data.team.leaderHandle === users.C.handle,
      `Leadership transferred to remaining operative: ${bAfterLeave.data.team.leaderHandle}`
    );

    const newLeaderToken =
      bAfterLeave.data.team.leaderHandle === users.B.handle ? tokens.B : tokens.C;
    const newLeaderKey =
      bAfterLeave.data.team.leaderHandle === users.B.handle ? 'Bob' : 'Charlie';

    // Verify new leader can now perform leader operations (e.g., kick)
    const memberToKick =
      bAfterLeave.data.team.leaderHandle === users.B.handle ? users.C.handle : users.B.handle;
    const kickByNewLeader = await request(
      'POST',
      '/teams/kick',
      { handle: memberToKick },
      newLeaderToken
    );
    assert(kickByNewLeader.status === 200, `New leader (${newLeaderKey}) successfully executed team kick`);

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE 13: TEAM LIFECYCLE COMPLETION (DISBAND)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n── PHASE 13: TEAM LIFECYCLE COMPLETION (DISBAND) ──');

    const disbandRes = await request('POST', '/teams/disband', {}, newLeaderToken);
    assert(disbandRes.status === 200, 'New leader disbands team');

    const checkDisbandedB = await request('GET', '/teams/current', null, tokens.B);
    const checkDisbandedC = await request('GET', '/teams/current', null, tokens.C);
    assert(checkDisbandedB.data.team === null, 'Bob confirmed solo agent after disband');
    assert(checkDisbandedC.data.team === null, 'Charlie confirmed solo agent after disband');

    console.log('\n===============================================================');
    console.log(`ALL DYNAMIC E2E TESTS COMPLETED`);
    console.log(`Total assertions: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log('===============================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (err) {
    console.error('\n❌ FATAL E2E TEST ERROR:', err);
    console.error(`Total assertions run: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`);
    process.exit(1);
  } finally {
    for (const key of Object.keys(sockets)) {
      if (sockets[key]) sockets[key].disconnect();
    }
  }
}

runAllPhases();
