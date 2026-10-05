import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET: string = process.env.JWT_SECRET || (() => {
  throw new Error('[SECURITY] JWT_SECRET environment variable is not set. Refusing to start.');
})();

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { userId: string; email: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function authenticateOptional(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET) as unknown as { userId: string; email: string };
      req.userId = payload.userId;
      req.userEmail = payload.email;
    } catch {
      // ignore
    }
  }
  next();
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET!, { expiresIn: '24h' });
}

export async function requireClubAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.userId;
  const clubId = req.params.clubId || req.body.clubId || req.query.clubId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!clubId) {
    res.status(400).json({ error: 'Club ID is required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, approvalStatus: true }
    });

    if (user?.role === 'GAME_MASTER' && user?.approvalStatus !== 'APPROVED') {
      res.status(403).json({ error: 'Forbidden: Game Master pending approval' });
      return;
    }

    // Administrator can do anything
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
      return next();
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        clubId_userId: {
          clubId: String(clubId),
          userId,
        },
      },
    });

    if (!membership || membership.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden: Club Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('[requireClubAdmin]', error);
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
}

export async function requireGameMaster(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      return next();
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
      return next();
    }

    res.status(403).json({ error: 'Forbidden: Game Master access required' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
}

export async function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
      res.status(403).json({ error: 'Forbidden: Administrator access required' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during authorization' });
  }
}
