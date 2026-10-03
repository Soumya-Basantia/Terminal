# TERMINAL — Product Requirements Document (PRD)

## 1. Product Vision
TERMINAL is a campus technical game platform designed to replace fragmented processes currently used by college technical clubs (e.g., Google Forms + PowerPoint + manual scoring). It provides a unified, reusable platform where Game Masters can create and run technical games, and students interact through a "TERMINAL-style" interface that makes learning concepts (Programming, AI, Databases, etc.) feel like playing a hacker-themed game.

## 2. Core User Roles

### 2.1 Student / Player [IMPLEMENTED]
Uses the TERMINAL command-line interface. 
**Abilities:**
- Register and login
- Access the terminal UI and execute commands
- Join a live session using a room code (`battle <room-code>`)
- Join/create teams (where permitted)
- Answer challenges and submit answers (`submit <answer>`)
- View their score, leaderboard, and team information
- Minimal friction: no complicated setup required before joining.

### 2.2 Club Admin / Game Master [IMPLEMENTED]
Uses a visual, neo-brutalist web dashboard.
**Abilities:**
- Manage and create games (templates)
- Create events (collections of games)
- Arrange games inside events
- Publish events and spawn live sessions
- Control live sessions (Lobby, Start Game, Activate Challenge, Lock, Reveal Results, Leaderboard, End Session)
- Monitor participants in real-time

### 2.3 Stage / Presenter View [IMPLEMENTED]
Not a user role, but a public display interface intended for a projector or large auditorium screen.
**Displays:**
- Lobby and Room/QR codes
- Current active game/challenge
- Timers
- Live Answer Status (how many players submitted)
- Leaderboard & Final Results

### 2.4 Super Admin [PLANNED / PARTIAL]
Platform-level role. 
**Abilities:**
- Create and manage clubs
- Assign Club Admins
- Manage platform-level configurations
*(Currently, clubs exist in the DB schema, and some route middleware checks for super admin, but a full management UI for Super Admins is mostly PLANNED).*

## 3. Club Architecture [IMPLEMENTED]
TERMINAL supports multiple technical clubs within one unified platform. 
**Current Clubs (Examples):** LANGNET, CODENEX, AIERA, AGENTIC ARC.
**Future Extension:** DATANEXUS (or others) can be added via the database without rewriting the platform.
The hierarchy:
- TERMINAL
  - CLUB
    - CLUB ADMIN
    - GAME LIBRARY
    - EVENTS
      - SESSIONS
        - PLAYERS, TEAMS, GAMES, CHALLENGES, SUBMISSIONS, SCORES.

## 4. Out of Scope [EXPLICITLY EXCLUDED]
Features that should NOT currently be built:
- Native mobile app
- Real Git repository execution
- Real code execution sandbox
- LLM-based judging
- Complex analytics
- Cross-college competitions
- Club marketplace
- Student history system
- AI-generated games
- Datanexus integration
- Complex enterprise RBAC
