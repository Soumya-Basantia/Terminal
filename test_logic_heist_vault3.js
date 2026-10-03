const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

async function run() {
  console.log("==================================================");
  console.log("PHASE 8.3: LOGIC HEIST VAULT 3 (CONDITIONAL LOGIC) QA");
  console.log("==================================================");

  let hostSocket, stageSocket, s1Socket, s2Socket, s3Socket, sTamperSocket;

  try {
    // ─── 1. AUTH & SETUP ───
    console.log("\n[1] AUTH & SETUP");
    const gmEmail = `gm_vault3_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_V3_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });
    console.log("✓ GM SuperAdmin registered & authenticated");

    const setupStudent = async (name) => {
      const email = `stud_v3_${name}_${Date.now()}@test.com`;
      await axios.post(`${API}/auth/register`, {
        email,
        username: `${name}_${Date.now()}`,
        password: 'password123',
        role: 'STUDENT'
      });
      const res = await axios.post(`${API}/auth/login`, { email, password: 'password123' });
      return { id: res.data.user.id, token: res.data.token, username: res.data.user.username };
    };

    const s1 = await setupStudent('Alice');
    const s2 = await setupStudent('Bob');
    const s3 = await setupStudent('Charlie');
    const sTamper = await setupStudent('Mallory');
    console.log("✓ Students registered & authenticated (Alice, Bob, Charlie, Mallory)");

    // ─── 2. GAME & VAULT 3 CREATION ───
    console.log("\n[2] GAME & VAULT 3 CREATION (LASER GRID SPEC)");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Logic Heist: Operation Nightfall - Vault 3',
      description: 'Laser Grid security chamber bypass',
      template: 'LOGIC_HEIST'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;
    if (!gameId) throw new Error("Failed to create game");
    console.log(`✓ Game created with ID: ${gameId}`);

    // Vault 3 Challenge Configuration
    const vault3Config = {
      vault: 3,
      narrative: "Security Layer 3: Laser Grid. The laser barrier is lethal above 30 units. If the sensor detects HIGH energy (> 50), dampen the laser; otherwise re-route auxiliary power before unlocking the gate.",
      initialState: { LASER: 70, GATE: 0 },
      targetState: { LASER: 20, GATE: 1 },
      blocks: [
        { id: 1, label: "SCAN SENSOR", operation: "SET", variable: "LASER", value: 70 },
        {
          id: 2,
          label: "IF LASER > 50: DAMPEN ELSE BOOST",
          operation: "IF",
          variable: "LASER",
          condition: { variable: "LASER", operator: ">", value: 50 },
          trueBranch: { label: "DAMPEN LASER", operation: "SUB", variable: "LASER", value: 50 },
          falseBranch: { label: "BOOST POWER", operation: "ADD", variable: "LASER", value: 20 }
        },
        { id: 3, label: "OPEN GATE", operation: "SET", variable: "GATE", value: 1 },
        { id: 4, label: "DISARM ALARM", operation: "SET", variable: "ALARM", value: 0, isDecoy: true }
      ],
      correctSequence: [2, 3],
      allowedAttempts: 3,
      hintText: "Read the sensor first. If the laser is over 50, the decision block will automatically choose the DAMPEN branch.",
      revealText: "You used CONDITIONAL BRANCHING — making decisions based on real-time data. In Python: `if laser > 50: laser -= 50 else: laser += 20`. Your code now thinks and reacts.",
      difficulty: "MEDIUM",
      concepts: ["CONDITIONALS", "BRANCHING", "DECISION_MAKING"]
    };

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'BLOCK_CONSTRUCTION',
      prompt: vault3Config.narrative,
      points: 200,
      timerSecs: 90,
      config: vault3Config
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;
    if (!challengeId) throw new Error("Failed to create challenge");
    console.log(`✓ Vault 3 challenge created with ID: ${challengeId}`);

    // Verify config persistence in database
    const savedGame = await axios.get(`${API}/games/${gameId}`, { headers: { Authorization: `Bearer ${gmToken}` } });
    const savedConfig = savedGame.data.game.challenges[0].config;
    if (!savedConfig.blocks || savedConfig.blocks[1].operation !== 'IF' || !savedConfig.blocks[1].condition) {
      throw new Error("Vault 3 conditional block config failed to persist in DB!");
    }
    console.log("✓ Custom Vault 3 conditional config verified persistent in database");

    // Create Event and Session
    const eventRes = await axios.post(`${API}/events`, {
      name: 'Laser Grid Security Trial',
      mode: 'SEQUENCE'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = eventRes.data.id;
    await axios.post(`${API}/events/${eventId}/games`, { gameId, position: 0 }, { headers: { Authorization: `Bearer ${gmToken}` } });
    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, { headers: { Authorization: `Bearer ${gmToken}` } });

    const sessionRes = await axios.post(`${API}/sessions`, { eventId }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const roomCode = sessionRes.data.session.roomCode;
    const sessionId = sessionRes.data.session.id;
    console.log(`✓ Session initialized with Room Code: ${roomCode}`);

    // ─── 3. SOCKETS & STAGE INITIALIZATION ───
    console.log("\n[3] SOCKETS & STAGE CONNECTION");
    hostSocket = io(SOCKET_URL, { auth: { token: gmToken } });
    await new Promise(r => hostSocket.on('connect', r));
    hostSocket.emit('host:join', { roomCode });

    stageSocket = io(SOCKET_URL, { auth: { isStage: true } });
    await new Promise(r => stageSocket.on('connect', r));
    stageSocket.emit('stage:join', { roomCode });

    let latestStageState = null;
    stageSocket.on('session_state_update', (st) => { latestStageState = st; });

    const initStudent = async (student) => {
      const joinRes = await axios.post(`${API}/sessions/join`, { roomCode }, {
        headers: { Authorization: `Bearer ${student.token}` }
      });
      const sock = io(SOCKET_URL, { auth: { token: student.token } });
      await new Promise(r => sock.on('connect', r));
      sock.emit('player:join', { roomCode });
      return {
        ...student,
        sock,
        sessionPlayerId: joinRes.data.sessionPlayer.id,
        api: axios.create({ baseURL: API, headers: { Authorization: `Bearer ${student.token}` } })
      };
    };

    const student1 = await initStudent(s1);
    const student2 = await initStudent(s2);
    const student3 = await initStudent(s3);
    const studentTamper = await initStudent(sTamper);
    s1Socket = student1.sock;
    s2Socket = student2.sock;
    s3Socket = student3.sock;
    sTamperSocket = studentTamper.sock;
    console.log("✓ GM, Stage, and 4 Students connected to room socket");

    // Start Session and Launch Round
    hostSocket.emit('host:select_game', { gameId, position: 0 });
    await new Promise(r => setTimeout(r, 600));

    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await new Promise(r => setTimeout(r, 600));

    console.log("✓ Game Status transitioned to ROUND_ACTIVE for Vault 3");

    // ─── 4. SERVER-SIDE EVALUATION: TRUE BRANCH ───
    console.log("\n[4] SERVER-SIDE CONDITIONAL: TRUE BRANCH");
    const { Validator } = require('./server/dist/engine');
    const trueBranchResult = Validator.executeSequence(
      vault3Config.blocks,
      [2, 3], // IF LASER > 50, OPEN GATE
      { LASER: 70, GATE: 0 } // LASER = 70 > 50 -> TRUE
    );
    if (trueBranchResult.finalState.LASER !== 20 || trueBranchResult.finalState.GATE !== 1) {
      throw new Error(`Expected LASER = 20, GATE = 1; got ${JSON.stringify(trueBranchResult.finalState)}`);
    }
    const step0 = trueBranchResult.steps[0];
    if (step0.branchTaken !== 'TRUE' || step0.conditionEvaluated?.result !== true) {
      throw new Error("Conditional step failed to evaluate TRUE branch!");
    }
    console.log("✓ TRUE Branch accurately evaluated: LASER 70 → 20, GATE 0 → 1");

    // ─── 5. SERVER-SIDE EVALUATION: FALSE BRANCH ───
    console.log("\n[5] SERVER-SIDE CONDITIONAL: FALSE BRANCH");
    const falseBranchResult = Validator.executeSequence(
      vault3Config.blocks,
      [2, 3], // IF LASER > 50, OPEN GATE
      { LASER: 30, GATE: 0 } // LASER = 30 < 50 -> FALSE
    );
    if (falseBranchResult.finalState.LASER !== 50 || falseBranchResult.finalState.GATE !== 1) {
      throw new Error(`Expected LASER = 50 (boosted), GATE = 1; got ${JSON.stringify(falseBranchResult.finalState)}`);
    }
    const falseStep = falseBranchResult.steps[0];
    if (falseStep.branchTaken !== 'FALSE' || falseStep.conditionEvaluated?.result !== false) {
      throw new Error("Conditional step failed to evaluate FALSE branch!");
    }
    console.log("✓ FALSE Branch accurately evaluated: LASER 30 → 50 (boosted), GATE 0 → 1");

    // ─── 6. INVALID CONDITION SAFETY ───
    console.log("\n[6] INVALID / MALFORMED CONDITION SAFETY");
    const malformedConditionBlock = {
      id: 99,
      label: "BAD CONDITION",
      operation: "IF",
      condition: { variable: null, operator: "UNKNOWN", value: "NOT_A_NUM" }
    };
    const malformedResult = Validator.evaluateCondition(malformedConditionBlock.condition, { LASER: 70 });
    if (malformedResult !== false) {
      throw new Error("Malformed condition unexpectedly evaluated to true!");
    }
    console.log("✓ Malformed condition safely returned false (safe fallback)");

    // ─── 7. TAMPER TEST: FORGED BRANCH & FORGED FINAL STATE ───
    console.log("\n[7] TAMPER RESISTANCE: FORGED BRANCH & FORGED FINAL STATE (MALLORY)");
    const tamperRes = await studentTamper.api.post('/sessions/active/submit', {
      answer: {
        sequence: [4], // Just decoy block
        branchTaken: 'TRUE', // Attacker claims true branch executed
        finalState: { LASER: 20, GATE: 1 }, // Attacker tries to forge target
        attempts: 1
      }
    });
    if (tamperRes.data.isCorrect === true) {
      throw new Error("Server accepted attacker's forged branch and final state!");
    }
    console.log("✓ Attacker attempt to forge branch/state independently recomputed and rejected by server");

    // ─── 8. INCORRECT FINAL STATE REJECTION ───
    console.log("\n[8] INCORRECT FINAL STATE REJECTION");
    // Alice submits [3] (only opening gate, skipping laser dampen)
    const wrongSubRes = await student1.api.post('/sessions/active/submit', {
      answer: {
        sequence: [3],
        attempts: 1
      }
    });
    if (wrongSubRes.data.isCorrect === true) {
      throw new Error("Incomplete sequence (un-dampened laser) was accepted!");
    }
    console.log("✓ Incomplete sequence (LASER remained lethal 70) rejected with isCorrect = false");

    // ─── 9. DRY RUN SAFETY ───
    console.log("\n[9] DRY RUN SAFETY");
    const subCountBefore = await prisma.submission.count({ where: { sessionId } });
    const dryRunResult = Validator.executeSequence(vault3Config.blocks, [2, 3], vault3Config.initialState);
    const subCountAfter = await prisma.submission.count({ where: { sessionId } });
    if (subCountBefore !== subCountAfter) {
      throw new Error("Dry Run resulted in database submission creation!");
    }
    if (dryRunResult.finalState.LASER !== 20 || dryRunResult.finalState.GATE !== 1) {
      throw new Error("Dry Run computation failed to match target state");
    }
    console.log("✓ Dry Run verified safe: computed locally, zero database mutations");

    // ─── 10. MULTIPLE ATTEMPTS (P2002 REGRESSION VERIFICATION) ───
    console.log("\n[10] MULTIPLE ATTEMPTS (P2002 REGRESSION VERIFICATION)");
    // Alice had attempt 1 (wrong). Now submit attempt 2 with correct sequence [2, 3]
    const attempt2Res = await student1.api.post('/sessions/active/submit', {
      answer: {
        sequence: [2, 3],
        attempts: 2
      }
    });
    if (!attempt2Res.data.isCorrect) {
      throw new Error("Attempt 2 with correct sequence was rejected!");
    }
    console.log("✓ Attempt 2 submitted successfully without P2002 error: isCorrect = true");

    // ─── 11. DUPLICATE SUBMISSION PREVENTION ───
    console.log("\n[11] DUPLICATE SUBMISSION PREVENTION");
    try {
      await student1.api.post('/sessions/active/submit', {
        answer: { sequence: [2, 3], attempts: 2 }
      });
      throw new Error("Already-solved challenge allowed duplicate submission!");
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log("✓ Duplicate submission rejected as expected (HTTP 400):", err.response.data?.error);
      } else {
        throw err;
      }
    }

    // ─── 12. MULTIPLAYER INDEPENDENCE ───
    console.log("\n[12] MULTIPLAYER INDEPENDENCE");
    // Bob solves independently on attempt 1
    const bobSub = await student2.api.post('/sessions/active/submit', {
      answer: {
        sequence: [2, 3],
        attempts: 1
      }
    });
    if (!bobSub.data.isCorrect) {
      throw new Error("Bob's independent submission failed!");
    }
    console.log("✓ Bob solved independently; Alice's prior submission had zero interference on Bob");

    // ─── 13. STAGE SYNCHRONIZATION & DECISION MONITOR ───
    console.log("\n[13] STAGE SYNCHRONIZATION & DECISION MONITOR");
    await new Promise(r => setTimeout(r, 600));
    if (!latestStageState) {
      throw new Error("Stage received no session_state_update!");
    }
    const chainProg = latestStageState.chainProgress;
    if (!chainProg || chainProg[student1.sessionPlayerId] !== 'COMPLETED' || chainProg[student2.sessionPlayerId] !== 'COMPLETED') {
      throw new Error(`Stage chainProgress did not reflect student completion: ${JSON.stringify(chainProg)}`);
    }
    console.log("✓ Stage received real-time chainProgress showing Alice & Bob COMPLETED Vault 3");

    // ─── 14. EXECUTION TRACE FIDELITY IN SUBMIT RESPONSE ───
    console.log("\n[14] EXECUTION TRACE FIDELITY (CONDITIONAL)");
    if (!bobSub.data.executionTrace || !bobSub.data.executionTrace.steps) {
      throw new Error("Submit response missing executionTrace!");
    }
    const ifStep = bobSub.data.executionTrace.steps[0];
    if (ifStep.branchTaken !== 'TRUE' || !ifStep.conditionEvaluated || !ifStep.executedAction) {
      throw new Error("Submit response executionTrace missing conditional branch data!");
    }
    console.log("✓ Execution trace returned with conditionEvaluated and branchTaken = TRUE");

    // ─── 15. RECONNECTION RESILIENCE ───
    console.log("\n[15] RECONNECTION RESILIENCE");
    const reconnectSocket = io(SOCKET_URL, { auth: { token: s1.token } });
    await new Promise(r => reconnectSocket.on('connect', r));
    reconnectSocket.emit('player:join', { roomCode });
    const reconnectedSocketState = await new Promise((resolve) => {
      reconnectSocket.on('session_state_update', resolve);
    });
    if (reconnectedSocketState.chainProgress?.[student1.sessionPlayerId] !== 'COMPLETED') {
      throw new Error("Reconnected player state lost completed status over socket!");
    }
    const sessionHttpState = await axios.get(`${API}/sessions/${roomCode}`);
    if (sessionHttpState.data.chainProgress?.[student1.sessionPlayerId] !== 'COMPLETED') {
      throw new Error("Reconnected player state lost completed status via HTTP!");
    }
    reconnectSocket.disconnect();
    console.log("✓ Reconnecting player cleanly recovers session state and completion status");

    // ─── 16. POST-LOCK SUBMISSION REJECTION (CHARLIE) ───
    console.log("\n[16] POST-LOCK SUBMISSION REJECTION (CHARLIE)");
    // GM locks round
    hostSocket.emit('host:change_status', { status: 'ROUND_LOCKED' });
    await new Promise(r => setTimeout(r, 500));
    try {
      await student3.api.post('/sessions/active/submit', {
        answer: { sequence: [2, 3], attempts: 1 }
      });
      throw new Error("Submission accepted after round was locked!");
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log("✓ Submission cleanly rejected when round is locked (HTTP 400)");
      } else {
        throw err;
      }
    }

    // ─── 17. SCORE CALCULATION ───
    console.log("\n[17] SCORE CALCULATION");
    const aliceRecord = await prisma.submission.findFirst({
      where: { sessionId, playerId: student1.sessionPlayerId, isCorrect: true }
    });
    if (!aliceRecord || aliceRecord.score <= 0) {
      throw new Error("Valid submission did not receive points!");
    }
    console.log(`✓ Alice received ${aliceRecord.score} points based on established scoring engine`);

    // ─── 18. ATTEMPT LIMIT EXHAUSTION ───
    console.log("\n[18] ATTEMPT LIMIT EXHAUSTION (3 ATTEMPTS)");
    // Unlock round
    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await new Promise(r => setTimeout(r, 400));

    // Attempt 1 (Wrong)
    await student3.api.post('/sessions/active/submit', {
      answer: { sequence: [4], attempts: 1 }
    });

    // Attempt 2 (Wrong)
    await student3.api.post('/sessions/active/submit', {
      answer: { sequence: [4], attempts: 2 }
    });

    // Attempt 3 (Wrong)
    await student3.api.post('/sessions/active/submit', {
      answer: { sequence: [4], attempts: 3 }
    });

    // Attempt 4 (Rejected)
    try {
      await student3.api.post('/sessions/active/submit', {
        answer: { sequence: [2, 3], attempts: 4 }
      });
      throw new Error("Attempt 4 accepted despite maxAttempts = 3!");
    } catch (err) {
      if (err.response && err.response.status === 400 && err.response.data.error === 'Maximum attempts reached') {
        console.log("✓ Max attempts (3) enforced properly: Attempt 4 rejected with 'Maximum attempts reached'");
      } else {
        throw err;
      }
    }

    // ─── 19. GAME COMPLETION & ENUM SAFETY ───
    console.log("\n[19] GAME COMPLETION & PRISMA ENUM SAFETY");
    hostSocket.emit('host:change_status', { status: 'RESULTS' });
    await new Promise(r => setTimeout(r, 400));

    hostSocket.emit('host:change_status', { status: 'ENDED' });
    await new Promise(r => setTimeout(r, 500));

    const finalSession = await prisma.session.findUnique({ where: { id: sessionId } });
    if (finalSession.status !== 'ENDED') {
      throw new Error(`Expected session status ENDED, got ${finalSession.status}`);
    }
    console.log(`✓ Game session ended cleanly with Prisma SessionStatus enum = ${finalSession.status}`);

    console.log("\n==================================================");
    console.log(">>> ALL VAULT 3 QA TEST CASES PASSED SUCCESSFULLY <<<");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ VAULT 3 QA TEST FAILURE:", err.message);
    if (err.response?.data) {
      console.error("Response Data:", err.response.data);
    }
    process.exit(1);
  } finally {
    if (hostSocket) hostSocket.disconnect();
    if (stageSocket) stageSocket.disconnect();
    if (s1Socket) s1Socket.disconnect();
    if (s2Socket) s2Socket.disconnect();
    if (s3Socket) s3Socket.disconnect();
    if (sTamperSocket) sTamperSocket.disconnect();
    await prisma.$disconnect();
  }
}

run();
