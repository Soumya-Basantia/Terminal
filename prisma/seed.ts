import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PLATFORM_CLUBS } from '../server/src/lib/platformClubs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TERMINAL database...');

  // Create a demo designer account
  const password = await bcrypt.hash('terminal123', 10);
  const designer = await prisma.user.upsert({
    where: { email: 'demo@terminal.dev' },
    update: {},
    create: {
      username: 'demo_designer',
      email: 'demo@terminal.dev',
      passwordHash: password,
      role: 'SUPER_ADMIN', // Made SUPER_ADMIN for testing
    },
  });

  console.log(`✅ Designer created: ${designer.email}`);

  // Create / ensure root administrator account
  const rootPassword = await bcrypt.hash('Root-Soumya', 10);
  const rootAdmin = await prisma.user.upsert({
    where: { username: 'root' },
    update: {
      passwordHash: rootPassword,
      role: 'ADMIN',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      name: 'Root Administrator',
    },
    create: {
      username: 'root',
      email: 'root@terminal.lan',
      passwordHash: rootPassword,
      role: 'ADMIN',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      name: 'Root Administrator',
      profile: {
        create: {
          displayName: 'Root Administrator',
        },
      },
    },
  });
  console.log(`✅ Root administrator ensured: ${rootAdmin.username}`);

  // Create Clubs
  const clubs = PLATFORM_CLUBS;
  const allowedClubs = new Set(clubs.map((club) => `${club.name}\0${club.slug}`));
  const existingClubs = await prisma.club.findMany({ select: { id: true, name: true, slug: true } });
  const unwantedClubIds = existingClubs
    .filter((club) => !allowedClubs.has(`${club.name}\0${club.slug}`))
    .map((club) => club.id);

  if (unwantedClubIds.length > 0) {
    await prisma.$transaction([
      prisma.game.updateMany({
        where: { clubId: { in: unwantedClubIds } },
        data: { clubId: null },
      }),
      prisma.event.updateMany({
        where: { clubId: { in: unwantedClubIds } },
        data: { clubId: null },
      }),
      prisma.club.deleteMany({ where: { id: { in: unwantedClubIds } } }),
    ]);
    console.log(`🧹 Removed ${unwantedClubIds.length} unsupported clubs`);
  }

  for (const clubData of clubs) {
    await prisma.club.upsert({
      where: { slug: clubData.slug },
      update: {},
      create: {
        name: clubData.name,
        slug: clubData.slug,
        focus: clubData.focus,
      }
    });
  }
  console.log(`✅ Seeded ${clubs.length} clubs`);

  // Create Git Battle — Beginner game
  const game = await prisma.game.upsert({
    where: { id: 'game-git-battle' },
    update: {},
    create: {
      id: 'game-git-battle',
      name: 'Git Battle — Beginner',
      description: 'Test your Git knowledge! Perfect for first-year CS students.',
      template: 'QUIZ',
      status: 'PUBLISHED',
      designerId: designer.id,
      maxPlayers: 200,
      teamsEnabled: false,
      leaderboardVisibility: 'LIVE',
      allowLateJoin: true,
      speedBonus: true,
    },
  });

  // Check if challenge already exists
  const existingChallenge = await prisma.challenge.findFirst({ where: { gameId: game.id } });
  if (existingChallenge) {
    console.log('✅ Seed data already exists, skipping questions...');
    await prisma.$disconnect();
    return;
  }

  const questions = [
    {
      order: 0,
      prompt: 'What is Git?',
      type: 'SINGLE_CHOICE' as const,
      options: [
        'A programming language',
        'A distributed version control system',
        'A code editor',
        'A cloud storage service',
      ],
      answer: 'A distributed version control system',
      explanation: 'Git is a distributed version control system created by Linus Torvalds in 2005.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 1,
      prompt: 'Which command initializes a new Git repository?',
      type: 'SINGLE_CHOICE' as const,
      options: ['git start', 'git create', 'git init', 'git new'],
      answer: 'git init',
      explanation: '`git init` creates a new empty Git repository or reinitializes an existing one.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 2,
      prompt: 'What does `git status` show?',
      type: 'SINGLE_CHOICE' as const,
      options: [
        'The commit history',
        'The working tree status — staged, unstaged, and untracked files',
        'The current branch name only',
        'The remote repository URL',
      ],
      answer: 'The working tree status — staged, unstaged, and untracked files',
      explanation: '`git status` shows the state of your working directory and staging area.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 3,
      prompt: 'Which command stages all changes in the current directory?',
      type: 'SINGLE_CHOICE' as const,
      options: ['git save .', 'git stage all', 'git add .', 'git commit .'],
      answer: 'git add .',
      explanation: '`git add .` stages all changes (new files, modifications, deletions) in the current directory.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 4,
      prompt: 'What does `git commit -m "message"` do?',
      type: 'SINGLE_CHOICE' as const,
      options: [
        'Sends changes to the remote repository',
        'Creates a new branch',
        'Saves the staged changes as a snapshot in the project history',
        'Merges two branches',
      ],
      answer: 'Saves the staged changes as a snapshot in the project history',
      explanation: '`git commit` records your staged changes permanently in the repository history with a descriptive message.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 5,
      prompt: 'Which command copies a remote repository to your local machine?',
      type: 'SINGLE_CHOICE' as const,
      options: ['git copy', 'git clone', 'git pull', 'git fetch'],
      answer: 'git clone',
      explanation: '`git clone` creates a local copy of a remote repository, including all history.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 6,
      prompt: 'What is the difference between `git pull` and `git fetch`?',
      type: 'SINGLE_CHOICE' as const,
      options: [
        'There is no difference',
        '`git fetch` downloads changes but does not merge; `git pull` downloads AND merges',
        '`git pull` downloads changes but does not merge; `git fetch` downloads AND merges',
        '`git fetch` only works with private repos',
      ],
      answer: '`git fetch` downloads changes but does not merge; `git pull` downloads AND merges',
      explanation: '`git fetch` is safer — it lets you review changes before integrating them. `git pull` = fetch + merge.',
      points: 15,
      timerSecs: 25,
      difficulty: 'MEDIUM' as const,
    },
    {
      order: 7,
      prompt: 'What does `git push origin main` do?',
      type: 'SINGLE_CHOICE' as const,
      options: [
        'Pulls from the main branch',
        'Creates a new branch called main',
        'Sends your committed changes on the main branch to the remote called origin',
        'Merges origin into main',
      ],
      answer: 'Sends your committed changes on the main branch to the remote called origin',
      explanation: '`git push` uploads local commits to the remote repository.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 8,
      prompt: 'In Git, a "repository" is:',
      type: 'SINGLE_CHOICE' as const,
      options: [
        'A folder where you store files only',
        'A container that stores the complete history and all versions of your project',
        'A branch of code',
        'A remote server',
      ],
      answer: 'A container that stores the complete history and all versions of your project',
      explanation: 'A Git repository is a data structure that tracks file changes across time.',
      points: 10,
      timerSecs: 20,
      difficulty: 'EASY' as const,
    },
    {
      order: 9,
      prompt: 'True or False: Multiple developers can work on the same Git repository simultaneously.',
      type: 'TRUE_FALSE' as const,
      options: ['True', 'False'],
      answer: 'True',
      explanation: 'This is one of Git\'s greatest strengths — it enables seamless collaboration with branching, merging, and pull requests.',
      points: 10,
      timerSecs: 15,
      difficulty: 'EASY' as const,
    },
  ];

  for (const q of questions) {
    await prisma.challenge.create({
      data: {
        gameId: game.id,
        position: q.order,
        type: q.type,
        prompt: q.prompt,
        timeLimit: q.timerSecs,
        config: {
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        },
        points: q.points,
      },
    });
  }

  console.log(`✅ Git Battle seeded with ${questions.length} questions`);
  console.log('\n📋 Demo credentials:');
  console.log('   Email: demo@terminal.dev');
  console.log('   Password: terminal123\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
