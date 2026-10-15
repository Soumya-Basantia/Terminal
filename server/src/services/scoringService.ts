import { prisma } from '../lib/prisma';

export interface PlayerScoreSummary {
  playerId: string;
  userId: string;
  username: string;
  name: string | null;
  usn: string | null;
  teamId: string | null;
  teamName: string | null;
  score: number;
  questionsAttempted: number;
  questionsCorrect: number;
  rank: number;
}

export interface TeamScoreSummary {
  teamId: string;
  teamName: string;
  membersCount: number;
  members: Array<{
    playerId: string;
    userId: string;
    username: string;
    score: number;
  }>;
  perQuestionScores: Record<string, number>; // total for question (base average + speed bonus)
  perQuestionBaseScores: Record<string, number>; // base question average
  perQuestionSpeedBonus: Record<string, number>; // team speed bonus for question
  baseScore: number;
  speedBonus: number;
  timeBonus: number; // alias for speedBonus
  finalScore: number;
  rank: number;
}

export interface SessionScoresResult {
  isTeamGame: boolean;
  timeBonusConfig: {
    enabled: boolean;
    points: number;
    ruleDescription: string;
  };
  teams: TeamScoreSummary[];
  individuals: PlayerScoreSummary[];
  topTeams: Array<{
    name: string;
    score: number;
    baseScore: number;
    speedBonus: number;
    timeBonus: number;
    rank: number;
  }>;
  topIndividuals: Array<{ name: string; score: number; teamName?: string; rank: number }>;
  leaderboard: any[];
}

/**
 * Deterministic rounding utility to avoid floating-point display artifacts (e.g. 7.5000000001).
 * Consistently rounds to at most 1 decimal place.
 */
export function roundScore(val: number): number {
  if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

/**
 * Authoritative scoring engine for TERMINAL sessions.
 *
 * Scoring Rules:
 * 1. Individual Question Score:
 *    - Each student's correct submission scores the challenge base points (e.g., 10).
 *    - Incorrect or missing submission scores 0.
 *
 * 2. Team Question Score (Rapid Fire & Quiz):
 *    - Calculated PER QUESTION as the AVERAGE of the individual question scores
 *      of all registered team members in the session.
 *    - Example: 4 members scored [10, 10, 0, 10] -> Team question base average = 30 / 4 = 7.5.
 *    - Unanswered or late questions count as 0. Missing or disconnected players
 *      are NOT removed from the denominator.
 *
 * 3. Team-Level Speed Bonus:
 *    - When speed bonus is enabled, a team earns a server-calculated bonus for answering
 *      correctly earlier within the time limit or bonus window.
 *    - Applied at the TEAM LEVEL (not summed across players) to avoid team-size bias.
 *    - Final question score = base question average + team question speed bonus.
 *
 * 4. Final Team Score:
 *    - FINAL TEAM SCORE = Sum of per-question scores (or BASE SCORE + SPEED BONUS).
 */
export async function calculateSessionScores(sessionId: string): Promise<SessionScoresResult> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      currentGame: {
        include: {
          challenges: { orderBy: { position: 'asc' } }
        }
      },
      event: {
        include: {
          games: {
            include: { game: { include: { challenges: { orderBy: { position: 'asc' } } } } },
            orderBy: { position: 'asc' }
          }
        }
      },
      players: {
        where: { status: { not: 'BANNED' } },
        include: {
          user: { select: { id: true, username: true, name: true, usn: true } },
          team: { select: { id: true, name: true } }
        }
      }
    }
  });

  if (!session) {
    return {
      isTeamGame: false,
      timeBonusConfig: { enabled: false, points: 0, ruleDescription: 'Time bonus disabled' },
      teams: [],
      individuals: [],
      topTeams: [],
      topIndividuals: [],
      leaderboard: []
    };
  }

  const primaryGame = session.currentGame || session.event.games[0]?.game;
  const isTeamGame = Boolean(primaryGame?.teamsEnabled);
  const gameConfig = (primaryGame?.config as any) || {};

  const timeBonusEnabled = Boolean(primaryGame?.speedBonus || gameConfig.timeBonusEnabled || gameConfig.speedBonus);
  const completionBonusPoints = Number(gameConfig.timeBonusPoints ?? 0);
  const maxSpeedBonusSetting = gameConfig.maxSpeedBonus ?? gameConfig.maxBonus;
  const hasQuestionSpeedBonus = timeBonusEnabled && (
    maxSpeedBonusSetting !== undefined ||
    completionBonusPoints === 0 ||
    gameConfig.speedBonusMode === 'QUESTION' ||
    gameConfig.speedBonusType === 'PER_QUESTION'
  );
  const isGameFinished = session.status === 'ENDED' || session.status === 'RESULTS';

  const timeBonusConfig = {
    enabled: timeBonusEnabled,
    points: hasQuestionSpeedBonus ? (Number(maxSpeedBonusSetting) || 5) : completionBonusPoints,
    ruleDescription: timeBonusEnabled
      ? (hasQuestionSpeedBonus
          ? `Speed Bonus enabled: up to ${Number(maxSpeedBonusSetting) || 5} PTS awarded per question for fast correct team responses`
          : `+${completionBonusPoints} PTS Final Completion Time Bonus added upon game finalization`)
      : 'Speed bonus disabled'
  };

  // Collect all challenges associated with current game / event
  const challenges = primaryGame?.challenges || [];

  // Fetch submissions for this session and current run
  const submissions = await prisma.submission.findMany({
    where: {
      sessionId: session.id,
      runId: session.currentRun
    },
    include: {
      player: {
        include: { user: { select: { id: true, username: true, name: true, usn: true } } }
      },
      team: { select: { id: true, name: true } }
    }
  });

  // 1. Calculate Individual Scores
  const playerMap = new Map<string, PlayerScoreSummary>();

  for (const sp of session.players) {
    const pSubs = submissions.filter(s => s.playerId === sp.id);
    const score = pSubs.reduce((sum, s) => sum + (s.score || 0), 0);
    const questionsAttempted = pSubs.length;
    const questionsCorrect = pSubs.filter(s => s.isCorrect).length;

    playerMap.set(sp.id, {
      playerId: sp.id,
      userId: sp.userId,
      username: sp.user.username,
      name: sp.user.name,
      usn: sp.user.usn,
      teamId: sp.teamId,
      teamName: sp.team?.name || null,
      score,
      questionsAttempted,
      questionsCorrect,
      rank: 1
    });
  }

  // 2. Calculate Team Scores with Stable Team Denominator & Speed Bonus
  const teamMap = new Map<string, TeamScoreSummary>();

  // Identify all distinct teams among non-banned players
  for (const sp of session.players) {
    if (!sp.teamId || !sp.team) continue;
    if (!teamMap.has(sp.teamId)) {
      teamMap.set(sp.teamId, {
        teamId: sp.teamId,
        teamName: sp.team.name,
        membersCount: 0,
        members: [],
        perQuestionScores: {},
        perQuestionBaseScores: {},
        perQuestionSpeedBonus: {},
        baseScore: 0,
        speedBonus: 0,
        timeBonus: 0,
        finalScore: 0,
        rank: 1
      });
    }
  }

  // Populate team members
  for (const sp of session.players) {
    if (sp.teamId && teamMap.has(sp.teamId)) {
      const team = teamMap.get(sp.teamId)!;
      const pSummary = playerMap.get(sp.id);
      team.members.push({
        playerId: sp.id,
        userId: sp.userId,
        username: sp.user.username,
        score: pSummary?.score || 0
      });
      team.membersCount = team.members.length;
    }
  }

  // Compute per-question average and team speed bonus for each team
  for (const team of teamMap.values()) {
    const teamPlayerIds = team.members.map(m => m.playerId);
    const teamSize = Math.max(team.membersCount, 1);
    let accumulatedBase = 0;
    let accumulatedSpeedBonus = 0;

    for (const ch of challenges) {
      let questionSum = 0;
      const correctSubs: Array<{ playerId: string; responseTime: number }> = [];

      for (const pId of teamPlayerIds) {
        const sub = submissions.find(s => s.playerId === pId && s.challengeId === ch.id);
        if (sub && sub.isCorrect) {
          const pts = (typeof sub.score === 'number' && sub.score > 0) ? sub.score : ch.points;
          questionSum += pts;
          correctSubs.push({
            playerId: pId,
            responseTime: Math.max(0, sub.responseTime || 0)
          });
        }
      }

      // Base Average: SUM(correct member scores) / teamSize
      const questionAvg = roundScore(questionSum / teamSize);
      team.perQuestionBaseScores[ch.id] = questionAvg;

      // Question Speed Bonus: calculated at the TEAM level
      let qSpeedBonus = 0;
      const qTimeLimit = Number(ch.timeLimit || (ch.config as any)?.timerSecs || (ch.config as any)?.timeLimit || 0);
      const qTimeLimitMs = qTimeLimit * 1000;
      const bonusWindowSecs = Number(gameConfig.speedBonusWindow || 0);
      const windowMs = bonusWindowSecs > 0 ? Math.min(qTimeLimitMs, bonusWindowSecs * 1000) : qTimeLimitMs;

      let maxBonusForQ = 0;
      if (hasQuestionSpeedBonus && windowMs > 0) {
        if (maxSpeedBonusSetting !== undefined && !isNaN(Number(maxSpeedBonusSetting))) {
          maxBonusForQ = Math.max(0, Number(maxSpeedBonusSetting));
        } else {
          maxBonusForQ = roundScore(ch.points * 0.5) || 5;
        }
      }

      if (hasQuestionSpeedBonus && maxBonusForQ > 0 && correctSubs.length > 0 && windowMs > 0) {
        // Average speed ratio of correct team responders
        const sumRatios = correctSubs.reduce((acc, sub) => {
          const respTime = sub.responseTime;
          if (respTime < windowMs) {
            return acc + (windowMs - respTime) / windowMs;
          }
          return acc;
        }, 0);
        const avgRatio = Math.max(0, Math.min(1, sumRatios / correctSubs.length));
        qSpeedBonus = roundScore(maxBonusForQ * avgRatio);
      }

      team.perQuestionSpeedBonus[ch.id] = qSpeedBonus;
      team.perQuestionScores[ch.id] = roundScore(questionAvg + qSpeedBonus);

      accumulatedBase += questionAvg;
      accumulatedSpeedBonus += qSpeedBonus;
    }

    team.baseScore = roundScore(accumulatedBase);

    // Apply end-of-game completion bonus if configured
    const finalCompletionBonus = (timeBonusEnabled && isGameFinished && completionBonusPoints > 0)
      ? completionBonusPoints
      : 0;

    team.speedBonus = roundScore(accumulatedSpeedBonus + finalCompletionBonus);
    team.timeBonus = team.speedBonus;
    team.finalScore = roundScore(team.baseScore + team.speedBonus);
  }

  // 3. Rank Teams (descending by finalScore, then baseScore, then speedBonus)
  const rankedTeams = Array.from(teamMap.values()).sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.baseScore !== a.baseScore) return b.baseScore - a.baseScore;
    return b.speedBonus - a.speedBonus;
  });
  rankedTeams.forEach((t, i) => {
    t.rank = i + 1;
  });

  // 4. Rank Individuals (descending by score)
  const rankedIndividuals = Array.from(playerMap.values()).sort((a, b) => b.score - a.score);
  rankedIndividuals.forEach((p, i) => {
    p.rank = i + 1;
  });

  const topTeams = rankedTeams.slice(0, 10).map(t => ({
    name: t.teamName,
    score: t.finalScore,
    baseScore: t.baseScore,
    speedBonus: t.speedBonus,
    timeBonus: t.timeBonus,
    rank: t.rank,
    perQuestionScores: t.perQuestionScores,
    perQuestionBaseScores: t.perQuestionBaseScores,
    perQuestionSpeedBonus: t.perQuestionSpeedBonus
  }));

  const topIndividuals = rankedIndividuals.slice(0, 10).map(p => ({
    name: p.username,
    score: p.score,
    teamName: p.teamName || undefined,
    rank: p.rank
  }));

  return {
    isTeamGame,
    timeBonusConfig,
    teams: rankedTeams,
    individuals: rankedIndividuals,
    topTeams,
    topIndividuals,
    leaderboard: isTeamGame && topTeams.length > 0 ? topTeams : topIndividuals
  };
}
