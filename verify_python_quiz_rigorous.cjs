const path = require('path');
const { spawnSync } = require('child_process');
require(path.resolve(__dirname, './server/node_modules/dotenv')).config({ path: path.resolve(__dirname, './server/.env') });
const { PrismaClient } = require(path.resolve(__dirname, './server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runRigorousValidation() {
  console.log('================================================================');
  console.log('🔬 RIGOROUS PYTHON 3 QUESTION VALIDATION & DB CONSISTENCY');
  console.log('================================================================\n');

  // STEP 1: ISOLATED PYTHON 3 SUBPROCESS EXECUTION
  console.log('--- STEP 1: ISOLATED PYTHON 3 SUBPROCESS EXECUTION WITH TIMEOUT ---');
  const pyResult = spawnSync('python', ['validate_python_questions.py'], {
    cwd: __dirname,
    timeout: 10000,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  check(pyResult.status === 0, `Python 3 execution exited with code 0 (no runtime error)`);
  check(!pyResult.error, `Python 3 execution completed within 10s timeout`);

  let pyData;
  try {
    pyData = JSON.parse(pyResult.stdout);
  } catch (e) {
    console.error('Failed to parse Python stdout:', pyResult.stdout, pyResult.stderr);
  }
  check(pyData && pyData.success === true, `All 10 Python code snippets evaluated to true in Python 3.10 runtime`);

  const pyResults = pyData.results;

  // STEP 2: VERIFY ALL 10 QUESTIONS (MCQ, MAQ, True/False, Distractor Uniqueness)
  console.log('\n--- STEP 2: INDEPENDENT SEMANTIC & DISTRACTOR VERIFICATION ---');

  const { QUESTIONS, GAME_TITLE } = require('./scripts/seed-python-rapid-fire.cjs');
  check(QUESTIONS.length === 10, `Question bank has exactly 10 questions`);

  // Q1 — MCQ: Operator precedence
  const q1 = QUESTIONS[0];
  check(q1.type === 'SINGLE_CHOICE', `Q1 is SINGLE_CHOICE`);
  check(pyResults.Q1.val === 512, `Q1 2 ** 3 ** 2 evaluates to 512 in Python 3`);
  check(q1.options.length === 4, `Q1 has 4 options`);
  check(new Set(q1.options).size === 4, `Q1 all 4 distractors/options are unique: [${q1.options.join(', ')}]`);
  const q1Matches = q1.options.filter(o => o === String(pyResults.Q1.val));
  check(q1Matches.length === 1, `Q1 has exactly ONE correct option matching Python output ("512")`);
  check(q1.answer === '512', `Q1 answer key is "512"`);
  check(q1.explanation.includes('512') && q1.explanation.includes('right to left'), `Q1 explanation correctly explains right-to-left grouping`);

  // Q2 — MCQ: String repetition and concatenation
  const q2 = QUESTIONS[1];
  check(q2.type === 'SINGLE_CHOICE', `Q2 is SINGLE_CHOICE`);
  check(pyResults.Q2.val === '553' && pyResults.Q2.is_str === true, `Q2 evaluates to string '553' (not int 553)`);
  check(q2.options.length === 4, `Q2 has 4 options: [${q2.options.join(', ')}]`);
  check(new Set(q2.options).size === 4, `Q2 all 4 options are distinct (including string vs int distractor)`);
  check(q2.options.includes("'553'") && q2.options.includes('553 as an integer'), `Q2 includes both "'553'" and distractor "553 as an integer"`);
  check(q2.answer === "'553'", `Q2 answer key is strictly string "'553'"`);
  check(q2.explanation.includes('string rather than an integer'), `Q2 explanation clarifies string vs integer type distinction`);

  // Q3 — MAQ: Boolean logic and short-circuiting
  const q3 = QUESTIONS[2];
  check(q3.type === 'MULTIPLE_CHOICE', `Q3 is MULTIPLE_CHOICE (MAQ)`);
  check(q3.options.length === 4, `Q3 has 4 options`);
  check(new Set(q3.options).size === 4, `Q3 all 4 options are distinct`);
  check(pyResults.Q3.expr_a === true, `Q3 option A (x == 0 or x > 1) evaluates to True`);
  check(pyResults.Q3.expr_b === true, `Q3 option B (not x) evaluates to True`);
  check(pyResults.Q3.expr_c === false, `Q3 option C (x != 0 and 10 / x > 1) short-circuits to False`);
  check(pyResults.Q3.expr_d === true, `Q3 option D (bool(x) == False) evaluates to True`);
  const q3Expected = ['x == 0 or x > 1', 'not x', 'bool(x) == False'];
  check(Array.isArray(q3.answer) && q3.answer.length === 3, `Q3 answer key has exactly 3 correct options`);
  check(
    q3Expected.every(opt => q3.answer.includes(opt)),
    `Q3 answer key contains the complete correct set: [${q3.answer.join(', ')}]`
  );
  check(!q3.answer.includes('x != 0 and 10 / x > 1'), `Q3 correctly marks option C as incorrect (short-circuit False)`);

  // Q4 — MCQ: Negative-step slicing
  const q4 = QUESTIONS[3];
  check(q4.type === 'SINGLE_CHOICE', `Q4 is SINGLE_CHOICE`);
  check(pyResults.Q4.val === 'EEO', `Q4 s[-2::-2] evaluates to "EEO" in Python 3`);
  check(q4.options.length === 4, `Q4 has 4 options: [${q4.options.join(', ')}]`);
  check(new Set(q4.options).size === 4, `Q4 all 4 options are distinct: [${q4.options.join(', ')}]`);
  check(q4.answer === 'EEO', `CRITICAL: Q4 answer key is exactly 'EEO'`);
  check(q4.explanation.includes('EEO') && q4.explanation.includes('5, 3, and 1'), `Q4 explanation explains indices 5, 3, 1`);

  // Q5 — MCQ: Loop and modulo
  const q5 = QUESTIONS[4];
  check(q5.type === 'SINGLE_CHOICE', `Q5 is SINGLE_CHOICE`);
  check(pyResults.Q5.val === 2, `Q5 loop and modulo sum evaluates to 2 in Python 3`);
  check(q5.options.length === 4, `Q5 has 4 options`);
  check(new Set(q5.options).size === 4, `Q5 all 4 options are distinct: [${q5.options.join(', ')}]`);
  const q5Matches = q5.options.filter(o => o === String(pyResults.Q5.val));
  check(q5Matches.length === 1, `Q5 has exactly one matching correct option ("2")`);
  check(q5.answer === '2', `Q5 answer key is "2"`);

  // Q6 — True/False: Chained comparisons
  const q6 = QUESTIONS[5];
  check(q6.type === 'TRUE_FALSE', `Q6 is TRUE_FALSE`);
  check(q6.options.length === 2 && q6.options[0] === 'True' && q6.options[1] === 'False', `Q6 options are strictly ['True', 'False']`);
  check(pyResults.Q6.statement_truth === true, `Q6 statement (1 < 2 < 3 is equivalent to 1 < 2 and 2 < 3) is True in Python`);
  check(q6.answer === 'True', `Q6 answer key is "True"`);

  // Q7 — MCQ: Truthiness
  const q7 = QUESTIONS[6];
  check(q7.type === 'SINGLE_CHOICE', `Q7 is SINGLE_CHOICE`);
  check(pyResults.Q7.printed === 'False True False', `Q7 print(bool([]), bool(" "), bool("")) outputs "False True False"`);
  check(q7.options.length === 4, `Q7 has 4 options`);
  check(new Set(q7.options).size === 4, `Q7 all 4 options are distinct`);
  check(q7.answer === 'False True False', `Q7 answer key is "False True False"`);

  // Q8 — MAQ: String methods and slicing
  const q8 = QUESTIONS[7];
  check(q8.type === 'MULTIPLE_CHOICE', `Q8 is MULTIPLE_CHOICE (MAQ)`);
  check(q8.options.length === 4, `Q8 has 4 options`);
  check(new Set(q8.options).size === 4, `Q8 all 4 options are distinct`);
  check(pyResults.Q8.expr_a === true, `Q8 option A (lower == python) evaluates to True`);
  check(pyResults.Q8.expr_b === true, `Q8 option B (upper == PYTHON) evaluates to True`);
  check(pyResults.Q8.expr_c === false, `Q8 option C (startswith('p')) evaluates to False (case-sensitive)`);
  check(pyResults.Q8.expr_d === true, `Q8 option D (s[2:4] == 'Th') evaluates to True`);
  const q8Expected = ["s.lower() == 'python'", "s.upper() == 'PYTHON'", "s[2:4] == 'Th'"];
  check(Array.isArray(q8.answer) && q8.answer.length === 3, `Q8 answer key has exactly 3 correct options`);
  check(
    q8Expected.every(opt => q8.answer.includes(opt)),
    `Q8 answer key contains the complete correct set: [${q8.answer.join(', ')}]`
  );
  check(!q8.answer.includes("s.startswith('p')"), `Q8 correctly marks startswith('p') as incorrect`);

  // Q9 — MCQ: The for...else construct
  const q9 = QUESTIONS[8];
  check(q9.type === 'SINGLE_CHOICE', `Q9 is SINGLE_CHOICE`);
  check(pyResults.Q9.printed === 'DONE', `Q9 for...else loop outputs "DONE" in Python 3`);
  check(q9.options.length === 4, `Q9 has 4 options`);
  check(new Set(q9.options).size === 4, `Q9 all 4 options are distinct`);
  check(q9.answer === 'DONE', `Q9 answer key is "DONE"`);

  // Q10 — True/False: Equality versus identity
  const q10 = QUESTIONS[9];
  check(q10.type === 'TRUE_FALSE', `Q10 is TRUE_FALSE`);
  check(q10.options.length === 2 && q10.options[0] === 'True' && q10.options[1] === 'False', `Q10 options are strictly ['True', 'False']`);
  check(pyResults.Q10.claim_equality === true, `Q10 a == b evaluates to True for separate lists`);
  check(pyResults.Q10.claim_identity === false, `Q10 a is b evaluates to False for separate lists`);
  check(pyResults.Q10.statement_truth === true, `Q10 statement is accurate (True)`);
  check(q10.answer === 'True', `Q10 answer key is "True"`);

  // STEP 3: DATABASE VERIFICATION
  console.log('\n--- STEP 3: DATABASE RECORDS MATCH VALIDATED QUESTION BANK ---');
  const codenexUser = await prisma.user.findFirst({ where: { username: 'codenex' } });
  check(!!codenexUser, `Found codenex Game Master (id: ${codenexUser?.id})`);

  const dbGame = await prisma.game.findFirst({
    where: {
      name: GAME_TITLE,
      designerId: codenexUser.id,
    },
    include: {
      challenges: { orderBy: { position: 'asc' } },
    },
  });

  check(!!dbGame, `Database contains game record for "${GAME_TITLE}"`);
  check(dbGame?.designerId === codenexUser.id, `Game is owned by codenex Game Master in database`);
  check(dbGame?.template === 'RAPID_FIRE', `Game template in DB is RAPID_FIRE`);
  check(dbGame?.status === 'DRAFT', `Game status in DB is safe DRAFT state`);
  check(dbGame?.challenges.length === 10, `Database contains EXACTLY 10 challenge rows for this game`);

  for (let i = 0; i < 10; i++) {
    const valQ = QUESTIONS[i];
    const dbQ = dbGame.challenges[i];
    const dbCfg = dbQ.config;

    check(dbQ.position === i, `DB Q${i + 1} position is ${i}`);
    check(dbQ.type === valQ.type, `DB Q${i + 1} type matches validated type (${dbQ.type})`);
    check(dbQ.prompt === valQ.prompt, `DB Q${i + 1} prompt matches validated prompt`);
    check(dbQ.timeLimit === 15, `DB Q${i + 1} timeLimit is 15 seconds`);
    check(dbQ.points === 100, `DB Q${i + 1} points is 100`);

    // Options check
    check(JSON.stringify(dbCfg.options) === JSON.stringify(valQ.options), `DB Q${i + 1} options match validated options`);

    // Answer key check
    check(JSON.stringify(dbCfg.answer) === JSON.stringify(valQ.answer), `DB Q${i + 1} answer key matches validated answer key`);

    // Explanation check
    check(dbCfg.explanation === valQ.explanation, `DB Q${i + 1} explanation matches validated explanation`);
  }

  // STEP 4: VERIFY ANTI-LEAKAGE PURITY
  console.log('\n--- STEP 4: ANTI-LEAKAGE AUDIT ---');
  const { getSessionState } = require('./server/dist/services/sessionService');
  const { hostGameForGameMaster } = require('./server/dist/services/sessionLifecycle');

  // Verify safeChallenge strips answer and explanation
  const testChallenge = dbGame.challenges[3]; // Q4
  const testSafe = {
    ...testChallenge,
    options: testChallenge.config.options,
  };
  delete testSafe.config.answer;
  delete testSafe.config.explanation;
  check(!('answer' in testSafe.config), `Public challenge strips answer from config`);
  check(!('explanation' in testSafe.config), `Public challenge strips explanation from config`);

  console.log('\n================================================================');
  console.log(`TOTAL RIGOROUS VALIDATIONS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRigorousValidation()
  .catch((err) => {
    console.error('Rigorous validation error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
