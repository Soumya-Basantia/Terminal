import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { deriveStageModeFromStatus, getSessionState, purgeGameSessionChat } from '../services/sessionService';
import { canTransition, applySessionTransition, startQuestion, finalizeSession, getChallengeForLiveSession, selectGameForSession } from '../services/sessionLifecycle';
import { startQuestionSweep } from '../services/questionSweep';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { checkEventAuthorization } from '../utils/authorization';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET: string = process.env.JWT_SECRET || (() => {
  throw new Error('[SECURITY] JWT_SECRET environment variable is not set. Refusing to start.');
})();

import { addUserSocket, removeUserSocket, isUserOnline, getUserSocketIds } from './presence';
export { isUserOnline, getUserSocketIds };

let globalIo: Server | null = null;

export function getIO(): Server {
  if (!globalIo) {
    throw new Error('Socket.io has not been initialized');
  }
  return globalIo;
}

export function setIO(io: Server): void {
  globalIo = io;
}

export function setupSocketHandlers(io: Server): void {
  setIO(io);

  io.use((socket, next) => {
    const { token, isStage } = socket.handshake.auth;

    // Stage / projector displays connect with { isStage: true } without a student/host token
    if (isStage) {
      socket.data.role = 'STAGE';
      socket.data.isStageRequest = true;
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          socket.data.userId = decoded.userId;
        } catch {
          // Ignore invalid token on public stage viewer
        }
      }
      return next();
    }

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`[Socket] Connected: ${socket.id}, User: ${userId}`);

    if (userId) {
      socket.join(`user:${userId}`);
      const isFirstSocket = addUserSocket(userId, socket.id);

      // Auto-join active team room if player belongs to a team.
      // Fire-and-forget: ALL event listeners below are registered
      // SYNCHRONOUSLY so a client's first emits (especially websocket-only
      // connections after a polling→websocket upgrade) can never race
      // listener registration and get silently dropped.
      if (isFirstSocket) {
        void (async () => {
          try {
            const membership = await prisma.teamMember.findFirst({
              where: { userId },
              include: { user: { select: { username: true } }, team: true }
            });
            if (membership) {
              socket.join(`team:${membership.teamId}`);
              socket.data.teamId = membership.teamId;
              io.to(`team:${membership.teamId}`).emit('team:presence', {
                userId,
                handle: `${membership.user.username}@terminal`,
                status: 'ONLINE'
              });
            }
          } catch (err) {
            console.error('Error auto-joining team room:', err);
          }
        })();
      }
    }

    // ── HOST JOINS ───────────────────────────────────────────────────────
    socket.on('host:join', async (data: { roomCode?: string; sessionCode?: string }) => {
      const roomCode = data?.roomCode || data?.sessionCode;
      if (!roomCode) {
        socket.emit('error', { message: 'roomCode is required' });
        return;
      }
      const userId = socket.data.userId;
      const code = String(roomCode).toUpperCase();

      const session = await prisma.session.findUnique({
        where: { roomCode: code },
        include: { event: true },
      });

      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const isAuthorized = await checkEventAuthorization(session.eventId, userId);
      if (!isAuthorized) {
        socket.emit('error', { message: 'Not authorized for this session' });
        return;
      }

      socket.join(`session:${code}`);
      socket.data.role = 'HOST';
      socket.data.roomCode = code;

      const state = await getSessionState(code);
      socket.emit('session_state_update', state);
      console.log(`[Host] ${userId} joined session ${code}`);
    });

    // ── PLAYER JOINS ─────────────────────────────────────────────────────
    socket.on('player:join', async (data: { roomCode?: string; sessionCode?: string }) => {
      const roomCode = data?.roomCode || data?.sessionCode;
      if (!roomCode) {
        socket.emit('error', { message: 'roomCode is required' });
        return;
      }
      const userId = socket.data.userId;
      const code = String(roomCode).toUpperCase();

      const sessionPlayer = await prisma.sessionPlayer.findFirst({
        where: {
          session: { roomCode: code },
          userId: userId
        },
        include: { session: true }
      });

      if (!sessionPlayer) {
        socket.emit('error', { message: 'Player not found in this session' });
        return;
      }

      socket.join(`session:${code}`);
      socket.data.role = 'PLAYER';
      socket.data.roomCode = code;
      socket.data.sessionId = sessionPlayer.sessionId;
      socket.data.sessionPlayerId = sessionPlayer.id;

      // Ensure status is active and team is linked if member
      const teamUpdateData: any = { status: 'ACTIVE' };
      if (!sessionPlayer.teamId) {
        const teamMember = await prisma.teamMember.findFirst({
          where: { userId }
        });
        if (teamMember) {
          teamUpdateData.teamId = teamMember.teamId;
        }
      }

      await prisma.sessionPlayer.update({
        where: { id: sessionPlayer.id },
        data: teamUpdateData
      });

      // Notify everyone of state change
      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);

      // Reconnect state restoration for Magnetic Dock challenges
      const currentChalId = sessionPlayer.session?.currentChallengeId;
      if (currentChalId) {
        const sub = await prisma.submission.findUnique({
          where: {
            sessionId_challengeId_playerId_runId: {
              sessionId: sessionPlayer.sessionId,
              challengeId: currentChalId,
              playerId: sessionPlayer.id,
              runId: sessionPlayer.session.currentRun,
            }
          }
        });
        if (sub?.metadata && (sub.metadata as any).dockState) {
          socket.emit('dock:state_sync', {
            state: (sub.metadata as any).dockState,
            challengeId: currentChalId,
          });
        }
      }
      
      console.log(`[Player] ${userId} joined session ${code}`);
    });

    // ── PLAYER DOCK ACTION ───────────────────────────────────────────────
    socket.on('player:dock_action', async (data: { roomCode?: string; challengeId?: string; action?: 'CONNECT' | 'RESET'; sourceNodeId?: string; targetNodeId?: string }) => {
      const code = (data.roomCode || socket.data.roomCode)?.toUpperCase();
      const userId = socket.data.userId;
      if (!code || !userId) {
        socket.emit('error', { message: 'Authentication or roomCode missing' });
        return;
      }

      const session = await prisma.session.findUnique({
        where: { roomCode: code },
        include: { currentGame: true }
      });
      if (!session) return;

      const sessionPlayer = await prisma.sessionPlayer.findFirst({
        where: { sessionId: session.id, userId }
      });
      if (!sessionPlayer) return;

      const targetChallengeId = data.challengeId || session.currentChallengeId;
      let liveChallenge = null;
      if (targetChallengeId) {
        liveChallenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
      } else if (session.currentGameId) {
        liveChallenge = await prisma.challenge.findFirst({
          where: { gameId: session.currentGameId },
          orderBy: { position: 'asc' }
        });
      }
      if (!liveChallenge) return;

      // Grade against the FROZEN snapshot — never the live Challenge row.
      const challenge = getChallengeForLiveSession(session, liveChallenge);

      const config = (challenge.config || {}) as any;
      const dockConfig = config.dock || config;
      if (!dockConfig || !dockConfig.nodes || !dockConfig.transitions) {
        socket.emit('error', { message: 'Challenge does not have dock configuration' });
        return;
      }

      const existingSub = await prisma.submission.findUnique({
        where: {
          sessionId_challengeId_playerId_runId: {
            sessionId: session.id,
            challengeId: challenge.id,
            playerId: sessionPlayer.id,
            runId: session.currentRun,
          }
        }
      });

      const initialNodes = dockConfig.initialNodes || dockConfig.availableNodes || [];
      const maxEnergy = dockConfig.resourceBudget?.energy ?? 6;

      let currentDockState: any = existingSub?.metadata && (existingSub.metadata as any).dockState
        ? (existingSub.metadata as any).dockState
        : {
            unlockedNodes: [...initialNodes],
            completedConnections: [],
            energyRemaining: maxEnergy,
            consequences: [],
            isCompleted: false,
          };

      const { Validator: V } = require('../engine');
      const actionPayload = {
        action: data.action || 'CONNECT',
        sourceNodeId: data.sourceNodeId,
        targetNodeId: data.targetNodeId,
      };

      const evalResult = V.evaluateDockAction(dockConfig, currentDockState, actionPayload);
      const updatedDockState = evalResult.state;

      let pointsAwarded = 0;
      if (updatedDockState.isCompleted) {
        pointsAwarded = challenge.points;
        if (updatedDockState.energyRemaining > 0) {
          pointsAwarded += Math.min(25, updatedDockState.energyRemaining * 5);
        }
        if (session.challengeStartTime && challenge.timeLimit > 0) {
          const responseTimeMs = Date.now() - session.challengeStartTime.getTime();
          const timeLimitMs = challenge.timeLimit * 1000;
          if (responseTimeMs < timeLimitMs / 2) {
            pointsAwarded += Math.floor(challenge.points * 0.15);
          }
        }
        updatedDockState.score = pointsAwarded;
      }

      await prisma.submission.upsert({
        where: {
          sessionId_challengeId_playerId_runId: {
            sessionId: session.id,
            challengeId: challenge.id,
            playerId: sessionPlayer.id,
            runId: session.currentRun,
          }
        },
        update: {
          answer: JSON.stringify({
            connections: updatedDockState.completedConnections,
            energy: updatedDockState.energyRemaining,
            isCompleted: updatedDockState.isCompleted,
          }),
          isCorrect: updatedDockState.isCompleted,
          score: pointsAwarded,
          metadata: {
            dockState: updatedDockState,
            completedConnections: updatedDockState.completedConnections,
            energyRemaining: updatedDockState.energyRemaining,
          },
        },
        create: {
          sessionId: session.id,
          challengeId: challenge.id,
          playerId: sessionPlayer.id,
          runId: session.currentRun,
          answer: JSON.stringify({
            connections: updatedDockState.completedConnections,
            energy: updatedDockState.energyRemaining,
            isCompleted: updatedDockState.isCompleted,
          }),
          isCorrect: updatedDockState.isCompleted,
          score: pointsAwarded,
          responseTime: session.challengeStartTime ? Date.now() - session.challengeStartTime.getTime() : 0,
          teamId: sessionPlayer.teamId,
          metadata: {
            dockState: updatedDockState,
            completedConnections: updatedDockState.completedConnections,
            energyRemaining: updatedDockState.energyRemaining,
          },
        }
      });

      socket.emit('dock:action_result', {
        valid: evalResult.valid,
        consequence: evalResult.consequence,
        state: updatedDockState,
        isCompleted: updatedDockState.isCompleted,
        pointsAwarded,
      });

      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    // ── HOST EVENT COMMANDS ───────────────────────────────────────────────
    socket.on('host:change_status', async (data: { status: string }) => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;

      // Strict allowlist — never write arbitrary strings to session.status
      const VALID_STATUSES = new Set([
        'LOBBY', 'STARTING', 'ROUND_ACTIVE', 'QUESTION_ACTIVE',
        'QUESTION_LOCKED', 'RESULTS', 'ENDED', 'FINAL'
      ]);
      if (!VALID_STATUSES.has(data.status)) {
        socket.emit('error', { message: 'Invalid session status' });
        return;
      }

      try {
        const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
        if (!session) return;
        const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
        if (!isAuthorized) return;

        let newStatus: any = data.status;
        if (newStatus === 'FINAL') newStatus = 'ENDED';

        // ── STATE MACHINE GUARD (server authoritative) ────────────────────
        if (!canTransition(session.status, newStatus)) {
          socket.emit('error', {
            message: `Invalid transition ${session.status} → ${newStatus}`,
            currentStatus: session.status,
          });
          return;
        }

        const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });
        const updated = await applySessionTransition(session, newStatus, {
          io,
          actorUsername: actor?.username,
          actorId: actor?.id,
        });
        if (!updated) return;

        // Keep stage mode in sync with status unless GM explicitly set one.
        if (session.stageMode === 'LOBBY' || session.stageMode === null) {
          const nextStageMode = deriveStageModeFromStatus(updated.status, updated.stageMode);
          if (nextStageMode !== updated.stageMode) {
            await prisma.session.update({ where: { roomCode: code }, data: { stageMode: nextStageMode as any } });
          }
        }

        const state = await getSessionState(code);
        io.to(`session:${code}`).emit('session_state_update', state);
      } catch (err) {
        console.error('host:change_status error:', err);
      }
    });

    socket.on('host:select_game', async (data: { gameId: string, position: number }) => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;

      const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });
      const updated = await selectGameForSession(
        session,
        { gameId: data.gameId, position: data.position },
        { io, actorUsername: actor?.username, actorId: actor?.id }
      );
      if (!updated) {
        socket.emit('error', {
          message: `Cannot start a game from status ${session.status}`,
          currentStatus: session.status,
        });
        return;
      }

      if (session.stageMode === 'LOBBY') {
        const nextStageMode = deriveStageModeFromStatus('STARTING', session.stageMode);
        if (nextStageMode !== updated.stageMode) {
          await prisma.session.update({ where: { roomCode: code }, data: { stageMode: nextStageMode as any } });
        }
      }

      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    // Rapid Fire question timing is handled by the restart-safe question sweep
    // (services/questionSweep.ts). No per-question in-process timers exist.

    socket.on('host:select_challenge', async (data: { challengeId: string }) => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;

      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;

      // Switching to another question while one is LIVE is a legitimate host
      // action (jump to any question); every other path stays machine-guarded.
      const switchingLive = session.status === 'QUESTION_ACTIVE'
        && data.challengeId && data.challengeId !== session.currentChallengeId;
      if (!switchingLive && !canTransition(session.status, 'QUESTION_ACTIVE')) {
        socket.emit('error', {
          message: `Cannot start a question from status ${session.status}`,
          currentStatus: session.status,
        });
        return;
      }

      const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });
      const updated = await startQuestion(session, data.challengeId, { io, actorUsername: actor?.username, actorId: actor?.id });
      if (!updated) return;

      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    socket.on('host:replay_game', async () => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session || !session.currentGameId) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;
      
      const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });
      const updated = await selectGameForSession(session, {}, { io, actorUsername: actor?.username, actorId: actor?.id });
      if (!updated) {
        socket.emit('error', {
          message: `Cannot replay from status ${session.status}`,
          currentStatus: session.status,
        });
        return;
      }

      if (session.stageMode === 'LOBBY') {
        const nextStageMode = deriveStageModeFromStatus('STARTING', session.stageMode);
        if (nextStageMode !== updated.stageMode) {
          await prisma.session.update({ where: { roomCode: code }, data: { stageMode: nextStageMode as any } });
        }
      }

      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    socket.on('host:skip_game', async () => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ 
        where: { roomCode: code }, 
        include: { event: { include: { games: { orderBy: { position: 'asc' } } } } } 
      });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;
      
      const nextPos = session.currentPosition + 1;
      const nextGame = session.event.games.find((g: any) => g.position === nextPos);

      const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });

      if (nextGame) {
        const updated = await selectGameForSession(
          session,
          { gameId: nextGame.gameId, position: nextPos },
          { io, actorUsername: actor?.username, actorId: actor?.id }
        );
        if (!updated) {
          socket.emit('error', {
            message: `Cannot skip to the next game from status ${session.status}`,
            currentStatus: session.status,
          });
          return;
        }
      } else {
        // No more games — terminate the event through the idempotent gateway.
        await finalizeSession(session, { io, actorUsername: actor?.username, actorId: actor?.id });
      }

      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    socket.on('host:end_event', async () => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;

      // Idempotent, audited finalization through the lifecycle service (purging
      // chat and broadcasting live state as part of the terminal transition).
      const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });
      await finalizeSession(session, { io, actorUsername: actor?.username, actorId: actor?.id });

      if (session.stageMode === 'LOBBY') {
        const nextStageMode = deriveStageModeFromStatus('ENDED', session.stageMode);
        await prisma.session.update({ where: { roomCode: code }, data: { stageMode: nextStageMode as any } });
      }
    });

    socket.on('host:random_game', async () => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ 
        where: { roomCode: code }, 
        include: { event: { include: { games: true } } } 
      });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;
      
      const submissions = await prisma.submission.findMany({
        where: { sessionId: session.id },
        select: { challenge: { select: { gameId: true } } }
      });
      const playedGameIds = new Set(submissions.map(s => s.challenge.gameId));
      if (session.currentGameId) playedGameIds.add(session.currentGameId);
      
      const unplayedGames = session.event.games.filter((g: any) => 
        g.enabled && g.purpose === 'NORMAL' && !playedGameIds.has(g.gameId)
      );
      
      const actor = await prisma.user.findUnique({ where: { id: socket.data.userId } });

      if (unplayedGames.length > 0) {
        const randomGame = unplayedGames[Math.floor(Math.random() * unplayedGames.length)];

        const updated = await selectGameForSession(
          session,
          { gameId: randomGame.gameId, position: randomGame.position },
          { io, actorUsername: actor?.username, actorId: actor?.id }
        );
        if (!updated) {
          socket.emit('error', {
            message: `Cannot start a random game from status ${session.status}`,
            currentStatus: session.status,
          });
          return;
        }
      } else {
        // Everything played — terminate through the idempotent gateway.
        await finalizeSession(session, { io, actorUsername: actor?.username, actorId: actor?.id });
      }

      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });


    // ── STAGE JOINS ────────────────────────────────────────────────────────
    socket.on('stage:join', async (data: { roomCode?: string; sessionCode?: string }) => {
      const roomCode = data?.roomCode || data?.sessionCode;
      if (!roomCode) {
        socket.emit('error', { message: 'roomCode is required' });
        return;
      }
      const code = String(roomCode).toUpperCase();
      const userId = socket.data.userId;

      const session = await prisma.session.findUnique({
        where: { roomCode: code }
      });

      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      // STAGE role joins session room strictly as an observer
      socket.join(`session:${code}`);
      socket.data.role = 'STAGE';
      socket.data.roomCode = code;
      console.log(`[Stage] Connected to session ${code}`);

      const state = await getSessionState(code);
      socket.emit('session_state_update', state);
    });

    // ── STAGE COMMANDS (HOST ONLY) ─────────────────────────────────────────
    socket.on('host:set_stage_mode', async (data: { mode: string }) => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const VALID_STAGE_MODES = new Set([
        'LOBBY', 'ANNOUNCEMENT', 'COUNTDOWN', 'QUESTION', 'ANSWER_REVEAL',
        'LEADERBOARD', 'TEAM_LEADERBOARD', 'FINAL_RESULTS', 'PAUSED', 'BLANK'
      ]);
      if (!data?.mode || !VALID_STAGE_MODES.has(data.mode)) {
        socket.emit('error', { message: 'Invalid stage mode' });
        return;
      }

      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;
      
      await prisma.session.update({
        where: { roomCode: code },
        data: { stageMode: data.mode as any }
      });
      
      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    // ── REAL-TIME TEAM CHAT ──────────────────────────────────────────────
    socket.on('team:join', async (data?: { teamId?: string }) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('team:error', { message: 'Authentication required' });
        return;
      }

      const membership = await prisma.teamMember.findFirst({
        where: {
          userId,
          ...(data?.teamId ? { teamId: data.teamId } : {})
        },
        include: {
          team: true,
          user: { select: { username: true, name: true } }
        }
      });

      if (!membership) {
        socket.emit('team:error', { message: 'Not a member of this team' });
        return;
      }

      const teamId = membership.teamId;
      socket.join(`team:${teamId}`);
      socket.data.teamId = teamId;

      socket.emit('team:joined', {
        teamId,
        teamName: membership.team.name,
        handle: `${membership.user.username}@terminal`
      });

      io.to(`team:${teamId}`).emit('team:presence', {
        userId,
        handle: `${membership.user.username}@terminal`,
        status: 'ONLINE'
      });
    });

    socket.on('team:send_message', async (data: { content: string; teamId?: string; sessionId?: string; roomCode?: string }) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.emit('team:error', { message: 'Authentication required' });
        return;
      }

      const content = (data?.content || '').trim();
      if (!content) return;

      if (content.length > 1000) {
        socket.emit('team:error', { message: 'Message exceeds 1000 characters limit' });
        return;
      }

      // Authoritative lookup: verify caller's team membership from server DB
      const membership = await prisma.teamMember.findFirst({
        where: {
          userId,
          ...(data?.teamId ? { teamId: data.teamId } : {})
        },
        include: {
          team: true,
          user: { select: { username: true, name: true } }
        }
      });

      if (!membership) {
        socket.emit('team:error', { message: 'You are not authorized to send messages to this team' });
        return;
      }

      const teamId = membership.teamId;
      const senderHandle = `${membership.user.username}@terminal`;
      const senderName = membership.user.name || membership.user.username;

      // Scoping to active game room / session
      let targetSessionId = data?.sessionId || socket.data.sessionId;
      let targetRoomCode = data?.roomCode || socket.data.roomCode;

      if (!targetSessionId && targetRoomCode) {
        const sess = await prisma.session.findUnique({
          where: { roomCode: String(targetRoomCode).toUpperCase() }
        });
        if (sess) {
          targetSessionId = sess.id;
          targetRoomCode = sess.roomCode;
        }
      }

      if (!targetSessionId) {
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

      const msg = await prisma.teamMessage.create({
        data: {
          teamId,
          sessionId: targetSessionId || null,
          roomCode: targetRoomCode || null,
          senderId: userId,
          content
        }
      });

      const messagePayload = {
        id: msg.id,
        teamId,
        sessionId: msg.sessionId,
        roomCode: msg.roomCode,
        senderHandle,
        senderName,
        content,
        createdAt: msg.createdAt.toISOString()
      };

      // Broadcast exclusively to team channel
      io.to(`team:${teamId}`).emit('team:message', messagePayload);
    });

    socket.on('session:leave', async (data?: { roomCode?: string }) => {
      const code = (data?.roomCode || socket.data.roomCode)?.toUpperCase();
      if (code) {
        socket.leave(`session:${code}`);
        socket.data.roomCode = undefined;
        socket.data.sessionId = undefined;
        socket.emit('team:chat_cleared', { roomCode: code });
      }
    });

    socket.on('team:leave_channel', (data?: { teamId?: string }) => {
      const teamId = data?.teamId || socket.data.teamId;
      if (teamId) {
        socket.leave(`team:${teamId}`);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

      const uid = socket.data.userId;
      if (uid) {
        const wentOffline = removeUserSocket(uid, socket.id);
        if (wentOffline && socket.data.teamId) {
          io.to(`team:${socket.data.teamId}`).emit('team:presence', {
            userId: uid,
            status: 'OFFLINE'
          });
        }
      }

      if (socket.data.role === 'PLAYER' && socket.data.sessionPlayerId) {
        await prisma.sessionPlayer.update({
          where: { id: socket.data.sessionPlayerId },
          data: { status: 'DISCONNECTED' },
        }).catch(() => {});

        const code = socket.data.roomCode;
        if (code) {
          const state = await getSessionState(code);
          io.to(`session:${code}`).emit('session_state_update', state);
        }
      }
    });
  });

  // ONE restart-safe question expiration sweep for the whole process
  // (authoritative deadline = persisted Session.questionEndsAt).
  startQuestionSweep(io);
}
