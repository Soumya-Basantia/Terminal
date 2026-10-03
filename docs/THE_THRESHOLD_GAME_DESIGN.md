# THE_THRESHOLD — Game Design & Technical Specification
## AIERA Club Signature Game | Document Version 1.0.0
> **Target Audience:** First and second-year undergraduate engineering students.  
> **Pedagogical Core:** Decision boundaries, False Positives vs. False Negatives, Asymmetric Loss Functions, and Distribution Shift.  
> **Status:** Specification Complete — Ready for Review & Implementation Authorization.

---

## 1. Game Identity
- **Game Name:** THE_THRESHOLD
- **Club:** AIERA (AI Engineering & Research Association)
- **Tagline:** *"The line between safety and catastrophe is calibrated in millimeters."*
- **Visual Aesthetic:** High-contrast tactical radar / biomedical telemetry HUD (Emerald Green, Amber Warning, Crimson Alert, Deep Slate Charcoal).

---

## 2. Club Alignment & Context
- **Club:** AIERA
- **Role in Suite:** AIERA’s primary game until now has been `ROGUE_SCANNER` (anomaly forensics & feature correlation). `THE_THRESHOLD` introduces the foundational mathematics of Machine Learning: **Classification Decision Boundaries, Sensitivity vs. Specificity Trade-offs, and Population Drift.**
- **Theme:** Real-world safety-critical classification (e.g., Cardiac Emergency Triage, Autonomous Braking Obstacle Detection, Financial Wire Fraud Interception).

---

## 3. Template ID & Architecture Mapping
- **Template ID:** `THE_THRESHOLD`
- **Validation Type:** `THRESHOLD_EVALUATION`
- **Interaction Type:** `CONTINUOUS_TUNING`
- **Progression Type:** `MULTI_POPULATION_SHIFT` (Phase 1 Baseline → Phase 2 Distribution Shift)

---

## 4. Challenge Type
- **Classification:** Continuous Parameter Optimization & Boundary Calibration.
- **Modality:** Real-time visual density histogram / probability density curve with interactive scrubbing threshold line, accompanied by live Confusion Matrix telemetry and Asymmetric Loss readout.

---

## 5. Player Fantasy
You are the **Chief Safety Calibration Officer** at Apex Health Systems or Orbital Defense Systems. An AI model outputs risk probabilities (0 to 100). The model does not make decisions — **you do**. 
Setting the threshold too high means critical threats slip past (fatal False Negatives). 
Setting it too low means false alarms flood the facility and cause system collapse (catastrophic False Positives). 
You must calibrate the boundary to survive the shift.

---

## 6. Beginner Mental Model
- A student does not need to know what a "Receiver Operating Characteristic (ROC)" or "Type I/II error" is.
- **Mental Model:** A metal detector at an airport.
  - Crank the sensitivity to maximum: it beeps at belt buckles, coins, and fillings. The line backs up out the door (False Positives).
  - Turn the sensitivity to minimum: people walk through fast, but someone walks in with contraband (False Negatives).
  - The student immediately understands that **there is no magic zero-error setting**. You must weigh which mistake costs more.

---

## 7. Core Gameplay Loop
```
1. RECEIVE SCENARIO & COST MATRIX
   → e.g., Missed Emergency = $10,000 / Fatal (Penalty x10)
   → e.g., False Alarm Investigation = $500 (Penalty x1)

2. OBSERVE POPULATION DISTRIBUTION (PHASE 1: BASELINE)
   → Bell curve of Healthy/Benign vs. Infected/Threat cases plotted along Risk Score (0-100).
   → Notice the overlap zone (the zone of uncertainty).

3. DRAG THRESHOLD SLIDER
   → Scrub the decision boundary vertically across the distribution.
   → Watch the live Confusion Matrix (TP, FP, TN, FN) and Loss Cost Meter react instantly.

4. COMMIT PHASE 1 THRESHOLD & TRANSMIT CALIBRATION
   → Server validates score, locks baseline performance, and awards Phase 1 efficiency score.

5. THE DISTRIBUTION SHIFT ALERT (PHASE 2: THE CRUCIBLE)
   → Incoming telemetry alarm: Population characteristics change (e.g., new viral variant, night-time sensor noise).
   → The distribution curves MORPH on screen!
   → The previous threshold is now hemorrhaging penalties!

6. RECALIBRATE UNDER SHIFT CONSTRAINTS
   → Player re-evaluates the shifted overlap zone with limited calibration micro-adjustments.
   → Transmits final calibrated boundary.

7. CONCEPT REVEAL & DEBRIEF
   → Discovers: You just balanced Precision/Recall and solved for Distribution Shift.
```

---

## 8. Signature Interaction: The Boundary Blade
- **Visual:** A dual-color semi-transparent distribution plot (Blue for Benign, Neon Red for Critical). In the middle is the **Boundary Blade** — a glowing amber vertical beam that can be dragged left/right across the 0–100 spectrum.
- **Tactile Feedback:** 
  - When the blade enters the overlap zone, the cost meter dynamically vibrates/glows.
  - Hovering over individual data points shows case micro-telemetry (e.g., *"Patient #104: Troponin Level 1.8, Age 62"*).
  - Live HUD displays:
    - **Sensitivity (Recall):** $\frac{\text{TP}}{\text{TP} + \text{FN}}$
    - **Specificity:** $\frac{\text{TN}}{\text{TN} + \text{FP}}$
    - **Total Incident Penalty:** $(\text{FN} \times \text{Cost}_{\text{FN}}) + (\text{FP} \times \text{Cost}_{\text{FP}})$

---

## 9. Core Technical Concepts Taught
1. **Decision Thresholds:** Models output probabilities; human systems require discrete actions.
2. **Trade-off Frontier (Precision vs. Recall):** You cannot decrease False Negatives without increasing False Positives in an overlapping distribution.
3. **Asymmetric Loss Functions:** In the real world, a missed cancer or missed weapon is 20x worse than a re-test. Optimal thresholds mirror cost asymmetry, not raw accuracy.
4. **Distribution Shift (Dataset Drift):** A threshold tuned to perfection on training/baseline data will catastrophically fail when the real-world input distribution changes.

---

## 10. Resource System
- **Calibration Credits (3 per round):**
  - Scrubbing the slider is free in preview mode.
  - Submitting an official **"Calibration Probe"** (test batch validation on live canary traffic) consumes 1 Calibration Credit.
  - Unused credits convert into an **Audit Efficiency Bonus** upon completion.
- **Incident Budget / Penalty Meter ($/Pts):**
  - Every FP costs $C_{\text{FP}}$, every FN costs $C_{\text{FN}}$.
  - Going over the maximum Incident Ceiling triggers an **Operational Shutdown / Triage Failure**.

---

## 11. System Constraints
- **Overlap Zone:** Benign and Critical distributions always overlap by 15–30% (simulating real-world noisy signals). A threshold with zero total errors is mathematically impossible.
- **Boundary Range:** 0 to 100 (integer or 0.5 increments).
- **Asymmetric Loss Ratio:** Typically 5:1 to 20:1 favoring False Negative prevention.

---

## 12. Multiple Valid Strategies
There is no single "correct integer" — there is an **Optimal Operating Region**:
1. **The Zero-Tolerance Protocol (Ultra-Conservative):**
   - Push threshold far to the left ($T \approx 40$).
   - Guarantees 0 False Negatives (FN = 0).
   - Incurs higher False Positive costs, but completely avoids catastrophic failure penalties.
2. **The Economic Optimizer (Balanced Minimum Loss):**
   - Find the exact mathematical inflection point ($T \approx 52$) where marginal cost of 1 FP equals marginal reduction in FN penalty.
   - Yields the highest raw score if tuned with precision.
3. **The Robust Margin Strategy (Shift-Resistant):**
   - Position slightly conservative of optimal, anticipating that a population shift will skew left.
   - In Phase 2, this player needs fewer emergency recalibrations and scores higher on shift resilience.

---

## 13. Failure Mechanics (Educational Diagnostic)
When a player commits an uncalibrated threshold, the game never says *"Wrong Answer."*
It returns a **4-Tier Diagnostic Incident Report**:
1. **What You Set:** e.g., *"Threshold Calibrated at T = 72."*
2. **What Happened:** *"14 Critical ICU Patients were classified as Benign and discharged home."*
3. **Why It Failed:** *"High threshold favored False Positive reduction, but False Negative penalty ($10,000/patient) is 20x higher than False Positive penalty ($500/review). Total Loss: $140,000 exceeded safety ceiling."*
4. **Actionable Adaptation Hint:** *"Slide the threshold leftward to prioritize Sensitivity over Specificity."*

---

## 14. Recovery Mechanics
- Players are given **2 Recalibration Windows** per phase.
- An in-game **"Canary Cohort Probe"** allows players to test their setting on 10 sample cases before locking in the full population run.
- Real-time ghost markers show the previous failing threshold position so students can visualize the direction of correction.

---

## 15. Anti-Guessing Mechanism
- **Continuous Parameter Space:** 100 possible threshold settings prevent binary guessing.
- **Asymmetric Cost Curve:** Blindly picking the middle (50) or extremes (0 or 100) instantly exhausts the Incident Penalty budget.
- **Canary Probe Budget:** Students only have 3 probes; random trial-and-error quickly exhausts credits.

---

## 16. Scoring Architecture
- **Base Victory Points:** 100 pts (Achieving permissible loss under threshold budget).
- **Optimal Calibration Bonus:** Up to +50 pts (Proximity to true minimum loss inflection point).
- **Zero Critical Miss Bonus:** +30 pts (Achieved 0 False Negatives).
- **Shift Resilience Bonus:** +30 pts (Phase 2 recalibrated within 1 attempt).
- **Audit Efficiency Bonus:** +10 pts per unused Calibration Credit.
- **Excess Loss Penalty:** Deductions proportional to budget overrun.

---

## 17. Stage / Projector Experience
- **Live Visual Density Plot:** The Stage shows the aggregate campus distribution curve.
- **Team Calibration Spectrum:** All student/team threshold lines are rendered as subtle colored laser lines cutting through the distribution.
- **The Phase 2 Shift Event:**
  - A klaxon / emergency banner flashes: *"⚠️ WARNING: SECTOR 4 DEMOGRAPHIC SHIFT DETECTED — RESCALING DISTRIBUTION."*
  - The curve smoothly animates and morphs into its new bimodal distribution.
  - Spectators watch team lines suddenly fall into or out of the danger zone.
- **Leaderboard Ticker:** Real-time updates of lowest total incident cost across teams.

---

## 18. Server-Authoritative Architecture
- **Client Authority:** ZERO. The client only sends `{ threshold: number }`.
- **Server Authority:**
  - The server holds the true population arrays (IDs, actual status, scores).
  - The server computes the exact Confusion Matrix ($\text{TP}, \text{FP}, \text{TN}, \text{FN}$).
  - The server evaluates the loss function:
    $$\text{Total Cost} = (\text{FP} \times C_{\text{FP}}) + (\text{FN} \times C_{\text{FN}})$$
  - Prevents spoofing scores or manipulating patient labels.

---

## 19. Challenge Configuration Schema (JSON)
```json
{
  "scenarioId": "THRESHOLD-OP-01",
  "scenarioTitle": "OPERATION SENTINEL TRIAGE: ACUTE CARDIAC ISCHEMIA",
  "system": "Apex Emergency Triage Network",
  "missionBrief": "Calibrate the diagnostic risk threshold for acute ischemia alerts. Missed emergencies risk patient mortality (Loss: $10,000). False positive alerts consume secondary specialist review (Loss: $500).",
  "costMatrix": {
    "falseNegativeCost": 10000,
    "falsePositiveCost": 500,
    "maxIncidentBudget": 25000
  },
  "phase1Baseline": {
    "populationName": "Standard Municipal Admissions (N=100)",
    "benignDistribution": { "mean": 32, "stdDev": 10, "count": 75 },
    "criticalDistribution": { "mean": 68, "stdDev": 11, "count": 25 },
    "optimalThresholdRange": [50, 56],
    "sampleCases": [
      { "id": "CASE-01", "riskScore": 28, "isCritical": false, "label": "Musculoskeletal Pain" },
      { "id": "CASE-12", "riskScore": 54, "isCritical": true, "label": "Atypical Angina" },
      { "id": "CASE-44", "riskScore": 72, "isCritical": true, "label": "STEMI Infarction" }
    ]
  },
  "phase2Shift": {
    "shiftName": "Geriatric Sub-Cohort Surge (Distribution Drift)",
    "shiftNarrative": "A regional cold front has caused a surge in elderly patients with elevated baseline biomarkers. The critical distribution has shifted leftward toward lower baseline scores.",
    "benignDistribution": { "mean": 42, "stdDev": 12, "count": 60 },
    "criticalDistribution": { "mean": 54, "stdDev": 12, "count": 40 },
    "optimalThresholdRange": [42, 47]
  },
  "probeTokens": 3,
  "scoring": {
    "basePoints": 100,
    "optimalBonus": 50,
    "zeroLossBonus": 30,
    "shiftResilienceBonus": 30,
    "unusedProbeBonus": 10
  },
  "revealConcept": {
    "title": "DECISION THRESHOLDS, CONFUSION MATRICES & DISTRIBUTION DRIFT",
    "summary": "AI models never output binary truths—they output risk scores. Setting the cutoff threshold is a human values decision that balances false alarms against missed catastrophes. When real-world conditions shift, your model must be recalibrated."
  }
}
```

---

## 20. Socket Events
- `threshold:join` — Client joins session room.
- `threshold:probe` — Student submits test threshold; server returns probe telemetry.
- `threshold:commit` — Student locks threshold for Phase 1 or Phase 2.
- `threshold:shift_triggered` — Server broadcasts to Stage & Students that Phase 2 Distribution Shift has commenced.
- `session_state_update` — Includes `thresholdProgress: { phase, activeCalibrations, avgCampusLoss, alertsPrevented }`.

---

## 21. Persistence Requirements
- Extends `Submission.metadata` with:
  ```json
  {
    "phase1Threshold": 52,
    "phase1Cost": 4500,
    "phase1ConfusionMatrix": { "tp": 25, "fp": 9, "tn": 66, "fn": 0 },
    "phase2Threshold": 44,
    "phase2Cost": 7000,
    "phase2ConfusionMatrix": { "tp": 39, "fp": 14, "tn": 46, "fn": 1 },
    "probesUsed": 2,
    "probesRemaining": 1,
    "isCompleted": true
  }
  ```

---

## 22. Security & Anti-Tampering
- Raw classification labels (`isCritical: true/false`) are NEVER sent to the client during active gameplay.
- Only the histogram aggregate bins ($0–100$, step 2) are transmitted for visual rendering.
- Scores and costs are authoritatively calculated on the backend during probe and submission.

---

## 23. Reconnection & Resilience
- On reconnect (`GET /api/sessions/:code/threshold-state`), the server restores:
  - Active Phase (Phase 1 Baseline vs. Phase 2 Shift)
  - Current committed threshold
  - Remaining probe tokens
  - Historical Confusion Matrix and loss curve

---

## 24. Beginner Onboarding (The 30-Second Rule)
1. **Second 0–10:** Student sees a red/blue mountain curve and a glowing amber slider line.
2. **Second 10–20:** Moving the slider shows immediate text feedback: *"Left = catch more patients (more alarms). Right = fewer alarms (miss sick patients)."*
3. **Second 20–30:** Student sees the Cost Meter: *"Goal: get the total dollar cost as low as possible."*
4. Ready to play. No prior machine learning knowledge required.

---

## 25. The "Aha!" Moment
```
ACTION: Student finds the sweet spot at T = 52. Cost is very low. Student feels confident.
→
CONSEQUENCE: Phase 2 begins. The curve shifts leftward due to demographic drift.
→
OBSERVATION: Without touching anything, the Cost Meter suddenly explodes into the red with 6 Fatal Misses!
→
REALIZATION: "Wait! A threshold isn't a permanent universal truth! Because the patients changed, my old threshold is now lethal!"
→
CONCEPT: You just discovered Machine Learning Model Drift / Distribution Shift and why deployed AI systems require continuous monitoring and recalibration.
```

---

## 26. Accessibility Considerations
- **Colorblind Safe:** In addition to Blue/Red curves, patterns are used (Striped pattern for Benign, Stippled dot pattern for Critical).
- **High-Contrast Text:** High-luminance labels for TP, FP, TN, FN.
- **Keyboard Navigation:** Arrow keys allow incrementing/decrementing threshold by 1.0 ($0.1$ with Shift).
- **Screen Reader Support:** ARIA live region reading *"Current Threshold: 52.0. False Negatives: 0. False Positives: 9. Total Incident Cost: $4,500."*

---

## 27. Edge Cases & Boundary Handling
- **Threshold = 0:** Everything flagged as Critical ($\text{Sensitivity} = 100\%$, Specificity = 0%, Massive FP penalty). Handled gracefully.
- **Threshold = 100:** Nothing flagged as Critical ($\text{Specificity} = 100\%$, Sensitivity = 0%, Catastrophic FN penalty). Handled gracefully.
- **Tie Scores (Score = Threshold):** Standard convention strictly applied: $\text{Score} \ge \text{Threshold} \implies \text{Positive}$.
- **Empty Bins:** Zero cases in a bin handled without division by zero ($\text{Precision}$ fallback to 1.0 if zero predicted positives).

---

## 28. QA & Verification Requirements
A comprehensive QA test suite (`test_the_threshold.js`) will verify:
1. Template registration in `TemplateRegistry`.
2. Exact Confusion Matrix computation for all boundary cases ($T=0, 50, 100$).
3. Asymmetric cost calculation matches mathematical ground truth.
4. Phase 1 submission locks baseline score.
5. Phase 2 shift event broadcasts cleanly over WebSockets to Host, Stage, and Player.
6. Reconnection restores exact phase and threshold.
7. Anti-spoofing rejection of client-provided costs or matrices.
8. Stage view receives live aggregate telemetry without lag.
