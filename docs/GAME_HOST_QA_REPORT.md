# Game Master Live Hosting — QA Report

**Scope:** Repair & production-harden the live multiplayer Game Master hosting flow (HOST → session → host control room → student join → gameplay → scoring → leaderboard → finalize → report) for ~200 concurrent students.
**Date:** 2026-10-07 · **Environment:** Windows, Node 26.3, single Postgres, no Redis · **Server:** `http://localhost:3001`

---

## 1. Verdict

**READY.** All automated suites green (see §3), including a 200-student concurrent load run with **zero** errors and **100%** correct scoring. This cycle also closed the two P0 production-hardening acceptance criteria from the master prompt — **① ONE authoritative session-status write gate** (static guard + behavioral proof: every REST/socket status write routes through `sessionLifecycle`, zero raw `Session.status` mutations elsewhere) and **② restart-safe question expiration with NO `setTimeout` as authoritative timing** (a single 1s sweep claims expired questions from the persisted `questionEndsAt` column; restart-before-expiry and expired-on-startup are both auto-recovered, audited as `SYSTEM`, never double-scored). 378+ baseline platform checks re-verified intact.

> **P0 hardening evidence:** `test_lifecycle_guard.cjs` (static) **PASS** · `test_lifecycle_hardening.cjs` **60/60 PASS** · `test_host_restart.cjs` **11/11 PASS**. Residual gap (non-P0): visual/browser QA of the host room UI (see §6).

---

## 2. What Was Broken (root causes) & What Was Fixed

### 2.1 Root cause #1 — Snapshot was frozen but scoring read the live editor row
- **Symptom:** editing a question's **answer** (or points) *after* hosting changed what a live room graded against — an immutability violation. Test-exposed by PATCHing `answer→'Z'` post-host then submitting `'A'` and observing wrong grading.
- **Fix:** every grading path now resolves the frozen challenge through `getChallengeForLiveSession(session, liveChallenge)` (snapshot `config./options./answer./points./timeLimit` shadow the live row; legacy sessions without snapshots fall back to live).
  - `POST /:code/submit` · `POST /:code/answer` · `POST /active/submit` (the real student play path) · socket `player:dock_action`.
- **Evidence:** `test_host_architecture.cjs [D]+[G]` — after post-host answer edit, submit of the frozen answer still grades `isCorrect=true`.

### 2.2 Root cause #2 — Socket listeners were registered *after* an await → first emits dropped
- **Symptom:** websocket-based clients (and post-upgrade reconnects) got **no response** to `host:join` — no state, no error, no server log; `io.on('connection', async …)` deferred player/host listener binding until after `prisma.teamMember.findFirst`, and socket.io silently drops packets that arrive before a listener exists. Polling clients were only *accidentally* safe (poll cadence hid the race).
- **Fix:** the connection handler is now synchronous — **all** listeners bind at connect time; the team-membership lookup runs fire-and-forget after binding.
- **Evidence:** architecture test `[J]` (invalid transition reaches the client as an `error` event over a websocket-only connection) and `[K]` (session isolation) now pass; the pre-existing GM socket flow (`host:join` → `host:select_challenge` → REST submits) runs end-to-end.

### 2.3 Root cause #3 — Strict machine broke the host's legal "jump between questions"
- **Symptom:** the frozen regression suite failed Q2 with `400 Already submitted` — `host:select_challenge` for Q2 was rejected (`QUESTION_ACTIVE→QUESTION_ACTIVE` not in the map), so students' Q2 submissions re-collided on Q1's key.
- **Fix:** `startQuestion` permits a **same-status re-arm**: switching `currentChallengeId` while `QUESTION_ACTIVE` (fresh authoritative `questionEndsAt`, `sequence++`, audit `QUESTION_SWITCHED`); re-selecting the *same* challenge is an idempotent no-op that never re-stamps the timer. All other transitions remain strictly guarded.
- **Evidence:** `test_gm_host_and_scoring.cjs` Q1→Q2→finalize→time-bonus→report — 11/11.

### 2.4 Fix set summary

| # | Change | Files |
|---|---|---|
| 1 | Frozen-snapshot grading everywhere | `sessionLifecycle.ts` (`getChallengeForLiveSession`), `sessions.ts`, `sockets/index.ts` |
| 2 | Synchro-now socket listener registration | `sockets/index.ts` |
| 3 | Same-status question re-arm in the state machine | `sessionLifecycle.ts` (`startQuestion`), `sockets/index.ts` (`host:select_challenge`) |
| 4 | Idempotent duplicate submit (`duplicate:true`, 200) | `sessions.ts` (`/:code/submit`) |
| 5 | `host:end_event` via idempotent audited `finalizeSession` | `sockets/index.ts` |
| 6 | (Prior) Preflight-first host launch, authenticated `/host` load, ENDED=terminal, REST controls, reconnect recovery | `App.tsx`, `SessionHostPage.tsx`, `sessions.ts`, `games.ts` |

### 2.5 P0 production-hardening cycle — one write gate, restart-safe timing

The master-prompt acceptance audit found the session-lifecycle invariants were *not yet* invariant:

| # | P0 defect found in audit | Fix |
|---|---|---|
| 7 | **Multiple raw `Session.status` write sites.** `PUT /:id/status` and `PUT /:id/advance` bypassed the machine (literal/silent writes, no transition validation); `host:select_game/replay_game/skip_game/random_game` did `prisma.session.update({status})` directly (no sequence/audit); `/next` used a raw `RESULTS` write on the no-more-challenges branch. | Every bypass rewired through `sessionLifecycle`: `PUT /:id/status` (gateway, 400 invalid literal / 409 illegal  / `ENDED`→`finalizeSession`), `PUT /:id/advance` (gateway; ending-branch now gated by `canTransition`, rejects mid-question 409, else `finalizeSession`), `/next` RESULTS branch via `applySessionTransition`, all four select/replay/skip/random events via `selectGameForSession`/`finalizeSession` with error emits on machine rejection. New **static guard** `test_lifecycle_guard.cjs` scans all of `server/src` and fails on any `status:` session mutation outside the gateway or sweep — the invariant is now enforced by CI-able code, not convention. |
| 8 | **`setTimeout` as authoritative timing.** RAPID_FIRE auto-lock ran an in-process `setTimeout` (`startRapidFireChallenge`); a restart mid-question left the room stuck `QUESTION_ACTIVE` forever and deadlines depended on process liveness. | **One restart-safe sweep** (`server/src/services/questionSweep.ts`): 1s `setInterval` observes the persisted `questionEndsAt` column; expired `QUESTION_ACTIVE` RAPID_FIRE rows are **claimed atomically** (`updateMany` guarded on `id + status + questionEndsAt <= now`) → `QUESTION_LOCKED`, `sequence+1`, persisted `autoAdvanceAt = lock+4s` (the legacy reveal window, now restart-safe), audit actor `SYSTEM`, broadcast; the same loop advances to the next frozen question or `RESULTS`. An immediate reconcile pass at boot recovers questions that expired while the process was down. Manual-lock semantics for non-RAPID_FIRE unchanged. `setTimeout` is gone from the server entirely. |
| 9 | **Cutoff depended on status flips, not the deadline.** After a restart the status never flipped, and even in-process the deadline was only *displayed*, not enforced on the submit path. | New server-time cutoff in **all three** submission gates (`/:code/submit`, `/active/submit`, `/:code/answer`): `Date.now() > questionEndsAt` → `400 Question deadline has passed` even while status is still `QUESTION_ACTIVE` — deterministic and sweep-independent. |

**Evidence:** §3.2 rows for the three new suites below.

---

## 3. Test Evidence

### 3.1 Build gate
```
server: npx tsc --noEmit        EXIT=0      npm run build  EXIT=0
client: npx tsc -b --noEmit     EXIT=0      npm run build  OK (vite 4.85s)
```

### 3.2 Automated suites (all against the rebuilt, running server)

| Suite | Result | Coverage |
|---|---|---|
| `test_host_architecture.cjs` | **34/34 PASS** | A Auth/role guards · B preflight (0-question game rejected, complete game passes) · C idempotent HOST (double-HOST reuses session) · **D immutable snapshot (name+question+answer survive post-host edits)** · E host authz (403/404) · F REST state machine + authoritative `questionEndsAt` + invalid-transition 409s · G submit idempotency + cutoff · I finalize idempotency · **J socket invalid-transition error reaches client (websocket-only)** · **K session isolation** · L late-join policy (ENDED→410, existing-member reattach, `allowLateJoin:false` gate) |
| `test_gm_host_and_scoring.cjs` | **11/11 PASS** | GM auth · role guard · 4-student team · game publish · session 8M4JX · team formation · state payload · **Q1 score 7.5 → Q2 → end_event → time bonus 10 → final 25** · Excel report |
| `test_regression_suite.cjs` | **10/10 PASS** | Auth · game CRUD · SQL/server-side validation rejections · type transitions persisted · **socket GM+student live flow: question active → submit → correct/points** |
| `test_gm_report.cjs` | **31/31 PASS** | GM download 200 + XLSX + filename (`TERMINAL_RPT_*_ROOM_REPORT.xlsx`) · student 403 · unauthorized GM 403 · 404 · **no passwordHash/bcrypt in bytes** · **no formula-injection filename** |
| `test_rapid_fire_builder_fix.cjs` | **PASS** | Builder: options/answer persistence on reload · stale-config overwrite immunity · compile-run → session | 
| `test_host_load_200.cjs` | **PASS ✦** | §3.3 |
| `test_lifecycle_guard.cjs` | **PASS ✦** | **Static scan of every `prisma.session.update/updateMany` in `server/src`:** 6 status-bearing mutations all inside `sessionLifecycle.ts` / `questionSweep.ts`; 6 non-status updates (stageMode etc.) benign; zero raw `status:` writes elsewhere — fails loudly if ever reintroduced |
| `test_lifecycle_hardening.cjs` | **60/60 PASS ✦** | **P0 gateway + sweep acceptance (TESTS 1–14):** create-time `sequence=1`, every valid transition bumps sequence (reads don't), audit `SESSION_STATUS_*` with `from/to`, illegal PUT `/status` → 409, malformed → 400, student → 403, `ENDED` via finalize + `GAME_ENDED` audit, `PUT /advance` mid-question → 409 + no-next-game → `ENDED`, **QUESTION_ACTIVE→QUESTION_ACTIVE re-arm** (switch re-stamps + `QUESTION_SWITCHED` audit; same-challenge re-select is an idempotent no-op), socket `select_game` while active → `error` event, **RAPID_FIRE auto-lock with NO host action + `SYSTEM` audit + no double-score**, sweep auto-advance chain → `RESULTS`, **deterministic deadline rejection** (`questionEndsAt` forced to past on a QUIZ room → 400 while status still `QUESTION_ACTIVE`), frozen-snapshot grading after live answer edit (`config.answer` → `'Z'`, still grades `'A'`), duplicate-submit/END/HOST idempotency, `ENDED` terminal (start/status/join/next all refused, never reopened, fresh room on re-host) |
| `test_host_restart.cjs` | **11/11 PASS ✦** | **Restart-safe auto-lock on its own :3011 instance (master stopped):** A) question started (20s), one score, kill server, restart → sweep auto-locks expired question, pre-restart score survives, late submit 400, no double-score, chain completes to `RESULTS`; B) `questionEndsAt` wedged into the past → kill + restart → **first sweep pass** reconciles to `QUESTION_LOCKED` (audit `SYSTEM`) → `RESULTS` with zero GM interaction |

### 3.3 200-student concurrent load (acceptance)

One RAPID_FIRE room, 1 scoring question, 200 real students (registered+auth+joined via API):

```
join   200/200   OK                 errors 0   (44% of wall time is register+auth)
submit 200/200   isCorrect=true,
                 score = 100 pts    errors 0
state  playerCount = 200           consistent at read
after END: 200 players ranked on individualLeaderboard, all 100 pts
```

(latest run: join ≈17.5s total ≈11/s incl. register+auth; submit burst ≈1.3s ≈153/s — **run with the new 1s lifecycle sweep active**)

- No Redis. Single Postgres handled the burst without a single error/5xx.
- Duplicate joins in the batch were re-attempted to exercise the idempotent reattach path — the policy held (200 unique players, 0 conflicts).

### 3.4 Manual acceptance mapping

The 74-step manual acceptance script maps onto the automated assertions above (each manual step corresponds to one or more `check(...)` in the suites). Automation covers: preflight rejection, idempotent host, immutable grading, host 403/404, full REST state machine + invalid transitions, authoritative deadlines, submit idempotency, submit cutoff after lock, finalize idempotency, socket guard + isolation + websocket race, late-join policy (410/reattach/`allowLateJoin`), team formation, per-question team scoring, time bonus, terminal END, report security.

---

## 4. Schema

`prisma/schema.prisma` — `Session` additions (pushed via `prisma db push`; client regen copied into `server/node_modules`):

| Column | Type | Purpose |
|---|---|---|
| `questionEndsAt` | `DateTime?` | authoritative question deadline |
| `autoAdvanceAt` | `DateTime?` | persisted reveal-window schedule (`lock + 4s`, legacy RAPID_FIRE chain) — restart-safe |
| `sequence` | `Int @default(0)` | monotonic state version for clients/replays |
| `snapshot` | `Json?` | frozen game + challenge data at host time |
| `snapshotVersion` | `String?` | `snap-<hash>` for host UI SNAP chip / audit |
| `gmId` | `String?` | owning Game Master (idempotent re-host key) |

`Submission` unique on `(sessionId, challengeId, playerId, runId)` — unchanged, now leveraged for idempotent duplicates.

---

## 5. Regression Baseline

All pre-existing suites (378+ platform checks per `AGENT_HANDOFF`) pass unchanged **on top of** the new `Session` columns and hardened routes — no existing flow (workspace auth, game builder CRUD + type transitions, SQL validation, student live play, RAPID_FIRE builder, GM reports) regressed.

---

## 6. Residual Risks / Notes

- **RESOLVED vs. prior cycle:** RAPID_FIRE auto-lock is no longer an in-process `setTimeout`; it is the restart-safe sweep (§2.5 fix #8, §2.4 of the architecture doc). The authoritative deadline was already the `questionEndsAt` column, and the submit paths now **enforce** it by server time, independent of sweep timing.
- **Single-instance assumption:** the sweep's guarded `updateMany` claims are multi-instance-safe by construction, but this deploy is a single Node process + one Postgres — scale-out (multiple instances) is untested as a whole app.
- Join throughput (~11/s incl. register+auth) is DB-write-bound; gameplay submit throughput (~153/s) leaves headroom for 200+ concurrent rooms. Batch join could be added if registration-time bursts grow.
- Sync XLSX report generation is fine at room scales tested (31 report checks); very large exports could move to a job.
- Responsive/visual QA of the hardened host room, pause/resume, and a scripted GM-refresh recovery were NOT re-run as automated browser tests in this cycle (covered structurally by reconnect re-join + REST-first refetch; flagged for a future `browse`/design-review pass).
- Transport: socket.io-client keeps default polling-first (no `transports` override); server listener registration is synchronous, so websocket-only clients are race-free (verified).