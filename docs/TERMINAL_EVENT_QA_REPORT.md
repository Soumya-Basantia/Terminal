# TERMINAL Event QA Report

## 1. Scope and objective

This review covers the live TERMINAL platform that is currently checked into the repository and intended for event use on a local Windows workstation. The objective was to validate the real application stack before public use, confirm authentication and session flows, inspect route coverage, and document any defects or caveats affecting the CODENEX event workflow.

This report reflects the code and runtime state observed in the current repository revision, along with the automated QA checks executed against the local backend and frontend build/test flows.

## 2. Environment and architecture summary

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Real-time layer: Socket.IO
- Persistence: PostgreSQL via Prisma
- Current local app ports:
  - Backend: http://localhost:3001
  - Frontend: http://localhost:5173
- Runtime startup path: `start.bat` launches Prisma sync, backend, and frontend in separate terminals.

## 3. Route and feature inventory

### 3.1 Auth and identity

Primary implementation: `server/src/routes/auth.ts`

Routes:
- `POST /api/auth/register`
- `POST /api/auth/register-gm`
- `POST /api/auth/login`
- `POST /api/auth/admin/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

Role model currently enforced in code and the schema:
- `PLAYER`
- `GAME_MASTER`
- `ADMIN`
- `SUPER_ADMIN`

Behavior observed:
- Student registration creates a `PLAYER` identity by default.
- GM registration is pending approval unless an admin explicitly approves it.
- Admin/Super Admin auth is distinct and should not be bypassed by client-supplied role payloads.
- Session and route authorization checks reject unauthorized access server-side.

### 3.2 Game and session management

Primary implementation: `server/src/routes/games.ts`, `server/src/routes/sessions.ts`, `server/src/routes/events.ts`

Core routes:
- `POST /api/games`
- `GET /api/games`
- `GET /api/games/:id`
- `PUT /api/games/:id`
- `POST /api/games/:id/publish`
- `POST /api/games/:id/clone`
- `POST /api/sessions`
- `POST /api/sessions/join`
- `GET /api/sessions/:roomCode`
- `GET /api/sessions/:roomCode/host`
- `GET /api/sessions/:roomCode/leaderboard`
- `PUT /api/sessions/:id/status`
- `PUT /api/sessions/:id/advance`
- `POST /api/sessions/:code/start`
- `POST /api/sessions/:code/lock`
- `POST /api/sessions/:code/end`
- `POST /api/sessions/:code/next`
- `POST /api/sessions/:id/purge-chat`

Session lifecycle behavior in use:
- Host route creates a unique room code and freezes a game snapshot before the session is live.
- Session transitions go through the lifecycle gateway and enforce server-authoritative rules.
- The backend rejects invalid transitions, terminal restarts, unauthorized control actions, and late joins when not allowed.

### 3.3 Teaming, collaboration, and chat

Primary implementation: `server/src/routes/teams.ts`, `server/src/routes/collab.ts`, `server/src/routes/messages.ts`

Core routes:
- `GET /api/teams/current`
- `POST /api/teams/create`
- `POST /api/teams/join`
- `POST /api/teams/invite`
- `POST /api/teams/accept`
- `POST /api/teams/reject`
- `POST /api/teams/leave`
- `POST /api/teams/kick`
- `POST /api/teams/disband`
- `GET /api/teams/messages`
- `GET /api/collab/`
- `POST /api/collab/add`
- `GET /api/collab/requests`
- `POST /api/collab/accept`
- `POST /api/collab/reject`
- `POST /api/collab/remove`
- `GET /api/messages`
- `PATCH /api/messages/:id/read`

The app supports:
- Collaboration requests and approvals
- Team creation and membership management
- Real-time chat and message persistence
- Team roster and leaderboard-driven session state

### 3.4 Admin and reporting

Primary implementation: `server/src/routes/admin.ts`, `server/src/routes/reports.ts`, `server/src/routes/sessionReport.ts`

Core routes:
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `POST /api/admin/query`
- `GET /api/admin/reports`
- `GET /api/admin/system-settings`
- `POST /api/admin/export/students-full`
- `GET /api/reports/my`
- `GET /api/sessions/:sessionId/report`

The admin area is designed to manage user approval, system settings, reporting, and data export while keeping privileged functionality server-authorized.

### 3.5 Frontend route inventory

Primary implementation: `client/src/App.tsx`

Public / app shell routes:
- `/login`
- `/register`
- `/join`
- `/join/:sessionCode`
- `/lobby/:sessionCode`
- `/play/:sessionCode`
- `/results/:sessionCode`
- `/presenter/:sessionCode`
- `/stage/:sessionCode`

Protected GM and workspace routes:
- `/admin`
- `/gm`
- `/workspace/gm`
- `/terminal`
- `/workspace/student`
- `/clubs`
- `/clubs/:clubId`
- `/clubs/:clubId/events`
- `/clubs/:clubId/events/:id/edit`
- `/clubs/:clubId/games/new`
- `/clubs/:clubId/games/:id/edit`
- `/clubs/:clubId/games/:id/host`
- `/clubs/:clubId/sessions/:sessionCode/host`
- `/sessions/:sessionCode/host`

## 4. Role and authorization model

The platform enforces the following core rule set:

1. `PLAYER` users may participate in sessions, join teams, submit answers, and view their own or room-authorized data.
2. `GAME_MASTER` users may create and control games/sessions only when they are approved.
3. `ADMIN` and `SUPER_ADMIN` users hold elevated privileges for approval, platform management, and cross-session controls.
4. Session ownership checks must match the active host and must reject cross-user control attempts.
5. The server is authoritative for scoring, timing, session transitions, and late-join restrictions.

This is implemented in `server/src/utils/authorization.ts` and used by the session control routes to keep host and admin behavior consistent.

## 5. Automated validation executed

The following checks were executed directly in the repository during this audit:

- `cd server && npm run build` — Passed
- `cd client && npm run build` — Passed
- `node test_gm_auth_regression.cjs` — Passed
- `node test_gm_student_diagnostic.cjs` — Passed
- `node test_team_average_and_speed_bonus.cjs` — Passed
- `node test_security_audit.js` — Passed
- `node test_socket_auth.js` — Passed
- `node test_host_architecture.cjs` — Passed
- `node test_host_load_200.cjs` — Passed
- `node test_gm_report.cjs` — Passed

## 6. Observed result and release recommendation

The repository currently reflects a mature event-ready implementation with strong server-side guardrails, a frozen snapshot-based hosting model, and passing regression coverage across host authorization, session lifecycle, scoring, load, and reporting. No new production-blocking defect was identified during the executed validation pass for the current branch.

Recommendation:
- Proceed with event deployment on the current codebase, assuming the local PostgreSQL instance is healthy and the app is launched via the supplied setup scripts.
- Continue to test with the staging or public-facing tunnel only after verifying environment variables and remote access constraints for the final event network.
- Keep the QA scripts and the report in the repository as evidence for release sign-off.

## 7. Known caveats

- Do not expose raw `.env` values or secrets in issue trackers or logs.
- Public access should be validated behind a tunnel or approved forwarding mechanism only.
- Database state, test users, and event test sessions should remain clearly labeled to avoid accidental mixing with real production accounts.
- The application relies on PostgreSQL; if the DB is offline or misconfigured, the startup script will fail and the event environment will not be ready.

## 8. Final status

Status: Ready for CODENEX event use under the validated local configuration and after normal pre-flight checks are completed.
