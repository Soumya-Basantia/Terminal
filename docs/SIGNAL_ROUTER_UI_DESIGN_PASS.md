# SIGNAL_ROUTER UI Design Pass

## Design Direction
**Cybercore + Neo-Brutalism + Cyberpunk + Pixel/Dot Art**

The visual transformation establishes SIGNAL_ROUTER as a futuristic Network Operations Center (NOC) tactical switchboard console. The operator acts as a telemetry routing officer under live capacity pressure, guiding high-bandwidth streams across a congested municipal fiber mesh to prevent buffer overflow and packet loss while complying with latency SLAs.

Key aesthetic pillars:
- **Neo-Brutalism:** Hard 2px high-contrast borders (`border-2 border-[var(--border-subtle)]`), sharp geometry (`rounded-none` and `rounded-sm`), offset solid drop shadows (`shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]`), uppercase monospace data labels, and no rounded SaaS pills.
- **Cybercore / Cyberpunk:** Dark technical operations canvas (`#05070a`, `#0b0e14`), glowing neon conduits, and high-visibility status signaling:
  - **Electric Cyan (`#00ffcc`):** Active transmission corridors, ingress beacons, and primary telemetry.
  - **Cyber Yellow (`#fcee0a`):** Current route head, next-hop invitations, and diagnostic probe tokens.
  - **Crimson / Rose (`#ff0055` / `#ff7b72`):** Buffer overflow alarms, congested links, and headroom deficits.
  - **Neon Emerald (`#3fb950`):** Target egress gateway, verified probe pings, and delivery lock.
- **Pixel / Dot Art Accents:** Coordinate dot matrix background on the SVG canvas (`<pattern id="sr-dot-grid">`), corner CAD crosshairs `+`, square probe token cells `[■] [■] [■]`, and pixelated status indicators.

---

## Visual Changes
1. **Header / HUD Bar:**
   - Redesigned into a compact, high-density Neo-Brutalist HUD.
   - Stream volume (`4.5 Gbps`) and latency SLA (`≤ 80 ms`) metrics display in cybercore contrast panels.
   - Replaced basic probe text with tactile diagnostic token cells (`[■] [■] [■]`).
   - Integrated quick-access `[ ? // FIELD MANUAL ]` button.
2. **Hero Network Canvas:**
   - Enlarged to visually dominate the desktop interface (8/12 grid columns).
   - Styled with dark operations framing (`#05070a`), CAD gridlines, and corner registration marks.
   - Live inspection bar docked beneath the canvas gives instant hover readouts for links and nodes.
3. **Nodes:**
   - Transformed into tactical switchboard junction stations with sharp corners and distinct type styling.
   - Clear visual hierarchy for Source Ingress (`[TX]`), Target Egress (`[RX]`), Active Route Hops (`01`, `02`), Route Head (`[HEAD]` badge), and Available Next Hops (`+ NEXT HOP`).
4. **Active Route Conduit:**
   - Active path rendered as a continuous glowing neon cable with directional chevrons.
   - Animated SVG packet pulse (`<animateMotion>`) moves along the exact coordinates from source to target.
5. **Route Corridor Strip:**
   - Vertical breadcrumb deck with clickable waypoint chips for instant backtracking.
   - Integrated with real-time pre-flight latency projection and bottleneck link telemetry.
6. **Transmission Controls:**
   - Hard-edged Neo-Brutalist action buttons with offset shadows.
   - Post-delivery state locks the circuit in delivered mode while offering a dedicated `[ VIEW DEBRIEF ]` button.

---

## Network Visualization
- **Canvas Base:** High-performance SVG grid with `viewBox="0 0 1000 600" preserveAspectRatio="none"` and dot matrix overlay (`#sr-dot-grid`).
- **Transmission Links:**
  - Inactive links: Subtle steel cables (`rgba(255,255,255,0.20)`).
  - Hovered links: Bright cyan preview stroke with pointer cursor.
  - Active route links: Heavy 4.5px neon cyan stroke with `#sr-glow-cyan` filter.
  - Congested / Overloaded links: Heavy 6.0px crimson stroke (`#ff0055`) with pulsing `#sr-glow-red` alarm glow.
- **Interactive Badges:**
  - Rectangular data chips centered on each cable showing available headroom and total capacity:
    - Normal: `AVL 8.0G / 10G`
    - Congested: `▲ AVL 1.2G / 5G` (high-contrast red warning chip).
- **Packet Pulse Motion:**
  - Smooth 1.1s SVG `<circle>` motion path along active waypoints.
  - Fully respects `@media (prefers-reduced-motion: reduce)`.

---

## Route Interaction
- **Click-to-Route:** Clicking an adjacent node OR clicking the interconnecting link cable extends the path immediately.
- **One-Click Backtracking:**
  - Clicking any earlier node in the topology canvas truncates the route back to that node.
  - Clicking any earlier waypoint chip in the right-hand Route Corridor strip immediately truncates to that hop.
  - Clicking an active route cable truncates the path to that segment.
- **Route Clearing:** Dedicated `[ RESET ]` button resets the path back to `NODE_TX`.

---

## Capacity Telemetry
- **Pre-Flight Health Deck:**
  - Real-time latency calculation vs. maximum SLA budget (`50 ms / SLA ≤ 80 ms`).
  - Real-time status forecast: `[✓ CLEAR FLOW]` vs. `[❌ OVERFLOW]`.
- **Bottleneck Analysis Box:**
  - Identifies the minimum-headroom link in the selected route.
  - If headroom is insufficient for the 4.5 Gbps stream, displays a prominent crimson alarm:
    `BUFFER OVERRUN: +3.3 Gbps DEFICIT`.
- **Live Hover Bar:**
  - Inspects any link or node on hover, reporting raw capacity, ambient load, headroom, and latency without cluttering the graph.

---

## Diagnostic UX
- **Canary Probes:**
  - 3 probe tokens represented as amber tactile blocks: `[■] [■] [■]`.
  - Dispatches zero-risk test pulse to measure latency and verify throughput before engaging stream.
  - Decrements server-authoritatively; exhausts to `[×] [×] [×]`.
- **Probe Telemetry Output:**
  - Renders a terminal-style verified telemetry card with round-trip latency (`RTT`), hop count, and bottleneck link headroom.
- **Depletion Alerts:**
  - High-contrast alert banner warns when probe tokens are depleted or dispatch errors occur.

---

## Success/Failure States
- **Buffer Overflow (Failure State):**
  - High-impact Neo-Brutalist warning modal (`4-Tier Causal Diagnostic Telemetry`):
    1. What You Routed: Full node sequence with failing link pinpointed.
    2. What Actually Happened: Exact headroom shortfall and packet spill description.
    3. Why The Network Failed: Causal explanation of background load vs stream volume.
    4. Tactical Adaptation Hint: Actionable guidance pointing toward higher-capacity optical trunks.
  - Includes a `[ ⟲ Splice & Reroute Path ]` action that truncates the route to right before the failing hop in one click.
- **Stream Delivered (Success State):**
  - Emerald victory modal displaying verified zero packet loss.
  - Full multi-factor score telemetry breakdown:
    - Base Challenge Points (+100)
    - Zero-Loss Integrity Bonus (+50)
    - Latency SLA Margin Bonus (+11)
    - Probe Conservation Bonus (+10)
    - Total: +171 PTS (or +161 PTS if probe used)
  - Educational distributed systems takeaway explaining why the shortest geographic path is frequently a bottleneck trap.
  - Delivery lock prevents accidental re-transmission while preserving a `[ VIEW DEBRIEF ]` button.

---

## Responsive Design
Tested and verified across all standard responsive breakpoints:
- **1440px / 1280px (Desktop):** Hero topology mesh occupies 8 columns; corridor strip and telemetry occupy 4 columns.
- **1024px (Tablet Landscape):** Canvas scales cleanly; font sizes and badge widths maintain perfect proportion.
- **768px (Tablet Portrait):** Panels stack vertically: Header HUD ➔ Hero Topology Mesh ➔ Inspection Dock ➔ Waypoint Corridor ➔ Telemetry ➔ Transmission Controls.
- **390px (Mobile):** Topology canvas height adjusts to 460px; SVG text and badges remain crisp; buttons adopt full-width stacked layout; horizontal overflow completely eliminated.

---

## Accessibility
- **Semantic Structure:** Semantic `<header>`, `<main>`, `<section>`, and `<button>` elements.
- **Keyboard Navigation:** All nodes have `tabIndex={0}`, `role="button"`, and `onKeyDown` handlers supporting `Enter` and `Space`.
- **ARIA & Labels:** Detailed `aria-label` tags on nodes and interactive cable lines.
- **Reduced Motion:** Fully integrated `@media (prefers-reduced-motion: reduce)` in `index.css` disabling animated cable dashes, packet motion, and pulse keyframes for sensitive users.
- **Color Contrast:** All text meets WCAG AA/AAA standards with minimum 4.5:1 to 7:1 contrast ratios on dark backgrounds.

---

## Performance
- **Zero Heavy Graph Dependencies:** Uses native SVG geometry with CSS hardware-accelerated transforms.
- **Bundle Impact:** 0 KB third-party bundle increase.
- **Client Build Speed:** Builds in 1.03s with 0 errors.

---

## Dependencies
- **0 New Dependencies Added.**
- Reused existing Lucide icons, Tailwind utility tokens, and native browser SVG APIs.

---

## Regression Results

| Test Suite | Purpose | Tests Run | Result |
|---|---|---|---|
| `test_signal_router.js` | SIGNAL_ROUTER 22-Stage Production QA Suite | 22 / 22 | **PASS** |
| `scripts/playtest_signal_router.js` | SIGNAL_ROUTER 9-Stage Human Playtest Suite | 9 / 9 | **PASS** |
| `test_the_threshold.js` | THE_THRESHOLD 106-Stage QA Suite | 106 / 106 | **PASS** |
| `test_silent_mission.js` | SILENT_MISSION 21-Stage QA Suite | 21 / 21 | **PASS** |
| `test_rogue_scanner.js` | ROGUE_SCANNER 17-Stage QA Suite | 17 / 17 | **PASS** |
| `test_the_witness.js` | THE_WITNESS 20-Stage QA Suite | 20 / 20 | **PASS** |
| `test_dead_code.js` | DEAD_CODE 13-Stage QA Suite | 13 / 13 | **PASS** |
| `test_logic_heist.js` | LOGIC_HEIST Multi-Node QA Suite | Multi-node | **PASS** |
| Server Build | TypeScript Compiler (`tsc`) | 0 Errors | **PASS** |
| Client Build | Vite Production Bundle (`tsc -b && vite build`) | 0 Errors | **PASS** |

---

## Deferred Features
- Multi-channel packet multiplexing (advanced future scenario).
- CRT phosphor scanline toggle filter (purely optional aesthetic overlay).
- Audio synthesizer clicks for cable connections (sound engine integration).
