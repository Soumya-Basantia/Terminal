import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { TerminalHeader } from './TerminalHeader';
import { TerminalInput } from './TerminalInput';
import { TerminalLogo } from './TerminalLogo';
import type { TerminalOutputItem } from '../core/types';
import { commandRegistry } from '../core/registry';
import { parseCommand } from '../core/parser';
import { getSuggestions } from '../core/matcher';
import { TerminalText, TerminalError, TerminalSuccess } from './outputs';
import {
  WhoamiPanel,
  StatusPanel,
  ScorecardPanel,
  GamesPanel,
  EventsPanel,
  TeamPanel,
  HistoryPanel,
  HelpPanel,
  BattlePanel,
  CollabPanel,
  MessagesPanel
} from './panels';
import './terminal.css';

interface TerminalShellProps {
  username: string;
  workspaceData?: any;
  onLogout: () => void;
}

interface ActivePanelState {
  name: string;
  data?: any;
}

export const TerminalShell: React.FC<TerminalShellProps> = ({ 
  username, 
  workspaceData, 
  onLogout 
}) => {
  const [outputs, setOutputs] = useState<TerminalOutputItem[]>([]);
  const [activePanel, setActivePanel] = useState<ActivePanelState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const student = workspaceData?.student || {
    name: username,
    username: username,
    usn: '1RV21CS001',
    email: `${username.toLowerCase()}@terminal.edu`,
    branch: 'CSE',
    section: 'A',
    role: 'PLAYER'
  };

  // Derive authenticated student's clean prompt name, e.g. "soumya" from "Soumya B" or "soumya"
  const rawPromptName = student.username || student.name || username || 'student';
  const promptUser = rawPromptName.toLowerCase().trim().split(' ')[0].replace(/[^a-z0-9_-]/g, '') || 'student';

  const progress = workspaceData?.progress || {
    totalScore: 0,
    solvedCount: 0,
    attemptedCount: 0,
    gamesPlayed: 0
  };

  const gamesCount = workspaceData?.games?.length || 7;
  const eventsCount = workspaceData?.events?.length || 0;

  // Auto-scroll to bottom of terminal output stream
  useEffect(() => {
    if (scrollRef.current && !activePanel) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs, activePanel]);

  const handleCommand = async (rawInput: string) => {
    const trimmed = rawInput.trim();

    // Echo command line into output history using promptUser
    const commandEntry: TerminalOutputItem = {
      id: Date.now().toString() + '-cmd',
      type: 'command',
      content: (
        <div className="flex font-mono text-zinc-300">
          <span className="text-emerald-400 font-bold mr-2 select-none">{promptUser}@terminal:~$</span>
          <span>{rawInput}</span>
        </div>
      )
    };
    
    setOutputs(prev => [...prev, commandEntry]);

    if (!trimmed) {
      return;
    }

    const { command, args, flags } = parseCommand(rawInput);
    if (!command) return;

    // Handle return to main terminal explicitly
    if (command === 'terminal' || command === 'home' || command === 'main' || command === 'welcome') {
      setActivePanel(null);
      setOutputs(prev => [...prev, {
        id: Date.now().toString() + '-out',
        type: 'output',
        content: (
          <div className="font-mono text-cyan-300">
            <TerminalSuccess>Returned to main Welcome Terminal screen.</TerminalSuccess>
          </div>
        )
      }]);
      return;
    }

    if (command === 'messages' || command === 'inbox' || command === 'mail') {
      setActivePanel({ name: 'messages' });
      return;
    }

    const cmdDef = commandRegistry.getCommand(command);
    let outputContent: ReactNode = null;

    if (cmdDef) {
      const context = {
        username: promptUser,
        workspaceData,
        clearTerminal: () => {
          setOutputs([]);
          setActivePanel(null);
        },
        logout: onLogout,
        pushOutput: (item: TerminalOutputItem) => setOutputs(prev => [...prev, item]),
        openPanel: (panelName: string, panelData?: any) => {
          setActivePanel({ name: panelName, data: panelData });
        },
        closePanel: () => {
          setActivePanel(null);
        },
        activePanel: activePanel?.name || null
      };

      try {
        if (flags.h || flags.help) {
          const helpCmd = commandRegistry.getCommand('help');
          if (helpCmd) {
            const result = await helpCmd.execute([command], {}, context);
            if (result) outputContent = result;
          }
        } else {
          const result = await cmdDef.execute(args, flags, context);
          if (result) {
            outputContent = result;
          }
        }
      } catch (err: any) {
        outputContent = <TerminalError>{err.message || 'Error executing command.'}</TerminalError>;
      }
    } else {
      const suggestions = getSuggestions(command, commandRegistry.getCommandNames());
      outputContent = (
        <div className="font-mono">
          <TerminalError>Command '{command}' not found.</TerminalError>
          {suggestions.length > 0 && (
            <div className="mt-2">
              <TerminalText>Did you mean:</TerminalText>
              <div className="flex flex-wrap gap-2 ml-4 my-1">
                {suggestions.slice(0, 4).map(s => (
                  <span key={s} className="text-cyan-400 font-bold bg-[#121622] px-2 py-0.5 border border-cyan-500/40">{s}</span>
                ))}
              </div>
            </div>
          )}
          <TerminalText className="mt-2 text-zinc-500">Type 'help' for available commands.</TerminalText>
        </div>
      );
    }

    if (outputContent) {
      setOutputs(prev => [...prev, {
        id: Date.now().toString() + '-out',
        type: 'output',
        content: outputContent
      }]);
    }
  };

  const handleClear = () => {
    setOutputs([]);
    setActivePanel(null);
  };

  const handleClosePanel = () => {
    setActivePanel(null);
  };

  // Render appropriate active panel
  const renderActivePanel = () => {
    if (!activePanel) return null;

    switch (activePanel.name) {
      case 'whoami':
        return <WhoamiPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'status':
        return <StatusPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'scorecard':
        return <ScorecardPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'games':
        return <GamesPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'events':
        return <EventsPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'team':
        return <TeamPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'history':
        return <HistoryPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'help':
        return <HelpPanel onClose={handleClosePanel} />;
      case 'battle':
        return <BattlePanel roomCode={activePanel.data?.roomCode || ''} onClose={handleClosePanel} />;
      case 'collab':
        return <CollabPanel target={activePanel.data?.target || ''} onClose={handleClosePanel} />;
      case 'messages':
      case 'inbox':
        return <MessagesPanel data={workspaceData} onClose={handleClosePanel} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#07090e] border-2 border-cyan-500/70 shadow-[0_0_35px_rgba(0,255,204,0.18)] overflow-hidden font-mono relative">
      {/* Top Window Bar */}
      <TerminalHeader 
        username={promptUser} 
        usn={student.usn} 
        onLogout={onLogout} 
      />

      {/* Main Content Area: Switch between Panels or Welcome Terminal */}
      {activePanel ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {/* Active Panel View */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {renderActivePanel()}
          </div>

          {/* Persistent Terminal Command Bar beneath active panel */}
          <div className="p-3 bg-[#090c14] border-t-2 border-cyan-500/60 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5 select-none">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>ACTIVE PANEL: <strong className="text-cyan-300">/bin/{activePanel.name}</strong></span>
              </span>
              <span>Type <span className="text-cyan-300 font-bold">terminal</span> or press <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]">Esc</kbd> to return</span>
            </div>

            <TerminalInput 
              username={promptUser} 
              onCommand={handleCommand} 
              onClear={handleClear} 
              onEscape={handleClosePanel}
            />
          </div>
        </div>
      ) : (
        /* Welcome Terminal View (Linux/Unix Full Terminal Stream) */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 sm:p-5 md:p-6">
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto mb-3 terminal-scroll pr-2 space-y-4"
          >
            {/* Primary Provided TERMINAL Logo Asset Branding */}
            <TerminalLogo className="py-2" />

            {/* Linux MOTD & Verified Student Identity */}
            <div className="bg-[#0f131d]/90 border border-cyan-500/40 p-3 sm:p-4 text-xs space-y-2 select-text">
              <div className="text-cyan-400 font-bold border-b border-zinc-800 pb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span>TERMINAL-OS v3.4.0 (x86_64-cybercore-linux-gnu)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-bold">
                  AUTHENTICATED LEVEL 1
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-zinc-300 pt-1">
                <div>* Authenticated Student : <span className="text-cyan-300 font-bold">{student.name}</span></div>
                <div>* University USN       : <span className="text-emerald-400 font-bold">{student.usn}</span></div>
                <div>* Student Email Node    : <span className="text-zinc-400">{student.email}</span></div>
                <div>* Academic Stream       : <span className="text-zinc-200">Branch {student.branch} • Sec {student.section}</span></div>
                <div>* Score Matrix          : <span className="text-amber-400 font-bold">{progress.totalScore} PTS</span> ({progress.solvedCount} Solved • {progress.gamesPlayed} Sessions)</div>
                <div>* Cyber Arenas Ready    : <span className="text-pink-400 font-bold">{gamesCount} Platform Modules</span> ({eventsCount} Active Events)</div>
              </div>

              <div className="pt-1.5 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
                <span>System Status: <strong className="text-emerald-400">100% OPERATIONAL</strong> • Telemetry verified.</span>
                {workspaceData?.unreadMessageCount > 0 && (
                  <span className="text-amber-400 font-bold animate-pulse">
                    ⚠ {workspaceData.unreadMessageCount} DIRECT TRANSMISSION(S) RECEIVED — type 'messages'
                  </span>
                )}
              </div>
            </div>

            {/* Terminal Command Navigation Guide */}
            <div className="bg-[#0b0e17] border border-zinc-800/80 p-3 sm:p-4 text-xs space-y-2">
              <div className="text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                NAVIGATION DIRECTIVE — TYPE COMMANDS TO NAVIGATE:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">whoami</span>
                  <div className="text-zinc-400">View student identity & credentials</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">status</span>
                  <div className="text-zinc-400">Query node & workspace telemetry</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">scorecard</span>
                  <div className="text-zinc-400">Check verified points & solve stats</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">games</span>
                  <div className="text-zinc-400">View platform simulation modules</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">events</span>
                  <div className="text-zinc-400">Inspect scheduled tournament events</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">battle &lt;code&gt;</span>
                  <div className="text-zinc-400">Join active combat room (e.g. battle -c ROOMCODE)</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">team</span>
                  <div className="text-zinc-400">Manage squad cooperative matrix</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">history</span>
                  <div className="text-zinc-400">View session participation history</div>
                </div>

                <div className="bg-[#121622] p-2 border border-zinc-800/80">
                  <span className="text-cyan-400 font-bold">help</span>
                  <div className="text-zinc-400">Display full command manual</div>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 pt-1">
                Type any command in the prompt below. Panels will animate into view. Use <span className="text-cyan-400 font-bold">terminal</span> or <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]">Esc</kbd> anytime to return.
              </div>
            </div>

            {/* Output Stream History */}
            {outputs.length > 0 && (
              <div className="space-y-3 pt-2">
                {outputs.map(item => (
                  <div key={item.id} className={item.type === 'command' ? 'opacity-85' : ''}>
                    {item.content}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Persistent Terminal Input at bottom */}
          <div className="pt-2 border-t border-cyan-500/40">
            <TerminalInput 
              username={promptUser} 
              onCommand={handleCommand} 
              onClear={handleClear} 
            />

            <div className="mt-3 text-[10px] text-zinc-600 font-mono tracking-widest uppercase flex flex-wrap gap-4 select-none">
              <span>ENTER <span className="text-zinc-500">execute</span></span>
              <span>TAB <span className="text-zinc-500">autocomplete</span></span>
              <span>↑↓ <span className="text-zinc-500">history</span></span>
              <span>CTRL+L <span className="text-zinc-500">clear</span></span>
              <span>ESC / 'terminal' <span className="text-zinc-500">main terminal</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
