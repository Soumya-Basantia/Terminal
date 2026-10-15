# TERMINAL — Pre-Deployment Security Audit Report

**Date:** 2026-10-15  
**Auditor:** Senior Application Security Engineer & Full-Stack Reviewer  
**Scope:** Complete Codebase (`client/`, `server/`, `prisma/`, configuration, and test suites)  
**Status:** REMEDIATED & VERIFIED  

---

## 1. Executive Summary

A comprehensive pre-GitHub and pre-deployment security review was performed on the TERMINAL live cyber-battle tournament platform. The audit identified and remediated critical authentication lifecycle issues, brute-force vulnerabilities, server-startup credential mutations, and unexpected credential persistence.

All confirmed vulnerabilities were remediated with targeted, surgical fixes that preserve core functionality:
- 100% of SOLO and SQUAD gameplay mechanics, authoritative timing, sequential question delivery, and delayed review are preserved and passing tests.
- Comprehensive regression testing across API endpoints, browser UI, and multi-user contexts verified 36/36 security tests, 39/39 live browser tests in Solo mode, and 29/29 live browser tests in Squad mode.

---

## 2. Root Cause Analysis: Login Unexpected Credentials

### Symptoms
When opening `/login`, the login credentials appeared to automatically populate or retain credentials from older sessions.

### Thorough Investigation Across Layers
1. **Frontend Components & State Initialization (`LoginPage.tsx`)**:
   - `loginIdentifier` and `loginPassword` state variables were initialized to empty strings `''`.
   - No hardcoded credential constants or default values existed in input attributes (`value`, `defaultValue`, `placeholder`).
   - Placeholder attributes only displayed generic labels (`"student / email"` and `"••••••••"`).
2. **Persistent Browser Autofill Vault (Root Cause #1)**:
   - The inputs previously utilized standard `id="login-id"` and `id="login-pass"` with `autoComplete="current-password"`.
   - Browsers (Google Chrome, Microsoft Edge) had saved login credentials from earlier testing sessions on origin `http://localhost:5173`. Upon visiting the page, the browser's native password manager automatically injected stored credentials into the form.
   - Form inputs were updated to include explicit standard W3C attributes `name="username"` and `name="password"` alongside `autoComplete="username"` and `autoComplete="current-password"`, ensuring full compatibility with password managers without illicit client-side defaults.
3. **Stale Local Storage & Unverified Session State (Root Cause #2)**:
   - In `client/src/features/auth/AuthContext.tsx`, initial state loaded `terminal_token` and `terminal_user` from `localStorage` directly into application state. If a token expired, was revoked, or belonged to a deleted account, the client continued treating the user as authenticated until an API call failed.
   - **Remediation**: Added proactive token validation on initial application mount. The client now calls `GET /api/auth/me`. If the token is invalid, expired, or rejected by the server, all stored authentication keys (`terminal_token`, `terminal_user`, `terminal_active_session`, `terminal_room_code`) are instantly purged, resetting the user to an unauthenticated state.
4. **Server Startup Demo Account Re-creation (Root Cause #3)**:
   - In `server/src/lib/adminInit.ts`, every server startup previously executed an automatic upsert creating or updating a demo user with hardcoded credentials (`demo@terminal.dev`).
   - Every server restart also checked and unconditionally reset the `root` admin's password hash in the database, overwriting any custom administrative password set in production.
   - **Remediation**: Removed automatic demo account generation entirely. Updated `adminInit.ts` to only create the `root` administrator if one does not already exist, and never overwrite an existing administrator's password or identity.

---

## 3. Vulnerability Findings & Remediation by Severity

### Critical Severity

#### C-01: Admin Password Overwrite on Every Server Boot
- **Location**: `server/src/lib/adminInit.ts`
- **Issue**: The initialization routine unconditionally updated the password hash of user `root` on every server boot using `ADMIN_PASSWORD` (or a fallback string). Any administrator password changed via administrative tools would be wiped out upon server reboot.
- **Remediation**: Added an existence check (`prisma.user.findFirst({ where: { role: 'ADMIN' } })`). The initialization now only seeds a root administrator if no admin account exists in the database. Existing credentials are strictly preserved.
- **Verification**: Verified via `test_pre_deployment_security.cjs` Step 7.

#### C-02: Hardcoded Demo Account Injected on Every Server Boot
- **Location**: `server/src/lib/adminInit.ts`
- **Issue**: The server automatically created/updated `demo@terminal.dev` with a plaintext fallback password upon every launch, logging credentials to standard output.
- **Remediation**: Excised the demo user upsert block completely from `adminInit.ts`. Cleaned console logs of plaintext credentials.
- **Verification**: Verified via `test_pre_deployment_security.cjs` Step 7.

---

### High Severity

#### H-01: Absence of Brute-Force Protection / Rate Limiting on Authentication Endpoints
- **Location**: `server/src/routes/auth.ts`
- **Issue**: `/api/auth/login`, `/api/auth/admin/login`, `/api/auth/register`, and `/api/auth/register-gm` had no rate limiting, allowing automated credential stuffing and dictionary attacks.
- **Remediation**: Implemented `server/src/middleware/rateLimiter.ts` providing an in-memory sliding-window rate limiter with automatic memory cleanup. Configured:
  - Max 10 attempts per 60-second window per IP.
  - Standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After`.
  - HTTP 429 response when threshold is exceeded.
- **Verification**: Verified via `test_pre_deployment_security.cjs` Step 8 (11 consecutive requests confirmed 429 Too Many Requests with `Retry-After`).

#### H-02: Unvalidated Stale Auth State in Frontend Application
- **Location**: `client/src/features/auth/AuthContext.tsx`
- **Issue**: Frontend trusted `localStorage` contents across reloads without pinging the backend, leading to UI desynchronization and potential session confusion.
- **Remediation**: Added server-side validation against `GET /api/auth/me` during `AuthContext` initialization. Invalid or stale tokens trigger complete cleanup of `localStorage` and `sessionStorage`.
- **Verification**: Verified via `test_pre_deployment_security.cjs` Step 2.

---

### Medium Severity

#### M-01: Insecure Default Password Fallback in Code
- **Location**: `server/src/lib/adminInit.ts`
- **Issue**: Code had a fallback default password string if `process.env.ADMIN_PASSWORD` was undefined.
- **Remediation**: Enforced security warning on missing `ADMIN_PASSWORD`. In production environments (`NODE_ENV === 'production'`), startup is halted if a strong `ADMIN_PASSWORD` is not configured.
- **Verification**: Code inspection and unit verification.

#### M-02: Exposure of Internal Debug Bat Script and Accidental Path
- **Location**: Root directory `tempCodeRunnerFile.bat` and `Users/`
- **Issue**: Temporary files and an accidental directory created by local shell tools were present in the workspace.
- **Remediation**: Removed `tempCodeRunnerFile.bat` and the `Users/` directory. Added them to `.gitignore`.
- **Verification**: Git status confirms absence of untracked temporary files.

---

### Low Severity / Informational

#### L-01: Question Key and Explanation Anti-Leakage
- **Audit Target**: Socket.IO payload broadcast and REST endpoints.
- **Finding**: Verified that active question delivery (`QUESTION_ACTIVE`) broadcasts only sanitized question payloads (question text, options, time limit, question index). Correct options and explanations remain strictly withheld by the server until post-game `REVEAL_ANSWERS` is explicitly triggered by the Game Master.
- **Verification**: Verified via Playwright live browser inspection and `test_pre_deployment_security.cjs` Step 6.

#### L-02: Multi-Tenant Game Master Session Isolation (IDOR Prevention)
- **Audit Target**: `server/src/routes/sessions.ts`
- **Finding**: Verified that session controls (`start`, `advance`, `reveal`, `end`) enforce session ownership (`session.hostId === req.user.id` or `role === 'ADMIN'`). A GM cannot access or control sessions belonging to another GM.
- **Verification**: Verified via `test_pre_deployment_security.cjs` Step 5.

---

## 4. Summary of Files Changed

| File | Change Description |
|---|---|
| `server/src/lib/adminInit.ts` | Removed root password overwrite; removed demo account re-creation; added production check for `ADMIN_PASSWORD`. |
| `server/src/middleware/rateLimiter.ts` | Added in-memory sliding-window rate limiter with IP tracking and cleanup. |
| `server/src/routes/auth.ts` | Applied `authRateLimiter` to `/login`, `/admin/login`, `/register`, `/register-gm`. |
| `client/src/features/auth/AuthContext.tsx` | Added proactive token verification on mount; cleans invalid local state on failure. |
| `client/src/pages/LoginPage.tsx` | Standardized `name="username"` and `name="password"` attributes; verified empty initial state. |
| `prisma/seed.ts` | Removed password hash overwrite on upsert; removed plaintext password logging. |
| `.gitignore` | Added `tempCodeRunnerFile.*`, `Users/`, `scratch/`, and local run artifacts. |
| `.env.example`, `server/.env.example` | Sanitized to purely generic template variables; no secrets or live credentials. |
| `test_pre_deployment_security.cjs` | Created 36-point security regression test suite. |

---

## 5. Secret Scan Summary

1. **Active Files**:
   - Zero hardcoded production passwords, tokens, or live database connection strings in tracked source code.
   - All `.env` files are properly excluded from Git by `.gitignore`.
   - `.env.example` templates contain only standard placeholders (e.g., `postgresql://user:password@localhost:5432/dbname`).
2. **Git Commit History**:
   - Inspected git commit log across all branches. No `.env` files were ever committed to Git history.
   - References to generic development phrases in past documentation commits were checked; no active API keys, JWT secrets, or production database passwords exist in Git history.
3. **Recommendation**:
   - When deploying to production hosting (e.g., AWS, GCP, Vercel, Railway), inject unique, cryptographically strong values for `JWT_SECRET` (minimum 32 random characters), `ADMIN_PASSWORD`, and `DATABASE_URL`.

---

## 6. Regression Testing and Verification Evidence

All tests were executed against the live application server and PostgreSQL database:

1. **Security Verification Test Suite (`test_pre_deployment_security.cjs`)**:
   - **Result**: **36 PASSED / 0 FAILED**
   - Verified: Empty login inputs, stale token cleansing on mount, unauthenticated 401 rejections, student GM control blocking (403), GM session isolation (403), question answer key anti-leakage, seed script idempotency without credential overwrite, and rate limiting (429 Too Many Requests).
2. **Solo Mode End-to-End Playwright Test (`test_playwright_full_game.cjs`)**:
   - **Result**: **39 PASSED / 0 FAILED**
   - Verified: Multi-browser context (GM + 2 Students), lobby join, countdown timer synchronization, answer submissions, question auto-advance, mid-game page refresh recovery, delayed answer review, and Excel report export.
3. **Squad Mode End-to-End Playwright Test (`test_playwright_squad_game.cjs`)**:
   - **Result**: **29 PASSED / 0 FAILED**
   - Verified: Multi-browser context (GM + 3 Students across 2 Squads), private squad chat isolation, team average scoring formula, speed bonus calculation, leaderboard toggle, and post-game review.
4. **Delayed Review Mode Suite (`test_delayed_review_mode.cjs`)**:
   - **Result**: **5/5 Phases PASSED**
5. **Real-Time Leaderboard Synchronization Suite (`test_realtime_leaderboard_sync.cjs`)**:
   - **Result**: **10 PASSED / 0 FAILED**
6. **Scoring Formulas & Speed Bonus Suite (`test_team_average_and_speed_bonus.cjs`)**:
   - **Result**: **14 PASSED / 0 FAILED**
7. **Production Builds**:
   - `client`: `npm run build` executed cleanly (TypeScript + Vite, exit code 0).
   - `server`: `npm run build` executed cleanly (`tsc`, exit code 0).

---

## 7. Remaining Risks & Pre-Deployment Recommendations

1. **Production Rate Limiting**: The current rate limiter uses an efficient in-memory sliding window. If scaling to a multi-instance cluster behind a load balancer, consider backing the rate limiter with a shared Redis store.
2. **Database Data Hygiene**: Follow the procedures documented in `docs/SAFE_DATA_CLEANUP_REPORT.md` to safely prune test accounts without impacting real tournament history.
3. **HTTPS / Secure Cookies**: Ensure that production deployments enforce HTTPS and configure reverse proxy headers (`trust proxy`) so IP rate limiting accurately reflects client IPs.
