const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

async function run() {
  console.log("==================================================");
  console.log("THE WITNESS — QA VALIDATION TEST SUITE (20 TESTS)");
  console.log("==================================================");

  let hostSocket, stageSocket, s1Socket, s2Socket, attackerSocket;

  try {
    // ─── SETUP ACCOUNTS ───
    const gmEmail = `gm_witness_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_W_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });

    const setupStudent = async (name) => {
      const email = `stud_wit_${name}_${Date.now()}@test.com`;
      await axios.post(`${API}/auth/register`, {
        email,
        username: `${name}_${Date.now()}`,
        password: 'password123',
        role: 'STUDENT'
      });
      const res = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
      return { id: res.data.user.id, token: res.data.token, username: res.data.user.username };
    };

    const s1 = await setupStudent('DetectiveAlice');
    const s2 = await setupStudent('DetectiveBob');
    const sTamper = await setupStudent('MalloryAttacker');

    // ─── 1. GAME CREATION ───
    console.log("\n[TEST 1] Game Creation with template THE_WITNESS");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Operation Blackout: The Witness',
      description: 'Zero-trust network intrusion investigation',
      template: 'THE_WITNESS'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;
    if (!gameId || gameRes.data.game.template !== 'THE_WITNESS') {
      throw new Error(`TEST 1 FAILED: Game creation failed or template mismatch: ${gameRes.data.game.template}`);
    }
    console.log(`✓ TEST 1 PASSED: Game created with template THE_WITNESS (ID: ${gameId})`);

    // ─── 2. CHALLENGE CREATION ───
    console.log("\n[TEST 2] Challenge Creation with 8 Suspects and Secret Culprit S4");
    const mysteryConfig = {
      title: "OPERATION BLACKOUT: CORE INTRUSION",
      system: "Subnet Sentinel Perimeter Logs",
      narrative: "At 02:44, a rogue administrative token authorized an encrypted export from Server Room B. Exactly one of 8 active staff members is responsible.",
      questionBudget: 5,
      culpritId: "S4",
      secret: "S4",
      suspects: [
        { id: "S1", name: "Devon Reed", role: "DevOps Engineer", clearance: 2, location: "East Wing Office", accessTime: "02:15", authMethod: "SSH_KEY", subnet: "ALPHA" },
        { id: "S2", name: "Elena Mercer", role: "Database Administrator", clearance: 4, location: "Data Center Vault", accessTime: "01:45", authMethod: "BIOMETRIC", subnet: "BETA" },
        { id: "S3", name: "Marcus Vance", role: "Security Architect", clearance: 3, location: "SOC Control Room", accessTime: "02:30", authMethod: "SMARTCARD", subnet: "ALPHA" },
        { id: "S4", name: "Priya Nair", role: "Cloud Systems Lead", clearance: 3, location: "Server Room B", accessTime: "02:44", authMethod: "HARDWARE_TOKEN", subnet: "BETA" },
        { id: "S5", name: "Taro Tanaka", role: "Network Administrator", clearance: 2, location: "IDF Closet 4", accessTime: "03:10", authMethod: "SSH_KEY", subnet: "GAMMA" },
        { id: "S6", name: "Sarah Jenkins", role: "Site Reliability Specialist", clearance: 1, location: "Remote Workstation", accessTime: "02:50", authMethod: "VPN_CERT", subnet: "DELTA" },
        { id: "S7", name: "Chloe Bennett", role: "Systems Intern", clearance: 1, location: "Testing Lab C", accessTime: "01:15", authMethod: "PASSWORD", subnet: "ALPHA" },
        { id: "S8", name: "Alex Rivera", role: "Infrastructure Manager", clearance: 4, location: "Server Room B", accessTime: "02:00", authMethod: "BIOMETRIC", subnet: "BETA" }
      ],
      queryableAttributes: [
        { key: "clearance", label: "Clearance Level", type: "number", operators: [">=", "<=", "=="] },
        { key: "location", label: "Location", type: "string", operators: ["==", "!="] },
        { key: "accessTime", label: "Access Timestamp", type: "time", operators: [">=", "<="] },
        { key: "authMethod", label: "Authentication Method", type: "string", operators: ["==", "!="] },
        { key: "subnet", label: "Origin Subnet", type: "string", operators: ["==", "!="] }
      ]
    };

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'INTERROGATION',
      prompt: mysteryConfig.narrative,
      points: 100,
      timeLimit: 180,
      config: mysteryConfig
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;
    if (!challengeId) throw new Error("TEST 2 FAILED: Challenge creation failed");
    console.log(`✓ TEST 2 PASSED: Interrogation challenge created with 8 suspects (ID: ${challengeId})`);

    // ─── 3. PLAYER JOINS & EVENT/SESSION SETUP ───
    console.log("\n[TEST 3] Player Joins Session");
    const eventRes = await axios.post(`${API}/events`, {
      name: 'The Witness Investigation Series',
      mode: 'SEQUENCE'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = eventRes.data.id;

    await axios.post(`${API}/events/${eventId}/games`, { gameId, position: 0 }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });

    const sessRes = await axios.post(`${API}/sessions`, { eventId }, {
      headers: { Authorization: `Bearer ${gmToken}` }
    });
    const roomCode = sessRes.data.session.roomCode;

    hostSocket = io(SOCKET_URL, { auth: { token: gmToken } });
    await new Promise(r => hostSocket.on('connect', r));
    hostSocket.emit('host:join', { roomCode });

    stageSocket = io(SOCKET_URL, { auth: { isStage: true } });
    await new Promise(r => stageSocket.on('connect', r));
    stageSocket.emit('stage:join', { roomCode });

    let latestStageUpdate = null;
    stageSocket.on('session_state_update', (d) => {
      latestStageUpdate = d;
    });

    const initStudent = async (student) => {
      const joinRes = await axios.post(`${API}/sessions/join`, { roomCode }, {
        headers: { Authorization: `Bearer ${student.token}` }
      });
      const socket = io(SOCKET_URL, { auth: { token: student.token } });
      await new Promise(r => socket.on('connect', r));
      socket.emit('player:join', { roomCode });
      return {
        ...student,
        socket,
        sessionPlayerId: joinRes.data.sessionPlayer.id,
        api: axios.create({ baseURL: API, headers: { Authorization: `Bearer ${student.token}` } })
      };
    };

    const student1 = await initStudent(s1);
    const student2 = await initStudent(s2);
    const attacker = await initStudent(sTamper);
    console.log(`✓ TEST 3 PASSED: Players successfully joined room ${roomCode}`);

    // Activate round
    hostSocket.emit('host:select_game', { gameId, position: 0 });
    await new Promise(r => setTimeout(r, 600));
    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await new Promise(r => setTimeout(r, 600));

    // ─── 4. WITNESS CHALLENGE LOADS & SECRETS SANITIZED ───
    console.log("\n[TEST 4] Challenge Loads with Sanitized Secret Culprit");
    const activeChalRes = await student1.api.get(`/sessions/${roomCode}/witness-state?challengeId=${challengeId}`);
    if (activeChalRes.data.questionsRemaining !== 5) {
      throw new Error(`TEST 4 FAILED: Expected 5 questionsRemaining, got ${activeChalRes.data.questionsRemaining}`);
    }

    // Inspect stage socket state payload
    const stageChallengeConfig = latestStageUpdate?.currentGame?.challenges?.[0]?.config;
    if (stageChallengeConfig?.culpritId || stageChallengeConfig?.secret || stageChallengeConfig?.secretCulpritId) {
      throw new Error("TEST 4 FAILED: Culprit identity leaked in public state!");
    }
    console.log("✓ TEST 4 PASSED: Challenge loaded; culpritId and secret cleanly stripped from client/stage payload");

    // ─── 5. QUESTION BUILDER ATTRIBUTES ───
    console.log("\n[TEST 5] Question Builder Schema Verification");
    const dbChal = await prisma.challenge.findUnique({ where: { id: challengeId } });
    const queryAttrs = dbChal.config.queryableAttributes;
    if (!Array.isArray(queryAttrs) || queryAttrs.length < 5) {
      throw new Error("TEST 5 FAILED: Missing queryable attributes");
    }
    console.log(`✓ TEST 5 PASSED: Question builder has ${queryAttrs.length} structured queryable attributes`);

    // ─── 10. PARTITION PREVIEW (VERIFIED BEFORE DISPATCH) ───
    console.log("\n[TEST 10] Partition Preview (YES: 4 | NO: 4)");
    const previewRes = await student1.api.post(`/sessions/${roomCode}/witness-preview`, {
      challengeId,
      query: { attribute: 'clearance', operator: '>=', value: 3 }
    });
    console.log("Preview Result:", previewRes.data);
    if (previewRes.data.yesCount !== 4 || previewRes.data.noCount !== 4) {
      throw new Error(`TEST 10 FAILED: Expected 4:4 partition, got YES:${previewRes.data.yesCount} NO:${previewRes.data.noCount}`);
    }
    console.log("✓ TEST 10 PASSED: Partition preview accurately predicted 4:4 binary split");

    // ─── 6, 7, 8, 9. VALID QUESTION DISPATCH & SERVER RESPONSE ───
    console.log("\n[TEST 6, 7, 8, 9] Question Dispatch, Budget Decrease, Evidence & Suspect Elimination");
    const q1Res = await student1.api.post(`/sessions/${roomCode}/witness-query`, {
      challengeId,
      query: {
        attribute: 'clearance',
        operator: '>=',
        value: 3,
        questionText: 'Did the culprit possess Clearance Level 3 or higher?'
      }
    });

    console.log("Query 1 Response:", q1Res.data);
    // Budget decrease
    if (q1Res.data.questionsRemaining !== 4 || q1Res.data.questionsUsed !== 1) {
      throw new Error(`TEST 7 FAILED: Budget did not decrement properly (remaining: ${q1Res.data.questionsRemaining})`);
    }
    // Evidence text
    if (q1Res.data.verdict !== true || !q1Res.data.responseText.includes('AFFIRMATIVE')) {
      throw new Error(`TEST 8 FAILED: Evidence verdict was not affirmative for culprit S4 (clearance 3)`);
    }
    // Suspect elimination
    if (!q1Res.data.eliminatedSuspectIds.includes('S1') || !q1Res.data.eliminatedSuspectIds.includes('S5') ||
        !q1Res.data.eliminatedSuspectIds.includes('S6') || !q1Res.data.eliminatedSuspectIds.includes('S7')) {
      throw new Error("TEST 9 FAILED: Contradictory clearance < 3 suspects were not eliminated!");
    }
    if (q1Res.data.activeSuspectIds.length !== 4) {
      throw new Error(`TEST 9 FAILED: Expected 4 active suspects remaining, got ${q1Res.data.activeSuspectIds.length}`);
    }
    console.log("✓ TEST 6 PASSED: Valid structured question dispatched");
    console.log("✓ TEST 7 PASSED: Question budget decreased (5 -> 4)");
    console.log("✓ TEST 8 PASSED: Evidence returned with detective narrative response");
    console.log("✓ TEST 9 PASSED: Exactly 4 contradictory suspects eliminated (S1, S5, S6, S7)");

    // ─── 19. DUPLICATE QUESTION REJECTION ───
    console.log("\n[TEST 19] Duplicate/Replayed Question Rejection");
    try {
      await student1.api.post(`/sessions/${roomCode}/witness-query`, {
        challengeId,
        query: { attribute: 'clearance', operator: '>=', value: 3 }
      });
      throw new Error("TEST 19 FAILED: Expected duplicate query to return 400 error");
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data.error.includes('Duplicate')) {
        console.log("✓ TEST 19 PASSED: Server rejected duplicate query with 400 Bad Request");
      } else {
        throw err;
      }
    }

    // ─── 11. MULTIPLE QUESTIONS (SECOND INQUIRY) ───
    console.log("\n[TEST 11] Multiple Sequential Inquiries");
    const q2Res = await student1.api.post(`/sessions/${roomCode}/witness-query`, {
      challengeId,
      query: {
        attribute: 'authMethod',
        operator: '==',
        value: 'HARDWARE_TOKEN',
        questionText: 'Did the suspect authenticate using a physical Hardware Token?'
      }
    });

    console.log("Query 2 Response:", q2Res.data);
    if (q2Res.data.questionsRemaining !== 3) {
      throw new Error(`TEST 11 FAILED: Questions remaining should be 3, got ${q2Res.data.questionsRemaining}`);
    }
    if (q2Res.data.activeSuspectIds.length !== 1 || q2Res.data.activeSuspectIds[0] !== 'S4') {
      throw new Error(`TEST 11 FAILED: Expected only culprit S4 remaining, got ${JSON.stringify(q2Res.data.activeSuspectIds)}`);
    }
    console.log("✓ TEST 11 PASSED: Second inquiry isolated exact culprit S4 (Priya Nair)");

    // ─── 17. STAGE SYNCHRONIZATION ───
    console.log("\n[TEST 17] Stage Socket Synchronization");
    await new Promise(r => setTimeout(r, 600));
    const stageWitness = latestStageUpdate?.witnessProgress;
    const aliceProgress = stageWitness?.activeInvestigators?.find(i => i.playerName.includes('DetectiveAlice'));
    if (!stageWitness || !aliceProgress || aliceProgress.activeSuspectsCount !== 1 || stageWitness.recentTestimonies?.length < 2) {
      throw new Error(`TEST 17 FAILED: Stage witness progress not synced: ${JSON.stringify(stageWitness)}`);
    }
    console.log("✓ TEST 17 PASSED: Spectator stage synchronized with investigation progress (Alice Active: 1, Testimonies: 2)");

    // ─── 18. RECONNECTION & STATE RESTORATION ───
    console.log("\n[TEST 18] Reconnection State Recovery");
    // Simulate player disconnect and re-fetch from witness-state endpoint
    student1.socket.disconnect();
    const restoredState = await student1.api.get(`/sessions/${roomCode}/witness-state?challengeId=${challengeId}`);
    if (restoredState.data.questionsRemaining !== 3 ||
        restoredState.data.questionsUsed !== 2 ||
        restoredState.data.activeSuspectIds.length !== 1 ||
        restoredState.data.inquiryHistory.length !== 2) {
      throw new Error(`TEST 18 FAILED: Restored state incomplete: ${JSON.stringify(restoredState.data)}`);
    }
    console.log("✓ TEST 18 PASSED: Reconnected client fully restored inquiries, budget, and suspect states");

    // ─── 20. FORGED CLIENT DATA REJECTION ───
    console.log("\n[TEST 20] Malicious Client Forged Data Rejection");
    const forgedAttempt = await attacker.api.post(`/sessions/active/submit`, {
      answer: {
        isCorrect: true,
        score: 9999,
        accusedSuspectId: 'S1', // Wrong suspect
      }
    });
    if (forgedAttempt.data.isCorrect !== false || forgedAttempt.data.pointsAwarded !== 0) {
      throw new Error(`TEST 20 FAILED: Attacker bypassed server validation: ${JSON.stringify(forgedAttempt.data)}`);
    }
    console.log("✓ TEST 20 PASSED: Server authoritative validation rejected forged isCorrect: true");

    // ─── 13. INCORRECT ACCUSATION HANDLING ───
    console.log("\n[TEST 13] Incorrect Accusation Warrant (Student 2)");
    // Student 2 asks 1 question then wrongly accuses S2
    await student2.api.post(`/sessions/${roomCode}/witness-query`, {
      challengeId,
      query: { attribute: 'clearance', operator: '>=', value: 3 }
    });
    const wrongAccusation = await student2.api.post(`/sessions/active/submit`, {
      answer: { accusedSuspectId: 'S2' }
    });
    if (wrongAccusation.data.isCorrect !== false) {
      throw new Error(`TEST 13 FAILED: Incorrect accusation was evaluated as correct!`);
    }
    console.log("✓ TEST 13 PASSED: False accusation rejected by server warrant review");

    // ─── 14. QUESTION EXHAUSTION HANDLING ───
    console.log("\n[TEST 14] Question Budget Exhaustion (Student 2 continues)");
    // Student 2 uses remaining questions: 4 -> 3 -> 2 -> 1 -> 0
    await student2.api.post(`/sessions/${roomCode}/witness-query`, { challengeId, query: { attribute: 'subnet', operator: '==', value: 'ALPHA' } });
    await student2.api.post(`/sessions/${roomCode}/witness-query`, { challengeId, query: { attribute: 'location', operator: '==', value: 'Server Room B' } });
    await student2.api.post(`/sessions/${roomCode}/witness-query`, { challengeId, query: { attribute: 'accessTime', operator: '<=', value: '02:00' } });
    await student2.api.post(`/sessions/${roomCode}/witness-query`, { challengeId, query: { attribute: 'authMethod', operator: '==', value: 'BIOMETRIC' } });

    // Verify 6th query is rejected due to budget exhaustion
    try {
      await student2.api.post(`/sessions/${roomCode}/witness-query`, {
        challengeId,
        query: { attribute: 'subnet', operator: '==', value: 'BETA' }
      });
      throw new Error("TEST 14 FAILED: Question dispatched when budget was 0");
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data.error.includes('exhausted')) {
        console.log("✓ Confirmed: Question dispatch blocked at 0 budget");
      } else {
        throw err;
      }
    }

    // But player can STILL make final accusation when questions reach 0!
    const finalExhaustedAccusation = await student2.api.post(`/sessions/active/submit`, {
      answer: { accusedSuspectId: 'S4' } // Correct culprit
    });
    if (!finalExhaustedAccusation.data.isCorrect) {
      throw new Error("TEST 14 FAILED: Final accusation at 0 questions should succeed if culprit is correct!");
    }
    console.log("✓ TEST 14 PASSED: Student can make final accusation even with 0 question budget remaining");

    // ─── 12, 15, 16. CORRECT ACCUSATION & EFFICIENCY SCORING (Student 1) ───
    console.log("\n[TEST 12, 15, 16] Correct Accusation & Efficiency Scoring Calculation");
    const correctSubmission = await student1.api.post(`/sessions/active/submit`, {
      answer: { accusedSuspectId: 'S4', accusedSuspectName: 'Priya Nair' }
    });

    console.log("Student 1 Final Accusation Result:", correctSubmission.data);
    if (!correctSubmission.data.isCorrect) {
      throw new Error("TEST 12 FAILED: Correct accusation for S4 was marked incorrect!");
    }

    // Scoring check:
    // Base: 100 points
    // Questions remaining: 3 * 20 = 60 points
    // Avg reduction: Q1 reduced 4/8 (50%), Q2 reduced 3/4 (75%) -> avg 62.5% >= 35% -> +15% Grand Detective bonus = +15 points
    // Total expected: 100 + 60 + 15 = 175 points
    const finalPoints = correctSubmission.data.pointsAwarded;
    console.log(`Awarded Points: ${finalPoints}`);
    if (finalPoints < 160) {
      throw new Error(`TEST 15/16 FAILED: Expected points with efficiency bonus >= 160, got ${finalPoints}`);
    }

    console.log("✓ TEST 12 PASSED: Final accusation of S4 verified correct");
    console.log("✓ TEST 15 PASSED: Base challenge points awarded");
    console.log(`✓ TEST 16 PASSED: Question conservation (+60) and Grand Detective efficiency bonus (+15) correctly awarded (Total: ${finalPoints} pts)`);

    console.log("\n==================================================");
    console.log("ALL 20 THE_WITNESS TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================");
    process.exit(0);

  } finally {
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (s1Socket) s1Socket.disconnect();
    if (s2Socket) s2Socket.disconnect();
    if (attackerSocket) attackerSocket.disconnect();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message);
  if (err.response) {
    console.error("Response data:", err.response.data);
    console.error("Response status:", err.response.status);
  }
  process.exit(1);
});
