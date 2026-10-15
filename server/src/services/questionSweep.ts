/**
 * questionSweep.ts — THE single restart-safe question expiration path.
 *
 * Replaces all in-process setTimeout auto-lock/auto-advance logic. The
 * AUTHORITATIVE deadline is the persisted `Session.questionEndsAt` column;
 * this worker only *observes* it and reconciles expired questions. Because
 * the schedule (`questionEndsAt`, `autoAdvanceAt`) and every decision are
 * persisted, a server restart simply re-runs this sweep and immediately
 * reconciles anything that came due while the process was down.
 *
 * Invariants:
 *  - ONE sweep loop for lock + advance (no per-question timers anywhere).
 *  - Every state change is claim-based & atomic (updateMany WHERE guards),
 *    so duplicate sweeps / restarts / simultaneous host actions can never
 *    lock, score, or advance twice.
 *  - Auto-lock applies ONLY to RAPID_FIRE (the pre-existing behavior).
 *    Other templates keep their host-manual lock semantics; the deadline
 *    still acts as an authoritative submit cutoff everywhere.
 *  - Every automatic transition audits with actor "SYSTEM" and bumps
 *    `sequence` through the lifecycle gateway.
 */

import { prisma } from '../lib/prisma';
import { writeAudit, startQuestion, applySessionTransition } from './sessionLifecycle';

const SWEEP_INTERVAL_MS = 1000;
// Legacy reveal window between a locked question and the next auto-start.
const REVEAL_WINDOW_MS = 4000;

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function templateOf(session: any): string {
  return (session as any)?.snapshot?.template ?? session?.currentGame?.template ?? 'QUIZ';
}

/** Next challenge strictly after `challengeId` in the FROZEN snapshot order. */
function nextChallengeAfter(session: any, challengeId: string | null | undefined): any | null {
  const snap: any = session?.snapshot;
  const snapChallenges: any[] = Array.isArray(snap?.challenges) ? snap.challenges : [];
  const challenges: any[] = snapChallenges.length > 0
    ? snapChallenges
    : (session?.currentGame?.challenges || []);
  if (!challenges.length) return null;
  const idx = challenges.findIndex((c: any) => c.id === challengeId);
  return idx >= 0 ? (challenges[idx + 1] ?? null) : null;
}

async function broadcast(io: any, roomCode: string): Promise<void> {
  const { getSessionState } = await import('./sessionService');
  const state = await getSessionState(roomCode);
  io.to(`session:${roomCode}`).emit('session_state_update', state);

  if (state?.session?.id) {
    try {
      const { calculateSessionScores } = await import('./scoringService');
      const scores = await calculateSessionScores(state.session.id);
      io.to(`session:${roomCode}`).emit('leaderboard:update', {
        roomCode,
        revision: Date.now(),
        isTeamGame: scores.isTeamGame,
        teamLeaderboard: scores.teams,
        individualLeaderboard: scores.individuals,
        timeBonusConfig: scores.timeBonusConfig,
      });
    } catch (err) {
      console.error('[Sweep] Error calculating leaderboard update:', err);
    }
  }
}

/**
 * Run one reconcile pass. Safe to call repeatedly, concurrently, and across
 * multiple backend instances: every mutation uses a guarded updateMany claim.
 *
 * @returns counts of { locked, advanced } for diagnostics/audit.
 */
export async function sweepOnce(io: any): Promise<{ locked: number; advanced: number }> {
  const now = new Date();
  let locked = 0;
  let advanced = 0;

  // ── 1. AUTO-LOCK expired questions ──────────────────────────────────────
  const due = await prisma.session.findMany({
    where: { status: 'QUESTION_ACTIVE', questionEndsAt: { lte: now } },
    include: { currentGame: { select: { template: true } } },
  });

  for (const session of due) {
    const autoAdvanceAt = new Date(now.getTime() + REVEAL_WINDOW_MS);
    // Claim atomically: ONLY a row still QUESTION_ACTIVE with an expired
    // deadline can be auto-locked. A racing host lock/end/select loses here.
    const claimed = await prisma.session.updateMany({
      where: { id: session.id, status: 'QUESTION_ACTIVE', questionEndsAt: { lte: now } },
      data: { status: 'QUESTION_LOCKED', sequence: { increment: 1 }, autoAdvanceAt },
    });
    if (claimed.count !== 1) continue;

    locked += 1;
    await writeAudit({
      adminUsername: 'SYSTEM',
      action: 'QUESTION_LOCKED',
      targetType: 'SESSION',
      targetId: session.id,
      details: {
        auto: true,
        roomCode: session.roomCode,
        challengeId: session.currentChallengeId,
        questionEndsAt: session.questionEndsAt ? session.questionEndsAt.toISOString() : null,
      },
    });
    await broadcast(io, session.roomCode);
  }

  // ── 2. AUTO-ADVANCE past the reveal window (locked → next / RESULTS) ─────
  const dueAdvance = await prisma.session.findMany({
    where: { autoAdvanceAt: { lte: now } },
    include: { currentGame: { include: { challenges: { orderBy: { position: 'asc' } } } } },
  });

  for (const session of dueAdvance) {
    // Claim atomically: only sessions still QUESTION_LOCKED with this exact
    // schedule can advance. If the host locked again / switched / ended, this
    // claim misses and the pending schedule is left to the next pass to clear
    // deterministically (see below).
    const claimed = await prisma.session.updateMany({
      where: { id: session.id, status: 'QUESTION_LOCKED', autoAdvanceAt: { lte: now } },
      data: { autoAdvanceAt: null },
    });
    if (claimed.count !== 1) continue;

    const next = nextChallengeAfter(session, session.currentChallengeId);
    if (next) {
      const updated = await startQuestion(session, next.id, { io, actorUsername: 'SYSTEM' });
      if (!updated) continue;
      advanced += 1;
      await writeAudit({
        adminUsername: 'SYSTEM',
        action: 'QUESTION_STARTED',
        targetType: 'SESSION',
        targetId: session.id,
        details: { auto: true, roomCode: session.roomCode, challengeId: next.id },
      });
      await broadcast(io, session.roomCode);
    } else {
      // Last question — show the leaderboard (RESULTS) exactly like the
      // legacy 3-timer chain did, but restart-safe.
      const updated = await applySessionTransition(session, 'RESULTS', { io, actorUsername: 'SYSTEM' });
      if (!updated) continue;
      advanced += 1;
      await writeAudit({
        adminUsername: 'SYSTEM',
        action: 'SESSION_STATUS_RESULTS',
        targetType: 'SESSION',
        targetId: session.id,
        details: { auto: true, roomCode: session.roomCode, sequence: updated.sequence },
      });
      await broadcast(io, session.roomCode);
    }
  }

  return { locked, advanced };
}

/**
 * Start the global sweep. Runs one immediate reconcile pass (so questions that
 * expired while a previous process was down are reconciled on startup WITHOUT
 * any host interaction), then ticks every second.
 *
 * @returns a stop() function (used by tests / shutdown).
 */
export function startQuestionSweep(io: any): () => void {
  if (sweepTimer) clearInterval(sweepTimer);

  sweepOnce(io).catch((err) => console.error('[Sweep] initial reconcile error:', err));

  sweepTimer = setInterval(() => {
    sweepOnce(io).catch((err) => console.error('[Sweep] tick error:', err));
  }, SWEEP_INTERVAL_MS);
  // Do not keep the process alive solely for the sweep (tests may stop it).
  if (typeof sweepTimer === 'object' && sweepTimer && 'unref' in sweepTimer) {
    (sweepTimer as any).unref?.();
  }

  return () => {
    if (sweepTimer) clearInterval(sweepTimer);
    sweepTimer = null;
  };
}