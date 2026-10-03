# THE WITNESS — PLAYTEST FINDINGS & VERIFICATION REPORT

This document logs issues, edge cases, and UX observations identified during live browser playtesting and verification of the **THE_WITNESS** Solo Vertical Slice.

---

### FINDING 1: Player Session Enrollment & Navigation Redirection

- **ISSUE:** When a logged-in student navigated directly to `/play/WITNZ` or was redirected after lobby entry, the application checked `localStorage.getItem('terminal_player')`. Because logged-in student accounts store session data under `terminal_user` and `terminal_token`, `player` resolved to `null`, triggering a redirect to `/join`. Since `/join` was not defined in `App.tsx`, it cascaded to `/login`, blocking direct room access.
- **EXPECTED:** Logged-in students should smoothly enter `/play/:sessionCode` and automatically be enrolled in the session player table if not already registered.
- **ACTUAL:** Unnecessary redirect loops between `/play`, `/join`, and `/login`.
- **SEVERITY:** High (Blocker for direct player links).
- **RECOMMENDED FIX:**
  1. In `PlayPage.tsx` and `LobbyPage.tsx`, resolve player as:
     `const player = JSON.parse(localStorage.getItem('terminal_player') || 'null') || JSON.parse(localStorage.getItem('terminal_user') || 'null');`
  2. On mount, call `api.post('/sessions/join', { roomCode })` to ensure the player DB record exists.
  3. Pre-fetch `api.get('/sessions/' + roomCode)` so the game view renders instantly even before socket handshake.
  4. Added dedicated `JoinPage.tsx` handling `/join` and `/join/:sessionCode` routes.
- **STATUS:** FIXED & VERIFIED.

---

### FINDING 2: Client Socket JWT Token Keying

- **ISSUE:** `client/src/lib/socket.ts` read `localStorage.getItem('token')` to authenticate the Socket.IO connection. However, the app's `AuthContext` and `LoginPage` persist the JWT token under `terminal_token`. As a result, the socket handshake was initiated without a token, failing the backend's `io.use` authentication middleware (`Authentication error`).
- **EXPECTED:** The socket client should supply the valid JWT token in `auth: { token }` for authenticated players.
- **ACTUAL:** Socket was rejected by server authentication.
- **SEVERITY:** High.
- **RECOMMENDED FIX:**
  Updated `getSocket()` in `client/src/lib/socket.ts` to read:
  `const token = localStorage.getItem('terminal_token') || localStorage.getItem('token');`
  and dynamically update socket auth if token changes.
- **STATUS:** FIXED & VERIFIED.

---

### FINDING 3: Socket Event Handshake (`session_state_update` vs `session:state`)

- **ISSUE:** The server socket handler and REST endpoints broadcast room updates using the event name `session_state_update`. However, `PlayPage.tsx` was listening strictly to `session:state`. Consequently, real-time status updates broadcast by the host or server were not picked up by the player view.
- **EXPECTED:** Real-time state synchronizations should update the player's active challenge and game state.
- **ACTUAL:** Player view remained in "Waiting for next challenge..." unless manually refreshed.
- **SEVERITY:** High.
- **RECOMMENDED FIX:**
  1. Updated `PlayPage.tsx` to register listeners for both `session_state_update` and `session:state`.
  2. Implemented active challenge resolution from `data.currentGame.challenges` when `data.currentChallenge` is omitted in the root payload.
- **STATUS:** FIXED & VERIFIED.

---

### FINDING 4: Variable Scope in `Validator.ts`

- **ISSUE:** In `server/src/engine/Validator.ts`, `evaluateWitnessCondition` referenced `attr` on lines 923-930 before declaring it, resulting in a TypeScript compilation error (`Cannot find name 'attr'`).
- **EXPECTED:** Clean build with `npm run build` with zero TypeScript errors.
- **ACTUAL:** Build failure on server tsc.
- **SEVERITY:** Medium.
- **RECOMMENDED FIX:**
  Added `const attr = String(query.attribute || '').trim();` at the beginning of `evaluateWitnessCondition`.
- **STATUS:** FIXED & VERIFIED.

---

### FINDING 5: Local Playwright CDN Sandbox Limitation

- **ISSUE:** During automated browser subagent verification, Playwright's browser manager reported an HTTP 404 from Azure CDN when trying to download `playwright-1.57.0-win32_x64.zip` in this environment.
- **EXPECTED:** Native browser testing via Subagent.
- **ACTUAL:** `open_browser_url` failed context creation due to network/CDN driver retrieval restriction.
- **SEVERITY:** Low (Environment restriction; does not affect human players running Chrome/Edge/Firefox).
- **RECOMMENDED FIX:**
  Instruct human playtester to access `http://localhost:5173/join` or `http://localhost:5173/play/WITNZ` directly via their standard local browser.
- **STATUS:** DOCUMENTED FOR HUMAN HANDOFF.

---

## HUMAN PLAYTEST OBSERVATION LOG

### PHASE 9A — 2026-10-02

Playtest was conducted in the running local application as a student, starting from login/join and following the first-time briefing into an active case. The live room was `Z9M4N`; automated integration checks used separately created sessions. This was functional QA only; no visual redesign was performed.

| Area | Result | Evidence |
|---|---|---|
| First-time join and onboarding | PASS | Joined a prepared THE_WITNESS session as a student; completed the first-time briefing and entered the investigation. |
| Question building and budget | PASS | Built and dispatched structured questions; budget updated after accepted inquiries. |
| Valid/invalid and duplicate questions | PASS | Valid questions returned testimony and evidence. Replaying a duplicate was rejected with HTTP 400 and visible inline feedback; rapid duplicate dispatch did not spend an additional token. |
| Evidence and evidence board | PASS | Inquiry history and suspect roster updated with the testimony and eliminated suspects. |
| Information gain | PASS | Balanced 4:4 partition preview was visible; follow-up narrowed the suspect set. |
| Accusation | PASS | Incorrect accusation was denied while investigation continued; correct accusation completed the case. |
| Scoring | PASS | Completed test student's re-entry displayed 175 points in the header; the API suite verified the two-question 175-point score calculation. |
| Completion/debrief | PASS | Correct solve opened the learning/debrief dialog; solved state is restored from the server on re-entry. |
| Refresh/reconnect | PASS | Refresh restored inquiry history and question budget. Simulated network disconnect/reconnect retained the same evidence and budget. |
| Re-entry after completion | PASS | Logged into the completed test student's account and revisited room `9BZQE`; the 175-point header, investigation history, and CASE CLOSED debrief were restored. |
| Multiplayer isolation | PASS (API/integration) | The integration suite used two independent student identities with separate inquiry/accusation/budget flows and verified stage synchronization. This was not a simultaneous two-browser-profile UX test. |
| Invalid/rapid actions | PASS | Duplicate dispatch was rejected without an extra effective inquiry or budget decrement. Exhausted-budget and final-accusation boundaries passed integration checks. |
| Console/runtime/network | PASS with expected rejection | No THE_WITNESS runtime crash blocked play. The deliberate duplicate request produced the expected HTTP 400 failed request. A React style warning was observed while browsing an unrelated Clubs view and was left untouched. |
| Narrow/mobile | PASS | At 390px viewport, no horizontal overflow; the invalid NaN timer overlay was absent after the fix. |

### Confirmed findings fixed

#### FINDING 6 — Invalid generic HUD progress/timer values

- **Severity:** P2
- **Reproduction:** Open the THE_WITNESS play route for a challenge without generic quiz `challengeIndex`, `totalChallenges`, `timerSecs`, or `challengeEndsAt` metadata; inspect the top-level progress HUD and narrow viewport.
- **Expected:** Optional generic quiz metadata should be omitted when unavailable.
- **Actual:** The page rendered `QNaN/` and a NaN timer ring/text, obscuring mobile content.
- **Root cause:** The shared play page formatted and rendered quiz progress/timer values without validating the optional challenge metadata.
- **Fix:** Render progress and timer only when the required metadata is finite and valid.
- **Verification:** Reloaded the live route; no NaN text/overlay and no horizontal overflow at 390px.

#### FINDING 7 — Incorrect accusation had no visible denial feedback

- **Severity:** P2
- **Reproduction:** Submit an incorrect suspect in the accusation dialog.
- **Expected:** Explain that the warrant failed and allow the student to continue investigating.
- **Actual:** The server rejected the accusation correctly, but the UI closed the dialog without communicating the result.
- **Root cause:** The client handled rejected HTTP requests but did not show feedback for a successful response whose `isCorrect` value was false.
- **Fix:** Show the existing inline error banner for the false-accusation result and clarify that only a correct accusation ends the investigation.
- **Verification:** Reproduced in the live student UI; the denial appeared and further investigation remained available.

#### FINDING 8 — First-time briefing state was shared across student identities

- **Severity:** P2
- **Reproduction:** Dismiss the briefing for an identity, keep the challenge-only legacy session-storage key set, then simulate another student identity in the same browser tab/session storage for the same challenge.
- **Expected:** Each student sees the first-time briefing once for their own identity.
- **Actual:** The challenge-only session-storage key caused a prior student's dismissal to suppress the next student's briefing.
- **Root cause:** The dismissal key was scoped to the challenge, not the student identity.
- **Fix:** Include the authenticated user (or player) identity in the per-challenge session-storage key.
- **Verification:** In the live browser, retained the first identity's legacy challenge-only dismissal key, switched the stored identity, and reloaded. The briefing appeared for the second identity. Restored the original identity afterward; no UI redesign.

### Automated verification and builds after fixes

- `node test_the_witness.js`: all 20 checks passed, including server-authoritative questions, duplicate rejection, independent student flows, scoring, reconnect, and stage synchronization. The test script was explicitly exited after its success output because open handles otherwise kept Node running.
- `node test_the_threshold.js`: 106/106 passed.
- `node test_signal_router.js`: 22/22 passed.
- `node test_silent_mission.js`: 21/21 passed.
- `node test_rogue_scanner.js`: 17/17 passed.
- Client `npm run build`: passed. Vite emitted existing chunk-size and ineffective-dynamic-import warnings.
- Server `npm run build`: passed.
- Targeted client lint completed with no unused imports/variables after cleanup; it reported React hook dependency and set-state-in-effect warnings.
- Editor diagnostics for the modified client files: no errors.

**Phase result:** THE_WITNESS Phase 9A is complete and LOCKED. Do not begin Phase 9B until a separate task is requested.
