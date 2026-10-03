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
  probeTokens: 3,
  scoring: {
    basePoints: 100,
    optimalBonus: 50,
    zeroLossBonus: 30,
  },
};

async function testClientFlow() {
  console.log('--- RUNNING CLIENT FLOW SIMULATION ---');
  const ts = Date.now();

  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_cf_${ts}@test.com`,
    username: `GM_CF_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmToken = gmRes.data.token;
  await prisma.user.update({ where: { id: gmRes.data.user.id }, data: { role: 'SUPER_ADMIN' } });

  const stRes = await axios.post(`${API}/auth/register`, {
    email: `student_cf_${ts}@test.com`,
    username: `Student_CF_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const stToken = stRes.data.token;

  const gameRes = await axios.post(`${API}/games`, {
    name: 'CLIENT FLOW GAME',
    template: 'THE_THRESHOLD',
    category: 'AI',
    config: SAMPLE_CONFIG,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const game = gameRes.data.game;

  const chalRes = await axios.post(`${API}/games/${game.id}/challenges`, {
    prompt: 'Calibrate risk threshold for cardiac triage.',
    type: 'THRESHOLD_CALIBRATION',
    points: 100,
    timeLimit: 120,
    config: SAMPLE_CONFIG,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const challenge = chalRes.data.challenge;
  await axios.post(`${API}/games/${game.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  const eventRes = await axios.post(`${API}/events`, {
    name: `Client Flow Event ${ts}`,
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

  const sessionRes = await axios.post(`${API}/sessions`, {
    eventId: event.id,
    roomCode: `CF${String(ts).slice(-4)}`,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const session = sessionRes.data.session || sessionRes.data;
  const roomCode = session.roomCode;

  await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${stToken}` } });
  await axios.post(`${API}/sessions/${roomCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  // 1. Initial State Load (Component Mount)
  const initialMountState = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
    headers: { Authorization: `Bearer ${stToken}` },
  });
  console.log('1. Component Mount State:', {
    activePhase: initialMountState.data.activePhase,
    probesRemaining: initialMountState.data.probesRemaining,
    scenarioId: initialMountState.data.scenarioId,
  });

  // 2. Client sends Canary Probe at T = 52
  const probeRes = await axios.post(`${API}/sessions/active/submit`, {
    challengeId: challenge.id,
    answer: { threshold: 52, phase: 1, isProbe: true },
  }, { headers: { Authorization: `Bearer ${stToken}` } });
  console.log('2. Canary Probe Result:', {
    isProbe: probeRes.data.isProbe,
    probesRemaining: probeRes.data.probesRemaining,
    matrix: probeRes.data.confusionMatrix,
    loss: probeRes.data.totalLoss,
  });

  // 3. Client commits Phase 1 at T = 53
  const p1Commit = await axios.post(`${API}/sessions/active/submit`, {
    challengeId: challenge.id,
    answer: { threshold: 53, phase: 1, isProbe: false },
  }, { headers: { Authorization: `Bearer ${stToken}` } });
  console.log('3. Phase 1 Calibration Result:', {
    phase1Completed: p1Commit.data.submission?.metadata?.phase1Completed,
    activePhase: p1Commit.data.submission?.metadata?.activePhase,
  });

  // 4. Simulate Page Refresh / Reconnect
  const refreshState = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
    headers: { Authorization: `Bearer ${stToken}` },
  });
  console.log('4. Reconnect State Recovery:', {
    activePhase: refreshState.data.activePhase,
    phase1Completed: refreshState.data.phase1Completed,
    phase1Threshold: refreshState.data.phase1Threshold,
    phase1Cost: refreshState.data.phase1Cost,
  });

  // 5. Client commits Phase 2 at T = 25
  const p2Commit = await axios.post(`${API}/sessions/active/submit`, {
    challengeId: challenge.id,
    answer: { threshold: 25, phase: 2, isProbe: false },
  }, { headers: { Authorization: `Bearer ${stToken}` } });
  console.log('5. Phase 2 Final Result:', {
    isCorrect: p2Commit.data.isCorrect,
    pointsAwarded: p2Commit.data.pointsAwarded,
    isCompleted: p2Commit.data.submission?.metadata?.phase2Completed,
  });

  // Clean up
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.sessionPlayer.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.eventGame.deleteMany({ where: { eventId: event.id } });
  await prisma.event.delete({ where: { id: event.id } });
  await prisma.challenge.delete({ where: { id: challenge.id } });
  await prisma.game.delete({ where: { id: game.id } });
  await prisma.user.deleteMany({ where: { id: { in: [gmRes.data.user.id, stRes.data.user.id] } } });

  console.log('--- CLIENT FLOW SIMULATION COMPLETE ✓ ---');
  await prisma.$disconnect();
}

testClientFlow().catch(err => {
  console.error('Flow error:', err.response?.data || err.message);
  prisma.$disconnect();
  process.exit(1);
});
