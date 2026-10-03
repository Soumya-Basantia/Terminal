const axios = require('axios');
const { io } = require('socket.io-client');
const API_URL = 'http://localhost:3001/api';

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('=== STARTING SOCKET AUTH TESTS ===');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Register users
    const superAdminReg = await axios.post(`${API_URL}/auth/register`, {
      email: `sa_${Date.now()}@test.com`, username: `SA_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    await prisma.user.update({ where: { id: superAdminReg.id }, data: { role: 'SUPER_ADMIN' } });
    const superAdminToken = (await axios.post(`${API_URL}/auth/login`, { email: superAdminReg.email, password: 'password123' })).data.token;

    const club1AdminReg = await axios.post(`${API_URL}/auth/register`, {
      email: `c1a_${Date.now()}@test.com`, username: `C1A_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    await prisma.user.update({ where: { id: club1AdminReg.id }, data: { role: 'GAME_MASTER' } });
    const club1AdminToken = (await axios.post(`${API_URL}/auth/login`, { email: club1AdminReg.email, password: 'password123' })).data.token;

    const club2AdminReg = await axios.post(`${API_URL}/auth/register`, {
      email: `c2a_${Date.now()}@test.com`, username: `C2A_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    await prisma.user.update({ where: { id: club2AdminReg.id }, data: { role: 'GAME_MASTER' } });
    const club2AdminToken = (await axios.post(`${API_URL}/auth/login`, { email: club2AdminReg.email, password: 'password123' })).data.token;

    const studentReg = await axios.post(`${API_URL}/auth/register`, {
      email: `st_${Date.now()}@test.com`, username: `ST_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    const studentToken = (await axios.post(`${API_URL}/auth/login`, { email: studentReg.email, password: 'password123' })).data.token;

    // Unsupported clubs are rejected; use an approved club for authorization setup.
    const rejectedClubResponse = await axios.post(
      `${API_URL}/clubs`,
      { name: `Club1_${Date.now()}`, slug: `club1-${Date.now()}` },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    ).catch(error => error.response);
    if (rejectedClubResponse?.status !== 400) {
      throw new Error('The API should reject clubs outside the configured platform list');
    }

    const club = await prisma.club.findUnique({ where: { slug: 'codenex' } });
    if (!club) throw new Error('CODENEX is missing; run the database seed first');
    const event = await axios.post(`${API_URL}/events`, { name: 'Club 1 Event', clubId: club.id }, { headers: { Authorization: `Bearer ${superAdminToken}` } }).then(res => res.data);
    await axios.put(`${API_URL}/events/${event.id}`, { status: 'PUBLISHED' }, { headers: { Authorization: `Bearer ${superAdminToken}` } });
    
    // Manual database queries for setup because there are no API endpoints for club member management yet
    
    await prisma.clubMember.create({ data: { clubId: club.id, userId: club1AdminReg.id, role: 'ADMIN' } });
    await prisma.clubMember.create({ data: { clubId: club.id, userId: studentReg.id, role: 'MEMBER' } }); // random member
    // club2 admin has NO connection to this club

    const sessionRes = await axios.post(`${API_URL}/sessions`, { eventId: event.id }, { headers: { Authorization: `Bearer ${club1AdminToken}` } });
    const roomCode = sessionRes.data.session.roomCode;
    console.log(`Session created: ${roomCode}`);

    // Helpers to test sockets
    const testSocketAction = (token, name) => new Promise((resolve) => {
      const socket = io('http://localhost:3001', { auth: { token } });
      let handled = false;
      
      socket.on('connect', () => {
        socket.emit('host:join', { roomCode });
      });

      socket.on('error', (err) => {
        handled = true;
        socket.disconnect();
        resolve({ name, allowed: false, error: err.message });
      });

      socket.on('session_state_update', (state) => {
        handled = true;
        socket.disconnect();
        resolve({ name, allowed: true });
      });
      
      setTimeout(() => {
        if (!handled) {
          socket.disconnect();
          resolve({ name, allowed: false, error: 'TIMEOUT' });
        }
      }, 1000);
    });

    const testChangeStatus = (token, name) => new Promise((resolve) => {
        const socket = io('http://localhost:3001', { auth: { token } });
        socket.on('connect', () => {
            // Join first to set role
            socket.emit('host:join', { roomCode });
            setTimeout(() => {
                let handled = false;
                socket.on('session_state_update', (s) => {
                    if (s.status === 'STARTING') {
                        handled = true;
                        socket.disconnect();
                        resolve({ name, allowed: true });
                    }
                });
                socket.emit('host:change_status', { status: 'STARTING' });
                setTimeout(() => {
                    if (!handled) {
                        socket.disconnect();
                        resolve({ name, allowed: false, error: 'TIMEOUT/IGNORED' });
                    }
                }, 1000);
            }, 500);
        });
    });

    console.log('--- RUNNING SOCKET AUTH TESTS ---');
    
    // CASE 1: Super Admin -> host session
    const res1 = await testSocketAction(superAdminToken, 'CASE 1: Super Admin');
    console.log(`${res1.name}: ${res1.allowed ? 'ALLOWED (Pass)' : 'REJECTED (Fail)'}`);
    
    // CASE 2: Authorized Club Admin -> host their club's session
    const res2 = await testSocketAction(club1AdminToken, 'CASE 2: Authorized Club Admin');
    console.log(`${res2.name}: ${res2.allowed ? 'ALLOWED (Pass)' : 'REJECTED (Fail)'}`);
    
    // CASE 3: Club Admin -> host another club's session
    const res3 = await testSocketAction(club2AdminToken, 'CASE 3: Unauthorized Club Admin');
    console.log(`${res3.name}: ${!res3.allowed ? 'REJECTED (Pass)' : 'ALLOWED (Fail)'}`);
    
    // CASE 4: Student -> host session
    const res4 = await testSocketAction(studentToken, 'CASE 4: Student (host:join)');
    console.log(`${res4.name}: ${!res4.allowed ? 'REJECTED (Pass)' : 'ALLOWED (Fail)'}`);

    // CASE 5: Student -> attempt host:change_status
    // Student can't even host:join so host:change_status will definitely fail due to role check
    const res5 = await testChangeStatus(studentToken, 'CASE 5: Student (host:change_status)');
    console.log(`${res5.name}: ${!res5.allowed ? 'REJECTED (Pass)' : 'ALLOWED (Fail)'}`);

    // CASE 7: Unauthenticated socket
    const res7 = await testSocketAction(null, 'CASE 7: Unauthenticated');
    console.log(`${res7.name}: ${!res7.allowed ? 'REJECTED (Pass)' : 'ALLOWED (Fail)'}`);

    await prisma.$disconnect();
    
    if (res1.allowed && res2.allowed && !res3.allowed && !res4.allowed && !res5.allowed && !res7.allowed) {
        console.log('ALL TESTS PASSED');
        process.exit(0);
    } else {
        console.log('SOME TESTS FAILED');
        process.exit(1);
    }
  } catch (e) {
    console.error('TEST ERROR:', e.response?.data || e.message);
    process.exit(1);
  }
}

run();
