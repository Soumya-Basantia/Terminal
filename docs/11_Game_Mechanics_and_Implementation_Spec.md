# TERMINAL — Game Mechanics & Implementation Specification
## Document 11 | The Bridge Between Design and Build

> **Status:** Pre-Implementation Reference — Phase 8 Ready
> **Source Authority:** This document is grounded in the live codebase as of Phase 7F.
> Any discrepancy between documentation and implementation is flagged explicitly.
> The running code is the source of truth; documentation is secondary.

---

## 1. Purpose

This document is the implementation contract between the game design direction
(TERMINAL_GAME_DESIGN_V2, AUDIENCE_ADDENDUM, V3_REFINEMENT) and the actual
development work in Phase 8 and beyond.

It defines:
- Exactly how each game fits into the existing architecture
- What configuration JSON each challenge requires
- What the student experiences step by step
- What the Game Master sees and controls
- What the Stage/Projector displays
- How scoring works per game
- What validation type handles each game
- What is already built vs. what needs to be built

---

## 2. Design Principles

### 2.1 Audience
First and second-year CSE students with approximately 4–8 weeks of
programming experience. They know variables, loops, and conditionals
exist — but do not yet feel them intuitively.

### 2.2 Learning Loop (Non-Negotiable)
```
EXPERIENCE → EXPERIMENT → DISCOVER → SUCCEED/FAIL → CONCEPT REVEAL
```
Never: `DEFINITION → QUESTION → ANSWER`

### 2.3 Game Feel Differentiation

| Club | Game Feel |
|------|-----------|
| CODENEX | Manipulate systems. Execute logic. Debug. Predict behavior. |
| LANGNET | Communicate. Interrogate. Compress. Clarify ambiguity. |
| AIERA | Investigate. Experiment. Form hypotheses. Test evidence. |
| AGENTIC ARC | Plan. Allocate tools. Orchestrate agents. Observe consequences. |
| DATA_HUNT | Investigate. Extract information. Chain clues. Solve mysteries. |

### 2.4 What This Platform Is NOT
- Not a coding exam
- Not an MCQ set with a story wrapper
- Not a syntax-writing challenge

---

## 3. Architecture Status (Discrepancy Audit)

### 3.1 What Is Actually Implemented

Reading `TemplateRegistry.ts`, `Validator.ts`, `schema.prisma`,
`sockets/index.ts`, `sessionService.ts`:

**AVAILABLE templates (runnable today):**
- `QUIZ` — MCQ, True/False
- `CHAIN_REACTION` — Sequential MCQ with chain unlock
- `RAPID_FIRE` — Auto-advancing timed MCQ
- `DATA_HUNT` — Filter/clue investigation
- `LOGIC_HEIST` — Registered but frontend interaction incomplete

**PLANNED templates (stub only, status: 'PLANNED'):**
- BUG_HUNT, TREASURE_HUNT, MATCH, ARRANGE, TEXT_INPUT,
  TEAM_CHALLENGE, PACKET_RELAY

**EXPERIMENTAL:**
- PROMPT_BATTLE

### 3.2 Discrepancy: Docs vs. Code

| Item | Documentation Claims | Code Reality |
|------|---------------------|-------------|
| `STATE_MATCH` ValidationType | Listed in doc 10 as implemented | `Validator.ts` has `stateTransition` as **private** method — NOT in the switch statement; cannot be called as a ValidationType |
| `LOGIC_EVALUATION`, `THRESHOLD`, `RESOURCE_CHECK` | Listed as implemented validators | NOT present in `Validator.ts` switch statement — only in documentation |
| Logic Heist frontend | Implied implemented | No Logic Heist-specific component visible in `PlayPage.tsx` pages listing |
| Speed bonus / streak | Listed as "PLANNED" in doc 07 | Submit route in sessions.ts does not implement these yet |

**Resolution:** The items above are design intentions, not shipped code.
This document treats them as "needs implementation" and provides the spec for building them.

---

## 4. Reusable Game Mechanics (Primitive Library)

All games are combinations of these primitives — not bespoke engines.

| Primitive | Description | Used In |
|-----------|-------------|---------|
| **Execution Trace** | Step-by-step animated state mutation | Logic Heist, Loop Trap |
| **Block Sequencer** | Ordered draggable action cards | Logic Heist, Silent Mission, Cascade |
| **Test Console** | Input → observe output, no commitment | Dead Code, Rogue Scanner |
| **Command Menu** | Structured terminal command picker (no free text) | Data Hunt, Signal Router |
| **Filtered Table** | Live-updating data table as filters applied | Data Hunt, Rogue Scanner |
| **Evidence Board** | Accumulating known-facts panel | The Witness, Data Hunt, Dead Code |
| **Pipeline Visualizer** | Node-to-node agent flow diagram | Cascade, Signal Router |
| **Resource Budget** | Countdown counter constraining actions | The Witness, Loop Trap, Compression |
| **Hypothesis Selector** | Commit-before-test mechanic | Rogue Scanner, Dead Code |
| **Conveyor / Item Stream** | Live items flowing through rule engine | Assembly Line |
| **Scatter Visualization** | 2D data point plot, updates dynamically | Classifier, Curator, Threshold |
| **Slider Control** | Continuous value selector with live preview | Threshold |
| **Narrative Reveal** | Story text unlocked by correct actions | Data Hunt, Logic Heist, Silent Mission |
| **Alert Tier System** | Escalating consequences on repeated failure | Logic Heist |
| **Ghost Trace** | Faded correct-path hint shown after failure | Logic Heist |
| **Concept Badge** | Post-solve achievement showing technical name | All games |

---

## 5. Template Mapping

| Game | Club | Template ID | Validation | Progression | Status |
|------|------|-------------|------------|-------------|--------|
| Logic Heist | CODENEX | `LOGIC_HEIST` | `STATE_MATCH` (fix needed) | CHAIN | Registered, needs full frontend |
| Dead Code | CODENEX | `BUG_HUNT` | `CUSTOM` | SEQUENTIAL | PLANNED — needs upgrade |
| Signal Router | CODENEX | `SIGNAL_ROUTER` (new) | `EXACT` | SEQUENTIAL | New |
| Assembly Line | CODENEX | `ASSEMBLY_LINE` (new) | `CUSTOM` | SEQUENTIAL | New |
| The Witness | LANGNET | `THE_WITNESS` (new) | `CASE_INSENSITIVE` | SEQUENTIAL | New |
| Dead Signal | LANGNET | `DEAD_SIGNAL` (new) | `CUSTOM` | SEQUENTIAL | New |
| The Corruptor | LANGNET | `TEXT_INPUT` extended | `CUSTOM` | SEQUENTIAL | PLANNED base |
| Compression | LANGNET | `PROMPT_BATTLE` | `CUSTOM` | SEQUENTIAL | EXPERIMENTAL base |
| Rogue Scanner | AIERA | `ROGUE_SCANNER` (new) | `CASE_INSENSITIVE` | SEQUENTIAL | New |
| The Threshold | AIERA | `THE_THRESHOLD` (new) | `CUSTOM` | SEQUENTIAL | New |
| The Classifier | AIERA | `THE_CLASSIFIER` (new) | `CUSTOM` | SEQUENTIAL | New |
| The Curator | AIERA | `THE_CURATOR` (new) | `CUSTOM` | SEQUENTIAL | New |
| Silent Mission | AGENTIC ARC | `SILENT_MISSION` (new) | `ORDER` | CHAIN | New |
| Cascade | AGENTIC ARC | `CASCADE` (new) | `ORDER` | SEQUENTIAL | New |
| Loop Trap | AGENTIC ARC | `LOOP_TRAP` (new) | `EXACT` | SEQUENTIAL | New |
| Data Hunt | ALL | `DATA_HUNT` | `CUSTOM` | CHAIN | ✅ AVAILABLE |

---

## 6. CODENEX

### 6.1 Logic Heist *(REGISTERED — Needs Full Feature Implementation)*

#### 6.1.1 Core Fantasy
You are a hacker. The vault has a **state** — a set of named variables
with current values. You must make the system reach the **target state**
using provided logic blocks arranged in the correct sequence.
Every execution is animated step by step.

#### 6.1.2 Game Loop
```
1. READ vault state (current → target)
2. SELECT blocks (drag or type: arrange 1 2 3 4)
3. OPTIONAL: DRY RUN (step through without committing)
4. BREACH (full animated execution)
5. WATCH trace step by step
6. If correct → vault opens, story clue reveals, next vault unlocks
7. If wrong → Security Alert tier escalates, Ghost Trace shows divergence
8. ADJUST and retry (with penalty)
9. All vaults complete → score finalized
```

#### 6.1.3 Player Actions

| Action | Terminal Command | UI |
|--------|-----------------|-----|
| Arrange blocks | `arrange 1 3 2 4` | Drag and drop |
| Step through (dry run) | `step` | Step button |
| Execute | `breach` | BREACH button |
| Reset | `reset` | Clear button |
| Request hint | `hint` | Hint button (costs points) |

#### 6.1.4 Challenge Configuration Schema (Implementation-Ready JSON)

```json
{
  "vault": 2,
  "narrative": "Security Layer 2: The signal amplifier requires exactly 9 units of power.",
  "initialState": { "SIGNAL": 0 },
  "targetState": { "SIGNAL": 9 },
  "blocks": [
    { "id": 1, "label": "SET SIGNAL = 0", "operation": "SET", "variable": "SIGNAL", "value": 0 },
    { "id": 2, "label": "ADD 3", "operation": "ADD", "variable": "SIGNAL", "value": 3 },
    { "id": 3, "label": "LOOP 3 TIMES: ADD 3", "operation": "LOOP", "variable": "SIGNAL", "value": 3, "loopCount": 3 },
    { "id": 4, "label": "MULTIPLY BY 2", "operation": "MUL", "variable": "SIGNAL", "value": 2, "isDecoy": true }
  ],
  "correctSequence": [1, 3],
  "allowedAttempts": 3,
  "hintText": "You only need 2 blocks. One sets the starting value. One repeats an action.",
  "revealText": "You used ITERATION — running the same instruction multiple times. In Python: `for i in range(3): signal += 3`. You just wrote a loop without writing it.",
  "difficulty": "EASY",
  "concepts": ["ITERATION", "ARITHMETIC"]
}
```

#### 6.1.5 Submission Format
Answer field (JSON-serialized string):
```json
{
  "finalState": { "SIGNAL": 9 },
  "sequence": [1, 3],
  "attempts": 1,
  "blocksUsed": 2,
  "timeMs": 15000,
  "hintsUsed": 0
}
```

#### 6.1.6 Validation
**Current gap:** `Validator.ts` has a private `stateTransition()` method
that compares JSON state objects — but it is NOT accessible as a
`ValidationType` in the switch statement.

**Fix required:**
1. Add `'STATE_MATCH'` to `ValidationType` in `types.ts`
2. Add `case 'STATE_MATCH': return this.stateTransition(context);` in `Validator.ts`

Then register Logic Heist with `validationType: 'STATE_MATCH'`.

Server validates `submission.finalState` against `challenge.config.targetState`.

#### 6.1.7 Scoring
```
First attempt:     100% base points
Second attempt:    70%
Third attempt:     50%
Timeout:           0–30% based on state closeness (manhattan distance)

Speed bonus:       +15% if solved in first half of time limit
Efficiency bonus:  +15% if blocksUsed < blocks.length (used fewer than available)
Hint penalty:      –20% per hint used
Alert Tier 2:      –10% of remaining points
Alert Tier 3:      –20% of remaining points
```

#### 6.1.8 Concept Progression Across Vaults

| Vault | Concept | Operations | Decoys | Time |
|-------|---------|-----------|--------|------|
| 1 | Sequencing + Arithmetic | SET, ADD | 0 | 90s |
| 2 | Iteration (loops) | SET, ADD, LOOP | 0 | 90s |
| 3 | Conditionals | SET, ADD, IF | 1 | 90s |
| 4 | Combined logic | LOOP + IF | 1-2 | 120s |
| 5 | Side effects | Full set + interdependent vars | 2 | 120s |

#### 6.1.9 Security Alert Tier System
- **Alert 1:** Wrong execution → –10% points. Ghost trace shown.
- **Alert 2:** Second wrong execution → –20% points. One block locked temporarily.
- **Alert 3:** Third wrong execution → –30% points. One variable resets to initialState.

Stage shows alert level per player (green → yellow → red indicator).

#### 6.1.10 Terminal Presentation
```
╔══════════════════════════════════════════════════════╗
║  OPERATION NIGHTFALL — VAULT 2                       ║
║  ────────────────────────────────────────────────    ║
║  CURRENT STATE:   SIGNAL = 0                         ║
║  TARGET STATE:    SIGNAL = 9                         ║
║                                                      ║
║  AVAILABLE BLOCKS:                                   ║
║  [1] SET SIGNAL = 0                                  ║
║  [2] ADD 3                                           ║
║  [3] LOOP 3 TIMES: ADD 3                             ║
║  [4] MULTIPLY BY 2       ← available                ║
║                                                      ║
║  YOUR SEQUENCE: [1] [3] ___ ___                      ║
║  Time: 01:12 | Attempts: 1/3 | Alert: 0 (CLEAR)     ║
╚══════════════════════════════════════════════════════╝
> _
```

Execution Trace Animation (after BREACH):
```
BREACH INITIATED...

  STEP 1: SET SIGNAL = 0
          SIGNAL: ∅ → 0
          ──────────────────────────
  STEP 2: LOOP 3 TIMES → ADD 3
    ITER 1: SIGNAL: 0 + 3 = 3
    ITER 2: SIGNAL: 3 + 3 = 6
    ITER 3: SIGNAL: 6 + 3 = 9
          ──────────────────────────
  FINAL STATE: SIGNAL = 9
  TARGET:      SIGNAL = 9

  ✓ VAULT OPEN. Security Layer 2 Bypassed.
  ✓ Story clue unlocked: "The encryption key is hidden in Layer 3..."
```

#### 6.1.11 Stage / Projector
- Left: Player alert level indicators (green/yellow/red per player)
- Center: Vault door animation + current challenge name
- Right: Live leaderboard (scores from completed vaults)
- On vault open: Full-screen vault-burst animation + story clue scrolls
- On Alert Tier 3: Red flash + alarm sound

#### 6.1.12 Game Master Controls

| Control | Action |
|---------|--------|
| Start Game | `host:select_game` |
| Activate Vault | `host:select_challenge` (specific challenge ID) |
| Pause Vault | `host:change_status → QUESTION_LOCKED` |
| Resume | `host:change_status → QUESTION_ACTIVE` |
| Reveal Concept | `host:set_stage_mode → ANSWER_REVEAL` |
| Show Leaderboard | `host:set_stage_mode → LEADERBOARD` |
| Skip Vault | `host:select_challenge` (next challenge ID) |
| Replay Vault | `host:replay_game` |
| Next Game | `host:skip_game` |

#### 6.1.13 QA Scenarios

| Scenario | Expected |
|----------|---------|
| Correct sequence | finalState matches targetState → vault opens |
| Wrong sequence | Alert tier++, ghost trace shows divergence |
| Decoy block included (non-NOP) | Wrong final state → fail |
| Decoy block included (NOP) | Final state unchanged by decoy → may still pass |
| BREACH with empty sequence | Server rejects — 0 blocks invalid |
| DRY RUN only (no BREACH) | No submission created, no penalty |
| Same wrong sequence twice | Alert Tier 2 fires, extra penalty |
| Alert Tier 3 | Variable resets + stage red flash |
| Hint used twice | Each deducts 20% independently |
| All vaults complete | chainProgress → COMPLETED, final score submitted |
| Player reconnects mid-vault | `player:join` re-syncs via `session_state_update` |
| GM skips vault | Next vault activates, current player progress abandoned |

---

### 6.2 Dead Code (Bug Hunt)

**Template:** `BUG_HUNT` (exists as PLANNED — upgrade to AVAILABLE)

#### 6.2.1 Core Fantasy
You are a software detective. A system produces wrong outputs.
You must reproduce the bug through controlled testing,
form a hypothesis, locate the faulty rule, fix it, and verify.

#### 6.2.2 Game Loop
```
1. READ scenario (system description + 2-3 known wrong outputs)
2. USE test console: enter input values, observe system output
3. REPRODUCE the bug: find the exact input that triggers it
4. FORM hypothesis: "Rule [N] uses [wrong operator/value]"
5. SUBMIT hypothesis (buggy rule ID + corrected rule text)
6. VERIFY: system replays 3 failing cases with fix applied — watch them pass
```

#### 6.2.3 Challenge Configuration Schema
```json
{
  "scenario": "The attendance grading system is marking students incorrectly.",
  "systemDescription": "Students with 75% or above should pass. Below 75% should fail.",
  "knownWrongOutputs": [
    { "input": { "attendance": 75 }, "expected": "PASS", "actual": "FAIL" }
  ],
  "rules": [
    { "id": 1, "label": "IF attendance LESS THAN 75 → FAIL", "hasBug": true, "bugType": "BOUNDARY" },
    { "id": 2, "label": "IF attendance GREATER THAN OR EQUAL TO 75 → PASS", "hasBug": false }
  ],
  "testInputRange": { "attendance": { "min": 0, "max": 100 } },
  "buggyRuleId": 1,
  "correctRule": "IF attendance LESS THAN 75 means score of 74 fails but 75 should pass — change < to <=",
  "answer": "1",
  "revealText": "The difference between < and <= (less than vs. less than or equal to) is called a boundary condition bug. It's one of the most common real-world errors."
}
```

#### 6.2.4 Validation
Type: `CUSTOM`. Server checks `submission === String(config.buggyRuleId)`.

#### 6.2.5 Scoring
```
Correct rule ID + fix text reasonable: 100%
Correct rule ID only:                  60%
Wrong rule ID:                         0% + new symptom revealed
Speed bonus:                           applicable
Hint: –20% per hint
```

#### 6.2.6 Stage Moment
"Bug Board" per team: INVESTIGATING → TESTING → SUSPECTED → PATCHING → VERIFIED.
When first team hits VERIFIED: "BUG SQUASHED" animation + correct rule shown on stage.

---

### 6.3 Signal Router

**Template:** NEW (`SIGNAL_ROUTER`)

#### 6.3.1 Challenge Config Schema
```json
{
  "scenario": "Route an emergency hospital signal. It must arrive. Cost is secondary.",
  "optimizeFor": "RELIABILITY",
  "graph": {
    "nodes": ["NEXUS", "EAST_RELAY", "BACKUP_SERVER", "TERMINAL_NODE"],
    "edges": [
      { "from": "NEXUS", "to": "EAST_RELAY", "energy": 3, "reliability": 1.0 },
      { "from": "NEXUS", "to": "BACKUP_SERVER", "energy": 1, "reliability": 0.7 },
      { "from": "EAST_RELAY", "to": "TERMINAL_NODE", "energy": 2, "reliability": 0.95 },
      { "from": "BACKUP_SERVER", "to": "TERMINAL_NODE", "energy": 1, "reliability": 0.6 }
    ],
    "start": "NEXUS",
    "end": "TERMINAL_NODE"
  },
  "optimalPath": ["NEXUS", "EAST_RELAY", "TERMINAL_NODE"],
  "answer": "NEXUS,EAST_RELAY,TERMINAL_NODE",
  "revealText": "The high-reliability path used more energy — but for a medical signal, that tradeoff was correct. Choosing what to optimize for is as important as solving the optimization itself."
}
```

#### 6.3.2 Validation
Type: `EXACT`. Submission is comma-joined node path.
Partial credit: server checks if path is valid (connected) even if not optimal.

---

### 6.4 Assembly Line

**Template:** NEW (`ASSEMBLY_LINE`)

#### 6.4.1 Challenge Config Schema
```json
{
  "scenario": "Build a grade classifier. Rules determine what category each student falls into.",
  "fields": ["score", "attendance"],
  "actions": ["PASS", "FAIL", "PROVISIONAL"],
  "ruleTemplate": "IF [field] [operator] [value] → [action]",
  "operators": [">=", ">", "<=", "<", "="],
  "wave1": [
    { "score": 90, "attendance": 95, "expected": "PASS" },
    { "score": 40, "attendance": 60, "expected": "FAIL" }
  ],
  "wave2EdgeCases": [
    { "score": 75, "attendance": 75, "expected": "PASS", "isEdgeCase": true }
  ],
  "answer": "RULE_SET_EVALUATION",
  "revealText": "A student at exactly 75% depended entirely on whether you wrote >= 75 or > 75. This boundary condition determines real academic outcomes."
}
```

---

## 7. LANGNET

### 7.1 The Witness

**Template:** NEW (`THE_WITNESS`)

#### 7.1.1 Core Fantasy
A system answers questions with perfect literal accuracy — but no
interpretation. Your question budget is your resource.
Spend each question to extract maximum information.

#### 7.1.2 Game Loop
```
1. READ mission brief (what secret must be extracted? stakes?)
2. SEE question budget counter
3. BUILD question using Question Builder menu (no free-typing)
4. READ response → evidence added to Evidence Board
5. DECIDE: what is the most valuable next question?
6. REPEAT until secret identified or budget exhausted
7. SUBMIT the extracted secret
8. POST-GAME: question replay ranked by information value
```

#### 7.1.3 Question Builder Menu
```
TYPE:   [IS IT / IS IT NOT / IS IT MORE THAN / DOES IT CONTAIN / IS IT RELATED TO]
TARGET: [a person / a place / a number / an action / an object / a category]
DETAIL: [optional single word or phrase]
```

#### 7.1.4 Challenge Config Schema
```json
{
  "missionBrief": "A theft occurred in the server room at 3AM. Identify the responsible department.",
  "questionBudget": 10,
  "secret": "NETWORK_OPS",
  "responses": {
    "IS IT a person": "No — it is an organizational unit.",
    "IS IT a department": "Yes.",
    "DOES IT CONTAIN the word development": "No.",
    "DOES IT CONTAIN the word network": "Yes.",
    "IS IT NETWORK_OPS": "Yes."
  },
  "informationValue": {
    "IS IT a person": "LOW — eliminated 10% of candidates",
    "IS IT a department": "HIGH — confirmed category (50% reduction)",
    "DOES IT CONTAIN the word network": "VERY HIGH — narrowed to 2 candidates"
  },
  "answer": "NETWORK_OPS",
  "revealText": "The best questions cut the candidate space in half each time. Asking 'Does it contain X?' is more efficient than 'Is it Y?' because it handles many wrong guesses simultaneously. This is how Binary Search works."
}
```

#### 7.1.5 Validation
Type: `CASE_INSENSITIVE`. Submission compared to `config.secret`.

#### 7.1.6 Scoring
```
Correct + questions remaining: 100% + (remaining/total × 30% bonus)
Correct + no budget remaining: 60%
Wrong:                         0%
```

#### 7.1.7 Stage Moment
Large question budget countdown on projector.
Post-game: best question of round shown to audience.
"Most efficient question: [text] — eliminated 60% of candidates."

---

### 7.2 Dead Signal

**Template:** NEW (`DEAD_SIGNAL`)

#### 7.2.1 Challenge Config Schema
```json
{
  "task": "Teach the Pattern Engine the Celsius-to-Fahrenheit conversion",
  "pool": [
    { "id": 1, "input": 0, "output": 32, "isNoise": false },
    { "id": 2, "input": 100, "output": 212, "isNoise": false },
    { "id": 3, "input": 25, "output": 77, "isNoise": false },
    { "id": 5, "input": 100, "output": 99, "isNoise": true }
  ],
  "maxSelectable": 3,
  "testCases": [
    { "input": -10, "expectedOutput": 14 },
    { "input": 50, "expectedOutput": 122 }
  ],
  "noiseIds": [5],
  "optimalSelectionIds": [1, 2, 3],
  "answer": "1,2,3",
  "revealText": "Example 5 was noise — it violated the pattern. Identifying and excluding noise is as important as finding good examples. In ML, this is called data cleaning."
}
```

---

### 7.3 The Corruptor

**Template:** `TEXT_INPUT` extended with `CUSTOM` validation

#### 7.3.1 Challenge Config Schema
```json
{
  "scenario": "An AI report on a merger will go to the board in 10 minutes. Find the inaccuracies.",
  "sources": [
    { "id": "S1", "text": "Company A employs 340 people as of Q3 2024." },
    { "id": "S2", "text": "Revenue increased by 12% year over year." }
  ],
  "report": "Company A employs 430 people as of Q3 2024. Revenue grew by 21% year over year.",
  "inaccuracies": [
    { "sentenceFragment": "employs 430 people", "sourceId": "S1", "issue": "Should be 340" },
    { "sentenceFragment": "grew by 21%", "sourceId": "S2", "issue": "Should be 12%" }
  ],
  "trickSentence": "The merger will conclude in Q1 2025.",
  "answer": "[S1:employs 430,S2:grew by 21%]",
  "revealText": "AI systems can produce text that is confident, fluent, and factually wrong. Always cross-reference AI-generated content with primary sources."
}
```

---

### 7.4 Compression (Prompt Golf)

**Template:** `PROMPT_BATTLE` (exists as EXPERIMENTAL — upgrade path)

#### 7.4.1 Challenge Config Schema
```json
{
  "targetOutput": "A medieval castle with a drawbridge surrounded by a moat at sunset",
  "keywordPool": ["medieval", "castle", "drawbridge", "moat", "sunset", "fortress", "ancient", "stone", "water", "evening", "the", "with", "a", "at", "surrounded", "by"],
  "maxWords": 10,
  "similarityThreshold": 0.85,
  "optimalKeywords": ["medieval", "castle", "drawbridge", "moat", "sunset"],
  "answer": "SIMILARITY_SCORE >= 0.85 AND WORD_COUNT <= 10",
  "revealText": "Removing 'the', 'with', and 'a' didn't hurt the meaning — they carry no semantic weight. The domain keywords (medieval, castle, moat) carried almost all the meaning with far fewer words."
}
```

---

## 8. AIERA

### 8.1 Rogue Scanner

**Template:** NEW (`ROGUE_SCANNER`)

#### 8.1.1 Core Fantasy
A classification system makes wrong decisions for the wrong reasons.
You must form a hypothesis about what it actually learned,
test it with controlled experiments, and prove your case.

#### 8.1.2 Game Loop
```
1. READ system description + wrong classifications shown
2. OBSERVE training data for patterns
3. FORM hypothesis: "It's using [Feature X] instead of [Feature Y]"
4. TEST: input a case designed to isolate the hypothesis
5. OBSERVE output: confirms or denies?
6. REFINE hypothesis if needed
7. RUN validation sweep (5 preset test cases)
8. SUBMIT: "System learned: [X]. Should have learned: [Y]"
```

#### 8.1.3 Challenge Config Schema
```json
{
  "scenario": "A hiring screener is rejecting qualified candidates. Something is wrong.",
  "systemDescription": "Should classify by: Relevant Experience + Skill Match",
  "trainingData": [
    { "experience": 5, "skillMatch": 90, "university": "IIT", "decision": "ACCEPTED" },
    { "experience": 5, "skillMatch": 90, "university": "Local College", "decision": "REJECTED" }
  ],
  "testConsoleFields": [
    { "name": "experience", "type": "number", "range": [0, 10] },
    { "name": "skillMatch", "type": "number", "range": [0, 100] },
    { "name": "university", "type": "enum", "options": ["IIT", "NIT", "Local College"] }
  ],
  "contaminatedFeature": "university",
  "validationSweep": [
    { "experience": 5, "skillMatch": 90, "university": "Local College", "expectedWithFix": "ACCEPTED" },
    { "experience": 2, "skillMatch": 40, "university": "IIT", "expectedWithFix": "REJECTED" }
  ],
  "answer": "university",
  "revealText": "The system learned university name as a shortcut for quality — a spurious correlation. The correct features were experience and skill match. This is called training bias."
}
```

#### 8.1.4 Validation
Type: `CASE_INSENSITIVE`. Answer is name of contaminated feature.
Bonus: +20% if validation sweep 5/5 correct.

#### 8.1.5 Scoring
```
Correct feature:              100%
+ Validation sweep 5/5:       +20% bonus
Found in fewer tests:         +10% bonus per test under limit
Wrong feature:                0% + new symptom revealed as consolation
```

#### 8.1.6 Stage Moment
Classification grid live. When correct hypothesis submitted: training data
viewer highlights contaminated feature in red → replays 5 cases correctly → green.
"Bias removed. System now decides fairly."

---

### 8.2 The Threshold

**Template:** NEW (`THE_THRESHOLD`)

#### 8.2.1 Challenge Config Schema
```json
{
  "scenario": "Medical screening. Set sensitivity threshold for flagging critical patients.",
  "population1": [
    { "name": "Ananya", "riskScore": 75, "isCritical": true },
    { "name": "Rahul", "riskScore": 45, "isCritical": false },
    { "name": "Dev", "riskScore": 55, "isCritical": true }
  ],
  "population2": [
    { "name": "Ananya", "riskScore": 55, "isCritical": true },
    { "name": "Rahul", "riskScore": 35, "isCritical": false }
  ],
  "costs": { "falseNegative": 10, "falsePositive": 2 },
  "optimalThreshold1": 60,
  "optimalThreshold2": 45,
  "answer": "60,45",
  "revealText": "The same threshold worked for round 1 but failed for round 2 because the patient population changed. Models must be recalibrated when deployed in new contexts. This is called distribution shift."
}
```

---

### 8.3 The Classifier

#### 8.3.1 Challenge Config Schema
```json
{
  "task": "Find minimum features that separate ELIGIBLE from NOT_ELIGIBLE scholarship candidates",
  "labeledExamples": [
    { "gpa": 8.5, "attendance": 95, "year": 2, "feePaid": true, "label": "ELIGIBLE" },
    { "gpa": 6.0, "attendance": 80, "year": 1, "feePaid": false, "label": "NOT_ELIGIBLE" }
  ],
  "features": ["gpa", "attendance", "year", "feePaid"],
  "minimalFeatureSet": ["gpa", "attendance"],
  "hiddenTestCases": [
    { "gpa": 8.0, "attendance": 90, "year": 3, "feePaid": true, "expected": "ELIGIBLE" }
  ],
  "answer": "gpa,attendance",
  "revealText": "Year of study and whether fees were paid were irrelevant to eligibility. GPA and attendance were sufficient. Irrelevant features add noise, not signal — a core insight in machine learning."
}
```

---

### 8.4 The Curator

#### 8.4.1 Challenge Config Schema
```json
{
  "task": "Curate training examples to teach a system to detect fake expense receipts",
  "pool": [
    { "id": 1, "amount": 500, "vendor": "Legit Vendor", "dateValid": true, "isFake": false },
    { "id": 2, "amount": 50000, "vendor": "Ghost Store", "dateValid": false, "isFake": true },
    { "id": 3, "amount": 500, "vendor": "Another Real", "dateValid": true, "isFake": false }
  ],
  "maxExamples": 6,
  "adversarialCase": { "amount": 500, "vendor": "Ghost Store Clone", "dateValid": true, "isFake": true },
  "optimalIds": [1, 2, 4, 7, 8, 9],
  "answer": "VALIDATION_ACCURACY >= 80",
  "revealText": "Choosing only obvious fakes taught the system to look for obvious fakes — it missed the subtle ones. Diverse examples covering edge cases is what makes a model robust."
}
```

---

## 9. AGENTIC ARC

### 9.1 Silent Mission

**Template:** NEW (`SILENT_MISSION`)

#### 9.1.1 Core Fantasy
You write the plan. You submit it. The agent executes it exactly.
If your plan didn't account for a locked door, the agent fails at
that door and cannot recover. The plan is the code.

#### 9.1.2 Game Loop
```
1. READ mission objective + available command library
2. STUDY map (fog of war on UNKNOWN zones)
3. BUILD plan: drag commands into ordered queue
4. WATCH energy budget (each command costs 1 energy)
5. OPTIONAL: Pre-Launch Checklist (non-mandatory prompts)
6. LAUNCH: agent executes queue step by step, animated
7. WATCH: each step → GREEN (success) or RED (failure + ABORT)
8. REVIEW: Mission Debrief Log shows exact failure step + reason
9. ADJUST and replan (time penalty for re-plan)
```

#### 9.1.3 Challenge Config Schema
```json
{
  "missionObjective": "Deliver package to SECTOR_C. Path requires passing through SECTOR_B.",
  "map": {
    "nodes": ["HUB", "SECTOR_B", "SECTOR_C"],
    "unknownZones": ["SECTOR_C"],
    "lockedPaths": [
      { "from": "SECTOR_B", "to": "SECTOR_C", "requiresScan": "SECTOR_C" }
    ]
  },
  "commandLibrary": [
    { "id": "MOVE", "label": "MOVE to [destination]", "energyCost": 1 },
    { "id": "SCAN", "label": "SCAN [zone]", "energyCost": 1 },
    { "id": "UNLOCK", "label": "UNLOCK path to [destination]", "energyCost": 1, "requiresScanFirst": true },
    { "id": "DELIVER", "label": "DELIVER package", "energyCost": 1, "requiresLocation": "SECTOR_C" }
  ],
  "energyBudget": 6,
  "correctPlan": ["MOVE:SECTOR_B", "SCAN:SECTOR_C", "UNLOCK:SECTOR_C", "MOVE:SECTOR_C", "DELIVER"],
  "answer": "MOVE:SECTOR_B,SCAN:SECTOR_C,UNLOCK:SECTOR_C,MOVE:SECTOR_C,DELIVER",
  "failureMessages": {
    "UNLOCK_WITHOUT_SCAN": "SECTOR_C not in agent memory. Cannot unlock unscanned zone. MISSION ABORT.",
    "MOVE_LOCKED_PATH": "Path to SECTOR_C is locked. MISSION ABORT."
  },
  "revealText": "Your agent could only act on information it had gathered through SCAN. This is the fundamental constraint of autonomous systems: they cannot act on unknown state. Plan first, then execute."
}
```

#### 9.1.4 Validation
Type: `ORDER`. Submission is comma-joined command string.
Server checks against `correctPlan` using `ORDER` validator.
Partial credit: simulate execution, count steps before abort.

#### 9.1.5 Stage Moment
Multiple drones navigate mission map simultaneously in different team colors.
ABORT events flash red with failure reason.
"MISSION ABORT — STEP 3: UNLOCK attempted without prior SCAN"

---

### 9.2 Cascade (Pipeline Builder)

**Template:** NEW (`CASCADE`)

#### 9.2.1 Challenge Config Schema
```json
{
  "objective": "Build a pipeline to process raw match data into a scoreboard display",
  "agents": [
    { "id": "PARSE", "label": "Parser", "inputFormat": "raw_text", "outputFormat": "structured_data" },
    { "id": "FILTER", "label": "Filter", "inputFormat": "structured_data", "outputFormat": "relevant_data" },
    { "id": "SORT", "label": "Sorter", "inputFormat": "relevant_data", "outputFormat": "sorted_data" },
    { "id": "FORMAT", "label": "Formatter", "inputFormat": "sorted_data", "outputFormat": "display_ready" },
    { "id": "DISPLAY", "label": "Display", "inputFormat": "display_ready", "outputFormat": "screen" }
  ],
  "correctPipeline": ["PARSE", "FILTER", "SORT", "FORMAT", "DISPLAY"],
  "answer": "PARSE,FILTER,SORT,FORMAT,DISPLAY",
  "incompatibilityMessages": {
    "PARSE,SORT": "Sorter needs relevant_data but Parser outputs structured_data. Incompatible connection.",
    "FORMAT,PARSE": "Parser needs raw_text but Formatter outputs display_ready. Incompatible."
  },
  "revealText": "Each agent required a specific input type and produced a specific output type. Connecting them in the wrong order caused a type mismatch — the same issue you get when you pass the wrong type to a function."
}
```

#### 9.2.2 Validation
Type: `ORDER`. Submission is comma-joined agent ID pipeline.

---

### 9.3 Loop Trap

**Template:** NEW (`LOOP_TRAP`)

#### 9.3.1 Core Fantasy
An agent is stuck in an infinite loop. The iteration counter is climbing.
You must identify why it won't stop, inject the minimal fix,
and verify the agent can both stop AND complete its task.

#### 9.3.2 Game Loop
```
1. OPEN log viewer (starts paused — player presses PLAY)
2. OBSERVE: what is the agent doing? What repeats?
3. SCRUB timeline: see how many iterations have run
4. SELECT a guardrail from the list (4-6 options)
5. INJECT (costs 1 credit)
6. WATCH: did the agent break the loop AND complete the task?
7. If wrong: new failure mode appears — observe and diagnose again
8. If correct: agent completes task, counter stops
```

#### 9.3.3 Challenge Config Schema
```json
{
  "agentDescription": "File cleanup agent: removes temporary files from /tmp directory",
  "log": [
    "[ 0001 ] Scanning /tmp for files...",
    "[ 0002 ] Found: cache_001.tmp",
    "[ 0003 ] Deleting cache_001.tmp...",
    "[ 0004 ] Scanning /tmp for files...",
    "[ 0005 ] Found: cache_001.tmp",
    "[ 0006 ] Deleting cache_001.tmp...",
    "[ 0007 ] Scanning /tmp for files..."
  ],
  "currentIterationCount": 847,
  "guardrails": [
    { "id": 1, "label": "After 5 failed deletes, skip to next file", "isCorrect": false, "consequence": "Agent processes first 5 files then stops — task partially complete" },
    { "id": 2, "label": "Track which files have been deleted; skip if already processed", "isCorrect": true, "consequence": "Agent processes each file exactly once — task complete" },
    { "id": 3, "label": "Print current status every 10 iterations", "isCorrect": false, "consequence": "Loop continues forever with logging added" },
    { "id": 4, "label": "Stop scanning after 10 total scans", "isCorrect": false, "consequence": "Agent stops after 10 scans — some files may remain" }
  ],
  "injectCredits": 3,
  "answer": "2",
  "revealText": "The agent deleted the file but didn't remember it had done so — finding it again on the next scan. Tracking state across iterations is what makes loops terminate correctly. This is why loops need: (1) a stopping condition, and (2) progress toward that condition."
}
```

#### 9.3.4 Validation
Type: `EXACT`. Answer is guardrail ID string.

#### 9.3.5 Scoring
```
Correct guardrail on first inject: 100% + credits remaining bonus
Correct on second inject:          70%
Wrong inject: new failure mode shown, lose 1 credit
Out of credits:                    0 points
```

#### 9.3.6 Stage Moment
Loop counter ticker live: "847 → 848 → 849 → ..."
When correct fix injected: counter stops → "LOOP TERMINATED" → task completes.
"File cleanup: 23 files processed. Agent finished."
Wrong injection: dramatic new error message appears live.

---

## 10. DATA_HUNT *(AVAILABLE — Already Implemented)*

### 10.1 Reference Implementation: Pirate Wanted Database

**Template:** `DATA_HUNT` — registered, AVAILABLE, QA-validated.

#### 10.1.1 Core Fantasy
You are a detective. The answer is in the data.
You don't write queries — you apply structured commands.
Each filter narrows the suspects. Each story beat reveals the next clue.

#### 10.1.2 Existing Challenge Config (Currently Working)
```json
{
  "clue": "Witnesses described the attacker's ship as carrying fewer than 50 crew.",
  "action": "FILTER",
  "field": "crew_size",
  "options": ["< 50", "= 50", "> 50"],
  "correct": "< 50",
  "onSuccess": "Narrowed to 11 suspects. A new clue is available..."
}
```

#### 10.1.3 Suspect Count Tracker
As filters applied → "SUSPECTS REMAINING: 20 → 11 → 4 → 1"
This number is the primary tension mechanic. Show it large on stage.

#### 10.1.4 Stage Moment
Final reveal: criminal profile shown with "CASE CLOSED" animation.
Audience watches suspect count drop in real time.

#### 10.1.5 Reskin Themes (Same Engine, Different Dataset)
- Pirates (canonical)
- Cybercrime: identify compromised account
- Lost artifact: identify stolen museum piece from shipping records
- Corporate fraud: identify anomalous transaction
- Space mission: identify target asteroid by resource signatures

---

## 11. Event Integration

### 11.1 How a Game Plugs Into the Session Engine
```
SESSION
  currentGameId → GAME
                   template → TemplateRegistry.getTemplate()
                               validationType → Validator.validate()
                               interactionType → frontend renders game UI
                               progressionType → chainProgress tracking
                   challenges[] → CHALLENGE
                                   config (JSON) → challenge-specific behavior
                                   submissions[] → SUBMISSION
                                                   answer (JSON string)
                                                   isCorrect (server-set)
                                                   score (server-calculated)
                                                   runId (replay isolation)
```

### 11.2 Submission Flow (All Games)
```
Player action
  → POST /sessions/:code/submit { challengeId, answer }
     OR socket event (if real-time feedback needed)
  → server: Validator.validate(template.validationType, { challengeConfig, submission })
  → Submission.create({ isCorrect, score, responseTime, runId })
  → getSessionState() → broadcast session_state_update to all in room
  → terminal + stage re-render simultaneously
```

### 11.3 Chain Progression (already implemented in sessionService.ts)
```
chainProgress[playerId] = currentChallengeId

On correct submission:
  → advance to next challenge in sequence
  → if no next challenge: chainProgress[entityId] = 'COMPLETED'
```

### 11.4 Rapid Fire Must Remain Configurable
`GamePurpose` enum (NORMAL, FINAL, TIE_BREAKER, BONUS) handles this.
GM sets purpose when adding game to event. No code changes needed.

---

## 12. Game Master Controls

### 12.1 Universal Controls (All Implemented)

| Control | Socket Event | Status |
|---------|-------------|--------|
| Start event | `host:change_status → STARTING` | ✅ |
| Select game | `host:select_game` | ✅ |
| Start challenge | `host:select_challenge` | ✅ |
| Pause (lock) | `host:change_status → ROUND_LOCKED` | ✅ |
| Resume | `host:change_status → ROUND_ACTIVE` | ✅ |
| Skip game | `host:skip_game` | ✅ |
| Replay game | `host:replay_game` | ✅ |
| Random game | `host:random_game` | ✅ |
| Set stage mode | `host:set_stage_mode` | ✅ |
| End event | `host:end_event` | ✅ |
| Reveal concept | `host:set_stage_mode → ANSWER_REVEAL` | ✅ |
| Show leaderboard | `host:set_stage_mode → LEADERBOARD` | ✅ |

### 12.2 Controls Needing UI Work in SessionHostPage

| Control | What's Needed |
|---------|--------------|
| Skip current challenge (mid-game) | Button to emit `host:select_challenge` with next challenge ID |
| Timer pause | UI toggle; needs server-side pause flag |
| Concept reveal per challenge | Button visible only when challenge is completed |

### 12.3 GM Philosophy
The GM dashboard should present controls as intent, not socket events:
```
[ ▶ START VAULT 3  ]  [ ⏸ PAUSE      ]  [ 🔓 REVEAL CONCEPT  ]
[ ⏭ NEXT VAULT    ]  [ 🔁 REPLAY    ]  [ 📊 SHOW LEADERBOARD ]
[ ⏩ NEXT GAME     ]  [ ⏹ END EVENT  ]
```

---

## 13. Stage / Projector Requirements

### 13.1 Existing Stage Modes (StageMode enum — all implemented)
```
LOBBY, ANNOUNCEMENT, COUNTDOWN, QUESTION, ANSWER_REVEAL,
LEADERBOARD, TEAM_LEADERBOARD, FINAL_RESULTS, PAUSED, BLANK
```

### 13.2 Per-Game Stage Elements

| Game | Key Stage Elements |
|------|-------------------|
| Logic Heist | Player alert levels, vault door animation, story reveal on open |
| Dead Code | Bug board per team (status labels), patch verification replay |
| Data Hunt | Suspect count (large, live), story narrative, criminal profile reveal |
| The Witness | Question budget countdown, typewriter response, post-game efficiency |
| Rogue Scanner | Classification grid, contaminated feature highlight, corrected replay |
| Silent Mission | Mission map, multi-drone animation, abort failure labels |
| Cascade | Pipeline diagrams, data flow particles, compatibility indicators |
| Loop Trap | Iteration counter (live climbing), guardrail injection, counter stop |
| Assembly Line | Conveyor belt per team, live accuracy meter |

### 13.3 Stage Is NOT a Terminal Mirror
Stage shows: status, drama, narrative, results.
Stage does NOT show: player's in-progress answer, internal config, admin tools.

---

## 14. Terminal Requirements

### 14.1 Rendering Architecture
```tsx
// PlayPage.tsx — game dispatcher
const game = sessionData.currentGame;
switch (game.template) {
  case 'LOGIC_HEIST':    return <LogicHeistChallenge ... />;
  case 'BUG_HUNT':       return <BugHuntChallenge ... />;
  case 'DATA_HUNT':      return <DataHuntChallenge ... />;
  case 'LOOP_TRAP':      return <LoopTrapChallenge ... />;
  case 'THE_WITNESS':    return <WitnessChallenge ... />;
  case 'ROGUE_SCANNER':  return <RogueScannerChallenge ... />;
  case 'SILENT_MISSION': return <SilentMissionChallenge ... />;
  case 'CASCADE':        return <CascadeChallenge ... />;
  default:               return <QuizChallenge ... />;
}
```

### 14.2 Universal Terminal Elements (Every Game)
Every challenge must display:
- Challenge name / mission title
- Time remaining
- Current player score (this session)
- Brief narrative context (1–2 lines)
- Input area appropriate to the interaction type

---

## 15. Scoring Architecture

### 15.1 Current State (sessions.ts submit route)
```
score = isCorrect ? challenge.points : 0
```
Speed bonus, streak — declared in templates but NOT implemented in route.

### 15.2 Phase 8 Required: Scoring Refinement

```typescript
// In sessions.ts submit handler — after isCorrect determined:

const basePoints = challenge.points;
const timeElapsed = Date.now() - session.challengeStartTime.getTime();
const timeLimitMs = challenge.timeLimit * 1000;
const timeRemaining = Math.max(0, timeLimitMs - timeElapsed);

let score = isCorrect ? basePoints : 0;

if (isCorrect) {
  // Speed bonus: +30% if solved in first half of time window
  if (currentGame.speedBonus && timeRemaining > timeLimitMs / 2) {
    score = Math.floor(score * 1.3);
  }

  // Streak bonus: +10% per consecutive correct, max +50%
  if (template.scoringConfig.streak) {
    const recentSubs = await prisma.submission.findMany({
      where: { playerId: sessionPlayer.id, sessionId: session.id },
      orderBy: { submittedAt: 'desc' },
      take: 5
    });
    const streak = recentSubs.filter(s => s.isCorrect).length;
    score = Math.floor(score * Math.min(1 + streak * 0.1, 1.5));
  }

  // Efficiency bonus (Logic Heist, Loop Trap, The Witness)
  // Parsed from answer metadata if provided
  if (parsedAnswer?.hintsUsed) {
    score = Math.floor(score * (1 - parsedAnswer.hintsUsed * 0.2));
  }
  if (parsedAnswer?.budgetRemaining && parsedAnswer?.budgetTotal) {
    const bonusFraction = parsedAnswer.budgetRemaining / parsedAnswer.budgetTotal;
    score = Math.floor(score * (1 + bonusFraction * 0.3));
  }
}
```

### 15.3 Per-Game Scoring Summary

| Game | Base | Speed | Streak | Efficiency | Penalties |
|------|------|-------|--------|------------|-----------|
| Logic Heist | ✅ | ✅ | — | ✅ (blocks used) | ✅ (alert tiers, hints) |
| Dead Code | ✅ | ✅ | — | — | ✅ (hints) |
| Data Hunt | ✅ | ✅ | — | — | — |
| The Witness | ✅ | — | — | ✅ (budget remaining) | — |
| Rogue Scanner | ✅ | — | — | ✅ (fewer tests) | — |
| Silent Mission | ✅ | — | — | — | ✅ (re-plan) |
| Loop Trap | ✅ | — | — | ✅ (credits remaining) | — |
| Rapid Fire | ✅ | ✅ | ✅ | — | — |
| Quiz | ✅ | ✅ | — | — | — |

---

## 16. Difficulty Scaling

### 16.1 Difficulty Is Per-Challenge
`Challenge.difficulty` → EASY / MEDIUM / HARD.
Frontend can show as a visual indicator.
Scoring can apply: EASY = 1.0×, MEDIUM = 1.25×, HARD = 1.5×.

### 16.2 Scaling Dimensions

| Dimension | Easy | Medium | Hard |
|-----------|------|--------|------|
| State variables | 1 | 1-2 | 2-3 |
| Available blocks/options | 3-4 | 5-6 | 7-8 |
| Decoys / noise | 0 | 1 | 2-3 |
| Information given | Full | Partial | Minimal |
| Time | Generous | Standard | Tight |
| Edge cases | 0 | 1 | 2-3 |
| Interdependencies | None | 1 | Multiple |

**Key principle:** Difficulty increases through more state, fewer clues,
more interacting rules — NOT through harder terminology.

---

## 17. Replayability

### 17.1 Configuration-Driven Content
All games are powered by `Challenge.config` JSON authored by GMs.
The same template can run infinite variants with different data.
Logic Heist vaults, Data Hunt datasets, Rogue Scanner scenarios
can all be swapped without touching code.

### 17.2 Session Replay
`host:replay_game` → `currentRun++` → fresh submission window.
Previous submissions preserved via `runId`. Scores accumulate.
Same game can run twice in one event with clean scoring.

---

## 18. QA Requirements

### 18.1 Universal QA (All Games)

| Scenario | Expected Behavior |
|----------|------------------|
| Happy path | Submission accepted, score awarded, chain advances |
| Wrong answer | isCorrect: false, 0 score, failure mechanic triggered |
| Invalid JSON in answer | Server parses with try/catch, no crash, returns isCorrect: false |
| Timeout | Status → QUESTION_LOCKED, partial points if applicable |
| Duplicate submission | DB unique constraint `[sessionId, challengeId, playerId, runId]` prevents double-score |
| Player reconnects | `player:join` triggers `session_state_update` → full state re-sync |
| Player leaves | Status → DISCONNECTED, scores preserved |
| GM skips | Next game selected, current state abandoned gracefully |
| GM replays | `currentRun++`, fresh submission window, old scores intact |
| Session ends | Status → ENDED, final results broadcast |
| Multiple players | Leaderboard updates per submission (no race condition in DB) |
| Multiple teams | `chainProgress` per teamId, not per playerId |
| Stage sync | Same `session_state_update` event hits stage socket |
| Terminal sync | Same event triggers re-render on all terminals |

### 18.2 Logic Heist-Specific QA

| Scenario | Expected |
|----------|---------|
| Correct sequence | finalState matches targetState → vault opens |
| Wrong sequence | Alert tier++, ghost trace shows divergence point |
| Decoy block changes state | Wrong final state → fail correctly |
| BREACH with 0 blocks | Server rejects as invalid |
| DRY RUN without BREACH | No submission created |
| Same wrong sequence twice | Alert Tier 2 fires |
| Alert Tier 3 | Variable reset + stage red flash |
| Hint used | 20% deducted from score per hint |
| All vaults complete | chainProgress → COMPLETED |
| GM skips active vault | Next vault activates, current abandoned |

---

## 19. Implementation Dependencies

### 19.1 Ready — Use As-Is
- ✅ Event → Session → Game → Challenge → Submission → Score pipeline
- ✅ All socket handlers (join, select_game, select_challenge, change_status, skip, replay, random, end, set_stage_mode)
- ✅ `DATA_HUNT` (AVAILABLE, fully functional)
- ✅ `RAPID_FIRE` — usable as NORMAL / FINAL / TIE_BREAKER
- ✅ `QUIZ`, `CHAIN_REACTION`
- ✅ Leaderboard calculation in `sessionService.ts`
- ✅ `chainProgress` tracking in `sessionService.ts`
- ✅ `runId` replay isolation on `Submission`
- ✅ `GamePurpose` enum (NORMAL, FINAL, TIE_BREAKER, BONUS)
- ✅ `stageMode` control + all StageMode values

### 19.2 Needs Existing System Extension

| Item | File | Effort |
|------|------|--------|
| Expose `STATE_MATCH` as ValidationType | `types.ts` (add to union) + `Validator.ts` (add case) | 30 min |
| Speed bonus in submit route | `server/src/routes/sessions.ts` | 2 hours |
| Streak bonus in submit route | `server/src/routes/sessions.ts` | 1 hour |
| `metadata Json?` field on Submission | `schema.prisma` | 30 min + db push |
| New `GameTemplate` enum values | `schema.prisma` + `TemplateRegistry.ts` + `client/src/types/index.ts` | 30 min per game |
| GM "skip challenge" button | `SessionHostPage.tsx` | 1 hour |

### 19.3 Needs New Backend

| Item | Where | Effort |
|------|-------|--------|
| Logic Heist block sequence executor | `engine/simulators/LogicHeistSimulator.ts` | 3-4 days |
| Rogue Scanner test console API | `POST /sessions/:code/test-input` | 2 days |
| Dead Code test console API | Same endpoint, different payload | 1 day |
| Silent Mission plan executor | `engine/simulators/SilentMissionExecutor.ts` | 3-4 days |

### 19.4 Needs New Frontend

| Item | Where | Effort |
|------|-------|--------|
| Logic Heist block sequencer | `LogicHeistChallenge.tsx` | 3-4 days |
| Execution trace animation | Component in above | 2 days |
| Logic Heist stage panel | `StagePage.tsx` (LOGIC_HEIST branch) | 1-2 days |
| Loop Trap log viewer + inject controls | `LoopTrapChallenge.tsx` | 2-3 days |
| The Witness evidence board + question builder | `WitnessChallenge.tsx` | 3-4 days |
| Dead Code test console | `BugHuntChallenge.tsx` | 3 days |
| Rogue Scanner test console | `RogueScannerChallenge.tsx` | 3 days |
| Silent Mission drag-to-queue + map | `SilentMissionChallenge.tsx` | 4-5 days |
| Cascade pipeline visualizer | `CascadeChallenge.tsx` | 3-4 days |
| Assembly Line conveyor + rule builder | `AssemblyLineChallenge.tsx` | 3-4 days |
| Challenge editor forms for complex games | `GameEditorPage.tsx` new editors | 1-2 days per game |

### 19.5 Needs Schema Changes

| Change | Effort |
|--------|--------|
| New `GameTemplate` enum values (LOOP_TRAP, THE_WITNESS, ROGUE_SCANNER, SILENT_MISSION, CASCADE, SIGNAL_ROUTER, ASSEMBLY_LINE, DEAD_SIGNAL, THE_THRESHOLD, THE_CLASSIFIER, THE_CURATOR) | 30 min + `npx prisma db push` |
| `metadata Json?` on Submission | 15 min + db push |

> **Reminder:** Kill dev server before running `npx prisma generate`.
> Run `npx prisma db push` after any schema change.

### 19.6 Architectural Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| `stateTransition` is private | Logic Heist cannot use STATE_MATCH validation until this method is exposed in the Validator switch. This is a **blocking issue** for Logic Heist. | Fix first, before any other Logic Heist work. 5-minute change. |
| Answer is `String` | All complex game answers must be JSON-serialized into this single field. Malformed JSON causes silent validation failure. | Always wrap server-side JSON.parse in try/catch. Never let parse failure crash the route. |
| No game-specific socket events | Test console, guardrail inject, dry run — none of these have dedicated socket events. | Implement as metadata in the standard submit payload (`{ answer, metadata: { action: 'DRY_RUN' } }`). Keeps socket layer generic. |
| `chainProgress` query scales poorly | All submissions queried for every state update. With 200 players and 50 challenges this becomes expensive. | Add DB index on `(sessionId, isCorrect, runId)`. Acceptable for current scale. |
| Timer is client-side | Client shows a countdown. Server doesn't enforce it for non-Rapid-Fire games. | Acceptable for college event scale. Server authoritative timer is a future enhancement. |

---

## 20. Recommended Implementation Order

### Phase 8, Week 1–2: Logic Heist Vertical Slice
1. Expose `STATE_MATCH` in `Validator.ts` (30 min — **do this first**)
2. Implement speed bonus + streak bonus in submit route (3 hours)
3. Add `metadata` field to Submission schema + db push (1 hour)
4. Build Logic Heist block sequencer UI + trace animation (5-7 days)
5. Build Logic Heist stage panel (2 days)
6. Author 3 vault challenges in GameEditorPage (1 day)

**Milestone:** Logic Heist playable end-to-end with full scoring.

### Phase 8, Week 3–4: First New Game + Data Hunt Verification
7. Verify Data Hunt renders correctly in PlayPage — fix any gaps (1 day)
8. Add `LOOP_TRAP` to schema + TemplateRegistry + client types (1 hour)
9. Build Loop Trap frontend (log viewer + guardrail select) (3 days)
10. Build Loop Trap stage panel (1 day)

**Milestone:** Three games fully playable — Logic Heist, Data Hunt, Loop Trap

### Phase 8, Week 5–6: Investigation Games
11. Dead Code / Bug Hunt (test console + hypothesis flow) (5 days)
12. The Witness (evidence board + question builder) (5 days)

**Milestone:** Five games — adds CODENEX debugging + LANGNET detective

### Phase 9: Advanced Games
13. Rogue Scanner (5-6 days)
14. Silent Mission (5-6 days)
15. Cascade (4-5 days)
16. Assembly Line (4-5 days)

### Phase 10+: Stretch
Signal Router, The Threshold, The Classifier, The Curator, Compression, Emergence

---

## Implementation Readiness Report

### READY — No Changes Needed
- Complete session engine (Event → Session → Challenge → Submission → Score)
- All GM socket controls
- DATA_HUNT (AVAILABLE, working)
- RAPID_FIRE as normal/final/tiebreaker via GamePurpose
- chainProgress tracking (Chain games)
- runId replay isolation
- Leaderboard calculation
- Stage mode control

### NEEDS EXISTING SYSTEM — Extend, Not Replace
- STATE_MATCH ValidationType → expose `stateTransition` in Validator switch
- Speed + streak bonus → implement in sessions.ts submit route
- Submission `metadata` field → schema.prisma addition
- New GameTemplate enum values → schema.prisma + TemplateRegistry + client types
- GM "skip challenge" button → SessionHostPage UI addition

### NEEDS NEW BACKEND
- Logic Heist block execution simulator (server validates sequence execution)
- Test console API endpoint (Rogue Scanner, Dead Code)
- Silent Mission plan executor (server simulates agent plan)

### NEEDS NEW FRONTEND
- Logic Heist block sequencer with drag-and-drop + trace animation
- Loop Trap log viewer + guardrail injection UI
- The Witness evidence board + question builder
- Dead Code test console
- Rogue Scanner test console
- Silent Mission command queue + map
- Cascade pipeline visualizer
- Assembly Line conveyor + rule builder
- Stage panels per game in StagePage
- Challenge editor forms for complex games

### NEEDS SCHEMA CHANGE
- GameTemplate enum: 11 new values
- Submission.metadata: Json? field
- Run `npx prisma db push` after each addition
- Kill dev server before `npx prisma generate`

### ARCHITECTURAL RISK
- **BLOCKING:** `Validator.stateTransition` is private — must be exposed before Logic Heist can validate. Fix before any other Logic Heist work.
- **MEDIUM:** Answer as plain String — JSON parse errors silently fail validation. Wrap all CUSTOM parsers in try/catch.
- **LOW:** No game-specific socket events — use metadata in submit payload for game actions (dry run, test console, guardrail inject).

### FIRST BUILD: Logic Heist Vertical Slice
Single vault (Vault 1 — sequencing, no decoys):
1. Author challenge in GameEditorPage
2. Block sequencer renders in PlayPage LOGIC_HEIST branch
3. BREACH submits block order as JSON → STATE_MATCH validator
4. Execution trace animation plays on terminal
5. Vault door opens on stage
6. GM concept reveal via ANSWER_REVEAL stage mode
7. Speed bonus applied to score

This vertical slice proves the full concept. All subsequent games are variations.

---

## 4. THE_WITNESS — Mechanics & Implementation Spec [QA-VALIDATED]

### 4.1 Concept & Pedagogy
- **Core Concept:** Binary search, partition balance, and information gain discovered intuitively through forensic deduction.
- **Pedagogical Rule:** No mathematical lecture (Shannon entropy, log2 N) during the core gameplay loop. Students experience the value of balanced questions naturally.
- **Player Perspective:** An investigator with a limited question budget (e.g. 5 questions) attempting to identify a single culprit among 6–8 suspects.

### 4.2 Vertical Slice Architecture
1. **Template & Challenge Registration:**
   - Template: `THE_WITNESS` (Status: `AVAILABLE` in `TemplateRegistry.ts`).
   - Challenge Type: `INTERROGATION`.
2. **Server-Authoritative Inquiries:**
   - `POST /api/sessions/:code/witness-preview`: Returns live candidate split (`YES: X | NO: Y`) without consuming budget.
   - `POST /api/sessions/:code/witness-query`: Server checks condition against secret culprit, consumes 1 question token, returns affirmative/negative detective narrative, and eliminates contradictory suspects.
   - `GET /api/sessions/:code/witness-state`: Restores authoritative inquiries, question budget, active suspects, and eliminated candidates upon reconnect.
3. **Evidence Board & Final Accusation:**
   - Suspect dossier cards show live status (Active vs. Exonerated).
   - Accusation warrant submitted via standard `POST /api/sessions/active/submit` (`accusedSuspectId`).
   - If questions reach 0, player can still make a final accusation.
4. **Scoring Formula:**
   - `Points = Base (100) + (QuestionsRemaining * 20) + EfficiencyBonus (15% if avg suspect reduction >= 35%)`.
5. **Stage Spectator View:**
   - Shows case overview, active vs eliminated counts across investigators, and recent testimony feed without leaking hidden culprits.
6. **Post-Game Learning:**
   - "WHAT YOU JUST DID" debrief explains how balanced splits eliminate half the suspects with each query.

---

## 5. ROGUE_SCANNER — Mechanics & Design Spec (AIERA Club) [DESIGN REFINED // READY FOR IMPLEMENTATION]

> Full game design document available at [`docs/ROGUE_SCANNER_GAME_DESIGN.md`](./ROGUE_SCANNER_GAME_DESIGN.md).

### 5.1 Concept & Pedagogy
- **Core Concept:** Anomaly detection, baseline profiling, multi-variable correlation, and false-positive discrimination.
- **Beginner-First Principle:** Zero machine learning equations, statistics, or cybersecurity prerequisites. Technical fields are in-universe flavor. The player's intuitive mental model: *"Something behaves differently from the established normal pattern."*
- **Player Perspective:** An AIERA Telemetry Analyst inspecting 22 cluster events on the *Prometheus Grid* with an action budget of 10 diagnostic probes.

### 5.2 Refined Key Mechanics
1. **Correlation as the Core Mechanic:** The rogue signal cannot be found from one extreme number. It is an ensemble of individually subtle signals (low payload + mechanical cadence + unmapped destination) that together prove automated beaconing.
2. **The "Pattern Overlay" Tool:** Player selects 2 to 4 events to visually overlay their timelines, durations, and routes. Highlights exact timestamp deltas ($\Delta t = 600.00s$) and identical sizes, producing the signature "Aha!" moment: *"Wait... these events are behaving almost exactly the same."*
3. **Curated 22-Event Vertical Slice:** 17 normal events (~77%), 3 seductive false positives (~14%), and 2 correlated rogue beacon events (~9%).
4. **Deliberate False Positive Traps:** 
   - `EVT-08`: 92 GB data spike (scheduled nightly backup).
   - `EVT-14`: Multiple 403 Denied errors (routine node reboot with transient token expiration).
   - `EVT-19`: 12.4s latency hang (local GPU JIT compilation warmup).
   - *Result:* The player investigates context before accusing, learning that high variance $\neq$ malicious.
5. **Configurable Scoring:** Base reward (100) + Corroboration bonus (+30) + Probe conservation (+10/token) + Clean sheet bonus (+20) - Incorrect accusation penalty (-40).
6. **Player Journey:** Observe $\rightarrow$ Notice obvious spike $\rightarrow$ Investigate $\rightarrow$ Get misled $\rightarrow$ Compare baselines $\rightarrow$ Pattern Overlay discovery $\rightarrow$ Verify provenance $\rightarrow$ Accuse.



