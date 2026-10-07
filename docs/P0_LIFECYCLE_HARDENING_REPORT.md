# P0 Production Hardening — Live-Game Session Lifecycle

**Delivery:** ONE authoritative session-status write gate · ONE restart-safe question-expiration path (no `setTimeout` as authoritative timing) — with tests as the proof, not inspection.
**Date:** 2026-10-07 · **Server:** `http://localhost:3001` (rebuilt from current `server/src`) · **DB:** single Postgres, no Redis

---

## 0. Single Production Verdict

> **READY.** The two P0 acceptance criteria are now *provably invariant*:
>
> 1. **No raw session-status write outside the lifecycle gateway** — proven by a CI-able static scan (`test_lifecycle_guard.cjs`, PASS) *and* behaviorally (60/60 hardening checks; every REST/socket status write is transition-validated, sequence-bumped, audited, broadcast; illegal writes 400/403/409; `ENDED` terminal).
> 2. **`questionEndsAt` is the authoritative deadline and no `setTimeout` exists as authoritative timing** — the only timer left in the server is a single 1s sweep that *observes* the column; auto-lock survives restarts (11/11 restart checks), expired-on-startup rooms reconcile on the first sweep, duplicates are impossible by claim-guard, and the submit paths enforce the deadline by server time even before any status flip.
>
> All pre-existing suites re-verified green on top (34+11+10+31+builder+load). Residual gap (non-P0, no blocker): visual browser QA of the host-room UI (see §7).

---

## 1. Acceptance Criteria → Proof Mapping (master prompt TESTS 1–14)

| # | Criterion | Where proven | Result |
|---|---|---|---|
| 1 | Every session-status mutation goes through ONE authoritative gateway | §4.1; `test_lifecycle_guard.cjs` (static); hardening T1/T5 (REST + socket, invalid → 409/400/`error`) | **PASS** |
| 2 | No unauthorized raw write; guard is enforceable | Static guard scans all of `server/src`; hardening T2 (student `PUT /status` → 403) | **PASS** |
| 3 | Versioning/sequence monotonic, not bumped by reads | Hardening T3 (`sequence` 1→2→3→4; read-only GETs equal) | **PASS** |
| 4 | Every transition audited (who/what/from/to) | Hardening T4 (`SESSION_STATUS_*`, `GAME_ENDED`, `QUESTION_SWITCHED`, sweep `QUESTION_LOCKED` as actor `SYSTEM`) | **PASS** |
| 5 | Invalid transitions rejected, hot state changes refused | Hardening T5 (409/400/403; socket `error`) | **PASS** |
| 6 | QUESTION_ACTIVE→QUESTION_ACTIVE re-arm works **and** same-select stays idempotent (never re-stamps) | Hardening T6: switch → re-stamped `challengeStartTime`+`questionEndsAt`, sequence++, `QUESTION_SWITCHED` audit; same re-select → identical timestamp, no sequence bump | **PASS** |
| 7 | No in-process `setTimeout` as authoritative timing | §4.2; hardening T7 full 3-question auto-lock chain with zero host action; grep: only `setInterval` in server = the sweep | **PASS** |
| 8 | Restart before expiry → auto-lock after restart | `test_host_restart.cjs` A → 11/11 (score survives, late submit 400, no double-score, chain → RESULTS) | **PASS** |
| 9 | Expired-on-startup → reconciled immediately | `test_host_restart.cjs` B (first sweep pass locks; audit `SYSTEM`) | **PASS** |
| 10 | No double-score after lock | Hardening T10 (`submission` row count stays 1 after late submit) + restart A | **PASS** |
| 11 | Deterministic deadline (server-time cutoff, sweep-independent) | Hardening T11 (`questionEndsAt` forced to past on a never-auto-locking QUIZ room → `400 question deadline has passed` while status still `QUESTION_ACTIVE`) | **PASS** |
| 12 | Snapshot grading stays frozen after editor edits | Hardening T12 (live `config.answer`→`'Z'` after host; frozen `'A'` still grades correct) | **PASS** |
| 13 | Idempotency: duplicate submit / END / HOST / next | Hardening T13 (`duplicate:true` + 1 row; second END no sequence bump; HOST-after-END → fresh room, never reopens; `/next` after END → 409) | **PASS** |
| 14 | ENDED stays terminal | Hardening T14 (`start` 409, `PUT status LOBBY` 409, join 410, `ENDED` persists) | **PASS** |

Plus the static architecture acceptance (grep-invariant, CI-able): **6 status-bearing session mutations, all inside `sessionLifecycle.ts` + `questionSweep.ts`; 0 elsewhere.**

---

## 2. What the Audit Found (root causes this cycle)

| # | Defect | Impact before fix |
|---|---|---|
| RC1 | `PUT /:id/status` and `PUT /:id/advance` bypassed the machine — accepted stray literals, performed machine-illegal writes, no sequence/audit | An "advance" mid-question silently finalized or skipped states |
| RC2 | `host:select_game` / `replay_game` / `skip_game` / `random_game` did raw `prisma.session.update({ status })` — no transition validation, no sequence, no audit | Invalid selects could corrupt the room state outside the machine |
| RC3 | `/next` no-more-challenges branch wrote `RESULTS` directly | Bypassed the gateway; irreversible chains not audited |
| RC4 | RAPID_FIRE auto-lock + reveal chain ran on in-process `setTimeout` (`startRapidFireChallenge`) | Server restart stranded rooms `QUESTION_ACTIVE` forever; deadlines depended on process liveness |
| RC5 | Deadlines were *displayed*, not enforced — submit gates checked status only | A submit after the deadline (before a lock flip) still scored |

---

## 3. What Changed (implementation)

### 3.1 The lifecycle gateway (`server/src/services/sessionLifecycle.ts`)
- `applySessionTransition` now takes `opts.data` (merge) and nulls `autoAdvanceAt` on every **explicit** transition; still: reject(`canTransition`) → `sequence+1` → `writeAudit` → broadcast.
- `selectGameForSession(session, {gameId, position}, opts)` — the STARTING transition for host game-select/replay/skip/random: sets `currentGameId/currentPosition`, clears challenge + `autoAdvanceAt`, increments `currentRun`, audits `SESSION_STATUS_STARTING`.
- Existing `startQuestion` same-status re-arm (preserved), `lockQuestion`, `finalizeSession` all clear `autoAdvanceAt`.

### 3.2 The sweep (`server/src/services/questionSweep.ts`) — NEW
- One `setInterval` (1s) + immediate boot reconciliation. Authority: persisted `questionEndsAt` / `autoAdvanceAt`.
- Lock path: `updateMany` claiming `WHERE id AND status='QUESTION_ACTIVE' AND questionEndsAt <= NOW` (RAPID_FIRE only; manual-lock semantics for other templates preserved) → `QUESTION_LOCKED`, `sequence+1`, `autoAdvanceAt = NOW+4s` (legacy reveal window, now a column), audit `SYSTEM`, broadcast.
- Advance path: claims `status='QUESTION_LOCKED' AND autoAdvanceAt <= NOW` → next frozen question (or `RESULTS` after the last).
- Claim-guards make double sweep / overlapping pass / manual-lock races impossible (a lost claim = 0 rows affected).

### 3.3 Rewired bypasses
- `PUT /:id/status` → gateway (400 invalid literal · 409 illegal · `ENDED`→`finalizeSession` · gmId ownership check).
- `PUT /:id/advance` → gateway; next-game branch = `STARTING` transition; ending branch **gated by `canTransition`** (mid-question → 409) else `finalizeSession` → ENDED.
- `/next` no-more-challenges → `applySessionTransition(RESULTS)` (idempotent at RESULTS).
- `host:select_game/replay_game/skip_game/random_game` → `selectGameForSession` / `finalizeSession` (+ `error` emit on machine rejection). `host:end_event` unchanged (already `finalizeSession`).
- Deleted `startRapidFireChallenge` (the `setTimeout` helper) and its call site; sweep started at end of `setupSocketHandlers`.

### 3.4 Server-time deadline enforcement (all three submit paths)
`/:code/submit`, `/active/submit`, `/:code/answer`: `Date.now() > questionEndsAt` → `400 Question deadline has passed` — *independent of the sweep*.

### 3.5 Schema
`Session.autoAdvanceAt DateTime?` (pushed via `prisma db push`; generated client + engine copied into `server/node_modules`).

---

## 4. Verification (evidence)

Run against the rebuilt running server (fresh instance for the restart suite):

```
test_lifecycle_guard.cjs        STATIC   PASS ✦   (6 status writes all in gateway/sweep; 0 elsewhere)
test_lifecycle_hardening.cjs    60/60    PASS ✦   (TESTS 1–14 incl. re-arm, auto-lock chain, deadline race, snapshot grade, ENDED terminal)
test_host_restart.cjs           11/11    PASS ✦   (restart-before-expiry + expired-on-startup, own :3011 instance, master stopped)
test_host_architecture.cjs      34/34    PASS     (pre-existing, re-verified)
test_gm_host_and_scoring.cjs    11/11    PASS     (pre-existing, re-verified)
test_regression_suite.cjs       10/10    PASS     (pre-existing, re-verified)
test_gm_report.cjs              31/31    PASS     (pre-existing, re-verified)
test_rapid_fire_builder_fix.cjs PASS              (pre-existing, re-verified)
test_host_load_200.cjs          PASS ✦   (200/200 joined · 200/200 scored 100pts · 0 errors · submit burst ≈153/s — sweep live)
Server build                    npx tsc EXIT=0
```

---

## 5. Lifecycle & Auto-Lock Design (as built)

- **One write gate:** `server/src/services/sessionLifecycle.ts` is the only module that performs a persistent `Session.status` mutation; the sweep is the only other module allowed by the static guard (it transitions via the machine's own service functions). Everything else must call it.
- **Restart-safe timing:** all timing state is columns (`questionEndsAt`, `autoAdvanceAt`). The 1s sweep is a *reactor*, not an oracle; losing the process loses nothing. `grep setTimeout server/src` → only a comment.

---

## 6. Files

| Area | Files |
|---|---|
| Core | `server/src/services/sessionLifecycle.ts` (gateway + selectGameForSession), `server/src/services/questionSweep.ts` (NEW), `server/src/routes/sessions.ts` (rewired /status, /advance, /next, deadline gates), `server/src/sockets/index.ts` (select/replay/skip/random + sweep boot) |
| Schema | `prisma/schema.prisma` — `Session.autoAdvanceAt` (pushed) |
| Tests | `test_lifecycle_guard.cjs` (NEW), `test_lifecycle_hardening.cjs` (NEW), `test_host_restart.cjs` (NEW) |
| Docs | `docs/GAME_HOST_ARCHITECTURE.md` (§2.2–2.5, §6, §7.3, §9, §11, §12), `docs/GAME_HOST_QA_REPORT.md` (§1–6) |

---

## 7. Residual Risks (non-blocking)

1. **Single-instance assumption:** claim-guards are multi-instance-safe by construction, but the app is deployed/tested as one process + one Postgres.
2. **Visual/browser QA** of the hardened host room and a scripted GM-refresh recovery were not automated this cycle (covered structurally: synchronous socket listener registration, reconnect re-join, REST-first refetch). Recommend a `browse`/design-review pass before a high-visibility production launch of the host UI.
3. Transport stays socket.io default polling-first (proxy-resilient; websocket-only verified race-free in suites).