import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getIO, isUserOnline, getUserSocketIds } from '../sockets';

const router = Router();
router.use(authenticate);

function normalizeHandle(handle: string): string {
  if (!handle) return '';
  return handle.trim().toLowerCase().replace(/@terminal$/i, '').replace(/^@/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/current — Current authenticated student's active team
// ─────────────────────────────────────────────────────────────────────────────
router.get('/current', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId },
      include: {
        team: {
          include: {
            creator: {
              select: { id: true, name: true, username: true }
            },
            members: {
              include: {
                user: {
                  select: { id: true, name: true, username: true, usn: true, branch: true }
                }
              },
              orderBy: { joinedAt: 'asc' }
            }
          }
        }
      }
    });

    if (!membership || !membership.team) {
      res.json({ team: null });
      return;
    }

    const team = membership.team;
    const isLeader = membership.role === 'LEADER' || team.createdBy === userId;

    res.json({
      team: {
        id: team.id,
        name: team.name,
        role: membership.role,
        isLeader,
        leaderHandle: `${team.creator.username}@terminal`,
        leaderName: team.creator.name || team.creator.username,
        isLeaderOnline: isUserOnline(team.createdBy),
        membersCount: team.members.length,
        maxSize: 4,
        status: 'READY',
        createdAt: team.createdAt,
        members: team.members.map(m => ({
          id: m.userId,
          handle: `${m.user.username}@terminal`,
          username: m.user.username,
          name: m.user.name || m.user.username,
          usn: m.user.usn,
          branch: m.user.branch,
          role: m.role,
          isLeader: m.role === 'LEADER',
          joinedAt: m.joinedAt,
          isOnline: isUserOnline(m.userId)
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve team', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/create — Establish a new team atomically
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawName = req.body.name;

  if (!rawName || typeof rawName !== 'string') {
    res.status(400).json({ error: 'Team name is required.' });
    return;
  }

  const name = rawName.trim().replace(/^["']|["']$/g, '').trim();
  if (name.length < 2 || name.length > 30) {
    res.status(400).json({ error: 'Team name must be between 2 and 30 characters.' });
    return;
  }

  try {
    // 1. Verify student is not already in an active team
    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId },
      include: { team: true }
    });

    if (existingMembership) {
      res.status(400).json({
        error: `You are already a member of team "${existingMembership.team.name}". Leave your current team first.`
      });
      return;
    }

    // 2. Check team name uniqueness
    const existingTeam = await prisma.team.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } }
    });

    if (existingTeam) {
      res.status(400).json({ error: `Team name "${name}" is already taken.` });
      return;
    }

    // 3. Create team and leader membership atomically
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const newTeam = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name,
          createdBy: userId,
          members: {
            create: {
              userId,
              role: 'LEADER'
            }
          }
        },
        include: {
          creator: true,
          members: {
            include: { user: true }
          }
        }
      });
      return created;
    });

    try {
      const io = getIO();
      io.in(`user:${userId}`).socketsJoin(`team:${newTeam.id}`);
      getUserSocketIds(userId).forEach(sockId => {
        io.sockets.sockets.get(sockId)?.join(`team:${newTeam.id}`);
      });
      io.to(`user:${userId}`).emit('team:updated');
    } catch {}

    res.status(201).json({
      message: `[TEAM] CREATED: "${newTeam.name}"`,
      team: {
        id: newTeam.id,
        name: newTeam.name,
        role: 'LEADER',
        isLeader: true,
        leaderHandle: `${user.username}@terminal`,
        leaderName: user.name || user.username,
        membersCount: 1,
        maxSize: 4,
        status: 'READY',
        members: [
          {
            id: user.id,
            handle: `${user.username}@terminal`,
            username: user.username,
            name: user.name || user.username,
            role: 'LEADER',
            isLeader: true,
            joinedAt: new Date()
          }
        ]
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create team', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/join — Join an existing joinable team
// ─────────────────────────────────────────────────────────────────────────────
router.post('/join', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawName = req.body.name;

  if (!rawName || typeof rawName !== 'string') {
    res.status(400).json({ error: 'Team name is required.' });
    return;
  }

  const name = rawName.trim().replace(/^["']|["']$/g, '').trim();

  try {
    // 1. Verify student is not already in an active team
    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId },
      include: { team: true }
    });

    if (existingMembership) {
      res.status(400).json({
        error: `You are already in team "${existingMembership.team.name}". Leave it first with: team leave`
      });
      return;
    }

    // 2. Find team
    const team = await prisma.team.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      include: {
        creator: true,
        members: {
          include: { user: true }
        }
      }
    });

    if (!team) {
      res.status(404).json({ error: `Team "${name}" not found.` });
      return;
    }

    if (team.members.length >= 4) {
      res.status(400).json({ error: `Team "${team.name}" is full (4/4 members).` });
      return;
    }

    // 3. Add as member
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        role: 'MEMBER'
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    try {
      const io = getIO();
      io.in(`user:${userId}`).socketsJoin(`team:${team.id}`);
      getUserSocketIds(userId).forEach(sockId => {
        io.sockets.sockets.get(sockId)?.join(`team:${team.id}`);
      });
      const memberHandle = `${user?.username}@terminal`;
      const memberPayload = {
        teamId: team.id,
        handle: memberHandle,
        userId,
        member: {
          id: user?.id,
          handle: memberHandle,
          name: user?.name || user?.username
        }
      };
      io.to(`team:${team.id}`).emit('team:updated');
      io.to(`team:${team.id}`).emit('team:member_joined', memberPayload);
      io.to(`user:${team.createdBy}`).emit('team:member_joined', memberPayload);
      io.to(`user:${userId}`).emit('team:updated');
    } catch {}

    res.json({
      message: `[TEAM] JOINED: "${team.name}"`,
      team: {
        id: team.id,
        name: team.name,
        leaderHandle: `${team.creator.username}@terminal`,
        membersCount: team.members.length + 1,
        maxSize: 4
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to join team', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/invite — Leader-only invite operative to team
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invite', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawHandle = req.body.handle;

  if (!rawHandle || typeof rawHandle !== 'string') {
    res.status(400).json({ error: 'Operative handle is required.' });
    return;
  }

  const targetUsername = normalizeHandle(rawHandle);

  try {
    // 1. Verify caller is leader
    const callerMembership = await prisma.teamMember.findFirst({
      where: { userId },
      include: {
        team: { include: { members: true } },
        user: { select: { username: true, name: true } }
      }
    });

    if (!callerMembership || callerMembership.role !== 'LEADER') {
      res.status(403).json({ error: 'Only the team leader can invite new members.' });
      return;
    }

    if (callerMembership.team.members.length >= 4) {
      res.status(400).json({ error: 'Team is already full (4/4 members).' });
      return;
    }

    // 2. Lookup target user
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
      res.status(400).json({ error: 'Cannot invite yourself to your own team.' });
      return;
    }

    // 3. Verify target is not already on this team or another team
    const targetMembership = await prisma.teamMember.findFirst({
      where: { userId: targetUser.id },
      include: { team: true }
    });

    if (targetMembership) {
      if (targetMembership.teamId === callerMembership.teamId) {
        res.status(400).json({ error: `${targetUser.username}@terminal is already on your team.` });
        return;
      }
      res.status(400).json({ error: `${targetUser.username}@terminal is already in another team.` });
      return;
    }

    // 4. Upsert pending invitation
    const invite = await prisma.teamInvitation.upsert({
      where: {
        teamId_receiverId: {
          teamId: callerMembership.teamId,
          receiverId: targetUser.id
        }
      },
      update: {
        status: 'PENDING',
        senderId: userId
      },
      create: {
        teamId: callerMembership.teamId,
        senderId: userId,
        receiverId: targetUser.id,
        status: 'PENDING'
      }
    });

    // 5. Store notification in messages so it appears in inbox and notify via socket
    try {
      await prisma.message.create({
        data: {
          senderId: userId,
          recipientId: targetUser.id,
          content: `[TEAM INVITATION] You have been invited to join team "${callerMembership.team.name}" by ${callerMembership.user.username}@terminal. Type 'team requests' or 'team accept' to join.`
        }
      });
      const io = getIO();
      io.to(`user:${targetUser.id}`).emit('team:invitation', {
        id: invite.id,
        teamId: callerMembership.teamId,
        teamName: callerMembership.team.name,
        leaderHandle: `${callerMembership.user.username}@terminal`
      });
      io.to(`user:${targetUser.id}`).emit('team:requests_updated');
      io.to(`user:${userId}`).emit('team:updated');
    } catch (e) {
      console.error('Error emitting team:invitation:', e);
    }

    res.json({
      success: true,
      message: `[TEAM] Invitation sent to ${targetUser.username}@terminal`,
      handle: `${targetUser.username}@terminal`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send team invitation', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/requests — View pending team invitations received
// ─────────────────────────────────────────────────────────────────────────────
router.get('/requests', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const invites = await prisma.teamInvitation.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING'
      },
      include: {
        team: {
          include: {
            creator: { select: { username: true, name: true } },
            members: { select: { id: true } }
          }
        },
        sender: {
          select: { username: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      requests: invites.map(inv => ({
        id: inv.id,
        teamId: inv.teamId,
        teamName: inv.team.name,
        leaderHandle: `${inv.team.creator.username}@terminal`,
        senderHandle: `${inv.sender.username}@terminal`,
        membersCount: inv.team.members.length,
        createdAt: inv.createdAt
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load team invitations', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/accept — Accept team invitation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/accept', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const targetIdentifier = req.body.teamId || req.body.name;

  try {
    // 1. Verify not already in a team
    const currentTeam = await prisma.teamMember.findFirst({ where: { userId } });
    if (currentTeam) {
      res.status(400).json({ error: 'You are already in a team. Run `team leave` first.' });
      return;
    }

    // 2. Find pending invitation (by teamId, team name, or fallback to latest pending)
    const invite = await prisma.teamInvitation.findFirst({
      where: {
        receiverId: userId,
        status: 'PENDING',
        ...(targetIdentifier ? {
          OR: [
            { teamId: targetIdentifier },
            { team: { name: { equals: targetIdentifier, mode: 'insensitive' } } }
          ]
        } : {})
      },
      include: { team: { include: { members: true, creator: true } } },
      orderBy: { createdAt: 'desc' }
    });

    if (!invite) {
      res.status(404).json({ error: 'No pending team invitation found.' });
      return;
    }

    if (invite.team.members.length >= 4) {
      res.status(400).json({ error: `Team "${invite.team.name}" is now full (4/4 members).` });
      return;
    }

    // 3. Join team and mark invite accepted atomically
    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId,
          role: 'MEMBER'
        }
      }),
      prisma.teamInvitation.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' }
      })
    ]);

    try {
      const io = getIO();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      io.in(`user:${userId}`).socketsJoin(`team:${invite.teamId}`);
      getUserSocketIds(userId).forEach(sockId => {
        io.sockets.sockets.get(sockId)?.join(`team:${invite.teamId}`);
      });
      const memberHandle = `${user?.username}@terminal`;
      const memberPayload = {
        teamId: invite.teamId,
        handle: memberHandle,
        userId,
        member: {
          id: user?.id,
          handle: memberHandle,
          name: user?.name || user?.username
        }
      };
      io.to(`team:${invite.teamId}`).emit('team:updated');
      io.to(`team:${invite.teamId}`).emit('team:member_joined', memberPayload);
      io.to(`user:${invite.team.createdBy}`).emit('team:member_joined', memberPayload);
      io.to(`user:${userId}`).emit('team:updated');
      io.to(`user:${userId}`).emit('team:requests_updated');
    } catch {}

    res.json({
      success: true,
      message: `[TEAM] Accepted invitation. Joined "${invite.team.name}".`,
      team: {
        id: invite.team.id,
        name: invite.team.name,
        leaderHandle: `${invite.team.creator.username}@terminal`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept invitation', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/reject — Reject team invitation
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const targetIdentifier = req.body.teamId || req.body.name;

  try {
    const invite = await prisma.teamInvitation.findFirst({
      where: {
        receiverId: userId,
        status: 'PENDING',
        ...(targetIdentifier ? {
          OR: [
            { teamId: targetIdentifier },
            { team: { name: { equals: targetIdentifier, mode: 'insensitive' } } }
          ]
        } : {})
      },
      include: { team: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!invite) {
      res.status(404).json({ error: 'No pending team invitation found to reject.' });
      return;
    }

    await prisma.teamInvitation.update({
      where: { id: invite.id },
      data: { status: 'REJECTED' }
    });

    try {
      const io = getIO();
      io.to(`user:${invite.senderId}`).emit('team:invitation_rejected', {
        teamId: invite.teamId,
        receiverId: userId
      });
      io.to(`user:${invite.senderId}`).emit('team:updated');
      io.to(`user:${userId}`).emit('team:requests_updated');
    } catch {}

    res.json({
      success: true,
      message: '[TEAM] Invitation rejected.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reject invitation', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/leave — Leave current team
// ─────────────────────────────────────────────────────────────────────────────
router.post('/leave', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
              include: { user: { select: { username: true, name: true } } },
              orderBy: { joinedAt: 'asc' }
            }
          }
        }
      }
    });

    if (!membership) {
      res.status(400).json({ error: 'You are not currently in a team.' });
      return;
    }

    const team = membership.team;
    const isLeader = membership.role === 'LEADER';

    if (isLeader) {
      const remainingMembers = team.members.filter(m => m.userId !== userId);
      if (remainingMembers.length === 0) {
        // Disband empty team
        await prisma.team.delete({ where: { id: team.id } });

        try {
          const io = getIO();
          io.to(`team:${team.id}`).emit('team:disbanded', { teamId: team.id, teamName: team.name });
          io.to(`team:${team.id}`).emit('team:updated');
          getUserSocketIds(userId).forEach(sockId => {
            io.sockets.sockets.get(sockId)?.leave(`team:${team.id}`);
          });
          io.to(`user:${userId}`).emit('team:updated');
        } catch {}

        res.json({ success: true, message: `[TEAM] Left and disbanded "${team.name}".` });
        return;
      } else {
        // Transfer leadership to next senior member
        const nextLeader = remainingMembers[0];
        await prisma.$transaction([
          prisma.teamMember.delete({ where: { id: membership.id } }),
          prisma.teamMember.update({
            where: { id: nextLeader.id },
            data: { role: 'LEADER' }
          }),
          prisma.team.update({
            where: { id: team.id },
            data: { createdBy: nextLeader.userId }
          })
        ]);

        try {
          const io = getIO();
          io.to(`team:${team.id}`).emit('team:leadership_transferred', {
            teamId: team.id,
            newLeaderHandle: `${nextLeader.user.username}@terminal`
          });
          io.to(`team:${team.id}`).emit('team:member_left', { teamId: team.id, userId });
          io.to(`team:${team.id}`).emit('team:updated');
          getUserSocketIds(userId).forEach(sockId => {
            io.sockets.sockets.get(sockId)?.leave(`team:${team.id}`);
          });
          io.to(`user:${userId}`).emit('team:updated');
        } catch {}

        res.json({
          success: true,
          message: `[TEAM] Left team. Leadership transferred to next member.`
        });
        return;
      }
    } else {
      await prisma.teamMember.delete({ where: { id: membership.id } });

      try {
        const io = getIO();
        io.to(`team:${team.id}`).emit('team:member_left', { teamId: team.id, userId });
        io.to(`team:${team.id}`).emit('team:updated');
        getUserSocketIds(userId).forEach(sockId => {
          io.sockets.sockets.get(sockId)?.leave(`team:${team.id}`);
        });
        io.to(`user:${userId}`).emit('team:updated');
      } catch {}

      res.json({ success: true, message: `[TEAM] Successfully departed "${team.name}".` });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to leave team', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/kick — Leader kicks member
// ─────────────────────────────────────────────────────────────────────────────
router.post('/kick', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const rawHandle = req.body.handle;

  if (!rawHandle) {
    res.status(400).json({ error: 'Member handle is required.' });
    return;
  }

  const targetUsername = normalizeHandle(rawHandle);

  try {
    const leaderMembership = await prisma.teamMember.findFirst({
      where: { userId },
      include: { team: true }
    });

    if (!leaderMembership || leaderMembership.role !== 'LEADER') {
      res.status(403).json({ error: 'Only the team leader can kick members.' });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: { username: { equals: targetUsername, mode: 'insensitive' } }
    });

    if (!targetUser) {
      res.status(404).json({ error: `Operative ${targetUsername} not found.` });
      return;
    }

    if (targetUser.id === userId) {
      res.status(400).json({ error: 'Cannot kick yourself. Use `team leave` or `team disband`.' });
      return;
    }

    const targetMembership = await prisma.teamMember.findFirst({
      where: {
        teamId: leaderMembership.teamId,
        userId: targetUser.id
      }
    });

    if (!targetMembership) {
      res.status(400).json({ error: `${targetUsername}@terminal is not on your team.` });
      return;
    }

    await prisma.teamMember.delete({ where: { id: targetMembership.id } });

    try {
      const io = getIO();
      getUserSocketIds(targetUser.id).forEach(sockId => {
        io.sockets.sockets.get(sockId)?.leave(`team:${leaderMembership.teamId}`);
      });
      io.to(`user:${targetUser.id}`).emit('team:member_kicked', {
        teamId: leaderMembership.teamId,
        message: 'You have been removed from the squad by the team leader.'
      });
      io.to(`user:${targetUser.id}`).emit('team:updated');
      io.to(`team:${leaderMembership.teamId}`).emit('team:member_left', {
        teamId: leaderMembership.teamId,
        userId: targetUser.id
      });
      io.to(`team:${leaderMembership.teamId}`).emit('team:updated');
    } catch {}

    res.json({
      success: true,
      message: `[TEAM] Removed ${targetUsername}@terminal from team.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to kick member', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teams/disband — Leader disbands team
// ─────────────────────────────────────────────────────────────────────────────
router.post('/disband', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const leaderMembership = await prisma.teamMember.findFirst({
      where: { userId },
      include: { team: true }
    });

    if (!leaderMembership || leaderMembership.role !== 'LEADER') {
      res.status(403).json({ error: 'Only the team leader can disband the team.' });
      return;
    }

    const teamId = leaderMembership.teamId;
    const teamName = leaderMembership.team.name;
    await prisma.team.delete({ where: { id: teamId } });

    try {
      const io = getIO();
      io.to(`team:${teamId}`).emit('team:disbanded', { teamId, teamName });
      io.to(`team:${teamId}`).emit('team:updated');
    } catch {}

    res.json({
      success: true,
      message: `[TEAM] Disbanded "${teamName}". Memberships invalidated.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disband team', details: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teams/messages — Retrieve recent team chat messages
// ─────────────────────────────────────────────────────────────────────────────
router.get('/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  try {
    const membership = await prisma.teamMember.findFirst({
      where: { userId }
    });

    if (!membership) {
      res.status(400).json({ error: 'You are not in a team.' });
      return;
    }

    const reqSessionId = req.query.sessionId as string | undefined;
    const reqRoomCode = req.query.roomCode ? String(req.query.roomCode).toUpperCase() : undefined;

    let targetSessionId = reqSessionId;
    let targetRoomCode = reqRoomCode;

    if (!targetSessionId && targetRoomCode) {
      const sess = await prisma.session.findUnique({
        where: { roomCode: targetRoomCode }
      });
      if (sess) {
        targetSessionId = sess.id;
        targetRoomCode = sess.roomCode;
      }
    }

    if (!targetSessionId && !targetRoomCode) {
      // Check if user is in an active game session
      const activeSP = await prisma.sessionPlayer.findFirst({
        where: {
          userId,
          session: { status: { not: 'ENDED' } }
        },
        include: { session: true }
      });
      if (activeSP) {
        targetSessionId = activeSP.sessionId;
        targetRoomCode = activeSP.session.roomCode;
      }
    }

    const whereClause: any = {
      teamId: membership.teamId
    };

    if (targetSessionId) {
      whereClause.sessionId = targetSessionId;
    } else if (targetRoomCode) {
      whereClause.roomCode = targetRoomCode;
    } else {
      // Default to general/lobby messages (not associated with an ended game)
      whereClause.sessionId = null;
    }

    const messages = await prisma.teamMessage.findMany({
      where: whereClause,
      include: {
        sender: {
          select: { username: true, name: true }
        }
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' }
      ],
      take: 100
    });

    res.json({
      sessionId: targetSessionId || null,
      roomCode: targetRoomCode || null,
      messages: messages.map(m => ({
        id: m.id,
        teamId: m.teamId,
        sessionId: m.sessionId,
        roomCode: m.roomCode,
        senderHandle: `${m.sender.username}@terminal`,
        senderName: m.sender.name || m.sender.username,
        content: m.content,
        createdAt: m.createdAt
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch team messages', details: err.message });
  }
});

export default router;
