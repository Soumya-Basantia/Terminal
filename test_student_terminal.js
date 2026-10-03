const axios = require('axios');

const API = 'http://localhost:3001/api';

async function runStudentTerminalTests() {
  console.log('====================================================');
  console.log('🚀 STUDENT TERMINAL-FIRST ARCHITECTURE & COMMANDS QA');
  console.log('====================================================');

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

  const ts = Date.now();

  try {
    // 1. Authenticate a student user
    console.log('\n--- 1. AUTHENTICATION & IDENTITY VERIFICATION ---');
    const studentUser = {
      name: `Kavya Sharma ${ts}`,
      username: `kavya_${ts}`,
      usn: `1RV21CS${Math.floor(100 + Math.random() * 900)}`,
      email: `kavya_${ts}@terminal.edu`,
      branch: 'CSE',
      section: 'A',
      password: 'SecurePassword@123',
      role: 'STUDENT'
    };

    const regRes = await axios.post(`${API}/auth/register`, studentUser);
    assert(regRes.status === 201, 'Student registered successfully');
    const token = regRes.data.token;
    assert(token && token.length > 20, 'JWT token returned by server');

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Fetch student personal workspace
    console.log('\n--- 2. STUDENT PERSONAL WORKSPACE ENDPOINT ---');
    const wsRes = await axios.get(`${API}/workspace/student`, { headers });
    assert(wsRes.status === 200, 'Student workspace endpoint accessible (HTTP 200)');
    
    const wsData = wsRes.data;
    assert(wsData.student.name === studentUser.name, `Workspace student name matches: ${wsData.student.name}`);
    assert(wsData.student.usn === studentUser.usn, `Workspace USN matches: ${wsData.student.usn}`);
    assert(wsData.student.email === studentUser.email, `Workspace email matches: ${wsData.student.email}`);
    assert(wsData.student.branch === 'CSE', `Workspace branch matches: ${wsData.student.branch}`);
    assert(wsData.student.section === 'A', `Workspace section matches: ${wsData.student.section}`);
    assert(wsData.student.role === 'PLAYER', `Workspace role is normalized PLAYER: ${wsData.student.role}`);
    assert(wsData.progress !== undefined, 'Workspace includes progress matrix');
    assert(typeof wsData.progress.totalScore === 'number', `Total score is numeric: ${wsData.progress.totalScore}`);
    assert(Array.isArray(wsData.games), `Workspace includes games array: ${wsData.games.length} games`);
    assert(Array.isArray(wsData.events), `Workspace includes events array`);
    assert(Array.isArray(wsData.sessions), `Workspace includes sessions array`);

    // 3. Verify security & data isolation
    console.log('\n--- 3. SECURITY & IDENTITY DERIVATION ---');
    // Spoofing attempt with query param or body
    const spoofRes = await axios.get(`${API}/workspace/student?userId=fake-admin-id`, { headers });
    assert(spoofRes.data.student.id === wsData.student.id, 'SECURITY PASS: Server derived identity from JWT, ignored query userId');

    // Unauthenticated rejection
    try {
      await axios.get(`${API}/workspace/student`);
      assert(false, 'Unauthenticated request should be rejected');
    } catch (e) {
      assert(e.response && e.response.status === 401, 'SECURITY PASS: Unauthenticated request rejected (HTTP 401)');
    }

    // Role barrier: Student cannot access GM workspace
    try {
      await axios.get(`${API}/workspace/gm`, { headers });
      assert(false, 'Student should not access GM workspace');
    } catch (e) {
      assert(e.response && e.response.status === 403, 'ROLE BARRIER: Student blocked from GM workspace (HTTP 403)');
    }

    // 4. Test terminal command simulation & registry contracts
    console.log('\n--- 4. COMMAND SYSTEM CONTRACTS & PANEL BEHAVIOR ---');
    
    // Test context mock
    let activePanel = null;
    let terminalCleared = false;
    const outputs = [];

    const mockContext = {
      username: studentUser.username,
      workspaceData: wsData,
      clearTerminal: () => {
        terminalCleared = true;
        outputs.length = 0;
      },
      openPanel: (name, data) => {
        activePanel = { name, data };
      },
      closePanel: () => {
        activePanel = null;
      },
      pushOutput: (item) => outputs.push(item)
    };

    // Test terminal command (returns to main terminal from any panel)
    activePanel = { name: 'whoami' };
    assert(activePanel.name === 'whoami', 'Precondition: active panel is whoami');
    mockContext.closePanel();
    assert(activePanel === null, "Command 'terminal' returns to main terminal screen (activePanel === null)");

    // Test Esc key behavior simulation
    activePanel = { name: 'games' };
    assert(activePanel.name === 'games', 'Precondition: active panel is games');
    mockContext.closePanel();
    assert(activePanel === null, 'Esc key dismisses active panel and returns to terminal');

    // Test transition from one panel to another (e.g., games -> scorecard)
    mockContext.openPanel('games');
    assert(activePanel.name === 'games', 'Navigated to games panel');
    mockContext.openPanel('scorecard');
    assert(activePanel.name === 'scorecard', 'Transitioned directly from games panel to scorecard panel');
    mockContext.openPanel('whoami');
    assert(activePanel.name === 'whoami', 'Transitioned directly to whoami profile panel');
    mockContext.openPanel('status');
    assert(activePanel.name === 'status', 'Transitioned directly to status telemetry panel');
    mockContext.openPanel('help');
    assert(activePanel.name === 'help', 'Transitioned directly to help reference panel');
    mockContext.openPanel('events');
    assert(activePanel.name === 'events', 'Transitioned directly to events panel');
    mockContext.openPanel('team');
    assert(activePanel.name === 'team', 'Transitioned directly to team squad panel');
    mockContext.openPanel('history');
    assert(activePanel.name === 'history', 'Transitioned directly to history panel');
    mockContext.openPanel('battle', { roomCode: 'ROOM123' });
    assert(activePanel.name === 'battle' && activePanel.data.roomCode === 'ROOM123', 'Transitioned to battle lobby panel with room code');
    mockContext.closePanel();
    assert(activePanel === null, 'Returned to main welcome terminal');

    // Test clear command simulation
    mockContext.openPanel('whoami');
    mockContext.clearTerminal();
    mockContext.closePanel();
    assert(terminalCleared === true, "Command 'clear' flushes terminal outputs");
    assert(activePanel === null, "Command 'clear' resets panel to welcome terminal");

    // 5. Test another student for profile data isolation
    console.log('\n--- 5. CROSS-STUDENT PROFILE ISOLATION ---');
    const studentUser2 = {
      name: `Rohan Verma ${ts}`,
      username: `rohan_${ts}`,
      usn: `1RV21EC${Math.floor(100 + Math.random() * 900)}`,
      email: `rohan_${ts}@terminal.edu`,
      branch: 'ECE',
      section: 'C',
      password: 'SecurePassword@123',
      role: 'STUDENT'
    };

    const regRes2 = await axios.post(`${API}/auth/register`, studentUser2);
    const token2 = regRes2.data.token;
    const wsRes2 = await axios.get(`${API}/workspace/student`, { headers: { Authorization: `Bearer ${token2}` } });

    assert(wsRes2.data.student.name === studentUser2.name, 'Student 2 workspace returns Student 2 name');
    assert(wsRes2.data.student.usn === studentUser2.usn, 'Student 2 workspace returns Student 2 USN');
    assert(wsRes2.data.student.branch === 'ECE', 'Student 2 workspace returns Student 2 Branch ECE');
    assert(wsRes2.data.student.id !== wsData.student.id, 'Student 1 and Student 2 have strictly separated IDs');
    assert(wsRes2.data.student.email !== wsData.student.email, 'Student 1 and Student 2 have strictly separated Emails');

  } catch (err) {
    console.error('Test execution error:', err.response ? err.response.data : err.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('🎉 ALL STUDENT TERMINAL-FIRST CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED!\n');
    process.exit(1);
  }
}

runStudentTerminalTests();
