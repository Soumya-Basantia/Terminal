import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const CreateGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  template: z.enum(['QUIZ', 'RAPID_FIRE', 'CHAIN_REACTION', 'DATA_HUNT', 'LOGIC_HEIST', 'BUG_HUNT', 'THE_WITNESS', 'ROGUE_SCANNER', 'SILENT_MISSION', 'SIGNAL_ROUTER', 'THE_THRESHOLD']).default('QUIZ'),
  clubId: z.string().optional(),
  teamsEnabled: z.boolean().default(false),
  maxPlayers: z.number().int().min(2).max(1000).default(200),
  maxTeamSize: z.number().int().min(2).max(20).default(5),
  allowLateJoin: z.boolean().default(true),
  leaderboardVisibility: z.enum(['HIDDEN', 'LIVE', 'FINAL']).default('LIVE'),
  allowAnswerChange: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
  speedBonus: z.boolean().default(false),
  config: z.any().optional(),
});

const UpdateGameSchema = CreateGameSchema.partial();

const ChallengeSchema = z.object({
  type: z.enum(['CHOICE', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILTER', 'MULTI_FILTER', 'SORT', 'LIMIT', 'FIELD_IDENTIFICATION', 'RECORD_IDENTIFICATION', 'VARIABLE_SIMULATION', 'LOOP_SIMULATION', 'BLOCK_CONSTRUCTION', 'DECISION', 'RESOURCE_SELECTION', 'TOOL_SELECTION', 'PREDICTION', 'CONSEQUENCE', 'CODE_REVEAL', 'NARRATIVE_CLUE', 'INTERROGATION', 'TELEMETRY_ANOMALY', 'MISSION_PLAN', 'NETWORK_ROUTING', 'THRESHOLD_CALIBRATION']).default('CHOICE'),
  prompt: z.string().min(1).default(''),
  options: z.array(z.string()).optional(),
  answer: z.union([z.string(), z.array(z.string())]).optional(),
  points: z.number().int().min(1).default(100),
  timerSecs: z.number().int().min(5).max(300).default(30),
  difficulty: z.string().optional(),
  clue: z.string().optional(),
  action: z.string().optional(),
  field: z.string().optional(),
  correct: z.string().optional(),
  onSuccess: z.string().optional(),
});

import { checkGameAuthorization, checkClubAuthorization } from '../utils/authorization';

// Helper to verify access
async function verifyGameAccess(gameId: string, userId: string, res: Response, includeChallenges: boolean = false) {
  const game = await prisma.game.findUnique({ 
    where: { id: gameId }, 
    include: includeChallenges ? { challenges: { orderBy: { position: 'asc' } }, _count: { select: { challenges: true } } } : { _count: { select: { challenges: true } } } 
  });
  
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return null;
  }
  
  const isAuthorized = await checkGameAuthorization(gameId, userId);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden: Club Admin or Designer access required' });
    return null;
  }
  
  return game;
}

// GET /api/games — list designer's games
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { clubId } = req.query;
  
  let whereClause: any = {};
  
  if (clubId) {
    const isAuthorized = await checkClubAuthorization(String(clubId), req.userId!);
    if (!isAuthorized) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    whereClause.clubId = String(clubId);
  } else {
    // If no clubId provided, return games where user is designer OR user is admin of the club
    const memberships = await prisma.clubMember.findMany({
      where: { userId: req.userId!, role: 'ADMIN' },
    });
    const clubIds = memberships.map(m => m.clubId);
    
    whereClause = {
      OR: [
        { designerId: req.userId! },
        { clubId: { in: clubIds } }
      ]
    };
  }

  const games = await prisma.game.findMany({
    where: whereClause,
    include: {
      _count: { select: { challenges: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ games });
});

// POST /api/games — create a game
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = CreateGameSchema.safeParse(req.body);
  const clubId = req.body.clubId;

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (user.role === 'GAME_MASTER') {
    if (user.approvalStatus === 'PENDING') {
      res.status(403).json({ error: 'Account pending administrator approval', approvalStatus: 'PENDING' });
      return;
    }
    if (user.approvalStatus === 'REJECTED') {
      res.status(403).json({ error: 'Account has been rejected by administrator', approvalStatus: 'REJECTED' });
      return;
    }
  }

  // Allow if SUPER_ADMIN, ADMIN, or APPROVED GAME_MASTER
  let canCreate = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || (user.role === 'GAME_MASTER' && user.approvalStatus === 'APPROVED');
  
  if (!canCreate) {
    // Check if they are a Club Admin anywhere
    const adminMembership = await prisma.clubMember.findFirst({
      where: { userId: user.id, role: 'ADMIN' }
    });
    if (adminMembership) {
      canCreate = true;
    }
  }

  if (!canCreate) {
    res.status(403).json({ error: 'Forbidden: Students cannot create games' });
    return;
  }

  if (clubId) {
    const isAuthorized = await checkClubAuthorization(clubId, req.userId!);
    if (!isAuthorized) {
      res.status(403).json({ error: 'Forbidden: Cannot create game for this club' });
      return;
    }
  }

  const game = await prisma.game.create({
    data: {
      ...parsed.data,
      designerId: req.userId!,
      clubId: clubId || null
    },
  });
  res.status(201).json({ game });
});

// GET /api/games/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const game = await verifyGameAccess(req.params.id as string, req.userId!, res, true);
  if (!game) return;
  
  const mappedGame = {
    ...game,
    challenges: game.challenges.map(c => {
      const config = (c.config as any) || {};
      return {
        ...c,
        timerSecs: c.timeLimit,
        options: config.options,
        answer: config.answer,
        difficulty: config.difficulty,
        clue: config.clue,
        action: config.action,
        field: config.field,
        correct: config.correct,
        onSuccess: config.onSuccess,
      };
    })
  };
  
  res.json({ game: mappedGame });
});

// PATCH /api/games/:id
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = UpdateGameSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const existing = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!existing) return;

  const game = await prisma.game.update({
    where: { id: req.params.id as string },
    data: parsed.data,
    include: { challenges: { orderBy: { position: 'asc' } } },
  });
  res.json({ game });
});

// DELETE /api/games/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!existing) return;

  await prisma.game.delete({ where: { id: req.params.id as string } });
  res.json({ success: true });
});

// POST /api/games/:id/publish
router.post('/:id/publish', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const game = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!game) return;

  if (game._count.challenges < 1) {
    res.status(400).json({ error: 'Add at least one challenge before publishing' });
    return;
  }

  const updated = await prisma.game.update({
    where: { id: req.params.id as string },
    data: { status: 'PUBLISHED' },
  });
  res.json({ game: updated });
});

// ─── CHALLENGE ROUTES ────────────────────────────────────

// POST /api/games/:id/challenges
router.post('/:id/challenges', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const game = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!game) return;

  const parsed = ChallengeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const existingCount = await prisma.challenge.count({ where: { gameId: req.params.id as string } });

  const challenge = await prisma.challenge.create({
    data: {
      gameId: req.params.id as string,
      position: existingCount,
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      points: parsed.data.points,
      timeLimit: parsed.data.timerSecs,
      config: {
        options: parsed.data.options,
        answer: parsed.data.answer,
        difficulty: parsed.data.difficulty,
        clue: parsed.data.clue,
        action: parsed.data.action,
        field: parsed.data.field,
        correct: parsed.data.correct,
        onSuccess: parsed.data.onSuccess,
        ...(req.body.config || {}),
        ...(req.body.initialState ? { initialState: req.body.initialState } : {}),
        ...(req.body.targetState ? { targetState: req.body.targetState } : {}),
        ...(req.body.blocks ? { blocks: req.body.blocks } : {}),
        ...(req.body.correctSequence ? { correctSequence: req.body.correctSequence } : {}),
        ...(req.body.narrative ? { narrative: req.body.narrative } : {}),
        ...(req.body.hintText ? { hintText: req.body.hintText } : {}),
        ...(req.body.revealText ? { revealText: req.body.revealText } : {}),
      }
    },
  });

  const config = (challenge.config as any) || {};
  res.status(201).json({ 
    challenge: {
      ...challenge,
      timerSecs: challenge.timeLimit,
      options: config.options,
      answer: config.answer,
      difficulty: config.difficulty,
      clue: config.clue,
      action: config.action,
      field: config.field,
      correct: config.correct,
      onSuccess: config.onSuccess,
    } 
  });
});

// PATCH /api/games/:id/challenges/:challengeId
router.patch('/:id/challenges/:challengeId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const game = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!game) return;

  const parsed = ChallengeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const challenge = await prisma.challenge.update({
    where: { id: req.params.challengeId as string },
    data: {
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      points: parsed.data.points,
      timeLimit: parsed.data.timerSecs,
      config: {
        options: parsed.data.options,
        answer: parsed.data.answer,
        difficulty: parsed.data.difficulty,
        clue: parsed.data.clue,
        action: parsed.data.action,
        field: parsed.data.field,
        correct: parsed.data.correct,
        onSuccess: parsed.data.onSuccess,
        ...(req.body.config || {}),
        ...(req.body.initialState ? { initialState: req.body.initialState } : {}),
        ...(req.body.targetState ? { targetState: req.body.targetState } : {}),
        ...(req.body.blocks ? { blocks: req.body.blocks } : {}),
        ...(req.body.correctSequence ? { correctSequence: req.body.correctSequence } : {}),
        ...(req.body.narrative ? { narrative: req.body.narrative } : {}),
        ...(req.body.hintText ? { hintText: req.body.hintText } : {}),
        ...(req.body.revealText ? { revealText: req.body.revealText } : {}),
      }
    },
  });

  const config = (challenge.config as any) || {};
  res.json({ 
    challenge: {
      ...challenge,
      timerSecs: challenge.timeLimit,
      options: config.options,
      answer: config.answer,
      difficulty: config.difficulty,
      clue: config.clue,
      action: config.action,
      field: config.field,
      correct: config.correct,
      onSuccess: config.onSuccess,
    } 
  });
});

// DELETE /api/games/:id/challenges/:challengeId
router.delete('/:id/challenges/:challengeId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const game = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!game) return;

  await prisma.challenge.delete({ where: { id: req.params.challengeId as string } });
  res.json({ success: true });
});

// POST /api/games/:id/challenges/reorder
router.post('/:id/challenges/reorder', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const game = await verifyGameAccess(req.params.id as string, req.userId!, res);
  if (!game) return;

  const { orderedIds } = req.body as { orderedIds: string[] };
  if (!Array.isArray(orderedIds)) {
    res.status(400).json({ error: 'orderedIds must be an array' });
    return;
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.challenge.update({ where: { id }, data: { position: index } })
    )
  );

  const challenges = await prisma.challenge.findMany({
    where: { gameId: req.params.id as string },
    orderBy: { position: 'asc' },
  });

  res.json({ challenges });
});

export default router;
