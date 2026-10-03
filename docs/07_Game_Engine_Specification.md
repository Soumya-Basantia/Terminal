# TERMINAL — Game Engine Specification

## 1. Reusable Engine Philosophy
TERMINAL uses a generic session engine that manages state, timers, and participants. Individual game *templates* plug into this engine to define interaction logic.

### Abstract Requirements for any Game Template:
- **Interaction Type:** How does the player submit? (CLI command, specific syntax)
- **Answer Schema:** What does the payload look like? (String, array, boolean)
- **Validation:** How does the server verify correctness? (Exact string match, regex, boolean check)
- **Challenge Configuration:** What fields exist in `Challenge.config`? (Options, expected vectors, targets)

## 2. Currently Implemented Architecture (Phase 6B)

The engine now utilizes a dynamic **Template Registry** (`TemplateRegistry.ts`) and a generic **Validator** (`Validator.ts`).

### Implemented Capabilities:
- **Registry System:** Templates declare capabilities (e.g., timers, speed bonus, teams) that inform the UI.
- **Validation Types:** `EXACT`, `MULTIPLE_CHOICE`, `MULTI_SELECT`, `ORDER`, `MATCH`, `PATTERN`, `STATE_MATCH`, `LOGIC_EVALUATION`, `THRESHOLD`, `RESOURCE_CHECK`, `CUSTOM`.
- **Interaction Types:** Range from standard choices (`CHOICE`) to rich simulations (`VARIABLE_SIMULATION`, `CODE_REVEAL`) introduced in Phase 7E.
- **Active Templates:** `QUIZ` [IMPLEMENTED], `CHAIN_REACTION` [IMPLEMENTED / QA-VALIDATED], `DATA_HUNT` [IMPLEMENTED / QA-VALIDATED], `RAPID_FIRE` [IMPLEMENTED / QA-VALIDATED], `LOGIC_HEIST` [IMPLEMENTED / QA-VALIDATED], `THE_WITNESS` [IMPLEMENTED / QA-VALIDATED]. (Others are currently stubs with `status: 'PLANNED'` or `status: 'EXPERIMENTAL'`).

For full details on the new registry and validation architecture, see **[10_Game_Template_Architecture.md](10_Game_Template_Architecture.md)**.

## 3. Event Orchestration & Game Flow [IMPLEMENTED Phase 7C, QA-VALIDATED Phase 7C.1]

TERMINAL operates as a multi-game event platform. An Event contains multiple Games (referred to as `EventGame` instances).

### Event Modes
Events support three orchestration modes:
- **SEQUENCE**: Games are played in pre-defined order. The GM clicks "Next Game" to advance.
- **GM_CONTROLLED**: The GM manually jumps to any game within the event using the dashboard.
- **RANDOM**: The GM triggers "Random Game" to pick a game from the unplayed, normal-purpose games pool.

### Event Games & Purposes
Games within an Event have a `GamePurpose` (`NORMAL`, `FINAL`, `TIE_BREAKER`, `BONUS`) and an `enabled` flag.
A single Game can be included multiple times in an Event without duplicating challenges.

### Game Replay
The GM can replay a game. Replaying increments the `Session.currentRun` counter. 
Submissions are tracked per-run via `runId`. 
Scores from previous runs are preserved in the Session Leaderboard, allowing continuous point accumulation.

## 4. Scoring Engine

### Current Scoring [IMPLEMENTED]
- Players submit an answer.
- Server extracts validation criteria from `Challenge.config`.
- If `isCorrect`, player receives full `Challenge.points`.
- No penalty for wrong answers (unless `negativeMarking` is manually tracked, though currently it defaults to false logic).

### Future Scoring [PLANNED]
- **Speed Bonus:** Point multiplier scaling linearly with time remaining.
- **Streak Bonus:** Bonus for consecutive correct answers.
- **Team Score:** Aggregate scores of all team members.
- **Comeback Mechanics:** Increased point values in later rounds.

*Important Philosophy:* Scoring should ensure players are not mathematically eliminated in the first round. Engagement must remain high throughout the event.
