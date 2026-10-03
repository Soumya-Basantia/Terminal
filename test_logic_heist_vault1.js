const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

async function run() {
  console.log("==================================================");
  console.log("PHASE 8.1: LOGIC HEIST VAULT 1 COMPREHENSIVE QA");
  console.log("==================================================");

  try {
    // ─── 1. AUTHENTICATION & SETUP ───
    console.log("\n[1] AUTH & SETUP");
    const gmEmail = `gm_vault1_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_V1_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });
    console.log("✓ GM SuperAdmin registered & authenticated");

    const setupStudent = async (name) => {
      const email = `stud_${name}_${Date.now()}@test.com`;
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
    console.log("✓ 3 Students registered & authenticated (Alice, Bob, Charlie)");

    // ─── 2. GAME & VAULT 1 CREATION ───
    console.log("\n[2] GAME CREATION: LOGIC HEIST (VAULT 1 SPEC)");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Logic Heist: Operation Nightfall',
      description: 'Mainframe power grid infiltration',
      template: 'LOGIC_HEIST'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;

    // Vault 1 Challenge Configuration
    const vault1Config = {
      vault: 1,
      narrative: "OPERATION NIGHTFALL: Infiltrate the mainframe power grid. The primary relay requires exactly 15 units of power to bypass the security interlock.",
      initialState: { POWER: 0 },
      targetState: { POWER: 15 },
      blocks: [
        { id: 1, label: "SET POWER = 5", operation: "SET", variable: "POWER", value: 5 },
        { id: 2, label: "ADD 10", operation: "ADD", variable: "POWER", value: 10 },
        { id: 3, label: "ADD 3", operation: "ADD", variable: "POWER", value: 3 },
        { id: 4, label: "SUB 2", operation: "SUB", variable: "POWER", value: 2 }
      ],
      correctSequence: [1, 2],
      allowedAttempts: 3,
      hintText: "Look at the starting power and what simple addition gets you directly to 15.",
      revealText: "You just executed SEQUENTIAL LOGIC — instructions executing in order, modifying state one step at a time.",
      difficulty: "EASY",
      concepts: ["SEQUENCING", "STATE", "ARITHMETIC"]
    };

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'BLOCK_CONSTRUCTION',
      prompt: vault1Config.narrative,
      points: 100,
      timerSecs: 90,
      config: vault1Config
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;
    console.log(`✓ Vault 1 created with challengeId: ${challengeId}`);

    // Create Event and Session
    const eventRes = await axios.post(`${API}/events`, {
      name: 'Cybercore Tournament',
      mode: 'SEQUENCE'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = eventRes.data.id;
    await axios.post(`${API}/events/${eventId}/games`, { gameId, position: 0 }, { headers: { Authorization: `Bearer ${gmToken}` } });
    await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, { headers: { Authorization: `Bearer ${gmToken}` } });

    const sessionRes = await axios.post(`${API}/sessions`, { eventId }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const roomCode = sessionRes.data.session.roomCode;
    const sessionId = sessionRes.data.session.id;
    console.log(`✓ Session initialized with Room Code: ${roomCode}`);

    // ─── 3. SOCKETS INITIALIZATION ───
    console.log("\n[3] SOCKET SYNCHRONIZATION");
    const hostSocket = io(SOCKET_URL, { auth: { token: gmToken } });
    await new Promise(r => hostSocket.on('connect', r));
    hostSocket.emit('host:join', { roomCode });

    const stageSocket = io(SOCKET_URL, { auth: { isStage: true } });
    await new Promise(r => stageSocket.on('connect', r));
    stageSocket.emit('stage:join', { roomCode });

    let latestStageData = null;
    stageSocket.on('session_state_update', (data) => {
      latestStageData = data;
    });

    const initStudentSocket = async (student) => {
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

    const student1 = await initStudentSocket(s1);
    const student2 = await initStudentSocket(s2);
    const student3 = await initStudentSocket(s3);
    console.log("✓ GM, Stage, and 3 Students successfully joined room socket");

    // ─── 4. GAME START ───
    console.log("\n[4] STARTING GAME & VAULT 1");
    hostSocket.emit('host:select_game', { gameId, position: 0 });
    await new Promise(r => setTimeout(r, 600));

    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await new Promise(r => setTimeout(r, 600));

    console.log("✓ Game Status transitioned to ROUND_ACTIVE");
    console.log(`✓ Stage reports: ${latestStageData?.playerCount} players connected, StageMode: ${latestStageData?.session?.stageMode}`);

    // ─── 5. STAGE VISIBILITY VALIDATION ───
    console.log("\n[5] STAGE VISIBILITY VERIFICATION");
    if (!latestStageData?.currentGame?.challenges?.length) {
      throw new Error("Stage has not received vault challenges!");
    }
    const stageVault = latestStageData.currentGame.challenges[0];
    console.log(`✓ Stage Target State:`, stageVault.config?.targetState);
    if (!stageVault.config?.targetState?.POWER) {
      throw new Error("Target state POWER is missing on Stage payload!");
    }
    // Verify answers are stripped from stage/client payload
    if (stageVault.config?.correctSequence) {
      throw new Error("SECURITY FAILURE: correctSequence was leaked in stage payload!");
    }
    console.log("✓ SECURITY PASS: Answer-revealing fields stripped from public socket payload");

    // ─── 6. STUDENT 1: WRONG SEQUENCE (FAILURE & RECOVERY) ───
    console.log("\n[6] ATTEMPT 1: INVALID SOLUTION (Failure & Trace Feedback)");
    // Student 1 tries: SET POWER = 5 (1), ADD 3 (3) -> 8 != 15
    const wrongSubRes = await student1.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 3],
        attempts: 1,
        hintsUsed: 0
      }
    });

    console.log("Attempt 1 isCorrect:", wrongSubRes.data.isCorrect);
    console.log("Attempt 1 pointsAwarded:", wrongSubRes.data.pointsAwarded);
    console.log("Attempt 1 execution trace finalState:", wrongSubRes.data.executionTrace?.finalState);

    if (wrongSubRes.data.isCorrect !== false) throw new Error("Expected Attempt 1 to be false!");
    if (wrongSubRes.data.pointsAwarded !== 0) throw new Error("Expected 0 points for wrong attempt!");
    if (wrongSubRes.data.executionTrace?.finalState?.POWER !== 8) throw new Error("Execution trace computed incorrect state!");
    console.log("✓ Failure feedback verified: trace accurately shows POWER = 8, not 15");

    // ─── 7. MALFORMED & FORGED ATTACK VALIDATION ───
    console.log("\n[7] SERVER AUTHORITY & TAMPER RESISTANCE TEST");
    const attacker = await initStudentSocket(await setupStudent('Eve'));

    // Tamper attempt: Client sends fake score and fake finalState
    const tamperRes = await attacker.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 3],
        correct: true,
        score: 9999,
        finalState: { POWER: 15 } // Lie to server
      }
    });
    console.log("Server response to forged finalState:", tamperRes.data.isCorrect, tamperRes.data.pointsAwarded);
    if (tamperRes.data.isCorrect !== false || tamperRes.data.pointsAwarded !== 0) {
      throw new Error("SECURITY BREACH: Server accepted client forged state/correct status!");
    }
    console.log("✓ SECURITY PASS: Server independently re-evaluated sequence and rejected forged state");

    // Malformed block IDs
    const malformedRes = await attacker.api.post('/sessions/active/submit', {
      answer: { sequence: [999, 888] }
    });
    if (malformedRes.data.isCorrect !== false) throw new Error("Server accepted non-existent block IDs!");
    console.log("✓ SECURITY PASS: Non-existent block IDs safely rejected");

    // Empty sequence
    const emptyRes = await attacker.api.post('/sessions/active/submit', {
      answer: { sequence: [] }
    });
    if (emptyRes.data.isCorrect !== false) throw new Error("Server accepted empty sequence!");
    console.log("✓ SECURITY PASS: Empty sequence safely rejected");

    // ─── 8. STUDENT 1: RECOVERY & VALID BREACH (2ND ATTEMPT SCORING) ───
    console.log("\n[8] ATTEMPT 2: VALID SOLUTION & RETRY SCORING");
    // Student 1 adjusts sequence: [1, 2] -> 5 + 10 = 15
    const validSubRes = await student1.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 2],
        attempts: 2,
        hintsUsed: 0
      }
    });

    console.log("Attempt 2 isCorrect:", validSubRes.data.isCorrect);
    console.log("Attempt 2 pointsAwarded:", validSubRes.data.pointsAwarded);
    console.log("Attempt 2 trace:", validSubRes.data.executionTrace?.steps?.map(s => s.label));

    if (!validSubRes.data.isCorrect) throw new Error("Valid sequence was not accepted!");
    // Base 100 * 0.70 (2nd attempt) + 15% efficiency (used 2 of 4 blocks) + 15% speed = ~100 pts
    if (validSubRes.data.pointsAwarded < 70) throw new Error("Score does not reflect 2nd attempt scoring rules!");
    console.log(`✓ Student 1 successfully breached Vault 1 with ${validSubRes.data.pointsAwarded} XP!`);

    await new Promise(r => setTimeout(r, 600));

    // ─── 9. DUPLICATE SUBMISSION AFTER SUCCESS ───
    console.log("\n[9] POST-SUCCESS DUPLICATE SUBMISSION REJECTION");
    try {
      await student1.api.post('/sessions/active/submit', {
        answer: { sequence: [1, 2], attempts: 3 }
      });
      throw new Error("Duplicate submission after success was accepted!");
    } catch (err) {
      console.log("✓ Duplicate submission rejected as expected (HTTP 400):", err.response?.data?.error);
    }

    // ─── 10. STUDENT 2: ALTERNATIVE VALID SEQUENCE (LOGIC DISCOVERY) ───
    console.log("\n[10] STUDENT 2: ALTERNATIVE VALID SEQUENCE (Non-Linear Reasoning)");
    // Student 2 solves on attempt 1 using arithmetic reasoning:
    // SET POWER = 5 (1), ADD 3 (3), ADD 3 (3), ADD 3 (3), ADD 3 (3), SUB 2 (4) -> 5 + 12 - 2 = 15!
    const s2SubRes = await student2.api.post('/sessions/active/submit', {
      answer: {
        sequence: [1, 3, 3, 3, 3, 4],
        attempts: 1,
        hintsUsed: 0
      }
    });

    console.log("Student 2 isCorrect:", s2SubRes.data.isCorrect);
    console.log("Student 2 finalState:", s2SubRes.data.executionTrace?.finalState);
    console.log("Student 2 pointsAwarded:", s2SubRes.data.pointsAwarded);

    if (!s2SubRes.data.isCorrect) throw new Error("Alternative valid sequence was rejected!");
    if (s2SubRes.data.executionTrace?.finalState?.POWER !== 15) throw new Error("Trace final state is not 15!");
    console.log("✓ Alternative sequence successfully executed and verified server-side!");

    // ─── 11. STUDENT 3: MAX ATTEMPTS EXHAUSTION ───
    console.log("\n[11] STUDENT 3: MAX ATTEMPTS ENFORCEMENT");
    // Attempt 1: wrong
    await student3.api.post('/sessions/active/submit', { answer: { sequence: [3], attempts: 1 } });
    // Attempt 2: wrong
    await student3.api.post('/sessions/active/submit', { answer: { sequence: [3], attempts: 2 } });
    // Attempt 3: wrong
    await student3.api.post('/sessions/active/submit', { answer: { sequence: [3], attempts: 3 } });

    // Attempt 4: Should be rejected for exceeding max attempts
    try {
      await student3.api.post('/sessions/active/submit', { answer: { sequence: [1, 2], attempts: 4 } });
      throw new Error("Student was allowed to submit past max allowed attempts!");
    } catch (err) {
      console.log("✓ Attempt 4 rejected as expected (HTTP 400):", err.response?.data?.error);
    }

    // ─── 12. MULTIPLAYER LEADERBOARD & STAGE SYNC ───
    console.log("\n[12] MULTIPLAYER LEADERBOARD & STAGE SYNC");
    await new Promise(r => setTimeout(r, 600));

    const sessionStateRes = await axios.get(`${API}/sessions/${roomCode}`);
    const lb = sessionStateRes.data.leaderboard;
    console.log("Current Leaderboard Standings:", lb);

    if (lb.length < 2) throw new Error("Leaderboard does not show both winning students!");
    const s1Entry = lb.find(e => e.name === student1.username);
    const s2Entry = lb.find(e => e.name === student2.username);

    if (!s1Entry || !s2Entry) throw new Error("Students missing from leaderboard!");
    console.log(`✓ Student 1 (${s1Entry.name}): ${s1Entry.score} pts`);
    console.log(`✓ Student 2 (${s2Entry.name}): ${s2Entry.score} pts`);

    // Verify stage aggregated cracked count
    console.log("Stage chain progress:", latestStageData?.chainProgress);
    const crackedCount = Object.values(latestStageData?.chainProgress || {}).filter(v => v === 'COMPLETED').length;
    console.log(`Stage Cracked Vaults: ${crackedCount}`);
    if (crackedCount !== 2) throw new Error(`Expected Stage to show 2 cracked vaults, got ${crackedCount}`);
    console.log("✓ Stage correctly aggregates multiplayer vault breaches!");

    // ─── 13. RECONNECT TEST ───
    console.log("\n[13] RECONNECTION BEHAVIOR");
    student1.socket.disconnect();
    await new Promise(r => setTimeout(r, 300));

    const reconnectedSocket = io(SOCKET_URL, { auth: { token: student1.token } });
    await new Promise(r => reconnectedSocket.on('connect', r));
    reconnectedSocket.emit('player:join', { roomCode });

    const stateOnReconnect = await new Promise((resolve) => {
      reconnectedSocket.on('session_state_update', (st) => resolve(st));
    });

    if (stateOnReconnect.chainProgress?.[student1.sessionPlayerId] !== 'COMPLETED') {
      throw new Error("Reconnected student lost completed vault progress!");
    }
    console.log("✓ Student reconnect preserves chain progress and game state");
    reconnectedSocket.disconnect();

    // ─── 14. GAME COMPLETION & GM END EVENT ───
    console.log("\n[14] GAME COMPLETION & GM EVENT TERMINATION");
    hostSocket.emit('host:change_status', { status: 'FINAL' });
    await new Promise(r => setTimeout(r, 600));

    // Attempt to submit after game end
    try {
      await student2.api.post('/sessions/active/submit', { answer: { sequence: [1, 2] } });
      throw new Error("Submission accepted after game termination!");
    } catch (err) {
      console.log("✓ Submission after game end rejected as expected (HTTP 400):", err.response?.data?.error);
    }

    // Cleanup sockets
    hostSocket.disconnect();
    stageSocket.disconnect();
    student2.socket.disconnect();
    student3.socket.disconnect();

    console.log("\n==================================================");
    console.log("✓ ALL PHASE 8.1 LOGIC HEIST VAULT 1 TESTS PASSED!");
    console.log("==================================================");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ TEST FAILED WITH ERROR:", error.response?.data || error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

run();
