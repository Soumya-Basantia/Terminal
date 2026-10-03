import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workspace/student
// Authenticated student's own protected workspace
// ─────────────────────────────────────────────────────────────────────────────
router.get('/student', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: Missing session token' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      usn: true,
      email: true,
      branch: true,
      section: true,
      role: true,
      approvalStatus: true,
      accountStatus: true,
      isVerified: true,
      createdAt: true
    }
  });

  if (!user) {
    res.status(404).json({ error: 'Student record not found' });
    return;
  }

  // Derive real score, solved challenges, and participation strictly from DB
  const submissions = await prisma.submission.findMany({
    where: { player: { userId } },
    select: {
      id: true,
      sessionId: true,
      challengeId: true,
      score: true,
      isCorrect: true,
      submittedAt: true
    },
    orderBy: { submittedAt: 'desc' }
  });

  const totalScore = submissions.reduce((sum, s) => sum + (s.score || 0), 0);
  const solvedCount = submissions.filter(s => s.isCorrect).length;
  const attemptedCount = submissions.length;
  const participatedSessionIds = Array.from(new Set(submissions.map(s => s.sessionId)));

  // Query enrolled sessions for this student
  const sessionEnrollments = await prisma.sessionPlayer.findMany({
    where: { userId },
    include: {
      session: {
        include: {
          event: { select: { name: true } },
          currentGame: { select: { name: true, template: true } }
        }
      }
    },
    orderBy: { joinedAt: 'desc' },
    take: 10
  });

  // Query published games available
  const availableGames = await prisma.game.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      template: true,
      description: true,
      _count: { select: { challenges: true } }
    },
    take: 10
  });

  // Query published events available
  const availableEvents = await prisma.event.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      name: true,
      description: true,
      mode: true,
      createdAt: true
    },
    take: 10
  });

  // Query direct messages for student
  const studentMessages = await prisma.message.findMany({
    where: { recipientId: userId },
    include: {
      sender: { select: { id: true, name: true, username: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({
    student: {
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      usn: user.usn || 'N/A',
      email: user.email,
      branch: user.branch || 'GENERAL',
      section: user.section || 'A',
      role: user.role,
      approvalStatus: user.approvalStatus,
      accountStatus: user.accountStatus,
      isVerified: user.isVerified
    },
    progress: {
      totalScore,
      solvedCount,
      attemptedCount,
      gamesPlayed: Math.max(participatedSessionIds.length, sessionEnrollments.length)
    },
    messages: studentMessages.map(m => ({
      id: m.id,
      sender: m.sender.name || m.sender.username,
      senderRole: m.sender.role,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt
    })),
    unreadMessageCount: studentMessages.filter(m => !m.isRead).length,
    sessions: sessionEnrollments.map(se => ({
      roomCode: se.session.roomCode,
      status: se.session.status,
      eventName: se.session.event?.name || 'Platform Event',
      gameName: se.session.currentGame?.name || 'Challenge',
      joinedAt: se.joinedAt
    })),
    games: availableGames.map(g => ({
      id: g.id,
      name: g.name,
      template: g.template,
      description: g.description || 'Interactive campus game module',
      challengeCount: g._count?.challenges || 0
    })),
    events: availableEvents.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description || 'Active campus tournament event',
      mode: e.mode,
      createdAt: e.createdAt
    }))
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workspace/gm
// Authenticated Game Master's own protected workspace
// ─────────────────────────────────────────────────────────────────────────────
router.get('/gm', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: Missing session token' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phoneNumber: true,
      role: true,
      approvalStatus: true,
      accountStatus: true,
      isVerified: true
    }
  });

  if (!user) {
    res.status(404).json({ error: 'User record not found' });
    return;
  }

  // Enforce server-side role check
  if (user.role === 'PLAYER') {
    res.status(403).json({ error: 'Access denied: Game Master workspace required' });
    return;
  }

  // Pending Game Master: return limited profile view with pending notice
  if (user.role === 'GAME_MASTER' && user.approvalStatus === 'PENDING') {
    res.json({
      gm: {
        id: user.id,
        name: user.name || user.username,
        email: user.email,
        phone: user.phoneNumber || 'Not provided',
        approvalStatus: 'PENDING',
        role: user.role
      },
      notice: 'Your Game Master account is pending administrator approval. Workspace management features will activate once approved.',
      events: [],
      games: [],
      sessions: []
    });
    return;
  }

  if (user.role === 'GAME_MASTER' && user.approvalStatus === 'REJECTED') {
    res.status(403).json({
      error: 'Account has been rejected by administrator',
      approvalStatus: 'REJECTED'
    });
    return;
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  // Strictly isolate events, games, and sessions to the authenticated GM
  const eventsWhere = isAdmin ? {} : { creatorId: userId };
  const gamesWhere = isAdmin ? {} : { designerId: userId };
  const sessionsWhere = isAdmin ? {} : { event: { creatorId: userId } };

  const [events, games, sessions] = await Promise.all([
    prisma.event.findMany({
      where: eventsWhere,
      include: {
        _count: { select: { games: true, sessions: true } },
        games: {
          include: { game: { select: { name: true, template: true } } },
          orderBy: { position: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.game.findMany({
      where: gamesWhere,
      include: {
        _count: { select: { challenges: true, currentSessions: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.session.findMany({
      where: sessionsWhere,
      include: {
        event: { select: { id: true, name: true } },
        currentGame: { select: { id: true, name: true, template: true } },
        players: {
          include: {
            user: { select: { id: true, name: true, usn: true, email: true } },
            Submission: { select: { score: true, isCorrect: true } }
          }
        },
        _count: { select: { players: true, submissions: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  // Aggregate participant leaderboards per session
  const sessionsWithLeaderboards = sessions.map(s => {
    const leaderboard = s.players.map(p => {
      const score = p.Submission.reduce((sum, sub) => sum + (sub.score || 0), 0);
      return {
        playerId: p.id,
        userId: p.userId,
        name: p.user?.name || 'Student',
        usn: p.user?.usn || 'N/A',
        email: p.user?.email || '',
        score,
        status: p.status
      };
    }).sort((a, b) => b.score - a.score).map((p, idx) => ({ ...p, rank: idx + 1 }));

    return {
      id: s.id,
      roomCode: s.roomCode,
      status: s.status,
      stageMode: s.stageMode,
      eventId: s.eventId,
      eventName: s.event?.name || 'Unnamed Event',
      gameName: s.currentGame?.name || 'Quiz',
      gameTemplate: s.currentGame?.template || 'QUIZ',
      playerCount: s._count.players,
      submissionCount: s._count.submissions,
      createdAt: s.createdAt,
      leaderboard
    };
  });

  // Query messages for Game Master
  const gmMessages = await prisma.message.findMany({
    where: { recipientId: userId },
    include: {
      sender: { select: { id: true, name: true, username: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({
    gm: {
      id: user.id,
      name: user.name || user.username,
      email: user.email,
      phone: user.phoneNumber || 'Not provided',
      approvalStatus: user.approvalStatus,
      accountStatus: user.accountStatus,
      isVerified: user.isVerified,
      role: user.role
    },
    messages: gmMessages.map(m => ({
      id: m.id,
      sender: m.sender.name || m.sender.username,
      senderRole: m.sender.role,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt
    })),
    unreadMessageCount: gmMessages.filter(m => !m.isRead).length,
    events: events.map(e => ({
      id: e.id,
      name: e.name,
      description: e.description,
      status: e.status,
      mode: e.mode,
      gameCount: e._count.games,
      sessionCount: e._count.sessions,
      games: e.games.map(g => ({ name: g.game.name, template: g.game.template })),
      createdAt: e.createdAt
    })),
    games: games.map(g => ({
      id: g.id,
      name: g.name,
      template: g.template,
      status: g.status,
      challengeCount: g._count.challenges,
      sessionCount: g._count.currentSessions,
      createdAt: g.createdAt
    })),
    sessions: sessionsWithLeaderboards
  });
});

export default router;
