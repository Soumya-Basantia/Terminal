import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateSessionCode } from '../utils/sessionCode';
import { getSessionState } from '../services/sessionService';
import { SessionStatus } from '@prisma/client';
import { checkEventAuthorization } from '../utils/authorization';
import { registry, Validator, ValidationContext } from '../engine';
import { validateChallengeAnswer } from '../engine/Validator';

const router = Router();

// POST /api/sessions — create a new session for an event (Game Master)
router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (user.role === 'PLAYER') {
    res.status(403).json({ error: 'Forbidden: Students cannot host sessions' });
    return;
  }

  if (user.role === 'GAME_MASTER' && user.approvalStatus !== 'APPROVED') {
    res.status(403).json({
      error: user.approvalStatus === 'PENDING'
        ? 'Account pending administrator approval'
        : 'Account has been rejected by administrator',
      approvalStatus: user.approvalStatus
    });
    return;
  }

  const { eventId } = req.body;
  if (!eventId) {
    res.status(400).json({ error: 'eventId is required' });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, status: 'PUBLISHED' },
    include: { games: { orderBy: { position: 'asc' } } }
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found or not published' });
    return;
  }

  const isAuthorized = await checkEventAuthorization(event.id, req.userId!);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden: Club Admin or Creator access required' });
    return;
  }

  // Generate unique room code
  let roomCode: string;
  let attempts = 0;
  do {
    roomCode = generateSessionCode();
    attempts++;
    if (attempts > 20) {
      res.status(500).json({ error: 'Could not generate unique session code' });
      return;
    }
  } while (await prisma.session.findUnique({ where: { roomCode } }));

  const firstGameId = event.games.length > 0 ? event.games[0].gameId : null;

  const session = await prisma.session.create({
    data: {
      roomCode,
      eventId: event.id,
      status: 'LOBBY',
      currentGameId: firstGameId,
      currentPosition: 0
    },
    include: {
      event: true
    },
  });

  res.status(201).json({ session });
});

// POST /api/sessions/join — student joins a session
router.post('/join', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { roomCode } = req.body;
  if (!roomCode) {
    res.status(400).json({ error: 'roomCode is required' });
    return;
  }

  const session = await prisma.session.findUnique({
    where: { roomCode: String(roomCode).toUpperCase() }
  });

  if (!session) {
    res.status(404).json({ error: `Room ${roomCode} not found.` });
    return;
  }

  if (session.status === 'ENDED') {
    res.status(410).json({ error: 'This event has ended.' });
    return;
  }

  if (session.status !== 'LOBBY' && session.status !== 'STARTING' && session.status !== 'ROUND_ACTIVE') {
    res.status(403).json({ error: 'This room is no longer accepting players.' });
    return;
  }

  const sessionPlayer = await prisma.sessionPlayer.upsert({
    where: {
      sessionId_userId: { sessionId: session.id, userId: req.userId! }
    },
    update: { status: 'ACTIVE' },
    create: {
      sessionId: session.id,
      userId: req.userId!
    }
  });

  // Fetch updated state and broadcast it via socket
  const io = req.app.get('io');
  if (io) {
    const updatedState = await getSessionState(session.roomCode);
    io.to(`session:${session.roomCode}`).emit('session_state_update', updatedState);
  }

  res.json({ session, sessionPlayer });
});

// GET /api/sessions/:roomCode — get session info
router.get('/:roomCode', async (req: Request, res: Response): Promise<void> => {
  const state = await getSessionState(String(req.params.roomCode).toUpperCase());
  if (!state) {
    res.status(404).json({ error: 'Session not found. Check your room code.' });
    return;
  }
  res.json(state);
});

// PUT /api/sessions/:id/status — Game Master updates status
router.put('/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;

  const session = await prisma.session.findUnique({
    where: { id: req.params.id as string },
    include: { event: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const isAuthorized = await checkEventAuthorization(session.eventId, req.userId!);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updated = await prisma.session.update({
    where: { id: req.params.id as string },
    data: { status: status as SessionStatus }
  });

  const io = req.app.get('io');
  if (io) {
    const updatedState = await getSessionState(updated.roomCode);
    io.to(`session:${updated.roomCode}`).emit('session_state_update', updatedState);
  }

  res.json({ session: updated });
});

// PUT /api/sessions/:id/advance — advance to next game in sequence
router.put('/:id/advance', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await prisma.session.findUnique({
    where: { id: req.params.id as string },
    include: { event: { include: { games: { orderBy: { position: 'asc' } } } } }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.event.clubId) {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (user?.role !== 'SUPER_ADMIN') {
      const membership = await prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: session.event.clubId, userId: req.userId! } }
      });
      if (!membership || membership.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
  } else {
    if (session.event.creatorId !== req.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const nextPos = session.currentPosition + 1;
  const nextGame = session.event.games.find(g => g.position === nextPos);

  const updated = await prisma.session.update({
    where: { id: req.params.id as string },
    data: { 
      currentPosition: nextPos,
      currentGameId: nextGame ? nextGame.gameId : null,
      status: nextGame ? 'STARTING' : 'ENDED'
    }
  });

  const io = req.app.get('io');
  if (io) {
    const updatedState = await getSessionState(updated.roomCode);
    io.to(`session:${updated.roomCode}`).emit('session_state_update', updatedState);
  }

  res.json({ session: updated });
});

// POST /api/sessions/active/submit
router.post('/active/submit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const answer = req.body.answer !== undefined 
    ? req.body.answer 
    : (req.body.actionPlan !== undefined ? { actionPlan: req.body.actionPlan } : undefined);
  
  const sessionPlayer = await prisma.sessionPlayer.findFirst({
    where: { userId: req.userId! },
    orderBy: { joinedAt: 'desc' },
    include: { session: { include: { currentGame: true } } }
  });

  if (!sessionPlayer) {
    res.status(403).json({ error: 'Not joined to any session' });
    return;
  }

  const session = sessionPlayer.session;
  const gameTemplate = registry.getTemplate(session.currentGame?.template || 'QUIZ');

  let challengeId = session.currentChallengeId;
  let statusValid = session.status === 'QUESTION_ACTIVE';

  if (gameTemplate?.progressionConfig?.type === 'CHAIN') {
    statusValid = session.status === 'ROUND_ACTIVE';
    
    const challenges = await prisma.challenge.findMany({
      where: { gameId: session.currentGameId! },
      orderBy: { position: 'asc' }
    });
    
    const successfulSubmissions = await prisma.submission.findMany({
      where: { 
        sessionId: session.id,
        runId: session.currentRun,
        isCorrect: true,
        ...(sessionPlayer.teamId ? { teamId: sessionPlayer.teamId } : { playerId: sessionPlayer.id })
      }
    });
    
    const solvedChallengeIds = new Set(successfulSubmissions.map(s => s.challengeId));
    const currentChainChallenge = challenges.find(c => !solvedChallengeIds.has(c.id));
    if (currentChainChallenge) {
      challengeId = currentChainChallenge.id;
    }
  } else if (gameTemplate?.id === 'BUG_HUNT' || gameTemplate?.id === 'THE_WITNESS' || gameTemplate?.id === 'ROGUE_SCANNER' || gameTemplate?.id === 'SILENT_MISSION' || gameTemplate?.id === 'SIGNAL_ROUTER' || gameTemplate?.id === 'THE_THRESHOLD') {
    statusValid = session.status === 'ROUND_ACTIVE' || session.status === 'QUESTION_ACTIVE';
    if (!challengeId && session.currentGameId) {
      const challenges = await prisma.challenge.findMany({
        where: { gameId: session.currentGameId },
        orderBy: { position: 'asc' }
      });
      challengeId = challenges[0]?.id || null;
    }
  }

  if (!statusValid || !challengeId) {
    res.status(400).json({ error: 'No active question accepting submissions' });
    return;
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId }
  });

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const validationType = gameTemplate?.challengeSchema?.validationType || 'EXACT';

  // Normalize single-letter answers to the actual option text if applicable
  let parsedSubmission = String(answer || '').trim();
  const config = challenge.config as any;
  if (parsedSubmission.length === 1 && /^[a-zA-Z]$/.test(parsedSubmission)) {
    const idx = parsedSubmission.toUpperCase().charCodeAt(0) - 65;
    if (config.options && config.options[idx]) {
      parsedSubmission = config.options[idx];
    }
  }

  const context: ValidationContext = {
    challengeConfig: config,
    submission: typeof answer === 'object' ? JSON.stringify(answer) : parsedSubmission,
  };

  console.log("Validation Context:", context, "Original Answer:", answer);

  const validationResult = Validator.validate(validationType, context);
  let isCorrect = validationResult.isCorrect;

  let pointsAwarded = 0;
  let responseTimeMs = 0;
  if (session.challengeStartTime) {
    responseTimeMs = Date.now() - session.challengeStartTime.getTime();
  }

  const isExploratoryGame = gameTemplate?.id === 'THE_THRESHOLD' ||
    gameTemplate?.id === 'SIGNAL_ROUTER' ||
    gameTemplate?.id === 'SILENT_MISSION' ||
    gameTemplate?.id === 'ROGUE_SCANNER' ||
    gameTemplate?.id === 'THE_WITNESS' ||
    gameTemplate?.id === 'BUG_HUNT' ||
    gameTemplate?.id === 'LOGIC_HEIST';

  // Enforce late submission rejection if timer expired and not explicitly allowed
  if (!isExploratoryGame && session.challengeStartTime && challenge.timeLimit > 0) {
    const timeLimitMs = challenge.timeLimit * 1000;
    const isLate = responseTimeMs > timeLimitMs;
    // We treat 2 seconds grace period just for network latency unless it's strictly enforced.
    // The spec says "When timer reaches zero: QUESTION LOCKED." 
    const allowLate = (session.currentGame?.config as any)?.allowLateAnswers === true;
    if (isLate && !allowLate) {
      res.status(400).json({ error: 'Submission closed' });
      return;
    }
  }

  if (isCorrect) {
    pointsAwarded = challenge.points;
    const gameConfig = (session.currentGame?.config || {}) as any;
    
    // Speed Bonus
    if (session.challengeStartTime && challenge.timeLimit > 0) {
      const timeLimitMs = challenge.timeLimit * 1000;
      if (responseTimeMs < timeLimitMs) {
        let maxSpeedBonus = 0;
        if (gameConfig.speedBonus !== undefined) {
          maxSpeedBonus = Number(gameConfig.speedBonus);
        } else if (session.currentGame?.speedBonus) {
          maxSpeedBonus = challenge.points * 0.5;
        }

        if (maxSpeedBonus > 0) {
          const bonusPct = (timeLimitMs - responseTimeMs) / timeLimitMs; // 1.0 to 0.0
          pointsAwarded += Math.floor(maxSpeedBonus * bonusPct);
        }
      }
    }

    // Streak Bonus
    if (gameConfig.streakBonus) {
      const prevSubmissions = await prisma.submission.findMany({
        where: { sessionId: session.id, playerId: sessionPlayer.id, runId: session.currentRun },
        orderBy: { submittedAt: 'desc' }
      });
      let streakCount = 1; // Including this correct answer
      for (const sub of prevSubmissions) {
        if (sub.isCorrect) streakCount++;
        else break;
      }
      
      // Store streakCount in session object temporarily to return it
      (session as any)._streakCount = streakCount;

      if (streakCount >= 3) {
        let streakPoints = Math.floor((streakCount - 1) / 2) * 5;
        const maxStreak = Number(gameConfig.maxStreakBonus);
        if (!isNaN(maxStreak) && maxStreak > 0 && streakPoints > maxStreak) {
          streakPoints = maxStreak;
        }
        pointsAwarded += streakPoints;
      }
    }
  }

  // Check if an existing submission exists for this player on this challenge & run
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

  try {
    // Build metadata for game-specific information
    let submissionMetadata: any = undefined;
    let executionTrace: any = undefined;

    if (validationType === 'STATE_MATCH') {
      // Logic Heist: compute execution trace server-side
      try {
        const parsed = typeof answer === 'object' ? answer : JSON.parse(String(answer));
        const { Validator: V } = require('../engine');
        const traceResult = V.executeSequence(
          config.blocks || [],
          parsed.sequence || [],
          config.initialState || {}
        );
        executionTrace = traceResult;
        submissionMetadata = {
          attempts: parsed.attempts || 1,
          hintsUsed: parsed.hintsUsed || 0,
          blocksUsed: (parsed.sequence || []).length,
          executionTrace: traceResult,
        };
      } catch {
        // If we can't parse metadata, still save the submission
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'BUG_HUNT' || gameTemplate?.id === 'BUG_HUNT') {
      // Dead Code: compute regression suite trace server-side
      try {
        const parsed = typeof answer === 'object' ? answer : JSON.parse(String(answer));
        const { Validator: V } = require('../engine');
        const validationDetails = V.validateBugHunt({ challengeConfig: config, submission: parsed });
        executionTrace = validationDetails.details;
        submissionMetadata = {
          attempts: parsed.attempts || 1,
          hypothesis: parsed.hypothesis,
          hypothesisCorrect: validationDetails.details?.hypothesisCorrect,
          patchedRuleId: parsed.patchedRuleId || parsed.ruleId,
          patch: parsed.patch,
          reproduced: Boolean(parsed.reproduced),
          experimentsRun: parsed.experimentsRun || 0,
          regressionResult: validationDetails.details,
          executionTrace: validationDetails.details,
        };
      } catch {
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'PIPELINE_MATCH' || config.dock) {
      try {
        const parsed = typeof answer === 'object' ? answer : JSON.parse(String(answer));
        const { Validator: V } = require('../engine');
        const validationDetails = V.validatePipeline({ challengeConfig: config, submission: parsed });
        executionTrace = validationDetails.details;
        submissionMetadata = {
          dockState: validationDetails.details,
          completedConnections: validationDetails.details?.completedConnections || [],
          energyRemaining: validationDetails.details?.energyRemaining,
          executionTrace: validationDetails.details,
        };
      } catch {
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'THE_WITNESS' || gameTemplate?.id === 'THE_WITNESS') {
      try {
        const parsed = typeof answer === 'object' ? answer : JSON.parse(String(answer));
        const { Validator: V } = require('../engine');
        const validationResult = V.validateTheWitness({ challengeConfig: config, submission: parsed });
        isCorrect = validationResult.isCorrect;

        const priorMeta = (existingSub?.metadata as any) || {};
        submissionMetadata = {
          ...priorMeta,
          accusedSuspectId: parsed.accusedSuspectId || parsed.suspectId || parsed.id || parsed.answer,
          accusedSuspectName: parsed.accusedSuspectName || parsed.name,
          isSolved: isCorrect,
          isAccused: true,
        };
      } catch {
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'ROGUE_SCANNER' || gameTemplate?.id === 'ROGUE_SCANNER') {
      try {
        const parsed = typeof answer === 'object' ? answer : JSON.parse(String(answer));
        const { Validator: V } = require('../engine');
        const validationResult = V.validateRogueScanner({ challengeConfig: config, submission: parsed });
        isCorrect = validationResult.isCorrect;

        const priorMeta = (existingSub?.metadata as any) || {};
        const priorIncorrect = Number(priorMeta.priorIncorrectAccusations || 0) + (isCorrect ? 0 : 1);
        submissionMetadata = {
          ...priorMeta,
          accusedEventId: parsed.anomalousEventId || parsed.eventId || parsed.targetEventId || parsed.answer,
          anomalyMechanism: parsed.anomalyMechanism || parsed.mechanism,
          supportingEvidence: parsed.supportingEvidence || parsed.corroboratingClue || parsed.clue,
          hasCorroboratingClue: validationResult.details?.hasCorroboratingClue || false,
          isSolved: isCorrect,
          isAccused: true,
          priorIncorrectAccusations: priorIncorrect,
        };
      } catch {
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'SILENT_MISSION' || gameTemplate?.id === 'SILENT_MISSION') {
      try {
        const payload = (req.body as any).actionPlan !== undefined
          ? req.body
          : (typeof answer === 'object' && answer !== null ? answer : JSON.parse(String(answer || '{}')));
        const actionPlan = Array.isArray(payload.actionPlan)
          ? payload.actionPlan
          : (Array.isArray(payload) ? payload : (Array.isArray(payload.actions) ? payload.actions : []));
        const { Validator: V } = require('../engine');
        const prevFailedRuns = Number((existingSub?.metadata as any)?.failedRunsCount || 0);
        const currentAttempt = existingSub ? Number((existingSub.metadata as any)?.attempts || 1) + 1 : 1;
        const sim = V.simulateMissionPlan(config, actionPlan, currentAttempt, prevFailedRuns);
        isCorrect = sim.isSuccess;
        executionTrace = sim.executionTrace;

        const priorMeta = (existingSub?.metadata as any) || {};
        submissionMetadata = {
          ...priorMeta,
          actionPlan,
          simulation: sim,
          scoreBreakdown: sim.scoreBreakdown,
          executionTrace: sim.executionTrace,
          remainingBattery: sim.remainingBattery,
          totalBatterySpent: sim.totalBatterySpent,
          targetAchieved: sim.targetAchieved,
          failedStepIndex: sim.failedStepIndex,
          failureExplanation: sim.failureExplanation,
          failedRunsCount: isCorrect ? prevFailedRuns : prevFailedRuns + 1,
          isSolved: isCorrect,
          lastExecutedAt: Date.now(),
        };
      } catch {
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'SIGNAL_ROUTER' || gameTemplate?.id === 'SIGNAL_ROUTER') {
      try {
        const payload = (req.body as any).route !== undefined
          ? req.body
          : (typeof answer === 'object' && answer !== null ? answer : JSON.parse(String(answer || '{}')));
        const routeNodes = Array.isArray(payload.route)
          ? payload.route
          : (Array.isArray(payload.nodes) ? payload.nodes : (Array.isArray(payload) ? payload : []));
        const { Validator: V } = require('../engine');
        const prevFailedRuns = Number((existingSub?.metadata as any)?.failedRunsCount || 0);
        const currentAttempt = existingSub ? Number((existingSub.metadata as any)?.attempts || 1) + 1 : 1;
        const sim = V.simulateSignalRoute(config, routeNodes, currentAttempt, prevFailedRuns, false);
        isCorrect = sim.isSuccess;

        const priorMeta = (existingSub?.metadata as any) || {};
        submissionMetadata = {
          ...priorMeta,
          route: routeNodes,
          simulation: sim,
          totalLatencyMs: sim.totalLatencyMs,
          totalPacketLossPercent: sim.totalPacketLossPercent,
          bottleneckLink: sim.bottleneckLink,
          failureTier: sim.failureTier,
          failedRunsCount: isCorrect ? prevFailedRuns : prevFailedRuns + 1,
          isSolved: isCorrect,
          lastTransmittedAt: Date.now(),
        };
      } catch {
        submissionMetadata = { parseError: true };
      }
    } else if (validationType === 'THE_THRESHOLD' || gameTemplate?.id === 'THE_THRESHOLD') {
      try {
        const payload = typeof answer === 'object' && answer !== null ? answer : JSON.parse(String(answer || '{}'));
        const rawThreshold = payload.threshold !== undefined ? payload.threshold : payload.value;
        if (rawThreshold === undefined || rawThreshold === null || rawThreshold === '' || isNaN(Number(rawThreshold))) {
          res.status(400).json({ error: 'Threshold is required and must be a number between 0 and 100' });
          return;
        }
        const threshold = Number(rawThreshold);
        if (threshold < 0 || threshold > 100) {
          res.status(400).json({ error: 'Threshold must be between 0 and 100' });
          return;
        }

        const phase = Number(payload.phase ?? (payload.isPhase2 ? 2 : 1));
        if (isNaN(phase) || (phase !== 1 && phase !== 2)) {
          res.status(400).json({ error: 'Phase must be 1 or 2' });
          return;
        }
        const isProbe = Boolean(payload.isProbe);

        const priorMeta = (existingSub?.metadata as any) || {};
        const maxProbes = Number(config.probeTokens ?? 3);
        const probesRemaining = priorMeta.probesRemaining !== undefined ? Number(priorMeta.probesRemaining) : maxProbes;

        if (phase === 2 && !priorMeta.phase1Completed) {
          res.status(400).json({ error: 'Phase 1 calibration required before Phase 2' });
          return;
        }

        if (isProbe && probesRemaining <= 0) {
          res.status(400).json({ error: 'No probe tokens remaining' });
          return;
        }

        const { Validator: V } = require('../engine');
        const evalResult = V.evaluateThreshold(config, threshold, phase);

        if (isProbe) {
          const updatedProbes = probesRemaining - 1;
          const updatedMeta = {
            ...priorMeta,
            probesRemaining: updatedProbes,
            probesUsed: (priorMeta.probesUsed || 0) + 1,
            lastProbe: {
              phase,
              threshold,
              confusionMatrix: { tp: evalResult.tp, fp: evalResult.fp, tn: evalResult.tn, fn: evalResult.fn },
              totalLoss: evalResult.totalLoss,
              withinBudget: evalResult.withinBudget,
              timestamp: Date.now(),
            },
          };

          await prisma.submission.upsert({
            where: {
              sessionId_challengeId_playerId_runId: {
                sessionId: session.id,
                challengeId: challenge.id,
                playerId: sessionPlayer.id,
                runId: session.currentRun,
              }
            },
            update: { metadata: updatedMeta },
            create: {
              sessionId: session.id,
              challengeId: challenge.id,
              playerId: sessionPlayer.id,
              runId: session.currentRun,
              answer: JSON.stringify({ isProbe: true, phase, threshold }),
              isCorrect: false,
              score: 0,
              responseTime: responseTimeMs,
              teamId: sessionPlayer.teamId,
              metadata: updatedMeta,
            }
          });

          res.json({
            isProbe: true,
            phase,
            threshold,
            confusionMatrix: { tp: evalResult.tp, fp: evalResult.fp, tn: evalResult.tn, fn: evalResult.fn },
            totalLoss: evalResult.totalLoss,
            withinBudget: evalResult.withinBudget,
            failureTier: evalResult.failureTier,
            probesRemaining: updatedProbes,
          });
          return;
        }

        const isPhase1 = phase === 1;
        const hasPhase2 = Boolean(config.phase2Shift);
        const prevFailedRuns = Number(priorMeta.failedRunsCount || 0);
        const failedRunsCount = evalResult.withinBudget ? prevFailedRuns : prevFailedRuns + 1;

        if (isPhase1) {
          isCorrect = evalResult.withinBudget && !hasPhase2;
          submissionMetadata = {
            ...priorMeta,
            probesRemaining,
            phase1Threshold: threshold,
            phase1Cost: evalResult.totalLoss,
            phase1ConfusionMatrix: { tp: evalResult.tp, fp: evalResult.fp, tn: evalResult.tn, fn: evalResult.fn },
            phase1Completed: evalResult.withinBudget,
            activePhase: evalResult.withinBudget && hasPhase2 ? 2 : 1,
            lastEvaluation: evalResult,
            isSolved: isCorrect,
            failedRunsCount,
          };
        } else {
          isCorrect = evalResult.withinBudget;
          submissionMetadata = {
            ...priorMeta,
            probesRemaining,
            phase2Threshold: threshold,
            phase2Cost: evalResult.totalLoss,
            phase2ConfusionMatrix: { tp: evalResult.tp, fp: evalResult.fp, tn: evalResult.tn, fn: evalResult.fn },
            phase2Completed: evalResult.withinBudget,
            activePhase: evalResult.withinBudget ? 'COMPLETED' : 2,
            lastEvaluation: evalResult,
            isSolved: isCorrect,
            failedRunsCount,
          };
        }
      } catch {
        submissionMetadata = { parseError: true };
      }
    }

    if (existingSub && existingSub.isCorrect) {
      res.status(400).json({ error: 'Already submitted' });
      return;
    }

    if (existingSub && gameTemplate?.id !== 'LOGIC_HEIST' && gameTemplate?.id !== 'BUG_HUNT' && gameTemplate?.id !== 'THE_WITNESS' && gameTemplate?.id !== 'ROGUE_SCANNER' && gameTemplate?.id !== 'SILENT_MISSION' && gameTemplate?.id !== 'SIGNAL_ROUTER' && gameTemplate?.id !== 'THE_THRESHOLD' && gameTemplate?.id !== 'TEAM_CHALLENGE' && !config.dock && !(session.currentGame?.config as any)?.allowMultipleAttempts) {
      res.status(400).json({ error: 'Already submitted' });
      return;
    }

    const maxAttempts = config.allowedAttempts || 5;
    let attemptNumber = 1;
    if (existingSub) {
      const prevAttempts = (existingSub.metadata as any)?.attempts || 1;
      attemptNumber = prevAttempts + 1;
    }
    if (typeof answer === 'object' && answer?.attempts) {
      attemptNumber = Math.max(attemptNumber, Number(answer.attempts));
    }

    if (attemptNumber > maxAttempts) {
      res.status(400).json({ error: 'Maximum attempts reached' });
      return;
    }

    if (gameTemplate?.id === 'LOGIC_HEIST' && isCorrect) {
      let multiplier = 1.0;
      if (attemptNumber === 2) multiplier = 0.7;
      else if (attemptNumber >= 3) multiplier = 0.5;

      let calculatedPoints = challenge.points * multiplier;

      // Hint penalty: -20% per hint used
      const hintsUsed = Number(submissionMetadata?.hintsUsed || 0);
      if (hintsUsed > 0) {
        calculatedPoints = Math.max(0, calculatedPoints * (1 - 0.2 * hintsUsed));
      }

      // Efficiency bonus: +15% if blocksUsed < total blocks
      const totalBlocks = (config.blocks || []).length;
      const blocksUsed = Number(submissionMetadata?.blocksUsed || 0);
      if (totalBlocks > 0 && blocksUsed > 0 && blocksUsed < totalBlocks) {
        calculatedPoints += challenge.points * 0.15;
      }

      // Speed bonus: +15% if solved in first half of time limit
      if (challenge.timeLimit > 0 && responseTimeMs < (challenge.timeLimit * 1000) / 2) {
        calculatedPoints += challenge.points * 0.15;
      }

      pointsAwarded = Math.round(calculatedPoints);
    } else if (gameTemplate?.id === 'BUG_HUNT' && isCorrect) {
      let multiplier = 1.0;
      if (attemptNumber === 2) multiplier = 0.8;
      else if (attemptNumber >= 3) multiplier = 0.6;

      let calculatedPoints = challenge.points * multiplier;

      // Hypothesis bonus: +15% if hypothesis correctly identified the faulty rule
      if (submissionMetadata?.hypothesisCorrect) {
        calculatedPoints += challenge.points * 0.15;
      }

      // Reproduction bonus: +10% if student reproduced the bug
      if (submissionMetadata?.reproduced) {
        calculatedPoints += challenge.points * 0.10;
      }

      // Speed bonus: +10% if solved in first half of time limit
      if (challenge.timeLimit > 0 && responseTimeMs < (challenge.timeLimit * 1000) / 2) {
        calculatedPoints += challenge.points * 0.10;
      }

      pointsAwarded = Math.round(calculatedPoints);
    } else if ((gameTemplate?.id === 'TEAM_CHALLENGE' || config.dock) && isCorrect) {
      let calculatedPoints = challenge.points;
      const remainingEnergy = Number(submissionMetadata?.energyRemaining || 0);
      if (remainingEnergy > 0) {
        calculatedPoints += Math.min(25, remainingEnergy * 5);
      }
      if (challenge.timeLimit > 0 && responseTimeMs < (challenge.timeLimit * 1000) / 2) {
        calculatedPoints += challenge.points * 0.15;
      }
      pointsAwarded = Math.round(calculatedPoints);
    } else if (gameTemplate?.id === 'THE_WITNESS' && isCorrect) {
      let calculatedPoints = challenge.points;
      const questionsRemaining = Number(submissionMetadata?.questionsRemaining ?? 0);
      
      // Query conservation bonus: 20 pts per unused question
      if (questionsRemaining > 0) {
        calculatedPoints += questionsRemaining * 20;
      }

      // Efficiency bonus: if average reduction >= 35%
      const history = Array.isArray(submissionMetadata?.inquiryHistory) ? submissionMetadata.inquiryHistory : [];
      if (history.length > 0) {
        let totalReductionRate = 0;
        let runningActive = (config.suspects || []).length;
        for (const h of history) {
          const elim = Array.isArray(h.eliminatedSuspectIds) ? h.eliminatedSuspectIds.length : 0;
          if (runningActive > 0) {
            totalReductionRate += elim / runningActive;
            runningActive = Math.max(1, runningActive - elim);
          }
        }
        const avgReduction = totalReductionRate / history.length;
        if (avgReduction >= 0.35) {
          calculatedPoints += Math.round(challenge.points * 0.15); // +15% Grand Detective bonus
        }
      }

      pointsAwarded = Math.round(calculatedPoints);
    } else if (gameTemplate?.id === 'ROGUE_SCANNER' || validationType === 'ROGUE_SCANNER') {
      const scoringConfig = (config.scoring || {}) as any;
      const basePoints = scoringConfig.basePoints !== undefined ? Number(scoringConfig.basePoints) : 100;
      const corroboratingBonus = scoringConfig.corroboratingBonus !== undefined ? Number(scoringConfig.corroboratingBonus) : 30;
      const tokenBonusPerUnit = scoringConfig.tokenBonusPerUnit !== undefined ? Number(scoringConfig.tokenBonusPerUnit) : 10;
      const cleanSheetBonus = scoringConfig.cleanSheetBonus !== undefined ? Number(scoringConfig.cleanSheetBonus) : 20;
      const incorrectPenalty = scoringConfig.incorrectPenalty !== undefined ? Number(scoringConfig.incorrectPenalty) : -40;

      if (isCorrect) {
        let calculatedPoints = basePoints;

        // Corroborating clue bonus: +30
        if (submissionMetadata?.hasCorroboratingClue) {
          calculatedPoints += corroboratingBonus;
        }

        // Unused investigation tokens: +10 each
        const tokensRemaining = Number(submissionMetadata?.actionTokensRemaining ?? 0);
        if (tokensRemaining > 0) {
          calculatedPoints += tokensRemaining * tokenBonusPerUnit;
        }

        // Clean Sheet: +20 if solved on first attempt without prior incorrect attempts
        const priorIncorrectAccusations = Number((existingSub?.metadata as any)?.priorIncorrectAccusations || 0);
        if (priorIncorrectAccusations === 0) {
          calculatedPoints += cleanSheetBonus;
        }

        pointsAwarded = Math.round(calculatedPoints);
      } else {
        // Incorrect accusation penalty: -40
        pointsAwarded = incorrectPenalty;
      }
    } else if (gameTemplate?.id === 'SILENT_MISSION') {
      const scoringConfig = (config.scoring || {}) as any;
      const basePoints = scoringConfig.basePoints !== undefined ? Number(scoringConfig.basePoints) : 100;
      const batteryBonusPerUnit = scoringConfig.batteryBonusPerUnit !== undefined ? Number(scoringConfig.batteryBonusPerUnit) : 10;
      const firstRunBonus = scoringConfig.firstRunBonus !== undefined ? Number(scoringConfig.firstRunBonus) : 30;
      const cleanSheetBonus = scoringConfig.cleanSheetBonus !== undefined ? Number(scoringConfig.cleanSheetBonus) : 20;
      const retryPenalty = scoringConfig.retryPenalty !== undefined ? Number(scoringConfig.retryPenalty) : -15;

      if (isCorrect) {
        let calculatedPoints = basePoints;
        const remainingBattery = Number(submissionMetadata?.remainingBattery ?? 0);
        calculatedPoints += remainingBattery * batteryBonusPerUnit;

        if (attemptNumber === 1) {
          calculatedPoints += firstRunBonus;
        }

        const failedPriorRuns = Number(submissionMetadata?.failedRunsCount ?? (attemptNumber - 1));
        if (failedPriorRuns === 0) {
          calculatedPoints += cleanSheetBonus;
        }

        pointsAwarded = Math.round(calculatedPoints);
      } else {
        pointsAwarded = retryPenalty;
      }
    } else if (gameTemplate?.id === 'SIGNAL_ROUTER') {
      const sim = submissionMetadata?.simulation;
      if (sim?.scoreBreakdown) {
        pointsAwarded = isCorrect ? sim.scoreBreakdown.totalScore : -sim.scoreBreakdown.penalty;
      } else {
        pointsAwarded = isCorrect ? challenge.points : 0;
      }
    } else if (gameTemplate?.id === 'THE_THRESHOLD') {
      const lastEval = submissionMetadata?.lastEvaluation;
      const scoringConfig = (config.scoring || {}) as any;
      const basePoints = scoringConfig.basePoints !== undefined ? Number(scoringConfig.basePoints) : challenge.points;
      const cleanSheetBonus = scoringConfig.cleanSheetBonus !== undefined ? Number(scoringConfig.cleanSheetBonus) : 20;
      const retryPenalty = scoringConfig.retryPenalty !== undefined ? Number(scoringConfig.retryPenalty) : -15;
      const unusedProbeBonus = scoringConfig.unusedProbeBonus !== undefined ? Number(scoringConfig.unusedProbeBonus) : 10;
      const maxProbes = Number(config.probeTokens ?? 3);
      const probesLeft = submissionMetadata?.probesRemaining !== undefined ? Number(submissionMetadata.probesRemaining) : maxProbes;
      const failedPriorRuns = Number(submissionMetadata?.failedRunsCount ?? 0);

      if (isCorrect) {
        let score = lastEval?.totalScore !== undefined ? Number(lastEval.totalScore) : basePoints;
        score += probesLeft * unusedProbeBonus;
        if (failedPriorRuns === 0) {
          score += cleanSheetBonus;
        }
        pointsAwarded = Math.round(score);
      } else if (lastEval && !lastEval.withinBudget) {
        pointsAwarded = retryPenalty;
      } else {
        pointsAwarded = 0;
      }
    }

    if (submissionMetadata) {
      submissionMetadata.attempts = attemptNumber;
    }

    const submission = await prisma.submission.upsert({
      where: {
        sessionId_challengeId_playerId_runId: {
          sessionId: session.id,
          challengeId: challenge.id,
          playerId: sessionPlayer.id,
          runId: session.currentRun,
        }
      },
      update: {
        answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer || ''),
        isCorrect,
        score: pointsAwarded,
        responseTime: responseTimeMs,
        metadata: submissionMetadata || undefined,
      },
      create: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
        answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer || ''),
        isCorrect,
        score: pointsAwarded,
        responseTime: responseTimeMs,
        teamId: sessionPlayer.teamId,
        metadata: submissionMetadata || undefined,
      }
    });

    const io = req.app.get('io');
    if (io) {
      const state = await getSessionState(session.roomCode);
      io.to(`session:${session.roomCode}`).emit('session_state_update', state);
    }

    res.json({ 
      submission, 
      isCorrect, 
      pointsAwarded,
      isChainReaction: gameTemplate?.progressionConfig?.type === 'CHAIN',
      isRapidFire: gameTemplate?.id === 'RAPID_FIRE',
      isBugHunt: gameTemplate?.id === 'BUG_HUNT',
      isWitness: gameTemplate?.id === 'THE_WITNESS',
      isRogueScanner: gameTemplate?.id === 'ROGUE_SCANNER',
      isSilentMission: gameTemplate?.id === 'SILENT_MISSION',
      isSignalRouter: gameTemplate?.id === 'SIGNAL_ROUTER',
      isThreshold: gameTemplate?.id === 'THE_THRESHOLD',
      streak: (session as any)._streakCount || 0,
      executionTrace,
      regressionResult: executionTrace,
      simulation: (submissionMetadata as any)?.simulation,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Already submitted' });
    } else {
      console.error('Submit error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// POST /api/sessions/:code/submit
router.post('/:code/submit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const { answer } = req.body;

  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.status !== 'QUESTION_ACTIVE' || !session.currentChallengeId) {
    res.status(400).json({ error: 'No active question accepting submissions' });
    return;
  }

  const sessionPlayer = await prisma.sessionPlayer.findFirst({
    where: { session: { roomCode: code }, userId: req.userId! }
  });

  if (!sessionPlayer) {
    res.status(403).json({ error: 'Not joined to session' });
    return;
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: session.currentChallengeId }
  });

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  // Check correctness
  const isCorrect = validateChallengeAnswer(challenge, answer);

  let pointsAwarded = 0;
  let responseTimeMs = 0;
  if (session.challengeStartTime) {
    responseTimeMs = Date.now() - session.challengeStartTime.getTime();
  }

  if (isCorrect) {
    pointsAwarded = challenge.points;
    if (session.currentGame?.speedBonus && session.challengeStartTime) {
      const timeLimitMs = challenge.timeLimit * 1000;
      if (responseTimeMs < timeLimitMs) {
        const bonusPct = (timeLimitMs - responseTimeMs) / timeLimitMs; // 1.0 to 0.0
        pointsAwarded += Math.floor((challenge.points * 0.5) * bonusPct);
      }
    }
  }

  try {
    const submission = await prisma.submission.create({
      data: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        answer: String(answer || ''),
        isCorrect,
        score: pointsAwarded,
        responseTime: responseTimeMs,
        teamId: sessionPlayer.teamId
      }
    });

    res.json({ 
      submission,
      isCorrect,
      pointsAwarded,
      isRapidFire: session.currentGame?.template === 'RAPID_FIRE',
      streak: 0,
      isChainReaction: false
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Already submitted' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// POST /api/sessions/:code/start — Host starts the round
router.post('/:code/start', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: { include: { challenges: { orderBy: { position: 'asc' } } } }, event: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const isAuthorized = await checkEventAuthorization(session.eventId, req.userId!);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const firstChallengeId = session.currentGame?.challenges?.[0]?.id || null;

  const updated = await prisma.session.update({
    where: { roomCode: code },
    data: {
      status: 'ROUND_ACTIVE',
      currentChallengeId: session.currentChallengeId || firstChallengeId,
      challengeStartTime: new Date(),
    }
  });

  const io = req.app.get('io');
  if (io) {
    const updatedState = await getSessionState(code);
    io.to(`session:${code}`).emit('session_state_update', updatedState);
  }

  res.json({ success: true, session: updated });
});

// POST /api/sessions/:code/next — Host advances to next challenge
router.post('/:code/next', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: { include: { challenges: { orderBy: { position: 'asc' } } } }, event: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const isAuthorized = await checkEventAuthorization(session.eventId, req.userId!);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const challenges = session.currentGame?.challenges || [];
  const currentIdx = challenges.findIndex(c => c.id === session.currentChallengeId);
  const nextChallenge = challenges[currentIdx + 1] || challenges[0];

  const updated = await prisma.session.update({
    where: { roomCode: code },
    data: {
      currentChallengeId: nextChallenge ? nextChallenge.id : null,
      challengeStartTime: new Date(),
      status: 'ROUND_ACTIVE',
    }
  });

  const io = req.app.get('io');
  if (io) {
    const updatedState = await getSessionState(code);
    io.to(`session:${code}`).emit('session_state_update', updatedState);
  }

  res.json({ success: true, session: updated });
});

// POST /api/sessions/:code/answer — Unified answer endpoint for clients
router.post('/:code/answer', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: { include: { challenges: { orderBy: { position: 'asc' } } } } }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const sessionPlayer = await prisma.sessionPlayer.findFirst({
    where: { sessionId: session.id, userId: req.userId! }
  });

  if (!sessionPlayer) {
    res.status(403).json({ error: 'Not joined to session' });
    return;
  }

  const gameTemplate = registry.getTemplate(session.currentGame?.template || 'QUIZ');
  const validationType = req.body.validationType || gameTemplate?.challengeSchema?.validationType || 'EXACT';

  let challengeId = req.body.challengeId || session.currentChallengeId;
  if (!challengeId && session.currentGame?.challenges?.length) {
    challengeId = session.currentGame.challenges[0].id;
  }

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;

  if (validationType === 'SIGNAL_ROUTER' || gameTemplate?.id === 'SIGNAL_ROUTER') {
    const rawRoute = req.body.route !== undefined 
      ? req.body.route 
      : (req.body.answer?.route || (Array.isArray(req.body.answer) ? req.body.answer : []));
    const route = Array.isArray(rawRoute) ? rawRoute : [];

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

    const priorMeta = (existingSub?.metadata as any) || {};
    const attemptNumber = Number(priorMeta.attempts || 0) + 1;
    const prevFailedRuns = Number(priorMeta.failedRunsCount || 0);

    const { Validator: V } = require('../engine');
    const sim = V.simulateSignalRoute(config, route, attemptNumber, prevFailedRuns, false);
    const isCorrect = sim.isSuccess;
    const pointsAwarded = sim.scoreBreakdown.totalScore;
    const maxProbes = Number(config.probeTokens || 3);
    const probesRemaining = priorMeta.probesRemaining !== undefined ? Number(priorMeta.probesRemaining) : maxProbes;

    const updatedMeta = {
      ...priorMeta,
      route,
      simulation: sim,
      totalLatencyMs: sim.totalLatencyMs,
      totalPacketLossPercent: sim.totalPacketLossPercent,
      bottleneckLink: sim.bottleneckLink,
      failureTier: sim.failureTier,
      failedRunsCount: isCorrect ? prevFailedRuns : prevFailedRuns + 1,
      attempts: attemptNumber,
      isCompleted: isCorrect,
      probesRemaining,
      lastTransmittedAt: Date.now(),
    };

    const submission = await prisma.submission.upsert({
      where: {
        sessionId_challengeId_playerId_runId: {
          sessionId: session.id,
          challengeId: challenge.id,
          playerId: sessionPlayer.id,
          runId: session.currentRun,
        }
      },
      update: {
        answer: JSON.stringify({ route }),
        isCorrect,
        score: pointsAwarded,
        metadata: updatedMeta,
      },
      create: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
        answer: JSON.stringify({ route }),
        isCorrect,
        score: pointsAwarded,
        responseTime: 0,
        teamId: sessionPlayer.teamId,
        metadata: updatedMeta,
      }
    });

    const io = req.app.get('io');
    if (io) {
      const state = await getSessionState(session.roomCode);
      io.to(`session:${session.roomCode}`).emit('session_state_update', state);
    }

    res.json({
      success: true,
      isCorrect,
      pointsAwarded,
      score: pointsAwarded,
      simulation: sim,
      details: { simulation: sim },
      submission,
    });
    return;
  }

  // Fallback for standard challenges
  const answer = req.body.answer !== undefined ? req.body.answer : req.body;
  const isCorrect = validateChallengeAnswer(challenge, answer);
  const pointsAwarded = isCorrect ? challenge.points : 0;

  const submission = await prisma.submission.create({
    data: {
      sessionId: session.id,
      challengeId: challenge.id,
      playerId: sessionPlayer.id,
      answer: String(typeof answer === 'object' ? JSON.stringify(answer) : answer),
      isCorrect,
      score: pointsAwarded,
      responseTime: 0,
      teamId: sessionPlayer.teamId,
    }
  });

  res.json({
    success: true,
    isCorrect,
    pointsAwarded,
    score: pointsAwarded,
    submission,
  });
});

// POST /api/sessions/:code/experiment
router.post('/:code/experiment', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const { challengeId, input } = req.body;

  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Look up challenge
  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const rules = config.rules || [];
  const { Validator: V } = require('../engine');
  const evalResult = V.evaluateBugHuntRules(rules, input, config.defaultOutput || 'UNKNOWN');

  // Check reproduction
  let isReproduction = false;
  if (config.reproduction?.input && config.reproduction?.actual) {
    const reproInput = config.reproduction.input;
    const matchesReproInput = Object.keys(reproInput).every(k =>
      Number(reproInput[k]) === Number(input?.[k]) || String(reproInput[k]) === String(input?.[k])
    );
    if (matchesReproInput && String(evalResult.output).trim().toLowerCase() === String(config.reproduction.actual).trim().toLowerCase()) {
      isReproduction = true;
    }
  }

  res.json({
    input,
    output: evalResult.output,
    matchedRuleId: evalResult.matchedRuleId,
    isReproduction,
  });
});

// POST /api/sessions/:code/dock-action
router.post('/:code/dock-action', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const { challengeId, action, sourceNodeId, targetNodeId } = req.body;

  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const sessionPlayer = await prisma.sessionPlayer.findFirst({
    where: { session: { roomCode: code }, userId: req.userId! }
  });

  if (!sessionPlayer) {
    res.status(403).json({ error: 'Not joined to session' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const dockConfig = config.dock || config;
  if (!dockConfig || !dockConfig.nodes || !dockConfig.transitions) {
    res.status(400).json({ error: 'Challenge does not have dock configuration' });
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
    action: action || 'CONNECT',
    sourceNodeId,
    targetNodeId,
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

  const io = req.app.get('io');
  if (io) {
    const updatedState = await getSessionState(session.roomCode);
    io.to(`session:${session.roomCode}`).emit('session_state_update', updatedState);
  }

  res.json({
    valid: evalResult.valid,
    consequence: evalResult.consequence,
    state: updatedDockState,
    isCompleted: updatedDockState.isCompleted,
    pointsAwarded,
  });
});

// GET /api/sessions/:code/dock-state
router.get('/:code/dock-state', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const code = (req.params.code as string).toUpperCase();
  const session = await prisma.session.findUnique({
    where: { roomCode: code },
    include: { currentGame: true }
  });

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const sessionPlayer = await prisma.sessionPlayer.findFirst({
    where: { session: { roomCode: code }, userId: req.userId! }
  });

  if (!sessionPlayer) {
    res.status(403).json({ error: 'Not joined to session' });
    return;
  }

  const challengeId = session.currentChallengeId;
  let challenge = null;
  if (challengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const dockConfig = config.dock || config;
  const initialNodes = dockConfig.initialNodes || dockConfig.availableNodes || [];
  const maxEnergy = dockConfig.resourceBudget?.energy ?? 6;

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

  const dockState = existingSub?.metadata && (existingSub.metadata as any).dockState
    ? (existingSub.metadata as any).dockState
    : {
        unlockedNodes: [...initialNodes],
        completedConnections: [],
        energyRemaining: maxEnergy,
        consequences: [],
        isCompleted: false,
      };

  res.json({ dockState, challengeId: challenge.id });
});

// Canonical helper to resolve session and sessionPlayer across custom challenge endpoints
async function resolvePlayerSession(req: AuthRequest, codeParam?: string | string[], requireEnrolled: boolean = false) {
  const code = String(codeParam || '').toUpperCase();
  let session: any = null;
  let sessionPlayer: any = null;

  if (code === 'ACTIVE') {
    sessionPlayer = await prisma.sessionPlayer.findFirst({
      where: { userId: req.userId! },
      orderBy: { joinedAt: 'desc' },
      include: { session: { include: { currentGame: true } } }
    });
    if (sessionPlayer) session = sessionPlayer.session;
  } else {
    session = await prisma.session.findUnique({
      where: { roomCode: code },
      include: { currentGame: true }
    });
    if (session) {
      sessionPlayer = await prisma.sessionPlayer.findFirst({
        where: { sessionId: session.id, userId: req.userId! }
      });
      if (!sessionPlayer && !requireEnrolled) {
        sessionPlayer = await prisma.sessionPlayer.create({
          data: {
            sessionId: session.id,
            userId: req.userId!,
            status: 'ACTIVE'
          }
        });
      }
    }
  }

  return { session, sessionPlayer };
}

const resolveWitnessSession = (req: AuthRequest, codeParam?: string | string[]) => resolvePlayerSession(req, codeParam, false);
const resolveScannerSession = resolvePlayerSession;

// POST /api/sessions/:code/witness-query
router.post('/:code/witness-query', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { challengeId, query } = req.body;
  if (!query || !query.attribute || !query.operator) {
    res.status(400).json({ error: 'Invalid query payload' });
    return;
  }

  const { session, sessionPlayer } = await resolveWitnessSession(req, req.params.code);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  if (session.status !== 'ROUND_ACTIVE' && session.status !== 'QUESTION_ACTIVE') {
    res.status(400).json({ error: 'Investigation is not currently active' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const suspects: Array<Record<string, any>> = Array.isArray(config.suspects) ? config.suspects : [];
  const questionBudget = Number(config.questionBudget || 5);

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

  const meta = (existingSub?.metadata as any) || {};
  let questionsRemaining = meta.questionsRemaining !== undefined ? Number(meta.questionsRemaining) : questionBudget;
  let questionsUsed = Number(meta.questionsUsed || 0);
  let activeSuspectIds: string[] = Array.isArray(meta.activeSuspectIds) ? meta.activeSuspectIds : suspects.map(s => s.id);
  let eliminatedSuspectIds: string[] = Array.isArray(meta.eliminatedSuspectIds) ? meta.eliminatedSuspectIds : [];
  let inquiryHistory: any[] = Array.isArray(meta.inquiryHistory) ? meta.inquiryHistory : [];

  if (questionsRemaining <= 0) {
    res.status(400).json({ error: 'Question budget exhausted' });
    return;
  }

  const queryKey = `${query.attribute}:${query.operator}:${query.value}`.toLowerCase().trim();
  if (inquiryHistory.some((h: any) => h.queryKey === queryKey)) {
    res.status(400).json({ error: 'Duplicate inquiry: this question was already asked' });
    return;
  }

  const { Validator: V } = require('../engine');
  const currentActiveSuspects = suspects.filter(s => activeSuspectIds.includes(s.id));
  const evalResult = V.evaluateWitnessQuery(config, query, currentActiveSuspects);

  questionsRemaining -= 1;
  questionsUsed += 1;
  eliminatedSuspectIds = Array.from(new Set([...eliminatedSuspectIds, ...evalResult.eliminatedSuspectIds]));
  activeSuspectIds = evalResult.remainingSuspectIds;

  const inquiryRecord = {
    id: 'inq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    queryKey,
    questionText: query.questionText || `${query.attribute} ${query.operator} ${query.value}`,
    attribute: query.attribute,
    operator: query.operator,
    value: query.value,
    verdict: evalResult.verdict,
    responseText: evalResult.responseText,
    eliminatedSuspectIds: evalResult.eliminatedSuspectIds,
    timestamp: Date.now(),
  };
  inquiryHistory.push(inquiryRecord);

  const updatedMeta = {
    ...meta,
    questionBudget,
    questionsRemaining,
    questionsUsed,
    activeSuspectIds,
    eliminatedSuspectIds,
    inquiryHistory,
    isSolved: existingSub?.isCorrect || false,
    isAccused: meta.isAccused || false,
  };

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
      metadata: updatedMeta,
    },
    create: {
      sessionId: session.id,
      challengeId: challenge.id,
      playerId: sessionPlayer.id,
      runId: session.currentRun,
      answer: '',
      isCorrect: false,
      score: 0,
      responseTime: 0,
      teamId: sessionPlayer.teamId,
      metadata: updatedMeta,
    }
  });

  const io = req.app.get('io');
  if (io) {
    const state = await getSessionState(session.roomCode);
    io.to(`session:${session.roomCode}`).emit('session_state_update', state);
  }

  res.json({
    success: true,
    verdict: evalResult.verdict,
    responseText: evalResult.responseText,
    eliminatedSuspectIds: evalResult.eliminatedSuspectIds,
    activeSuspectIds,
    questionsRemaining,
    questionsUsed,
    inquiryHistory,
  });
});

// GET /api/sessions/:code/witness-state
router.get('/:code/witness-state', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { session, sessionPlayer } = await resolveWitnessSession(req, req.params.code);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  const challengeId = (req.query.challengeId as string) || session.currentChallengeId;
  let challenge = null;
  if (challengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const suspects: Array<Record<string, any>> = Array.isArray(config.suspects) ? config.suspects : [];
  const questionBudget = Number(config.questionBudget || 5);

  const sub = await prisma.submission.findUnique({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    }
  });

  const meta = (sub?.metadata as any) || {};

  res.json({
    questionBudget,
    questionsRemaining: meta.questionsRemaining !== undefined ? Number(meta.questionsRemaining) : questionBudget,
    questionsUsed: Number(meta.questionsUsed || 0),
    activeSuspectIds: Array.isArray(meta.activeSuspectIds) ? meta.activeSuspectIds : suspects.map(s => s.id),
    eliminatedSuspectIds: Array.isArray(meta.eliminatedSuspectIds) ? meta.eliminatedSuspectIds : [],
    inquiryHistory: Array.isArray(meta.inquiryHistory) ? meta.inquiryHistory : [],
    isSolved: sub?.isCorrect || false,
    isAccused: meta.isAccused || false,
    score: sub?.score || 0,
  });
});

// POST /api/sessions/:code/witness-preview
router.post('/:code/witness-preview', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { challengeId, query } = req.body;
  const { session, sessionPlayer } = await resolveWitnessSession(req, req.params.code);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const suspects: Array<Record<string, any>> = Array.isArray(config.suspects) ? config.suspects : [];

  let activeSuspects = suspects;
  if (sessionPlayer) {
    const sub = await prisma.submission.findUnique({
      where: {
        sessionId_challengeId_playerId_runId: {
          sessionId: session.id,
          challengeId: challenge.id,
          playerId: sessionPlayer.id,
          runId: session.currentRun,
        }
      }
    });
    const meta = (sub?.metadata as any) || {};
    if (Array.isArray(meta.activeSuspectIds)) {
      activeSuspects = suspects.filter(s => meta.activeSuspectIds.includes(s.id));
    }
  }

  const { Validator: V } = require('../engine');
  const partition = V.calculateWitnessPartition(activeSuspects, query);
  res.json(partition);
});

// POST /api/sessions/:code/scanner-probe
router.post('/:code/scanner-probe', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { challengeId, actionPayload } = req.body;
  if (!actionPayload || !actionPayload.action) {
    res.status(400).json({ error: 'Invalid probe action payload' });
    return;
  }

  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  if (session.status !== 'ROUND_ACTIVE' && session.status !== 'QUESTION_ACTIVE') {
    res.status(400).json({ error: 'Scanner telemetry investigation is not currently active' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const actionBudget = Number(config.actionBudget || 10);

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

  const meta = (existingSub?.metadata as any) || {};
  const currentState = {
    actionTokensRemaining: meta.actionTokensRemaining !== undefined ? Number(meta.actionTokensRemaining) : actionBudget,
    tokensUsed: Number(meta.tokensUsed || 0),
    unlockedTraces: Array.isArray(meta.unlockedTraces) ? meta.unlockedTraces : [],
    activeHypothesis: meta.activeHypothesis || null,
    overlayHistory: Array.isArray(meta.overlayHistory) ? meta.overlayHistory : [],
    clearedFalsePositives: Array.isArray(meta.clearedFalsePositives) ? meta.clearedFalsePositives : [],
    probeLog: Array.isArray(meta.probeLog) ? meta.probeLog : [],
  };

  const { Validator: V } = require('../engine');
  const probeResult = V.evaluateScannerProbe(config, currentState, actionPayload);

  if (!probeResult.valid) {
    res.status(400).json({ error: probeResult.error || 'Invalid scanner probe' });
    return;
  }

  const updatedMeta = {
    ...meta,
    ...probeResult.updatedState,
    isSolved: existingSub?.isCorrect || false,
    isAccused: meta.isAccused || false,
  };

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
      metadata: updatedMeta,
    },
    create: {
      sessionId: session.id,
      challengeId: challenge.id,
      playerId: sessionPlayer.id,
      runId: session.currentRun,
      answer: '',
      isCorrect: false,
      score: 0,
      responseTime: 0,
      teamId: sessionPlayer.teamId,
      metadata: updatedMeta,
    }
  });

  const io = req.app.get('io');
  if (io) {
    const state = await getSessionState(session.roomCode);
    io.to(`session:${session.roomCode}`).emit('session_state_update', state);
  }

  res.json({
    success: true,
    actionResult: probeResult.actionResult,
    ...probeResult.updatedState,
  });
});

// GET /api/sessions/:code/scanner-state
router.get('/:code/scanner-state', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  const challengeId = (req.query.challengeId as string) || session.currentChallengeId;
  let challenge = null;
  if (challengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const actionBudget = Number(config.actionBudget || 10);

  const sub = await prisma.submission.findUnique({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    }
  });

  const meta = (sub?.metadata as any) || {};
  const unlockedTraces = Array.isArray(meta.unlockedTraces) ? meta.unlockedTraces : [];
  const events = Array.isArray(config.events) ? config.events : [];
  const falsePositiveIds = ['EVT-08', 'EVT-14', 'EVT-19'];
  const rogueIds = ['EVT-11', 'EVT-17'];

  const unlockedTraceDetails: Record<string, any> = {};
  for (const tid of unlockedTraces) {
    const evt = events.find((e: any) => String(e.id).toUpperCase() === String(tid).toUpperCase());
    if (evt) {
      unlockedTraceDetails[tid] = {
        type: 'DEEP_TRACE_RESULT',
        eventId: tid,
        traceDetails: evt.traceDetails || {
          processName: 'unknown-process',
          verifiedSource: 'Standard cluster daemon',
          notes: 'No abnormal signatures logged in kernel journal.',
        },
        isClearedFalsePositive: falsePositiveIds.includes(tid),
        isRogueEvent: rogueIds.includes(tid),
      };
    }
  }

  const hasScannedBaseline = Array.isArray(meta.probeLog) && meta.probeLog.some((p: any) => p.action === 'SCAN_BASELINE');
  let baselineData = null;
  if (hasScannedBaseline) {
    const baseline = config.baseline || {};
    baselineData = {
      type: 'BASELINE_DATA',
      data: baseline,
      registeredNodes: baseline.registeredNodes || [],
      knownExternalRelays: baseline.knownExternalRelays || [],
    };
  }

  res.json({
    actionTokensRemaining: meta.actionTokensRemaining !== undefined ? Number(meta.actionTokensRemaining) : actionBudget,
    tokensUsed: Number(meta.tokensUsed || 0),
    unlockedTraces,
    unlockedTraceDetails,
    baselineData,
    activeHypothesis: meta.activeHypothesis || null,
    overlayHistory: Array.isArray(meta.overlayHistory) ? meta.overlayHistory : [],
    clearedFalsePositives: Array.isArray(meta.clearedFalsePositives) ? meta.clearedFalsePositives : [],
    probeLog: Array.isArray(meta.probeLog) ? meta.probeLog : [],
    isSolved: sub?.isCorrect || false,
    isAccused: meta.isAccused || false,
    score: sub?.score || 0,
  });
});

// POST /api/sessions/:code/mission-execute
router.post('/:code/mission-execute', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { challengeId, actionPlan } = req.body;

  if (!Array.isArray(actionPlan)) {
    res.status(400).json({ error: 'Action plan must be an array of steps' });
    return;
  }

  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  if (session.status !== 'ROUND_ACTIVE' && session.status !== 'QUESTION_ACTIVE') {
    res.status(400).json({ error: 'Mission planning is not currently active' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;

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

  const priorMeta = (existingSub?.metadata as any) || {};
  const prevAttempts = Number(priorMeta.attempts || 0);
  const attemptNumber = prevAttempts + 1;
  const prevFailedRuns = Number(priorMeta.failedRunsCount || 0);

  const { Validator: V } = require('../engine');
  const sim = V.simulateMissionPlan(config, actionPlan, attemptNumber, prevFailedRuns);

  const isCorrect = sim.isSuccess;
  const pointsAwarded = sim.scoreBreakdown.totalScore;

  const updatedMeta = {
    ...priorMeta,
    actionPlan,
    simulation: sim,
    scoreBreakdown: sim.scoreBreakdown,
    executionTrace: sim.executionTrace,
    remainingBattery: sim.remainingBattery,
    totalBatterySpent: sim.totalBatterySpent,
    targetAchieved: sim.targetAchieved,
    failedStepIndex: sim.failedStepIndex,
    failureExplanation: sim.failureExplanation,
    failedRunsCount: isCorrect ? prevFailedRuns : prevFailedRuns + 1,
    attempts: attemptNumber,
    isCompleted: isCorrect,
    lastExecutedAt: Date.now(),
  };

  const submission = await prisma.submission.upsert({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    },
    update: {
      answer: JSON.stringify(actionPlan),
      isCorrect,
      score: pointsAwarded,
      metadata: updatedMeta,
    },
    create: {
      sessionId: session.id,
      challengeId: challenge.id,
      playerId: sessionPlayer.id,
      runId: session.currentRun,
      answer: JSON.stringify(actionPlan),
      isCorrect,
      score: pointsAwarded,
      responseTime: 0,
      teamId: sessionPlayer.teamId,
      metadata: updatedMeta,
    }
  });

  const io = req.app.get('io');
  if (io) {
    const state = await getSessionState(session.roomCode);
    io.to(`session:${session.roomCode}`).emit('session_state_update', state);
  }

  res.json({
    success: true,
    isCompleted: isCorrect,
    simulation: sim,
    remainingBattery: sim.remainingBattery,
    executionTrace: sim.executionTrace,
    scoreBreakdown: sim.scoreBreakdown,
    score: pointsAwarded,
    submissionId: submission.id,
  });
});

// GET /api/sessions/:code/mission-state
router.get('/:code/mission-state', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  const challengeId = (req.query.challengeId as string) || session.currentChallengeId;
  let challenge = null;
  if (challengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;

  const sub = await prisma.submission.findUnique({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    }
  });

  const meta = (sub?.metadata as any) || {};

  res.json({
    challengeId: challenge.id,
    operationId: config.operationId || 'OP-01',
    scenarioTitle: config.scenarioTitle || challenge.prompt,
    missionBrief: config.missionBrief || '',
    batteryCapacity: Number(config.batteryCapacity || config.initialBattery || 40),
    actionPlan: meta.actionPlan || [],
    executionTrace: meta.executionTrace || [],
    remainingBattery: meta.remainingBattery !== undefined ? Number(meta.remainingBattery) : Number(config.batteryCapacity || config.initialBattery || 40),
    totalBatterySpent: Number(meta.totalBatterySpent || 0),
    initialBattery: Number(config.batteryCapacity || config.initialBattery || 40),
    initialState: config.initialState || {},
    targetState: config.targetState || {},
    actions: Array.isArray(config.actions) ? config.actions : [],
    failedStepIndex: meta.failedStepIndex !== undefined ? meta.failedStepIndex : null,
    failureExplanation: meta.failureExplanation || null,
    isCompleted: sub?.isCorrect || false,
    attempts: Number(meta.attempts || 0),
    score: sub?.score || 0,
    scoreBreakdown: meta.scoreBreakdown || (meta.simulation ? meta.simulation.scoreBreakdown : null),
    simulation: meta.simulation || null,
    scoring: config.scoring || {},
  });
});

// POST /api/sessions/:code/router-probe
router.post('/:code/router-probe', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { challengeId, route } = req.body;

  if (!Array.isArray(route)) {
    res.status(400).json({ error: 'Route must be an array of node IDs' });
    return;
  }

  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code, true);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  if (session.status !== 'ROUND_ACTIVE' && session.status !== 'QUESTION_ACTIVE') {
    res.status(400).json({ error: 'Signal routing is not currently active' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const maxProbes = Number(config.probeTokens || 3);

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

  const priorMeta = (existingSub?.metadata as any) || {};
  const currentProbes = priorMeta.probesRemaining !== undefined ? Number(priorMeta.probesRemaining) : maxProbes;

  if (currentProbes <= 0) {
    res.status(400).json({ error: 'Diagnostic probe tokens exhausted' });
    return;
  }

  const { Validator: V } = require('../engine');
  const sim = V.simulateSignalRoute(config, route, 1, 0, true);

  const newProbesRemaining = currentProbes - 1;
  const probesUsed = (priorMeta.probesUsed || 0) + 1;

  const updatedMeta = {
    ...priorMeta,
    probesRemaining: newProbesRemaining,
    probesUsed,
    lastRoute: route,
    lastProbeSimulation: sim,
    lastProbeAt: Date.now(),
  };

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
      metadata: updatedMeta,
    },
    create: {
      sessionId: session.id,
      challengeId: challenge.id,
      playerId: sessionPlayer.id,
      runId: session.currentRun,
      answer: JSON.stringify({ route, probeOnly: true }),
      isCorrect: false,
      score: 0,
      responseTime: 0,
      teamId: sessionPlayer.teamId,
      metadata: updatedMeta,
    }
  });

  res.json({
    success: true,
    probesRemaining: newProbesRemaining,
    probesUsed,
    probeTelemetry: sim,
  });
});

// POST /api/sessions/:code/router-transmit
router.post('/:code/router-transmit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { challengeId, route } = req.body;

  if (!Array.isArray(route)) {
    res.status(400).json({ error: 'Route must be an array of node IDs' });
    return;
  }

  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code, true);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  if (session.status !== 'ROUND_ACTIVE' && session.status !== 'QUESTION_ACTIVE') {
    res.status(400).json({ error: 'Signal routing is not currently active' });
    return;
  }

  const targetChallengeId = challengeId || session.currentChallengeId;
  let challenge = null;
  if (targetChallengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: targetChallengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;

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

  const priorMeta = (existingSub?.metadata as any) || {};
  const prevAttempts = Number(priorMeta.attempts || 0);
  const attemptNumber = prevAttempts + 1;
  const prevFailedRuns = Number(priorMeta.failedRunsCount || 0);

  const { Validator: V } = require('../engine');
  const sim = V.simulateSignalRoute(config, route, attemptNumber, prevFailedRuns, false);

  const isCorrect = sim.isSuccess;
  const pointsAwarded = sim.scoreBreakdown.totalScore;
  const maxProbes = Number(config.probeTokens || 3);
  const probesRemaining = priorMeta.probesRemaining !== undefined ? Number(priorMeta.probesRemaining) : maxProbes;

  const updatedMeta = {
    ...priorMeta,
    route,
    simulation: sim,
    totalLatencyMs: sim.totalLatencyMs,
    totalPacketLossPercent: sim.totalPacketLossPercent,
    bottleneckLink: sim.bottleneckLink,
    failureTier: sim.failureTier,
    failedRunsCount: isCorrect ? prevFailedRuns : prevFailedRuns + 1,
    attempts: attemptNumber,
    isCompleted: isCorrect,
    probesRemaining,
    lastTransmittedAt: Date.now(),
  };

  const submission = await prisma.submission.upsert({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    },
    update: {
      answer: JSON.stringify({ route }),
      isCorrect,
      score: pointsAwarded,
      metadata: updatedMeta,
    },
    create: {
      sessionId: session.id,
      challengeId: challenge.id,
      playerId: sessionPlayer.id,
      runId: session.currentRun,
      answer: JSON.stringify({ route }),
      isCorrect,
      score: pointsAwarded,
      responseTime: 0,
      teamId: sessionPlayer.teamId,
      metadata: updatedMeta,
    }
  });

  const io = req.app.get('io');
  if (io) {
    const state = await getSessionState(session.roomCode);
    io.to(`session:${session.roomCode}`).emit('session_state_update', state);
  }

  res.json({
    success: true,
    isDelivered: isCorrect,
    simulation: sim,
    score: pointsAwarded,
    scoreBreakdown: sim.scoreBreakdown,
    failureTier: sim.failureTier,
    submissionId: submission.id,
  });
});

// GET /api/sessions/:code/router-state
router.get('/:code/router-state', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { session, sessionPlayer } = await resolveScannerSession(req, req.params.code, true);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  const challengeId = (req.query.challengeId as string) || session.currentChallengeId;
  let challenge = null;
  if (challengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;

  const sub = await prisma.submission.findUnique({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    }
  });

  const meta = (sub?.metadata as any) || {};
  const maxProbes = Number(config.probeTokens || 3);

  res.json({
    challengeId: challenge.id,
    scenarioId: config.scenarioId || 'ROUTER-OP-01',
    scenarioTitle: config.scenarioTitle || challenge.prompt,
    missionBrief: config.missionBrief || '',
    stream: config.stream || {},
    graph: config.graph || {},
    probeTokens: maxProbes,
    probesRemaining: meta.probesRemaining !== undefined ? Number(meta.probesRemaining) : maxProbes,
    probesUsed: Number(meta.probesUsed || 0),
    lastRoute: meta.route || [],
    lastSimulation: meta.simulation || null,
    isCompleted: sub?.isCorrect || false,
    attempts: Number(meta.attempts || 0),
    score: sub?.score || 0,
    scoring: config.scoring || {},
  });
});

// GET /api/sessions/:code/threshold-state
router.get('/:code/threshold-state', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { session, sessionPlayer } = await resolvePlayerSession(req, req.params.code, true);
  if (!session || !sessionPlayer) {
    res.status(404).json({ error: 'Session or player not found' });
    return;
  }

  const challengeId = (req.query.challengeId as string) || session.currentChallengeId;
  let challenge = null;
  if (challengeId) {
    challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  } else if (session.currentGameId) {
    challenge = await prisma.challenge.findFirst({
      where: { gameId: session.currentGameId },
      orderBy: { position: 'asc' }
    });
  }

  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const config = (challenge.config || {}) as any;
  const sub = await prisma.submission.findUnique({
    where: {
      sessionId_challengeId_playerId_runId: {
        sessionId: session.id,
        challengeId: challenge.id,
        playerId: sessionPlayer.id,
        runId: session.currentRun,
      }
    }
  });

  const meta = (sub?.metadata as any) || {};
  const maxProbes = Number(config.probeTokens ?? 3);
  const activePhase = meta.phase1Completed ? (meta.phase2Completed ? 'COMPLETED' : 2) : 1;

  res.json({
    challengeId: challenge.id,
    scenarioId: config.scenarioId || 'THRESHOLD-OP-01',
    scenarioTitle: config.scenarioTitle || challenge.prompt,
    missionBrief: config.missionBrief || '',
    system: config.system || '',
    costMatrix: config.costMatrix || {},
    phase1Baseline: config.phase1Baseline || {},
    phase2Shift: config.phase2Shift || null,
    probeTokens: maxProbes,
    probesRemaining: meta.probesRemaining !== undefined ? Number(meta.probesRemaining) : maxProbes,
    probesUsed: Number(meta.probesUsed || 0),
    activePhase,
    phase1Completed: Boolean(meta.phase1Completed),
    phase2Completed: Boolean(meta.phase2Completed),
    phase1Threshold: meta.phase1Threshold ?? null,
    phase1Cost: meta.phase1Cost ?? null,
    phase1ConfusionMatrix: meta.phase1ConfusionMatrix ?? null,
    phase2Threshold: meta.phase2Threshold ?? null,
    phase2Cost: meta.phase2Cost ?? null,
    phase2ConfusionMatrix: meta.phase2ConfusionMatrix ?? null,
    lastEvaluation: meta.lastEvaluation ?? null,
    failedRunsCount: Number(meta.failedRunsCount || 0),
    isCompleted: sub?.isCorrect || false,
    score: sub?.score || 0,
    scoring: config.scoring || {},
  });
});

export default router;
