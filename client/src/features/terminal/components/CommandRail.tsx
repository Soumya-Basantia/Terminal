import React, { useState } from 'react';
import { 
  Terminal, 
  Keyboard, 
  Radio, 
  Users, 
  MessageSquare, 
  History, 
  Trophy, 
  Inbox, 
  Share2, 
  HelpCircle, 
  User, 
  Swords,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface CommandRailProps {
  activePanel?: string | null;
  activePanelData?: any;
  unreadCount?: number;
  unreadTeamCount?: number;
  onSelectCommand?: (cmd: string) => void;
}

export const CommandRail: React.FC<CommandRailProps> = ({ 
  activePanel, 
  activePanelData,
  unreadCount = 0,
  unreadTeamCount = 0,
  onSelectCommand
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const commands = [
    { id: 'help', name: 'help', syntax: 'help', tag: 'SYS', icon: HelpCircle, color: 'text-cyan-400' },
    { id: 'whoami', name: 'whoami', syntax: 'whoami', tag: 'ID', icon: User, color: 'text-emerald-400' },
    { id: 'team', name: 'team', syntax: 'team', tag: 'SQUAD', icon: Users, color: 'text-pink-400', count: unreadTeamCount },
    { id: 'battle', name: 'battle', syntax: 'battle -c', tag: 'ARENA', icon: Swords, color: 'text-red-400' },
    { id: 'scorecard', name: 'scorecard', syntax: 'scorecard', tag: 'SCORES', icon: Trophy, color: 'text-amber-400' },
    { id: 'history', name: 'history', syntax: 'history', tag: 'LOGS', icon: History, color: 'text-purple-400' },
    { id: 'collab', name: 'collab', syntax: 'collab', tag: 'PEERS', icon: Share2, color: 'text-cyan-300' },
    { id: 'messages', name: 'messages', syntax: 'messages', tag: 'MSG', icon: MessageSquare, color: 'text-amber-300', count: unreadCount },
    { id: 'inbox', name: 'inbox', syntax: 'inbox', tag: 'INBOX', icon: Inbox, color: 'text-fuchsia-400' },
  ];

  return (
    <aside 
      aria-label="Command Manual Rail"
      className={`h-full flex flex-col bg-[#07090e] border-r border-[#1c2638] font-mono select-none shrink-0 transition-all duration-200 z-10 ${
        isExpanded ? 'w-48 sm:w-52' : 'w-10 sm:w-11'
      }`}
    >
      {/* Rail Toggle & Header */}
      <div className="h-9 px-2 bg-[#090d16] border-b border-[#1c2638] flex items-center justify-between">
        {isExpanded ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <Terminal size={12} className="text-cyan-400 shrink-0" />
              <span className="text-[10px] font-bold text-zinc-200 tracking-wider uppercase truncate">
                COMMANDS
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-[#121824] text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Collapse Command Rail"
            >
              <ChevronLeft size={13} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full h-full flex items-center justify-center text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Expand Command Rail (Index)"
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Commands List */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1 space-y-1 terminal-scroll">
        {commands.map((cmd) => {
          let isActive = false;
          if (cmd.id === 'collab') {
            isActive = activePanel === 'collab' && !activePanelData?.isRequestsView;
          } else {
            isActive = activePanel === cmd.name;
          }

          const IconComponent = cmd.icon;

          if (!isExpanded) {
            return (
              <button
                key={cmd.id}
                onClick={() => onSelectCommand?.(cmd.syntax)}
                className={`w-full aspect-square flex items-center justify-center relative transition-colors cursor-pointer border ${
                  isActive
                    ? 'bg-[#0e1626] border-cyan-400 text-cyan-300'
                    : 'bg-[#080b12] border-transparent hover:border-[#1c2638] hover:bg-[#0d121e] text-zinc-400 hover:text-zinc-200'
                }`}
                title={`Command: ${cmd.syntax} (${cmd.tag})`}
              >
                <IconComponent size={14} className={isActive ? 'text-cyan-400' : cmd.color} />
                {cmd.count && cmd.count > 0 ? (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border border-black" />
                ) : null}
              </button>
            );
          }

          return (
            <button
              key={cmd.id}
              onClick={() => onSelectCommand?.(cmd.syntax)}
              className={`w-full p-1.5 border text-left transition-colors cursor-pointer block ${
                isActive
                  ? 'bg-[#0e1626] border-cyan-400 shadow-[2px_2px_0px_#000]'
                  : 'bg-[#080b12] border-[#1c2638] hover:border-zinc-700 hover:bg-[#0d121e]'
              }`}
              title={`Execute: ${cmd.syntax}`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <IconComponent size={12} className={cmd.color} />
                  <span className={`text-[11px] font-bold font-mono truncate ${cmd.color}`}>
                    {cmd.syntax}
                  </span>
                </div>
                {cmd.count && cmd.count > 0 ? (
                  <span className="text-[9px] px-1 py-0.2 bg-amber-500 text-black font-bold shrink-0 animate-pulse">
                    {cmd.count}
                  </span>
                ) : (
                  <span className="text-[8px] px-1 py-0.2 bg-[#05070c] border border-zinc-800 text-zinc-500 font-mono uppercase shrink-0">
                    {cmd.tag}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Keyboard Shortcuts Summary (when expanded) */}
      {isExpanded && (
        <div className="p-2 bg-[#090d16] border-t border-[#1c2638] text-[9px] space-y-1 text-zinc-400 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">[TAB]</span>
            <span>Autocomplete</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">[ESC]</span>
            <span>Close Panel</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">[CTRL+L]</span>
            <span>Clear Screen</span>
          </div>
        </div>
      )}
    </aside>
  );
};
