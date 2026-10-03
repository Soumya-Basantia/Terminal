import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

import { checkEventAuthorization, checkClubAuthorization } from '../utils/authorization';

// Helper to verify access
async function verifyEventAccess(eventId: string, userId: string, res: Response) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { games: { include: { game: true }, orderBy: { position: 'asc' } } } });
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return null;
  }
  
  const isAuthorized = await checkEventAuthorization(eventId, userId);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden: Club Admin or Creator access required' });
    return null;
  }
  
  return event;
}

// Create Event
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, mode, clubId } = req.body;
  
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
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
    res.status(403).json({ error: 'Forbidden: Students cannot create events' });
    return;
  }

  if (clubId) {
    const isAuthorized = await checkClubAuthorization(clubId, req.userId!);
    if (!isAuthorized) {
      res.status(403).json({ error: 'Forbidden: Cannot create event for this club' });
      return;
    }
  }

  const event = await prisma.event.create({
    data: {
      name,
      description,
      mode: mode || 'SEQUENCE',
      creatorId: req.userId!,
      clubId: clubId || null
    }
  });
  
  res.status(201).json(event);
});

// List Events
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
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
    // If no clubId provided, return events where user is creator OR user is admin of the club
    const memberships = await prisma.clubMember.findMany({
      where: { userId: req.userId!, role: 'ADMIN' },
    });
    const clubIds = memberships.map(m => m.clubId);
    
    whereClause = {
      OR: [
        { creatorId: req.userId! },
        { clubId: { in: clubIds } }
      ]
    };
  }

  const events = await prisma.event.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' }
  });
  res.json(events);
});

// Get Event
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const event = await verifyEventAccess(req.params.id as string, req.userId!, res);
  if (!event) return;

  res.json(event);
});

// Edit Event
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, description, mode, status } = req.body;
  
  const event = await verifyEventAccess(req.params.id as string, req.userId!, res);
  if (!event) return;

  const updated = await prisma.event.update({
    where: { id: req.params.id as string },
    data: {
      name: name !== undefined ? name : undefined,
      description: description !== undefined ? description : undefined,
      mode: mode !== undefined ? mode : undefined,
      status: status !== undefined ? status : undefined,
    }
  });

  res.json(updated);
});

// Add Game
router.post('/:id/games', async (req: AuthRequest, res: Response): Promise<void> => {
  const { gameId, purpose = 'NORMAL', enabled = true } = req.body;
  if (!gameId) {
    res.status(400).json({ error: 'gameId is required' });
    return;
  }

  const event = await verifyEventAccess(req.params.id as string, req.userId!, res);
  if (!event) return;

  const position = event.games.length;
  
  const eventGame = await prisma.eventGame.create({
    data: {
      eventId: event.id,
      gameId,
      position,
      purpose,
      enabled
    },
    include: { game: true }
  });

  res.status(201).json(eventGame);
});

// Reorder Games
router.put('/:id/games/reorder', async (req: AuthRequest, res: Response): Promise<void> => {
  const { gameIds } = req.body; // array of eventGame ids in new order
  if (!Array.isArray(gameIds)) {
    res.status(400).json({ error: 'gameIds array required' });
    return;
  }

  const event = await verifyEventAccess(req.params.id as string, req.userId!, res);
  if (!event) return;

  // Transaction to update positions
  await prisma.$transaction(
    gameIds.map((id, index) => 
      prisma.eventGame.update({
        where: { id },
        data: { position: index }
      })
    )
  );

  res.json({ success: true });
});

// Remove Game
router.delete('/:id/eventGames/:eventGameId', async (req: AuthRequest, res: Response): Promise<void> => {
  const event = await verifyEventAccess(req.params.id as string, req.userId!, res);
  if (!event) return;

  await prisma.eventGame.delete({
    where: {
      id: req.params.eventGameId as string
    }
  });

  res.json({ success: true });
});

// Update Event Game (Enable/Disable, Purpose)
router.put('/:id/eventGames/:eventGameId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { enabled, purpose } = req.body;
  const event = await verifyEventAccess(req.params.id as string, req.userId!, res);
  if (!event) return;

  const eventGame = await prisma.eventGame.update({
    where: { id: req.params.eventGameId as string },
    data: { enabled, purpose },
    include: { game: true }
  });

  res.json(eventGame);
});

export default router;
