/**
 * test_lifecycle_guard.cjs — STATIC architectural guard.
 *
 * Enforces the P0 invariant:
 *   NO AUTHORITATIVE SESSION STATUS MUTATION OUTSIDE THE LIFECYCLE GATEWAY.
 *
 * Scans every production .ts file under server/src and fails loudly if any
 * prisma.session.update / updateMany call near a `status:` write exists
 * outside the approved modules:
 *   - server/src/services/sessionLifecycle.ts  (the gateway)
 *   - server/src/services/questionSweep.ts     (the restart-safe sweep)
 *
 * This is a guardrail for future code, not just a snapshot of current behavior.
 *
 * Run from repo root:  node test_lifecycle_guard.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'server', 'src');
const OK_FILES = new Set([
  path.join(SRC, 'services', 'sessionLifecycle.ts'),
  path.join(SRC, 'services', 'questionSweep.ts'),
]);

// Matches `prisma.session.update(` … `});` and `prisma.session.updateMany(` … `});`
// (covers multi-line invocations; non-greedy so it stops at the real close).
const UPDATE_CALL = /prisma\.session\.(update|updateMany)\(\s*([\s\S]*?)\}\);?/g;
const STATUS_LITERAL = /(?:^|[\s,{])(status\s*:\s*['"`][A-Z_]+['"`])/;

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walk(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

let failures = [];
let checked = 0;
let benignCalls = 0;

for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, 'utf8');
  const isAuthorized = OK_FILES.has(file.replaceAll('\\', '/')) || OK_FILES.has(file);
  let m;
  UPDATE_CALL.lastIndex = 0;
  while ((m = UPDATE_CALL.exec(source)) !== null) {
    const callKind = m[1];
    const body = m[2];
    if (!STATUS_LITERAL.test(body)) {
      benignCalls++; // stageMode-only or non-status updates are fine
      continue;
    }
    checked++;
    if (isAuthorized) continue; // gateway / sweep — approved
    failures.push({
      file: path.relative(ROOT, file),
      line: source.slice(0, m.index).split('\n').length,
      kind: callKind,
    });
  }
}

console.log('==============================================================');
console.log('  STATIC GUARD — SESSION STATUS WRITE AUDIT                    ');
console.log('==============================================================');
if (failures.length > 0) {
  console.log('\n✗ DIRECT SESSION STATUS MUTATION OUTSIDE LIFECYCLE GATEWAY\n');
  for (const f of failures) {
    console.log(`  ${f.file}:${f.line}  [${f.kind}]  ✗ RAW STATUS WRITE`);
  }
  console.log('\nRESULT: FAIL — remove the raw writes and route through sessionLifecycle.ts');
  process.exit(1);
}

console.log(`\n  ✓ ${checked} status-bearing session mutation(s) all inside the gateway/sweep`);
console.log(`  ✓ ${benignCalls} non-status session update(s) (stageMode etc.) — benign`);
console.log('  ✓ No raw Session.status writes outside server/src/services/sessionLifecycle.ts');
console.log('    or server/src/services/questionSweep.ts');
console.log('\nRESULT: PASS ✦');