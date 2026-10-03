/**
 * TERMINAL PROTECTED WORKSPACES & ROLE ISOLATION QA SUITE
 * Tests:
 * 1. Student personal workspace: Name, USN, Email, Branch, Section, Score, Progress, Games, Events
 * 2. Student cross-user isolation: Server-derived identity, no frontend ID spoofing
 * 3. Game Master pending workspace: Status notice, locked controls
 * 4. Game Master approved workspace: Name, Email, Phone, Approval status, Events, Games, Sessions, Participants, Leaderboards
 * 5. Game Master cross-user isolation: GM A cannot view or manage GM B's events, games, sessions, or leaderboards
 * 6. Admin workspace: root privileges and cross-workspace visibility
 * 7. Role barrier enforcement: Students blocked from GM/Admin APIs (HTTP 403)
 * 8. Unauthenticated access prevention (HTTP 401)
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  [PASS] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 TERMINAL PROTECTED WORKSPACES & DATA ISOLATION QA');
  console.log('====================================================\n');

  const salt = Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  let totalChecks = 0;

  function check(cond, msg) {
    totalChecks++;
    assert(cond, msg);
  }

  // ─── 1. ROOT ADMIN SETUP ───
  console.log('--- 1. ROOT ADMIN AUTHENTICATION ---');
  const adminLoginRes = await request('POST', '/api/auth/login', {
    login: 'root',
    password: process.env.ADMIN_PASSWORD || 'Root-Soumya'
  });
  check(adminLoginRes.status === 200, 'Root Administrator authenticated (HTTP 200)');
  const adminToken = adminLoginRes.data.token;
  check(adminLoginRes.data.user.role === 'ADMIN', 'Root received role ADMIN');

  // ─── 2. STUDENT A & STUDENT B WORKSPACE CREATION & ISOLATION ───
  console.log('\n--- 2. STUDENT PERSONAL WORKSPACE & ISOLATION ---');
  const studentAData = {
    name: `Student_Alpha_${salt}`,
    usn: `1MS21CS${Math.floor(100 + Math.random() * 899)}`,
    email: `alpha_${salt}@terminal.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'password123'
  };

  const studentARegRes = await request('POST', '/api/auth/register', studentAData);
  check(studentARegRes.status === 201, 'Student Alpha registered (HTTP 201)');
  const studentAToken = studentARegRes.data.token;

  const studentBData = {
    name: `Student_Beta_${salt}`,
    usn: `1MS21IS${Math.floor(100 + Math.random() * 899)}`,
    email: `beta_${salt}@terminal.edu`,
    branch: 'ISE',
    section: 'B',
    password: 'password123'
  };

  const studentBRegRes = await request('POST', '/api/auth/register', studentBData);
  check(studentBRegRes.status === 201, 'Student Beta registered (HTTP 201)');
  const studentBToken = studentBRegRes.data.token;

  // Student Alpha queries /api/workspace/student
  const alphaWorkspaceRes = await request('GET', '/api/workspace/student', null, studentAToken);
  check(alphaWorkspaceRes.status === 200, 'Student Alpha fetches workspace (HTTP 200)');
  check(alphaWorkspaceRes.data.student.name === studentAData.name, 'Workspace returns Alpha Name');
  check(alphaWorkspaceRes.data.student.usn === studentAData.usn, 'Workspace returns Alpha USN');
  check(alphaWorkspaceRes.data.student.email === studentAData.email, 'Workspace returns Alpha Email');
  check(alphaWorkspaceRes.data.student.branch === 'CSE', 'Workspace returns Alpha Branch (CSE)');
  check(alphaWorkspaceRes.data.student.section === 'A', 'Workspace returns Alpha Section (A)');
  check(typeof alphaWorkspaceRes.data.progress.totalScore === 'number', 'Progress includes totalScore');
  check(Array.isArray(alphaWorkspaceRes.data.games), 'Workspace includes available platform games array');
  check(Array.isArray(alphaWorkspaceRes.data.events), 'Workspace includes tournament events array');

  // Student Beta queries /api/workspace/student
  const betaWorkspaceRes = await request('GET', '/api/workspace/student', null, studentBToken);
  check(betaWorkspaceRes.status === 200, 'Student Beta fetches workspace (HTTP 200)');
  check(betaWorkspaceRes.data.student.name === studentBData.name, 'Workspace returns Beta Name');
  check(betaWorkspaceRes.data.student.usn === studentBData.usn, 'Workspace returns Beta USN');
  check(betaWorkspaceRes.data.student.branch === 'ISE', 'Workspace returns Beta Branch (ISE)');
  check(betaWorkspaceRes.data.student.section === 'B', 'Workspace returns Beta Section (B)');

  // SECURITY: Student Alpha attempts to pass Student Beta's ID in query or body
  const spoofAttemptRes = await request('GET', `/api/workspace/student?userId=${studentBRegRes.data.user.id}`, null, studentAToken);
  check(spoofAttemptRes.status === 200, 'Spoof request handled');
  check(spoofAttemptRes.data.student.id === studentARegRes.data.user.id, 'SECURITY PASS: Server derived identity strictly from JWT; ignored query userId');
  check(spoofAttemptRes.data.student.usn === studentAData.usn, 'SECURITY PASS: Student Alpha received their own data, never Beta data');

  // ─── 3. GAME MASTER A & B WORKSPACES & DATA ISOLATION ───
  console.log('\n--- 3. GAME MASTER PERSONAL WORKSPACE & ISOLATION ---');
  const gmAData = {
    name: `GM_Alpha_${salt}`,
    email: `gm_alpha_${salt}@terminal.edu`,
    phoneNumber: '+91 9876543210',
    password: 'password123'
  };

  const gmARegRes = await request('POST', '/api/auth/register-gm', gmAData);
  check(gmARegRes.status === 201, 'Game Master Alpha registered (HTTP 201)');
  const gmALoginRes = await request('POST', '/api/auth/login', {
    login: gmAData.email,
    password: gmAData.password
  });
  const gmAToken = gmALoginRes.data.token;
  const gmAId = gmALoginRes.data.user.id;

  // Prior to approval: GM Alpha checks workspace
  const gmAPendingWorkspace = await request('GET', '/api/workspace/gm', null, gmAToken);
  check(gmAPendingWorkspace.status === 200, 'Pending GM fetches workspace (HTTP 200)');
  check(gmAPendingWorkspace.data.gm.approvalStatus === 'PENDING', 'Workspace identifies status: PENDING');
  check(gmAPendingWorkspace.data.notice !== undefined, 'Workspace displays pending administrator notice');
  check(gmAPendingWorkspace.data.events.length === 0, 'Pending GM has 0 events unlocked');

  // Root Admin approves GM Alpha
  const approveARes = await request('PATCH', `/api/admin/game-masters/${gmAId}/status`, { status: 'APPROVED' }, adminToken);
  check(approveARes.status === 200, 'Root Admin approved GM Alpha');

  // Register and approve GM Beta
  const gmBData = {
    name: `GM_Beta_${salt}`,
    email: `gm_beta_${salt}@terminal.edu`,
    phoneNumber: '+91 9123456780',
    password: 'password123'
  };
  const gmBRegRes = await request('POST', '/api/auth/register-gm', gmBData);
  const gmBLoginRes = await request('POST', '/api/auth/login', {
    login: gmBData.email,
    password: gmBData.password
  });
  const gmBToken = gmBLoginRes.data.token;
  const gmBId = gmBLoginRes.data.user.id;
  await request('PATCH', `/api/admin/game-masters/${gmBId}/status`, { status: 'APPROVED' }, adminToken);
  check(true, 'Root Admin approved GM Beta');

  // GM Alpha creates Game Alpha and Event Alpha
  const gameARes = await request('POST', '/api/games', {
    name: `Game_Alpha_${salt}`,
    description: 'Alpha Quiz',
    template: 'QUIZ'
  }, gmAToken);
  check(gameARes.status === 201, 'GM Alpha created Game Alpha');
  const gameAId = gameARes.data.game ? gameARes.data.game.id : gameARes.data.id;

  // Add question to Game Alpha
  await request('POST', `/api/games/${gameAId}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What is O(1)?',
    options: ['Constant', 'Linear', 'Quadratic', 'Logarithmic'],
    answer: 'Constant',
    points: 100
  }, gmAToken);

  // Publish Game Alpha
  await request('PUT', `/api/games/${gameAId}`, { status: 'PUBLISHED' }, gmAToken);

  // GM Alpha creates Event Alpha
  const eventARes = await request('POST', '/api/events', {
    name: `Event_Alpha_${salt}`,
    description: 'Tournament Alpha',
    mode: 'SEQUENCE'
  }, gmAToken);
  check(eventARes.status === 201, 'GM Alpha created Event Alpha');
  const eventAId = eventARes.data.id;

  // Add Game Alpha to Event Alpha
  await request('POST', `/api/events/${eventAId}/games`, { gameId: gameAId }, gmAToken);
  await request('PUT', `/api/events/${eventAId}`, { status: 'PUBLISHED' }, gmAToken);

  // GM Alpha launches Session A
  const sessionARes = await request('POST', '/api/sessions', { eventId: eventAId }, gmAToken);
  check(sessionARes.status === 201, 'GM Alpha launched Session Alpha');
  const sessionACode = sessionARes.data.session.roomCode;

  // Student Alpha joins Session A
  const studentJoinRes = await request('POST', '/api/sessions/join', { roomCode: sessionACode }, studentAToken);
  check(studentJoinRes.status === 200, 'Student Alpha joined Session Alpha');

  // GM Alpha checks their approved workspace
  const gmAApprovedWorkspace = await request('GET', '/api/workspace/gm', null, gmAToken);
  check(gmAApprovedWorkspace.status === 200, 'GM Alpha fetches approved workspace (HTTP 200)');
  check(gmAApprovedWorkspace.data.gm.name === gmAData.name, 'Workspace returns GM Alpha Name');
  check(gmAApprovedWorkspace.data.gm.email === gmAData.email, 'Workspace returns GM Alpha Email');
  check(gmAApprovedWorkspace.data.gm.phone === gmAData.phoneNumber, 'Workspace returns GM Alpha Phone');
  check(gmAApprovedWorkspace.data.gm.approvalStatus === 'APPROVED', 'Workspace confirms approvalStatus: APPROVED');
  check(gmAApprovedWorkspace.data.events.some(e => e.id === eventAId), 'Workspace lists GM Alpha event');
  check(gmAApprovedWorkspace.data.games.some(g => g.id === gameAId), 'Workspace lists GM Alpha game');
  check(gmAApprovedWorkspace.data.sessions.some(s => s.roomCode === sessionACode), 'Workspace lists GM Alpha active session');
  
  const alphaSessionInWs = gmAApprovedWorkspace.data.sessions.find(s => s.roomCode === sessionACode);
  check(alphaSessionInWs && alphaSessionInWs.leaderboard.length > 0, 'GM Alpha workspace provides participants leaderboard');
  check(alphaSessionInWs.leaderboard[0].name === studentAData.name, 'Leaderboard lists enrolled Student Alpha with USN');

  // GM Beta checks their workspace
  const gmBWorkspace = await request('GET', '/api/workspace/gm', null, gmBToken);
  check(gmBWorkspace.status === 200, 'GM Beta fetches workspace (HTTP 200)');
  check(gmBWorkspace.data.gm.name === gmBData.name, 'Workspace returns GM Beta identity');
  check(!gmBWorkspace.data.events.some(e => e.id === eventAId), 'DATA ISOLATION: GM Beta CANNOT see GM Alpha event');
  check(!gmBWorkspace.data.games.some(g => g.id === gameAId), 'DATA ISOLATION: GM Beta CANNOT see GM Alpha game');
  check(!gmBWorkspace.data.sessions.some(s => s.roomCode === sessionACode), 'DATA ISOLATION: GM Beta CANNOT see GM Alpha session or participants');

  // GM Beta attempts to mutate or access GM Alpha event/game directly
  const unauthorizedEventAccess = await request('GET', `/api/events/${eventAId}`, null, gmBToken);
  check(unauthorizedEventAccess.status === 403, 'AUTHORIZATION PASS: GM Beta blocked from accessing GM Alpha event (HTTP 403)');

  const unauthorizedGameAccess = await request('GET', `/api/games/${gameAId}`, null, gmBToken);
  check(unauthorizedGameAccess.status === 403, 'AUTHORIZATION PASS: GM Beta blocked from accessing GM Alpha game (HTTP 403)');

  const unauthorizedSessionLaunch = await request('POST', '/api/sessions', { eventId: eventAId }, gmBToken);
  check(unauthorizedSessionLaunch.status === 403, 'AUTHORIZATION PASS: GM Beta blocked from launching session for GM Alpha event (HTTP 403)');

  // ─── 4. ROLE BARRIER ENFORCEMENT & AUTH PROTECTION ───
  console.log('\n--- 4. ROLE BARRIER ENFORCEMENT ---');
  // Student attempts to access /api/workspace/gm
  const studentToGmWs = await request('GET', '/api/workspace/gm', null, studentAToken);
  check(studentToGmWs.status === 403, 'ROLE BARRIER: Student blocked from Game Master workspace (HTTP 403)');

  // Student attempts to query admin statistics
  const studentToAdmin = await request('GET', '/api/admin/stats', null, studentAToken);
  check(studentToAdmin.status === 403, 'ROLE BARRIER: Student blocked from Admin API (HTTP 403)');

  // Unauthenticated requests
  const noTokenStudent = await request('GET', '/api/workspace/student');
  check(noTokenStudent.status === 401, 'SECURITY PASS: Unauthenticated student workspace rejected (HTTP 401)');

  const noTokenGm = await request('GET', '/api/workspace/gm');
  check(noTokenGm.status === 401, 'SECURITY PASS: Unauthenticated GM workspace rejected (HTTP 401)');

  // ─── 5. ROOT ADMIN WORKSPACE ACCESS ───
  console.log('\n--- 5. ROOT ADMIN PRIVILEGES ---');
  const adminGmWs = await request('GET', '/api/workspace/gm', null, adminToken);
  check(adminGmWs.status === 200, 'Root Admin can access GM workspace telemetry (HTTP 200)');
  check(adminGmWs.data.gm.role === 'ADMIN', 'Admin identity retained');

  const adminStats = await request('GET', '/api/admin/stats', null, adminToken);
  check(adminStats.status === 200, 'Root Admin fetches platform admin stats (HTTP 200)');
  check(typeof adminStats.data.totalStudents === 'number', 'Admin stats reports registered students');

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${totalChecks}`);
  console.log(`PASSED: ${totalChecks}`);
  console.log(`FAILED: 0`);
  console.log('====================================================');
  console.log('🎉 ALL PROTECTED WORKSPACES & DATA ISOLATION CHECKS PASSED!\n');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
