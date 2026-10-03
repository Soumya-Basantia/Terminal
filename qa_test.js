const axios = require('axios');
const { io } = require('socket.io-client');

const API_URL = 'http://localhost:3001/api';
let gmToken = '';
let gmId = '';
let studentToken = '';

async function run() {
  console.log('=== STARTING QA TESTS ===');
  try {
    const gmEmail = `gm_${Date.now()}@test.com`;
    const studentEmail = `student_${Date.now()}@test.com`;

    // 1. Auth GM
    const gmReg = await axios.post(`${API_URL}/auth/register`, {
      email: gmEmail,
      username: `GM_${Date.now()}`,
      password: 'password123',
      role: 'HOST'
    }).catch(e => e.response);
    
    const gmLog = await axios.post(`${API_URL}/auth/login`, {
      email: gmEmail,
      password: 'password123'
    });
    gmToken = gmLog.data.token;
    gmId = gmLog.data.user.id;

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.user.update({ where: { id: gmId }, data: { role: 'SUPER_ADMIN' } });

    console.log('GM Authenticated', gmId);

    // 2. Auth Student
    const stReg = await axios.post(`${API_URL}/auth/register`, {
      email: studentEmail,
      username: `Student_${Date.now()}`,
      password: 'password123',
      role: 'PLAYER'
    }).catch(e => e.response);
    const stLog = await axios.post(`${API_URL}/auth/login`, {
      email: studentEmail,
      password: 'password123'
    });
    studentToken = stLog.data.token;
    console.log('Student Authenticated');

    // 3. Create Game
    const gameRes = await axios.post(`${API_URL}/games`, {
      name: 'QA Test Game',
      description: 'Test',
      type: 'QUIZ',
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const gameId = gameRes.data.game.id;
    console.log('Game Created:', gameId);

    // 4. Create Challenge
    const chRes = await axios.post(`${API_URL}/games/${gameId}/challenges`, {
      type: 'SINGLE_CHOICE',
      prompt: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      answer: '4',
      points: 10,
      timerSecs: 30
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const challengeId = chRes.data.challenge.id;
    console.log('Challenge Created:', challengeId);

    // 5. Create Event
    const evRes = await axios.post(`${API_URL}/events`, {
      name: 'QA Event',
      mode: 'SEQUENCE'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const eventId = evRes.data.id;
    console.log('Event Created:', eventId);

    // 6. Link Game to Event
    await axios.post(`${API_URL}/events/${eventId}/games`, {
      gameId: gameId,
      position: 0
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    console.log('Game Linked');

    // 6.5 Publish Event
    await axios.put(`${API_URL}/events/${eventId}`, {
      status: 'PUBLISHED'
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    console.log('Event Published');
    
    // 7. Create Session
    const sessRes = await axios.post(`${API_URL}/sessions`, {
      eventId: eventId
    }, { headers: { Authorization: `Bearer ${gmToken}` } });
    const roomCode = sessRes.data.session.roomCode;
    console.log('Session Created, Room Code:', roomCode);

    // 8. Student Joins
    const joinRes = await axios.post(`${API_URL}/sessions/join`, {
      roomCode
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log('Student Joined Session');

    // 9. GM Starts Game & Challenge
    await axios.put(`${API_URL}/sessions/${sessRes.data.session.id}/advance`, {}, { headers: { Authorization: `Bearer ${gmToken}` } });
    console.log('Event Advanced to First Game');
    
    // Need socket to select challenge since it's a socket event
    const gmSocket = io('http://localhost:3001', { auth: { token: gmToken } });
    gmSocket.on('connect', () => {
      gmSocket.emit('host:join', { roomCode });
      
      setTimeout(async () => {
        console.log('GM Selecting Challenge via Socket');
        gmSocket.emit('host:select_challenge', { challengeId });
        
        setTimeout(async () => {
          // 10. Student Submits
          try {
            const subRes = await axios.post(`${API_URL}/sessions/active/submit`, {
              answer: 'B' // Since '4' is index 1
            }, { headers: { Authorization: `Bearer ${studentToken}` } });
            console.log('Student Submission Response:', subRes.data);
            
            // Test Concurrency - double submit
            const doubleSubRes = await axios.post(`${API_URL}/sessions/active/submit`, {
              answer: 'A'
            }, { headers: { Authorization: `Bearer ${studentToken}` } }).catch(e => e.response);
            console.log('Double Submission (should fail 400):', doubleSubRes.status);

          } catch (err) {
            console.error('Submission failed:', err.response?.data || err.message);
            process.exit(1);
          }
          
          process.exit(0);
        }, 500);
      }, 500);
    });

  } catch (e) {
    console.error('TEST FAILED:', e.response ? e.response.data : e.message);
    process.exit(1);
  }
}

run();
