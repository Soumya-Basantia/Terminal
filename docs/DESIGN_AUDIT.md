# TERMINAL — DESIGN AUDIT & DESIGN SYSTEM SPECIFICATION

**Date:** 2026-10-03  
**Status:** PHASE A Complete — Design Audit & Token Architecture Established

---

## 1. COMPREHENSIVE DESIGN AUDIT

### 1.1 Inconsistent UI Patterns
- **Authentication Screens (`LoginPage.tsx`, `AdminLoginPage.tsx`):**
  - Uses harsh black-on-white high contrast with raw CSS borders (`border-2 border-[var(--border-brutal)] shadow-[8px_8px_0_0_rgba(0,0,0,0.5)]`), mixed with raw button bottom borders (`border-b-4 border-gray-400 active:translate-y-1`).
  - Uses inconsistent color accents for Game Master vs Student (e.g. blue-500 buttons vs cyan accents) without unified token usage.
- **Student Terminal (`TerminalShell.tsx`):**
  - True Unix/cybercore aesthetic with scanlines, monospace MOTD, and pixel branding.
  - Well-defined panels, but panels use custom local wrapper (`PanelFrame`) instead of a shared design system component.
- **Game Master Workspace (`GameMasterWorkspacePage.tsx`):**
  - Uses `BrutalistPanel` and `BrutalistButton` with 6px black drop-shadows and bright yellow/amber notices, creating a visual disconnect from the Student Terminal's dark cybercore aesthetic.
- **Admin Console (`AdminPage.tsx`):**
  - Very information-dense with excellent operational utility, but uses inline styling and ad-hoc buttons (`px-2 py-1`, `px-3 py-1.5`, `bg-purple-950/40`), creating visual noise.
- **Presenter & Stage (`PresenterPage.tsx`, `StagePage.tsx`):**
  - `PresenterPage` uses generic SaaS round corners, flat primary colors (`#3b82f6`, `#ef4444`, `#f59e0b`, `#22c55e`), and standard sans-serif text, looking like a different product from the rest of TERMINAL.
  - `StagePage` has cyberpunk corner brackets, but uses an isolated styling implementation.
- **Games (All 7 Engines):**
  - While mechanically locked and verified, visual elements vary from sharp 0px neo-brutalist cards to rounded pill badges (`rounded-full`) and default slider thumbs.

### 1.2 Weak Visual Hierarchy
- **Typography Sizing & Weights:** Inconsistent mix of `text-[10px]`, `text-xs`, `text-sm`, `text-base` with inconsistent letter spacing (`tracking-tight`, `tracking-wider`, `tracking-widest`).
- **Telemetry & Labels:** Labels often lack structured prefixing (e.g. `//`, `SYS:`, `>` prompt markers), making system metadata look like regular text.
- **Status Badges:** 4 different badge implementations with different border radiuses (pills vs sharp boxes).

### 1.3 Spacing / Layout Problems
- **Fixed Multi-Column Grids:** Several dashboards and modals use `grid-cols-3` or `grid-cols-4` that collapse uncomfortably on screens below 768px, causing text truncation or horizontal overflow.
- **Mobile Viewports (320px – 390px):** Form buttons and table filters experience overflow or wrapping artifacts.

### 1.4 Typography Inconsistencies
- Monospace font (`JetBrains Mono`) is the intended platform voice, but several screens default to `Inter` (`font-sans`) without clear semantic rationale.
- Headings oscillate between uppercase brutalist sans-serif and monospace cyber banners.

### 1.5 Duplicated UI Components
- **Buttons:** 4 competing implementations (`.btn`, `.brutalist-button`, `BrutalistButton`, and ad-hoc `<button className="...">`).
- **Panels / Cards:** 5 competing implementations (`.card`, `.brutalist-panel`, `BrutalistPanel`, `StagePanel`, `PanelFrame`).
- **Badges:** 4 competing implementations (`.badge`, `PixelBadge`, `.rs-pixel-badge`, inline `<span>`).
- **Modals / Drawers:** 4 different backdrop implementations with differing blur and opacity values.

---

## 2. THE TERMINAL DESIGN SYSTEM (CORE VISUAL LANGUAGE)

The unified visual identity combines:
1. **Cyberpunk Linux/Unix Terminal** (Dark surfaces, high contrast, monospace typography, command-line telemetry, subtle scanlines, ASCII/pixel motifs).
2. **Cybercore** (Restrained neon accents: Cyan `#00ffcc`, Emerald `#3fb950`, Magenta `#ff007f`, Yellow `#fcee0a`, deep obsidian backgrounds `#08090b`).
3. **Neo-Brutalism** (Crisp 1px–2px borders, deliberate hard drop shadows `2px 2px 0px`, `4px 4px 0px`, functional compact layouts, zero unnecessary pill rounding).
4. **Pixel / Dot Art** (Secondary accents: pixel-rendered status LEDs, dot-matrix backgrounds, retro computing brackets `[OK]`, `//`, `>_`).

### 2.1 Design Tokens (CSS Variables)

```css
:root {
  /* Surfaces */
  --term-bg-void: #050608;
  --term-bg-base: #090b0e;
  --term-bg-surface: #0f1217;
  --term-bg-elevated: #161b22;
  --term-bg-highlight: #1f2530;

  /* Borders & Dividers */
  --term-border-faint: #1f2633;
  --term-border-muted: #2d3748;
  --term-border-crisp: #4a5568;
  --term-border-neon: #00ffcc;

  /* Text & Telemetry */
  --term-text-bright: #ffffff;
  --term-text-primary: #e6edf3;
  --term-text-secondary: #8b949e;
  --term-text-dim: #545d68;

  /* Neon Accents (Restrained & Purposeful) */
  --term-cyan: #00ffcc;
  --term-cyan-dim: #00997a;
  --term-cyan-glow: rgba(0, 255, 204, 0.2);
  --term-green: #3fb950;
  --term-green-glow: rgba(63, 185, 80, 0.2);
  --term-yellow: #fcee0a;
  --term-yellow-glow: rgba(252, 238, 10, 0.2);
  --term-magenta: #ff007f;
  --term-magenta-glow: rgba(255, 0, 127, 0.2);
  --term-blue: #38bdf8;
  --term-red: #ff3366;

  /* Neo-Brutalist Hard Shadows */
  --term-shadow-sm: 2px 2px 0px #000000;
  --term-shadow-md: 4px 4px 0px #000000;
  --term-shadow-neon: 3px 3px 0px var(--term-cyan);

  /* Typography */
  --term-font-mono: 'JetBrains Mono', 'Cascadia Code', monospace;
  --term-font-sans: 'Inter', system-ui, sans-serif;
}
```

---

## 3. COMPONENT CONSOLIDATION PLAN

| Category | Existing Duplications | Unified Replacement | Location |
| :--- | :--- | :--- | :--- |
| **Buttons** | `.btn`, `.brutalist-button`, `BrutalistButton`, inline buttons | `<TerminalButton variant="primary \| secondary \| danger \| ghost \| cyber" size="sm \| md \| lg">` | `client/src/components/ui/TerminalButton.tsx` |
| **Panels** | `.card`, `.brutalist-panel`, `BrutalistPanel`, `StagePanel`, `PanelFrame` | `<TerminalPanel title="..." headerTag="..." variant="default \| elevated \| cyber \| alert">` | `client/src/components/ui/TerminalPanel.tsx` |
| **Inputs** | `.input`, `.input-mono`, inline inputs | `<TerminalInput label="..." prefix=">_" mono error="..." />` | `client/src/components/ui/TerminalInput.tsx` |
| **Badges** | `.badge`, `PixelBadge`, `.rs-pixel-badge` | `<TerminalBadge variant="cyan \| green \| yellow \| red \| blue \| dim" dot={boolean}>` | `client/src/components/ui/TerminalBadge.tsx` |
| **Modals** | Inline modals with varying backdrops | `<TerminalModal isOpen={...} onClose={...} title="...">` | `client/src/components/ui/TerminalModal.tsx` |
| **Tables** | Ad-hoc HTML tables | `<TerminalTable>` styled with monospace alignment, sticky header, hover rows | Shared CSS + component helper |

---

## 4. PHASED EXECUTION ROADMAP

- [x] **PHASE A:** Design Audit + Token System Architecture (this document + `index.css` token integration).
- [ ] **PHASE B:** Build Unified Shared Components (`TerminalButton`, `TerminalPanel`, `TerminalInput`, `TerminalBadge`, `TerminalModal`).
- [ ] **PHASE C:** Polish Student Terminal & Login / Registration Screens using unified tokens.
- [ ] **PHASE D:** Polish Game Master Workspace (tactical operations styling, unified telemetry).
- [ ] **PHASE E:** Polish Admin Panel (information-dense cyberpunk console).
- [ ] **PHASE F:** Transform Presenter / Stage for distance readability with cyber aesthetic.
- [ ] **PHASE G:** Visual polish across the 7 locked game engines (preserving 100% mechanics and scoring).
- [ ] **PHASE H:** Responsive (320px–1440px+) and Accessibility (WCAG contrast, keyboard, reduced-motion) pass.
- [ ] **PHASE I:** Comprehensive automated test rerun (378/378) + client/server builds + visual sign-off.
