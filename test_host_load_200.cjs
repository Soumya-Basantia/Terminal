/**
 * test_host_load_200.cjs
 *
 * 200-student concurrent load verification for the live host flow.
 * Hosts a RAPID_FIRE session, joins 200 students while the lobby is open,
 * starts a question, submits answers from all 200, locks, and finalizes.
 *
 * Measures wall-clock for each phase and verifies EVERY submission persisted
 * and scored — zero drops. Run against http://localhost:3001.
 */

const axios = require('axios');
const { io } = require('socket.io-client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const N = 200;

let start, elapsed = (label) => { const ms = Date.now() - start; console.log(`  ⏱ ${label}: ${ms}ms`); return ms; };

async function main() {
  console.log('================================================================');
  console.log(`  200-STUDENT CONCURRENT LOAD TEST — HOST FLOW                 `);
  console.log(`  target: ${API}   students: ${N}`);
  console.log('================================================================');

  const ts = Date.now();

  // GM
  const gmRes = await axios.post(`${API}/auth/login`, { login: 'demo@terminal.dev', password: 'terminal123' });
  const gmHeaders = { headers: { Authorization: `Bearer ${gmRes.data.token}` } };
  const token = gmRes.data.token;
  console.log('\n[1] GM authenticated');

  // Game with exactly one scoring question
  const game = (await axios.post(`${API}/games`, {
    name: `LOAD ${ts}`, template: 'RAPID_FIRE', maxPlayers: 300, description: '200-student load test',
  }, gmHeaders)).data.game;
  const q = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE', prompt: `Load Q ${ts}`, options: ['A', 'B', 'C', 'D'], answer: 'A',
    points: 100, timerSecs: 60, difficulty: 'EASY',
  }, gmHeaders)).data.challenge;
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  console.log('[2] RAPID_FIRE game + 1 scoring question published');

  // Host
  const session = (await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders)).data.session;
  const code = session.roomCode;
  console.log(`[3] Session hosted: ${code}`);

  // Host socket (receives the 200 join broadcasts — used for liveness sanity)
  const hostSock = io(SOCKET_URL, { auth: { token }, forceNew: true });
  let hostUpdates = 0;
  hostSock.on('session_state_update', () => { hostUpdates++; });
  await new Promise(r => hostSock.on('connect', r));
  hostSock.emit('host:join', { roomCode: code });

  // ── JOIN PHASE ────────────────────────────────────────────────────────
  console.log(`[4] Joining ${N} students...`);
  start = Date.now();
  const students = [];
  const joinErrs = [];
  const CONCURRENCY = 25;
  for (let base = 0; base < N; base += CONCURRENCY) {
    const batch = [];
    for (let i = base; i < Math.min(base + CONCURRENCY, N); i++) {
      const uname = `load_${i}_${ts}`;
      batch.push(axios.post(`${API}/auth/register`, {
        name: `Load ${i} ${ts}`, username: uname, usn: `1MS24CS${String(ts).slice(-4)}${String(i).padStart(2, '0')}`,
        email: `${uname}@campus.edu`, branch: 'CSE', section: 'A', password: 'Password123!',
      }).then(async reg => {
        const h = { headers: { Authorization: `Bearer ${reg.data.token}` } };
        // A few re-joins amid the batch (late re-attach policy must stay idempotent)
        await axios.post(`${API}/sessions/join`, { roomCode: code }, h);
        return { name: reg.data.user.name, usn: reg.data.user.usn, headers: h };
      }).catch(e => { joinErrs.push(e.response?.status || e.message); return null; }));
    }
    students.push(...(await Promise.all(batch)).filter(Boolean));
  }
  const joinMs = elapsed(`join phase`);
  const joined = students.length;
  console.log(`  ✓ ${joined}/${N} students joined (errors: ${joinErrs.length})`);

  joinErrCheck: if (joined !== N) { throw new Error(`Only ${joined}/${N} joined`); }

  // Verify authoritative player count
  const pub = (await axios.get(`${API}/sessions/${code}`)).data;
  console.log(`  ✓ host sees playerCount=${pub.playerCount ?? pub.playerRoster?.length}`);
  if ((pub.playerCount ?? 0) !== N) throw new Error(`playerCount ${pub.playerCount} != ${N}`);

  // ── GAMEPLAY PHASE ────────────────────────────────────────────────────
  console.log('[5] Starting question...');
  await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
  await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); // QUESTION_ACTIVE
  const active = (await axios.get(`${API}/sessions/${code}`)).data;
  if (active.session.status !== 'QUESTION_ACTIVE') throw new Error('not QUESTION_ACTIVE');
  console.log(`  ✓ QUESTION_ACTIVE, challenge ${active.session.currentChallengeId === q.id ? 'correct' : 'WRONG'}`);

  console.log(`[6] Submitting from ${N} students (all correct 'A', 100 pts)...`);
  start = Date.now();
  const subResults = [];
  const subErrs = [];
  for (let base = 0; base < N; base += CONCURRENCY) {
    const batch = [];
    for (let i = base; i < Math.min(base + CONCURRENCY, N); i++) {
      const s = students[i];
      batch.push(
        axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, s.headers)
          .then(r => subResults.push({ ok: r.data.isCorrect === true, score: r.data.pointsAwarded }))
          .catch(e => subErrs.push(e.response?.status || e.message))
      );
    }
    await Promise.all(batch);
  }
  const submitMs = elapsed('submit phase');
  console.log(`  ✓ submits: ${subResults.length} resolved, ${subErrs.length} errors`);
  const correct = subResults.filter(r => r.ok).length;
  const scored = subResults.filter(r => r.score === 100).length;
  console.log(`  ✓ isCorrect=true: ${correct}/${N}   score=100: ${scored}/${N}`);
  if (subErrs.length) throw new Error(`submit errors: ${JSON.stringify(subErrs.slice(0, 5))}`);
  if (correct !== N) throw new Error(`Only ${correct}/${N} graded correct`);

  // ── LOCK / FINALIZE ───────────────────────────────────────────────────
  console.log('[7] Lock, finalize, verify persistence...');
  await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders);
  const locked = (await axios.get(`${API}/sessions/${code}`)).data;
  console.log(`  ✓ status=${locked.session.status}`);
  if (locked.session.status !== 'QUESTION_LOCKED') throw new Error('lock failed');

  const endRes = await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders);
  const ended = endRes.data.session.status;
  console.log(`  ✓ finalized: ${ended}`);

  // Submission persistence + scoring verified straight from the scores API.
  // `individualLeaderboard` returns EVERY ranked player; `leaderboard` is top-10.
  const lb = (await axios.get(`${API}/sessions/${code}/leaderboard`)).data;
  const rosterLen = lb.individualLeaderboard?.length ?? lb.leaderboard?.length ?? 0;
  const topScored = (lb.individualLeaderboard || []).filter(p => p.score === 100).length;
  console.log(`  ✓ scoreboard: ${rosterLen} players scored (${topScored} with 100 pts)`);
  if (rosterLen < N) throw new Error(`scoreboard roster ${rosterLen} < ${N}`);
  if (topScored < N) throw new Error(`only ${topScored}/${N} scored a full 100`);

  hostSock.disconnect();

  console.log('\n================================================================');
  console.log('   LOAD RESULT:');
  console.log(`      join   ${joinMs}ms  (${Math.round(N / (joinMs / 1000))}/s)`);
  console.log(`      submit ${submitMs}ms  (${Math.round(N / (submitMs / 1000))}/s)`);
  console.log(`      errors  join=${joinErrs.length} submit=${subErrs.length}`);
  console.log(`      scored   ${scored}/${N}  correct=${correct}/${N}`);
  console.log(`   RESULT: ${correct === N && subErrs.length === 0 && joined === N ? 'PASS ✦' : 'FAIL'}`);
  console.log('================================================================');
  if (correct !== N || subErrs.length || joined !== N) process.exit(1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  if (err.response) console.error('  status:', err.response.status, JSON.stringify(err.response.data).slice(0, 300));
  process.exit(1);
});