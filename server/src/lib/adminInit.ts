import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export async function ensureAdminUser(): Promise<void> {
  const adminUsername = 'root';
  const adminEmail = 'root@terminal.lan';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Root-Soumya';

  try {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // Remove any legacy placeholder admin user if present to ensure exactly one root account
    await prisma.user.deleteMany({
      where: {
        username: { equals: 'admin', mode: 'insensitive' },
        email: { equals: 'admin@terminal.internal', mode: 'insensitive' }
      }
    });

    // Upsert or create exactly one root admin account
    const existingRoot = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: 'root', mode: 'insensitive' } },
          { email: { equals: adminEmail, mode: 'insensitive' } }
        ]
      }
    });

    if (existingRoot) {
      await prisma.user.update({
        where: { id: existingRoot.id },
        data: {
          username: 'root',
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          approvalStatus: 'APPROVED',
          name: 'Root Administrator'
        }
      });
      console.log(`🛡️ Verified singleton Root Administrator account (username: root)`);
    } else {
      await prisma.user.create({
        data: {
          username: 'root',
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          approvalStatus: 'APPROVED',
          name: 'Root Administrator',
          profile: {
            create: { displayName: 'Root Administrator' }
          }
        }
      });
      console.log(`🛡️ Initialized singleton Root Administrator account (username: root)`);
    }

    const demoEmail = 'demo@terminal.dev';
    const demoUser = await prisma.user.upsert({
      where: { email: demoEmail },
      update: {
        username: 'demo_designer',
        passwordHash: await bcrypt.hash('terminal123', 10),
        role: 'SUPER_ADMIN',
        approvalStatus: 'APPROVED',
        accountStatus: 'ACTIVE',
        name: 'Demo Designer'
      },
      create: {
        username: 'demo_designer',
        email: demoEmail,
        passwordHash: await bcrypt.hash('terminal123', 10),
        role: 'SUPER_ADMIN',
        approvalStatus: 'APPROVED',
        accountStatus: 'ACTIVE',
        name: 'Demo Designer',
        profile: {
          create: { displayName: 'Demo Designer' }
        }
      }
    });

    console.log(`🧪 Ensured demo designer account (email: ${demoUser.email})`);
  } catch (error) {
    console.error('Failed to initialize root administrator user:', error);
  }
}
