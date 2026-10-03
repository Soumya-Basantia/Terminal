# THE_THRESHOLD UI Design Pass

## Design Direction
**Core:** Cybercore + Neo-Brutalism  
**Secondary:** Cyberpunk + Pixel Art + Dot Art  
**Visual Behavior:** Animated scientific visualization, telemetry-like AI operations interface, controlled laser glow, strong visual hierarchy, technical instrumentation aesthetic.

The interface evokes a futuristic AI operations calibration console where an operator is tuning a live machine-learning decision boundary under severe asymmetric incident risk.

---

## Major Changes

1. **Top Status Bar (AI Ops HUD)**:
   - Replaced generic header with a hard-edged, neo-brutalist technical HUD.
   - Status chips: `AI_OPS` tag, active scenario title, compact step-by-step Phase indicator (`01_BASELINE ➔ 02_DRIFT ➔ COMPLETE`), Canary Probe capsules (`[■] [■] [■]`), and live digital boundary readout (`T = XX`).

2. **Hero Calibration Graph (SVG)**:
   - Expanded viewBox to `680 x 230` with balanced margins (`padX: 32`, `padTop: 26`, `padBottom: 34`).
   - Added subtle dot-matrix background pattern (`#th-dot-matrix`) at 16x16px grid spacing.
   - Added horizontal amplitude gridlines (25%, 50%, 75%, 100%) and vertical coordinate axes.
   - Integrated classification zone shading (`fill="rgba(0, 229, 255, 0.03)"` for predicted Benign, `fill="rgba(255, 0, 85, 0.03)"` for predicted Critical) with in-graph directional labels (`◄ PREDICTED BENIGN (SPECIFICITY)` and `PREDICTED CRITICAL (SENSITIVITY) ►`).
   - Rendered high-contrast, glowing Gaussian curves:
     - **Benign Curve**: Cyber-cyan (`#00e5ff`) with glowing SVG filter and downward gradient fill.
     - **Critical Curve**: Cyber-pink (`#ff0055`) with glowing SVG filter and downward gradient fill.
   - Distinct peak markers with dynamic frequency labels (`Benign Peak (N=XX)` / `Critical Peak (N=XX)`).
   - Corner pixel-art registration reticles for calibration instrument aesthetics.

3. **Threshold Beam (Calibration Blade)**:
   - Dynamic laser beam at `x = bladeX` with ambient laser glow (`filter="url(#th-glow-beam)"`) and dashed core line (`strokeDasharray="4 2"`).
   - Top reticle badge tracking with the blade: `T = XX` with high-contrast amber border and subtle glow.
   - Diamond/circle coordinate anchor pins on top and bottom guide rails.

4. **Calibration Potentiometer (Custom Slider)**:
   - Retained native `<input type="range" min="0" max="100">` as authoritative source of interaction.
   - Styled via `.threshold-slider` in `client/src/index.css`:
     - 6px dark track with inset shadow.
     - 16x28px neo-brutalist rectangular amber potentiometer thumb (`#fcee0a`) with 2px hard border and laser glow.
     - Smooth micro-animation on hover (`transform: scaleY(1.15)`).
     - Distinct mechanical scale indicators: `[00] FLAG ALL`, `[25]`, `[50] MID`, `[75]`, `[100] CLEAR ALL`.
     - Sensitivity vs Specificity directional markers (`◄ MAX SENSITIVITY` vs `MAX SPECIFICITY ►`).
     - Accessible keyboard tuning guidance (`← / →` keys for precision adjustment).
     - Full disabled state locking when calibration protocol completes.

5. **Confusion Matrix Telemetry (4 Operational Quadrants)**:
   - Technical 2x2 grid formatted as live telemetry quadrants:
     - **TP (True Positives)**: Cyan theme, "Flagged Critical", "Secured Intrusions", "+CORRECT" badge.
     - **FP (False Positives)**: Amber theme, "False Alarm", plain-English "$500 per incident" cost tag.
     - **TN (True Negatives)**: Blue theme, "Cleared Benign", "Unobstructed Flow", "+CORRECT" badge.
     - **FN (False Negatives)**: Pulsing crimson theme, "Missed Critical", "$10,000 per disaster" high-hazard alert.
   - Prominent footer banner highlighting the asymmetric penalty ratio: `(FN × $10,000) + (FP × $500)` with `20:1 PENALTY ASYMMETRY` callout.

6. **Incident Loss Telemetry**:
   - High-visibility loss readout with `$XX,XXX` formatting and dynamic safety badge:
     - `SAFE` (emerald green badge) when `loss <= maxBudget`.
     - `BREACH` (crimson red pulsing badge) when `loss > maxBudget`.
   - 20-segment neo-brutalist ASCII-style progress bar with real-time budget utilization percentage and `$0` to `$XXK` scale markers.

7. **Demographic Shift Warning (Phase 2)**:
   - High-contrast hazard banner alerting operator to distribution drift (`GERIATRIC POPULATION SURGE DETECTED`).
   - Explains the environmental shift (elevated baseline troponin + blunted infarction response) and prompts immediate recalibration.

8. **Diagnostic Debrief & Telemetry Cards**:
   - Passing Canary Probe: Glowing emerald confirmation card verifying decision boundary safety without granting premature score.
   - Failing Probe / Over-Budget Attempt: 4-Tier Diagnostic debrief detailing Observation, Root Cause, and Tactical Adaptation Hint.
   - Protocol Completion: Locked state console confirming population protection and final boundary position.

---

## Gameplay Preservation

**CONFIRMED: Gameplay logic and server authority remain 100% unaltered.**
- Zero changes to threshold evaluation mathematics (`Validator.evaluateThreshold`).
- Exact confusion matrix calculations preserved (`TP`, `FP`, `TN`, `FN`).
- Asymmetric incident loss formula unchanged: `(FN * 10000) + (FP * 500)`.
- Probe economy intact: 3 probes maximum, strictly enforced on server, 0 points awarded on probe, remaining tokens persisted in DB.
- Phase progression unchanged: Phase 1 baseline ➔ Phase 2 distribution shift ➔ Final completion lock.
- API endpoints and parameters preserved: `GET /sessions/:code/threshold-state`, `POST /sessions/active/submit`.
- Anti-cheat and server authority intact: Client-forged matrices or scores are discarded; all evaluations performed server-side.

---

## Responsive Behavior

- **Desktop (1440px / 1280px)**:
  - Distribution graph acts as the hero visual object, dominating the upper canvas.
  - Telemetry area arranged in a 12-column layout: 7 columns for Confusion Matrix telemetry and 5 columns for Incident Loss & Action Dispatch.
- **Tablet (1024px / 768px)**:
  - SVG graph automatically scales viewBox while preserving crisp text, vector lines, and tick marks.
  - Telemetry seamlessly adjusts padding and font tracking for medium viewports.
- **Mobile (390px)**:
  - Linear vertical stack:
    1. Header HUD & Phase Indicator
    2. Hero Distribution Graph
    3. Precision Potentiometer & Scale
    4. Confusion Matrix (2x2 grid with compact numbers)
    5. Incident Loss Meter & Segmented Bar
    6. Action Buttons & Canary Probes
    7. Diagnostic Telemetry Feedback
  - Horizontal scrolling prevented; touch targets remain accessible and large.

---

## Accessibility

- **Keyboard Navigation**: Native HTML range input preserves full arrow key navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`), with explicit instructional hint for keyboard users.
- **ARIA Attributes**: Slider contains `aria-label="Classification decision threshold"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and dynamic `aria-valuenow`.
- **Textual Redundancy**: Information is never conveyed by color alone. Every metric includes plain-English descriptive labels ("Missed Critical", "False Alarm", "Cleared Benign", "Flagged Critical") and explicit numerical costs.
- **Contrast**: High-contrast ratios on dark background (`#080a0f`) using bright cyan (`#00e5ff`), cyber-pink (`#ff0055`), amber (`#fcee0a`), emerald (`#00ffcc`), and clean white/slate text.
- **Reduced Motion**: Dedicated `@media (prefers-reduced-motion: reduce)` block in `index.css` disables non-essential scale transitions and pulse animations.

---

## Performance

- **Zero Added Dependencies**: Built exclusively with native SVG, React hooks (`useMemo`), and existing Tailwind/CSS variables.
- **Lightweight SVG Math**: Optimized analytical Gaussian curve sampling (`0..100` step loop in `useMemo`) executes in < 0.1ms per slider change, ensuring 60fps interaction without frame drops.
- **No Heavy Charting Libraries**: Avoided D3, Chart.js, Recharts, or Three.js to keep bundle size small and load time instant.

---

## Validation

All automated test suites and platform regression tests pass with 0 errors:

1. **THE_THRESHOLD Automated QA**: 106 / 106 PASS (`node test_the_threshold.js`)
2. **SIGNAL_ROUTER Regression**: 22 / 22 PASS (`node test_signal_router.js`)
3. **SILENT_MISSION Regression**: 21 / 21 PASS (`node test_silent_mission.js`)
4. **ROGUE_SCANNER Regression**: 17 / 17 PASS (`node test_rogue_scanner.js`)
5. **THE_WITNESS Regression**: 20 / 20 PASS (`node test_the_witness.js`)
6. **DEAD_CODE Regression**: 13 / 13 PASS (`node test_dead_code.js`)
7. **LOGIC_HEIST Regression**: PASS (`node test_logic_heist.js`)
8. **Live Playtest Suite**: 9 / 9 STEPS PASS (`node playtest_j62s3.js` on live room `J62S3`)
9. **Server TypeScript Build**: PASS, 0 errors (`npm --prefix server run build`)
10. **Client TypeScript + Vite Build**: PASS, 0 errors, built in 1.02s (`npm --prefix client run build`)

---

## Deferred Features

As established in the project specification and human playtesting, the following features remain intentionally deferred:
- ROC (Receiver Operating Characteristic) curve interactive overlay.
- Direct draggable blade handles on SVG canvas (retaining native accessible range potentiometer).
- Audio synthesis and sound effects.
- Full-screen cinematic video cutscenes.
- Third-party chart rendering libraries.
