const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// The 5 explicitly retained accounts
const RETAINED_ACCOUNTS = {
  root: {
    id: 'cmus48lhg00001e4apdypdrsc',
    username: 'root',
    email: 'root@terminal.lan',
    role: 'ADMIN',
  },
  shraddha: {
    id: 'cmv86pxey0006ewy619kbr2gf',
    username: 'shraddha',
    email: 'shraddha@gmail.com',
    role: 'PLAYER',
  },
  soumya_gm: {
    id: 'cmuvhfg7i0002gnzffintu3ad',
    username: 'soumyabasantia24aiml',
    email: 'soumyabasantia.24aiml@saividya.ac.in',
    role: 'GAME_MASTER',
  },
  bob_player: {
    id: 'cmuybuebb0008u0b887ybcf7q',
    username: 'bob',
    email: 'bobtherobber690@gmail.com',
    role: 'PLAYER',
  },
  codenex_gm: {
    id: 'cmv7i9wa3000012xhqtbd1qu6',
    username: 'codenex',
    email: 'codenex.gm@terminal.dev',
    role: 'GAME_MASTER',
  },
};

// Known core/real non-test accounts that must also NOT be deleted
const SYSTEM_CORE_USERNAMES = [
  'demo_designer', // Owns 324 games and 309 events in seed
  'demo',          // Real demo player
  'hero',          // Real GM
  'soumya',        // Student account (1RV21CS042)
  'rohan',         // Student account (1RV21CS089)
];

// Verified automated test naming patterns
const AUTOMATED_TEST_PATTERNS = [
  /^pw_stud[AB]_\d+/i,
  /^pw_gm_\d+/i,
  /^sq_lead[AB]_\d+/i,
  /^sq_mem[AB]_\d+/i,
  /^seq_stud\d+_\d+/i,
  /^seq_gm_\d+/i,
  /^rt_stud\d+_\d+/i,
  /^rt_gm_\d+/i,
  /^(alpha|bravo|charlie)_\d+_\d+/i,
  /^diff_?gm_\d+/i,
  /^regstudent_\d+/i,
  /^testuser_\d+/i,
  /^(student|stud|stud_rf)_\d+/i,
  /^load_\d+_\d+/i,
  /^agent_\d+_\d+/i,
  /^(arch|hard|restart|sec)_stud_\d+/i,
  /^sectest(_[a-z0-9]+)?$/i,
  /^rpt_(stu|gmb|ex)_\d+/i,
  /^othergm_\d+/i,
  /^(sa|gm1|gm2|st2|st|c1a|c2a|hacker)_\d{10,}/i,
  /^u_[a-z0-9]{6}$/i,
  /^tst\d+/i,
  /^uicheck\d*/i,
  /^alice_e2e$/i,
  /^bob_e2e$/i,
  /^charlie_e2e$/i,
  /^cap_u\d+$/i,
  /^room_p\d+$/i,
  /^(soumya|rohan|kavya)_(18397|17024)$/i,
  /^testgmb\d+/i,
  /^quiz_tester_student/i,
  /^1rv22cs999$/i, // "Test Student" from initial seed
  /_\d{10,}/i, // Catch-all for automated test timestamp accounts (e.g., DetectiveAlice_179..., gm_179...)
];

function isAutomatedTestUser(user) {
  // Never match retained or core system users
  if (SYSTEM_CORE_USERNAMES.includes(user.username)) return false;
  if (Object.values(RETAINED_ACCOUNTS).some(r => r.id === user.id || r.username === user.username)) return false;

  for (const pattern of AUTOMATED_TEST_PATTERNS) {
    if (pattern.test(user.username) || pattern.test(user.email)) {
      return true;
    }
  }
  return false;
}

async function inspectAndPlan(dryRun = true) {
  console.log('================================================================');
  console.log(` TERMINAL SAFE DATA CLEANUP — ${dryRun ? 'DRY RUN MODE' : 'EXECUTE MODE'}`);
  console.log('================================================================\n');

  // Step 1: Verify all 5 retained accounts
  console.log('[1] Verifying the 5 Retained Production Accounts:');
  const retainedIds = Object.values(RETAINED_ACCOUNTS).map(a => a.id);
  const foundRetained = await prisma.user.findMany({
    where: { id: { in: retainedIds } },
    include: {
      _count: {
        select: {
          games: true,
          events: true,
          sessionPlayers: true,
          createdTeams: true,
          teamMemberships: true,
        },
      },
    },
  });

  for (const [key, expected] of Object.entries(RETAINED_ACCOUNTS)) {
    const actual = foundRetained.find(u => u.id === expected.id);
    if (!actual) {
      throw new Error(`CRITICAL: Retained account ${key} (${expected.username}) NOT FOUND in database!`);
    }
    if (actual.role !== expected.role) {
      throw new Error(`CRITICAL: Role mismatch on retained account ${key}: expected ${expected.role}, got ${actual.role}`);
    }
    console.log(`  ✓ Preserved: [${actual.role}] ${actual.username} (${actual.email}) — ID: ${actual.id}`);
    console.log(`    Games: ${actual._count.games} | Events: ${actual._count.events} | Sessions: ${actual._count.sessionPlayers}`);
  }

  // Step 2: Fetch all users and categorize
  console.log('\n[2] Categorizing Database Accounts:');
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  console.log(`  Total users in database: ${allUsers.length}`);

  const testUsers = [];
  const coreUsers = [];
  const ambiguousUsers = [];

  for (const user of allUsers) {
    if (retainedIds.includes(user.id)) {
      coreUsers.push(user);
    } else if (SYSTEM_CORE_USERNAMES.includes(user.username)) {
      coreUsers.push(user);
    } else if (isAutomatedTestUser(user)) {
      testUsers.push(user);
    } else {
      ambiguousUsers.push(user);
    }
  }

  console.log(`  - Retained & System Core accounts: ${coreUsers.length}`);
  console.log(`  - Confirmed Automated-Test accounts: ${testUsers.length}`);
  console.log(`  - Ambiguous accounts (RETAINED, requires review): ${ambiguousUsers.length}`);

  if (ambiguousUsers.length > 0) {
    console.log('\n  Ambiguous Accounts (Safeguarded from deletion):');
    ambiguousUsers.forEach(u => {
      console.log(`    - ID: ${u.id} | username: ${u.username} | email: ${u.email} | role: ${u.role}`);
    });
  }

  const testUserIds = testUsers.map(u => u.id);

  // Step 3: Scan dependent records for test accounts
  console.log('\n[3] Scanning Dependent Records Associated Exclusively with Test Users:');

  // Profiles
  const profileCount = await prisma.profile.count({
    where: { userId: { in: testUserIds } },
  });

  // Teams created by test users
  const createdTeams = await prisma.team.findMany({
    where: { createdBy: { in: testUserIds } },
    select: { id: true, name: true },
  });
  const createdTeamIds = createdTeams.map(t => t.id);

  // Team memberships for test users
  const teamMemberCount = await prisma.teamMember.count({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { teamId: { in: createdTeamIds } },
      ],
    },
  });

  // Team invitations & messages for test users/teams
  const teamInviteCount = await prisma.teamInvitation.count({
    where: {
      OR: [
        { senderId: { in: testUserIds } },
        { receiverId: { in: testUserIds } },
        { teamId: { in: createdTeamIds } },
      ],
    },
  });

  const teamMsgCount = await prisma.teamMessage.count({
    where: {
      OR: [
        { senderId: { in: testUserIds } },
        { teamId: { in: createdTeamIds } },
      ],
    },
  });

  // Collaborations
  const collabCount = await prisma.collaboration.count({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { peerId: { in: testUserIds } },
      ],
    },
  });
  const collabReqCount = await prisma.collaborationRequest.count({
    where: {
      OR: [
        { senderId: { in: testUserIds } },
        { receiverId: { in: testUserIds } },
      ],
    },
  });

  // Direct Messages
  const msgCount = await prisma.message.count({
    where: {
      OR: [
        { senderId: { in: testUserIds } },
        { recipientId: { in: testUserIds } },
      ],
    },
  });

  // Club Members
  const clubMemberCount = await prisma.clubMember.count({
    where: { userId: { in: testUserIds } },
  });

  // Session Players for test users
  const testSessionPlayers = await prisma.sessionPlayer.findMany({
    where: { userId: { in: testUserIds } },
    select: { id: true, sessionId: true },
  });
  const testSessionPlayerIds = testSessionPlayers.map(p => p.id);

  // Submissions by test session players
  const submissionCount = await prisma.submission.count({
    where: { playerId: { in: testSessionPlayerIds } },
  });

  // Games and Events created by test users
  const testGames = await prisma.game.findMany({
    where: { designerId: { in: testUserIds } },
    select: { id: true, name: true },
  });
  const testGameIds = testGames.map(g => g.id);

  const testEvents = await prisma.event.findMany({
    where: { creatorId: { in: testUserIds } },
    select: { id: true, name: true },
  });
  const testEventIds = testEvents.map(e => e.id);

  // Sessions created/hosted for test games/events or with test gmId
  const testSessions = await prisma.session.findMany({
    where: {
      OR: [
        { gmId: { in: testUserIds } },
        { currentGameId: { in: testGameIds } },
        { eventId: { in: testEventIds } },
      ],
    },
    select: { id: true, roomCode: true },
  });
  const testSessionIds = testSessions.map(s => s.id);

  // Challenges under test games
  const testChallengeCount = await prisma.challenge.count({
    where: { gameId: { in: testGameIds } },
  });

  // EventGames under test events
  const testEventGameCount = await prisma.eventGame.count({
    where: {
      OR: [
        { eventId: { in: testEventIds } },
        { gameId: { in: testGameIds } },
      ],
    },
  });

  console.log('\n  Proposed Deletion Counts by Table:');
  console.log(`  -------------------------------------------------------------`);
  console.log(`  1. Submissions (test player submissions):       ${submissionCount}`);
  console.log(`  2. SessionPlayers (test player session links):  ${testSessionPlayers.length}`);
  console.log(`  3. TeamMessages (test team messages):           ${teamMsgCount}`);
  console.log(`  4. TeamInvitations (test team invites):         ${teamInviteCount}`);
  console.log(`  5. TeamMembers (test team memberships):         ${teamMemberCount}`);
  console.log(`  6. Teams (teams created by test accounts):      ${createdTeams.length}`);
  console.log(`  7. Direct Messages (sent/received by tests):    ${msgCount}`);
  console.log(`  8. Collaboration Requests:                      ${collabReqCount}`);
  console.log(`  9. Collaborations:                              ${collabCount}`);
  console.log(`  10. Club Members:                               ${clubMemberCount}`);
  console.log(`  11. Profiles (profiles of test users):          ${profileCount}`);
  console.log(`  12. Sessions (ephemeral test sessions):         ${testSessions.length}`);
  console.log(`  13. EventGames (test event-game links):         ${testEventGameCount}`);
  console.log(`  14. Challenges (questions on test games):       ${testChallengeCount}`);
  console.log(`  15. Games (ephemeral test games):               ${testGames.length}`);
  console.log(`  16. Events (ephemeral test events):             ${testEvents.length}`);
  console.log(`  17. Users (confirmed automated test accounts):  ${testUsers.length}`);
  console.log(`  -------------------------------------------------------------`);

  // Step 4: Cross-check safety
  console.log('\n[4] Retained Data Protection Verification:');
  const retainedGames = await prisma.game.count({ where: { designerId: { in: retainedIds } } });
  const retainedEvents = await prisma.event.count({ where: { creatorId: { in: retainedIds } } });
  console.log(`  ✓ Retained accounts own ${retainedGames} games and ${retainedEvents} events.`);
  console.log(`  ✓ None of the ${testGames.length} candidate test games belong to retained accounts.`);
  console.log(`  ✓ None of the ${testEvents.length} candidate test events belong to retained accounts.`);
  console.log(`  ✓ None of the ${testUsers.length} candidate test users match retained account IDs.`);

  if (dryRun) {
    console.log('\n================================================================');
    console.log(' DRY RUN COMPLETED SUCCESSFULLY — ZERO DATABASE RECORDS MODIFIED');
    console.log('================================================================');
    return {
      success: true,
      dryRun: true,
      counts: {
        users: testUsers.length,
        submissions: submissionCount,
        sessionPlayers: testSessionPlayers.length,
        teamMessages: teamMsgCount,
        teamInvitations: teamInviteCount,
        teamMembers: teamMemberCount,
        teams: createdTeams.length,
        directMessages: msgCount,
        collaborations: collabCount,
        collabRequests: collabReqCount,
        clubMembers: clubMemberCount,
        profiles: profileCount,
        sessions: testSessions.length,
        eventGames: testEventGameCount,
        challenges: testChallengeCount,
        games: testGames.length,
        events: testEvents.length,
      },
      retainedUsersCount: coreUsers.length,
      ambiguousCount: ambiguousUsers.length,
    };
  }

  // Step 5: Execute scoped transaction
  console.log('\n[5] Executing Scoped Transaction Deletion in Foreign-Key Order...');
  const result = await prisma.$transaction(async (tx) => {
    // 1. Delete Submissions of test session players AND test sessions
    const delSub = await tx.submission.deleteMany({
      where: {
        OR: [
          { playerId: { in: testSessionPlayerIds } },
          { sessionId: { in: testSessionIds } },
        ],
      },
    });

    // 2. Delete SessionPlayers
    const delSp = await tx.sessionPlayer.deleteMany({
      where: {
        OR: [
          { id: { in: testSessionPlayerIds } },
          { sessionId: { in: testSessionIds } },
        ],
      },
    });

    // 3. Delete Team Messages
    const delTmMsg = await tx.teamMessage.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { teamId: { in: createdTeamIds } },
        ],
      },
    });

    // 4. Delete Team Invitations
    const delTmInv = await tx.teamInvitation.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { receiverId: { in: testUserIds } },
          { teamId: { in: createdTeamIds } },
        ],
      },
    });

    // 5. Delete Team Members
    const delTmMem = await tx.teamMember.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { teamId: { in: createdTeamIds } },
        ],
      },
    });

    // 6. Delete Teams created by test users
    const delTeams = await tx.team.deleteMany({
      where: { id: { in: createdTeamIds } },
    });

    // 7. Delete Direct Messages
    const delMsg = await tx.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { recipientId: { in: testUserIds } },
        ],
      },
    });

    // 8. Delete Collaboration Requests & Collaborations
    const delCollabReq = await tx.collaborationRequest.deleteMany({
      where: {
        OR: [
          { senderId: { in: testUserIds } },
          { receiverId: { in: testUserIds } },
        ],
      },
    });
    const delCollab = await tx.collaboration.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { peerId: { in: testUserIds } },
        ],
      },
    });

    // 9. Delete Club Memberships
    const delClubMem = await tx.clubMember.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    // 10. Delete Profiles
    const delProf = await tx.profile.deleteMany({
      where: { userId: { in: testUserIds } },
    });

    // 11. Delete Sessions
    const delSessions = await tx.session.deleteMany({
      where: { id: { in: testSessionIds } },
    });

    // 12. Delete EventGames
    const delEg = await tx.eventGame.deleteMany({
      where: {
        OR: [
          { eventId: { in: testEventIds } },
          { gameId: { in: testGameIds } },
        ],
      },
    });

    // 13. Delete Challenges under test games
    const delCh = await tx.challenge.deleteMany({
      where: { gameId: { in: testGameIds } },
    });

    // 14. Delete Games created by test users
    const delGames = await tx.game.deleteMany({
      where: { id: { in: testGameIds } },
    });

    // 15. Delete Events created by test users
    const delEvents = await tx.event.deleteMany({
      where: { id: { in: testEventIds } },
    });

    // 16. Delete Users
    const delUsers = await tx.user.deleteMany({
      where: { id: { in: testUserIds } },
    });

    return {
      deletedUsers: delUsers.count,
      deletedSubmissions: delSub.count,
      deletedSessionPlayers: delSp.count,
      deletedTeams: delTeams.count,
      deletedSessions: delSessions.count,
      deletedGames: delGames.count,
      deletedEvents: delEvents.count,
    };
  }, { maxWait: 30000, timeout: 120000 });

  console.log('\n================================================================');
  console.log(` CLEANUP TRANSACTION EXECUTED SUCCESSFULLY:`);
  console.log(`   - Deleted Users:           ${result.deletedUsers}`);
  console.log(`   - Deleted Submissions:     ${result.deletedSubmissions}`);
  console.log(`   - Deleted SessionPlayers:  ${result.deletedSessionPlayers}`);
  console.log(`   - Deleted Teams:           ${result.deletedTeams}`);
  console.log(`   - Deleted Sessions:        ${result.deletedSessions}`);
  console.log(`   - Deleted Games:           ${result.deletedGames}`);
  console.log(`   - Deleted Events:          ${result.deletedEvents}`);
  console.log('================================================================');

  return { success: true, dryRun: false, result };
}

if (require.main === module) {
  const isDryRun = !process.argv.includes('--execute');
  inspectAndPlan(isDryRun)
    .catch((err) => {
      console.error('ERROR during cleanup:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { inspectAndPlan, RETAINED_ACCOUNTS, AUTOMATED_TEST_PATTERNS };
