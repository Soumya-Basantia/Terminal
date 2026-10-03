const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

const CURATED_EVENTS = [
  { id: 'EVT-01', timestamp: '03:00:12', sourceNode: 'worker-01', targetNode: 'storage-gateway', protocol: 'HTTPS', payloadSizeMb: 1.2, latencyMs: 45, status: 'SUCCESS' },
  { id: 'EVT-02', timestamp: '03:01:05', sourceNode: 'worker-03', targetNode: 'db-replica-01', protocol: 'DB_SYNC', payloadSizeMb: 4.8, latencyMs: 120, status: 'SUCCESS' },
  { id: 'EVT-03', timestamp: '03:02:40', sourceNode: 'worker-02', targetNode: 'auth-gateway', protocol: 'GRPC', payloadSizeMb: 0.1, latencyMs: 12, status: 'SUCCESS' },
  { id: 'EVT-04', timestamp: '03:03:15', sourceNode: 'worker-05', targetNode: 'storage-gateway', protocol: 'GCS', payloadSizeMb: 14.5, latencyMs: 310, status: 'SUCCESS' },
  { id: 'EVT-05', timestamp: '03:05:00', sourceNode: 'worker-04', targetNode: 'metrics-sink', protocol: 'WEBSOCKET', payloadSizeMb: 0.8, latencyMs: 25, status: 'SUCCESS' },
  { id: 'EVT-06', timestamp: '03:06:22', sourceNode: 'worker-01', targetNode: 'vpc-connector', protocol: 'HTTPS', payloadSizeMb: 2.1, latencyMs: 55, status: 'SUCCESS' },
  { id: 'EVT-07', timestamp: '03:07:45', sourceNode: 'worker-06', targetNode: 'db-replica-01', protocol: 'DB_SYNC', payloadSizeMb: 3.9, latencyMs: 95, status: 'SUCCESS' },
  { id: 'EVT-08', timestamp: '03:08:30', sourceNode: 'backup-agent-01', targetNode: 'storage-gateway', protocol: 'GCS', payloadSizeMb: 92.4, latencyMs: 1850, status: 'SUCCESS', traceDetails: { processName: 'slurm-backup-daemon', verifiedSource: 'Cold Storage Archive Backup (Task #8942)', notes: 'Verified routine scheduled batch. Approved storage policy.' } },
  { id: 'EVT-09', timestamp: '03:09:50', sourceNode: 'worker-02', targetNode: 'metrics-sink', protocol: 'WEBSOCKET', payloadSizeMb: 0.5, latencyMs: 18, status: 'SUCCESS' },
  { id: 'EVT-10', timestamp: '03:10:14', sourceNode: 'worker-03', targetNode: 'storage-gateway', protocol: 'HTTPS', payloadSizeMb: 0.9, latencyMs: 35, status: 'SUCCESS' },
  { id: 'EVT-11', timestamp: '03:12:00', sourceNode: 'worker-08', targetNode: 'ext-staging-relay', protocol: 'HTTPS', payloadSizeMb: 0.24, latencyMs: 42, status: 'SUCCESS', isRogue: true, traceDetails: { processName: 'kworker_anon_egress', verifiedSource: 'Orphaned daemon process spawn (PID 40912)', notes: 'Unlisted external staging relay endpoint. Abnormal parent PID hierarchy.' } },
  { id: 'EVT-12', timestamp: '03:13:22', sourceNode: 'worker-07', targetNode: 'auth-gateway', protocol: 'GRPC', payloadSizeMb: 0.1, latencyMs: 15, status: 'SUCCESS' },
  { id: 'EVT-13', timestamp: '03:14:05', sourceNode: 'worker-01', targetNode: 'db-replica-02', protocol: 'DB_SYNC', payloadSizeMb: 5.2, latencyMs: 130, status: 'SUCCESS' },
  { id: 'EVT-14', timestamp: '03:15:10', sourceNode: 'auth-gateway', targetNode: 'worker-05', protocol: 'GRPC', payloadSizeMb: 0.05, latencyMs: 8, status: 'ERROR', traceDetails: { processName: 'kerberos-kdc-refresh', verifiedSource: 'Kerberos Auth Ticket Renewal Cascade (Auth Gateway #4)', notes: 'Known ticket rotation retry wave. Benign expired service credential renewal.' } },
  { id: 'EVT-15', timestamp: '03:16:30', sourceNode: 'worker-04', targetNode: 'storage-gateway', protocol: 'GCS', payloadSizeMb: 18.2, latencyMs: 410, status: 'SUCCESS' },
  { id: 'EVT-16', timestamp: '03:18:00', sourceNode: 'worker-02', targetNode: 'vpc-connector', protocol: 'HTTPS', payloadSizeMb: 1.7, latencyMs: 62, status: 'SUCCESS' },
  { id: 'EVT-17', timestamp: '03:22:00', sourceNode: 'worker-08', targetNode: 'ext-staging-relay', protocol: 'HTTPS', payloadSizeMb: 0.24, latencyMs: 44, status: 'SUCCESS', isRogue: true, traceDetails: { processName: 'kworker_anon_egress', verifiedSource: 'Orphaned daemon process spawn (PID 40912)', notes: 'Repeated micro-payload to unmapped staging relay. Exact clockwork cadence.' } },
  { id: 'EVT-18', timestamp: '03:23:45', sourceNode: 'worker-03', targetNode: 'metrics-sink', protocol: 'WEBSOCKET', payloadSizeMb: 0.7, latencyMs: 22, status: 'SUCCESS' },
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
      GRPC: { normalRangeMb: [0.01, 1.0], normalLatencyMs: [5, 15000] },
    },
  },
  scoring: {
    basePoints: 100,
    corroboratingBonus: 30,
    tokenBonusPerUnit: 10,
    cleanSheetBonus: 20,
    incorrectPenalty: -40,
  },
};

async function playtest() {
  console.log("==================================================");
  console.log("ROGUE_SCANNER — HUMAN PLAYTEST SUITE (PHASE 9A)");
  console.log("==================================================");

  let stageSocket;

  try {
    // ─── STAGE 1: PLAYER SETUP & ONBOARDING ───
    console.log("\n[STAGE 1] Player Registration & Session Provisioning");
    const gmEmail = `gm_playtest_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_Play_${Date.now()}`,
      password: 'password123',
      role: 'HOST',
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });

    const createStudent = async (name) => {
      const email = `stud_${name}_${Date.now()}@test.com`;
      await axios.post(`${API}/auth/register`, {
        email,
        username: `${name}_${Date.now()}`,
        password: 'password123',
        role: 'STUDENT',
      });
      const res = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
      return { id: res.data.user.id, token: res.data.token, username: res.data.user.username };
    };

    const studentA = await createStudent('AnalystAlice');
    const studentB = await createStudent('AnalystBob');

    // Create Game & Challenge
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Operation Phantom Cadence Playtest',
      description: 'AIERA telemetry anomaly detection',
      template: 'ROGUE_SCANNER',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'TELEMETRY_ANOMALY',
      prompt: SCANNER_CONFIG.missionBrief,
      points: 100,
      timeLimit: 300,
      config: SCANNER_CONFIG,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;

    const eventRes = await axios.post(`${API}/events`, {
      name: 'Forensics Playtest Round',
      mode: 'SEQUENCE',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = eventRes.data.id || eventRes.data.event?.id;

    await axios.post(`${API}/events/${eventId}/games`, { gameId, position: 0 }, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });
    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });

    const sessionRes = await axios.post(`${API}/sessions`, { eventId }, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });
    const roomCode = sessionRes.data.session?.roomCode || sessionRes.data.roomCode;
    const sessionId = sessionRes.data.session?.id || sessionRes.data.id;

    // Join both students
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${studentA.token}` } });
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${studentB.token}` } });

    // Host starts session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ROUND_ACTIVE',
        currentGameId: gameId,
        currentChallengeId: challengeId,
        challengeStartTime: new Date(),
      },
    });
    console.log(`✓ STAGE 1 PASSED: Room ${roomCode} active with challenge ${challengeId}`);

    // ─── STAGE 2: TELEMETRY STREAM INSPECTION ───
    console.log("\n[STAGE 2] Telemetry Stream Inspection & Sanitization");
    const sessionState = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    const activeChal = sessionState.data.currentGame?.challenges?.find(c => c.id === challengeId);
    if (!activeChal) throw new Error("STAGE 2 FAILED: Active challenge missing from state");

    const events = activeChal.config.events || [];
    if (events.length !== 22) throw new Error(`STAGE 2 FAILED: Expected 22 events, got ${events.length}`);

    // Verify sanitization
    if (activeChal.config.anomalousEventIds || activeChal.config.anomalyMechanism) {
      throw new Error("STAGE 2 FAILED: Secret answers leaked in challenge config");
    }
    const leaked = events.find(e => e.traceDetails || e.isRogue);
    if (leaked) {
      throw new Error(`STAGE 2 FAILED: Secret traceDetails or isRogue leaked on ${leaked.id}`);
    }
    console.log(`✓ STAGE 2 PASSED: 22 events loaded cleanly with zero data leaks`);

    // ─── STAGE 3: BASELINE PROFILE SCAN ───
    console.log("\n[STAGE 3] Baseline Scan Execution");
    const baseScan = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'SCAN_BASELINE' },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });

    if (!baseScan.data.success || !baseScan.data.actionResult?.data) {
      throw new Error("STAGE 3 FAILED: Baseline scan probe returned invalid structure");
    }
    if (baseScan.data.actionTokensRemaining !== 14 || baseScan.data.tokensUsed !== 1) {
      throw new Error(`STAGE 3 FAILED: Token deduction failed: ${baseScan.data.actionTokensRemaining}`);
    }
    console.log(`✓ STAGE 3 PASSED: Baseline profile retrieved. Tokens: 15 -> 14`);

    // ─── STAGE 4: FALSE POSITIVE INVESTIGATIONS ───
    console.log("\n[STAGE 4] False-Positive Audits (EVT-08, EVT-14, EVT-19)");
    // EVT-08 (92 GB backup)
    const trace08 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-08' },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });
    if (!trace08.data.actionResult?.isClearedFalsePositive) {
      throw new Error("STAGE 4 FAILED: EVT-08 not identified as cleared false positive");
    }
    if (!trace08.data.actionResult?.traceDetails?.processName?.includes('slurm-backup')) {
      throw new Error("STAGE 4 FAILED: EVT-08 process name missing or incorrect");
    }

    // EVT-14 (Auth Error)
    const trace14 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-14' },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });
    if (!trace14.data.actionResult?.isClearedFalsePositive) {
      throw new Error("STAGE 4 FAILED: EVT-14 not identified as cleared false positive");
    }

    // EVT-19 (12.4s Latency Stall)
    const trace19 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-19' },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });
    if (!trace19.data.actionResult?.isClearedFalsePositive) {
      throw new Error("STAGE 4 FAILED: EVT-19 not identified as cleared false positive");
    }

    if (trace19.data.clearedFalsePositives.length !== 3) {
      throw new Error(`STAGE 4 FAILED: Expected 3 cleared false positives, found ${trace19.data.clearedFalsePositives.length}`);
    }
    console.log(`✓ STAGE 4 PASSED: EVT-08, EVT-14, EVT-19 cleared as benign operational spikes (Tokens: 14 -> 8)`);

    // ─── STAGE 5: CORRELATED ROGUE INVESTIGATION ───
    console.log("\n[STAGE 5] Rogue Event Deep Trace (EVT-11)");
    const trace11 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-11' },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });

    if (!trace11.data.actionResult?.isRogueEvent) {
      throw new Error("STAGE 5 FAILED: EVT-11 should be flagged as rogue event");
    }
    if (!trace11.data.actionResult?.traceDetails?.processName?.includes('kworker_anon')) {
      throw new Error("STAGE 5 FAILED: EVT-11 trace details process mismatch");
    }
    console.log(`✓ STAGE 5 PASSED: EVT-11 traced: orphaned daemon process detected (Tokens: 8 -> 6)`);

    // ─── STAGE 6: PATTERN OVERLAY INVESTIGATION ───
    console.log("\n[STAGE 6] Pattern Overlay Cadence Detection (EVT-11 & EVT-17)");
    const overlayRes = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'PATTERN_OVERLAY', eventIds: ['EVT-11', 'EVT-17'] },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });

    const matrix = overlayRes.data.actionResult;
    if (!matrix?.correlationDetected || !matrix?.isMechanicalCadence || !matrix?.hasIdenticalPayload || !matrix?.hasSharedUnmappedTarget) {
      throw new Error(`STAGE 6 FAILED: Rogue beacon correlation missed! ${JSON.stringify(matrix)}`);
    }
    if (matrix.comparisons[0]?.deltaSeconds !== 600) {
      throw new Error(`STAGE 6 FAILED: Expected deltaSeconds 600, got ${matrix.comparisons[0]?.deltaSeconds}`);
    }
    console.log(`✓ STAGE 6 PASSED: Strict 600.00s cadence detected to unmapped ext-staging-relay (Tokens: 6 -> 4)`);

    // ─── STAGE 7: WORKING HYPOTHESIS SELECTION ───
    console.log("\n[STAGE 7] Setting Working Hypothesis");
    const hypRes = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'SET_HYPOTHESIS', hypothesis: 'Periodic Covert Beaconing Channel (EVT-11 / EVT-17 cadence)' },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });

    if (hypRes.data.actionTokensRemaining !== 4) {
      throw new Error(`STAGE 7 FAILED: Hypothesis should cost 0 tokens. Tokens remaining: ${hypRes.data.actionTokensRemaining}`);
    }
    if (!hypRes.data.activeHypothesis?.includes('Periodic Covert Beaconing')) {
      throw new Error("STAGE 7 FAILED: Working hypothesis was not stored in session state");
    }
    console.log(`✓ STAGE 7 PASSED: Hypothesis saved with 0 token consumption (Tokens: 4 remaining)`);

    // ─── STAGE 8: STATE RESTORATION ACROSS RECONNECT ───
    console.log("\n[STAGE 8] Reconnect & State Restoration Verification");
    const stateRes = await axios.get(`${API}/sessions/${roomCode}/scanner-state?challengeId=${challengeId}`, {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    const restored = stateRes.data;
    if (restored.actionTokensRemaining !== 4 || restored.tokensUsed !== 11) {
      throw new Error(`STAGE 8 FAILED: Tokens not restored correctly. Remaining: ${restored.actionTokensRemaining}`);
    }
    if (restored.unlockedTraces.length !== 4) {
      throw new Error(`STAGE 8 FAILED: Expected 4 unlocked traces, got ${restored.unlockedTraces.length}`);
    }
    if (!restored.unlockedTraceDetails?.['EVT-08'] || !restored.unlockedTraceDetails?.['EVT-11']) {
      throw new Error("STAGE 8 FAILED: unlockedTraceDetails missing from reconnected state");
    }
    if (!restored.baselineData) {
      throw new Error("STAGE 8 FAILED: baselineData missing from reconnected state");
    }
    if (restored.clearedFalsePositives.length !== 3) {
      throw new Error(`STAGE 8 FAILED: Cleared false positives not restored: ${restored.clearedFalsePositives.length}`);
    }
    console.log(`✓ STAGE 8 PASSED: Reconnection restored tokens, 4 traces, baseline, hypothesis, and false positive list`);

    // ─── STAGE 9: MULTIPLAYER ISOLATION ───
    console.log("\n[STAGE 9] Multi-Player Session Isolation");
    const stateB = await axios.get(`${API}/sessions/${roomCode}/scanner-state?challengeId=${challengeId}`, {
      headers: { Authorization: `Bearer ${studentB.token}` },
    });
    if (stateB.data.actionTokensRemaining !== 15 || stateB.data.tokensUsed !== 0) {
      throw new Error(`STAGE 9 FAILED: Student B inherited Student A's token usage! Remaining: ${stateB.data.actionTokensRemaining}`);
    }
    if (stateB.data.unlockedTraces.length !== 0 || stateB.data.clearedFalsePositives.length !== 0) {
      throw new Error("STAGE 9 FAILED: Student B inherited Student A's unlocked traces or false positives!");
    }
    console.log(`✓ STAGE 9 PASSED: Student B maintains completely isolated state and full 15-token budget`);

    // ─── STAGE 10: FALSE POSITIVE PENALTY FOR BLIND ACCUSATION ───
    console.log("\n[STAGE 10] False Positive Accusation Penalty (-40 PTS)");
    const falseAccuseRes = await axios.post(`${API}/sessions/active/submit`, {
      answer: {
        anomalousEventId: 'EVT-08',
        anomalyMechanism: 'DATA_EXFILTRATION',
        supportingEvidence: '92 GB massive volume spike',
      },
    }, { headers: { Authorization: `Bearer ${studentB.token}` } });

    if (falseAccuseRes.data.isCorrect) {
      throw new Error("STAGE 10 FAILED: Accusing benign EVT-08 was accepted as correct!");
    }
    if (falseAccuseRes.data.pointsAwarded !== -40) {
      throw new Error(`STAGE 10 FAILED: Expected -40 penalty, got ${falseAccuseRes.data.pointsAwarded}`);
    }
    console.log(`✓ STAGE 10 PASSED: False positive accusation correctly penalized with -40 points`);

    // ─── STAGE 11: ACCUSATION VALIDATION & CORRECT VERDICT ───
    console.log("\n[STAGE 11] Correct Final Verdict & Scoring Verification");
    const accuseResA = await axios.post(`${API}/sessions/active/submit`, {
      answer: {
        anomalousEventId: 'EVT-11',
        anomalyMechanism: 'PERIODIC_BEACON',
        supportingEvidence: 'EVT-17 clockwork beacon at delta 600s to unmapped ext-staging-relay',
      },
    }, { headers: { Authorization: `Bearer ${studentA.token}` } });

    if (!accuseResA.data.isCorrect) {
      throw new Error("STAGE 11 FAILED: Correct accusation for EVT-11 with periodic beacon was rejected");
    }

    // Score: Base 100 + Clue 30 + Tokens (4 * 10 = 40) + Clean Sheet 20 = 190
    const pointsA = accuseResA.data.pointsAwarded;
    if (pointsA !== 190) {
      throw new Error(`STAGE 11 FAILED: Expected exactly 190 points (100 base + 30 clue + 40 tokens + 20 clean sheet), got ${pointsA}`);
    }
    console.log(`✓ STAGE 11 PASSED: Correct accusation verified! Awarded ${pointsA} pts (100 Base + 30 Clue + 40 Tokens + 20 Clean Sheet)`);

    // ─── STAGE 12: LEADERBOARD & COMPLETION PERSISTENCE ───
    console.log("\n[STAGE 12] Completion Persistence & Final Leaderboard");
    const finalSession = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${studentA.token}` },
    });
    const lb = finalSession.data.leaderboard || [];
    const rank1 = lb[0];
    const rank2 = lb[1];

    if (!rank1 || rank1.name !== studentA.username || rank1.score !== 190) {
      throw new Error(`STAGE 12 FAILED: Rank 1 should be AnalystAlice with 190 pts. Got: ${JSON.stringify(rank1)}`);
    }
    if (!rank2 || rank2.name !== studentB.username || rank2.score !== -40) {
      throw new Error(`STAGE 12 FAILED: Rank 2 should be AnalystBob with -40 pts. Got: ${JSON.stringify(rank2)}`);
    }
    console.log(`✓ STAGE 12 PASSED: Final Leaderboard: #1 ${rank1.name} (190 pts) vs #2 ${rank2.name} (-40 pts)`);

    console.log("\n==================================================");
    console.log("ALL 12 HUMAN PLAYTEST STAGES COMPLETED & PASSED!");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ PLAYTEST FAILURE:", err.response?.data || err.message);
    process.exit(1);
  } finally {
    if (stageSocket) stageSocket.disconnect();
    await prisma.$disconnect();
  }
}

playtest();
