# TERMINAL — Club Architecture Design (Phase 6) [IMPLEMENTED]

## 1. Vision
TERMINAL is evolving into a multi-tenant platform to support various technical college clubs (e.g., LANGNET, CODENEX, AIERA, AGENTIC ARC). Each club requires isolated ownership of Games and Events, while maintaining a unified Student experience and a shared Game Engine.

## 2. Ownership Model
The conceptual ownership hierarchy is strictly top-down:
- **Club:** Top-level organizational entity.
- **Game:** Belongs to exactly one Club. Defines reusable challenge templates.
- **Event:** Belongs to exactly one Club. Acts as a playlist of Games.
- **Session:** Belongs to exactly one Event. A live, instantiated run of an Event.

## 3. Roles and Membership
- **SUPER_ADMIN:** Platform-wide administrator with full access to all clubs, games, and events.
- **CLUB_ADMIN:** A user with `ADMIN` role in `ClubMember`. They can create, edit, and manage Games and Events *only* for their assigned Club(s). A single user can be an Admin for multiple clubs.
- **CLUB_MEMBER:** Standard club affiliation. (Optional for gameplay).
- **STUDENT / PLAYER:** Any authenticated user. They do NOT need club membership to participate in a live Session.

## 4. Permission Matrix

| Action | Super Admin | Club Admin | Student / Player |
| :--- | :---: | :---: | :---: |
| Create Club | ✅ | ❌ | ❌ |
| Edit Club Details | ✅ | ✅ (Own Club) | ❌ |
| Create Game | ✅ | ✅ (Own Club) | ❌ |
| Edit/Publish Game | ✅ | ✅ (Own Club) | ❌ |
| Create Event | ✅ | ✅ (Own Club) | ❌ |
| Edit/Publish Event| ✅ | ✅ (Own Club) | ❌ |
| Spawn Session | ✅ | ✅ (Own Club) | ❌ |
| Host Session (Socket)|✅ | ✅ (Own Club) | ❌ |
| Join Session | ✅ | ✅ | ✅ |
| Submit Answers | ✅ | ✅ | ✅ |

## 5. Data Model (Current vs. Required)

### Current Model Findings
The `schema.prisma` file is remarkably well-prepared for this architecture. The following models and relationships **ALREADY EXIST** and can be reused without modification:
- `Club` (id, name, slug, status)
- `ClubMember` (clubId, userId, role)
- `User` (role Enum for SUPER_ADMIN)
- `Game` (clubId optional relation)
- `Event` (clubId optional relation)
- `EventGame` (many-to-many join table)

### Required Changes
**No schema changes are required** to support the core club isolation mechanics. The database is already structured to map Games and Events to Clubs, and Users to Clubs via `ClubMember`.

### Optional Future Changes
- **Shared/Public Games:** A `visibility` enum on `Game` (e.g., `PRIVATE`, `CLUB_ONLY`, `PUBLIC`) to allow clubs to use generic platform-wide games.
- **Club Analytics:** Materialized views for club-specific participation metrics.

## 6. Relationships & Technical Rules
- **Rule 1:** `Game.clubId` enforces ownership.
- **Rule 2:** `Event.clubId` enforces ownership.
- **Rule 3:** Cross-club games via `EventGame` are structurally possible but should be blocked at the application level (API) unless the Game is explicitly marked as shared/public in the future.
- **Rule 4:** `Session` inherits its authorization context entirely from `Session.event.clubId`.

## 7. Game & Event Ownership
The game engine (Sessions, Stage, Challenges, Submissions) remains entirely unified. When a Club Admin creates a Game, they populate `Challenge.config` as normal. 
If a Club Admin leaves a club, their `ClubMember` record is deleted. The Games and Events remain safely owned by the `Club` (via `clubId`), preventing orphaned records.

## 8. Authorization Strategy
Authorization must be unified across the REST API and Socket.IO server.
We will expand the shared authorization helper (`server/src/utils/authorization.ts`):
- `checkEventAuthorization(eventId, userId)` (Already implemented)
- `checkGameAuthorization(gameId, userId)` (To be implemented)
- `checkClubAuthorization(clubId, userId)` (To be implemented)

*Security Impact:*
- APIs fetching Games/Events must strictly apply `where: { clubId: { in: userClubIds } }` for Club Admins.
- Socket.IO must continue to rely on the shared authorization helpers before processing `host:*` events.

## 9. Migration Strategy (Legacy Compatibility)
Older Games and Events in the database have `clubId = null` but have `creatorId` (Events) and `designerId` (Games).
**Safe Migration Plan:**
1. Leave legacy records as `clubId = null`.
2. The authorization helper already falls back to checking `creatorId === userId` if `clubId` is null. We will mirror this for Games (`designerId === userId`).
3. (Optional) Provide a Super Admin script to retroactively assign legacy Games and Events to newly created Clubs.

## 10. Open Questions / Architectural Decisions
- **Cross-Club Collaboration:** Should a CODENEX admin be able to import a LANGNET game if they co-host an event? For Phase 6, we will restrict this, but the schema (`EventGame`) technically supports it.
- **Resource Limits:** Do we need to enforce limits on the number of active sessions a single club can run concurrently to prevent platform starvation?

## 11. Recommended Implementation Sequence
1. **Club Management API:** Endpoints to list clubs, create clubs (Super Admin), and manage `ClubMember` relations.
2. **Authorization Middleware:** Implement `checkGameAuthorization` and `checkClubAuthorization`.
3. **Data Segregation:** Update all `GET /api/games` and `GET /api/events` endpoints to filter by the user's authorized clubs.
4. **Club Admin UI:** Build the React dashboard for Club Admins to view their specific Club scope.
