# TERMINAL — Projector Stage Mode & Live Esports Animations Architecture

## Overview

The TERMINAL Live Game Host has been upgraded into an esports broadcast-grade, projector-ready stage control system. This enables Game Masters (GMs) running live hackathons and competitive coding tournaments to project crisp, dynamic, low-latency visuals on classroom and auditorium screens without sacrificing operational control or leaking sensitive information (such as answer keys, private student identities, or future challenges).

---

## 1. Module Spotlight System Architecture

### Core Design Philosophy
Instead of hardcoded popups or separate disconnected presentation views that disrupt host workflow:
- The dashboard operates in a **responsive neo-brutalist grid** during standard operations.
- Any module can be expanded into **fullscreen spotlight mode** with a single click or keyboard shortcut.
- State continuity is 100% preserved during transitions: timers continue counting down, WebSocket feeds stay connected, selected tabs remain intact, and no gameplay components are unmounted.
- The host can switch directly between spotlight modules (e.g., from Question Spotlight `[Q]` straight to Esports Leaderboard `[L]`) without clumsy intermediate dashboard resets.

### Component Structure
The spotlight architecture resides under `client/src/components/host/`:

1. **`SpotlightModule.tsx`**:
   - Reusable wrapping container providing a standard title bar, status chip, action buttons, and expand/collapse triggers.
   - Handles the fixed-position fullscreen overlay when expanded (`fixed inset-0 z-50 p-4 sm:p-6 lg:p-8 bg-black/95 backdrop-blur-xl`).
   - Supports native browser Fullscreen API integration via `document.documentElement.requestFullscreen()` with graceful fallback.
   - Exposes an **Audience Safe Mode** toggle directly in the spotlight header to immediately preview what external screens see.
   - Provides a quick module navigation bar in spotlight mode allowing instant 1-click or key-driven switching across:
     - `[Q]` Question Spotlight
     - `[L]` Live Leaderboard
     - `[T]` Teams & Progress
     - `[S]` Session Telemetry
     - `[A]` Live Activity Log
     - `[Esc]` Minimize / Return to Dashboard

2. **`useHostKeyboardShortcuts.ts`**:
   - Centralized, non-conflicting keyboard event listener.
   - Automatically disables shortcuts when focus is inside text inputs, textareas, selects, or modal overlays.
   - Key map:
     - `Q` / `q`: Toggle Question Spotlight
     - `L` / `l`: Toggle Live Leaderboard Spotlight
     - `T` / `t`: Toggle Teams & Question Progress Spotlight
     - `S` / `s`: Toggle Session Stats Spotlight
     - `A` / `a`: Toggle Recent Activity Spotlight
     - `Escape`: Minimize active spotlight module back to dashboard
     - `F` / `f`: Toggle native browser fullscreen

---

## 2. Dedicated Spotlight Experiences

### A. Question Spotlight (`QuestionSpotlight.tsx`)
- **Typography Scale**: Responsive 40–64px main question prompt (`text-2xl sm:text-4xl md:text-5xl lg:text-6xl`) with high-contrast text shadow, optimized for visibility from the back of an auditorium or classroom.
- **Radial Countdown Ring**: SVG-based ring timer that dynamically changes color based on remaining time:
  - Cyan (`#06b6d4`): Normal countdown (> 10s)
  - Yellow (`#eab308`): Caution (<= 10s)
  - Red Pulse (`#ef4444`): Critical threshold (<= 5s) with subtle CSS pulse animation
- **2x2 Answer Choice Layout**: Choices reflow into a clean 2x2 grid on landscape/projector screens and a vertical stack on mobile/narrow screens. Option labels (`[A]`, `[B]`, `[C]`, `[D]`) are prominently displayed in monospace tags.
- **State Lifecycle Display**: Displays real-time state badges (`STANDBY / LOBBY`, `QUESTION ACTIVE`, `QUESTION LOCKED`, `FINAL RESULTS`).
- **Privacy & Security Boundaries**:
  - Future questions are masked by the server and never sent to client memory until activated.
  - Correct answer keys and GM admin controls (`Lock Question`, `Advance Next`, `End Session`) are strictly stripped when in Audience Safe mode or on the dedicated `/stage/:code` presenter route.

### B. Esports Leaderboard (`EsportsLeaderboard.tsx`)
- **Podium Visual Hierarchy**:
  - **1st Place**: Gold border (`border-yellow-400`), crown badge (`👑`), golden glowing gradient, and prominent `#01` tag.
  - **2nd Place**: Silver border (`border-slate-300`), `#02` badge, metallic silver accents.
  - **3rd Place**: Bronze border (`border-amber-600`), `#03` badge, warm bronze accents.
  - **Rank 4+**: Deep graphite panel with electric cyan indicators.
- **Smooth Layout Reordering**: Uses Framer Motion's GPU-accelerated `layout` prop with spring physics (`stiffness: 300, damping: 30`). Rows glide smoothly to their new positions as scores update.
- **Live Score Deltas**: Server score events trigger a floating `+N PTS` (or `-N PTS`) animated chip alongside the affected team row, persisting for 1.8 seconds before fading.
- **New Leader Banner**: When rank 1 changes, a momentary gold banner ("⚡ NEW LEADER: [TEAM NAME] TAKES THE LEAD") sweeps across the top of the scoreboard.
- **Privacy Preserved**: Student institutional emails, USNs, and database IDs are excluded; only public display names and team rosters are rendered.

### C. Teams & Question Progress (`TeamsProgressSpotlight.tsx`)
- High-contrast visual grid showing registered teams, live participant counts, submission status (Submitted vs Waiting), and real-time response gauges.
- Question Progress timeline displaying past questions, active question position, and future question markers without leaking question content.

### D. Session Telemetry & Activity Log (`SessionStatsSpotlight.tsx`, `RecentActivitySpotlight.tsx`)
- Large digital readout cards for Total Teams, Active Connections, Total Submissions, and Game Phase.
- Real-time audit log stream tracking connection events, submissions, and session transitions with timestamped cybercore formatting.

---

## 3. Dedicated Projector Route (`/stage/:code` & `/presenter/:code`)

For setups with a dual-monitor or secondary hardware output:
- **URL**: `http://localhost:5173/stage/<ROOM_CODE>` or `/presenter/<ROOM_CODE>`
- **Design**:
  - Completely stripped of navigation sidebars, headers, debugging tools, and host controls.
  - Synchronized via the existing authoritative Socket.IO room subscriptions.
  - Exposes discreet hoverable controls in the bottom corner:
    - `[⛶ FULLSCREEN]`: Toggles native display fullscreen.
    - `[HOST DASHBOARD]`: Quick link back to the GM controller room.
  - Reconnects automatically on network drops and resynchronizes session state from the server.

---

## 4. Motion Design System Tokens

All animation timings and easings are codified in `client/src/styles/motion.ts`:

| Motion Token | Timing / Target | Curve / Physics | Description |
|---|---|---|---|
| `moduleExpand` | 550 ms | `type: "spring", stiffness: 280, damping: 28` | Snappy spring-like expansion from dashboard tile to fullscreen overlay |
| `moduleMinimize` | 380 ms | `ease: [0.4, 0, 0.2, 1]` | Fast, controlled cubic-bezier settle returning to dashboard grid |
| `leaderboardReorder`| 600 ms | `type: "spring", stiffness: 320, damping: 32` | Fluid rank reordering transition using FLIP-style layout |
| `pointCountUp` | 450 ms | `ease: [0.16, 1, 0.3, 1]` | Floating `+N PTS` delta indicator float and scale |
| `toastEntry` | 260 ms | `ease: [0.16, 1, 0.3, 1]` | New Leader banner and alert entry |
| `toastExit` | 180 ms | `ease: [0.4, 0, 1, 1]` | Alert dismissal |
| `questionGlitch` | 320 ms | `ease: [0.2, 0, 0, 1]` | Question switch reveal / scanline wipe |

### Accessibility & `prefers-reduced-motion`
When the user or operating system has enabled `prefers-reduced-motion`:
- Elaborate layout springs and transforms are substituted with immediate, gentle fades (`duration: 0.1s`).
- Glitch and pulsing scanline effects are disabled.
- Timer rings transition color cleanly without flashing or pulse animations.

---

## 5. Responsive Projector Resolution Validation

All modules and spotlight modes were verified using Playwright E2E browser automation across standard projector and display aspect ratios:

| Target Display | Resolution | Aspect Ratio | Verification Result |
|---|---|---|---|
| 1080p Projector | 1920 × 1080 | 16:9 | PASS — Crisp 52px text, 2x2 grid, no overflow |
| 900p Display | 1600 × 900 | 16:9 | PASS — Sized appropriately, full visibility |
| MacBook Widescreen | 1440 × 900 | 16:10 | PASS — Stable layout, clear countdown |
| 720p Classroom Projector | 1280 × 720 | 16:9 | PASS — Highly legible from distance |
| Legacy Classroom Projector| 1024 × 768 | 4:3 | PASS — Reflows cleanly without clipping |
| Tablet Portrait | 768 × 1024 | 3:4 | PASS — Vertical stacked layout, full access |
| Standard Mobile | 390 × 844 | 19.5:9 | PASS — `overflow-x-hidden`, responsive tags |
| Compact Mobile | 320 × 640 | 1:2 | PASS — 0 horizontal scroll, clean touch target |

---

## 6. Files Changed & Added

### Newly Created Files:
- `client/src/styles/motion.ts`: Motion design system tokens and reduced-motion presets.
- `client/src/components/host/SpotlightModule.tsx`: Reusable module spotlight wrapper.
- `client/src/components/host/useHostKeyboardShortcuts.ts`: Host keyboard shortcut controller.
- `client/src/components/host/QuestionSpotlight.tsx`: Projector-ready question spotlight with timer ring.
- `client/src/components/host/EsportsLeaderboard.tsx`: Esports broadcast leaderboard with layout animation.
- `client/src/components/host/TeamsProgressSpotlight.tsx`: Roster, response gauges, and progression.
- `client/src/components/host/SessionStatsSpotlight.tsx`: Cyber telemetry and system cards.
- `client/src/components/host/RecentActivitySpotlight.tsx`: Fullscreen activity stream.
- `client/src/components/host/index.ts`: Module export index.
- `test_projector_stage_mode.cjs`: Automated Playwright E2E test suite for projector stage mode.

### Modified Files:
- `client/src/pages/SessionHostPage.tsx`: Integrated spotlight containers, audience safe mode toggle, projector stage navigation, and responsive overflow controls.
- `client/src/pages/StagePage.tsx`: Enhanced dedicated stage view with fullscreen controls and dashboard return link.
- `client/src/pages/PresenterPage.tsx`: Added stage navigation and fullscreen support.

---

## 7. Automated Test Verification Results

### Projector Stage Mode E2E Test Suite (`test_projector_stage_mode.cjs`):
- **Command**: `node test_projector_stage_mode.cjs`
- **Result**: **23 PASSED, 0 FAILED**
  - Session creation & authentication: PASS
  - Question spotlight expand & minimize: PASS
  - Keyboard shortcuts (`[Q]`, `[L]`, `[T]`, `[S]`, `[A]`, `Escape`): PASS
  - Direct module-to-module switching: PASS
  - Active question presentation (40–64px scale, 2x2 grid, radial countdown): PASS
  - Audience Safe Mode privacy strip: PASS
  - Multi-resolution projector verification (8 resolutions): PASS
  - Dedicated `/stage/:code` presenter route: PASS

### Sequential Gameplay & Timer Regression Test (`test_sequential_question_flow.cjs`):
- **Command**: `node test_sequential_question_flow.cjs`
- **Result**: **49 PASSED, 0 FAILED**
  - GM ownership authorization: PASS
  - Sequential question activation and deadlines: PASS
  - Server auto-advancement sweeps: PASS
  - Concurrent manual advancement idempotency: PASS
  - Timer integrity across disconnects: PASS
  - Crash/restart recovery: PASS
  - Server-authoritative scoring: PASS

### Production Build Verification:
- `npm run build --prefix client`: **0 errors, built successfully in 1.38s**
- `npm run build --prefix server`: **0 errors, TypeScript compiled cleanly**
