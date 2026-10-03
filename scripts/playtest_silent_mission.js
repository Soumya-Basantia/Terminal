const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const prisma = new PrismaClient();

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
        ATMOSPHERE_PRESSURE: '0.0_VACUUM',
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
        ATMOSPHERE_PRESSURE: '1.0_BAR',
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
        ATMOSPHERE_PRESSURE: '1.0_BAR',
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

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`PASS: ${message}`);
}

async function runHumanPlaytest() {
  console.log('====================================================');
  console.log('SILENT_MISSION — 11-STAGE HUMAN PLAYTEST SUITE');
  console.log('====================================================\n');

  let testPassed = 0;
  const totalTests = 11;

  try {
    // -------------------------------------------------------------
    // STAGE 1: JOIN / FIRST IMPRESSION
    // -------------------------------------------------------------
    console.log('--- STAGE 1: JOIN / FIRST IMPRESSION ---');
    const timestamp = Date.now();
    const gmRes = await axios.post(`${API}/auth/register`, {
      email: `gm_playtest_${timestamp}@test.com`,
      username: `GM_Play_${timestamp}`,
      password: 'password123',
      role: 'HOST',
    });
    const gmUser = gmRes.data.user;
    const gmToken = gmRes.data.token;
    await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

    const p1Res = await axios.post(`${API}/auth/register`, {
      email: `student1_${timestamp}@test.com`,
      username: `Cadet_1_${timestamp}`,
      password: 'password123',
      role: 'STUDENT',
    });
    const p1Token = p1Res.data.token;

    const p2Res = await axios.post(`${API}/auth/register`, {
      email: `student2_${timestamp}@test.com`,
      username: `Cadet_2_${timestamp}`,
      password: 'password123',
      role: 'STUDENT',
    });
    const p2Token = p2Res.data.token;

    // Create Game via API
    const gameRes = await axios.post(`${API}/games`, {
      name: `SILENT_MISSION Playtest ${timestamp}`,
      description: 'Human Playtest Mission Operations Suite',
      template: 'SILENT_MISSION',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const game = gameRes.data.game;

    const op1Res = await axios.post(`${API}/games/${game.id}/challenges`, {
      prompt: OP1_COLD_BOOT.scenarioTitle,
      type: 'MISSION_PLAN',
      points: 100,
      timeLimit: 120,
      config: OP1_COLD_BOOT,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const op1Challenge = op1Res.data.challenge;

    const op4Res = await axios.post(`${API}/games/${game.id}/challenges`, {
      prompt: OP4_GHOST_EXTRACT.scenarioTitle,
      type: 'MISSION_PLAN',
      points: 100,
      timeLimit: 120,
      config: OP4_GHOST_EXTRACT,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const op4Challenge = op4Res.data.challenge;

    // Create Event & Link Game
    const eventRes = await axios.post(`${API}/events`, {
      name: `Playtest Event ${timestamp}`,
      description: 'SILENT_MISSION Human Validation',
      mode: 'SEQUENCE',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = eventRes.data.id || eventRes.data.event?.id;

    await axios.post(`${API}/events/${eventId}/games`, {
      gameId: game.id,
      position: 0,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });

    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });

    const sessionRes = await axios.post(`${API}/sessions`, { eventId }, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });
    const roomCode = sessionRes.data.session.roomCode;
    console.log(`Created test session room: ${roomCode}`);

    // Join Players
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${p1Token}` } });
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${p2Token}` } });

    // Host starts session
    await axios.post(`${API}/sessions/${roomCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    // P1 inspects mission state (Join / First Impression)
    const stateRes = await axios.get(`${API}/sessions/${roomCode}/mission-state?challengeId=${op1Challenge.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` },
    });
    const state = stateRes.data;

    assert(state.operationId === 'OP-01', 'Operation ID is OP-01');
    assert(state.scenarioTitle.includes('COLD BOOT'), 'Scenario title communicates mission objective');
    assert(state.batteryCapacity === 40, 'Battery capacity is 40⚡');
    assert(state.initialState.POWER_BUS === '24V_AUX', 'Initial state communicates power restriction');
    assert(state.targetState.ACCESS_TERMINAL === 'AUTHENTICATED', 'Target end state is obvious and explicit');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 2: MISSION STATE
    // -------------------------------------------------------------
    console.log('\n--- STAGE 2: MISSION STATE ---');
    assert(Array.isArray(state.actions) && state.actions.length === 5, 'Actions library populated with 5 operational modules');
    assert(state.actions.every(a => a.cost > 0), 'Every action has a clear battery energy cost');
    assert(state.remainingBattery === 40, 'Player starts with 100% full battery budget');
    assert(state.isCompleted === false, 'Mission state is uncompleted on entry');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 3: ACTION PLANNING (Prerequisite Violations & Causality)
    // -------------------------------------------------------------
    console.log('\n--- STAGE 3: ACTION PLANNING ---');
    // First-time player tries to authenticate console directly without powering grid or injecting keys
    const invalidPlan = [
      { slot: 0, actionId: 'INITIALIZE_TERMINAL' },
    ];
    const invalidExecRes = await axios.post(`${API}/sessions/${roomCode}/mission-execute`, {
      challengeId: op1Challenge.id,
      actionPlan: invalidPlan,
    }, { headers: { Authorization: `Bearer ${p1Token}` } });

    const invalidSim = invalidExecRes.data.simulation;
    assert(invalidSim.isSuccess === false, 'Invalid plan correctly rejected');
    assert(invalidSim.failedStepIndex === 0, 'Failed at first step due to unmet prerequisite');
    assert(invalidSim.failureExplanation.includes('CIPHER_CORE'), 'Failure notice clearly explains why action failed: missing CIPHER_CORE==READY');
    assert(invalidSim.remainingBattery === 39, 'Player charged 1⚡ stall penalty for planning error');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 4: RESOURCE / BATTERY MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- STAGE 4: RESOURCE / BATTERY MANAGEMENT ---');
    // Plan that exceeds battery capacity: Purge coolant (20) + Transformer (15) + Fiber (10) = 45 > 40
    const batteryOverloadPlan = [
      { slot: 0, actionId: 'PURGE_COOLANT_LOOP' }, // 20 cost, rem: 20
      { slot: 1, actionId: 'STEP_UP_TRANSFORMER' }, // 15 cost, rem: 5
      { slot: 2, actionId: 'ALIGN_OPTICAL_FIBER' }, // 10 cost -> Exhaustion!
    ];
    const overloadRes = await axios.post(`${API}/sessions/${roomCode}/mission-execute`, {
      challengeId: op1Challenge.id,
      actionPlan: batteryOverloadPlan,
    }, { headers: { Authorization: `Bearer ${p1Token}` } });

    const overloadSim = overloadRes.data.simulation;
    assert(overloadSim.isSuccess === false, 'Overloaded plan correctly halted');
    assert(overloadSim.failureExplanation.includes('BATTERY EXHAUSTION'), 'Explains BATTERY EXHAUSTION clearly: required 10, remaining 5');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 5: MAGNETIC DOCK DATA SNAPPING & SPLICING
    // -------------------------------------------------------------
    console.log('\n--- STAGE 5: MAGNETIC DOCK DATA SNAPPING & SPLICING ---');
    const { Validator: V } = require('../server/dist/engine');
    const existingStalledPlan = [
      { slot: 0, actionId: 'STEP_UP_TRANSFORMER' },
      { slot: 1, actionId: 'LOAD_CIPHER_KEYS' }, // Missing ALIGN_OPTICAL_FIBER between slot 0 and 1!
      { slot: 2, actionId: 'INITIALIZE_TERMINAL' },
    ];
    // In-place splice ALIGN_OPTICAL_FIBER at index 1
    const splicedPlan = V.spliceMissionPlan(existingStalledPlan, 1, 'ALIGN_OPTICAL_FIBER');
    assert(splicedPlan.length === 4, 'Spliced plan expanded to 4 sequential slots');
    assert(splicedPlan[1].actionId === 'ALIGN_OPTICAL_FIBER', 'ALIGN_OPTICAL_FIBER successfully spliced into slot 1');
    assert(splicedPlan[2].actionId === 'LOAD_CIPHER_KEYS', 'Subsequent actions re-indexed smoothly');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 6: EXTRACTION & PREMATURE EXTRACTION TRAP (OP-04)
    // -------------------------------------------------------------
    console.log('\n--- STAGE 6: EXTRACTION & PREMATURE EXTRACTION TRAP (OP-04) ---');
    // In OP-04: Thermite lance burns titanium door but vents chamber oxygen to 0.0_VACUUM.
    // If player immediately calls lift without equalizing ventilation, pistons seize in vacuum!
    const prematureExtractionPlan = [
      { slot: 0, actionId: 'IGNITE_THERMITE_CHARGE' },
      { slot: 1, actionId: 'RETRIEVE_FLIGHT_RECORDER' },
      { slot: 2, actionId: 'CALL_PNEUMATIC_LIFT' }, // Trapped! ATMOSPHERE_PRESSURE is 0.0_VACUUM!
    ];
    const op4TrapRes = await axios.post(`${API}/sessions/${roomCode}/mission-execute`, {
      challengeId: op4Challenge.id,
      actionPlan: prematureExtractionPlan,
    }, { headers: { Authorization: `Bearer ${p1Token}` } });

    const trapSim = op4TrapRes.data.simulation;
    assert(trapSim.isSuccess === false, 'Premature extraction trap successfully caught');
    assert(trapSim.failedStepIndex === 2, 'Stalled precisely on extraction lift step');
    assert(trapSim.failureExplanation.includes('ATMOSPHERE_PRESSURE'), 'Trap explicitly warns: lift requires 1.0_BAR, but current is 0.0_VACUUM');

    // Now rescue team by inserting OPEN_VENT_DAMPER before CALL_PNEUMATIC_LIFT
    const rescuedPlan = [
      { slot: 0, actionId: 'IGNITE_THERMITE_CHARGE' },
      { slot: 1, actionId: 'RETRIEVE_FLIGHT_RECORDER' },
      { slot: 2, actionId: 'OPEN_VENT_DAMPER' },
      { slot: 3, actionId: 'CALL_PNEUMATIC_LIFT' },
    ];
    const rescueRes = await axios.post(`${API}/sessions/${roomCode}/mission-execute`, {
      challengeId: op4Challenge.id,
      actionPlan: rescuedPlan,
    }, { headers: { Authorization: `Bearer ${p1Token}` } });

    const rescueSim = rescueRes.data.simulation;
    assert(rescueSim.isSuccess === true, 'Rescued extraction plan succeeds cleanly');
    assert(rescueSim.finalState.EXTRACTION_STATUS === 'ESCAPED', 'Team successfully escaped deep containment');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 7: PLANNING / EXECUTION TRACE
    // -------------------------------------------------------------
    console.log('\n--- STAGE 7: PLANNING / EXECUTION TRACE ---');
    assert(Array.isArray(rescueSim.executionTrace), 'Execution trace generated');
    assert(rescueSim.executionTrace.length === 4, 'Trace recorded all 4 completed steps');
    assert(rescueSim.executionTrace.every(t => t.status === 'SUCCESS'), 'All 4 trace steps marked SUCCESS');
    assert(rescueSim.remainingBattery === 5, 'Battery consumption verified: 65 - (20 + 10 + 15 + 15) = 5⚡');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 8: FEEDBACK & EXPLANATIONS
    // -------------------------------------------------------------
    console.log('\n--- STAGE 8: FEEDBACK & EXPLANATIONS ---');
    // Verify explanations are grounded in real game mechanics
    assert(!trapSim.failureExplanation.includes('Action failed.'), 'Feedback avoids generic "Action failed."');
    assert(trapSim.failureExplanation.includes('Action [Engage Pneumatic Evacuation Shaft] requires environmental state [ATMOSPHERE_PRESSURE] to be \'1.0_BAR\''), 'Feedback pinpoints the exact unmet physical constraint');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 9: COMPLETION & MULTI-FACTOR SCORING
    // -------------------------------------------------------------
    console.log('\n--- STAGE 9: COMPLETION & MULTI-FACTOR SCORING ---');
    // Execute OP-01 with optimal clean plan: 15 + 10 + 10 + 5 = 40 cost, rem: 0
    const op1CleanPlan = [
      { slot: 0, actionId: 'STEP_UP_TRANSFORMER' },
      { slot: 1, actionId: 'ALIGN_OPTICAL_FIBER' },
      { slot: 2, actionId: 'LOAD_CIPHER_KEYS' },
      { slot: 3, actionId: 'INITIALIZE_TERMINAL' },
    ];
    const op1CompleteRes = await axios.post(`${API}/sessions/${roomCode}/mission-execute`, {
      challengeId: op1Challenge.id,
      actionPlan: op1CleanPlan,
    }, { headers: { Authorization: `Bearer ${p1Token}` } });

    assert(op1CompleteRes.data.isCompleted === true, 'OP-01 marked isCompleted: true');
    assert(op1CompleteRes.data.scoreBreakdown.basePoints === 100, 'Awarded 100 base points');
    assert(op1CompleteRes.data.score > 0, 'Mission score awarded and positive');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 10: RECONNECT & STATE RESTORATION
    // -------------------------------------------------------------
    console.log('\n--- STAGE 10: RECONNECT & STATE RESTORATION ---');
    // Player 1 refreshes / reconnects to OP-01
    const p1ReconRes = await axios.get(`${API}/sessions/${roomCode}/mission-state?challengeId=${op1Challenge.id}`, {
      headers: { Authorization: `Bearer ${p1Token}` },
    });
    const p1Recon = p1ReconRes.data;

    assert(p1Recon.isCompleted === true, 'Completed state restored after reconnection');
    assert(p1Recon.actionPlan.length === 4, 'Committed action plan restored across reconnect');
    assert(p1Recon.scoreBreakdown !== null, 'Score breakdown preserved and restored on reconnect');
    assert(p1Recon.scoreBreakdown.basePoints === 100, 'Score breakdown base points intact');
    testPassed++;

    // -------------------------------------------------------------
    // STAGE 11: MULTI-PLAYER ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- STAGE 11: MULTI-PLAYER ISOLATION ---');
    // Player 2 inspects their own OP-01 state in the same session
    const p2StateRes = await axios.get(`${API}/sessions/${roomCode}/mission-state?challengeId=${op1Challenge.id}`, {
      headers: { Authorization: `Bearer ${p2Token}` },
    });
    const p2State = p2StateRes.data;

    assert(p2State.isCompleted === false, 'Player 2 mission remains UNCOMPLETED (Player 1 did not bleed into Player 2)');
    assert(p2State.actionPlan.length === 0, 'Player 2 action plan remains blank/isolated');
    assert(p2State.remainingBattery === 40, 'Player 2 battery remains full (40⚡)');
    assert(p2State.score === 0, 'Player 2 score is 0');
    testPassed++;

    console.log('\n====================================================');
    console.log(`HUMAN PLAYTEST COMPLETE: ${testPassed}/${totalTests} AREAS PASSED`);
    console.log('====================================================');
  } catch (err) {
    console.error('Playtest error:', err.response?.data || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runHumanPlaytest();
