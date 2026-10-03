# TERMINAL — Implementation Status & Roadmap

## 1. Current Implementation Status

| Feature | Status | Evidence/Location | Notes |
|---------|--------|-------------------|-------|
| Authentication | IMPLEMENTED | `auth.ts`, `AuthContext.tsx` | JWT, bcrypt, login/register |
| Terminal UI | IMPLEMENTED | `TerminalPage.tsx`, `commands/` | CLI-style input, command registry |
| Commands | IMPLEMENTED | `features/terminal/commands/` | `battle`, `submit`, `whoami`, etc. |
| Events | IMPLEMENTED | `events.ts`, `EventEditorPage.tsx` | Creation, game arrangement, publishing |
| Games | IMPLEMENTED | `games.ts`, `GameEditorPage.tsx` | Reusable templates, challenge builder |
| Quiz Engine | IMPLEMENTED | `sessions.ts`, `Challenge` model | MCQs, True/False, Single Choice |
| Sessions | IMPLEMENTED | `sessions.ts`, `SessionHostPage` | Live lifecycle, state machine |
| Sockets | IMPLEMENTED | `sockets/index.ts`, `socket.ts` | Auth, join, state_update, GM overrides |
| Scoring | IMPLEMENTED | `sessions.ts` (submit route) | Server-side validation, flat points |
| Leaderboard | IMPLEMENTED | `LeaderboardView.tsx`, Prisma | Querying profiles/sessions for score sums |
| Stage | IMPLEMENTED | `StagePage.tsx` | Read-only public projector view |
| Security | IMPLEMENTED | `requireClubAdmin`, JWT | Strong boundaries for event/game ownership |
| Club Architecture | IMPLEMENTED | `clubs.ts`, DB Schema | Route nested `/clubs/:clubId/`, ownership isolation |
| Game Templates | IMPLEMENTED | `engine/`, `TemplateRegistry.ts` | Reusable architecture for varied mechanics (including THE_WITNESS) |
| QR Codes | IMPLEMENTED | `LobbyView.tsx` | Used in Stage/Lobby for easy joining |
| The Witness (Solo) | QA-VALIDATED | `WitnessChallenge.tsx`, `Validator.ts` | Interrogation, binary partitioning, evidence board |
| Rogue Scanner | QA-VALIDATED | `ScannerChallenge.tsx`, `Validator.ts` | Multi-variable correlation forensics, anomaly verification |
| Silent Mission | QA-VALIDATED | `MissionChallenge.tsx`, `Validator.ts` | Autonomous sequence planning, state machines, causal recovery |
| Datanexus Integration | PLANNED | N/A | Excluded per requirements |
| Mobile App | PLANNED (EXCLUDED) | N/A | Explicitly out of scope |

## 2. Roadmap

**Completed Phases:**
- [x] Phase 1 — Terminal Foundation
- [x] Phase 2 — Event Architecture
- [x] Phase 3 — Live Session Engine
- [x] Phase 4 — Quiz Gameplay
- [x] Phase 4.5 — Security / QA
- [x] Phase 5 — Stage / Projector
- [x] Phase 5.5 — Design System
- [x] Phase 6A — Club Architecture
- [x] Phase 6B — Game Template Engine
- [x] Phase 7A — Chain Reaction Game Template (QA-VALIDATED)
- [x] Phase 7B — Data Hunt Game Template (QA-VALIDATED)
- [x] Phase 7C — Event Game Flow & Template Selection (QA-VALIDATED)
- [x] Phase 7C.1 — Event Control + Live UX Audit (QA-VALIDATED)
- [x] Phase 7D — Rapid Fire Game Template (QA-VALIDATED)
- [x] Phase 7E — Learning-Through-Gameplay Architecture (IMPLEMENTED)
- [x] Phase 7F — CodeNex Signature Game: Logic Heist (QA-VALIDATED)
- [x] Phase 8 — Scoring Refinement (Speed bonuses, streaks, multipliers) (QA-VALIDATED)
- [x] Phase 8.1 — Logic Heist Vault 1 Playtest, QA & Refinement (QA-VALIDATED)
- [x] Phase 8.2 — Logic Heist Vault 2: Iteration & Loops (QA-VALIDATED)
- [x] Phase 8.3 — Logic Heist Vault 3: Conditional Logic (QA-VALIDATED)
- [x] Phase 8.4 — Dead Code: The Bug Hunt (QA-VALIDATED)
- [x] Phase 8.5 — The Witness: Solo Vertical Slice (QA-VALIDATED)
- [x] Phase 8.6 — Rogue Scanner: Multi-Variable Correlation Forensics (QA-VALIDATED)
- [x] Phase 8.7 — Silent Mission: Autonomous Sequence Planning & State Machines (QA-VALIDATED)

**Upcoming Phases:**
- [ ] Phase 9 — Additional Domain-Specific Club Signature Games
  - [ ] 6.3 Signal Router / 6.4 Assembly Line (CODENEX)
  - [ ] 7.2 Dead Signal / 7.3 The Corruptor (LANGNET)
  - [ ] 8.2 The Threshold / 8.3 The Classifier (AIERA)
  - [ ] 9.2 Cascade / 9.3 Loop Trap (AGENTIC ARC)
- [ ] Phase 10 — Real College Pilot
