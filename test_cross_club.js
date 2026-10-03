const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('=== STARTING CROSS-CLUB TESTS ===');

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 1. Get clubs
    const langnetClub = await prisma.club.findUnique({ where: { slug: 'langnet' } });
    const codenexClub = await prisma.club.findUnique({ where: { slug: 'codenex' } });

    // 2. Setup users
    const langnetAdminReg = await axios.post(`${API_URL}/auth/register`, {
      email: `langnet_${Date.now()}@test.com`, username: `LN_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    const langnetToken = (await axios.post(`${API_URL}/auth/login`, { email: langnetAdminReg.email, password: 'password123' })).data.token;

    const codenexAdminReg = await axios.post(`${API_URL}/auth/register`, {
      email: `codenex_${Date.now()}@test.com`, username: `CN_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    const codenexToken = (await axios.post(`${API_URL}/auth/login`, { email: codenexAdminReg.email, password: 'password123' })).data.token;

    const studentReg = await axios.post(`${API_URL}/auth/register`, {
      email: `stu_${Date.now()}@test.com`, username: `ST_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    const studentToken = (await axios.post(`${API_URL}/auth/login`, { email: studentReg.email, password: 'password123' })).data.token;

    const superAdminReg = await axios.post(`${API_URL}/auth/register`, {
      email: `super_${Date.now()}@test.com`, username: `SA_${Date.now()}`, password: 'password123'
    }).then(res => res.data.user);
    await prisma.user.update({ where: { id: superAdminReg.id }, data: { role: 'SUPER_ADMIN' } });
    const superAdminToken = (await axios.post(`${API_URL}/auth/login`, { email: superAdminReg.email, password: 'password123' })).data.token;

    // Assign roles manually
    await prisma.clubMember.create({ data: { clubId: langnetClub.id, userId: langnetAdminReg.id, role: 'ADMIN' } });
    await prisma.clubMember.create({ data: { clubId: codenexClub.id, userId: codenexAdminReg.id, role: 'ADMIN' } });

    // 3. Langnet Admin creates Game & Event
    const langnetGame = await axios.post(`${API_URL}/games`, { name: 'LN Game', clubId: langnetClub.id }, { headers: { Authorization: `Bearer ${langnetToken}` } }).then(res => res.data.game);
    const langnetEvent = await axios.post(`${API_URL}/events`, { name: 'LN Event', clubId: langnetClub.id }, { headers: { Authorization: `Bearer ${langnetToken}` } }).then(res => res.data);
    await axios.put(`${API_URL}/events/${langnetEvent.id}`, { status: 'PUBLISHED' }, { headers: { Authorization: `Bearer ${langnetToken}` } });
    
    // Codenex Admin creates Game & Event
    const codenexGame = await axios.post(`${API_URL}/games`, { name: 'CN Game', clubId: codenexClub.id }, { headers: { Authorization: `Bearer ${codenexToken}` } }).then(res => res.data.game);
    const codenexEvent = await axios.post(`${API_URL}/events`, { name: 'CN Event', clubId: codenexClub.id }, { headers: { Authorization: `Bearer ${codenexToken}` } }).then(res => res.data);
    await axios.put(`${API_URL}/events/${codenexEvent.id}`, { status: 'PUBLISHED' }, { headers: { Authorization: `Bearer ${codenexToken}` } });

    // Test cases
    const tests = [
      {
        name: 'LANGNET ADMIN -> LANGNET Game',
        req: () => axios.get(`${API_URL}/games/${langnetGame.id}`, { headers: { Authorization: `Bearer ${langnetToken}` } }),
        expectAllowed: true
      },
      {
        name: 'LANGNET ADMIN -> CODENEX Game',
        req: () => axios.get(`${API_URL}/games/${codenexGame.id}`, { headers: { Authorization: `Bearer ${langnetToken}` } }),
        expectAllowed: false
      },
      {
        name: 'LANGNET ADMIN -> LANGNET Event',
        req: () => axios.post(`${API_URL}/sessions`, { eventId: langnetEvent.id }, { headers: { Authorization: `Bearer ${langnetToken}` } }),
        expectAllowed: true
      },
      {
        name: 'LANGNET ADMIN -> CODENEX Event',
        req: () => axios.post(`${API_URL}/sessions`, { eventId: codenexEvent.id }, { headers: { Authorization: `Bearer ${langnetToken}` } }),
        expectAllowed: false
      },
      {
        name: 'SUPER_ADMIN -> CODENEX Game',
        req: () => axios.get(`${API_URL}/games/${codenexGame.id}`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
        expectAllowed: true
      },
      {
        name: 'SUPER_ADMIN -> LANGNET Event',
        req: () => axios.post(`${API_URL}/sessions`, { eventId: langnetEvent.id }, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
        expectAllowed: true
      },
      {
        name: 'STUDENT -> Create Game',
        req: () => axios.post(`${API_URL}/games`, { name: 'Student Game' }, { headers: { Authorization: `Bearer ${studentToken}` } }),
        expectAllowed: false
      },
    ];

    for (const t of tests) {
      try {
        await t.req();
        if (t.expectAllowed) {
          console.log(`PASS: ${t.name} (Allowed as expected)`);
        } else {
          console.error(`FAIL: ${t.name} (Should have been rejected but was allowed)`);
        }
      } catch (err) {
        if (!t.expectAllowed && err.response && err.response.status === 403) {
          console.log(`PASS: ${t.name} (Rejected with 403 as expected)`);
        } else {
          console.error(`FAIL: ${t.name} (Failed with unexpected error: ${err.message})`);
        }
      }
    }

  } catch (err) {
    console.error('TEST ERROR:', err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

runTests();
