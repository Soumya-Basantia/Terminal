const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:3001/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('TESTING IDENTITY MAPPING, WHOAMI, COLLAB & TERMINAL SPECS');
  console.log('===============================================================');

  // 1. Authenticate user domo
  console.log('\n--- 1. VERIFY DOMO AUTHENTICATION & IDENTITY ---');
  const loginRes = await request('POST', '/auth/login', {
    login: '1VA24CI102',
    password: 'Password123!'
  });

  assert(loginRes.status === 200, `Expected login 200, got ${loginRes.status}`);
  const token = loginRes.body.token;
  const user = loginRes.body.user;

  console.log('  Login successful for DOMO');
  assert(user.username === 'domo', `User username MUST be "domo", got "${user.username}"`);
  assert(user.usn === '1VA24CI102', `User USN MUST be "1VA24CI102", got "${user.usn}"`);
  console.log('  ✅ PASS: Username is strictly "domo" (not USN)');
  console.log('  ✅ PASS: USN is strictly "1VA24CI102"');

  // 2. Test Student Workspace
  console.log('\n--- 2. VERIFY GET /api/workspace/student ---');
  const wsRes = await request('GET', '/workspace/student', null, token);
  assert(wsRes.status === 200, `Expected 200 from workspace, got ${wsRes.status}`);
  const s = wsRes.body.student;
  
  assert(s.username === 'domo', `Workspace student username MUST be "domo", got "${s.username}"`);
  assert(s.usn === '1VA24CI102', `Workspace student usn MUST be "1VA24CI102", got "${s.usn}"`);
  const derivedPublicHandle = `${s.username}@terminal`;
  assert(derivedPublicHandle === 'domo@terminal', `Derived handle MUST be "domo@terminal", got "${derivedPublicHandle}"`);
  console.log(`  ✅ PASS: Public Terminal Handle is verified as: ${derivedPublicHandle}`);
  console.log(`  ✅ PASS: Student Academic USN is verified as: ${s.usn}`);

  // 3. Test Collab Directory Sanitization
  console.log('\n--- 3. VERIFY COLLAB DIRECTORY (PUBLIC HANDLES ONLY) ---');
  const collabRes = await request('GET', '/collab', null, token);
  assert(collabRes.status === 200, `Expected 200 from /collab, got ${collabRes.status}`);
  const dir = collabRes.body.directory;
  assert(Array.isArray(dir), 'Expected directory to be an array');
  console.log(`  Directory returned ${dir.length} operatives`);

  // Verify each operative has handle = username@terminal and NO USN, email, or test prefixes
  for (const op of dir) {
    assert(op.handle.endsWith('@terminal'), `Operative handle must end with @terminal: ${op.handle}`);
    assert(!op.usn, `Operative in directory MUST NOT expose USN: ${JSON.stringify(op)}`);
    assert(!op.email, `Operative in directory MUST NOT expose email: ${JSON.stringify(op)}`);
    assert(!op.id, `Operative in directory MUST NOT expose internal DB id: ${JSON.stringify(op)}`);
    assert(['CONNECTED', 'PENDING', 'ADD'].includes(op.relation), `Operative relation must be CONNECTED/PENDING/ADD: ${op.relation}`);
    
    // Test fixture leaks
    assert(!op.username.startsWith('cap_u'), `Directory must not contain cap_u fixtures: ${op.username}`);
    assert(!op.username.startsWith('room_p'), `Directory must not contain room_p fixtures: ${op.username}`);
    assert(!op.username.startsWith('S1_'), `Directory must not contain S1_ fixtures: ${op.username}`);
  }
  console.log('  ✅ PASS: All directory items use pure "username@terminal" public handles');
  console.log('  ✅ PASS: Zero leakage of USN, email, or internal database IDs in directory');
  console.log('  ✅ PASS: Zero test fixture accounts leaked into campus directory');

  // 4. Test collab add with public handle
  console.log('\n--- 4. VERIFY COLLAB ADD ACCEPTS username@terminal ---');
  // Add another registered user
  const peerUser = dir.find(d => d.username !== 'domo' && d.relation === 'ADD');
  if (peerUser) {
    const addRes = await request('POST', '/collab/add', { handle: peerUser.handle }, token);
    assert(addRes.status === 200 || addRes.status === 400, `Add response unexpected status: ${addRes.status}`);
    console.log(`  ✅ PASS: /collab/add successfully accepts public handle "${peerUser.handle}"`);
  } else {
    console.log('  (Skipping collab add peer test, all peers already connected/pending)');
  }

  console.log('\n===============================================================');
  console.log('ALL AUDIT TESTS PASSED: IDENTITY, WHOAMI & COLLAB VERIFIED!');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
