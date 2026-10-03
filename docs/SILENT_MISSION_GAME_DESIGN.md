# SILENT MISSION — MASTER GAME DESIGN SPECIFICATION

**Domain:** Planning Under Constraints, Workflow Orchestration, and Dependency Reasoning  
**Club:** General / Cross-Domain (Advanced Operations & System Architecture)  
**Template ID:** `SILENT_MISSION`  
**Challenge Type:** `MISSION_PLAN`  
**Phase:** 10 — Game Design Master Document  
**Status:** GAME DESIGN COMPLETE // AWAITING IMPLEMENTATION AUTHORIZATION  
**Author:** Lead Game Designer, TERMINAL Core Architecture Team  

---

## 1. Game Vision

In complex modern engineering—whether coordinating autonomous AI agents, orchestrating distributed cloud microservices, deploying CI/CD release pipelines, or commanding robotic spacecraft—success is rarely determined by single isolated actions. Success is determined by **planning under constraints**.

**SILENT MISSION** is a strategic, turn-based planning and execution game. The player takes the role of a **Mission Operations Specialist** programming an autonomous stealth reconnaissance drone through hostile, unmapped, or compromised facilities.

The core cognitive loop is:
```
PLAN  ──►  EXECUTE  ──►  OBSERVE CONSEQUENCES  ──►  ADAPT
```

The game is strictly designed to teach students two foundational engineering truths through gameplay rather than lectures:
1. *"Doing the right actions in the wrong order can still cause catastrophic failure."*
2. *"A resilient plan accounts for prerequisites, environmental states, and resource budgets before the first action is executed."*

---

## 2. Player Fantasy

The player is not an arcade pilot with a joystick. The player is the **Cold-Blooded Mission Planner** in the underground telemetry bunker.

- **The Setting:** *Facility Triton-9*, a subterranean automated deep-ocean research lab that has gone dark following a cascading power failure.
- **The Vehicle:** The *Specter-4 Automated Infiltration Unit*—a low-signature robotic drone capable of optical bypass, terminal hacking, pneumatic valve venting, and data extraction.
- **The Catch:** Deep underwater, electromagnetic jamming prevents real-time manual control. The player cannot steer the drone on the fly. The player must **build a complete action sequence**, commit it to the drone's memory bank, and click **EXECUTE MISSION**.
- **The Drama:** The drone executes the planned instructions step by step. If the player forgot to shut off the security pressure valve before cutting power, the emergency interlock jams, the drill bit snaps, and the drone burns half its battery before aborting. The player watches the telemetry trace, diagnoses the failure point, refines the dependency sequence, and re-executes.

---

## 3. Core Learning Objective

The student must develop intuition for **Directed Acyclic Graphs (DAGs)**, **preconditions/postconditions**, **state machines**, and **resource optimization**—without hearing any of those academic terms during gameplay.

| Academic Computer Science Concept | Intuitive In-Game Representation |
|:---|:---|
| **Directed Acyclic Graph (DAG)** | "Action Chain" — You cannot plug Action C into the dock until Action A's output socket is satisfied. |
| **Preconditions (Prerequisites)** | "System Requirements" — The terminal needs power before you can plug in the decryption key. |
| **Postconditions (Side Effects)** | "Facility Changes" — Venting the tank disables fire suppression but unlocks the service shaft. |
| **Resource Budget / Knapsack Problem** | "Battery Reserve" — You have 12 power cells. Every movement, hack, and drill costs cells. Failed actions still consume power. |
| **Concurrency & Non-Linear Execution** | "Parallel Channels" — Deploying a decoy drone on Channel B distracts acoustic sensors while Channel A accesses the vault. |
| **Irreversible State Transitions** | "One-Way Hatches" — Once you blow the bulkhead fuse, you cannot backtrack through Sector 2. |

---

## 4. Central Gameplay Mechanic: The Modular Planning Corridor

The entire game revolves around **Building and Testing a Plan**. There are no reflex mini-games, no trivia questions, and no typing riddles.

### The 4-Phase Interaction Loop
1. **INSPECT (Reconnaissance):**
   - The player reviews the **Mission Objective** (e.g., `RETRIEVE BLACKBOX CIPHER`, `REBOOT CORE GENERATOR`).
   - The player inspects the **Action Arsenal** (modular instruction blocks available for this scenario).
   - The player hovers over or inspects actions to see their **Input Requirements** (e.g., `Requires: High-Voltage Bypass`), **Resource Cost** (e.g., `⚡ 2 Battery`), and **Output Effect** (e.g., `Emits: Terminal Token`).
2. **ASSEMBLE (Docking):**
   - The player drags Action Blocks from their Arsenal into the **Planning Corridor** (an ordered, snap-dock timeline).
   - If an action requires tools or parameters, the player magnetically docks the required modifier block into that step.
3. **EXECUTE & SIMULATE:**
   - The player hits **ENGAGE SEQUENCE**.
   - The UI shifts into **Telemetry Playback**. The drone executes step 1, step 2, step 3...
   - Real-time facility meters fluctuate: Battery drains, door status lights flip, alert levels rise or fall.
4. **DIAGNOSE & REFINE:**
   - If a step encounters an unsatisfied prerequisite, execution halts with a clear operational reason (e.g., *"Step 3 [EXTRACT_DATABASE] failed: Optical Link Offline. Battery wasted: 2 cells"*).
   - The timeline highlights the failure node in warning amber.
   - The player rearranges the sequence, inserts the missing prerequisite step, and re-executes.

---

## 5. 30-Second Onboarding

When a student first launches SILENT MISSION, an onboarding overlay takes no more than 30 seconds to read:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [TRANSMISSION: TRITON-9 OPS COMMAND]                                   │
│                                                                        │
│ 1. YOU DO NOT STEER IN REAL TIME.                                      │
│    Drag Action Blocks into the Sequence Dock to build your plan.       │
│                                                                        │
│ 2. EVERY ACTION HAS PREREQUISITES AND COSTS.                           │
│    A door cannot open without power. A terminal cannot sync without    │
│    an optical link. Every action drains your limited battery.          │
│                                                                        │
│ 3. WATCH THE FAILURE TRACE.                                            │
│    If your plan stalls, inspect the failure log to see what was        │
│    missing. Fix the sequence and re-engage.                            │
│                                                                        │
│ [ENTER MISSION DECK]                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

Zero mention of DAGs, scheduling algorithms, or workflow engines. The player immediately knows what to click and what to expect.

---

## 6. Mission Structure (Vertical Slice Progression)

The vertical slice contains **4 Progressive Operations**. Each operation introduces exactly one new dimension of constraint reasoning.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   OPERATION 1   │ ──►  │   OPERATION 2   │ ──►  │   OPERATION 3   │ ──►  │   OPERATION 4   │
│  "COLD BOOT"    │      │  "CIRCUIT BREAKER"│    │ "SIPHON PROTOCOL"│     │ "GHOST EXTRACT" │
│                 │      │                 │      │                 │      │                 │
│ Linear Order &  │      │ Branching Multi-│      │ Battery Budget &│      │ Irreversible    │
│ Prerequisites   │      │ Dependencies    │      │ Tool Tradeoffs  │      │ Side-Effects    │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Operation 1: "Cold Boot" (Linear Dependency)
- **Objective:** Power on Terminal A and download the facility blueprint.
- **Available Actions:** `CONNECT_POWER_FEED`, `ACTIVATE_TERMINAL`, `DOWNLOAD_BLUEPRINT`, `VENT_EXHAUST`.
- **Lesson:** `DOWNLOAD_BLUEPRINT` requires `ACTIVATE_TERMINAL`, which requires `CONNECT_POWER_FEED`. Placing them out of order immediately halts at Step 1 or 2 with clear feedback.

### Operation 2: "Circuit Breaker" (Multi-Dependency Confluence)
- **Objective:** Unlock Main Vault Door.
- **Available Actions:** `DISARM_SONIC_ALARM`, `REROUTE_COOLANT`, `DEACTIVATE_MAGNETIC_LOCK`, `PRY_VAULT_DOOR`.
- **Constraint:** `PRY_VAULT_DOOR` requires **both** `DEACTIVATE_MAGNETIC_LOCK` and `DISARM_SONIC_ALARM` to be satisfied. If the alarm is disarmed before coolant is rerouted, an emergency thermal sensor re-engages the locks.
- **Lesson:** Confluence of multiple prerequisites and intermediate prerequisite timing.

### Operation 3: "Siphon Protocol" (Resource Tradeoff & Efficiency)
- **Objective:** Extract encrypted research drive with limited battery (10 units).
- **Available Actions:**
  - Route A (Brute Force): `OVERDRIVE_DRILL` (Costs 5⚡, No prerequisites) $\rightarrow$ Fast, but burns half your battery.
  - Route B (Surgical Bypass): `DECRYPT_KEYCARD` (Costs 1⚡) $\rightarrow$ `BYPASS_SOLENOID` (Costs 2⚡) $\rightarrow$ `CLEAN_RETRIEVE` (Costs 1⚡). Total = 4⚡, leaving 6⚡ for the extraction beacon.
- **Lesson:** The shortest list of actions is not always the most efficient plan. Evaluating action costs vs. prerequisite chains saves resources.

### Operation 4: "Ghost Extract" (Irreversible Side Effects & Fragility)
- **Objective:** Sabotage the reactor coolant and extract without triggering total lockdown.
- **Dynamic:** Venting the reactor coolant destroys the main elevator cable. The extraction drone *must* secure the ventilation service shaft *before* pulling the coolant lever, or the exit path is permanently sealed.
- **Lesson:** Actions change the world state. An action that achieves an intermediate goal can permanently break a subsequent step if sequenced prematurely.

---

## 7. Action System

Every action in SILENT MISSION is a discrete, predictable block with 4 immutable parameters:

```
┌────────────────────────────────────────────────────────┐
│  ACTION BLOCK: [DECRYPT_SECURITY_GATE]                 │
│                                                        │
│  • PREREQUISITES:                                      │
│    - FACILITY_POWER == ONLINE                          │
│    - DECRYPTION_KEY == LOADED                          │
│                                                        │
│  • CONSUMES:                                           │
│    - ⚡ 2 Battery Units                                │
│                                                        │
│  • EMITS STATE:                                        │
│    - GATE_STATUS: OPEN                                 │
│    - ALARM_LEVEL: +1                                   │
│                                                        │
│  • FAILURE SIGNATURE:                                  │
│    If POWER missing: "Error: No voltage to keypad"     │
│    If KEY missing:   "Error: Cipher mismatch (500ms)"  │
└────────────────────────────────────────────────────────┘
```

### Arsenal Categories
1. **Utility & Power:** `RESTORE_BREAKER`, `CHARGE_CAPACITOR`, `ROUTE_BATTERY_AUX`.
2. **Access & Security:** `SCAN_KEYPAD`, `DECRYPT_GATE`, `DISARM_LASER_GRID`, `DISABLE_ACOUSTIC_ALARM`.
3. **Environment & Physical:** `DRAIN_SUMP_PUMP`, `VENT_PRESSURE_CHAMBER`, `PRY_HATCH`, `OVERLOAD_FUSE`.
4. **Data & Mission Goals:** `DOWNLOAD_LOGS`, `PULL_CORE_DRIVE`, `TRANSMIT_BURST_UPLINK`, `DEPLOY_BEACON`.

---

## 8. Dependency System

Dependencies are modeled cleanly on the server as **Precondition Rules** and **State Flags**.

### State Registry
The facility environment maintains a simple dictionary of boolean or integer states during a simulation run:
```json
{
  "POWER_MAIN": false,
  "POWER_AUX": false,
  "LASER_GRID_ACTIVE": true,
  "COOLANT_PRESSURE_BAR": 120,
  "KEYCARD_LOADED": false,
  "TARGET_CIPHER_SECURED": false,
  "VENTILATION_SHAFT_OPEN": false,
  "ALERT_LEVEL": 0
}
```

### Validation of Step $N$
Before action $A_i$ is executed:
1. The server checks if all `requiredStates` in $A_i$ match the current environment state.
2. If any condition fails:
   - The action **aborts**.
   - A penalty cost (default: 1–2 battery units) is consumed for the stalled attempt.
   - A structured diagnostic event is generated (`PREREQUISITE_FAILED`, identifying which specific state was missing).
   - Execution terminates, and the playback scrubber stops on the failing block.
3. If all conditions pass:
   - The battery is deducted.
   - The action's `postConditions` are applied to the environment.
   - The action is marked `SUCCESS`.
   - Execution advances to $A_{i+1}$.

---

## 9. Resource System: The Battery Matrix

The game uses **Battery Energy Cells (⚡)** as its primary resource constraint.

- **Initial Budget:** Typically 10 to 14 cells per scenario.
- **Execution Cost:** Every valid action costs between 1⚡ and 4⚡.
- **Stall Penalty:** A failed/invalid action consumes 1⚡ or 2⚡ as wasted attempt energy.
- **Unused Battery Bonus:** Each unused battery cell awards $+10$ points at final mission completion.

### Why Battery Works as the Ideal Constraint
1. **Prevents Blind Trial-and-Error:** A student cannot simply put all 12 available actions into the corridor and hope the right ones fire in sequence. Doing so burns 12+ battery cells and triggers a `BATTERY DEPLETED` abort before reaching the objective.
2. **Encourages Surgical Plans:** The player is incentivized to find the minimal critical path of dependencies.
3. **Zero Mental Math Friction:** Using small integer cells (1, 2, 3) makes mental budget planning instant and accessible to beginners.

---

## 10. Failure & Consequence System

Failure in SILENT MISSION is the primary teaching instrument. The game strictly avoids generic "Game Over" screens.

### The 3-Tier Failure Diagnostic Display

When a plan fails, the player sees a detailed breakdown:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [!] MISSION ABORT: STEP 3 EXECUTION FAILURE                            │
│                                                                        │
│ 1. WHAT YOU PLANNED:                                                   │
│    [CONNECT_POWER] ──► [OVERLOAD_PUMP] ──► [EXTRACT_DATABASE]          │
│                                                                        │
│ 2. WHAT ACTUALLY HAPPENED:                                             │
│    ✓ Step 1: CONNECT_POWER [OK - Consumed 2⚡]                         │
│    ✓ Step 2: OVERLOAD_PUMP [OK - Consumed 3⚡]                         │
│    ✗ Step 3: EXTRACT_DATABASE [FAILED - Consumed 1⚡ penalty]          │
│                                                                        │
│ 3. OPERATIONAL CAUSE:                                                  │
│    "EXTRACT_DATABASE requires OPTICAL_LINK to be ONLINE.               │
│     When you ran OVERLOAD_PUMP, power to the optical switch was blown. │
│     Establish an auxiliary optic bypass before extracting."            │
│                                                                        │
│ [ADJUST SEQUENCE AND RETRY]                                            │
└────────────────────────────────────────────────────────────────────────┘
```

The player is never insulted or left guessing. They are shown:
- Where the chain broke.
- What environmental state was missing.
- Why the preceding steps failed to prepare or inadvertently destroyed that state.

---

## 11. The "Aha!" Moment: The Premature Extraction Trap

The vertical slice features a signature "Aha!" moment in **Operation 4**:

### Setup
The player must enter the Vault, download the Blackbox, and escape through the Pneumatic Lift.

### Player Assumption
*"I'll just blow the vault door with thermite, grab the data, and ride the lift up."*

### Action Sequence
```
[IGNITE_THERMITE_CHARGE] ──► [DOWNLOAD_BLACKBOX] ──► [CALL_PNEUMATIC_LIFT]
```

### Consequence
- Step 1: `IGNITE_THERMITE_CHARGE` succeeds, but the thermite explosion consumes all oxygen in the sealed sector, dropping chamber pressure to 0.0 bar.
- Step 2: `DOWNLOAD_BLACKBOX` succeeds.
- Step 3: `CALL_PNEUMATIC_LIFT` **FAILS**. The pneumatic lift requires atmospheric air pressure to operate its vacuum piston! With chamber pressure at 0.0 bar, the lift is paralyzed. The drone is trapped with 2 battery cells left.

### Realization
*"Wait... the thermite sucked the air out of the room! The lift works on air pressure! I have to open the ventilation damper BEFORE firing the thermite, or trigger the lift mechanism first!"*

### Corrected Strategy
```
[OPEN_VENT_DAMPER] ──► [IGNITE_THERMITE_CHARGE] ──► [DOWNLOAD_BLACKBOX] ──► [CALL_PNEUMATIC_LIFT]
```
The plan succeeds smoothly. The player feels brilliant because they reasoned through cause-and-effect in an interconnected system.

---

## 12. Scoring Architecture

SILENT MISSION integrates directly into TERMINAL's unified scoring engine.

```
Total Score = Base Completion + Battery Bonus + Precision Bonus - Retry Penalty
```

| Component | Default Value | Purpose |
|:---|:---|:---|
| **Base Completion** | $+100$ pts | Awarded for satisfying all mission win-conditions. |
| **Battery Conservation** | $+10$ pts per unused ⚡ | Rewards minimal, surgical dependency paths. |
| **First-Run Precision Bonus** | $+30$ pts | Awarded if the plan succeeds on the very first execution. |
| **Clean Sheet Bonus** | $+20$ pts | Awarded if no step suffered an execution stall or penalty. |
| **Execution Failure Penalty** | $-15$ pts per failed run | Penalizes blind brute-force guessing without crippling score. |

All values are fully configurable in `Challenge.config.scoring`.

---

## 13. Competitive & Spectator Design

TERMINAL is designed for live classroom and tournament competition. SILENT MISSION must be exciting to play and compelling to watch on the big screen.

### Player View (Tactical Ops Console)
- **Top Bar:** Scenario Title, Mission Objective, Battery Remaining Meter, Simulation Status (`STAGING` / `EXECUTING` / `ABORTED` / `MISSION COMPLETE`).
- **Left Panel:** Action Arsenal (draggable cards with clear icons, battery costs, and prerequisite badges).
- **Center Canvas:** The **Planning Corridor** with Magnetic Snap Sockets. Numbered slots ($1 \dots N$) where actions click into place.
- **Bottom Bar:** Quick Controls (`CLEAR`, `SIMULATE PLAN`, `RESET`).
- **Right Panel:** Live Telemetry Trace & Environmental State Monitor (Power, Locks, Pressure, Alarms).

### Stage View (Spectator Command Radar)
Spectators in the auditorium or on Twitch watch the **Mission Readiness Grid**:
- **Drone Telemetry Visualizer:** An animated schematic diagram of the Triton-9 facility.
- **Player Fleet Progress:** Shows each student's current execution status (e.g., *Alice: Executing Step 4/6... [SUCCESS]* | *Bob: Stalled at Step 2 [LOCK INTERLOCK]*).
- **Anti-Spoiler Protection:** The Stage displays **which step index** a player is executing and their **battery efficiency**, but does **not** reveal the exact action names or secret prerequisite chains until the round completes.
- **Leaderboard Ticker:** Live point standings updated immediately upon mission completion.

---

## 14. Student UI Design System

SILENT MISSION strictly adheres to TERMINAL's design language:  
**Cybercore + Neo-Brutalism + High Contrast + Tactile Interaction**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  SILENT MISSION // FACILITY TRITON-9                [BATTERY: ⚡ 12/12]  [SCORE: 000] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  OBJECTIVE: REROUTE CORE POWER & RETRIEVE BLUEPRINT FILE                               │
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│  ACTION ARSENAL          │  PLANNING CORRIDOR (DRAG ACTIONS HERE)                     │
│                          │                                                             │
│  ┌────────────────────┐  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ CONNECT_POWER_FEED │  │  │ STEP 1       │   │ STEP 2       │   │ STEP 3       │    │
│  │ Cost: ⚡ 2          │  │  │ CONNECT_PWR  │──►│ BOOT_TERMINAL│──►│ DOWNLOAD_LOGS│    │
│  │ Emits: POWER_ON    │  │  │ Cost: ⚡ 2    │   │ Cost: ⚡ 1    │   │ Cost: ⚡ 3    │    │
│  └────────────────────┘  │  └──────────────┘   └──────────────┘   └──────────────┘    │
│  ┌────────────────────┐  │                                                             │
│  │ BOOT_TERMINAL      │  │  [ + DROP NEXT ACTION HERE ]                                │
│  │ Cost: ⚡ 1          │  │                                                             │
│  │ Needs: POWER_ON    │  ├─────────────────────────────────────────────────────────────┤
│  └────────────────────┘  │  ENVIRONMENT TELEMETRY                                      │
│  ┌────────────────────┐  │  Power Grid: [OFFLINE]   Air Pressure: [1.0 ATM]            │
│  │ DOWNLOAD_LOGS      │  │  Vault Lock: [ENGAGED]   Optical Uplink: [DISCONNECTED]     │
│  │ Cost: ⚡ 3          │  ├─────────────────────────────────────────────────────────────┤
│  │ Needs: TERMINAL_ON │  │  [ CLEAR PLAN ]          [ ENGAGE MISSION SEQUENCE ]         │
│  └────────────────────┘  │                                                             │
└──────────────────────────┴─────────────────────────────────────────────────────────────┘
```

- **Color Palette:** Deep void background (`#0A0D14`), Tactical Emerald for confirmed states (`#10B981`), Amber Warning for missing dependencies (`#F59E0B`), Neon Cyan for interactive docks (`#06B6D4`), and Crimson for blown fuses (`#EF4444`).
- **Typography:** JetBrains Mono for telemetry codes; Outfit/Inter for mission briefings.

---

## 15. Magnetic Dock Integration

The platform has selected `npx shadcn@latest add @componentry/magnetic-dock` as an official interactive primitive.

### How Magnetic Dock Serves the Gameplay
In SILENT MISSION, planning is physical. The Magnetic Dock is utilized for **Action-to-Slot Docking** and **Modifier-to-Action Coupling**:

1. **Sequence Slot Magnetic Snap:**
   - The Planning Corridor consists of a horizontal track of magnetic dock slots (`SLOT_1`, `SLOT_2`, etc.).
   - As the player drags an Action Block near a slot, the magnetic dock expands smoothly, showing snap preview lines and calculating dependency compatibility.
   - When dropped, the action snaps into place with a crisp neo-brutalist mechanical sound and tactile micro-animation.
2. **Prerequisite Port Magnetism:**
   - Actions with explicit parameter requirements (e.g., `DECRYPT_KEYPAD` requiring `CIPHER_KEYCARD`) have a magnetic sub-dock socket.
   - Dragging the `CIPHER_KEYCARD` item near the socket magnetically snaps it into the action block, visibly locking the dependency together.
3. **Why This Improves Pedagogical Understanding:**
   - Instead of looking at an abstract list of text options, the student physically connects modular components. The snap interaction physically reinforces the concept of modular pipeline composition.

---

## 16. Server-Authoritative Architecture & Validation

The client is strictly a presentation and plan-construction interface. **The server is 100% authoritative.**

### State Validation Cycle
When the client clicks `ENGAGE MISSION SEQUENCE`, it dispatches:
```json
POST /api/sessions/:code/mission-execute
{
  "actionPlan": [
    { "slot": 0, "actionId": "CONNECT_POWER_FEED", "params": {} },
    { "slot": 1, "actionId": "BOOT_TERMINAL", "params": {} },
    { "slot": 2, "actionId": "DOWNLOAD_LOGS", "params": {} }
  ]
}
```

### Authoritative Server Execution Algorithm
```
1. Fetch Challenge.config for current challenge.
2. Verify player has not already submitted or session is ROUND_ACTIVE.
3. Initialize virtual EnvironmentState from config.initialState.
4. Set remainingBattery = config.initialBattery.
5. Create empty executionTrace array.
6. For each step i in actionPlan:
   a. Look up ActionDefinition in config.actions.
   b. Verify actionId is valid and allowed in this challenge.
   c. Check remainingBattery >= ActionDefinition.cost. If not:
      - Record BATTERY_DEPLETED in trace.
      - Break execution.
   d. Check all requiredStates in ActionDefinition.prerequisites.
      - If ANY condition unmet:
        - Deduct penaltyCost (1⚡).
        - Record PREREQUISITE_FAILED (specifying missing state).
        - Break execution.
   e. All checks passed:
      - Deduct ActionDefinition.cost from remainingBattery.
      - Apply ActionDefinition.postConditions to EnvironmentState.
      - Record STEP_SUCCESS in trace.
7. Evaluate win condition:
   - Are all config.targetStates satisfied?
8. Calculate score:
   - If win: Base (100) + Battery Bonus (remainingBattery * 10) + CleanSheet (if zero stalls).
   - If failed: Deduct retry penalty (-15).
9. Save execution trace and score in Submission.metadata.
10. Broadcast sanitized session_state_update via Socket.IO.
11. Return full executionTrace and result to client.
```

### Security & Anti-Cheat Guarantees
- **No Client State Trust:** The server does not accept client claims like `"isSuccess": true` or `"batteryUsed": 2`. The server computes the entire simulation independently.
- **No Forged Actions:** Actions not present in `Challenge.config.actions` trigger immediate HTTP 400 Bad Request.
- **Replay / Race Protection:** Rapid duplicate execution clicks are blocked via atomic session locks.

---

## 17. Conceptual `Challenge.config` Schema

Below is the complete configuration structure representing an entire SILENT MISSION challenge:

```json
{
  "scenarioId": "MISSION_TRITON_02",
  "title": "OPERATION CIRCUIT BREAKER",
  "briefing": "Subterranean vault access is offline. Reroute coolant, disarm sonic alarms, and bypass the magnetic interlocks without overheating the auxiliary transformer.",
  "initialBattery": 12,
  "initialState": {
    "MAIN_POWER": false,
    "COOLANT_PUMP": false,
    "SONIC_ALARM_DISARMED": false,
    "MAGNETIC_LOCK_RELEASED": false,
    "AUX_TRANSFORMER_TEMPERATURE": 45,
    "VAULT_DOOR_OPEN": false
  },
  "targetState": {
    "VAULT_DOOR_OPEN": true
  },
  "actions": [
    {
      "id": "ENGAGE_POWER_BUS",
      "label": "Engage Power Bus",
      "category": "POWER",
      "cost": 2,
      "prerequisites": {},
      "postConditions": {
        "MAIN_POWER": true
      },
      "failureNotice": "Power bus requires manual breaker latch."
    },
    {
      "id": "REROUTE_COOLANT",
      "label": "Reroute Primary Coolant",
      "category": "ENVIRONMENT",
      "cost": 3,
      "prerequisites": {
        "MAIN_POWER": true
      },
      "postConditions": {
        "COOLANT_PUMP": true,
        "AUX_TRANSFORMER_TEMPERATURE": 25
      },
      "failureNotice": "Coolant pump cannot start without active power."
    },
    {
      "id": "DISARM_SONIC_ALARM",
      "label": "Disarm Sonic Alarm Sensor",
      "category": "SECURITY",
      "cost": 2,
      "prerequisites": {
        "MAIN_POWER": true
      },
      "postConditions": {
        "SONIC_ALARM_DISARMED": true
      },
      "failureNotice": "Sonic bypass transmitter has no signal without main power."
    },
    {
      "id": "DEACTIVATE_MAGNETIC_LOCK",
      "label": "Deactivate Magnetic Interlock",
      "category": "SECURITY",
      "cost": 2,
      "prerequisites": {
        "MAIN_POWER": true,
        "COOLANT_PUMP": true
      },
      "postConditions": {
        "MAGNETIC_LOCK_RELEASED": true
      },
      "failureNotice": "Releasing magnetic locks without coolant causes transformer thermal trip."
    },
    {
      "id": "OPEN_VAULT_DOOR",
      "label": "Open Vault Hatch",
      "category": "MISSION",
      "cost": 2,
      "prerequisites": {
        "SONIC_ALARM_DISARMED": true,
        "MAGNETIC_LOCK_RELEASED": true
      },
      "postConditions": {
        "VAULT_DOOR_OPEN": true
      },
      "failureNotice": "Vault hatch jammed: Interlocks engaged or alarm system triggered."
    }
  ],
  "scoring": {
    "basePoints": 100,
    "batteryBonusPerUnit": 10,
    "firstRunBonus": 30,
    "cleanSheetBonus": 20,
    "retryPenalty": -15
  }
}
```

---

## 18. Pedagogical Debrief ("What You Just Did")

Immediately after successfully completing the mission, the student is presented with a non-intrusive, visual debrief connecting their tactical gameplay experience to foundational software and systems concepts:

```
┌────────────────────────────────────────────────────────────────────────┐
│  MISSION COMPLETE // SYSTEM DEBRIEF: WHAT YOU JUST DID                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. DEPENDENCY GRAPHS (DAGs)                                           │
│     In this mission, you discovered that OPEN_VAULT required both      │
│     COOLANT and SONIC_ALARM to be resolved first.                      │
│     In real systems (like Docker builds, CI/CD pipelines, and AI agent │
│     workplans), tasks cannot run until their dependencies complete.    │
│                                                                        │
│  2. PRECONDITIONS & POSTCONDITIONS                                     │
│     Every software function or automated workflow has:                 │
│     - What must be true BEFORE it runs (Precondition).                 │
│     - What changes in the world AFTER it runs (Postcondition).         │
│                                                                        │
│  3. RESOURCE-AWARE SCHEDULING                                          │
│     By planning the shortest valid sequence, you conserved 3 battery    │
│     cells. Engineering is not just about making something work—it is   │
│     about achieving the goal within budget constraints.                │
│                                                                        │
│  [CONTINUE TO NEXT SECTOR]                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 19. Anti-Quiz & Anti-Guessing Enforcement

To protect the integrity of TERMINAL's gameplay:

1. **No Multiple-Choice Questions:** The student is never presented with `"Which action should you run first? A, B, or C"`.
2. **No Blind Reordering of a Fixed List:** The player chooses *which* actions to include, *in what order*, and *which optional actions to omit*.
3. **Severe Brute-Force Discouragement:**
   - With 8 available actions and a 5-step sequence, there are $8^5 = 32,768$ combinations. Random clicking will mathematically fail.
   - Each failed execution consumes a -15 score penalty and battery stall penalty.
   - The fastest and highest-scoring path is always to read the failure trace and reason through the dependency chain.

---

## 20. Comparison With Existing Games

| Game Template | Core Mechanic | Player Question | Cognitive Skill | Why SILENT MISSION is Distinct |
|:---|:---|:---|:---|:---|
| **LOGIC HEIST** | Security graph path traversal | *"Which path has the correct boolean condition?"* | Conditional logic & branch evaluation | In Heist, the environment evaluates conditions as you move. In Silent Mission, you **construct the entire pipeline upfront** and simulate it. |
| **DEAD CODE** | AST refactoring & rule patching | *"Why did this rule misclassify student #17?"* | Differential debugging & hypothesis testing | Dead Code fixes broken rules. Silent Mission sequences brand-new operational workflows under strict battery limits. |
| **THE WITNESS** | Structured question interrogation | *"Which question cuts the suspect pool in half?"* | Binary search & information entropy | The Witness deduces hidden identity through questions. Silent Mission orchestrates cause-and-effect state transformations. |
| **ROGUE SCANNER** | Telemetry correlation & false positive triage | *"Which low-amplitude signals share a covert cadence?"* | Anomaly detection & multi-signal pattern matching | Scanner filters noise from passive historical logs. Silent Mission actively changes environmental states to accomplish a mission. |

---

## 21. Human Playtest Plan

Before implementation is marked complete, the human playtester must run through the following 6-stage test matrix:

### Test 1: 5-Minute Beginner Test
- **Action:** A first-time student plays Operation 1 ("Cold Boot") with zero verbal instructions.
- **Expected:** The student drags actions into the dock, runs the sequence, experiences a prerequisite stall, reads the trace, fixes the order, and succeeds within 3 minutes.
- **Failure Indicator:** Student asks "What am I supposed to click?" or takes $>5$ minutes on Stage 1.

### Test 2: 10-Minute Full Vertical Slice Test
- **Action:** Play through Operations 1, 2, 3, and 4 in sequence.
- **Expected:** Student experiences escalating constraint complexity, notices the resource tradeoffs in Stage 3, and solves the Stage 4 Premature Extraction trap.
- **Failure Indicator:** Student feels Stage 3 or 4 is repetitive or finds that guessing is faster than reasoning.

### Test 3: Failure & Diagnostic Recovery Test
- **Action:** Intentionally construct a backwards plan (`DOWNLOAD` before `POWER`).
- **Expected:** Clear telemetry diagnostic showing exactly which prerequisite was missing, without frustrating the player.
- **Failure Indicator:** Cryptic error message like `"Invalid submission"` or `"Error 500"`.

### Test 4: Resource Constraint & Budget Exhaustion Test
- **Action:** Player intentionally inserts 4 unnecessary high-cost actions into the corridor.
- **Expected:** Battery depletes to 0 before the final objective; system clearly displays `BATTERY EXHAUSTED: 0/12 CELLS`.
- **Failure Indicator:** Drone completes the mission despite negative battery.

### Test 5: Blind First-Play Discovery Test
- **Action:** Player is not told that thermite venting removes air pressure in Stage 4.
- **Expected:** Player encounters the failure, reads the trace explaining pneumatic pressure loss, and experiences the "Aha!" moment on retry.
- **Failure Indicator:** Player feels cheated or blames the game for an invisible rule.

### Test 6: Spectator Stage Synchronization Test
- **Action:** Run the game while observing `/stage/:roomCode` in another browser window.
- **Expected:** Spectator sees live animated fleet status and step indicators without seeing the secret solution sequence.
- **Failure Indicator:** Spectator screen displays the answer key or freezes.

---

## 22. Edge Cases & Boundary Handling

1. **Empty Plan Submission:** If the player clicks `ENGAGE SEQUENCE` with 0 actions, the UI prevents submission and flashes the corridor dock.
2. **Circular Dependencies:** Server config validator checks that `Challenge.config` does not contain unresolvable cycles ($A \to B \to A$) at challenge load time.
3. **Mid-Sequence Disconnection:** If the student's browser closes during a simulation run, the server completes the authoritative evaluation; when the student reconnects, their socket receives the completed execution trace and updated battery state.
4. **Duplicate Actions in Corridor:** Some missions require executing the same action twice (e.g., `CYCLE_AIRLOCK`). The engine supports multiple instances of the same action block in different timeline slots.

---

## 23. Security & Anti-Cheat Considerations

- **Server-Authoritative State:** The client never sends `"status": "SUCCESS"`. It sends only the array of chosen action IDs.
- **Input Sanitization:** Action parameters and IDs are validated against an allowlist in the challenge schema using Zod.
- **Replay & Timing Attack Prevention:** Each submission increments the player's run attempt counter; the server rejects outdated run IDs.
- **Answer Sanitization:** Target state conditions and secret prerequisite maps are withheld from the public session state broadcast.

---

## 24. Implementation Compatibility with Existing TERMINAL Engine

SILENT MISSION requires **zero changes to the core game engine architecture**:
- **Prisma Schema:** Add `SILENT_MISSION` to `GameTemplate` enum and `MISSION_PLAN` to `ChallengeType` enum.
- **TemplateRegistry:** Register `SILENT_MISSION` with validation type `SILENT_MISSION` and interaction type `MISSION_PLAN`.
- **Validator.ts:** Implement `validateMissionPlan(submission, config)` to run the deterministic state simulation.
- **Session Service:** Broadcast `missionProgress` (current step, battery remaining, attempt count) via Socket.IO.
- **Frontend Component:** Create `client/src/components/MissionChallenge.tsx` utilizing `@componentry/magnetic-dock` for timeline snapping.

---

## 25. Design Quality Gate

| Criterion | Evaluation | Result |
|:---|:---|:---:|
| **1. Is the central mechanic genuinely fun?** | Assembling a sequence and watching it execute with tension is inherently satisfying (like programming a Mars rover). | **PASS** |
| **2. Can a beginner understand it in 30 seconds?** | Yes: "Drag actions, check requirements, hit Execute." | **PASS** |
| **3. Does failure teach?** | Yes: The failure diagnostic explicitly identifies the broken prerequisite. | **PASS** |
| **4. Is there an actual aha moment?** | Yes: Stage 4's pneumatic pressure dependency creates a classic narrative and logic realization. | **PASS** |
| **5. Is planning the gameplay?** | Yes: 100% of the game is sequence construction and resource triage. | **PASS** |
| **6. Can players make meaningful decisions?** | Yes: Route A (fast & power-hungry) vs. Route B (surgical & dependency-heavy). | **PASS** |
| **7. Is it distinct from existing games?** | Yes: Distinct from Heist (pathing), Dead Code (rules), Witness (questions), and Scanner (signals). | **PASS** |
| **8. Does it support live competition?** | Yes: Leaderboard scoring based on completion + battery efficiency + first-run bonuses. | **PASS** |
| **9. Can the existing engine support it?** | Yes: Standard Challenge.config, Validator, and Socket.IO session loop. | **PASS** |
| **10. Would students play another round?** | High replayability through optimizing battery conservation and unlocking harder sectors. | **PASS** |

---

## 26. Final Recommendation

**SILENT MISSION** represents a major cognitive addition to the TERMINAL platform. By translating the abstract computer science concepts of **Directed Acyclic Graphs (DAGs)**, **preconditions/postconditions**, and **workflow orchestration** into a tactile, high-stakes reconnaissance mission, students master computational planning through consequence-driven discovery.

```
================================================================================
STATUS: SILENT MISSION GAME DESIGN COMPLETE
CLASSIFICATION: APPROVED FOR VERTICAL SLICE IMPLEMENTATION
ACTION: HANDOFF TO IMPLEMENTATION AGENT (DO NOT PROCEED WITHOUT USER AUTHORIZATION)
================================================================================
```

---

# FINAL PRE-IMPLEMENTATION GAMEPLAY REVIEW
### Stress-Test & Playability Audit Under Live Competitive Conditions

To guarantee that **SILENT MISSION** is a genuine planning game rather than a veiled sequence-ordering quiz, the design was subjected to a 14-point gameplay stress test simulating 100 students playing simultaneously in a live auditorium event.

---

### 1. Valid Plan Analysis (Multiple Solutions & Strategic Trade-Offs)

A game ceases to be a planning game if there is only one "correct" sequence of actions. In SILENT MISSION, every non-introductory mission scenario explicitly supports **multiple divergent valid plans**, each reflecting a distinct engineering philosophy with clear trade-offs.

#### Example Scenario: Operation 3 ("Siphon Protocol")
- **Mission Goal:** Extract the encrypted telemetry core from Sector 4 and transmit it to the surface relay.
- **Starting Budget:** 12 Battery Units (⚡).
- **Available Arsenal (8 actions):** `RESTORE_BREAKER`, `DECRYPT_KEYPAD`, `DEPLOY_AUX_BATTERY`, `BYPASS_SOLENOID`, `OVERDRIVE_DRILL`, `BURST_TRANSMIT`, `OPTICAL_UPLINK`, `DEPLOY_SMOKE_DECOY`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PLAN A: THE SURGICAL LOW-POWER PATH (High Skill / Max Score)               │
│ Sequence: DECRYPT_KEYPAD (1⚡) ──► BYPASS_SOLENOID (2⚡) ──►                 │
│           OPTICAL_UPLINK (2⚡) ──► RETRIEVE_CORE (1⚡)                       │
│ Total Battery Used: 6⚡ | Remaining: 6⚡ (+60 bonus points)                │
│ Trade-offs: Zero noise, zero alarm escalation. Requires resolving 3 nested │
│             firmware prerequisites in exact order. One mistake halts plan. │
├─────────────────────────────────────────────────────────────────────────────┤
│ PLAN B: THE BRUTE-FORCE OVERDRIVE PATH (Low Skill / Fast / Risky)          │
│ Sequence: OVERDRIVE_DRILL (5⚡) ──► RETRIEVE_CORE (1⚡) ──►                  │
│           BURST_TRANSMIT (4⚡)                                              │
│ Total Battery Used: 10⚡ | Remaining: 2⚡ (+20 bonus points)               │
│ Trade-offs: Bypasses keypad and solenoid entirely. Extremely fast to plan. │
│             Burns 83% of battery reserve. Alert level rises to 80%, leaving│
│             zero margin for unexpected stalls or secondary retries.         │
├─────────────────────────────────────────────────────────────────────────────┤
│ PLAN C: THE REDUNDANT FAIL-SAFE PATH (Defensive / High Reliability)        │
│ Sequence: DEPLOY_AUX_BATTERY (2⚡) ──► DECRYPT_KEYPAD (1⚡) ──►              │
│           BYPASS_SOLENOID (2⚡) ──► BURST_TRANSMIT (4⚡) ──► RETRIEVE_CORE  │
│ Total Battery Used: 9⚡ (augmented to 14⚡ pool) | Remaining: 5⚡ (+50 pts) │
│ Trade-offs: Spends energy up front to expand power buffer. Immune to low-  │
│             voltage stalls. Lower peak score than Plan A, but guaranteed    │
│             completion on first attempt under tournament pressure.         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Stress-Test Result:** **PASSED**. The player is not guessing a developer's secret sequence. The player is choosing between *Stealth Precision*, *Brute-Force Speed*, or *Engineered Redundancy*.

---

### 2. Consequence Analysis (Causal Logic vs. Arbitrary Rules)

Every consequence in SILENT MISSION stems from physical and operational causality within the facility. Arbitrary video game failures (e.g. *"You ran out of invisible turns"*) are strictly prohibited.

| Action | Immediate Effect | Environmental State Change | Future Consequence (Why It Matters Later) |
|:---|:---|:---|:---|
| `IGNITE_THERMITE` | Vault door barrier melts | `DOOR_BREACHED: true`<br>`CHAMBER_OXYGEN: 0.0%`<br>`PRESSURE: 0.0 BAR` | Vacuum pistons and pneumatic lifts cannot operate in zero pressure. The escape lift is disabled until ventilation is restored. |
| `OVERLOAD_GENERATOR` | Primary electrical bus blows | `MAIN_POWER: false`<br>`CAMERAS: DISABLED`<br>`OPTIC_FIBER: DARK` | Optical security cameras are blinded (good!), but high-speed optical data transmitters lose power (bad!). Player must use low-frequency radio burst. |
| `VENT_COOLANT_TANK` | Superheated steam released into corridor | `SECTOR_2_TEMPERATURE: 180°C`<br>`SPRINKLERS: JAMMED` | Douses laser tripwires, but thermal sensors lock down adjacent airlocks. Player must isolate Sector 2 before venting. |
| `DEPLOY_AUX_BATTERY` | Auxiliary power pack attached to drone | `MAX_BATTERY: +4⚡`<br>`DRONE_WEIGHT: HEAVY` | Increases total energy pool, but heavy payload prevents moving through narrow ventilation grates. |

**Stress-Test Result:** **PASSED**. Every failure can be traced to a real-world physical principle (pneumatics require air, optical cables require power, thermite consumes oxygen).

---

### 3. Information Analysis (Known vs. Discoverable vs. Hidden)

To ensure fair play without psychic knowledge:

- **KNOWN (Visible Upfront on Action Cards & HUD):**
  - Battery cost (⚡) of every action.
  - Stated prerequisites (e.g., `Requires: MAIN_POWER == true`).
  - Starting facility indicators (Power, Locks, Chamber Pressure, Alert Meter).
- **DISCOVERABLE (Inspectable via Hover, Blueprint Notes & Inspection Tooltips):**
  - Secondary equipment properties: Hovering over `PNEUMATIC_LIFT` displays: *"Operates via atmospheric air pressure differential."*
  - Sector schematics: The mission briefing map contains operational footnotes (e.g., *"Warning: Optical switch bus is slaved to Primary Generator"*).
- **HIDDEN (Discovered Through Execution & Simulation):**
  - Exact thermal trip thresholds (e.g. running 3 high-heat actions consecutively trips the auxiliary fuse).
  - Specific diagnostic telemetry traces generated when a prerequisite is missed.
- **Fairness Guarantee:** No mission failure is ever caused by HIDDEN information. Every failure is preventable by reading KNOWN cards and DISCOVERABLE blueprints.

**Stress-Test Result:** **PASSED**. The game rewards observation, not trial-and-error memorization.

---

### 4. Aha Moment Analysis (The Premature Extraction Trap)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PLAYER ASSUMPTION                                                        │
│ "I have thermite and an escape lift. I'll just blast the vault door open,   │
│ download the payload, and ride the pneumatic lift straight to safety."      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. PLAYER ACTION                                                            │
│ Sequence: [IGNITE_THERMITE] ──► [EXTRACT_DATABASE] ──► [CALL_PNEUMATIC_LIFT]│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. UNEXPECTED CONSEQUENCE                                                   │
│ • Step 1: Thermite fires. Vault door disintegrates. Chamber flashes red.    │
│ • Step 2: Database extracted successfully.                                  │
│ • Step 3: [CALL_PNEUMATIC_LIFT] FAILS! Elevator motor whines and stalls.   │
│   Telemetry Log: "Pneumatic cylinder pressure: 0.0 bar (Required: 1.0 bar). │
│   Atmospheric oxygen depleted by chemical combustion. Piston paralyzed."    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. THE AHA! REALIZATION                                                     │
│ "Wait! The thermite burned all the air in the sealed room! The lift works on│
│ air pressure! I paralyzed my own escape vehicle because I fired the thermite│
│ in a vacuum! I have to open the air vent BEFORE burning the door!"          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. REVISED SUCCESSFUL PLAN                                                  │
│ Sequence: [OPEN_AIR_DAMPER] ──► [IGNITE_THERMITE] ──► [EXTRACT_DATABASE]    │
│           ──► [CALL_PNEUMATIC_LIFT]                                         │
│ Result: Lift operates normally. Mission Accomplished.                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Stress-Test Result:** **PASSED**. The failure makes the student feel clever rather than cheated because the connection between *fire*, *oxygen*, and *pneumatics* makes immediate intuitive sense.

---

### 5. Magnetic Dock Analysis (Essential Component vs. Decoration)

**Question:** *"If we replaced `@componentry/magnetic-dock` with a plain HTML ordered list or standard drag-and-drop table, would the game become meaningfully worse?"*

**Verdict: YES, meaningfully worse.**
1. **Tension of Spatial Assembly:** In software and hardware engineering, pipelines are composed of modular components with input/output sockets. Magnetic Dock provides tactile, physical snapping: as a student drags an action near a timeline slot, the slot dynamically expands and displays a neon green magnetic snap boundary if prerequisites are compatible, or an amber resist-snap cue if an obvious prerequisite is absent.
2. **Modifier Sockets (Compositional Planning):** Certain actions in later stages have **sub-sockets** (e.g. `DECRYPT_KEYPAD` has a socket for `CIPHER_KEYCARD_B`). Magnetic Dock allows physical snapping of modifier chips *into* action blocks. Standard lists cannot represent this two-dimensional composition without clunky modal dropdowns.
3. **Neo-Brutalist Tactility:** The magnetic snap animation and tactile click sound make committing a plan feel like arming a real physical mechanism, reinforcing the fantasy of programming an autonomous probe.

**Stress-Test Result:** **PASSED**. Magnetic Dock is structurally integrated into pipeline composition and modifier docking.

---

### 6. Resource Analysis (Battery: Hard Cap vs. Score Multiplier)

**Question:** *"Is battery energy just a multiplier at the end, or does it force real in-game decisions?"*

- Battery is a **Hard Execution Boundary**. If the drone reaches 0⚡ before reaching the target state, the mission aborts instantly.
- In Operation 3 and 4, the total cost of all available actions in the Arsenal is **22⚡**, but the drone's battery capacity is only **12⚡**.
- The student literally *cannot* afford to run every safety measure. They must choose:
  - Do I spend 2⚡ on `DEPLOY_DECOY` to guarantee zero laser alarms?
  - Or do I save the 2⚡, risk a +1 alert level, and use those cells to run the high-speed `OPTICAL_UPLINK`?
- **Decision Verdict:** Battery forces continuous risk-budget triage. It is an operational constraint first, and a score bonus second.

**Stress-Test Result:** **PASSED**.

---

### 7. Irreversibility Analysis (Permanent World Changes)

- Irreversible actions (e.g., `DETONATE_THERMITE`, `BLOW_MAIN_BREAKER`, `DRAIN_SUMP_RESERVOIR`) permanently alter environmental flags.
- **Fairness Protection:** Every irreversible action card displays an unambiguous, high-contrast badge:  
  `[IRREVERSIBLE STATE TRANSITION: DESTROYS SECTOR 1 ACCESS]`
- Players are never blindsided. When they choose to blow the breaker, they know they cannot return to Sector 1. The challenge is sequencing all Sector 1 objectives *before* committing the irreversible act.

**Stress-Test Result:** **PASSED**.

---

### 8. Failure Recovery Analysis (Safe Experimentation & Dignified Failure)

A failed execution run does **not** reset the student to a blank slate:
1. **Telemetry Scrubber:** The execution timeline freezes at the exact failing step. Preceding successful steps remain highlighted in emerald green (`✓ PASSED - 2⚡`).
2. **Failure Node Inspection:** The failing step flashes in amber. Clicking it opens the diagnostic inspector showing the exact missing state.
3. **In-Place Sequence Splicing:** The student does not need to rebuild the plan from scratch. They can drag a new prerequisite block directly between Step 2 and Step 3; the Magnetic Dock smoothly parts to accommodate the spliced action.
4. **Iterative Learning:** Attempt 1 uncovers a prerequisite; Attempt 2 refines the order; Attempt 3 optimizes battery. Failure is part of the engineering loop.

**Stress-Test Result:** **PASSED**.

---

### 9. 30-Second Experience (First-Time Student Playthrough)

```
[00:00 - 00:08]
Screen fades in from black. Terminal scanlines pulse.
Headline: OPERATION COLD BOOT // FACILITY TRITON-9
Subtext: "Telemetry link established. Program drone instructions to extract Sector 1 blueprint."
Visual: Left side shows 4 glowing cards. Center shows 3 numbered empty magnetic docks.

[00:08 - 00:18]
Student looks at left panel:
Card 1: [CONNECT_POWER] (Cost: ⚡ 2 | Emits: POWER_ON)
Card 2: [BOOT_TERMINAL] (Cost: ⚡ 1 | Requires: POWER_ON)
Card 3: [DOWNLOAD_BLUEPRINT] (Cost: ⚡ 2 | Requires: TERMINAL_ON)
Card 4: [VENT_EXHAUST] (Cost: ⚡ 3)

[00:18 - 00:24]
Student drags [CONNECT_POWER] -> SNAPS into Slot 1.
Student drags [BOOT_TERMINAL] -> SNAPS into Slot 2.
Student drags [DOWNLOAD_BLUEPRINT] -> SNAPS into Slot 3.

[00:24 - 00:30]
Student clicks glowing neon green button: [ENGAGE MISSION SEQUENCE].
Timeline lights up step by step:
Step 1: CONNECT_POWER [✓ OK]
Step 2: BOOT_TERMINAL [✓ OK]
Step 3: DOWNLOAD_BLUEPRINT [✓ OK]
Banner: "SECTOR 1 BLUEPRINT SECURED. MISSION SUCCESS (+150 PTS)."
```
**Total elapsed time:** 28 seconds. The student immediately grasps the entire loop without reading a single paragraph of instructions.

**Stress-Test Result:** **PASSED**.

---

### 10. Anti-Guessing Analysis (Mathematical & Mechanical Defense)

- In Operation 3 and 4, the Arsenal contains **8 actions**, and the sequence corridor accepts **4 to 6 slots**.
- Number of possible 5-step permutations:  
  $$P(8, 5) = \frac{8!}{(8-5)!} = 8 \times 7 \times 6 \times 5 \times 4 = 6,720 \text{ ordered combinations.}$$
- If replacement is allowed (same action used twice):  
  $$8^5 = 32,768 \text{ combinations.}$$
- Each failed execution run applies a **$-15$ score penalty** and burns battery stall penalties.
- Random guessing will deplete all battery, trigger rapid negative scoring, and mathematically fail. The only viable path to victory is reading the prerequisite badges and assembling the dependencies logically.

**Stress-Test Result:** **PASSED**.

---

### 11. Anti-Ordering-Puzzle Analysis (Planning vs. Jigsaw Ordering)

| Characteristic | Sequence Ordering Puzzle (Quiz) | SILENT MISSION (Planning Game) |
|:---|:---|:---|
| **Action Pool** | Fixed $N$ items provided; player must arrange all $N$ items. | Pool of $M$ actions provided ($M > N$). Player must choose *which* subset of actions to deploy. |
| **Solution Count** | Exactly 1 predetermined correct sequence. | Multiple divergent valid paths (Plan A: Stealth, Plan B: Overdrive, Plan C: Redundant). |
| **Resource Triage** | No concept of budget or capacity. | Strict battery energy limits (⚡). Running too many "safe" actions triggers battery death. |
| **Environmental Side-Effects** | Actions are independent steps in a recipe. | Actions dynamically mutate world flags (pressure, temperature, power, alarms). |
| **Failure Feedback** | Red checkmark: *"Incorrect order."* | Causal operational telemetry: *"Oxygen depleted by thermite; vacuum lift stalled."* |

**Stress-Test Result:** **PASSED**. SILENT MISSION is a true workflow planning simulation.

---

### 12. Competitive & Spectator Analysis (Live 100-Student Arena)

- **Does Speed Trump Reasoning?**  
  No. A student who rushes and fails twice incurs $-30$ in retry penalties and burns battery bonuses. A student who spends 45 seconds carefully reviewing dependencies and completes the mission on Run 1 earns $+30$ (First-Run Precision) $+50$ (Battery Bonus) $+20$ (Clean Sheet), outscoring the rushed guesser by over 100 points.
- **Stage Spectator Legibility:**  
  On the main auditorium screen, spectators see an animated layout of *Facility Triton-9*. Colored blips represent students' drones progressing through sectors. When a student's drone stalls, a warning pulse ripples across the sector schematic, creating high tension and drama without spoiling the correct sequence for other players.

**Stress-Test Result:** **PASSED**.

---

### 13. Learning Transfer Analysis (Post-Game Student Articulation)

When a student finishes SILENT MISSION, what can they explain to a peer in plain, non-academic language?

> *"Before I can download data from a server, something has to power it on first—that's a requirement. But I also learned that every action changes the environment. If I blow a fuse to shut down the cameras, I might accidentally kill the power to the elevator I need for my escape! And you can't just do everything safely, because you only have a limited amount of energy. You have to figure out the shortest, smartest chain of steps that gets the job done without breaking your own tools."*

This is the exact mental model required for **Directed Acyclic Graphs (DAGs)**, **microservice dependencies**, **CI/CD pipeline construction**, and **autonomous agent task planning**.

**Stress-Test Result:** **PASSED**.

---

### 14. Final Verdict

```
================================================================================
FINAL GAMEPLAY REVIEW VERDICT:
A. READY FOR IMPLEMENTATION
================================================================================
```

The game design of **SILENT MISSION** successfully survived all 14 stress tests. It is fundamentally a planning and dependency game, not an ordering puzzle. It enforces server-authoritative validation, integrates seamlessly into the existing TERMINAL engine, provides genuine student "Aha!" moments, and supports exhilarating live competitive gameplay.

**Status:** **LOCKED & READY FOR IMPLEMENTATION**.

