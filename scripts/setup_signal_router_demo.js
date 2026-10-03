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
  revealConcept: {
    title: 'GRAPH ROUTING & BOTTLENECK ANALYSIS',
    summary: 'The shortest route (fewest hops) is frequently a bottleneck trap. Real distributed systems prioritize link throughput, buffer headroom, and congestion minimization over geometric distance.'
  }
};

async function main() {
  const ts = Date.now();

  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_demo_${ts}@terminal.test`,
    username: `GM_Demo_${ts}`,
    password: 'password123',
    role: 'HOST',
  });
  const gmToken = gmRes.data.token;
  const gmUser = gmRes.data.user;
  await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

  const sRes = await axios.post(`${API}/auth/register`, {
    email: `student_demo_${ts}@terminal.test`,
    username: `Operator_Demo_${ts}`,
    password: 'password123',
    role: 'STUDENT',
  });
  const sToken = sRes.data.token;

  const gameRes = await axios.post(`${API}/games`, {
    name: 'SIGNAL_ROUTER LIVE NOC',
    description: 'Emergency Hospital Telemetry Mesh Routing',
    template: 'SIGNAL_ROUTER',
    category: 'NETWORKS',
    config: OP1_FIBER_BURST,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const game = gameRes.data.game;

  const chalRes = await axios.post(`${API}/games/${game.id}/challenges`, {
    prompt: 'Route the 4.5 Gbps medical telemetry stream from TX to RX without exceeding link bandwidth or SLA latency.',
    type: 'NETWORK_ROUTING',
    points: 100,
    timeLimit: 600,
    config: OP1_FIBER_BURST,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });

  await axios.post(`${API}/games/${game.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

  const eventRes = await axios.post(`${API}/events`, {
    name: `Live Signal Router Demo ${ts}`,
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

  const sessRes = await axios.post(`${API}/sessions`, {
    eventId: event.id,
  }, { headers: { Authorization: `Bearer ${gmToken}` } });
  const roomCode = sessRes.data.session?.roomCode || sessRes.data.roomCode;

  // Student joins
  await axios.post(`${API}/sessions/join`, { roomCode }, {
    headers: { Authorization: `Bearer ${sToken}` }
  });

  // Start round
  await axios.post(`${API}/sessions/${roomCode}/start`, {}, {
    headers: { Authorization: `Bearer ${gmToken}` }
  });

  console.log('DEMO_SESSION_READY');
  console.log(`ROOM_CODE: ${roomCode}`);
  console.log(`STUDENT_TOKEN: ${sToken}`);
  console.log(`URL: http://localhost:5173/play/${roomCode}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
