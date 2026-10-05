# TERMINAL — Security Attack Surface Mapping

**Classification**: Architecture & Threat Model Document  
**Version**: 1.0.0  
**Scope**: REST API Endpoints, Real-Time Socket Architecture, Authorization Boundaries, and Threat Vector Analysis.

---

## 1. Role-Based Access Control (RBAC) Hierarchy

The platform defines distinct user tiers with strictly isolated operational capabilities:

```
                  ┌──────────────────────┐
                  │     SUPER_ADMIN      │ (Platform Owner: root)
                  └──────────┬───────────┘
                             │ Full system oversight, audit queries, GM approvals
                  ┌──────────▼───────────┐
                  │  ADMIN / GAME_MASTER │ (Club Leaders / Event Organizers)
                  └──────────┬───────────┘
                             │ Event creation, game configuration, session hosting
                  ┌──────────▼───────────┐
                  │        PLAYER        │ (Campus Students)
                  └──────────┬───────────┘
                             │ Game participation, team formation, campus chat
                  ┌──────────▼───────────┐
                  │        STAGE         │ (Projector / Arena Display)
                  └──────────────────────┘
                    Read-only spectator stream, no command issuance
```

### Role Capabilities & Guardrails

| Role | Approval Status | Scope & Capabilities | Prohibited Operations |
| :--- | :--- | :--- | :--- |
| **`PLAYER`** | `APPROVED` | Browse public directory, create/join teams, participate in active game sessions, access player socket channels. | Creating games/events/sessions, advancing game rounds, triggering host commands, viewing non-player directory. |
| **`GAME_MASTER`** | `PENDING` | Authenticate into portal, view pending verification banner. | Any event creation, session management, or game authoring until approved by `ADMIN`. |
| **`GAME_MASTER`** | `APPROVED` | Create/edit games, organize club events, host live game sessions, manage session chat. | Accessing platform-wide admin statistics, querying root SQL interface, approving other Game Masters. |
| **`ADMIN`** | `APPROVED` | Full administrative control, review/approve/reject Game Masters, run allowlisted queries, audit system events. | N/A |
| **`STAGE`** | Virtual / Tokenless Handshake | Receive real-time stage display broadcasts (`stage:update`, `round:start`, `leaderboard:update`). | Invoking `host:*` or `player:*` commands, modifying session state. |

---

## 2. REST API Attack Surface & Authorization Matrix

### 2.1. Authentication & Identity (`/api/auth`)

| Endpoint | Method | Required Role | Potential Attack Vector | Applied Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/register` | POST | Public | Mass Assignment / Privilege Escalation | Hardcoded `role: 'PLAYER'`. Rejects reserved username/keyword `"root"`. |
| `/api/auth/register-gm` | POST | Public | Auto-approval bypass | Enforces `approvalStatus: 'PENDING'`. Rejects `"root"` username/email. |
| `/api/auth/login` | POST | Public | Brute-force / Credential Stuffing | Constant-time password hashing comparison via `bcrypt`. Strict format checking. |
| `/api/auth/me` | GET | Authenticated (`PLAYER`, `GAME_MASTER`, `ADMIN`) | Token tampering / Session hijack | Cryptographic JWT signature verification (`HS256`) with required `JWT_SECRET`. |

### 2.2. Administrative Controls (`/api/admin`)

| Endpoint | Method | Required Role | Potential Attack Vector | Applied Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| `/api/admin/stats` | GET | `ADMIN` / `SUPER_ADMIN` | Information Disclosure | Guarded by `requireRole(['ADMIN', 'SUPER_ADMIN'])`. |
| `/api/admin/query` | POST | `ADMIN` / `SUPER_ADMIN` | SQL Injection / Schema Enumeration | Raw SQL execution completely eliminated. Parameterized ORM queries only. Whitelisted targets and fields. |
| `/api/admin/approve-gm` | POST | `ADMIN` / `SUPER_ADMIN` | Unauthorized State Change | Strict role validation. Updates `approvalStatus` to `APPROVED`. |
| `/api/admin/reject-gm` | POST | `ADMIN` / `SUPER_ADMIN` | Denial of Service on GMs | Strict role validation. Updates `approvalStatus` to `REJECTED`. |

### 2.3. Live Sessions & Game Host Controls (`/api/sessions`)

| Endpoint | Method | Required Role | Potential Attack Vector | Applied Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| `/api/sessions/create` | POST | Approved `GAME_MASTER` or `ADMIN` | Unauthorized Session Creation | Enforces `requireRole` and verifies user is not `PENDING`. |
| `/api/sessions/:id` | GET | Authenticated | Session State Sniffing | Sanitized return payload. Omits sensitive author keys. |
| `/api/sessions/:id/advance` | PUT | Event Creator or `SUPER_ADMIN` | Session Hijack / IDOR | Validates `checkEventAuthorization(session.eventId, req.userId)`. Blocks cross-club manipulation. |
| `/api/sessions/:id/purge-chat` | POST | Event Creator or `SUPER_ADMIN` | Chat Tampering / IDOR | Validates `checkEventAuthorization(session.eventId, req.userId)`. Blocks foreign GM calls. |

### 2.4. Teams & Collaboration (`/api/teams`, `/api/collab`)

| Endpoint | Method | Required Role | Potential Attack Vector | Applied Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| `/api/teams/create` | POST | Authenticated `PLAYER` | Team Name Injection / Overwrite | Validates membership count and team uniqueness per event. |
| `/api/teams/disband` | POST | Team `LEADER` | Team IDOR Disbandment | Enforces explicit leader membership check. Returns `403` if non-leader attempts call. |
| `/api/teams/kick` | POST | Team `LEADER` | Member Kick IDOR | Enforces caller is team leader and target is team member. |
| `/api/collab/directory` | GET | Authenticated `PLAYER` | Privileged PII Leaks | Strictly scoped to `{ role: 'PLAYER' }`. Administrators and GMs are hidden. |

---

## 3. Real-Time WebSockets Attack Surface (`Socket.IO`)

### 3.1. Connection Handshake
- **Standard Clients**: Sockets must supply a valid JWT in `auth.token`. Sockets lacking credentials or providing invalid tokens are rejected during the handshake (`io.use`).
- **Stage Display Clients**: Sockets presenting `{ isStage: true }` are admitted without player credentials, but are permanently assigned `socket.data.role = 'STAGE'`.

### 3.2. Socket Event Matrix & Command Guardrails

| Socket Event | Direction | Permitted Roles | Threat Mitigation |
| :--- | :--- | :--- | :--- |
| `host:join` | Inbound | `GAME_MASTER`, `ADMIN`, `SUPER_ADMIN` | Checks `socket.data.role !== 'STAGE'` and user ownership of session. Students receive unauthorized error. |
| `host:change_status` | Inbound | Authorized Session Host | Validates host authorization. Updates session status authoritatively on the server. |
| `host:set_stage_mode` | Inbound | Authorized Session Host | Validates requested mode against `VALID_STAGE_MODES` (`LOBBY`, `ANNOUNCEMENT`, `COUNTDOWN`, `QUESTION`, `ANSWER_REVEAL`, `LEADERBOARD`, `TEAM_LEADERBOARD`, `FINAL_RESULTS`, `PAUSED`, `BLANK`). Rejects malformed modes. |
| `player:join` | Inbound | Authenticated `PLAYER` | Connects student to the session room. Prevents joining if session is not active or full. |
| `player:submit_action`| Inbound | Authenticated `PLAYER` | Verifies active round state and participant identity before accepting game inputs. |
| `stage:update` | Outbound | All Room Participants | Broadcasts authoritative public game state without exposing answers or hidden cues. |

---

## 4. Threat Vector Analysis & Hardening Summary

```
[Threat Vector]                    [Platform Defense]
Malicious Payload on Reg.  ──────> Enforced 'PLAYER' role; 'root' keyword blacklisted
SQL Injection Probe        ──────> Prisma parameterized ORM; allowlisted targets
Cross-Tenant Session Edit  ──────> checkEventAuthorization(eventId, userId) check
Fake Host Socket Events    ──────> Handshake JWT validation + role check
Stage Display Injection    ──────> Stage mode enum validation + 'STAGE' role lock
Cross-Team Member Eviction ──────> Explicit team leader database verification
User Directory Harvesting  ──────> role: 'PLAYER' filter hides all staff/admins
```

The attack surface is comprehensively constrained by defense-in-depth measures operating at the network, application, database, and real-time socket layers.
