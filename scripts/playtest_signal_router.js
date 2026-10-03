const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

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
      { id: 'LINK_TX_N1', from: 'NODE_TX', to: 'NODE_N1', capacityGbps: 10.0, backgroundLoadGbps: 2.0, latencyMs: 15, lossRate: 0.0 },
      { id: 'LINK_TX_N2', from: 'NODE_TX', to: 'NODE_N2', capacityGbps: 5.0, backgroundLoadGbps: 3.8, latencyMs: 10, lossRate: 0.0 },
      { id: 'LINK_N1_N3', from: 'NODE_N1', to: 'NODE_N3', capacityGbps: 10.0, backgroundLoadGbps: 1.0, latencyMs: 20, lossRate: 0.0 },
      { id: 'LINK_N1_N4', from: 'NODE_N1', to: 'NODE_N4', capacityGbps: 3.0, backgroundLoadGbps: 0.5, latencyMs: 12, lossRate: 0.0 },
      { id: 'LINK_N2_N4', from: 'NODE_N2', to: 'NODE_N4', capacityGbps: 5.0, backgroundLoadGbps: 1.2, latencyMs: 18, lossRate: 0.0 },
      { id: 'LINK_N3_RX', from: 'NODE_N3', to: 'NODE_RX', capacityGbps: 10.0, backgroundLoadGbps: 2.5, latencyMs: 15, lossRate: 0.0 },
      { id: 'LINK_N4_RX', from: 'NODE_N4', to: 'NODE_RX', capacityGbps: 4.0, backgroundLoadGbps: 0.0, latencyMs: 10, lossRate: 0.0 },
    ],
  },
  probeTokens: 3,
  scoring: {
    basePoints: 100,
    zeroLossBonus: 50,
    firstRunCleanSheetBonus: 50,
    latencyHeadroomMaxBonus: 30,
    overloadPenalty: 15,
  },
};

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`PASS: ${message}`);
}

async function runHumanPlaytest() {
  console.log('====================================================');
  console.log('SIGNAL_ROUTER — 9-STAGE HUMAN PLAYTEST SUITE');
  console.log('====================================================\n');

  const ts = Date.now();

  // Register GM
  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_sr_${ts}@terminal.test`,
    username: `Director_SR_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmToken = gmRes.data.token;
  const gmUser = gmRes.data.user;
  await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

  // Register Student 1
  const s1Res = await axios.post(`${API}/auth/register`, {
    email: `student1_sr_${ts}@terminal.test`,
    username: `Operator_Alice_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const s1Token = s1Res.data.token;
  const s1Client = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${s1Token}` } });

  // Register Student 2
  const s2Res = await axios.post(`${API}/auth/register`, {
    email: `student2_sr_${ts}@terminal.test`,
    username: `Operator_Bob_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const s2Token = s2Res.data.token;
  const s2Client = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${s2Token}` } });

  // Create Game
  const gameRes = await axios.post(`${API}/games`, {
    name: 'OPERATION FIBER_BURST',
    description: 'Emergency Hospital Telemetry Mesh Routing',
    template: 'SIGNAL_ROUTER',
    category: 'NETWORKS',
    config: OP1_FIBER_BURST,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const game = gameRes.data.game;

  // Create Challenge
  const chalRes = await axios.post(`${API}/games/${game.id}/challenges`, {
    prompt: 'Route the 4.5 Gbps medical telemetry stream from TX to RX without exceeding link bandwidth or SLA latency.',
    type: 'NETWORK_ROUTING',
    points: 100,
    timeLimit: 300,
    config: OP1_FIBER_BURST,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const challenge = chalRes.data.challenge;

  // Publish
  await axios.post(`${API}/games/${game.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  // Event
  const eventRes = await axios.post(`${API}/events`, {
    name: `Network Ops Trials ${ts}`,
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
  console.log(`Live Session Created: Room Code [${roomCode}]`);

  // Both students join
  await s1Client.post('/sessions/join', { roomCode });
  await s2Client.post('/sessions/join', { roomCode });

  // Start round
  await axios.post(`${API}/sessions/${roomCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  // ============================================================================
  // STAGE 1: JOIN / FIRST IMPRESSION & STATE INITIALIZATION
  // ============================================================================
  console.log('\n--- STAGE 1: JOIN & FIRST IMPRESSION ---');
  const initState = await s1Client.get(`/sessions/${roomCode}/router-state?challengeId=${challenge.id}`);
  assert(initState.status === 200, '[1.1] Initial router-state query returned 200 OK');
  assert(initState.data.stream.payloadVolumeGbps === 4.5, '[1.2] Stream volume is 4.5 Gbps');
  assert(initState.data.stream.slaMaxLatencyMs === 80, '[1.3] Max latency SLA is 80 ms');
  assert(initState.data.probesRemaining === 3, '[1.4] Initial probe budget is 3 tokens');
  assert(initState.data.isCompleted === false, '[1.5] Game starts in uncompleted status');
  assert(initState.data.graph.sourceNodeId === 'NODE_TX', '[1.6] Source ingress is NODE_TX');
  assert(initState.data.graph.targetNodeId === 'NODE_RX', '[1.7] Destination egress is NODE_RX');

  // ============================================================================
  // STAGE 2: TOPOLOGY & LINK HEADROOM ANALYSIS
  // ============================================================================
  console.log('\n--- STAGE 2: TOPOLOGY & LINK HEADROOM ANALYSIS ---');
  const links = initState.data.graph.links;
  const nodes = initState.data.graph.nodes;
  assert(nodes.length === 6, '[2.1] Exactly 6 network switches/gateways in mesh');
  assert(links.length === 7, '[2.2] Exactly 7 interconnecting links configured');

  // Check Link TX->N2 legacy copper headroom
  const linkCopper = links.find(l => l.from === 'NODE_TX' && l.to === 'NODE_N2');
  const copperHeadroom = Number((linkCopper.capacityGbps - linkCopper.backgroundLoadGbps).toFixed(1));
  assert(copperHeadroom === 1.2, `[2.3] Copper link TX->N2 headroom is 1.2 Gbps (Capacity: 5.0, Load: 3.8)`);
  assert(copperHeadroom < 4.5, '[2.4] Copper link cannot accommodate 4.5 Gbps stream (Deficit: 3.3 Gbps)');

  // Check Link TX->N1 optical fiber headroom
  const linkFiber = links.find(l => l.from === 'NODE_TX' && l.to === 'NODE_N1');
  const fiberHeadroom = linkFiber.capacityGbps - linkFiber.backgroundLoadGbps;
  assert(fiberHeadroom === 8.0, `[2.5] Fiber link TX->N1 headroom is 8.0 Gbps (Capacity: 10.0, Load: 2.0)`);
  assert(fiberHeadroom >= 4.5, '[2.6] Fiber link easily supports 4.5 Gbps stream');

  // ============================================================================
  // STAGE 3: SHORTEST-PATH TRAP (Failure Case 1: Buffer Overflow)
  // ============================================================================
  console.log('\n--- STAGE 3: SHORTEST-PATH TRAP (Buffer Overflow) ---');
  // Student naively takes 3-hop shortest route: TX -> N2 -> N4 -> RX
  const shortestPath = ['NODE_TX', 'NODE_N2', 'NODE_N4', 'NODE_RX'];
  const txShortestRes = await s1Client.post(`/sessions/${roomCode}/router-transmit`, {
    challengeId: challenge.id,
    route: shortestPath,
  });

  assert(txShortestRes.status === 200, '[3.1] Transmit request handled by server');
  assert(txShortestRes.data.isDelivered === false, '[3.2] Shortest-path transmission failed (Buffer Overflow)');
  assert(txShortestRes.data.failureTier !== null, '[3.3] 4-Tier failure diagnostic report returned');
  assert(txShortestRes.data.failureTier.failingHop.from === 'NODE_TX' && txShortestRes.data.failureTier.failingHop.to === 'NODE_N2',
    '[3.4] Diagnostic pinpointed failing link [NODE_TX ➔ NODE_N2]');
  assert(txShortestRes.data.failureTier.whatHappened.includes('Buffer Overflow'),
    '[3.5] Diagnostic debrief clearly explains Buffer Overflow');
  assert(txShortestRes.data.failureTier.adaptationHint.includes('NODE_TX'),
    '[3.6] Adaptation hint directs operator toward alternate egress');

  // ============================================================================
  // STAGE 4: DIAGNOSTIC PROBING
  // ============================================================================
  console.log('\n--- STAGE 4: DIAGNOSTIC PROBING ---');
  // Student investigates candidate route: TX -> N1 -> N4 -> RX using diagnostic probe
  const probeRoute = ['NODE_TX', 'NODE_N1', 'NODE_N4', 'NODE_RX'];
  const probeRes = await s1Client.post(`/sessions/${roomCode}/router-probe`, {
    challengeId: challenge.id,
    route: probeRoute,
  });

  assert(probeRes.status === 200, '[4.1] Probe dispatch returned 200 OK');
  assert(probeRes.data.success === true, '[4.2] Diagnostic probe succeeded');
  assert(probeRes.data.probesRemaining === 2, '[4.3] Probe budget decremented from 3 to 2');
  assert(probeRes.data.probesUsed === 1, '[4.4] Probe usage tracked accurately');
  assert(probeRes.data.probeTelemetry.hops.length === 3, '[4.5] Probe returned telemetry for all 3 hops');
  
  // Inspect N1->N4 hop via probe
  const hopN1N4 = probeRes.data.probeTelemetry.hops.find(h => h.from === 'NODE_N1' && h.to === 'NODE_N4');
  assert(hopN1N4.headroomGbps === 2.5, `[4.6] Probe telemetry detected N1->N4 headroom is only 2.5 Gbps (< 4.5 Gbps stream)`);

  // ============================================================================
  // STAGE 5: SECONDARY BOTTLENECK AVOIDANCE (Failure Case 2)
  // ============================================================================
  console.log('\n--- STAGE 5: SECONDARY BOTTLENECK AVOIDANCE ---');
  // If student ignores probe and transmits TX -> N1 -> N4 -> RX
  const txMicrowaveRes = await s1Client.post(`/sessions/${roomCode}/router-transmit`, {
    challengeId: challenge.id,
    route: probeRoute,
  });
  assert(txMicrowaveRes.data.isDelivered === false, '[5.1] Transmission over constricted microwave link rejected');
  assert(txMicrowaveRes.data.failureTier.failingHop.linkId === 'LINK_N1_N4', '[5.2] Bottleneck accurately caught at LINK_N1_N4');

  // ============================================================================
  // STAGE 6: OPTIMAL HIGH-CAPACITY OPTICAL BYPASS TRANSMISSION
  // ============================================================================
  console.log('\n--- STAGE 6: OPTIMAL TRANSMISSION (SUCCESS) ---');
  // Student routes via high-speed optical bypass: TX -> N1 -> N3 -> RX
  const optimalRoute = ['NODE_TX', 'NODE_N1', 'NODE_N3', 'NODE_RX'];
  const txOptRes = await s1Client.post(`/sessions/${roomCode}/router-transmit`, {
    challengeId: challenge.id,
    route: optimalRoute,
  });

  assert(txOptRes.data.isDelivered === true, '[6.1] High-capacity optical path delivered successfully');
  assert(txOptRes.data.score > 0, `[6.2] Points awarded: ${txOptRes.data.score}`);
  assert(txOptRes.data.simulation.totalPacketLossPercent === 0, '[6.3] 0.0% Packet loss achieved');
  assert(txOptRes.data.simulation.totalLatencyMs === 50, `[6.4] Total latency is 50ms (well within 80ms SLA)`);
  assert(txOptRes.data.scoreBreakdown.base === 100, '[6.5] Base points (100) awarded');
  assert(txOptRes.data.scoreBreakdown.zeroLoss === 50, '[6.6] Zero-loss integrity bonus (+50) awarded');

  // ============================================================================
  // STAGE 7: POST-DELIVERY STATE INTEGRITY
  // ============================================================================
  console.log('\n--- STAGE 7: POST-DELIVERY STATE INTEGRITY ---');
  const postState = await s1Client.get(`/sessions/${roomCode}/router-state?challengeId=${challenge.id}`);
  assert(postState.data.isCompleted === true, '[7.1] Server-authoritative state records challenge as completed');
  assert(postState.data.score === txOptRes.data.score, '[7.2] Verified score is persisted in session');
  assert(postState.data.probesRemaining === 2, '[7.3] Remaining probe budget (2) preserved on server');
  assert(postState.data.lastRoute.join('->') === optimalRoute.join('->'), '[7.4] Committed route preserved');

  // ============================================================================
  // STAGE 8: RECONNECT & STATE RESTORATION
  // ============================================================================
  console.log('\n--- STAGE 8: RECONNECT & STATE RESTORATION ---');
  // Fresh client simulates page reload
  const reloadedClient = axios.create({ baseURL: API, headers: { Authorization: `Bearer ${s1Token}` } });
  const reloadedState = await reloadedClient.get(`/sessions/${roomCode}/router-state?challengeId=${challenge.id}`);
  assert(reloadedState.data.isCompleted === true, '[8.1] Reconnected client restores isCompleted = true');
  assert(reloadedState.data.score > 0, '[8.2] Reconnected client restores awarded score');
  assert(reloadedState.data.lastRoute.length === 4, '[8.3] Reconnected client restores full route sequence');
  assert(reloadedState.data.probesRemaining === 2, '[8.4] Reconnected client restores probe count');

  // ============================================================================
  // STAGE 9: MULTI-PLAYER ISOLATION
  // ============================================================================
  console.log('\n--- STAGE 9: MULTI-PLAYER ISOLATION ---');
  // Verify Student 2 in same session is completely independent
  const s2State = await s2Client.get(`/sessions/${roomCode}/router-state?challengeId=${challenge.id}`);
  assert(s2State.data.isCompleted === false, '[9.1] Student 2 challenge remains incomplete');
  assert(s2State.data.probesRemaining === 3, '[9.2] Student 2 has full 3 probe budget (unaffected by Student 1)');
  assert(s2State.data.probesUsed === 0, '[9.3] Student 2 has 0 probes used');
  assert(s2State.data.score === 0, '[9.4] Student 2 score is 0');
  assert(s2State.data.lastRoute.length === 0, '[9.5] Student 2 has no route committed');

  console.log('\n====================================================');
  console.log('ALL 9 HUMAN PLAYTEST STAGES COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runHumanPlaytest().catch(err => {
  console.error('Human playtest failed:', err.response?.data || err.message);
  process.exit(1);
});
