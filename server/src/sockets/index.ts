import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
import { getSessionState } from '../services/sessionService';
import jwt from 'jsonwebtoken';
import { checkEventAuthorization } from '../utils/authorization';
const JWT_SECRET = process.env.JWT_SECRET || 'terminal-secret-change-in-prod';

export function setupSocketHandlers(io: Server): void {
  io.use((socket, next) => {
    const { token, isStage } = socket.handshake.auth;

    if (isStage) {
      socket.data.role = 'STAGE';
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
    console.log(`[Socket] Connected: ${socket.id}, User: ${socket.data.userId}`);

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
      socket.data.sessionPlayerId = sessionPlayer.id;

      // Ensure status is active
      await prisma.sessionPlayer.update({
        where: { id: sessionPlayer.id },
        data: { status: 'ACTIVE' }
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
      let challenge = null;
      if (targetChallengeId) {
        challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
      } else if (session.currentGameId) {
        challenge = await prisma.challenge.findFirst({
          where: { gameId: session.currentGameId },
          orderBy: { position: 'asc' }
        });
      }
      if (!challenge) return;

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
      
      try {
        const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
        if (!session) return;
        const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
        if (!isAuthorized) return;
        
        let newStatus: any = data.status;
        if (newStatus === 'FINAL') newStatus = 'ENDED';

        await prisma.session.update({
          where: { roomCode: code },
          data: { status: newStatus }
        });
        
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
      
      await prisma.session.update({
        where: { roomCode: code },
        data: { 
          currentGameId: data.gameId,
          currentPosition: data.position,
          currentChallengeId: null,
          currentRun: { increment: 1 },
          status: 'STARTING'
        }
      });
      
      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
    });

    // Helper for Rapid Fire auto progression
    const startRapidFireChallenge = async (code: string, challengeId: string) => {
      const state = await getSessionState(code);
      if (state?.currentGame?.template === 'RAPID_FIRE') {
        const challenge = state.currentGame.challenges?.find(c => c.id === challengeId);
        if (challenge?.timeLimit) {
          setTimeout(async () => {
             const currentSession = await prisma.session.findUnique({ where: { roomCode: code }});
             if (currentSession?.currentChallengeId === challengeId && currentSession.status === 'QUESTION_ACTIVE') {
                await prisma.session.update({ where: { roomCode: code }, data: { status: 'QUESTION_LOCKED' }});
                const lockedState = await getSessionState(code);
                io.to(`session:${code}`).emit('session_state_update', lockedState);
                
                setTimeout(async () => {
                   const checkSession = await prisma.session.findUnique({ where: { roomCode: code }});
                   if (checkSession?.currentChallengeId === challengeId && checkSession.status === 'QUESTION_LOCKED') {
                       const challenges = lockedState?.currentGame?.challenges || [];
                       const currentIdx = challenges.findIndex(c => c.id === challengeId);
                       const nextChallenge = challenges[currentIdx + 1];
                       
                       if (nextChallenge) {
                           await prisma.session.update({
                             where: { roomCode: code },
                             data: { currentChallengeId: nextChallenge.id, challengeStartTime: new Date(), status: 'QUESTION_ACTIVE' }
                           });
                           const nextState = await getSessionState(code);
                           io.to(`session:${code}`).emit('session_state_update', nextState);
                           // RECURSIVE CALL FOR NEXT CHALLENGE
                           startRapidFireChallenge(code, nextChallenge.id);
                       } else {
                           await prisma.session.update({
                             where: { roomCode: code },
                             data: { status: 'RESULTS' }
                           });
                           const nextState = await getSessionState(code);
                           io.to(`session:${code}`).emit('session_state_update', nextState);
                       }
                   }
                }, 4000); // 4s result view
             }
          }, challenge.timeLimit * 1000);
        }
      }
    };

    socket.on('host:select_challenge', async (data: { challengeId: string }) => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;
      
      await prisma.session.update({
        where: { roomCode: code },
        data: { 
          currentChallengeId: data.challengeId,
          challengeStartTime: new Date(),
          status: 'QUESTION_ACTIVE'
        }
      });
      
      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);

      startRapidFireChallenge(code, data.challengeId);
    });

    socket.on('host:replay_game', async () => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
      const session = await prisma.session.findUnique({ where: { roomCode: code }, include: { event: true } });
      if (!session || !session.currentGameId) return;
      const isAuthorized = await checkEventAuthorization(session.eventId, socket.data.userId);
      if (!isAuthorized) return;
      
      await prisma.session.update({
        where: { roomCode: code },
        data: { 
          currentChallengeId: null,
          currentRun: { increment: 1 },
          status: 'STARTING'
        }
      });
      
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

      await prisma.session.update({
        where: { roomCode: code },
        data: { 
          currentGameId: nextGame ? nextGame.gameId : null,
          currentPosition: nextPos,
          currentChallengeId: null,
          currentRun: { increment: 1 },
          status: nextGame ? 'STARTING' : 'ENDED',
          endedAt: nextGame ? null : new Date()
        }
      });
      
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
      
      await prisma.session.update({
        where: { roomCode: code },
        data: { 
          status: 'ENDED',
          endedAt: new Date()
        }
      });
      
      const state = await getSessionState(code);
      io.to(`session:${code}`).emit('session_state_update', state);
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
      
      if (unplayedGames.length > 0) {
        const randomGame = unplayedGames[Math.floor(Math.random() * unplayedGames.length)];
        
        await prisma.session.update({
          where: { roomCode: code },
          data: { 
            currentGameId: randomGame.gameId,
            currentPosition: randomGame.position,
            currentChallengeId: null,
            currentRun: { increment: 1 },
            status: 'STARTING'
          }
        });
      } else {
        await prisma.session.update({
          where: { roomCode: code },
          data: { status: 'ENDED', endedAt: new Date() }
        });
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
      
      const session = await prisma.session.findUnique({
        where: { roomCode: code }
      });
      
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }
      
      socket.join(`session:${code}`);
      socket.data.roomCode = code;
      console.log(`[Stage] Connected to session ${code}`);
      
      const state = await getSessionState(code);
      socket.emit('session_state_update', state);
    });

    // ── STAGE COMMANDS (HOST ONLY) ─────────────────────────────────────────
    socket.on('host:set_stage_mode', async (data: { mode: string }) => {
      if (socket.data.role !== 'HOST' || !socket.data.roomCode) return;
      const code = socket.data.roomCode;
      
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

    // ── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);

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
}
