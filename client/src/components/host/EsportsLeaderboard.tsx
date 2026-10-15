import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Trophy, Crown, ArrowUp, ArrowDown, Minus, Zap, Users, User, Shield } from 'lucide-react';
import { MOTION_TOKENS, REDUCED_MOTION_TRANSITION } from '../../styles/motion';

export interface EsportsLeaderboardProps {
  sessionCode: string;
  teamsEnabled?: boolean;
  teamLeaderboard: Array<{
    teamId: string;
    teamName: string;
    rank?: number;
    baseScore?: number;
    perQuestionScores?: Record<string, number>;
    speedBonus?: number;
    timeBonus?: number;
    finalScore?: number;
  }>;
  individualLeaderboard: Array<{
    playerId: string;
    username: string;
    teamName?: string;
    rank?: number;
    score: number;
    questionsAttempted?: number;
    questionsCorrect?: number;
  }>;
  teamResponsesList?: Array<{
    teamId: string;
    teamName: string;
    respondedCount: number;
    totalMembers: number;
  }>;
  challenges?: Array<any>;
  isSpotlight?: boolean;
}

interface ScoreDelta {
  id: string;
  delta: number;
  timestamp: number;
}

export function EsportsLeaderboard({
  sessionCode,
  teamsEnabled = true,
  teamLeaderboard = [],
  individualLeaderboard = [],
  teamResponsesList = [],
  challenges = [],
  isSpotlight = false,
}: EsportsLeaderboardProps) {
  const [tab, setTab] = useState<'TEAMS' | 'PLAYERS'>(teamsEnabled ? 'TEAMS' : 'PLAYERS');

  useEffect(() => {
    if (!teamsEnabled) {
      setTab('PLAYERS');
    }
  }, [teamsEnabled]);
  const shouldReduceMotion = useReducedMotion();

  // Track previous scores & ranks for real-time animations
  const prevScoresRef = useRef<Record<string, number>>({});
  const prevRanksRef = useRef<Record<string, number>>({});
  const [deltas, setDeltas] = useState<Record<string, ScoreDelta>>({});
  const [flashRows, setFlashRows] = useState<Record<string, boolean>>({});

  // Leader change banner
  const prevLeaderRef = useRef<string | null>(null);
  const [newLeaderBanner, setNewLeaderBanner] = useState<{ name: string; score: number } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect score updates and rank shifts in both teamLeaderboard and individualLeaderboard
  useEffect(() => {
    const currentScores: Record<string, number> = {};
    const currentRanks: Record<string, number> = {};
    const newDeltas: Record<string, ScoreDelta> = {};
    const newFlashes: Record<string, boolean> = {};

    // 1. Process teams
    if (teamLeaderboard && teamLeaderboard.length > 0) {
      teamLeaderboard.forEach((t, idx) => {
        const id = t.teamId || `team-${idx}`;
        const score = t.finalScore !== undefined ? (Math.round(t.finalScore * 10) / 10) : (t.baseScore ?? 0);
        const rank = t.rank ?? idx + 1;
        currentScores[id] = score;
        currentRanks[id] = rank;

        const prevScore = prevScoresRef.current[id];
        if (prevScore !== undefined && score !== prevScore) {
          const diff = Math.round((score - prevScore) * 10) / 10;
          newDeltas[id] = { id, delta: diff, timestamp: Date.now() };
          newFlashes[id] = true;
        }
      });
    }

    // 2. Process individual players (solo mode or player spotlight)
    if (individualLeaderboard && individualLeaderboard.length > 0) {
      individualLeaderboard.forEach((ind, idx) => {
        const id = ind.playerId || ind.username || `player-${idx}`;
        const score = ind.score ?? 0;
        const rank = ind.rank ?? idx + 1;
        currentScores[id] = score;
        currentRanks[id] = rank;

        const prevScore = prevScoresRef.current[id];
        if (prevScore !== undefined && score !== prevScore) {
          const diff = Math.round((score - prevScore) * 10) / 10;
          newDeltas[id] = { id, delta: diff, timestamp: Date.now() };
          newFlashes[id] = true;
        }
      });
    }

    // 3. Check if 1st place changed hands in active mode
    const isTeamMode = teamsEnabled && teamLeaderboard && teamLeaderboard.length > 0;
    if (isTeamMode) {
      const currentFirst = teamLeaderboard[0];
      if (currentFirst) {
        const currentFirstId = currentFirst.teamId || currentFirst.teamName;
        if (prevLeaderRef.current && prevLeaderRef.current !== currentFirstId) {
          setNewLeaderBanner({
            name: currentFirst.teamName,
            score: currentFirst.finalScore !== undefined ? Math.round(currentFirst.finalScore * 10) / 10 : (currentFirst.baseScore ?? 0),
          });
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setNewLeaderBanner(null), 4000);
        }
        prevLeaderRef.current = currentFirstId;
      }
    } else if (individualLeaderboard && individualLeaderboard.length > 0) {
      const currentFirst = individualLeaderboard[0];
      if (currentFirst) {
        const currentFirstId = currentFirst.playerId || currentFirst.username;
        if (prevLeaderRef.current && prevLeaderRef.current !== currentFirstId) {
          setNewLeaderBanner({
            name: `${currentFirst.username}@terminal`,
            score: currentFirst.score ?? 0,
          });
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setNewLeaderBanner(null), 4000);
        }
        prevLeaderRef.current = currentFirstId;
      }
    }

    // 4. Update deltas and flash triggers without early returning (prevents stale refs)
    if (Object.keys(newDeltas).length > 0) {
      setDeltas(prev => ({ ...prev, ...newDeltas }));
      setFlashRows(prev => ({ ...prev, ...newFlashes }));

      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlashRows({});
      }, 1500);
    }

    // Always update previous scores and ranks
    prevScoresRef.current = { ...prevScoresRef.current, ...currentScores };
    prevRanksRef.current = { ...prevRanksRef.current, ...currentRanks };
  }, [teamLeaderboard, individualLeaderboard, teamsEnabled]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Compute rank movement for a given entity
  const getRankDelta = (id: string, currentRank: number) => {
    const prevRank = prevRanksRef.current[id];
    if (prevRank === undefined) return 0;
    return prevRank - currentRank; // Positive means moved UP (e.g. 3 -> 1 is +2)
  };

  const transitionSettings = shouldReduceMotion
    ? REDUCED_MOTION_TRANSITION
    : MOTION_TOKENS.leaderboardReorderSpring;

  return (
    <div className={`flex flex-col flex-1 w-full min-w-0 max-w-full overflow-hidden font-mono select-none ${isSpotlight ? 'p-2 sm:p-4' : ''}`}>
      {/* ── NEW LEADER GOLD BANNER ── */}
      <AnimatePresence>
        {newLeaderBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 bg-gradient-to-r from-amber-950/80 via-yellow-950/90 to-amber-950/80 border-2 border-[#fcee0a] shadow-[0_0_24px_rgba(252,238,10,0.35)] flex items-center justify-between gap-3 text-black"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#fcee0a] flex items-center justify-center text-black font-black">
                <Crown size={18} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#fcee0a]">
                  ⚡ LEADERSHIP CHANGE // NEW TOURNAMENT LEADER
                </div>
                <div className="text-white text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{newLeaderBanner.name}</span>
                  <span className="text-[#fcee0a] text-sm">({newLeaderBanner.score} PTS)</span>
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-[#fcee0a] text-black font-black text-xs uppercase shadow-[2px_2px_0_#000]">
              RANK #1
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP BAR: TITLE & TEAMS/PLAYERS TAB SWITCHER ── */}
      <div className={`flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b2432] ${isSpotlight ? 'mb-4' : 'mb-2'}`}>
        <div className="flex items-center gap-2.5">
          <Trophy size={isSpotlight ? 20 : 16} className="text-[#fcee0a]" />
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-black uppercase text-white tracking-wider ${isSpotlight ? 'text-lg sm:text-xl' : 'text-xs'}`}>
                ESPORTS SCOREBOARD
              </span>
              <span className="px-1.5 py-0.5 bg-[rgba(0,255,204,0.15)] text-[#00ffcc] border border-[#00ffcc] text-[9px] font-black">
                LIVE SYNC
              </span>
            </div>
            {isSpotlight && (
              <span className="text-[10px] text-[#5e6b7c]">
                SESSION CODE: <strong className="text-[#00ffcc]">{sessionCode}</strong> • {teamLeaderboard.length} TEAMS ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        {teamsEnabled && (
          <div className="flex items-center bg-[#0a0c10] border border-[#2d3848] p-0.5">
            <button
              onClick={() => setTab('TEAMS')}
              className={`px-3 py-1 text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                tab === 'TEAMS'
                  ? 'bg-[#00ffcc] text-black shadow-[2px_2px_0px_#000]'
                  : 'text-[#8b99aa] hover:text-white'
              }`}
            >
              <Users size={12} />
              <span>TEAMS</span>
            </button>
            <button
              onClick={() => setTab('PLAYERS')}
              className={`px-3 py-1 text-xs font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                tab === 'PLAYERS'
                  ? 'bg-[#00ffcc] text-black shadow-[2px_2px_0px_#000]'
                  : 'text-[#8b99aa] hover:text-white'
              }`}
            >
              <User size={12} />
              <span>PLAYERS</span>
            </button>
          </div>
        )}
      </div>

      {/* ── LEADERBOARD TABLE CANVAS ── */}
      <div className="overflow-x-auto flex-1">
        {tab === 'TEAMS' ? (
          teamLeaderboard.length === 0 ? (
            <div className="text-center py-12 text-[#5e6b7c] text-xs">
              // NO TEAMS RECORDED YET ON AUTHORITATIVE SERVER FEED
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono">
              <thead>
                <tr className="border-b-2 border-[#1b2432] text-[#5e6b7c] text-[10px] sm:text-xs uppercase">
                  <th className="py-2.5 px-3 w-12 text-center">RANK</th>
                  <th className="py-2.5 px-3">TEAM</th>
                  <th className="py-2.5 px-3 text-right">BASE</th>
                  {challenges.slice(0, isSpotlight ? 10 : 6).map((_, qIdx) => (
                    <th key={qIdx} className="py-2.5 px-3 text-right">Q{qIdx + 1}</th>
                  ))}
                  <th className="py-2.5 px-3 text-right">SPEED+</th>
                  <th className="py-2.5 px-3 text-right">TOTAL</th>
                  <th className="py-2.5 px-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {teamLeaderboard.map((team, idx) => {
                  const id = team.teamId || `team-${idx}`;
                  const rank = team.rank ?? idx + 1;
                  const score = team.finalScore !== undefined ? (Math.round(team.finalScore * 10) / 10) : (team.baseScore ?? 0);
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;

                  const deltaObj = deltas[id];
                  const isFlashing = flashRows[id];
                  const rankDelta = getRankDelta(id, rank);

                  const hasAnsweredCurrent =
                    (teamResponsesList.find(t => t.teamId === team.teamId)?.respondedCount ?? 0) > 0;

                  return (
                    <motion.tr
                      key={id}
                      layout="position"
                      transition={transitionSettings}
                      className={`border-b border-[#16202c] transition-colors relative ${
                        isGold
                          ? 'bg-amber-950/20 hover:bg-amber-950/30'
                          : isSilver
                          ? 'bg-slate-900/40 hover:bg-slate-900/60'
                          : isBronze
                          ? 'bg-orange-950/20 hover:bg-orange-950/30'
                          : 'bg-[#0a0c10]/50 hover:bg-[#121822]'
                      } ${isFlashing ? 'ring-2 ring-[#00ffcc] bg-[rgba(0,255,204,0.08)]' : ''}`}
                    >
                      {/* Rank Indicator */}
                      <td className="py-2.5 sm:py-3.5 px-3 text-center font-black">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`inline-flex items-center justify-center font-black border font-mono ${
                              isSpotlight ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'
                            } ${
                              isGold
                                ? 'border-[#fcee0a] bg-[rgba(252,238,10,0.2)] text-[#fcee0a] shadow-[0_0_10px_rgba(252,238,10,0.3)]'
                                : isSilver
                                ? 'border-[#e2e8f0] bg-[rgba(226,232,240,0.2)] text-[#e2e8f0]'
                                : isBronze
                                ? 'border-[#ea580c] bg-[rgba(234,88,12,0.2)] text-[#ea580c]'
                                : 'border-[#2d3848] text-[#8b99aa]'
                            }`}
                          >
                            {rank}
                          </span>

                          {/* Rank Shift Indicator */}
                          {rankDelta > 0 && (
                            <span className="text-[#3fb950] text-[9px] font-black flex items-center" title={`Up ${rankDelta} spots`}>
                              <ArrowUp size={10} />
                            </span>
                          )}
                          {rankDelta < 0 && (
                            <span className="text-[#ff3366] text-[9px] font-black flex items-center" title={`Down ${Math.abs(rankDelta)} spots`}>
                              <ArrowDown size={10} />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Team Name */}
                      <td className="py-2.5 sm:py-3.5 px-3 font-bold text-white">
                        <div className="flex items-center gap-2">
                          {isGold && <Crown size={isSpotlight ? 18 : 14} className="text-[#fcee0a] shrink-0" />}
                          <span className={`truncate ${isSpotlight ? 'text-base sm:text-lg max-w-[280px]' : 'text-xs max-w-[180px]'}`}>
                            {team.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Base Score */}
                      <td className="py-2.5 sm:py-3.5 px-3 text-right font-black text-[#fcee0a] font-mono">
                        {team.baseScore !== undefined ? Math.round(team.baseScore * 10) / 10 : 0}
                      </td>

                      {/* Per-Question Scores */}
                      {challenges.slice(0, isSpotlight ? 10 : 6).map((ch, qIdx) => {
                        const qScore = ch?.id && team.perQuestionScores ? team.perQuestionScores[ch.id] : undefined;
                        return (
                          <td key={qIdx} className="py-2.5 sm:py-3.5 px-3 text-right font-mono">
                            {qScore !== undefined ? (
                              <span className="text-[#3fb950] font-bold">+{Math.round(qScore * 10) / 10}</span>
                            ) : (
                              <span className="text-[#3d4754]">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Speed Bonus */}
                      <td className="py-2.5 sm:py-3.5 px-3 text-right font-bold text-[#a855f7] font-mono">
                        {(() => {
                          const bonus = team.speedBonus ?? team.timeBonus ?? 0;
                          return bonus > 0 ? `+${Math.round(bonus * 10) / 10}` : '0';
                        })()}
                      </td>

                      {/* Total Score & Animated Delta Chip */}
                      <td className="py-2.5 sm:py-3.5 px-3 text-right font-black font-mono relative">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`${isSpotlight ? 'text-xl sm:text-2xl' : 'text-sm'} ${
                              isGold ? 'text-[#fcee0a]' : 'text-[#00ffcc]'
                            }`}
                          >
                            {score}
                          </span>

                          {/* Floating Score Delta Floater */}
                          {deltaObj && (
                            <motion.span
                              initial={{ opacity: 1, y: 0, scale: 1 }}
                              animate={{ opacity: 0, y: -16, scale: 1.15 }}
                              transition={{ duration: 1.2, ease: 'easeOut' }}
                              className="text-[10px] font-black text-[#3fb950] bg-black/60 px-1 border border-[#3fb950]"
                            >
                              +{deltaObj.delta}
                            </motion.span>
                          )}
                        </div>
                      </td>

                      {/* Answer Status */}
                      <td className="py-2.5 sm:py-3.5 px-3 text-center">
                        {hasAnsweredCurrent ? (
                          <span className="px-2 py-0.5 bg-[rgba(63,185,80,0.15)] text-[#3fb950] border border-[#3fb950] text-[9px] font-black">
                            ANSWERED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-[rgba(252,238,10,0.1)] text-[#fcee0a] border border-[#fcee0a] text-[9px] font-black">
                            THINKING
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          /* PLAYERS TAB */
          individualLeaderboard.length === 0 ? (
            <div className="text-center py-12 text-[#5e6b7c] text-xs">
              // NO INDIVIDUAL SCORES RECORDED YET ON AUTHORITATIVE FEED
            </div>
          ) : (
            <table className="w-full text-left border-collapse font-mono">
              <thead>
                <tr className="border-b-2 border-[#1b2432] text-[#5e6b7c] text-[10px] sm:text-xs uppercase">
                  <th className="py-2.5 px-3 w-12 text-center">RANK</th>
                  <th className="py-2.5 px-3">PLAYER</th>
                  <th className="py-2.5 px-3">TEAM</th>
                  <th className="py-2.5 px-3 text-right">SCORE</th>
                  <th className="py-2.5 px-3 text-right">ATTEMPTED</th>
                  <th className="py-2.5 px-3 text-right">CORRECT</th>
                  <th className="py-2.5 px-3 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {individualLeaderboard.map((ind, idx) => {
                  const id = ind.playerId || ind.username || `player-${idx}`;
                  const rank = ind.rank ?? idx + 1;
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;

                  const deltaObj = deltas[id];
                  const isFlashing = flashRows[id];
                  const rankDelta = getRankDelta(id, rank);

                  return (
                    <motion.tr
                      key={id}
                      layout="position"
                      transition={transitionSettings}
                      className={`border-b border-[#16202c] transition-colors relative ${
                        isGold
                          ? 'bg-amber-950/20 hover:bg-amber-950/30'
                          : isSilver
                          ? 'bg-slate-900/40 hover:bg-slate-900/60'
                          : isBronze
                          ? 'bg-orange-950/20 hover:bg-orange-950/30'
                          : 'bg-[#0a0c10]/50 hover:bg-[#121822]'
                      } ${isFlashing ? 'ring-2 ring-[#00ffcc] bg-[rgba(0,255,204,0.08)]' : ''}`}
                    >
                      <td className="py-2.5 sm:py-3.5 px-3 text-center font-black">
                        <div className="flex items-center justify-center gap-1">
                          <span
                            className={`inline-flex items-center justify-center font-black border font-mono ${
                              isSpotlight ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'
                            } ${
                              isGold
                                ? 'border-[#fcee0a] bg-[rgba(252,238,10,0.2)] text-[#fcee0a] shadow-[0_0_10px_rgba(252,238,10,0.3)]'
                                : isSilver
                                ? 'border-[#e2e8f0] bg-[rgba(226,232,240,0.2)] text-[#e2e8f0]'
                                : isBronze
                                ? 'border-[#ea580c] bg-[rgba(234,88,12,0.2)] text-[#ea580c]'
                                : 'border-[#2d3848] text-[#8b99aa]'
                            }`}
                          >
                            {rank}
                          </span>

                          {/* Rank Shift Indicator */}
                          {rankDelta > 0 && (
                            <span className="text-[#3fb950] text-[9px] font-black flex items-center" title={`Up ${rankDelta} spots`}>
                              <ArrowUp size={10} />
                            </span>
                          )}
                          {rankDelta < 0 && (
                            <span className="text-[#ff3366] text-[9px] font-black flex items-center" title={`Down ${Math.abs(rankDelta)} spots`}>
                              <ArrowDown size={10} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3.5 px-3 font-bold text-white">
                        <div className="flex items-center gap-2">
                          {isGold && <Crown size={isSpotlight ? 18 : 14} className="text-[#fcee0a] shrink-0" />}
                          <span className={`truncate ${isSpotlight ? 'text-base sm:text-lg max-w-[280px]' : 'text-xs max-w-[180px]'}`}>
                            {ind.username}@terminal
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3.5 px-3 text-[#8b99aa]">
                        {ind.teamName || 'SOLO'}
                      </td>
                      <td className="py-2.5 sm:py-3.5 px-3 text-right font-black font-mono relative">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`${isSpotlight ? 'text-xl sm:text-2xl' : 'text-sm'} ${
                              isGold ? 'text-[#fcee0a]' : 'text-[#00ffcc]'
                            }`}
                          >
                            {ind.score} PTS
                          </span>

                          {/* Floating Score Delta Floater */}
                          {deltaObj && (
                            <motion.span
                              initial={{ opacity: 1, y: 0, scale: 1 }}
                              animate={{ opacity: 0, y: -16, scale: 1.15 }}
                              transition={{ duration: 1.2, ease: 'easeOut' }}
                              className="text-[10px] font-black text-[#3fb950] bg-black/60 px-1 border border-[#3fb950]"
                            >
                              +{deltaObj.delta}
                            </motion.span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3.5 px-3 text-right text-[#8b99aa] font-mono">
                        {ind.questionsAttempted ?? 0}
                      </td>
                      <td className="py-2.5 sm:py-3.5 px-3 text-right text-[#3fb950] font-mono font-bold">
                        {ind.questionsCorrect ?? 0}
                      </td>
                      <td className="py-2.5 sm:py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-[rgba(63,185,80,0.15)] text-[#3fb950] border border-[#3fb950] text-[9px] font-black">
                          ACTIVE
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
