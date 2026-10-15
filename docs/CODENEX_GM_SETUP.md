# TERMINAL — CODENEX Production Game Master Account & Safe Delete Unplayed Games

## 1. Overview & Architecture

This guide details the operations and security controls for:
1. **Dedicated CODENEX Game Master Account**: An idempotent, secure, environment-driven bootstrap mechanism establishing the production Game Master account for official CODENEX events.
2. **Safe Delete Unplayed Games**: A transactional, row-locked deletion protocol allowing Game Masters to purge unplayed draft and published templates without compromising historical gameplay or tournament records.

---

## 2. Feature 1: Dedicated CODENEX Game Master Account

### 2.1 Identity & Permissions
- **Username**: `codenex`
- **Display Name**: `CODENEX Game Master`
- **Role**: `GAME_MASTER`
- **Approval Status**: `APPROVED`
- **Account Status**: `ACTIVE`
- **Club Affiliation**: Admin of the `codenex` club
- **Email**: Configured via operator environment variable `CODENEX_GM_EMAIL` (never hardcoded)
- **Initial Password**: Configured via operator environment variable `CODENEX_GM_INITIAL_PASSWORD` (default requested: `Codenex`)

### 2.2 Security & Idempotency Rules
1. **Zero Plaintext Storage**: The initial password is never committed to Git, stored in `.env` files, logged to standard out, returned in API payloads, or persisted as plaintext in the database. It is hashed immediately using `bcryptjs` with salt rounds = 10 (`$2a$` / `$2b$`).
2. **First-Login Password Rotation**: The account is provisioned with `mustChangePassword = true`. Until the operator changes the temporary password via `/api/auth/change-password`, all privileged GM operations (`POST /api/games`, `POST /api/events`, `DELETE /api/games/:id`, session hosting) are blocked server-side with `403 Forbidden` (`code: PASSWORD_CHANGE_REQUIRED`).
3. **Idempotency**: Re-running the seed command will not create duplicate accounts, will not reset an already updated password back to the initial password, and will preserve all established relations.
4. **No Silent Hijacking**: If username `codenex` or the email configured in `CODENEX_GM_EMAIL` belongs to an unexpected or conflicting account, the command aborts safely with exit code 1 without altering database state.
5. **No Public Endpoint**: Account provisioning is strictly server-side through the explicit operator CLI command.

### 2.3 Windows PowerShell Bootstrap Commands

Open Windows PowerShell in the project root (`c:\Users\SOUMYA.B\Desktop\Terminal`):

```powershell
# 1. Set required environment variables in current PowerShell session
$env:CODENEX_GM_EMAIL = "codenex.gm@terminal.dev"
$env:CODENEX_GM_INITIAL_PASSWORD = "Codenex"

# 2. Run the idempotent bootstrap command
npm run seed:codenex-gm

# 3. Clean up the sensitive password variable from session memory
Remove-Item Env:\CODENEX_GM_INITIAL_PASSWORD
```

### 2.4 First-Login Operator Flow
1. Navigate to the TERMINAL Web Client (`http://localhost:5173/login`).
2. Log in with:
   - **Login / Username**: `codenex` (or the configured email)
   - **Password**: `Codenex`
3. Upon authentication, TERMINAL detects `mustChangePassword: true` and automatically presents the Cybercore **First-Login Security Protocol** modal.
4. Supply `Codenex` as the Current Password and enter a strong New Password.
5. Upon confirmation, the backend rotates the bcrypt hash, updates `mustChangePassword: false`, and unlocks all GM hosting, game design, event creation, and reporting features.

---

## 3. Feature 2: Safe Delete Unplayed Games

### 3.1 Eligibility Requirements
A game module may be permanently deleted if and only if **all** of the following conditions are verified server-side inside an atomic database transaction:
- **Never Played**: The game has 0 recorded submissions (`prisma.submission.count == 0`).
- **No Active Sessions**: The game has no sessions in `LOBBY`, `STARTING`, `IN_PROGRESS`, `PAUSED`, `QUESTION_ACTIVE`, `QUESTION_LOCKED`, or `RESULTS` status.
- **Ownership / Authorization**: The requesting user is the designer of the game, an Admin of the associated club, or a Platform Administrator (`SUPER_ADMIN`).

If a game has historical submissions or an active running session, the backend strictly rejects the deletion with `409 Conflict` and a human-readable explanation. Historical scores and tournament reports are never cascade-deleted.

### 3.2 Backend Transaction & Row-Locking Architecture
The `DELETE /api/games/:id` endpoint uses PostgreSQL row-level locking:
```sql
SELECT id, "designerId", "clubId", name FROM "games" WHERE id = $1 FOR UPDATE;
```
Inside `prisma.$transaction`:
1. Row lock on the target game prevents race conditions with concurrent `POST /api/sessions` or game starts.
2. Ownership is verified against `designerId`, `clubId`, and admin privileges.
3. Active sessions are checked; any active session triggers an immediate `409 Conflict`.
4. Submissions are checked across all sessions associated with the game; any submission triggers an immediate `409 Conflict`.
5. For empty ended sessions, `currentGameId` foreign keys are safely decoupled (`SET NULL`).
6. Associated challenges, event attachments, and unplayed session records are cleanly cascaded.
7. The game is deleted atomically.

### 3.3 HTTP Status Codes
| HTTP Status | Condition |
| :--- | :--- |
| `200 OK` | Game safely purged from database (`{ success: true, message: "..." }`) |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | Requesting Game Master is not the owner or club admin |
| `404 Not Found` | Game ID does not exist |
| `409 Conflict` | Game cannot be deleted (has active session or historical submissions) |
| `500 Internal Error` | Unexpected server fault (internal traces suppressed) |

### 3.4 User Interface
- **Game Master Workspace (`/gm?tab=games`)**:
  - Each unplayed game card displays a visible Cybercore red trash action button with tooltip.
  - Clicking launches a high-contrast Neo-Brutalist confirmation modal explaining permanent deletion.
  - Success banner informs the GM of successful deletion; the game card is removed from the reactive UI without a page reload.
- **Game Editor (`/games/:id/edit`)**:
  - Top navigation bar provides a `[DELETE MODULE]` action with a trash icon.
  - Opening the confirmation modal displays the module title and safety criteria.
  - Upon successful deletion, the user is navigated back to `/gm?tab=games`.
  - Double-click protection and loading spinners prevent duplicate requests.

---

## 4. Rollback Considerations & Operational Runbook

### 4.1 Database Rollback
The changes introduce one optional field to `User`:
```prisma
mustChangePassword Boolean @default(false)
```
- **Backward Compatibility**: Existing accounts default to `mustChangePassword: false`. Standard logins and gameplay are unaffected.
- **Schema Reversion**: If reverting the Prisma schema, set default in migration or remove the column; no existing production data will be lost.

### 4.2 Seed Command Rollback
To remove or reset the `codenex` Game Master account:
```powershell
# In PowerShell:
npx prisma db execute --stdin
# SQL:
# DELETE FROM club_members WHERE "userId" IN (SELECT id FROM users WHERE username = 'codenex');
# DELETE FROM users WHERE username = 'codenex';
```

### 4.3 Automated Verification
Run the complete regression suite:
```powershell
# 1. Run CODENEX GM & Safe Delete Game Suite
node test_codenex_gm_and_delete_game.cjs

# 2. Run Existing System Test Suites
node test_gm_auth_regression.cjs
node test_gm_host_and_scoring.cjs
node test_gm_report.cjs
node test_lifecycle_hardening.cjs
node test_sequential_question_flow.cjs
node test_projector_stage_mode.cjs
```
