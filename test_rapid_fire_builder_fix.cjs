const axios = require('axios');
const assert = require('assert');

const API = 'http://localhost:3001/api';

// Replicate the client logic for isOptionCorrect to test frontend behavior directly
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function isOptionCorrect(local, opt, oi) {
  const label = OPTION_LABELS[oi];
  const cleanOpt = opt.trim();
  if (local.type === 'MULTIPLE_CHOICE') {
    if (!Array.isArray(local.answer)) return false;
    return local.answer.some(a => {
      if (!a || typeof a !== 'string') return false;
      const cleanA = a.trim();
      if (cleanOpt !== '' && cleanA.toLowerCase() === cleanOpt.toLowerCase()) return true;
      if (cleanA.toUpperCase() === label) {
        const matchingOther = (local.options || []).some((o, otherIdx) => otherIdx !== oi && o.trim() !== '' && o.trim().toUpperCase() === label);
        if (!matchingOther) return true;
      }
      return false;
    });
  }
  if (typeof local.answer !== 'string' || !local.answer.trim()) return false;
  const cleanAns = local.answer.trim();
  if (cleanOpt !== '' && cleanAns.toLowerCase() === cleanOpt.toLowerCase()) return true;
  if (cleanAns.toUpperCase() === label) {
    const matchingOther = (local.options || []).some((o, otherIdx) => otherIdx !== oi && o.trim() !== '' && o.trim().toUpperCase() === label);
    if (!matchingOther) return true;
  }
  return false;
}

async function run() {
  console.log('=================================================================');
  console.log('   RAPID FIRE QUESTION BUILDER & VALIDATION TEST SUITE');
  console.log('=================================================================');

  // 1. Authenticate GM
  console.log('\n[1] GM Authentication...');
  const loginRes = await axios.post(`${API}/auth/login`, {
    login: 'demo@terminal.dev',
    password: 'terminal123',
  });
  const gmToken = loginRes.data.token;
  const gmHeaders = { headers: { Authorization: `Bearer ${gmToken}` } };
  console.log('✓ GM Authenticated');

  // 2. Unit Verification of Radio Selection Bug: A=4, B=6, C=3, D=5
  console.log('\n[2] Verifying Radio Selection Bug Logic (Unit)...');
  const userCaseQuestion = {
    type: 'SINGLE_CHOICE',
    options: ['4', '6', '3', '5'],
    answer: '3', // User selected Option C (text "3")
  };

  const selA = isOptionCorrect(userCaseQuestion, '4', 0);
  const selB = isOptionCorrect(userCaseQuestion, '6', 1);
  const selC = isOptionCorrect(userCaseQuestion, '3', 2);
  const selD = isOptionCorrect(userCaseQuestion, '5', 3);

  console.log(`  Option A ("4", idx 0): selected = ${selA}`);
  console.log(`  Option B ("6", idx 1): selected = ${selB}`);
  console.log(`  Option C ("3", idx 2): selected = ${selC}`);
  console.log(`  Option D ("5", idx 3): selected = ${selD}`);

  assert.strictEqual(selA, false, 'Option A should not be selected');
  assert.strictEqual(selB, false, 'Option B should not be selected');
  assert.strictEqual(selC, true, 'Option C MUST be selected');
  assert.strictEqual(selD, false, 'Option D MUST NOT be selected (Radio-selection bug fixed!)');
  console.log('✓ Bug verified resolved: Option C selected does NOT select Option D!');

  // Test edge case where option text is "D" on Option A:
  const invertedCase = {
    type: 'SINGLE_CHOICE',
    options: ['D', 'C', 'B', 'A'],
    answer: 'D', // User selected Option A (text "D")
  };
  assert.strictEqual(isOptionCorrect(invertedCase, 'D', 0), true, 'Option A text "D" selected');
  assert.strictEqual(isOptionCorrect(invertedCase, 'A', 3), false, 'Option D label "D" not falsely selected');
  console.log('✓ Edge case: Option text matching another option label handled properly!');

  // 3. Create a RAPID_FIRE game
  console.log('\n[3] Creating RAPID_FIRE Game...');
  const ts = Date.now();
  const gameRes = await axios.post(`${API}/games`, {
    name: `RF Question Test ${ts}`,
    template: 'RAPID_FIRE',
    description: 'Testing builder save, options persistence, and session launch',
    maxPlayers: 50,
  }, gmHeaders);
  const game = gameRes.data.game;
  console.log(`✓ Game created: ID ${game.id}`);

  // 4. Create Question 1 with A=4, B=6, C=3, D=5, answer=3
  console.log('\n[4] Adding Question 1 (A=4, B=6, C=3, D=5, Ans=3)...');
  const chRes = await axios.post(`${API}/games/${game.id}/challenges`, {
    type: 'SINGLE_CHOICE',
    prompt: 'What is 1 + 2?',
    options: ['4', '6', '3', '5'],
    answer: '3',
    points: 100,
    timerSecs: 20,
    difficulty: 'EASY',
    // Simulate what the client was doing previously: sending a config object
    config: {
      options: ['', '', '', ''],
      answer: '',
    }
  }, gmHeaders);
  const ch = chRes.data.challenge;
  console.log(`✓ Challenge created: ID ${ch.id}`);
  console.log(`  Persisted Options:`, JSON.stringify(ch.options));
  console.log(`  Persisted Answer:`, JSON.stringify(ch.answer));

  assert.deepStrictEqual(ch.options, ['4', '6', '3', '5'], 'Options must be ["4", "6", "3", "5"]');
  assert.strictEqual(ch.answer, '3', 'Answer must be "3"');

  // 5. Verify DB reload
  console.log('\n[5] Verifying DB Reload for Question 1...');
  const reloadRes = await axios.get(`${API}/games/${game.id}`, gmHeaders);
  const reloadedGame = reloadRes.data.game;
  const reloadedCh = reloadedGame.challenges[0];
  console.log(`  Reloaded Options:`, JSON.stringify(reloadedCh.options));
  console.log(`  Reloaded Answer:`, JSON.stringify(reloadedCh.answer));

  assert.deepStrictEqual(reloadedCh.options, ['4', '6', '3', '5'], 'Reloaded options must match');
  assert.strictEqual(reloadedCh.answer, '3', 'Reloaded answer must match');
  console.log('✓ Reload verification passed!');

  // 6. Test PATCH Challenge with options and answer update (even if stale config object is sent)
  console.log('\n[6] Testing PATCH with stale config object in body (Bug 2 root cause test)...');
  const patchRes = await axios.patch(`${API}/games/${game.id}/challenges/${ch.id}`, {
    options: ['4', '6', '3', '5'],
    answer: '3',
    prompt: 'Compute: 2 + 1',
    config: {
      options: ['', '', '', ''], // Stale nested config that previously overwrote options
      answer: '',
    }
  }, gmHeaders);

  const patchedCh = patchRes.data.challenge;
  console.log(`  Patched Options:`, JSON.stringify(patchedCh.options));
  console.log(`  Patched Answer:`, JSON.stringify(patchedCh.answer));
  assert.deepStrictEqual(patchedCh.options, ['4', '6', '3', '5'], 'PATCH must preserve options');
  assert.strictEqual(patchedCh.answer, '3', 'PATCH must preserve answer');
  console.log('✓ Stale config overwrite immunity verified!');

  // 7. Publish Game & Start Session (COMPILE RUN)
  console.log('\n[7] Testing COMPILE RUN (POST /api/sessions)...');
  await axios.post(`${API}/games/${game.id}/publish`, {}, gmHeaders);
  console.log('✓ Game published');

  const sessionRes = await axios.post(`${API}/sessions`, { gameId: game.id }, gmHeaders);
  const session = sessionRes.data.session;
  console.log(`✓ Session successfully created! Room Code: ${session.roomCode || session.code}`);
  console.log('✓ No "Single choice questions must have at least 2 non-empty options" error!');

  // 8. Test Transition: SINGLE_CHOICE -> MULTIPLE_CHOICE
  console.log('\n[8] Testing Transition: SINGLE_CHOICE -> MULTIPLE_CHOICE...');
  const patchMultiRes = await axios.patch(`${API}/games/${game.id}/challenges/${ch.id}`, {
    type: 'MULTIPLE_CHOICE',
    options: ['4', '6', '3', '5'],
    answer: ['3', '5'],
  }, gmHeaders);
  const multiCh = patchMultiRes.data.challenge;
  assert.strictEqual(multiCh.type, 'MULTIPLE_CHOICE');
  assert.deepStrictEqual(multiCh.answer, ['3', '5']);
  console.log('✓ Transition to MULTIPLE_CHOICE succeeded and persisted');

  // 9. Test Transition: MULTIPLE_CHOICE -> TRUE_FALSE
  console.log('\n[9] Testing Transition: MULTIPLE_CHOICE -> TRUE_FALSE...');
  const patchTFRes = await axios.patch(`${API}/games/${game.id}/challenges/${ch.id}`, {
    type: 'TRUE_FALSE',
    options: ['True', 'False'],
    answer: 'True',
  }, gmHeaders);
  const tfCh = patchTFRes.data.challenge;
  assert.strictEqual(tfCh.type, 'TRUE_FALSE');
  assert.deepStrictEqual(tfCh.options, ['True', 'False']);
  assert.strictEqual(tfCh.answer, 'True');
  console.log('✓ Transition to TRUE_FALSE succeeded and persisted');

  // 10. Test Transition: TRUE_FALSE -> SINGLE_CHOICE
  console.log('\n[10] Testing Transition: TRUE_FALSE -> SINGLE_CHOICE...');
  const patchSingleAgain = await axios.patch(`${API}/games/${game.id}/challenges/${ch.id}`, {
    type: 'SINGLE_CHOICE',
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
    answer: 'Option 2',
  }, gmHeaders);
  const singleAgain = patchSingleAgain.data.challenge;
  assert.strictEqual(singleAgain.type, 'SINGLE_CHOICE');
  assert.deepStrictEqual(singleAgain.options, ['Option 1', 'Option 2', 'Option 3', 'Option 4']);
  assert.strictEqual(singleAgain.answer, 'Option 2');
  console.log('✓ Transition back to SINGLE_CHOICE succeeded and persisted');

  console.log('\n=================================================================');
  console.log('   ALL RAPID FIRE BUILDER TESTS PASSED WITH 100% SUCCESS!');
  console.log('=================================================================');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});
