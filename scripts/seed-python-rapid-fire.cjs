const path = require('path');
require(path.resolve(__dirname, '../server/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../server/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const GAME_TITLE = 'PYTHON RAPID FIRE — CODE TRAP ZONE';
const GAME_DESCRIPTION = 'High-velocity Python 3 logic traps: 10 competitive Rapid Fire challenges with server-authoritative timers and delayed post-game review.';

const QUESTIONS = [
  {
    num: 1,
    type: 'SINGLE_CHOICE',
    prompt: `Operator precedence\n\nprint(2 ** 3 ** 2)`,
    options: ['64', '512', '256', '36'],
    answer: '512',
    explanation: 'Exponentiation groups from right to left, so this is 2 ** (3 ** 2), which evaluates to 512.',
    points: 100,
    timerSecs: 15,
    difficulty: 'EASY',
  },
  {
    num: 2,
    type: 'SINGLE_CHOICE',
    prompt: `String repetition and concatenation\n\nprint('5' * 2 + '3')`,
    options: ['13', "'553'", '553 as an integer', 'TypeError'],
    answer: "'553'",
    explanation: "Multiplying a string by two repeats it, producing '55'. Adding '3' concatenates the strings, producing '553', which is a string rather than an integer.",
    points: 100,
    timerSecs: 15,
    difficulty: 'EASY',
  },
  {
    num: 3,
    type: 'MULTIPLE_CHOICE',
    prompt: `Boolean logic and short-circuiting\n\nx = 0\n\nSelect all expressions that evaluate to True.`,
    options: ['x == 0 or x > 1', 'not x', 'x != 0 and 10 / x > 1', 'bool(x) == False'],
    answer: ['x == 0 or x > 1', 'not x', 'bool(x) == False'],
    explanation: 'A is true because x == 0. B is true because zero is falsy and not 0 evaluates to True. C evaluates to False because the first operand of and is false; the division is not evaluated. D is true because bool(0) is False.',
    points: 100,
    timerSecs: 15,
    difficulty: 'MEDIUM',
  },
  {
    num: 4,
    type: 'SINGLE_CHOICE',
    prompt: `Negative-step slicing\n\ns = "CODENEX"\nprint(s[-2::-2])`,
    options: ['NEO', 'XND', 'EEO', 'XEO'],
    answer: 'EEO',
    explanation: "The starting index -2 refers to the second-last character, E, at index 5. Stepping backward by two visits indices 5, 3, and 1, producing E, E, O and therefore 'EEO'.",
    points: 100,
    timerSecs: 15,
    difficulty: 'MEDIUM',
  },
  {
    num: 5,
    type: 'SINGLE_CHOICE',
    prompt: `Loop and modulo\n\ntotal = 0\nfor i in range(1, 5):\n    total += i % 2\nprint(total)`,
    options: ['2', '4', '10', '1'],
    answer: '2',
    explanation: 'The values of i are 1, 2, 3, and 4. Their remainders modulo 2 are 1, 0, 1, and 0. Their sum is 2.',
    points: 100,
    timerSecs: 15,
    difficulty: 'EASY',
  },
  {
    num: 6,
    type: 'TRUE_FALSE',
    prompt: `Chained comparisons\n\nStatement:\n1 < 2 < 3 is equivalent in result to 1 < 2 and 2 < 3.`,
    options: ['True', 'False'],
    answer: 'True',
    explanation: 'Both comparisons must hold for the chained comparison to be true. Python evaluates the middle value only once in a chained comparison, so the expressions are equivalent in result for these operands.',
    points: 100,
    timerSecs: 15,
    difficulty: 'EASY',
  },
  {
    num: 7,
    type: 'SINGLE_CHOICE',
    prompt: `Truthiness\n\nprint(bool([]), bool(" "), bool(""))`,
    options: ['False False False', 'False True False', 'True True False', 'False True True'],
    answer: 'False True False',
    explanation: 'An empty list is falsy, a string containing a space is non-empty and truthy, and an empty string is falsy.',
    points: 100,
    timerSecs: 15,
    difficulty: 'EASY',
  },
  {
    num: 8,
    type: 'MULTIPLE_CHOICE',
    prompt: `String methods and slicing\n\ns = "PyThOn"\n\nSelect all expressions that evaluate to True.`,
    options: ["s.lower() == 'python'", "s.upper() == 'PYTHON'", "s.startswith('p')", "s[2:4] == 'Th'"],
    answer: ["s.lower() == 'python'", "s.upper() == 'PYTHON'", "s[2:4] == 'Th'"],
    explanation: "lower() converts letters to lowercase, upper() converts letters to uppercase, and indices 2 and 3 contain T and h. The string begins with uppercase P, so startswith('p') is false.",
    points: 100,
    timerSecs: 15,
    difficulty: 'MEDIUM',
  },
  {
    num: 9,
    type: 'SINGLE_CHOICE',
    prompt: `The for...else construct\n\nfor i in range(3):\n    if i == 5:\n        break\nelse:\n    print("DONE")`,
    options: ['Nothing is printed.', 'DONE', '0 1 2', 'SyntaxError'],
    answer: 'DONE',
    explanation: 'The loop iterates over 0, 1, and 2. The break condition is never met, so the loop finishes normally and its else block prints DONE.',
    points: 100,
    timerSecs: 15,
    difficulty: 'MEDIUM',
  },
  {
    num: 10,
    type: 'TRUE_FALSE',
    prompt: `Equality versus identity\n\nStatement:\nFor these separately created lists, a == b is True and a is b is False.\n\na = [1, 2]\nb = [1, 2]`,
    options: ['True', 'False'],
    answer: 'True',
    explanation: 'The lists contain equal values, so == evaluates to True. They are separate list objects, so is evaluates to False.',
    points: 100,
    timerSecs: 15,
    difficulty: 'EASY',
  },
];

async function seedPythonRapidFire() {
  console.log('Searching for codenex Game Master user...');
  const codenexUser = await prisma.user.findFirst({
    where: { username: 'codenex' },
  });

  if (!codenexUser) {
    console.error('ERROR: codenex Game Master user not found in database!');
    process.exit(1);
  }

  console.log(`Found codenex user: ${codenexUser.username} (${codenexUser.id})`);

  // Find or create the Game (Saved as DRAFT)
  let game = await prisma.game.findFirst({
    where: {
      name: GAME_TITLE,
      designerId: codenexUser.id,
    },
    include: { challenges: true },
  });

  if (!game) {
    console.log(`Creating new game: "${GAME_TITLE}" (Template: RAPID_FIRE, Status: DRAFT)...`);
    game = await prisma.game.create({
      data: {
        name: GAME_TITLE,
        description: GAME_DESCRIPTION,
        template: 'RAPID_FIRE',
        status: 'DRAFT',
        designerId: codenexUser.id,
        allowAnswerChange: false,
        negativeMarking: false,
        speedBonus: true,
        maxPlayers: 200,
        teamsEnabled: false,
        maxTeamSize: 4,
        allowLateJoin: true,
        leaderboardVisibility: 'LIVE',
        config: {
          difficulty: 'Basic to moderate',
          category: 'Python 3 Logic',
          targetAudience: 'First-year engineering students',
          questionCount: 10,
          timerPerQuestionSecs: 15,
        },
      },
      include: { challenges: true },
    });
    console.log(`Game created with ID: ${game.id}`);
  } else {
    console.log(`Found existing game with ID: ${game.id}, updating metadata...`);
    game = await prisma.game.update({
      where: { id: game.id },
      data: {
        description: GAME_DESCRIPTION,
        status: 'DRAFT',
        template: 'RAPID_FIRE',
        config: {
          difficulty: 'Basic to moderate',
          category: 'Python 3 Logic',
          targetAudience: 'First-year engineering students',
          questionCount: 10,
          timerPerQuestionSecs: 15,
        },
      },
      include: { challenges: true },
    });
  }

  // Delete existing challenges for this game to ensure exact sequential ordering & no duplicates
  const deletedCount = await prisma.challenge.deleteMany({
    where: { gameId: game.id },
  });
  console.log(`Cleaned up ${deletedCount.count} previous challenge rows for clean idempotency.`);

  // Create all 10 challenges
  console.log('Inserting exactly 10 Python logic trap questions...');
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    await prisma.challenge.create({
      data: {
        gameId: game.id,
        position: i,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        timeLimit: q.timerSecs,
        config: {
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
        },
      },
    });
    console.log(`  [${i + 1}/10] Inserted Q${q.num}: (${q.type})`);
  }

  // Verify created challenges
  const finalChallenges = await prisma.challenge.findMany({
    where: { gameId: game.id },
    orderBy: { position: 'asc' },
  });

  console.log(`\nSUCCESS: "${GAME_TITLE}" is saved in the database under designer "codenex"!`);
  console.log(`Total questions verified: ${finalChallenges.length}`);
  console.log(`Game ID: ${game.id}`);
  console.log(`Template: ${game.template}`);
  console.log(`Status: ${game.status}`);
  console.log(`Designer: ${codenexUser.username} (${codenexUser.id})`);

  return game;
}

if (require.main === module) {
  seedPythonRapidFire()
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedPythonRapidFire, QUESTIONS, GAME_TITLE };
