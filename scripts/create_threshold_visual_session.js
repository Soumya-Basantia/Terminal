const axios = require('axios');
const fs = require('fs');

const API = 'http://localhost:3001/api';

const THRESHOLD_CONFIG = {
  scenarioId: 'THRESHOLD-UI-VISUAL',
  scenarioTitle: 'OPERATION SENTINEL TRIAGE: ACUTE CARDIAC ISCHEMIA',
  system: 'Apex Emergency Triage Network',
  missionBrief: 'Calibrate the diagnostic risk threshold for acute ischemia alerts under asymmetric loss.',
  probeTokens: 3,
  costMatrix: {
    falsePositiveCost: 500,
    falseNegativeCost: 10000,
    maxIncidentBudget: 25000,
  },
  phase1Baseline: {
    populationName: 'Standard Municipal Admissions (N=100)',
    benignDistribution: {
      label: 'Benign (Non-Ischemic Chest Pain)',
      count: 75,
      mean: 32,
      stdDev: 12,
    },
    criticalDistribution: {
      label: 'Critical (Acute Myocardial Infarction)',
      count: 25,
      mean: 68,
      stdDev: 10,
    },
    optimalThresholdRange: [48, 56],
  },
  phase2Shift: {
    shiftName: 'Geriatric Sub-Cohort Surge (Distribution Drift)',
    benignDistribution: {
      label: 'Shifted Benign (Elderly Baseline Troponin Elevation)',
      count: 70,
      mean: 42,
      stdDev: 14,
    },
    criticalDistribution: {
      label: 'Shifted Critical (Atypical Presentation Blunted Response)',
      count: 30,
      mean: 54,
      stdDev: 12,
    },
    optimalThresholdRange: [24, 30],
    maxIncidentBudget: 35000,
  },
  scoring: {
    basePoints: 100,
    optimalBonus: 50,
    zeroLossBonus: 30,
    cleanSheetBonus: 20,
    unusedProbeBonus: 10,
    shiftResilienceBonus: 30,
    retryPenalty: -15,
  },
};

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ts = Date.now();
  // Register GM
  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_vis_${ts}@terminal.test`,
    username: `Director_Vis_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmToken = gmRes.data.token;
  const gmUser = gmRes.data.user;
  await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

  // Register Student
  const sRes = await axios.post(`${API}/auth/register`, {
    email: `student_vis_${ts}@terminal.test`,
    username: `Officer_Vis_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const studentUser = sRes.data.user;
  const studentToken = sRes.data.token;

  // Create Game
  const gameRes = await axios.post(`${API}/games`, {
    name: 'OPERATION SENTINEL TRIAGE',
    description: 'Visual Inspection Game',
    template: 'THE_THRESHOLD',
    category: 'AI',
    config: THRESHOLD_CONFIG,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const game = gameRes.data.game;

  // Create Challenge
  const chalRes = await axios.post(`${API}/games/${game.id}/challenges`, {
    prompt: 'Calibrate risk cutoff threshold for emergency admissions.',
    type: 'THRESHOLD_CALIBRATION',
    points: 100,
    timeLimit: 600,
    config: THRESHOLD_CONFIG,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const challenge = chalRes.data.challenge;

  // Publish
  await axios.post(`${API}/games/${game.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  // Event
  const eventRes = await axios.post(`${API}/events`, {
    name: `Visual Pass Event ${ts}`,
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

  // Session
  const sessRes = await axios.post(`${API}/sessions`, {
    eventId: event.id,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const roomCode = sessRes.data.session?.roomCode || sessRes.data.roomCode;

  // Join Student
  await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${studentToken}` } });

  // Start round
  await axios.post(`${API}/sessions/${roomCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  const output = {
    roomCode,
    studentUser: studentUser.username,
    studentEmail: studentUser.email,
    password: 'password123',
    studentToken,
    url: `http://localhost:5173/play/${roomCode}`,
  };

  fs.writeFileSync('visual_session.json', JSON.stringify(output, null, 2));
  console.log('Visual test session created:');
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Error creating visual session:', err.response?.data || err.message);
  process.exit(1);
});
