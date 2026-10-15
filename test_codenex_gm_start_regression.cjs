/**
 * Regression Test: TERMINAL CODENEX Game Master Session Start Authorization
 *
 * Verifies:
 * 1. 401 Unauthorized for unauthenticated requests to start live session PCEBA.
 * 2. 403 Forbidden when a student (role: PLAYER, e.g. shraddha) attempts to start session PCEBA
 *    (reproducing the cross-tab token contamination / unauthorized player action).
 * 3. 403 Forbidden when a different Game Master attempts to start session PCEBA.
 * 4. 200 OK when the owning approved CODENEX Game Master starts their own valid WAITING session.
 * 5. State transitions from LOBBY -> STARTING -> QUESTION_ACTIVE.
 * 6. Clean restoration of session PCEBA to LOBBY status.
 */

const http = require('http');
const { PrismaClient } = require('@prisma/client');
const jwt = require('./server/node_modules/jsonwebtoken');

require('./server/node_modules/dotenv').config({ path: './server/.env' });
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'terminal-super-secret-key-change-in-production';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function runRegressionTest() {
  console.log('================================================================');
  console.log('  CODENEX GAME MASTER LIVE START AUTHORIZATION REGRESSION TEST  ');
  console.log('================================================================\n');

  // 1. Verify Database State
  const session = await prisma.session.findUnique({
    where: { roomCode: 'PCEBA' },
    include: {
      event: true,
      currentGame: true,
      players: { include: { user: true } }
    }
  });

  if (!session) {
    throw new Error('Session PCEBA not found in database.');
  }

  const codenexUser = await prisma.user.findUnique({ where: { id: session.gmId } });
  if (!codenexUser) {
    throw new Error(`Owning GM ${session.gmId} not found in database.`);
  }

  const shraddhaPlayer = session.players.find(p => p.user?.username === 'shraddha') || session.players[0];
  if (!shraddhaPlayer) {
    throw new Error('Participant shraddha not found in session PCEBA.');
  }

  // Ensure another GM exists
  let otherGm = await prisma.user.findFirst({
    where: {
      role: 'GAME_MASTER',
      id: { not: codenexUser.id },
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE'
    }
  });

  if (!otherGm) {
    otherGm = await prisma.user.create({
      data: {
        username: 'other_gm_test',
        email: 'other_gm@terminal.dev',
        passwordHash: 'dummy',
        name: 'Other Test GM',
        role: 'GAME_MASTER',
        approvalStatus: 'APPROVED',
        accountStatus: 'ACTIVE'
      }
    });
  }

  console.log(`[Config] Target Session: ${session.roomCode} (ID: ${session.id})`);
  console.log(`[Config] Game: ${session.currentGame?.name}`);
  console.log(`[Config] Owning GM: ${codenexUser.name} (${codenexUser.username}, Role: ${codenexUser.role})`);
  console.log(`[Config] Participant: ${shraddhaPlayer.user.username} (Role: ${shraddhaPlayer.user.role})`);
  console.log(`[Config] Other GM: ${otherGm.username} (Role: ${otherGm.role})\n`);

  // Ensure session is in LOBBY / WAITING initially
  await prisma.session.update({
    where: { roomCode: 'PCEBA' },
    data: {
      status: 'LOBBY',
      stageMode: 'LOBBY',
      startedAt: null,
      endedAt: null,
      currentChallengeId: null,
      challengeStartTime: null,
      questionEndsAt: null,
    }
  });

  const codenexToken = generateToken(codenexUser.id, codenexUser.role);
  const shraddhaToken = generateToken(shraddhaPlayer.userId, shraddhaPlayer.user.role);
  const otherGmToken = generateToken(otherGm.id, otherGm.role);

  // ── TEST 1: Unauthenticated request must return 401 Unauthorized ──
  console.log('[Test 1] Unauthenticated request to POST /api/sessions/PCEBA/start...');
  const res1 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/PCEBA/start',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log(`  -> Status: ${res1.status}, Body: ${JSON.stringify(res1.data)}`);
  if (res1.status !== 401) {
    throw new Error(`Expected status 401, got ${res1.status}`);
  }
  console.log('  ✓ Correctly rejected with 401 Unauthorized\n');

  // ── TEST 2: Student caller (shraddha) must return 403 Forbidden ──
  console.log('[Test 2] Student caller (reproducing cross-tab token contamination)...');
  const res2 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/PCEBA/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${shraddhaToken}`
    }
  });
  console.log(`  -> Status: ${res2.status}, Body: ${JSON.stringify(res2.data)}`);
  if (res2.status !== 403) {
    throw new Error(`Expected status 403, got ${res2.status}`);
  }
  console.log('  ✓ Correctly rejected student caller with 403 Forbidden\n');

  // ── TEST 3: Different GM caller must return 403 Forbidden ──
  console.log('[Test 3] Different GM caller (non-owning Game Master)...');
  const res3 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/PCEBA/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${otherGmToken}`
    }
  });
  console.log(`  -> Status: ${res3.status}, Body: ${JSON.stringify(res3.data)}`);
  if (res3.status !== 403) {
    throw new Error(`Expected status 403, got ${res3.status}`);
  }
  console.log('  ✓ Correctly rejected non-owning GM caller with 403 Forbidden\n');

  // ── TEST 4: Owning approved CODENEX GM starts their own valid WAITING session ──
  console.log('[Test 4] Owning approved CODENEX GM caller starts session...');
  const res4 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/PCEBA/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${codenexToken}`
    }
  });
  console.log(`  -> Status: ${res4.status}, Session Status: ${res4.data?.session?.status}`);
  if (res4.status !== 200) {
    throw new Error(`Expected status 200, got ${res4.status}: ${JSON.stringify(res4.data)}`);
  }
  if (res4.data?.session?.status !== 'STARTING') {
    throw new Error(`Expected session status STARTING, got ${res4.data?.session?.status}`);
  }
  console.log('  ✓ Successfully transitioned session from LOBBY to STARTING\n');

  // ── TEST 5: Second start call activates Question 1 (Host Single-click flow) ──
  console.log('[Test 5] Second start call activates Question 1...');
  const res5 = await request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/PCEBA/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${codenexToken}`
    }
  });
  console.log(`  -> Status: ${res5.status}, Session Status: ${res5.data?.session?.status}, Challenge: ${res5.data?.session?.currentChallengeId}`);
  if (res5.status !== 200) {
    throw new Error(`Expected status 200, got ${res5.status}: ${JSON.stringify(res5.data)}`);
  }
  if (res5.data?.session?.status !== 'QUESTION_ACTIVE') {
    throw new Error(`Expected session status QUESTION_ACTIVE, got ${res5.data?.session?.status}`);
  }
  console.log('  ✓ Successfully transitioned session to QUESTION_ACTIVE with first question\n');

  // ── TEST 6: Clean restoration of session PCEBA to LOBBY status ──
  console.log('[Test 6] Restoring session PCEBA to LOBBY (WAITING)...');
  await prisma.session.update({
    where: { roomCode: 'PCEBA' },
    data: {
      status: 'LOBBY',
      stageMode: 'LOBBY',
      startedAt: null,
      endedAt: null,
      currentChallengeId: null,
      challengeStartTime: null,
      questionEndsAt: null,
    }
  });
  const finalCheck = await prisma.session.findUnique({ where: { roomCode: 'PCEBA' } });
  if (finalCheck.status !== 'LOBBY') {
    throw new Error(`Session failed to reset to LOBBY: ${finalCheck.status}`);
  }
  console.log('  ✓ Session PCEBA cleanly restored to LOBBY (WAITING)\n');

  console.log('================================================================');
  console.log('  ALL REGRESSION TESTS PASSED!                                  ');
  console.log('================================================================');
}

runRegressionTest()
  .catch((err) => {
    console.error('\n❌ REGRESSION TEST FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
