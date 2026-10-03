const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

const CURATED_EVENTS = [
  { id: 'EVT-01', timestamp: '03:00:12', sourceNode: 'worker-01', targetNode: 'storage-gateway', protocol: 'HTTPS', payloadSizeMb: 1.2, latencyMs: 45, status: 'SUCCESS' },
  { id: 'EVT-02', timestamp: '03:01:05', sourceNode: 'worker-03', targetNode: 'db-replica-01', protocol: 'DB_SYNC', payloadSizeMb: 4.8, latencyMs: 120, status: 'SUCCESS' },
  { id: 'EVT-03', timestamp: '03:02:40', sourceNode: 'worker-02', targetNode: 'auth-gateway', protocol: 'GRPC', payloadSizeMb: 0.1, latencyMs: 12, status: 'SUCCESS' },
  { id: 'EVT-04', timestamp: '03:03:15', sourceNode: 'worker-05', targetNode: 'storage-gateway', protocol: 'GCS', payloadSizeMb: 14.5, latencyMs: 310, status: 'SUCCESS' },
  { id: 'EVT-05', timestamp: '03:05:00', sourceNode: 'worker-04', targetNode: 'metrics-sink', protocol: 'WEBSOCKET', payloadSizeMb: 0.8, latencyMs: 25, status: 'SUCCESS' },
  { id: 'EVT-06', timestamp: '03:06:22', sourceNode: 'worker-01', targetNode: 'vpc-connector', protocol: 'HTTPS', payloadSizeMb: 2.1, latencyMs: 55, status: 'SUCCESS' },
  { id: 'EVT-07', timestamp: '03:07:45', sourceNode: 'worker-06', targetNode: 'db-replica-01', protocol: 'DB_SYNC', payloadSizeMb: 3.9, latencyMs: 95, status: 'SUCCESS' },
  // False Positive 1: Giant Spike
  { id: 'EVT-08', timestamp: '03:08:30', sourceNode: 'backup-agent-01', targetNode: 'storage-gateway', protocol: 'GCS', payloadSizeMb: 92.4, latencyMs: 1850, status: 'SUCCESS', traceDetails: { processName: 'slurm-backup-daemon', verifiedSource: 'Cold Storage Archive Backup (Task #8942)', notes: 'Verified routine scheduled batch. Approved storage policy.' } },
  { id: 'EVT-09', timestamp: '03:09:50', sourceNode: 'worker-02', targetNode: 'metrics-sink', protocol: 'WEBSOCKET', payloadSizeMb: 0.5, latencyMs: 18, status: 'SUCCESS' },
  { id: 'EVT-10', timestamp: '03:10:14', sourceNode: 'worker-03', targetNode: 'storage-gateway', protocol: 'HTTPS', payloadSizeMb: 0.9, latencyMs: 35, status: 'SUCCESS' },
  // Rogue Event 1: Automated Beacon (Period = 600s, Identical payload, unmapped relay)
  { id: 'EVT-11', timestamp: '03:12:00', sourceNode: 'worker-08', targetNode: 'ext-staging-relay', protocol: 'HTTPS', payloadSizeMb: 0.24, latencyMs: 42, status: 'SUCCESS', isRogue: true, traceDetails: { processName: 'kworker_anon_egress', verifiedSource: 'Orphaned daemon process spawn (PID 40912)', notes: 'Unlisted external staging relay endpoint. Abnormal parent PID hierarchy.' } },
  { id: 'EVT-12', timestamp: '03:13:22', sourceNode: 'worker-07', targetNode: 'auth-gateway', protocol: 'GRPC', payloadSizeMb: 0.1, latencyMs: 15, status: 'SUCCESS' },
  { id: 'EVT-13', timestamp: '03:14:05', sourceNode: 'worker-01', targetNode: 'db-replica-02', protocol: 'DB_SYNC', payloadSizeMb: 5.2, latencyMs: 130, status: 'SUCCESS' },
  // False Positive 2: Auth Cascade
  { id: 'EVT-14', timestamp: '03:15:10', sourceNode: 'auth-gateway', targetNode: 'worker-05', protocol: 'GRPC', payloadSizeMb: 0.05, latencyMs: 8, status: 'ERROR', traceDetails: { processName: 'kerberos-kdc-refresh', verifiedSource: 'Kerberos Auth Ticket Renewal Cascade (Auth Gateway #4)', notes: 'Known ticket rotation retry wave. Benign expired service credential renewal.' } },
  { id: 'EVT-15', timestamp: '03:16:30', sourceNode: 'worker-04', targetNode: 'storage-gateway', protocol: 'GCS', payloadSizeMb: 18.2, latencyMs: 410, status: 'SUCCESS' },
  { id: 'EVT-16', timestamp: '03:18:00', sourceNode: 'worker-02', targetNode: 'vpc-connector', protocol: 'HTTPS', payloadSizeMb: 1.7, latencyMs: 62, status: 'SUCCESS' },
  // Rogue Event 2: Automated Beacon (03:22:00 = exactly 600s after 03:12:00, identical 0.24 MB, same unmapped relay)
  { id: 'EVT-17', timestamp: '03:22:00', sourceNode: 'worker-08', targetNode: 'ext-staging-relay', protocol: 'HTTPS', payloadSizeMb: 0.24, latencyMs: 44, status: 'SUCCESS', isRogue: true, traceDetails: { processName: 'kworker_anon_egress', verifiedSource: 'Orphaned daemon process spawn (PID 40912)', notes: 'Repeated micro-payload to unmapped staging relay. Exact clockwork cadence.' } },
  { id: 'EVT-18', timestamp: '03:23:45', sourceNode: 'worker-03', targetNode: 'metrics-sink', protocol: 'WEBSOCKET', payloadSizeMb: 0.7, latencyMs: 22, status: 'SUCCESS' },
  // False Positive 3: Latency Freeze
  { id: 'EVT-19', timestamp: '03:24:12', sourceNode: 'worker-12', targetNode: 'compute-scheduler', protocol: 'GRPC', payloadSizeMb: 0.3, latencyMs: 12400, status: 'SUCCESS', traceDetails: { processName: 'triton-gpu-compile', verifiedSource: 'Triton JIT Kernel Compilation Stall (Worker node-12)', notes: 'First-touch GPU shader warmup compilation. Single long stall, benign engine warmup.' } },
  { id: 'EVT-20', timestamp: '03:26:00', sourceNode: 'worker-06', targetNode: 'storage-gateway', protocol: 'HTTPS', payloadSizeMb: 3.1, latencyMs: 78, status: 'SUCCESS' },
  { id: 'EVT-21', timestamp: '03:27:30', sourceNode: 'worker-01', targetNode: 'db-replica-01', protocol: 'DB_SYNC', payloadSizeMb: 6.4, latencyMs: 155, status: 'SUCCESS' },
  { id: 'EVT-22', timestamp: '03:29:10', sourceNode: 'worker-05', targetNode: 'vpc-connector', protocol: 'HTTPS', payloadSizeMb: 1.5, latencyMs: 50, status: 'SUCCESS' },
];

const SCANNER_CONFIG = {
  scenarioTitle: 'OPERATION PHANTOM CADENCE: TELEMETRY FORENSICS',
  missionBrief: 'AIERA cluster telemetry detected an active covert channel. 22 events captured. Discover the rogue beacon while avoiding benign operational false positives.',
  actionBudget: 15,
  events: CURATED_EVENTS,
  anomalousEventIds: ['EVT-11', 'EVT-17'],
  anomalyMechanism: 'PERIODIC_BEACON',
  baseline: {
    expectedProtocols: ['HTTPS', 'GCS', 'GRPC', 'WEBSOCKET', 'DB_SYNC'],
    registeredNodes: ['worker-01', 'worker-02', 'worker-03', 'worker-04', 'worker-05', 'worker-06', 'worker-07', 'worker-08', 'worker-12', 'backup-agent-01'],
    knownExternalRelays: ['storage-gateway', 'vpc-connector', 'auth-gateway', 'metrics-sink', 'db-replica-01', 'db-replica-02'],
    protocols: {
      HTTPS: { normalRangeMb: [0.1, 10.0], normalLatencyMs: [10, 200] },
      GCS: { normalRangeMb: [0.5, 100.0], normalLatencyMs: [50, 2000] },
      GRPC: { normalRangeMb: [0.01, 1.0], normalLatencyMs: [5, 15000] }
    }
  },
  scoring: {
    basePoints: 100,
    corroboratingBonus: 30,
    tokenBonusPerUnit: 10,
    cleanSheetBonus: 20,
    incorrectPenalty: -40
  }
};

async function main() {
  const timestamp = Date.now();
  const gmEmail = `gm_${timestamp}@test.com`;
  const studentEmail = `student_${timestamp}@test.com`;
  const studentUsername = `analyst_${timestamp.toString().slice(-4)}`;

  // Register GM
  await axios.post(`${API}/auth/register`, {
    email: gmEmail,
    username: `gm_${timestamp.toString().slice(-4)}`,
    password: 'password123'
  });
  const gmLogin = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
  const gmToken = gmLogin.data.token;
  const gmId = gmLogin.data.user.id;
  await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });

  // Register Playtester Student
  await axios.post(`${API}/auth/register`, {
    email: studentEmail,
    username: studentUsername,
    password: 'password123'
  });
  const studLogin = await axios.post(`${API}/auth/login`, { email: studentEmail, password: 'password123' });
  const studentToken = studLogin.data.token;
  const studentId = studLogin.data.user.id;

  // Create Game
  const gameRes = await axios.post(`${API}/games`, {
    name: 'Operation Phantom Cadence: Rogue Scanner',
    description: 'AIERA cluster telemetry anomaly forensics',
    template: 'ROGUE_SCANNER'
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const gameId = gameRes.data.game.id;

  // Create Challenge
  const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
    type: 'TELEMETRY_ANOMALY',
    prompt: SCANNER_CONFIG.missionBrief,
    points: 100,
    timeLimit: 600,
    config: SCANNER_CONFIG
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const challengeId = chalRes.data.challenge.id;

  // Create Event
  const eventRes = await axios.post(`${API}/events`, {
    name: 'AIERA Forensics Live Playtest',
    mode: 'SEQUENCE'
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const eventId = eventRes.data.id || eventRes.data.event?.id;

  await axios.post(`${API}/events/${eventId}/games`, {
    gameId,
    position: 0
  }, { headers: { Authorization: `Bearer ${gmToken}` } });

  await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
    headers: { Authorization: `Bearer ${gmToken}` }
  });

  // Create Session
  const sessionRes = await axios.post(`${API}/sessions`, {
    eventId
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const roomCode = sessionRes.data.session?.roomCode || sessionRes.data.roomCode;
  const sessionId = sessionRes.data.session?.id || sessionRes.data.id;

  // Student Joins
  await axios.post(`${API}/sessions/join`, { roomCode }, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });

  // Host starts session into ROUND_ACTIVE
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'ROUND_ACTIVE',
      currentGameId: gameId,
      currentChallengeId: challengeId,
      challengeStartTime: new Date(),
    }
  });

  console.log("==================================================");
  console.log("ROGUE_SCANNER PLAYTEST SESSION READY");
  console.log("==================================================");
  console.log(`Room Code: ${roomCode}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Challenge ID: ${challengeId}`);
  console.log(`Student Username: ${studentUsername}`);
  console.log(`Student Email: ${studentEmail}`);
  console.log(`Student Password: password123`);
  console.log(`Student User ID: ${studentId}`);
  console.log(`Student Play URL: http://localhost:5173/play`);
  console.log(`Stage Spectator URL: http://localhost:5173/stage/${roomCode}`);
  console.log("==================================================");

  fs.writeFileSync('playtest_session.json', JSON.stringify({
    roomCode,
    sessionId,
    challengeId,
    gmToken,
    studentToken,
    studentId,
    studentUsername,
    studentEmail,
    password: 'password123',
    playUrl: 'http://localhost:5173/play',
    stageUrl: `http://localhost:5173/stage/${roomCode}`
  }, null, 2));
}

main().catch(err => {
  console.error("Error creating playtest session:", err.response?.data || err.message);
  process.exit(1);
});
