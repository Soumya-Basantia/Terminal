# ROGUE_SCANNER — PHASE 9A HUMAN PLAYTEST REPORT

## OVERVIEW
- **Game**: `ROGUE_SCANNER`
- **Club**: `AIERA`
- **Phase**: 9A (Human Playtest + Findings Fix)
- **Status**: **LOCKED & VERIFIED**
- **Date**: 2026-10-02

---

## 1. PLAYTEST RESULTS SUMMARY

| Playtest Area | Status | Evaluation |
|---|---|---|
| **Player Flow** | **PASS** | Seamless onboarding, telemetry table navigation, probe toolbars, hypothesis drawer, and accusation modal. |
| **First-Time Comprehension** | **PASS** | 3-step 30s briefing sets clear goals: discover covert beacon, clear benign spikes, conserve token budget. |
| **Telemetry Investigation** | **PASS** | 22 curated events loaded and strictly sanitized; zero secret flags (`isRogue`, `traceDetails`) leaked to client. |
| **False Positives** | **PASS** | EVT-08 (92 GB backup), EVT-14 (Kerberos refresh), and EVT-19 (GPU JIT stall) correctly cleared via Deep Trace without penalty. |
| **Rogue Correlation** | **PASS** | Clockwork 600.00s cadence between EVT-11 and EVT-17 identified; orphaned daemon process PID confirmed. |
| **Pattern Overlay** | **PASS** | Matrix calculates time deltas, identical payload matches, and shared unregistered targets; cached comparisons re-viewable for 0 tokens. |
| **Probe Economy** | **PASS** | 15-token starting budget strictly server-authoritative; overdraft blocked; negative cost exploits rejected; duplicate probes blocked. |
| **Evidence / Reasoning** | **PASS** | Working theory hypotheses logged with 0 token expenditure; evidence required for +30 corroborating clue bonus. |
| **Final Verdict** | **PASS** | Validation requires selecting primary rogue event and mechanism; incorrect accusation penalized with -40 pts. |
| **Scoring** | **PASS** | Formula accurately awards +100 Base, +30 Clue, +10/remaining token, +20 Clean Sheet (fixed prior probe conflict). |
| **Reconnect** | **PASS** | Reconnection cleanly restores tokens, probe log, hypothesis, overlay history, cleared false positives, and unlocked trace dossiers. |
| **Multiplayer Isolation** | **PASS** | Player A and Player B have completely segregated token economies, unlocked traces, and submission scores in the same room. |
| **Completion / Debrief** | **PASS** | Post-game modal provides debrief on forensic telemetry signatures and final leaderboard standings. |

---

## 2. BUGS FOUND & RESOLVED

### Bug 1: Accusation Form Pre-Populated with Winning Solution (P1)
- **Severity**: P1 (Critical Gameplay Defect)
- **Reproduction**: Opening the "FORMALIZE ACCUSATION" modal in `ScannerChallenge.tsx` without performing any investigation.
- **Expected Behavior**: Target event, mechanism, and supporting evidence fields should start unselected/empty so players must formulate their own hypothesis.
- **Actual Behavior**: `accusedEventId` was hardcoded to `'EVT-11'`, `accusedMechanism` to `'PERIODIC_BEACON'`, and `accusedEvidence` to `'EVT-17 (600s periodic beacon to ext-staging-relay)'`. Any student opening the modal immediately saw the answer.
- **Root Cause**: Developer test initial state was left in `ScannerChallenge.tsx`.
- **Fix**: Reset initial state to empty strings (`''`), added placeholder prompt options (`-- SELECT PRIMARY ANOMALOUS EVENT --`, `-- SELECT SUSPECTED MECHANISM --`), and added validation requiring both fields before dispatch.

### Bug 2: Modal Error Obscurity (P2)
- **Severity**: P2 (Usability Issue)
- **Reproduction**: Attempting to click "SUBMIT CHARGES" in the accusation modal with empty fields.
- **Expected Behavior**: An inline error banner should appear inside the modal indicating the missing requirement.
- **Actual Behavior**: `actionError` was rendered on the main page background underneath the `z-50` backdrop overlay, leaving the user with no visual feedback as to why submission failed.
- **Root Cause**: `actionError` was only placed in the main page toolbar container.
- **Fix**: Added an inline error alert container directly inside the Accusation modal.

### Bug 3: Clean Sheet Bonus Lost to Investigation Probes (P1)
- **Severity**: P1 (Scoring Inconsistency)
- **Reproduction**: Student spends tokens to run baseline scans and deep traces, then successfully submits their first accusation on attempt 1.
- **Expected Behavior**: Award +20 Clean Sheet bonus because the student solved the mystery on their first accusation without any prior incorrect accusations.
- **Actual Behavior**: Awarded only 170 pts instead of 190 pts. Clean Sheet bonus (+20) was withheld.
- **Root Cause**: `attemptNumber` in `sessions.ts` checked `existingSub`. Because `prisma.submission.upsert` was used by `/scanner-probe` to store intermediate probe tokens, `existingSub` already existed in the DB, causing `attemptNumber` to increment to 2.
- **Fix**: Changed clean sheet check to inspect `priorIncorrectAccusations === 0` tracked in `submissionMetadata`, ensuring legitimate forensic probes do not penalize clean sheet bonuses.

### Bug 4: Inability to Re-Inspect Already Unlocked Traces & Overlays (P2)
- **Severity**: P2 (Investigation Dead End / Usability Issue)
- **Reproduction**: Player uncovers a deep trace on EVT-08 or runs a Pattern Overlay on EVT-11 & EVT-17, closes the modal, and later wants to re-read the report.
- **Expected Behavior**: Player should be able to view their already-unlocked evidence for 0 tokens.
- **Actual Behavior**: The server rejected the request with HTTP 400 "Duplicate probe: trace for event EVT-08 is already unlocked", preventing the player from re-reading evidence.
- **Root Cause**: Client did not cache unlocked dossiers or detect prior overlay results, and server did not return unlocked dossiers on reconnect.
- **Fix**: 
  1. Updated `GET /api/sessions/:code/scanner-state` to return `unlockedTraceDetails` and `baselineData`.
  2. Updated `ScannerChallenge.tsx` to maintain `traceDetailsMap`. If an event or overlay was already unlocked, the UI displays "VIEW AUDIT (Unlocked • 0 Tokens)" and re-opens the cached report instantly.
  3. Made table audit badges clickable so players can directly re-inspect cleared false positive records.

---

## 3. VERIFICATION & REGRESSION RESULTS

- **`scripts/playtest_rogue_scanner.js`**: **12/12 STAGES PASSED** (100%)
- **`test_rogue_scanner.js`**: **17/17 QA STAGES PASSED** (100%)
- **`scripts/playtest_silent_mission.js`**: **11/11 AREAS PASSED**
- **`test_silent_mission.js`**: **21/21 TESTS PASSED**
- **`test_signal_router.js`**: **22/22 TESTS PASSED**
- **`test_the_threshold.js`**: **106/106 TESTS PASSED**
- **`test_the_witness.js`**: **20/20 TESTS PASSED**
- **`test_dead_code.js`**: **13/13 TESTS PASSED**
- **`test_logic_heist.js`**: **PASSED**
- **Server TypeScript Build (`tsc`)**: **PASS (0 errors)**
- **Client Vite Production Build (`tsc -b && vite build`)**: **PASS (0 errors)**

---

## 4. PHASE 9A CONCLUSION
ROGUE_SCANNER is functionally locked, verified against real first-time student flows, resilient across network reconnections, strictly server-authoritative, and ready for Phase 9B UI/UX Design Transformation.
