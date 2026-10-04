import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Trophy, Award, Zap, Star, ShieldCheck, Flame, Medal } from 'lucide-react';

interface WonPanelProps {
  data: any;
  onClose: () => void;
}

export const WonPanel: React.FC<WonPanelProps> = ({ data, onClose }) => {
  const student = data?.student;
  const progress = data?.progress || {
    totalScore: 0,
    solvedCount: 0,
    attemptedCount: 0,
    gamesPlayed: 0
  };
  const sessions = data?.sessions || [];

  // Identify sessions where player scored well or finished
  const victorySessions = sessions.filter((s: any) => 
    s.status === 'COMPLETED' || s.status === 'FINISHED' || s.score > 0
  );

  // Derived achievement milestones based on real player telemetry
  const milestones = [
    {
      id: 'm1',
      title: 'FIRST BLOOD',
      desc: 'Solve your first technical challenge',
      unlocked: progress.solvedCount >= 1,
      badge: '+50 XP',
      icon: Zap,
      color: 'text-cyan-400 border-cyan-500/50 bg-cyan-950/30'
    },
    {
      id: 'm2',
      title: 'CENTURY MILESTONE',
      desc: 'Accumulate 100+ verified points',
      unlocked: progress.totalScore >= 100,
      badge: '100 PTS',
      icon: Trophy,
      color: 'text-amber-400 border-amber-500/50 bg-amber-950/30'
    },
    {
      id: 'm3',
      title: 'CODE BREAKER',
      desc: 'Solve 5 or more platform challenges',
      unlocked: progress.solvedCount >= 5,
      badge: '5 SOLVES',
      icon: Star,
      color: 'text-fuchsia-400 border-fuchsia-500/50 bg-fuchsia-950/30'
    },
    {
      id: 'm4',
      title: 'ARENA VETERAN',
      desc: 'Participate in 3 or more live arena battles',
      unlocked: progress.gamesPlayed >= 3,
      badge: '3 BATTLES',
      icon: Flame,
      color: 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30'
    },
    {
      id: 'm5',
      title: 'SYSTEM OPERATIVE',
      desc: 'Attain 500+ verified total score',
      unlocked: progress.totalScore >= 500,
      badge: '500 PTS',
      icon: Medal,
      color: 'text-purple-400 border-purple-500/50 bg-purple-950/30'
    },
    {
      id: 'm6',
      title: 'AUTHORIZED AGENT',
      desc: 'Authenticate student credentials on Terminal OS',
      unlocked: true,
      badge: 'VERIFIED',
      icon: ShieldCheck,
      color: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/30'
    }
  ];

  const unlockedCount = milestones.filter(m => m.unlocked).length;
  const winsCount = victorySessions.length;

  return (
    <PanelFrame
      title="VICTORIES & ACHIEVEMENTS"
      path="/var/log/won"
      badge={`${winsCount} VICTORIES • ${unlockedCount}/${milestones.length} BADGES`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Top Trophy Banner */}
        <div className="bg-[#121622] border-2 border-amber-500/50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-950/60 border-2 border-amber-400 text-amber-300 shadow-[2px_2px_0px_#000]">
              <Trophy size={28} />
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                COMPETITIVE TRIUMPHS
              </div>
              <h3 className="text-lg font-black text-zinc-100 flex items-center gap-2">
                <span>{student?.name || 'STUDENT'}</span>
                <span className="text-[10px] px-2 py-0.5 border border-amber-500 bg-[#0b0e17] text-amber-300 font-mono font-bold">
                  {winsCount} ARENA WINS
                </span>
              </h3>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase block font-mono">BADGES EARNED</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{unlockedCount}</span>
            <span className="text-xs text-zinc-500 font-mono">/{milestones.length}</span>
          </div>
        </div>

        {/* Milestone Badges Grid */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
            <span>CAREER MILESTONES</span>
            <span className="text-[11px] text-cyan-400 font-mono font-bold">{unlockedCount} UNLOCKED</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {milestones.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className={`p-3 border-2 transition-all ${
                    m.unlocked
                      ? `${m.color} shadow-[2px_2px_0px_#000]`
                      : 'border-zinc-800 bg-[#090b10] opacity-50 grayscale'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon size={16} />
                      <span className="font-mono font-bold text-xs text-zinc-100 tracking-wider">
                        {m.title}
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 border border-current font-mono font-bold">
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono leading-tight">
                    {m.desc}
                  </p>
                  <div className="mt-2 text-[9px] font-mono font-bold flex items-center gap-1">
                    {m.unlocked ? (
                      <span className="text-emerald-400">✓ UNLOCKED & RECORDED</span>
                    ) : (
                      <span className="text-zinc-600">🔒 LOCKED // IN PROGRESS</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Victory History Log */}
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            ARENA VICTORIES LOG
          </div>

          {victorySessions.length > 0 ? (
            <div className="bg-[#121622] border border-cyan-500/30 overflow-hidden font-mono text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#0b0e17] text-zinc-400 border-b border-zinc-800 text-[10px]">
                    <th className="p-2.5">ROOM</th>
                    <th className="p-2.5">EVENT</th>
                    <th className="p-2.5">GAME</th>
                    <th className="p-2.5">RESULT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {victorySessions.map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#181d2c] transition-colors">
                      <td className="p-2.5 font-bold text-cyan-300">{s.roomCode}</td>
                      <td className="p-2.5 text-zinc-200">{s.eventName}</td>
                      <td className="p-2.5 text-emerald-400">{s.gameName}</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-950 border border-emerald-500/60 text-emerald-300">
                          VICTORY
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-[#121622] border border-zinc-800 p-6 text-center font-mono">
              <Award size={24} className="mx-auto mb-2 text-zinc-600" />
              <div className="text-xs font-bold text-zinc-300 mb-1 uppercase tracking-wider">
                NO RECORDED ARENA WINS YET
              </div>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mb-3">
                Complete and win live tournament games to record your triumphs on your permanent student ledger.
              </p>
              <div className="text-[11px] text-cyan-400">
                Join a live room: <span className="font-bold">battle -c &lt;room_code&gt;</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
};
