const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const io = require('socket.io-client');

const TEST_PORT = 3005;

// 1. Unit Tests on compiled config/cors module
console.log('================================================================');
console.log('🧪 1. UNIT TESTING CORS RESOLUTION & ORIGIN MATCHING LOGIC');
console.log('================================================================');

const corsModule = require('./server/dist/config/cors');
const { resolveAllowedOrigins, isOriginAllowed } = corsModule;

const { allowedOrigins } = resolveAllowedOrigins('https://custom-client.com,https://terminal-two-gilt.vercel.app');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ PASS: ${message}`);
}

// Production Vercel Origin
assert(isOriginAllowed('https://terminal-two-gilt.vercel.app', allowedOrigins), 'Production Vercel URL is allowed');
assert(isOriginAllowed('https://terminal-two-gilt-preview.vercel.app', allowedOrigins), 'Vercel branch preview URL for TERMINAL is allowed');

// Localhost Development
assert(isOriginAllowed('http://localhost:5173', allowedOrigins), 'localhost:5173 is allowed');
assert(isOriginAllowed('http://127.0.0.1:5173', allowedOrigins), '127.0.0.1:5173 is allowed');
assert(isOriginAllowed('http://localhost:3000', allowedOrigins), 'localhost:3000 is allowed');
assert(isOriginAllowed('http://localhost:8080', allowedOrigins), 'localhost on arbitrary port is allowed');

// Configured custom client
assert(isOriginAllowed('https://custom-client.com', allowedOrigins), 'Custom client in CLIENT_URL is allowed');

// Non-browser / Server-to-server
assert(isOriginAllowed(undefined, allowedOrigins), 'Undefined origin (curl/mobile/server-to-server) is allowed');

// Rejection of Unknown Origins
assert(!isOriginAllowed('https://evil-attacker.com', allowedOrigins), 'Arbitrary malicious origin is REJECTED');
assert(!isOriginAllowed('https://random-user.vercel.app', allowedOrigins), 'Unrelated Vercel app is REJECTED');
assert(!isOriginAllowed('http://phishing-terminal.com', allowedOrigins), 'Phishing domain is REJECTED');

console.log('\n================================================================');
console.log('🚀 2. INTEGRATION TESTING LIVE EXPRESS & SOCKET.IO CORS');
console.log('================================================================');

async function runIntegrationTests() {
  console.log(`Starting server on port ${TEST_PORT} with CLIENT_URL=https://terminal-two-gilt.vercel.app...`);

  const serverProcess = spawn('node', ['server/dist/index.js'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      HOST: '127.0.0.1',
      NODE_ENV: 'production',
      CLIENT_URL: 'https://terminal-two-gilt.vercel.app'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverLogs = '';
  serverProcess.stdout.on('data', d => serverLogs += d.toString());
  serverProcess.stderr.on('data', d => serverLogs += d.toString());

  function makeRequest(method, path, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body
        }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  // Wait for server to boot
  let booted = false;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await makeRequest('GET', '/health');
      if (res.status === 200) {
        booted = true;
        break;
      }
    } catch {}
  }

  if (!booted) {
    console.error('Server failed to boot. Output:');
    console.error(serverLogs);
    serverProcess.kill('SIGKILL');
    process.exit(1);
  }

  console.log('✓ Server booted successfully.\n');

  // Verify Startup Log
  assert(serverLogs.includes('Allowed CORS origins:'), 'Startup log lists Allowed CORS origins');
  assert(serverLogs.includes('https://terminal-two-gilt.vercel.app'), 'Startup log confirms https://terminal-two-gilt.vercel.app');

  // ── TEST A: Production Vercel Origin (Preflight OPTIONS) ─────────────────
  const vercelPreflight = await makeRequest('OPTIONS', '/api/auth/login', {
    'Origin': 'https://terminal-two-gilt.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type, Authorization'
  });
  assert(vercelPreflight.headers['access-control-allow-origin'] === 'https://terminal-two-gilt.vercel.app',
    'OPTIONS preflight returns Access-Control-Allow-Origin: https://terminal-two-gilt.vercel.app');
  assert(vercelPreflight.headers['access-control-allow-credentials'] === 'true',
    'OPTIONS preflight returns Access-Control-Allow-Credentials: true');

  // ── TEST B: Production Vercel Origin (GET /health) ───────────────────────
  const vercelGet = await makeRequest('GET', '/health', {
    'Origin': 'https://terminal-two-gilt.vercel.app'
  });
  assert(vercelGet.headers['access-control-allow-origin'] === 'https://terminal-two-gilt.vercel.app',
    'GET /health returns Access-Control-Allow-Origin: https://terminal-two-gilt.vercel.app');
  assert(vercelGet.headers['access-control-allow-credentials'] === 'true',
    'GET /health returns Access-Control-Allow-Credentials: true');

  // ── TEST C: Localhost Development Origin (GET /health) ───────────────────
  const localhostGet = await makeRequest('GET', '/health', {
    'Origin': 'http://localhost:5173'
  });
  assert(localhostGet.headers['access-control-allow-origin'] === 'http://localhost:5173',
    'Localhost GET returns Access-Control-Allow-Origin: http://localhost:5173');
  assert(localhostGet.headers['access-control-allow-credentials'] === 'true',
    'Localhost GET returns Access-Control-Allow-Credentials: true');

  // ── TEST D: Rejection of Unknown Origin (OPTIONS & GET) ──────────────────
  const evilPreflight = await makeRequest('OPTIONS', '/api/auth/login', {
    'Origin': 'https://evil-attacker.com',
    'Access-Control-Request-Method': 'POST'
  });
  assert(!evilPreflight.headers['access-control-allow-origin'],
    'Preflight from https://evil-attacker.com omits Access-Control-Allow-Origin');

  const evilGet = await makeRequest('GET', '/health', {
    'Origin': 'https://evil-attacker.com'
  });
  assert(!evilGet.headers['access-control-allow-origin'],
    'GET /health from https://evil-attacker.com omits Access-Control-Allow-Origin');

  // ── TEST E: Socket.IO Connection with Production Vercel Origin ─────────
  console.log('\nTesting Socket.IO connection from production Vercel origin...');
  const vercelSocket = io(`http://127.0.0.1:${TEST_PORT}`, {
    extraHeaders: {
      Origin: 'https://terminal-two-gilt.vercel.app'
    },
    transports: ['websocket', 'polling']
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      vercelSocket.disconnect();
      reject(new Error('Socket.IO connection timed out for Vercel origin'));
    }, 4000);

    vercelSocket.on('connect', () => {
      clearTimeout(timer);
      console.log('  ✓ PASS: Socket.IO connected with Origin: https://terminal-two-gilt.vercel.app');
      vercelSocket.disconnect();
      resolve();
    });

    vercelSocket.on('connect_error', (err) => {
      // If server requires auth token at handshake, it still proves CORS passed
      clearTimeout(timer);
      if (err.message.includes('Authentication') || err.message.includes('token') || err.message.includes('auth')) {
        console.log('  ✓ PASS: Socket.IO handshake passed CORS (reached auth guard: ' + err.message + ')');
        vercelSocket.disconnect();
        resolve();
      } else {
        reject(err);
      }
    });
  });

  // ── TEST F: Socket.IO Connection with Localhost Origin ─────────────────
  console.log('\nTesting Socket.IO connection from localhost origin...');
  const localSocket = io(`http://127.0.0.1:${TEST_PORT}`, {
    extraHeaders: {
      Origin: 'http://localhost:5173'
    },
    transports: ['websocket', 'polling']
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      localSocket.disconnect();
      reject(new Error('Socket.IO connection timed out for localhost origin'));
    }, 4000);

    localSocket.on('connect', () => {
      clearTimeout(timer);
      console.log('  ✓ PASS: Socket.IO connected with Origin: http://localhost:5173');
      localSocket.disconnect();
      resolve();
    });

    localSocket.on('connect_error', (err) => {
      clearTimeout(timer);
      if (err.message.includes('Authentication') || err.message.includes('token') || err.message.includes('auth')) {
        console.log('  ✓ PASS: Socket.IO handshake passed CORS (reached auth guard: ' + err.message + ')');
        localSocket.disconnect();
        resolve();
      } else {
        reject(err);
      }
    });
  });

  // ── Shutdown Server ────────────────────────────────────────────────────
  console.log('\nTearing down test server...');
  serverProcess.kill('SIGTERM');
  await new Promise(r => serverProcess.on('exit', r));
  console.log('✓ Test server shutdown cleanly.');

  console.log('\n================================================================');
  console.log('🎉 ALL CORS SECURITY & ORIGIN TESTS PASSED (100%)');
  console.log('================================================================');
}

runIntegrationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
