/**
 * Phase 17: Restart & Database Persistence Verification
 */
const { io } = require('socket.io-client');
const http = require('http');

const API_BASE = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const postData = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const mode = process.argv[2]; // 'setup' or 'verify'

async function run() {
  const users = {
    A: { login: 'alice_e2e', password: 'Password123!', handle: 'alice_e2e@terminal' },
    B: { login: 'bob_e2e', password: 'Password123!', handle: 'bob_e2e@terminal' },
    C: { login: 'charlie_e2e', password: 'Password123!', handle: 'charlie_e2e@terminal' },
  };

  if (mode === 'setup') {
    console.log('[Setup] Logging in and establishing persistent state before restart...');
    const tokenA = (await request('POST', '/auth/login', users.A)).data.token;
    const tokenB = (await request('POST', '/auth/login', users.B)).data.token;
    const tokenC = (await request('POST', '/auth/login', users.C)).data.token;

    // Clean up any existing team
    try { await request('POST', '/teams/leave', {}, tokenA); } catch {}
    try { await request('POST', '/teams/disband', {}, tokenA); } catch {}
    try { await request('POST', '/teams/leave', {}, tokenB); } catch {}
    try { await request('POST', '/teams/disband', {}, tokenB); } catch {}

    // 1. Establish collab
    await request('POST', '/collab/add', { handle: users.B.handle }, tokenA);
    await request('POST', '/collab/accept', { handle: users.A.handle }, tokenB);

    // 2. Create team
    const teamRes = await request('POST', '/teams/create', { name: 'Persistence Squad' }, tokenA);
    const teamId = teamRes.data.team.id;

    // 3. Bob joins team
    await request('POST', '/teams/join', { name: 'Persistence Squad' }, tokenB);

    // 4. Send message to team chat
    const socketA = io(SOCKET_URL, { auth: { token: tokenA }, transports: ['websocket'] });
    await new Promise((r) => socketA.on('connect', r));
    socketA.emit('team:join', { teamId });
    await new Promise((r) => setTimeout(r, 200));
    socketA.emit('team:send_message', { content: 'PRE-RESTART PERSISTENCE AUDIT PACKET', teamId });
    await new Promise((r) => setTimeout(r, 300));
    socketA.disconnect();

    // 5. Invite Charlie
    await request('POST', '/teams/invite', { handle: users.C.handle }, tokenA);

    console.log('[Setup Complete] State written to database. Ready for restart.');
    process.exit(0);
  }

  if (mode === 'verify') {
    console.log('[Verify] Re-logging in after server restart to verify full database persistence...');
    const tokenA = (await request('POST', '/auth/login', users.A)).data.token;
    const tokenB = (await request('POST', '/auth/login', users.B)).data.token;
    const tokenC = (await request('POST', '/auth/login', users.C)).data.token;

    // 1. Verify team persists
    const aTeam = await request('GET', '/teams/current', null, tokenA);
    const bTeam = await request('GET', '/teams/current', null, tokenB);

    if (!aTeam.data.team || aTeam.data.team.name !== 'Persistence Squad') {
      console.error('❌ Team persistence check failed for A:', aTeam.data);
      process.exit(1);
    }
    if (!bTeam.data.team || bTeam.data.team.name !== 'Persistence Squad') {
      console.error('❌ Team persistence check failed for B:', bTeam.data);
      process.exit(1);
    }
    console.log('✅ Team "Persistence Squad" and 2-member roster persisted across server restart');

    // 2. Verify collaboration persists
    const aCollab = await request('GET', '/collab', null, tokenA);
    const bHasCollab = (aCollab.data.contacts || []).some((c) => c.handle === users.B.handle);
    if (!bHasCollab) {
      console.error('❌ Collaboration persistence check failed:', aCollab.data);
      process.exit(1);
    }
    console.log('✅ Peer collaboration relationship persisted across server restart');

    // 3. Verify chat message persists
    const msgRes = await request('GET', '/teams/messages', null, tokenA);
    const msgs = msgRes.data.messages || [];
    const foundMsg = msgs.some((m) => m.content === 'PRE-RESTART PERSISTENCE AUDIT PACKET');
    if (!foundMsg) {
      console.error('❌ Chat message persistence check failed:', msgs);
      process.exit(1);
    }
    console.log('✅ Team chat messages persisted across server restart');

    // 4. Verify invitation persists
    const cReqs = await request('GET', '/teams/requests', null, tokenC);
    const foundInvite = (cReqs.data.requests || []).some((r) => r.teamName === 'Persistence Squad');
    if (!foundInvite) {
      console.error('❌ Team invitation persistence check failed:', cReqs.data);
      process.exit(1);
    }
    console.log('✅ Team invitation state persisted across server restart');

    // 5. Verify sockets connect and communicate after restart
    const socketA = io(SOCKET_URL, { auth: { token: tokenA }, transports: ['websocket'] });
    const socketB = io(SOCKET_URL, { auth: { token: tokenB }, transports: ['websocket'] });
    await Promise.all([
      new Promise((r) => socketA.on('connect', r)),
      new Promise((r) => socketB.on('connect', r)),
    ]);
    socketA.emit('team:join', { teamId: aTeam.data.team.id });
    socketB.emit('team:join', { teamId: bTeam.data.team.id });
    await new Promise((r) => setTimeout(r, 200));

    let liveMsg = null;
    socketB.once('team:message', (m) => { liveMsg = m; });
    socketA.emit('team:send_message', {
      content: 'POST-RESTART LIVE PACKET',
      teamId: aTeam.data.team.id,
    });
    await new Promise((r) => setTimeout(r, 400));

    socketA.disconnect();
    socketB.disconnect();

    if (!liveMsg || liveMsg.content !== 'POST-RESTART LIVE PACKET') {
      console.error('❌ Post-restart live socket communication failed');
      process.exit(1);
    }
    console.log('✅ Live Socket.IO communication verified post-restart');

    // Clean up
    await request('POST', '/teams/disband', {}, tokenA);
    console.log('✅ Cleaned up persistence squad');
    console.log('\n===============================================================');
    console.log('ALL PHASE 17 RESTART & PERSISTENCE CHECKS PASSED');
    console.log('===============================================================\n');
    process.exit(0);
  }
}

run();
