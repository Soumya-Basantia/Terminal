# TERMINAL — Production Readiness, Integration Repair & Deployment Master Report

**Document Version:** 1.0.0 (Production Release Candidate)  
**Date of Audit & Certification:** October 2026  
**Auditor:** Full-Stack Staff Systems & Reliability Engineer  
**Applicability:** Full TERMINAL Platform (Node.js/Express, React/Vite/Tailwind, PostgreSQL/Prisma, Socket.IO)

---

## 1. Executive Summary

TERMINAL is an enterprise-grade, real-time competitive cyber-simulation and learning platform for university hackathons, cyber arenas, and classroom tournaments. Game Masters (GMs) create and orchestrate custom CODENEX games, while students join via 5-character alphanumeric room codes, answer challenges independently, collaborate in squads, and receive authoritative scores and downloadable audit reports.

A comprehensive, end-to-end audit was conducted across the codebase, database schema, real-time Socket.IO communication layer, cryptographic authentication system, and gameplay state machine. Critical integration and authorization defects were discovered and remediated with surgical, minimal safe patches without compromising the server-authoritative lifecycle or rewriting architectural patterns.

Every automated test suite in the repository has been executed against live backend instances and real PostgreSQL database transactions. In addition, the platform was subjected to a **200-student concurrent load test** simulating simultaneous student joins, question starts, concurrent submissions, deadline cutoffs, and session finalization.

### Overall Production Verdict
**`READY FOR PRODUCTION`**

---

## 2. Verified Root Causes Found & Repaired

### Root Cause 1: Zero Participants on GM Host Page (`LobbyPage.tsx` Join Route Omission)
- **Defect Symptom:** When students joined a session via `battle -c <ROOMCODE>` or navigated directly to `/lobby/:sessionCode`, the GM Host page and student lobby displayed `0 Players`, and participant rosters remained empty.
- **Underlying Cause:** `LobbyPage.tsx` previously established a Socket.IO connection and directly emitted `player:join` without first calling `POST /api/sessions/join`. The server's Socket.IO connection handler strictly validates student registration:
  ```typescript
  const player = await prisma.sessionPlayer.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId } },
  });
  if (!player) {
    socket.emit('error', { message: 'Player not found in this session' });
    return;
  }
  ```
  Because no `SessionPlayer` row existed in the database, the socket event was rejected. The student never joined the socket room, and no roster update was broadcast to the host.
- **Surgical Fix:** Updated `client/src/pages/LobbyPage.tsx` to register via `api.post('/sessions/join', { roomCode })` upon mounting before initializing the Socket.IO client. If the student is already registered, the backend handles it idempotently and returns the existing registration. The socket then connects, `player:join` succeeds, `SessionPlayer` is persisted, and the GM Host roster immediately increments and displays the student.

### Root Cause 2: GM Start & Control Actions Returning `403 Forbidden`
- **Defect Symptom:** Legitimate Game Masters attempting to start a hosted game (`POST /api/sessions/:code/start`) or control questions received `403 Forbidden`.
- **Underlying Cause:** `GET /api/sessions/:roomCode/host` correctly authorized the session owner via `session.gmId === req.userId`. However, the operational control routes (`POST /:code/start`, `POST /:code/lock`, `POST /:code/end`, `POST /:code/next`, and `PUT /:id/status`) bypassed session ownership and invoked only `checkEventAuthorization(session.eventId, req.userId!)`. Whenever a GM hosted a game where the backing event was associated with a club or another creator, the event-level permission check failed, locking out the legitimate hosting GM.
- **Surgical Fix:** Created and exported a centralized authorization helper `checkSessionHostAuthorization(session, userId)` in `server/src/utils/authorization.ts`. Refactored all GM control routes in `server/src/routes/sessions.ts` to use this unified helper:
  - Owning GM (`session.gmId === userId` with approved status): **PERMITTED**.
  - Super Admin: **PERMITTED**.
  - Different GM or Student: **REJECTED (403 Forbidden)**.
  - Legacy sessions without `gmId`: falls back safely to event ownership verification.

### Root Cause 3: Client Type Inconsistencies & Socket URL Misalignments
- **Defect Symptom:** TypeScript compilation warnings on client payloads regarding `questionEndsAt`, `autoAdvanceAt`, `teamRoster`, and potential fallback issues on `StagePage.tsx` socket connections if `VITE_SOCKET_URL` differed from `VITE_API_URL`.
- **Surgical Fix:** Synchronized `client/src/types/index.ts` with server-emitted fields and harmonized `SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001'` across `PresenterPage.tsx`, `StagePage.tsx`, and `lib/socket.ts`.

---

## 3. Files Changed and Technical Rationale

| File Path | Changes Made | Rationale |
| :--- | :--- | :--- |
| `client/src/pages/LobbyPage.tsx` | Added `api.post('/sessions/join', { roomCode })` pre-join hook before socket connection. | Ensures `SessionPlayer` row is persisted in DB so `player:join` socket handler accepts the student. |
| `server/src/utils/authorization.ts` | Implemented and exported `checkSessionHostAuthorization(session, userId)`. | Centralizes host authorization rules and eliminates divergent checks across host retrieval and control routes. |
| `server/src/routes/sessions.ts` | Refactored `/:code/start`, `/:code/lock`, `/:code/end`, `/:code/next`, `/:id/status`, `/:id/advance`, `/:id/purge-chat` to use `checkSessionHostAuthorization`. | Resolves 403 errors for legitimate session-owning Game Masters while preventing cross-session privilege escalation. |
| `client/src/types/index.ts` | Added `questionEndsAt`, `autoAdvanceAt`, `teamRoster`, `teamResponses` to `SessionStatePayload`. | Eliminates TypeScript type discrepancies between server socket broadcasts and client listeners. |
| `client/src/pages/PresenterPage.tsx` | Fallback `SOCKET_URL` to `VITE_SOCKET_URL \|\| VITE_API_URL \|\| 'http://localhost:3001'`. | Prevents socket disconnects in staging/production environments where socket and API domains are configured via environment variables. |
| `client/src/pages/StagePage.tsx` | Standardized `SOCKET_URL` fallback pattern matching other views. | Ensures projector/stage displays connect to the correct backend host in containerized and cloud deployments. |

---

## 4. Security Audit & Attack Surface Verification

The security posture was verified using `test_security_audit.js` (11 tests), `test_auth_roles.js` (70 checks), and `test_socket_auth.js`.

### Validated Security Controls:
1. **Broken Object Level Authorization (BOLA/IDOR):**
   - Students cannot purge session chat (`403 Forbidden`).
   - Unauthorized GMs cannot advance or mutate sessions belonging to other GMs or clubs (`403 Forbidden`).
   - Non-leader students cannot kick members or disband foreign teams (`403 Forbidden`).
2. **Privilege Escalation & Mass Assignment:**
   - Registration payload `{ role: "SUPER_ADMIN" }` is ignored; role is hardcoded to `PLAYER` in database.
   - GM accounts register in `PENDING` status and require explicit admin approval before hosting.
3. **SQL Injection Defense:**
   - `/api/admin/query` rejects arbitrary SQL via strict Prisma ORM parameterization and allowlisted fields.
4. **Real-time Socket Handshake & Room Isolation:**
   - Sockets connecting without a valid JWT are rejected at the handshake layer (`Authentication error`).
   - Sockets flagged `{ isStage: true }` are granted read-only observer permissions and barred from emitting player or host commands.
   - Sockets cannot listen or broadcast across distinct session rooms.
5. **Spreadsheet Formula Injection Defense:**
   - All Excel/CSV exported strings starting with `=`, `+`, `-`, or `@` are sanitized with leading single quotes.
6. **HTTP Security Headers & Environment Guardrails:**
   - Express fingerprint disabled (`x-powered-by: false`).
   - Strict Content Security Policy (CSP), X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`), HSTS, and Referrer Policy enforced in `server/src/index.ts`.
   - Server fails fast with exit code 1 if `JWT_SECRET` is unset.

---

## 5. GM ↔ Student Integration Verification

The complete lifecycle was validated through automated tests (`test_gm_student_diagnostic.cjs`, `test_gm_host_and_scoring.cjs`, `test_host_architecture.cjs`, `test_regression_suite.cjs`):

```mermaid
sequenceDiagram
    autonumber
    actor GM as Game Master
    actor Student as Student Player
    participant Server as Backend / DB
    participant Socket as Socket.IO Engine

    GM->>Server: POST /api/sessions (GameId)
    Server-->>GM: 201 Created (RoomCode: "9U5T9", Snapshot frozen)
    GM->>Socket: emit('host:join', { roomCode })
    Socket-->>GM: Joined host room

    Student->>Server: POST /api/sessions/join ({ roomCode })
    Server-->>Student: 200 OK (SessionPlayer persisted in DB)
    Student->>Socket: emit('player:join', { roomCode })
    Socket-->>GM: broadcast('session_state_update', playerCount: 1)
    
    GM->>Server: POST /api/sessions/9U5T9/start
    Server->>Socket: broadcast('session_state_update', status: QUESTION_ACTIVE, deadline)
    Student->>Server: POST /api/sessions/9U5T9/submit ({ answer: "A" })
    Server-->>Student: 200 OK (isCorrect: true, pointsAwarded: 100)
    Server->>Socket: broadcast to host (submission count updated)

    Server->>Server: Authoritative Deadline Sweep (questionEndsAt reached)
    Server->>Socket: broadcast('session_state_update', status: QUESTION_LOCKED)
    
    GM->>Server: POST /api/sessions/9U5T9/end
    Server-->>GM: 200 OK (status: ENDED, final scores computed)
    GM->>Server: GET /api/sessions/9U5T9/report
    Server-->>GM: 200 OK (.xlsx generated without formula injection)
```

- **Persistence Verified:** Student handle, USN, and team membership persisted in PostgreSQL.
- **Roster Synchronization:** Host updates participant counts without manual refresh.
- **Idempotent Joins:** Reconnections restore existing participant records and team memberships without creating duplicates.

---

## 6. Authoritative Gameplay, Scoring & Speed Bonus

All scoring is strictly server-authoritative as specified in `docs/CODENEX_SCORING_SPEC.md`.

### Validated Scoring Properties:
1. **Zero Client Trust:** Clients never submit scores, timestamps, or correctness flags.
2. **Deterministic Individual Scoring:** Correct answer = base points; incorrect/unanswered = 0 points.
3. **Team Average Formula:**
   $$\text{Team Base Score} = \text{roundScore}\left(\frac{\sum_{p \in T} \text{individualScore}(p, q)}{\max(|T|, 1)}\right)$$
   Where $|T|$ is the fixed denominator of registered non-banned team members. Disconnecting or skipping questions does not decrease the denominator, preventing gaming of the average.
4. **Team-Level Speed Bonus:**
   - Bonuses are computed at the **team level**, not individual sums, ensuring larger teams do not receive unfair multiplier advantages.
   - Evaluated using average response time ratio across correct team responders:
     $$\bar{r} = \frac{1}{|C|} \sum_{s \in C} \frac{W_{ms} - \text{responseTime}(s)}{W_{ms}}$$
     $$\text{Bonus} = \text{roundScore}(M \times \bar{r})$$
5. **Deterministic Rounding:** Values are deterministically rounded to 1 decimal place using `(Math.round((v + Number.EPSILON) * 10) / 10)` across database, live scoreboard, and exported Excel reports.
6. **Immutable Game Snapshot:** Hosting a game freezes challenges, points, time limits, and bonus parameters into `session.snapshot`. Editing a game post-hosting cannot tamper with live sessions.

---

## 7. Automated Test Suite Results

Every test suite was executed against the active PostgreSQL database and running server instance:

| Suite Name | Scope | Tests Run | Result |
| :--- | :--- | :---: | :---: |
| `test_gm_auth_regression.cjs` | GM session authorization across all endpoints | 25 | **25 / 25 PASS** |
| `test_gm_student_diagnostic.cjs` | Live GM host & student join diagnostic | 7 | **7 / 7 PASS** |
| `test_lifecycle_hardening.cjs` | State transitions, monotonic increments, terminal states | 60 | **60 / 60 PASS** |
| `test_host_restart.cjs` | Restart-safe deadline sweep & auto-lock | 11 | **11 / 11 PASS** |
| `test_lifecycle_guard.cjs` | Static code guard against raw status writes | 1 | **PASS (0 raw writes)** |
| `test_team_average_and_speed_bonus.cjs` | Scoring formulas, precision, team averages, bonuses | 14 + E2E | **14 / 14 PASS** |
| `test_gm_host_and_scoring.cjs` | Host flow, question advance, scoring persistence | 11 | **11 / 11 PASS** |
| `test_regression_suite.cjs` | Question builder semantics, publish, and gameplay | 10 | **10 / 10 PASS** |
| `test_host_architecture.cjs` | State machine, immutable snapshots, role guards | 34 | **34 / 34 PASS** |
| `test_gm_report.cjs` | Report generation, authorization, formula injection | 34 | **34 / 34 PASS** |
| `test_security_audit.js` | RBAC, IDOR, SQL injection, socket authorization | 11 | **11 / 11 PASS** |
| `test_socket_auth.js` | Socket handshake auth and role boundaries | 6 | **6 / 6 PASS** |
| `test_host_load_200.cjs` | 200 concurrent students (join, submit, score, lock) | 200 subs | **PASS ✦ (0 errors)** |
| Server TypeScript (`npx tsc --noEmit`) | Backend type safety | Full server | **0 Errors** |
| Client Build (`npm run build`) | Frontend Vite & TypeScript production build | Full client | **0 Errors (1.44s)** |

---

## 8. 200-Student Concurrent Load Test Results

The load test (`test_host_load_200.cjs`) executed a realistic tournament round with 200 real student accounts against `http://localhost:3001`:

```
================================================================
  200-STUDENT CONCURRENT LOAD TEST — HOST FLOW
  target: http://localhost:3001/api   students: 200
================================================================
[1] GM authenticated
[2] RAPID_FIRE game + 1 scoring question published
[3] Session hosted: 9U5T9
[4] Joining 200 students...
  ⏱ join phase: 25158ms (8 registrations & joins/sec)
  ✓ 200/200 students joined (errors: 0)
  ✓ host sees playerCount=200
[5] Starting question...
  ✓ QUESTION_ACTIVE, challenge correct
[6] Submitting from 200 students (all correct 'A', 100 pts)...
  ⏱ submit phase: 2326ms (86 submissions/sec throughput)
  ✓ submits: 200 resolved, 0 errors
  ✓ isCorrect=true: 200/200   score=100: 200/200
[7] Lock, finalize, verify persistence...
  ✓ status=QUESTION_LOCKED
  ✓ finalized: ENDED
  ✓ scoreboard: 200 players scored (200 with 100 pts)

================================================================
   LOAD RESULT:
      join    25158ms  (8/s)
      submit   2326ms  (86/s)
      errors   join=0 submit=0
      scored   200/200  correct=200/200
   RESULT: PASS ✦
================================================================
```

### Analysis & Observations:
- **Join Throughput:** 200 students registered with BCrypt password hashing, generated JWT tokens, and persisted session records in 25.1s with 0 errors.
- **Submission Throughput:** 86 submissions/second during concurrent answering. All 200 submissions evaluated, stored, and scored in 2.3 seconds.
- **Zero Data Loss:** 200/200 submissions persisted and visible on the final leaderboard.
- **Database Connection Pool:** Standard Prisma connection pooling handled the concurrency smoothly without timeouts. Redis is not required for 200-student tournaments.

---

## 9. Production Configuration & Deployment Architecture

### Recommended Deployment Topology
1. **Frontend:** Deployed to Vercel, Netlify, or AWS CloudFront/S3 as static assets built with `npm run build`.
2. **Backend:** Deployed as a Node.js process on Railway, Render, Fly.io, or AWS ECS/Fargate behind a reverse proxy (Nginx or Cloudflare) supporting WebSocket upgrade (`Upgrade: websocket`).
3. **Database:** Managed PostgreSQL instance (Neon, Supabase, AWS RDS, or Railway Postgres).

### Mandatory Environment Variables
```env
# Server (.env)
DATABASE_URL="postgresql://user:password@host:5432/terminal_db?schema=public&connection_limit=25"
JWT_SECRET="<generate-minimum-64-character-cryptographic-random-secret>"
PORT=3001
CLIENT_URL="https://terminal.yourdomain.com,https://staging.yourdomain.com"
NODE_ENV="production"

# Client (.env.production)
VITE_API_URL="https://api.terminal.yourdomain.com"
VITE_SOCKET_URL="https://api.terminal.yourdomain.com"
```

### CORS & WebSocket Verification
- The backend parses comma-separated `CLIENT_URL` entries.
- WebSocket upgrades require reverse proxy configuration:
  ```nginx
  location /socket.io/ {
      proxy_pass http://localhost:3001;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "Upgrade";
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
  }
  ```

---

## 10. Operational Guardrails & Limitations

1. **Host Connection Redundancy:** If the Game Master disconnects during an active session, the server-authoritative timer continues running. The GM can reconnect at any time and resume control without state corruption.
2. **Late Joins:** By default, new students joining after question start are placed in spectator status until the next question unless late joins are enabled in session settings.
3. **Terminal Resets:** In the student terminal UI, refreshing the browser re-authenticates via stored JWT and re-attaches to the active session immediately.

---

## 11. Final Certification Verdict

### Verdict: `READY FOR PRODUCTION`

The TERMINAL platform has satisfied all functional, integration, authorization, security, scoring, responsiveness, and load requirements:
- Server-authoritative lifecycle and timer sweeping operate deterministically.
- GM Host and student workflows integrate reliably without dropped participants or unhandled exceptions.
- 200 concurrent student participants operate with zero errors and 86 submissions/second throughput.
- All 13+ automated verification suites pass with zero failures.
