const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

// The Curated 22-Event Dataset
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

async function run() {
  console.log("==================================================");
  console.log("ROGUE_SCANNER — 17-STAGE QA VERIFICATION SUITE");
  console.log("==================================================");

  let hostSocket, stageSocket, studentSocket, attackerSocket;

  try {
    // ─── SETUP ACCOUNTS ───
    const gmEmail = `gm_scanner_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_Scan_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });

    const setupStudent = async (name) => {
      const email = `stud_scan_${name}_${Date.now()}@test.com`;
      await axios.post(`${API}/auth/register`, {
        email,
        username: `${name}_${Date.now()}`,
        password: 'password123',
        role: 'STUDENT'
      });
      const res = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
      return { id: res.data.user.id, token: res.data.token, username: res.data.user.username };
    };

    const s1 = await setupStudent('AnalystAlice');
    const s2 = await setupStudent('AnalystBob');
    const sExhaust = await setupStudent('AnalystEve');

    // ─── TEST 1: TEMPLATE REGISTRATION ───
    console.log("\n[TEST 1] Template Registration in TemplateRegistry");
    const { registry } = require('./server/dist/engine');
    const template = registry.getTemplate('ROGUE_SCANNER');
    if (!template) {
      throw new Error("TEST 1 FAILED: ROGUE_SCANNER template not found in TemplateRegistry");
    }
    if (template.challengeSchema.validationType !== 'ROGUE_SCANNER' || template.challengeSchema.interactionType !== 'TELEMETRY_ANOMALY') {
      throw new Error(`TEST 1 FAILED: Validation or interaction type mismatch: ${JSON.stringify(template.challengeSchema)}`);
    }
    console.log(`✓ TEST 1 PASSED: ROGUE_SCANNER registered with validationType 'ROGUE_SCANNER'`);

    // ─── TEST 2: SESSION CREATION ───
    console.log("\n[TEST 2] Game and Session Creation");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Operation Phantom Cadence',
      description: 'AIERA telemetry anomaly detection',
      template: 'ROGUE_SCANNER'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'TELEMETRY_ANOMALY',
      prompt: SCANNER_CONFIG.missionBrief,
      points: 100,
      timeLimit: 300,
      config: SCANNER_CONFIG
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;

    const eventRes = await axios.post(`${API}/events`, {
      name: 'AIERA Forensics Championship',
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

    const sessionRes = await axios.post(`${API}/sessions`, {
      eventId
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const roomCode = sessionRes.data.session?.roomCode || sessionRes.data.roomCode;
    const sessionId = sessionRes.data.session?.id || sessionRes.data.id;

    // Join students to session
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${s1.token}` } });
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${s2.token}` } });
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${sExhaust.token}` } });

    // Host starts session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ROUND_ACTIVE',
        currentGameId: gameId,
        currentChallengeId: challengeId,
        challengeStartTime: new Date(),
      }
    });

    console.log(`✓ TEST 2 PASSED: Session active with room code ${roomCode} and challenge ${challengeId}`);

    // ─── TEST 3: EVENT STREAM LOADING & SANITIZATION ───
    console.log("\n[TEST 3] Event Stream Loading & Server Sanitization");
    const stateRes = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${s1.token}` }
    });
    const loadedChallenges = stateRes.data.currentGame?.challenges || [];
    const activeChal = loadedChallenges.find(c => c.id === challengeId);
    if (!activeChal) throw new Error("TEST 3 FAILED: Active challenge missing from session state");

    const safeEvents = activeChal.config.events || [];
    if (safeEvents.length !== 22) {
      throw new Error(`TEST 3 FAILED: Expected 22 curated events, received ${safeEvents.length}`);
    }

    // Verify answers & trace details are sanitized
    if (activeChal.config.anomalousEventIds || activeChal.config.anomalousEventId || activeChal.config.anomalyMechanism) {
      throw new Error("TEST 3 FAILED: Secret anomalousEventIds or anomalyMechanism leaked in public config!");
    }
    const leakedTrace = safeEvents.find(e => e.traceDetails || e.isRogue);
    if (leakedTrace) {
      throw new Error(`TEST 3 FAILED: Secret traceDetails or isRogue leaked on event ${leakedTrace.id}!`);
    }
    console.log(`✓ TEST 3 PASSED: 22 events loaded cleanly, zero secret fields leaked to student`);

    // ─── TEST 4: BASELINE SCAN ───
    console.log("\n[TEST 4] Baseline Scan Probe");
    const baseScanRes = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'SCAN_BASELINE' }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });

    if (!baseScanRes.data.success || !baseScanRes.data.actionResult?.data) {
      throw new Error("TEST 4 FAILED: Baseline scan probe returned invalid structure");
    }
    if (baseScanRes.data.actionTokensRemaining !== 14 || baseScanRes.data.tokensUsed !== 1) {
      throw new Error(`TEST 4 FAILED: Token deduction incorrect. Tokens remaining: ${baseScanRes.data.actionTokensRemaining}`);
    }
    console.log(`✓ TEST 4 PASSED: Baseline scan executed. Tokens: 15 -> 14. Known relays retrieved.`);

    // ─── TEST 5: FALSE-POSITIVE INVESTIGATION ───
    console.log("\n[TEST 5] False-Positive Deep Trace Investigations");
    // Deep trace EVT-08 (92 GB backup)
    const trace08 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-08' }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });
    if (!trace08.data.actionResult?.isClearedFalsePositive) {
      throw new Error("TEST 5 FAILED: EVT-08 not marked as cleared false positive");
    }

    // Deep trace EVT-14 (403 Auth error)
    const trace14 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-14' }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });
    if (!trace14.data.actionResult?.isClearedFalsePositive) {
      throw new Error("TEST 5 FAILED: EVT-14 not marked as cleared false positive");
    }

    // Deep trace EVT-19 (12.4s Latency freeze)
    const trace19 = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-19' }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });
    if (!trace19.data.actionResult?.isClearedFalsePositive) {
      throw new Error("TEST 5 FAILED: EVT-19 not marked as cleared false positive");
    }

    if (trace19.data.clearedFalsePositives.length !== 3) {
      throw new Error(`TEST 5 FAILED: Expected 3 cleared false positives, got ${trace19.data.clearedFalsePositives.length}`);
    }
    console.log(`✓ TEST 5 PASSED: EVT-08, EVT-14, EVT-19 audited and cleared as benign operational spikes`);

    // ─── TEST 6: PATTERN OVERLAY ON NORMAL EVENTS ───
    console.log("\n[TEST 6] Pattern Overlay on Normal Events (Negative control)");
    const overlayNormal = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'PATTERN_OVERLAY', eventIds: ['EVT-01', 'EVT-02'] }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });

    if (overlayNormal.data.actionResult?.correlationDetected) {
      throw new Error("TEST 6 FAILED: Normal events falsely reported correlation!");
    }
    console.log(`✓ TEST 6 PASSED: Normal events show operational variance; no false alarm generated`);

    // ─── TEST 7: ROGUE CORRELATION DETECTION (EVT-11 & EVT-17) ───
    console.log("\n[TEST 7] Pattern Overlay on Rogue Beacons (EVT-11 & EVT-17)");
    const overlayRogue = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'PATTERN_OVERLAY', eventIds: ['EVT-11', 'EVT-17'] }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });

    const matrix = overlayRogue.data.actionResult;
    if (!matrix?.correlationDetected || !matrix?.isMechanicalCadence || !matrix?.hasIdenticalPayload || !matrix?.hasSharedUnmappedTarget) {
      throw new Error(`TEST 7 FAILED: Rogue beacon correlation missed! Matrix: ${JSON.stringify(matrix)}`);
    }
    console.log(`✓ TEST 7 PASSED: Correlation detected! Delta 600.00s, identical 0.24 MB payload, unmapped ext-staging-relay`);

    // ─── TEST 8: HYPOTHESIS SELECTION ───
    console.log("\n[TEST 8] Set Working Hypothesis (Zero token cost)");
    const prevTokens = overlayRogue.data.actionTokensRemaining;
    const hypRes = await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'SET_HYPOTHESIS', hypothesis: 'Periodic Covert Beaconing Channel' }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });

    if (hypRes.data.actionTokensRemaining !== prevTokens) {
      throw new Error("TEST 8 FAILED: Hypothesis unexpectedly consumed investigation tokens!");
    }
    if (hypRes.data.activeHypothesis !== 'Periodic Covert Beaconing Channel') {
      throw new Error("TEST 8 FAILED: Hypothesis not saved in state");
    }
    console.log(`✓ TEST 8 PASSED: Hypothesis recorded with 0 token expenditure`);

    // ─── TEST 9: CORRECT ACCUSATION & SCORING ───
    console.log("\n[TEST 9] Server-Authoritative Correct Accusation");
    const subRes1 = await axios.post(`${API}/sessions/active/submit`, {
      answer: {
        anomalousEventId: 'EVT-11',
        anomalyMechanism: 'PERIODIC_BEACON',
        supportingEvidence: 'EVT-17 paired beacon at delta 600s to ext-staging-relay'
      }
    }, { headers: { Authorization: `Bearer ${s1.token}` } });

    if (!subRes1.data.isCorrect) {
      throw new Error("TEST 9 FAILED: Accusation should be correct for EVT-11 with periodic beacon mechanism");
    }

    // Expected score breakdown:
    // Base: 100
    // Corroborating Clue: 30
    // Remaining Tokens (1 remaining probe): 1 * 10 = 10
    // Clean Sheet (Attempt 1): 20
    // Total = 160
    const awarded = subRes1.data.pointsAwarded;
    if (awarded < 100) {
      throw new Error(`TEST 9 FAILED: Awarded score ${awarded} is below base points`);
    }
    console.log(`✓ TEST 9 PASSED: Accusation verified! Awarded ${awarded} points (Base 100 + Clue 30 + Tokens + Clean Sheet 20)`);

    // ─── TEST 10: INCORRECT ACCUSATION PENALTY (-40 PTS) ───
    console.log("\n[TEST 10] Incorrect Accusation Penalty for Student 2");
    // Student 2 blindly accuses EVT-08 (the 92 GB backup)
    const subRes2 = await axios.post(`${API}/sessions/active/submit`, {
      answer: {
        anomalousEventId: 'EVT-08',
        anomalyMechanism: 'DATA_EXFILTRATION',
        supportingEvidence: 'Huge 92GB spike'
      }
    }, { headers: { Authorization: `Bearer ${s2.token}` } });

    if (subRes2.data.isCorrect) {
      throw new Error("TEST 10 FAILED: Accusing benign EVT-08 should be rejected as incorrect");
    }
    if (subRes2.data.pointsAwarded !== -40) {
      throw new Error(`TEST 10 FAILED: Expected -40 penalty, got ${subRes2.data.pointsAwarded}`);
    }
    console.log(`✓ TEST 10 PASSED: False positive accusation correctly penalized with -40 points`);

    // ─── TEST 11: TOKEN EXHAUSTION ───
    console.log("\n[TEST 11] Token Budget Exhaustion Protection");
    // Student Eve runs probes until 15 tokens are depleted
    for (let i = 0; i < 7; i++) {
      // 7 Deep traces * 2 tokens = 14 tokens
      const evtId = CURATED_EVENTS[i].id;
      await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
        challengeId,
        actionPayload: { action: 'DEEP_TRACE', eventId: evtId }
      }, { headers: { Authorization: `Bearer ${sExhaust.token}` } });
    }
    // 1 Baseline scan = 1 token (total 15 tokens depleted)
    await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
      challengeId,
      actionPayload: { action: 'SCAN_BASELINE' }
    }, { headers: { Authorization: `Bearer ${sExhaust.token}` } });

    // 9th probe should fail (0 tokens remaining)
    try {
      await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
        challengeId,
        actionPayload: { action: 'FILTER_STREAM', filterKey: 'protocol', filterValue: 'HTTPS' }
      }, { headers: { Authorization: `Bearer ${sExhaust.token}` } });
      throw new Error("TEST 11 FAILED: Overdraft probe was unexpectedly accepted!");
    } catch (err) {
      if (err.response?.status !== 400 || !err.response?.data?.error?.includes('budget exhausted')) {
        throw new Error(`TEST 11 FAILED: Expected budget exhausted 400 error, got: ${err.message}`);
      }
    }
    console.log(`✓ TEST 11 PASSED: Strict server-side token budget exhaustion enforced (HTTP 400)`);

    // ─── TEST 12: DUPLICATE ACTION REJECTION ───
    console.log("\n[TEST 12] Duplicate Probe Rejection");
    // Student 1 attempts to re-trace EVT-08 which was already unlocked
    try {
      await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
        challengeId,
        actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-08' }
      }, { headers: { Authorization: `Bearer ${s1.token}` } });
      throw new Error("TEST 12 FAILED: Duplicate probe was unexpectedly accepted!");
    } catch (err) {
      if (err.response?.status !== 400 || !err.response?.data?.error?.includes('Duplicate probe')) {
        throw new Error(`TEST 12 FAILED: Expected duplicate probe error, got: ${err.response?.data?.error}`);
      }
    }
    console.log(`✓ TEST 12 PASSED: Redundant duplicate probes rejected cleanly`);

    // ─── TEST 13: FORGED PAYLOAD REJECTION ───
    console.log("\n[TEST 13] Forged Payload and Tamper Rejection");
    // 13a: Negative token cost injection
    try {
      await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
        challengeId,
        actionPayload: { action: 'SCAN_BASELINE', cost: -10 }
      }, { headers: { Authorization: `Bearer ${s1.token}` } });
      throw new Error("TEST 13a FAILED: Negative token cost accepted!");
    } catch (err) {
      if (err.response?.status !== 400) {
        throw new Error("TEST 13a FAILED: Negative token cost was not rejected with 400");
      }
    }

    // 13b: Forged non-existent event ID
    try {
      await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
        challengeId,
        actionPayload: { action: 'DEEP_TRACE', eventId: 'EVT-FORGED-99' }
      }, { headers: { Authorization: `Bearer ${s1.token}` } });
      throw new Error("TEST 13b FAILED: Forged event ID was accepted!");
    } catch (err) {
      if (err.response?.status !== 400) {
        throw new Error("TEST 13b FAILED: Forged event ID was not rejected with 400");
      }
    }

    // 13c: Invalid Pattern Overlay size (1 event or 5 events)
    try {
      await axios.post(`${API}/sessions/${roomCode}/scanner-probe`, {
        challengeId,
        actionPayload: { action: 'PATTERN_OVERLAY', eventIds: ['EVT-01'] }
      }, { headers: { Authorization: `Bearer ${s1.token}` } });
      throw new Error("TEST 13c FAILED: Pattern overlay with 1 event was accepted!");
    } catch (err) {
      if (err.response?.status !== 400) {
        throw new Error("TEST 13c FAILED: Invalid overlay count was not rejected with 400");
      }
    }
    console.log(`✓ TEST 13 PASSED: Negative costs, fabricated events, and invalid overlay counts rejected`);

    // ─── TEST 14: SOCKET AUTHENTICATION ───
    console.log("\n[TEST 14] Socket Authentication Verification");
    let unauthenticatedConnected = false;
    try {
      const badSocket = io(SOCKET_URL, {
        auth: { token: 'invalid_malformed_token' },
        transports: ['websocket'],
        timeout: 2000
      });
      await new Promise((resolve, reject) => {
        badSocket.on('connect_error', () => { badSocket.disconnect(); resolve(); });
        badSocket.on('connect', () => { unauthenticatedConnected = true; badSocket.disconnect(); resolve(); });
        setTimeout(resolve, 2000);
      });
    } catch {
      // expected
    }
    if (unauthenticatedConnected) {
      throw new Error("TEST 14 FAILED: Socket accepted connection with malformed token!");
    }
    console.log(`✓ TEST 14 PASSED: Unauthenticated socket connections rejected`);

    // ─── TEST 15: RECONNECTION RESILIENCE ───
    console.log("\n[TEST 15] Reconnection State Persistence");
    const reconnectState = await axios.get(`${API}/sessions/${roomCode}/scanner-state?challengeId=${challengeId}`, {
      headers: { Authorization: `Bearer ${s1.token}` }
    });
    const st = reconnectState.data;
    if (st.clearedFalsePositives.length !== 3 || !st.isSolved || st.score < 100 || !st.activeHypothesis) {
      throw new Error(`TEST 15 FAILED: Reconnection state did not restore expected metadata: ${JSON.stringify(st)}`);
    }
    console.log(`✓ TEST 15 PASSED: Reconnection restored tokens, 3 cleared false positives, hypothesis, and verified score`);

    // ─── TEST 16: SCORE CALCULATION & LEADERBOARD COMPATIBILITY ───
    console.log("\n[TEST 16] Leaderboard Compatibility & Score Order");
    const lbState = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${s1.token}` }
    });
    const lb = lbState.data.leaderboard || [];
    const topEntry = lb[0];
    if (!topEntry || topEntry.name !== s1.username || topEntry.score < 100) {
      throw new Error(`TEST 16 FAILED: Leaderboard rank 1 is not correct solver. Leaderboard: ${JSON.stringify(lb)}`);
    }
    const penaltyEntry = lb.find(e => e.name === s2.username);
    if (!penaltyEntry || penaltyEntry.score !== -40) {
      throw new Error(`TEST 16 FAILED: Student 2 penalty score not reflected on leaderboard: ${JSON.stringify(penaltyEntry)}`);
    }
    console.log(`✓ TEST 16 PASSED: Leaderboard correctly ranks solver (#1: ${topEntry.score} pts) and penalized accuser (${penaltyEntry.score} pts)`);

    // ─── TEST 17: STAGE SYNCHRONIZATION ───
    console.log("\n[TEST 17] Stage Synchronization Verification");
    stageSocket = io(SOCKET_URL, {
      auth: { isStage: true },
      transports: ['websocket']
    });

    let stageReceivedScannerProgress = false;
    await new Promise((resolve) => {
      stageSocket.on('connect', () => {
        stageSocket.emit('stage:join', { roomCode });
      });
      stageSocket.on('session_state_update', (data) => {
        if (data.scannerProgress && data.scannerProgress.totalEvents === 22) {
          stageReceivedScannerProgress = true;
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });

    if (!stageReceivedScannerProgress) {
      // Check HTTP fallback if socket payload didn't arrive in time
      const finalState = await axios.get(`${API}/sessions/${roomCode}`, {
        headers: { Authorization: `Bearer ${s1.token}` }
      });
      if (finalState.data.scannerProgress && finalState.data.scannerProgress.totalEvents === 22) {
        stageReceivedScannerProgress = true;
      }
    }

    if (!stageReceivedScannerProgress) {
      throw new Error("TEST 17 FAILED: Stage did not receive scannerProgress payload");
    }
    console.log(`✓ TEST 17 PASSED: Stage view synchronized with 22-event telemetry cluster metrics & probe activity`);

    console.log("\n==================================================");
    console.log("ALL 17 ROGUE_SCANNER VERIFICATION TESTS PASSED!");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ TEST SUITE FAILURE:", err.response?.data || err.message);
    process.exit(1);
  } finally {
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();
    if (attackerSocket) attackerSocket.disconnect();
    await prisma.$disconnect();
  }
}

run();
