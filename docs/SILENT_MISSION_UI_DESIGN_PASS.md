# SILENT_MISSION UI Design Pass

## Design Direction
**Cybercore + Neo-Brutalism + Cyberpunk + Industrial Terminal + Pixel/Dot Art**

The visual transformation establishes SILENT_MISSION as a **Covert Systems Infiltration / Mission Control Console**. The player acts as a covert operator remotely infiltrating a hostile automated facility. The interface is engineered to evoke the tactile reality of assembling an autonomous drone instruction pipeline, managing fragile system state, manipulating dependencies across high-voltage and atmospheric constraints, watching physical sensors react, and avoiding battery exhaustion before extraction.

Explicit anti-patterns avoided:
- No generic SaaS aesthetics
- No ordinary project management or kanban board patterns
- No rounded-card-heavy UI (sharp brutalist geometry with hard 2px borders)
- No excessive glassmorphism or soft blurry cards

### Semantic Color Palette
- **Electric Cyan (`#00ffcc`):** System/network information, verified circuit traces, active execution conduits.
- **Cyber Yellow / Amber (`#fcee0a`):** Planning focus, attention alerts, splicing sockets, energy reserve meter.
- **Neon Emerald (`#3fb950`):** Target objective verified, clean-sheet bonus, executed steps, sensor stability.
- **Crimson / Rose (`#ff0055`):** Battery exhaustion warning, broken dependency traces, stalled steps, facility hazards.

---

## Mission HUD
The Top Mission HUD is a compact, high-density tactical command strip:
- **Operation & Sector Identification:** `SILENT_MISSION // OP-01 COVERT CONSOLE` with CAD targeting reticle.
- **Monospace Value Readouts:** High-contrast tactical tags with hard borders.
- **Battery Status Meter:** Compact cell readout `⚡ 40 / 40 MAX` with status indicators.
- **Mission Status Tag:** High-visibility indicators: `[PLANNING]`, `[EXECUTING]`, and `[VERIFIED]`.
- **Integrated Tactical Audio Toggle:** Accessible button (`[ 🔊 ]` / `[ 🔇 ]`) to toggle procedural audio cues.
- **Field Manual & Debrief Controls:** Direct access to operational briefings and post-mission debrief reports.

---

## Planning Corridor
The **Planning Corridor** is the central HERO interaction of SILENT_MISSION:
- **Pipeline Structure:** Strong geometric blocks with hard 2px borders (`border-2 border-neutral-800 bg-[#070a10]`) and offset drop shadows (`shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]`).
- **Tactical Step Data:** Each committed step clearly communicates:
  - Step index badge: `[ STEP 01 ]`
  - Action name & icon
  - Energy cost in cyber yellow: `⚡ 15`
  - Preconditions: `NEEDS: POWER_BUS==480V_MAIN`
  - Postconditions: `EMITS: FIBER_LINK==ONLINE`
  - Execution state: `[STANDBY]`, `[▶ EXECUTING...]`, `[✓ EXECUTED ⚡10 USED]`, or `[✕ STALLED ⚡1 PENALTY]`.
- **Step Controls:**
  - Move step up/earlier (`▲`)
  - Move step down/later (`▼`)
  - In-place `[SPLICE]` button
  - Remove step button (`✕`)
- **Corridor Control Bar:**
  - `CLEAR PIPELINE` button with warning highlight.
  - `ENGAGE SEQUENCE` button with electric cyan glow and pulsating activation state.

---

## Circuit Connectors
Implemented using **native SVG circuit traces** connecting sequential steps in the pipeline:
- **Physical Circuit Layout:** Right-angle and vertical circuit traces with small circular junction nodes (`<circle r="3.5">`) and directional flow indicators (`<polygon points="...">`).
- **Satisfied Dependency State:** When previous steps supply the required prerequisites, the connector activates in glowing electric cyan (`#00ffcc`) with flowing animated dashes (`.sm-circuit-active`). Hovering reveals a `[ + SPLICE STEP HERE ]` button.
- **Broken Dependency State:** When an action lacks a prerequisite, the connector enters a high-visibility crimson alarm state (`.sm-circuit-warning`), displaying an inline badge:
  `⚠ BROKEN DEPENDENCY: MISSING [KEY==VALUE]`
  accompanied by an immediate one-click splicing button: `[ + INSERT REQUIRED_ACTION ]`.
- **Reduced Motion Compliance:** Under `@media (prefers-reduced-motion: reduce)`, animated dashes and pulse effects are disabled while preserving high-contrast static technical indicators.

---

## In-Place Splicing
SILENT_MISSION's signature mechanic is made visually obvious:
- When a dependency breaks or the player clicks `SPLICE`, an amber pulsating insertion socket opens directly between the two affected steps:
  `[ SPLICING SOCKET: INSERT AT SLOT XX ]`
- Selecting any module from the Action Arsenal or Magnetic Quick-Dock immediately splices the action into that exact slot and re-indexes all subsequent steps.
- Plays a tactile metallic socket lock audio cue (`playDockSnap()`).

---

## Magnetic Dock
The Magnetic Dock is treated as a physical hardware rack:
- Framed in an industrial dark-enclosure chassis (`border-2 border-neutral-800 bg-[#0c101a]`).
- Label: `HARDWARE MAGNETIC DOCK // ACTION BUS [ TARGET: SLOT XX ]`.
- Dot-matrix background pattern with tactile icons.
- When an action is engaged:
  - High-precision spring snap animation.
  - Confirmation status strip below the dock:
    `[ SOCKET ENGAGED: ACTION_NAME → CORRIDOR UPDATED ✓ ]`
  - Non-intrusive sound effect: short metallic snap.

---

## Action Arsenal
The Arsenal is styled as a tactical equipment module rack:
- Category filtering tabs: `[ALL]`, `[POWER]`, `[SECURITY]`, `[ENVIRONMENT]`, `[DATA]`.
- Available modules count: `(5 MODULES READY)`.
- Each action card displays:
  - Module title and category badge
  - Energy cost badge: `⚡ 10`
  - Clear technical description (preserved from Phase 8A)
  - Preconditions: `NEEDS: ...`
  - Postconditions: `EMITS: ...`
  - Irreversible action tag: `[IRREVERSIBLE STATE TRANSITION]` in crimson
  - Keyboard accessible: `tabIndex={0}`, responds to Enter and Space keys.

---

## Environmental Telemetry
The dynamic telemetry grid functions as an industrial sensor instrument cluster:
- **Authoritative Dynamic Rendering:** Reads directly from live facility state (`environmentState`).
- **Explicit Text State Indicators:** Rather than relying purely on color, every sensor displays an explicit bracketed technical state:
  - `POWER_BUS`: `24V_AUX` `[STABLE]` / `480V_MAIN` `[STABLE]`
  - `CIPHER_CORE`: `READY` `[VERIFIED]` / `LOCKED` `[WARNING]`
  - `ATMOSPHERE_PRESSURE`: `1.0_BAR` `[STABLE]` / `0.0_VACUUM` `[VACUUM]`
  - `VENT_DAMPER`: `OPEN` `[ACTIVE]` / `CLOSED` `[STANDBY]`
  - `PNEUMATIC_LIFT`: `STATIONARY` `[STANDBY]` / `SEIZED` `[SEIZED]`
  - `COOLANT_LOOP`: `STABLE` `[STABLE]` / `DRAINED` `[DRAINED]`
- **Objective Matching Badges:** Target sensors highlight with `[TARGET: MET ✓]` when matching the mission win condition.

---

## Battery Telemetry
Energy reserve is treated as mission-critical fuel:
- **Segmented Fuel Gauge:** 20 discrete Neo-Brutalist blocks representing cell capacity.
- **Dynamic Color States:**
  - Full / Normal: Electric Cyan (`#00ffcc`)
  - Projected Drain: Amber (`#fcee0a`)
  - Critical / Low ($\le 6⚡$): Crimson (`#ff0055`)
- **Planned Drain & Buffer Readout:**
  - `PROJECTED: XX⚡`
  - `BUFFER: XX⚡`
- **Exhaustion Warning:** When planned actions exceed available power, an amber/crimson alert appears:
  `[ ⚠ BATTERY EXHAUSTION WARNING: SEQUENCE WILL OVERDRAW CELLS. ABORT IMMINENT. ]`

---

## Failure Diagnostics
Failure states feel like an authoritative systems diagnostic report:
- **4-Tier Causal Diagnostic Report:**
  1. `1. WHAT YOU PLANNED:` Step sequence highlighting the failing step in crimson.
  2. `2. WHAT ACTUALLY HAPPENED:` Factual narrative explaining which steps ran and where the drone stalled with penalty cost.
  3. `3. WHY THE FACILITY STALLED:` Authoritative physical cause (e.g. ambient pressure is 0.0 vacuum, lift seized).
  4. `4. TACTICAL RECOVERY & ADAPTATION:` Actionable instruction on what prerequisite is missing.
- **Direct Splicing Action:** Includes a one-click button:
  `[ ➔ SPLICE BEFORE STEP #X ]` which directly opens the insertion socket at the failing slot.

---

## Execution Trace
A tactical event stream displayed during simulation and post-run:
- Monospace timestamped logs:
  `[01] STEP_UP_TRANSFORMER ➔ POWER_BUS: 480V_MAIN [⚡15 USED] [SUCCESS]`
  `[02] ALIGN_OPTICAL_FIBER ➔ FIBER_LINK: ONLINE [⚡10 USED] [SUCCESS]`
  `[03] CALL_ESCAPE_LIFT ➔ FAILED: ATMOSPHERE==0.0_VACUUM [⚡1 PENALTY] [FAILED]`
- State changes highlighted in electric cyan.

---

## Completion / Debrief
- **Covert Extraction Confirmation:** Emerald banner with clean-sheet bonus verification and final score award.
- **Persistent Debrief Access:** Dedicated `[ DEBRIEF ]` button remains in the Top HUD for the duration of the session.
- **Intelligence Report Styling:** Hard 2px borders, uppercase monospace headers, score breakdown grid:
  - Base Mission Points
  - Battery Cell Efficiency Bonus
  - First-Run Surgical Infiltration Bonus
  - Clean Sheet (Zero Stalls) Bonus
- **Systems Architecture Debrief:** Educational takeaway on Directed Acyclic Graphs (DAGs) and precondition/postcondition dependency validation in production distributed systems.

---

## Responsive Design
- **1440px / 1280px (Desktop):** Planning Corridor dominates center-right (8 columns); Arsenal and Magnetic Dock occupy left panel (4 columns).
- **1024px (Tablet Landscape):** 8/4 grid preserved with scaled card padding and responsive typography.
- **768px (Tablet Portrait):** Intelligent vertical stacking with collapsible drawer/accordion toggle for Arsenal and full-width Planning Corridor.
- **390px (Mobile Portrait):** Compact single-column flow:
  1. Top Mission HUD
  2. Mission Objective & Battery Bar
  3. Planning Corridor (Hero)
  4. Collapsible Arsenal & Hardware Dock
  5. Facility State Telemetry Sensors
  6. Execution Trace Log
  - Zero horizontal overflow; touch-friendly 44px+ interactive targets.

---

## Accessibility
- **Full Keyboard Navigation:** All steps, modules, dock items, and controls feature explicit `tabIndex={0}`, keyboard event handlers (`Enter` and `Space`), and visible focus rings (`focus-visible:ring-2 focus-visible:ring-[#00ffcc]`).
- **Semantic Text States:** Every status indicator pairs color with explicit text labels (`[VERIFIED]`, `[STABLE]`, `[VACUUM]`, `[SEIZED]`, `[DRAINED]`, `[STANDBY]`).
- **High-Contrast Readability:** Text adheres to WCAG AAA contrast ratios on dark industrial backgrounds (`#070a10`, `#0c101a`).

---

## Animation
- Purposeful CSS/SVG micro-animations only:
  - `.sm-circuit-active`: Smooth dashed trace motion along satisfied connectors.
  - `.sm-circuit-warning`: Pulsing warning glow on broken dependencies.
  - `.sm-snap-active`: Subtle snap glow on hardware module engagement.
- Fully respects `@media (prefers-reduced-motion: reduce)`.
- Zero third-party animation libraries added.

---

## Audio
- Procedural, micro-synthesized sound cues using native browser **Web Audio API** (`client/src/lib/tacticalAudio.ts`):
  - `playClick()`: Subtle high-frequency tactile tick for navigation and reordering.
  - `playDockSnap()`: Mechanical dual-frequency snap for Magnetic Dock and module insertion.
  - `playRelay()`: Square-wave voltage switch sound on sequence engagement.
  - `playAlarm()`: Descending sawtooth alert on prerequisite stall or vacuum lock.
  - `playSuccess()`: 4-note ascending chord on covert extraction completion.
- Fully mutable with a dedicated toggle button in the HUD.
- Automatically muted when user prefers reduced motion or accessibility constraints.

---

## Performance
- Native SVG paths for connectors (no graph libraries).
- Pure CSS keyframes and utility classes in `index.css`.
- Memoized calculations for dependencies, battery costs, and target evaluation.
- Zero external UI/chart dependencies added.

---

## Dependencies
- Zero new runtime or dev dependencies added.
- Existing React, Lucide icons, and Tailwind CSS v4 utilized.

---

## Regression Results
All automated test suites executed post-transformation:
- `test_silent_mission.js`: **21/21 PASS**
- `playtest_silent_mission.js`: **11/11 PASS**
- `test_signal_router.js`: **22/22 PASS**
- `test_the_threshold.js`: **106/106 PASS**
- `test_rogue_scanner.js`: **17/17 PASS**
- `test_the_witness.js`: **20/20 PASS**
- `test_dead_code.js`: **13/13 PASS**
- `test_logic_heist.js`: **PASS**
- `server build`: **0 errors (PASS)**
- `client build`: **0 errors (PASS)**

---

## Deferred Features
- **Multiplayer Collaborative Corridor Editing:** Simultaneous multi-cursor plan construction deferred to future collaborative modes.
- **Custom Sound Pack Uploads:** Audio uses deterministic procedural Web Audio API synthesis without external audio asset downloads.
