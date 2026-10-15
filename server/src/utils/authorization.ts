import { prisma } from '../lib/prisma';

/**
 * Checks if a user is authorized to manage a given event.
 * Reusable across REST API and Sockets.
 * 
 * Rules:
 * - If user is GAME_MASTER, approvalStatus must be APPROVED.
 * - If event belongs to a club: user must be SUPER_ADMIN or club ADMIN.
 * - If event has no club (legacy): user must be the event creator.
 */
export async function checkEventAuthorization(eventId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  // Block unapproved Game Masters from any event management
  if (user.role === 'GAME_MASTER' && (user.approvalStatus !== 'APPROVED' || user.mustChangePassword)) {
    return false;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) return false;

  if (event.clubId) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    if (event.creatorId === userId) return true;

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: event.clubId, userId } }
    });
    
    if (membership && membership.role === 'ADMIN') {
      return true;
    }
    
    return false;
  } else {
    // Fallback for non-migrated events
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return event.creatorId === userId;
  }
}

/**
 * Checks if a user is authorized to host or control a session.
 * Rules:
 * - Unauthenticated callers rejected prior to this check.
 * - Students (role === 'PLAYER') are always forbidden.
 * - Unapproved Game Masters or those requiring password change are forbidden.
 * - SUPER_ADMIN and ADMIN have platform-wide host authority.
 * - Owning GM (session.gmId === userId) is authorized.
 * - Different GM (session.gmId !== userId) is forbidden.
 * - Fallback for legacy sessions without gmId: event creator or event admin.
 */
export async function checkSessionHostAuthorization(
  session: { gmId?: string | null; eventId: string; event?: { creatorId?: string } | null },
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  // Students can never host or control a session
  if (user.role === 'PLAYER') return false;

  // Block unapproved Game Masters or those requiring password change from session control
  if (user.role === 'GAME_MASTER' && (user.approvalStatus !== 'APPROVED' || user.mustChangePassword)) {
    return false;
  }

  // SUPER_ADMIN and ADMIN have platform-wide host authority
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;

  // Owning GM: the GM who hosted this session
  if (session.gmId) {
    return session.gmId === userId;
  }

  // Legacy fallback: event creator or event admin
  if (session.event?.creatorId && session.event.creatorId === userId) {
    return true;
  }

  return checkEventAuthorization(session.eventId, userId);
}

/**
 * Checks if a user is authorized to manage a given game.
 * Rules:
 * - If user is GAME_MASTER, approvalStatus must be APPROVED and mustChangePassword must be false.
 * - If game belongs to a club: user must be SUPER_ADMIN or club ADMIN.
 * - If game has no club (legacy): user must be SUPER_ADMIN/ADMIN or the game designer.
 */
export async function checkGameAuthorization(gameId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  // Block unapproved Game Masters from any game management
  if (user.role === 'GAME_MASTER' && (user.approvalStatus !== 'APPROVED' || user.mustChangePassword)) {
    return false;
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId }
  });

  if (!game) return false;

  if (game.clubId) {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    if (game.designerId === userId) return true;

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId: game.clubId, userId } }
    });
    
    if (membership && membership.role === 'ADMIN') {
      return true;
    }
    
    return false;
  } else {
    // Fallback for non-migrated games
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return game.designerId === userId;
  }
}

/**
 * Checks if a user is authorized to manage a given club.
 * Rules:
 * - If user is GAME_MASTER, approvalStatus must be APPROVED.
 * - User must be SUPER_ADMIN or have ADMIN role in ClubMember for that club.
 */
export async function checkClubAuthorization(clubId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  // Block unapproved Game Masters
  if (user.role === 'GAME_MASTER' && user.approvalStatus !== 'APPROVED') {
    return false;
  }

  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;

  const membership = await prisma.clubMember.findUnique({
    where: { clubId_userId: { clubId, userId } }
  });
  
  return membership?.role === 'ADMIN';
}
