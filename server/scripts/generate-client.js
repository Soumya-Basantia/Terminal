const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveSchema() {
  const candidates = [
    path.resolve(__dirname, '../../prisma/schema.prisma'),
    path.resolve(__dirname, '../prisma/schema.prisma'),
    path.resolve(process.cwd(), 'prisma/schema.prisma'),
    path.resolve(process.cwd(), '../prisma/schema.prisma'),
    path.resolve(process.cwd(), '../../prisma/schema.prisma')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`[Prisma Generate] schema.prisma could not be located in any known candidate path.`);
}

function generatePrismaClient() {
  const schemaPath = resolveSchema();
  console.log(`[Prisma Generate] Using schema at: ${schemaPath}`);

  // Execute prisma generate with resolved schema
  execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });

  // Handle monorepo artifact sync between root and server node_modules if needed
  const repoRoot = path.dirname(path.dirname(schemaPath));
  const rootNodeModules = path.join(repoRoot, 'node_modules');
  const serverNodeModules = path.resolve(__dirname, '../node_modules');

  const rootPrismaClient = path.join(rootNodeModules, '@prisma', 'client');
  const rootDotPrisma = path.join(rootNodeModules, '.prisma');

  const serverPrismaClient = path.join(serverNodeModules, '@prisma', 'client');
  const serverDotPrisma = path.join(serverNodeModules, '.prisma');

  // If generated in root, copy to server/node_modules if server has its own node_modules
  if (fs.existsSync(rootPrismaClient) && fs.existsSync(serverNodeModules) && rootNodeModules !== serverNodeModules) {
    try {
      if (fs.realpathSync(rootPrismaClient) !== fs.realpathSync(serverPrismaClient)) {
        fs.mkdirSync(path.dirname(serverPrismaClient), { recursive: true });
        fs.cpSync(rootPrismaClient, serverPrismaClient, { recursive: true });
        if (fs.existsSync(rootDotPrisma)) {
          fs.mkdirSync(path.dirname(serverDotPrisma), { recursive: true });
          fs.cpSync(rootDotPrisma, serverDotPrisma, { recursive: true });
        }
        console.log('[Prisma Generate] Synchronized client to server/node_modules');
      }
    } catch (e) {
      // If realpath matches or directory cannot be copied, continue safely
      console.log(`[Prisma Generate] Client synchronization note: ${e.message}`);
    }
  }

  // If generated in server, copy to root node_modules if root node_modules exists
  if (fs.existsSync(serverPrismaClient) && fs.existsSync(rootNodeModules) && rootNodeModules !== serverNodeModules) {
    try {
      if (!fs.existsSync(rootPrismaClient) || fs.realpathSync(serverPrismaClient) !== fs.realpathSync(rootPrismaClient)) {
        fs.mkdirSync(path.dirname(rootPrismaClient), { recursive: true });
        fs.cpSync(serverPrismaClient, rootPrismaClient, { recursive: true });
        if (fs.existsSync(serverDotPrisma)) {
          fs.mkdirSync(path.dirname(rootDotPrisma), { recursive: true });
          fs.cpSync(serverDotPrisma, rootDotPrisma, { recursive: true });
        }
        console.log('[Prisma Generate] Synchronized client to root node_modules');
      }
    } catch (e) {
      console.log(`[Prisma Generate] Root synchronization note: ${e.message}`);
    }
  }

  console.log('[Prisma Generate] Prisma Client generation completed successfully.');
}

generatePrismaClient();
