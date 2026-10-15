import { prisma } from '../lib/prisma';
import { registry } from '../engine';
import { calculateSessionScores } from './scoringService';
import { isUserOnline } from '../sockets/presence';

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
    questionEndsAt: Date | null;
    currentPosition: number;
    currentRun: number;
    sequence: number;
    startedAt: Date | null;
    endedAt: Date | null;
    gmId: string | null;
    snapshotVersion: string | null;
    isReviewRevealed?: boolean;
    reviewQuestionIndex?: number | null;
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
    maxPlayers?: number;
    teamsEnabled: boolean;
    leaderboardVisibility: string;
    speedBonus: boolean;
  };
  currentGame: {
    id: string;
    name: string;
    template: string;
    maxPlayers?: number;
    challenges?: any[];
  } | null;
  currentChallenge?: any;
  reviewChallenge?: any;
  playerCount: number;
  teamCount: number;
  answersCount?: number;
  leaderboard?: { name: string; score: number }[];
  teamLeaderboard?: Array<{
    teamId: string;
    teamName: string;
    membersCount: number;
    members: Array<{ playerId: string; userId: string; username: string; score: number }>;
    baseScore: number;
    timeBonus: number;
    finalScore: number;
    rank: number;
  }>;
  individualLeaderboard?: Array<{
    playerId: string;
    userId: string;
    username: string;
    name: string | null;
    usn: string | null;
    teamName: string | null;
    score: number;
    rank: number;
  }>;
  timeBonusConfig?: {
    enabled: boolean;
    points: number;
    ruleDescription: string;
  };
  playerRoster?: Array<{
    id: string;
    userId: string;
    handle: string;
    username: string;
    name: string | null;
    teamName: string | null;
    teamId: string | null;
    status: string;
    connected: boolean;
  }>;
  teamRoster?: {
    teams: Array<{
      teamId: string;
      teamName: string;
      membersCount: number;
      maxSize: number;
      members: Array<{
        playerId: string;
        userId: string;
        username: string;
        handle: string;
        connected: boolean;
      }>;
    }>;
    unassignedCount: number;
    unassignedPlayers: Array<{
      playerId: string;
      userId: string;
      username: string;
      handle: string;
      connected: boolean;
    }>;
  };
  teamResponses?: Array<{
    teamId: string;
    teamName: string;
    respondedCount: number;
    totalMembers: number;
  }>;
  teamsRespondedCount?: number;
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
  isReviewRevealed?: boolean;
  reviewQuestionIndex?: number | null;
}

export function deriveStageModeFromStatus(status: string | null | undefined, currentStageMode?: string | null): string {
  if (currentStageMode && currentStageMode !== 'LOBBY') {
    return currentStageMode;
  }

  const stageModeByStatus: Record<string, string> = {
    LOBBY: 'LOBBY',
    STARTING: 'ANNOUNCEMENT',
    ROUND_ACTIVE: 'QUESTION',
    ROUND_LOCKED: 'ANSWER_REVEAL',
    RESULTS: 'LEADERBOARD',
    ENDED: 'FINAL_RESULTS',
    QUESTION_ACTIVE: 'QUESTION',
    QUESTION_LOCKED: 'ANSWER_REVEAL',
    QUESTION_RESULTS: 'LEADERBOARD',
  };

  return stageModeByStatus[status || ''] || currentStageMode || 'LOBBY';
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
      players: {
        where: { status: 'ACTIVE' },
        include: {
          user: { select: { id: true, username: true, name: true, usn: true } },
          team: { select: { id: true, name: true } }
        }
      }
    },
  });

  if (!session) return null;

  // Authoritative scores across teams and individuals
  const scores = await calculateSessionScores(session.id);

  // We can count distinct teams from the players
  const uniqueTeams = new Set(session.players.filter(p => p.teamId).map(p => p.teamId));

  // Build public player roster (privacy-preserving: handle@terminal, no USN or passwords)
  const playerRoster = session.players.map(p => ({
    id: p.id,
    userId: p.userId,
    handle: `${p.user?.username || 'player'}@terminal`,
    username: p.user?.username || 'player',
    name: p.user?.name || null,
    teamName: p.team?.name || null,
    teamId: p.teamId,
    status: p.status,
    connected: isUserOnline(p.userId)
  }));

  // Build structured team roster with member handles and unassigned group
  const teamRosterMap = new Map<string, {
    teamId: string;
    teamName: string;
    membersCount: number;
    maxSize: number;
    members: Array<{
      playerId: string;
      userId: string;
      username: string;
      handle: string;
      connected: boolean;
    }>;
  }>();

  const unassignedPlayers: Array<{
    playerId: string;
    userId: string;
    username: string;
    handle: string;
    connected: boolean;
  }> = [];

  for (const p of session.players) {
    const handle = `${p.user?.username || 'player'}@terminal`;
    const connected = isUserOnline(p.userId);
    if (p.teamId && p.team) {
      if (!teamRosterMap.has(p.teamId)) {
        teamRosterMap.set(p.teamId, {
          teamId: p.teamId,
          teamName: p.team.name,
          membersCount: 0,
          maxSize: 4,
          members: []
        });
      }
      const t = teamRosterMap.get(p.teamId)!;
      t.members.push({
        playerId: p.id,
        userId: p.userId,
        username: p.user?.username || 'player',
        handle,
        connected
      });
      t.membersCount = t.members.length;
    } else {
      unassignedPlayers.push({
        playerId: p.id,
        userId: p.userId,
        username: p.user?.username || 'player',
        handle,
        connected
      });
    }
  }

  const teamRoster = {
    teams: Array.from(teamRosterMap.values()),
    unassignedCount: unassignedPlayers.length,
    unassignedPlayers
  };

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

  // Calculate per-team responses for the current challenge
  const currentChallengeSubmissions = session.currentChallengeId
    ? submissions.filter(s => s.challengeId === session.currentChallengeId && s.runId === session.currentRun)
    : [];
  const submittedPlayerIds = new Set(currentChallengeSubmissions.map(s => s.playerId));

  const teamResponses = teamRoster.teams.map(t => {
    const answered = t.members.filter(m => submittedPlayerIds.has(m.playerId)).length;
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      respondedCount: answered,
      totalMembers: t.membersCount
    };
  });
  const teamsRespondedCount = teamResponses.filter(t => t.respondedCount > 0).length;

  const leaderboard = scores.leaderboard;

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

  const effectiveStageMode = deriveStageModeFromStatus(session.status, session.stageMode);

  // Prefer the frozen snapshot for live gameplay so editor edits never mutate
  // an active session. Fall back to the live Game row for legacy sessions.
  const snapshot: any = (session as any).snapshot;
  const liveChallenges = (session.currentGame as any)?.challenges || [];

  const safeChallenge = (ch: any) => {
    if (!ch.config) return ch;
    // Strip answer-revealing fields and explanation from config before sending to clients
    const { answer, correct, correctSequence, optimalPath, correctRoute, bug, solution, solutionPatch, secret, culpritId, secretCulpritId, anomalousEventIds, anomalousEventId, anomalyMechanism, explanation, ...safeConfig } = ch.config;
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
    const safeCh = { ...ch, options: safeConfig.options ?? ch.options, config: safeConfig };
    delete (safeCh as any).explanation;
    return safeCh;
  };

  const snapshotChallenges = (Array.isArray(snapshot?.challenges) ? snapshot.challenges : []).map((c: any) => {
    const { answer, correct, ...safe } = c;
    const config = c.config ? { ...c.config } : null;
    if (config) {
      delete config.answer;
      delete config.correct;
      delete config.solutionPatch;
      delete config.explanation;
    }
    delete (safe as any).explanation;
    return { ...safe, options: c.options ?? undefined, config };
  });

  const rawChallenges = (snapshotChallenges.length > 0 ? snapshotChallenges : liveChallenges).map(safeChallenge);
  const activeIdx = rawChallenges.findIndex((c: any) => c.id === session.currentChallengeId);
  const currentChallengeIndex = activeIdx >= 0 ? activeIdx : (session.currentPosition || 0);
  const activeChallenge = rawChallenges[currentChallengeIndex] || null;

  const isQuestionState = session.status === 'QUESTION_ACTIVE' || session.status === 'QUESTION_LOCKED' || session.status === 'QUESTION_RESULTS';

  const rawActiveChallenge = (snapshot?.challenges?.[currentChallengeIndex] || liveChallenges[currentChallengeIndex]) || null;
  const rawActiveConfig = (rawActiveChallenge?.config as any) || {};

  const currentChallenge = (activeChallenge && isQuestionState) ? {
    id: activeChallenge.id,
    type: activeChallenge.type,
    prompt: activeChallenge.prompt,
    points: activeChallenge.points,
    options: activeChallenge.options,
    config: activeChallenge.config,
    timeLimit: activeChallenge.timeLimit || activeChallenge.timerSecs || 30,
    timerSecs: activeChallenge.timeLimit || activeChallenge.timerSecs || 30,
    challengeIndex: currentChallengeIndex,
    totalChallenges: rawChallenges.length,
    challengeEndsAt: session.questionEndsAt ? session.questionEndsAt.toISOString() : null,
  } : null;

  // Post-game authorized review mode state
  const reviewState = (snapshot as any)?.reviewState || null;
  const isPostGame = session.status === 'RESULTS' || session.status === 'ENDED';
  const isReviewRevealed = Boolean(reviewState?.revealed && isPostGame);

  const rawSnapshotChallenges = Array.isArray(snapshot?.challenges)
    ? snapshot.challenges
    : liveChallenges;

  let reviewChallenge: any = null;
  if (isReviewRevealed && rawSnapshotChallenges.length > 0) {
    const revIdx = Math.max(0, Math.min(rawSnapshotChallenges.length - 1, Number(reviewState?.currentQuestionIndex || 0)));
    const targetCh = rawSnapshotChallenges[revIdx] || null;
    if (targetCh) {
      const cfg = (targetCh.config || {}) as any;
      reviewChallenge = {
        id: targetCh.id,
        index: revIdx,
        position: targetCh.position ?? revIdx + 1,
        prompt: targetCh.prompt,
        type: targetCh.type,
        points: targetCh.points,
        options: targetCh.options || cfg.options || [],
        correctAnswer: cfg.answer !== undefined ? cfg.answer : (cfg.correct !== undefined ? cfg.correct : targetCh.answer),
        explanation: cfg.explanation || targetCh.explanation || null,
        totalQuestions: rawSnapshotChallenges.length,
      };
    }
  }

  // Mask future challenges in currentGame.challenges so students never see prompts or options ahead of time
  const sanitizedChallenges = rawChallenges.map((ch: any, idx: number) => {
    // If the game is ended or at results, or it's the current or past question, keep details
    if (session.status === 'RESULTS' || session.status === 'ENDED' || idx <= currentChallengeIndex) {
      return ch;
    }
    // Future question: preserve identifiers, points, timer, position for progress tracking, but mask playable content
    return {
      id: ch.id,
      position: ch.position ?? idx,
      type: ch.type,
      points: ch.points,
      timeLimit: ch.timeLimit || ch.timerSecs || 30,
      timerSecs: ch.timeLimit || ch.timerSecs || 30,
      prompt: `[ LOCKED - QUESTION ${idx + 1} ]`,
      options: [],
      config: {},
    };
  });

  return {
    session: {
      id: session.id,
      eventId: session.eventId,
      roomCode: session.roomCode,
      status: session.status,
      stageMode: effectiveStageMode,
      currentGameId: session.currentGameId,
      currentChallengeId: session.currentChallengeId,
      challengeStartTime: session.challengeStartTime,
      questionEndsAt: session.questionEndsAt,
      currentPosition: session.currentPosition,
      currentRun: session.currentRun,
      sequence: session.sequence,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      gmId: session.gmId,
      snapshotVersion: session.snapshotVersion,
      isReviewRevealed,
      reviewQuestionIndex: isReviewRevealed ? (reviewState?.currentQuestionIndex ?? 0) : null,
    },
    event: {
      id: session.event.id,
      name: session.event.name,
      mode: session.event.mode,
      games: session.event.games,
    },
    game: session.currentGame ? {
      id: session.currentGame.id,
      name: snapshot?.gameName || session.currentGame.name,
      template: session.currentGame.template,
      maxPlayers: Number(snapshot?.maxPlayers ?? session.currentGame.maxPlayers ?? 200),
      teamsEnabled: snapshot ? Boolean(snapshot.teamsEnabled) : session.currentGame.teamsEnabled,
      leaderboardVisibility: session.currentGame.leaderboardVisibility,
      speedBonus: session.currentGame.speedBonus,
    } : {
      id: '',
      name: session.event.name,
      template: 'QUIZ',
      maxPlayers: 200,
      teamsEnabled: false,
      leaderboardVisibility: 'LIVE',
      speedBonus: false,
    },
    currentGame: session.currentGame ? {
      id: session.currentGame.id,
      name: snapshot?.gameName || session.currentGame.name,
      template: session.currentGame.template,
      maxPlayers: Number(snapshot?.maxPlayers ?? session.currentGame.maxPlayers ?? 200),
      challenges: sanitizedChallenges,
    } : null,
    currentChallenge,
    reviewChallenge,
    isReviewRevealed,
    reviewQuestionIndex: isReviewRevealed ? (reviewState?.currentQuestionIndex ?? 0) : null,
    playerCount: session.players.length,
    teamCount: uniqueTeams.size,
    answersCount,
    leaderboard,
    teamLeaderboard: scores.teams,
    individualLeaderboard: scores.individuals,
    timeBonusConfig: scores.timeBonusConfig,
    playerRoster,
    teamRoster,
    teamResponses,
    teamsRespondedCount,
    chainProgress,
    dockProgress,
    witnessProgress,
    scannerProgress,
    missionProgress,
    routerProgress,
  };
}

/**
 * Purges all temporary game-room / session chat messages for a finished session.
 * Emits 'team:chat_cleared' to sockets so client UI resets to empty state.
 */
export async function purgeGameSessionChat(sessionId: string, roomCode?: string, io?: any): Promise<void> {
  try {
    const deleteResult = await prisma.teamMessage.deleteMany({
      where: {
        OR: [
          { sessionId },
          ...(roomCode ? [{ roomCode }] : [])
        ]
      }
    });

    console.log(`[Chat Cleanup] Purged ${deleteResult.count} temporary game session chat messages for session ${sessionId} (${roomCode || 'no roomCode'})`);

    if (io) {
      if (roomCode) {
        io.to(`session:${roomCode}`).emit('team:chat_cleared', { sessionId, roomCode });
      }
      const sessionPlayers = await prisma.sessionPlayer.findMany({
        where: { sessionId },
        select: { teamId: true }
      });
      const teamIds = new Set(sessionPlayers.map(p => p.teamId).filter(Boolean));
      for (const tId of teamIds) {
        io.to(`team:${tId}`).emit('team:chat_cleared', { sessionId, roomCode, teamId: tId });
      }
    }
  } catch (err: any) {
    console.error(`[Chat Cleanup Error] Failed to purge session chat for ${sessionId}:`, err);
  }
}
