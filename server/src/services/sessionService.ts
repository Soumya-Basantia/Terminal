import { prisma } from '../lib/prisma';
import { registry } from '../engine';

export interface SessionStatePayload {
  session: {
    id: string;
    eventId: string;
    roomCode: string;
    status: string;
    stageMode: string;
    currentGameId: string | null;
    currentChallengeId: string | null;
    challengeStartTime: Date | null;
    currentPosition: number;
    currentRun: number;
    startedAt: Date | null;
    endedAt: Date | null;
  };
  event: {
    id: string;
    name: string;
    mode: string;
    games: any[];
  };
  game?: {
    id: string;
    name: string;
    template: string;
    teamsEnabled: boolean;
    leaderboardVisibility: string;
    speedBonus: boolean;
  };
  currentGame: {
    id: string;
    name: string;
    template: string;
    challenges?: any[];
  } | null;
  playerCount: number;
  teamCount: number;
  answersCount?: number;
  leaderboard?: { name: string; score: number }[];
  chainProgress?: Record<string, string>;
  dockProgress?: {
    totalInvestigators: number;
    completedCount: number;
    activePipelines: Array<{
      playerName: string;
      connectionsCount: number;
      energyRemaining: number;
      isCompleted: boolean;
      lastConsequence?: string;
    }>;
  };
  witnessProgress?: {
    caseTitle: string;
    missionBrief?: string;
    totalSuspects: number;
    totalInvestigators: number;
    solvedCount: number;
    recentTestimonies: Array<{
      playerName: string;
      questionText: string;
      eliminatedCount: number;
      verdict: boolean;
      timestamp: number;
    }>;
    activeInvestigators: Array<{
      playerName: string;
      questionsRemaining: number;
      questionsUsed: number;
      activeSuspectsCount: number;
      isSolved: boolean;
      score: number;
    }>;
  };
  scannerProgress?: {
    scenarioTitle: string;
    missionBrief?: string;
    totalEvents: number;
    totalAnalysts: number;
    solvedCount: number;
    clearedFalsePositivesCount: number;
    recentProbes: Array<{
      playerName: string;
      action: string;
      target?: string;
      summary: string;
      timestamp: number;
    }>;
    activeAnalysts: Array<{
      playerName: string;
      tokensRemaining: number;
      tokensUsed: number;
      tracesUnlockedCount: number;
      clearedFalsePositivesCount: number;
      hypothesis?: string;
      isSolved: boolean;
      score: number;
    }>;
  };
  missionProgress?: {
    scenarioTitle?: string;
    briefing?: string;
    operationId: string;
    missionBrief?: string;
    batteryCapacity: number;
    initialBattery?: number;
    plansExecutedCount: number;
    successfulInfiltrations: number;
    completedCount?: number;
    activeFailures: number;
    totalAgents: number;
    totalPlanners?: number;
    activeAgents?: Array<{
      playerName: string;
      batteryRemaining: number;
      batterySpent: number;
      stepsCount: number;
      attempts: number;
      isCompleted: boolean;
      score: number;
    }>;
    activePlanners?: Array<{
      playerName: string;
      batteryRemaining: number;
      batterySpent: number;
      stepsCount: number;
      attempts: number;
      isCompleted: boolean;
      score: number;
    }>;
    recentExecutions: Array<{
      playerName: string;
      operationId?: string;
      stepsCount: number;
      isSuccess: boolean;
      isCorrect?: boolean;
      batteryUsed?: number;
      batteryRemaining: number;
      failedAction?: string;
      timestamp: number;
    }>;
  };
  routerProgress?: {
    scenarioTitle: string;
    missionBrief?: string;
    streamVolumeGbps: number;
    slaMaxLatencyMs: number;
    slaMaxLossPercent: number;
    totalControllers: number;
    transmissionsCount: number;
    successfulDeliveries: number;
    activeCongestions: number;
    recentTransmissions: Array<{
      playerName: string;
      pathText: string;
      latencyMs: number;
      packetLossPercent: number;
      isSuccess: boolean;
      bottleneckLink?: string;
      timestamp: number;
    }>;
    activeControllers: Array<{
      playerName: string;
      probesRemaining: number;
      probesUsed: number;
      lastRoute?: string[];
      isCompleted: boolean;
      score: number;
    }>;
  };
}

export async function getSessionState(roomCode: string): Promise<SessionStatePayload | null> {
  const session = await prisma.session.findUnique({
    where: { roomCode },
    include: {
      event: {
        include: {
          games: {
            include: { game: true },
            orderBy: { position: 'asc' }
          }
        }
      },
      currentGame: {
        include: {
          challenges: {
            orderBy: { position: 'asc' }
          }
        }
      },
      players: { where: { status: 'ACTIVE' } }
    },
  });

  if (!session) return null;

  // We can count distinct teams from the players
  const uniqueTeams = new Set(session.players.filter(p => p.teamId).map(p => p.teamId));

  let answersCount = 0;
  if (session.currentChallengeId) {
    answersCount = await prisma.submission.count({
      where: {
        sessionId: session.id,
        challengeId: session.currentChallengeId,
        runId: session.currentRun
      }
    });
  }

  const submissions = await prisma.submission.findMany({
    where: { sessionId: session.id },
    include: { player: { include: { user: true } }, team: true }
  });

  const playerScores: Record<string, { name: string, score: number }> = {};
  for (const sub of submissions) {
    if (!playerScores[sub.playerId]) {
      playerScores[sub.playerId] = { name: sub.player.user.username, score: 0 };
    }
    playerScores[sub.playerId].score += sub.score;
  }
  
  const leaderboard = Object.values(playerScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let chainProgress: Record<string, string> | undefined = undefined;
  
  if (session.currentGame) {
    const template = registry.getTemplate(session.currentGame.template);
    if (template?.progressionConfig?.type === 'CHAIN') {
      chainProgress = {};
      const challenges = (session.currentGame as any).challenges || [];
      const successfulSubmissions = submissions.filter(s => s.isCorrect && s.runId === session.currentRun);
      
      const entities = uniqueTeams.size > 0 
        ? Array.from(uniqueTeams).filter(Boolean) as string[]
        : session.players.map(p => p.id);

      for (const entityId of entities) {
        const entitySubs = successfulSubmissions.filter(s => 
          uniqueTeams.size > 0 ? s.teamId === entityId : s.playerId === entityId
        );
        const solvedIds = new Set(entitySubs.map(s => s.challengeId));
        const currentChallenge = challenges.find((c: any) => !solvedIds.has(c.id));
        if (currentChallenge) {
          chainProgress[entityId] = currentChallenge.id;
        } else {
          chainProgress[entityId] = 'COMPLETED';
        }
      }
    }
  }

  let dockProgress: {
    totalInvestigators: number;
    completedCount: number;
    activePipelines: Array<{
      playerName: string;
      connectionsCount: number;
      energyRemaining: number;
      isCompleted: boolean;
      lastConsequence?: string;
    }>;
  } | undefined = undefined;

  const currentChal = session.currentGame?.challenges?.find((c: any) => c.id === session.currentChallengeId) 
    || session.currentGame?.challenges?.[0];
  const chalConfig = currentChal?.config as any;

  if (session.currentGame?.template === 'TEAM_CHALLENGE' || chalConfig?.dock) {
    const dockSubs = submissions.filter(s => s.challengeId === currentChal?.id && s.runId === session.currentRun);
    const activePipelines = dockSubs.map(s => {
      const dState = (s.metadata as any)?.dockState || {};
      const lastMsg = dState.consequences?.[dState.consequences.length - 1]?.message;
      return {
        playerName: s.player?.user?.username || 'Unknown',
        connectionsCount: (dState.completedConnections || []).length,
        energyRemaining: dState.energyRemaining ?? 6,
        isCompleted: s.isCorrect,
        lastConsequence: lastMsg,
      };
    });
    dockProgress = {
      totalInvestigators: session.players.length,
      completedCount: dockSubs.filter(s => s.isCorrect).length,
      activePipelines,
    };
  }

  let witnessProgress: {
    caseTitle: string;
    missionBrief?: string;
    totalSuspects: number;
    totalInvestigators: number;
    solvedCount: number;
    recentTestimonies: Array<{
      playerName: string;
      questionText: string;
      eliminatedCount: number;
      verdict: boolean;
      timestamp: number;
    }>;
    activeInvestigators: Array<{
      playerName: string;
      questionsRemaining: number;
      questionsUsed: number;
      activeSuspectsCount: number;
      isSolved: boolean;
      score: number;
    }>;
  } | undefined = undefined;

  if (session.currentGame?.template === 'THE_WITNESS') {
    const witnessSubs = submissions.filter(s => s.challengeId === currentChal?.id && s.runId === session.currentRun);
    const suspects = Array.isArray(chalConfig?.suspects) ? chalConfig.suspects : [];
    
    const allRecentTestimonies: Array<{
      playerName: string;
      questionText: string;
      eliminatedCount: number;
      verdict: boolean;
      timestamp: number;
    }> = [];

    const activeInvestigators = witnessSubs.map(s => {
      const meta = (s.metadata as any) || {};
      const history = Array.isArray(meta.inquiryHistory) ? meta.inquiryHistory : [];
      for (const h of history) {
        allRecentTestimonies.push({
          playerName: s.player?.user?.username || 'Investigator',
          questionText: h.questionText || 'Inquiry',
          eliminatedCount: Array.isArray(h.eliminatedSuspectIds) ? h.eliminatedSuspectIds.length : 0,
          verdict: Boolean(h.verdict),
          timestamp: h.timestamp || Date.now(),
        });
      }
      return {
        playerName: s.player?.user?.username || 'Unknown',
        questionsRemaining: meta.questionsRemaining ?? (chalConfig?.questionBudget || 5),
        questionsUsed: meta.questionsUsed ?? 0,
        activeSuspectsCount: Array.isArray(meta.activeSuspectIds) ? meta.activeSuspectIds.length : suspects.length,
        isSolved: s.isCorrect,
        score: s.score || 0,
      };
    });

    allRecentTestimonies.sort((a, b) => b.timestamp - a.timestamp);

    witnessProgress = {
      caseTitle: chalConfig?.caseTitle || currentChal?.prompt || 'ACTIVE INVESTIGATION',
      missionBrief: chalConfig?.missionBrief,
      totalSuspects: suspects.length,
      totalInvestigators: session.players.length,
      solvedCount: witnessSubs.filter(s => s.isCorrect).length,
      recentTestimonies: allRecentTestimonies.slice(0, 10),
      activeInvestigators,
    };
  }

  let scannerProgress: {
    scenarioTitle: string;
    missionBrief?: string;
    totalEvents: number;
    totalAnalysts: number;
    solvedCount: number;
    clearedFalsePositivesCount: number;
    recentProbes: Array<{
      playerName: string;
      action: string;
      target?: string;
      summary: string;
      timestamp: number;
    }>;
    activeAnalysts: Array<{
      playerName: string;
      tokensRemaining: number;
      tokensUsed: number;
      tracesUnlockedCount: number;
      clearedFalsePositivesCount: number;
      hypothesis?: string;
      isSolved: boolean;
      score: number;
    }>;
  } | undefined = undefined;

  if (session.currentGame?.template === 'ROGUE_SCANNER') {
    const scannerSubs = submissions.filter(s => s.challengeId === currentChal?.id && s.runId === session.currentRun);
    const events = Array.isArray(chalConfig?.events) ? chalConfig.events : [];

    const allRecentProbes: Array<{
      playerName: string;
      action: string;
      target?: string;
      summary: string;
      timestamp: number;
    }> = [];

    let totalClearedFP = 0;

    const activeAnalysts = scannerSubs.map(s => {
      const meta = (s.metadata as any) || {};
      const probes = Array.isArray(meta.probeLog) ? meta.probeLog : [];
      for (const p of probes) {
        allRecentProbes.push({
          playerName: s.player?.user?.username || 'Analyst',
          action: p.action || 'PROBE',
          target: p.target,
          summary: p.summary || 'Telemetry probe executed',
          timestamp: p.timestamp || Date.now(),
        });
      }

      const cleared = Array.isArray(meta.clearedFalsePositives) ? meta.clearedFalsePositives.length : 0;
      totalClearedFP += cleared;

      return {
        playerName: s.player?.user?.username || 'Unknown',
        tokensRemaining: meta.actionTokensRemaining ?? (chalConfig?.actionBudget || 10),
        tokensUsed: meta.tokensUsed ?? 0,
        tracesUnlockedCount: Array.isArray(meta.unlockedTraces) ? meta.unlockedTraces.length : 0,
        clearedFalsePositivesCount: cleared,
        hypothesis: meta.activeHypothesis,
        isSolved: s.isCorrect,
        score: s.score || 0,
      };
    });

    allRecentProbes.sort((a, b) => b.timestamp - a.timestamp);

    scannerProgress = {
      scenarioTitle: chalConfig?.scenarioTitle || currentChal?.prompt || 'ROGUE SCANNER TELEMETRY',
      missionBrief: chalConfig?.missionBrief,
      totalEvents: events.length,
      totalAnalysts: session.players.length,
      solvedCount: scannerSubs.filter(s => s.isCorrect).length,
      clearedFalsePositivesCount: totalClearedFP,
      recentProbes: allRecentProbes.slice(0, 12),
      activeAnalysts,
    };
  }

  let missionProgress: SessionStatePayload['missionProgress'] = undefined;

  if (session.currentGame?.template === 'SILENT_MISSION') {
    const missionSubs = submissions.filter(s => s.challengeId === currentChal?.id && s.runId === session.currentRun);
    const allRecentExecutions: Array<{
      playerName: string;
      operationId?: string;
      stepsCount: number;
      isSuccess: boolean;
      isCorrect?: boolean;
      batteryUsed?: number;
      batteryRemaining: number;
      failedAction?: string;
      timestamp: number;
    }> = [];

    const activePlanners = missionSubs.map(s => {
      const meta = (s.metadata as any) || {};
      const execTrace = Array.isArray(meta.executionTrace) ? meta.executionTrace : [];
      const failedStep = execTrace.find((t: any) => t.status === 'FAILED');

      allRecentExecutions.push({
        playerName: s.player?.user?.username || 'Planner',
        operationId: chalConfig?.operationId || 'OP-01',
        stepsCount: execTrace.length,
        isSuccess: s.isCorrect,
        isCorrect: s.isCorrect,
        batteryUsed: meta.totalBatterySpent || 0,
        batteryRemaining: meta.remainingBattery ?? Number(chalConfig?.batteryCapacity || chalConfig?.initialBattery || 40),
        failedAction: failedStep?.label || failedStep?.actionId,
        timestamp: meta.lastExecutedAt || (s as any).submittedAt?.getTime() || (s as any).createdAt?.getTime() || Date.now(),
      });

      return {
        playerName: s.player?.user?.username || 'Unknown',
        batteryRemaining: meta.remainingBattery ?? Number(chalConfig?.batteryCapacity || chalConfig?.initialBattery || 40),
        batterySpent: meta.totalBatterySpent ?? 0,
        stepsCount: Array.isArray(meta.actionPlan) ? meta.actionPlan.length : 0,
        attempts: meta.attempts || 1,
        isCompleted: s.isCorrect,
        score: s.score || 0,
      };
    });

    allRecentExecutions.sort((a, b) => b.timestamp - a.timestamp);

    missionProgress = {
      scenarioTitle: chalConfig?.scenarioTitle || chalConfig?.title || currentChal?.prompt || 'SILENT MISSION // OPERATION TRITON',
      missionBrief: chalConfig?.missionBrief || chalConfig?.briefing || '',
      briefing: chalConfig?.missionBrief || chalConfig?.briefing,
      operationId: chalConfig?.operationId || 'OP-01',
      batteryCapacity: Number(chalConfig?.batteryCapacity || chalConfig?.initialBattery || 40),
      initialBattery: Number(chalConfig?.batteryCapacity || chalConfig?.initialBattery || 40),
      totalPlanners: session.players.length,
      totalAgents: session.players.length,
      plansExecutedCount: missionSubs.length,
      successfulInfiltrations: missionSubs.filter(s => s.isCorrect).length,
      completedCount: missionSubs.filter(s => s.isCorrect).length,
      activeFailures: missionSubs.filter(s => !s.isCorrect).length,
      recentExecutions: allRecentExecutions.slice(0, 12),
      activePlanners,
      activeAgents: activePlanners,
    };
  }

  let routerProgress: SessionStatePayload['routerProgress'] = undefined;

  if (session.currentGame?.template === 'SIGNAL_ROUTER') {
    const routerSubs = submissions.filter(s => s.challengeId === currentChal?.id && s.runId === session.currentRun);
    const allRecentTransmissions: Array<{
      playerName: string;
      pathText: string;
      latencyMs: number;
      packetLossPercent: number;
      isSuccess: boolean;
      bottleneckLink?: string;
      timestamp: number;
    }> = [];

    const activeControllers = routerSubs.map(s => {
      const meta = (s.metadata as any) || {};
      const sim = meta.simulation || {};
      const pathText = Array.isArray(meta.route) ? meta.route.join(' ➔ ') : (Array.isArray(sim.routeNodes) ? sim.routeNodes.join(' ➔ ') : 'DIRECT');
      const latency = Number(sim.totalLatencyMs ?? meta.totalLatencyMs ?? 0);
      const loss = Number(sim.totalPacketLossPercent ?? meta.totalPacketLossPercent ?? 0);
      const bottleneck = sim.bottleneckLink ? `[${sim.bottleneckLink.from} ➔ ${sim.bottleneckLink.to}]` : undefined;

      allRecentTransmissions.push({
        playerName: s.player?.user?.username || 'Controller',
        pathText,
        latencyMs: latency,
        packetLossPercent: loss,
        isSuccess: s.isCorrect,
        bottleneckLink: bottleneck,
        timestamp: meta.lastTransmittedAt || (s as any).submittedAt?.getTime() || (s as any).createdAt?.getTime() || Date.now(),
      });

      return {
        playerName: s.player?.user?.username || 'Unknown',
        probesRemaining: meta.probesRemaining ?? Number(chalConfig?.probeTokens || 3),
        probesUsed: meta.probesUsed ?? 0,
        lastRoute: meta.route || sim.routeNodes || [],
        isCompleted: s.isCorrect,
        score: s.score || 0,
      };
    });

    allRecentTransmissions.sort((a, b) => b.timestamp - a.timestamp);

    const stream = chalConfig?.stream || {};
    routerProgress = {
      scenarioTitle: chalConfig?.scenarioTitle || currentChal?.prompt || 'SUBNET TRAFFIC CONTROL',
      missionBrief: chalConfig?.missionBrief || '',
      streamVolumeGbps: Number(stream.payloadVolumeGbps || stream.payloadVolume || 4.5),
      slaMaxLatencyMs: Number(stream.slaMaxLatencyMs || stream.maxLatency || 80),
      slaMaxLossPercent: Number(stream.slaMaxLossPercent ?? stream.maxLossPercent ?? 0.0),
      totalControllers: session.players.length,
      transmissionsCount: routerSubs.length,
      successfulDeliveries: routerSubs.filter(s => s.isCorrect).length,
      activeCongestions: routerSubs.filter(s => !s.isCorrect).length,
      recentTransmissions: allRecentTransmissions.slice(0, 12),
      activeControllers,
    };
  }

  return {
    session: {
      id: session.id,
      eventId: session.eventId,
      roomCode: session.roomCode,
      status: session.status,
      stageMode: session.stageMode,
      currentGameId: session.currentGameId,
      currentChallengeId: session.currentChallengeId,
      challengeStartTime: session.challengeStartTime,
      currentPosition: session.currentPosition,
      currentRun: session.currentRun,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    event: {
      id: session.event.id,
      name: session.event.name,
      mode: session.event.mode,
      games: session.event.games,
    },
    game: session.currentGame ? {
      id: session.currentGame.id,
      name: session.currentGame.name,
      template: session.currentGame.template,
      teamsEnabled: session.currentGame.teamsEnabled,
      leaderboardVisibility: session.currentGame.leaderboardVisibility,
      speedBonus: session.currentGame.speedBonus,
    } : {
      id: '',
      name: session.event.name,
      template: 'QUIZ',
      teamsEnabled: false,
      leaderboardVisibility: 'LIVE',
      speedBonus: false,
    },
    currentGame: session.currentGame ? {
      id: session.currentGame.id,
      name: session.currentGame.name,
      template: session.currentGame.template,
      challenges: (session.currentGame as any).challenges?.map((ch: any) => {
        if (!ch.config) return ch;
        // Strip answer-revealing fields from config before sending to clients
        const { answer, correct, correctSequence, optimalPath, correctRoute, bug, solution, solutionPatch, secret, culpritId, secretCulpritId, anomalousEventIds, anomalousEventId, anomalyMechanism, ...safeConfig } = ch.config;
        if (Array.isArray(safeConfig.rules)) {
          safeConfig.rules = safeConfig.rules.map((r: any) => {
            const { hasBug, ...safeRule } = r;
            return safeRule;
          });
        }
        if (Array.isArray(safeConfig.events)) {
          safeConfig.events = safeConfig.events.map((evt: any) => {
            const { traceDetails, isRogue, ...safeEvt } = evt;
            return safeEvt;
          });
        }
        return { ...ch, options: safeConfig.options ?? ch.options, config: safeConfig };
      }),
    } : null,
    playerCount: session.players.length,
    teamCount: uniqueTeams.size,
    answersCount,
    leaderboard,
    chainProgress,
    dockProgress,
    witnessProgress,
    scannerProgress,
    missionProgress,
    routerProgress,
  };
}
