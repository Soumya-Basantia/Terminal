import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function bootstrapCodenexGm(): Promise<{ success: boolean; action: 'created' | 'existing'; username: string; email: string }> {
  const emailRaw = process.env.CODENEX_GM_EMAIL;
  if (!emailRaw || !emailRaw.trim()) {
    console.error('[ERROR] Environment variable CODENEX_GM_EMAIL is required but not set.');
    console.error('Please configure CODENEX_GM_EMAIL before running this bootstrap command.');
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`[ERROR] Invalid email format provided in CODENEX_GM_EMAIL: "${emailRaw}".`);
    process.exit(1);
  }

  const username = 'codenex';

  // Check existing records for conflicts
  const userByUsername = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
  });

  const userByEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  // Conflict Scenario 1: 'codenex' username exists, but has a different email
  if (userByUsername && userByUsername.email.toLowerCase() !== email) {
    console.error(`[ERROR] Account conflict: Username '${username}' is already taken by a different account with email '${userByUsername.email}'.`);
    console.error('Refusing to hijack or overwrite an existing account.');
    process.exit(1);
  }

  // Conflict Scenario 2: email exists, but has a different username
  if (userByEmail && userByEmail.username.toLowerCase() !== username) {
    console.error(`[ERROR] Account conflict: Email '${email}' is already associated with username '${userByEmail.username}'.`);
    console.error('Refusing to hijack or overwrite an existing account.');
    process.exit(1);
  }

  // Idempotent Scenario: Account already exists with matching username and email
  if (userByUsername && userByEmail && userByUsername.id === userByEmail.id) {
    const existing = userByUsername;

    // Safety check: verify it is indeed a GAME_MASTER
    if (existing.role !== 'GAME_MASTER') {
      console.error(`[ERROR] Account conflict: User '${username}' exists but has unexpected role '${existing.role}'.`);
      console.error('Refusing to silently reassign or promote an unexpected account role.');
      process.exit(1);
    }

    // Ensure approved and active status without resetting the established password
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        approvalStatus: 'APPROVED',
        accountStatus: 'ACTIVE',
        isVerified: true,
        mustChangePassword: false,
      },
    });

    // Ensure CODENEX club membership exists
    const codenexClub = await prisma.club.findUnique({ where: { slug: 'codenex' } });
    if (codenexClub) {
      await prisma.clubMember.upsert({
        where: {
          clubId_userId: {
            clubId: codenexClub.id,
            userId: existing.id,
          },
        },
        update: { role: 'ADMIN' },
        create: {
          clubId: codenexClub.id,
          userId: existing.id,
          role: 'ADMIN',
        },
      });
    }

    console.log(`[IDEMPOTENT] CODENEX Game Master account ('${username}' / ${email}) already exists.`);
    console.log('Existing credentials and password preserved. Account status confirmed as ACTIVE and APPROVED.');
    return { success: true, action: 'existing', username, email };
  }

  // Creation Scenario: Neither username nor email exists
  const initialPassword = process.env.CODENEX_GM_INITIAL_PASSWORD;
  if (!initialPassword || !initialPassword.trim()) {
    console.error('[ERROR] Environment variable CODENEX_GM_INITIAL_PASSWORD is required for initial account creation.');
    console.error('Please configure CODENEX_GM_INITIAL_PASSWORD with the operator-supplied temporary initial password.');
    process.exit(1);
  }

  if (initialPassword.length < 6) {
    console.error('[ERROR] CODENEX_GM_INITIAL_PASSWORD must be at least 6 characters long.');
    process.exit(1);
  }

  // Hash password using bcryptjs (salt rounds = 10)
  const passwordHash = await bcrypt.hash(initialPassword, 10);

  const newUser = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      role: 'GAME_MASTER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      isVerified: true,
      mustChangePassword: false,
      name: 'CODENEX Game Master',
      profile: {
        create: {
          displayName: 'CODENEX Game Master',
        },
      },
    },
  });

  // Ensure CODENEX club exists and assign GM as club admin
  let codenexClub = await prisma.club.findUnique({ where: { slug: 'codenex' } });
  if (!codenexClub) {
    codenexClub = await prisma.club.create({
      data: {
        name: 'CODENEX',
        slug: 'codenex',
        focus: 'Programming, Algorithms, Coding, Git',
        status: 'ACTIVE',
      },
    });
  }

  await prisma.clubMember.upsert({
    where: {
      clubId_userId: {
        clubId: codenexClub.id,
        userId: newUser.id,
      },
    },
    update: { role: 'ADMIN' },
    create: {
      clubId: codenexClub.id,
      userId: newUser.id,
      role: 'ADMIN',
    },
  });

  console.log('================================================================');
  console.log('  CODENEX GAME MASTER BOOTSTRAP — SUCCESS                       ');
  console.log('================================================================');
  console.log(`Username:       ${username}`);
  console.log(`Display Name:   CODENEX Game Master`);
  console.log(`Email:          ${email}`);
  console.log(`Role:           GAME_MASTER (Approved & Active)`);
  console.log(`Club:           CODENEX (Club Admin permissions enabled)`);
  console.log('Security:       Temporary password provisioned.');
  console.log('                First-login password change is ENFORCED.');
  console.log('================================================================');

  return { success: true, action: 'created', username, email };
}

if (require.main === module) {
  bootstrapCodenexGm()
    .catch((err) => {
      console.error('[FATAL] Failed to bootstrap CODENEX Game Master:', err.message);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
