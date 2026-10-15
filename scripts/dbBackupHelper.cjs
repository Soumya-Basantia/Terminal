const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getDatabaseConfig() {
  const envPath = fs.existsSync(path.join(__dirname, '../server/.env')) 
    ? path.join(__dirname, '../server/.env')
    : path.join(__dirname, '../.env');

  if (!fs.existsSync(envPath)) {
    throw new Error('Environment file not found');
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
  if (!line) {
    throw new Error('DATABASE_URL not found in env');
  }

  let dbUrl = line.split('DATABASE_URL=')[1].trim();
  if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) dbUrl = dbUrl.slice(1, -1);
  if (dbUrl.startsWith("'") && dbUrl.endsWith("'")) dbUrl = dbUrl.slice(1, -1);

  const parsed = new URL(dbUrl);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '')
  };
}

function backupDatabase() {
  const config = getDatabaseConfig();
  console.log(`Active Target Database: ${config.database}`);
  console.log(`Target Host: ${config.host}:${config.port}`);
  console.log(`Target User: ${config.user}`);

  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `terminal_pre_cleanup_${timestamp}.dump`);
  const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';

  if (!fs.existsSync(pgDumpPath)) {
    throw new Error(`pg_dump.exe not found at ${pgDumpPath}`);
  }

  console.log(`\nExecuting pg_dump to ${backupFile}...`);

  const args = [
    '-h', config.host,
    '-p', config.port,
    '-U', config.user,
    '-F', 'c', // custom compressed format
    '-b', // include blobs
    '-v', // verbose
    '-f', backupFile,
    config.database
  ];

  const env = { ...process.env, PGPASSWORD: config.password };
  const res = spawnSync(pgDumpPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

  if (res.status !== 0) {
    console.error('pg_dump failed with exit code', res.status);
    console.error(res.stderr);
    throw new Error('Database backup failed');
  }

  const stats = fs.statSync(backupFile);
  console.log(`✓ Backup successfully created!`);
  console.log(`  File: ${backupFile}`);
  console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${stats.size} bytes)`);

  return backupFile;
}

if (require.main === module) {
  try {
    backupDatabase();
  } catch (err) {
    console.error('Backup error:', err.message);
    process.exit(1);
  }
}

module.exports = { getDatabaseConfig, backupDatabase };
