const axios = require('axios');
const io = require('socket.io-client');

const API = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

async function run() {
  console.log('====================================================');
  console.log('   TERMINAL AUTOMATED REGRESSION & INTEGRATION SUITE');
  console.log('====================================================');

  // 1. GM Authentication (using demo designer or test GM)
  console.log('\n[TEST 1] GM Authentication...');
  const gmLogin = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123'
  });
  const gmToken = gmLogin.data.token;
  const gmUser = gmLogin.data.user;
  console.log(`✓ GM Authenticated: ${gmUser.name} (${gmUser.role})`);

  // 2. Student Registration & Authentication
  console.log('\n[TEST 2] Student Registration & Authentication...');
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const studentReg = await axios.post(`${API}/auth/register`, {
    name: `Student QA ${ts}`,
    username: `u_${rand}`,
    usn: `1MS24CS${String(ts).slice(-4)}`,
    email: `stu_${rand}_${ts}@campus.edu`,
    branch: 'CSE',
    section: 'A',
    password: 'Password123!',
  });
  const studentToken = studentReg.data.token;
  const studentUser = studentReg.data.user;
  console.log(`✓ Student Registered & Authenticated: ${studentUser.name} (${studentUser.role})`);

  // 3. Game Creation
  console.log('\n[TEST 3] Create RAPID_FIRE Game...');
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };
  const studentHeaders = { headers: { Authorization: `Bearer ${studentToken}` } };

  const createGameRes = await axios.post(`${API}/games`, {
    name: `RF Regression Test ${ts}`,
    template: 'RAPID_FIRE',
    description: 'Testing question type normalization and persistence',
    maxPlayers: 50,
  }, gmHeaders);
  const game = createGameRes.data.game;
  console.log(`✓ Game created: ID ${game.id}, Template: ${game.template}`);

  // 4. Initial Question Creation (SINGLE_CHOICE)
  console.log('\n[TEST 4] Create Initial SINGLE_CHOICE Question...');
  const qCreateRes = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What is the standard loopback address?',
    options: ['192.168.1.1', '10.0.0.1', '127.0.0.1', '255.255.255.0'],
    answer: '127.0.0.1',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
    explanation: '127.0.0.1 is the IPv4 loopback address.',
  }, gmHeaders);
  let challenge = qCreateRes.data.challenge;
  console.log(`✓ SINGLE_CHOICE created: ID ${challenge.id}`);
  console.log(`  Options: ${JSON.stringify(challenge.options)}`);
  console.log(`  Answer: ${JSON.stringify(challenge.answer)}`);
  if (challenge.answer !== '127.0.0.1') throw new Error('Answer mismatch on creation');

  // 5. Server-Side Validation: Reject Malformed Question States
  console.log('\n[TEST 5] Testing Server-side Validation Rejections...');
  
  // 5a. SINGLE_CHOICE with array answer
  try {
    await axios.patch(`${API}/games/${game.id}/challenges/${challenge.id}`, {
      type: 'SINGLE_CHOICE',
      answer: ['127.0.0.1', '10.0.0.1']
    }, gmHeaders);
    throw new Error('Server should have rejected array answer for SINGLE_CHOICE');
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('✓ Rejected SINGLE_CHOICE with multiple answers (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // 5b. TRUE_FALSE with 4 options
  try {
    await axios.patch(`${API}/games/${game.id}/challenges/${challenge.id}`, {
      type: 'TRUE_FALSE',
      options: ['True', 'False', 'Maybe', 'Never'],
      answer: 'True'
    }, gmHeaders);
    throw new Error('Server should have rejected >2 options for TRUE_FALSE');
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('✓ Rejected TRUE_FALSE with 4 options (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // 5c. MULTIPLE_CHOICE with 0 answers
  try {
    await axios.patch(`${API}/games/${game.id}/challenges/${challenge.id}`, {
      type: 'MULTIPLE_CHOICE',
      options: ['A', 'B', 'C', 'D'],
      answer: []
    }, gmHeaders);
    throw new Error('Server should have rejected empty answer for MULTIPLE_CHOICE');
  } catch (err) {
    if (err.response?.status === 400) {
      console.log('✓ Rejected MULTIPLE_CHOICE with empty answer array (400 Bad Request)');
    } else {
      throw err;
    }
  }

  // 6. Transition: SINGLE_CHOICE -> MULTIPLE_CHOICE
  console.log('\n[TEST 6] Transition: SINGLE_CHOICE -> MULTIPLE_CHOICE...');
  const toMultiRes = await axios.patch(`${API}/games/${game.id}/challenges/${challenge.id}`, {
    type: 'MULTIPLE_CHOICE',
    options: ['127.0.0.1', '::1', '10.0.0.1', '192.168.1.1'],
    answer: ['127.0.0.1', '::1'],
    explanation: 'Both 127.0.0.1 and ::1 are loopback addresses.',
  }, gmHeaders);
  challenge = toMultiRes.data.challenge;
  console.log(`✓ MULTIPLE_CHOICE saved:`);
  console.log(`  Options: ${JSON.stringify(challenge.options)}`);
  console.log(`  Answer: ${JSON.stringify(challenge.answer)}`);
  if (!Array.isArray(challenge.answer) || challenge.answer.length !== 2) {
    throw new Error('MULTIPLE_CHOICE answer should be array of length 2');
  }

  // Reload from DB to verify persistence
  const reload1 = await axios.get(`${API}/games/${game.id}`, gmHeaders);
  const reloadedChallenge1 = reload1.data.game.challenges[0];
  if (!Array.isArray(reloadedChallenge1.answer) || reloadedChallenge1.answer.length !== 2) {
    throw new Error('MULTIPLE_CHOICE persistence failed on reload');
  }
  console.log('✓ Verified MULTIPLE_CHOICE persistence on DB reload');

  // 7. Transition: MULTIPLE_CHOICE -> TRUE_FALSE
  console.log('\n[TEST 7] Transition: MULTIPLE_CHOICE -> TRUE_FALSE...');
  const toTFRes = await axios.patch(`${API}/games/${game.id}/challenges/${challenge.id}`, {
    type: 'TRUE_FALSE',
    prompt: 'Is 127.0.0.1 a loopback IP address?',
    options: ['True', 'False'],
    answer: 'True',
  }, gmHeaders);
  challenge = toTFRes.data.challenge;
  console.log(`✓ TRUE_FALSE saved:`);
  console.log(`  Options: ${JSON.stringify(challenge.options)}`);
  console.log(`  Answer: ${JSON.stringify(challenge.answer)}`);
  if (challenge.options.length !== 2 || challenge.answer !== 'True') {
    throw new Error('TRUE_FALSE configuration invalid');
  }

  // Reload from DB
  const reload2 = await axios.get(`${API}/games/${game.id}`, gmHeaders);
  const reloadedChallenge2 = reload2.data.game.challenges[0];
  if (reloadedChallenge2.options.length !== 2 || reloadedChallenge2.answer !== 'True') {
    throw new Error('TRUE_FALSE persistence failed on reload');
  }
  console.log('✓ Verified TRUE_FALSE persistence on DB reload');

  // 8. Transition: TRUE_FALSE -> SINGLE_CHOICE (Clean normalization)
  console.log('\n[TEST 8] Transition: TRUE_FALSE -> SINGLE_CHOICE...');
  const toSingleRes = await axios.patch(`${API}/games/${game.id}/challenges/${challenge.id}`, {
    type: 'SINGLE_CHOICE',
    prompt: 'Which port is used by standard HTTP?',
    options: ['80', '443', '22', '8080'],
    answer: '80',
    explanation: 'HTTP default port is 80.',
  }, gmHeaders);
  challenge = toSingleRes.data.challenge;
  console.log(`✓ SINGLE_CHOICE restored:`);
  console.log(`  Options: ${JSON.stringify(challenge.options)}`);
  console.log(`  Answer: ${JSON.stringify(challenge.answer)}`);
  if (challenge.options.includes('True') || challenge.options.includes('False')) {
    throw new Error('True/False options leaked into SINGLE_CHOICE!');
  }
  if (challenge.answer !== '80') throw new Error('Answer mismatch in SINGLE_CHOICE');

  // 9. Publish Game
  console.log('\n[TEST 9] Publish Game...');
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  console.log('✓ Game published successfully');

  // 10. Event & Live Session Creation & Student Gameplay
  console.log('\n[TEST 10] Event Creation, Session Host & Gameplay Execution...');
  
  // Find a club for event attachment
  const clubsRes = await axios.get(`${API}/clubs`, gmHeaders);
  const clubId = clubsRes.data[0]?.id;

  const eventRes = await axios.post(`${API}/events`, {
    name: `RF Regression Event ${ts}`,
    mode: 'SEQUENCE',
    ...(clubId ? { clubId } : {}),
  }, gmHeaders);
  const eventId = eventRes.data.id;
  console.log(`✓ Event created: ID ${eventId}`);

  await axios.post(`${API}/events/${eventId}/games`, {
    gameId: game.id,
    position: 0,
    purpose: 'NORMAL',
  }, gmHeaders);
  console.log(`✓ Game attached to event`);

  await axios.put(`${API}/events/${eventId}`, { status: 'PUBLISHED' }, gmHeaders);
  console.log(`✓ Event published`);

  const sessionRes = await axios.post(`${API}/sessions`, { eventId }, gmHeaders);
  const session = sessionRes.data.session;
  console.log(`✓ Session created: Code ${session.roomCode}, Status: ${session.status}`);

  // Socket connection for GM
  const gmSocket = io(SOCKET_URL, { auth: { token: gmToken } });
  const studentSocket = io(SOCKET_URL, { auth: { token: studentToken } });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => { if (++connected === 2) resolve(); };
    gmSocket.on('connect', check);
    studentSocket.on('connect', check);
  });
  console.log('✓ GM and Student sockets connected');

  // Join Student via REST
  await axios.post(`${API}/sessions/join`, { roomCode: session.roomCode }, studentHeaders);

  // Sockets join room
  gmSocket.emit('host:join', { roomCode: session.roomCode });
  studentSocket.emit('player:join', { roomCode: session.roomCode });

  await new Promise(r => setTimeout(r, 600));

  // Host selects game & activates challenge
  console.log('Host selecting game and challenge...');
  gmSocket.emit('host:select_game', { gameId: game.id, position: 0 });
  await new Promise(r => setTimeout(r, 1000));

  let questionActivePromise = new Promise(resolve => {
    const handler = (data) => {
      if (data?.session?.status === 'QUESTION_ACTIVE') {
        gmSocket.off('session_state_update', handler);
        resolve(data);
      }
    };
    gmSocket.on('session_state_update', handler);
  });

  gmSocket.emit('host:select_challenge', { challengeId: challenge.id });
  await questionActivePromise;
  console.log('✓ Question is active (QUESTION_ACTIVE)');

  // Student submits answer '80'
  console.log('Student submitting answer "80"...');
  const submitRes = await axios.post(`${API}/sessions/${session.roomCode}/submit`, {
    challengeId: challenge.id,
    answer: '80'
  }, studentHeaders);

  console.log(`✓ Submission result: Correct = ${submitRes.data.isCorrect}, Points = ${submitRes.data.pointsAwarded}`);
  if (!submitRes.data.isCorrect) {
    throw new Error('Answer 80 was marked incorrect by validation engine!');
  }

  // End session
  gmSocket.emit('host:end_event');
  await new Promise(r => setTimeout(r, 600));

  gmSocket.disconnect();
  studentSocket.disconnect();

  console.log('\n====================================================');
  console.log('   ALL REGRESSION CHECKS PASSED SUCCESSFULLY! (10/10)');
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n❌ REGRESSION TEST FAILED:', err.message);
  if (err.response?.data) console.error(err.response.data);
  process.exit(1);
});
