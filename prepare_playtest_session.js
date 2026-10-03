const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function prepare() {
  console.log("=== PREPARING THE WITNESS HUMAN PLAYTEST SESSION ===");

  // 1. Ensure GM account
  const gmEmail = 'gm@terminal.lan';
  const hashedPassword = await bcrypt.hash('password123', 10);
  let gm = await prisma.user.findUnique({ where: { email: gmEmail } });
  if (!gm) {
    gm = await prisma.user.create({
      data: {
        email: gmEmail,
        username: 'GameMaster',
        passwordHash: hashedPassword,
        role: 'SUPER_ADMIN'
      }
    });
  } else {
    gm = await prisma.user.update({
      where: { id: gm.id },
      data: { role: 'SUPER_ADMIN' }
    });
  }
  console.log("✓ GM ready:", gm.email);

  // 2. Ensure Student test account for instant login
  const studentEmail = 'detective@terminal.lan';
  let student = await prisma.user.findUnique({ where: { email: studentEmail } });
  if (!student) {
    student = await prisma.user.create({
      data: {
        email: studentEmail,
        username: 'Detective',
        passwordHash: hashedPassword,
        role: 'PLAYER'
      }
    });
  }
  console.log("✓ Student ready:", student.email);

  // 3. Create or update The Witness Game
  const mysteryConfig = {
    title: "OPERATION BLACKOUT: CORE INTRUSION",
    system: "Subnet Sentinel Perimeter Logs",
    narrative: "At 02:44, a rogue administrative token authorized an encrypted export from Server Room B. Exactly one of 8 active staff members is responsible.",
    questionBudget: 5,
    culpritId: "S4",
    secret: "S4",
    suspects: [
      { id: "S1", name: "Devon Reed", role: "DevOps Engineer", clearance: 2, location: "East Wing Office", accessTime: "02:15", authMethod: "SSH_KEY", subnet: "ALPHA" },
      { id: "S2", name: "Elena Mercer", role: "Database Administrator", clearance: 4, location: "Data Center Vault", accessTime: "01:45", authMethod: "BIOMETRIC", subnet: "BETA" },
      { id: "S3", name: "Marcus Vance", role: "Security Architect", clearance: 3, location: "SOC Control Room", accessTime: "02:30", authMethod: "SMARTCARD", subnet: "ALPHA" },
      { id: "S4", name: "Priya Nair", role: "Cloud Systems Lead", clearance: 3, location: "Server Room B", accessTime: "02:44", authMethod: "HARDWARE_TOKEN", subnet: "BETA" },
      { id: "S5", name: "Taro Tanaka", role: "Network Administrator", clearance: 2, location: "IDF Closet 4", accessTime: "03:10", authMethod: "SSH_KEY", subnet: "GAMMA" },
      { id: "S6", name: "Sarah Jenkins", role: "Site Reliability Specialist", clearance: 1, location: "Remote Workstation", accessTime: "02:50", authMethod: "VPN_CERT", subnet: "DELTA" },
      { id: "S7", name: "Chloe Bennett", role: "Systems Intern", clearance: 1, location: "Testing Lab C", accessTime: "01:15", authMethod: "PASSWORD", subnet: "ALPHA" },
      { id: "S8", name: "Alex Rivera", role: "Infrastructure Manager", clearance: 4, location: "Server Room B", accessTime: "02:00", authMethod: "BIOMETRIC", subnet: "BETA" }
    ],
    queryableAttributes: [
      { key: "clearance", label: "Clearance Level", type: "number", operators: [">=", "<=", "=="] },
      { key: "location", label: "Building Location", type: "string", operators: ["==", "!="] },
      { key: "accessTime", label: "Access Timestamp", type: "time", operators: [">=", "<="] },
      { key: "authMethod", label: "Authentication Method", type: "string", operators: ["==", "!="] },
      { key: "subnet", label: "Origin Subnet", type: "string", operators: ["==", "!="] }
    ]
  };

  let game = await prisma.game.findFirst({
    where: { name: 'Operation Blackout: The Witness', template: 'THE_WITNESS' }
  });

  if (!game) {
    game = await prisma.game.create({
      data: {
        name: 'Operation Blackout: The Witness',
        description: 'Zero-trust perimeter log investigation',
        template: 'THE_WITNESS',
        creatorId: gm.id,
      }
    });
  }

  // Ensure challenge exists
  let challenge = await prisma.challenge.findFirst({
    where: { gameId: game.id }
  });

  if (!challenge) {
    challenge = await prisma.challenge.create({
      data: {
        gameId: game.id,
        type: 'INTERROGATION',
        prompt: mysteryConfig.narrative,
        points: 100,
        timeLimit: 300,
        position: 0,
        config: mysteryConfig
      }
    });
  } else {
    challenge = await prisma.challenge.update({
      where: { id: challenge.id },
      data: { config: mysteryConfig, points: 100, timeLimit: 300 }
    });
  }
  console.log("✓ Game & Challenge ready:", game.id, challenge.id);

  // 4. Ensure Event exists
  let event = await prisma.event.findFirst({
    where: { name: 'The Witness Live Playtest' }
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'The Witness Live Playtest',
        mode: 'SEQUENCE',
        status: 'PUBLISHED',
        creatorId: gm.id,
      }
    });
    await prisma.eventGame.create({
      data: {
        eventId: event.id,
        gameId: game.id,
        position: 0,
      }
    });
  } else {
    await prisma.event.update({
      where: { id: event.id },
      data: { status: 'PUBLISHED' }
    });
  }
  console.log("✓ Event ready:", event.id);

  // 5. Clean up old WITNESS room code if exists
  const ROOM_CODE = 'WITNZ';
  const existingSession = await prisma.session.findUnique({
    where: { roomCode: ROOM_CODE }
  });

  if (existingSession) {
    await prisma.submission.deleteMany({ where: { sessionId: existingSession.id } });
    await prisma.sessionPlayer.deleteMany({ where: { sessionId: existingSession.id } });
    await prisma.session.delete({ where: { id: existingSession.id } });
    console.log("✓ Cleaned up prior session with code:", ROOM_CODE);
  }

  // 6. Create Fresh Session with room code WITNZ
  const session = await prisma.session.create({
    data: {
      roomCode: ROOM_CODE,
      eventId: event.id,
      currentGameId: game.id,
      currentChallengeId: challenge.id,
      status: 'ROUND_ACTIVE',
      currentRun: 1,
      challengeStartTime: new Date(),
    }
  });

  console.log("\n==================================================");
  console.log("✨ PLAYTEST SESSION INITIALIZED AND ACTIVE!");
  console.log("==================================================");
  console.log(`Room Code:          ${ROOM_CODE}`);
  console.log(`Direct Student URL: http://localhost:5173/join`);
  console.log(`Direct Play URL:    http://localhost:5173/play/${ROOM_CODE}`);
  console.log(`Direct Stage URL:   http://localhost:5173/stage/${ROOM_CODE}`);
  console.log(`Direct Host URL:    http://localhost:5173/host/${ROOM_CODE}`);
  console.log(`Student Login:      detective@terminal.lan / password123`);
  console.log(`GM Login:           gm@terminal.lan / password123`);
  console.log("==================================================\n");
}

prepare().catch(console.error).finally(() => prisma.$disconnect());
