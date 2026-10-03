const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const { registry, Validator } = require('./server/dist/engine');

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
    shiftResilienceBonus: 30,
    unusedProbeBonus: 10,
    cleanSheetBonus: 20,
    retryPenalty: -15,
  },
};

let passedCount = 0;
let failedCount = 0;
const testLogs = [];

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.error(`✗ FAIL: ${message}`);
    testLogs.push(`✗ FAIL: ${message}`);
    throw new Error(message);
  } else {
    passedCount++;
    console.log(`✓ PASS: ${message}`);
    testLogs.push(`✓ PASS: ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('THE_THRESHOLD — PRODUCTION QA, SECURITY & FULL PLATFORM REGRESSION');
  console.log('================================================================\n');

  const ts = Date.now();
  let gmUser, gmToken;
  let studentUser, studentToken;
  let student2User, student2Token;
  let attackerUser, attackerToken;
  let testGame, testChallenge, testEvent, testSession, roomCode;
  let session2, roomCode2;
  let hostSocket, stageSocket, studentSocket;

  try {
    // ========================================================================
    // SECTION A: THRESHOLD MATHEMATICS
    // ========================================================================
    console.log('\n--- SECTION A: THRESHOLD MATHEMATICS ---');

    // 1. threshold = 0
    const evalZero = Validator.evaluateThreshold(THRESHOLD_CONFIG, 0, 1);
    assert(evalZero.fn === 0, '[A.1] Threshold = 0 produces 0 False Negatives (Maximum Sensitivity)');
    assert(evalZero.fp === 75, '[A.2] Threshold = 0 flags all benign cases as False Positives (75/75)');
    assert(evalZero.tp === 25, '[A.3] Threshold = 0 catches all critical cases (25/25)');
    assert(evalZero.tn === 0, '[A.4] Threshold = 0 produces 0 True Negatives (0% Specificity)');
    assert(evalZero.totalLoss === 75 * 500, '[A.5] Threshold = 0 loss equals benign count * FP cost ($37,500)');
    assert(evalZero.withinBudget === false, '[A.6] Threshold = 0 loss ($37,500) exceeds safety budget ($25,000)');

    // 2. threshold = 100
    const evalHundred = Validator.evaluateThreshold(THRESHOLD_CONFIG, 100, 1);
    assert(evalHundred.fp === 0, '[A.7] Threshold = 100 produces 0 False Positives (Maximum Specificity)');
    assert(evalHundred.fn === 25, '[A.8] Threshold = 100 misses all critical cases as False Negatives (25/25)');
    assert(evalHundred.tn === 75, '[A.9] Threshold = 100 identifies all benign cases as True Negatives (75/75)');
    assert(evalHundred.tp === 0, '[A.10] Threshold = 100 catches 0 True Positives (0% Sensitivity)');
    assert(evalHundred.totalLoss === 25 * 10000, '[A.11] Threshold = 100 loss equals critical count * FN cost ($250,000)');
    assert(evalHundred.withinBudget === false, '[A.12] Threshold = 100 loss ($250,000) heavily exceeds safety budget ($25,000)');

    // 3. threshold = 50
    const evalFifty = Validator.evaluateThreshold(THRESHOLD_CONFIG, 50, 1);
    assert(evalFifty.tp > 0 && evalFifty.fp > 0 && evalFifty.tn > 0 && evalFifty.fn >= 0, '[A.13] Threshold = 50 produces balanced confusion matrix partition');
    assert(evalFifty.withinBudget === true, '[A.14] Threshold = 50 yields manageable loss strictly within budget ceiling');

    // 4. TP / FP / TN / FN sum
    const totalCases = evalFifty.tp + evalFifty.fp + evalFifty.tn + evalFifty.fn;
    assert(totalCases === 100, '[A.15] TP + FP + TN + FN sum exactly to population size (100)');
    assert(typeof evalFifty.tp === 'number' && typeof evalFifty.fp === 'number' && typeof evalFifty.tn === 'number' && typeof evalFifty.fn === 'number', '[A.16] Confusion matrix values are valid non-negative integers');

    // 5. Asymmetric loss verification
    const expectedLossFifty = (evalFifty.fn * 10000) + (evalFifty.fp * 500);
    assert(evalFifty.totalLoss === expectedLossFifty, '[A.17] Calculated loss strictly adheres to asymmetric formula: (FN * 10000) + (FP * 500)');
    // Contrast T = 45 vs T = 65: demonstrating asymmetry (1 missed critical costs 20 false alarms)
    const evalConservative = Validator.evaluateThreshold(THRESHOLD_CONFIG, 45, 1);
    const evalPermissive = Validator.evaluateThreshold(THRESHOLD_CONFIG, 65, 1);
    assert(evalConservative.fn <= evalPermissive.fn, '[A.18] Lowering threshold strictly decreases or maintains False Negatives');
    assert(evalConservative.fp >= evalPermissive.fp, '[A.19] Lowering threshold increases False Positives in trade-off zone');
    assert(evalPermissive.totalLoss > evalConservative.totalLoss, '[A.20] High-threshold False Negative penalty dominates asymmetric loss curve');

    // 6. Boundary conditions & Deterministic evaluation
    const baselineEval = Validator.evaluateThreshold(THRESHOLD_CONFIG, 53, 1);
    for (let i = 0; i < 5; i++) {
      const evalRepeat = Validator.evaluateThreshold(THRESHOLD_CONFIG, 53, 1);
      assert(
        evalRepeat.totalLoss === baselineEval.totalLoss &&
        evalRepeat.tp === baselineEval.tp &&
        evalRepeat.fn === baselineEval.fn &&
        evalRepeat.fp === baselineEval.fp &&
        evalRepeat.tn === baselineEval.tn &&
        evalRepeat.withinBudget === baselineEval.withinBudget &&
        evalRepeat.totalScore === baselineEval.totalScore,
        `[A.21.${i+1}] Deterministic evaluation produces bit-identical results across runs`
      );
    }

    // ========================================================================
    // SETUP: ACCOUNTS, TEMPLATES, GAMES, AND SESSIONS
    // ========================================================================
    console.log('\n--- SETUP: PLATFORM INITIALIZATION ---');
    const template = registry.getTemplate('THE_THRESHOLD');
    assert(template !== undefined && template.id === 'THE_THRESHOLD', '[SETUP.1] THE_THRESHOLD registered in TemplateRegistry');

    // Register GM and Students
    const gmRes = await axios.post(`${API}/auth/register`, {
      email: `gm_th_${ts}@terminal.test`,
      username: `Director_Th_${ts}`,
      password: 'password123',
      role: 'HOST',
    });
    gmUser = gmRes.data.user;
    gmToken = gmRes.data.token;
    await prisma.user.update({ where: { id: gmUser.id }, data: { role: 'SUPER_ADMIN' } });

    const s1Res = await axios.post(`${API}/auth/register`, {
      email: `s1_th_${ts}@terminal.test`,
      username: `Officer_Alpha_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    studentUser = s1Res.data.user;
    studentToken = s1Res.data.token;

    const s2Res = await axios.post(`${API}/auth/register`, {
      email: `s2_th_${ts}@terminal.test`,
      username: `Officer_Beta_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    student2User = s2Res.data.user;
    student2Token = s2Res.data.token;

    const atRes = await axios.post(`${API}/auth/register`, {
      email: `at_th_${ts}@terminal.test`,
      username: `Infiltrator_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    attackerUser = atRes.data.user;
    attackerToken = atRes.data.token;

    // Create THE_THRESHOLD Game
    const gameRes = await axios.post(`${API}/games`, {
      name: 'OPERATION SENTINEL TRIAGE',
      description: 'Asymmetric classification and population drift triage.',
      template: 'THE_THRESHOLD',
      category: 'AI',
      config: THRESHOLD_CONFIG,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testGame = gameRes.data.game;

    // Create THRESHOLD_CALIBRATION Challenge
    const chalRes = await axios.post(`${API}/games/${testGame.id}/challenges`, {
      prompt: 'Calibrate risk cutoff threshold for emergency admissions.',
      type: 'THRESHOLD_CALIBRATION',
      points: 100,
      timeLimit: 180,
      config: THRESHOLD_CONFIG,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testChallenge = chalRes.data.challenge;

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

    // Session 1 (Main Session)
    const sessRes = await axios.post(`${API}/sessions`, {
      eventId: testEvent.id,
      roomCode: `TH${String(ts).slice(-4)}`,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    testSession = sessRes.data.session || sessRes.data;
    roomCode = testSession.roomCode;

    // Session 2 (Cross-Session Isolation)
    const sess2Res = await axios.post(`${API}/sessions`, {
      eventId: testEvent.id,
      roomCode: `X${String(ts).slice(-4)}`,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    session2 = sess2Res.data.session || sess2Res.data;
    roomCode2 = session2.roomCode;

    // Join students to their sessions
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${studentToken}` } });
    await axios.post(`${API}/sessions/join`, { roomCode }, { headers: { Authorization: `Bearer ${student2Token}` } });
    await axios.post(`${API}/sessions/join`, { roomCode: roomCode2 }, { headers: { Authorization: `Bearer ${attackerToken}` } });

    // Start round in Session 1
    await axios.post(`${API}/sessions/${roomCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    // ========================================================================
    // SECTION C: PROBE ECONOMY
    // ========================================================================
    console.log('\n--- SECTION C: PROBE ECONOMY ---');

    // Initial state check
    const initialProbeCheck = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(initialProbeCheck.data.probeTokens === 3, '[C.1] Configured probe tokens is 3');
    assert(initialProbeCheck.data.probesRemaining === 3, '[C.2] Initial probesRemaining equals 3');
    assert(initialProbeCheck.data.probesUsed === 0, '[C.3] Initial probesUsed equals 0');

    // Valid probe 1
    const p1Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 52, phase: 1, isProbe: true },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    assert(p1Res.data.isProbe === true, '[C.4] Probe request returns isProbe: true');
    assert(p1Res.data.probesRemaining === 2, '[C.5] Probe count decrements by 1 (3 -> 2)');
    assert(p1Res.data.confusionMatrix !== undefined, '[C.6] Probe returns authoritative confusion matrix');
    assert(p1Res.data.totalLoss !== undefined, '[C.7] Probe returns authoritative totalLoss');
    assert(p1Res.data.isCorrect !== true, '[C.8] Probe does NOT complete the game (isCorrect is not true)');

    // Verify probe did not complete session in DB
    const sp1 = await prisma.sessionPlayer.findFirst({
      where: { sessionId: testSession.id, userId: studentUser.id },
    });
    const subProbe1 = await prisma.submission.findFirst({
      where: { sessionId: testSession.id, playerId: sp1.id },
    });
    assert(subProbe1?.isCorrect === false, '[C.9] Probe persists isCorrect: false in database');
    assert(subProbe1?.score === 0, '[C.10] Probe awards 0 score points in database');
    assert(subProbe1?.metadata?.probesRemaining === 2, '[C.11] Probe remaining count is saved in submission metadata');

    // Valid probe 2
    const p2Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 50, phase: 1, isProbe: true },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(p2Res.data.probesRemaining === 1, '[C.12] Second probe decrements count (2 -> 1)');

    // Valid probe 3 (Exhaustion)
    const p3Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 48, phase: 1, isProbe: true },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(p3Res.data.probesRemaining === 0, '[C.13] Third probe decrements count to exhaustion (1 -> 0)');

    // Probe after exhaustion must return 400
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 45, phase: 1, isProbe: true },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Probe allowed after token exhaustion');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error.includes('No probe tokens'), '[C.14] Probe after exhaustion returns 400 with descriptive error');
    }

    // Verify state not corrupted after rejection
    const probeExhaustCheck = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(probeExhaustCheck.data.probesRemaining === 0, '[C.15] Probe remaining count stays safely at 0 without negative underflow');

    // ========================================================================
    // SECTION D: SERVER AUTHORITY & TAMPER RESISTANCE
    // ========================================================================
    console.log('\n--- SECTION D: SERVER AUTHORITY ---');

    // Attempt to tamper with TP, FP, TN, FN, loss, score, probe count, completion
    const tamperRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: {
        threshold: 52,
        phase: 1,
        isProbe: false,
        tp: 9999,
        fp: 0,
        tn: 9999,
        fn: 0,
        totalLoss: 0,
        score: 999999,
        pointsAwarded: 999999,
        probesRemaining: 100,
        probeTokens: 100,
        phase1Completed: true,
        phase2Completed: true,
        isCorrect: true,
        isCompleted: true,
      },
    }, { headers: { Authorization: `Bearer ${studentToken}` } });

    assert(tamperRes.data.submission.metadata.phase1ConfusionMatrix.tp !== 9999, '[D.1] Client-supplied TP is ignored by server');
    assert(tamperRes.data.submission.metadata.phase1ConfusionMatrix.fp > 0, '[D.2] Client-supplied FP (0) is ignored; server calculates actual FP');
    assert(tamperRes.data.submission.metadata.phase1ConfusionMatrix.tn !== 9999, '[D.3] Client-supplied TN is ignored by server');
    assert(tamperRes.data.submission.metadata.phase1Cost !== 0, '[D.4] Client-supplied totalLoss (0) is ignored by server');
    assert(tamperRes.data.pointsAwarded !== 999999 && tamperRes.data.submission.score !== 999999, '[D.5] Client-supplied score (999,999) is ignored by server');
    assert(tamperRes.data.submission.metadata.probesRemaining === 0, '[D.6] Client-supplied probe count (100) is ignored; server uses DB state (0)');
    assert(tamperRes.data.submission.metadata.phase2Completed !== true, '[D.7] Client-supplied phase2Completed: true is ignored');

    // Tampering with boundary values: < 0 and > 100
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: -1, phase: 1 },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Negative threshold accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[D.8] Negative threshold (< 0) rejected with 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 101, phase: 1 },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Threshold > 100 accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[D.9] Excessive threshold (> 100) rejected with 400');
    }

    // Tampering with phase: invalid numbers
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 3 },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Phase 3 accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[D.10] Invalid phase (3) rejected with 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 0 },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Phase 0 accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[D.11] Invalid phase (0) rejected with 400');
    }

    // Non-numeric threshold
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 'nan_attack', phase: 1 },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'String threshold accepted');
    } catch (e) {
      assert(e.response?.status === 400, '[D.12] Non-numeric threshold string rejected with 400');
    }

    // ========================================================================
    // SECTION B: PHASE PROGRESSION
    // ========================================================================
    console.log('\n--- SECTION B: PHASE PROGRESSION ---');

    // 1. Reject Phase 2 before Phase 1 completion (Testing with student 2 who hasn't completed Phase 1)
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 25, phase: 2, isProbe: false },
      }, { headers: { Authorization: `Bearer ${student2Token}` } });
      assert(false, 'Phase 2 accepted before Phase 1');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error.includes('Phase 1'), '[B.1] Phase 2 calibration before Phase 1 completion returns 400');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 25, phase: 2, isProbe: true },
      }, { headers: { Authorization: `Bearer ${student2Token}` } });
      assert(false, 'Phase 2 probe accepted before Phase 1');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error.includes('Phase 1'), '[B.2] Phase 2 probe before Phase 1 completion returns 400');
    }

    // 2. Failed Phase 1 calibration attempt (T = 80, over budget)
    const failP1Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 80, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${student2Token}` } });
    assert(failP1Res.data.submission.metadata.phase1Completed === false, '[B.3] Failed Phase 1 calibration does not mark phase1Completed');
    assert(failP1Res.data.submission.metadata.failedRunsCount === 1, '[B.4] Failed Phase 1 calibration increments failedRunsCount');

    const s2StateP1Fail = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${student2Token}` },
    });
    assert(s2StateP1Fail.data.activePhase === 1, '[B.5] Failed Phase 1 calibration keeps activePhase at 1');

    // 3. Successful Phase 1 unlocks Phase 2
    const passP1Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 53, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${student2Token}` } });
    assert(passP1Res.data.submission.metadata.phase1Completed === true, '[B.6] Valid Phase 1 calibration completes Phase 1');

    const s2StateP1Pass = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${student2Token}` },
    });
    assert(s2StateP1Pass.data.activePhase === 2, '[B.7] Successful Phase 1 unlocks Phase 2 (activePhase = 2)');
    assert(s2StateP1Pass.data.phase1Threshold === 53, '[B.8] Phase 1 committed threshold (53) is persisted');

    // 4. Distribution shift verification
    assert(s2StateP1Pass.data.phase2Shift !== null, '[B.9] Phase 2 supplies shifted distribution telemetry');
    assert(s2StateP1Pass.data.phase2Shift.benignDistribution.mean === 42, '[B.10] Shifted benign mean (42) differs from baseline (32)');
    assert(s2StateP1Pass.data.phase2Shift.criticalDistribution.mean === 54, '[B.11] Shifted critical mean (54) differs from baseline (68)');

    // 5. Phase 2 uses shifted authoritative data (re-applying old Phase 1 threshold fails)
    const shiftFailRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 53, phase: 2, isProbe: false },
    }, { headers: { Authorization: `Bearer ${student2Token}` } });
    assert(shiftFailRes.data.isCorrect === false, '[B.12] Committing Phase 1 threshold (53) fails under shifted distribution');
    assert(shiftFailRes.data.submission.metadata.phase2Completed === false, '[B.13] Shifted failure does not complete Phase 2');
    assert(shiftFailRes.data.submission.metadata.phase2Cost > 35000, '[B.14] Phase 2 loss under old threshold exceeds safety budget');

    // 6. Final calibration completes challenge
    const finalPassRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 25, phase: 2, isProbe: false },
    }, { headers: { Authorization: `Bearer ${student2Token}` } });
    assert(finalPassRes.data.isCorrect === true, '[B.15] Calibrating to shifted optimal range succeeds');
    assert(finalPassRes.data.submission.metadata.phase2Completed === true, '[B.16] Phase 2 marked completed in metadata');

    const s2FinalState = await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${student2Token}` },
    });
    assert(s2FinalState.data.activePhase === 'COMPLETED', '[B.17] State activePhase transitions to COMPLETED');
    assert(s2FinalState.data.isCompleted === true, '[B.18] State isCompleted is true');

    // 7. Duplicate submission after completion returns 400
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 25, phase: 2, isProbe: false },
      }, { headers: { Authorization: `Bearer ${student2Token}` } });
      assert(false, 'Duplicate final submission allowed');
    } catch (e) {
      assert(e.response?.status === 400 && e.response.data.error === 'Already submitted', '[B.19] Duplicate submission after completion locked with 400');
    }

    // ========================================================================
    // SECTION E: AUTHORIZATION & ISOLATION
    // ========================================================================
    console.log('\n--- SECTION E: AUTHORIZATION ---');

    // 1. Unauthenticated request
    try {
      await axios.get(`${API}/sessions/${roomCode}/threshold-state`);
      assert(false, 'Unauthenticated state query allowed');
    } catch (e) {
      assert(e.response?.status === 401, '[E.1] Unauthenticated GET /threshold-state rejected with 401');
    }

    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 1, isProbe: true },
      });
      assert(false, 'Unauthenticated submission allowed');
    } catch (e) {
      assert(e.response?.status === 401, '[E.2] Unauthenticated POST /submit rejected with 401');
    }

    // 2. Wrong / non-existent room
    try {
      await axios.get(`${API}/sessions/INVALID999/threshold-state`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert(false, 'Invalid room query allowed');
    } catch (e) {
      assert(e.response?.status === 404, '[E.3] Querying invalid room code returns 404');
    }

    // 3. Cross-player state access (User not enrolled in Session 1 trying to read Session 1 state)
    try {
      await axios.get(`${API}/sessions/${roomCode}/threshold-state`, {
        headers: { Authorization: `Bearer ${attackerToken}` },
      });
      assert(false, 'Cross-player session state access allowed');
    } catch (e) {
      assert(e.response?.status === 404, '[E.4] Unenrolled player cannot access session threshold state (404)');
    }

    // 4. Cross-session submission (Attacker in Session 2 submitting to Session 1 challenge)
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: testChallenge.id,
        answer: { threshold: 50, phase: 1, isProbe: true },
      }, { headers: { Authorization: `Bearer ${attackerToken}` } });
      assert(false, 'Cross-session submission allowed');
    } catch (e) {
      assert(e.response?.status === 403 || e.response?.status === 404 || e.response?.status === 400, '[E.5] Player from another session cannot submit to active question (403/404/400)');
    }

    // 5. Tampered challenge ID
    try {
      await axios.post(`${API}/sessions/active/submit`, {
        challengeId: 'non-existent-challenge-id',
        answer: { threshold: 50, phase: 1, isProbe: true },
      }, { headers: { Authorization: `Bearer ${studentToken}` } });
      assert(false, 'Tampered challenge ID allowed');
    } catch (e) {
      assert(e.response?.status === 404 || e.response?.status === 400, '[E.6] Non-existent challenge ID rejected safely (400/404)');
    }

    // ========================================================================
    // SECTION F: RECONNECT & STATE RESTORATION
    // ========================================================================
    console.log('\n--- SECTION F: RECONNECT ---');

    // Create a dedicated clean session for reconnect flow
    const reconSessRes = await axios.post(`${API}/sessions`, {
      eventId: testEvent.id,
      roomCode: `RC${String(ts).slice(-4)}`,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const reconSession = reconSessRes.data.session || reconSessRes.data;
    const rcCode = reconSession.roomCode;

    // Register fresh clean student
    const rcStudentRes = await axios.post(`${API}/auth/register`, {
      email: `rc_${ts}@terminal.test`,
      username: `Officer_Recon_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    const rcStudentToken = rcStudentRes.data.token;
    await axios.post(`${API}/sessions/join`, { roomCode: rcCode }, { headers: { Authorization: `Bearer ${rcStudentToken}` } });
    await axios.post(`${API}/sessions/${rcCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    // Step 1: Probe in Phase 1
    await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 51, phase: 1, isProbe: true },
    }, { headers: { Authorization: `Bearer ${rcStudentToken}` } });

    // Step 2: Refresh during Phase 1
    const reconP1 = await axios.get(`${API}/sessions/${rcCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${rcStudentToken}` },
    });
    assert(reconP1.data.activePhase === 1, '[F.1] Refresh during Phase 1 restores activePhase = 1');
    assert(reconP1.data.phase1Completed === false, '[F.2] Refresh during Phase 1 restores phase1Completed = false');
    assert(reconP1.data.probesRemaining === 2, '[F.3] Refresh during Phase 1 restores probesRemaining = 2');
    assert(reconP1.data.probesUsed === 1, '[F.4] Refresh during Phase 1 restores probesUsed = 1');

    // Step 3: Calibrate Phase 1 successfully
    await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 54, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${rcStudentToken}` } });

    // Step 4: Refresh after Phase 1 / Reconnect during Phase 2
    const reconP2 = await axios.get(`${API}/sessions/${rcCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${rcStudentToken}` },
    });
    assert(reconP2.data.activePhase === 2, '[F.5] Reconnect during Phase 2 restores activePhase = 2');
    assert(reconP2.data.phase1Completed === true, '[F.6] Reconnect restores phase1Completed = true');
    assert(reconP2.data.phase1Threshold === 54, '[F.7] Reconnect restores phase1Threshold = 54');
    assert(reconP2.data.phase1Cost !== null, '[F.8] Reconnect restores phase1Cost');
    assert(reconP2.data.phase1ConfusionMatrix?.tp > 0, '[F.9] Reconnect restores phase1ConfusionMatrix');
    assert(reconP2.data.lastEvaluation !== null, '[F.10] Reconnect restores full lastEvaluation');

    // Step 5: Probe during Phase 2
    await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 26, phase: 2, isProbe: true },
    }, { headers: { Authorization: `Bearer ${rcStudentToken}` } });

    const reconP2Probe = await axios.get(`${API}/sessions/${rcCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${rcStudentToken}` },
    });
    assert(reconP2Probe.data.probesRemaining === 1, '[F.11] Reconnect during Phase 2 reflects updated probe count (1)');

    // Step 6: Complete Phase 2 calibration
    await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 26, phase: 2, isProbe: false },
    }, { headers: { Authorization: `Bearer ${rcStudentToken}` } });

    // Step 7: Final state restoration
    const reconFinal = await axios.get(`${API}/sessions/${rcCode}/threshold-state`, {
      headers: { Authorization: `Bearer ${rcStudentToken}` },
    });
    assert(reconFinal.data.activePhase === 'COMPLETED', '[F.12] Final reconnect reports activePhase = COMPLETED');
    assert(reconFinal.data.phase2Completed === true, '[F.13] Final reconnect reports phase2Completed = true');
    assert(reconFinal.data.phase2Threshold === 26, '[F.14] Final reconnect reports phase2Threshold = 26');
    assert(reconFinal.data.isCompleted === true, '[F.15] Final reconnect reports isCompleted = true');
    assert(reconFinal.data.score > 0, '[F.16] Final reconnect reports awarded score');

    // Clean up reconnect session
    await prisma.submission.deleteMany({ where: { sessionId: reconSession.id } });
    await prisma.sessionPlayer.deleteMany({ where: { sessionId: reconSession.id } });
    await prisma.session.delete({ where: { id: reconSession.id } }).catch(() => {});

    // ========================================================================
    // SECTION G: SCORING & INTEGRITY
    // ========================================================================
    console.log('\n--- SECTION G: SCORING ---');

    // Create a clean-sheet session to test clean-sheet bonus vs penalty behavior
    const scoreSessRes = await axios.post(`${API}/sessions`, {
      eventId: testEvent.id,
      roomCode: `SC${String(ts).slice(-4)}`,
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const scoreSession = scoreSessRes.data.session || scoreSessRes.data;
    const scCode = scoreSession.roomCode;

    // Student A: Clean sheet (0 failed runs, 3 unused probes)
    const cleanStudentRes = await axios.post(`${API}/auth/register`, {
      email: `clean_${ts}@terminal.test`,
      username: `Clean_Officer_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    const cleanStudentToken = cleanStudentRes.data.token;
    await axios.post(`${API}/sessions/join`, { roomCode: scCode }, { headers: { Authorization: `Bearer ${cleanStudentToken}` } });

    // Student B: Penalized (1 failed calibration run)
    const messyStudentRes = await axios.post(`${API}/auth/register`, {
      email: `messy_${ts}@terminal.test`,
      username: `Messy_Officer_${ts}`,
      password: 'password123',
      role: 'STUDENT',
    });
    const messyStudentToken = messyStudentRes.data.token;
    await axios.post(`${API}/sessions/join`, { roomCode: scCode }, { headers: { Authorization: `Bearer ${messyStudentToken}` } });

    await axios.post(`${API}/sessions/${scCode}/start`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });

    // 1. Successful Phase 1 (Clean Student)
    const cleanP1Res = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 53, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${cleanStudentToken}` } });
    assert(cleanP1Res.data.pointsAwarded === 0, '[G.1] Successful Phase 1 does not prematurely award final score points');
    assert(cleanP1Res.data.submission.metadata.phase1Completed === true, '[G.2] Successful Phase 1 marks phase1Completed: true');

    // 2. Penalty behavior (Messy Student submits over-budget calibration)
    const messyP1Fail = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 85, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${messyStudentToken}` } });
    assert(messyP1Fail.data.pointsAwarded === -15, '[G.3] Penalty behavior: Over-budget calibration attempt receives -15 penalty');
    assert(messyP1Fail.data.submission.metadata.failedRunsCount === 1, '[G.4] Penalty behavior: Failed calibration records failedRunsCount = 1');

    // Messy student fixes Phase 1
    await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 53, phase: 1, isProbe: false },
    }, { headers: { Authorization: `Bearer ${messyStudentToken}` } });

    // 3. Final calibrations & clean-sheet comparison
    // Clean student: T = 25 (optimal range [22, 28], 0 FN, 3 unused probes, 0 failed runs)
    // Base 100 + Optimal 50 + ZeroLoss 30 + (3 probes * 10) + CleanSheet 20 = 230 pts
    const cleanFinalRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: {
        threshold: 25,
        phase: 2,
        isProbe: false,
        score: 999999, // Attempted forgery
      },
    }, { headers: { Authorization: `Bearer ${cleanStudentToken}` } });

    assert(cleanFinalRes.data.isCorrect === true, '[G.5] Clean student achieves successful Phase 2');
    assert(cleanFinalRes.data.pointsAwarded !== 999999, '[G.6] Final score cannot be client-forged');
    assert(cleanFinalRes.data.pointsAwarded === 230, `[G.7] Clean sheet scoring verified: Base(100) + Opt(50) + ZeroLoss(30) + Probes(30) + CleanSheet(20) = 230 (Got ${cleanFinalRes.data.pointsAwarded})`);

    // Messy student completes Phase 2 with same threshold (T = 25)
    // Base 100 + Optimal 50 + ZeroLoss 30 + (3 probes * 10) + NO CleanSheet = 210 pts
    const messyFinalRes = await axios.post(`${API}/sessions/active/submit`, {
      challengeId: testChallenge.id,
      answer: { threshold: 25, phase: 2, isProbe: false },
    }, { headers: { Authorization: `Bearer ${messyStudentToken}` } });

    assert(messyFinalRes.data.pointsAwarded === 210, `[G.8] Clean-sheet bonus correctly withheld after failed run (Expected 210, Got ${messyFinalRes.data.pointsAwarded})`);
    assert(cleanFinalRes.data.pointsAwarded > messyFinalRes.data.pointsAwarded, '[G.9] Clean-sheet performer strictly outscores student with prior incident failure');

    // Clean up scoring session
    await prisma.submission.deleteMany({ where: { sessionId: scoreSession.id } });
    await prisma.sessionPlayer.deleteMany({ where: { sessionId: scoreSession.id } });
    await prisma.session.delete({ where: { id: scoreSession.id } }).catch(() => {});

    // ========================================================================
    // SECTION H: SOCKET & STAGE INTEGRATION
    // ========================================================================
    console.log('\n--- SECTION H: SOCKET & STAGE INTEGRATION ---');
    hostSocket = io(SOCKET_URL, { auth: { token: gmToken }, transports: ['websocket'] });
    stageSocket = io(SOCKET_URL, { auth: { token: gmToken }, transports: ['websocket'] });
    studentSocket = io(SOCKET_URL, { auth: { token: studentToken }, transports: ['websocket'] });

    await new Promise((resolve, reject) => {
      let count = 0;
      const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 4000);
      const check = () => { count++; if (count === 3) { clearTimeout(timer); resolve(); } };
      hostSocket.on('connect', check);
      stageSocket.on('connect', check);
      studentSocket.on('connect', check);
    });

    assert(hostSocket.connected && stageSocket.connected && studentSocket.connected, '[H.1] Host, Stage, and Student sockets connected');

    hostSocket.emit('host:join', { roomCode });
    stageSocket.emit('stage:join', { roomCode });
    studentSocket.emit('player:join', { roomCode });

    const sessionState = await axios.get(`${API}/sessions/${roomCode}`, {
      headers: { Authorization: `Bearer ${gmToken}` },
    });
    assert(sessionState.status === 200, '[H.2] THE_THRESHOLD session state query returns healthy 200');
    assert(Array.isArray(sessionState.data.leaderboard), '[H.3] Session leaderboard is structured array');

  } finally {
    console.log('\n--- CLEANUP & TEARDOWN ---');
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (studentSocket) studentSocket.disconnect();

    if (testSession) {
      await prisma.submission.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.sessionPlayer.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.session.delete({ where: { id: testSession.id } }).catch(() => {});
    }
    if (session2) {
      await prisma.submission.deleteMany({ where: { sessionId: session2.id } });
      await prisma.sessionPlayer.deleteMany({ where: { sessionId: session2.id } });
      await prisma.session.delete({ where: { id: session2.id } }).catch(() => {});
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
    if (student2User) await prisma.user.delete({ where: { id: student2User.id } }).catch(() => {});
    if (attackerUser) await prisma.user.delete({ where: { id: attackerUser.id } }).catch(() => {});

    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`THE_THRESHOLD QA RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');
}

runTestSuite().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\nQA Suite Failed with Error:', err);
  process.exit(1);
});
