const axios = require('axios');
const io = require('socket.io-client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

async function main() {
  console.log('================================================================');
  console.log('   VERIFY GM HOSTING & RAPID FIRE / QUIZ AUTHORITATIVE SCORING  ');
  console.log('================================================================');

  // 1. GM Login
  console.log('\n[1] Authenticating Game Master...');
  const gmRes = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = gmRes.data.token;
  const gmUser = gmRes.data.user;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };
  console.log(`✓ GM Authenticated: ${gmUser.name} (${gmUser.role})`);

  // 2. Verify GM is FORBIDDEN from Student Terminal Workspace
  console.log('\n[2] Testing role guard on /api/workspace/student...');
  try {
    await axios.get(`${API}/workspace/student`, gmHeaders);
    throw new Error('GM should have been rejected with 403 Forbidden on /api/workspace/student');
  } catch (err) {
    if (err.response?.status === 403) {
      console.log('✓ GM access to /api/workspace/student rejected with 403 Forbidden as required');
    } else {
      throw err;
    }
  }

  // 3. Register 4 students and authenticate
  console.log('\n[3] Registering 4 students for Team Alpha...');
  const ts = Date.now();
  const students = [];

  for (let i = 1; i <= 4; i++) {
    const regRes = await axios.post(`${API}/auth/register`, {
      name: `Agent ${i} ${ts}`,
      username: `agent_${i}_${ts}`,
      usn: `1MS24CS${String(ts).slice(-3)}${i}`,
      email: `agent_${i}_${ts}@campus.edu`,
      branch: 'CSE',
      section: 'A',
      password: 'Password123!',
    });
    students.push({
      id: regRes.data.user.id,
      name: regRes.data.user.name,
      username: regRes.data.user.username,
      token: regRes.data.token,
      headers: { headers: { Authorization: `Bearer ${regRes.data.token}` } },
    });
  }
  console.log(`✓ 4 Students registered: ${students.map(s => s.username).join(', ')}`);

  // Verify Student CAN access /api/workspace/student
  const studentWorkspaceRes = await axios.get(`${API}/workspace/student`, students[0].headers);
  if (studentWorkspaceRes.status === 200) {
    console.log('✓ Student successfully access /api/workspace/student (200 OK)');
  }

  // 4. Create Game with teamsEnabled: true, speedBonus: true, timeBonusPoints: 10
  console.log('\n[4] Creating Team Game with Speed Bonus & 10 Time Bonus Points...');
  const createGameRes = await axios.post(`${API}/games`, {
    name: `Team Rapid Fire ${ts}`,
    template: 'RAPID_FIRE',
    description: 'Testing per-question team averaging and time bonus',
    maxPlayers: 20,
    teamsEnabled: true,
    speedBonus: true,
    config: {
      timeBonusPoints: 10,
    },
  }, gmHeaders);
  const game = createGameRes.data.game;
  console.log(`✓ Game created: ID ${game.id}`);

  // Create Question 1 (10 points)
  const q1Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What is the binary representation of decimal 5?',
    options: ['101', '110', '011', '111'],
    answer: '101',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, gmHeaders);
  const q1 = q1Res.data.challenge;

  // Create Question 2 (10 points)
  const q2Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Which protocol is used for secure shell access?',
    options: ['SSH', 'FTP', 'TELNET', 'HTTP'],
    answer: 'SSH',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, gmHeaders);
  const q2 = q2Res.data.challenge;

  // Publish game
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  console.log('✓ Game configured and published with 2 questions (10 pts each)');

  // 5. GM starts session directly via POST /api/sessions with gameId
  console.log('\n[5] Game Master creating live session directly with gameId...');
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const sessionData = sessionRes.data.session;
  console.log(`✓ Session created: roomCode = ${sessionData.roomCode}, code = ${sessionData.code}`);
  if (sessionData.code !== sessionData.roomCode || sessionData.code.length !== 5) {
    throw new Error('Room code format invalid or code property missing');
  }

  // 6. Students join session & create/join Team Alpha
  console.log('\n[6] Students joining session and forming Team Alpha...');
  for (const st of students) {
    await axios.post(`${API}/sessions/join`, { roomCode: sessionData.roomCode }, st.headers);
  }

  // Create Team Alpha
  const teamName = `Alpha${String(ts).slice(-4)}`;
  const teamRes = await axios.post(`${API}/teams/create`, {
    name: teamName,
  }, students[0].headers);
  const team = teamRes.data.team;
  console.log(`✓ Team created: ${team.name} (ID: ${team.id})`);

  // Remaining students join the team
  for (let i = 1; i < students.length; i++) {
    await axios.post(`${API}/teams/join`, {
      name: teamName,
    }, students[i].headers);
  }

  // Re-join session to link teamId to session players
  for (const st of students) {
    await axios.post(`${API}/sessions/join`, { roomCode: sessionData.roomCode }, st.headers);
  }

  // 7. Connect sockets for GM and verify session state payload
  console.log('\n[7] Verifying live session state payload...');
  const gmSocket = io(SOCKET_URL, { auth: { token: gmToken } });
  await new Promise(resolve => gmSocket.on('connect', resolve));
  gmSocket.emit('host:join', { roomCode: sessionData.roomCode });

  const stateRes = await axios.get(`${API}/sessions/${sessionData.roomCode}`);
  console.log(`✓ Session state loaded:`);
  console.log(`  playerRoster count = ${stateRes.data.playerRoster?.length}`);
  console.log(`  teamRoster count = ${stateRes.data.teamRoster?.teams?.length}`);
  console.log(`  timeBonusConfig =`, stateRes.data.timeBonusConfig);

  if (!stateRes.data.playerRoster || !stateRes.data.teamRoster || !stateRes.data.timeBonusConfig) {
    throw new Error('Session state missing playerRoster, teamRoster, or timeBonusConfig');
  }

  // 8. Execute Question 1:
  // S1 = '101' (correct, 10)
  // S2 = '101' (correct, 10)
  // S3 = '011' (incorrect, 0)
  // S4 = '101' (correct, 10)
  // Expected Q1 team score = (10 + 10 + 0 + 10) / 4 = 7.5
  console.log('\n[8] Executing Question 1...');
  gmSocket.emit('host:select_challenge', { challengeId: q1.id });
  await new Promise(r => setTimeout(r, 600));

  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: '101' }, students[0].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: '101' }, students[1].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: '011' }, students[2].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: '101' }, students[3].headers);

  // Check Leaderboard after Q1
  let lbQ1 = await axios.get(`${API}/sessions/${sessionData.roomCode}/leaderboard`);
  console.log('✓ Leaderboard after Q1:');
  const teamScoreQ1 = lbQ1.data.teamLeaderboard.find(t => t.teamId === team.id);
  console.log(`  Team Base Score = ${teamScoreQ1.baseScore}`);
  console.log(`  Team Final Score = ${teamScoreQ1.finalScore}`);
  console.log(`  Per Question Scores =`, teamScoreQ1.perQuestionScores);

  if (teamScoreQ1.baseScore !== 7.5) {
    throw new Error(`Expected Q1 Team Base Score to be 7.5, got ${teamScoreQ1.baseScore}`);
  }
  if (teamScoreQ1.finalScore !== 7.5) {
    throw new Error(`Expected Q1 Team Final Score to be 7.5 (no time bonus mid-game), got ${teamScoreQ1.finalScore}`);
  }

  // 9. Execute Question 2:
  // S1 = 'SSH' (correct, 10)
  // S2 = 'FTP' (incorrect, 0)
  // S3 = 'SSH' (correct, 10)
  // S4 = 'SSH' (correct, 10)
  // Expected Q2 team score = (10 + 0 + 10 + 10) / 4 = 7.5
  // Total Base score = 7.5 + 7.5 = 15.0
  console.log('\n[9] Executing Question 2...');
  gmSocket.emit('host:select_challenge', { challengeId: q2.id });
  await new Promise(r => setTimeout(r, 600));

  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'SSH' }, students[0].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'FTP' }, students[1].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'SSH' }, students[2].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'SSH' }, students[3].headers);

  let lbQ2 = await axios.get(`${API}/sessions/${sessionData.roomCode}/leaderboard`);
  console.log('✓ Leaderboard after Q2:');
  const teamScoreQ2 = lbQ2.data.teamLeaderboard.find(t => t.teamId === team.id);
  console.log(`  Team Base Score = ${teamScoreQ2.baseScore}`);
  console.log(`  Team Final Score = ${teamScoreQ2.finalScore}`);
  console.log(`  Per Question Scores =`, teamScoreQ2.perQuestionScores);

  if (teamScoreQ2.baseScore !== 15.0) {
    throw new Error(`Expected Q2 Team Base Score to be 15.0, got ${teamScoreQ2.baseScore}`);
  }
  if (teamScoreQ2.finalScore !== 15.0) {
    throw new Error(`Expected Q2 Team Final Score to be 15.0 before end, got ${teamScoreQ2.finalScore}`);
  }

  // 10. End Game / Finalize Session: Verify Time Bonus Applied!
  console.log('\n[10] Ending Game and Finalizing Session...');
  gmSocket.emit('host:end_event');
  await new Promise(r => setTimeout(r, 1000));

  let finalLb = await axios.get(`${API}/sessions/${sessionData.roomCode}/leaderboard`);
  console.log('✓ Final Leaderboard:');
  const finalTeamScore = finalLb.data.teamLeaderboard.find(t => t.teamId === team.id);
  console.log(`  Team Base Score = ${finalTeamScore.baseScore}`);
  console.log(`  Team Time Bonus = ${finalTeamScore.timeBonus}`);
  console.log(`  Team Final Score = ${finalTeamScore.finalScore}`);

  if (finalTeamScore.baseScore !== 15.0) {
    throw new Error(`Expected Final Base Score to be 15.0, got ${finalTeamScore.baseScore}`);
  }
  if (finalTeamScore.timeBonus !== 10) {
    throw new Error(`Expected Final Time Bonus to be 10, got ${finalTeamScore.timeBonus}`);
  }
  if (finalTeamScore.finalScore !== 25.0) {
    throw new Error(`Expected Final Score to be 25.0 (15 base + 10 bonus), got ${finalTeamScore.finalScore}`);
  }
  console.log('✓ EXACT SCORING FORMULA VERIFIED: BASE (15.0) + TIME BONUS (10) = FINAL (25.0)');

  // 11. Verify Excel Report Consistency
  console.log('\n[11] Verifying Excel Game Performance Report Download...');
  const reportRes = await axios.get(`${API}/sessions/${sessionData.id}/report`, {
    ...gmHeaders,
    responseType: 'arraybuffer',
  });
  console.log(`✓ Report generated: status = ${reportRes.status}, size = ${reportRes.data.length} bytes`);
  if (reportRes.status !== 200 || reportRes.data.length < 1000) {
    throw new Error('Report download failed or file empty');
  }

  gmSocket.disconnect();
  console.log('\n================================================================');
  console.log('   ALL GM HOSTING & SCORING VERIFICATION TESTS PASSED (11/11)!  ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  if (err.response?.data) {
    try {
      const decoded = Buffer.isBuffer(err.response.data) ? err.response.data.toString() : err.response.data;
      console.error(decoded);
    } catch {
      console.error(err.response.data);
    }
  }
  process.exit(1);
});
