# TERMINAL — Safe Data Cleanup Report

**Execution Date:** 2026-10-15  
**Auditor & Reviewer:** Senior Application Security Engineer & Database Reviewer  
**Scope:** PostgreSQL Database (`terminal`), Prisma Schema, Retained Accounts, and Automated Test Deletions  
**Status:** **CLEANUP COMPLETED & VERIFIED** (Database Integrity 100% Healthy, ZERO Test Accounts Remaining)  

---

## 1. Executive Summary

A comprehensive, transactional data cleanup was performed on the PostgreSQL database powering TERMINAL to purge **all automated testing data**. Prior to deletion, uncorrupted compressed binary snapshots were generated and verified using `pg_dump.exe`. 

In strict adherence to the **Accidental Data Loss Prevention** mandate:
- **Zero production accounts, tournament questions, or official games were altered or deleted.**
- **All five requested core accounts** (`root`, `shraddha`, `soumyabasantia24aiml`, `bob`, and `codenex`) were verified and remain in the database with their exact original database IDs, roles, and relationship links.
- **2,086 total automated-test accounts** and their exclusively associated ephemeral records were pruned across scoped transactions following strict foreign-key dependency order.
- Post-cleanup database verification confirmed that exactly **10 clean accounts** remain in the database, with **zero test accounts remaining**.
- All security, authentication, and gameplay test suites were executed post-cleanup and passed with 100% success. Both frontend and backend builds compile cleanly.

---

## 2. Pre-Cleanup Recoverable Snapshots

Prior to performing deletions, compressed binary snapshots of the PostgreSQL database were created and verified:

- **Active Database:** `terminal` (Host: `localhost:5432`, User: `postgres`)
- **Backup Tool:** PostgreSQL `pg_dump.exe` (v18.0)
- **Primary Snapshot:** `backups/terminal_pre_cleanup_2026-10-15T02-18-38-164Z.dump` (699,163 bytes)
- **Final Snapshot:** `backups/terminal_pre_cleanup_2026-10-15T02-31-28-557Z.dump` (283,307 bytes)
- **Format:** Custom compressed (`-F c`), including large objects and schemas.
- **Safety:** The `backups/` directory is registered in `.gitignore` to prevent accidental commits of binary database dumps into Git.

---

## 3. Preserved Legitimate Accounts & Official Assets

All five requested accounts were verified in the database before and after the cleanup transactions:

| Entity | Identifier / Username | Email | Role | Database ID | Status |
|---|---|---|---|---|---|
| **Root Administrator** | `root` | `root@terminal.lan` | `ADMIN` | `cmus48lhg00001e4apdypdrsc` | **CONFIRMED PRESERVED** |
| **Shraddha's Account** | `shraddha` | `shraddha@gmail.com` | `PLAYER` | `cmv86pxey0006ewy619kbr2gf` | **CONFIRMED PRESERVED** (USN: `1VA24CI095`) |
| **Soumya's GM Account** | `soumyabasantia24aiml` | `soumyabasantia.24aiml@saividya.ac.in` | `GAME_MASTER` | `cmuvhfg7i0002gnzffintu3ad` | **CONFIRMED PRESERVED** |
| **Intended Player Account** | `bob` | `bobtherobber690@gmail.com` | `PLAYER` | `cmuybuebb0008u0b887ybcf7q` | **CONFIRMED PRESERVED** (USN: `1VA24CI123`) |
| **Official Tournament GM** | `codenex` | `codenex.gm@terminal.dev` | `GAME_MASTER` | `cmv7i9wa3000012xhqtbd1qu6` | **CONFIRMED PRESERVED** |

In addition, 5 foundational system accounts were preserved:
- `demo_designer` (`demo@terminal.dev`, `SUPER_ADMIN`) — Creator of base seed games
- `demo` (`demo@gmail.com`, `PLAYER`, USN: `1VA24CI103`) — Real demo player
- `hero` (`hero@gmail.com`, `GAME_MASTER`) — Real Game Master
- `soumya` (`soumya@terminal.edu`, `PLAYER`, USN: `1RV21CS042`) — Student account
- `rohan` (`rohan@terminal.edu`, `PLAYER`, USN: `1RV21CS089`) — Student account

### Production Tournament Questions & Question Banks Preserved
The two official CODENEX tournament games owned by `codenex` remain completely intact:
1. **"PYTHON LOGIC TRAPS: The First-Year Challenge"** (`cmv7qd0vi000112c6dp72b1hj`):
   - **20 Published Challenges** with full options, point allocations, and detailed explanations.
2. **"PYTHON RAPID FIRE — CODE TRAP ZONE"** (`cmv7sljxr0001voi307i59znc`):
   - **10 Published Challenges** with speed timers and multiple-choice trap logic.

---

## 4. Cumulative Deletion Metrics by Table

The cleanup transactions were executed using Prisma Client in [`scripts/safeDataCleanup.cjs`](file:///c:/Users/SOUMYA.B/Desktop/Terminal/scripts/safeDataCleanup.cjs) with an extended timeout (`{ maxWait: 30000, timeout: 120000 }`) to guarantee atomicity.

| Table | Deleted Count | Description & Scope |
|---|---|---|
| **`users`** | **2,086** | Confirmed automated test accounts (`pw_*`, `sq_*`, `seq_*`, `rt_*`, `load_*`, `agent_*`, `sec_stud_*`, etc.) |
| **`submissions`** | **1,935** | Submissions created exclusively by test players and test sessions |
| **`session_players`** | **1,837** | Session participation links of test accounts |
| **`profiles`** | **1,760** | User profiles belonging to deleted test accounts |
| **`team_members`** | **161** | Memberships in temporary test squads |
| **`challenges`** | **80** | Ephemeral quiz questions generated on temporary test games |
| **`games`** | **73** | Temporary test games created by test scripts |
| **`sessions`** | **71** | Ephemeral live sessions launched during test runs |
| **`events`** | **63** | Temporary test events created by test scripts |
| **`teams`** | **60** | Temporary squads created during multi-player squad tests |
| **`event_games`** | **50** | Temporary event-game mapping entries |
| **`messages`** | **24** | Direct messages between test users |
| **`club_members`** | **21** | Test memberships in demo clubs |
| **`collaboration_requests`**| **9** | Test collaboration requests |
| **`team_messages`** | **4** | Test squad chat messages |
| **`collaborations`** | **0** | No test collaboration pairs found |
| **`team_invitations`** | **0** | No test team invites found |

---

## 5. Foreign-Key Deletion Order Execution

To prevent foreign-key constraint violations (`23503`), records were purged in strict reverse-dependency order:
1. `Submission` (player submissions in test sessions / by test players)
2. `SessionPlayer` (player links in test sessions / by test players)
3. `TeamMessage` (messages sent by test users or on test teams)
4. `TeamInvitation` (invitations involving test users or test teams)
5. `TeamMember` (memberships involving test users or test teams)
6. `Team` (teams created by test accounts)
7. `Message` (direct messages between test users)
8. `CollaborationRequest` & `Collaboration` (collaboration links)
9. `ClubMember` (memberships involving test users)
10. `Profile` (profiles of test users)
11. `Session` (ephemeral test sessions)
12. `EventGame` (event-game mapping rows for test games/events)
13. `Challenge` (challenges belonging to test games)
14. `Game` (games created by test accounts)
15. `Event` (events created by test accounts)
16. `User` (the confirmed automated test users)

---

## 6. Post-Cleanup Verification & Integrity Checks

Database integrity verification was executed via [`scratch/verify_post_cleanup.cjs`](file:///c:/Users/SOUMYA.B/Desktop/Terminal/scratch/verify_post_cleanup.cjs):
- **Total Users in Database:** Exactly **10** (5 retained production accounts + 5 foundational system accounts).
- **Remaining Automated-Test Accounts:** Exactly **0**.
- **Tournament Question Bank Integrity:** 100% of the 30 CODENEX challenges and explanations remain available.

### Post-Cleanup Test Results
All automated test suites were executed against the cleaned database:

| Suite | Focus | Result |
|---|---|---|
| `test_production_integrity.cjs` | Self-cleaning production integrity test: verifies 5 retained accounts, 30 tournament challenges, auth login, 401 rejection, session creation/teardown, and zero lingering artifacts. | **PASSED (0 LEFTOVER ARTIFACTS)** |
| `test_pre_deployment_security.cjs` | Empty login inputs, stale token cleansing, 401 unauthenticated rejections, 403 GM control blocking, 403 GM-to-GM session isolation, answer anti-leakage, seed idempotency, auth rate limiting (429). | **36 / 36 PASSED** |
| `test_delayed_review_mode.cjs` | 5-phase verification of delayed answer review, student anti-leakage, and post-game authorized reveal. | **5 / 5 PHASES PASSED** |
| `test_realtime_leaderboard_sync.cjs` | Real-time Socket.IO leaderboard synchronization, instant scoring, and reconnection reconciliation. | **10 / 10 PASSED** |
| `test_team_average_and_speed_bonus.cjs` | 14 scoring formula unit edge cases + full live E2E squad game integration. | **14 / 14 PASSED** |
| `test_gm_auth_regression.cjs` | Session start, lock, next, end, and terminal state transitions with role checks. | **25 / 25 PASSED** |
| `npm run build` (`client`) | Client TypeScript compilation and Vite production bundle generation. | **EXIT CODE 0** |
| `npm run build` (`server`) | Server TypeScript compilation (`tsc`). | **EXIT CODE 0** |

---

## 7. Conclusion

The TERMINAL database is completely free of all automated test data, verified against foreign-key integrity constraints, and ready for deployment.
