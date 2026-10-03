import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/messages — Get messages for current authenticated user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const [received, sent, unreadCount] = await Promise.all([
      prisma.message.findMany({
        where: { recipientId: userId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.message.findMany({
        where: { senderId: userId },
        include: {
          recipient: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.message.count({
        where: { recipientId: userId, isRead: false },
      }),
    ]);

    res.json({
      received,
      sent,
      unreadCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch messages', details: err.message });
  }
});

// PATCH /api/messages/:id/read — Mark message as read
router.patch('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  const id = String(req.params.id);

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (message.recipientId !== userId) {
      res.status(403).json({ error: 'Cannot mark another user\'s message as read' });
      return;
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ success: true, message: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update message', details: err.message });
  }
});

export default router;
