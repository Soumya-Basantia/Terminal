# TERMINAL — GAME LOGIC AUDIT (PHASE 2)

**Audit Date:** 2026-10-03  
**Auditor:** Lead Architect, Game Designer & QA Lead  
**Cognitive Model:** INFORMATION → DECISION → RISK → CONSEQUENCE → NEW INFORMATION → NEXT DECISION

---

## 1. THE_THRESHOLD (AI Model Calibration Laboratory)
- **Technical Skill Tested:** Classification threshold calibration, asymmetric cost matrix evaluation ($FN = $10,000, $FP = $500), and distribution drift adaptation.
- **Current Mechanic Fidelity:** High. Students are presented with probability distributions, baseline test metrics, and drift telemetry. They calibrate decision threshold $\tau \in [0.0, 1.0]$.
- **Optimal Strategy:** Calculate the optimal operating point on the cost curve based on class ratios and cost asymmetry; use canary probe tokens to gauge drift variance before final calibration submission.
- **Dominant Strategy / Exploit Potential:** None. Client guessing is blocked because validation is computed server-side in `Validator.ts` using ground-truth distributions. Probe tokens are strictly budget-limited (3 tokens max).
- **Decision Loop:**
  - *Information:* Validation score histograms & asymmetric cost parameters.
  - *Decision:* Select operating threshold $\tau$ for baseline; trigger canary probes for drift detection.
  - *Risk:* Over-calibrating for False Positives risks crippling catastrophic False Negatives.
  - *Consequence:* Server calculates true loss matrix and evaluates SLA compliance.
  - *New Information:* Canary probe feedback reveals post-deployment distribution drift.
  - *Next Decision:* Re-calibrate $\tau_{\text{drift}}$ to minimize total business loss.
- **Scoring:** Simple & explainable. Base score (100) + Cost efficiency bonus (up to 75) + Canary conservation bonus. Penalties applied for SLA loss violations.

---

## 2. SIGNAL_ROUTER (Network Operations)
- **Technical Skill Tested:** Network routing algorithms, SLA latency enforcement, packet loss minimization, and link bufferbloat/congestion avoidance.
- **Current Mechanic Fidelity:** High. Students navigate directed acyclic and cyclic graphs from Source (TX) to Destination (RX) under throughput and loss constraints.
- **Optimal Strategy:** Identify low-latency optical backbone links while avoiding legacy congested copper hops with high packet drop rates.
- **Dominant Strategy / Exploit Potential:** None. `Validator.ts` executes loop detection, hop adjacency verification, and telemetry simulation server-side. Fabricated routes or disconnected hops fail with 4-tier diagnostic errors.
- **Decision Loop:**
  - *Information:* Graph topology showing node hops, link bandwidth, and latency estimates.
  - *Decision:* Formulate multi-hop path from TX to RX.
  - *Risk:* Selecting lowest-latency link that suffers from bufferbloat under burst load.
  - *Consequence:* Packets dropped; score penalized for SLA degradation.
  - *New Information:* Route telemetry pinpoints congested bottleneck node.
  - *Next Decision:* Re-route packet stream through redundant secondary trunk.
- **Scoring:** Base transmission points (100) + Latency SLA margin (up to 60) + Zero-loss clean sheet bonus (+40). Deductions for dropped packets.

---

## 3. SILENT_MISSION (Covert Mission Control)
- **Technical Skill Tested:** Systems scheduling, dependency graph resolution, battery energy budgeting ($\le 60\text{W}$), and state-machine transitions with irreversible side-effects.
- **Current Mechanic Fidelity:** High. Step sequences require specific order-of-operations (Power -> Network -> Crypto). Irreversible actions (EMP blast) disable stealth options.
- **Optimal Strategy:** Construct clean dependency tree that executes required milestones with minimum battery drain and zero alert trigger.
- **Dominant Strategy / Exploit Potential:** None. Server evaluates full state machine execution sequentially. Client cannot forge intermediate success flags.
- **Decision Loop:**
  - *Information:* Target facility subsystems, energy budget, and prerequisite dependency requirements.
  - *Decision:* Sequence action cards into execution dock.
  - *Risk:* Executing crypto breach before network isolation sends an alert; executing EMP permanently fries bypass options.
  - *Consequence:* Battery depleted or alarm triggered, aborting mission attempt.
  - *New Information:* Diagnostics show exact prerequisite failure or energy deficit.
  - *Next Decision:* Re-splice action dock with lower-energy bypass actions.
- **Scoring:** Base success score (150) + First-attempt clean execution bonus (+100) + Energy conservation bonus. Submissions on 2nd/3rd attempts have scaled multipliers.

---

## 4. ROGUE_SCANNER (AI Anomaly Forensics)
- **Technical Skill Tested:** Telemetry event correlation, security auditing, log analysis, and differentiating periodic C2 beacons from background noise.
- **Current Mechanic Fidelity:** High. 22-event telemetry radar cluster. Students spend probe tokens to eliminate false positives and isolate synchronized malicious beacons.
- **Optimal Strategy:** Filter events by periodicity and payload entropy; probe suspect clusters to eliminate benign background telemetry; confirm dual synchronized beacon pair before issuing accusation.
- **Dominant Strategy / Exploit Potential:** None. Accusing without evidence incurs heavy point penalties (-40 pts), preventing brute-force guessing. Server validates event IDs and probe token accounting.
- **Decision Loop:**
  - *Information:* 22-event telemetry cluster radar with timestamps, packet sizes, and ports.
  - *Decision:* Select candidate event clusters for diagnostic probing.
  - *Risk:* Burning probe tokens on benign events leaves no budget for deep packet analysis.
  - *Consequence:* False positive cleared, or budget exhausted.
  - *New Information:* Periodic clockwork intervals revealed between EVT-11 and EVT-17.
  - *Next Decision:* Lock in anomaly signature and issue forensic quarantine.
- **Scoring:** Base anomaly score (150) + Probe conservation bonus (+40). Wrongful quarantine incurs a 40-point deduction.

---

## 5. THE_WITNESS (Detective / Binary Search Investigation)
- **Technical Skill Tested:** Information theory, binary search partitioning, logical deduction, and boolean constraint satisfaction.
- **Current Mechanic Fidelity:** High. 8 suspects, 5-question budget. Questions allow partitioning suspects into subsets (e.g., location, time, access badge).
- **Optimal Strategy:** Construct questions that partition active suspects into equal halves (4:4, then 2:2, then 1:1), guaranteeing identification within 3 questions.
- **Dominant Strategy / Exploit Potential:** None. Guessing the culprit without sufficient evidence risks warrant rejection. Question budget is strictly enforced by server state.
- **Decision Loop:**
  - *Information:* Suspect roster (8 candidates) with attributes (Alibi, Access Level, Location, Device).
  - *Decision:* Formulate inquiry query to interview witness.
  - *Risk:* Asking overly specific question (eliminates 1, leaves 7) wastes query budget.
  - *Consequence:* Witness testimony returns; board eliminates non-matching suspects.
  - *New Information:* Active suspect pool reduced to candidates satisfying all testimony.
  - *Next Decision:* Formulate second query to isolate final suspect and file arrest warrant.
- **Scoring:** Base score (100) + Question conservation bonus (+20 per unused question) + Grand Detective bonus (+15 for $\le 2$ questions used).

---

## 6. DEAD_CODE (The Bug Hunt)
- **Technical Skill Tested:** Root-cause analysis, software debugging, defect reproduction, regression testing, and code patch crafting.
- **Current Mechanic Fidelity:** High. Bug reproduction console allows running inputs against flawed rule engine. Fix selection triggers a 4-case automated regression suite.
- **Optimal Strategy:** Run boundary inputs to define the defect zone (e.g. 50-74%); select targeted rule modification that fixes edge case without breaking existing passing rules; verify full suite pass.
- **Dominant Strategy / Exploit Potential:** None. Server runs regression tests dynamically against the candidate patch. Tampered client payloads with fake passing flags are completely rejected.
- **Decision Loop:**
  - *Information:* Defective rule engine code and bug report description.
  - *Decision:* Submit test values into reproduction console to trigger bug.
  - *Risk:* Submitting an untested patch introduces regression failures.
  - *Consequence:* Reproduction console confirms defect; patch attempt returns regression feedback detailing failed test cases.
  - *New Information:* Exact failing test case and mismatched expectation identified.
  - *Next Decision:* Refine patch rule to preserve passing behavior while rectifying edge case.
- **Scoring:** Base resolution score (100) + First-attempt zero-regression bonus (+35) - 20 pts per failed regression attempt.

---

## 7. LOGIC_HEIST (Cyber Heist Logic Gates)
- **Technical Skill Tested:** Boolean algebra, combinatorial logic circuits (AND, OR, XOR, NAND, NOR), truth table inversion, and multi-stage signal propagation.
- **Current Mechanic Fidelity:** High. Three distinct vaults: Vault 1 (Linear/Non-linear gate tree), Vault 2 (Feedback/Repetition gates), Vault 3 (Conditional branching logic).
- **Optimal Strategy:** Work backwards from target vault state (Output = 1 / 0) to determine required intermediate node states and primary input signals.
- **Dominant Strategy / Exploit Potential:** None. Server calculates node gate states deterministically. Dry-run toggle prevents brute-force lockouts.
- **Decision Loop:**
  - *Information:* Circuit schematic with logic gate symbols and target lock condition.
  - *Decision:* Toggle input switches (A, B, C, D) to propagate desired signals.
  - *Risk:* Incorrect input triggers alarm lockout state in vault.
  - *Consequence:* Gate outputs update; vault latch remains locked or opens.
  - *New Information:* Signal analyzer reveals logic state at intermediate test points.
  - *Next Decision:* Adjust upstream gate inputs to resolve inverted polarity at final stage.
- **Scoring:** Base vault unlock score (50 per vault, 150 total) + Circuit efficiency bonus for minimal toggles.

---

## Summary of Findings & Minimal Fixes
1. **Mechanic Integrity:** All 7 games directly test their advertised technical skills (AI calibration, routing, scheduling, telemetry forensics, binary search, debugging, and boolean algebra).
2. **Exploit Resistance:** All 7 game validators in `server/src/engine/Validator.ts` are strictly server-authoritative, checking ground truths, budgets, state transitions, and rejecting any forged client flags.
3. **Scoring Understandability:** Each game follows an easily explainable formula: `Base Points + Skill/Efficiency Bonus - Penalties/Attempts`.
