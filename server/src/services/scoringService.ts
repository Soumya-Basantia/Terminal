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
  perQuestionScores: Record<string, number>;
  baseScore: number;
  timeBonus: number;
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
  topTeams: Array<{ name: string; score: number; baseScore: number; timeBonus: number; rank: number }>;
  topIndividuals: Array<{ name: string; score: number; teamName?: string; rank: number }>;
  leaderboard: any[];
}

/**
 * Authoritative scoring engine for TERMINAL sessions.
 *
 * Scoring Rules:
 * 1. Individual Question Score:
 *    - Each student's correct submission scores the challenge points (e.g., 10).
 *    - Incorrect or missing submission scores 0.
 *
 * 2. Team Question Score (Rapid Fire & Quiz):
 *    - Calculated PER QUESTION as the AVERAGE of the individual question scores
 *      of the team members (divided by active team size).
 *    - Example: 4 members scored [10, 10, 0, 10] -> Team question score = 30 / 4 = 7.5.
 *
 * 3. Base Team Score:
 *    - Sum of the per-question team averages across all questions.
 *
 * 4. Final Time Bonus:
 *    - If speedBonus / time bonus is enabled on the game, a configured bonus (e.g. 10 pts)
 *      is added at the END of the game when session is finalized (ENDED / RESULTS).
 *    - Time bonus is NEVER included in the per-question average.
 *    - FINAL TEAM SCORE = BASE TEAM SCORE + FINAL TIME BONUS.
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
        where: { status: 'ACTIVE' },
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
  const timeBonusPoints = Number(gameConfig.timeBonusPoints ?? (timeBonusEnabled ? 10 : 0));
  const isGameFinished = session.status === 'ENDED' || session.status === 'RESULTS';

  const timeBonusConfig = {
    enabled: timeBonusEnabled,
    points: timeBonusPoints,
    ruleDescription: timeBonusEnabled
      ? `+${timeBonusPoints} PTS Final Completion Time Bonus added upon game finalization`
      : 'Time bonus disabled'
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

  // 2. Calculate Team Scores with Per-Question Averaging
  const teamMap = new Map<string, TeamScoreSummary>();

  // Identify all distinct teams among active players
  for (const sp of session.players) {
    if (!sp.teamId || !sp.team) continue;
    if (!teamMap.has(sp.teamId)) {
      teamMap.set(sp.teamId, {
        teamId: sp.teamId,
        teamName: sp.team.name,
        membersCount: 0,
        members: [],
        perQuestionScores: {},
        baseScore: 0,
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

  // Compute per-question average for each team
  for (const team of teamMap.values()) {
    const teamPlayerIds = team.members.map(m => m.playerId);
    const teamSize = Math.max(team.membersCount, 1);
    let accumulatedBase = 0;

    for (const ch of challenges) {
      // Find submission for each member on this question
      let questionSum = 0;
      for (const pId of teamPlayerIds) {
        const sub = submissions.find(s => s.playerId === pId && s.challengeId === ch.id);
        if (sub) {
          questionSum += sub.score || 0;
        }
      }

      // Average = questionSum / teamSize
      const questionAvg = Math.round((questionSum / teamSize) * 10) / 10;
      team.perQuestionScores[ch.id] = questionAvg;
      accumulatedBase += questionAvg;
    }

    team.baseScore = Math.round(accumulatedBase * 10) / 10;

    // Apply time bonus only at the end if enabled
    const finalBonus = (timeBonusEnabled && isGameFinished) ? timeBonusPoints : 0;
    team.timeBonus = finalBonus;
    team.finalScore = Math.round((team.baseScore + finalBonus) * 10) / 10;
  }

  // 3. Rank Teams (descending by finalScore)
  const rankedTeams = Array.from(teamMap.values()).sort((a, b) => b.finalScore - a.finalScore);
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
    timeBonus: t.timeBonus,
    rank: t.rank
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
