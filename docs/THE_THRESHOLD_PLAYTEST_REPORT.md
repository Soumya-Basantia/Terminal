# THE_THRESHOLD — Human Playtest Report

## Session
- **Room Code:** J62S3
- **Date/Time:** 2026-10-02 08:56 UTC
- **Scenario:** `THE THRESHOLD: NEURAL INGESTION CALIBRATION` (Scenario ID: `THRESHOLD-LIVE-01`)
- **Challenge Type:** `THRESHOLD_CALIBRATION`
- **Environment:** Local Test Server (Node.js + Express + Prisma + SQLite, Vite React Client)
- **Player Accounts Tested:**
  - `student_thlive_1790908306851@test.com` (`Officer_ThLive_1790908306851`)
  - `Playtest Officer 1` (`student_playtest_...`)
  - `Officer_ThLive_2` (`student2_thlive_...`)

---

## Result
**PASS WITH FIXES**

The gameplay loop, threshold interaction, canary probe economy, distribution shift mechanic, server-authoritative scoring, and multi-player isolation have all been thoroughly exercised, debugged, and verified.

---

## First-Time Player Experience

- **Objective Clarity:** Highly intuitive. The mission brief ("Balance false alarms against catastrophic missed intrusions under distribution drift") and metric subtitles immediately make clear that students must keep estimated incident loss below the safety budget.
- **Threshold Understanding:** Moving the slider intuitively shifts the vertical boundary line between the blue (Benign) and red (Critical) normal distributions. Leftward movements increase Sensitivity (capturing more critical cases at the expense of false alarms); rightward movements increase Specificity.
- **Metrics Clarity:** Clear and immediate. With the addition of plain-English sub-labels (`Flagged Critical`, `False Alarm ($500/ea)`, `Cleared Benign`, `Missed Critical ($10,000/ea)`), students immediately grasp why a single missed critical case ($10,000) causes 20× more damage than a false alarm ($500).
- **Probe Clarity:** Crystal clear. The Canary Probe button allows students to spend a limited token (3 initial tokens) to test their hypothesis against server ground truth. Passing probes now show green verified telemetry with exact loss and confusion matrix values; failed probes show detailed root-cause feedback.
- **Phase Transition Clarity:** Seamless and organic. When Phase 1 commits, Phase 2 immediately displays the "DEMOGRAPHIC DRIFT ACTIVE" banner and redraws the shifted distributions. Under the old threshold, the loss turns bright red ($120,000 / Max $35,000), communicating through gameplay alone: "The environment changed, so the previous threshold is no longer safe."
- **Final Result Clarity:** Unambiguous. Locking the final shift boundary displays the completion confirmation badge, locks the controls, awards final score points (including clean-sheet and probe conservation bonuses), and prevents duplicate submissions.

---

## Gameplay Findings

### Finding 1: Single-Question Rapid-Fire Timer Lockout on Exploratory Games
- **ID:** FND-01
- **Severity:** P0 (Game-breaking)
- **Observation:** When playtesting room `J62S3` after the initial 30 seconds of round start, any probe or calibration submission was rejected with HTTP 400 `"Submission closed"`.
- **Reproduction:** Join an exploratory game session with default `timeLimit: 30`, wait $> 30$ seconds, attempt to send a canary probe or calibration.
- **Root Cause:** In `server/src/routes/sessions.ts` lines 309–319, `session.challengeStartTime` and `challenge.timeLimit > 0` were enforced indiscriminately across all game templates. While appropriate for rapid-fire quiz games, exploratory games (`THE_THRESHOLD`, `SIGNAL_ROUTER`, `SILENT_MISSION`, `ROGUE_SCANNER`, `THE_WITNESS`, `BUG_HUNT`, `LOGIC_HEIST`) rely on round-level active duration.
- **Fix:** Added `isExploratoryGame` check to bypass the single-question rapid-fire timer cutoff while the round status remains active (`ROUND_ACTIVE` or `QUESTION_ACTIVE`).
- **Verification:** Verified via `playtest_j62s3.js` and `test_the_threshold.js`.

---

### Finding 2: Phase 2 Optimal Threshold Range Contradicted Asymmetric Loss Budget
- **ID:** FND-02
- **Severity:** P1 (Major gameplay/correctness problem)
- **Observation:** In Phase 2, calibrating at the stated optimal threshold range ($T \in [42, 47]$) caused loss of $\$42,000$ to $\$70,500$, failing the challenge because it exceeded the $\$35,000$ safety ceiling.
- **Reproduction:** In room `J62S3` Phase 2, set $T = 43$. The server returns failure with total loss of $\$51,000$ (5 missed criticals at $\$10,000$ each).
- **Root Cause:** The challenge configuration and fallback in `Validator.ts` set `optimalThresholdRange: [42, 47]` based on the geometric midpoint of the distributions without factoring in the 20:1 asymmetric loss ($10,000 per FN vs $500 per FP). To avoid catastrophic FN costs under the $\$35,000$ budget, the true optimal operating point is $T \in [26, 32]$ where loss is minimized to $\$14,000$ (0 to 1 FN).
- **Fix:** Corrected `optimalThresholdRange` to `[26, 32]` in `Validator.ts` fallback and in the challenge config for room `J62S3`.
- **Verification:** Verified in `playtest_j62s3.js` Step 7 ($T = 30$ achieves $\$14,000$ loss and passes within budget).

---

### Finding 3: Reconnect State Degradation in Phase 2 / Completed State
- **ID:** FND-03
- **Severity:** P1 (Major gameplay/correctness problem)
- **Observation:** When a player reloaded the browser after completing the challenge or during Phase 2, the UI degraded back to Phase 1 baseline display and reset the threshold slider to `phase1Threshold`.
- **Reproduction:** Complete Phase 2, refresh the browser at `/play/J62S3`.
- **Root Cause:** In `ThresholdChallenge.tsx`, state restoration checked `if (d.activePhase === 2 || (d.phase1Completed && !d.phase2Completed))`. When completed, `activePhase` is `'COMPLETED'` and `d.phase2Completed` is `true`, so neither condition matched, causing the code to fall through to `else if (d.phase1Threshold !== null)` and leaving `activePhase = 1`.
- **Fix:** Added explicit check `if (d.isCompleted || d.phase2Completed || d.activePhase === 'COMPLETED')` to maintain `activePhase = 2` and restore `phase2Threshold`.
- **Verification:** Verified in `playtest_j62s3.js` Step 8 and `test_the_threshold.js` tests `[F.12–F.16]`.

---

### Finding 4: Missing Telemetry Feedback on Successful Canary Probes
- **ID:** FND-04
- **Severity:** P2 (Noticeable usability/clarity problem)
- **Observation:** When a canary probe was within budget, the probe token count decremented, but no feedback banner or metrics summary was displayed.
- **Reproduction:** Click "CANARY PROBE" with a valid threshold (e.g. $T = 50$).
- **Root Cause:** In `ThresholdChallenge.tsx`, telemetry feedback only rendered when `serverResult?.failureTier` was truthy. Since `failureTier` is `null` on passing evaluations, passing probes displayed nothing.
- **Fix:** Added a dedicated `CANARY PROBE VERIFIED — WITHIN BUDGET` card rendering total loss, safety ceiling comparison, and confusion matrix breakdown (TP, FP, TN, FN).
- **Verification:** Verified in `playtest_j62s3.js` and in `ThresholdChallenge.tsx`.

---

### Finding 5: Slider Not Disabled After Challenge Completion
- **ID:** FND-05
- **Severity:** P2 (Noticeable usability/clarity problem)
- **Observation:** After locking final shift boundary and receiving completion status, the range slider remained interactive, leading to potential user confusion about whether further adjustment was possible.
- **Reproduction:** Submit Phase 2 final boundary, then drag the slider.
- **Root Cause:** The `<input type="range">` lacked `disabled={isCompleted}`.
- **Fix:** Added `disabled={isCompleted}` and `disabled:opacity-50` to the range input.
- **Verification:** Verified in `ThresholdChallenge.tsx`.

---

### Finding 6: Metric Cards Subtitle Ambiguity for First-Time Students
- **ID:** FND-06
- **Severity:** P2 (Noticeable usability/clarity problem)
- **Observation:** The confusion matrix tiles displayed technical terms ("True Positives", "False Positives ($500)") without concise real-world operational definitions.
- **Reproduction:** Inspect the metrics HUD as a first-time player.
- **Root Cause:** Lack of contextual micro-labels explaining the operational significance of each quadrant.
- **Fix:** Added clear plain-language sub-labels (`Flagged Critical`, `False Alarm ($500/ea)`, `Cleared Benign`, `Missed Critical ($10,000/ea)`).
- **Verification:** Verified in `ThresholdChallenge.tsx`.

---

## Bugs Fixed

1. `server/src/routes/sessions.ts`: Excluded exploratory game templates (`THE_THRESHOLD`, `SIGNAL_ROUTER`, `SILENT_MISSION`, `ROGUE_SCANNER`, `THE_WITNESS`, `BUG_HUNT`, `LOGIC_HEIST`) from single-question rapid-fire timer lockout.
2. `server/src/engine/Validator.ts`: Updated Phase 2 fallback `optimalThresholdRange` to `[26, 32]` to align with asymmetric loss reality.
3. Challenge `cmuqckdvg00c886upns06rq8s` in Prisma DB: Updated `phase2Shift.optimalThresholdRange` to `[26, 32]`.
4. `client/src/components/ThresholdChallenge.tsx`: Fixed reconnect phase restoration for completed states (`activePhase: 'COMPLETED'`).
5. `client/src/components/ThresholdChallenge.tsx`: Added verified canary probe telemetry display card for within-budget probes.
6. `client/src/components/ThresholdChallenge.tsx`: Disabled range slider once calibration protocol is completed.
7. `client/src/components/ThresholdChallenge.tsx`: Added intuitive operational subtitles for all four confusion matrix quadrants.
8. `client/src/components/ThresholdChallenge.tsx`: Added `PROCESSING CALIBRATION...` state indicator on submission action buttons.

---

## Deferred UI/UX Polish

The following items are purely visual and intentionally deferred to the later design pass:
- Custom animated gradients for the distribution curve fill areas.
- Draggable blade handle on the SVG canvas itself in addition to the native slider.
- ROC Curve / Operating Characteristic toggle overlay.
- Micro-animations for probe token dissipation.
- Audio cues for probe discharge and budget breach alerts.

---

## Regression Results

| Test Suite | Purpose | Tests Run | Result |
|---|---|---|---|
| `playtest_j62s3.js` | Live Session Human Playtest (All 9 Steps) | 9 / 9 | **PASS** |
| `test_the_threshold.js` | THE_THRESHOLD Automated QA Suite | 106 / 106 | **PASS** |
| `test_signal_router.js` | SIGNAL_ROUTER Regression | 22 / 22 | **PASS** |
| `test_silent_mission.js` | SILENT_MISSION Regression | 21 / 21 | **PASS** |
| `test_rogue_scanner.js` | ROGUE_SCANNER Regression | 17 / 17 | **PASS** |
| `test_the_witness.js` | THE_WITNESS Regression | 20 / 20 | **PASS** |
| `test_dead_code.js` | DEAD_CODE (Bug Hunt) Regression | 13 / 13 | **PASS** |
| `test_logic_heist.js` | LOGIC_HEIST Regression | Multi-node | **PASS** |
| Server Build (`npm --prefix server run build`) | TypeScript Compilation | 0 Errors | **PASS** |
| Client Build (`npm --prefix client run build`) | Vite Bundle Build | 0 Errors | **PASS** |

---

## Final Status

**READY TO MOVE TO THE NEXT PHASE**

THE_THRESHOLD has passed functional human playtesting, live session verification, security validation, and full platform regression. All blocking (P0), gameplay (P1), and clarity (P2) issues are fixed.
