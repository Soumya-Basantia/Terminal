/**
 * sessionLifecycle.ts — TERMINAL authoritative live-session lifecycle.
 *
 * Single source of truth for:
 *  - the session state machine (guarded transitions, idempotency)
 *  - pre-flight validation before hosting
 *  - immutable game snapshot freezing for live sessions
 *  - server-authoritative question timing
 *  - idempotent finalization
 *
 * The live session MUST be controlled through this service (REST commands or
 * socket handlers) so that no client can write an arbitrary session status.
 */

import { prisma } from '../lib/prisma';
import type { Session, SessionStatus } from '@prisma/client';
import { validateQuestionTypeSemantics } from '../routes/games';
import { deriveStageModeFromStatus } from './sessionService';

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical allowed transitions. `ENDED` is terminal.
 * Key rules enforced:
 *   - WAITING/LOBBY → COMPLETED only through explicit cancellation (ENDED)
 *   - COMPLETED/ENDED can never leave
 *   - STARTING may only go forward into a round/question or a clean end
 *   - a finished question can be followed by the next question, results, or end
 */
export const SESSION_TRANSITIONS: Record<string, string[]> = {
  LOBBY: ['STARTING', 'ROUND_ACTIVE', 'QUESTION_ACTIVE', 'ENDED'],
  STARTING: ['ROUND_ACTIVE', 'QUESTION_ACTIVE', 'RESULTS', 'ENDED'],
  QUESTION_ACTIVE: ['QUESTION_LOCKED', 'QUESTION_RESULTS', 'RESULTS', 'ENDED'],
  QUESTION_LOCKED: ['QUESTION_RESULTS', 'QUESTION_ACTIVE', 'RESULTS', 'ENDED'],
  QUESTION_RESULTS: ['QUESTION_ACTIVE', 'RESULTS', 'ENDED'],
  ROUND_ACTIVE: ['RESULTS', 'QUESTION_ACTIVE', 'QUESTION_LOCKED', 'ENDED'],
  ROUND_LOCKED: ['RESULTS', 'QUESTION_ACTIVE', 'ENDED'],
  RESULTS: ['STARTING', 'ROUND_ACTIVE', 'QUESTION_ACTIVE', 'LOBBY', 'ENDED'],
  ENDED: [], // terminal — reopening a lobby after END is an explicit new host
};

export function canTransition(from: string | null | undefined, to: string): boolean {
  if (!from) return true;
  const allowed = SESSION_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PRE-FLIGHT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export interface PreflightIssue {
  questionNumber: number;
  message: string;
}

export interface PreflightResult {
  ok: boolean;
  issues: PreflightIssue[];
}

const CHOICE_TYPES = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'CHOICE', 'MULTI_CHOICE']);

export interface HostableGame {
  id: string;
  name: string;
  template: string;
  teamsEnabled: boolean;
  maxTeamSize: number;
  speedBonus: boolean;
  allowLateJoin: boolean;
  config: any;
  challenges: Array<{
    id: string;
    position: number;
    type: string;
    prompt: string;
    config: any;
    points: number;
    timeLimit: number;
    options?: any;
    answer?: any;
  }>;
}

/**
 * Validate that a game is hostable BEFORE a session is created.
 * Returns structured per-question issues suitable for a "[ BACK TO EDITOR ]" screen.
 */
export async function preflightGameForHosting(game: any): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];

  if (!game) {
    return { ok: false, issues: [{ questionNumber: 0, message: 'Game not found.' }] };
  }

  if (!game.name || !String(game.name).trim()) {
    issues.push({ questionNumber: 0, message: 'Game has no title. Add a title before hosting.' });
  }

  const challenges: any[] = (game.challenges || []).slice().sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

  if (challenges.length === 0) {
    return {
      ok: false,
      issues: [...issues, { questionNumber: 0, message: 'Game has no questions. Add at least one question before hosting.' }],
    };
  }

  for (let i = 0; i < challenges.length; i++) {
    const ch = challenges[i];
    const num = i + 1;
    const cfg = (ch.config || {}) as any;

    if (!ch.prompt || !String(ch.prompt).trim()) {
      issues.push({ questionNumber: num, message: 'Missing question text.' });
      continue;
    }

    if (CHOICE_TYPES.has(ch.type)) {
      const options = Array.isArray(cfg.options) && cfg.options.length > 0 ? cfg.options : ch.options;
      const answer = cfg.answer !== undefined ? cfg.answer : ch.answer;
      const semError = validateQuestionTypeSemantics(ch.type, options, answer);
      if (semError) {
        issues.push({ questionNumber: num, message: semError });
      }
    }

    if (!ch.points || Number(ch.points) <= 0) {
      issues.push({ questionNumber: num, message: 'Points must be greater than zero.' });
    }
    if (!ch.timeLimit || Number(ch.timeLimit) < 5) {
      issues.push({ questionNumber: num, message: 'Timer must be at least 5 seconds.' });
    }
  }

  return { ok: issues.length === 0, issues };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. IMMUTABLE GAME SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

function stableStringify(value: any): string {
  return JSON.stringify(value);
}

/**
 * Freeze the exact game configuration (including correct answers, scoring and
 * timer rules) that a live session must use. The live session reads ONLY this
 * snapshot — later edits to the original Game/Challenge rows affect future
 * sessions only.
 */
export function freezeGameSnapshot(game: any): { snapshot: any; snapshotVersion: string } {
  const challenges: any[] = (game.challenges || [])
    .slice()
    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
    .map((ch: any) => ({
      id: ch.id,
      position: ch.position || 0,
      type: ch.type,
      prompt: ch.prompt,
      points: Number(ch.points) || 0,
      timeLimit: Number(ch.timeLimit) || 30,
      options: (ch.config && ch.config.options) ?? ch.options ?? null,
      answer: (ch.config && ch.config.answer !== undefined) ? ch.config.answer : (ch.answer ?? null),
      correct: (ch.config && ch.config.correct) ?? null,
      config: ch.config ?? null,
    }));

  const snapshot = {
    frozenAt: new Date().toISOString(),
    gameId: game.id,
    gameName: game.name,
    template: game.template,
    teamsEnabled: Boolean(game.teamsEnabled),
    maxTeamSize: Number(game.maxTeamSize) || 4,
    speedBonus: Boolean(game.speedBonus),
    allowLateJoin: Boolean(game.allowLateJoin),
    leaderboardVisibility: game.leaderboardVisibility || 'LIVE',
    config: game.config ?? {},
    challenges,
  };

  // Stable hash so the same frozen configuration has the same version id.
  let version = 'snap-' + require('crypto').createHash('sha1').update(stableStringify(snapshot)).digest('hex').slice(0, 12);
  return { snapshot, snapshotVersion: version };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3b. FROZEN-CHALLENGE LOOKUP FOR SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge a live Challenge row with the FROZEN snapshot data for a session.
 * Every scoring/validation path MUST grade against these frozen values — an
 * editor can never change what a live room is graded against mid-game.
 * Falls back to the live row for legacy sessions hosted before snapshots.
 */
export function getChallengeForLiveSession(session: { snapshot?: any }, liveChallenge: any): any {
  if (!liveChallenge) return liveChallenge;
  const snapshot: any = session.snapshot;
  const snapChallenges: any[] = Array.isArray(snapshot?.challenges) ? snapshot.challenges : [];
  const frozen = snapChallenges.find((c: any) => c.id === liveChallenge.id);
  if (!frozen) return liveChallenge;
  return {
    ...liveChallenge,
    type: frozen.type ?? liveChallenge.type,
    prompt: frozen.prompt ?? liveChallenge.prompt,
    points: Number(frozen.points) || liveChallenge.points,
    timeLimit: Number(frozen.timeLimit) || liveChallenge.timeLimit,
    options: frozen.options !== undefined ? frozen.options : liveChallenge.options,
    answer: frozen.answer !== undefined ? frozen.answer : liveChallenge.answer,
    config: frozen.config || liveChallenge.config,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AUDIT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  adminId?: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? null,
        adminUsername: entry.adminUsername,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        details: (entry.details ?? {}) as any,
      },
    });
  } catch (err) {
    // Audit logging must never break the live game.
    console.error('[Audit] Failed to write audit log:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. HOSTING (idempotent, transactional)
// ─────────────────────────────────────────────────────────────────────────────

export interface HostSessionResult {
  session: any;
  created: boolean;
  reused: boolean;
}

const ACTIVELY_HOSTED = ['LOBBY', 'STARTING', 'ROUND_ACTIVE', 'ROUND_LOCKED', 'QUESTION_ACTIVE', 'QUESTION_LOCKED', 'QUESTION_RESULTS', 'RESULTS'];

/**
 * Create (or safely reuse) a live session for the given game owned by this GM.
 *
 * Idempotency protection (double-HOST / double-click / retries):
 *  - an existing non-terminal session for the SAME game + GM is reused instead
 *    of creating a duplicate;
 *  - the room code is unique and collision-checked;
 *  - the game snapshot is frozen inside the same transaction as the session.
 */
export async function hostGameForGameMaster(gmId: string, gameId: string): Promise<HostSessionResult> {
  // Reuse an active session hosted by this GM for this game (prevents duplicates)
  const existing = await prisma.session.findFirst({
    where: {
      gmId,
      currentGameId: gameId,
      status: { in: ACTIVELY_HOSTED as any },
    },
    include: { event: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return { session: existing, created: false, reused: true };
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { challenges: { orderBy: { position: 'asc' } } },
  });

  if (!game) {
    const err: any = new Error('Game not found');
    err.status = 404;
    throw err;
  }

  const preflight = await preflightGameForHosting(game);
  if (!preflight.ok) {
    const err: any = new Error('Game cannot be hosted');
    err.status = 400;
    err.code = 'PREFLIGHT_FAILED';
    err.preflight = preflight;
    throw err;
  }

  const { snapshot, snapshotVersion } = freezeGameSnapshot(game);

  // Find or create the backing Event for this game + GM (no duplicate events)
  let event = await prisma.event.findFirst({
    where: { games: { some: { gameId } }, creatorId: gmId },
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: game.name,
        description: game.description,
        creatorId: gmId,
        clubId: game.clubId,
        mode: 'SEQUENCE',
        status: 'PUBLISHED',
        games: { create: { gameId, position: 0 } },
      },
    });
  }

  // Generate a unique room code (collision-checked)
  const { generateSessionCode } = await import('../utils/sessionCode');
  let roomCode: string;
  let attempts = 0;
  do {
    roomCode = generateSessionCode();
    attempts++;
    if (attempts > 20) {
      const err: any = new Error('Could not generate unique session code');
      err.status = 500;
      throw err;
    }
  } while (await prisma.session.findUnique({ where: { roomCode } }));

  const session = await prisma.session.create({
    data: {
      roomCode,
      eventId: event.id,
      status: 'LOBBY',
      currentGameId: gameId,
      currentPosition: 0,
      currentChallengeId: null,
      currentRun: 0,
      gmId,
      snapshot: snapshot as any,
      snapshotVersion,
      sequence: 1,
    },
    include: { event: true, currentGame: true },
  });

  await writeAudit({
    adminId: gmId,
    adminUsername: 'GM',
    action: 'SESSION_CREATED',
    targetType: 'SESSION',
    targetId: session.id,
    details: { roomCode, gameId, snapshotVersion },
  });

  return { session, created: true, reused: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. TRANSITION EXECUTOR (server-authoritative)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomically transition a session to `to` if allowed, bump the monotonic
 * sequence, persist, and broadcast the fresh snapshot. Returns null when the
 * transition is invalid (no DB write happens — idempotent against dupes).
 */
export async function applySessionTransition(
  session: Session,
  to: string,
  opts: {
    io?: any;
    actorUsername?: string;
    actorId?: string;
    keepStage?: boolean;
    /**
     * Extra authoritative fields to persist atomically with the transition
     * (e.g. currentGameId / currentPosition / currentRun for game selects).
     * The GATEWAY owns every persistent status write — callers route through
     * this function instead of writing status directly.
     */
    data?: Record<string, unknown>;
  } = {}
): Promise<Session | null> {
  if (!canTransition(session.status, to)) {
    return null;
  }

  const now = new Date();
  const data: any = {
    status: to as SessionStatus,
    sequence: { increment: 1 },
    // Any explicit transition cancels a pending sweep auto-advance.
    autoAdvanceAt: null,
    ...(opts.data ?? {}),
  };

  if (to === 'RESULTS') {
    data.questionEndsAt = null;
    data.autoAdvanceAt = null;
  }
  if (to === 'ENDED') {
    data.endedAt = now;
    data.questionEndsAt = null;
    data.autoAdvanceAt = null;
  }
  if (to === 'STARTING' || to === 'ROUND_ACTIVE' || to === 'QUESTION_ACTIVE') {
    if (!session.startedAt) data.startedAt = now;
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data,
  });

  if (opts.actorUsername) {
    await writeAudit({
      adminId: opts.actorId,
      adminUsername: opts.actorUsername,
      action: `SESSION_STATUS_${to}`,
      targetType: 'SESSION',
      targetId: session.id,
      details: { from: session.status, to, sequence: updated.sequence },
    });
  }

  if (opts.io) {
    const { getSessionState } = await import('./sessionService');
    const state = await getSessionState(updated.roomCode);
    opts.io.to(`session:${updated.roomCode}`).emit('session_state_update', state);

    try {
      const { calculateSessionScores } = await import('./scoringService');
      const scores = await calculateSessionScores(session.id);
      opts.io.to(`session:${updated.roomCode}`).emit('leaderboard:update', {
        roomCode: updated.roomCode,
        revision: Date.now(),
        isTeamGame: scores.isTeamGame,
        teamLeaderboard: scores.teams,
        individualLeaderboard: scores.individuals,
        timeBonusConfig: scores.timeBonusConfig,
      });
    } catch (err) {
      console.error('[Transition] Error calculating leaderboard update:', err);
    }
  }

  return updated;
}

/**
 * Select/start a game inside a live session (host:select_game, replay_game,
 * skip_game, random_game). Routes the STARTING transition + game context
 * through the SAME gateway — one authoritative status write path.
 */
export async function selectGameForSession(
  session: Session,
  target: { gameId?: string | null; position?: number | null },
  opts: { io?: any; actorUsername?: string; actorId?: string } = {}
): Promise<Session | null> {
  if (!canTransition(session.status, 'STARTING')) {
    return null;
  }
  return applySessionTransition(session, 'STARTING', {
    ...opts,
    data: {
      currentGameId: target.gameId ?? session.currentGameId,
      currentPosition: target.position ?? session.currentPosition,
      currentChallengeId: null,
      currentRun: { increment: 1 },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. AUTHORITATIVE QUESTION TIMING
// ─────────────────────────────────────────────────────────────────────────────

export interface ActiveQuestionInfo {
  challengeId: string | null;
  questionStartedAt: Date | null;
  questionEndsAt: Date | null;
  remainingMs: number;
  expired: boolean;
}

/**
 * Server-authoritative remaining time for the current question.
 * If the deadline has already passed, the question is considered expired
 * (the host/lock logic must finalize it — clients never decide timing).
 */
export function getQuestionTiming(session: {
  status: string;
  challengeStartTime?: Date | null;
  questionEndsAt?: Date | null;
}): ActiveQuestionInfo {
  const now = Date.now();
  const ends = session.questionEndsAt ? session.questionEndsAt.getTime() : null;
  const remainingMs = ends ? Math.max(0, ends - now) : 0;
  return {
    challengeId: session.status === 'QUESTION_ACTIVE' || session.status === 'QUESTION_LOCKED' ? (session as any).currentChallengeId : null,
    questionStartedAt: session.challengeStartTime || null,
    questionEndsAt: session.questionEndsAt || null,
    remainingMs,
    expired: ends !== null && now >= ends,
  };
}

/**
 * Start a question: set QUESTION_ACTIVE, stamp challengeStartTime and the
 * server-authoritative questionEndsAt deadline, bump sequence, broadcast.
 */
export async function startQuestion(
  session: Session,
  challengeId: string,
  opts: { io?: any; actorUsername?: string; actorId?: string } = {}
): Promise<Session | null> {
  // Load the frozen snapshot challenge to get the authoritative time limit.
  const snapshot: any = (session as any).snapshot;
  const snapChallenges: any[] = Array.isArray(snapshot?.challenges) ? snapshot.challenges : [];
  let snapCh = snapChallenges.find((c: any) => c.id === challengeId);
  if (!snapCh && (session as any).currentGame?.challenges) {
    snapCh = (session as any).currentGame.challenges.find((c: any) => c.id === challengeId);
  }
  const timeLimit = snapCh?.timeLimit || snapCh?.timerSecs || 30;
  const allCh = snapChallenges.length > 0 ? snapChallenges : ((session as any).currentGame?.challenges || []);
  const idx = allCh.findIndex((c: any) => c.id === challengeId);
  const position = idx >= 0 ? idx : 0;

  // The host may freely re-arm or SWITCH questions while a question is live
  // (legacy host behavior — jump to any question at any time). The strict
  // state machine still governs every OTHER transition: this special case
  // only swaps the *active challenge + deadline*, never the session status.
  if (session.status === 'QUESTION_ACTIVE') {
    if (session.currentChallengeId === challengeId) {
      return session; // idempotent re-select — never re-stamp the timer
    }
    const now = new Date();
    const endsAt = new Date(now.getTime() + timeLimit * 1000);
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'QUESTION_ACTIVE',
        currentChallengeId: challengeId,
        currentPosition: position,
        challengeStartTime: now,
        questionEndsAt: endsAt,
        startedAt: session.startedAt || now,
        autoAdvanceAt: null, // explicit host action cancels pending sweep advance
        sequence: { increment: 1 },
      },
    });

    if (opts.actorUsername) {
      await writeAudit({
        adminId: opts.actorId,
        adminUsername: opts.actorUsername,
        action: 'QUESTION_SWITCHED',
        targetType: 'SESSION',
        targetId: session.id,
        details: { fromChallenge: session.currentChallengeId, challengeId, questionEndsAt: endsAt.toISOString(), timeLimit },
      });
    }

    if (opts.io) {
      const { getSessionState } = await import('./sessionService');
      const state = await getSessionState(updated.roomCode);
      opts.io.to(`session:${updated.roomCode}`).emit('session_state_update', state);
    }

    return updated;
  }

  if (!canTransition(session.status, 'QUESTION_ACTIVE')) {
    return null;
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + timeLimit * 1000);

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: 'QUESTION_ACTIVE',
      currentChallengeId: challengeId,
      currentPosition: position,
      challengeStartTime: now,
      questionEndsAt: endsAt,
      startedAt: session.startedAt || now,
      autoAdvanceAt: null, // explicit host action cancels pending sweep advance
      sequence: { increment: 1 },
    },
  });

  if (opts.actorUsername) {
    await writeAudit({
      adminId: opts.actorId,
      adminUsername: opts.actorUsername,
      action: 'QUESTION_STARTED',
      targetType: 'SESSION',
      targetId: session.id,
      details: { challengeId, questionEndsAt: endsAt.toISOString(), timeLimit },
    });
  }

  if (opts.io) {
    const { getSessionState } = await import('./sessionService');
    const state = await getSessionState(updated.roomCode);
    opts.io.to(`session:${updated.roomCode}`).emit('session_state_update', state);
  }

  return updated;
}

/**
 * Lock the current question (stop accepting submissions). Idempotent.
 */
export async function lockQuestion(
  session: Session,
  opts: { io?: any; actorUsername?: string; actorId?: string } = {}
): Promise<Session | null> {
  if (session.status === 'QUESTION_ACTIVE') {
    const updated = await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'QUESTION_LOCKED',
        questionEndsAt: new Date(),
        autoAdvanceAt: null, // manual lock cancels any pending sweep advance
        sequence: { increment: 1 },
      },
    });
    if (opts.actorUsername) {
      await writeAudit({
        adminId: opts.actorId,
        adminUsername: opts.actorUsername,
        action: 'QUESTION_ENDED',
        targetType: 'SESSION',
        targetId: session.id,
        details: { challengeId: session.currentChallengeId },
      });
    }
    if (opts.io) {
      const { getSessionState } = await import('./sessionService');
      const state = await getSessionState(updated.roomCode);
      opts.io.to(`session:${updated.roomCode}`).emit('session_state_update', state);
    }
    return updated;
  }
  return null;
}

/**
 * Finalization — idempotent. Repeated END requests must never duplicate
 * scores or results, so this is a guarded, externally-idempotent operation.
 */
export async function finalizeSession(
  session: Session,
  opts: { io?: any; actorUsername?: string; actorId?: string } = {}
): Promise<{ session: Session; alreadyEnded: boolean }> {
  if (session.status === 'ENDED') {
    return { session, alreadyEnded: true };
  }

  const now = new Date();
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { status: 'ENDED', endedAt: now, questionEndsAt: null, autoAdvanceAt: null, sequence: { increment: 1 } },
  });

  if (opts.actorUsername) {
    await writeAudit({
      adminId: opts.actorId,
      adminUsername: opts.actorUsername,
      action: 'GAME_ENDED',
      targetType: 'SESSION',
      targetId: session.id,
      details: { sequence: updated.sequence },
    });
  }

  if (opts.io) {
    const { getSessionState, purgeGameSessionChat } = await import('./sessionService');
    await purgeGameSessionChat(updated.id, updated.roomCode, opts.io);
    const state = await getSessionState(updated.roomCode);
    opts.io.to(`session:${updated.roomCode}`).emit('session_state_update', state);

    try {
      const { calculateSessionScores } = await import('./scoringService');
      const scores = await calculateSessionScores(session.id);
      opts.io.to(`session:${updated.roomCode}`).emit('leaderboard:update', {
        roomCode: updated.roomCode,
        revision: Date.now(),
        isTeamGame: scores.isTeamGame,
        teamLeaderboard: scores.teams,
        individualLeaderboard: scores.individuals,
        timeBonusConfig: scores.timeBonusConfig,
      });
    } catch (err) {
      console.error('[Finalize] Error calculating leaderboard update:', err);
    }
  }

  return { session: updated, alreadyEnded: false };
}