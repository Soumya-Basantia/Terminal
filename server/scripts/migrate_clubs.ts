import { PrismaClient, ClubStatus, ClubRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating database to support Clubs...');

  // 1. Create Clubs
  const clubsData = [
    { name: 'LANGNET', slug: 'langnet', focus: 'LLM, Prompt Engineering, Generative AI', status: ClubStatus.ACTIVE },
    { name: 'CODENEX', slug: 'codenex', focus: 'Programming, Coding, Algorithms, Git', status: ClubStatus.ACTIVE },
    { name: 'AIERA', slug: 'aiera', focus: 'Artificial Intelligence, Machine Learning', status: ClubStatus.ACTIVE },
    { name: 'AGENTIC ARC', slug: 'agentic-arc', focus: 'Agentic AI, Tools, Workflows', status: ClubStatus.ACTIVE },
  ];

  for (const c of clubsData) {
    await prisma.club.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
    });
  }

  const codenex = await prisma.club.findUnique({ where: { slug: 'codenex' } });
  if (!codenex) throw new Error('Codenex not created');

  console.log('✅ Clubs created');

  // 2. Map existing Game Masters to CODENEX
  const gameMasters = await prisma.user.findMany({
    where: { role: 'GAME_MASTER' },
  });

  for (const gm of gameMasters) {
    await prisma.clubMember.upsert({
      where: { clubId_userId: { clubId: codenex.id, userId: gm.id } },
      update: { role: ClubRole.ADMIN },
      create: { clubId: codenex.id, userId: gm.id, role: ClubRole.ADMIN },
    });
  }
  console.log(`✅ Migrated ${gameMasters.length} existing Game Masters to CODENEX admins`);

  // 3. Assign existing games to CODENEX
  const updatedGames = await prisma.game.updateMany({
    where: { clubId: null },
    data: { clubId: codenex.id },
  });
  console.log(`✅ Migrated ${updatedGames.count} existing games to CODENEX`);

  // 4. Assign existing events to CODENEX
  const updatedEvents = await prisma.event.updateMany({
    where: { clubId: null },
    data: { clubId: codenex.id },
  });
  console.log(`✅ Migrated ${updatedEvents.count} existing events to CODENEX`);

  console.log('🎉 Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
