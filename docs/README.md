# TERMINAL Documentation

Welcome to the TERMINAL technical documentation folder. These documents act as the **strict source of truth** for the TERMINAL application architecture, UI/UX guidelines, and product roadmap.

### Files Overview

- **`AGENT_HANDOFF.md`**: Persistent agent handoff with verified project status, locked games, and the exact next task. Read this first when resuming development.
- **`FULL_PLATFORM_QA_REPORT.md`**: Current full-platform black-box QA results, verified fixes, regression/build outcomes, and remaining coverage.
- **`TERMINAL_MASTER_SPEC.md`**: The entry point. Start here to understand the platform conceptually and structurally.
- **`01_PRD.md`**: Product vision, user personas, club architecture concepts, and explicit exclusions (out-of-scope).
- **`02_Technical_Requirements.md`**: The technology stack, framework choices, and environment constraints.
- **`03_Application_Flow_and_Logic.md`**: The step-by-step lifecycle flows for Students, Game Masters, and the Stage view.
- **`04_UI_UX_Design_Brief.md`**: Visual language rules (Cybercore, Neo-brutalism, Pixel Art usage) and UX friction guidelines.
- **`05_Backend_and_Database_Schema.md`**: Database ER diagrams (Prisma schema) and a complete list of implemented REST API endpoints.
- **`06_System_Architecture.md`**: Real-time Socket.IO event documentation, system data-flow diagram, and security architecture.
- **`07_Game_Engine_Specification.md`**: Mechanics of the generic game engine, implemented templates (Quiz), and planned templates/scoring.
- **`08_Implementation_Plan.md`**: A matrix mapping features to their status (`IMPLEMENTED`, `PLANNED`, etc.) and the phase-by-phase roadmap.

> **Note to Agents and Developers:** Before making any changes or proposing new features, read `TERMINAL_MASTER_SPEC.md`. Do not contradict the architecture or visual direction without explicit authorization.
