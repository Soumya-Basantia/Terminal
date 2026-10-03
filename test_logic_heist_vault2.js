const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

async function run() {
  console.log("==================================================");
  console.log("PHASE 8.2: LOGIC HEIST VAULT 2 COMPREHENSIVE QA");
  console.log("==================================================");

  let hostSocket, stageSocket, s1Socket, s2Socket, s3Socket, sTamperSocket;

  try {
    // ─── 1. AUTH & SETUP ───
    console.log("\n[1] AUTH & SETUP");
    const gmEmail = `gm_vault2_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_V2_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });
    console.log("✓ GM SuperAdmin registered & authenticated");

    const setupStudent = async (name) => {
      const email = `stud_v2_${name}_${Date.now()}@test.com`;
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

    // ─── 2. GAME & VAULT 2 CREATION ───
    console.log("\n[2] GAME CREATION: LOGIC HEIST (VAULT 2 SPEC)");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Logic Heist: Operation Nightfall - Vault 2',
      description: 'Mainframe signal amplifier infiltration',
      template: 'LOGIC_HEIST'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;
    if (!gameId) throw new Error("Failed to create game");
    console.log(`✓ Game created with ID: ${gameId}`);

    // Vault 2 Challenge Configuration according to Section 6.1.4
    const vault2Config = {
      vault: 2,
      narrative: "Security Layer 2: The signal amplifier requires exactly 9 units of power.",
      initialState: { SIGNAL: 0 },
      targetState: { SIGNAL: 9 },
      blocks: [
        { id: 1, label: "SET SIGNAL = 0", operation: "SET", variable: "SIGNAL", value: 0 },
        { id: 2, label: "ADD 3", operation: "ADD", variable: "SIGNAL", value: 3 },
        { id: 3, label: "LOOP 3 TIMES: ADD 3", operation: "LOOP", variable: "SIGNAL", value: 3, loopCount: 3 },
        { id: 4, label: "MULTIPLY BY 2", operation: "MUL", variable: "SIGNAL", value: 2, isDecoy: true }
      ],
      correctSequence: [1, 3],
      allowedAttempts: 3,
      hintText: "You only need 2 blocks. One sets the starting value. One repeats an action.",
      revealText: "You used ITERATION — running the same instruction multiple times. In Python: `for i in range(3): signal += 3`. You just wrote a loop without writing it.",
      difficulty: "EASY",
      concepts: ["ITERATION", "ARITHMETIC"]
    };

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'BLOCK_CONSTRUCTION',
      prompt: vault2Config.narrative,
      points: 150,
      timerSecs: 90,
      config: vault2Config
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;
    if (!challengeId) throw new Error("Failed to create challenge");
    console.log(`✓ Vault 2 challenge created with ID: ${challengeId}`);

    // Verify config persistence in database
    const savedGame = await axios.get(`${API}/games/${gameId}`, { headers: { Authorization: `Bearer ${gmToken}` } });
    const savedConfig = savedGame.data.game.challenges[0].config;
    if (!savedConfig.blocks || savedConfig.blocks.length !== 4 || savedConfig.targetState.SIGNAL !== 9) {
      throw new Error("Vault 2 custom config failed to persist in DB!");
    }
    console.log("✓ Custom Vault 2 config verified persistent in database");

    // Create Event and Session
    const eventRes = await axios.post(`${API}/events`, {
      name: 'CodeNex Nightfall League',
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

    console.log("✓ Game Status transitioned to ROUND_ACTIVE for Vault 2");

    // ─── 4. SIMPLE REPETITION VIA VALIDATOR ───
    console.log("\n[4] SERVER-SIDE VALIDATION: SIMPLE REPETITION");
    const { Validator } = require('./server/dist/engine');
    const simpleSeqResult = Validator.executeSequence(
      vault2Config.blocks,
      [1, 3], // SET SIGNAL = 0, LOOP 3 TIMES: ADD 3
      vault2Config.initialState
    );
    if (simpleSeqResult.finalState.SIGNAL !== 9) {
      throw new Error(`Expected SIGNAL = 9, got ${simpleSeqResult.finalState.SIGNAL}`);
    }
    if (!simpleSeqResult.steps[1].iterations || simpleSeqResult.steps[1].iterations.length !== 3) {
      throw new Error("Loop step did not capture 3 iterations!");
    }
    console.log("✓ Server executeSequence correctly expanded loop into 3 iterations with finalState = 9");

    // ─── 5. DIFFERENT REPEAT COUNTS ───
    console.log("\n[5] DIFFERENT REPEAT COUNTS");
    const customBlocks = [
      { id: 1, label: "SET SIGNAL = 0", operation: "SET", variable: "SIGNAL", value: 0 },
      { id: 10, label: "LOOP 5 TIMES: ADD 3", operation: "LOOP", variable: "SIGNAL", value: 3, loopCount: 5 }
    ];
    const fiveRepeatResult = Validator.executeSequence(customBlocks, [1, 10], { SIGNAL: 0 });
    if (fiveRepeatResult.finalState.SIGNAL !== 15 || fiveRepeatResult.steps[1].iterations.length !== 5) {
      throw new Error(`Expected 5 iterations and SIGNAL = 15, got ${fiveRepeatResult.finalState.SIGNAL}`);
    }
    console.log("✓ Different repeat count (5 iterations) verified: SIGNAL = 15");

    // ─── 6. INVALID REPEAT COUNT / MISMATCH TARGET ───
    console.log("\n[6] REPEAT COUNT MISMATCH TARGET REJECTION");
    const wrongRepeatBlocks = [
      { id: 1, label: "SET SIGNAL = 0", operation: "SET", variable: "SIGNAL", value: 0 },
      { id: 20, label: "LOOP 2 TIMES: ADD 3", operation: "LOOP", variable: "SIGNAL", value: 3, loopCount: 2 }
    ];
    const wrongRepeat = Validator.executeSequence(wrongRepeatBlocks, [1, 20], { SIGNAL: 0 });
    if (wrongRepeat.finalState.SIGNAL === 9) {
      throw new Error("2-repeat unexpectedly produced 9!");
    }
    console.log(`✓ 2-repeat correctly evaluated to SIGNAL = ${wrongRepeat.finalState.SIGNAL} (target: 9, mismatch handled)`);

    // ─── 7. INVALID BLOCK TAMPER RESISTANCE ───
    console.log("\n[7] INVALID BLOCK TAMPER RESISTANCE (MALLORY)");
    const tamperRes = await studentTamper.api.post('/sessions/active/submit', {
      answer: {
        sequence: [9999, 8888], // Non-existent blocks
        finalState: { SIGNAL: 9 }, // Attempt to forge state
        attempts: 1
      }
    });
    if (tamperRes.data.isCorrect === true) {
      throw new Error("Tampered submission with non-existent blocks was accepted!");
    }
    console.log("✓ Malicious non-existent block IDs safely rejected by server-side validator");

    // ─── 8. INCORRECT FINAL STATE REJECTION ───
    console.log("\n[8] INCORRECT FINAL STATE REJECTION");
    const wrongSubRes = await student1.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 2], // SET SIGNAL = 0, ADD 3 -> SIGNAL = 3 (target: 9)
        finalState: { SIGNAL: 3 },
        attempts: 1
      }
    });
    if (wrongSubRes.data.isCorrect === true) {
      throw new Error("Incorrect final state was accepted as correct!");
    }
    console.log("✓ Incomplete sequence (SIGNAL = 3) rejected with isCorrect = false");

    // ─── 9. DRY RUN SAFETY ───
    console.log("\n[9] DRY RUN SAFETY");
    const subCountBefore = await prisma.submission.count({ where: { sessionId } });
    const dryRunResult = Validator.executeSequence(vault2Config.blocks, [1, 3], vault2Config.initialState);
    const subCountAfter = await prisma.submission.count({ where: { sessionId } });
    if (subCountBefore !== subCountAfter) {
      throw new Error("Dry run persisted a submission record!");
    }
    if (dryRunResult.finalState.SIGNAL !== 9) {
      throw new Error("Dry run computation failed");
    }
    console.log("✓ Dry Run verified safe: computed locally, zero database mutations");

    // ─── 10. MULTIPLE ATTEMPTS (P2002 REGRESSION VERIFICATION) ───
    console.log("\n[10] MULTIPLE ATTEMPTS (P2002 REGRESSION VERIFICATION)");
    // Alice had attempt 1 (wrong). Now submit attempt 2 with correct sequence
    const attempt2Res = await student1.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 3], // Correct loop
        finalState: { SIGNAL: 9 },
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
        answer: {
          sequence: [1, 3],
          attempts: 2
        }
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
    // Bob solves independently
    const bobSub = await student2.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 3],
        finalState: { SIGNAL: 9 },
        attempts: 1
      }
    });
    if (!bobSub.data.isCorrect) {
      throw new Error("Bob's independent submission failed!");
    }
    console.log("✓ Bob solved independently; Alice's prior submission had zero interference on Bob");

    // ─── 13. STAGE SYNCHRONIZATION & LOOP MONITOR ───
    console.log("\n[13] STAGE SYNCHRONIZATION & LOOP MONITOR");
    await new Promise(r => setTimeout(r, 600));
    if (!latestStageState) {
      throw new Error("Stage received no session_state_update!");
    }
    const chainProg = latestStageState.chainProgress;
    if (!chainProg || chainProg[student1.sessionPlayerId] !== 'COMPLETED' || chainProg[student2.sessionPlayerId] !== 'COMPLETED') {
      throw new Error(`Stage chainProgress did not reflect student completion: ${JSON.stringify(chainProg)}`);
    }
    console.log("✓ Stage received real-time chainProgress showing Alice & Bob COMPLETED Vault 2");

    // ─── 14. EXECUTION TRACE FIDELITY ───
    console.log("\n[14] EXECUTION TRACE FIDELITY IN SUBMIT RESPONSE");
    if (!bobSub.data.executionTrace || !bobSub.data.executionTrace.steps) {
      throw new Error("Submit response missing executionTrace!");
    }
    const loopStep = bobSub.data.executionTrace.steps[1];
    if (!loopStep.iterations || loopStep.iterations.length !== 3) {
      throw new Error("Submit response executionTrace missing loop iterations!");
    }
    console.log("✓ Execution trace returned with 3 granular loop iterations in API response");

    // ─── 15. RECONNECTION ───
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

    // ─── 16. POST-LOCK SUBMISSION REJECTION ───
    console.log("\n[16] POST-LOCK SUBMISSION REJECTION (CHARLIE)");
    // GM locks round
    hostSocket.emit('host:change_status', { status: 'ROUND_LOCKED' });
    await new Promise(r => setTimeout(r, 500));
    try {
      await student3.api.post('/sessions/active/submit', {
        answer: { sequence: [1, 3], attempts: 1 }
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
      answer: { sequence: [2], attempts: 1 }
    });

    // Attempt 2 (Wrong)
    await student3.api.post('/sessions/active/submit', {
      answer: { sequence: [2], attempts: 2 }
    });

    // Attempt 3 (Wrong)
    await student3.api.post('/sessions/active/submit', {
      answer: { sequence: [2], attempts: 3 }
    });

    // Attempt 4 (Rejected)
    try {
      await student3.api.post('/sessions/active/submit', {
        answer: { sequence: [1, 3], attempts: 4 }
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
    // Show results
    hostSocket.emit('host:change_status', { status: 'RESULTS' });
    await new Promise(r => setTimeout(r, 400));

    // End session
    hostSocket.emit('host:change_status', { status: 'ENDED' });
    await new Promise(r => setTimeout(r, 500));

    const finalSession = await prisma.session.findUnique({ where: { id: sessionId } });
    if (finalSession.status !== 'ENDED') {
      throw new Error(`Expected session status ENDED, got ${finalSession.status}`);
    }
    console.log(`✓ Game session ended cleanly with Prisma SessionStatus enum = ${finalSession.status}`);

    console.log("\n==================================================");
    console.log(">>> ALL 19 VAULT 2 QA TEST CASES PASSED SUCCESSFULLY <<<");
    console.log("==================================================");

  } catch (err) {
    console.error("\n❌ VAULT 2 QA TEST FAILURE:", err.message);
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
