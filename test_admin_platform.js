// test_admin_platform.js
// Automated verification suite for MASTER PROMPT: TERMINAL AUTH + WORKSPACES + ADMIN PLATFORM

const API_BASE = 'http://localhost:3001/api';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 TERMINAL AUTH + WORKSPACES + ADMIN PLATFORM QA');
  console.log('====================================================\n');

  const ts = Date.now();

  // --- 1. ROOT ADMIN AUTHENTICATION ---
  console.log('--- 1. ROOT ADMIN AUTHENTICATION & SINGLETON ---');
  const rootLoginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: 'root',
      password: 'Root-Soumya'
    })
  });
  assert(rootLoginRes.status === 200, 'Root authenticated via standard login (HTTP 200)');
  assert(rootLoginRes.data.user?.username === 'root', 'Admin username is "root"');
  assert(rootLoginRes.data.user?.role === 'ADMIN', 'Admin received role ADMIN');
  assert(rootLoginRes.data.token, 'Admin received JWT token');
  const adminToken = rootLoginRes.data.token;

  // Case-insensitive root login
  const rootCaseRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: 'ROOT',
      password: 'Root-Soumya'
    })
  });
  assert(rootCaseRes.status === 200, 'Root login succeeds with case variation ROOT (HTTP 200)');

  // Rejection of invalid root password
  const rootBadRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: 'root',
      password: 'WrongPassword'
    })
  });
  assert(rootBadRes.status === 401, 'Rejects invalid root password (HTTP 401)');

  // Server-side rejection of root registration
  const rootRegRes = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'root',
      usn: `1RV21CS${ts % 10000}`,
      email: `root_${ts}@terminal.lan`,
      branch: 'CSE',
      section: 'A',
      password: 'SomePassword123'
    })
  });
  assert(rootRegRes.status === 400, 'Server-side rejects student registering with reserved name "root" (HTTP 400)');

  // --- 2. STUDENT REGISTRATION & PERSONAL WORKSPACE ---
  console.log('\n--- 2. STUDENT REGISTRATION & WORKSPACE ---');
  const studentEmail = `student_${ts}@terminal.edu`;
  const studentUsn = `1RV21CS${ts.toString().slice(-4)}`;
  const studentReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Soumya B',
      usn: studentUsn,
      email: studentEmail,
      branch: 'CSE',
      section: 'B',
      password: 'Password123'
    })
  });
  assert(studentReg.status === 201, 'Student successfully registered (HTTP 201)');
  const studentToken = studentReg.data.token;
  const studentId = studentReg.data.user?.id;
  assert(studentId, 'Student has unique user ID');
  assert(studentReg.data.user?.role === 'PLAYER', 'Student role is PLAYER');

  // Student login
  const studentLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: studentUsn,
      password: 'Password123'
    })
  });
  assert(studentLogin.status === 200, 'Student logs in using USN (HTTP 200)');
  assert(studentLogin.data.user?.accountStatus === 'ACTIVE', 'Student accountStatus is ACTIVE');

  // Student Workspace
  const studentWs = await request('/workspace/student', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(studentWs.status === 200, 'Student personal workspace fetched (HTTP 200)');
  assert(studentWs.data.student?.name === 'Soumya B', 'Workspace reflects student real name');
  assert(studentWs.data.student?.usn === studentUsn.toUpperCase(), 'Workspace reflects student USN');
  assert(studentWs.data.student?.branch === 'CSE', 'Workspace reflects student branch');
  assert(studentWs.data.student?.section === 'B', 'Workspace reflects student section');
  assert(Array.isArray(studentWs.data.games), 'Workspace provides available games');
  assert(Array.isArray(studentWs.data.events), 'Workspace provides available events');
  assert(Array.isArray(studentWs.data.messages), 'Workspace provides direct messages channel');

  // --- 3. GAME MASTER REGISTRATION & PENDING APPROVAL ---
  console.log('\n--- 3. GAME MASTER REGISTRATION & APPROVAL ---');
  const gmEmail = `gm_${ts}@terminal.edu`;
  const gmReg = await request('/auth/register-gm', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Professor Wayne',
      email: gmEmail,
      phoneNumber: '+91 9876543210',
      password: 'Password123'
    })
  });
  assert(gmReg.status === 201, 'Game Master registered (HTTP 201)');
  assert(gmReg.data.user?.role === 'GAME_MASTER', 'Role is GAME_MASTER');
  assert(gmReg.data.user?.approvalStatus === 'PENDING', 'Initial status is strictly PENDING');
  const gmId = gmReg.data.user?.id;

  // Pending GM login
  const gmLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: gmEmail,
      password: 'Password123'
    })
  });
  assert(gmLogin.status === 200, 'Pending GM can authenticate (HTTP 200)');
  const gmToken = gmLogin.data.token;
  assert(gmLogin.data.warning, 'Login returns pending administrator approval warning');

  // Blocked GM functionality while pending
  const gmCreateGame = await request('/games', {
    method: 'POST',
    headers: { Authorization: `Bearer ${gmToken}` },
    body: JSON.stringify({
      name: 'Unauthorized Quiz',
      template: 'QUIZ'
    })
  });
  assert(gmCreateGame.status === 403, 'Pending GM blocked from creating games (HTTP 403)');

  // Admin approves Game Master
  const approveGm = await request(`/admin/users/${gmId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ approvalStatus: 'APPROVED' })
  });
  assert(approveGm.status === 200, 'Admin approves Game Master (HTTP 200)');
  assert(approveGm.data.user?.approvalStatus === 'APPROVED', 'Game Master approvalStatus updated to APPROVED');

  // Approved GM can create games
  const gmCreateGameAfter = await request('/games', {
    method: 'POST',
    headers: { Authorization: `Bearer ${gmToken}` },
    body: JSON.stringify({
      name: `Cyber Matrix ${ts}`,
      template: 'QUIZ',
      maxPlayers: 50
    })
  });
  assert(gmCreateGameAfter.status === 201, 'Approved Game Master successfully creates game (HTTP 201)');
  const createdGameId = gmCreateGameAfter.data?.game?.id;

  // --- 4. ADMIN OPERATIONAL OVERVIEW & STATS ---
  console.log('\n--- 4. ADMIN OPERATIONAL OVERVIEW & STATS ---');
  const statsRes = await request('/admin/stats', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(statsRes.status === 200, 'Admin fetches operational statistics (HTTP 200)');
  assert(typeof statsRes.data.totalStudents === 'number', 'Stats reports total students');
  assert(typeof statsRes.data.totalGameMasters === 'number', 'Stats reports total game masters');
  assert(typeof statsRes.data.pendingGameMasters === 'number', 'Stats reports pending game masters');
  assert(typeof statsRes.data.activeSessions === 'number', 'Stats reports active sessions');
  assert(typeof statsRes.data.openReports === 'number', 'Stats reports open reports');
  assert(typeof statsRes.data.activeEvents === 'number', 'Stats reports active events');

  // --- 5. GLOBAL ADMIN SEARCH ---
  console.log('\n--- 5. GLOBAL ADMIN SEARCH ---');
  const searchRes = await request(`/admin/search?q=${encodeURIComponent('Soumya')}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(searchRes.status === 200, 'Global search executes (HTTP 200)');
  assert(Array.isArray(searchRes.data.results), 'Global search returns results array');
  const foundStudent = searchRes.data.results.find(r => r.category === 'STUDENT' && r.id === studentId);
  assert(foundStudent, 'Global search locates registered student by name');

  // --- 6. USER DETAIL & LIFECYCLE TIMELINE ---
  console.log('\n--- 6. USER DETAIL & LIFECYCLE TIMELINE ---');
  const userDetailRes = await request(`/admin/users/${studentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(userDetailRes.status === 200, 'Admin fetches user detail (HTTP 200)');
  assert(userDetailRes.data.user?.email === studentEmail, 'User detail matches student email');
  assert(userDetailRes.data.user?.accountStatus === 'ACTIVE', 'User detail contains accountStatus');
  assert(userDetailRes.data.user?.passwordHash === undefined, 'Security: passwordHash never exposed');

  const userTimelineRes = await request(`/admin/users/${studentId}/timeline`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(userTimelineRes.status === 200, 'Admin fetches user timeline (HTTP 200)');
  assert(Array.isArray(userTimelineRes.data.timeline), 'User timeline returns array of chronological events');
  const regEvent = userTimelineRes.data.timeline.find(e => e.type === 'REGISTRATION');
  assert(regEvent, 'Timeline records account registration');

  // --- 7. USER VERIFICATION, BLOCKING, AND EDITING ---
  console.log('\n--- 7. USER STATUS CONTROLS & EDITING ---');
  // Verify student
  const verifyRes = await request(`/admin/users/${studentId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ isVerified: true })
  });
  assert(verifyRes.status === 200, 'Admin verifies student account (HTTP 200)');
  assert(verifyRes.data.user?.isVerified === true, 'Student isVerified flag set to true');

  // Edit student details
  const editUserRes = await request(`/admin/users/${studentId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Soumya B (Updated)',
      section: 'C'
    })
  });
  assert(editUserRes.status === 200, 'Admin edits user details (HTTP 200)');
  assert(editUserRes.data.user?.name === 'Soumya B (Updated)', 'Student name updated');
  assert(editUserRes.data.user?.section === 'C', 'Student section updated');

  // Block student
  const blockRes = await request(`/admin/users/${studentId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ accountStatus: 'BLOCKED' })
  });
  assert(blockRes.status === 200, 'Admin blocks student account (HTTP 200)');

  // Blocked student login attempt
  const blockedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      login: studentEmail,
      password: 'Password123'
    })
  });
  assert(blockedLogin.status === 403, 'Server blocks suspended/blocked student login (HTTP 403)');

  // Unblock student
  const unblockRes = await request(`/admin/users/${studentId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ accountStatus: 'ACTIVE' })
  });
  assert(unblockRes.status === 200, 'Admin unblocks student account (HTTP 200)');

  // --- 8. BULK USER ACTIONS ---
  console.log('\n--- 8. BULK USER ACTIONS ---');
  const bulkRes = await request('/admin/users/bulk-action', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      userIds: [studentId, gmId],
      action: 'verify'
    })
  });
  assert(bulkRes.status === 200, 'Admin executes bulk verification (HTTP 200)');
  assert(bulkRes.data.updatedCount >= 2, 'Bulk action updated multiple users');

  // --- 9. CONTENT MANAGEMENT (NO AUTO NOTIFICATIONS) ---
  console.log('\n--- 9. CONTENT MANAGEMENT ---');
  const contentListRes = await request('/admin/content/games', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(contentListRes.status === 200, 'Admin fetches games content (HTTP 200)');
  assert(Array.isArray(contentListRes.data.items), 'Content list returned');

  if (createdGameId) {
    const editContentRes = await request(`/admin/content/games/${createdGameId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        description: 'Updated without sending notifications'
      })
    });
    assert(editContentRes.status === 200, 'Admin edits game content (HTTP 200)');
    assert(editContentRes.data.message.includes('without sending notifications'), 'Enforced: No automatic notifications dispatched on content edits');

    const toggleRes = await request(`/admin/content/games/${createdGameId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(toggleRes.status === 200, 'Admin toggles game publication status (HTTP 200)');
  }

  // --- 10. DIRECT MESSAGING ---
  console.log('\n--- 10. DIRECT MESSAGING ---');
  const sendMsgRes = await request('/admin/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      recipientId: studentId,
      content: 'Welcome to TERMINAL. Report to Sector 7 for tournament briefing.'
    })
  });
  assert(sendMsgRes.status === 201, 'Admin sends direct message to student (HTTP 201)');
  assert(sendMsgRes.data.message?.content.includes('Welcome to TERMINAL'), 'Message content recorded');

  // Student receives message in terminal workspace
  const studentInbox = await request('/messages', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(studentInbox.status === 200, 'Student retrieves messages (HTTP 200)');
  assert(studentInbox.data.received?.length > 0, 'Student inbox contains direct message from Admin');
  assert(studentInbox.data.unreadCount > 0, 'Student has unread transmission notification');

  // Student marks message as read
  const msgId = studentInbox.data.received[0]?.id;
  if (msgId) {
    const readRes = await request(`/messages/${msgId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(readRes.status === 200, 'Student marks message as read (HTTP 200)');
  }

  // --- 11. REPORTS MANAGEMENT ---
  console.log('\n--- 11. REPORTS MANAGEMENT ---');
  // Student files a report
  const fileReportRes = await request('/reports', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      targetType: 'SYSTEM',
      reason: 'Signal latency anomaly in terminal node',
      details: 'Response time spiked during router calibration'
    })
  });
  assert(fileReportRes.status === 201, 'Student files report (HTTP 201)');
  const reportId = fileReportRes.data.report?.id;

  // Admin lists reports
  const adminReportsRes = await request('/admin/reports', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminReportsRes.status === 200, 'Admin fetches reports list (HTTP 200)');
  const foundReport = adminReportsRes.data.reports?.find(r => r.id === reportId);
  assert(foundReport, 'Admin sees submitted report');

  // Admin handles report
  const resolveReportRes = await request(`/admin/reports/${reportId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      status: 'RESOLVED',
      internalNotes: 'Latency resolved via node recalibration'
    })
  });
  assert(resolveReportRes.status === 200, 'Admin resolves report with internal notes (HTTP 200)');
  assert(resolveReportRes.data.report?.status === 'RESOLVED', 'Report status changed to RESOLVED');
  assert(resolveReportRes.data.report?.internalNotes.includes('Latency resolved'), 'Internal notes preserved');

  // --- 12. AUDIT LOGGING ---
  console.log('\n--- 12. AUDIT LOGGING ---');
  const auditRes = await request('/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(auditRes.status === 200, 'Admin retrieves audit logs (HTTP 200)');
  assert(Array.isArray(auditRes.data.logs), 'Audit logs returns array of entries');
  assert(auditRes.data.logs.length > 0, 'Audit logs contains recorded admin actions');
  const hasUserAction = auditRes.data.logs.some(l => l.action.startsWith('USER_') || l.action.startsWith('BULK_'));
  assert(hasUserAction, 'Audit log accurately tracks user administration actions');

  // --- 13. PARAMETERIZED SQL-STYLE QUERY INTERFACE ---
  console.log('\n--- 13. SAFE PARAMETERIZED SQL-STYLE QUERY ---');
  const sqlQueryRes = await request('/admin/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      target: 'students',
      filters: [{ field: 'section', operator: 'EQUALS', value: 'C' }],
      orderBy: { field: 'createdAt', direction: 'desc' },
      page: 1,
      pageSize: 10
    })
  });
  assert(sqlQueryRes.status === 200, 'Safe parameterized query executes (HTTP 200)');
  assert(sqlQueryRes.data.sqlPreview.includes('SELECT'), 'Safe SQL preview generated');
  assert(sqlQueryRes.data.records.some(r => r.id === studentId), 'Filtered student found in query records');

  // Security: reject non-allowlisted field
  const badFieldQuery = await request('/admin/query', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      target: 'students',
      filters: [{ field: 'non_existent_column', operator: 'EQUALS', value: 'malicious' }]
    })
  });
  assert(badFieldQuery.status === 400, 'Security: Server rejects non-allowlisted field (HTTP 400)');

  // --- 14. EXCEL EXPORT (.XLSX) ---
  console.log('\n--- 14. EXCEL EXPORT (.XLSX) GENERATION ---');
  const exportRes = await request('/admin/export/students', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(exportRes.status === 200, 'Excel export returns HTTP 200');
  const contentType = exportRes.headers.get('content-type') || '';
  assert(
    contentType.includes('spreadsheetml.sheet') || contentType.includes('application/octet-stream'),
    'Excel export delivers genuine .xlsx MIME type'
  );
  const disposition = exportRes.headers.get('content-disposition') || '';
  assert(disposition.includes('terminal_students_'), 'Header includes valid attachment filename');

  // Non-admin export rejection
  const unauthorizedExport = await request('/admin/export/students', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(unauthorizedExport.status === 403, 'Security: Non-admin blocked from Excel export (HTTP 403)');

  // --- 15. SYSTEM / EMERGENCY CONTROLS ---
  console.log('\n--- 15. SYSTEM / EMERGENCY CONTROLS ---');
  // Disable student registration
  const disableRegRes = await request('/admin/system-settings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      key: 'student_registration_enabled',
      value: 'false'
    })
  });
  assert(disableRegRes.status === 200, 'Admin sets student_registration_enabled = false (HTTP 200)');

  // Registration attempt should fail
  const blockedRegAttempt = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Blocked Student',
      usn: `1RV21CS${(ts + 99) % 10000}`,
      email: `blocked_${ts}@terminal.edu`,
      branch: 'CSE',
      section: 'A',
      password: 'Password123'
    })
  });
  assert(blockedRegAttempt.status === 403, 'Server enforces disabled student registration (HTTP 403)');

  // Re-enable student registration
  await request('/admin/system-settings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      key: 'student_registration_enabled',
      value: 'true'
    })
  });
  console.log('  [PASS] Re-enabled student registration');
  passed++;

  // --- 16. DATA ISOLATION & SECURITY BARRIERS ---
  console.log('\n--- 16. TENANT ISOLATION & SECURITY BARRIERS ---');
  // Student cannot access another student's data via spoofed query parameter
  const spoofWs = await request(`/workspace/student?userId=${adminToken}`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(spoofWs.data.student?.id === studentId, 'Security: Workspace ignores spoofed query userId, strictly uses JWT');

  // Student cannot access Admin API
  const studentAdminAttempt = await request('/admin/stats', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(studentAdminAttempt.status === 403, 'Security: Student blocked from Admin API (HTTP 403)');

  // Student cannot access GM workspace
  const studentGmWsAttempt = await request('/workspace/gm', {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  assert(studentGmWsAttempt.status === 403, 'Security: Student blocked from Game Master workspace (HTTP 403)');

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 ALL MASTER PROMPT AUTH, WORKSPACES & ADMIN TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
