import React from 'react';
import { Terminal, Shield, Keyboard, Zap, Radio } from 'lucide-react';

interface CommandRailProps {
  activePanel?: string | null;
  unreadCount?: number;
}

export const CommandRail: React.FC<CommandRailProps> = ({ 
  activePanel, 
  unreadCount = 0 
}) => {
  const commands = [
    { name: 'help', syntax: 'help', tag: 'MANUAL', color: 'text-cyan-400' },
    { name: 'whoami', syntax: 'whoami', tag: 'IDENTITY', color: 'text-emerald-400' },
    { name: 'scorecard', syntax: 'scorecard', tag: 'SCORES', color: 'text-amber-400' },
    { name: 'history', syntax: 'history', tag: 'SESSIONS', color: 'text-purple-400' },
    { name: 'won', syntax: 'won', tag: 'VICTORIES', color: 'text-yellow-400' },
    { name: 'team', syntax: 'team', tag: 'SQUAD', color: 'text-pink-400' },
    { name: 'collab', syntax: 'collab', tag: 'COOP', color: 'text-cyan-300' },
    { name: 'messages', syntax: 'messages', tag: 'DIRECT', color: 'text-amber-300', count: unreadCount },
    { name: 'inbox', syntax: 'inbox', tag: 'NOTICES', color: 'text-fuchsia-400' },
    { name: 'battle', syntax: 'battle -c', tag: 'COMBAT', color: 'text-red-400' },
  ];

  return (
    <aside 
      aria-label="Command Manual Rail"
      className="w-48 sm:w-52 h-full flex flex-col bg-[#07090f] border-r-2 border-cyan-500/50 font-mono select-none shrink-0"
    >
      {/* Rail Title Header */}
      <div className="px-3 py-2.5 bg-[#0e121c] border-b-2 border-cyan-500/50 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Terminal size={13} className="text-cyan-400" />
          <span className="text-[11px] font-bold text-zinc-200 tracking-wider">
            CMD://INDEX
          </span>
        </div>
        <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-bold uppercase">
          REFERENCE
        </span>
      </div>

      <div className="px-3 py-1.5 bg-[#090c14] border-b border-zinc-800 text-[10px] text-zinc-500 flex items-center gap-1">
        <Radio size={10} className="text-emerald-400 animate-pulse" />
        <span>TYPE TO EXECUTE</span>
      </div>

      {/* Commands List (Visual Reference) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 terminal-scroll">
        {commands.map((cmd) => {
          const isActive = activePanel === cmd.name || (cmd.name === 'collab' && activePanel === 'collab');
          return (
            <div
              key={cmd.name}
              className={`p-2 border transition-all ${
                isActive
                  ? 'bg-[#141b2c] border-cyan-400 shadow-[2px_2px_0px_#000]'
                  : 'bg-[#0b0e17] border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={isActive ? 'text-cyan-400 font-bold' : 'text-zinc-600'}>
                    &gt;
                  </span>
                  <span className={`text-xs font-bold font-mono tracking-tight truncate ${cmd.color}`}>
                    {cmd.syntax}
                  </span>
                </div>
                {cmd.count && cmd.count > 0 ? (
                  <span className="text-[9px] px-1 py-0.2 bg-amber-950 border border-amber-500 text-amber-300 font-bold shrink-0">
                    {cmd.count}
                  </span>
                ) : (
                  <span className="text-[9px] px-1 py-0.2 bg-[#06080d] border border-zinc-800 text-zinc-500 font-mono uppercase shrink-0">
                    {cmd.tag}
                  </span>
                )}
              </div>

              {isActive && (
                <div className="mt-1 pt-1 border-t border-cyan-500/30 text-[9px] text-cyan-300 font-bold flex items-center justify-between">
                  <span>● ACTIVE PANEL</span>
                  <span className="text-zinc-400">ESC TO CLOSE</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard Directives Cheat-Sheet */}
      <div className="p-2.5 bg-[#090c14] border-t-2 border-cyan-500/40 text-[10px] space-y-1.5 shrink-0">
        <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase tracking-wider text-[9px]">
          <Keyboard size={11} className="text-cyan-400" />
          <span>KEYBOARD HINTS</span>
        </div>

        <div className="space-y-1 font-mono text-[10px]">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-zinc-500">[ENTER]</span>
            <span>Execute</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-zinc-500">[TAB]</span>
            <span>Autocomplete</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-zinc-500">[↑ / ↓]</span>
            <span>History</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-zinc-500">[ESC]</span>
            <span>Close Panel</span>
          </div>
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-zinc-500">[CTRL+L]</span>
            <span>Clear Screen</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
