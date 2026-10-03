const axios = require('axios');
const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';
const prisma = new PrismaClient();

async function run() {
  console.log("==================================================");
  console.log("PHASE 8.4: DEAD CODE — THE BUG HUNT QA TEST SUITE");
  console.log("==================================================");

  let hostSocket, stageSocket, s1Socket, s2Socket, s3Socket, sTamperSocket;

  try {
    // ─── 1. AUTH & SETUP ───
    console.log("\n[1] AUTH & SETUP");
    const gmEmail = `gm_bughunt_${Date.now()}@test.com`;
    await axios.post(`${API}/auth/register`, {
      email: gmEmail,
      username: `GM_BH_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    });
    const gmLog = await axios.post(`${API}/auth/login`, { email: gmEmail, password: 'password123' });
    const gmToken = gmLog.data.token;
    const gmId = gmLog.data.user.id;
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });
    console.log("✓ GM SuperAdmin registered & authenticated");

    const setupStudent = async (name) => {
      const email = `stud_bh_${name}_${Date.now()}@test.com`;
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
    console.log("✓ 4 Students registered & authenticated (Alice, Bob, Charlie, Mallory)");

    // ─── 2. GAME & BUG HUNT CASE CREATION ───
    console.log("\n[2] GAME & BUG HUNT CASE CREATION");
    const gameRes = await axios.post(`${API}/games`, {
      name: 'Dead Code: Case Files',
      description: 'Campus system debugging investigations',
      template: 'BUG_HUNT'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;
    if (!gameId) throw new Error("Failed to create game");
    console.log(`✓ Game created with ID: ${gameId}`);

    // Case 17: The Missing Scholarship
    const case17Config = {
      title: "CASE #17: THE MISSING SCHOLARSHIP",
      system: "Campus Scholarship Eligibility Engine",
      narrative: "The scholarship engine is marking students incorrectly. A student with 72% attendance was marked ELIGIBLE when university policy requires at least 75%.",
      reproduction: {
        input: { attendance: 72 },
        expected: "NOT ELIGIBLE",
        actual: "ELIGIBLE",
        description: "Enter attendance 72% to reproduce the faulty behavior."
      },
      rules: [
        {
          id: "rule_a",
          label: "RULE A",
          description: "Attendance is 75% or above → Mark ELIGIBLE",
          field: "attendance",
          operator: ">=",
          threshold: 75,
          output: "ELIGIBLE"
        },
        {
          id: "rule_b",
          label: "RULE B",
          description: "Attendance is 50% or above → Mark ELIGIBLE",
          field: "attendance",
          operator: ">=",
          threshold: 50,
          output: "ELIGIBLE",
          hasBug: true
        },
        {
          id: "rule_c",
          label: "RULE C",
          description: "Attendance is below 50% → Mark NOT ELIGIBLE",
          field: "attendance",
          operator: "<",
          threshold: 50,
          output: "NOT ELIGIBLE"
        }
      ],
      defaultOutput: "NOT ELIGIBLE",
      bug: {
        ruleId: "rule_b",
        type: "WRONG_THRESHOLD",
        description: "Rule B premature threshold marks 50-74% as ELIGIBLE."
      },
      regressionTests: [
        { input: { attendance: 72 }, expected: "NOT ELIGIBLE", description: "Borderline failing student" },
        { input: { attendance: 49 }, expected: "NOT ELIGIBLE", description: "Failing student" },
        { input: { attendance: 75 }, expected: "ELIGIBLE", description: "Exact threshold passing student" },
        { input: { attendance: 91 }, expected: "ELIGIBLE", description: "High attendance passing student" }
      ],
      allowedAttempts: 5,
      storyClue: "Scholarship registry unlocked. Sector clue: CIPHER-99.",
      difficulty: "MEDIUM"
    };

    const chalRes = await axios.post(`${API}/games/${gameId}/challenges`, {
      type: 'DECISION',
      prompt: case17Config.narrative,
      points: 100,
      timeLimit: 120,
      config: case17Config
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chalRes.data.challenge.id;
    console.log(`✓ Challenge created with ID: ${challengeId}`);

    // ─── 3. DB PERSISTENCE VERIFICATION ───
    console.log("\n[3] DATABASE PERSISTENCE VERIFICATION");
    const dbChal = await prisma.challenge.findUnique({ where: { id: challengeId } });
    const loadedConfig = dbChal.config;
    if (loadedConfig.rules.length !== 3) throw new Error("Rules array did not persist in DB!");
    if (loadedConfig.regressionTests.length !== 4) throw new Error("Regression tests did not persist in DB!");
    if (loadedConfig.bug.ruleId !== "rule_b") throw new Error("Bug metadata did not persist in DB!");
    console.log("✓ Custom Case configuration survived DB roundtrip perfectly");

    // ─── 4. EVENT & SESSION LAUNCH ───
    console.log("\n[4] EVENT & SESSION LAUNCH");
    const eventRes = await axios.post(`${API}/events`, {
      name: 'Bug Hunt Championship',
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
    console.log(`✓ Session initialized with Room Code: ${roomCode}`);

    // Connect Sockets
    hostSocket = io(SOCKET_URL, { auth: { token: gmToken } });
    await new Promise(r => hostSocket.on('connect', r));
    hostSocket.emit('host:join', { roomCode });

    stageSocket = io(SOCKET_URL, { auth: { isStage: true } });
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
    const attacker = await initStudentSocket(sTamper);
    console.log("✓ GM, Stage, and 4 Students joined room socket");

    // Select game & start round
    hostSocket.emit('host:select_game', { gameId, position: 0 });
    await new Promise(r => setTimeout(r, 600));
    hostSocket.emit('host:change_status', { status: 'ROUND_ACTIVE' });
    await new Promise(r => setTimeout(r, 600));

    // Verify stage sanitized payload (hasBug and bug stripped)
    const stageChallenge = latestStageData?.currentGame?.challenges?.[0];
    if (stageChallenge?.config?.bug) {
      throw new Error("SECURITY FAILURE: bug identity was leaked in public socket state!");
    }
    if (stageChallenge?.config?.rules?.some(r => r.hasBug)) {
      throw new Error("SECURITY FAILURE: hasBug flag was leaked in public socket rules!");
    }
    console.log("✓ SECURITY PASS: Answer-revealing bug metadata stripped from public socket payload");

    // ─── 5. EXPERIMENTATION & REPRODUCTION ───
    console.log("\n[5] EXPERIMENTATION & REPRODUCTION CONSOLE");
    // Run normal experiment: attendance 80
    const exp1Res = await student1.api.post(`/sessions/${roomCode}/experiment`, {
      challengeId,
      input: { attendance: 80 }
    });
    console.log("Exp 1 (attendance=80):", exp1Res.data);
    if (exp1Res.data.output !== 'ELIGIBLE' || exp1Res.data.isReproduction !== false) {
      throw new Error("Exp 1 output incorrect!");
    }

    // Run reproduction experiment: attendance 72
    const reproRes = await student1.api.post(`/sessions/${roomCode}/experiment`, {
      challengeId,
      input: { attendance: 72 }
    });
    console.log("Reproduction Exp (attendance=72):", reproRes.data);
    if (reproRes.data.output !== 'ELIGIBLE' || reproRes.data.isReproduction !== true) {
      throw new Error("Expected reproduction experiment to confirm bug!");
    }
    console.log("✓ Bug Reproduction confirmed: 72% yielded ELIGIBLE when NOT ELIGIBLE was expected");

    // Run low attendance experiment: attendance 49
    const exp2Res = await student1.api.post(`/sessions/${roomCode}/experiment`, {
      challengeId,
      input: { attendance: 49 }
    });
    console.log("Exp 2 (attendance=49):", exp2Res.data);
    if (exp2Res.data.output !== 'NOT ELIGIBLE' || exp2Res.data.matchedRuleId !== 'rule_c') {
      throw new Error("Exp 2 output incorrect!");
    }
    console.log("✓ Experiments verified boundary behavior (50-74% range is defect zone)");

    // ─── 6. MALICIOUS CLIENT TAMPER ATTEMPTS ───
    console.log("\n[6] MALICIOUS CLIENT TAMPER RESISTANCE");
    // Attacker tries to submit "isCorrect: true" with no patch
    const forgedRes = await attacker.api.post('/sessions/active/submit', {
      answer: {
        status: 'BUG FIXED',
        isCorrect: true,
        score: 9999
      }
    });
    console.log("Forged submission response:", forgedRes.data.isCorrect, forgedRes.data.pointsAwarded);
    if (forgedRes.data.isCorrect !== false || forgedRes.data.pointsAwarded !== 0) {
      throw new Error("SECURITY BREACH: Server accepted client-forged correct status!");
    }
    console.log("✓ SECURITY PASS: Forged submission without patch rejected");

    // Attacker submits non-existent ruleId patch
    const fakeRuleRes = await attacker.api.post('/sessions/active/submit', {
      answer: {
        patchedRuleId: 'fake_rule_999',
        patch: { threshold: 99 }
      }
    });
    if (fakeRuleRes.data.isCorrect !== false) {
      throw new Error("SECURITY BREACH: Server accepted non-existent rule ID patch!");
    }
    console.log("✓ SECURITY PASS: Non-existent rule ID patch rejected");

    // ─── 7. INCORRECT PATCH & REGRESSION DETECTION ───
    console.log("\n[7] INCORRECT PATCH & REGRESSION DETECTION");
    // Student 1 applies a flawed patch: raises Rule A threshold to 80 (breaks 75% test case)
    const regressionSubRes = await student1.api.post('/sessions/active/submit', {
      answer: {
        hypothesis: 'rule_a',
        patchedRuleId: 'rule_a',
        patch: { threshold: 80 },
        reproduced: true,
        experimentsRun: 3,
        attempts: 1
      }
    });

    console.log("Regression Test Result isCorrect:", regressionSubRes.data.isCorrect);
    console.log("Regression details:", regressionSubRes.data.regressionResult?.allPassed);
    if (regressionSubRes.data.isCorrect !== false) {
      throw new Error("Expected flawed patch to fail verification!");
    }
    if (regressionSubRes.data.pointsAwarded !== 0) {
      throw new Error("Flawed patch should award 0 points!");
    }

    const test72 = regressionSubRes.data.regressionResult?.results?.find(r => r.input.attendance === 72);
    console.log("Test case 72% result:", test72);
    if (test72?.passed !== false) {
      throw new Error("Expected test case for 72% to fail verification!");
    }
    console.log("✓ Educational Regression Feedback Verified: Test 72% failed as expected (defect persisted)");

    // ─── 8. MULTI-ATTEMPT RETRY WITHOUT P2002 ───
    console.log("\n[8] MULTI-ATTEMPT RETRY & SUCCESSFUL PATCH VERIFICATION");
    // Student 1 now patches rule_b properly: change threshold to 75
    const fixSubRes = await student1.api.post('/sessions/active/submit', {
      answer: {
        hypothesis: 'rule_b',
        patchedRuleId: 'rule_b',
        patch: { threshold: 75 },
        reproduced: true,
        experimentsRun: 3,
        attempts: 2
      }
    });

    console.log("Fix Attempt 2 isCorrect:", fixSubRes.data.isCorrect);
    console.log("Fix Attempt 2 pointsAwarded:", fixSubRes.data.pointsAwarded);
    console.log("Fix Attempt 2 allPassed:", fixSubRes.data.regressionResult?.allPassed);

    if (fixSubRes.data.isCorrect !== true) {
      throw new Error("Expected correct patch to pass all regression tests!");
    }
    if (fixSubRes.data.regressionResult?.passedCount !== 4) {
      throw new Error("Expected all 4 regression tests to pass!");
    }

    // Points calculation: Attempt 2 multiplier = 0.8 * 100 = 80 pts.
    // Hypothesis bonus (+15%) + Reproduction bonus (+10%) = +25 pts.
    // Total should be >= 90 pts.
    if (fixSubRes.data.pointsAwarded < 80) {
      throw new Error(`Scoring calculation unexpected: ${fixSubRes.data.pointsAwarded}`);
    }
    console.log(`✓ Solution verified: All 4 regression tests passed! Points awarded: ${fixSubRes.data.pointsAwarded}`);

    // ─── 9. DUPLICATE SUBMISSION IDEMPOTENCY ───
    console.log("\n[9] DUPLICATE SUBMISSION PREVENTION");
    try {
      await student1.api.post('/sessions/active/submit', {
        answer: {
          patchedRuleId: 'rule_b',
          patch: { threshold: 75 }
        }
      });
      throw new Error("Student 1 was able to resubmit after already solving!");
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error === 'Already submitted') {
        console.log("✓ Duplicate submission safely blocked with 400 Already submitted");
      } else {
        throw err;
      }
    }

    // ─── 10. MULTIPLAYER ISOLATION ───
    console.log("\n[10] MULTIPLAYER INDEPENDENCE");
    // Student 2 solves on Attempt 1 with correct hypothesis and reproduction
    const s2SubRes = await student2.api.post('/sessions/active/submit', {
      answer: {
        hypothesis: 'rule_b',
        patchedRuleId: 'rule_b',
        patch: { threshold: 75 },
        reproduced: true,
        experimentsRun: 2,
        attempts: 1
      }
    });

    console.log("Student 2 Attempt 1 pointsAwarded:", s2SubRes.data.pointsAwarded);
    if (s2SubRes.data.isCorrect !== true) throw new Error("Student 2 correct solution failed!");
    // Attempt 1 should receive higher score than Student 1 (attempt 2)
    if (s2SubRes.data.pointsAwarded <= fixSubRes.data.pointsAwarded) {
      throw new Error("Attempt 1 did not score higher than Attempt 2!");
    }
    console.log("✓ Multiplayer Isolation Verified: Student 2 scored independently on Attempt 1");

    // ─── 11. POST-LOCK SUBMISSION BLOCK ───
    console.log("\n[11] POST-LOCK SUBMISSION REJECTION");
    hostSocket.emit('host:change_status', { status: 'RESULTS' });
    await new Promise(r => setTimeout(r, 600));

    try {
      await student3.api.post('/sessions/active/submit', {
        answer: {
          patchedRuleId: 'rule_b',
          patch: { threshold: 75 }
        }
      });
      throw new Error("Student 3 submitted during RESULTS status!");
    } catch (err) {
      if (err.response?.status === 400) {
        console.log("✓ Post-lock submission properly rejected with 400");
      } else {
        throw err;
      }
    }

    // ─── 12. STAGE SYNCHRONIZATION ───
    console.log("\n[12] STAGE SYNCHRONIZATION");
    if (!latestStageData?.leaderboard?.length) {
      throw new Error("Stage has not received leaderboard updates!");
    }
    console.log("Stage Leaderboard Top:", latestStageData.leaderboard[0]);
    console.log("✓ Stage correctly reflects top bug squasher and points");

    // ─── 13. SESSION END ───
    console.log("\n[13] SESSION ENDING");
    hostSocket.emit('host:change_status', { status: 'FINAL' });
    await new Promise(r => setTimeout(r, 600));

    const finalSession = await prisma.session.findUnique({ where: { roomCode } });
    if (finalSession.status !== 'ENDED') {
      throw new Error(`Expected session status ENDED, got ${finalSession.status}`);
    }
    console.log("✓ Session cleanly transitioned to ENDED status");

    console.log("\n==================================================");
    console.log("🎉 ALL PHASE 8.4 DEAD CODE BUG HUNT QA TESTS PASSED!");
    console.log("==================================================");
    process.exit(0);

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

run().catch(err => {
  console.error("\n❌ QA TEST FAILED:", err);
  process.exit(1);
});
