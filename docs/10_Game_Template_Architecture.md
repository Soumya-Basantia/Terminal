# TERMINAL — Game Template Architecture (Phase 6B) [IMPLEMENTED]

## 1. Vision
The Terminal platform is designed to be a unified, generic Game Engine capable of running multiple types of games (Trivia, Puzzle, Code, CTF) without rebuilding the core engine for each game type.

To achieve this, we have introduced a **Game Template Architecture**. 
Games are no longer hardcoded structures; instead, they are instances of a **Template**. A Template defines the interaction types, validation logic, capabilities (teams, timers), and progression rules for a specific kind of game mechanic.

## 2. Core Concepts & Separation of Concerns

- **TEMPLATE**: The core mechanic ruleset (e.g., `QUIZ`, `CHAIN_REACTION`, `TREASURE_HUNT`). Templates are **global** and hardcoded in the server registry.
- **GAME**: A collection of content created by a Club Admin, assigned a specific Template (e.g., "Git Fundamentals Quiz" using the `QUIZ` template). Games are **Club-owned**.
- **CHALLENGE**: An individual interaction/question within a Game (e.g., "What does git init do?"). The fields inside the Challenge config are defined by the Template's schema.
- **SESSION**: A live, running instance of an Event. 
- **EVENT MODE**: Controls how games progress within a Session (`SEQUENCE`, `GM_CONTROLLED`, `RANDOM`).
- **SUBMISSION**: A player's raw answer. 
- **VALIDATION**: The server-side logic that compares a Submission against a Challenge config, determined by the Template's validation type.

## 3. Template Registry (`TemplateRegistry.ts`)
The server maintains a registry of templates implementing the `GameTemplateContract`.
This contract specifies:
- `id`: The Enum ID (e.g., `QUIZ`, `CHAIN_REACTION`, `DATA_HUNT`, `LOGIC_HEIST`, `THE_WITNESS` - all `[IMPLEMENTED / QA-VALIDATED]`)
- `status`: `AVAILABLE`, `EXPERIMENTAL`, or `PLANNED`. Unfinished templates cannot be played.
- `capabilities`: Flags for the UI to know what features are supported (e.g., `timer: true`, `teams: 'OPTIONAL'`).
- `challengeSchema`: The structure of the challenge configuration.
  - `interactionType`: How the student interacts (e.g., `MCQ`, `TEXT_INPUT`, `ORDER`).
  - `validationType`: How the server grades the submission (e.g., `EXACT`, `MULTIPLE_CHOICE`).

## 4. Interaction Primitives (`types.ts`)
Templates use reusable interaction primitives to dictate the student UI:
- `CHOICE`, `SINGLE_CHOICE`, `MULTI_CHOICE`: Standard selection interactions (replacing MCQ).
- `TEXT_INPUT`: Open-ended string input.
- `MULTI_SELECT`: Checkbox style multiple correct answers.
- `MATCH`: Linking items from two columns.
- `ORDER`: Arranging items in a specific sequence.
- `TEAM_ACTION`: Collaborative triggers requiring team synchronization.
- `CODE_LIKE_INPUT`: Code editor / syntax-aware input.
- `CHAIN`: Connected inputs (like a crossword or pipeline).
- `FILTER`, `MULTI_FILTER`, `SORT`, `LIMIT`: Data manipulation operations.
- `FIELD_IDENTIFICATION`, `RECORD_IDENTIFICATION`: Data hunt specific identification tasks.
- **Phase 7E Primitives (Learning-Through-Gameplay):**
  - `VARIABLE_SIMULATION`: Tracing or simulating variable state changes.
  - `LOOP_SIMULATION`: Predicting loop outputs or execution counts.
  - `BLOCK_CONSTRUCTION`: Visual programming block arrangement.
  - `DECISION`: Branching narrative or logic path choices.
  - `RESOURCE_SELECTION`: Managing constrained resources (e.g., bandwidth, compute).
  - `TOOL_SELECTION`: Choosing the right tool for a specific problem.
  - `PREDICTION`: Guessing the outcome of an action or script.
  - `CONSEQUENCE`: Identifying the result of a vulnerability or misconfiguration.
  - `CODE_REVEAL`: Partially obscured code that reveals based on actions.
  - `NARRATIVE_CLUE`: Story-based discovery elements.

## 5. Validation Architecture (`Validator.ts`)
The server strictly handles grading. The `Validator` takes a `ValidationType` and a `ValidationContext` (the submission and challenge config).
Current validators:
- `EXACT`: Strict string comparison.
- `CASE_INSENSITIVE`: Case-insensitive string comparison.
- `MULTIPLE_CHOICE`: Validates an option selection.
- `MULTI_SELECT`: Set-based validation (all required options must be present).
- `PATTERN`: Regex matching.
- `ORDER`: Validates sequence arrays.
- `MATCH`: Validates a Key-Value mapping.
- `STATE_MATCH`: Validates complex JSON state against expected state (Phase 7E).
- `LOGIC_EVALUATION`: Evaluates logic conditions/rules dynamically (Phase 7E).
- `THRESHOLD`: Checks if a numerical value is within an acceptable range (Phase 7E).
- `RESOURCE_CHECK`: Validates remaining resource budgets (Phase 7E).
- `CUSTOM`: Fallback for complex template-specific logic.

## 6. Progression Architecture
Templates specify how players move between challenges:
- `SEQUENTIAL`: Linear progression controlled by the Game Master (Default for Quiz).
- `FREE_ORDER`: Players can tackle challenges in any order.
- `CHAIN`: Solving challenge N unlocks challenge N+1.
- `CONDITIONAL`: Branching paths based on answers.
- `TEAM_UNLOCK`: Requires N team members to solve before proceeding.
- `SIMULATION_STEP`: Progression based on stepping through a simulation loop (Phase 7E).
- `SCENARIO_BRANCH`: Progression determined by narrative or logic decisions (Phase 7E).
- `STATE_TRIGGER`: Progression unlocked when specific state conditions are met (Phase 7E).

## 6.5. Event Orchestration (Phase 7C / QA-VALIDATED Phase 7C.1)
While Templates dictate *in-game* progression, Event Modes dictate *between-game* progression.
- **SEQUENCE**: Fixed order progression (Next Game).
- **GM_CONTROLLED**: Free form jump between games.
- **RANDOM**: Random selection from remaining unplayed normal games.
Games can be replayed inside an event, which increments a `currentRun` counter on the Session to preserve historical submission scores without overwriting them.

## 7. Security and Integrity
- The server remains authoritative. Clients never decide correctness.
- Modifying `Game` settings dynamically respects the Template capabilities.
- Unregistered or `PLANNED` templates are rejected if attempting to run.
- Club ownership applies to Games and Events; Templates are unified and globally accessible to all authorized Club Admins.

## 8. Specific Template Implementations

### DATA_HUNT
Data Hunt is designed as a mystery/mission rather than a database lesson. It provides students with a `datasetUrl` and a `story` (defined in the `Game` config). Players interact with the data through narrative-driven clues.
- **Progression:** Uses `CHAIN` progression. Solving challenge N unlocks challenge N+1.
- **Interaction Types:** `FILTER`, `MULTI_FILTER`, `SORT`, `LIMIT`, `FIELD_IDENTIFICATION`, `RECORD_IDENTIFICATION`.
- **Validation:** Uses `CUSTOM` validation, checking the student's submission against `challenge.config.correct`.
- **Configuration:** Challenges have `clue`, `action`, `field`, `correct`, and `onSuccess` fields.

### LOGIC_HEIST
Logic Heist is a beginner-friendly programming logic adventure where the player acts as a hacker breaking through digital security systems.
- **Progression:** Uses `CHAIN` progression. Players solve vault nodes independently.
- **Interaction Types:** Employs Phase 7E primitives like `VARIABLE_SIMULATION`, `LOOP_SIMULATION`, `BLOCK_CONSTRUCTION`, `DECISION`, `CONSEQUENCE`, `CODE_REVEAL`.
- **Validation:** Uses `CUSTOM` (with fallback to exact matching of `answer`).
- **Configuration:** Challenges include `prompt` (scenario/code), `answer`, `options` (for block construction), and `onSuccess` (reveal text).

### THE_WITNESS (Phase 8.5) [IMPLEMENTED / QA-VALIDATED]
The Witness is an investigative interrogation game where the player acts as a detective isolating a single culprit among suspects through constrained inquiries.
- **Educational Concept:** Binary search, partition balance, and information gain discovered through detective intuition.
- **Progression:** Single mission investigation with a fixed Question Budget (e.g., 5 tokens).
- **Interaction Types:** Structured question builder (`INTERROGATION`) with subject, attribute, operator, and value slots. No free-text typing.
- **Core Mechanics:** Live Partition Preview (`YES: X | NO: Y`), server-authoritative evidence evaluation (`POST /witness-query`), contradictory candidate elimination, Evidence Board tracking, and Final Accusation warrant submission (`POST /submit`).
- **Scoring:** Base challenge points + Question conservation bonus (+20 pts per unused query) + Grand Detective efficiency bonus (+15% for avg suspect reduction >= 35%).
- **Security:** Secret culprit identity (`secret`, `culpritId`) is strictly sanitized from public session state, socket payloads, and stage views. Reconnection restores the authoritative investigation state from `submission.metadata`.

