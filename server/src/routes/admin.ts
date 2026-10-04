import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireSuperAdmin, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../lib/audit';
import { generateExcelBuffer, generateMultiSheetExcelBuffer, ExcelColumn } from '../lib/excel';
import { isReservedKeyword } from './auth';
import { Prisma } from '@prisma/client';

const router = Router();

// Protect all admin endpoints with authenticate + requireSuperAdmin
router.use(authenticate);
router.use(requireSuperAdmin);

// Helper to get admin user details from request
async function getAdminActor(req: AuthRequest) {
  const adminId = req.userId;
  const admin = adminId ? await prisma.user.findUnique({ where: { id: adminId } }) : null;
  return {
    adminId: admin?.id || null,
    adminUsername: admin?.username || 'root',
  };
}

// ── ALLOWLISTS FOR SQL-STYLE SAFE QUERYING ──
const STUDENT_ALLOWLISTED_FIELDS = new Set([
  'id', 'name', 'usn', 'email', 'branch', 'section', 'accountStatus', 'isVerified', 'createdAt', 'updatedAt', 'lastLogin'
]);

const GAMEMASTER_ALLOWLISTED_FIELDS = new Set([
  'id', 'name', 'email', 'phoneNumber', 'approvalStatus', 'accountStatus', 'isVerified', 'createdAt', 'updatedAt', 'lastLogin'
]);

const USER_ALLOWLISTED_FIELDS = new Set([
  'id', 'username', 'name', 'email', 'role', 'approvalStatus', 'accountStatus', 'isVerified', 'usn', 'branch', 'section', 'phoneNumber', 'createdAt', 'updatedAt'
]);

const CLUB_ALLOWLISTED_FIELDS = new Set([
  'id', 'name', 'slug', 'focus', 'status', 'createdAt', 'updatedAt'
]);

const GAME_ALLOWLISTED_FIELDS = new Set([
  'id', 'name', 'template', 'status', 'maxPlayers', 'teamsEnabled', 'createdAt', 'updatedAt'
]);

const EVENT_ALLOWLISTED_FIELDS = new Set([
  'id', 'name', 'status', 'mode', 'createdAt', 'updatedAt'
]);

const REPORT_ALLOWLISTED_FIELDS = new Set([
  'id', 'targetType', 'status', 'reason', 'createdAt', 'updatedAt'
]);

const AUDIT_ALLOWLISTED_FIELDS = new Set([
  'id', 'adminUsername', 'action', 'targetType', 'targetId', 'createdAt'
]);

const ALLOWED_OPERATORS = new Set([
  'EQUALS', '=',
  'NOT_EQUALS', '!=',
  'CONTAINS', 'LIKE',
  'STARTS_WITH',
  'ENDS_WITH',
  'IN'
]);

// ── 1. OVERVIEW & PLATFORM STATISTICS ──
// GET /api/admin/stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalStudents,
      totalGameMasters,
      pendingGameMasters,
      approvedGameMasters,
      rejectedGameMasters,
      activeSessions,
      openReports,
      activeEvents,
      totalGames,
      totalClubs
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'PLAYER' } }),
      prisma.user.count({ where: { role: 'GAME_MASTER' } }),
      prisma.user.count({ where: { role: 'GAME_MASTER', approvalStatus: 'PENDING' } }),
      prisma.user.count({ where: { role: 'GAME_MASTER', approvalStatus: 'APPROVED' } }),
      prisma.user.count({ where: { role: 'GAME_MASTER', approvalStatus: 'REJECTED' } }),
      prisma.session.count({ where: { status: { not: 'ENDED' } } }),
      prisma.report.count({ where: { status: { in: ['PENDING', 'REVIEWING'] } } }),
      prisma.event.count({ where: { status: 'PUBLISHED' } }),
      prisma.game.count(),
      prisma.club.count(),
    ]);

    res.json({
      totalStudents,
      totalGameMasters,
      pendingGameMasters,
      approvedGameMasters,
      rejectedGameMasters,
      activeSessions,
      openReports,
      activeEvents,
      totalGames,
      totalClubs,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch admin statistics', details: err.message });
  }
});

// ── 2. GLOBAL SEARCH ──
// GET /api/admin/search?q=term
router.get('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    res.json({ results: [], total: 0 });
    return;
  }

  try {
    const [students, gameMasters, events, games, reports] = await Promise.all([
      // Search students
      prisma.user.findMany({
        where: {
          role: 'PLAYER',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { usn: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { branch: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, usn: true, email: true, branch: true, accountStatus: true },
        take: 10,
      }),
      // Search game masters
      prisma.user.findMany({
        where: {
          role: 'GAME_MASTER',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phoneNumber: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true, phoneNumber: true, approvalStatus: true, accountStatus: true },
        take: 10,
      }),
      // Search events
      prisma.event.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, status: true, mode: true },
        take: 10,
      }),
      // Search games
      prisma.game.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, template: true, status: true },
        take: 10,
      }),
      // Search reports
      prisma.report.findMany({
        where: {
          OR: [
            { reason: { contains: query, mode: 'insensitive' } },
            { details: { contains: query, mode: 'insensitive' } },
            { targetType: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, targetType: true, reason: true, status: true, createdAt: true },
        take: 10,
      }),
    ]);

    const results = [
      ...students.map(s => ({
        id: s.id,
        category: 'STUDENT',
        title: s.name || s.email,
        subtitle: `USN: ${s.usn || 'N/A'} | Branch: ${s.branch || 'N/A'}`,
        status: s.accountStatus,
        linkType: 'user',
        data: s,
      })),
      ...gameMasters.map(g => ({
        id: g.id,
        category: 'GAME_MASTER',
        title: g.name || g.email,
        subtitle: `Email: ${g.email} | Phone: ${g.phoneNumber || 'N/A'}`,
        status: g.approvalStatus,
        linkType: 'user',
        data: g,
      })),
      ...events.map(e => ({
        id: e.id,
        category: 'EVENT',
        title: e.name,
        subtitle: `Mode: ${e.mode}`,
        status: e.status,
        linkType: 'event',
        data: e,
      })),
      ...games.map(gm => ({
        id: gm.id,
        category: 'GAME',
        title: gm.name,
        subtitle: `Template: ${gm.template}`,
        status: gm.status,
        linkType: 'game',
        data: gm,
      })),
      ...reports.map(r => ({
        id: r.id,
        category: 'REPORT',
        title: `Report #${r.id.slice(-6)}: ${r.reason}`,
        subtitle: `Type: ${r.targetType}`,
        status: r.status,
        linkType: 'report',
        data: r,
      })),
    ];

    res.json({ results, total: results.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// ── 2b. STUDENT PERFORMANCE DETAIL ──
// GET /api/admin/students/:id/performance
// Returns full identity + real-time performance metrics for a single student
router.get('/students/:id/performance', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.id);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        usn: true,
        branch: true,
        section: true,
        role: true,
        accountStatus: true,
        approvalStatus: true,
        isVerified: true,
        lastLogin: true,
        lastActivity: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Fetch all session enrollments with session/game/event context
    const sessionPlayers = await prisma.sessionPlayer.findMany({
      where: { userId },
      include: {
        session: {
          include: {
            event: { select: { id: true, name: true, clubId: true } },
            currentGame: { select: { id: true, name: true, template: true, clubId: true } },
          },
        },
        team: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Fetch all submissions for this student
    const submissions = await prisma.submission.findMany({
      where: { player: { userId } },
      include: {
        challenge: { select: { id: true, points: true, gameId: true } },
        session: { select: { id: true, roomCode: true, startedAt: true, endedAt: true, status: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Aggregate metrics
    const totalScore = submissions.reduce((s, sub) => s + (sub.score || 0), 0);
    const attemptedCount = submissions.length;
    const solvedCount = submissions.filter(s => s.isCorrect).length;
    const successRate = attemptedCount > 0 ? Math.round((solvedCount / attemptedCount) * 100) : 0;
    const sessionIds = [...new Set(sessionPlayers.map(sp => sp.sessionId))];
    const gamesPlayed = sessionIds.length;
    const completedSessions = sessionPlayers.filter(sp =>
      sp.session.status === 'ENDED' || sp.session.status === 'RESULTS'
    ).length;

    // Per-session breakdown (game history)
    const gameHistory = sessionPlayers.slice(0, 20).map(sp => {
      const sessionSubs = submissions.filter(sub => sub.sessionId === sp.sessionId);
      const sessionScore = sessionSubs.reduce((s, sub) => s + (sub.score || 0), 0);
      const sessionSolved = sessionSubs.filter(s => s.isCorrect).length;
      const sessionAttempted = sessionSubs.length;
      return {
        sessionId: sp.sessionId,
        roomCode: sp.session.roomCode,
        gameName: sp.session.currentGame?.name || 'Unknown Game',
        gameTemplate: sp.session.currentGame?.template || 'QUIZ',
        eventName: sp.session.event?.name || 'Platform Event',
        teamId: sp.team?.id || null,
        teamName: sp.team?.name || null,
        joinedAt: sp.joinedAt,
        sessionStatus: sp.session.status,
        startedAt: sp.session.startedAt,
        endedAt: sp.session.endedAt,
        score: sessionScore,
        challengesAttempted: sessionAttempted,
        challengesSolved: sessionSolved,
        successRate: sessionAttempted > 0 ? Math.round((sessionSolved / sessionAttempted) * 100) : 0,
        result: (sp.session.status === 'ENDED' || sp.session.status === 'RESULTS') ? 'COMPLETED' : sp.session.status === 'LOBBY' ? 'PENDING' : 'IN_PROGRESS',
      };
    });

    // Current team membership
    const currentTeam = await prisma.teamMember.findFirst({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
              include: { user: { select: { username: true, name: true } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Club memberships
    const clubMemberships = await prisma.clubMember.findMany({
      where: { userId },
      include: { club: { select: { id: true, name: true, slug: true } } },
    });

    // Global rank among all PLAYER users by total score
    const allPlayerScores: Array<{ userId: string; totalScore: number }> = await prisma.$queryRaw`
      SELECT sp."userId" as "userId", COALESCE(SUM(sub.score), 0)::int as "totalScore"
      FROM session_players sp
      LEFT JOIN submissions sub ON sub."playerId" = sp.id
      INNER JOIN users u ON u.id = sp."userId" AND u.role = 'PLAYER'
      GROUP BY sp."userId"
      ORDER BY "totalScore" DESC
    `;

    const rankIdx = allPlayerScores.findIndex(p => p.userId === userId);
    const currentRank = rankIdx >= 0 ? rankIdx + 1 : allPlayerScores.length + 1;

    res.json({
      student: {
        id: user.id,
        username: user.username,
        handle: `${user.username}@terminal`,
        name: user.name || user.username,
        email: user.email,
        usn: user.usn || 'N/A',
        branch: user.branch || 'N/A',
        section: user.section || 'N/A',
        role: user.role,
        accountStatus: user.accountStatus,
        approvalStatus: user.approvalStatus,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin,
        lastActivity: user.lastActivity,
        createdAt: user.createdAt,
      },
      performance: {
        totalScore,
        rank: currentRank,
        gamesPlayed,
        gamesCompleted: completedSessions,
        challengesAttempted: attemptedCount,
        challengesSolved: solvedCount,
        successRate,
      },
      team: currentTeam ? {
        id: currentTeam.team.id,
        name: currentTeam.team.name,
        role: currentTeam.role,
        memberCount: currentTeam.team.members.length,
        members: currentTeam.team.members.map(m => `${m.user.username}@terminal`),
      } : null,
      clubs: clubMemberships.map(cm => ({
        id: cm.club.id,
        name: cm.club.name,
        slug: cm.club.slug,
        role: cm.role,
      })),
      gameHistory,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch student performance', details: err.message });
  }
});

// ── 3. USER DETAILS & TIMELINE ──
// GET /api/admin/users/:id
router.get('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        _count: {
          select: {
            games: true,
            events: true,
            sessionPlayers: true,
            filedReports: true,
            reportedReports: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Sanitize passwordHash
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user details', details: err.message });
  }
});

// GET /api/admin/users/:id/timeline
router.get('/users/:id/timeline', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        sessionPlayers: {
          include: {
            session: {
              include: {
                currentGame: { select: { name: true, template: true } },
                event: { select: { name: true } },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
          take: 20,
        },
        filedReports: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        reportedReports: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build timeline items
    const events: Array<{ type: string; title: string; timestamp: Date; details?: any }> = [
      {
        type: 'REGISTRATION',
        title: `Account registered as ${user.role}`,
        timestamp: user.createdAt,
        details: { email: user.email, usn: user.usn },
      },
    ];

    if (user.lastLogin) {
      events.push({
        type: 'LOGIN',
        title: 'Last logged in',
        timestamp: user.lastLogin,
      });
    }

    if (user.lastActivity) {
      events.push({
        type: 'ACTIVITY',
        title: 'Last active',
        timestamp: user.lastActivity,
      });
    }

    // Game participations
    for (const sp of user.sessionPlayers) {
      events.push({
        type: 'GAME_PARTICIPATION',
        title: `Joined session in ${sp.session.currentGame?.name || sp.session.event?.name || 'Tournament'}`,
        timestamp: sp.joinedAt,
        details: { sessionId: sp.sessionId, status: sp.status },
      });
    }

    // Reports filed
    for (const rep of user.filedReports) {
      events.push({
        type: 'REPORT_FILED',
        title: `Filed report: ${rep.reason}`,
        timestamp: rep.createdAt,
        details: { status: rep.status, targetType: rep.targetType },
      });
    }

    // Reports against user
    for (const rep of user.reportedReports) {
      events.push({
        type: 'REPORT_RECEIVED',
        title: `Reported for: ${rep.reason}`,
        timestamp: rep.createdAt,
        details: { status: rep.status },
      });
    }

    // Admin audit logs for this target
    const auditLogsOnUser = await prisma.auditLog.findMany({
      where: { targetId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const a of auditLogsOnUser) {
      events.push({
        type: 'ADMIN_ACTION',
        title: `Admin [${a.adminUsername}] executed: ${a.action}`,
        timestamp: a.createdAt,
        details: a.details,
      });
    }

    // Sort descending by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ timeline: events });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user timeline', details: err.message });
  }
});

// PATCH /api/admin/users/:id — Edit appropriate user details
router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { name, email, usn, branch, section, phoneNumber } = req.body;
  const adminActor = await getAdminActor(req);

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Validate email/usn uniqueness if changed
    if (email && email !== user.email) {
      if (isReservedKeyword(email)) {
        res.status(400).json({ error: "The identifier 'root' is reserved for system administration." });
        return;
      }
      const existingEmail = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, id: { not: id } },
      });
      if (existingEmail) {
        res.status(409).json({ error: 'Email already in use by another user' });
        return;
      }
    }

    if (usn && usn !== user.usn) {
      if (isReservedKeyword(usn)) {
        res.status(400).json({ error: "The identifier 'root' is reserved for system administration." });
        return;
      }
      const existingUsn = await prisma.user.findFirst({
        where: { usn: { equals: usn.toUpperCase() }, id: { not: id } },
      });
      if (existingUsn) {
        res.status(409).json({ error: 'USN already in use by another user' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(usn !== undefined ? { usn: usn ? usn.toUpperCase() : null } : {}),
        ...(branch !== undefined ? { branch } : {}),
        ...(section !== undefined ? { section } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
      },
    });

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'USER_EDITED',
      targetType: 'USER',
      targetId: id,
      details: { changes: req.body },
    });

    const { passwordHash, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// PATCH /api/admin/users/:id/status — Approve/reject GM, verify/block/suspend user
router.patch('/users/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { approvalStatus, accountStatus, isVerified } = req.body;
  const adminActor = await getAdminActor(req);

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updateData: any = {};
    if (approvalStatus && ['PENDING', 'APPROVED', 'REJECTED'].includes(approvalStatus)) {
      updateData.approvalStatus = approvalStatus;
    }
    if (accountStatus && ['ACTIVE', 'PENDING', 'SUSPENDED', 'BLOCKED', 'REJECTED'].includes(accountStatus)) {
      updateData.accountStatus = accountStatus;
    }
    if (typeof isVerified === 'boolean') {
      updateData.isVerified = isVerified;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No valid status fields provided' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'USER_STATUS_CHANGED',
      targetType: 'USER',
      targetId: id,
      details: updateData,
    });

    const { passwordHash, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user status', details: err.message });
  }
});

// POST /api/admin/users/bulk-action — Bulk user operations
const BulkActionSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Select at least one user'),
  action: z.enum(['verify', 'unverify', 'block', 'unblock', 'suspend', 'activate', 'approve', 'reject']),
});

router.post('/users/bulk-action', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = BulkActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid bulk action payload', details: parsed.error.flatten() });
    return;
  }

  const { userIds, action } = parsed.data;
  const adminActor = await getAdminActor(req);

  try {
    let updateData: any = {};
    switch (action) {
      case 'verify':
        updateData = { isVerified: true };
        break;
      case 'unverify':
        updateData = { isVerified: false };
        break;
      case 'block':
        updateData = { accountStatus: 'BLOCKED' };
        break;
      case 'unblock':
      case 'activate':
        updateData = { accountStatus: 'ACTIVE' };
        break;
      case 'suspend':
        updateData = { accountStatus: 'SUSPENDED' };
        break;
      case 'approve':
        updateData = { approvalStatus: 'APPROVED' };
        break;
      case 'reject':
        updateData = { approvalStatus: 'REJECTED' };
        break;
    }

    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: updateData,
    });

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: `BULK_${action.toUpperCase()}`,
      targetType: 'USER',
      details: { count: result.count, userIds },
    });

    res.json({
      success: true,
      message: `Bulk action '${action}' applied to ${result.count} users.`,
      updatedCount: result.count,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Bulk action failed', details: err.message });
  }
});

// ── 4. PARAMETERIZED SQL-STYLE QUERY INTERFACE ──
// POST /api/admin/query
const QueryRequestSchema = z.object({
  target: z.enum(['students', 'gamemasters', 'users', 'clubs', 'games', 'events', 'reports', 'audit_logs']),
  search: z.string().optional(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any(),
  })).optional(),
  orderBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});

function getAllowlistForTarget(target: string): Set<string> {
  switch (target) {
    case 'students': return STUDENT_ALLOWLISTED_FIELDS;
    case 'gamemasters': return GAMEMASTER_ALLOWLISTED_FIELDS;
    case 'users': return USER_ALLOWLISTED_FIELDS;
    case 'clubs': return CLUB_ALLOWLISTED_FIELDS;
    case 'games': return GAME_ALLOWLISTED_FIELDS;
    case 'events': return EVENT_ALLOWLISTED_FIELDS;
    case 'reports': return REPORT_ALLOWLISTED_FIELDS;
    case 'audit_logs': return AUDIT_ALLOWLISTED_FIELDS;
    default: return STUDENT_ALLOWLISTED_FIELDS;
  }
}

router.post('/query', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = QueryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    return;
  }

  const { target, search, filters = [], orderBy, page, pageSize } = parsed.data;
  const allowlist = getAllowlistForTarget(target);

  // Validate fields in filters and orderBy
  for (const filter of filters) {
    if (!allowlist.has(filter.field)) {
      res.status(400).json({ error: `Field '${filter.field}' is not permitted for querying ${target}` });
      return;
    }
    const op = filter.operator.toUpperCase();
    if (!ALLOWED_OPERATORS.has(op)) {
      res.status(400).json({ error: `Operator '${filter.operator}' is not supported` });
      return;
    }
  }

  if (orderBy && !allowlist.has(orderBy.field)) {
    res.status(400).json({ error: `Sort field '${orderBy.field}' is not permitted` });
    return;
  }

  try {
    const andConditions: any[] = [];
    const sqlWhereParts: string[] = [];

    // Role restrictions for students / gamemasters
    if (target === 'students') {
      andConditions.push({ role: 'PLAYER' });
      sqlWhereParts.push(`role = 'PLAYER'`);
    } else if (target === 'gamemasters') {
      andConditions.push({ role: 'GAME_MASTER' });
      sqlWhereParts.push(`role = 'GAME_MASTER'`);
    }

    // Global search keyword
    if (search && search.trim()) {
      const term = search.trim();
      if (target === 'students') {
        andConditions.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { usn: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { branch: { contains: term, mode: 'insensitive' } },
            { section: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(name ILIKE '%${term}%' OR usn ILIKE '%${term}%' OR email ILIKE '%${term}%')`);
      } else if (target === 'gamemasters') {
        andConditions.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phoneNumber: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(name ILIKE '%${term}%' OR email ILIKE '%${term}%' OR phone_number ILIKE '%${term}%')`);
      } else if (target === 'users') {
        andConditions.push({
          OR: [
            { username: { contains: term, mode: 'insensitive' } },
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { usn: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(username ILIKE '%${term}%' OR name ILIKE '%${term}%' OR email ILIKE '%${term}%')`);
      } else if (target === 'games') {
        andConditions.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(name ILIKE '%${term}%' OR description ILIKE '%${term}%')`);
      } else if (target === 'events') {
        andConditions.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(name ILIKE '%${term}%' OR description ILIKE '%${term}%')`);
      } else if (target === 'reports') {
        andConditions.push({
          OR: [
            { reason: { contains: term, mode: 'insensitive' } },
            { details: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(reason ILIKE '%${term}%' OR details ILIKE '%${term}%')`);
      } else if (target === 'audit_logs') {
        andConditions.push({
          OR: [
            { adminUsername: { contains: term, mode: 'insensitive' } },
            { action: { contains: term, mode: 'insensitive' } },
            { targetType: { contains: term, mode: 'insensitive' } },
          ],
        });
        sqlWhereParts.push(`(admin_username ILIKE '%${term}%' OR action ILIKE '%${term}%')`);
      }
    }

    // Structured parameterized filters
    for (const f of filters) {
      const op = f.operator.toUpperCase();
      const val = f.value;

      switch (op) {
        case 'EQUALS':
        case '=':
          andConditions.push({ [f.field]: val });
          sqlWhereParts.push(`${f.field} = '${val}'`);
          break;
        case 'NOT_EQUALS':
        case '!=':
          andConditions.push({ [f.field]: { not: val } });
          sqlWhereParts.push(`${f.field} != '${val}'`);
          break;
        case 'CONTAINS':
        case 'LIKE':
          andConditions.push({ [f.field]: { contains: String(val), mode: 'insensitive' } });
          sqlWhereParts.push(`${f.field} ILIKE '%${val}%'`);
          break;
        case 'STARTS_WITH':
          andConditions.push({ [f.field]: { startsWith: String(val), mode: 'insensitive' } });
          sqlWhereParts.push(`${f.field} LIKE '${val}%'`);
          break;
        case 'ENDS_WITH':
          andConditions.push({ [f.field]: { endsWith: String(val), mode: 'insensitive' } });
          sqlWhereParts.push(`${f.field} LIKE '%${val}'`);
          break;
        case 'IN': {
          const inArr = Array.isArray(val) ? val : [val];
          andConditions.push({ [f.field]: { in: inArr } });
          sqlWhereParts.push(`${f.field} IN (${inArr.map(x => `'${x}'`).join(', ')})`);
          break;
        }
      }
    }

    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};
    const sortField = orderBy?.field || 'createdAt';
    const sortDir = orderBy?.direction || 'desc';
    const offset = (page - 1) * pageSize;

    let total = 0;
    let records: any[] = [];
    let tableName = 'users';

    if (target === 'students' || target === 'gamemasters' || target === 'users') {
      tableName = 'users';
      const selectFields = target === 'students'
        ? { id: true, name: true, usn: true, email: true, branch: true, section: true, accountStatus: true, isVerified: true, lastLogin: true, createdAt: true, updatedAt: true }
        : target === 'gamemasters'
        ? { id: true, name: true, email: true, phoneNumber: true, approvalStatus: true, accountStatus: true, isVerified: true, lastLogin: true, createdAt: true, updatedAt: true }
        : { id: true, username: true, name: true, email: true, role: true, approvalStatus: true, accountStatus: true, isVerified: true, usn: true, branch: true, section: true, phoneNumber: true, createdAt: true, updatedAt: true };

      [total, records] = await Promise.all([
        prisma.user.count({ where: whereClause }),
        prisma.user.findMany({
          where: whereClause,
          select: selectFields,
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        }),
      ]);
    } else if (target === 'clubs') {
      tableName = 'clubs';
      [total, records] = await Promise.all([
        prisma.club.count({ where: whereClause }),
        prisma.club.findMany({
          where: whereClause,
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        }),
      ]);
    } else if (target === 'games') {
      tableName = 'games';
      [total, records] = await Promise.all([
        prisma.game.count({ where: whereClause }),
        prisma.game.findMany({
          where: whereClause,
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        }),
      ]);
    } else if (target === 'events') {
      tableName = 'events';
      [total, records] = await Promise.all([
        prisma.event.count({ where: whereClause }),
        prisma.event.findMany({
          where: whereClause,
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        }),
      ]);
    } else if (target === 'reports') {
      tableName = 'reports';
      [total, records] = await Promise.all([
        prisma.report.count({ where: whereClause }),
        prisma.report.findMany({
          where: whereClause,
          include: {
            reporter: { select: { id: true, name: true, email: true, role: true } },
            reportedUser: { select: { id: true, name: true, email: true, role: true } },
          },
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        }),
      ]);
    } else if (target === 'audit_logs') {
      tableName = 'audit_logs';
      [total, records] = await Promise.all([
        prisma.auditLog.count({ where: whereClause }),
        prisma.auditLog.findMany({
          where: whereClause,
          orderBy: { [sortField]: sortDir },
          skip: offset,
          take: pageSize,
        }),
      ]);
    }

    const sqlPreview = `SELECT * FROM ${tableName}${sqlWhereParts.length > 0 ? `\nWHERE ${sqlWhereParts.join('\n  AND ')}` : ''}\nORDER BY ${sortField} ${sortDir.toUpperCase()}\nLIMIT ${pageSize} OFFSET ${offset};`;

    res.json({
      target,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
      sqlPreview,
      records,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Query execution failed', details: err.message });
  }
});

// ── 5. DIRECT MESSAGING ──
// POST /api/admin/messages — Send direct message to student or GM
const SendMessageSchema = z.object({
  recipientId: z.string().min(1, 'Recipient is required'),
  content: z.string().min(1, 'Message content cannot be empty'),
});

router.post('/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid message payload', details: parsed.error.flatten() });
    return;
  }

  const { recipientId, content } = parsed.data;
  const adminActor = await getAdminActor(req);

  try {
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    if (!recipient) {
      res.status(404).json({ error: 'Recipient user not found' });
      return;
    }

    // Identify sender ID
    let senderId = adminActor.adminId;
    if (!senderId) {
      const rootUser = await prisma.user.findFirst({ where: { username: { equals: 'root', mode: 'insensitive' } } });
      senderId = rootUser?.id || recipientId;
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        recipientId,
        content,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, role: true } },
        recipient: { select: { id: true, name: true, username: true, role: true } },
      },
    });

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'MESSAGE_SENT',
      targetType: 'USER',
      targetId: recipientId,
      details: { messageId: message.id, contentPreview: content.slice(0, 50) },
    });

    res.status(201).json({ success: true, message });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

// GET /api/admin/messages/:userId — Conversation history with a user
router.get('/messages/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = String(req.params.userId);

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, username: true, role: true } },
        recipient: { select: { id: true, name: true, username: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch conversation history', details: err.message });
  }
});

// ── 6. REPORTS MANAGEMENT ──
// GET /api/admin/reports
router.get('/reports', async (req: AuthRequest, res: Response): Promise<void> => {
  const status = req.query.status as string | undefined;
  const targetType = req.query.targetType as string | undefined;
  const search = req.query.search as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
  const offset = (page - 1) * pageSize;

  try {
    const where: any = {};
    if (status && ['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'].includes(status)) {
      where.status = status;
    }
    if (targetType) {
      where.targetType = targetType;
    }
    if (search && search.trim()) {
      where.OR = [
        { reason: { contains: search.trim(), mode: 'insensitive' } },
        { details: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true, role: true } },
          reportedUser: { select: { id: true, name: true, email: true, role: true } },
          handler: { select: { id: true, name: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
      }),
    ]);

    res.json({
      reports,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reports', details: err.message });
  }
});

// PATCH /api/admin/reports/:id — Review, resolve, reject report with internal notes
const UpdateReportSchema = z.object({
  status: z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED']).optional(),
  internalNotes: z.string().optional(),
});

router.patch('/reports/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid report update payload', details: parsed.error.flatten() });
    return;
  }

  const adminActor = await getAdminActor(req);

  try {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const updated = await prisma.report.update({
      where: { id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.internalNotes !== undefined ? { internalNotes: parsed.data.internalNotes } : {}),
        handlerId: adminActor.adminId,
      },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reportedUser: { select: { id: true, name: true, email: true } },
        handler: { select: { id: true, name: true, username: true } },
      },
    });

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: `REPORT_${parsed.data.status || 'UPDATED'}`,
      targetType: 'REPORT',
      targetId: id,
      details: parsed.data,
    });

    res.json({ success: true, report: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update report', details: err.message });
  }
});

// ── 7. CONTENT MANAGEMENT (CLUBS, GAMES, EVENTS, CHALLENGES) ──
// GET /api/admin/content/:type
router.get('/content/:type', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = String(req.params.type).toLowerCase();
  const search = req.query.search as string | undefined;

  try {
    if (type === 'clubs') {
      const clubs = await prisma.club.findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
        include: { _count: { select: { games: true, events: true, members: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ items: clubs, total: clubs.length });
    } else if (type === 'games') {
      const games = await prisma.game.findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
        include: {
          club: { select: { id: true, name: true } },
          _count: { select: { challenges: true, currentSessions: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ items: games, total: games.length });
    } else if (type === 'events') {
      const events = await prisma.event.findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
        include: {
          club: { select: { id: true, name: true } },
          _count: { select: { games: true, sessions: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ items: events, total: events.length });
    } else if (type === 'challenges') {
      const challenges = await prisma.challenge.findMany({
        where: search ? { prompt: { contains: search, mode: 'insensitive' } } : {},
        include: { game: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ items: challenges, total: challenges.length });
    } else {
      res.status(400).json({ error: `Unsupported content type '${type}'. Supported: clubs, games, events, challenges.` });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch content', details: err.message });
  }
});

// PATCH /api/admin/content/:type/:id — Edit content (NO AUTOMATIC NOTIFICATIONS)
router.patch('/content/:type/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = String(req.params.type).toLowerCase();
  const id = String(req.params.id);
  const adminActor = await getAdminActor(req);

  try {
    let updated: any;
    if (type === 'clubs') {
      const { name, focus, description, status } = req.body;
      updated = await prisma.club.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(focus !== undefined ? { focus } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status ? { status } : {}),
        },
      });
    } else if (type === 'games') {
      const { name, description, status, maxPlayers, teamsEnabled } = req.body;
      updated = await prisma.game.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status ? { status } : {}),
          ...(maxPlayers !== undefined ? { maxPlayers: Number(maxPlayers) } : {}),
          ...(teamsEnabled !== undefined ? { teamsEnabled: Boolean(teamsEnabled) } : {}),
        },
      });
    } else if (type === 'events') {
      const { name, description, status, mode } = req.body;
      updated = await prisma.event.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status ? { status } : {}),
          ...(mode ? { mode } : {}),
        },
      });
    } else if (type === 'challenges') {
      const { prompt, points, timeLimit } = req.body;
      updated = await prisma.challenge.update({
        where: { id },
        data: {
          ...(prompt ? { prompt } : {}),
          ...(points !== undefined ? { points: Number(points) } : {}),
          ...(timeLimit !== undefined ? { timeLimit: Number(timeLimit) } : {}),
        },
      });
    } else {
      res.status(400).json({ error: `Unsupported content type '${type}'` });
      return;
    }

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'CONTENT_EDITED',
      targetType: type.toUpperCase(),
      targetId: id,
      details: { changes: req.body, silent: true },
    });

    res.json({ success: true, item: updated, message: 'Content updated successfully without sending notifications.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update content', details: err.message });
  }
});

// PATCH /api/admin/content/:type/:id/toggle — Activate/deactivate content
router.patch('/content/:type/:id/toggle', async (req: AuthRequest, res: Response): Promise<void> => {
  const type = String(req.params.type).toLowerCase();
  const id = String(req.params.id);
  const adminActor = await getAdminActor(req);

  try {
    let updated: any;
    let newStatus = '';
    if (type === 'clubs') {
      const club = await prisma.club.findUnique({ where: { id } });
      if (!club) { res.status(404).json({ error: 'Club not found' }); return; }
      newStatus = club.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      updated = await prisma.club.update({ where: { id }, data: { status: newStatus as any } });
    } else if (type === 'games') {
      const game = await prisma.game.findUnique({ where: { id } });
      if (!game) { res.status(404).json({ error: 'Game not found' }); return; }
      newStatus = game.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
      updated = await prisma.game.update({ where: { id }, data: { status: newStatus as any } });
    } else if (type === 'events') {
      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
      newStatus = event.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
      updated = await prisma.event.update({ where: { id }, data: { status: newStatus as any } });
    } else {
      res.status(400).json({ error: `Toggle not supported for content type '${type}'` });
      return;
    }

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: newStatus === 'ACTIVE' || newStatus === 'PUBLISHED' ? 'CONTENT_ACTIVATED' : 'CONTENT_DEACTIVATED',
      targetType: type.toUpperCase(),
      targetId: id,
      details: { newStatus },
    });

    res.json({ success: true, item: updated, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to toggle content status', details: err.message });
  }
});

// ── 8. AUDIT LOGS ──
// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  const action = req.query.action as string | undefined;
  const targetType = req.query.targetType as string | undefined;
  const search = req.query.search as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 30));
  const offset = (page - 1) * pageSize;

  try {
    const where: any = {};
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (search && search.trim()) {
      where.OR = [
        { adminUsername: { contains: search.trim(), mode: 'insensitive' } },
        { action: { contains: search.trim(), mode: 'insensitive' } },
        { targetType: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: pageSize,
      }),
    ]);

    res.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
  }
});

// ── 9. SYSTEM SETTINGS & EMERGENCY CONTROLS ──
// GET /api/admin/system-settings
router.get('/system-settings', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {
      student_registration_enabled: 'true',
      gm_registration_enabled: 'true',
      maintenance_mode: 'false',
      disabled_games: '[]',
      disabled_events: '[]',
    };

    for (const s of settings) {
      map[s.key] = s.value;
    }

    res.json({ settings: map });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch system settings', details: err.message });
  }
});

// POST /api/admin/system-settings — Update system control flags
router.post('/system-settings', async (req: AuthRequest, res: Response): Promise<void> => {
  const { key, value, description } = req.body;
  if (!key || typeof value !== 'string') {
    res.status(400).json({ error: "Both 'key' and string 'value' are required" });
    return;
  }

  const adminActor = await getAdminActor(req);

  try {
    const updated = await prisma.systemSetting.upsert({
      where: { key },
      update: { value, description: description || null },
      create: { key, value, description: description || null },
    });

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'SYSTEM_CONFIG_CHANGED',
      targetType: 'SYSTEM',
      targetId: key,
      details: { key, value },
    });

    res.json({ success: true, setting: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update system setting', details: err.message });
  }
});

// ── 10. EXCEL EXPORT (ALL DATA TABLES) ──
// POST or GET /api/admin/export/:target
router.all(['/export/:target', '/export'], async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const target = String(req.params.target || req.body?.target || req.query?.target || 'students').toLowerCase();
  if (target === 'students-full') {
    return next();
  }
  const search = req.body?.search || req.query?.search;
  const filters = req.body?.filters || [];
  const adminActor = await getAdminActor(req);

  try {
    let columns: ExcelColumn[] = [];
    let rows: any[] = [];
    let sheetName = target.toUpperCase();

    // Construct filter condition
    const andConditions: any[] = [];
    if (target === 'students') {
      andConditions.push({ role: 'PLAYER' });
    } else if (target === 'gamemasters') {
      andConditions.push({ role: 'GAME_MASTER' });
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      if (target === 'students' || target === 'gamemasters' || target === 'users') {
        andConditions.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { usn: { contains: term, mode: 'insensitive' } },
          ],
        });
      } else if (target === 'games' || target === 'events') {
        andConditions.push({ name: { contains: term, mode: 'insensitive' } });
      } else if (target === 'reports') {
        andConditions.push({ reason: { contains: term, mode: 'insensitive' } });
      } else if (target === 'audit_logs') {
        andConditions.push({ action: { contains: term, mode: 'insensitive' } });
      }
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    if (target === 'students') {
      columns = [
        { header: 'Student ID', key: 'id', width: 26 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'USN', key: 'usn', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Branch', key: 'branch', width: 14 },
        { header: 'Section', key: 'section', width: 12 },
        { header: 'Account Status', key: 'accountStatus', width: 16 },
        { header: 'Verified', key: 'isVerified', width: 12 },
        { header: 'Last Login', key: 'lastLogin', width: 22 },
        { header: 'Registered At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'gamemasters') {
      columns = [
        { header: 'GM ID', key: 'id', width: 26 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Phone Number', key: 'phoneNumber', width: 18 },
        { header: 'Approval Status', key: 'approvalStatus', width: 18 },
        { header: 'Account Status', key: 'accountStatus', width: 16 },
        { header: 'Verified', key: 'isVerified', width: 12 },
        { header: 'Last Login', key: 'lastLogin', width: 22 },
        { header: 'Registered At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'users') {
      columns = [
        { header: 'User ID', key: 'id', width: 26 },
        { header: 'Username', key: 'username', width: 18 },
        { header: 'Name', key: 'name', width: 22 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Role', key: 'role', width: 16 },
        { header: 'Approval Status', key: 'approvalStatus', width: 18 },
        { header: 'Account Status', key: 'accountStatus', width: 16 },
        { header: 'USN', key: 'usn', width: 16 },
        { header: 'Branch', key: 'branch', width: 14 },
        { header: 'Phone', key: 'phoneNumber', width: 18 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'clubs') {
      columns = [
        { header: 'Club ID', key: 'id', width: 26 },
        { header: 'Club Name', key: 'name', width: 26 },
        { header: 'Slug', key: 'slug', width: 20 },
        { header: 'Focus', key: 'focus', width: 24 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.club.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'games') {
      columns = [
        { header: 'Game ID', key: 'id', width: 26 },
        { header: 'Game Name', key: 'name', width: 28 },
        { header: 'Template', key: 'template', width: 20 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Max Players', key: 'maxPlayers', width: 14 },
        { header: 'Teams Enabled', key: 'teamsEnabled', width: 14 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.game.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'events') {
      columns = [
        { header: 'Event ID', key: 'id', width: 26 },
        { header: 'Event Name', key: 'name', width: 28 },
        { header: 'Mode', key: 'mode', width: 18 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.event.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'reports') {
      columns = [
        { header: 'Report ID', key: 'id', width: 26 },
        { header: 'Target Type', key: 'targetType', width: 16 },
        { header: 'Reason', key: 'reason', width: 28 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Reporter ID', key: 'reporterId', width: 26 },
        { header: 'Reported User ID', key: 'reportedUserId', width: 26 },
        { header: 'Internal Notes', key: 'internalNotes', width: 30 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else if (target === 'audit_logs') {
      columns = [
        { header: 'Log ID', key: 'id', width: 26 },
        { header: 'Admin Username', key: 'adminUsername', width: 20 },
        { header: 'Action', key: 'action', width: 24 },
        { header: 'Target Type', key: 'targetType', width: 18 },
        { header: 'Target ID', key: 'targetId', width: 26 },
        { header: 'Details', key: 'details', width: 36 },
        { header: 'Timestamp', key: 'createdAt', width: 22 },
      ];
      rows = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' } });
    } else {
      res.status(400).json({ error: `Unsupported export target '${target}'` });
      return;
    }

    const excelBuffer = await generateExcelBuffer(sheetName, columns, rows);

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'EXPORT_EXCEL',
      targetType: target.toUpperCase(),
      details: { count: rows.length },
    });

    const filename = `terminal_${target}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err: any) {
    res.status(500).json({ error: 'Excel export failed', details: err.message });
  }
});


// ── 11. COMPREHENSIVE STUDENT EXCEL EXPORT (MULTI-SHEET) ──
// POST /api/admin/export/students-full
// Generates a professional 6-sheet XLSX workbook with real data from the database
router.post('/export/students-full', async (req: AuthRequest, res: Response): Promise<void> => {
  const adminActor = await getAdminActor(req);
  const {
    branch, section, clubSlug, teamId, accountStatus,
    minScore, maxScore, search, sheets: requestedSheets,
    exportedAt,
  } = req.body || {};

  try {
    // ─── Base where clause for student filter ───
    const userWhere: any = { role: 'PLAYER' };
    const andConditions: any[] = [{ role: 'PLAYER' }];

    if (accountStatus) andConditions.push({ accountStatus });
    if (branch) andConditions.push({ branch: { contains: branch, mode: 'insensitive' } });
    if (section) andConditions.push({ section: { contains: section, mode: 'insensitive' } });
    if (search?.trim()) {
      andConditions.push({
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { username: { contains: search.trim(), mode: 'insensitive' } },
          { usn: { contains: search.trim(), mode: 'insensitive' } },
          { email: { contains: search.trim(), mode: 'insensitive' } },
        ],
      });
    }

    const where = andConditions.length > 1 ? { AND: andConditions } : { role: 'PLAYER' as const };

    // ─── Fetch all students ───
    const students = await prisma.user.findMany({
      where,
      select: {
        id: true, username: true, name: true, email: true, usn: true,
        branch: true, section: true, role: true, accountStatus: true,
        approvalStatus: true, isVerified: true, lastLogin: true,
        lastActivity: true, createdAt: true,
        ClubMember: { include: { club: { select: { name: true, slug: true } } } },
        teamMemberships: {
          include: { team: { select: { id: true, name: true } } },
          orderBy: { joinedAt: 'desc' },
          take: 1,
        },
        sessionPlayers: {
          include: {
            session: {
              include: {
                event: { select: { name: true } },
                currentGame: { select: { id: true, name: true, template: true } },
              },
            },
            team: { select: { name: true } },
          },
          orderBy: { joinedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ─── Aggregate scores per student from submissions ───
    const submissionAgg: Array<{ userId: string; totalScore: number; attempted: number; solved: number }> = await prisma.$queryRaw`
      SELECT sp."userId" as "userId",
             COALESCE(SUM(sub.score), 0)::int as "totalScore",
             COUNT(sub.id)::int as "attempted",
             COUNT(CASE WHEN sub."isCorrect" THEN 1 END)::int as "solved"
      FROM session_players sp
      LEFT JOIN submissions sub ON sub."playerId" = sp.id
      INNER JOIN users u ON u.id = sp."userId" AND u.role = 'PLAYER'
      GROUP BY sp."userId"
      ORDER BY "totalScore" DESC
    `;

    const scoreMap = new Map(submissionAgg.map(r => [r.userId, r]));
    const rankMap = new Map(submissionAgg.map((r, i) => [r.userId, i + 1]));

    // Apply minScore / maxScore filter
    const filteredStudents = students.filter(s => {
      const score = scoreMap.get(s.id)?.totalScore || 0;
      if (minScore !== undefined && score < Number(minScore)) return false;
      if (maxScore !== undefined && score > Number(maxScore)) return false;
      // Club filter
      if (clubSlug && !s.ClubMember.some(cm => cm.club.slug === clubSlug)) return false;
      return true;
    });

    const exportTimestamp = new Date();
    const filterDesc = [
      branch && `branch=${branch}`,
      section && `section=${section}`,
      clubSlug && `club=${clubSlug}`,
      accountStatus && `status=${accountStatus}`,
      minScore !== undefined && `minScore=${minScore}`,
      maxScore !== undefined && `maxScore=${maxScore}`,
      search && `search=${search}`,
    ].filter(Boolean).join(', ') || 'ALL STUDENTS';

    const workbookSheets: Array<{ name: string; columns: ExcelColumn[]; rows: Record<string, any>[] }> = [];

    // ─── SHEET 1: STUDENTS ───
    const sheet1Rows = filteredStudents.map(s => {
      const agg = scoreMap.get(s.id);
      const rank = rankMap.get(s.id);
      const clubs = s.ClubMember.map(cm => cm.club.name).join(', ');
      const currentTeam = s.teamMemberships[0];
      const teamRole = s.teamMemberships[0]?.role || null;
      return {
        id: s.id,
        name: s.name || s.username,
        username: s.username,
        handle: `${s.username}@terminal`,
        usn: s.usn || '',
        email: s.email,
        branch: s.branch || '',
        section: s.section || '',
        role: s.role,
        club: clubs || '',
        currentTeam: currentTeam?.team.name || '',
        teamRole: teamRole || '',
        accountStatus: s.accountStatus,
        onlineStatus: s.lastActivity && (Date.now() - new Date(s.lastActivity).getTime() < 5 * 60 * 1000) ? 'ONLINE' : 'OFFLINE',
        totalScore: agg?.totalScore || 0,
        rank: rank || 0,
        gamesPlayed: [...new Set(s.sessionPlayers.map(sp => sp.sessionId))].length,
        gamesCompleted: s.sessionPlayers.filter(sp =>
          sp.session.status === 'ENDED' || sp.session.status === 'RESULTS'
        ).length,
        challengesAttempted: agg?.attempted || 0,
        challengesSolved: agg?.solved || 0,
        successRate: (agg?.attempted || 0) > 0
          ? Math.round(((agg?.solved || 0) / (agg?.attempted || 1)) * 100)
          : 0,
        lastActive: s.lastActivity ? s.lastActivity.toISOString() : '',
        registeredAt: s.createdAt.toISOString(),
      };
    });

    workbookSheets.push({
      name: 'STUDENTS',
      columns: [
        { header: 'Student ID', key: 'id', width: 28 },
        { header: 'Full Name', key: 'name', width: 22 },
        { header: 'Username', key: 'username', width: 16 },
        { header: 'TERMINAL Handle', key: 'handle', width: 22 },
        { header: 'USN', key: 'usn', width: 16 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Branch', key: 'branch', width: 12 },
        { header: 'Section', key: 'section', width: 10 },
        { header: 'Role', key: 'role', width: 12 },
        { header: 'Club', key: 'club', width: 18 },
        { header: 'Current Team', key: 'currentTeam', width: 20 },
        { header: 'Team Role', key: 'teamRole', width: 12 },
        { header: 'Account Status', key: 'accountStatus', width: 16 },
        { header: 'Online Status', key: 'onlineStatus', width: 14 },
        { header: 'Total Points', key: 'totalScore', width: 14, type: 'number' },
        { header: 'Rank', key: 'rank', width: 10, type: 'number' },
        { header: 'Games Played', key: 'gamesPlayed', width: 14, type: 'number' },
        { header: 'Games Completed', key: 'gamesCompleted', width: 18, type: 'number' },
        { header: 'Challenges Attempted', key: 'challengesAttempted', width: 22, type: 'number' },
        { header: 'Challenges Solved', key: 'challengesSolved', width: 18, type: 'number' },
        { header: 'Success Rate (%)', key: 'successRate', width: 16, type: 'percent' },
        { header: 'Last Active', key: 'lastActive', width: 22, type: 'date' },
        { header: 'Registered At', key: 'registeredAt', width: 22, type: 'date' },
      ],
      rows: sheet1Rows,
    });

    // ─── SHEET 2: GAME PERFORMANCE ───
    const gamePerformanceRows: Record<string, any>[] = [];
    for (const s of filteredStudents) {
      const agg = scoreMap.get(s.id);
      for (const sp of s.sessionPlayers) {
        const clubs = s.ClubMember.map(cm => cm.club.name).join(', ');
        gamePerformanceRows.push({
          studentName: s.name || s.username,
          username: s.username,
          handle: `${s.username}@terminal`,
          usn: s.usn || '',
          club: clubs || '',
          game: sp.session.currentGame?.name || '',
          gameTemplate: sp.session.currentGame?.template || '',
          sessionCode: sp.session.roomCode,
          team: sp.team?.name || '',
          eventName: sp.session.event?.name || '',
          joinedAt: sp.joinedAt.toISOString(),
          sessionStatus: sp.session.status,
        });
      }
    }

    workbookSheets.push({
      name: 'GAME PERFORMANCE',
      columns: [
        { header: 'Student Name', key: 'studentName', width: 22 },
        { header: 'Username', key: 'username', width: 16 },
        { header: 'TERMINAL Handle', key: 'handle', width: 22 },
        { header: 'USN', key: 'usn', width: 16 },
        { header: 'Club', key: 'club', width: 18 },
        { header: 'Game', key: 'game', width: 24 },
        { header: 'Template', key: 'gameTemplate', width: 16 },
        { header: 'Session Code', key: 'sessionCode', width: 14 },
        { header: 'Team', key: 'team', width: 20 },
        { header: 'Event', key: 'eventName', width: 22 },
        { header: 'Joined At', key: 'joinedAt', width: 22, type: 'date' },
        { header: 'Session Status', key: 'sessionStatus', width: 18 },
      ],
      rows: gamePerformanceRows,
    });

    // ─── SHEET 3: GAME SUMMARY ───
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        roomCode: true,
        status: true,
        startedAt: true,
        endedAt: true,
        event: { select: { name: true } },
        currentGame: { select: { id: true, name: true, template: true } },
        players: { select: { id: true, userId: true, status: true } },
        submissions: { select: { score: true, isCorrect: true } },
      },
      where: { status: { in: ['ENDED', 'RESULTS', 'ROUND_ACTIVE'] } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    // Fetch game club names separately
    const gameIds = [...new Set(sessions.map(s => s.currentGame?.id).filter(Boolean))] as string[];
    const gameClubs = await prisma.game.findMany({
      where: { id: { in: gameIds } },
      select: { id: true, club: { select: { name: true } } },
    });
    const gameClubMap = new Map(gameClubs.map(g => [g.id, g.club?.name || '']));

    const gameSummaryRows = sessions.map(sess => {
      const subs = sess.submissions as Array<{ score: number | null; isCorrect: boolean }>;
      const plrs = sess.players as Array<{ id: string; userId: string; status: string }>;
      const totalScore = subs.reduce((s, sub) => s + (sub.score || 0), 0);
      const playerCount = plrs.length;
      const completedPlayers = plrs.filter(p => p.status === 'ACTIVE').length;
      const avgScore = playerCount > 0 ? Math.round(totalScore / playerCount) : 0;
      const maxSc = subs.length > 0 ? Math.max(...subs.map(s => s.score || 0)) : 0;
      const solved = subs.filter(s => s.isCorrect).length;
      const gameId = sess.currentGame?.id || '';
      return {
        game: sess.currentGame?.name || '',
        template: sess.currentGame?.template || '',
        club: gameClubMap.get(gameId) || '',
        sessionCode: sess.roomCode,
        eventName: sess.event?.name || '',
        status: sess.status,
        uniquePlayers: playerCount,
        totalSubmissions: subs.length,
        solved,
        avgScore,
        highestScore: maxSc,
        completionRate: playerCount > 0 ? Math.round((completedPlayers / playerCount) * 100) : 0,
      };
    });

    workbookSheets.push({
      name: 'GAME SUMMARY',
      columns: [
        { header: 'Game', key: 'game', width: 26 },
        { header: 'Template', key: 'template', width: 18 },
        { header: 'Club', key: 'club', width: 18 },
        { header: 'Session Code', key: 'sessionCode', width: 14 },
        { header: 'Event', key: 'eventName', width: 22 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Players', key: 'uniquePlayers', width: 12, type: 'number' },
        { header: 'Submissions', key: 'totalSubmissions', width: 14, type: 'number' },
        { header: 'Solved', key: 'solved', width: 12, type: 'number' },
        { header: 'Avg Score', key: 'avgScore', width: 12, type: 'number' },
        { header: 'Highest Score', key: 'highestScore', width: 14, type: 'number' },
        { header: 'Completion (%)', key: 'completionRate', width: 16, type: 'percent' },
      ],
      rows: gameSummaryRows,
    });

    // ─── SHEET 4: TEAMS ───
    const teams = await prisma.team.findMany({
      include: {
        members: {
          include: { user: { select: { username: true, name: true } } },
        },
        creator: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const teamRows = teams.map(t => ({
      name: t.name,
      leader: `${t.creator.username}@terminal`,
      memberCount: t.members.length,
      memberHandles: t.members.map(m => `${m.user.username}@terminal`).join(', '),
      createdAt: t.createdAt.toISOString(),
    }));

    workbookSheets.push({
      name: 'TEAMS',
      columns: [
        { header: 'Team Name', key: 'name', width: 24 },
        { header: 'Leader', key: 'leader', width: 22 },
        { header: 'Member Count', key: 'memberCount', width: 14, type: 'number' },
        { header: 'Member Handles', key: 'memberHandles', width: 50 },
        { header: 'Created At', key: 'createdAt', width: 22, type: 'date' },
      ],
      rows: teamRows,
    });

    // ─── SHEET 5: CLUBS ───
    const clubs = await prisma.club.findMany({
      include: {
        members: {
          include: { user: { select: { username: true, role: true } } },
        },
      },
    });

    const clubRows: Record<string, any>[] = [];
    for (const club of clubs) {
      for (const m of club.members) {
        clubRows.push({
          club: club.name,
          slug: club.slug,
          memberHandle: `${m.user.username}@terminal`,
          memberRole: m.role,
          joinedAt: m.joinedAt.toISOString(),
        });
      }
    }

    workbookSheets.push({
      name: 'CLUBS',
      columns: [
        { header: 'Club Name', key: 'club', width: 22 },
        { header: 'Club Slug', key: 'slug', width: 18 },
        { header: 'Member Handle', key: 'memberHandle', width: 24 },
        { header: 'Club Role', key: 'memberRole', width: 14 },
        { header: 'Joined At', key: 'joinedAt', width: 22, type: 'date' },
      ],
      rows: clubRows,
    });

    // ─── SHEET 6: PARTICIPATION ───
    const participationRows: Record<string, any>[] = [];
    for (const s of filteredStudents) {
      for (const sp of s.sessionPlayers) {
        participationRows.push({
          studentName: s.name || s.username,
          handle: `${s.username}@terminal`,
          usn: s.usn || '',
          game: sp.session.currentGame?.name || '',
          sessionCode: sp.session.roomCode,
          event: sp.session.event?.name || '',
          joinedAt: sp.joinedAt.toISOString(),
          sessionStatus: sp.session.status,
          result: ['ENDED', 'FINAL_RESULTS'].includes(sp.session.status) ? 'COMPLETED' : sp.session.status === 'LOBBY' ? 'PENDING' : 'IN_PROGRESS',
        });
      }
    }

    workbookSheets.push({
      name: 'PARTICIPATION',
      columns: [
        { header: 'Student Name', key: 'studentName', width: 22 },
        { header: 'TERMINAL Handle', key: 'handle', width: 22 },
        { header: 'USN', key: 'usn', width: 16 },
        { header: 'Game', key: 'game', width: 24 },
        { header: 'Session Code', key: 'sessionCode', width: 14 },
        { header: 'Event', key: 'event', width: 22 },
        { header: 'Joined At', key: 'joinedAt', width: 22, type: 'date' },
        { header: 'Session Status', key: 'sessionStatus', width: 18 },
        { header: 'Result', key: 'result', width: 14 },
      ],
      rows: participationRows,
    });



    const xlsxBuffer = await generateMultiSheetExcelBuffer(
      workbookSheets,
      {
        title: 'TERMINAL Student Export',
        appliedFilters: filterDesc,
        exportedAt: exportTimestamp,
      }
    );

    await createAuditLog({
      adminId: adminActor.adminId,
      adminUsername: adminActor.adminUsername,
      action: 'EXPORT_STUDENT_FULL_XLSX',
      targetType: 'STUDENTS',
      details: {
        studentCount: filteredStudents.length,
        sheets: workbookSheets.map(s => s.name),
        filters: filterDesc,
      },
    });

    const filename = `TERMINAL_Students_${exportTimestamp.toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Count', String(filteredStudents.length));
    res.setHeader('X-Export-Filters', filterDesc);
    res.send(xlsxBuffer);
  } catch (err: any) {
    console.error('[EXPORT ERROR]', err);
    res.status(500).json({ error: 'Student XLSX export failed', details: err.message });
  }
});

// Legacy backward-compatibility route for GM status updates:
// PATCH /api/admin/gamemasters/:id/status
router.patch(['/gamemasters/:id/status', '/game-masters/:id/status'], async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { status } = req.body;
  const adminActor = await getAdminActor(req);

  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    res.status(400).json({ error: "Invalid status. Must be 'PENDING', 'APPROVED', or 'REJECTED'." });
    return;
  }

  const gm = await prisma.user.findFirst({
    where: { id, role: 'GAME_MASTER' },
  });

  if (!gm) {
    res.status(404).json({ error: 'Game Master not found' });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { approvalStatus: status },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      role: true,
      approvalStatus: true,
      accountStatus: true,
      updatedAt: true,
    },
  });

  await createAuditLog({
    adminId: adminActor.adminId,
    adminUsername: adminActor.adminUsername,
    action: `GM_${status}`,
    targetType: 'GAME_MASTER',
    targetId: id,
    details: { approvalStatus: status },
  });

  res.json({
    success: true,
    message: `Game Master ${status.toLowerCase()} successfully`,
    user: updated,
  });
});

export default router;
