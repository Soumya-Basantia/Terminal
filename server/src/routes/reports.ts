import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

const CreateReportSchema = z.object({
  reportedUserId: z.string().optional(),
  targetType: z.string().min(1, 'Target type is required'),
  targetId: z.string().optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
  details: z.string().optional(),
});

// POST /api/reports — File a report
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = CreateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid report data', details: parsed.error.flatten() });
    return;
  }

  try {
    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId: parsed.data.reportedUserId || null,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId || null,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      message: 'Report submitted successfully. Administrators will review it.',
      report,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit report', details: err.message });
  }
});

// GET /api/reports/my — Get reports filed by current user
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const reports = await prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reports });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reports', details: err.message });
  }
});

export default router;
