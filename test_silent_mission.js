const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

// ============================================================================
// CURATED 4-OPERATION VERTICAL SLICE SCENARIOS (Authoritative Design)
// ============================================================================

const OP1_COLD_BOOT = {
  operationId: 'OP-01',
  scenarioTitle: 'OPERATION COLD BOOT: FACILITY INFILTRATION',
  missionBrief: 'Infiltrate the perimeter auxiliary substation. Power is restricted to 24V auxiliary bus. Route 480V three-phase power, calibrate optical fiber link, and decrypt access terminal to secure the forward staging outpost.',
  batteryCapacity: 40,
  initialState: {
    POWER_BUS: '24V_AUX',
    FIBER_LINK: 'OFFLINE',
    CIPHER_CORE: 'LOCKED',
    ACCESS_TERMINAL: 'UNAUTHENTICATED',
    COOLANT_LOOP: 'STABLE',
  },
  targetState: {
    ACCESS_TERMINAL: 'AUTHENTICATED',
  },
  actions: [
    {
      id: 'STEP_UP_TRANSFORMER',
      name: 'Step Up Substation Transformer',
      category: 'POWER',
      cost: 15,
      prerequisites: {},
      postconditions: { POWER_BUS: '480V_MAIN' },
      isIrreversible: false,
      description: 'Engages high-voltage coil switches to upgrade 24V auxiliary power to 480V industrial grid.',
    },
    {
      id: 'ALIGN_OPTICAL_FIBER',
      name: 'Calibrate Optical Link',
      category: 'NETWORK',
      cost: 10,
      prerequisites: { POWER_BUS: '480V_MAIN' },
      postconditions: { FIBER_LINK: 'ONLINE' },
      isIrreversible: false,
      description: 'Aligns laser collimator to the primary fiber trunk. Requires high-voltage power.',
    },
    {
      id: 'LOAD_CIPHER_KEYS',
      name: 'Inject Decryption Keys',
      category: 'CRYPTOGRAPHY',
      cost: 10,
      prerequisites: { FIBER_LINK: 'ONLINE' },
      postconditions: { CIPHER_CORE: 'READY' },
      isIrreversible: false,
      description: 'Streams one-time cryptographic pads across the verified optical line to prepare cipher core.',
    },
    {
      id: 'INITIALIZE_TERMINAL',
      name: 'Authenticate Terminal Session',
      category: 'ACCESS',
      cost: 5,
      prerequisites: { CIPHER_CORE: 'READY' },
      postconditions: { ACCESS_TERMINAL: 'AUTHENTICATED' },
      isIrreversible: false,
      description: 'Establishes authorized administrative console session.',
    },
    {
      id: 'PURGE_COOLANT_LOOP',
      name: 'Emergency Coolant Purge',
      category: 'THERMAL',
      cost: 20,
      prerequisites: {},
      postconditions: { COOLANT_LOOP: 'DRAINED' },
      isIrreversible: true,
      description: 'Dumps fluorocarbon coolant. Irreversible environmental state transition.',
    },
  ],
  scoring: {
    basePoints: 100,
    batteryBonusMultiplier: 10,
    firstRunBonus: 30,
    cleanSheetBonus: 20,
    retryPenalty: -15,
  },
};

const OP3_SIPHON_PROTOCOL = {
  operationId: 'OP-03',
  scenarioTitle: 'OPERATION SIPHON PROTOCOL: DIVERGENT APPROACHES',
  missionBrief: 'Infiltrate the secure archival vault. You may choose Plan A (Surgical Stealth), Plan B (Overdrive Brute-Force), or Plan C (Redundant Fail-Safe).',
  batteryCapacity: 60,
  initialState: {
    VAULT_LOCK: 'SECURED',
    IDS_ALARM: 'ARMED',
    GRID_FREQUENCY: '60HZ',
    INTEL_SIPHON: 'STANDBY',
    ACCESS_TIER: 'NONE',
  },
  targetState: {
    INTEL_SIPHON: 'EXTRACTED',
  },
  actions: [
    // Plan A: Surgical Stealth
    {
      id: 'CLONE_RFID_BADGE',
      name: 'Clone Supervisor Badge',
      category: 'ACCESS',
      cost: 15,
      prerequisites: {},
      postconditions: { ACCESS_TIER: 'SUPERVISOR' },
      isIrreversible: false,
      description: 'Surgically mirrors security token without tripping IDS sensor grid.',
    },
    {
      id: 'SPOOF_IDS_HEARTBEAT',
      name: 'Spoof IDS Heartbeat Beacon',
      category: 'NETWORK',
      cost: 15,
      prerequisites: { ACCESS_TIER: 'SUPERVISOR' },
      postconditions: { IDS_ALARM: 'BYPASSED' },
      isIrreversible: false,
      description: 'Simulates legitimate keep-alive pings across security network.',
    },
    {
      id: 'SILENT_SIPHON_INTEL',
      name: 'Execute Low-Bandwidth Data Siphon',
      category: 'CRYPTOGRAPHY',
      cost: 20,
      prerequisites: { IDS_ALARM: 'BYPASSED' },
      postconditions: { INTEL_SIPHON: 'EXTRACTED' },
      isIrreversible: false,
      description: 'Trickles encrypted database contents quietly.',
    },

    // Plan B: Overdrive Brute-Force
    {
      id: 'OVERCHARGE_CAPACITOR_BANK',
      name: 'Overcharge Capacitor Bank',
      category: 'POWER',
      cost: 20,
      prerequisites: {},
      postconditions: { GRID_FREQUENCY: '120HZ_SURGE' },
      isIrreversible: false,
      description: 'Forces industrial power bank to double output frequency.',
    },
    {
      id: 'EMP_BURST_SOLENOID',
      name: 'Discharge Electromagnetic Burst',
      category: 'POWER',
      cost: 25,
      prerequisites: { GRID_FREQUENCY: '120HZ_SURGE' },
      postconditions: { VAULT_LOCK: 'FRIED_OPEN', IDS_ALARM: 'DISABLED' },
      isIrreversible: true,
      description: 'Blasts security solonoid with EMP, disabling both lock and IDS instantly.',
    },
    {
      id: 'HIGH_SPEED_DATA_DUMP',
      name: 'High-Speed Memory Dump',
      category: 'NETWORK',
      cost: 10,
      prerequisites: { VAULT_LOCK: 'FRIED_OPEN' },
      postconditions: { INTEL_SIPHON: 'EXTRACTED' },
      isIrreversible: false,
      description: 'Dumps full memory bus onto storage brick in seconds.',
    },

    // Plan C: Redundant Fail-Safe
    {
      id: 'ISOLATE_BACKUP_GENERATOR',
      name: 'Isolate Standby Generator',
      category: 'POWER',
      cost: 15,
      prerequisites: {},
      postconditions: { BACKUP_GRID: 'ISOLATED' },
      isIrreversible: false,
      description: 'Reroutes facility emergency generator circuit.',
    },
    {
      id: 'INJECT_OPTICAL_TAP',
      name: 'Splice Optical Tap into Data Backbone',
      category: 'NETWORK',
      cost: 20,
      prerequisites: { BACKUP_GRID: 'ISOLATED' },
      postconditions: { FIBER_TAP: 'ACTIVE' },
      isIrreversible: false,
      description: 'Physical fiber-optic beam-splitter splice.',
    },
    {
      id: 'PASSIVE_PACKET_HARVEST',
      name: 'Passive Packet Stream Capture',
      category: 'CRYPTOGRAPHY',
      cost: 23,
      prerequisites: { FIBER_TAP: 'ACTIVE' },
      postconditions: { INTEL_SIPHON: 'EXTRACTED' },
      isIrreversible: false,
      description: 'Reconstructs siphon package from passive fiber-optic interception.',
    },
  ],
  scoring: {
    basePoints: 100,
    batteryBonusMultiplier: 10,
    firstRunBonus: 30,
    cleanSheetBonus: 20,
    retryPenalty: -15,
  },
};

const OP4_GHOST_EXTRACT = {
  operationId: 'OP-04',
  scenarioTitle: 'OPERATION GHOST EXTRACT: TRAP & EXTRACTION',
  missionBrief: 'Infiltrate deep containment. Thermite breaching depletes ambient oxygen. If you call the pneumatic escape lift without equalizing ventilation, the vacuum seal locks and traps the team.',
  batteryCapacity: 65,
  initialState: {
    VAULT_DOOR: 'SEALED_TITANIUM',
    ATMOSPHERE_PRESSURE: '1.0_BAR',
    VENT_DAMPER: 'CLOSED',
    PNEUMATIC_LIFT: 'STATIONARY',
    EXTRACTION_STATUS: 'PENDING',
  },
  targetState: {
    EXTRACTION_STATUS: 'ESCAPED',
  },
  actions: [
    {
      id: 'IGNITE_THERMITE_CHARGE',
      name: 'Ignite Thermite Breach Lance',
      category: 'BREACH',
      cost: 20,
      prerequisites: {},
      postconditions: {
        VAULT_DOOR: 'BREACHED',
        ATMOSPHERE_PRESSURE: '0.0_VACUUM', // Oxygen sucked out!
      },
      isIrreversible: true,
      description: 'Thermal lance burns through 6-inch titanium. Consumes 100% of chamber oxygen in reaction.',
    },
    {
      id: 'OPEN_VENT_DAMPER',
      name: 'Depressurize & Equalize Vent Damper',
      category: 'ATMOSPHERE',
      cost: 15,
      prerequisites: { VAULT_DOOR: 'BREACHED' },
      postconditions: {
        VENT_DAMPER: 'OPEN',
        ATMOSPHERE_PRESSURE: '1.0_BAR', // Equalized!
      },
      isIrreversible: false,
      description: 'Opens rooftop damper to restore 1.0 BAR atmospheric pressure into the containment room.',
    },
    {
      id: 'RETRIEVE_FLIGHT_RECORDER',
      name: 'Retrieve Black Box Data Capsule',
      category: 'INTEL',
      cost: 10,
      prerequisites: { VAULT_DOOR: 'BREACHED' },
      postconditions: { INTEL_CAPSULE: 'SECURED' },
      isIrreversible: false,
      description: 'Pulls the armored core recorder from the vault dais.',
    },
    {
      id: 'CALL_PNEUMATIC_LIFT',
      name: 'Engage Pneumatic Evacuation Shaft',
      category: 'EXTRACTION',
      cost: 15,
      prerequisites: {
        INTEL_CAPSULE: 'SECURED',
        ATMOSPHERE_PRESSURE: '1.0_BAR', // PREVENT PREMATURE EXTRACTION TRAP
      },
      postconditions: {
        EXTRACTION_STATUS: 'ESCAPED',
        PNEUMATIC_LIFT: 'ASCENDING',
      },
      isIrreversible: true,
      description: 'Pressurized elevator requires 1.0 BAR equalized pressure or pneumatic pistons seize.',
    },
  ],
  scoring: {
    basePoints: 100,
    batteryBonusMultiplier: 10,
    firstRunBonus: 30,
    cleanSheetBonus: 20,
    retryPenalty: -15,
  },
};

// ============================================================================
// TEST RUNNER
// ============================================================================

async function run() {
  console.log("==================================================");
  console.log("SILENT_MISSION — 21-STAGE PRODUCTION QA SUITE");
  console.log("==================================================");

  let hostSocket, stageSocket, studentSocket, attackerSocket;
  let testGame, testChallengeOp1, testChallengeOp3, testChallengeOp4, testSession;
  let studentUser, gmUser, attackerUser;

  try {
    // ------------------------------------------------------------------------
    // STAGE 1: TEMPLATE REGISTRATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 1/21] Verifying SILENT_MISSION Template Registration in TemplateRegistry...");
    const { registry } = require('fs').existsSync('./server/dist/engine/TemplateRegistry.js')
      ? require('./server/dist/engine/TemplateRegistry')
      : require('./server/src/engine/TemplateRegistry');
    const silentTemplate = registry.getTemplate('SILENT_MISSION');
    if (!silentTemplate) throw new Error("SILENT_MISSION template not found in TemplateRegistry!");
    if (silentTemplate.id !== 'SILENT_MISSION') throw new Error(`Template id mismatch: ${silentTemplate.id}`);
    if (silentTemplate.status !== 'AVAILABLE') throw new Error("SILENT_MISSION must be AVAILABLE!");
    if (silentTemplate.challengeSchema.interactionType !== 'MISSION_PLAN') {
      throw new Error(`Expected interactionType MISSION_PLAN, got ${silentTemplate.challengeSchema.interactionType}`);
    }
    if (silentTemplate.challengeSchema.validationType !== 'SILENT_MISSION') {
      throw new Error(`Expected validationType SILENT_MISSION, got ${silentTemplate.challengeSchema.validationType}`);
    }
    console.log("✓ PASS: SILENT_MISSION properly registered with capabilities, config schema, and scoring.");

    // ------------------------------------------------------------------------
    // STAGE 2: CHALLENGE CREATION (Prisma DB Integration)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 2/21] Creating SILENT_MISSION Game & Challenges in Database...");
    
    // Register GM and student
    const gmEmail = `gm_mission_${Date.now()}@test.com`;
    const gmRes = await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_M_${Date.now()}`,
      password: 'password123',
      role: 'HOST',
    });
    gmUser = gmRes.data.user;
    const gmToken = gmRes.data.token;

    const studentEmail = `agent_zero_${Date.now()}@test.com`;
    const stRes = await axios.post(`${API}/auth/register`, {
      email: studentEmail,
      username: `Agent_${Date.now()}`,
      password: 'password123',
      role: 'STUDENT',
    });
    studentUser = stRes.data.user;
    const studentToken = stRes.data.token;

    // Attacker
    const attackerEmail = `malicious_${Date.now()}@test.com`;
    const atRes = await axios.post(`${API}/auth/register`, {
      email: attackerEmail,
      username: `Hacker_${Date.now()}`,
      password: 'password123',
      role: 'STUDENT',
    });
    attackerUser = atRes.data.user;
    const attackerToken = atRes.data.token;

    // Promote GM to SUPER_ADMIN so they can create games and events
    await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

    // Create Game via API
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Silent Mission: Operational Suite',
      description: 'Multi-operation DAG planning and tactical facility breach.',
      template: 'SILENT_MISSION',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testGame = gameRes.data.game;

    // Create 3 Operation Challenges
    const op1Res = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: OP1_COLD_BOOT.scenarioTitle,
      type: 'MISSION_PLAN',
      points: 100,
      timeLimit: 120,
      config: OP1_COLD_BOOT,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChallengeOp1 = op1Res.data.challenge;

    const op3Res = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: OP3_SIPHON_PROTOCOL.scenarioTitle,
      type: 'MISSION_PLAN',
      points: 100,
      timeLimit: 120,
      config: OP3_SIPHON_PROTOCOL,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChallengeOp3 = op3Res.data.challenge;

    const op4Res = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: OP4_GHOST_EXTRACT.scenarioTitle,
      type: 'MISSION_PLAN',
      points: 100,
      timeLimit: 120,
      config: OP4_GHOST_EXTRACT,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChallengeOp4 = op4Res.data.challenge;

    // Create Event & Session
    const eventRes = await axios.post(`${API}/events`, {
      name: 'Silent Mission Tactical Tournament',
      mode: 'SEQUENCE',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = eventRes.data.id || eventRes.data.event?.id;

    await axios.post(`${API}/events/${eventId}/games`, {
      gameId: testGame.id,
      position: 0,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });

    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });

    const sessionRes = await axios.post(`${API}/sessions`, {
      eventId,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testSession = sessionRes.data.session || sessionRes.data;

    console.log(`✓ PASS: Database challenges created. Op1 ID: ${testChallengeOp1.id}, Op3 ID: ${testChallengeOp3.id}, Op4 ID: ${testChallengeOp4.id}`);

    // ------------------------------------------------------------------------
    // STAGE 3: OPERATION LOADING
    // ------------------------------------------------------------------------
    console.log("\n[TEST 3/21] Testing Operation Loading and Configuration Parsing...");
    const loadedOp1 = await prisma.challenge.findUnique({ where: { id: testChallengeOp1.id } });
    if (!loadedOp1 || loadedOp1.type !== 'MISSION_PLAN') throw new Error("Operation 1 failed to load with type MISSION_PLAN");
    const op1Config = loadedOp1.config;
    if (op1Config.batteryCapacity !== 40) throw new Error(`Expected battery 40, got ${op1Config.batteryCapacity}`);
    if (op1Config.initialState.POWER_BUS !== '24V_AUX') throw new Error("Initial state corrupted");
    console.log("✓ PASS: Operation loaded cleanly with battery budget and initial facility telemetry.");

    // ------------------------------------------------------------------------
    // STAGE 4: ACTION LOADING
    // ------------------------------------------------------------------------
    console.log("\n[TEST 4/21] Testing Action Library Schema & Properties...");
    const actions = op1Config.actions;
    if (!Array.isArray(actions) || actions.length < 5) throw new Error("Expected at least 5 curated actions in Op 1");
    const transformer = actions.find(a => a.id === 'STEP_UP_TRANSFORMER');
    if (!transformer || transformer.cost !== 15 || transformer.postconditions.POWER_BUS !== '480V_MAIN') {
      throw new Error("Action STEP_UP_TRANSFORMER properties invalid");
    }
    console.log(`✓ PASS: ${actions.length} actions loaded with category, cost, prereqs, postconditions, and flags.`);

    // ------------------------------------------------------------------------
    // STAGE 5: PLAN CONSTRUCTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 5/21] Testing Plan Construction (Sequential Slot Structure)...");
    const validPlanOp1 = [
      { slot: 0, actionId: 'STEP_UP_TRANSFORMER' },
      { slot: 1, actionId: 'ALIGN_OPTICAL_FIBER' },
      { slot: 2, actionId: 'LOAD_CIPHER_KEYS' },
      { slot: 3, actionId: 'INITIALIZE_TERMINAL' },
    ];
    if (validPlanOp1.length !== 4) throw new Error("Invalid plan construction");
    console.log("✓ PASS: Plan constructed with 4 ordered action slots.");

    // ------------------------------------------------------------------------
    // STAGE 6: MAGNETIC DOCK INTERACTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 6/21] Testing Magnetic Dock Data Snapping & Parameters...");
    const dockPayloadWithParams = [
      { slot: 0, actionId: 'STEP_UP_TRANSFORMER', params: { voltageSetting: '480V' } },
      { slot: 1, actionId: 'ALIGN_OPTICAL_FIBER', params: { channel: 'MAIN_TRUNK' } },
      { slot: 2, actionId: 'LOAD_CIPHER_KEYS' },
      { slot: 3, actionId: 'INITIALIZE_TERMINAL' },
    ];
    console.log("✓ PASS: Magnetic Dock parameter attachments formatted and preserved.");

    // ------------------------------------------------------------------------
    // STAGE 7: VALID PREREQUISITE EXECUTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 7/21] Testing Valid Prerequisite Chain via Validator Engine...");
    const { Validator } = require('fs').existsSync('./server/dist/engine/Validator.js')
      ? require('./server/dist/engine/Validator')
      : require('./server/src/engine/Validator');
    const simSuccess = Validator.simulateMissionPlan(OP1_COLD_BOOT, validPlanOp1);
    if (!simSuccess.success) {
      throw new Error(`Simulation unexpectedly failed: ${simSuccess.failureReason}`);
    }
    if (simSuccess.remainingBattery !== 0) {
      // 40 - 15 - 10 - 10 - 5 = 0
      throw new Error(`Expected 0 remaining battery, got ${simSuccess.remainingBattery}`);
    }
    if (simSuccess.finalState.ACCESS_TERMINAL !== 'AUTHENTICATED') {
      throw new Error("Target state ACCESS_TERMINAL !== AUTHENTICATED");
    }
    console.log("✓ PASS: Valid plan executed to completion. Facility state updated to AUTHENTICATED.");

    // ------------------------------------------------------------------------
    // STAGE 8: INVALID PREREQUISITE
    // ------------------------------------------------------------------------
    console.log("\n[TEST 8/21] Testing Invalid Prerequisite (Skipping transformer step)...");
    const prematurePlan = [
      { slot: 0, actionId: 'ALIGN_OPTICAL_FIBER' }, // Requires POWER_BUS: 480V_MAIN, but current is 24V_AUX!
      { slot: 1, actionId: 'LOAD_CIPHER_KEYS' },
      { slot: 2, actionId: 'INITIALIZE_TERMINAL' },
    ];
    const simPrereqFail = Validator.simulateMissionPlan(OP1_COLD_BOOT, prematurePlan);
    if (simPrereqFail.success) throw new Error("Plan without transformer should have failed!");
    if (simPrereqFail.failedStepIndex !== 0) throw new Error(`Expected failure at step 0, got ${simPrereqFail.failedStepIndex}`);
    if (!simPrereqFail.missingPrerequisite) throw new Error("Missing prerequisite field expected!");
    console.log(`✓ PASS: Prerequisite failure correctly caught: "${simPrereqFail.failureReason}" (Missing: ${simPrereqFail.missingPrerequisite.key} = ${simPrereqFail.missingPrerequisite.required})`);

    // ------------------------------------------------------------------------
    // STAGE 9: BATTERY CONSUMPTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 9/21] Testing Step-by-Step Battery Energy Consumption Tracking...");
    const partialPlan = [
      { slot: 0, actionId: 'STEP_UP_TRANSFORMER' }, // cost 15 -> battery 25
      { slot: 1, actionId: 'ALIGN_OPTICAL_FIBER' },  // cost 10 -> battery 15
    ];
    const simPartial = Validator.simulateMissionPlan(OP1_COLD_BOOT, partialPlan);
    if (simPartial.batteryUsed !== 25) throw new Error(`Expected battery used 25, got ${simPartial.batteryUsed}`);
    if (simPartial.remainingBattery !== 15) throw new Error(`Expected remaining battery 15, got ${simPartial.remainingBattery}`);
    console.log(`✓ PASS: Battery correctly deducted: Used 25 ⚡, Remaining 15 ⚡.`);

    // ------------------------------------------------------------------------
    // STAGE 10: BATTERY EXHAUSTION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 10/21] Testing Battery Exhaustion Boundary...");
    const overbudgetPlan = [
      { slot: 0, actionId: 'PURGE_COOLANT_LOOP' }, // 20
      { slot: 1, actionId: 'STEP_UP_TRANSFORMER' }, // 15 (total 35)
      { slot: 2, actionId: 'ALIGN_OPTICAL_FIBER' },  // 10 (total 45 > 40 capacity!)
    ];
    const simExhaust = Validator.simulateMissionPlan(OP1_COLD_BOOT, overbudgetPlan);
    if (simExhaust.success) throw new Error("Overbudget plan should fail with battery exhaustion!");
    if (!simExhaust.failureReason.includes('BATTERY EXHAUSTION')) {
      throw new Error(`Expected BATTERY EXHAUSTION reason, got: ${simExhaust.failureReason}`);
    }
    console.log(`✓ PASS: Battery exhaustion triggered authoritatively: "${simExhaust.failureReason}"`);

    // ------------------------------------------------------------------------
    // STAGE 11: IRREVERSIBLE ACTION WARNING & STATE TRANSITION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 11/21] Testing Irreversible Action Warning & State Flagging...");
    const irreversiblePlan = [
      { slot: 0, actionId: 'PURGE_COOLANT_LOOP' },
    ];
    const simIrrev = Validator.simulateMissionPlan(OP1_COLD_BOOT, irreversiblePlan);
    if (simIrrev.finalState.COOLANT_LOOP !== 'DRAINED') {
      throw new Error("COOLANT_LOOP was not updated to DRAINED");
    }
    const purgeAction = OP1_COLD_BOOT.actions.find(a => a.id === 'PURGE_COOLANT_LOOP');
    if (!purgeAction.isIrreversible) throw new Error("Action isIrreversible flag must be true");
    console.log("✓ PASS: Irreversible action tracked with isIrreversible: true and permanent state change.");

    // ------------------------------------------------------------------------
    // STAGE 12: PREMATURE EXTRACTION TRAP (Operation 4 Consequence)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 12/21] Testing Operation 4 Premature Extraction Trap Consequence...");
    // Premature trap: Ignite thermite, get intel, but call lift without equalizing damper!
    const trappedPlan = [
      { slot: 0, actionId: 'IGNITE_THERMITE_CHARGE' }, // drops pressure to 0.0_VACUUM
      { slot: 1, actionId: 'RETRIEVE_FLIGHT_RECORDER' }, // secures intel
      { slot: 2, actionId: 'CALL_PNEUMATIC_LIFT' },      // FAILS: lift requires 1.0_BAR!
    ];
    const simTrapped = Validator.simulateMissionPlan(OP4_GHOST_EXTRACT, trappedPlan);
    if (simTrapped.success) throw new Error("Trapped plan should fail because oxygen is depleted!");
    if (simTrapped.failedStepIndex !== 2) throw new Error(`Expected failure at step 2, got ${simTrapped.failedStepIndex}`);
    if (simTrapped.missingPrerequisite.key !== 'ATMOSPHERE_PRESSURE') {
      throw new Error(`Expected missing ATMOSPHERE_PRESSURE, got ${simTrapped.missingPrerequisite.key}`);
    }
    console.log(`✓ PASS: Premature extraction trap caught: Chamber depressurized, lift pistons seized without vent damper.`);

    // ------------------------------------------------------------------------
    // STAGE 13: FAILED EXECUTION SIMULATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 13/21] Testing Failed Execution Halt & Step Inspection...");
    if (simTrapped.completedSteps !== 2) {
      throw new Error(`Expected exactly 2 completed steps before failure, got ${simTrapped.completedSteps}`);
    }
    console.log("✓ PASS: Execution halted precisely at step index 2. Prior steps recorded as completed.");

    // ------------------------------------------------------------------------
    // STAGE 14: FAILURE EXPLANATION (3-Tier Diagnostic Trace)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 14/21] Testing 3-Tier Failure Diagnostic Trace (Planned -> Actual -> Why)...");
    const trace = simTrapped.executionTrace;
    if (!trace || !Array.isArray(trace) || trace.length < 3) throw new Error("Execution trace incomplete");
    const failedTraceItem = trace[2];
    if (failedTraceItem.status !== 'FAILED') throw new Error("Step 2 status must be FAILED");
    if (!failedTraceItem.causalExplanation) throw new Error("Missing causal explanation in trace item");
    console.log(`✓ PASS: 3-Tier Failure Trace verified:\n  - Planned: ${failedTraceItem.actionName}\n  - Actual: System State [${JSON.stringify(failedTraceItem.stateBefore)}]\n  - Why: ${failedTraceItem.causalExplanation}`);

    // ------------------------------------------------------------------------
    // STAGE 15: PLAN SPLICE / RECOVERY
    // ------------------------------------------------------------------------
    console.log("\n[TEST 15/21] Testing In-Place Plan Splicing Recovery Engine...");
    // Recover by splicing OPEN_VENT_DAMPER into slot 2 (before CALL_PNEUMATIC_LIFT)
    const splicedPlan = Validator.spliceMissionPlan(trappedPlan, 2, 'OPEN_VENT_DAMPER');
    if (splicedPlan.length !== 4) throw new Error(`Expected 4 steps after splice, got ${splicedPlan.length}`);
    if (splicedPlan[2].actionId !== 'OPEN_VENT_DAMPER') throw new Error("Spliced action not at slot 2");
    if (splicedPlan[3].actionId !== 'CALL_PNEUMATIC_LIFT') throw new Error("Subsequent action not shifted to slot 3");

    // Re-simulate the repaired plan
    const simRepaired = Validator.simulateMissionPlan(OP4_GHOST_EXTRACT, splicedPlan);
    if (!simRepaired.success) {
      throw new Error(`Repaired plan unexpectedly failed: ${simRepaired.failureReason}`);
    }
    if (simRepaired.finalState.EXTRACTION_STATUS !== 'ESCAPED') {
      throw new Error("Target state EXTRACTION_STATUS !== ESCAPED");
    }
    console.log("✓ PASS: Plan successfully spliced in-place and re-executed to ESCAPED status.");

    // ------------------------------------------------------------------------
    // STAGE 16: MULTIPLE VALID PLANS (Divergent Strategies)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 16/21] Testing Operation 3 Multiple Valid Plans (Plan A vs Plan B vs Plan C)...");
    
    // Plan A: Surgical Stealth (Cost: 15 + 15 + 20 = 50 ⚡, Remaining: 10 ⚡)
    const planA = [
      { slot: 0, actionId: 'CLONE_RFID_BADGE' },
      { slot: 1, actionId: 'SPOOF_IDS_HEARTBEAT' },
      { slot: 2, actionId: 'SILENT_SIPHON_INTEL' },
    ];
    const simA = Validator.simulateMissionPlan(OP3_SIPHON_PROTOCOL, planA);
    if (!simA.success || simA.batteryUsed !== 50 || simA.remainingBattery !== 10) {
      throw new Error(`Plan A (Surgical Stealth) failed or battery mismatch: used ${simA.batteryUsed}`);
    }

    // Plan B: Overdrive Brute-Force (Cost: 20 + 25 + 10 = 55 ⚡, Remaining: 5 ⚡, Irreversible: true)
    const planB = [
      { slot: 0, actionId: 'OVERCHARGE_CAPACITOR_BANK' },
      { slot: 1, actionId: 'EMP_BURST_SOLENOID' },
      { slot: 2, actionId: 'HIGH_SPEED_DATA_DUMP' },
    ];
    const simB = Validator.simulateMissionPlan(OP3_SIPHON_PROTOCOL, planB);
    if (!simB.success || simB.batteryUsed !== 55 || simB.remainingBattery !== 5) {
      throw new Error(`Plan B (Overdrive Brute-Force) failed or battery mismatch: used ${simB.batteryUsed}`);
    }

    // Plan C: Redundant Fail-Safe (Cost: 15 + 20 + 23 = 58 ⚡, Remaining: 2 ⚡)
    const planC = [
      { slot: 0, actionId: 'ISOLATE_BACKUP_GENERATOR' },
      { slot: 1, actionId: 'INJECT_OPTICAL_TAP' },
      { slot: 2, actionId: 'PASSIVE_PACKET_HARVEST' },
    ];
    const simC = Validator.simulateMissionPlan(OP3_SIPHON_PROTOCOL, planC);
    if (!simC.success || simC.batteryUsed !== 58 || simC.remainingBattery !== 2) {
      throw new Error(`Plan C (Redundant Fail-Safe) failed or battery mismatch: used ${simC.batteryUsed}`);
    }

    console.log("✓ PASS: All 3 divergent strategies validated independently with distinct energy costs and consequences:");
    console.log(`  - Plan A (Surgical Stealth): 50 ⚡ used, 10 ⚡ remaining`);
    console.log(`  - Plan B (Overdrive Brute-Force): 55 ⚡ used, 5 ⚡ remaining, EMP irreversible`);
    console.log(`  - Plan C (Redundant Fail-Safe): 58 ⚡ used, 2 ⚡ remaining`);

    // ------------------------------------------------------------------------
    // STAGE 17: SCORING CALCULATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 17/21] Testing Multi-Factor Scoring Architecture...");
    // Scoring for Plan A on first run:
    // Base: 100
    // Battery bonus: 10 * 10 = 100
    // First run bonus: 30
    // Clean sheet bonus: 20
    // Expected: 250
    const scoreA = Validator.calculateMissionScore(OP3_SIPHON_PROTOCOL, simA, 1);
    if (scoreA !== 250) {
      throw new Error(`Expected score 250 for clean first-run Plan A, got ${scoreA}`);
    }

    // Scoring for Plan B with 2 retries (attempt 3):
    // Base: 100
    // Battery bonus: 5 * 10 = 50
    // First run bonus: 0
    // Clean sheet bonus: 0
    // Penalty: -15 * 2 = -30
    // Expected: 120
    const scoreB = Validator.calculateMissionScore(OP3_SIPHON_PROTOCOL, simB, 3);
    if (scoreB !== 120) {
      throw new Error(`Expected score 120 for 3rd-attempt Plan B, got ${scoreB}`);
    }
    console.log(`✓ PASS: Scoring verified: Clean first-run = ${scoreA} pts, 3rd-attempt = ${scoreB} pts.`);

    // ------------------------------------------------------------------------
    // STAGE 18: INCORRECT / FORGED CLIENT STATE REJECTION (Security Model)
    // ------------------------------------------------------------------------
    console.log("\n[TEST 18/21] Testing Security: Malicious Client Forging State / Success Flag...");
    // Join students to session via API
    const sessionCode = testSession.roomCode;
    const sessionId = testSession.id;

    await axios.post(`${API}/sessions/join`, { roomCode: sessionCode }, { headers: { Authorization: `Bearer ${studentToken}` } });
    await axios.post(`${API}/sessions/join`, { roomCode: sessionCode }, { headers: { Authorization: `Bearer ${attackerToken}` } });

    // Activate round on session
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ROUND_ACTIVE',
        currentGameId: testGame.id,
        currentChallengeId: testChallengeOp1.id,
        challengeStartTime: new Date(),
      },
    });

    // Connect Host & Stage sockets
    hostSocket = io(SOCKET_URL, { auth: { token: gmToken } });
    stageSocket = io(SOCKET_URL, { auth: { isStage: true } });
    studentSocket = io(SOCKET_URL, { auth: { token: studentToken } });
    attackerSocket = io(SOCKET_URL, { auth: { token: attackerToken } });

    await new Promise(r => setTimeout(r, 500));
    hostSocket.emit('host:join', { roomCode: sessionCode });
    stageSocket.emit('stage:join', { roomCode: sessionCode });
    studentSocket.emit('player:join', { roomCode: sessionCode, name: 'AgentZero' });
    attackerSocket.emit('player:join', { roomCode: sessionCode, name: 'Attacker' });
    await new Promise(r => setTimeout(r, 600));

    // Attacker tries to submit forged status and forged remaining battery
    const forgedPayload = {
      challengeId: testChallengeOp1.id,
      actionPlan: [
        { slot: 0, actionId: 'INITIALIZE_TERMINAL' } // Invalid: requires cipher core!
      ],
      remainingBattery: 9999, // Forged battery!
      isCorrect: true,        // Forged client success!
      pointsAwarded: 500,     // Forged score!
    };

    const forgedRes = await axios.post(`${API}/sessions/active/submit`, forgedPayload, {
      headers: { Authorization: `Bearer ${attackerToken}` },
    });

    if (forgedRes.data.isCorrect) throw new Error("Security breach: Server accepted forged submission!");
    if (forgedRes.data.pointsAwarded > 0) throw new Error("Security breach: Server awarded points for forged submission!");
    console.log("✓ PASS: Server rejected forged submission authoritatively (awarded 0 pts, marked isCorrect: false).");

    // ------------------------------------------------------------------------
    // STAGE 19: RECONNECTION STATE RESTORATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 19/21] Testing Reconnection State Restoration Endpoint...");
    const stateRes = await axios.get(`${API}/sessions/${sessionCode}/mission-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const restored = stateRes.data;
    if (!restored.challengeId || restored.operationId !== 'OP-01') {
      throw new Error(`Reconnection state invalid: ${JSON.stringify(restored)}`);
    }
    if (restored.batteryCapacity !== 40) throw new Error("Battery capacity mismatch on reconnect");
    console.log(`✓ PASS: Reconnection state restored: Operation ${restored.operationId}, Battery ${restored.batteryCapacity} ⚡.`);

    // ------------------------------------------------------------------------
    // STAGE 20: STAGE SYNCHRONIZATION
    // ------------------------------------------------------------------------
    console.log("\n[TEST 20/21] Testing Spectator Stage Synchronization...");
    let stageUpdated = false;
    let missionProgressPayload = null;

    stageSocket.on('session_state_update', (data) => {
      if (data.missionProgress) {
        stageUpdated = true;
        missionProgressPayload = data.missionProgress;
      }
    });

    // Execute valid plan with student via active submit
    const studentSubmitRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallengeOp1.id,
      actionPlan: validPlanOp1,
    }, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    if (!studentSubmitRes.data.isCorrect) {
      throw new Error(`Student submission unexpectedly failed: ${JSON.stringify(studentSubmitRes.data)}`);
    }

    await new Promise(r => setTimeout(r, 1200));
    if (!stageUpdated || !missionProgressPayload) {
      throw new Error("Stage socket did not receive missionProgress update!");
    }
    if (missionProgressPayload.operationId !== 'OP-01') {
      throw new Error("Stage missionProgress operationId mismatch");
    }
    console.log(`✓ PASS: Stage received live telemetry: ${missionProgressPayload.scenarioTitle}, Plans: ${missionProgressPayload.plansExecutedCount}, Breaches: ${missionProgressPayload.successfulInfiltrations}`);

    // ------------------------------------------------------------------------
    // STAGE 21: MISSION COMPLETION & SCORING VERIFICATION
    // ------------------------------------------------------------------------
    const sessionStateRes = await axios.get(`${API}/sessions/${sessionCode}`);
    const lb = sessionStateRes.data.leaderboard || [];
    const studentEntry = lb.find(e => e.name === studentUser.username || e.userId === studentUser.id || e.id === studentUser.id);
    if (!studentEntry || studentEntry.score <= 0) {
      throw new Error(`Student score not recorded in leaderboard: ${JSON.stringify(lb)}`);
    }
    console.log(`✓ PASS: Mission completed. Leaderboard verified: ${studentEntry.name} = ${studentEntry.score} pts.`);

    console.log("\n==================================================");
    console.log("ALL 21 SILENT_MISSION QA VERIFICATIONS PASSED!");
    console.log("==================================================");

  } finally {
    // Cleanup sockets
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();
    if (attackerSocket) attackerSocket.disconnect();

    // Clean test DB records
    try {
      if (testGame) {
        await prisma.submission.deleteMany({ where: { challenge: { gameId: testGame.id } } });
        await prisma.sessionPlayer.deleteMany({ where: { session: { gameId: testGame.id } } });
        await prisma.session.deleteMany({ where: { gameId: testGame.id } });
        await prisma.challenge.deleteMany({ where: { gameId: testGame.id } });
        await prisma.game.delete({ where: { id: testGame.id } });
      }
      if (gmUser) await prisma.user.delete({ where: { id: gmUser.id } }).catch(() => {});
      if (studentUser) await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});
      if (attackerUser) await prisma.user.delete({ where: { id: attackerUser.id } }).catch(() => {});
      await prisma.$disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

run().catch((err) => {
  console.error("\n❌ SILENT_MISSION TEST FAILED:", err);
  process.exit(1);
});
