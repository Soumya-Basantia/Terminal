const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const API = 'http://localhost:3001/api';

const OP1_COLD_BOOT = {
  operationId: 'OP-01',
  scenarioTitle: 'OPERATION COLD BOOT: FACILITY INFILTRATION',
  missionBrief: 'Infiltrate the perimeter auxiliary substation. Power is restricted to 24V auxiliary bus. Route 480V three-phase power, calibrate optical fiber link, and decrypt access terminal to secure the forward staging outpost.',
  batteryCapacity: 40,
  initialState: {
    POWER_BUS: '24V_AUX',
    FIBER_LINK: 'OFFLINE',
    CIPHER_CORE: 'LOCKED',
    ACCESS_TERMINAL: 'UNAUTHENTICATED',
    COOLANT_LOOP: 'STABLE',
  },
  targetState: {
    ACCESS_TERMINAL: 'AUTHENTICATED',
  },
  actions: [
    {
      id: 'STEP_UP_TRANSFORMER',
      name: 'Step Up Substation Transformer',
      category: 'POWER',
      cost: 15,
      prerequisites: {},
      postconditions: { POWER_BUS: '480V_MAIN' },
      isIrreversible: false,
      description: 'Engages high-voltage coil switches to upgrade 24V auxiliary power to 480V industrial grid.',
    },
    {
      id: 'ALIGN_OPTICAL_FIBER',
      name: 'Calibrate Optical Link',
      category: 'NETWORK',
      cost: 10,
      prerequisites: { POWER_BUS: '480V_MAIN' },
      postconditions: { FIBER_LINK: 'ONLINE' },
      isIrreversible: false,
      description: 'Aligns laser collimator to the primary fiber trunk. Requires high-voltage power.',
    },
    {
      id: 'LOAD_CIPHER_KEYS',
      name: 'Inject Decryption Keys',
      category: 'CRYPTOGRAPHY',
      cost: 10,
      prerequisites: { FIBER_LINK: 'ONLINE' },
      postconditions: { CIPHER_CORE: 'READY' },
      isIrreversible: false,
      description: 'Streams one-time cryptographic pads across the verified optical line to prepare cipher core.',
    },
    {
      id: 'INITIALIZE_TERMINAL',
      name: 'Authenticate Staging Terminal',
      category: 'EXPLOITATION',
      cost: 5,
      prerequisites: { CIPHER_CORE: 'READY', POWER_BUS: '480V_MAIN' },
      postconditions: { ACCESS_TERMINAL: 'AUTHENTICATED' },
      isIrreversible: true,
      description: 'Submits decrypted handshake credentials to complete perimeter outpost infiltration.',
    },
    {
      id: 'VENT_COOLANT_LOOP',
      name: 'Vent Auxiliary Coolant',
      category: 'PHYSICAL',
      cost: 12,
      prerequisites: {},
      postconditions: { COOLANT_LOOP: 'VENTED' },
      isIrreversible: true,
      description: 'Purges auxiliary coolant line into sub-floor trench. Distraction maneuver.',
    },
  ],
  scoring: {
    baseCompletionPoints: 100,
    batteryEfficiencyMultiplier: 10,
    firstRunPrecisionBonus: 30,
    cleanSheetBonus: 20,
    retryPenalty: -15,
  },
};

async function main() {
  const ts = Date.now();
  const gmEmail = `director_${ts}@terminal.test`;
  const gmRes = await axios.post(`${API}/auth/register`, {
    email: gmEmail,
    username: `Director_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmUser = gmRes.data.user;
  const gmToken = gmRes.data.token;

  await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

  const studentEmail = `operative_${ts}@terminal.test`;
  const stRes = await axios.post(`${API}/auth/register`, {
    email: studentEmail,
    username: `Operative_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const studentToken = stRes.data.token;

  const gameRes = await axios.post(`${API}/games`, {
    name: 'SILENT MISSION // OPERATION TRITON',
    description: 'Autonomous sequence planning and tactical facility breach.',
    template: 'SILENT_MISSION',
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const game = gameRes.data.game;

  const op1Res = await axios.post(`${API}/games/${game.id}/challenges`, {
    prompt: OP1_COLD_BOOT.scenarioTitle,
    type: 'MISSION_PLAN',
    points: 100,
    timeLimit: 300,
    config: OP1_COLD_BOOT,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const challenge = op1Res.data.challenge;

  const eventRes = await axios.post(`${API}/events`, {
    name: 'SILENT MISSION // PLAYTEST EVENT',
    mode: 'SEQUENCE',
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const eventId = eventRes.data.id || eventRes.data.event?.id;

  await axios.post(`${API}/events/${eventId}/games`, {
    gameId: game.id,
    position: 0,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });

  await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
    headers: { Authorization: `Bearer ${gmToken}` },
  });

  const sessionRes = await axios.post(`${API}/sessions`, {
    eventId,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const session = sessionRes.data.session;
  const roomCode = session.roomCode;

  // Student join
  await axios.post(`${API}/sessions/join`, {
    roomCode,
  }, { headers: { Authorization: `Bearer ${studentToken}` } });

  // Activate round on session via Prisma
  await prisma.session.update({
    where: { id: session.id },
    data: {
      status: 'ROUND_ACTIVE',
      currentGameId: game.id,
      currentChallengeId: challenge.id,
      challengeStartTime: new Date(),
    },
  });

  console.log('PLAYTEST_SESSION_READY');
  console.log(JSON.stringify({
    roomCode,
    sessionId: session.id,
    gameId: game.id,
    challengeId: challenge.id,
    studentUsername: `Operative_${ts}`,
    studentEmail,
    password: 'password123',
    studentToken,
    playUrl: `http://localhost:5173/play`,
    stageUrl: `http://localhost:5173/stage/${roomCode}`,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err.response ? err.response.data : err.message);
  process.exit(1);
});
