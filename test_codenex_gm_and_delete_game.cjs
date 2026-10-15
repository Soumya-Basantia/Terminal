const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('./server/node_modules/bcryptjs');
const { execSync } = require('child_process');

const prisma = new PrismaClient();
const API = 'http://localhost:3001/api';

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

async function runTests() {
  console.log('================================================================');
  console.log('   CODENEX GM & SAFE DELETE GAME INTEGRATION TEST SUITE        ');
  console.log('================================================================\n');

  const ts = Date.now();
  const testEmail = `codenex.test.${ts}@terminal.dev`;
  const initialPassword = 'Codenex';
  const newPassword = 'NewCodenexSecure2026!';

  // =================================================================
  // SECTION 1: CODENEX GM ACCOUNT BOOTSTRAP & SECURITY
  // =================================================================
  console.log('--- SECTION 1: CODENEX GM ACCOUNT BOOTSTRAP & PERMISSIONS ---');

  // 1.1 Clean any old test users or previous codenex bootstrap to test fresh setup
  // 1.1 Clean any old test users or temporary sessions
  const existingCodenex = await prisma.user.findUnique({ where: { username: 'codenex' } });
  if (existingCodenex) {
    const userEvents = await prisma.event.findMany({ where: { creatorId: existingCodenex.id }, select: { id: true } });
    const eventIds = userEvents.map(e => e.id);
    if (eventIds.length > 0) {
      await prisma.submission.deleteMany({ where: { session: { eventId: { in: eventIds } } } });
      await prisma.sessionPlayer.deleteMany({ where: { session: { eventId: { in: eventIds } } } });
      await prisma.eventGame.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.session.deleteMany({ where: { eventId: { in: eventIds } } });
      await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    }
    await prisma.session.deleteMany({ where: { gmId: existingCodenex.id } });
  }

  await prisma.user.deleteMany({
    where: { username: { in: [`test_codenex_${ts}`, `conflict_user_${ts}`, `student_test_${ts}`, `other_gm_${ts}`] } }
  }).catch(() => {});

  // 1.2 Test environment variable requirements
  console.log('\n[1.1] Testing bootstrap requirements validation...');
  try {
    execSync('node server/src/prisma/seed-codenex-gm-loader.js', {
      env: { ...process.env, CODENEX_GM_EMAIL: '', CODENEX_GM_INITIAL_PASSWORD: '' },
      stdio: 'pipe',
    });
    assert(false, 'Bootstrap should have failed when email is missing');
  } catch (err) {
    assert(err.status === 1, 'Bootstrap exits with code 1 when required env vars are missing');
  }

  // 1.3 Test bootstrap creation of the codenex user
  console.log('\n[1.2] Running seed with valid environment variables...');
  const seedOutput = execSync('node server/src/prisma/seed-codenex-gm-loader.js', {
    env: {
      ...process.env,
      CODENEX_GM_EMAIL: testEmail,
      CODENEX_GM_INITIAL_PASSWORD: initialPassword,
    },
    encoding: 'utf-8',
  });
  assert(seedOutput.includes('SUCCESS') || seedOutput.includes('CODENEX Game Master account ready'), 'Seed completed successfully');

  // Verify DB state
  const codenexUser = await prisma.user.findUnique({
    where: { username: 'codenex' },
    include: { ClubMember: true },
  });

  assert(!!codenexUser, 'User "codenex" exists in database');
  assert(codenexUser.role === 'GAME_MASTER', 'User role is GAME_MASTER');
  assert(codenexUser.approvalStatus === 'APPROVED', 'User approvalStatus is APPROVED');
  assert(codenexUser.accountStatus === 'ACTIVE', 'User accountStatus is ACTIVE');
  assert(codenexUser.name === 'CODENEX Game Master', 'Display name is "CODENEX Game Master"');
  assert(codenexUser.mustChangePassword === true, 'mustChangePassword flag is true on initial creation');

  // Password hash verification
  assert(codenexUser.passwordHash.startsWith('$2a$') || codenexUser.passwordHash.startsWith('$2b$'), 'Password is encrypted using secure bcrypt hash');
  assert(codenexUser.passwordHash !== initialPassword, 'Password is NOT stored in plaintext');
  const isBcryptMatch = await bcrypt.compare(initialPassword, codenexUser.passwordHash);
  assert(isBcryptMatch, 'Initial password matches bcrypt hash');

  // 1.4 Test idempotency - re-running must not create duplicates or reset password
  console.log('\n[1.3] Testing bootstrap idempotency...');
  const rerunOutput = execSync('node server/src/prisma/seed-codenex-gm-loader.js', {
    env: {
      ...process.env,
      CODENEX_GM_EMAIL: codenexUser.email,
      CODENEX_GM_INITIAL_PASSWORD: 'DifferentIgnoredPassword!',
    },
    encoding: 'utf-8',
  });
  assert(rerunOutput.includes('already exists') || rerunOutput.includes('SUCCESS'), 'Idempotent seed run succeeds');

  const afterRerun = await prisma.user.findUnique({ where: { username: 'codenex' } });
  const stillMatchesInitial = await bcrypt.compare(initialPassword, afterRerun.passwordHash);
  assert(stillMatchesInitial, 'Re-running seed did NOT alter or overwrite established password');

  // 1.5 Conflict safety - mismatched email/username fails safely
  console.log('\n[1.4] Testing conflict safety with mismatched existing account...');
  try {
    execSync('node server/src/prisma/seed-codenex-gm-loader.js', {
      env: {
        ...process.env,
        CODENEX_GM_EMAIL: 'completely_different_conflict@example.com',
        CODENEX_GM_INITIAL_PASSWORD: initialPassword,
      },
      stdio: 'pipe',
    });
    assert(false, 'Should fail when username exists under a different email');
  } catch (err) {
    assert(err.status === 1, 'Safe failure (exit code 1) when conflict detected with existing username');
  }

  // 1.6 First-login enforcement via API
  console.log('\n[1.5] Testing first-login password change enforcement...');
  const loginRes = await axios.post(`${API}/auth/login`, {
    login: 'codenex',
    password: initialPassword,
  });
  assert(loginRes.status === 200, 'Login with initial password succeeds');
  assert(loginRes.data.user.mustChangePassword === true, 'Login response returns mustChangePassword: true');
  const initialToken = loginRes.data.token;
  const initialHeaders = { headers: { Authorization: `Bearer ${initialToken}` } };

  // Attempting protected GM actions before changing password must return 403
  let blockedCreateGame = false;
  try {
    const res = await axios.post(`${API}/games`, { name: 'Blocked Game', template: 'QUIZ' }, initialHeaders);
    console.log('UNEXPECTED SUCCESS:', res.status, res.data);
  } catch (err) {
    console.log('CAUGHT ERROR:', err.response?.status, err.response?.data);
    if (err.response && err.response.status === 403 && err.response.data.code === 'PASSWORD_CHANGE_REQUIRED') {
      blockedCreateGame = true;
    }
  }
  assert(blockedCreateGame, 'POST /api/games returns 403 PASSWORD_CHANGE_REQUIRED before password change');

  let blockedCreateEvent = false;
  try {
    await axios.post(`${API}/events`, { name: 'Blocked Event', mode: 'CHAMPIONSHIP' }, initialHeaders);
  } catch (err) {
    if (err.response && err.response.status === 403 && err.response.data.code === 'PASSWORD_CHANGE_REQUIRED') {
      blockedCreateEvent = true;
    }
  }
  assert(blockedCreateEvent, 'POST /api/events returns 403 PASSWORD_CHANGE_REQUIRED before password change');

  const wsInitRes = await axios.get(`${API}/workspace/gm`, initialHeaders);
  assert(wsInitRes.data.mustChangePassword === true, 'GET /api/workspace/gm flags mustChangePassword: true with zeroed resources');
  assert(wsInitRes.data.games.length === 0, 'GET /api/workspace/gm hides games before password change');

  // 1.7 Change password
  console.log('\n[1.6] Changing password via POST /api/auth/change-password...');
  const changeRes = await axios.post(`${API}/auth/change-password`, {
    currentPassword: initialPassword,
    newPassword: newPassword,
  }, initialHeaders);
  assert(changeRes.status === 200, 'Password change request succeeds');

  const refreshedUser = await prisma.user.findUnique({ where: { username: 'codenex' } });
  assert(refreshedUser.mustChangePassword === false, 'User mustChangePassword in DB is now false');
  const isNewHash = await bcrypt.compare(newPassword, refreshedUser.passwordHash);
  assert(isNewHash, 'New password hash is stored in DB');

  // 1.8 Login with new password and verify normal GM operations work
  console.log('\n[1.7] Verifying login with new password and GM access...');
  const newLoginRes = await axios.post(`${API}/auth/login`, {
    login: 'codenex',
    password: newPassword,
  });
  assert(newLoginRes.status === 200, 'Login with new password succeeds');
  assert(newLoginRes.data.user.mustChangePassword === false, 'New login returns mustChangePassword: false');
  const gmToken = newLoginRes.data.token;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };

  // Verify GM workspace access
  const wsRes = await axios.get(`${API}/workspace/gm`, gmHeaders);
  assert(wsRes.status === 200, 'GET /api/workspace/gm succeeds after password change');

  // Verify GM game creation
  const gameCreateRes = await axios.post(`${API}/games`, {
    name: `CODENEX Test Game ${ts}`,
    template: 'QUIZ',
  }, gmHeaders);
  assert(gameCreateRes.status === 201, 'POST /api/games succeeds after password change');
  const codenexGameId = gameCreateRes.data.game.id;

  // 1.9 Student privilege escalation protection
  console.log('\n[1.8] Verifying student cannot obtain GM permissions...');
  const studentReg = await axios.post(`${API}/auth/register`, {
    name: `Student Test ${ts}`,
    username: `student_test_${ts}`,
    usn: `1VA24CS${String(ts).slice(-3)}`,
    email: `student_test_${ts}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'Password123!',
  });
  const studentHeaders = { headers: { Authorization: `Bearer ${studentReg.data.token}` } };

  let studentBlocked = false;
  try {
    await axios.post(`${API}/games`, { name: 'Student Rogue Game', template: 'QUIZ' }, studentHeaders);
  } catch (err) {
    if (err.response && err.response.status === 403) {
      studentBlocked = true;
    }
  }
  assert(studentBlocked, 'Student attempting GM action is rejected with 403 Forbidden');

  // =================================================================
  // SECTION 2: SAFE DELETE UNPLAYED GAMES
  // =================================================================
  console.log('\n--- SECTION 2: SAFE DELETE UNPLAYED GAMES ---');

  // 2.1 Eligible unplayed draft game can be deleted
  console.log('\n[2.1] Deleting eligible unplayed draft game...');
  const draftGame = await axios.post(`${API}/games`, {
    name: `Draft To Delete ${ts}`,
    template: 'QUIZ',
  }, gmHeaders);
  const draftGameId = draftGame.data.game.id;

  // Add a challenge to make sure challenges cascade cleanly
  await axios.post(`${API}/games/${draftGameId}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Delete Me Question',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    points: 10,
    timerSecs: 30,
    difficulty: 'EASY',
  }, gmHeaders);

  const deleteDraftRes = await axios.delete(`${API}/games/${draftGameId}`, gmHeaders);
  assert(deleteDraftRes.status === 200, 'DELETE /api/games/:id returns 200 OK');
  assert(deleteDraftRes.data.success === true, 'Response contains success: true');

  // Verify game is gone
  const draftCheck = await prisma.game.findUnique({ where: { id: draftGameId } });
  assert(!draftCheck, 'Draft game is permanently deleted from database');
  const challengeCheck = await prisma.challenge.findMany({ where: { gameId: draftGameId } });
  assert(challengeCheck.length === 0, 'Associated challenges were cleanly removed');

  // 2.2 Eligible unplayed published game can be deleted
  console.log('\n[2.2] Deleting eligible unplayed published game...');
  const pubGame = await axios.post(`${API}/games`, {
    name: `Published To Delete ${ts}`,
    template: 'QUIZ',
  }, gmHeaders);
  const pubGameId = pubGame.data.game.id;

  await axios.post(`${API}/games/${pubGameId}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Published Question',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    answer: 'Alpha',
    points: 10,
    timerSecs: 30,
    difficulty: 'EASY',
  }, gmHeaders);

  await axios.post(`${API}/games/${pubGameId}/publish`, {}, gmHeaders);
  const publishedDbGame = await prisma.game.findUnique({ where: { id: pubGameId } });
  assert(publishedDbGame.status === 'PUBLISHED', 'Game is published');

  const deletePubRes = await axios.delete(`${API}/games/${pubGameId}`, gmHeaders);
  assert(deletePubRes.status === 200, 'Published unplayed game deleted with 200 OK');
  const pubCheck = await prisma.game.findUnique({ where: { id: pubGameId } });
  assert(!pubCheck, 'Published unplayed game is permanently deleted from database');

  // 2.3 Game with active/running session CANNOT be deleted
  console.log('\n[2.3] Testing active/running session deletion rejection...');
  const activeSessionGame = await axios.post(`${API}/games`, {
    name: `Active Session Game ${ts}`,
    template: 'QUIZ',
  }, gmHeaders);
  const activeGameId = activeSessionGame.data.game.id;

  await axios.post(`${API}/games/${activeGameId}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Session Q',
    options: ['1', '2', '3', '4'],
    answer: '1',
    points: 10,
    timerSecs: 30,
    difficulty: 'EASY',
  }, gmHeaders);
  await axios.post(`${API}/games/${activeGameId}/publish`, {}, gmHeaders);

  const sessionRes = await axios.post(`${API}/sessions`, { gameId: activeGameId }, gmHeaders);
  const activeSessionId = sessionRes.data.session.id;

  let activeDeleteBlocked = false;
  try {
    await axios.delete(`${API}/games/${activeGameId}`, gmHeaders);
  } catch (err) {
    if (err.response && err.response.status === 409) {
      activeDeleteBlocked = true;
      assert(err.response.data.error.includes('active') || err.response.data.error.includes('running'), 'Clear error message indicating active session');
    }
  }
  assert(activeDeleteBlocked, 'Game with active session rejected with 409 Conflict');

  const activeGameCheck = await prisma.game.findUnique({ where: { id: activeGameId } });
  assert(!!activeGameCheck, 'Active session game was preserved and NOT deleted');

  // 2.4 Game with submissions/gameplay history CANNOT be deleted
  console.log('\n[2.4] Testing game with submissions/results deletion rejection...');
  // Add a session player and submission to the session to simulate gameplay history
  const sessionPlayer = await prisma.sessionPlayer.create({
    data: {
      sessionId: activeSessionId,
      userId: codenexUser.id,
    }
  });

  const challengeRecord = await prisma.challenge.findFirst({ where: { gameId: activeGameId } });

  await prisma.submission.create({
    data: {
      sessionId: activeSessionId,
      challengeId: challengeRecord.id,
      playerId: sessionPlayer.id,
      answer: '1',
      isCorrect: true,
      score: 10,
      responseTime: 5000,
    }
  });

  // End the session
  await prisma.session.update({
    where: { id: activeSessionId },
    data: { status: 'ENDED', endedAt: new Date() }
  });

  let historyDeleteBlocked = false;
  try {
    await axios.delete(`${API}/games/${activeGameId}`, gmHeaders);
  } catch (err) {
    if (err.response && err.response.status === 409) {
      historyDeleteBlocked = true;
      assert(err.response.data.error.includes('submission') || err.response.data.error.includes('history'), 'Clear error message indicating historical gameplay');
    }
  }
  assert(historyDeleteBlocked, 'Game with submissions/gameplay history rejected with 409 Conflict');

  const historyGameCheck = await prisma.game.findUnique({ where: { id: activeGameId } });
  assert(!!historyGameCheck, 'Game with gameplay history was preserved and NOT deleted');

  // 2.5 Cross-GM authorization: GM B cannot delete GM A's game
  console.log('\n[2.5] Testing cross-GM deletion authorization (403 Forbidden)...');
  const otherGmUser = await prisma.user.create({
    data: {
      name: `Other GM ${ts}`,
      username: `other_gm_${ts}`,
      email: `other_gm_${ts}@campus.edu`,
      passwordHash: await bcrypt.hash('Password123!', 10),
      role: 'GAME_MASTER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      mustChangePassword: false,
    }
  });
  const otherGmLogin = await axios.post(`${API}/auth/login`, {
    login: otherGmUser.email,
    password: 'Password123!',
  });
  const otherGmHeaders = { headers: { Authorization: `Bearer ${otherGmLogin.data.token}` } };

  let crossGmBlocked = false;
  try {
    await axios.delete(`${API}/games/${codenexGameId}`, otherGmHeaders);
  } catch (err) {
    if (err.response && err.response.status === 403) {
      crossGmBlocked = true;
    }
  }
  assert(crossGmBlocked, 'Another GM cannot delete an unauthorized game (403 Forbidden)');

  // 2.6 Unauthenticated deletion is rejected (401 Unauthorized)
  console.log('\n[2.6] Testing unauthenticated deletion (401 Unauthorized)...');
  let unauthBlocked = false;
  try {
    await axios.delete(`${API}/games/${codenexGameId}`);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      unauthBlocked = true;
    }
  }
  assert(unauthBlocked, 'Unauthenticated deletion returns 401 Unauthorized');

  // 2.7 Non-existent game ID returns 404
  console.log('\n[2.7] Testing non-existent game ID handling (404 Not Found)...');
  let notFoundHandled = false;
  try {
    await axios.delete(`${API}/games/00000000-0000-0000-0000-000000000000`, gmHeaders);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      notFoundHandled = true;
    }
  }
  assert(notFoundHandled, 'Non-existent game ID returns 404 Not Found');

  // Clean up codenexGameId created during tests
  await axios.delete(`${API}/games/${codenexGameId}`, gmHeaders);
  const cleanupCheck = await prisma.game.findUnique({ where: { id: codenexGameId } });
  assert(!cleanupCheck, 'Test game cleanly purged at end of test suite');

  console.log('\n================================================================');
  console.log(`   ALL TESTS PASSED: ${passedTests}/${totalTests}                     `);
  console.log('================================================================\n');
}

runTests()
  .catch((err) => {
    console.error('\n❌ TEST RUN ABORTED WITH ERROR:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
