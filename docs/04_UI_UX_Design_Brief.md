# TERMINAL — UI/UX Design Brief

## 1. Visual Direction

### Student Terminal View
- **Aesthetic:** Cybercore / Terminal.
- **Typography:** Strictly Monospace (e.g., `font-mono`).
- **Colors:** High contrast (black backgrounds, neon green/cyan primary accents, bright red for errors).
- **Vibe:** Technical, system atmosphere. The student should feel like an operator hacking a mainframe.

### Game Master Dashboard
- **Aesthetic:** Neo-brutalism + Cybercore.
- **Components:** Thick borders (`border-4`, `border-2`), solid harsh drop shadows (e.g., `shadow-[8px_8px_0_0_rgba(0,0,0,0.5)]`), sharp corners.
- **Colors:** High contrast, visually distinct states.
- **Vibe:** Control-room feeling, strong hierarchy, normal visual UI (not a terminal) to prioritize usability and data density.

### Stage / Presenter View
- **Aesthetic:** Cybercore / Controlled Cyberpunk.
- **Typography:** Large, extremely legible fonts for distance reading.
- **Colors:** High contrast.
- **Elements:** Massive timers, dominant leaderboard bars, QR codes.

### Pixel Art Language
- Pixel art is used as a **secondary** visual language.
- **Appropriate Uses:** Game icons, event illustrations, empty states, achievements, game identity.
- **Rule:** Do NOT turn every UI element (like standard buttons or forms) into pixel art. Keep functional components neo-brutalist or terminal-based.

## 2. Core UX Principles
- **One primary action per screen:** Keep focus tight.
- **Minimal student friction:** No confusing menus for students. The terminal commands must be intuitive, with helpers/aliases.
- **Advanced settings hidden:** Keep Game Master interfaces clean by hiding complex options behind toggles.
- **No programming knowledge required for GMs:** Game Masters should construct games visually without writing code.
- **Stage readability:** Ensure high contrast and large scaling so the stage is readable from the back of an auditorium.
