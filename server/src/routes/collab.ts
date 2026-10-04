import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getIO, isUserOnline } from '../sockets';

const router = Router();
router.use(authenticate);

function normalizeHandle(handle: string): string {
  if (!handle) return '';
  return handle.trim().toLowerCase().replace(/@terminal$/i, '').replace(/^@/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/collab — Retrieve student's verified collaboration network & directory
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const [collaborations, incomingRequests, outgoingRequests, campusUsers] = await Promise.all([
      // 1. Accepted mutual contacts
      prisma.collaboration.findMany({
        where: { userId },
        include: {
          peer: {
            select: {
              id: true,
              username: true,
              name: true,
              usn: true,
              branch: true,
              section: true,
              lastActivity: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 2. Incoming pending requests
      prisma.collaborationRequest.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              name: true,
              usn: true,
              branch: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 3. Outgoing pending requests
      prisma.collaborationRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              name: true,
              usn: true,
              branch: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // 4. Campus Directory of registered active students (strictly real operatives, excluding test fixtures)
      prisma.user.findMany({
        where: {
          id: { not: userId },
          accountStatus: 'ACTIVE',
          role: 'PLAYER',
          NOT: [
            { email: { endsWith: '@test.com' } },
            { email: { endsWith: '@terminal.test' } },
            { email: { endsWith: '.test' } },
            { username: { startsWith: 'S1_' } },
            { username: { startsWith: 'S2_' } },
            { username: { startsWith: 'ST_' } },
            { username: { startsWith: 'LN_' } },
            { username: { startsWith: 'CN_' } },
            { username: { startsWith: 'SA_' } },
            { username: { startsWith: 'GM_' } },
            { username: { startsWith: 'C1A_' } },
            { username: { startsWith: 'C2A_' } },
            { username: { startsWith: 'cap_u' } },
            { username: { startsWith: 'room_p' } },
            { username: { startsWith: 'api_user_' } },
            { username: { startsWith: 'hostrf_' } },
            { username: { startsWith: 'sturf_' } },
            { name: { startsWith: 'Student_Alpha_' } },
            { name: { startsWith: 'Student_Beta_' } },
            { name: { startsWith: 'AnalystBob_' } },
            { name: { startsWith: 'Member ' } },
            { name: { startsWith: 'Player ' } },
          ]
        },
        select: {
          id: true,
          username: true,
          name: true
        },
        orderBy: { username: 'asc' },
        take: 50
      })
    ]);

    const connectedPeerIds = new Set(collaborations.map(c => c.peer.id));
    const pendingReceiverIds = new Set(outgoingRequests.map(r => r.receiver.id));

    res.json({
      contacts: collaborations.map(c => ({
        id: c.peer.id,
        handle: `${c.peer.username}@terminal`,
        username: c.peer.username,
        connectedAt: c.createdAt,
        isOnline: isUserOnline(c.peer.id)
      })),
      incoming: incomingRequests.map(r => ({
        id: r.id,
        senderId: r.sender.id,
        handle: `${r.sender.username}@terminal`,
        username: r.sender.username,
        createdAt: r.createdAt
      })),
      outgoing: outgoingRequests.map(r => ({
        id: r.id,
        receiverId: r.receiver.id,
        handle: `${r.receiver.username}@terminal`,
        username: r.receiver.username,
        createdAt: r.createdAt
      })),
      directory: campusUsers.map(u => {
        let relation: 'CONNECTED' | 'PENDING' | 'ADD' = 'ADD';
        if (connectedPeerIds.has(u.id)) {
          relation = 'CONNECTED';
        } else if (pendingReceiverIds.has(u.id)) {
          relation = 'PENDING';
        }

        return {
          handle: `${u.username}@terminal`,
          username: u.username,
          isOnline: isUserOnline(u.id),
          relation
        };
      })
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve collaboration network', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/collab/add — Send collaboration request
// ─────────────────────────────────────────────────────────────────────────────
router.post('/add', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawHandle = req.body.handle;

  if (!rawHandle || typeof rawHandle !== 'string') {
    res.status(400).json({ error: 'Operative handle is required.' });
    return;
  }

  const targetUsername = normalizeHandle(rawHandle);

  try {
    // 1. Verify target user exists
    const targetUser = await prisma.user.findFirst({
      where: { username: { equals: targetUsername, mode: 'insensitive' } }
    });

    if (!targetUser) {
      res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: `No registered TERMINAL user: ${targetUsername}`
      });
      return;
    }

    if (targetUser.id === userId) {
      res.status(400).json({ error: 'Cannot add yourself to collaboration network.' });
      return;
    }

    // 2. Check if already connected
    const existingCollab = await prisma.collaboration.findUnique({
      where: {
        userId_peerId: {
          userId,
          peerId: targetUser.id
        }
      }
    });

    if (existingCollab) {
      res.status(400).json({
        error: 'ALREADY_CONNECTED',
        message: `${targetUser.username}@terminal is already in your network.`
      });
      return;
    }

    // 3. Check if request already pending
    const existingRequest = await prisma.collaborationRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUser.id, status: 'PENDING' },
          { senderId: targetUser.id, receiverId: userId, status: 'PENDING' }
        ]
      }
    });

    if (existingRequest) {
      res.status(400).json({
        error: 'ALREADY_PENDING',
        message: 'Request already pending.'
      });
      return;
    }

    // 4. Create request
    const createdReq = await prisma.collaborationRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: userId,
          receiverId: targetUser.id
        }
      },
      update: {
        status: 'PENDING'
      },
      create: {
        senderId: userId,
        receiverId: targetUser.id,
        status: 'PENDING'
      }
    });

    try {
      const io = getIO();
      const senderUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true }
      });
      const senderHandle = `${senderUser?.username || 'operative'}@terminal`;
      io.to(`user:${targetUser.id}`).emit('collab:request', {
        id: createdReq.id,
        senderId: userId,
        senderHandle,
        fromHandle: senderHandle,
        handle: senderHandle,
        senderName: senderUser?.name || senderUser?.username
      });
      io.to(`user:${targetUser.id}`).emit('collab:updated');
      io.to(`user:${userId}`).emit('collab:updated');
    } catch {}

    res.json({
      success: true,
      message: `[COLLAB] Request sent to ${targetUser.username}@terminal`,
      handle: `${targetUser.username}@terminal`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send collaboration request', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/collab/requests — View incoming & outgoing request queue
// ─────────────────────────────────────────────────────────────────────────────
router.get('/requests', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const [incoming, outgoing] = await Promise.all([
      prisma.collaborationRequest.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: {
          sender: { select: { username: true, name: true, usn: true, branch: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.collaborationRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        include: {
          receiver: { select: { username: true, name: true, usn: true, branch: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({
      incoming: incoming.map(r => ({
        id: r.id,
        handle: `${r.sender.username}@terminal`,
        username: r.sender.username,
        name: r.sender.name || r.sender.username,
        usn: r.sender.usn,
        branch: r.sender.branch,
        createdAt: r.createdAt
      })),
      outgoing: outgoing.map(r => ({
        id: r.id,
        handle: `${r.receiver.username}@terminal`,
        username: r.receiver.username,
        name: r.receiver.name || r.receiver.username,
        usn: r.receiver.usn,
        branch: r.receiver.branch,
        createdAt: r.createdAt
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load collaboration requests', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/collab/accept — Accept collaboration request from handle
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accept', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawHandle = req.body.handle;

  if (!rawHandle) {
    res.status(400).json({ error: 'Operative handle is required.' });
    return;
  }

  const senderUsername = normalizeHandle(rawHandle);

  try {
    const sender = await prisma.user.findFirst({
      where: { username: { equals: senderUsername, mode: 'insensitive' } }
    });

    if (!sender) {
      res.status(404).json({ error: `Operative ${senderUsername} not found.` });
      return;
    }

    const request = await prisma.collaborationRequest.findFirst({
      where: {
        senderId: sender.id,
        receiverId: userId,
        status: 'PENDING'
      }
    });

    if (!request) {
      res.status(404).json({ error: `No pending collaboration request from ${sender.username}@terminal.` });
      return;
    }

    // Establish mutual connection atomically
    await prisma.$transaction([
      prisma.collaborationRequest.update({
        where: { id: request.id },
        data: { status: 'ACCEPTED' }
      }),
      prisma.collaboration.upsert({
        where: { userId_peerId: { userId, peerId: sender.id } },
        update: {},
        create: { userId, peerId: sender.id }
      }),
      prisma.collaboration.upsert({
        where: { userId_peerId: { userId: sender.id, peerId: userId } },
        update: {},
        create: { userId: sender.id, peerId: userId }
      })
    ]);

    try {
      const io = getIO();
      const acceptingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true }
      });
      const acceptingHandle = `${acceptingUser?.username || 'operative'}@terminal`;
      io.to(`user:${sender.id}`).emit('collab:accepted', {
        peerId: userId,
        handle: acceptingHandle,
        peerHandle: acceptingHandle
      });
      io.to(`user:${sender.id}`).emit('collab:updated');
      io.to(`user:${userId}`).emit('collab:updated');
    } catch {}

    res.json({
      success: true,
      message: `[COLLAB] Accepted request. Connected with ${sender.username}@terminal.`,
      handle: `${sender.username}@terminal`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept collaboration request', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/collab/reject — Reject collaboration request from handle
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawHandle = req.body.handle;

  if (!rawHandle) {
    res.status(400).json({ error: 'Operative handle is required.' });
    return;
  }

  const senderUsername = normalizeHandle(rawHandle);

  try {
    const sender = await prisma.user.findFirst({
      where: { username: { equals: senderUsername, mode: 'insensitive' } }
    });

    if (!sender) {
      res.status(404).json({ error: `Operative ${senderUsername} not found.` });
      return;
    }

    const request = await prisma.collaborationRequest.findFirst({
      where: {
        senderId: sender.id,
        receiverId: userId,
        status: 'PENDING'
      }
    });

    if (!request) {
      res.status(404).json({ error: `No pending collaboration request from ${sender.username}@terminal.` });
      return;
    }

    await prisma.collaborationRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED' }
    });

    try {
      const io = getIO();
      io.to(`user:${sender.id}`).emit('collab:rejected', { peerId: userId });
      io.to(`user:${sender.id}`).emit('collab:updated');
      io.to(`user:${userId}`).emit('collab:updated');
    } catch {}

    res.json({
      success: true,
      message: `[COLLAB] Rejected collaboration request from ${sender.username}@terminal.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reject collaboration request', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/collab/remove — Remove connection from network
// ─────────────────────────────────────────────────────────────────────────────
router.post('/remove', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawHandle = req.body.handle;

  if (!rawHandle) {
    res.status(400).json({ error: 'Operative handle is required.' });
    return;
  }

  const peerUsername = normalizeHandle(rawHandle);

  try {
    const peer = await prisma.user.findFirst({
      where: { username: { equals: peerUsername, mode: 'insensitive' } }
    });

    if (!peer) {
      res.status(404).json({ error: `Operative ${peerUsername} not found.` });
      return;
    }

    await prisma.$transaction([
      prisma.collaboration.deleteMany({
        where: {
          OR: [
            { userId, peerId: peer.id },
            { userId: peer.id, peerId: userId }
          ]
        }
      }),
      prisma.collaborationRequest.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: peer.id },
            { senderId: peer.id, receiverId: userId }
          ]
        }
      })
    ]);

    try {
      const io = getIO();
      io.to(`user:${peer.id}`).emit('collab:removed', { peerId: userId });
      io.to(`user:${peer.id}`).emit('collab:updated');
      io.to(`user:${userId}`).emit('collab:updated');
    } catch {}

    res.json({
      success: true,
      message: `[COLLAB] Removed ${peer.username}@terminal from network.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove connection', details: err.message });
  }
});

export default router;
