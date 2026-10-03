import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Trophy, Award, Target, Zap, CheckCircle2, Flame } from 'lucide-react';

interface ScorecardPanelProps {
  data: any;
  onClose: () => void;
}

export const ScorecardPanel: React.FC<ScorecardPanelProps> = ({ data, onClose }) => {
  const student = data?.student;
  const progress = data?.progress || {
    totalScore: 0,
    solvedCount: 0,
    attemptedCount: 0,
    gamesPlayed: 0
  };

  const accuracy = progress.attemptedCount > 0 
    ? Math.round((progress.solvedCount / progress.attemptedCount) * 100) 
    : 100;

  let rankTier = 'CADET';
  let tierColor = 'text-cyan-400 border-cyan-500';
  if (progress.totalScore >= 1000) {
    rankTier = 'CYBER ARCHITECT';
    tierColor = 'text-fuchsia-400 border-fuchsia-500';
  } else if (progress.totalScore >= 500) {
    rankTier = 'SYSTEM OPERATIVE';
    tierColor = 'text-emerald-400 border-emerald-500';
  } else if (progress.totalScore >= 200) {
    rankTier = 'SECURITY SPECIALIST';
    tierColor = 'text-amber-400 border-amber-500';
  }

  return (
    <PanelFrame
      title="VERIFIED SCORECARD & PERFORMANCE MATRIX"
      path="/var/log/scorecard"
      badge={rankTier}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Top Highlight Banner */}
        <div className="bg-[#121622] border-2 border-emerald-500/50 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-950/60 border border-emerald-400 text-emerald-400">
              <Trophy size={28} />
            </div>
            <div>
              <div className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                CURRENT STANDING
              </div>
              <div className="text-xl font-black text-zinc-100 flex items-center gap-2">
                <span>{student?.name}</span>
                <span className={`text-xs px-2 py-0.5 border ${tierColor} bg-[#0b0e17] font-bold`}>
                  RANK: {rankTier}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase block">AGGREGATE PTS</span>
            <span className="text-3xl font-black text-emerald-400">{progress.totalScore}</span>
            <span className="text-xs text-zinc-400 ml-1">PTS</span>
          </div>
        </div>

        {/* 4 Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#121622] p-3 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
              <span>SOLVED</span>
              <CheckCircle2 size={14} className="text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-zinc-100">{progress.solvedCount}</div>
            <div className="text-[10px] text-emerald-400">Verified Cleared</div>
          </div>

          <div className="bg-[#121622] p-3 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
              <span>ATTEMPTS</span>
              <Target size={14} className="text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-zinc-100">{progress.attemptedCount}</div>
            <div className="text-[10px] text-zinc-400">Total Submissions</div>
          </div>

          <div className="bg-[#121622] p-3 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
              <span>ACCURACY</span>
              <Zap size={14} className="text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">{accuracy}%</div>
            <div className="text-[10px] text-zinc-400">Precision Ratio</div>
          </div>

          <div className="bg-[#121622] p-3 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
              <span>SESSIONS</span>
              <Flame size={14} className="text-pink-400" />
            </div>
            <div className="text-xl font-bold text-pink-400">{progress.gamesPlayed}</div>
            <div className="text-[10px] text-zinc-400">Arenas Joined</div>
          </div>
        </div>

        {/* Instructions Footer */}
        <div className="bg-[#0e111a] border border-cyan-500/30 p-3 text-xs text-zinc-400 flex items-center justify-between">
          <span>To earn additional points, join an active tournament room:</span>
          <span className="text-cyan-300 font-bold font-mono">battle &lt;room_code&gt;</span>
        </div>
      </div>
    </PanelFrame>
  );
};
