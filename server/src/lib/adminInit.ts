import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export async function ensureAdminUser(): Promise<void> {
  const adminUsername = 'root';
  const adminEmail = 'root@terminal.lan';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Root-Soumya';

  if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
    console.warn('⚠️ [SECURITY WARNING] ADMIN_PASSWORD environment variable is not configured in production. Please set a strong, random password.');
  }

  try {
    // Check if root administrator account already exists
    const existingRoot = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: adminUsername, mode: 'insensitive' } },
          { email: { equals: adminEmail, mode: 'insensitive' } }
        ]
      }
    });

    if (existingRoot) {
      // Preserve existing credentials — DO NOT overwrite passwordHash or user-configured credentials
      await prisma.user.update({
        where: { id: existingRoot.id },
        data: {
          username: 'root',
          email: adminEmail,
          role: 'ADMIN',
          approvalStatus: 'APPROVED',
          accountStatus: 'ACTIVE',
          name: existingRoot.name || 'Root Administrator'
        }
      });
      console.log(`🛡️ Verified singleton Root Administrator account (username: root)`);
    } else {
      // Initial creation on first bootstrap only
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          username: 'root',
          email: adminEmail,
          passwordHash,
          role: 'ADMIN',
          approvalStatus: 'APPROVED',
          accountStatus: 'ACTIVE',
          name: 'Root Administrator',
          profile: {
            create: { displayName: 'Root Administrator' }
          }
        }
      });
      console.log(`🛡️ Initialized singleton Root Administrator account (username: root)`);
    }
  } catch (error) {
    console.error('Failed to initialize root administrator user:', error);
  }
}
