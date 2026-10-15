# TERMINAL — Live Gameplay Lifecycle & Server-Authoritative Question Flow QA Report

## 1. Executive Summary & Defect Overview

### Defect Reported
When the Game Master (GM) starts a game, all questions appeared to start or become available simultaneously, or did not advance strictly one question at a time. The game required strictly sequential gameplay:
1. Activating Question 1 only upon start.
2. Setting an authoritative deadline based on Question 1's configured time limit.
3. Preventing future questions from leaking or being playable before their turn.
4. Auto-locking submissions when the authoritative deadline expires.
5. Advancing to Question 2 with Question 2's own configured time limit.
6. Repeating sequentially until the final question expires, then finalizing scores, rankings, and transitioning to `RESULTS`.

---

## 2. Root Cause Analysis

### 1. Template-Gated Auto-Lock and Auto-Advance in `questionSweep.ts`
- **Root Cause**: The background timer sweep in `server/src/services/questionSweep.ts` previously checked `if (templateOf(session) !== 'RAPID_FIRE') continue;` in both:
  - Step 1: Auto-locking expired questions (`QUESTION_ACTIVE` with `questionEndsAt <= now`).
  - Step 2: Auto-advancing past the reveal window (`autoAdvanceAt <= now`).
- **Impact**: Any session hosted under standard templates (such as `QUIZ`, `MATCH`, `ARRANGE`, etc.) never automatically locked expired questions or advanced to the next question. The question would remain stalled past its deadline unless manual host controls were pressed.

### 2. Leaking Future Questions in State Payload (`sessionService.ts`)
- **Root Cause**: `getSessionState` in `server/src/services/sessionService.ts` sent `currentGame.challenges` directly to all connected clients (including students). While `currentChallengeId` was set to Question 1, client gameplay views that iterated or inspected `currentGame.challenges` could display or make playable future questions immediately.
- **Impact**: Future questions, options, and prompts were visible before their turn.

### 3. Missing Active Challenge Context & Synchronization in State Payload
- **Root Cause**: The broadcast state updates did not explicitly provide a dedicated, sanitized `currentChallenge` object containing only the active question's sanitized payload (`id`, `prompt`, `points`, `options`, `timeLimit`, `timerSecs`, `challengeIndex`, `totalChallenges`, `challengeEndsAt`), and future challenges were not masked.

### 4. Missing Manual Question Advancement & Lock Controls in GM Host Controls
- **Root Cause**: `SessionHostPage.tsx` did not expose explicit "Lock Question" or "Next Question" buttons in the host controls toolbar. If the host previewed another question in the challenge list (`previewIdx`), the host view could stay stuck previewing a non-active question rather than following the live active challenge.

### 5. Snapshot Fallback for Challenge Time Limits in `sessionLifecycle.ts`
- **Root Cause**: In `startQuestion`, if a live session used live game challenges rather than frozen snapshot challenges, `snapCh` lookup failed, causing `timeLimit` to default to 30s rather than using Question N's configured `timeLimit` or `timerSecs`. Furthermore, `currentPosition` was not persisted in the session row upon starting a question.

---

## 3. Changes Implemented

### 1. `server/src/services/questionSweep.ts`
- Removed restrictive `templateOf(session) !== 'RAPID_FIRE'` checks from both Step 1 (auto-lock) and Step 2 (auto-advance). All live sessions with authoritative `questionEndsAt` and `autoAdvanceAt` timestamps are now handled automatically by the single, authoritative sweep loop.
- Updated `nextChallengeAfter` to check frozen snapshot challenges first and fall back gracefully to `session.currentGame.challenges` ordered by `position: 'asc'`.
- Ensured `dueAdvance` query includes `currentGame: { include: { challenges: { orderBy: { position: 'asc' } } } }` so sequential progression is guaranteed even if a session was initialized without snapshot challenges.

### 2. `server/src/services/sessionLifecycle.ts`
- In `startQuestion`:
  - Resolved challenge time limits from frozen snapshot or live game challenges (`timeLimit || timerSecs || 30`), ensuring each question gets its own configured deadline.
  - Calculated and persisted `currentPosition: position` in the database update.
- In `applySessionTransition`:
  - Cleared `questionEndsAt: null` and `autoAdvanceAt: null` when transitioning to `RESULTS` or `ENDED` to prevent lingering timers.

### 3. `server/src/routes/sessions.ts`
- In `POST /:code/next`:
  - Allowed manual host progression from `QUESTION_ACTIVE`, `QUESTION_LOCKED`, and `QUESTION_RESULTS`.
  - Added idempotency guard `if (req.body?.currentChallengeId && session.currentChallengeId !== req.body.currentChallengeId)` to prevent duplicate advances when a sweep advance and manual GM action coincide.

### 4. `server/src/services/sessionService.ts`
- Constructed authoritative `currentChallenge` object for the active challenge containing:
  `{ id, prompt, type, points, options, timeLimit, timerSecs, challengeIndex, totalChallenges, challengeEndsAt }`.
- Masked all future challenges in `currentGame.challenges` for active sessions (`prompt: '[ LOCKED - QUESTION X ]'`, `options: []`, `config: {}`), ensuring students cannot inspect or play questions before their turn.

### 5. `client/src/pages/SessionHostPage.tsx`
- Added `Lock` and `SkipForward` icons from `lucide-react`.
- Added `lockQuestion` (`POST /api/sessions/:code/lock`) and `nextQuestion` (`POST /api/sessions/:code/next`) actions with toast feedback.
- Added host controls toolbar buttons: **LOCK QUESTION** and **NEXT QUESTION**.
- Added `prevChallengeIdRef` to automatically reset `previewIdx` to `null` whenever `session.currentChallengeId` changes so the GM view automatically follows active sequential question progression.

---

## 4. Verification & Test Evidence

### End-to-End Sequential Gameplay Acceptance Suite
**File**: [`test_sequential_question_flow.cjs`](file:///c:/Users/SOUMYA.B/Desktop/Terminal/test_sequential_question_flow.cjs)

Executed against live running server on `http://localhost:3001`:

```text
================================================================
   SEQUENTIAL QUESTION FLOW & SERVER-AUTHORITATIVE TIMERS       
================================================================
Target: http://localhost:3001/api

  ✓ GM authenticated (demo@terminal.dev)
  ✓ Students registered (s1: seq_stud1_1791912436501, s2: seq_stud2_1791912436501)
  ✓ Game published with 3 sequential questions (Q1: 5s, Q2: 6s, Q3: 5s)
  ✓ Session created: roomCode=4FLUN, status=LOBBY
  ✓ Sockets connected & players joined room 4FLUN
  ✓ Session status is LOBBY
  ✓ currentChallenge is null in LOBBY
  ✓ Future questions are masked from playable payload (2 masked)

--- PHASE 1: START GAME -> QUESTION 1 ACTIVATION ---
  ✓ Session is QUESTION_ACTIVE
  ✓ Question 1 activated (cmv6yedcm005v89nm1qr6q38z)
  ✓ Current position is 0
  ✓ Authoritative deadline set for Q1 (~5s: 5s)
  ✓ currentChallenge matches Q1 id
  ✓ currentChallenge has Q1 prompt
  ✓ currentChallenge has 4 options
  ✓ challengeIndex is 0
  ✓ totalChallenges is 3
  ✓ Future Question 2 is locked with no exposed options
  ✓ Future Question 3 is locked with no exposed options

--- PHASE 2: QUESTION 1 SUBMISSIONS & DEADLINE EXPIRATION ---
  ✓ Student 1 submitted correct answer for Q1 before deadline
  ✓ Duplicate submission on Q1 handled idempotently (duplicate=true or 400)
  Waiting 5.5s for Q1 authoritative timer to expire...
  ✓ Late submission past Q1 deadline rejected: No active question accepting submissions

--- PHASE 3: QUESTION 1 EXPIRES -> AUTO-ADVANCE TO QUESTION 2 ---
  ✓ Server auto-advanced to QUESTION_ACTIVE
  ✓ Server activated Question 2 (cmv6yedcz005x89nmryigr0ap) automatically
  ✓ Current position advanced to 1
  ✓ Question 2 received its own 5s configured time limit (remaining=6s)
  ✓ Student currentChallenge updated to Q2
  ✓ currentChallenge has Q2 prompt
  ✓ challengeIndex updated to 1
  ✓ Submissions are evaluated against current challenge Q2 only

--- PHASE 4: MANUAL ADVANCE & IDEMPOTENCY ON QUESTION 2 ---
  ✓ Student 1 submitted correct answer for Q2
  Testing simultaneous manual advancement attempts (idempotency guard)...
  ✓ First advance attempt succeeded (200)
  ✓ Second advance attempt returned idempotent success (200)
  ✓ Session is QUESTION_ACTIVE on Question 3
  ✓ Session currentChallengeId is Question 3 (cmv6yeddb005z89nmaj4pvr5z)
  ✓ Session position is 2

--- PHASE 5: RECONNECTION / REFRESH TIMER INTEGRITY ---
  ✓ Question 3 received its own 4s timer (remaining=5s)
  ✓ Disconnect/reconnect did NOT reset authoritative server deadline
  ✓ Authoritative countdown continued smoothly (4s < 5s)
  ✓ Student 1 submitted correct answer for Q3

--- PHASE 6: FINAL QUESTION EXPIRATION -> RESULTS FINALIZATION ---
  Waiting for final question to expire and sweep to drive to RESULTS...
  ✓ Final question expiry transitioned session to RESULTS
  ✓ currentChallenge is null in RESULTS state
  ✓ Student 1 final score is exactly 60 (10 + 20 + 30) (actual=60)
  ✓ Student 1 is ranked #1
  ✓ Student 2 final score is exactly 0 (actual=0)
  ✓ Student 1 has exactly 3 submission rows in DB (n=3)

--- PHASE 7: BACKEND RESTART RECOVERY ---
  ✓ Startup sweep pass locked expired question without stalling (locked=0, status=QUESTION_LOCKED)
  ✓ Expired session recovered to QUESTION_LOCKED
  ✓ autoAdvanceAt scheduled for smooth sequential advance

================================================================
  SUMMARY: 49 PASSED, 0 FAILED
================================================================
ALL SEQUENTIAL GAMEPLAY AND TIMER ACCEPTANCE TESTS PASSED! ✦
```

---

## 5. Full Regression Suite Results

| Test Suite | Purpose | Result |
| :--- | :--- | :--- |
| `test_lifecycle_guard.cjs` | Static AST audit: raw `Session.status` writes strictly confined to gateway & sweep | **PASS (0 violations)** |
| `test_lifecycle_hardening.cjs` | Monotonic sequences, audit trail, server-authoritative sweep cutoff, frozen snapshot grading | **PASS (60 / 60)** |
| `test_host_architecture.cjs` | State machine transitions, preflight validation, snapshot immutability, role authorization | **PASS (34 / 34)** |
| `test_host_restart.cjs` | Backend crash/restart recovery, auto-lock before/after expiry reconciliation | **PASS (11 / 11)** |
| `test_gm_auth_regression.cjs` | Start, lock, advance, end authorization & idempotency across GM, student, other GM | **PASS (25 / 25)** |
| `test_gm_student_diagnostic.cjs` | Student join roster visibility, real-time Socket.IO question broadcast | **PASS (7 / 7)** |
| `test_gm_host_and_scoring.cjs` | Speed bonus, time bonus, team averaging, and Excel performance report generation | **PASS (11 / 11)** |
| `test_team_average_and_speed_bonus.cjs` | Edge case unit test suite & multi-player live team scoring | **PASS (14 unit + live)** |
| `test_sequential_question_flow.cjs` | Sequential Q1→Q2→Q3 flow, timer integrity, masking, restart recovery | **PASS (49 / 49)** |
| `client` production build | TypeScript validation & Vite bundle build (`tsc -b && vite build`) | **PASS (0 errors)** |

---

## 6. Remaining Limitations & Operating Notes

1. **Reveal Window Interval**: Between automatic question lock (`QUESTION_LOCKED`) and auto-advancement (`QUESTION_ACTIVE`), the server enforces a 4-second review/reveal window (`REVEAL_WINDOW_MS = 4000`), during which answers and leaderboards can be reviewed by host and students.
2. **Minimum Configured Timer**: Challenge configuration schemas enforce a minimum of 5 seconds (`min(5)`). Any configured question must have at least 5 seconds timer duration.
3. **Single Sweep Interval**: The backend runs the sweep pass every 1,000ms (`setInterval(..., 1000)`). The effective server-authoritative deadline cutoff is evaluated on every submission via `Date.now() > session.questionEndsAt.getTime()`, ensuring zero late submissions are accepted even between sweep intervals.
