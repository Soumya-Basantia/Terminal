const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

const SAMPLE_CONFIG = {
  scenarioId: 'THRESHOLD-OP-01',
  scenarioTitle: 'OPERATION SENTINEL TRIAGE: ACUTE CARDIAC ISCHEMIA',
  system: 'Apex Emergency Triage Network',
  missionBrief: 'Calibrate the diagnostic risk threshold for acute ischemia alerts.',
  costMatrix: {
    falseNegativeCost: 10000,
    falsePositiveCost: 500,
    maxIncidentBudget: 25000,
  },
  phase1Baseline: {
    populationName: 'Standard Municipal Admissions (N=100)',
    benignDistribution: { mean: 32, stdDev: 10, count: 75 },
    criticalDistribution: { mean: 68, stdDev: 11, count: 25 },
    optimalThresholdRange: [50, 56],
  },
  phase2Shift: {
    shiftName: 'Geriatric Sub-Cohort Surge (Distribution Drift)',
    benignDistribution: { mean: 42, stdDev: 12, count: 60 },
    criticalDistribution: { mean: 54, stdDev: 12, count: 40 },
    maxIncidentBudget: 35000,
    optimalThresholdRange: [22, 28],
  },
  probeTokens: 2,
  scoring: {
    basePoints: 100,
    optimalBonus: 50,
    zeroLossBonus: 30,
  },
};

async function run() {
  console.log('--- STARTING THE_THRESHOLD STEP 2 VERIFICATION ---');
  const ts = Date.now();

  // 1. Auth setup
  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_th_${ts}@test.com`,
    username: `GM_Th_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmToken = gmRes.data.token;
  await prisma.user.update({ where: { id: gmRes.data.user.id }, data: { role: 'SUPER_ADMIN' } });

  const stRes = await axios.post(`${API}/auth/register`, {
    email: `student_th_${ts}@test.com`,
    username: `Student_Th_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const stToken = stRes.data.token;

  // 2. Create game & challenge
  const gameRes = await axios.post(
    `${API}/games`,
    {
      name: 'OPERATION THRESHOLD TEST',
      template: 'THE_THRESHOLD',
      category: 'AI',
      config: SAMPLE_CONFIG,
    },
    { headers: { Authorization: `Bearer ${gmToken}` } }
  );
  const game = gameRes.data.game;

  const chalRes = await axios.post(
    `${API}/games/${game.id}/challenges`,
    {
      prompt: 'Calibrate risk threshold for cardiac triage.',
      type: 'THRESHOLD_CALIBRATION',
      points: 100,
      timeLimit: 120,
      config: SAMPLE_CONFIG,
    },
    { headers: { Authorization: `Bearer ${gmToken}` } }
  );
  const challenge = chalRes.data.challenge;
  await axios.post(`${API}/games/${game.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  // Create Event
  const eventRes = await axios.post(`${API}/events`, {
    name: `Threshold Championship ${ts}`,
    mode: 'GM_CONTROLLED',
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const event = eventRes.data.event || eventRes.data;

  await axios.post(`${API}/events/${event.id}/games`, {
    gameId: game.id,
    position: 0,
    purpose: 'NORMAL',
  }, { headers: { Authorization: `Bearer ${gmToken}` } });

  await axios.put(`${API}/events/${event.id}`, { status: 'PUBLISHED' }, {
    headers: { Authorization: `Bearer ${gmToken}` }
  });

  // 3. Start Session & Enroll Student
  const sessionRes = await axios.post(
    `${API}/sessions`,
    { eventId: event.id, roomCode: `TH${String(ts).slice(-4)}` },
    { headers: { Authorization: `Bearer ${gmToken}` } }
  );
  const session = sessionRes.data.session || sessionRes.data;
  const roomCode = session.roomCode;

  await axios.post(
    `${API}/sessions/join`,
    { roomCode },
    { headers: { Authorization: `Bearer ${stToken}` } }
  );

  await axios.post(
    `${API}/sessions/${roomCode}/start`,
    {},
    { headers: { Authorization: `Bearer ${gmToken}` } }
  );

  console.log('✓ Session initialized and round active.');

  // Test 1: Invalid threshold rejection (< 0 or > 100)
  try {
    await axios.post(
      `${API}/sessions/active/submit`,
      { challengeId: challenge.id, answer: { threshold: 150, phase: 1, isProbe: true } },
      { headers: { Authorization: `Bearer ${stToken}` } }
    );
    console.error('FAIL: Invalid threshold > 100 was accepted');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('✓ PASS: Invalid threshold rejected with 400.');
    } else {
      throw err;
    }
  }

  // Test 2: Phase 2 before Phase 1 completion rejection
  try {
    await axios.post(
      `${API}/sessions/active/submit`,
      { challengeId: challenge.id, answer: { threshold: 45, phase: 2, isProbe: false } },
      { headers: { Authorization: `Bearer ${stToken}` } }
    );
    console.error('FAIL: Phase 2 allowed before Phase 1 completion');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 400 && err.response.data.error.includes('Phase 1')) {
      console.log('✓ PASS: Phase 2 before Phase 1 rejected with 400.');
    } else {
      throw err;
    }
  }

  // Test 3: Valid Phase 1 probe
  const probe1 = await axios.post(
    `${API}/sessions/active/submit`,
    { challengeId: challenge.id, answer: { threshold: 52, phase: 1, isProbe: true } },
    { headers: { Authorization: `Bearer ${stToken}` } }
  );
  if (probe1.data.isProbe && probe1.data.probesRemaining === 1 && probe1.data.confusionMatrix) {
    console.log(`✓ PASS: Valid Phase 1 probe returned telemetry (TP:${probe1.data.confusionMatrix.tp}, FP:${probe1.data.confusionMatrix.fp}, Loss:$${probe1.data.totalLoss}, ProbesLeft:${probe1.data.probesRemaining}).`);
  } else {
    console.error('FAIL: Probe 1 response malformed', probe1.data);
    process.exit(1);
  }

  // Test 4: Consume probe 2 & check Probe Exhaustion
  const probe2 = await axios.post(
    `${API}/sessions/active/submit`,
    { challengeId: challenge.id, answer: { threshold: 60, phase: 1, isProbe: true } },
    { headers: { Authorization: `Bearer ${stToken}` } }
  );
  if (probe2.data.probesRemaining === 0) {
    console.log('✓ PASS: Second probe consumed, 0 tokens remaining.');
  }

  try {
    await axios.post(
      `${API}/sessions/active/submit`,
      { challengeId: challenge.id, answer: { threshold: 50, phase: 1, isProbe: true } },
      { headers: { Authorization: `Bearer ${stToken}` } }
    );
    console.error('FAIL: Probe allowed after tokens exhausted');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 400 && err.response.data.error.includes('probe tokens')) {
      console.log('✓ PASS: Probe token exhaustion enforced.');
    } else {
      throw err;
    }
  }

  // Test 5: Reconnect / State Recovery (GET /threshold-state)
  const stateRes = await axios.get(
    `${API}/sessions/${roomCode}/threshold-state`,
    { headers: { Authorization: `Bearer ${stToken}` } }
  );
  if (stateRes.data.activePhase === 1 && stateRes.data.probesRemaining === 0 && !stateRes.data.phase1Completed) {
    console.log('✓ PASS: GET /threshold-state restored active state on reconnect.');
  } else {
    console.error('FAIL: Threshold state restoration mismatch', stateRes.data);
    process.exit(1);
  }

  // Test 6: Unauthorized access to /threshold-state
  try {
    await axios.get(`${API}/sessions/${roomCode}/threshold-state`);
    console.error('FAIL: Unauthenticated threshold-state request succeeded');
    process.exit(1);
  } catch (err) {
    if (err.response?.status === 401) {
      console.log('✓ PASS: Unauthorized access blocked with 401.');
    } else {
      throw err;
    }
  }

  // Test 7: Valid Phase 1 Commit
  const p1Commit = await axios.post(
    `${API}/sessions/active/submit`,
    { challengeId: challenge.id, answer: { threshold: 53, phase: 1, isProbe: false } },
    { headers: { Authorization: `Bearer ${stToken}` } }
  );
  if (!p1Commit.data.isCorrect && p1Commit.data.isThreshold) {
    // Note: isCorrect is false because Phase 2 is required!
    console.log('✓ PASS: Phase 1 calibrated within budget; Phase 2 unlocked.');
  }

  // Verify Phase 2 is now active in state
  const stateAfterP1 = await axios.get(
    `${API}/sessions/${roomCode}/threshold-state`,
    { headers: { Authorization: `Bearer ${stToken}` } }
  );
  if (stateAfterP1.data.activePhase === 2 && stateAfterP1.data.phase1Completed && stateAfterP1.data.phase1Threshold === 53) {
    console.log('✓ PASS: State confirms activePhase = 2 with phase1Completed = true.');
  } else {
    console.error('FAIL: State after Phase 1 invalid', stateAfterP1.data);
    process.exit(1);
  }

  // Test 8: Valid Phase 2 Commit & Final Server-Authoritative Evaluation
  const p2Commit = await axios.post(
    `${API}/sessions/active/submit`,
    { challengeId: challenge.id, answer: { threshold: 25, phase: 2, isProbe: false } },
    { headers: { Authorization: `Bearer ${stToken}` } }
  );
  if (p2Commit.data.isCorrect && p2Commit.data.pointsAwarded > 0) {
    console.log(`✓ PASS: Phase 2 calibrated successfully. Final Score: ${p2Commit.data.pointsAwarded} points.`);
  } else {
    console.error('FAIL: Final Phase 2 commit failed', p2Commit.data);
    process.exit(1);
  }

  // Clean up test data
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.sessionPlayer.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.eventGame.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });
  await prisma.challenge.delete({ where: { id: challenge.id } });
  await prisma.game.delete({ where: { id: game.id } });
  await prisma.user.deleteMany({ where: { id: { in: [gmRes.data.user.id, stRes.data.user.id] } } });

  console.log('\n==================================================');
  console.log('ALL STEP 2 VERIFICATION CHECKS PASSED SUCCESSFULLY! ✓');
  console.log('==================================================');
  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Verification error:', err.response?.data || err.message);
  prisma.$disconnect();
  process.exit(1);
});
