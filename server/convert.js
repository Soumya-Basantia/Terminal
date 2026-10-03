const fs = require('fs');
let s = fs.readFileSync('../prisma/schema.prisma', 'utf8');

s = s.replace(/provider = "postgresql"/, 'provider = "sqlite"');
s = s.replace(/url      = env\("DATABASE_URL"\)/, 'url      = "file:./dev.db"');

// Replace Enums in field definitions
s = s.replace(/role\s+UserRole\s+@default\(DESIGNER\)/, 'role      String   @default("DESIGNER")');
s = s.replace(/template\s+GameTemplate\s+@default\(QUIZ\)/, 'template    String @default("QUIZ")');
s = s.replace(/status\s+GameStatus\s+@default\(DRAFT\)/, 'status      String   @default("DRAFT")');
s = s.replace(/leaderboardVisibility\s+LeaderboardVisibility\s+@default\(LIVE\)/, 'leaderboardVisibility String @default("LIVE")');
s = s.replace(/type\s+ChallengeType\s+@default\(SINGLE_CHOICE\)/, 'type       String @default("SINGLE_CHOICE")');
s = s.replace(/difficulty\s+Difficulty\s+@default\(EASY\)/, 'difficulty  String    @default("EASY")');
s = s.replace(/state\s+SessionState\s+@default\(LOBBY\)/, 'state       String @default("LOBBY")');
s = s.replace(/status\s+PlayerStatus\s+@default\(ACTIVE\)/, 'status      String @default("ACTIVE")');
s = s.replace(/status\s+PollStatus\s+@default\(ACTIVE\)/, 'status    String @default("ACTIVE")');

// Remove enum definitions
s = s.replace(/enum [A-Za-z]+ \{[^}]+\}/g, '');

fs.writeFileSync('../prisma/schema.prisma', s);
