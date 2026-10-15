/**
 * GET /api/sessions/:sessionId/report
 *
 * Generates and streams an XLSX Game Performance Report for a completed session.
 *
 * Authorization:
 *   - Authenticated Game Master / Club Admin / SUPER_ADMIN / ADMIN only.
 *   - Must be authorized for the event that owns this session.
 *   - Students (PLAYER role) are denied.
 *
 * Security:
 *   - No passwords, tokens, hashes, or private credentials are included.
 *   - User-controlled text (team names, usernames) is sanitized to prevent
 *     Excel formula injection (values starting with =, +, -, @).
 *   - Authorization is derived exclusively from the server-side auth context.
 *
 * Score Authority:
 *   - All scores are read from the `submissions` table (authoritative final scores).
 *   - Team scores = sum of individual `submission.score` values per team in that session.
 *   - This matches the live leaderboard calculation in sessionService.ts.
 */

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { checkEventAuthorization } from '../utils/authorization';
import ExcelJS from 'exceljs';
import { calculateSessionScores } from '../services/scoringService';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sanitize a cell value to prevent Excel formula injection.
 * Values beginning with =, +, -, @ are prefixed with a single quote
 * (which ExcelJS passes as a text prefix, harmless in spreadsheet display).
 */
function sanitizeCell(value: string | null | undefined): string {
  const s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

/**
 * Format a duration in milliseconds as "Xh Ym" or "Ym" or "< 1 minute".
 */
function formatDuration(ms: number): string {
  if (ms <= 0) return '< 1 minute';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} minute${m !== 1 ? 's' : ''}`;
  return '< 1 minute';
}

/**
 * Format a Date to "DD Month YYYY"
 */
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format a Date to "HH:MM AM/PM IST"
 */
function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
    hour12: true,
  }).toUpperCase() + ' IST';
}

// ─── XLSX Style helpers ──────────────────────────────────────────────────────

type ExcelFill = ExcelJS.Fill & { type: 'pattern'; pattern: string };

function headerFill(hex: string): ExcelFill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex.replace('#', '') } };
}

const TERMINAL_GREEN = '00FFCC';
const TERMINAL_DARK  = '050608';
const RANK_GOLD      = 'FFD700';
const RANK_SILVER    = 'C0C0C0';
const RANK_BRONZE    = 'CD7F32';

function applyHeaderRow(row: ExcelJS.Row, bgArgb: string, fgArgb: string = 'FFFFFFFF') {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: fgArgb }, name: 'Consolas', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } } as ExcelFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2D3848' } },
      left: { style: 'thin', color: { argb: 'FF2D3848' } },
      bottom: { style: 'thin', color: { argb: 'FF2D3848' } },
      right: { style: 'thin', color: { argb: 'FF2D3848' } },
    };
  });
}

function applyDataRow(row: ExcelJS.Row, bgArgb: string = 'FF0F1319') {
  row.eachCell(cell => {
    cell.font = { name: 'Consolas', size: 9, color: { argb: 'FFE6EDF3' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } } as ExcelFill;
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1A222E' } },
      left: { style: 'thin', color: { argb: 'FF1A222E' } },
      bottom: { style: 'thin', color: { argb: 'FF1A222E' } },
      right: { style: 'thin', color: { argb: 'FF1A222E' } },
    };
  });
}

// ─── Route ──────────────────────────────────────────────────────────────────

router.get('/:sessionId/report', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId: string = String(req.params.sessionId ?? '');
  const userId = req.userId!;

  // 1. Load requester
  const requester = await prisma.user.findUnique({ where: { id: userId } });
  if (!requester) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // 2. Only GMs / Admins may download. Students (PLAYER role) are denied.
  if (requester.role === 'PLAYER') {
    res.status(403).json({ error: 'Forbidden: Game Master authorization required' });
    return;
  }

  if (requester.role === 'GAME_MASTER') {
    if (requester.approvalStatus !== 'APPROVED') {
      res.status(403).json({ error: 'Forbidden: Game Master pending approval' });
      return;
    }
    if (requester.mustChangePassword) {
      res.status(403).json({ error: 'Password change required before accessing Game Master functionality', mustChangePassword: true });
      return;
    }
  }

  // 3. Load session — try by ID first, then by room code
  const session = await prisma.session.findFirst({
    where: {
      OR: [
        { id: sessionId },
        { roomCode: sessionId.toUpperCase() },
      ],
    },
    include: {
      event: {
        include: {
          club: { select: { id: true, name: true } },
          creator: { select: { id: true, username: true, name: true } },
          games: {
            include: { game: true },
            orderBy: { position: 'asc' },
          },
        },
      },
      players: {
        include: {
          user: { select: { id: true, username: true, name: true } },
          team: { select: { id: true, name: true } },
        },
        where: { status: 'ACTIVE' },
      },
    },
  }) as any;  // cast to avoid recursive Prisma type inference limits

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // 4. Authorize: requester must be authorized for this event or be the session's host GM
  const isAuthorized = (session.gmId && session.gmId === userId) || await checkEventAuthorization(session.eventId, userId);
  if (!isAuthorized) {
    res.status(403).json({ error: 'Forbidden: You are not authorized for this session' });
    return;
  }

  // 5. Report only available for ended sessions
  if (session.status !== 'ENDED') {
    res.status(409).json({
      error: 'Report not available',
      message: 'The game session must be ENDED before a report can be generated.',
      currentStatus: session.status,
    });
    return;
  }

  // 6. Check finalization: session must have an endedAt timestamp
  if (!session.endedAt) {
    res.status(409).json({
      error: 'Report not available',
      message: 'Session finalization is still in progress. Please try again shortly.',
    });
    return;
  }

  // 7. Load all submissions for this session (for question attempt stats)
  const allSubmissions = await prisma.submission.findMany({
    where: { sessionId: session.id },
    include: {
      player: {
        include: { user: { select: { id: true, username: true, name: true } } },
      },
      challenge: { select: { id: true, prompt: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  // Calculate authoritative scores via the scoring engine
  const scoresResult = await calculateSessionScores(session.id);

  // ── Determine the primary game ────────────────────────────────────────────
  // Use the game that was active when the session ended, or the first game.
  const primaryGameEntry = session.event.games[0];
  const gameName = primaryGameEntry?.game?.name || session.event.name;
  const gameTemplate = primaryGameEntry?.game?.template || 'QUIZ';
  const teamsEnabled = scoresResult.isTeamGame || primaryGameEntry?.game?.teamsEnabled || false;
  const eventCreator = session.event.creator;
  const club = session.event.club;

  // ── Map authoritative scores ──────────────────────────────────────────────
  const players = scoresResult.individuals.map(ind => ({
    playerId: ind.playerId,
    userId: ind.userId,
    username: ind.username,
    handle: `${ind.username}@terminal`,
    teamId: ind.teamId,
    teamName: ind.teamName,
    totalScore: ind.score,
    correctCount: ind.questionsCorrect,
    attemptedCount: ind.questionsAttempted,
    rank: ind.rank,
  }));

  const teamResults = scoresResult.teams.map(tm => ({
    teamId: tm.teamId,
    teamName: tm.teamName,
    members: tm.members.map(m => ({
      username: m.username,
      handle: `${m.username}@terminal`,
      totalScore: m.score,
    })),
    baseScore: tm.baseScore,
    timeBonus: tm.timeBonus,
    teamScore: tm.finalScore,
    rank: tm.rank,
  }));

  const individualRanked = [...players];

  // ── Session metadata ──────────────────────────────────────────────────────
  const startedAt   = session.startedAt  ?? session.createdAt;
  const endedAt     = session.endedAt;
  const durationMs  = endedAt.getTime() - startedAt.getTime();
  const sessionDate = formatDate(startedAt);
  const sessionStart = formatTime(startedAt);
  const sessionEnd   = formatTime(endedAt);
  const duration     = formatDuration(durationMs);
  const totalTeams   = teamsEnabled ? teamResults.length : 0;
  const totalPlayers = players.length;
  const roomCode     = session.roomCode;
  const reportTitle  = `TERMINAL — ${gameName.toUpperCase()} // GAME PERFORMANCE REPORT`;

  // ── Challenge stats ───────────────────────────────────────────────────────
  const uniqueChallengeIds = new Set(allSubmissions.map(s => s.challengeId));
  const totalQuestionsAttempted = uniqueChallengeIds.size;
  const totalSubmissions = allSubmissions.length;
  const totalCorrect = allSubmissions.filter(s => s.isCorrect).length;
  const avgScore = players.length > 0
    ? Math.round(players.reduce((sum, p) => sum + p.totalScore, 0) / players.length)
    : 0;
  const highestIndividualScore = players.length > 0
    ? Math.max(...players.map(p => p.totalScore))
    : 0;
  const highestTeamScore = teamResults.length > 0
    ? Math.max(...teamResults.map(t => t.teamScore))
    : 0;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BUILD WORKBOOK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const wb = new ExcelJS.Workbook();
  wb.creator = 'TERMINAL by CODENEX';
  wb.created = new Date();
  wb.modified = new Date();
  wb.properties.date1904 = false;

  // ── SHEET 1: Game Report ─────────────────────────────────────────────────

  const ws1 = wb.addWorksheet('Game Report', {
    properties: { tabColor: { argb: 'FF00FFCC' } },
  });
  ws1.properties.defaultRowHeight = 18;

  // Header block — Report title row
  ws1.mergeCells('A1:G1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = reportTitle;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FF00FFCC' }, name: 'Consolas' };
  titleCell.fill = headerFill(TERMINAL_DARK);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 28;

  // Sub-header: TERMINAL / CODENEX branding
  ws1.mergeCells('A2:G2');
  const brandCell = ws1.getCell('A2');
  brandCell.value = 'TERMINAL  //  CODENEX  //  GAME PERFORMANCE REPORT';
  brandCell.font = { bold: false, size: 9, color: { argb: 'FF5E6B7C' }, name: 'Consolas' };
  brandCell.fill = headerFill(TERMINAL_DARK);
  brandCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 16;

  // Divider
  ws1.mergeCells('A3:G3');
  ws1.getCell('A3').fill = headerFill('1A222E');
  ws1.getRow(3).height = 4;

  // Metadata rows — label / value pairs
  const meta: [string, string][] = [
    ['GAME',            sanitizeCell(gameName)],
    ['EVENT',           sanitizeCell(session.event.name)],
    ['CLUB',            sanitizeCell(club?.name ?? '—')],
    ['DATE',            sessionDate],
    ['START TIME',      sessionStart],
    ['END TIME',        sessionEnd],
    ['DURATION',        duration],
    ['ROOM CODE',       sanitizeCell(roomCode)],
    ['GM',              sanitizeCell(eventCreator ? `${eventCreator.username}@terminal` : '—')],
    ['TOTAL TEAMS',     teamsEnabled ? String(totalTeams) : 'N/A (Individual Mode)'],
    ['TOTAL PARTICIPANTS', String(totalPlayers)],
  ];

  let metaRow = 4;
  for (const [label, value] of meta) {
    ws1.mergeCells(`A${metaRow}:B${metaRow}`);
    ws1.mergeCells(`C${metaRow}:G${metaRow}`);
    const lCell = ws1.getCell(`A${metaRow}`);
    const vCell = ws1.getCell(`C${metaRow}`);
    lCell.value = label;
    vCell.value = value;
    lCell.font = { bold: true, size: 9, color: { argb: 'FF5E6B7C' }, name: 'Consolas' };
    vCell.font = { bold: true, size: 10, color: { argb: 'FFE6EDF3' }, name: 'Consolas' };
    lCell.fill = headerFill('0F1319');
    vCell.fill = headerFill('0A0C10');
    lCell.alignment = { vertical: 'middle', horizontal: 'left' };
    vCell.alignment = { vertical: 'middle', horizontal: 'left' };
    // Special color for room code
    if (label === 'ROOM CODE') {
      vCell.font = { bold: true, size: 14, color: { argb: 'FF' + TERMINAL_GREEN }, name: 'Consolas' };
    }
    ws1.getRow(metaRow).height = 20;
    metaRow++;
  }

  // Divider before team table
  metaRow++;
  ws1.mergeCells(`A${metaRow}:G${metaRow}`);
  const divCell = ws1.getCell(`A${metaRow}`);
  divCell.value = teamsEnabled ? '═══ TEAM PERFORMANCE ═══' : '═══ INDIVIDUAL PERFORMANCE ═══';
  divCell.font = { bold: true, size: 10, color: { argb: 'FF' + TERMINAL_GREEN }, name: 'Consolas' };
  divCell.fill = headerFill('161C24');
  divCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(metaRow).height = 22;
  metaRow++;

  // ── Team table headers ────────────────────────────────────────────────────
  ws1.getColumn('A').width = 8;   // RANK
  ws1.getColumn('B').width = 22;  // TEAM NAME
  ws1.getColumn('C').width = 38;  // MEMBERS
  ws1.getColumn('D').width = 24;  // INDIVIDUAL SCORES
  ws1.getColumn('E').width = 14;  // TEAM SCORE
  ws1.getColumn('F').width = 10;  // (spare)
  ws1.getColumn('G').width = 10;  // (spare)

  const hasTimeBonus = scoresResult.timeBonusConfig.enabled;
  if (teamsEnabled && teamResults.length > 0) {
    if (hasTimeBonus) {
      ws1.getColumn('E').width = 14;  // BASE SCORE
      ws1.getColumn('F').width = 14;  // SPEED BONUS
      ws1.getColumn('G').width = 16;  // FINAL SCORE
      const hRow = ws1.addRow(['RANK', 'TEAM NAME', 'MEMBERS', 'INDIVIDUAL SCORES', 'BASE SCORE', 'SPEED BONUS', 'FINAL SCORE']);
      hRow.height = 22;
      applyHeaderRow(hRow, 'FF' + TERMINAL_DARK, 'FF' + TERMINAL_GREEN);
      hRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let ri = 0; ri < teamResults.length; ri++) {
        const t = teamResults[ri];
        const rank = ri + 1;
        const membersStr = t.members.map(m => sanitizeCell(m.handle)).join('\n');
        const scoresStr  = t.members.map(m => String(m.totalScore)).join('\n');

        const rankBg = rank === 1 ? ('FF' + RANK_GOLD.slice(1)) : rank === 2 ? ('FF' + RANK_SILVER.slice(1)) : rank === 3 ? ('FF' + RANK_BRONZE.slice(1)) : 'FF0F1319';
        const rankFg = rank <= 3 ? 'FF050608' : 'FFE6EDF3';

        const dRow = ws1.addRow([
          rank,
          sanitizeCell(t.teamName),
          membersStr,
          scoresStr,
          t.baseScore,
          t.timeBonus,
          t.teamScore,
        ]);
        dRow.height = Math.max(22, t.members.length * 16);
        applyDataRow(dRow, 'FF0F1319');

        // Rank cell styling
        dRow.getCell(1).font = { bold: true, size: 11, name: 'Consolas', color: { argb: rankFg } };
        dRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rankBg } } as ExcelFill;
        dRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Scores
        dRow.getCell(5).font = { bold: false, size: 10, name: 'Consolas', color: { argb: 'FFE6EDF3' } };
        dRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        dRow.getCell(6).font = { bold: false, size: 10, name: 'Consolas', color: { argb: 'FF3FB950' } };
        dRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        dRow.getCell(7).font = { bold: true, size: 11, name: 'Consolas', color: { argb: 'FF' + TERMINAL_GREEN } };
        dRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        // Members / scores wrap
        dRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
        dRow.getCell(4).alignment = { wrapText: true, vertical: 'top' };
        dRow.getCell(2).alignment = { vertical: 'middle' };
      }
    } else {
      const hRow = ws1.addRow(['RANK', 'TEAM NAME', 'MEMBERS', 'INDIVIDUAL SCORES', 'TEAM SCORE']);
      hRow.height = 22;
      applyHeaderRow(hRow, 'FF' + TERMINAL_DARK, 'FF' + TERMINAL_GREEN);
      hRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let ri = 0; ri < teamResults.length; ri++) {
        const t = teamResults[ri];
        const rank = ri + 1;
        const membersStr = t.members.map(m => sanitizeCell(m.handle)).join('\n');
        const scoresStr  = t.members.map(m => String(m.totalScore)).join('\n');

        const rankBg = rank === 1 ? ('FF' + RANK_GOLD.slice(1)) : rank === 2 ? ('FF' + RANK_SILVER.slice(1)) : rank === 3 ? ('FF' + RANK_BRONZE.slice(1)) : 'FF0F1319';
        const rankFg = rank <= 3 ? 'FF050608' : 'FFE6EDF3';

        const dRow = ws1.addRow([
          rank,
          sanitizeCell(t.teamName),
          membersStr,
          scoresStr,
          t.teamScore,
        ]);
        dRow.height = Math.max(22, t.members.length * 16);
        applyDataRow(dRow, 'FF0F1319');

        // Rank cell styling
        dRow.getCell(1).font = { bold: true, size: 11, name: 'Consolas', color: { argb: rankFg } };
        dRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rankBg } } as ExcelFill;
        dRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Team score cell
        dRow.getCell(5).font = { bold: true, size: 11, name: 'Consolas', color: { argb: 'FF' + TERMINAL_GREEN } };
        dRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Members / scores wrap
        dRow.getCell(3).alignment = { wrapText: true, vertical: 'top' };
        dRow.getCell(4).alignment = { wrapText: true, vertical: 'top' };
        dRow.getCell(2).alignment = { vertical: 'middle' };
      }
    }
  } else if (!teamsEnabled) {
    // Individual mode table
    const hRow = ws1.addRow(['RANK', 'PLAYER HANDLE', 'SCORE', 'CORRECT', 'ATTEMPTED', 'ACCURACY']);
    hRow.height = 22;
    applyHeaderRow(hRow, 'FF' + TERMINAL_DARK, 'FF' + TERMINAL_GREEN);

    ws1.getColumn('C').width = 14;
    ws1.getColumn('D').width = 12;
    ws1.getColumn('E').width = 14;
    ws1.getColumn('F').width = 12;

    for (let ri = 0; ri < individualRanked.length; ri++) {
      const p = individualRanked[ri];
      const rank = ri + 1;
      const accuracy = p.attemptedCount > 0
        ? `${Math.round((p.correctCount / p.attemptedCount) * 100)}%`
        : '0%';
      const rankBg = rank === 1 ? ('FF' + RANK_GOLD.slice(1)) : rank === 2 ? ('FF' + RANK_SILVER.slice(1)) : rank === 3 ? ('FF' + RANK_BRONZE.slice(1)) : 'FF0F1319';
      const rankFg = rank <= 3 ? 'FF050608' : 'FFE6EDF3';

      const dRow = ws1.addRow([
        rank,
        sanitizeCell(p.handle),
        p.totalScore,
        p.correctCount,
        p.attemptedCount,
        accuracy,
      ]);
      dRow.height = 20;
      applyDataRow(dRow);
      dRow.getCell(1).font = { bold: true, size: 10, name: 'Consolas', color: { argb: rankFg } };
      dRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rankBg } } as ExcelFill;
      dRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      dRow.getCell(3).font = { bold: true, size: 10, name: 'Consolas', color: { argb: 'FF' + TERMINAL_GREEN } };
    }
  } else {
    // No participants
    ws1.mergeCells(`A${metaRow}:G${metaRow}`);
    ws1.getCell(`A${metaRow}`).value = 'NO PARTICIPATION DATA';
    ws1.getCell(`A${metaRow}`).font = { italic: true, color: { argb: 'FF5E6B7C' }, name: 'Consolas', size: 10 };
    ws1.getCell(`A${metaRow}`).alignment = { horizontal: 'center' };
  }

  // ── SHEET 2: Individual Performance ─────────────────────────────────────

  const ws2 = wb.addWorksheet('Individual Performance', {
    properties: { tabColor: { argb: 'FF3FB950' } },
  });
  ws2.properties.defaultRowHeight = 18;

  ws2.getColumn('A').width = 8;   // RANK
  ws2.getColumn('B').width = 8;   // TEAM RANK
  ws2.getColumn('C').width = 22;  // TEAM NAME
  ws2.getColumn('D').width = 26;  // STUDENT HANDLE
  ws2.getColumn('E').width = 14;  // INDIVIDUAL SCORE
  ws2.getColumn('F').width = 12;  // CORRECT
  ws2.getColumn('G').width = 14;  // ATTEMPTED
  ws2.getColumn('H').width = 12;  // ACCURACY

  const ws2Title = ws2.addRow(['TERMINAL // INDIVIDUAL PERFORMANCE REPORT']);
  ws2.mergeCells(`A${ws2Title.number}:H${ws2Title.number}`);
  ws2Title.height = 24;
  ws2Title.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF00FFCC' }, name: 'Consolas' };
  ws2Title.getCell(1).fill = headerFill(TERMINAL_DARK);
  ws2Title.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  // Meta
  const ws2Meta: [string, string][] = [
    ['GAME', sanitizeCell(gameName)],
    ['DATE', sessionDate],
    ['ROOM CODE', sanitizeCell(roomCode)],
  ];
  for (const [l, v] of ws2Meta) {
    const r = ws2.addRow([l, '', v]);
    ws2.mergeCells(`A${r.number}:B${r.number}`);
    ws2.mergeCells(`C${r.number}:H${r.number}`);
    r.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF5E6B7C' }, name: 'Consolas' };
    r.getCell(3).font = { bold: true, size: 9, color: { argb: 'FFE6EDF3' }, name: 'Consolas' };
    r.getCell(1).fill = headerFill('0F1319');
    r.getCell(3).fill = headerFill('0A0C10');
    r.height = 18;
  }

  // Column headers
  const indHeaders = ws2.addRow(['RANK', 'TEAM RANK', 'TEAM', 'STUDENT HANDLE', 'SCORE', 'CORRECT', 'ATTEMPTED', 'ACCURACY']);
  indHeaders.height = 22;
  applyHeaderRow(indHeaders, 'FF' + TERMINAL_DARK, 'FF' + TERMINAL_GREEN);

  // Build team rank lookup
  const teamRankMap = new Map<string, number>();
  teamResults.forEach((t, idx) => teamRankMap.set(t.teamId, idx + 1));

  for (let ri = 0; ri < individualRanked.length; ri++) {
    const p = individualRanked[ri];
    const rank = ri + 1;
    const teamRank = p.teamId ? (teamRankMap.get(p.teamId) ?? '—') : '—';
    const accuracy = p.attemptedCount > 0
      ? `${Math.round((p.correctCount / p.attemptedCount) * 100)}%`
      : '0%';

    const dRow = ws2.addRow([
      rank,
      teamRank,
      sanitizeCell(p.teamName ?? '—'),
      sanitizeCell(p.handle),
      p.totalScore,
      p.correctCount,
      p.attemptedCount,
      accuracy,
    ]);
    dRow.height = 18;
    applyDataRow(dRow);
    dRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    dRow.getCell(5).font = { bold: true, size: 10, name: 'Consolas', color: { argb: 'FF' + TERMINAL_GREEN } };
  }

  // ── SHEET 3: Game Summary ────────────────────────────────────────────────

  const ws3 = wb.addWorksheet('Game Summary', {
    properties: { tabColor: { argb: 'FFFCCE0A' } },
  });
  ws3.properties.defaultRowHeight = 18;
  ws3.getColumn('A').width = 32;
  ws3.getColumn('B').width = 24;

  ws3.mergeCells('A1:B1');
  const ws3Title = ws3.getCell('A1');
  ws3Title.value = 'TERMINAL // GAME SUMMARY';
  ws3Title.font = { bold: true, size: 12, color: { argb: 'FF00FFCC' }, name: 'Consolas' };
  ws3Title.fill = headerFill(TERMINAL_DARK);
  ws3Title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 24;

  const summaryRows: [string, string | number][] = [
    ['GAME',                   sanitizeCell(gameName)],
    ['EVENT',                  sanitizeCell(session.event.name)],
    ['CLUB',                   sanitizeCell(club?.name ?? '—')],
    ['GM',                     sanitizeCell(eventCreator ? `${eventCreator.username}@terminal` : '—')],
    ['DATE',                   sessionDate],
    ['START TIME',             sessionStart],
    ['END TIME',               sessionEnd],
    ['DURATION',               duration],
    ['ROOM CODE',              sanitizeCell(roomCode)],
    ['TOTAL TEAMS',            teamsEnabled ? totalTeams : 'N/A'],
    ['TOTAL PARTICIPANTS',     totalPlayers],
    ['QUESTIONS ATTEMPTED',    totalQuestionsAttempted],
    ['TOTAL SUBMISSIONS',      totalSubmissions],
    ['TOTAL CORRECT',          totalCorrect],
    ['AVERAGE INDIVIDUAL SCORE', avgScore],
    ['HIGHEST INDIVIDUAL SCORE', highestIndividualScore],
    ['HIGHEST TEAM SCORE',     teamsEnabled ? highestTeamScore : 'N/A'],
    ['GAME DURATION',          duration],
  ];

  for (const [label, value] of summaryRows) {
    const sRow = ws3.addRow([label, value]);
    sRow.height = 20;
    sRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF5E6B7C' }, name: 'Consolas' };
    sRow.getCell(2).font = { bold: true, size: 10, color: { argb: 'FFE6EDF3' }, name: 'Consolas' };
    sRow.getCell(1).fill = headerFill('0F1319');
    sRow.getCell(2).fill = headerFill('0A0C10');
    sRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    sRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    sRow.getCell(1).border = {
      bottom: { style: 'thin', color: { argb: 'FF1A222E' } },
      right:  { style: 'thin', color: { argb: 'FF1A222E' } },
    };
    sRow.getCell(2).border = {
      bottom: { style: 'thin', color: { argb: 'FF1A222E' } },
    };
  }

  // ── Stream the workbook ───────────────────────────────────────────────────

  // Sanitize filename
  const safeGame = gameName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30);
  const safeCode = roomCode.replace(/[^A-Z0-9]/g, '');
  const filename = `TERMINAL_${safeGame}_${safeCode}_REPORT.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  await wb.xlsx.write(res);
  res.end();
});

export default router;
