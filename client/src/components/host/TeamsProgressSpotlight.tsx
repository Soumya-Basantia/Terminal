import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, User, CheckCircle2, Wifi, Clock, Activity, AlertCircle } from 'lucide-react';
import { MOTION_TOKENS, REDUCED_MOTION_TRANSITION } from '../../styles/motion';

export interface TeamsProgressSpotlightProps {
  isSpotlight: boolean;
  teamsEnabled?: boolean;
  playerRoster?: Array<any>;
  teamResponsesList: Array<{
    teamId: string;
    teamName: string;
    respondedCount: number;
    totalMembers: number;
  }>;
  totalParticipants: number;
  maxCapacity: number;
  totalTeams: number;
  totalAnswers: number;
  onlineConnections: number;
  currentChallengeIndex: number;
  totalQuestions: number;
  challenges: Array<any>;
  state: string;
}

export function TeamsProgressSpotlight({
  isSpotlight,
  teamsEnabled = true,
  playerRoster = [],
  teamResponsesList = [],
  totalParticipants,
  maxCapacity,
  totalTeams,
  totalAnswers,
  onlineConnections,
  currentChallengeIndex,
  totalQuestions,
  challenges = [],
  state,
}: TeamsProgressSpotlightProps) {
  const shouldReduceMotion = useReducedMotion();
  const transitionSettings = shouldReduceMotion
    ? REDUCED_MOTION_TRANSITION
    : { duration: 0.3, ease: 'easeOut' as const };

  return (
    <div className={`flex flex-col flex-1 w-full font-mono select-none ${isSpotlight ? 'p-2 sm:p-6' : 'p-3'}`}>
      {/* ── TOP METRICS CARDS (IN SPOTLIGHT) ── */}
      {isSpotlight && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-[#0a0c10] border-2 border-[#38bdf8] p-3 sm:p-4 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-1">
              <User size={14} className="text-[#38bdf8]" />
              <span>Participants</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-white font-mono">
              {totalParticipants} <span className="text-xs sm:text-sm text-[#5e6b7c]">/ {maxCapacity}</span>
            </div>
          </div>

          <div className="bg-[#0a0c10] border-2 border-[#a855f7] p-3 sm:p-4 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-1">
              <Users size={14} className="text-[#a855f7]" />
              <span>Active Teams</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-white font-mono">
              {totalTeams}
            </div>
          </div>

          <div className="bg-[#0a0c10] border-2 border-[#00ffcc] p-3 sm:p-4 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-1">
              <CheckCircle2 size={14} className="text-[#00ffcc]" />
              <span>Submissions</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#00ffcc] font-mono">
              {totalAnswers} <span className="text-xs sm:text-sm text-[#5e6b7c]">/ {totalParticipants}</span>
            </div>
          </div>

          <div className="bg-[#0a0c10] border-2 border-[#3fb950] p-3 sm:p-4 shadow-[4px_4px_0_0_#000]">
            <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-1">
              <Wifi size={14} className="text-[#3fb950]" />
              <span>Live Connections</span>
            </div>
            <div className="text-2xl sm:text-4xl font-black text-[#3fb950] font-mono flex items-center gap-2">
              <span>{onlineConnections}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950] animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* ── QUESTION TIMELINE PIPELINE ── */}
      <div className="mb-6 bg-[#0a0c10] border-2 border-[#1b2432] p-4 shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase text-[#00ffcc] tracking-wider">
            &gt; QUESTION PROGRESSION TIMELINE ({totalQuestions} TOTAL)
          </span>
          <span className="text-xs text-[#8b99aa]">
            STATUS: <strong className="text-white uppercase">{state}</strong>
          </span>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {Array.from({ length: totalQuestions }).map((_, qIdx) => {
            const isCompleted = qIdx < currentChallengeIndex;
            const isActive = qIdx === currentChallengeIndex && state.startsWith('QUESTION_');
            const isUpcoming = qIdx > currentChallengeIndex;

            return (
              <div
                key={qIdx}
                className={`flex items-center justify-center font-mono font-black border transition-all ${
                  isSpotlight ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs'
                } ${
                  isActive
                    ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.25)] text-[#00ffcc] ring-2 ring-[#00ffcc] shadow-[0_0_12px_rgba(0,255,204,0.4)]'
                    : isCompleted
                    ? 'border-[#3fb950] bg-[rgba(63,185,80,0.2)] text-[#3fb950]'
                    : 'border-[#1b2432] bg-[#0a0c10] text-[#5e6b7c]'
                }`}
                title={`Question ${qIdx + 1}: ${isActive ? 'Active' : isCompleted ? 'Completed' : 'Upcoming'}`}
              >
                Q{qIdx + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SUBMISSION ROSTER (TEAMS OR INDIVIDUALS) ── */}
      <div className="flex-1 bg-[#0a0c10] border-2 border-[#1b2432] p-4 shadow-[4px_4px_0_0_#000] flex flex-col">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1b2432]">
          <span className="text-xs font-black uppercase text-[#00ffcc] tracking-wider">
            {teamsEnabled ? '> TEAMS LIVE SUBMISSION STATUS' : '> OPERATORS LIVE SUBMISSION STATUS'}
          </span>
          <span className="text-[10px] text-[#5e6b7c]">
            {teamsEnabled
              ? `${teamResponsesList.length} REGISTERED TEAMS`
              : `${playerRoster.length || totalParticipants} REGISTERED OPERATORS`}
          </span>
        </div>

        <div className={`overflow-y-auto flex-1 ${isSpotlight ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' : 'flex flex-col gap-2'}`}>
          {teamsEnabled ? (
            teamResponsesList.length === 0 ? (
              <div className="text-center py-12 text-[#5e6b7c] text-xs col-span-full">
                // NO TEAMS REGISTERED YET ON LIVE ROSTER
              </div>
            ) : (
              teamResponsesList.map((team, idx) => {
                const responded = team.respondedCount;
                const total = team.totalMembers || 1;
                const pct = Math.min(100, Math.round((responded / total) * 100));
                const hasAnswered = responded > 0;

                return (
                  <motion.div
                    key={team.teamId || idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transitionSettings}
                    className="p-3 bg-[#0f141c] border border-[#1b2432] flex flex-col gap-2 shadow-[2px_2px_0_0_#000]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${hasAnswered ? 'bg-[#3fb950] animate-pulse' : 'bg-[#fcee0a]'}`} />
                        <span className="font-bold text-white text-sm truncate">{team.teamName}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-black border ${
                          hasAnswered
                            ? 'bg-[rgba(63,185,80,0.15)] text-[#3fb950] border-[#3fb950]'
                            : 'bg-[rgba(252,238,10,0.1)] text-[#fcee0a] border-[#fcee0a]'
                        }`}
                      >
                        {hasAnswered ? 'ANSWERED' : 'THINKING'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center justify-between text-xs text-[#8b99aa]">
                      <span>Responses</span>
                      <span className="font-mono text-white font-bold">{responded} / {total} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-[#0a0c10] h-2 border border-[#1b2432]">
                      <div
                        className={`h-full transition-all duration-300 ${hasAnswered ? 'bg-[#3fb950]' : 'bg-[#fcee0a]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })
            )
          ) : (
            playerRoster.length === 0 ? (
              <div className="text-center py-12 text-[#5e6b7c] text-xs col-span-full">
                // NO OPERATORS REGISTERED YET ON LIVE ROSTER
              </div>
            ) : (
              playerRoster.map((player, idx) => {
                const handle = `${player.displayName || player.username || 'operator'}@terminal`;
                const isOnline = player.connected !== false;

                return (
                  <motion.div
                    key={player.id || idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transitionSettings}
                    className="p-3 bg-[#0f141c] border border-[#1b2432] flex items-center justify-between gap-2 shadow-[2px_2px_0_0_#000]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#3fb950]' : 'bg-[#5e6b7c]'}`} />
                      <span className="font-bold text-white text-xs truncate font-mono">{handle}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-black border font-mono ${
                        isOnline
                          ? 'bg-[rgba(63,185,80,0.15)] text-[#3fb950] border-[#3fb950]'
                          : 'bg-[#1b2432] text-[#8b99aa] border-[#2d3848]'
                      }`}
                    >
                      {isOnline ? 'READY' : 'OFFLINE'}
                    </span>
                  </motion.div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}
