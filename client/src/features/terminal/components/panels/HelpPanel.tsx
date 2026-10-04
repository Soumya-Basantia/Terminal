import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Keyboard, Terminal } from 'lucide-react';

interface HelpPanelProps {
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  const commandSections = [
    {
      title: 'CORE & IDENTITY',
      color: 'text-cyan-400 border-cyan-500/50',
      commands: [
        {
          name: 'help',
          usage: 'help [cmd]',
          desc: 'Display interactive manual or details for specific command'
        },
        {
          name: 'whoami',
          usage: 'whoami',
          desc: 'Show verified student identity, USN, academic stream, and clearance level'
        },
        {
          name: 'scorecard',
          usage: 'scorecard',
          desc: 'Display verified competitive score, solve count, and accuracy matrix'
        },
        {
          name: 'history',
          usage: 'history',
          desc: 'Inspect previous arena sessions, room records, and timestamps'
        },
        {
          name: 'won',
          usage: 'won',
          desc: 'View tournament victories, milestones, and earned achievement badges'
        }
      ]
    },
    {
      title: 'SQUAD & NETWORKING',
      color: 'text-purple-400 border-purple-500/50',
      commands: [
        {
          name: 'team',
          usage: 'team [-c|-j name]',
          desc: 'Manage squad formation, establish or join a battle team'
        },
        {
          name: 'collab',
          usage: 'collab [user]',
          desc: 'Open peer collaboration network or dispatch invite to username'
        },
        {
          name: 'collab requests',
          usage: 'collab requests',
          desc: 'Inspect incoming and outgoing collaboration request queue'
        }
      ]
    },
    {
      title: 'COMMUNICATIONS & COMBAT',
      color: 'text-amber-400 border-amber-500/50',
      commands: [
        {
          name: 'messages',
          usage: 'messages',
          desc: 'Access encrypted direct transmissions and administrator messages'
        },
        {
          name: 'inbox',
          usage: 'inbox',
          desc: 'View centralized notification inbox for alerts and requests'
        },
        {
          name: 'battle',
          usage: 'battle -c <CODE>',
          desc: 'Join a live multiplayer combat arena session using room code'
        }
      ]
    }
  ];

  return (
    <PanelFrame
      title="COMMAND REFERENCE & USER MANUAL"
      path="/usr/share/man/commands"
      badge="MANUAL v3.4"
      onClose={onClose}
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Keyboard Directives Banner */}
        <div className="bg-[#121622] border-2 border-cyan-500/40 p-3 shadow-[2px_2px_0px_#000]">
          <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Keyboard size={13} />
            <span>KEYBOARD DIRECTIVES</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-cyan-400 font-bold">ENTER</span>
              <div className="text-zinc-500 text-[10px]">Execute Command</div>
            </div>
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-cyan-400 font-bold">TAB</span>
              <div className="text-zinc-500 text-[10px]">Autocomplete</div>
            </div>
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-cyan-400 font-bold">↑ / ↓</span>
              <div className="text-zinc-500 text-[10px]">History Recall</div>
            </div>
            <div className="bg-[#0b0e17] p-2 border border-zinc-800">
              <span className="text-pink-400 font-bold">ESC</span>
              <div className="text-zinc-500 text-[10px]">Close Active Panel</div>
            </div>
          </div>
        </div>

        {/* Command Groups */}
        <div className="space-y-3">
          {commandSections.map(section => (
            <div key={section.title} className={`bg-[#0f131d] border-2 ${section.color} p-3`}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-300 mb-2 pb-1 border-b border-zinc-800">
                {section.title}
              </div>

              <div className="divide-y divide-zinc-800/60">
                {section.commands.map(cmd => (
                  <div key={cmd.name} className="py-2 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                    <div className="w-44 text-cyan-300 font-bold shrink-0">
                      {cmd.usage}
                    </div>
                    <div className="text-zinc-400 text-[11px] flex-1">
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
