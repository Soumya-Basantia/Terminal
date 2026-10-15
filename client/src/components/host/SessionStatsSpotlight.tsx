import React from 'react';
import { User, Users, CheckCircle2, Wifi, Clock, Activity, Target } from 'lucide-react';

export interface SessionStatsSpotlightProps {
  isSpotlight: boolean;
  totalParticipants: number;
  maxCapacity: number;
  totalTeams: number;
  totalAnswers: number;
  onlineConnections: number;
  elapsedTimeStr: string;
  totalQuestions: number;
  currentChallengeIndex: number;
}

export function SessionStatsSpotlight({
  isSpotlight,
  totalParticipants,
  maxCapacity,
  totalTeams,
  totalAnswers,
  onlineConnections,
  elapsedTimeStr,
  totalQuestions,
  currentChallengeIndex,
}: SessionStatsSpotlightProps) {
  const participationRate = maxCapacity > 0 ? Math.round((totalParticipants / maxCapacity) * 100) : 0;
  const submissionRate = totalParticipants > 0 ? Math.round((totalAnswers / totalParticipants) * 100) : 0;

  return (
    <div className={`flex flex-col flex-1 w-full font-mono select-none ${isSpotlight ? 'p-4 sm:p-8 max-w-6xl mx-auto' : 'p-3.5 gap-2.5'}`}>
      {isSpotlight ? (
        <div className="flex flex-col gap-6 my-auto">
          <div className="border-b-2 border-[#16202c] pb-4">
            <h1 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-tight mb-2">
              SESSION TELEMETRY & STATS
            </h1>
            <p className="text-[#8b99aa] text-sm">
              Live operational metrics and capacity telemetry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Metric 1 */}
            <div className="p-6 bg-[#0a0c10] border-2 border-[#38bdf8] shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-2">
                <User size={18} className="text-[#38bdf8]" />
                <span>Total Enrolled Participants</span>
              </div>
              <div className="text-5xl font-black text-white font-mono mb-2">
                {totalParticipants}
              </div>
              <div className="text-xs text-[#5e6b7c]">
                CAPACITY: {maxCapacity} ({participationRate}% FILLED)
              </div>
            </div>

            {/* Metric 2 */}
            <div className="p-6 bg-[#0a0c10] border-2 border-[#a855f7] shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-2">
                <Users size={18} className="text-[#a855f7]" />
                <span>Formed Battle Teams</span>
              </div>
              <div className="text-5xl font-black text-white font-mono mb-2">
                {totalTeams}
              </div>
              <div className="text-xs text-[#5e6b7c]">
                TEAMS ENGAGED IN ACTIVE SCORING
              </div>
            </div>

            {/* Metric 3 */}
            <div className="p-6 bg-[#0a0c10] border-2 border-[#00ffcc] shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-2">
                <CheckCircle2 size={18} className="text-[#00ffcc]" />
                <span>Current Submissions</span>
              </div>
              <div className="text-5xl font-black text-[#00ffcc] font-mono mb-2">
                {totalAnswers}
              </div>
              <div className="text-xs text-[#5e6b7c]">
                RESPONSE RATE: {submissionRate}%
              </div>
            </div>

            {/* Metric 4 */}
            <div className="p-6 bg-[#0a0c10] border-2 border-[#3fb950] shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-2">
                <Wifi size={18} className="text-[#3fb950]" />
                <span>Active WebSocket Connections</span>
              </div>
              <div className="text-5xl font-black text-[#3fb950] font-mono mb-2 flex items-center gap-3">
                <span>{onlineConnections}</span>
                <span className="w-3 h-3 rounded-full bg-[#3fb950] animate-pulse" />
              </div>
              <div className="text-xs text-[#5e6b7c]">
                REAL-TIME BIDIRECTIONAL SYNC
              </div>
            </div>

            {/* Metric 5 */}
            <div className="p-6 bg-[#0a0c10] border-2 border-[#fcee0a] shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-2">
                <Clock size={18} className="text-[#fcee0a]" />
                <span>Elapsed Tournament Clock</span>
              </div>
              <div className="text-5xl font-black text-white font-mono mb-2">
                {elapsedTimeStr}
              </div>
              <div className="text-xs text-[#5e6b7c]">
                SERVER-AUTHORITATIVE SESSION DURATION
              </div>
            </div>

            {/* Metric 6 */}
            <div className="p-6 bg-[#0a0c10] border-2 border-[#ff3366] shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-2 text-xs text-[#8b99aa] uppercase font-bold mb-2">
                <Target size={18} className="text-[#ff3366]" />
                <span>Challenge Progress</span>
              </div>
              <div className="text-5xl font-black text-white font-mono mb-2">
                {currentChallengeIndex + 1} <span className="text-2xl text-[#5e6b7c]">/ {totalQuestions}</span>
              </div>
              <div className="text-xs text-[#5e6b7c]">
                SEQUENTIAL QUESTION STACK
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* COMPACT DASHBOARD VIEW */
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between p-2 bg-[#0a0c10] border border-[#1b2432]">
            <div className="flex items-center gap-2">
              <User size={13} className="text-[#38bdf8]" />
              <span className="text-[10px] text-[#8b99aa] uppercase font-bold">Participants</span>
            </div>
            <span className="text-xs font-black text-white font-mono">
              {totalParticipants} <span className="text-[#5e6b7c]">/ {maxCapacity}</span>
            </span>
          </div>

          <div className="flex items-center justify-between p-2 bg-[#0a0c10] border border-[#1b2432]">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-[#a855f7]" />
              <span className="text-[10px] text-[#8b99aa] uppercase font-bold">Teams</span>
            </div>
            <span className="text-xs font-black text-white font-mono">{totalTeams}</span>
          </div>

          <div className="flex items-center justify-between p-2 bg-[#0a0c10] border border-[#1b2432]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-[#3fb950]" />
              <span className="text-[10px] text-[#8b99aa] uppercase font-bold">Submissions</span>
            </div>
            <span className="text-xs font-black text-[#00ffcc] font-mono">
              {totalAnswers} <span className="text-[#5e6b7c]">/ {totalParticipants}</span>
            </span>
          </div>

          <div className="flex items-center justify-between p-2 bg-[#0a0c10] border border-[#1b2432]">
            <div className="flex items-center gap-2">
              <Wifi size={13} className="text-[#00ffcc]" />
              <span className="text-[10px] text-[#8b99aa] uppercase font-bold">Connections</span>
            </div>
            <span className="text-xs font-black text-[#00ffcc] font-mono">
              {onlineConnections} <span className="text-[9px] text-[#5e6b7c]">online</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
