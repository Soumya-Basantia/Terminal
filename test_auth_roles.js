// test_auth_roles.js — Comprehensive Automated Test for TERMINAL Auth & Roles Architecture
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedChecks++;
    console.error(`  [FAIL] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 TERMINAL AUTH & ROLE ARCHITECTURE VERIFICATION');
  console.log('====================================================\n');

  const timestamp = Date.now();
  const testStudentUSN = `1RV24CS${String(timestamp).slice(-4)}`;
  const testStudentEmail = `student_${timestamp}@campus.edu`;
  const testStudentPass = 'SecurePass123!';

  const testGmEmail = `gm_${timestamp}@campus.edu`;
  const testGmPhone = `+9198${String(timestamp).slice(-8)}`;
  const testGmPass = 'GmPassSecure456!';

  let studentToken = '';
  let studentUser = null;
  let gmToken = '';
  let gmUser = null;
  let adminToken = '';
  let adminUser = null;

  // ── TEST 1: RESERVATION OF 'root' KEYWORD GLOBALLY ──
  console.log('--- 1. GLOBAL RESERVATION OF "root" KEYWORD ---');

  // Student trying to register with name 'root'
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'root',
      usn: `1RV24CS991`,
      email: `root_name_${timestamp}@campus.edu`,
      branch: 'CSE',
      section: 'A',
      password: 'password123'
    });
    assert(false, 'Should reject Student registering with name "root"');
  } catch (err) {
    assert(err.response?.status === 400 && err.response?.data?.error?.includes('reserved'), 'Server rejects Student registration with name "root" (HTTP 400)');
  }

  // Student trying to register with USN 'ROOT'
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Alice Student',
      usn: 'ROOT',
      email: `alice_root_${timestamp}@campus.edu`,
      branch: 'CSE',
      section: 'A',
      password: 'password123'
    });
    assert(false, 'Should reject Student registering with USN "ROOT"');
  } catch (err) {
    assert(err.response?.status === 400 && err.response?.data?.error?.includes('reserved'), 'Server rejects Student registration with USN "ROOT" (HTTP 400)');
  }

  // Student trying to register with email 'root@campus.edu'
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Bob Student',
      usn: `1RV24CS992`,
      email: 'root@campus.edu',
      branch: 'CSE',
      section: 'A',
      password: 'password123'
    });
    assert(false, 'Should reject Student registering with email "root@..."');
  } catch (err) {
    assert(err.response?.status === 400 && err.response?.data?.error?.includes('reserved'), 'Server rejects Student registration with email starting with "root" (HTTP 400)');
  }

  // Game Master trying to register with name 'Root'
  try {
    await axios.post(`${BASE_URL}/auth/register-gm`, {
      name: 'Root',
      email: `gm_root_name_${timestamp}@campus.edu`,
      phoneNumber: '+919988776655',
      password: 'password123'
    });
    assert(false, 'Should reject Game Master registering with name "Root"');
  } catch (err) {
    assert(err.response?.status === 400 && err.response?.data?.error?.includes('reserved'), 'Server rejects Game Master registration with name "Root" (HTTP 400)');
  }

  // Game Master trying to register with email 'root@campus.edu'
  try {
    await axios.post(`${BASE_URL}/auth/register-gm`, {
      name: 'Charlie GM',
      email: 'root@campus.edu',
      phoneNumber: '+919988776655',
      password: 'password123'
    });
    assert(false, 'Should reject Game Master registering with email "root@..."');
  } catch (err) {
    assert(err.response?.status === 400 && err.response?.data?.error?.includes('reserved'), 'Server rejects Game Master registration with email "root@..." (HTTP 400)');
  }

  // Legacy user trying to register with username 'root'
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      username: 'root',
      email: `legacy_${timestamp}@test.com`,
      password: 'password123'
    });
    assert(false, 'Should reject legacy registration with username "root"');
  } catch (err) {
    assert(err.response?.status === 400 && err.response?.data?.error?.includes('reserved'), 'Server rejects legacy registration with username "root" (HTTP 400)');
  }

  // ── TEST 2: STUDENT REGISTRATION FIELD VALIDATION ──
  console.log('\n--- 2. STUDENT REGISTRATION FIELD VALIDATION ---');
  
  // Missing name
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      usn: testStudentUSN,
      email: testStudentEmail,
      branch: 'CSE',
      section: 'A',
      password: testStudentPass
    });
    assert(false, 'Should reject missing student name');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejects student registration with missing name (HTTP 400)');
  }

  // Missing USN
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test Student',
      email: testStudentEmail,
      branch: 'CSE',
      section: 'A',
      password: testStudentPass
    });
    assert(false, 'Should reject missing student USN');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejects student registration with missing USN (HTTP 400)');
  }

  // Missing Branch
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test Student',
      usn: testStudentUSN,
      email: testStudentEmail,
      section: 'A',
      password: testStudentPass
    });
    assert(false, 'Should reject missing student branch');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejects student registration with missing branch (HTTP 400)');
  }

  // Missing Section
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test Student',
      usn: testStudentUSN,
      email: testStudentEmail,
      branch: 'CSE',
      password: testStudentPass
    });
    assert(false, 'Should reject missing student section');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejects student registration with missing section (HTTP 400)');
  }

  // Short password (< 6 chars)
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test Student',
      usn: testStudentUSN,
      email: testStudentEmail,
      branch: 'CSE',
      section: 'A',
      password: '123'
    });
    assert(false, 'Should reject short password');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejects short password < 6 chars (HTTP 400)');
  }

  // ── TEST 3: VALID STUDENT REGISTRATION & DUAL-IDENTIFIER LOGIN ──
  console.log('\n--- 3. STUDENT REGISTRATION & DUAL-IDENTIFIER LOGIN ---');

  try {
    const regRes = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Ada Lovelace',
      usn: testStudentUSN,
      email: testStudentEmail,
      branch: 'CSE',
      section: 'A',
      password: testStudentPass
    });

    studentUser = regRes.data.user;
    studentToken = regRes.data.token;
    assert(regRes.status === 201, 'Student successfully registered (HTTP 201)');
    assert(studentUser.role === 'PLAYER', 'Student role is PLAYER');
    assert(studentUser.approvalStatus === 'APPROVED', 'Student approvalStatus is APPROVED by default');
    assert(studentUser.usn === testStudentUSN.toUpperCase(), 'Student USN properly normalized and stored');
    assert(Boolean(studentToken), 'JWT session token returned upon registration');
  } catch (err) {
    assert(false, `Student registration failed: ${err.message}`);
  }

  // Duplicate USN rejection
  try {
    await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Another Student',
      usn: testStudentUSN,
      email: `diff_${timestamp}@campus.edu`,
      branch: 'ECE',
      section: 'B',
      password: testStudentPass
    });
    assert(false, 'Should reject duplicate USN');
  } catch (err) {
    assert(err.response?.status === 409, 'Enforces unique USN constraint (HTTP 409 Conflict)');
  }

  // Login with Email
  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: testStudentEmail,
      password: testStudentPass
    });
    assert(loginRes.status === 200, 'Student logs in using Email (HTTP 200)');
    assert(loginRes.data.user.usn === testStudentUSN.toUpperCase(), 'Login returns USN');
  } catch (err) {
    assert(false, `Student email login failed: ${err.message}`);
  }

  // Login with USN
  try {
    const loginUsnRes = await axios.post(`${BASE_URL}/auth/login`, {
      usn: testStudentUSN,
      password: testStudentPass
    });
    assert(loginUsnRes.status === 200, 'Student logs in using USN (HTTP 200)');
    assert(loginUsnRes.data.user.email === testStudentEmail, 'Login via USN returns correct student record');
  } catch (err) {
    assert(false, `Student USN login failed: ${err.message}`);
  }

  // Authenticated /me endpoint
  try {
    const meRes = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(meRes.status === 200, 'Student profile fetched from /api/auth/me');
    assert(meRes.data.user.branch === 'CSE', 'Student profile contains branch information');
    assert(meRes.data.user.section === 'A', 'Student profile contains section information');
  } catch (err) {
    assert(false, `Student /me fetch failed: ${err.message}`);
  }

  // ── TEST 4: STUDENT ROLE ISOLATION ON SERVER ──
  console.log('\n--- 4. STUDENT ROLE ISOLATION ON SERVER ---');

  // Student cannot create games
  try {
    await axios.post(`${BASE_URL}/games`, {
      name: 'Student Unauthorized Game',
      template: 'QUIZ'
    }, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(false, 'Student should not be able to create games');
  } catch (err) {
    assert(err.response?.status === 403, 'Server blocks Student from creating games (HTTP 403 Forbidden)');
  }

  // Student cannot create events
  try {
    await axios.post(`${BASE_URL}/events`, {
      name: 'Student Unauthorized Event'
    }, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(false, 'Student should not be able to create events');
  } catch (err) {
    assert(err.response?.status === 403, 'Server blocks Student from creating events (HTTP 403 Forbidden)');
  }

  // Student cannot access Admin stats
  try {
    await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(false, 'Student should not be able to access Admin stats');
  } catch (err) {
    assert(err.response?.status === 403, 'Server blocks Student from Admin stats (HTTP 403 Forbidden)');
  }

  // ── TEST 5: GAME MASTER REGISTRATION & PENDING APPROVAL STATUS ──
  console.log('\n--- 5. GAME MASTER REGISTRATION & PENDING STATUS ---');

  // Missing phone number
  try {
    await axios.post(`${BASE_URL}/auth/register-gm`, {
      name: 'Charles Babbage',
      email: testGmEmail,
      password: testGmPass
    });
    assert(false, 'Should reject GM registration without phone number');
  } catch (err) {
    assert(err.response?.status === 400, 'Rejects Game Master without phone number (HTTP 400)');
  }

  // Valid GM registration
  try {
    const gmRegRes = await axios.post(`${BASE_URL}/auth/register-gm`, {
      name: 'Charles Babbage',
      email: testGmEmail,
      phoneNumber: testGmPhone,
      password: testGmPass
    });

    gmUser = gmRegRes.data.user;
    assert(gmRegRes.status === 201, 'Game Master registered (HTTP 201)');
    assert(gmUser.role === 'GAME_MASTER', 'Role is GAME_MASTER');
    assert(gmUser.approvalStatus === 'PENDING', 'Initial approvalStatus is strictly PENDING');
    assert(gmRegRes.data.message.includes('pending Administrator approval'), 'Clear approval notice returned');
  } catch (err) {
    assert(false, `Game Master registration failed: ${err.message}`);
  }

  // GM login while pending
  try {
    const gmLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: testGmEmail,
      password: testGmPass
    });

    gmToken = gmLoginRes.data.token;
    assert(gmLoginRes.status === 200, 'Game Master can authenticate (HTTP 200)');
    assert(gmLoginRes.data.user.approvalStatus === 'PENDING', 'User info confirms approvalStatus is PENDING');
    assert(Boolean(gmLoginRes.data.warning), 'Login response contains pending approval warning');
  } catch (err) {
    assert(false, `Pending Game Master login failed: ${err.message}`);
  }

  // ── TEST 6: PENDING GAME MASTER ACCESS RESTRICTIONS ──
  console.log('\n--- 6. PENDING GAME MASTER ACCESS RESTRICTIONS ---');

  // Pending GM cannot create games
  try {
    await axios.post(`${BASE_URL}/games`, {
      name: 'Pending GM Game Attempt',
      template: 'QUIZ'
    }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(false, 'Pending GM should not create games');
  } catch (err) {
    assert(err.response?.status === 403, 'Pending Game Master blocked from creating games (HTTP 403)');
    assert(err.response?.data?.approvalStatus === 'PENDING', 'Error specifies approvalStatus: PENDING');
  }

  // Pending GM cannot create events
  try {
    await axios.post(`${BASE_URL}/events`, {
      name: 'Pending GM Event Attempt'
    }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(false, 'Pending GM should not create events');
  } catch (err) {
    assert(err.response?.status === 403, 'Pending Game Master blocked from creating events (HTTP 403)');
  }

  // Pending GM cannot create sessions
  try {
    await axios.post(`${BASE_URL}/sessions`, {
      eventId: 'evt-dummy'
    }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(false, 'Pending GM should not create sessions');
  } catch (err) {
    assert(err.response?.status === 403, 'Pending Game Master blocked from creating sessions (HTTP 403)');
  }

  // ── TEST 7: ROOT ADMIN AUTHENTICATION VIA STANDARD LOGIN ──
  console.log('\n--- 7. ROOT ADMIN AUTHENTICATION (STANDARD LOGIN ENDPOINT) ---');

  // Attempt root login with wrong password
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      login: 'root',
      password: 'WrongPassword999!'
    });
    assert(false, 'Should reject root login with wrong password');
  } catch (err) {
    assert(err.response?.status === 401, 'Rejects invalid root credentials (HTTP 401)');
  }

  // Attempt root login with case variations: 'root'
  try {
    const rootRes = await axios.post(`${BASE_URL}/auth/login`, {
      login: 'root',
      password: process.env.ADMIN_PASSWORD || 'Root-Soumya'
    });

    adminUser = rootRes.data.user;
    adminToken = rootRes.data.token;
    assert(rootRes.status === 200, 'Root authenticated via standard login with username: root, password: Root-Soumya');
    assert(adminUser.username === 'root', 'Admin username is "root"');
    assert(adminUser.role === 'ADMIN', 'Admin receives role ADMIN');
    assert(adminUser.approvalStatus === 'APPROVED', 'Admin approvalStatus is APPROVED');
    assert(Boolean(adminToken), 'Admin received JWT token');
  } catch (err) {
    assert(false, `Root login failed: ${err.message}`);
  }

  // Case-insensitive test: 'Root'
  try {
    const rootResUpper = await axios.post(`${BASE_URL}/auth/login`, {
      login: 'Root',
      password: process.env.ADMIN_PASSWORD || 'Root-Soumya'
    });
    assert(rootResUpper.status === 200, 'Root authenticates with case variation "Root" (HTTP 200)');
    assert(rootResUpper.data.user.role === 'ADMIN', 'Role remains ADMIN');
  } catch (err) {
    assert(false, `Root case-variation login failed: ${err.message}`);
  }

  // ── TEST 8: ADMIN STATS & SQL-STYLE QUERY INTERFACE ──
  console.log('\n--- 8. ADMIN STATS & SQL-STYLE QUERY INTERFACE ---');

  try {
    const statsRes = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(statsRes.status === 200, 'Root admin fetches platform statistics (HTTP 200)');
    assert(statsRes.data.totalStudents >= 1, 'Stats includes students count');
    assert(statsRes.data.totalGameMasters >= 1, 'Stats includes game masters count');
    assert(statsRes.data.pendingGameMasters >= 1, 'Stats includes pending game masters count');
  } catch (err) {
    assert(false, `Admin stats failed: ${err.message}`);
  }

  // Query students
  try {
    const studentQueryRes = await axios.post(`${BASE_URL}/admin/query`, {
      target: 'students',
      search: 'Ada',
      filters: [{ field: 'branch', operator: 'EQUALS', value: 'CSE' }],
      page: 1,
      pageSize: 10
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert(studentQueryRes.status === 200, 'Admin executes parameterized query on students (HTTP 200)');
    assert(Array.isArray(studentQueryRes.data.records), 'Records array returned');
    assert(studentQueryRes.data.records.some(r => r.usn === testStudentUSN.toUpperCase()), 'Found newly registered student');
    assert(Boolean(studentQueryRes.data.sqlPreview), 'Returns generated SQL preview string');
  } catch (err) {
    assert(false, `Student query failed: ${err.message}`);
  }

  // Query Game Masters
  try {
    const gmQueryRes = await axios.post(`${BASE_URL}/admin/query`, {
      target: 'gamemasters',
      filters: [{ field: 'approvalStatus', operator: 'EQUALS', value: 'PENDING' }],
      page: 1,
      pageSize: 10
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert(gmQueryRes.status === 200, 'Admin executes parameterized query on game masters (HTTP 200)');
    assert(gmQueryRes.data.records.some(r => r.id === gmUser.id), 'Found newly registered pending Game Master in query');
  } catch (err) {
    assert(false, `Game Master query failed: ${err.message}`);
  }

  // Security: Reject non-allowlisted field in query (SQL injection / data leakage prevention)
  try {
    await axios.post(`${BASE_URL}/admin/query`, {
      target: 'students',
      filters: [{ field: 'passwordHash', operator: 'EQUALS', value: 'something' }]
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(false, 'Should reject non-allowlisted field');
  } catch (err) {
    assert(err.response?.status === 400, 'Security: Server rejects non-allowlisted field parameter (HTTP 400)');
  }

  // ── TEST 9: ADMIN APPROVAL OF GAME MASTER ──
  console.log('\n--- 9. ADMIN APPROVAL WORKFLOW ---');

  try {
    const approveRes = await axios.patch(`${BASE_URL}/admin/gamemasters/${gmUser.id}/status`, {
      status: 'APPROVED'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert(approveRes.status === 200, 'Admin approves Game Master (HTTP 200)');
    assert(approveRes.data.user.approvalStatus === 'APPROVED', 'Game Master approvalStatus changed to APPROVED');
  } catch (err) {
    assert(false, `Admin approval failed: ${err.message}`);
  }

  // ── TEST 10: APPROVED GAME MASTER ACCESS ──
  console.log('\n--- 10. APPROVED GAME MASTER FUNCTIONALITY ACCESS ---');

  let createdGameId = '';
  try {
    const createGameRes = await axios.post(`${BASE_URL}/games`, {
      name: `Approved GM Game ${timestamp}`,
      description: 'Game created after admin approval',
      template: 'QUIZ',
      maxPlayers: 50
    }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });

    createdGameId = createGameRes.data.game?.id || createGameRes.data.id;
    assert(createGameRes.status === 201, 'Approved Game Master successfully creates a game (HTTP 201)');
    assert(Boolean(createdGameId), 'Created game has valid ID');
  } catch (err) {
    assert(false, `Approved Game Master game creation failed: ${err.message}`);
  }

  // ── TEST 11: ADMIN REJECTION OF GAME MASTER ──
  console.log('\n--- 11. ADMIN REJECTION WORKFLOW ---');

  try {
    const rejectRes = await axios.patch(`${BASE_URL}/admin/gamemasters/${gmUser.id}/status`, {
      status: 'REJECTED'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert(rejectRes.status === 200, 'Admin rejects Game Master (HTTP 200)');
    assert(rejectRes.data.user.approvalStatus === 'REJECTED', 'Game Master approvalStatus changed to REJECTED');
  } catch (err) {
    assert(false, `Admin rejection failed: ${err.message}`);
  }

  // Rejected GM tries to create another game
  try {
    await axios.post(`${BASE_URL}/games`, {
      name: 'Rejected GM Attempt',
      template: 'QUIZ'
    }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    assert(false, 'Rejected GM should not be allowed to create games');
  } catch (err) {
    assert(err.response?.status === 403, 'Rejected Game Master blocked from creating games (HTTP 403 Forbidden)');
    assert(err.response?.data?.approvalStatus === 'REJECTED', 'Error confirms approvalStatus: REJECTED');
  }

  // ── TEST 12: SESSION EXPIRY & UNAUTHORIZED API ACCESS ──
  console.log('\n--- 12. SESSION EXPIRY & UNAUTHORIZED API ACCESS ---');

  // Request with invalid token
  try {
    await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.token.value' }
    });
    assert(false, 'Should reject invalid token');
  } catch (err) {
    assert(err.response?.status === 401, 'Rejects invalid token with HTTP 401 Unauthorized');
  }

  // Request without token
  try {
    await axios.get(`${BASE_URL}/auth/me`);
    assert(false, 'Should reject missing token');
  } catch (err) {
    assert(err.response?.status === 401, 'Rejects missing token with HTTP 401 Unauthorized');
  }

  // ── TEST 13: EXISTING STUDENT/GAME FUNCTIONALITY INTEGRITY ──
  console.log('\n--- 13. EXISTING STUDENT/GAME FUNCTIONALITY INTEGRITY ---');

  try {
    // Designer token (demo@terminal.dev)
    const demoLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'demo@terminal.dev',
      password: 'terminal123'
    });
    assert(demoLoginRes.status === 200, 'Existing demo designer login intact');

    // Health endpoint
    const healthRes = await axios.get(`${BASE_URL}/health`);
    assert(healthRes.status === 200 && healthRes.data.status === 'ok', 'Server health endpoint OK');
  } catch (err) {
    assert(false, `Existing functionality check failed: ${err.message}`);
  }

  // Summary
  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${totalChecks}`);
  console.log(`PASSED: ${passedChecks}`);
  console.log(`FAILED: ${failedChecks}`);
  console.log('====================================================');

  if (failedChecks > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL AUTH & ROLE ARCHITECTURE CHECKS PASSED!\n');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
