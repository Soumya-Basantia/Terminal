# TERMINAL — Master Specification

**Campus Technical Game Platform**

TERMINAL is an interactive, unified platform designed to replace fragmented tools (Google Forms, PowerPoint) for college technical clubs. It merges a neo-brutalist dashboard for Game Masters with a hacker-themed terminal for students, enabling live, interactive, technical gameplay (Programming, AI, Databases, etc.).

## Documentation Index

This Master Specification links to the detailed architectural and product documents that serve as the strict source of truth for the TERMINAL platform.

> **CRITICAL RULE FOR FUTURE DEVELOPMENT:** 
> Do not overwrite these documents casually in future phases. They are the project's source of truth. Do not contradict documented architecture without explicitly identifying the conflict.

### 1. Product & UX Requirements
- **[01_PRD.md](01_PRD.md)**
  *Vision, Core Users (Student, Game Master, Stage, Super Admin), Club Architecture Concepts, and Out-of-Scope exclusions.*
- **[03_Application_Flow_and_Logic.md](03_Application_Flow_and_Logic.md)**
  *Student terminal flow, Game Master dashboard flow, and Stage presenter lifecycle.*
- **[04_UI_UX_Design_Brief.md](04_UI_UX_Design_Brief.md)**
  *Visual direction (Cybercore, Neo-brutalism, Monospace, Pixel Art rules) and core UX principles.*

### 2. Technical Architecture & Schemas
- **[02_Technical_Requirements.md](02_Technical_Requirements.md)**
  *Core stack (React, Express, Prisma, Socket.IO) and infrastructure principles.*
- **[05_Backend_and_Database_Schema.md](05_Backend_and_Database_Schema.md)**
  *Entity-Relationship diagrams, database schema mapping, and existing REST API endpoints.*
- **[06_System_Architecture.md](06_System_Architecture.md)**
  *High-level flow diagram, Socket.IO real-time architecture, and security/authorization rules.*
- **[09_Club_Architecture_Design.md](09_Club_Architecture_Design.md)**
  *Phase 6 Club Isolation design, Ownership model, and Migration strategy.*

### 3. Game & Implementation Plans
- **[07_Game_Engine_Specification.md](07_Game_Engine_Specification.md)**
  *Engine philosophy, Event Game Flow (Phase 7C), Phase 7E Interaction Types, future planned templates, and scoring mechanisms.*
- **[10_Game_Template_Architecture.md](10_Game_Template_Architecture.md)**
  *Phase 6B and 7E Game Template architecture, Validator, Template Registry, and extensible game mechanics.*
- **[11_Game_Mechanics_and_Implementation_Spec.md](11_Game_Mechanics_and_Implementation_Spec.md)**
  *Concrete game mechanics specifications, learning loops, challenge configurations, and vertical slice definitions (Logic Heist, Dead Code, The Witness, Rogue Scanner).*
- **[ROGUE_SCANNER_GAME_DESIGN.md](ROGUE_SCANNER_GAME_DESIGN.md)**
  *Phase 9B AIERA Game Design Specification: Anomaly detection, baseline profiling, false-positive triage, and hypothesis-driven forensic telemetry search.*
- **[08_Implementation_Plan.md](08_Implementation_Plan.md)**
  *Detailed table of current feature statuses, implemented components, and the phased roadmap for future work (including Phase 8.5 THE_WITNESS QA-VALIDATED and Phase 9B ROGUE_SCANNER DESIGN COMPLETE).*

---

### Core Architectural Principle
TERMINAL remains:
- **ONE PLATFORM**
- **ONE GAME ENGINE**
- **ONE SESSION ENGINE**
- **ONE REAL-TIME SYSTEM**
- **MULTIPLE CLUBS, GAMES, EVENTS, AND USERS**

*Club-specific content must never require separate applications or disjointed database deployments.*
