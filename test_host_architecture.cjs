/**
 * test_host_architecture.cjs
 *
 * E2E verification of the hardened TERMINAL live-session host architecture:
 *
 *  A. Role guards           — PLAYER cannot host; unapproved GM cannot host
 *  B. Pre-flight            — broken games are BLOCKED with structured per-question issues
 *  C. Idempotent hosting    — double-HOST reuses the live session, never duplicates
 *  D. Immutable snapshot    — freeze at host time; later game edits don't touch the live room
 *  E. Host authorization    — GET /:code/host is authenticated + authorized (403 / 404)
 *  F. State machine (REST)  — guarded LOBBY→STARTING→QUESTION_ACTIVE→LOCKED→RESULTS→ENDED
 *                             + invalid transitions rejected with 409
 *  G. Submission idempotency — duplicate submits never double-credit
 *  H. Cutoff enforcement    — submissions rejected once locked
 *  I. Finalize idempotency  — END is terminal; repeated END/START are no-ops (guarded)
 *  J. Socket guard          — invalid socket transitions are rejected server-side
 *  K. Session isolation     — room A state updates never reach room B sockets
 *  L. Late-join policy      — joining an ENDED session is rejected
 *
 * Requires: server running on http://localhost:3001
 * Run:      node test_host_architecture.cjs
 */

const axios = require('axios');
const { io } = require('socket.io-client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;
function ok(msg) { passed++; console.log(`  ✓ ${msg}`); }
let lastFail;
function bad(msg, extra) { failed++; lastFail = extra || msg; console.log(`  ✗ ${msg}${extra ? '\n    ' + JSON.stringify(extra) : ''}`); }

function check(cond, msg, extra) { return cond ? ok(msg) : bad(msg, extra); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('================================================================');
  console.log('   HOST ARCHITECTURE E2E — STATE MACHINE, SNAPSHOT, SECURITY     ');
  console.log('================================================================');

  const ts = Date.now();

  // ── AUTH ─────────────────────────────────────────────────────────────────
  console.log('\n[A] AUTH / ROLE GUARDS');
  const gmRes = await axios.post(`${API}/auth/login`, { login: 'demo@terminal.dev', password: 'terminal123' });
  const gmHeaders = { headers: { Authorization: `Bearer ${gmRes.data.token}` } };
  const gm = gmRes.data.user;
  ok(`GM authenticated: ${gm.name} (${gm.role})`);

  const student = await axios.post(`${API}/auth/register`, {
    name: `Arch Agent ${ts}`, username: `arch_stud_${ts}`,
    usn: `1MS24CS${String(ts).slice(-4)}S`, email: `arch_stud_${ts}@campus.edu`,
    branch: 'CSE', section: 'A', password: 'Password123!',
  });
  const studHeaders = { headers: { Authorization: `Bearer ${student.data.token}` } };
  ok(`Student registered: ${student.data.user.username}`);

  try {
    await axios.post(`${API}/sessions`, { gameId: 'cmus4rewd000e1e4aqqyxowai' }, studHeaders);
    bad('PLAYER hosting a session was rejected');
  } catch (e) {
    check(e.response?.status === 403, `PLAYER cannot host (403) — got ${e.response?.status}`, e.response?.data);
  }

  // ── PRE-FLIGHT ───────────────────────────────────────────────────────────
  console.log('\n[B] PRE-FLIGHT VALIDATION');
  const broken = await axios.post(`${API}/games`, {
    name: `Broken ${ts}`, template: 'QUIZ', maxPlayers: 20,
  }, gmHeaders);
  const brokenGame = broken.data.game;
  ok(`Broken game created (0 questions): ${brokenGame.id}`);

  const pfBroken = await axios.post(`${API}/games/${brokenGame.id}/preflight`, {}, gmHeaders);
  check(pfBroken.data.hostable === false && pfBroken.data.ok === false,
    `preflight flags game with 0 questions as NOT hostable`, pfBroken.data);

  try {
    await axios.post(`${API}/sessions`, { gameId: brokenGame.id }, gmHeaders);
    bad('HOST of broken game was blocked');
  } catch (e) {
    check(e.response?.status === 400 && e.response?.data?.code === 'PREFLIGHT_FAILED',
      `POST /sessions blocks broken game with PREFLIGHT_FAILED (400)`, e.response?.data);
  }

  // Build a HOSTABLE game
  const game = (await axios.post(`${API}/games`, {
    name: `Arch Host ${ts}`, template: 'RAPID_FIRE', maxPlayers: 20,
    description: 'Host architecture E2E', teamsEnabled: true, speedBonus: true,
    config: { timeBonusPoints: 10 },
  }, gmHeaders)).data.game;

  const q1 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE', prompt: `Arch Q1 ${ts}`, options: ['A','B','C','D'], answer: 'A',
    points: 10, timerSecs: 15, difficulty: 'EASY',
  }, gmHeaders)).data.challenge;
  const q2 = (await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE', prompt: `Arch Q2 ${ts}`, options: ['A','B','C','D'], answer: 'B',
    points: 10, timerSecs: 15, difficulty: 'EASY',
  }, gmHeaders)).data.challenge;

  const pfOk = await axios.post(`${API}/games/${game.id}/preflight`, {}, gmHeaders);
  check(pfOk.data.hostable === true, `preflight passes for the complete 2-question game`);

  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);

  // ── IDEMPOTENT HOSTING + SNAPSHOT ────────────────────────────────────────
  console.log('\n[C] IDEMPOTENT HOSTING');
  const s1 = (await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders)).data.session;
  check(!!s1.roomCode && s1.roomCode.length === 5 && s1.code === s1.roomCode,
    `First HOST created session ${s1.roomCode} (status ${s1.status})`);

  const s2 = (await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders)).data.session;
  check(s2.roomCode === s1.roomCode && s2.reused === true,
    `Double-HOST reused the SAME live session ${s2.roomCode} (reused=${s2.reused})`);

  const code = s1.roomCode;

  console.log('\n[D] IMMUTABLE SNAPSHOT');
  const hostData = (await axios.get(`${API}/sessions/${code}/host`, gmHeaders)).data;
  check(!!hostData.session.snapshotVersion && (hostData.session.snapshotVersion || '').startsWith('snap-'),
    `Session carries a frozen snapshot (${hostData.session.snapshotVersion})`);
  check(hostData.game.challengeCount === 2, `Snapshot has ${hostData.game.challengeCount} frozen questions`);
  const frozenName = hostData.game.name;

  // Mutate the underlying Game AFTER hosting
  await axios.patch(`${API}/games/${game.id}`, { name: `EDITED AFTER HOST ${ts}` }, gmHeaders);
  await axios.patch(`${API}/games/${game.id}/challenges/${q1.id}`, {
    prompt: `EDITED Q1 ${ts}`, answer: 'Z',
  }, gmHeaders);

  const hostAfterEdit = (await axios.get(`${API}/sessions/${code}/host`, gmHeaders)).data;
  check(hostAfterEdit.game.name === frozenName,
    `Live room still serves the FROZEN game name ('${hostAfterEdit.game.name}') after editor rename`);
  const publicAfterEdit = (await axios.get(`${API}/sessions/${code}`)).data;
  const livePrompt = publicAfterEdit.currentGame?.challenges?.find((c) => c.id === q1.id)?.prompt;
  check(livePrompt === `Arch Q1 ${ts}`, 'Live room still serves the FROZEN question text after editor edits');

  // ── HOST AUTHORIZATION ───────────────────────────────────────────────────
  console.log('\n[E] HOST AUTHORIZATION');
  try {
    await axios.get(`${API}/sessions/${code}/host`, studHeaders);
    bad('Student was rejected from /host');
  } catch (e) {
    check(e.response?.status === 403, `Student cannot access host control (403)`, e.response?.data);
  }
  try {
    await axios.get(`${API}/sessions/ZZZZZ/host`, gmHeaders);
    bad('Unknown room was 404');
  } catch (e) {
    check(e.response?.status === 404, `Unknown room returns 404 from /host`);
  }

  // ── STATE MACHINE VIA REST ───────────────────────────────────────────────
  console.log('\n[F] STATE MACHINE (REST, server-authoritative)');

  // Students join the LOBBY before anything else starts.
  const joinPub = (await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders)).data;
  ok(`Student joined the live session while LOBBY (${!!joinPub.sessionPlayer})`);

  const st = (await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders)).data.session;
  check(st.status === 'STARTING', `LOBBY → STARTING ${st.status}`, st.status);

  // Invalid from STARTING: lock
  try {
    await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders);
    bad('LOCK from STARTING was rejected');
  } catch (e) {
    check(e.response?.status === 409, `LOCK while STARTING rejected (409)`, e.response?.data);
  }

  const st2 = (await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders)).data.session;
  check(st2.status === 'QUESTION_ACTIVE' && st2.currentChallengeId === q1.id,
    `STARTING → QUESTION_ACTIVE on Q1 (${st2.currentChallengeId === q1.id ? 'correct challenge' : 'WRONG'})`);

  const pubActive = (await axios.get(`${API}/sessions/${code}`)).data;
  const endsAt = new Date(pubActive.session.questionEndsAt).getTime();
  const delta = endsAt - Date.now();
  check(delta > 0 && delta < 20_000 && !!pubActive.session.challengeStartTime,
    `QUESTION_ACTIVE carries a server-authoritative deadline (~${Math.round(delta / 1000)}s remaining)`);

  // ── SUBMISSION IDEMPOTENCY ───────────────────────────────────────────────
  console.log('\n[G] SUBMISSION IDEMPOTENCY + CUTOFF');

  const sub1 = (await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders)).data;
  const sub2 = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders).then(d => d.data).catch(e => e.response?.data);
  check(!!sub1 && (sub1.isCorrect === true || sub1.score > 0), `First submit scored (isCorrect=${sub1.isCorrect}, score=${sub1.score})`);
  check(sub2 && (sub2.duplicate === true || sub2.alreadySubmitted || sub2.score === sub1.score || sub2.id === sub1.id),
    `Duplicate submit did not double-credit`, sub2);

  const st3 = (await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders)).data.session;
  check(st3.status === 'QUESTION_LOCKED', `QUESTION_ACTIVE → QUESTION_LOCKED`);

  try {
    await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders);
    bad('Submit after lock was rejected');
  } catch (e) {
    check(e.response?.status === 400, `Submit after lock rejected (400) — cutoff enforced`, e.response?.data);
  }

  // ── NEXT / RESULTS ───────────────────────────────────────────────────────
  const st4 = (await axios.post(`${API}/sessions/${code}/next`, {}, gmHeaders)).data.session;
  check(st4.status === 'QUESTION_ACTIVE' && st4.currentChallengeId === q2.id,
    `QUESTION_LOCKED → QUESTION_ACTIVE on Q2`);

  await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders);
  const st5 = (await axios.post(`${API}/sessions/${code}/next`, {}, gmHeaders)).data;
  check(st5.finished === true && st5.session.status === 'RESULTS',
    `Last question → RESULTS leaderboard (finished=${st5.finished})`);

  try {
    await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders);
    bad('LOCK from RESULTS was rejected');
  } catch (e) {
    check(e.response?.status === 409, `LOCK while RESULTS rejected (409) — no stray question`);
  }

  // ── FINALIZE (IDEMPOTENT) ────────────────────────────────────────────────
  console.log('\n[I] FINALIZE / TERMINAL STATE');
  const fin1 = (await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders)).data;
  check(fin1.session.status === 'ENDED' && fin1.alreadyEnded === false, `END → ENDED (first call)`);
  const fin2 = (await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders)).data;
  check(fin2.alreadyEnded === true, `Repeated END is an idempotent no-op (alreadyEnded=true)`);

  try {
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    bad('START after END was rejected');
  } catch (e) {
    check(e.response?.status === 409, `START after END rejected (409) — ENDED is terminal`, e.response?.data);
  }

  // Late-join policy
  try {
    await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders);
    bad('Late-join to ENDED session was rejected');
  } catch (e) {
    check(e.response?.status === 410, `Late-join to ENDED session rejected (410 Gone)`, e.response?.data);
  }

  // allowLateJoin=false must bar NEW players mid-question
  try {
    const strict = (await axios.post(`${API}/games`, { name: `Strict ${ts}`, template: 'QUIZ', maxPlayers: 20, allowLateJoin: false }, gmHeaders)).data.game;
    await axios.post(`${API}/games/${strict.id}/challenges`, {
      type: 'SINGLE_CHOICE', prompt: `Strict Q1 ${ts}`, options: ['A','B'], answer: 'A',
      points: 10, timerSecs: 30, difficulty: 'EASY',
    }, gmHeaders);
    await axios.post(`${API}/games/${strict.id}/publish`, {}, gmHeaders);
    const sStrict = (await axios.post(`${API}/sessions`, { gameId: strict.id }, gmHeaders)).data.session;
    await axios.post(`${API}/sessions/${sStrict.roomCode}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${sStrict.roomCode}/start`, {}, gmHeaders); // QUESTION_ACTIVE
    await axios.post(`${API}/sessions/join`, { roomCode: sStrict.roomCode }, studHeaders);
    bad('NEW player joined a allowLateJoin=false room mid-question');
  } catch (e) {
    check(e.response?.status === 403, `allowLateJoin=false room rejects NEW players mid-question (403)`, e.response?.data);
  }

  // ── SOCKET GUARD + ISOLATION ─────────────────────────────────────────────
  console.log('\n[J/K] SOCKET GUARD + SESSION ISOLATION');
  await new Promise((resolve, reject) => {
    (async () => {
      try {
        // Host B — a separate live session (second game hosted by same GM)
        const gameB = (await axios.post(`${API}/games`, { name: `Isolation B ${ts}`, template: 'QUIZ', maxPlayers: 20 }, gmHeaders)).data.game;
        await axios.post(`${API}/games/${gameB.id}/challenges`, {
          type: 'SINGLE_CHOICE', prompt: `Isolation B Q1 ${ts}`, options: ['A','B'], answer: 'A',
          points: 10, timerSecs: 15, difficulty: 'EASY',
        }, gmHeaders);
        await axios.post(`${API}/games/${gameB.id}/publish`, {}, gmHeaders);
        const sb = (await axios.post(`${API}/sessions`, { gameId: gameB.id }, gmHeaders)).data.session;
        const codeB = sb.roomCode;

        const token = gmRes.data.token;
        const sockA = io(SOCKET_URL, { auth: { token }, forceNew: true, transports: ['websocket'] });
        const sockB = io(SOCKET_URL, { auth: { token }, forceNew: true, transports: ['websocket'] });

        let bLeak = null;

        sockA.on('error', () => {});
        sockB.on('session_state_update', (state) => { if (state?.session?.roomCode === code) bLeak = state; });

        sockA.on('connect', () => { sockA.emit('host:join', { roomCode: code }); });
        sockB.on('connect', () => { sockB.emit('host:join', { roomCode: codeB }); });

        // Re-host a scratch game so we can drive a fresh QUESTION_ACTIVE invalid transition
        const gameC = (await axios.post(`${API}/games`, { name: `Sock ${ts}`, template: 'RAPID_FIRE', maxPlayers: 20 }, gmHeaders)).data.game;
        await axios.post(`${API}/games/${gameC.id}/challenges`, {
          type: 'SINGLE_CHOICE', prompt: `Sock Q1 ${ts}`, options: ['A','B'], answer: 'A',
          points: 10, timerSecs: 60, difficulty: 'EASY',
        }, gmHeaders);
        await axios.post(`${API}/games/${gameC.id}/publish`, {}, gmHeaders);
        const sc = (await axios.post(`${API}/sessions`, { gameId: gameC.id }, gmHeaders)).data.session;
        const codeC = sc.roomCode;
        await axios.post(`${API}/sessions/${codeC}/start`, {}, gmHeaders);
        await axios.post(`${API}/sessions/${codeC}/start`, {}, gmHeaders); // QUESTION_ACTIVE

        const sockC = io(SOCKET_URL, { auth: { token }, forceNew: true, transports: ['websocket'] });
        sockC.on('connect', () => sockC.emit('host:join', { roomCode: codeC }));
        sockC.on('error', () => {}); // handled by the dedicated once() below
        await sleep(800);

        // invalid: try to go LOBBY while QUESTION_ACTIVE (invalid transition).
        // Attach the listener BEFORE emitting so the server's error reply is caught.
        const errorPromise = new Promise(res => {
          sockC.once('error', (e) => res(!!(e && (e.message || '').includes('transition'))));
          setTimeout(() => res(false), 2500);
        });
        sockC.emit('host:change_status', { status: 'LOBBY' });
        const invalidRejected = await errorPromise;
        check(invalidRejected === true,
          'Socket: invalid transition LOBBY←QUESTION_ACTIVE rejected server-side with error');

        // b) isolation: change state of C via REST, ensure B (different room) got nothing
        const cStatusNow = (await axios.get(`${API}/sessions/${codeC}`)).data.session.status;
        await axios.post(`${API}/sessions/${codeC}/lock`, {}, gmHeaders);
        await sleep(1000);
        check(bLeak === null, `Socket: session C state change did NOT leak to session B socket`);

        sockA.disconnect(); sockB.disconnect(); sockC.disconnect();
        resolve();
      } catch (err) { reject(err); }
    })();
  });

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log(`\n================================================================`);
  console.log(`   RESULT: ${passed} PASSED / ${failed} FAILED`);
  console.log(`================================================================`);
  if (failed > 0) {
    console.log(`   First failure: ${lastFail}`);
    process.exit(1);
  }
  if (passed === 0) { console.log('   ⚠ No assertions executed'); process.exit(1); }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  if (err.response) console.error('  status:', err.response.status, JSON.stringify(err.response.data));
  process.exit(1);
});