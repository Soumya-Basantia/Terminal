const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

const THRESHOLD_CONFIG = {
  scenarioId: 'THRESHOLD-LIVE-01',
  scenarioTitle: 'THE THRESHOLD: NEURAL INGESTION CALIBRATION',
  missionBrief: 'Balance false alarms against catastrophic missed intrusions under distribution drift.',
  probeTokens: 3,
  costMatrix: {
    falseNegativeCost: 10000,
    falsePositiveCost: 500,
    maxIncidentBudget: 25000,
  },
  phase1Baseline: {
    benignDistribution: { mean: 32, stdDev: 10, count: 75 },
    criticalDistribution: { mean: 68, stdDev: 11, count: 25 },
    optimalThresholdRange: [50, 56],
  },
  phase2Shift: {
    benignDistribution: { mean: 28, stdDev: 9, count: 65 },
    criticalDistribution: { mean: 58, stdDev: 13, count: 35 },
    optimalThresholdRange: [42, 47],
    maxIncidentBudget: 35000,
    shiftNarrative: 'ADVERSARIAL CAMOUFLAGE DETECTED: Critical vector mean compressed leftward to 58.0.',
  },
};

async function prepare() {
  const ts = Date.now();
  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_thlive_${ts}@test.com`,
    username: `GM_Thresh_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmUser = gmRes.data.user;
  const gmToken = gmRes.data.token;
  await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

  const stRes = await axios.post(`${API}/auth/register`, {
    email: `student_thlive_${ts}@test.com`,
    username: `Officer_ThLive_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const studentUser = stRes.data.user;
  const studentToken = stRes.data.token;

  // Create game & challenge
  const gameRes = await axios.post(`${API}/games`, {
    name: 'THE THRESHOLD LIVE PLAYTEST',
    description: 'Classification Calibration Under Demographic Shift',
    template: 'THE_THRESHOLD',
    category: 'AI',
    config: THRESHOLD_CONFIG,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const gameId = gameRes.data.game.id;

  await axios.post(`${API}/games/${gameId}/challenges`, {
    prompt: 'Calibrate Autonomous Diagnostic Triage Matrix',
    type: 'THRESHOLD_CALIBRATION',
    points: 100,
    timeLimit: 120,
    config: THRESHOLD_CONFIG,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });

  await axios.post(`${API}/games/${gameId}/publish`, {}, {
    headers: { Authorization: `Bearer ${gmToken}` },
  });

  const eventRes = await axios.post(`${API}/events`, {
    name: `THRESHOLD EVENT ${ts}`,
    mode: 'GM_CONTROLLED',
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const eventId = eventRes.data.event?.id || eventRes.data.id;

  await axios.post(`${API}/events/${eventId}/games`, {
    gameId,
    position: 0,
    purpose: 'NORMAL',
  }, { headers: { Authorization: `Bearer ${gmToken}` } });

  await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
    headers: { Authorization: `Bearer ${gmToken}` }
  });

  const sessionRes = await axios.post(`${API}/sessions`, {
    eventId,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const session = sessionRes.data.session;
  const roomCode = session.roomCode;

  // Student joins
  await axios.post(`${API}/sessions/join`, { roomCode }, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });

  // Host starts round
  await axios.post(`${API}/sessions/${roomCode}/start`, {}, {
    headers: { Authorization: `Bearer ${gmToken}` },
  });

  const info = {
    roomCode,
    studentUser: studentUser.username,
    studentEmail: studentUser.email,
    password: 'password123',
    studentToken,
  };
  fs.writeFileSync('threshold_playtest_session.json', JSON.stringify(info, null, 2));
  console.log('Playtest session prepared successfully:', info);
  await prisma.$disconnect();
}

prepare().catch(err => {
  console.error(err.response?.data || err);
  process.exit(1);
});
