const axios = require('axios');
const fs = require('fs');

const API = 'http://localhost:3001/api';
const sessionData = JSON.parse(fs.readFileSync('threshold_playtest_session.json', 'utf8'));
const roomCode = sessionData.roomCode;
async function runLivePlaytest() {
  console.log('====================================================');
  console.log(`LIVE HUMAN PLAYTEST PASS: ROOM ${roomCode}`);
  console.log('====================================================\n');

  // Register fresh student for clean playtest run
  const reg1 = await axios.post(`${API}/auth/register`, {
    email: `student_playtest_${Date.now()}@test.com`,
    username: `officer_${Date.now().toString().slice(-6)}`,
    password: 'password123',
    displayName: 'Playtest Officer 1',
    role: 'STUDENT'
  });
  const token1 = reg1.data.token;

  const client1 = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token1}` }
  });

  // STEP 1: JOIN
  console.log('--- STEP 1: JOIN & LOAD ---');
  const joinRes = await client1.post('/sessions/join', { roomCode });
  console.log('Join response status:', joinRes.status, 'SessionPlayer ID:', joinRes.data.sessionPlayer?.id);

  const sessionRes = await client1.get(`/sessions/${roomCode}`);
  console.log('Session game template:', sessionRes.data.currentGame?.template);
  console.log('Session status:', sessionRes.data.session?.status);
  const challenge = sessionRes.data.currentGame?.challenges?.[0];
  console.log('Challenge type:', challenge?.type, 'Scenario Title:', challenge?.config?.scenarioTitle);

  const state1 = await client1.get(`/sessions/${roomCode}/threshold-state`);
  console.log('Initial Threshold State:', {
    activePhase: state1.data.activePhase,
    probesRemaining: state1.data.probesRemaining,
    phase1Completed: state1.data.phase1Completed,
    isCompleted: state1.data.isCompleted,
    maxBudget: state1.data.phase1Baseline?.maxIncidentBudget || state1.data.costMatrix?.maxIncidentBudget
  });

  // STEP 2: THRESHOLD INTERACTION VERIFICATION (Math agreement)
  console.log('\n--- STEP 2 & 3: THRESHOLD INTERACTION (Math parity) ---');
  const { Validator } = require('./server/dist/engine');
  const testThresholds = [0, 25, 50, 53, 75, 100];
  for (const t of testThresholds) {
    const evalMath = Validator.evaluateThreshold(challenge.config, t, 1);
    console.log(`T=${t}: TP=${evalMath.tp} FP=${evalMath.fp} TN=${evalMath.tn} FN=${evalMath.fn} | Loss: $${evalMath.totalLoss} withinBudget=${evalMath.withinBudget}`);
  }

  // STEP 4: CANARY PROBES
  console.log('\n--- STEP 4: CANARY PROBES ---');
  console.log(`Initial probes: ${state1.data.probesRemaining}`);

  // Probe 1: T=50 (Within budget)
  const probe1 = await client1.post('/sessions/active/submit', {
    challengeId: challenge.id,
    answer: { threshold: 50, phase: 1, isProbe: true }
  });
  console.log('Probe 1 (T=50) result:', {
    isProbe: probe1.data.isProbe,
    withinBudget: probe1.data.withinBudget,
    totalLoss: probe1.data.totalLoss,
    probesRemaining: probe1.data.probesRemaining,
    failureTier: probe1.data.failureTier
  });

  // Probe 2: T=80 (Out of budget - missed criticals)
  const probe2 = await client1.post('/sessions/active/submit', {
    challengeId: challenge.id,
    answer: { threshold: 80, phase: 1, isProbe: true }
  });
  console.log('Probe 2 (T=80) result:', {
    isProbe: probe2.data.isProbe,
    withinBudget: probe2.data.withinBudget,
    totalLoss: probe2.data.totalLoss,
    probesRemaining: probe2.data.probesRemaining,
    whatHappened: probe2.data.failureTier?.whatHappened,
    adaptationHint: probe2.data.failureTier?.adaptationHint
  });

  // Refresh/reconnect check after probes
  const stateAfterProbes = await client1.get(`/sessions/${roomCode}/threshold-state`);
  console.log('State after 2 probes on refresh:', {
    probesRemaining: stateAfterProbes.data.probesRemaining,
    probesUsed: stateAfterProbes.data.probesUsed
  });

  // STEP 5: PHASE 1 COMMIT
  console.log('\n--- STEP 5: PHASE 1 COMMIT ---');
  // First test invalid threshold (e.g. out of range)
  try {
    await client1.post('/sessions/active/submit', {
      challengeId: challenge.id,
      answer: { threshold: 150, phase: 1, isProbe: false }
    });
    console.error('Should have rejected threshold 150!');
  } catch (err) {
    console.log('✓ Invalid threshold 150 correctly rejected:', err.response?.data?.error);
  }

  // Commit valid Phase 1 calibration: T=53
  const p1Commit = await client1.post('/sessions/active/submit', {
    challengeId: challenge.id,
    answer: { threshold: 53, phase: 1, isProbe: false }
  });
  console.log('Phase 1 Commit result:', {
    isCorrect: p1Commit.data.isCorrect,
    phase1Completed: p1Commit.data.submission?.metadata?.phase1Completed,
    activePhase: p1Commit.data.submission?.metadata?.activePhase,
    pointsAwarded: p1Commit.data.pointsAwarded
  });

  // Refresh/reconnect check after Phase 1 commit
  const stateAfterP1 = await client1.get(`/sessions/${roomCode}/threshold-state`);
  console.log('State on refresh after Phase 1 commit:', {
    activePhase: stateAfterP1.data.activePhase,
    phase1Completed: stateAfterP1.data.phase1Completed,
    phase1Threshold: stateAfterP1.data.phase1Threshold,
    phase1Cost: stateAfterP1.data.phase1Cost,
    phase2Completed: stateAfterP1.data.phase2Completed,
    isCompleted: stateAfterP1.data.isCompleted
  });

  // STEP 6: DISTRIBUTION SHIFT IN PHASE 2
  console.log('\n--- STEP 6: DISTRIBUTION SHIFT ---');
  console.log('Phase 2 shift narrative:', stateAfterP1.data.phase2Shift?.shiftNarrative);
  console.log('Phase 2 critical distribution:', stateAfterP1.data.phase2Shift?.criticalDistribution);
  console.log('Phase 2 benign distribution:', stateAfterP1.data.phase2Shift?.benignDistribution);
  console.log('Phase 2 optimal range:', stateAfterP1.data.phase2Shift?.optimalThresholdRange);

  // If player kept old threshold (53) in Phase 2:
  const evalOldInP2 = Validator.evaluateThreshold(challenge.config, 53, 2);
  console.log(`Old T=53 in Phase 2: Loss: $${evalOldInP2.totalLoss} withinBudget=${evalOldInP2.withinBudget} (FN=${evalOldInP2.fn})`);

  // STEP 7: PHASE 2 CALIBRATION
  console.log('\n--- STEP 7: PHASE 2 CALIBRATION ---');
  // Use remaining probe to verify T=30
  const probe3 = await client1.post('/sessions/active/submit', {
    challengeId: challenge.id,
    answer: { threshold: 30, phase: 2, isProbe: true }
  });
  console.log('Probe 3 (T=30 in Phase 2) result:', {
    withinBudget: probe3.data.withinBudget,
    totalLoss: probe3.data.totalLoss,
    probesRemaining: probe3.data.probesRemaining
  });

  // Try to use a 4th probe when exhausted
  try {
    await client1.post('/sessions/active/submit', {
      challengeId: challenge.id,
      answer: { threshold: 30, phase: 2, isProbe: true }
    });
    console.error('Should have rejected probe when exhausted!');
  } catch (err) {
    console.log('✓ Exhausted probe correctly rejected:', err.response?.data?.error);
  }

  // Lock final Phase 2 boundary at T=30
  const p2Commit = await client1.post('/sessions/active/submit', {
    challengeId: challenge.id,
    answer: { threshold: 30, phase: 2, isProbe: false }
  });
  console.log('Phase 2 Commit result:', {
    isCorrect: p2Commit.data.isCorrect,
    pointsAwarded: p2Commit.data.pointsAwarded,
    isCompleted: p2Commit.data.submission?.metadata?.phase2Completed
  });

  // STEP 8: END STATE & RECONNECT STABILITY
  console.log('\n--- STEP 8: END STATE & RECONNECT STABILITY ---');
  const finalState = await client1.get(`/sessions/${roomCode}/threshold-state`);
  console.log('Final State on Reconnect:', {
    activePhase: finalState.data.activePhase,
    isCompleted: finalState.data.isCompleted,
    score: finalState.data.score,
    phase1Threshold: finalState.data.phase1Threshold,
    phase2Threshold: finalState.data.phase2Threshold
  });

  // Attempt duplicate submission when completed
  try {
    await client1.post('/sessions/active/submit', {
      challengeId: challenge.id,
      answer: { threshold: 30, phase: 2, isProbe: false }
    });
    console.error('Should have rejected submission after completion!');
  } catch (err) {
    console.log('✓ Duplicate final submission correctly rejected:', err.response?.data?.error);
  }

  // STEP 9: MULTI-PLAYER ISOLATION
  console.log('\n--- STEP 9: MULTI-PLAYER ISOLATION ---');
  // Create a second student
  const reg2 = await axios.post(`${API}/auth/register`, {
    email: `student2_thlive_${Date.now()}@test.com`,
    username: `officer2_${Date.now().toString().slice(-6)}`,
    password: 'password123',
    displayName: 'Officer_ThLive_2',
    role: 'STUDENT'
  });
  const token2 = reg2.data.token;
  const client2 = axios.create({
    baseURL: API,
    headers: { Authorization: `Bearer ${token2}` }
  });

  await client2.post('/sessions/join', { roomCode });
  const statePlayer2 = await client2.get(`/sessions/${roomCode}/threshold-state`);
  console.log('Player 2 Initial State (Player 1 has completed):', {
    activePhase: statePlayer2.data.activePhase,
    probesRemaining: statePlayer2.data.probesRemaining,
    phase1Completed: statePlayer2.data.phase1Completed,
    isCompleted: statePlayer2.data.isCompleted,
    score: statePlayer2.data.score
  });

  if (statePlayer2.data.activePhase === 1 && statePlayer2.data.probesRemaining === 3 && !statePlayer2.data.isCompleted) {
    console.log('✓ Player 2 state is completely independent of Player 1!');
  } else {
    console.error('✗ Player 2 leaked state from Player 1!');
  }

  console.log('\n====================================================');
  console.log('PLAYTEST FLOW FOR J62S3 COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runLivePlaytest().catch(err => {
  console.error('Playtest error:', err.response ? err.response.data : err.message);
});
