# Game Master Live Hosting — Architecture

**Status:** Implemented & verified · **Scope:** HOST → session → host control room → student join → gameplay → scoring → leaderboard → finalize → report
**Audience:** Engineers operating, extending, or deploying the live multiplayer hosting flow (target: ~200 concurrent students per room).

---

## 1. Purpose & Design Goals

The live hosting flow lets a Game Master (GM) run a game live for a room of students:

```
HOST ─► preflight ─► session created (LOBBY) ─► students join ─► question active ─► submit ─► lock ─► next ─► results ─► ENDED ─► report
```

Hardening goals (per master prompt):

1. **Server-authoritative state** — the client never decides role, status, score, or timer.
2. **Immutability** — a hosted room is graded against a frozen snapshot of the game, never the mutating editor rows.
3. **Idempotency** — double HOST, double submit, double END must be harmless.
4. **Concurrency safety** — ~200 students submitting while the host controls the room, without corruption.
5. **Security** — authorization at every boundary; no client-trusted fields.
6. **Recovery** — a refreshed/reconnected host page re-attaches and refetches state.

Non-goals: no Redis (load-tested and not required), no rename of `SessionStatus`/`StageMode` enums, no `setTimeout`-based control (timers are deadline columns in the DB).

---

## 2. Core Services & Ownership

| Service | File | Responsibility |
|---|---|---|
| **Session lifecycle** | `server/src/services/sessionLifecycle.ts` | State machine (`SESSION_TRANSITIONS`, `canTransition`, `applySessionTransition`), `preflightGameForHosting`, `freezeGameSnapshot`, `hostGameForGameMaster`, `startQuestion`/`lockQuestion`, `finalizeSession`, audit, `getChallengeForLiveSession` (frozen scoring). Single source of truth for session state. |
| **Session state projection** | `server/src/services/sessionService.ts` | `getSessionState(roomCode)` — snapshot-first payload, strips answers from client-facing challenge data, exposes `sequence`, `questionEndsAt`, `gmId`, `snapshotVersion`. |
| **Scoring** | `server/src/services/scoringService.ts` | `calculateSessionScores(sessionId)` — reads persisted submissions, ranks players/teams, applies time bonus. |
| **Reports** | `server/src/services/sessionReport.ts` | Excel report generation (filename sanitized, no secrets, formula-injection safe). |
| **Presence** | `server/src/services/presence.ts` | Socket registry, team-room presence broadcasts. |
| **Sockets** | `server/src/sockets/index.ts` | Authenticated socket layer; host/player events all re-validate server-side. |
| **Routes** | `server/src/routes/sessions.ts`, `games.ts` | REST surface for host controls, join, submit, leaderboard, report. |

### 2.1 The guarded state machine

`SESSION_TRANSITIONS` maps every status to its legal successors (`ENDED` is terminal — reopening is an explicit NEW SESSION re-host):

```
LOBBY          → STARTING | ROUND_ACTIVE | QUESTION_ACTIVE | ENDED
STARTING       → ROUND_ACTIVE | QUESTION_ACTIVE | RESULTS | ENDED
QUESTION_ACTIVE→ QUESTION_LOCKED | QUESTION_RESULTS | RESULTS | ENDED   (+ same-status SWITCH, see 2.2)
QUESTION_LOCKED→ QUESTION_RESULTS | QUESTION_ACTIVE | RESULTS | ENDED
QUESTION_RESULTS→ QUESTION_ACTIVE | RESULTS | ENDED
ROUND_ACTIVE   → RESULTS | QUESTION_ACTIVE | QUESTION_LOCKED | ENDED
ROUND_LOCKED   → RESULTS | QUESTION_ACTIVE | ENDED
RESULTS        → STARTING | ROUND_ACTIVE | QUESTION_ACTIVE | LOBBY | ENDED
ENDED          → (none — terminal)
```

The master-prompt states (STARTING/QUESTION_ACTIVE/QUESTION_LOCKED/QUESTION_RESULTS/ROUND_ACTIVE/ROUND_LOCKED/RESULTS/ENDED) map onto the pre-existing `SessionStatus` enum — no enum renames.

Every transition is performed by `applySessionTransition`, which:
- rejects illegal transitions (`canTransition`),
- bumps `sequence`,
- audits (`SESSION_STATUS_<TO>` via `writeAudit`),
- broadcasts a fresh `session_state_update` to `session:<code>`.

Transitions land in exactly one place whether driven by REST (`/start`, `/lock`, `/end`, `/next`, `PUT /:id/status`, `PUT /:id/advance`) or socket (`host:change_status`, `host:select_game`, `host:replay_game`, `host:skip_game`, `host:random_game`, `host:end_event`). Hosting-time game selection/replay/skip/random were the last raw-`prisma.session.update` bypasses and now route through `selectGameForSession` (guarded `STARTING` transition + sequence + audit + broadcast + cancel pending auto-advance); their end-of-event branches use idempotent `finalizeSession`.

### 2.2 The one deliberate exception: switching questions while LIVE

The legacy host flow (and the frozen regression suite) lets a GM jump directly from one question to another **without locking**. This is preserved as a **same-status re-arm**, not a loosen-up of the machine:

- `startQuestion` when `status === 'QUESTION_ACTIVE'`:
  - same `challengeId` → idempotent no-op (timer is **not** re-stamped; the `REST /start` reply and socket broadcast still fire).
  - different `challengeId` → swaps `currentChallengeId`, re-stamps `challengeStartTime` + `questionEndsAt` from the **frozen** challenge's `timeLimit`, bumps `sequence`, audits `QUESTION_SWITCHED`, broadcasts.
- All *other* transitions stay strictly guarded (e.g., `host:change_status` from `QUESTION_ACTIVE → LOBBY` is rejected with an `error` event: verified).
- Already-scored submissions reference their `challengeId` explicitly, so switching mid-round never corrupts prior scores.

### 2.3 ONE authoritative status-write gate

`sessionLifecycle.ts` is the **only** place that performs a persistent `Session.status` mutation. Every entry point listed above routes through `applySessionTransition` / `startQuestion` / `lockQuestion` / `selectGameForSession` / `finalizeSession`. A static guard test (`test_lifecycle_guard.cjs`) scans **all** of `server/src` and fails loudly (`DIRECT SESSION STATUS MUTATION OUTSIDE LIFECYCLE GATEWAY`) on any `prisma.session.update`/`updateMany` containing a `status:` write outside the gateway or the sweep — an architectural guardrail for future code.

### 2.4 One restart-safe question-expiration path (the sweep)

The **only** timer left in the server is the single sweep interval in `server/src/services/questionSweep.ts`. The AUTHORITATIVE deadline is the persisted `questionEndsAt` column — the process merely observes it:

- every second the sweep finds `QUESTION_ACTIVE && questionEndsAt <= NOW` rows;
- for **RAPID_FIRE** (the pre-existing auto-lock template; other templates keep host-manual lock semantics) it **claims** the row atomically — `updateMany` guarded on `status='QUESTION_ACTIVE' AND questionEndsAt <= NOW` → `QUESTION_LOCKED`, `sequence+1`, schedules `autoAdvanceAt = lock + 4s` (the legacy reveal window, now a persisted schedule), audits as actor **`SYSTEM`**, broadcasts;
- the same loop processes `autoAdvanceAt <= NOW` rows (claim guarded on `status='QUESTION_LOCKED'`) → starts the **next frozen** question, or transitions to `RESULTS` after the last one — replicating the old 3-timer chain, restart-safe;
- an immediate reconcile pass runs at boot: a question that expired while the process was **down** is locked on the **first** sweep, with zero host interaction;
- all claims are guarded `updateMany`-style, so duplicate sweeps, overlapping passes, manual host locks, and future multi-instance deployments can never lock/score/advance twice.

### 2.5 Authoritative timing

- `questionEndsAt` is a **DB column** set when a question starts (from the frozen `timeLimit`).
- The host page countdown renders from `questionEndsAt`, never a client timer.
- No `setTimeout` anywhere in the server (the only `setInterval` is the sweep above).
- Bonus deterministic rule (verified): a submit is rejected with `Question deadline has passed` when `Date.now() > questionEndsAt` **even if the status has not flipped yet** — the cutoff is column-based server time in all three submission gates (`/:code/submit`, `/active/submit`, `/:code/answer`), independent of sweep timing.

---

## 3. Hosting a Game (GM REST flow)

### 3.1 Preflight (`POST /api/games/:id/preflight`)

Runs before a session is created and answers "can this game be hosted *as-is*?":

- at least one challenge,
- every challenge has a prompt,
- every choice-type challenge has ≥ 2 non-empty options,
- valid template/challenge types,
- any host-time blockers the editor allows but a live room cannot survive.

`preflightGameForHosting()` returns structured `{ ok, issues[] }`. A rejected game yields `POST /api/sessions` → `400 PREFLIGHT_FAILED` with the issue list. The host UI now runs this **before** creating a room (validating → creating → preflight-failed → error phases; BACK TO EDITOR / RETRY actions).

### 3.2 Freeze (`freezeGameSnapshot`)

At host time the game is deep-frozen into `Session.snapshot`:

- `frozenAt` (ISO), `gameId`, `gameName`, `template`, `teamsEnabled`, `maxTeamSize`, `speedBonus`, `allowLateJoin`,
- per challenge: `id, position, type, prompt, points, timeLimit, options, answer, correct, config`,
- `snapshotVersion` (`snap-<hash>`) recorded on the session.

The snapshot is immutable by construction (JSON column; the editor never writes to session snapshots). Everything graded and projected afterward reads from the snapshot first.

### 3.3 Idempotent HOST (`POST /api/sessions`)

`hostGameForGameMaster(gmId, gameId)`:

1. looks up an existing **non-terminal** live session for the same `(game, GM)`; if found → **reuses it** (`{ reuse: true, session }`) — a GM refresh never strands a live room;
2. otherwise preflights (see above), freezes the snapshot, generates a **collision-checked** room code, creates the session (`status LOBBY`, `gmId`, `currentGameId`, snapshot columns), audits `SESSION_HOSTED`.

The host page is `HostGameRedirect`, which preflights first, then creates; both it and the tests double-HOST to prove reuse.

---

## 4. Join & Late-Join Policy (server-authoritative)

`POST /api/sessions/join` (room code from body `roomCode`/`code`), evaluated in order:

1. `ENDED` → **410 Gone** (a finished room is never rejoined).
2. Existing `sessionPlayer` for this user → **reattach** (idempotent re-join; team kept).
3. Otherwise, joinable **only** while `LOBBY | STARTING | ROUND_ACTIVE`, or in later states when the game's **frozen** `allowLateJoin` is true — else **403**.

`teamId` is derived from `teamMember.findFirst` at join time (server-side; client never supplies it). Chat cleanup and room broadcasts follow.

---

## 5. Host Control Room (client)

`client/src/pages/SessionHostPage.tsx`:

- **Authenticated load:** `GET /api/sessions/:roomCode/host` (GM-only). Explicit **404 / 403 / error screens** — no silent redirects.
- **REST-first controls:** `POST /start`, `/lock`, `/end` (+ `/next` for QUESTION_LOCKED→next, no last→first wrap). Each button has `actionBusy` / `actionError` state; response-driven UI.
- **Reconnect recovery:** socket reconnect re-emits `host:join` and refetches `getSessionState`; reconnect + error banners inform the user; `questionEndsAt` countdown chip re-syncs from server state; SEQ/SNAP chips expose the authoritative sequence and snapshot version.
- **ENDED = terminal:** the room cannot be reopened; the UI offers **NEW SESSION** (re-host), never a fake reopen.

`client/src/App.tsx` `HostGameRedirect` preflights (validating → creating → preflight-failed → error), and the socket layer (`client/src/lib/socket.ts`) authenticates with the JWT.

---

## 6. Socket Layer (server)

`server/src/sockets/index.ts`:

- **Auth middleware** rejects connections without a valid JWT (`Authentication error`).
- **Listener registration is synchronous.** All `socket.on(...)` handlers are bound at connect time, *before* any DB await — a websocket-only client's first emits can never race listener registration and be silently dropped (this was a real production bug: `io.on('connection', async …)` deferred registration until after `prisma.teamMember.findFirst`, so websocket reconnects lost their first `host:join`; fixed and regression-tested).
- **Host events** (`host:join`, `host:change_status`, `host:select_challenge`, `host:select_game`, `host:replay_game`, `host:skip_game`, `host:random_game`, `host:end_event`, …) all re-load the session, re-check `checkEventAuthorization(session.eventId, userId)`, enforce `socket.data.role === 'HOST'`, then run through the lifecycle service:
  - `host:end_event` → idempotent `finalizeSession` (audit + chat purge + broadcast);
  - `host:select_game` / `host:replay_game` / `host:skip_game` / `host:random_game` → `selectGameForSession` (guarded `STARTING` transition, sequence+audit+broadcast) and never touch `session.status` directly; a rejected machine state (e.g. select while `QUESTION_ACTIVE`) is surfaced to the client as an `error` event and the session row is untouched;
  - the sweep (`startQuestionSweep(io)`) is launched at the end of `setupSocketHandlers`, on top of all per-session sockets.
- **Player events** (`player:join`, `player:answer`, `player:dock_action`, …) grade against the **frozen** challenge via `getChallengeForLiveSession`.
- Stage/projector connections (`isStage`) are permitted without a student token; everything else requires auth.

---

## 7. Scoring & Immutability

### 7.1 All submission paths grade the snapshot

`getChallengeForLiveSession(session, liveChallenge)` merges the live `Challenge` row with the frozen snapshot entry:

```ts
{ ...liveChallenge,
  type, prompt, points, timeLimit, options, answer, config   // ← from snapshot
}
```

Applied at **every** boundary:

- `POST /api/sessions/active/submit` (the student play path used by PlayPage + challenge components),
- `POST /api/sessions/:code/submit` (REST answer path),
- `POST /api/sessions/:code/answer`,
- socket `player:dock_action`.

Consequence (verified by test): editing a game's answer/points **after** hosting changes nothing — a room grades exactly what was frozen. Legacy sessions hosted before snapshots exist fall back to the live row (no breakage).

### 7.2 Submission idempotency

`Submission` is unique on `(sessionId, challengeId, playerId, runId)`. A duplicate submit is **not an error**: on `P2002` the route returns the existing submission with `duplicate: true` (200), so retries/flaky clients are harmless. Duplicate-write races (`runId` double-increment window) resolve to the same unique row.

### 7.3 Cutoff

A submit is rejected (`400 No active question accepting submissions`) unless `status === 'QUESTION_ACTIVE'` with a `currentChallengeId`. Locks/finalize present a strict boundary: after `QUESTION_LOCKED`/`ENDED`, no new scoring rows are accepted.

On top of the status gate, **every** submission path (`/:code/submit`, `/active/submit`, `/:code/answer`) enforces a deterministic server-time cutoff: if `Date.now() > questionEndsAt` the answer is rejected (`400 Question deadline has passed`) **even while the status is still `QUESTION_ACTIVE`** — the deadline is column-authoritative and never depends on sweep timing (verified by the deadline-race test, which wedges `questionEndsAt` into the past on a never-auto-locking QUIZ room and observes the immediate rejection).

---

## 8. Finalization & Reports

- `finalizeSession` is **idempotent** (`alreadyEnded: true` when already `ENDED`); sets `status ENDED`, `endedAt`, clears `questionEndsAt`, bumps `sequence`, audits, purges temporary game chat, broadcasts.
- `calculateSessionScores` reads persisted submissions (never live state): `individualLeaderboard` = every ranked player, `leaderboard`/`teamLeaderboard` = top-10 projections, `timeBonusConfig` included.
- `GET /api/sessions/:id/report` streams an XLSX: filename sanitized (`TERMINAL_RPT_..._<ROOMCODE>_REPORT.xlsx`, no leading `= + -` → formula-injection safe), content-disposition set, **no** `passwordHash`/bcrypt material in bytes, GM-only (student → 403, unauthorized GM → 403, missing session → 404).

---

## 9. Performance & Concurrency (load-tested)

Local acceptance, 200 students, 1 room, single Postgres (no Redis):

| Phase | Result | Errors |
|---|---|---|
| Join (25-concurrent batches) | 200/200 | 0 |
| Submit (25-concurrent batches) | 200/200 correct, 100 pts each | 0 |
| State projection (`playerCount=200`) | consistent | — |
| Scoreboard after END | 200 ranked, all at 100 pts | 0 |

Timing (latest run, sweep live): join ~17.5s total (≈11/s incl. registration+auth), submit bursts ~1.3s for 200 (≈153/s). No Redis required at this scale; throughput headroom is ample since submits are single-row idempotent inserts and scoring is read-time aggregation.

---

## 10. Security Summary

- Roles: host endpoints require GM/game-master authorization; player cannot `POST /api/sessions` (403) nor reach `/host` (403); unknown rooms → 404 (no existence oracle via the host endpoint).
- Client never supplies `role`, `status`, `score`, or `teamId` — all derived server-side.
- Socket auth = JWT middleware + per-event authorization; stage mode is the only tokenless path.
- Immutability prevents post-host answer/point tampering; cutoff prevents late scoring; idempotency prevents duplicate scoring; `ENDED` is terminal.
- Excel output is sanitized (no formulas, no secrets).

---

## 11. Files Touched

| Area | Files |
|---|---|
| Server services | `sessionLifecycle.ts`, `questionSweep.ts`, `sessionService.ts`, `scoringService.ts`, `sessionReport.ts`, `presence.ts` |
| Server routes | `sessions.ts`, `games.ts` |
| Server sockets | `sockets/index.ts` |
| Client | `SessionHostPage.tsx`, `App.tsx`, `lib/socket.ts` |
| Schema | `prisma/schema.prisma` — `Session.questionEndsAt`, `autoAdvanceAt`, `sequence`, `snapshot`, `snapshotVersion`, `gmId` |
| Tests | `test_lifecycle_guard.cjs` (static write-gate scan), `test_lifecycle_hardening.cjs` (60 P0 gateway/sweep checks), `test_host_restart.cjs` (restart-safe auto-lock, own :3011 instance), `test_host_architecture.cjs`, `test_host_load_200.cjs`, + pre-existing suites (`test_gm_host_and_scoring.cjs`, `test_regression_suite.cjs`, `test_gm_report.cjs`, `test_rapid_fire_builder_fix.cjs`) |

---

## 12. Extension Points & Known Limitations

- **Auto-lock is now restart-safe and timer-free** (see §2.4): the only timer is the 1s sweep, and every lock/advance is a guarded column-conditional claim keyed on `questionEndsAt` / `autoAdvanceAt`. A horizontal deployment can run multiple sweeps safely; nothing depends on an in-process `setTimeout`.
- **Transport:** the client keeps Socket.IO's default **polling-first** transport (no `transports` override) — proxy-friendly and server-race-free now that listener registration is synchronous (verified with websocket-only sockets in the suites). Flip to websocket-first only if measured upgrade latency matters.
- **Join throughput** (~11/s incl. register+auth) is dominated by per-join DB writes; a batch-join endpoint or multi-row upsert would scale joins further if rooms exceed hundreds of registration-time joins (gameplay submits are already ~153/s).
- **Report generation** is synchronous XLSX in the request; for very large rooms consider queueing/async export.
- **Stage mode** (`session.stageMode`) is preserved through transitions but not re-architected here.