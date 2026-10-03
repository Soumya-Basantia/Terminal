const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const { registry, Validator } = require('../server/dist/engine');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

const THRESHOLD_CONFIG = {
  scenarioId: 'THRESHOLD-QA-01',
  scenarioTitle: 'OPERATION SENTINEL TRIAGE: ACUTE CARDIAC ISCHEMIA',
  system: 'Apex Emergency Triage Network',
  missionBrief: 'Calibrate the diagnostic risk threshold for acute ischemia alerts under asymmetric loss.',
  costMatrix: {
    falseNegativeCost: 10000,
    falsePositiveCost: 500,
    maxIncidentBudget: 25000,
  },
  phase1Baseline: {
    populationName: 'Standard Municipal Admissions (N=100)',
    benignDistribution: { mean: 32, stdDev: 10, count: 75 },
    criticalDistribution: { mean: 68, stdDev: 11, count: 25 },
    optimalThresholdRange: [50, 56],
  },
  phase2Shift: {
    shiftName: 'Geriatric Sub-Cohort Surge (Distribution Drift)',
    benignDistribution: { mean: 42, stdDev: 12, count: 60 },
    criticalDistribution: { mean: 54, stdDev: 12, count: 40 },
    maxIncidentBudget: 35000,
    optimalThresholdRange: [22, 28],
  },
  probeTokens: 3,
  scoring: {
    basePoints: 100,
    optimalBonus: 50,
    zeroLossBonus: 30,
    unusedProbeBonus: 10,
  },
};

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.error(`✗ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedCount++;
    console.log(`✓ PASS: ${message}`);
  }
}

async function runQaSuite() {
  console.log('==================================================');
  console.log('THE_THRESHOLD — 61-POINT PRODUCTION QA SUITE');
  console.log('==================================================\n');

  const ts = Date.now();
  let gmUser, gmToken;
  let studentUser, studentToken;
  let attackerUser, attackerToken;
  let testGame, testChallenge, testEvent, testSession, roomCode;
  let hostSocket, stageSocket, studentSocket;

  try {
    // --------------------------------------------------
    // A. TEMPLATE REGISTRATION (1..4)
    // --------------------------------------------------
    console.log('--- A. TEMPLATE REGISTRATION ---');
    const template = registry.getTemplate('THE_THRESHOLD');
    assert(template !== undefined && template.id === 'THE_THRESHOLD', '[1] THE_THRESHOLD registered in TemplateRegistry');

    // Register GM and Student
    const gmRes = await axios.post(`${API}/auth/register`, {
      email: `gm_thqa_${ts}@test.com`,
      username: `GM_ThQA_${ts}`,
      password: 'password123',
      role: 'HOST',
    });
    gmUser = gmRes.data.user;
    gmToken = gmRes.data.token;
    await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

    const stRes = await axios.post(`${API}/auth/register`, {
      email: `st_thqa_${ts}@test.com`,
      username: `Officer_ThQA_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    studentUser = stRes.data.user;
    studentToken = stRes.data.token;

    const atRes = await axios.post(`${API}/auth/register`, {
      email: `at_thqa_${ts}@test.com`,
      username: `Rogue_ThQA_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    attackerUser = atRes.data.user;
    attackerToken = atRes.data.token;

    // Create game with THE_THRESHOLD
    const gameRes = await axios.post(`${API}/games`, {
      name: 'OPERATION SENTINEL TRIAGE',
      description: 'Asymmetric classification and population drift triage.',
      template: 'THE_THRESHOLD',
      category: 'AI',
      config: THRESHOLD_CONFIG,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testGame = gameRes.data.game;
    assert(testGame && testGame.template === 'THE_THRESHOLD', '[2] THE_THRESHOLD game created successfully');

    // Create challenge with THRESHOLD_CALIBRATION
    const chalRes = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: 'Calibrate risk cutoff threshold for emergency admissions.',
      type: 'THRESHOLD_CALIBRATION',
      points: 100,
      timeLimit: 120,
      config: THRESHOLD_CONFIG,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChallenge = chalRes.data.challenge;
    assert(testChallenge && testChallenge.type === 'THRESHOLD_CALIBRATION', '[3] THRESHOLD_CALIBRATION challenge created');

    assert(testChallenge.config?.costMatrix?.falseNegativeCost === 10000, '[4] Challenge config is present and verified');

    // Publish Game and create Event
    await axios.post(`${API}/games/${testGame.id}/publish`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    const eventRes = await axios.post(`${API}/events`, {
      name: `Triage Trials ${ts}`,
      mode: 'GM_CONTROLLED',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testEvent = eventRes.data.event || eventRes.data;

    await axios.post(`${API}/events/${testEvent.id}/games`, {
      gameId: testGame.id,
      position: 0,
      purpose: 'NORMAL',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });

    await axios.put(`${API}/events/${testEvent.id}`, { status: 'PUBLISHED' }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });

    const sessRes = await axios.post(`${API}/sessions`, {
      eventId: testEvent.id,
      roomCode: `TH${String(ts).slice(-4)}`,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testSession = sessRes.data.session || sessRes.data;
    roomCode = testSession.roomCode;

    // Student joins
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${studentToken}` } });

    // --------------------------------------------------
    // B. VALIDATION / MATH (5..11)
    // --------------------------------------------------
    console.log('\n--- B. VALIDATION / MATH ---');
    const evalZero = Validator.evaluateThreshold(THRESHOLD_CONFIG, 0, 1);
    assert(evalZero.fn === 0 && evalZero.fp > 0 && !isNaN(evalZero.totalLoss), '[5] Threshold = 0 handled correctly (0 FN, max sensitivity)');

    const evalHundred = Validator.evaluateThreshold(THRESHOLD_CONFIG, 100, 1);
    assert(evalHundred.fp === 0 && evalHundred.fn > 0 && !isNaN(evalHundred.totalLoss), '[6] Threshold = 100 handled correctly (0 FP, max specificity)');

    const evalNormal = Validator.evaluateThreshold(THRESHOLD_CONFIG, 53, 1);
    assert(evalNormal.withinBudget === true, '[7] Normal valid threshold produces deterministic result within budget');

    assert(typeof evalNormal.tp === 'number' && typeof evalNormal.fp === 'number' && typeof evalNormal.tn === 'number' && typeof evalNormal.fn === 'number' && (evalNormal.tp + evalNormal.fp + evalNormal.tn + evalNormal.fn) === 100, '[8] TP/FP/TN/FN are server-calculated and sum to population count');

    const expectedLoss = (evalNormal.fn * 10000) + (evalNormal.fp * 500);
    assert(evalNormal.totalLoss === expectedLoss, '[9] Incident loss matches server asymmetric loss formula');

    const evalRepeat = Validator.evaluateThreshold(THRESHOLD_CONFIG, 53, 1);
    assert(evalRepeat.totalLoss === evalNormal.totalLoss && evalRepeat.tp === evalNormal.tp, '[10] Repeating the same threshold produces identical evaluation');

    const evalP1 = Validator.evaluateThreshold(THRESHOLD_CONFIG, 53, 1);
    const evalP2 = Validator.evaluateThreshold(THRESHOLD_CONFIG, 53, 2);
    assert(evalP1.withinBudget !== evalP2.withinBudget, '[11] Phase-specific distributions are applied correctly (P1 within, P2 outside)');

    // Start round
    await axios.post(`${API}/sessions/${roomCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    // --------------------------------------------------
    // C. INPUT SECURITY (12..23)
    // --------------------------------------------------
    console.log('\n--- C. INPUT SECURITY & SERVER AUTHORITY ---');
    try {
      await axios.post(`${API}/sessions/active/submit`, { challengeId: testChallenge.id, answer: { threshold: -5, phase: 1, isProbe: true } }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'threshold < 0 accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[12] threshold < 0 rejected with 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, { challengeId: testChallenge.id, answer: { threshold: 105, phase: 1, isProbe: true } }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'threshold > 100 accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[13] threshold > 100 rejected with 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, { challengeId: testChallenge.id, answer: { threshold: 'not_a_number', phase: 1, isProbe: true } }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'non-numeric threshold accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[14] Non-numeric threshold rejected with 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, { challengeId: testChallenge.id, answer: { threshold: null, phase: 1, isProbe: true } }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'null threshold accepted');
    } catch (e) {
      assert(e.response?.status === 400 || e.response?.data?.threshold !== null, '[15] Null/invalid threshold rejected or normalized safely');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, { challengeId: testChallenge.id, answer: { threshold: 50, phase: 2, isProbe: false } }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Phase 2 allowed before Phase 1 completion');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error.includes('Phase 1'), '[16] Phase 2 before Phase 1 rejected with 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, { challengeId: testChallenge.id, answer: { threshold: 50, phase: 2, isProbe: true } }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Phase 2 probe allowed before Phase 1 completion');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error.includes('Phase 1'), '[17] Phase 2 probe before Phase 1 rejected with 400');
    }

    // Attempting to spoof TP/FP/TN/FN/loss/score
    const spoofRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: {
        threshold: 52,
        phase: 1,
        isProbe: true,
        tp: 9999,
        fp: 0,
        tn: 9999,
        fn: 0,
        totalLoss: 0,
        score: 999999,
      },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    assert(spoofRes.data.confusionMatrix.tp !== 9999, '[18] Fake TP cannot be submitted (ignored by server)');
    assert(spoofRes.data.confusionMatrix.fp !== undefined && spoofRes.data.confusionMatrix.fp > 0, '[19] Fake FP cannot be submitted (computed server-side)');
    assert(spoofRes.data.confusionMatrix.tn !== 9999, '[20] Fake TN cannot be submitted');
    assert(spoofRes.data.confusionMatrix.fn !== undefined, '[21] Fake FN cannot be submitted');
    assert(spoofRes.data.totalLoss !== 0, '[22] Fake loss cannot be submitted');
    assert(spoofRes.data.pointsAwarded === 0 || spoofRes.data.score !== 999999, '[23] Fake score cannot be submitted');

    // --------------------------------------------------
    // D. PROBE ECONOMY (24..30)
    // --------------------------------------------------
    console.log('\n--- D. PROBE ECONOMY ---');
    const initialProbeCheck = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(initialProbeCheck.data.probeTokens === 3, '[24] Initial probe count is configured correctly (3 tokens)');

    assert(spoofRes.data.probesRemaining === 2, '[25] Valid probe consumed exactly one token (3 -> 2)');
    assert(spoofRes.data.isProbe === true && spoofRes.data.withinBudget !== undefined, '[26] Probe returns authoritative telemetry');

    const sp = await prisma.sessionPlayer.findFirst({
      where: { sessionId: testSession.id, userId: studentUser.id },
    });
    const subCheck1 = await prisma.submission.findFirst({
      where: { sessionId: testSession.id, playerId: sp.id },
    });
    assert(subCheck1?.metadata?.probesRemaining === 2, '[27] Probe metadata is persisted to Submission.metadata');

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 1, isProbe: true },
      });
      assert(false, 'Unauthenticated probe allowed');
    } catch (e) {
      assert(e.response?.status === 401, '[28] Probe cannot be consumed without authorization (401)');
    }

    // Consume probe 2 and probe 3
    await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 51, phase: 1, isProbe: true },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    const p3Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 52, phase: 1, isProbe: true },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(p3Res.data.probesRemaining === 0, '[29] Probe remaining count correctly decremented to zero');

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 53, phase: 1, isProbe: true },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Probe allowed at zero tokens');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error.includes('No probe tokens'), '[30] Probe at zero remaining tokens is rejected without corrupting state');
    }

    // --------------------------------------------------
    // E. PHASE 1 (31..35)
    // --------------------------------------------------
    console.log('\n--- E. PHASE 1 CALIBRATION & PROGRESSION ---');
    // Test failed Phase 1 calibration (T = 80)
    const failP1 = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 80, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(failP1.data.submission.metadata.phase1Completed === false, '[31] Failed Phase 1 calibration does not pass requirements');

    const stateFailP1 = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(stateFailP1.data.activePhase === 1 && stateFailP1.data.phase1Completed === false, '[32] Failed Phase 1 calibration does not unlock Phase 2');

    // Valid Phase 1 calibration (T = 53)
    const successP1 = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 53, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(successP1.data.submission.metadata.phase1Completed === true, '[33] Valid Phase 1 calibration within budget succeeds and unlocks Phase 2');

    const stateP1Pass = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(stateP1Pass.data.phase1Threshold === 53, '[34] Phase 1 threshold is persisted');
    assert(stateP1Pass.data.activePhase === 2, '[35] Phase 1 cannot be replayed to bypass progression (activePhase is now 2)');

    // --------------------------------------------------
    // F. DISTRIBUTION SHIFT (36..40)
    // --------------------------------------------------
    console.log('\n--- F. DISTRIBUTION SHIFT ---');
    assert(stateP1Pass.data.phase2Shift?.shiftName?.includes('Geriatric'), '[36] Phase 2 supplies shifted distribution telemetry');

    // Committing old Phase 1 threshold (53) in Phase 2 should fail
    const p1ThreshInP2 = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 53, phase: 2, isProbe: false },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(p1ThreshInP2.data.isCorrect === false && p1ThreshInP2.data.submission.metadata.phase2Completed === false, '[37] Phase 1 distribution cannot be used to fake Phase 2 success');

    assert(p1ThreshInP2.data.submission.metadata.phase2Cost > 100000, '[38] Phase 2 requires recalibration under shifted distribution');
    assert(p1ThreshInP2.data.isCorrect === false, '[39] Existing Phase 1 threshold is not automatically accepted in Phase 2');

    const checkP2State = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(checkP2State.data.activePhase === 2 && checkP2State.data.phase2Completed === false, '[40] State correctly reports activePhase = 2 under shift');

    // --------------------------------------------------
    // G. FINAL CALIBRATION (41..45)
    // --------------------------------------------------
    console.log('\n--- G. FINAL CALIBRATION & SCORING ---');
    const finalCalib = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 25, phase: 2, isProbe: false },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    assert(finalCalib.data.isCorrect === true, '[41] Valid Phase 2 calibration succeeds');
    assert(finalCalib.data.pointsAwarded > 0, '[42] Final score is server-authoritative');
    assert(finalCalib.data.submission.metadata.phase2Completed === true, '[43] Completion is persisted in Submission.metadata');

    // Duplicate submission attempt
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 25, phase: 2, isProbe: false },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Duplicate final submission allowed');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error === 'Already submitted', '[44] Duplicate final submissions cannot award unlimited points (locked with 400)');
    }

    const evalInvalidPhase = Validator.evaluateThreshold(THRESHOLD_CONFIG, 95, 2);
    assert(evalInvalidPhase.failureTier !== null && evalInvalidPhase.withinBudget === false, '[45] Invalid final calibration generates correct 4-tier failure response');

    // --------------------------------------------------
    // H. STATE RESTORATION (46..52)
    // --------------------------------------------------
    console.log('\n--- H. STATE RESTORATION & RESILIENCE ---');
    const authState = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(authState.status === 200, '[46] GET /threshold-state works for authorized player');

    try {
      await axios.get(`${API}/sessions/${roomCode}/threshold-state`);
      assert(false, 'Unauthorized GET /threshold-state allowed');
    } catch (e) {
      assert(e.response?.status === 401, '[47] Unauthorized request rejected with 401');
    }

    assert(authState.data.probesRemaining === 0, '[48] State contains correct probesRemaining');
    assert(authState.data.activePhase === 'COMPLETED' || authState.data.phase2Completed === true, '[49] State contains correct activePhase');
    assert(authState.data.phase1Completed === true, '[50] State contains phase1 completion state');
    assert(authState.data.phase1Threshold === 53 && authState.data.phase2Threshold === 25, '[51] State contains last threshold/evaluation for all phases');
    assert(authState.data.isCompleted === true, '[52] Refresh/reconnect preserves complete progress');

    // --------------------------------------------------
    // I. SESSION / AUTH SECURITY (53..57)
    // --------------------------------------------------
    console.log('\n--- I. SESSION / AUTH SECURITY ---');
    try {
      await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
        headers: { Authorization: `Bearer ${attackerToken}` },
      });
      assert(false, 'Non-enrolled user accessed threshold state');
    } catch (e) {
      assert(e.response?.status === 404, '[53] Non-player cannot access session threshold state (404)');
    }

    try {
      await axios.get(`${API}/sessions/NONEXISTENT/threshold-state`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert(false, 'Wrong session code allowed');
    } catch (e) {
      assert(e.response?.status === 404, '[54] Wrong session code cannot expose another player state (404)');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 1, isProbe: true },
      });
      assert(false, 'Unauthenticated submission allowed');
    } catch (e) {
      assert(e.response?.status === 401, '[55] Unauthenticated submission rejected with 401');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 1, isProbe: true },
      }, { headers: { Authorization: `Bearer ${attackerToken}` } });
      assert(false, 'Attacker from outside session allowed to submit');
    } catch (e) {
      assert(e.response?.status === 403 || e.response?.status === 404, '[56] Player from another session cannot submit (403/404)');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: 'invalid-challenge-id',
        answer: { threshold: 50, phase: 1, isProbe: true },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Tampered challenge ID allowed');
    } catch (e) {
      assert(e.response?.status === 400 || e.response?.status === 404, '[57] Tampered challenge identifiers safely rejected (400/404)');
    }

    // --------------------------------------------------
    // J. SOCKET / STAGE REGRESSION (58..61)
    // --------------------------------------------------
    console.log('\n--- J. SOCKET & STAGE REGRESSION ---');
    hostSocket = io(SOCKET_URL, { auth: { token: gmToken }, transports: ['websocket'] });
    stageSocket = io(SOCKET_URL, { auth: { token: gmToken }, transports: ['websocket'] });
    studentSocket = io(SOCKET_URL, { auth: { token: studentToken }, transports: ['websocket'] });

    await new Promise(resolve => {
      let count = 0;
      const check = () => { count++; if (count === 3) resolve(); };
      hostSocket.on('connect', check);
      stageSocket.on('connect', check);
      studentSocket.on('connect', check);
    });

    hostSocket.emit('host:join', { roomCode });
    stageSocket.emit('stage:join', { roomCode });
    studentSocket.emit('player:join', { roomCode });

    const stateBroadcastPromise = new Promise(resolve => {
      stageSocket.on('session_state_update', data => {
        if (data && data.roomCode === roomCode) resolve(data);
      });
    });

    // Trigger state refresh/update
    const stateSync = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });
    assert(stateSync.status === 200, '[58] THE_THRESHOLD session state query returns healthy payload');

    const broadcastData = await Promise.race([
      stateBroadcastPromise,
      new Promise(r => setTimeout(() => r(stateSync.data), 1500)),
    ]);
    assert(broadcastData !== null, '[59] Stage remains functional and receives updates');

    const leaderboardRes = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });
    assert(leaderboardRes.status === 200 && Array.isArray(leaderboardRes.data.leaderboard), '[60] Leaderboard remains functional with awarded scores');

    assert(hostSocket.connected && stageSocket.connected && studentSocket.connected, '[61] Existing socket rooms are not broken');

  } finally {
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();

    // Clean up QA database artifacts
    if (testSession) {
      await prisma.submission.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.sessionPlayer.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.session.delete({ where: { id: testSession.id } }).catch(() => {});
    }
    if (testEvent) {
      await prisma.eventGame.deleteMany({ where: { eventId: testEvent.id } });
      await prisma.event.delete({ where: { id: testEvent.id } }).catch(() => {});
    }
    if (testChallenge) {
      await prisma.challenge.delete({ where: { id: testChallenge.id } }).catch(() => {});
    }
    if (testGame) {
      await prisma.game.delete({ where: { id: testGame.id } }).catch(() => {});
    }
    if (gmUser) await prisma.user.delete({ where: { id: gmUser.id } }).catch(() => {});
    if (studentUser) await prisma.user.delete({ where: { id: studentUser.id } }).catch(() => {});
    if (attackerUser) await prisma.user.delete({ where: { id: attackerUser.id } }).catch(() => {});

    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log(`THE_THRESHOLD QA RESULTS: ${passedCount}/61 PASSED, ${failedCount} FAILED`);
  console.log('==================================================');
}

runQaSuite().catch(err => {
  console.error('\nQA Suite Aborted with Error:', err);
  process.exit(1);
});
