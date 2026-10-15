const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';

async function main() {
  console.log('================================================================');
  console.log(' RUNNING PRODUCTION INTEGRITY & RETENTION VERIFICATION TEST');
  console.log('================================================================\n');

  let tempUserId = null;
  let tempSessionId = null;

  try {
    // 1. Verify 5 core accounts can be fetched and have expected roles
    console.log('[1] Verifying Core Retained Accounts:');
    const rootUser = await prisma.user.findUnique({ where: { username: 'root' } });
    if (!rootUser || rootUser.role !== 'ADMIN') throw new Error('Root Admin verification failed');
    console.log('  ✓ Root Admin intact');

    const shraddha = await prisma.user.findUnique({ where: { username: 'shraddha' } });
    if (!shraddha || shraddha.role !== 'PLAYER') throw new Error('Shraddha account verification failed');
    console.log('  ✓ Shraddha player account intact');

    const soumyaGm = await prisma.user.findUnique({ where: { username: 'soumyabasantia24aiml' } });
    if (!soumyaGm || soumyaGm.role !== 'GAME_MASTER') throw new Error('Soumya GM verification failed');
    console.log('  ✓ Soumya Game Master intact');

    const bobPlayer = await prisma.user.findUnique({ where: { username: 'bob' } });
    if (!bobPlayer || bobPlayer.role !== 'PLAYER') throw new Error('Bob Player verification failed');
    console.log('  ✓ Bob Player intact');

    const codenexGm = await prisma.user.findUnique({ where: { username: 'codenex' } });
    if (!codenexGm || codenexGm.role !== 'GAME_MASTER') throw new Error('Codenex GM verification failed');
    console.log('  ✓ Codenex Game Master intact');

    // 2. Verify CODENEX Tournament games & questions
    console.log('\n[2] Verifying CODENEX Tournament Game Questions:');
    const codenexGames = await prisma.game.findMany({
      where: { designerId: codenexGm.id, status: 'PUBLISHED' },
      include: { challenges: true },
    });
    if (codenexGames.length < 2) throw new Error('Missing tournament games for CODENEX GM');
    const totalQuestions = codenexGames.reduce((acc, g) => acc + g.challenges.length, 0);
    if (totalQuestions !== 30) throw new Error(`Expected 30 tournament questions, found ${totalQuestions}`);
    console.log(`  ✓ Both tournament games verified with exactly ${totalQuestions} challenges.`);

    // 3. Test Authentication API (login with demo_designer)
    console.log('\n[3] Testing Authentication Flow via API:');
    const loginRes = await axios.post(`${API}/auth/login`, {
      login: 'demo@terminal.dev',
      password: 'terminal123',
    });
    if (!loginRes.data.token) throw new Error('Login failed for demo_designer');
    console.log('  ✓ Authentication API returned valid JWT');

    // 4. Test Unauthenticated rejection
    console.log('\n[4] Testing Unauthenticated Rejection (401):');
    try {
      await axios.get(`${API}/auth/me`);
      throw new Error('Unauthenticated /auth/me should have failed');
    } catch (err) {
      if (err.response?.status !== 401) throw err;
      console.log('  ✓ Unauthenticated request rejected with HTTP 401');
    }

    // 5. Test Live Session Creation & Instant Cleanup
    console.log('\n[5] Testing Session Hosting & Clean Teardown:');
    const sessionRes = await axios.post(`${API}/sessions`, {
      gameId: codenexGames[0].id,
      mode: 'SOLO',
    }, {
      headers: { Authorization: `Bearer ${loginRes.data.token}` },
    });
    const roomCode = sessionRes.data.roomCode || sessionRes.data.session?.roomCode;
    tempSessionId = sessionRes.data.session?.id || sessionRes.data.id;
    console.log(`  ✓ Live session created with roomCode: ${roomCode}`);

    // Immediately teardown test session
    if (tempSessionId) {
      await prisma.session.delete({ where: { id: tempSessionId } });
      tempSessionId = null;
      console.log('  ✓ Temporary session safely torn down.');
    }

    // 6. Verify zero test accounts exist in database
    console.log('\n[6] Verifying Final Database Cleanliness:');
    const allUsers = await prisma.user.findMany({ select: { username: true } });
    const lingeringTestUsers = allUsers.filter(u => /_\d{10,}/.test(u.username) || /^(pw_|sq_|seq_|rt_|load_|stud_|regstudent_|bravo_)/.test(u.username));
    if (lingeringTestUsers.length > 0) {
      throw new Error(`Lingering test accounts found: ${JSON.stringify(lingeringTestUsers)}`);
    }
    console.log(`  ✓ Database contains exactly ${allUsers.length} users; ZERO automated test accounts!`);

    console.log('\n================================================================');
    console.log(' ✓ ALL PRODUCTION INTEGRITY TESTS PASSED WITH 0 LEFTOVER ARTIFACTS');
    console.log('================================================================');
  } finally {
    if (tempSessionId) {
      await prisma.session.deleteMany({ where: { id: tempSessionId } }).catch(() => {});
    }
    if (tempUserId) {
      await prisma.user.deleteMany({ where: { id: tempUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
