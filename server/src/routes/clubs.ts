import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { PLATFORM_CLUBS } from '../lib/platformClubs';
import { authenticate, AuthRequest, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// GET /api/clubs
// Get clubs for the currently authenticated user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (user.role === 'SUPER_ADMIN') {
      const clubs = await prisma.club.findMany({ orderBy: { name: 'asc' } });
      res.json(clubs);
      return;
    }

    // Return only clubs the user is a member of
    const memberships = await prisma.clubMember.findMany({
      where: { userId: req.userId },
      include: { club: true },
    });

    const clubs = memberships.map((m) => ({
      ...m.club,
      myRole: m.role,
    }));

    res.json(clubs);
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
      res.status(400).json({ error: 'Only the four configured platform clubs are supported' });
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
      },
    });
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create club' });
  }
});

export default router;
