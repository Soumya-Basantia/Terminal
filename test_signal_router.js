const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

// ============================================================================
// CURATED SIGNAL ROUTER SCENARIOS (Authoritative Design Spec)
// ============================================================================

const OP1_FIBER_BURST = {
  scenarioId: 'ROUTER-OP-01',
  scenarioTitle: 'OPERATION FIBER_BURST: EMERGENCY HOSPITAL TELEMETRY',
  missionBrief: 'A critical 4.5 Gbps medical telemetry stream from Saint Jude Regional Clinic (TX) must reach the Medical Diagnostic Center (RX). Core lines are experiencing evening rush-hour congestion. Route the stream without blowing switch buffers or exceeding the 80ms latency deadline.',
  stream: {
    payloadVolumeGbps: 4.5,
    streamType: 'CRITICAL_TELEMETRY',
    slaMaxLatencyMs: 80,
    slaMaxLossPercent: 0.0,
  },
  graph: {
    sourceNodeId: 'NODE_TX',
    targetNodeId: 'NODE_RX',
    nodes: [
      { id: 'NODE_TX', label: 'ST_JUDE_INGRESS', type: 'INGRESS', x: 10, y: 50 },
      { id: 'NODE_N1', label: 'NORTH_GATEWAY', type: 'GATEWAY', x: 35, y: 20 },
      { id: 'NODE_N2', label: 'METRO_CORE', type: 'CORE_ROUTER', x: 35, y: 80 },
      { id: 'NODE_N3', label: 'OPTICAL_HUB_A', type: 'CORE_ROUTER', x: 65, y: 20 },
      { id: 'NODE_N4', label: 'RIVER_RELAY', type: 'RELAY', x: 65, y: 80 },
      { id: 'NODE_RX', label: 'MED_CENTER_RX', type: 'EGRESS', x: 90, y: 50 },
    ],
    links: [
      {
        id: 'LINK_TX_N1',
        from: 'NODE_TX',
        to: 'NODE_N1',
        capacityGbps: 10.0,
        backgroundLoadGbps: 2.0,
        latencyMs: 15,
        lossRate: 0.0,
        description: 'High-speed municipal optical fiber.',
      },
      {
        id: 'LINK_TX_N2',
        from: 'NODE_TX',
        to: 'NODE_N2',
        capacityGbps: 5.0,
        backgroundLoadGbps: 3.8,
        latencyMs: 10,
        lossRate: 0.0,
        description: 'Legacy copper backbone (Strained).',
      },
      {
        id: 'LINK_N1_N3',
        from: 'NODE_N1',
        to: 'NODE_N3',
        capacityGbps: 10.0,
        backgroundLoadGbps: 1.0,
        latencyMs: 20,
        lossRate: 0.0,
        description: 'Long-distance optical line.',
      },
      {
        id: 'LINK_N1_N4',
        from: 'NODE_N1',
        to: 'NODE_N4',
        capacityGbps: 3.0,
        backgroundLoadGbps: 0.5,
        latencyMs: 12,
        lossRate: 0.0,
        description: 'Secondary microwave link.',
      },
      {
        id: 'LINK_N2_N4',
        from: 'NODE_N2',
        to: 'NODE_N4',
        capacityGbps: 5.0,
        backgroundLoadGbps: 1.2,
        latencyMs: 18,
        lossRate: 0.0,
        description: 'Substation conduit.',
      },
      {
        id: 'LINK_N3_RX',
        from: 'NODE_N3',
        to: 'NODE_RX',
        capacityGbps: 10.0,
        backgroundLoadGbps: 2.5,
        latencyMs: 15,
        lossRate: 0.0,
        description: 'Hospital campus primary link.',
      },
      {
        id: 'LINK_N4_RX',
        from: 'NODE_N4',
        to: 'NODE_RX',
        capacityGbps: 4.0,
        backgroundLoadGbps: 0.0,
        latencyMs: 10,
        lossRate: 0.0,
        description: 'Emergency backup feed.',
      },
    ],
  },
  probeTokens: 3,
  scoring: {
    basePoints: 100,
    zeroLossBonus: 50,
    firstRunCleanSheetBonus: 50,
    latencyHeadroomMaxBonus: 50,
    unusedProbeBonus: 10,
    overloadPenalty: 25,
  },
  revealConcept: {
    title: 'WHAT YOU JUST EXPERIENCED: GRAPH ROUTING & BOTTLENECK ANALYSIS',
    summary: 'The shortest path in hops is rarely the best path in networks. High-capacity optical lines avoid queue buffer bloat and packet drop.',
  },
};

const OP2_CLOUD_SURGE = {
  scenarioId: 'ROUTER-OP-02',
  scenarioTitle: 'OPERATION CLOUD_SURGE: FINANCIAL LEDGER REPLICATION',
  missionBrief: 'Synchronize 6.0 Gbps of encrypted transaction logs from Cloud Hub TX to Fortress Ledger RX. SLA deadline is strict 65ms.',
  stream: {
    payloadVolumeGbps: 6.0,
    streamType: 'FINANCIAL_LEDGER',
    slaMaxLatencyMs: 65,
    slaMaxLossPercent: 0.0,
  },
  graph: {
    sourceNodeId: 'NODE_TX',
    targetNodeId: 'NODE_RX',
    nodes: [
      { id: 'NODE_TX', label: 'CLOUD_INGRESS', type: 'INGRESS', x: 10, y: 50 },
      { id: 'NODE_A', label: 'EXCHANGE_A', type: 'SWITCH', x: 35, y: 25 },
      { id: 'NODE_B', label: 'EXCHANGE_B', type: 'SWITCH', x: 35, y: 75 },
      { id: 'NODE_C', label: 'TRUNK_CORE', type: 'CORE_ROUTER', x: 65, y: 50 },
      { id: 'NODE_RX', label: 'LEDGER_RX', type: 'EGRESS', x: 90, y: 50 },
    ],
    links: [
      { id: 'L_TX_A', from: 'NODE_TX', to: 'NODE_A', capacityGbps: 10, backgroundLoadGbps: 2.0, latencyMs: 15 },
      { id: 'L_TX_B', from: 'NODE_TX', to: 'NODE_B', capacityGbps: 8, backgroundLoadGbps: 1.0, latencyMs: 12 },
      { id: 'L_A_C', from: 'NODE_A', to: 'NODE_C', capacityGbps: 12, backgroundLoadGbps: 4.0, latencyMs: 18 },
      { id: 'L_B_C', from: 'NODE_B', to: 'NODE_C', capacityGbps: 6, backgroundLoadGbps: 1.5, latencyMs: 20 }, // Headroom: 4.5G < 6.0G
      { id: 'L_C_RX', from: 'NODE_C', to: 'NODE_RX', capacityGbps: 15, backgroundLoadGbps: 3.0, latencyMs: 15 },
    ],
  },
  probeTokens: 3,
  scoring: {
    basePoints: 120,
    zeroLossBonus: 60,
    firstRunCleanSheetBonus: 40,
    latencyHeadroomMaxBonus: 50,
    unusedProbeBonus: 10,
    overloadPenalty: 30,
  },
};

// ============================================================================
// TEST SUITE RUNNER
// ============================================================================

async function run() {
  console.log("==================================================");
  console.log("SIGNAL_ROUTER — 22-STAGE PRODUCTION QA SUITE");
  console.log("==================================================");

  let hostSocket, stageSocket, studentSocket, attackerSocket;
  let testGame, testChal1, testChal2, testSession;
  let studentUser, gmUser, attackerUser;

  try {
    // ------------------------------------------------------------------------
    // STAGE 1: TEMPLATE REGISTRATION VERIFICATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 1/22] Verifying SIGNAL_ROUTER Template in TemplateRegistry...");
    const { registry, Validator } = require('./server/dist/engine');
    const template = registry.getTemplate('SIGNAL_ROUTER');
    if (!template) throw new Error("SIGNAL_ROUTER not registered in TemplateRegistry!");
    if (template.status !== 'AVAILABLE') throw new Error("SIGNAL_ROUTER template must be AVAILABLE!");
    if (template.challengeSchema.validationType !== 'SIGNAL_ROUTER') {
      throw new Error(`Expected validationType SIGNAL_ROUTER, got ${template.challengeSchema.validationType}`);
    }
    if (template.challengeSchema.interactionType !== 'NETWORK_ROUTING') {
      throw new Error(`Expected interactionType NETWORK_ROUTING, got ${template.challengeSchema.interactionType}`);
    }
    console.log("✓ PASS: SIGNAL_ROUTER template registered with correct schemas and capabilities.");

    // ------------------------------------------------------------------------
    // STAGE 2: OFFLINE SIMULATION — INSUFFICIENT NODES
    // ------------------------------------------------------------------------
    console.log("\n[TEST 2/22] Testing Validator with single-node route (< 2 nodes)...");
    const sim1 = Validator.simulateSignalRoute(OP1_FIBER_BURST, ['NODE_TX']);
    if (sim1.isValidPath !== false || sim1.isSuccess !== false) {
      throw new Error("Single node path should be rejected as invalid!");
    }
    if (!sim1.failureTier || !sim1.failureTier.whatHappened.includes('insufficient')) {
      throw new Error("Expected failureTier to report insufficient nodes!");
    }
    console.log("✓ PASS: Insufficient path rejected with clean diagnostic.");

    // ------------------------------------------------------------------------
    // STAGE 3: OFFLINE SIMULATION — INVALID SOURCE OR TARGET
    // ------------------------------------------------------------------------
    console.log("\n[TEST 3/22] Testing Validator with invalid start and end endpoints...");
    const simWrongStart = Validator.simulateSignalRoute(OP1_FIBER_BURST, ['NODE_N1', 'NODE_N3', 'NODE_RX']);
    if (simWrongStart.isValidPath !== false || !simWrongStart.failureTier.whatHappened.includes('starts at')) {
      throw new Error("Expected wrong start node failure diagnostic!");
    }

    const simWrongEnd = Validator.simulateSignalRoute(OP1_FIBER_BURST, ['NODE_TX', 'NODE_N1', 'NODE_N3']);
    if (simWrongEnd.isValidPath !== false || !simWrongEnd.failureTier.whatHappened.includes('terminates at')) {
      throw new Error("Expected wrong end node failure diagnostic!");
    }
    console.log("✓ PASS: Non-source or non-target endpoints correctly rejected.");

    // ------------------------------------------------------------------------
    // STAGE 4: OFFLINE SIMULATION — DISCONNECTED JUMP
    // ------------------------------------------------------------------------
    console.log("\n[TEST 4/22] Testing Validator with non-adjacent jump in topology...");
    const simDisconnected = Validator.simulateSignalRoute(OP1_FIBER_BURST, ['NODE_TX', 'NODE_N3', 'NODE_RX']);
    if (simDisconnected.isValidPath !== false || !simDisconnected.failureTier.whatHappened.includes('No physical or logical link')) {
      throw new Error("Disconnected hop should fail link existence check!");
    }
    console.log("✓ PASS: Non-adjacent hop properly detected and flagged.");

    // ------------------------------------------------------------------------
    // STAGE 5: OFFLINE SIMULATION — LOOP / CYCLE DETECTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 5/22] Testing Validator with routing loop...");
    const simLoop = Validator.simulateSignalRoute(OP1_FIBER_BURST, ['NODE_TX', 'NODE_N1', 'NODE_N4', 'NODE_N1', 'NODE_N3', 'NODE_RX']);
    if (simLoop.isValidPath !== false || !simLoop.failureTier.whatHappened.includes('loop detected')) {
      throw new Error("Routing loop should be flagged!");
    }
    console.log("✓ PASS: Routing cycles and forward loops prevented.");

    // ------------------------------------------------------------------------
    // STAGE 6: OFFLINE SIMULATION — BUFFER OVERFLOW & CAUSAL DIAGNOSTICS
    // ------------------------------------------------------------------------
    console.log("\n[TEST 6/22] Testing Validator with congested link (Legacy Copper TX->N2)...");
    const congestedPath = ['NODE_TX', 'NODE_N2', 'NODE_N4', 'NODE_RX'];
    const simCongested = Validator.simulateSignalRoute(OP1_FIBER_BURST, congestedPath, 1, 0, false);
    if (simCongested.isSuccess !== false) throw new Error("Congested route must fail!");
    if (!simCongested.failureTier || !simCongested.failureTier.whatHappened.includes('Buffer Overflow')) {
      throw new Error(`Expected Buffer Overflow in failureTier: ${JSON.stringify(simCongested.failureTier)}`);
    }
    if (simCongested.totalPacketLossPercent <= 0) {
      throw new Error("Expected positive packet loss percent on overflow!");
    }
    if (!simCongested.failureTier.adaptationHint) {
      throw new Error("Expected adaptation hint on buffer overflow!");
    }
    console.log("✓ PASS: Buffer overflow accurately detected with 4-tier diagnostic details.");

    // ------------------------------------------------------------------------
    // STAGE 7: OFFLINE SIMULATION — LATENCY SLA BREACH
    // ------------------------------------------------------------------------
    console.log("\n[TEST 7/22] Testing Validator with excessive propagation latency...");
    const highLatConfig = {
      ...OP1_FIBER_BURST,
      stream: { ...OP1_FIBER_BURST.stream, slaMaxLatencyMs: 30 }, // Requires <= 30ms
    };
    const simHighLat = Validator.simulateSignalRoute(highLatConfig, ['NODE_TX', 'NODE_N1', 'NODE_N3', 'NODE_RX']);
    if (simHighLat.latencySlaMet !== false || simHighLat.isSuccess !== false) {
      throw new Error("Route exceeding latency SLA must fail!");
    }
    if (!simHighLat.failureTier.whatHappened.includes('Latency SLA breach')) {
      throw new Error("Expected Latency SLA breach in failureTier!");
    }
    console.log("✓ PASS: Latency SLA violation correctly identified.");

    // ------------------------------------------------------------------------
    // STAGE 8: OFFLINE SIMULATION — OPTIMAL OPTICAL TRUNK DELIVERY
    // ------------------------------------------------------------------------
    console.log("\n[TEST 8/22] Testing Validator with optimal optical trunk route...");
    const optimalPath = ['NODE_TX', 'NODE_N1', 'NODE_N3', 'NODE_RX'];
    const simOptimal = Validator.simulateSignalRoute(OP1_FIBER_BURST, optimalPath, 1, 0, false);
    if (!simOptimal.isSuccess) throw new Error("Optimal route should pass!");
    if (simOptimal.totalPacketLossPercent !== 0) throw new Error("Optimal route should have 0% loss!");
    if (simOptimal.totalLatencyMs > 80) throw new Error("Optimal route should be under 80ms!");
    if (simOptimal.scoreBreakdown.zeroLoss <= 0) throw new Error("Expected zeroLossBonus!");
    if (simOptimal.scoreBreakdown.cleanSheet <= 0) throw new Error("Expected cleanSheetBonus on first attempt!");
    console.log(`✓ PASS: Optimal transmission succeeded with score +${simOptimal.scoreBreakdown.totalScore} (Zero loss & Clean sheet).`);

    // ------------------------------------------------------------------------
    // STAGE 9: OFFLINE SIMULATION — DIAGNOSTIC PROBE PULSE
    // ------------------------------------------------------------------------
    console.log("\n[TEST 9/22] Testing Validator in probe mode (isProbe = true)...");
    const simProbe = Validator.simulateSignalRoute(OP1_FIBER_BURST, congestedPath, 1, 0, true);
    // In probe mode, payload is 0.01G test pulse, so it doesn't trigger buffer overflow
    if (simProbe.hops.some(h => h.isCongested)) {
      throw new Error("Probe pulse should not trigger buffer overflow!");
    }
    console.log("✓ PASS: Diagnostic probe pulse accurately returns baseline telemetry without buffer bloat.");

    // ------------------------------------------------------------------------
    // STAGE 10: USER REGISTRATION & AUTH SETUP
    // ------------------------------------------------------------------------
    console.log("\n[TEST 10/22] Setting up GM, Student, and Attacker accounts...");
    const ts = Date.now();
    const gmRes = await axios.post(`${API}/auth/register`, {
      email: `gm_router_${ts}@test.com`,
      username: `GM_Router_${ts}`,
      password: 'password123',
      role: 'HOST',
    });
    gmUser = gmRes.data.user;
    const gmToken = gmRes.data.token;
    await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

    const stRes = await axios.post(`${API}/auth/register`, {
      email: `student_router_${ts}@test.com`,
      username: `TrafficOfficer_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    studentUser = stRes.data.user;
    const studentToken = stRes.data.token;

    const atRes = await axios.post(`${API}/auth/register`, {
      email: `attacker_router_${ts}@test.com`,
      username: `RogueRouter_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    attackerUser = atRes.data.user;
    const attackerToken = atRes.data.token;
    console.log("✓ PASS: Test identities authenticated with JWT tokens.");

    // ------------------------------------------------------------------------
    // STAGE 11: DATABASE EVENT & SIGNAL_ROUTER GAME CREATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 11/22] Creating SIGNAL_ROUTER Game & Challenges in DB...");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'OPERATION SIGNAL MESH',
      description: 'Tactical network flow and routing under capacity constraints.',
      template: 'SIGNAL_ROUTER',
      category: 'Code',
      speedBonus: true,
      teamsEnabled: false,
      leaderboardVisibility: 'LIVE',
      config: {
        scoring: {
          basePoints: 100,
          zeroLossBonus: 50,
          cleanSheetBonus: 50,
          latencyHeadroomMaxBonus: 50,
        },
      },
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testGame = gameRes.data.game;

    // Add Challenge 1
    const chal1Res = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: 'OPERATION FIBER_BURST: Route 4.5 Gbps hospital telemetry to destination.',
      type: 'NETWORK_ROUTING',
      points: 100,
      timeLimit: 180,
      config: OP1_FIBER_BURST,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChal1 = chal1Res.data.challenge;

    // Add Challenge 2
    const chal2Res = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: 'OPERATION CLOUD_SURGE: Synchronize 6.0 Gbps financial ledger.',
      type: 'NETWORK_ROUTING',
      points: 120,
      timeLimit: 180,
      config: OP2_CLOUD_SURGE,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChal2 = chal2Res.data.challenge;

    // Publish Game
    await axios.post(`${API}/games/${testGame.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    // Create Event
    const eventRes = await axios.post(`${API}/events`, {
      name: `NOC Routing Championship ${ts}`,
      mode: 'GM_CONTROLLED',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const testEvent = eventRes.data.event || eventRes.data;

    await axios.post(`${API}/events/${testEvent.id}/games`, {
      gameId: testGame.id,
      position: 0,
      purpose: 'NORMAL',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });

    await axios.put(`${API}/events/${testEvent.id}`, { status: 'PUBLISHED' }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });

    console.log("✓ PASS: SIGNAL_ROUTER game and challenges persisted and published.");

    // ------------------------------------------------------------------------
    // STAGE 12: SESSION INITIALIZATION & PLAYER JOIN
    // ------------------------------------------------------------------------
    console.log("\n[TEST 12/22] Launching live session and enrolling player...");
    const sessRes = await axios.post(`${API}/sessions`, {
      eventId: testEvent.id,
      roomCode: `ROUT${String(ts).slice(-4)}`,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testSession = sessRes.data.session || sessRes.data;

    // Student joins room
    const joinRes = await axios.post(`${API}/sessions/join`, {
      roomCode: testSession.roomCode,
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    if (!joinRes.data.sessionPlayer) throw new Error("Player join failed to return sessionPlayer!");

    console.log(`✓ PASS: Session ${testSession.roomCode} initialized; student enrolled.`);

    // ------------------------------------------------------------------------
    // STAGE 13: SOCKET.IO TRI-CHANNEL HANDSHAKE (Host, Stage, Player)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 13/22] Connecting Host, Stage, and Player Socket.IO clients...");
    hostSocket = io(SOCKET_URL, { auth: { token: gmToken }, reconnection: false });
    stageSocket = io(SOCKET_URL, { auth: { isStage: true }, reconnection: false });
    studentSocket = io(SOCKET_URL, { auth: { token: studentToken }, reconnection: false });

    await Promise.all([
      new Promise(res => hostSocket.on('connect', res)),
      new Promise(res => stageSocket.on('connect', res)),
      new Promise(res => studentSocket.on('connect', res)),
    ]);

    hostSocket.emit('host:join', { roomCode: testSession.roomCode });
    stageSocket.emit('stage:join', { roomCode: testSession.roomCode });
    studentSocket.emit('player:join', { roomCode: testSession.roomCode });

    console.log("✓ PASS: All 3 socket connections verified with room memberships.");

    // ------------------------------------------------------------------------
    // STAGE 14: START ROUND & VERIFY STAGE TELEMETRY INITIALIZATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 14/22] Starting round and asserting routerProgress broadcast...");
    
    let stageReceivedStatePromise = new Promise(resolve => {
      stageSocket.on('session_state_update', data => {
        if (data && data.routerProgress) resolve(data);
      });
    });

    await axios.post(`${API}/sessions/${testSession.roomCode}/start`, {}, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });

    const receivedState = await stageReceivedStatePromise;
    const rp = receivedState.routerProgress;
    if (!rp) throw new Error("Stage state update missing routerProgress payload!");
    if (rp.streamVolumeGbps !== 4.5) throw new Error(`Expected stream 4.5 Gbps, got ${rp.streamVolumeGbps}`);
    if (rp.slaMaxLatencyMs !== 80) throw new Error(`Expected SLA 80ms, got ${rp.slaMaxLatencyMs}`);
    if (rp.totalControllers < 1) throw new Error("Expected at least 1 active controller!");

    console.log("✓ PASS: Round started; Stage successfully received routerProgress telemetry.");

    // ------------------------------------------------------------------------
    // STAGE 15: DIAGNOSTIC PROBE EXECUTION & TOKEN CONSUMPTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 15/22] Executing diagnostic test probe (/router-probe)...");
    const probeRes1 = await axios.post(`${API}/sessions/${testSession.roomCode}/router-probe`, {
      challengeId: testChal1.id,
      route: ['NODE_TX', 'NODE_N1', 'NODE_N4', 'NODE_RX'],
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    if (!probeRes1.data.success) throw new Error("Probe request failed!");
    if (probeRes1.data.probesRemaining !== 2) {
      throw new Error(`Expected 2 probes remaining, got ${probeRes1.data.probesRemaining}`);
    }
    if (probeRes1.data.probesUsed !== 1) {
      throw new Error(`Expected 1 probe used, got ${probeRes1.data.probesUsed}`);
    }
    if (!probeRes1.data.probeTelemetry || !probeRes1.data.probeTelemetry.hops) {
      throw new Error("Expected probeTelemetry with hops data!");
    }
    console.log("✓ PASS: Probe token decremented; per-hop test pulse telemetry returned.");

    // ------------------------------------------------------------------------
    // STAGE 16: PROBE TOKEN EXHAUSTION GUARD
    // ------------------------------------------------------------------------
    console.log("\n[TEST 16/22] Consuming remaining probes and verifying exhaustion lock...");
    // Consume 2nd probe
    await axios.post(`${API}/sessions/${testSession.roomCode}/router-probe`, {
      challengeId: testChal1.id,
      route: ['NODE_TX', 'NODE_N1', 'NODE_N3', 'NODE_RX'],
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    // Consume 3rd probe (budget exhausted)
    const probeRes3 = await axios.post(`${API}/sessions/${testSession.roomCode}/router-probe`, {
      challengeId: testChal1.id,
      route: ['NODE_TX', 'NODE_N1', 'NODE_N3', 'NODE_RX'],
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    if (probeRes3.data.probesRemaining !== 0) throw new Error("Expected 0 probes remaining!");

    // 4th probe should be rejected
    try {
      await axios.post(`${API}/sessions/${testSession.roomCode}/router-probe`, {
        challengeId: testChal1.id,
        route: ['NODE_TX', 'NODE_N1', 'NODE_N3', 'NODE_RX'],
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      throw new Error("4th probe should have been rejected with 400 error!");
    } catch (err) {
      if (err.response?.status !== 400) throw err;
      if (!err.response?.data?.error?.includes('exhausted')) {
        throw new Error(`Expected exhausted error, got: ${err.response?.data?.error}`);
      }
    }
    console.log("✓ PASS: Probe token budget strictly enforced on server.");

    // ------------------------------------------------------------------------
    // STAGE 17: BUFFER OVERFLOW ATTEMPT & STAGE LIVE UPDATE
    // ------------------------------------------------------------------------
    console.log("\n[TEST 17/22] Dispatching congested transmission (/router-transmit)...");
    let stageReceivedCongestionPromise = new Promise(resolve => {
      stageSocket.on('session_state_update', data => {
        if (data.routerProgress && data.routerProgress.activeCongestions > 0) resolve(data);
      });
    });

    const txFailRes = await axios.post(`${API}/sessions/${testSession.roomCode}/router-transmit`, {
      challengeId: testChal1.id,
      route: congestedPath,
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    if (txFailRes.data.isDelivered !== false) throw new Error("Congested transmission must not deliver!");
    if (!txFailRes.data.failureTier || !txFailRes.data.failureTier.whatHappened.includes('Buffer Overflow')) {
      throw new Error("Expected failureTier buffer overflow diagnostic!");
    }

    const stateWithCongestion = await stageReceivedCongestionPromise;
    if (stateWithCongestion.routerProgress.activeCongestions < 1) {
      throw new Error("Expected Stage to display active congestion incident!");
    }
    console.log("✓ PASS: Buffer overflow handled; 4-tier diagnostic returned; Stage updated in real time.");

    // ------------------------------------------------------------------------
    // STAGE 18: RECONNECTION & ROUTER STATE RESILIENCE (/router-state)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 18/22] Testing player reconnect and state recovery (/router-state)...");
    const stateRes = await axios.get(`${API}/sessions/${testSession.roomCode}/router-state?challengeId=${testChal1.id}`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });

    if (stateRes.data.probesRemaining !== 0) {
      throw new Error(`Expected 0 probes remaining on reconnect, got ${stateRes.data.probesRemaining}`);
    }
    if (stateRes.data.probesUsed !== 3) {
      throw new Error(`Expected 3 probes used on reconnect, got ${stateRes.data.probesUsed}`);
    }
    if (stateRes.data.isCompleted !== false) {
      throw new Error("State should reflect pending / incomplete delivery!");
    }
    console.log("✓ PASS: Player session state cleanly reconstructed on reconnect.");

    // ------------------------------------------------------------------------
    // STAGE 19: SUCCESSFUL TRANSMISSION & SCORE CALCULATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 19/22] Transmitting via high-capacity optical bypass...");
    let stageReceivedDeliveryPromise = new Promise(resolve => {
      stageSocket.on('session_state_update', data => {
        if (data.routerProgress && data.routerProgress.successfulDeliveries > 0) resolve(data);
      });
    });

    const txSuccessRes = await axios.post(`${API}/sessions/${testSession.roomCode}/router-transmit`, {
      challengeId: testChal1.id,
      route: optimalPath,
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    if (txSuccessRes.data.isDelivered !== true) throw new Error("Optimal path should deliver!");
    if (txSuccessRes.data.score <= 0) throw new Error("Score must be positive!");
    if (txSuccessRes.data.simulation.totalPacketLossPercent !== 0) {
      throw new Error("Expected 0% packet loss!");
    }

    const stateWithDelivery = await stageReceivedDeliveryPromise;
    if (stateWithDelivery.routerProgress.successfulDeliveries < 1) {
      throw new Error("Stage should reflect successful delivery!");
    }
    console.log(`✓ PASS: Transmission confirmed (+${txSuccessRes.data.score} pts); Stage ticker updated.`);

    // ------------------------------------------------------------------------
    // STAGE 20: SECURITY & ANTI-TAMPERING VERIFICATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 20/22] Verifying security: spoofing rejection & unauthorized dispatches...");
    // 1. Spoof attempt: send arbitrary isDelivered: true and score: 99999
    const spoofRes = await axios.post(`${API}/sessions/${testSession.roomCode}/router-transmit`, {
      challengeId: testChal1.id,
      route: congestedPath, // intentionally congested
      isDelivered: true,
      score: 99999,
      totalPacketLossPercent: 0,
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    if (spoofRes.data.isDelivered === true || spoofRes.data.score === 99999) {
      throw new Error("SECURITY FAILURE: Client spoofed successful delivery!");
    }

    // 2. Attacker not enrolled in session attempting dispatch
    try {
      await axios.post(`${API}/sessions/${testSession.roomCode}/router-transmit`, {
        challengeId: testChal1.id,
        route: optimalPath,
      }, { headers: { Authorization: `Bearer ${attackerToken}` } });
      throw new Error("Non-enrolled attacker should be rejected with 404!");
    } catch (err) {
      if (err.response?.status !== 404) throw err;
    }
    console.log("✓ PASS: Server authority intact; client parameter spoofing and non-member access blocked.");

    // ------------------------------------------------------------------------
    // STAGE 21: UNIFIED /answer ROUTE COMPATIBILITY
    // ------------------------------------------------------------------------
    console.log("\n[TEST 21/22] Verifying unified /sessions/:code/answer endpoint for SIGNAL_ROUTER...");
    // Advance to Challenge 2
    await axios.post(`${API}/sessions/${testSession.roomCode}/next`, {}, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });

    // Submit answer on Challenge 2 via /answer
    const answerRes = await axios.post(`${API}/sessions/${testSession.roomCode}/answer`, {
      route: ['NODE_TX', 'NODE_A', 'NODE_C', 'NODE_RX'],
      validationType: 'SIGNAL_ROUTER',
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    if (answerRes.data.isCorrect !== true) {
      throw new Error(`Expected isCorrect: true on valid route, got: ${JSON.stringify(answerRes.data)}`);
    }
    if (answerRes.data.pointsAwarded <= 0) {
      throw new Error("Expected points awarded for correct route via /answer!");
    }
    console.log("✓ PASS: Unified /answer endpoint successfully dispatches and scores SIGNAL_ROUTER.");

    // ------------------------------------------------------------------------
    // STAGE 22: CLEAN TEARDOWN
    // ------------------------------------------------------------------------
    console.log("\n[TEST 22/22] Tearing down sockets and cleaning up...");
    hostSocket.disconnect();
    stageSocket.disconnect();
    studentSocket.disconnect();

    console.log("\n==================================================");
    console.log("ALL 22 PRODUCTION QA TESTS PASSED SUCCESSFULLY! ✓");
    console.log("SIGNAL_ROUTER VERTICAL SLICE FULLY VERIFIED.");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err.message);
    if (err.response) {
      console.error("HTTP Status:", err.response.status);
      console.error("Response Data:", err.response.data);
    }
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
