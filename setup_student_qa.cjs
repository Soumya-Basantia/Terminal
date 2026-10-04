require('./server/node_modules/dotenv').config({ path: './server/.env' });
const { PrismaClient } = require('./server/node_modules/@prisma/client');
const bcrypt = require('./server/node_modules/bcryptjs');
const jwt = require('./server/node_modules/jsonwebtoken');
const prisma = new PrismaClient();

async function setupStudent() {
  const hash = await bcrypt.hash('password123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'soumya@terminal.edu' },
    update: {
      name: 'Soumya Basantia',
      username: 'soumya',
      usn: '1RV21CS042',
      branch: 'CSE',
      section: 'B',
      role: 'PLAYER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      isVerified: true
    },
    create: {
      name: 'Soumya Basantia',
      username: 'soumya',
      email: 'soumya@terminal.edu',
      passwordHash: hash,
      usn: '1RV21CS042',
      branch: 'CSE',
      section: 'B',
      role: 'PLAYER',
      approvalStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      isVerified: true
    }
  });

  const token = jwt.sign(
    { userId: student.id, role: student.role, approvalStatus: student.approvalStatus },
    process.env.JWT_SECRET || 'terminal-super-secret-key-change-in-production',
    { expiresIn: '7d' }
  );

  console.log('Student ready:', student.name, 'USN:', student.usn);
  console.log('JWT_TOKEN:', token);
}

setupStudent().catch(console.error).finally(() => prisma.$disconnect());
