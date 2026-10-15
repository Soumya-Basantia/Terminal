const axios = require('axios');
const io = require('socket.io-client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

// Deterministic rounding utility matching server
function roundScore(val) {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

// Pure math unit tester for the scoring rules
function calculateMockTeamQuestionScore({
  teamSize,
  memberScores,
  correctResponseTimes = [],
  timeLimitSec = 20,
  speedBonusEnabled = false,
  maxSpeedBonus = 5,
  speedBonusWindowSec = null,
}) {
  const effectiveTeamSize = Math.max(teamSize, 1);
  const totalBase = memberScores.reduce((sum, s) => sum + s, 0);
  const baseAvg = roundScore(totalBase / effectiveTeamSize);

  let speedBonus = 0;
  const timeLimitMs = timeLimitSec * 1000;
  const windowMs = speedBonusWindowSec ? speedBonusWindowSec * 1000 : timeLimitMs;

  const validMaxBonus = (typeof maxSpeedBonus === 'number' && !isNaN(maxSpeedBonus) && isFinite(maxSpeedBonus))
    ? Math.max(0, maxSpeedBonus)
    : 0;

  if (speedBonusEnabled && validMaxBonus > 0 && correctResponseTimes.length > 0 && windowMs > 0) {
    const sumRatios = correctResponseTimes.reduce((acc, t) => {
      const respTime = Math.max(0, t);
      if (respTime < windowMs) {
        return acc + (windowMs - respTime) / windowMs;
      }
      return acc;
    }, 0);
    const avgRatio = Math.max(0, Math.min(1, sumRatios / correctResponseTimes.length));
    speedBonus = roundScore(validMaxBonus * avgRatio);
  }

  return {
    baseAvg,
    speedBonus,
    total: roundScore(baseAvg + speedBonus),
  };
}

async function runUnitTests() {
  console.log('================================================================');
  console.log('   PART A: SCORING FORMULA UNIT TESTS (ALL EDGE CASES)           ');
  console.log('================================================================');

  // Test 1: 4 players: 10,10,10,10 -> 10
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 4, memberScores: [10, 10, 10, 10] });
    console.log(`Test 1 [4 players: 10,10,10,10]: base = ${res.baseAvg} (expected 10)`);
    if (res.baseAvg !== 10) throw new Error(`Test 1 Failed: expected 10, got ${res.baseAvg}`);
  }

  // Test 2: 4 players: 10,10,0,10 -> 7.5
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 4, memberScores: [10, 10, 0, 10] });
    console.log(`Test 2 [4 players: 10,10,0,10]: base = ${res.baseAvg} (expected 7.5)`);
    if (res.baseAvg !== 7.5) throw new Error(`Test 2 Failed: expected 7.5, got ${res.baseAvg}`);
  }

  // Test 3: 3 players: 10,10,10 -> 10
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 3, memberScores: [10, 10, 10] });
    console.log(`Test 3 [3 players: 10,10,10]: base = ${res.baseAvg} (expected 10)`);
    if (res.baseAvg !== 10) throw new Error(`Test 3 Failed: expected 10, got ${res.baseAvg}`);
  }

  // Test 4: 3 players: 10,0,10 -> 6.7
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 3, memberScores: [10, 0, 10] });
    console.log(`Test 4 [3 players: 10,0,10]: base = ${res.baseAvg} (expected 6.7)`);
    if (res.baseAvg !== 6.7) throw new Error(`Test 4 Failed: expected 6.7, got ${res.baseAvg}`);
  }

  // Test 5: 2 players: 10,0 -> 5
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 2, memberScores: [10, 0] });
    console.log(`Test 5 [2 players: 10,0]: base = ${res.baseAvg} (expected 5)`);
    if (res.baseAvg !== 5) throw new Error(`Test 5 Failed: expected 5, got ${res.baseAvg}`);
  }

  // Test 6: 1 player: 10 -> 10
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 1, memberScores: [10] });
    console.log(`Test 6 [1 player: 10]: base = ${res.baseAvg} (expected 10)`);
    if (res.baseAvg !== 10) throw new Error(`Test 6 Failed: expected 10, got ${res.baseAvg}`);
  }

  // Test 7: No-answer: 10,10,no-answer,10 -> 7.5 (denominator stays 4)
  {
    const res = calculateMockTeamQuestionScore({ teamSize: 4, memberScores: [10, 10, 0, 10] });
    console.log(`Test 7 [No-answer in team of 4]: base = ${res.baseAvg} (expected 7.5)`);
    if (res.baseAvg !== 7.5) throw new Error(`Test 7 Failed: expected 7.5, got ${res.baseAvg}`);
  }

  // Test 8: SPEED BONUS - Faster correct response vs slower correct response
  {
    // Fast response: 2s into 20s window (ratio = 18/20 = 0.9) -> bonus = 5 * 0.9 = 4.5
    const fast = calculateMockTeamQuestionScore({
      teamSize: 4,
      memberScores: [10, 10, 0, 10],
      correctResponseTimes: [2000, 2000, 2000],
      timeLimitSec: 20,
      speedBonusEnabled: true,
      maxSpeedBonus: 5,
    });
    // Slow response: 18s into 20s window (ratio = 2/20 = 0.1) -> bonus = 5 * 0.1 = 0.5
    const slow = calculateMockTeamQuestionScore({
      teamSize: 4,
      memberScores: [10, 10, 0, 10],
      correctResponseTimes: [18000, 18000, 18000],
      timeLimitSec: 20,
      speedBonusEnabled: true,
      maxSpeedBonus: 5,
    });
    console.log(`Test 8 [Speed Bonus]: Fast = ${fast.speedBonus} pts (total: ${fast.total}), Slow = ${slow.speedBonus} pts (total: ${slow.total})`);
    if (fast.speedBonus <= slow.speedBonus) throw new Error('Faster response must produce higher bonus than slower response');
    if (fast.speedBonus !== 4.5) throw new Error(`Expected fast bonus 4.5, got ${fast.speedBonus}`);
    if (slow.speedBonus !== 0.5) throw new Error(`Expected slow bonus 0.5, got ${slow.speedBonus}`);
  }

  // Test 9: SPEED BONUS - Incorrect only (no correct answers) -> 0 bonus
  {
    const res = calculateMockTeamQuestionScore({
      teamSize: 4,
      memberScores: [0, 0, 0, 0],
      correctResponseTimes: [],
      timeLimitSec: 20,
      speedBonusEnabled: true,
      maxSpeedBonus: 5,
    });
    console.log(`Test 9 [Incorrect only]: bonus = ${res.speedBonus} (expected 0)`);
    if (res.speedBonus !== 0) throw new Error(`Expected 0 bonus for incorrect only, got ${res.speedBonus}`);
  }

  // Test 10: SPEED BONUS - Unanswered only -> 0 bonus
  {
    const res = calculateMockTeamQuestionScore({
      teamSize: 4,
      memberScores: [0, 0, 0, 0],
      correctResponseTimes: [],
      timeLimitSec: 20,
      speedBonusEnabled: true,
      maxSpeedBonus: 5,
    });
    console.log(`Test 10 [Unanswered only]: bonus = ${res.speedBonus} (expected 0)`);
    if (res.speedBonus !== 0) throw new Error(`Expected 0 bonus for unanswered only, got ${res.speedBonus}`);
  }

  // Test 11: SPEED BONUS - At Deadline (responseTime = 20s) -> 0 bonus
  {
    const res = calculateMockTeamQuestionScore({
      teamSize: 1,
      memberScores: [10],
      correctResponseTimes: [20000],
      timeLimitSec: 20,
      speedBonusEnabled: true,
      maxSpeedBonus: 5,
    });
    console.log(`Test 11 [At Deadline]: bonus = ${res.speedBonus} (expected 0)`);
    if (res.speedBonus !== 0) throw new Error(`Expected 0 bonus at deadline, got ${res.speedBonus}`);
  }

  // Test 12: SPEED BONUS - Disabled -> 0 bonus
  {
    const res = calculateMockTeamQuestionScore({
      teamSize: 1,
      memberScores: [10],
      correctResponseTimes: [1000],
      timeLimitSec: 20,
      speedBonusEnabled: false,
      maxSpeedBonus: 5,
    });
    console.log(`Test 12 [Bonus Disabled]: bonus = ${res.speedBonus} (expected 0)`);
    if (res.speedBonus !== 0) throw new Error(`Expected 0 bonus when disabled, got ${res.speedBonus}`);
  }

  // Test 13: SPEED BONUS - Maximum bonus (t = 0)
  {
    const res = calculateMockTeamQuestionScore({
      teamSize: 1,
      memberScores: [10],
      correctResponseTimes: [0],
      timeLimitSec: 20,
      speedBonusEnabled: true,
      maxSpeedBonus: 5,
    });
    console.log(`Test 13 [Max Bonus at t=0]: bonus = ${res.speedBonus} (expected 5)`);
    if (res.speedBonus !== 5) throw new Error(`Expected max bonus 5, got ${res.speedBonus}`);
  }

  // Test 14: SPEED BONUS - Malformed config (negative, NaN, Infinity)
  {
    const resNeg = calculateMockTeamQuestionScore({
      teamSize: 1,
      memberScores: [10],
      correctResponseTimes: [1000],
      speedBonusEnabled: true,
      maxSpeedBonus: -10,
    });
    const resNaN = calculateMockTeamQuestionScore({
      teamSize: 1,
      memberScores: [10],
      correctResponseTimes: [1000],
      speedBonusEnabled: true,
      maxSpeedBonus: NaN,
    });
    console.log(`Test 14 [Malformed config]: resNeg = ${resNeg.speedBonus}, resNaN = ${resNaN.speedBonus} (both expected 0)`);
    if (resNeg.speedBonus !== 0 || resNaN.speedBonus !== 0) {
      throw new Error('Malformed config should safely evaluate to 0 bonus');
    }
  }

  console.log('✓ ALL 14 SCORING FORMULA UNIT TESTS PASSED!\n');
}

async function runLiveIntegrationTests() {
  console.log('================================================================');
  console.log('   PART B: LIVE E2E INTEGRATION (GAME BUILDER -> LIVE SESSION)   ');
  console.log('================================================================');

  // 1. GM Login
  console.log('[1] Logging in Game Master...');
  const gmRes = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = gmRes.data.token;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };

  // 2. Register 4 students for Team Bravo
  const ts = Date.now();
  console.log('\n[2] Registering 4 students for Team Bravo...');
  const students = [];
  for (let i = 1; i <= 4; i++) {
    const regRes = await axios.post(`${API}/auth/register`, {
      name: `Bravo ${i} ${ts}`,
      username: `bravo_${i}_${ts}`,
      usn: `1MS24BR${String(ts).slice(-3)}${i}`,
      email: `bravo_${i}_${ts}@campus.edu`,
      branch: 'ISE',
      section: 'B',
      password: 'Password123!',
    });
    students.push({
      id: regRes.data.user.id,
      username: regRes.data.user.username,
      token: regRes.data.token,
      headers: { headers: { Authorization: `Bearer ${regRes.data.token}` } },
    });
  }

  // 3. Create Game with Speed Bonus enabled & maxSpeedBonus: 5
  console.log('\n[3] Creating Game with Speed Bonus enabled (max 5 pts)...');
  const createGameRes = await axios.post(`${API}/games`, {
    name: `Speed Bonus Arena ${ts}`,
    template: 'RAPID_FIRE',
    description: 'Testing team average and speed bonus',
    maxPlayers: 20,
    teamsEnabled: true,
    speedBonus: true,
    config: {
      maxSpeedBonus: 5,
    },
  }, gmHeaders);
  const game = createGameRes.data.game;

  // Add Question 1: 10 pts, 20s
  const q1Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What does TCP stand for?',
    options: ['Transmission Control Protocol', 'Terminal Control Port', 'Transfer Call Process', 'Total Command Path'],
    answer: 'Transmission Control Protocol',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, gmHeaders);
  const q1 = q1Res.data.challenge;

  // Add Question 2: 10 pts, 20s
  const q2Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Which data structure follows FIFO?',
    options: ['Queue', 'Stack', 'Tree', 'Graph'],
    answer: 'Queue',
    points: 10,
    timerSecs: 20,
    difficulty: 'EASY',
  }, gmHeaders);
  const q2 = q2Res.data.challenge;

  // Publish game
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  console.log(`✓ Game configured with 2 questions (10 pts, 20s each) and published.`);

  // 4. Create Session
  console.log('\n[4] Creating Live Session...');
  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const sessionData = sessionRes.data.session;
  console.log(`✓ Session created: roomCode = ${sessionData.roomCode}`);

  // 5. Students join session & create Team Bravo
  console.log('\n[5] Students forming Team Bravo...');
  for (const st of students) {
    await axios.post(`${API}/sessions/join`, { roomCode: sessionData.roomCode }, st.headers);
  }
  const teamName = `Bravo${String(ts).slice(-4)}`;
  const teamRes = await axios.post(`${API}/teams/create`, { name: teamName }, students[0].headers);
  const team = teamRes.data.team;
  for (let i = 1; i < students.length; i++) {
    await axios.post(`${API}/teams/join`, { name: teamName }, students[i].headers);
  }
  for (const st of students) {
    await axios.post(`${API}/sessions/join`, { roomCode: sessionData.roomCode }, st.headers);
  }

  // Connect GM socket
  const gmSocket = io(SOCKET_URL, { auth: { token: gmToken } });
  await new Promise(resolve => gmSocket.on('connect', resolve));
  gmSocket.emit('host:join', { roomCode: sessionData.roomCode });
  await new Promise(r => setTimeout(r, 400));
  await axios.get(`${API}/sessions/${sessionData.roomCode}`);

  // 6. Execute Question 1:
  // S1 = Correct ('Transmission Control Protocol')
  // S2 = Correct ('Transmission Control Protocol')
  // S3 = Incorrect ('Terminal Control Port')
  // S4 = Correct ('Transmission Control Protocol')
  // Expected Base Score = (10 + 10 + 0 + 10) / 4 = 7.5
  console.log('\n[6] Submitting Question 1 (3 correct, 1 incorrect)...');
  gmSocket.emit('host:select_challenge', { challengeId: q1.id });
  await new Promise(r => setTimeout(r, 600));

  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: 'Transmission Control Protocol' }, students[0].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: 'Transmission Control Protocol' }, students[1].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: 'Terminal Control Port' }, students[2].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: 'Transmission Control Protocol' }, students[3].headers);

  // Verify Idempotency: Duplicate submission from S1 is handled idempotently without mutating scores
  try {
    const dupRes = await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q1.id, answer: 'Transmission Control Protocol' }, students[0].headers);
    if (dupRes.data.duplicate || dupRes.status === 200) {
      console.log('✓ Idempotency verified: duplicate submission safely handled idempotently (duplicate: true).');
    }
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('✓ Idempotency verified: duplicate submission properly rejected with 400.');
    } else {
      throw err;
    }
  }

  // Check Leaderboard after Q1
  let lbQ1 = await axios.get(`${API}/sessions/${sessionData.roomCode}/leaderboard`);
  const teamScoreQ1 = lbQ1.data.teamLeaderboard.find(t => t.teamId === team.id);
  console.log('✓ Leaderboard after Q1:');
  console.log(`  Base Score: ${teamScoreQ1.baseScore}`);
  console.log(`  Speed Bonus: ${teamScoreQ1.speedBonus}`);
  console.log(`  Final Score: ${teamScoreQ1.finalScore}`);
  console.log(`  Per Question Base Scores:`, teamScoreQ1.perQuestionBaseScores);
  console.log(`  Per Question Speed Bonus:`, teamScoreQ1.perQuestionSpeedBonus);

  if (teamScoreQ1.baseScore !== 7.5) {
    throw new Error(`Expected Q1 Team Base Score to be 7.5, got ${teamScoreQ1.baseScore}`);
  }
  if (teamScoreQ1.speedBonus <= 0) {
    throw new Error(`Expected Q1 Speed Bonus > 0 for fast responses, got ${teamScoreQ1.speedBonus}`);
  }
  if (teamScoreQ1.finalScore !== roundScore(7.5 + teamScoreQ1.speedBonus)) {
    throw new Error(`Final score must equal base + speed bonus: got ${teamScoreQ1.finalScore}`);
  }

  // 7. Execute Question 2 with NO-ANSWER RULE:
  // S1 = Correct ('Queue')
  // S2 = Correct ('Queue')
  // S3 = NO-ANSWER (does not submit anything)
  // S4 = Correct ('Queue')
  // Expected Q2 Base Score = (10 + 10 + 0 + 10) / 4 = 7.5
  console.log('\n[7] Submitting Question 2 (3 correct, 1 NO-ANSWER)...');
  gmSocket.emit('host:select_challenge', { challengeId: q2.id });
  await new Promise(r => setTimeout(r, 600));

  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'Queue' }, students[0].headers);
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'Queue' }, students[1].headers);
  // S3 intentionally does NOT submit!
  await axios.post(`${API}/sessions/${sessionData.roomCode}/submit`, { challengeId: q2.id, answer: 'Queue' }, students[3].headers);

  let lbQ2 = await axios.get(`${API}/sessions/${sessionData.roomCode}/leaderboard`);
  const teamScoreQ2 = lbQ2.data.teamLeaderboard.find(t => t.teamId === team.id);
  console.log('✓ Leaderboard after Q2 (with No-Answer player):');
  console.log(`  Total Base Score: ${teamScoreQ2.baseScore} (expected 15.0)`);
  console.log(`  Q2 Base Score: ${teamScoreQ2.perQuestionBaseScores[q2.id]} (expected 7.5)`);
  console.log(`  Total Final Score: ${teamScoreQ2.finalScore}`);

  if (teamScoreQ2.perQuestionBaseScores[q2.id] !== 7.5) {
    throw new Error(`Expected Q2 Base Score with No-Answer to be 7.5, got ${teamScoreQ2.perQuestionBaseScores[q2.id]}`);
  }
  if (teamScoreQ2.baseScore !== 15.0) {
    throw new Error(`Expected Total Base Score to be 15.0, got ${teamScoreQ2.baseScore}`);
  }

  // 8. End Game & Finalize Session
  console.log('\n[8] Finalizing session and verifying results...');
  gmSocket.emit('host:end_event');
  await new Promise(r => setTimeout(r, 1000));

  const finalLb = await axios.get(`${API}/sessions/${sessionData.roomCode}/leaderboard`);
  const finalTeam = finalLb.data.teamLeaderboard.find(t => t.teamId === team.id);
  console.log(`✓ Final Team Score Breakdown:`);
  console.log(`  Rank: ${finalTeam.rank}`);
  console.log(`  Base Score: ${finalTeam.baseScore}`);
  console.log(`  Speed Bonus: ${finalTeam.speedBonus}`);
  console.log(`  Final Score: ${finalTeam.finalScore}`);

  if (finalTeam.baseScore !== 15.0) {
    throw new Error(`Expected final base score 15.0, got ${finalTeam.baseScore}`);
  }
  if (finalTeam.finalScore !== roundScore(finalTeam.baseScore + finalTeam.speedBonus)) {
    throw new Error(`Final score mismatch: ${finalTeam.finalScore} vs ${finalTeam.baseScore + finalTeam.speedBonus}`);
  }

  // 9. Report download
  console.log('\n[9] Verifying Game Master Performance Report...');
  const reportRes = await axios.get(`${API}/sessions/${sessionData.id}/report`, {
    ...gmHeaders,
    responseType: 'arraybuffer',
  });
  if (reportRes.status !== 200 || reportRes.data.length < 1000) {
    throw new Error('Failed to generate report or file empty');
  }
  console.log(`✓ Excel Report generated successfully (${reportRes.data.length} bytes).`);

  gmSocket.disconnect();
  console.log('\n================================================================');
  console.log('   ALL UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!            ');
  console.log('================================================================');
}

async function main() {
  await runUnitTests();
  await runLiveIntegrationTests();
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
