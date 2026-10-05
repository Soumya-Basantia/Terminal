import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PLATFORM_CLUBS } from '../lib/platformClubs';
import { authenticate, AuthRequest, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// GET /api/clubs
// Get active clubs for the currently authenticated user (CODENEX ONLY)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // TERMINAL product freeze: Active clubs = CODENEX ONLY
    const activeClubs = await prisma.club.findMany({
      where: { status: 'ACTIVE', slug: 'codenex' },
      orderBy: { name: 'asc' }
    });

    if (activeClubs.length === 0) {
      res.json([]);
      return;
    }

    const codenex = activeClubs[0];

    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      res.json([{ ...codenex, myRole: 'ADMIN' }]);
      return;
    }

    // Check membership
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: codenex.id, userId: req.userId! } }
    });

    res.json([{
      ...codenex,
      myRole: membership?.role || (user.role === 'GAME_MASTER' ? 'ADMIN' : 'MEMBER')
    }]);
  } catch (error) {
    console.error('[GET /api/clubs]', error);
    res.status(500).json({ error: 'Failed to fetch clubs' });
  }
});

// GET /api/clubs/:clubId
// Get a specific club
router.get('/:clubId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const clubId = req.params.clubId as string;
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        _count: {
          select: { games: true, events: true, members: true },
        },
      },
    });

    if (!club) {
      res.status(404).json({ error: 'Club not found' });
      return;
    }

    // Only active clubs are accessible to non-superadmins
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (club.status !== 'ACTIVE' && user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Club is archived or inactive' });
      return;
    }

    res.json(club);
  } catch (error) {
    console.error('[GET /api/clubs/:clubId]', error);
    res.status(500).json({ error: 'Failed to fetch club details' });
  }
});

// SUPER_ADMIN routes
router.post('/', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, slug, description, focus } = req.body;
    const allowedClub = PLATFORM_CLUBS.find((club) => club.name === name && club.slug === slug);
    if (!allowedClub) {
      res.status(400).json({ error: 'Only the configured platform club (CODENEX) is supported' });
      return;
    }

    const existingClub = await prisma.club.findUnique({ where: { slug: allowedClub.slug } });
    if (existingClub) {
      res.status(409).json({ error: 'Club already exists' });
      return;
    }

    const club = await prisma.club.create({
      data: {
        name: allowedClub.name,
        slug: allowedClub.slug,
        description,
        focus: focus ?? allowedClub.focus,
        status: 'ACTIVE',
      },
    });
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create club' });
  }
});

export default router;
