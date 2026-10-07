/**
 * test_lifecycle_hardening.cjs — P0 PRODUCTION HARDENING ACCEPTANCE
 *
 * Verifies the master-prompt acceptance criteria against a LIVE server:
 *
 *   TEST 1  every session status mutation goes through the lifecycle gateway
 *   TEST 2  no unauthorized raw session status write exists (behavioral half;
 *           the static half is test_lifecycle_guard.cjs)
 *   TEST 3  every valid transition bumps `sequence` (monotonic), reads don't
 *   TEST 4  every valid transition writes an audit record (actor SYSTEM on auto)
 *   TEST 5  invalid transitions are rejected (REST 409/400 + socket error)
 *   TEST 6  QUESTION_ACTIVE → QUESTION_ACTIVE re-arm works (switch + idempotent
 *           same-challenge re-select NEVER re-stamps the timer)
 *   TEST 7  RAPID_FIRE auto-lock works WITHOUT setTimeout (sweep drives the
 *           whole chain: active → locked → next → locked → … → RESULTS)
 *   TEST 10 auto-lock cannot double-score
 *   TEST 11 submission at/after deadline follows deterministic SERVER time
 *   TEST 12 frozen-snapshot grading remains correct after editor edits
 *   TEST 13 idempotency: duplicate submit / double end / double host / next-noop
 *   TEST 14 ENDED stays terminal (start/status/join all refused, never reopens)
 *   +       PUT /:id/status and PUT /:id/advance route through the gateway
 *   +       host:select_game / replay_game / random_game route through gateway
 *
 * Requires: hardened server running on http://localhost:3001
 * Run:      node test_lifecycle_hardening.cjs   (from repo root)
 */

const path = require('path');
const fs = require('fs');
// Load DATABASE_URL from server/.env without a dotenv dependency.
const envFile = fs.readFileSync(path.join(__dirname, 'server', '.env'), 'utf8');
const dbMatch = envFile.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m);
if (dbMatch && !process.env.DATABASE_URL) process.env.DATABASE_URL = dbMatch[1];

const axios = require('axios');
const { io } = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

let passed = 0;
let failed = 0;
let lastFail = '';

function ok(msg) { passed++; console.log(`  ✓ ${msg}`); }
function bad(msg, extra) { failed++; lastFail = msg; console.log(`  ✗ ${msg}${extra ? '\n    ' + JSON.stringify(extra) : ''}`); }
function check(cond, msg, extra) { return cond ? ok(msg) : bad(msg, extra); }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function poll(fn, predicate, timeoutMs, intervalMs = 1000) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (predicate(v)) return v;
    if (Date.now() - start > timeoutMs) return v;
    await sleep(intervalMs);
  }
}

function socketError(sock, emitFn, matcher, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const h = (e) => { clearTimeout(t); sock.removeListener('error', h); resolve(e); };
    const t = setTimeout(() => { sock.removeListener('error', h); resolve(null); }, timeoutMs);
    sock.once('error', h);
    emitFn();
  });
}

async function makeGame(name, template, timerSecs, answers, opts = {}) {
  const game = (await axios.post(`${API}/games`, { name, template, maxPlayers: 20, ...opts }, gmHeaders)).data.game;
  const challenges = [];
  for (let i = 0; i < answers.length; i++) {
    const ch = (await axios.post(`${API}/games/${game.id}/challenges`, {
      type: 'SINGLE_CHOICE', prompt: `${name} Q${i + 1}`, options: ['A', 'B', 'C', 'D'],
      answer: answers[i], points: 10, timerSecs, difficulty: 'EASY',
    }, gmHeaders)).data.challenge;
    challenges.push(ch);
  }
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  return { game, challenges };
}

async function hostGame(game) {
  return (await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders)).data.session;
}

async function getSession(code) {
  return (await axios.get(`${API}/sessions/${code}`)).data.session;
}

let gmHeaders, studHeaders, ts;

async function main() {
  console.log('================================================================');
  console.log('   P0 LIFECYCLE HARDENING — GATEWAY, SEQUENCE, AUDIT, SWEEP      ');
  console.log('================================================================');

  ts = Date.now();

  const gmRes = await axios.post(`${API}/auth/login`, { login: 'demo@terminal.dev', password: 'terminal123' });
  gmHeaders = { headers: { Authorization: `Bearer ${gmRes.data.token}` } };
  const gm = gmRes.data.user;
  ok(`GM authenticated: ${gm.name} (${gm.role})`);

  const student = await axios.post(`${API}/auth/register`, {
    name: `Hard Agent ${ts}`, username: `hard_stud_${ts}`,
    usn: `1MS24CS${String(ts).slice(-4)}S`, email: `hard_stud_${ts}@campus.edu`,
    branch: 'CSE', section: 'A', password: 'Password123!',
  });
  studHeaders = { headers: { Authorization: `Bearer ${student.data.token}` } };
  ok(`Student registered: ${student.data.user.username}`);

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T1/T3/T4] GATEWAY — PUT /:id/status + sequence + audit');
  {
    const { game } = await makeGame(`GW ${ts}`, 'QUIZ', 30, ['A']);
    const s = await hostGame(game);
    const base = await prisma.session.findUnique({ where: { id: s.id } });
    check(base?.sequence === 1, `Session created with sequence=${base?.sequence} (status init at create)`);

    const seq1 = base.sequence;
    const r1 = (await axios.put(`${API}/sessions/${s.id}/status`, { status: 'STARTING' }, gmHeaders)).data.session;
    check(r1.status === 'STARTING', `PUT /:id/status LOBBY→STARTING accepted (status=${r1.status})`);
    check(r1.sequence === seq1 + 1, `Sequence bumped on gateway transition (${seq1}→${r1.sequence})`);

    const r2 = (await axios.put(`${API}/sessions/${s.id}/status`, { status: 'QUESTION_ACTIVE' }, gmHeaders)).data.session;
    check(r2.status === 'QUESTION_ACTIVE' && r2.sequence === r1.sequence + 1,
      `PUT /:id/status STARTING→QUESTION_ACTIVE accepted, sequence monotonic (${r2.sequence})`);

    // Read-only GET must NOT bump the sequence
    const g1 = await getSession(s.roomCode);
    const g2 = await getSession(s.roomCode);
    check(g1.sequence === g2.sequence, `Read-only GETs do not mutate sequence (${g1.sequence})`);

    // TEST 5 — invalid + malformed rejected
    try {
      await axios.put(`${API}/sessions/${s.id}/status`, { status: 'LOBBY' }, gmHeaders);
      bad('QUESTION_ACTIVE→LOBBY was rejected');
    } catch (e) {
      check(e.response?.status === 409, `PUT /:id/status illegal transition rejected (409)`, e.response?.data);
    }
    try {
      await axios.put(`${API}/sessions/${s.id}/status`, { status: 'GARBAGE_STATE' }, gmHeaders);
      bad('Garbage status was rejected');
    } catch (e) {
      check(e.response?.status === 400, `PUT /:id/status malformed value rejected (400)`);
    }
    try {
      await axios.put(`${API}/sessions/${s.id}/status`, { status: 'RESULTS' }, studHeaders);
      bad('Student status-write was rejected');
    } catch (e) {
      check(e.response?.status === 403, `Student cannot write session status (403)`, e.response?.data);
    }

    // TEST 4 — audit written for every transition
    const audits = await prisma.auditLog.findMany({ where: { targetId: s.id, targetType: 'SESSION' } });
    const actions = audits.map(a => a.action);
    check(actions.includes('SESSION_STATUS_STARTING') && actions.includes('SESSION_STATUS_QUESTION_ACTIVE'),
      `Audit trail contains SESSION_STATUS_STARTING + SESSION_STATUS_QUESTION_ACTIVE`, actions);
    const stAudit = audits.find(a => a.action === 'SESSION_STATUS_STARTING');
    check(stAudit?.details?.from === 'LOBBY' && stAudit?.details?.to === 'STARTING',
      `Audit carries from/to (${stAudit?.details?.from} → ${stAudit?.details?.to})`);

    // PUT /:id/status to ENDED → finalize path (idempotent + purge + audit GAME_ENDED)
    const rEnd = (await axios.put(`${API}/sessions/${s.id}/status`, { status: 'ENDED' }, gmHeaders)).data.session;
    check(rEnd.status === 'ENDED' && rEnd.endedAt, `PUT /:id/status → ENDED via finalize (endedAt=${!!rEnd.endedAt})`);
    const endAudits = await prisma.auditLog.findMany({ where: { targetId: s.id, targetType: 'SESSION', action: 'GAME_ENDED' } });
    check(endAudits.length === 1, `ENDED write produced GAME_ENDED audit (n=${endAudits.length})`);
    const seqAfterEnd = (await getSession(s.roomCode)).sequence;
    check(seqAfterEnd > r2.sequence, `Sequence monotonic through END (…→${seqAfterEnd})`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T3/T4/T5] GATEWAY — PUT /:id/advance');
  {
    const { game } = await makeGame(`ADV ${ts}`, 'QUIZ', 30, ['A']);
    const s = await hostGame(game);
    await axios.put(`${API}/sessions/${s.id}/status`, { status: 'STARTING' }, gmHeaders);
    await axios.put(`${API}/sessions/${s.id}/status`, { status: 'QUESTION_ACTIVE' }, gmHeaders);

    // Mid-question advance is ILLEGAL now (no raw write bypass)
    try {
      await axios.put(`${API}/sessions/${s.id}/advance`, {}, gmHeaders);
      bad('ADVANCE mid-question was rejected');
    } catch (e) {
      check(e.response?.status === 409, `PUT /:id/advance from QUESTION_ACTIVE rejected (409)`, e.response?.data);
    }

    const seqBefore = (await getSession(s.roomCode)).sequence;
    await axios.put(`${API}/sessions/${s.id}/status`, { status: 'RESULTS' }, gmHeaders);
    const adv = (await axios.put(`${API}/sessions/${s.id}/advance`, {}, gmHeaders)).data.session;
    // No next game in the event → advance terminates through finalizeSession (ENDED).
    check(adv.status === 'ENDED' && adv.endedAt, `PUT /:id/advance with no next game → ENDED via finalize`);
    const seqAfter = (await getSession(s.roomCode)).sequence;
    check(seqAfter > seqBefore, `Advance bumped sequence (${seqBefore}→${seqAfter})`);
    const advAudit = await prisma.auditLog.findMany({ where: { targetId: s.id, targetType: 'SESSION', action: 'GAME_ENDED' } });
    check(advAudit.length === 1, `Advance-to-end wrote GAME_ENDED audit (n=${advAudit.length})`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T6] QUESTION_ACTIVE → QUESTION_ACTIVE re-arm (socket)');
  const sockA = io(SOCKET_URL, { auth: { token: gmRes.data.token }, forceNew: true, transports: ['websocket'] });
  sockA.on('error', () => {});
  await new Promise((res) => sockA.on('connect', res));
  {
    const { game, challenges: [q1, q2] } = await makeGame(`RARM ${ts}`, 'RAPID_FIRE', 60, ['A', 'B']);
    const s = await hostGame(game);
    const code = s.roomCode;
    await new Promise((res) => { sockA.emit('host:join', { roomCode: code }); setTimeout(res, 400); });

    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); // LOBBY → STARTING
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); // STARTING → QUESTION_ACTIVE q1

    let st = await getSession(code);
    check(st.status === 'QUESTION_ACTIVE' && st.currentChallengeId === q1.id, `Question active on q1`);
    const seqQ1 = st.sequence;
    const t01 = st.challengeStartTime;

    // SWITCH to q2 while still QUESTION_ACTIVE
    await new Promise((res) => { sockA.emit('host:select_challenge', { challengeId: q2.id }); setTimeout(res, 600); });
    st = await getSession(code);
    check(st.status === 'QUESTION_ACTIVE' && st.currentChallengeId === q2.id,
      `Host switched to q2 while QUESTION_ACTIVE (current=${st.currentChallengeId === q2.id ? 'q2' : 'WRONG'})`);
    check(st.sequence === seqQ1 + 1, `Re-arm bumped sequence (${seqQ1}→${st.sequence})`);
    const tSwitch = st.challengeStartTime;
    check(new Date(tSwitch).getTime() > new Date(t01).getTime(), `Re-arm re-stamped the authoritative deadline`);

    const switchAudits = await prisma.auditLog.findMany({ where: { targetId: s.id, targetType: 'SESSION', action: 'QUESTION_SWITCHED' } });
    check(switchAudits.length === 1, `Re-arm wrote QUESTION_SWITCHED audit (n=${switchAudits.length})`);

    // SAME-challenge re-select must be an idempotent NO-OP (never re-stamp)
    const seqBeforeNoop = st.sequence;
    await new Promise((res) => { sockA.emit('host:select_challenge', { challengeId: q2.id }); setTimeout(res, 600); });
    st = await getSession(code);
    check(st.currentChallengeId === q2.id && st.sequence === seqBeforeNoop,
      `Same-challenge re-select is an idempotent no-op (sequence unchanged ${st.sequence})`);
    check(st.challengeStartTime === tSwitch, `Same-challenge re-select did NOT re-stamp the timer`);

    // Socket invalid transitions → gateway rejects (TEST 1/5 on the socket path)
    const errSel = await socketError(sockA, () => sockA.emit('host:select_game', { gameId: game.id, position: 0 }),
      (e) => /Cannot start a game/.test(e?.message || ''));
    check(!!errSel, `host:select_game while QUESTION_ACTIVE rejected via lifecycle (no raw write)`, errSel);

    // Cleanup this session
    await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders);
    sockA.removeAllListeners('error');
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T1/T3/T4] SOCKET GATEWAY — select_game / replay_game');
  {
    const { game } = await makeGame(`SEL ${ts}`, 'RAPID_FIRE', 60, ['A', 'B']);
    const s = await hostGame(game);
    const code = s.roomCode;
    sockA.on('error', () => {});
    await new Promise((res) => { sockA.emit('host:join', { roomCode: code }); setTimeout(res, 400); });

    // select_game from LOBBY — legal, routes through gateway
    const seq0 = (await getSession(code)).sequence;
    await new Promise((res) => { sockA.emit('host:select_game', { gameId: game.id, position: 0 }); setTimeout(res, 700); });
    let st = await getSession(code);
    check(st.status === 'STARTING' && st.currentGameId === game.id && st.currentChallengeId === null,
      `host:select_game from LOBBY → STARTING via gateway`);
    check(st.sequence === seq0 + 1, `select_game bumped sequence (${seq0}→${st.sequence})`);
    const selAudits = await prisma.auditLog.findMany({ where: { targetId: s.id, targetType: 'SESSION', action: 'SESSION_STATUS_STARTING' } });
    check(selAudits.length >= 1, `select_game wrote SESSION_STATUS_STARTING audit (n=${selAudits.length})`);

    // drive to RESULTS then replay
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); // STARTING → QUESTION_ACTIVE q1
    await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/next`, {}, gmHeaders);  // q2 active
    await axios.post(`${API}/sessions/${code}/lock`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/next`, {}, gmHeaders);  // RESULTS
    st = await getSession(code);
    check(st.status === 'RESULTS', `Room reached RESULTS for replay test`);

    const seqRes = st.sequence;
    await new Promise((res) => { sockA.emit('host:replay_game'); setTimeout(res, 700); });
    st = await getSession(code);
    check(st.status === 'STARTING' && st.currentGameId === game.id,
      `host:replay_game from RESULTS → STARTING via gateway`);
    check(st.sequence > seqRes, `replay_game bumped sequence (${seqRes}→${st.sequence})`);
    check(st.currentChallengeId === null && st.currentRun === 2, `replay reset challenge (run=${st.currentRun})`);

    await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders);
    sockA.removeAllListeners('error');
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T7/T10/T11] SWEEP — restart-safe auto-lock WITHOUT setTimeout');
  {
    const { game, challenges: [c1, c2, c3] } = await makeGame(`SWEEP ${ts}`, 'RAPID_FIRE', 5, ['A', 'B', 'C']);
    const s = await hostGame(game);
    const code = s.roomCode;
    // a student joins and answers q1 BEFORE the deadline
    const joinRes = await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders).then(d => ({ ok: true })).catch(e => ({ ok: false, status: e.response?.status, body: e.response?.data }));
    check(joinRes.ok, `Student joined SWEEP room`, joinRes.body);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);

    // Submit IMMEDIATELY — no round-trips between QUESTION_ACTIVE and the
    // answer, so the 5s deadline can never beat the test to the punch.
    const sub = (await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders).then(d => ({ ok: true, data: d.data })).catch(e => ({ ok: false, status: e.response?.status, body: e.response?.data })));
    check(sub.ok && sub.data.isCorrect === true,
      `Student scored on q1 before deadline (${sub.body?.error || sub.data?.isCorrect})`);
    let st = await getSession(code);
    check(st.status === 'QUESTION_ACTIVE' && st.currentChallengeId === c1.id, `q1 confirmed active (5s timer)`);
    const submissionsBeforeLock = await prisma.submission.count({ where: { sessionId: s.id, challengeId: c1.id } });
    check(submissionsBeforeLock === 1, `Exactly 1 scored submission row before lock`);

    // TEST 7a — q1 AUTO-LOCKS via the sweep (no host action, no setTimeout)
    const locked = await poll(async () => getSession(code),
      (x) => x.status === 'QUESTION_LOCKED' && x.currentChallengeId === c1.id, 12000, 1000);
    check(locked.status === 'QUESTION_LOCKED', `q1 auto-locked WITHOUT host action (status=${locked.status})`);
    const sysAudits = await prisma.auditLog.findMany({ where: { targetId: s.id, targetType: 'SESSION', action: 'QUESTION_LOCKED' } });
    check(sysAudits.length === 1 && sysAudits[0].adminUsername === 'SYSTEM',
      `Auto-lock audited with actor SYSTEM (n=${sysAudits.length})`, sysAudits[0]?.adminUsername);

    // TEST 10 — no double-score: late submit rejected AND row count unchanged
    const late = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders).then(d => d.data).catch(e => e.response);
    check(late?.status === 400 || late?.error || late?.data?.error,
      `Late submit after auto-lock rejected (${late?.status || late?.error || 'ok'})`);
    const submissionsAfterLock = await prisma.submission.count({ where: { sessionId: s.id, challengeId: c1.id } });
    check(submissionsAfterLock === 1, `Auto-lock did NOT double-score (rows=${submissionsAfterLock})`);

    // TEST 7b — auto-advance to q2 (4s reveal window, driven by the sweep)
    const adv1 = await poll(async () => getSession(code),
      (x) => x.status === 'QUESTION_ACTIVE' && x.currentChallengeId === c2.id, 15000, 1000);
    check(adv1.status === 'QUESTION_ACTIVE' && adv1.currentChallengeId === c2.id,
      `Sweep auto-advanced locked q1 → q2 ($[${adv1.currentChallengeId === c2.id ? 'ok' : 'WRONG'}])`);

    // TEST 7c — full chain completes to RESULTS with ZERO host interaction
    const results = await poll(async () => getSession(code),
      (x) => x.status === 'RESULTS', 60000, 1000);
    check(results.status === 'RESULTS', `Sweep drove the whole chain to RESULTS (no host action)`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T11] DEADLINE — deterministic server-time cutoff');
  {
    // QUIZ never auto-locks, so the status stays QUESTION_ACTIVE while the
    // persisted deadline passes — this isolates the SERVER-TIME cutoff.
    const { game } = await makeGame(`DL ${ts}`, 'QUIZ', 30, ['A']);
    const s = await hostGame(game);
    const code = s.roomCode;
    await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    check((await getSession(code)).status === 'QUESTION_ACTIVE', `Quiz question active`);

    // Push the authoritative deadline 500ms into the past (status untouched).
    await prisma.session.update({ where: { id: s.id }, data: { questionEndsAt: new Date(Date.now() - 500) } });

    const r = await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders).then(d => ({ ok: true, d: d.data })).catch(e => ({ ok: false, status: e.response?.status, body: e.response?.data }));
    check(r.ok === false && r.status === 400 && /deadline/i.test(r.body?.error || ''),
      `Submit past deadline rejected deterministically by SERVER time (400 '${r.body?.error}')`, r.body);

    check((await getSession(code)).status === 'QUESTION_ACTIVE',
      `Status never auto-flipped for QUIZ — cutoff proven independently of the sweep`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T12] SNAPSHOT — frozen grading after editor edits');
  {
    const { game, challenges: [fq1] } = await makeGame(`SNAP ${ts}`, 'RAPID_FIRE', 60, ['A']);
    const s = await hostGame(game);
    const code = s.roomCode;

    await axios.patch(`${API}/games/${game.id}/challenges/${fq1.id}`, { answer: 'Z' }, gmHeaders);
    const live = await prisma.challenge.findUnique({ where: { id: fq1.id } });
    check(live?.config?.answer === 'Z', `Underlying game answer edited to 'Z' (config.answer) after hosting`);

    await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);

    const sub = (await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders)).data;
    check(sub.isCorrect === true, `Frozen snapshot grades 'A' (snapshot answer) as CORRECT despite live 'Z' edit`);

    await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T13] IDEMPOTENCY — submit / end / host / next');
  {
    const { game, challenges: [q1] } = await makeGame(`IDEM ${ts}`, 'RAPID_FIRE', 60, ['A']);
    const s = await hostGame(game);
    const code = s.roomCode;
    await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);
    await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders);

    const sub1 = (await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders)).data;
    const sub2 = (await axios.post(`${API}/sessions/${code}/submit`, { answer: 'A' }, studHeaders)).data;
    check(sub2.duplicate === true || sub2.alreadySubmitted || sub2.id === sub1.id,
      `Duplicate submit is idempotent (duplicate=${sub2.duplicate})`);
    const rows = await prisma.submission.count({ where: { sessionId: s.id, challengeId: q1.id } });
    check(rows === 1, `Duplicate submit did not double-credit (rows=${rows})`);

    const end1 = (await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders)).data;
    const seqAtEnd = end1.session.sequence;
    const end2 = (await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders)).data;
    check(end1.session.status === 'ENDED' && end1.alreadyEnded === false && end2.alreadyEnded === true,
      `Double END idempotent (alreadyEnded=${end2.alreadyEnded})`);
    check((await getSession(code)).sequence === seqAtEnd, `Second END did not bump sequence`);

    // /next on an ended session is REJECTED (409) — ENDED never reopens
    try {
      await axios.post(`${API}/sessions/${code}/next`, {}, gmHeaders);
      bad('/next after END was accepted');
    } catch (e) {
      check(e.response?.status === 409, `/next after END rejected (409) — ENDED terminal`, e.response?.data);
    }
    check((await getSession(code)).status === 'ENDED', `Status still ENDED after the /next attempt`);

    // double HOST *while active* reuses the live room — verified in
    // test_host_architecture [C]. After END, hosting creates a FRESH session:
    // ENDED is terminal and is never reopened/overwritten.
    const re = (await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders)).data.session;
    check(re.roomCode !== code && re.reused !== true,
      `HOST after END creates a fresh session (new room ${re.roomCode}, reused=${re.reused}) — ENDED never reopened`);
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log('\n[T14] ENDED — terminal state');
  {
    const { game } = await makeGame(`TERM ${ts}`, 'QUIZ', 30, ['A']);
    const s = await hostGame(game);
    const code = s.roomCode;
    await axios.post(`${API}/sessions/${code}/end`, {}, gmHeaders);

    try { await axios.post(`${API}/sessions/${code}/start`, {}, gmHeaders); bad('START after END rejected'); }
    catch (e) { check(e.response?.status === 409, `START after END rejected (409)`); }

    try { await axios.put(`${API}/sessions/${s.id}/status`, { status: 'LOBBY' }, gmHeaders); bad('LOBBY re-open rejected'); }
    catch (e) { check(e.response?.status === 409, `PUT /:id/status LOBBY after END rejected (409)`); }

    try { await axios.post(`${API}/sessions/join`, { roomCode: code }, studHeaders); bad('Late join rejected'); }
    catch (e) { check(e.response?.status === 410, `Join after END rejected (410 Gone)`); }

    check((await getSession(code)).status === 'ENDED', `ENDED remains terminal after all attempts`);
  }

  sockA.disconnect();
  await prisma.$disconnect();

  console.log(`\n================================================================`);
  console.log(`   RESULT: ${passed} PASSED / ${failed} FAILED`);
  console.log(`================================================================`);
  if (failed > 0) {
    console.log(`   First failure: ${lastFail}`);
    process.exit(1);
  }
  console.log('   PRODUCTION HARDENING ACCEPTANCE: PASS ✦');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack?.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
});