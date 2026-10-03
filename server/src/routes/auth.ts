import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest, authenticate, generateToken } from '../middleware/auth';

const router = Router();

// ── RESERVATION HELPER ──
export function isReservedKeyword(str?: string | null): boolean {
  if (!str) return false;
  const cleaned = str.trim().toLowerCase();
  return cleaned === 'root' || cleaned.startsWith('root@') || cleaned.split('@')[0] === 'root';
}

// ── SYSTEM SETTINGS HELPER ──
export async function getSystemSetting(key: string, defaultValue: string = 'true'): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

// ── SCHEMAS ──

const StudentRegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  usn: z.string().min(3, 'USN is required').transform(v => v.trim().toUpperCase()),
  email: z.string().email('Valid email is required'),
  branch: z.string().min(1, 'Branch is required'),
  section: z.string().min(1, 'Section is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(2).optional(),
});

const GameMasterRegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phoneNumber: z.string().min(7, 'Phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(2).optional(),
});

const LegacyRegisterSchema = z.object({
  username: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().optional(),
  login: z.string().optional(),
  usn: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
});

const AdminLoginSchema = z.object({
  login: z.string().min(1, 'Admin login ID is required'),
  password: z.string().min(1, 'Password is required'),
});

// Helper to sanitize usernames
function generateUsername(input: string, fallback: string): string {
  const cleaned = input.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned.length >= 2 ? cleaned : fallback;
}

// ── REGISTRATION (STUDENT & GAME MASTER) ──
// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  // If explicitly registering as GAME_MASTER via role parameter
  if (req.body.role === 'GAME_MASTER') {
    const gmReg = await getSystemSetting('gm_registration_enabled', 'true');
    if (gmReg === 'false') {
      res.status(403).json({ error: 'Game Master registration is currently disabled by administrator.' });
      return;
    }

    const gmParsed = GameMasterRegisterSchema.safeParse(req.body);
    if (!gmParsed.success) {
      res.status(400).json({ error: 'Invalid Game Master input', details: gmParsed.error.flatten() });
      return;
    }
    const { name, email, phoneNumber, password, username } = gmParsed.data;

    // Reject reserved 'root' identifier server-side
    if (isReservedKeyword(name) || isReservedKeyword(email) || isReservedKeyword(username)) {
      res.status(400).json({ error: "The identifier 'root' is reserved for system administration." });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' as const } },
          ...(username ? [{ username: { equals: username, mode: 'insensitive' as const } }] : [])
        ]
      }
    });

    if (existing) {
      res.status(409).json({ error: 'Email or username already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const finalUsername = username || generateUsername(email.split('@')[0], `gm_${Date.now()}`);

    const user = await prisma.user.create({
      data: {
        username: finalUsername,
        email,
        passwordHash: hashed,
        name,
        phoneNumber,
        role: 'GAME_MASTER',
        approvalStatus: 'PENDING',
        profile: {
          create: {
            displayName: name
          }
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        approvalStatus: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: 'Game Master registration submitted. Account is pending Administrator approval.',
      user,
      approvalStatus: 'PENDING'
    });
    return;
  }

  // Check if Student Registration fields are provided
  if (req.body.usn || req.body.branch || req.body.section) {
    const studentReg = await getSystemSetting('student_registration_enabled', 'true');
    if (studentReg === 'false') {
      res.status(403).json({ error: 'Student registration is currently disabled by administrator.' });
      return;
    }

    const studentParsed = StudentRegisterSchema.safeParse(req.body);
    if (!studentParsed.success) {
      res.status(400).json({ error: 'Invalid Student input', details: studentParsed.error.flatten() });
      return;
    }

    const { name, usn, email, branch, section, password, username } = studentParsed.data;

    // Reject reserved 'root' identifier server-side
    if (isReservedKeyword(name) || isReservedKeyword(usn) || isReservedKeyword(email) || isReservedKeyword(username)) {
      res.status(400).json({ error: "The identifier 'root' is reserved for system administration." });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' as const } },
          { usn: { equals: usn, mode: 'insensitive' as const } },
          ...(username ? [{ username: { equals: username, mode: 'insensitive' as const } }] : [])
        ]
      }
    });

    if (existing) {
      const field = existing.usn?.toUpperCase() === usn ? 'USN' : existing.email?.toLowerCase() === email.toLowerCase() ? 'Email' : 'Username';
      res.status(409).json({ error: `${field} already in use` });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const finalUsername = username || generateUsername(usn, `std_${Date.now()}`);

    const user = await prisma.user.create({
      data: {
        username: finalUsername,
        email,
        passwordHash: hashed,
        name,
        usn,
        branch,
        section,
        role: 'PLAYER',
        approvalStatus: 'APPROVED',
        profile: {
          create: {
            displayName: name
          }
        }
      },
      select: {
        id: true,
        username: true,
        name: true,
        usn: true,
        email: true,
        branch: true,
        section: true,
        role: true,
        approvalStatus: true,
        createdAt: true
      }
    });

    const token = generateToken(user.id, user.email);
    res.status(201).json({ user, token });
    return;
  }

  // Legacy fallback registration
  const parsed = LegacyRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { username, email, password } = parsed.data;

  // Reject reserved 'root' identifier server-side
  if (isReservedKeyword(username) || isReservedKeyword(email)) {
    res.status(400).json({ error: "The identifier 'root' is reserved for system administration." });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: 'insensitive' } },
        { username: { equals: username, mode: 'insensitive' } }
      ]
    }
  });

  if (existing) {
    res.status(409).json({ error: 'Email or username already in use' });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const requestedRole = (parsed.data.role || '').toUpperCase();
  let role: 'PLAYER' | 'GAME_MASTER' | 'SUPER_ADMIN' | 'ADMIN' = 'PLAYER';
  if (requestedRole === 'SUPER_ADMIN' || requestedRole === 'ADMIN') role = 'ADMIN';
  else if (requestedRole === 'GAME_MASTER' || requestedRole === 'HOST' || requestedRole === 'DESIGNER') role = 'GAME_MASTER';

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: hashed,
      role,
      approvalStatus: 'APPROVED',
    },
    select: { id: true, username: true, email: true, role: true, approvalStatus: true },
  });

  const token = generateToken(user.id, user.email);
  res.status(201).json({ user, token });
});

// ── DEDICATED GAME MASTER REGISTRATION ──
// POST /api/auth/register-gm
router.post('/register-gm', async (req: Request, res: Response): Promise<void> => {
  const gmReg = await getSystemSetting('gm_registration_enabled', 'true');
  if (gmReg === 'false') {
    res.status(403).json({ error: 'Game Master registration is currently disabled by administrator.' });
    return;
  }

  const parsed = GameMasterRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid Game Master input', details: parsed.error.flatten() });
    return;
  }

  const { name, email, phoneNumber, password, username } = parsed.data;

  // Reject reserved 'root' identifier server-side
  if (isReservedKeyword(name) || isReservedKeyword(email) || isReservedKeyword(username)) {
    res.status(400).json({ error: "The identifier 'root' is reserved for system administration." });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: 'insensitive' as const } },
        ...(username ? [{ username: { equals: username, mode: 'insensitive' as const } }] : [])
      ]
    }
  });

  if (existing) {
    res.status(409).json({ error: 'Email or username already in use' });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const finalUsername = username || generateUsername(email.split('@')[0], `gm_${Date.now()}`);

  const user = await prisma.user.create({
    data: {
      username: finalUsername,
      email,
      passwordHash: hashed,
      name,
      phoneNumber,
      role: 'GAME_MASTER',
      approvalStatus: 'PENDING',
      profile: {
        create: {
          displayName: name
        }
      }
    },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      phoneNumber: true,
      role: true,
      approvalStatus: true,
      createdAt: true
    }
  });

  res.status(201).json({
    message: 'Game Master registration submitted. Account is pending Administrator approval.',
    user,
    approvalStatus: 'PENDING'
  });
});

// ── LOGIN (STUDENTS, GAME MASTERS, AND ROOT ADMIN) ──
// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const { email, login, usn, username, password } = parsed.data;
  const rawIdentifier = (login || email || usn || username || '').trim();

  if (!rawIdentifier) {
    res.status(400).json({ error: 'Email, username, or USN is required' });
    return;
  }

  // If identifier is 'root' (case-insensitive), locate the Root Administrator account
  let user;
  if (rawIdentifier.toLowerCase() === 'root') {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: 'root', mode: 'insensitive' } },
          { email: { equals: 'root@terminal.lan', mode: 'insensitive' } }
        ]
      }
    });
  } else {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: rawIdentifier, mode: 'insensitive' } },
          { username: { equals: rawIdentifier, mode: 'insensitive' } },
          { usn: { equals: rawIdentifier.toUpperCase() } }
        ]
      }
    });
  }

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Maintenance mode check — only administrators can log in
  const maintenanceMode = await getSystemSetting('maintenance_mode', 'false');
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.username?.toLowerCase() === 'root';
  if (maintenanceMode === 'true' && !isAdmin) {
    res.status(503).json({ error: 'System is undergoing maintenance. Only administrators can log in.' });
    return;
  }

  // Check accountStatus: prevent blocked or suspended users
  if (user.accountStatus === 'BLOCKED' || user.accountStatus === 'SUSPENDED') {
    res.status(403).json({ error: `Account is ${user.accountStatus.toLowerCase()}. Please contact Administrator.` });
    return;
  }

  // Record login activity
  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLogin: now,
      lastActivity: now,
    }
  });

  const token = generateToken(user.id, user.email);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      usn: user.usn,
      email: user.email,
      branch: user.branch,
      section: user.section,
      phoneNumber: user.phoneNumber,
      role: user.role,
      approvalStatus: user.approvalStatus,
      accountStatus: user.accountStatus,
      isVerified: user.isVerified,
      lastLogin: now,
      lastActivity: now
    },
    token,
    warning: user.role === 'GAME_MASTER' && user.approvalStatus === 'PENDING'
      ? 'Account pending administrator approval'
      : undefined
  });
});

// ── PROTECTED DEDICATED ADMIN LOGIN (API COMPATIBILITY) ──
// POST /api/auth/admin/login
router.post('/admin/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = AdminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid admin login input', details: parsed.error.flatten() });
    return;
  }

  const { login, password } = parsed.data;
  const rawLogin = login.trim();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: rawLogin, mode: 'insensitive' as const } },
        { email: { equals: rawLogin, mode: 'insensitive' as const } },
        ...(rawLogin.toLowerCase() === 'root' ? [{ username: { equals: 'root', mode: 'insensitive' as const } }] : [])
      ]
    }
  });

  if (!user) {
    res.status(401).json({ error: 'Invalid administrator credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid administrator credentials' });
    return;
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied: Administrator privileges required' });
    return;
  }

  const token = generateToken(user.id, user.email);
  res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name || 'Root Administrator',
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus
    },
    token
  });
});

// ── CURRENT AUTHENTICATED USER ──
// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      usn: true,
      email: true,
      branch: true,
      section: true,
      phoneNumber: true,
      role: true,
      approvalStatus: true,
      accountStatus: true,
      isVerified: true,
      lastLogin: true,
      lastActivity: true,
      profile: true,
      teamMemberships: {
        include: {
          team: true
        }
      }
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
});

export default router;
