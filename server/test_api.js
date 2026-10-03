const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let resData = '';
      res.on('data', (chunk) => { resData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resData) });
        } catch(e) {
          resolve({ status: res.statusCode, data: resData });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const salt = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6);
  const username = `api_user_${salt}`;
  const email = `api_${salt}@test.com`;
  const password = 'password123';

  console.log('Registering user...');
  let res = await request('POST', '/api/auth/register', { username, email, password });
  let token = res.data?.token;
  const userId = res.data?.user?.id;

  if (!token) {
    console.log('Register failed, trying login with email...');
    res = await request('POST', '/api/auth/login', { email, password });
    token = res.data?.token;
  }
  console.log('Token:', token ? 'obtained' : 'missing');

  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { role: 'SUPER_ADMIN' } });
  }

  console.log('\nCreating Game...');
  res = await request('POST', '/api/games', { name: `API Test Game ${salt}`, template: 'QUIZ' }, token);
  console.log('Game status:', res.status);
  const gameId = res.data?.game?.id;
  if (!gameId) throw new Error('Failed to create game: ' + JSON.stringify(res.data));

  console.log('\nAdding Challenge...');
  res = await request('POST', `/api/games/${gameId}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What is 1+1?',
    options: ['2', '3'],
    answer: '2',
    points: 10
  }, token);
  console.log('Challenge status:', res.status);

  console.log('\nPublishing Game...');
  res = await request('POST', `/api/games/${gameId}/publish`, {}, token);
  console.log('Publish status:', res.status);

  console.log('\nGetting Games...');
  res = await request('GET', '/api/games', null, token);
  console.log('Games count:', res.data?.games?.length);
  console.log('✓ test_api completed successfully');
}

run()
  .catch(err => {
    console.error('test_api failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
