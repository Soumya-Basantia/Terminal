# TERMINAL — Application Flow & Logic

## 1. Student Terminal Experience [IMPLEMENTED]

The student interacts primarily through a command-line interface mimicking a hacker terminal.

**Command Registry:** (Located in `client/src/features/terminal/commands/`)
- `help`: Lists commands
- `whoami`: Shows current operator identity
- `status`: Shows system status
- `profile`: Shows user statistics
- `battle <room-code>`: Connects to a live game session
- `submit <answer>`: Submits an answer during a live challenge
- `team`: Team management commands (`-j` to join, `-c` to create)
- `leaderboard`: Shows current session standings
- `exit`: Disconnects from the current session

**Intended Flow:**
1. **Student Login:** Student signs in.
2. **TERMINAL:** Lands in the terminal UI.
3. **Join Game:** Student enters `battle <room-code>`.
4. **Session Lobby:** Waiting for Game Master to start.
5. **Game Active:** Game begins.
6. **Challenge Active:** Challenge details appear in the terminal prompt.
7. **Submit Answer:** Student uses `submit <answer>`. Server validates and stores it.
8. **Results/Score:** Question locks, server broadcasts points.
9. **Leaderboard:** Student checks standings.
10. **Next Challenge:** Loop continues until event ends.

## 2. Game Master Flow [IMPLEMENTED]

1. **Login & Club Context:** Game Master logs in and enters their assigned club workspace (e.g., `/clubs/:clubId`).
2. **Dashboard:** Overview of games, events, and club stats.
3. **Game Library:** GM creates/edits reusable games via `GameEditorPage.tsx`.
4. **Create Event:** GM creates an Event and arranges multiple games inside it (`EventEditorPage.tsx`).
5. **Publish & Host:** GM publishes the event and clicks "Initialize" to spawn a live session.
6. **Room Code:** The server returns a short code (e.g., `G7K29`).
7. **Session Control (Host View):** GM manages the flow from `/clubs/:clubId/sessions/:roomCode/host`:
   - Wait in Lobby for players
   - Start Game
   - Activate Challenge
   - Lock Challenge (prevent further submissions)
   - Reveal Results
   - Show Leaderboard
   - Proceed to Next Challenge/Game
   - End Session

## 3. Stage (Presenter) Flow [IMPLEMENTED]

The Stage (`/sessions/:roomCode/stage`) is a read-only public view managed remotely by the Game Master.

**Modes Controlled by GM:**
- `LOBBY`: Shows the room code, QR, and joined players.
- `ANNOUNCEMENT` / `COUNTDOWN`: Visual transitions.
- `QUESTION`: Displays the active challenge and timer.
- `ANSWER_REVEAL`: Shows correct answer.
- `LEADERBOARD`: Displays current rank standings.
- `FINAL_RESULTS`: Shows winners at the end of the event.

*All state changes on the stage happen automatically via Socket.IO broadcasts triggered by the Game Master.*
