const axios = require('axios');
const { io } = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const assert = require('assert');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runMultiplayerIsolationTest() {
  console.log('====================================================');
  console.log('STARTING MULTIPLAYER ISOLATION VERIFICATION TEST');
  console.log('====================================================\n');

  const salt = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6);

  // 1. Setup GM
  const gmRes = await axios.post(`${API}/auth/register`, {
    email: `gm_mp_${salt}@test.com`,
    username: `GM_MP_${salt}`,
    password: 'password123',
    role: 'HOST'
  });
  const gmToken = gmRes.data.token;
  const gmId = gmRes.data.user.id;
  await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });
  const gmAuth = { headers: { Authorization: `Bearer ${gmToken}` } };

  // 2. Setup Student 1 and Student 2 (Completely independent accounts)
  const s1Res = await axios.post(`${API}/auth/register`, {
    email: `student1_mp_${salt}@test.com`,
    username: `Student1_MP_${salt}`,
    password: 'password123',
    role: 'PLAYER'
  });
  const s1Token = s1Res.data.token;
  const s1Id = s1Res.data.user.id;
  const s1Auth = { headers: { Authorization: `Bearer ${s1Token}` } };

  const s2Res = await axios.post(`${API}/auth/register`, {
    email: `student2_mp_${salt}@test.com`,
    username: `Student2_MP_${salt}`,
    password: 'password123',
    role: 'PLAYER'
  });
  const s2Token = s2Res.data.token;
  const s2Id = s2Res.data.user.id;
  const s2Auth = { headers: { Authorization: `Bearer ${s2Token}` } };

  console.log(`✓ Accounts initialized: GM, Student 1 (${s1Res.data.user.username}), Student 2 (${s2Res.data.user.username})`);

  // 3. Create a Game & Challenges
  const gameRes = await axios.post(`${API}/games`, {
    name: `Multiplayer Test Game ${salt}`,
    template: 'QUIZ',
    description: 'Isolation test',
  }, gmAuth);
  const gameId = gameRes.data.game.id;

  const chal1Res = await axios.post(`${API}/games/${gameId}/challenges`, {
    prompt: 'Question 1: What is 2 + 2?',
    type: 'SINGLE_CHOICE',
    points: 50,
    options: ['3', '4', '5', '6'],
    answer: '4'
  }, gmAuth);
  const challenge1 = chal1Res.data.challenge;

  const chal2Res = await axios.post(`${API}/games/${gameId}/challenges`, {
    prompt: 'Question 2: What is 5 * 5?',
    type: 'SINGLE_CHOICE',
    points: 100,
    options: ['20', '25', '30'],
    answer: '25'
  }, gmAuth);
  const challenge2 = chal2Res.data.challenge;

  await axios.post(`${API}/games/${gameId}/publish`, {}, gmAuth);

  // 4. Create Event & Session
  const eventRes = await axios.post(`${API}/events`, {
    name: `MP Isolation Event ${salt}`,
    mode: 'GM_CONTROLLED'
  }, gmAuth);
  const eventId = eventRes.data.id;
  await axios.post(`${API}/events/${eventId}/games`, { gameId, position: 0, purpose: 'NORMAL' }, gmAuth);
  await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, gmAuth);

  const sessionRes = await axios.post(`${API}/sessions`, { eventId }, gmAuth);
  const roomCode = sessionRes.data.session.roomCode;
  console.log(`✓ Room created: ${roomCode}`);

  // 5. Connect Sockets for Host, Student 1, Student 2
  const hostSocket = io(SOCKET_URL, { auth: { token: gmToken } });
  const s1Socket = io(SOCKET_URL, { auth: { token: s1Token } });
  const s2Socket = io(SOCKET_URL, { auth: { token: s2Token } });

  await Promise.all([
    new Promise(res => hostSocket.on('connect', res)),
    new Promise(res => s1Socket.on('connect', res)),
    new Promise(res => s2Socket.on('connect', res)),
  ]);

  hostSocket.emit('host:join', { roomCode });
  s1Socket.emit('player:join', { roomCode });
  s2Socket.emit('player:join', { roomCode });

  // Both join session via API
  await axios.post(`${API}/sessions/join`, { roomCode }, s1Auth);
  await axios.post(`${API}/sessions/join`, { roomCode }, s2Auth);
  console.log('✓ Both students joined room via API and connected to isolated sockets');

  // Track socket broadcasts received by S1 and S2
  const s1Broadcasts = [];
  const s2Broadcasts = [];
  s1Socket.on('session_state_update', (d) => s1Broadcasts.push(d));
  s2Socket.on('session_state_update', (d) => s2Broadcasts.push(d));

  // 6. Host starts Game & selects Challenge 1
  hostSocket.emit('host:start_game', { gameId });
  await wait(500);
  hostSocket.emit('host:select_challenge', { challengeId: challenge1.id });
  await wait(500);

  // Verify safe session state does not leak correct answer to either student
  const s1State = (await axios.get(`${API}/sessions/${roomCode}`, s1Auth)).data;
  const s2State = (await axios.get(`${API}/sessions/${roomCode}`, s2Auth)).data;

  const s1Chal = s1State.currentChallenge || s1State.currentGame?.challenges?.find(c => c.id === s1State.session?.currentChallengeId) || s1State.currentGame?.challenges?.[0];
  const s2Chal = s2State.currentChallenge || s2State.currentGame?.challenges?.find(c => c.id === s2State.session?.currentChallengeId) || s2State.currentGame?.challenges?.[0];

  assert(s1Chal, 'CHECK 1: Challenge is present for S1');
  assert(s2Chal, 'CHECK 2: Challenge is present for S2');
  assert(!s1Chal.config?.answer && !s1Chal.answer, 'CHECK 3: S1 sanitized state does not leak answer');
  assert(!s2Chal.config?.answer && !s2Chal.answer, 'CHECK 4: S2 sanitized state does not leak answer');
  assert.strictEqual(s1Chal.prompt, 'Question 1: What is 2 + 2?', 'CHECK 5: Question rendered for S1');
  assert.strictEqual(s2Chal.prompt, 'Question 1: What is 2 + 2?', 'CHECK 6: Question rendered for S2');
  console.log('✓ Sanitized question broadcast verified; no answer leakage');

  // 7. Student 1 submits answer '4' (Correct -> 50 pts)
  const s1Submit = await axios.post(`${API}/sessions/active/submit`, { answer: '4' }, s1Auth);
  assert.strictEqual(s1Submit.data.isCorrect, true, 'CHECK 5: S1 answer correct');
  assert.strictEqual(s1Submit.data.pointsAwarded, 50, 'CHECK 6: S1 awarded 50 pts');
  console.log('✓ Student 1 submitted correct answer');

  await wait(600);

  // Verify Student 2 receives updated leaderboard with S1 at 50, but S2 score is 0
  const s2LatestState = (await axios.get(`${API}/sessions/${roomCode}`, s2Auth)).data;
  const s1LbEntry = s2LatestState.leaderboard.find(e => e.name === s1Res.data.user.username);
  const s2LbEntry = s2LatestState.leaderboard.find(e => e.name === s2Res.data.user.username);

  assert(s1LbEntry && s1LbEntry.score === 50, 'CHECK 7: S2 sees S1 score of 50 on leaderboard');
  assert(!s2LbEntry || s2LbEntry.score === 0, 'CHECK 8: S2 has no leaked points (either absent from leaderboard or 0)');

  // Check that S2 did not receive S1 submission details in socket broadcasts
  const leakedToS2 = s2Broadcasts.some(b => b.lastSubmission && b.lastSubmission.playerId === s1Id);
  assert(!leakedToS2, 'CHECK 9: Private submission payload was NOT leaked to Student 2 socket');
  console.log('✓ Public leaderboard updated; private submission payload isolated from Student 2');

  // 8. Student 2 submits answer '3' (Incorrect -> 0 pts)
  const s2Submit = await axios.post(`${API}/sessions/active/submit`, { answer: '3' }, s2Auth);
  assert.strictEqual(s2Submit.data.isCorrect, false, 'CHECK 10: S2 answer incorrect');
  assert.strictEqual(s2Submit.data.pointsAwarded, 0, 'CHECK 11: S2 awarded 0 pts');

  await wait(600);

  // Verify Leaderboard: S1 = 50, S2 = 0
  const finalLb1 = (await axios.get(`${API}/sessions/${roomCode}`, s1Auth)).data.leaderboard;
  const s1Score = finalLb1.find(e => e.name === s1Res.data.user.username)?.score;
  const s2Score = finalLb1.find(e => e.name === s2Res.data.user.username)?.score;
  assert.strictEqual(s1Score, 50, 'CHECK 12: Final leaderboard S1 has 50');
  assert.strictEqual(s2Score, 0, 'CHECK 13: Final leaderboard S2 has 0');
  console.log('✓ Scores independently calculated and isolated');

  // 9. Reconnect / Refresh Simulation
  // Disconnect S1 socket and reconnect
  s1Socket.disconnect();
  console.log('✓ Student 1 disconnected; Student 2 remains active');

  // S2 can still query session
  const s2PostDisconnect = (await axios.get(`${API}/sessions/${roomCode}`, s2Auth)).data;
  assert(s2PostDisconnect.session.roomCode === roomCode, 'CHECK 14: S2 uninterrupted by S1 disconnect');

  // S1 reconnects
  const s1ReconSocket = io(SOCKET_URL, { auth: { token: s1Token } });
  await new Promise(res => s1ReconSocket.on('connect', res));
  s1ReconSocket.emit('player:join', { roomCode });

  const s1ReconState = (await axios.get(`${API}/sessions/${roomCode}`, s1Auth)).data;
  const s1RestoredScore = s1ReconState.leaderboard.find(e => e.name === s1Res.data.user.username)?.score;
  assert.strictEqual(s1RestoredScore, 50, 'CHECK 15: S1 reconnected and verified persisted score 50');

  // Clean disconnect
  hostSocket.disconnect();
  s1ReconSocket.disconnect();
  s2Socket.disconnect();

  console.log('\n====================================================');
  console.log('ALL 15 MULTIPLAYER ISOLATION CHECKS PASSED!');
  console.log('====================================================\n');
}

runMultiplayerIsolationTest()
  .catch(err => {
    console.error('Multiplayer test failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
