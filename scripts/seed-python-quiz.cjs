const path = require('path');
require(path.resolve(__dirname, '../server/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../server/.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

const QUIZ_TITLE = 'PYTHON LOGIC TRAPS: The First-Year Challenge';
const QUIZ_DESCRIPTION = 'Test your Python 3 intuition against 20 classic logic traps designed for first-year engineering students.';

const QUESTIONS = [
  {
    num: 1,
    type: 'SINGLE_CHOICE',
    prompt: `Operator precedence\n\nx = 10\nprint(x - 3 * 2 + 1)`,
    options: ['15', '5', '7', '9'],
    answer: '5',
    explanation: 'Multiplication happens first: 3 * 2 = 6. Addition and subtraction then proceed from left to right: 10 - 6 + 1 = 5.',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 2,
    type: 'SINGLE_CHOICE',
    prompt: `Integer division and remainder\n\nprint(19 // 4 + 19 % 4)`,
    options: ['4', '7', '8', '4.75'],
    answer: '7',
    explanation: '19 // 4 is 4, while 19 % 4 is 3. Their sum is 7.',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 3,
    type: 'SINGLE_CHOICE',
    prompt: `String multiplication\n\nx = '12'\nprint(x * 2)`,
    options: ['24', '1212', '14', 'TypeError'],
    answer: '1212',
    explanation: "Multiplying a string by an integer repeats the string. The result is '1212', not the numerical product 24.",
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 4,
    type: 'SINGLE_CHOICE',
    prompt: `String indexing\n\ns = 'PYTHON'\nprint(s[1] + s[-1])`,
    options: ['PT', 'YO', 'YN', 'PN'],
    answer: 'YN',
    explanation: "Index 1 contains Y. Index -1 contains the last character, N. Concatenating them produces 'YN'.",
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 5,
    type: 'MULTIPLE_CHOICE',
    prompt: `Boolean logic\n\nx = 6\n\nSelect all expressions that evaluate to True.`,
    options: ['x > 5 and x < 10', 'x == 6 or x == 7', 'not (x > 6)', 'x < 3 and x > 5'],
    answer: ['x > 5 and x < 10', 'x == 6 or x == 7', 'not (x > 6)'],
    explanation: 'A is true because 6 is between 5 and 10. B is true because the first comparison is true. C is true because x > 6 is false and not False is true. D is false because 6 cannot simultaneously be less than 3 and greater than 5.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 6,
    type: 'MULTIPLE_CHOICE',
    prompt: `String methods\n\ns = 'Python Programming'\n\nSelect all expressions that evaluate to True.`,
    options: ["s.lower() == 'python programming'", "s.startswith('Py')", "s.isalpha()", "s.find('Pro') == 7"],
    answer: ["s.lower() == 'python programming'", "s.startswith('Py')", "s.find('Pro') == 7"],
    explanation: "lower() converts letters to lowercase. startswith('Py') is true. isalpha() returns false because the string contains a space. 'Pro' begins at index 7.",
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 7,
    type: 'MULTIPLE_CHOICE',
    prompt: `Loop reasoning\n\nfor i in range(2, 8, 2):\n    print(i, end=' ')\n\nSelect all values printed.`,
    options: ['2', '4', '6', '8'],
    answer: ['2', '4', '6'],
    explanation: 'The sequence is 2, 4, 6. The stop value 8 is excluded from range().',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 8,
    type: 'MULTIPLE_CHOICE',
    prompt: `Comparison operators\n\na = 5\nb = 8\n\nSelect all expressions that evaluate to True.`,
    options: ['a != b', 'a >= b', 'a < b', 'a == 5'],
    answer: ['a != b', 'a < b', 'a == 5'],
    explanation: '5 != 8, 5 < 8, and 5 == 5 are true. 5 >= 8 is false.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 9,
    type: 'TRUE_FALSE',
    prompt: `String immutability\n\ns = 'hello'\ns[0] = 'H'\n\nStatement: This assignment successfully changes the first character of the string.`,
    options: ['True', 'False'],
    answer: 'False',
    explanation: 'Python strings are immutable. Assigning directly to an individual character raises TypeError.',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 10,
    type: 'TRUE_FALSE',
    prompt: `range()\n\nStatement: list(range(1, 5)) produces [1, 2, 3, 4, 5].`,
    options: ['True', 'False'],
    answer: 'False',
    explanation: 'The stop value is excluded. The actual result is [1, 2, 3, 4].',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 11,
    type: 'TRUE_FALSE',
    prompt: `Short-circuit logic\n\nx = 0\nresult = x != 0 and 10 / x > 1\nprint(result)\n\nStatement: This code raises ZeroDivisionError.`,
    options: ['True', 'False'],
    answer: 'False',
    explanation: 'The first condition, x != 0, is false. Python short-circuits the and expression, so 10 / x is never evaluated. The code prints False.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 12,
    type: 'TRUE_FALSE',
    prompt: `String slicing\n\ns = 'COMPUTER'\n\nStatement: s[1:4] produces 'OMP'.`,
    options: ['True', 'False'],
    answer: 'True',
    explanation: 'The slice includes indices 1, 2, and 3, which contain O, M, and P. Index 4 is excluded.',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 13,
    type: 'SINGLE_CHOICE',
    prompt: `Nested conditions\n\nx = 7\nif x > 5:\n    if x < 7:\n        print('A')\n    else:\n        print('B')\nelse:\n    print('C')`,
    options: ['A', 'B', 'C', 'Nothing is printed'],
    answer: 'B',
    explanation: 'x > 5 is true. However, x < 7 is false because x equals 7. The inner else executes and prints B.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 14,
    type: 'SINGLE_CHOICE',
    prompt: `Loop and condition\n\ncount = 0\nfor i in range(1, 6):\n    if i % 2 == 0:\n        count += 1\nprint(count)`,
    options: ['1', '2', '3', '5'],
    answer: '2',
    explanation: 'The loop visits 1, 2, 3, 4, and 5. Only 2 and 4 are even, so the counter increments twice.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 15,
    type: 'MULTIPLE_CHOICE',
    prompt: `String traps\n\ns = 'hello'\n\nSelect all expressions that evaluate to True.`,
    options: ['len(s) == 5', "s[0] == 'h'", "s[-1] == 'o'", "s[1:3] == 'ell'"],
    answer: ['len(s) == 5', "s[0] == 'h'", "s[-1] == 'o'"],
    explanation: "The string contains five characters, starts with h, and ends with o. The slice s[1:3] produces 'el', not 'ell', because the stop index is excluded.",
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 16,
    type: 'TRUE_FALSE',
    prompt: `Logical negation\n\nx = 4\nprint(not (x == 4))\n\nStatement: The program prints True.`,
    options: ['True', 'False'],
    answer: 'False',
    explanation: 'x == 4 evaluates to True. Applying not produces False, which is what the program prints.',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 17,
    type: 'SINGLE_CHOICE',
    prompt: `String concatenation\n\na = '5'\nb = '2'\nprint(a + b)`,
    options: ['7', '52', '10', 'TypeError'],
    answer: '52',
    explanation: "Both variables contain strings. The + operator concatenates them, producing '52' rather than adding their numerical values.",
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 18,
    type: 'MULTIPLE_CHOICE',
    prompt: `Loop filtering\n\nfor i in range(1, 6):\n    if i % 2 != 0:\n        print(i)\n\nSelect all values printed.`,
    options: ['1', '2', '3', '5'],
    answer: ['1', '3', '5'],
    explanation: 'The condition checks whether the remainder after division by 2 is nonzero. The odd numbers between 1 and 5 are 1, 3, and 5.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
  {
    num: 19,
    type: 'TRUE_FALSE',
    prompt: `Equality versus assignment\n\nStatement: In Python, x == 5 assigns the value 5 to x.`,
    options: ['True', 'False'],
    answer: 'False',
    explanation: '== compares two values for equality. Assignment uses a single = sign, as in x = 5.',
    points: 100,
    timerSecs: 30,
    difficulty: 'EASY',
  },
  {
    num: 20,
    type: 'MULTIPLE_CHOICE',
    prompt: `Mixed Boolean reasoning\n\na = 3\nb = 6\n\nSelect all expressions that evaluate to True.`,
    options: ['a < b and b < 10', 'a == 3 or b == 5', 'not (a > b)', 'a > 3 and b < 10'],
    answer: ['a < b and b < 10', 'a == 3 or b == 5', 'not (a > b)'],
    explanation: 'A is true because 3 is less than 6 and 6 is less than 10. B is true because a == 3. C is true because a > b is false, so its negation is true. D is false because a > 3 is false.',
    points: 100,
    timerSecs: 30,
    difficulty: 'MEDIUM',
  },
];

async function seedPythonQuiz() {
  console.log('Searching for codenex Game Master user...');
  const codenexUser = await prisma.user.findFirst({
    where: { username: 'codenex' },
  });

  if (!codenexUser) {
    console.error('ERROR: codenex Game Master user not found in database!');
    process.exit(1);
  }

  console.log(`Found codenex user: ${codenexUser.username} (${codenexUser.id})`);

  // Find or create the Game
  let game = await prisma.game.findFirst({
    where: {
      name: QUIZ_TITLE,
      designerId: codenexUser.id,
    },
    include: { challenges: true },
  });

  if (!game) {
    console.log(`Creating new game: "${QUIZ_TITLE}"...`);
    game = await prisma.game.create({
      data: {
        name: QUIZ_TITLE,
        description: QUIZ_DESCRIPTION,
        template: 'QUIZ',
        status: 'PUBLISHED',
        designerId: codenexUser.id,
        allowAnswerChange: false,
        negativeMarking: false,
        speedBonus: false,
        maxPlayers: 200,
        teamsEnabled: false,
        maxTeamSize: 4,
        allowLateJoin: true,
        leaderboardVisibility: 'LIVE',
        config: {
          difficulty: 'Basic to moderate',
          category: 'Python 3 Logic',
          targetAudience: 'First-year engineering students',
          questionCount: 20,
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
        description: QUIZ_DESCRIPTION,
        status: 'PUBLISHED',
        template: 'QUIZ',
        config: {
          difficulty: 'Basic to moderate',
          category: 'Python 3 Logic',
          targetAudience: 'First-year engineering students',
          questionCount: 20,
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

  // Create all 20 challenges
  console.log('Inserting exactly 20 Python logic trap questions...');
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
    console.log(`  [${i + 1}/20] Inserted Q${q.num}: (${q.type})`);
  }

  // Verify created challenges
  const finalChallenges = await prisma.challenge.findMany({
    where: { gameId: game.id },
    orderBy: { position: 'asc' },
  });

  console.log(`\nSUCCESS: "${QUIZ_TITLE}" is saved in the database under designer "codenex"!`);
  console.log(`Total questions verified: ${finalChallenges.length}`);
  console.log(`Game ID: ${game.id}`);
  console.log(`Designer: ${codenexUser.username} (${codenexUser.id})`);
}

seedPythonQuiz()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
