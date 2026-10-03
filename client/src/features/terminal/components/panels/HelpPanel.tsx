import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Terminal, Keyboard, Info, BookOpen } from 'lucide-react';

interface HelpPanelProps {
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  const categories = [
    {
      name: 'NAVIGATION & CORE',
      color: 'text-cyan-300 border-cyan-500/40',
      commands: [
        { name: 'terminal', usage: 'terminal', desc: 'Return to the main Welcome Terminal screen from any state/panel' },
        { name: 'help', usage: 'help [command]', desc: 'Display interactive command manual or details for specific command' },
        { name: 'clear', usage: 'clear', desc: 'Flush and clear all terminal command logs (Ctrl+L)' },
        { name: 'status', usage: 'status', desc: 'Display workspace health, node latency, and system telemetry' },
        { name: 'exit', usage: 'exit', desc: 'Securely terminate session and log out of the platform' }
      ]
    },
    {
      name: 'PROFILE & CREDENTIALS',
      color: 'text-emerald-300 border-emerald-500/40',
      commands: [
        { name: 'whoami', usage: 'whoami', desc: 'Display verified student identity, USN, academic branch, section, and role' },
        { name: 'scorecard', usage: 'scorecard', desc: 'View verified points, accuracy ratio, and challenge solve count' },
        { name: 'history', usage: 'history', desc: 'Inspect authenticated session and arena participation history' }
      ]
    },
    {
      name: 'BATTLE & COMPETITIVE ARENAS',
      color: 'text-fuchsia-300 border-fuchsia-500/40',
      commands: [
        { name: 'games', usage: 'games', desc: 'List all 7 platform cyber games and simulation modules' },
        { name: 'events', usage: 'events', desc: 'List active tournament events and competitive schedules' },
        { name: 'battle', usage: 'battle <code>', desc: 'Join a live multiplayer combat arena using the room code' },
        { name: 'leaderboard', usage: 'leaderboard', desc: 'View live standings and rankings in the active session' },
        { name: 'submit', usage: 'submit <answer>', desc: 'Submit a challenge solution to the active question' }
      ]
    },
    {
      name: 'SQUAD & COOPERATION',
      color: 'text-amber-300 border-amber-500/40',
      commands: [
        { name: 'team', usage: 'team [-c|-j <name>]', desc: 'Establish or join a multi-student battle squad' },
        { name: 'collab', usage: 'collab <username>', desc: 'Dispatch a real-time peer collaboration invitation' }
      ]
    }
  ];

  return (
    <PanelFrame
      title="COMMAND REFERENCE & USER MANUAL"
      path="/man/commands"
      badge="MANUAL v3.0"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Keyboard Shortcuts Bar */}
        <div className="bg-[#121622] border border-cyan-500/30 p-3">
          <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Keyboard size={14} />
            <span>KEYBOARD DIRECTIVES</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-cyan-400 font-bold">ENTER</span>
              <div className="text-zinc-400 text-[11px]">Execute Command</div>
            </div>
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-cyan-400 font-bold">TAB</span>
              <div className="text-zinc-400 text-[11px]">Autocomplete</div>
            </div>
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-cyan-400 font-bold">↑ / ↓</span>
              <div className="text-zinc-400 text-[11px]">Command History</div>
            </div>
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-pink-400 font-bold">ESC</span>
              <div className="text-zinc-400 text-[11px]">Return to Terminal</div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat.name} className={`bg-[#121622] border ${cat.color} p-3.5`}>
              <h3 className={`text-xs font-bold uppercase tracking-widest mb-2.5 ${cat.color.split(' ')[0]}`}>
                {cat.name}
              </h3>

              <div className="divide-y divide-zinc-800/60 font-mono text-xs">
                {cat.commands.map(cmd => (
                  <div key={cmd.name} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="w-48 text-cyan-300 font-bold">
                      {cmd.usage}
                    </div>
                    <div className="flex-1 text-zinc-400 text-xs">
                      {cmd.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PanelFrame>
  );
};
