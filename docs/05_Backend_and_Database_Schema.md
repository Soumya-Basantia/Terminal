# TERMINAL — Backend, Database Schema, and API

## 1. Database Schema [IMPLEMENTED]

The database uses PostgreSQL managed by Prisma. Below is the conceptual Entity-Relationship (ER) mapping of the current schema (`prisma/schema.prisma`):

```mermaid
erDiagram
    User {
        String id PK
        String username UK
        String email UK
        String passwordHash
        Enum role "PLAYER | GAME_MASTER | SUPER_ADMIN"
    }

    Profile {
        String id PK
        String userId FK
        String displayName
        Int totalScore
        Int gamesPlayed
        Int gamesWon
    }
    
    Club {
        String id PK
        String name UK
        String slug UK
        Enum status "ACTIVE | INACTIVE"
    }

    ClubMember {
        String id PK
        String clubId FK
        String userId FK
        Enum role "ADMIN | MEMBER"
    }

    Team {
        String id PK
        String name UK
        String createdBy FK
    }

    TeamMember {
        String id PK
        String teamId FK
        String userId FK
        Enum role "LEADER | MEMBER"
    }

    Game {
        String id PK
        String name
        Enum template "QUIZ | RAPID_FIRE"
        Enum status "DRAFT | PUBLISHED | ARCHIVED"
        String designerId FK
        String clubId FK
    }

    Challenge {
        String id PK
        String gameId FK
        Int position
        Enum type "SINGLE_CHOICE | MULTIPLE_CHOICE | TRUE_FALSE"
        Json config
        Int points
    }

    Event {
        String id PK
        String name
        String creatorId FK
        String clubId FK
        Enum status "DRAFT | PUBLISHED | ARCHIVED"
        Enum mode "MANUAL | SEQUENCE | RANDOM"
    }

    EventGame {
        String id PK
        String eventId FK
        String gameId FK
        Int position
    }

    Session {
        String id PK
        String roomCode UK
        String eventId FK
        Enum status "LOBBY | STARTING | QUESTION_ACTIVE | QUESTION_END | LEADERBOARD | FINAL_RESULTS"
        Enum stageMode "LOBBY | QUESTION | LEADERBOARD | FINAL_RESULTS | etc"
    }

    SessionPlayer {
        String id PK
        String sessionId FK
        String userId FK
        String teamId FK
    }

    Submission {
        String id PK
        String sessionId FK
        String challengeId FK
        String playerId FK
        String answer
        Boolean isCorrect
        Int score
    }

    User ||--o{ ClubMember : "belongs to"
    Club ||--o{ ClubMember : "has"
    Club ||--o{ Game : "owns"
    Club ||--o{ Event : "owns"
    User ||--o{ Profile : "has"
    User ||--o{ Team : "creates"
    User ||--o{ TeamMember : "belongs to"
    Team ||--o{ TeamMember : "has"
    Team ||--o{ SessionPlayer : "plays as"
    Team ||--o{ Submission : "makes"
    Game ||--o{ Challenge : "contains"
    Event ||--o{ EventGame : "contains"
    Game ||--o{ EventGame : "included in"
    Event ||--o{ Session : "spawns"
    Session ||--o{ SessionPlayer : "hosts"
    User ||--o{ SessionPlayer : "joins as"
    Session ||--o{ Submission : "records"
    Challenge ||--o{ Submission : "receives"
```

## 2. API Endpoints [IMPLEMENTED]

The backend provides a RESTful API powered by Express.

### Authentication (`/api/auth`)
- `POST /register`: Register a new user.
- `POST /login`: Authenticate and receive a JWT.
- `GET /me`: Get current authenticated user details.

### Clubs (`/api/clubs`)
- `GET /`: List clubs the user belongs to.
- `GET /:clubId`: Get specific club details.
- `POST /`: Create a new club (Requires Super Admin).

### Events (`/api/events`)
- `POST /`: Create an event.
- `GET /`: List events (filtered by `clubId`).
- `GET /:id`: Get specific event details.
- `PUT /:id`: Update event.
- `POST /:id/games`: Add a game to an event.
- `PUT /:id/games/reorder`: Reorder games within an event.
- `DELETE /:id/games/:gameId`: Remove a game from an event.

### Games (`/api/games`)
- `GET /`: List games (filtered by `clubId`).
- `POST /`: Create a game.
- `GET /:id`: Get specific game with challenges.
- `DELETE /:id`: Delete a game.
- `POST /:id/publish`: Change game status to PUBLISHED.
- `POST /:id/challenges`: Add a challenge to a game.
- `POST /:id/challenges/reorder`: Reorder challenges.
- `DELETE /:id/challenges/:challengeId`: Remove a challenge.

### Sessions (`/api/sessions`)
- `POST /`: Spawn a live session from an event (returns room code).
- `POST /join`: Player joins a session via room code.
- `GET /:roomCode`: Get active session state.
- `PUT /:id/status`: Update session status/stage mode (Host only).
- `PUT /:id/advance`: Advance session to next game/challenge (Host only).
- `POST /active/submit`: Submit an answer to the current active challenge.
- `POST /:code/submit`: Legacy alias for submission.
