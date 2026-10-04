import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { TerminalHeader } from './TerminalHeader';
import { TerminalInput } from './TerminalInput';
import { TerminalLogo } from './TerminalLogo';
import { CommandRail } from './CommandRail';
import type { TerminalOutputItem } from '../core/types';
import { commandRegistry } from '../core/registry';
import { parseCommand } from '../core/parser';
import { getSuggestions } from '../core/matcher';
import { TerminalText, TerminalError, TerminalSuccess, TerminalSection } from './outputs';
import {
  WhoamiPanel,
  ScorecardPanel,
  TeamPanel,
  HistoryPanel,
  HelpPanel,
  BattlePanel,
  CollabPanel,
  MessagesPanel,
  WonPanel,
  InboxPanel
} from './panels';
import { Users } from 'lucide-react';
import { getSocket } from '../../../lib/socket';
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
  const [unreadTeamCount, setUnreadTeamCount] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Clear unread count when team panel opens
  useEffect(() => {
    if (activePanel?.name === 'team') {
      setUnreadTeamCount(0);
    }
  }, [activePanel]);

  // Track team messages to update unread badge when team panel is closed
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleTeamMsg = () => {
      setActivePanel(curr => {
        if (curr?.name !== 'team') {
          setUnreadTeamCount(c => c + 1);
        }
        return curr;
      });
    };
    socket.on('team:message', handleTeamMsg);
    return () => {
      socket.off('team:message', handleTeamMsg);
    };
  }, []);

  const student = workspaceData?.student || {
    name: username,
    username: username,
    usn: 'AUTHENTICATED',
    email: `${username.toLowerCase()}@terminal.edu`,
    branch: 'CSE',
    section: 'A',
    role: 'PLAYER'
  };

  // Clean prompt username
  const rawPromptName = student.username || student.name || username || 'student';
  const promptUser = rawPromptName.toLowerCase().trim().split(' ')[0].replace(/[^a-z0-9_-]/g, '') || 'student';

  const progress = workspaceData?.progress || {
    totalScore: 0,
    solvedCount: 0,
    attemptedCount: 0,
    gamesPlayed: 0
  };

  // Auto-scroll terminal output stream on new outputs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [outputs, activePanel]);

  // Global escape key collapses active panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePanel) {
        e.preventDefault();
        setActivePanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel]);

  const handleCommand = async (rawInput: string) => {
    const trimmed = rawInput.trim();

    // Echo command into terminal output stream with timestamp
    const timeStr = new Date().toLocaleTimeString();
    const commandEntry: TerminalOutputItem = {
      id: Date.now().toString() + '-cmd',
      type: 'command',
      content: (
        <div className="flex items-baseline justify-between font-mono text-zinc-300 text-xs">
          <div className="flex items-center">
            <span className="text-emerald-400 font-bold mr-2 select-none">{promptUser}@terminal:~$</span>
            <span className="text-zinc-100 font-semibold">{rawInput}</span>
          </div>
          <span className="text-[10px] text-zinc-600 select-none hidden sm:inline">{timeStr}</span>
        </div>
      )
    };
    
    setOutputs(prev => [...prev, commandEntry]);

    if (!trimmed) {
      return;
    }

    const { command, args, flags } = parseCommand(rawInput);
    if (!command) return;

    // Internal commands to collapse panel and return to full terminal
    if (command === 'terminal' || command === 'home' || command === 'close' || command === 'exit-panel') {
      setActivePanel(null);
      setOutputs(prev => [...prev, {
        id: Date.now().toString() + '-out',
        type: 'output',
        content: (
          <div className="font-mono text-xs text-cyan-300">
            <TerminalSuccess>Side module closed. Terminal returned to full workspace.</TerminalSuccess>
          </div>
        )
      }]);
      return;
    }

    // Direct routing for messages / inbox
    if (command === 'messages') {
      setActivePanel({ name: 'messages' });
    } else if (command === 'inbox') {
      setActivePanel({ name: 'inbox' });
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
        activePanel: activePanel?.name || null,
        openTeamChat: () => setActivePanel({ name: 'team' }),
        closeTeamChat: () => {
          setActivePanel(curr => (curr?.name === 'team' ? null : curr));
        },
        isTeamChatOpen: activePanel?.name === 'team'
      };

      setIsExecuting(true);
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
      } finally {
        setIsExecuting(false);
      }
    } else {
      // Suggest closest available commands
      const available = ['help', 'whoami', 'scorecard', 'history', 'won', 'team', 'collab', 'messages', 'inbox', 'battle'];
      const suggestions = getSuggestions(command, available);
      outputContent = (
        <div className="font-mono text-xs">
          <TerminalError>Command '{command}' not recognized.</TerminalError>
          {suggestions.length > 0 && (
            <div className="mt-1.5 ml-2">
              <TerminalText className="text-zinc-400">Did you mean:</TerminalText>
              <div className="flex flex-wrap gap-2 ml-2 my-1">
                {suggestions.slice(0, 3).map(s => (
                  <span key={s} className="text-cyan-400 font-bold bg-[#10141f] px-2 py-0.5 border border-cyan-500/40">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-1 text-zinc-500 text-[11px] ml-2">
            Type <span className="text-cyan-300 font-bold">'help'</span> for list of valid commands.
          </div>
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
  };

  const handleClosePanel = () => {
    setActivePanel(null);
  };

  // Render appropriate active side panel
  const renderActivePanel = () => {
    if (!activePanel) return null;

    switch (activePanel.name) {
      case 'whoami':
        return <WhoamiPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'scorecard':
        return <ScorecardPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'history':
        return <HistoryPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'won':
        return <WonPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'team':
        return <TeamPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'collab':
        return (
          <CollabPanel 
            target={activePanel.data?.target} 
            isRequestsView={activePanel.data?.isRequestsView} 
            onClose={handleClosePanel} 
          />
        );
      case 'messages':
        return <MessagesPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'inbox':
        return <InboxPanel data={workspaceData} onClose={handleClosePanel} />;
      case 'battle':
        return <BattlePanel roomCode={activePanel.data?.roomCode || ''} onClose={handleClosePanel} />;
      case 'help':
        return <HelpPanel onClose={handleClosePanel} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#05070c] border-2 border-cyan-500/70 shadow-[0_0_35px_rgba(0,255,204,0.18)] overflow-hidden font-mono select-text relative">
      {/* Top Bar with System telemetry, Clock & Logout */}
      <TerminalHeader 
        username={promptUser}
        studentName={student.name}
        usn={student.usn}
        branch={student.branch}
        section={student.section}
        onLogout={onLogout} 
      />

      {/* Main Workspace Body: Command Rail + Central Terminal / Game Area + Expandable Side Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Command Rail (Visual HUD Reference) */}
        <CommandRail 
          activePanel={activePanel?.name} 
          activePanelData={activePanel?.data}
          unreadCount={workspaceData?.unreadMessageCount} 
          unreadTeamCount={unreadTeamCount}
          onSelectCommand={(cmd) => handleCommand(cmd)}
        />

        {/* Central Terminal / Game Workspace */}
        <main 
          aria-label="Student Command Workspace"
          className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#07090e] relative transition-all duration-200 ease-out"
        >
          {/* Quick Floating [TEAM] Trigger on right edge when panel is closed */}
          {!activePanel && (
            <button
              onClick={() => setActivePanel({ name: 'team' })}
              className="absolute top-3 right-4 z-10 px-2.5 py-1 bg-[#090d16] hover:bg-[#121622] border border-cyan-500/70 text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
              title="Open Squad Workspace & Live Chat (team)"
            >
              <Users size={12} className="text-cyan-400" />
              <span>TEAM &gt;</span>
              {unreadTeamCount > 0 && (
                <span className="px-1 py-0.2 bg-amber-500 text-black text-[9px] font-black animate-pulse">
                  ● {unreadTeamCount}
                </span>
              )}
            </button>
          )}

          {/* Scrollable Output Stream */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 sm:p-5 terminal-scroll space-y-4 text-xs"
          >
            {/* Primary Pixel Logo */}
            <TerminalLogo className="py-1" />

            {/* Linux Native Boot Telemetry & Verified Student Identity */}
            <div className="bg-[#090d16] border-2 border-cyan-500/50 p-3 sm:p-4 text-xs space-y-2 shadow-[4px_4px_0px_#000]">
              <div className="text-cyan-400 font-bold border-b border-zinc-800 pb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="tracking-wider">TERMINAL-OS v3.4.0 (x86_64-cybercore-linux-gnu)</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-400/80 text-emerald-300 font-bold tracking-widest uppercase">
                  AUTHENTICATION VERIFIED
                </span>
              </div>

              {/* Native Terminal Boot Telemetry Sequence */}
              <div className="font-mono text-[11px] space-y-0.5 text-zinc-400 border-b border-zinc-800/80 pb-2 select-text">
                <div>&gt; INITIALIZING CORE ................................ <span className="text-emerald-400 font-bold">OK</span></div>
                <div>&gt; AUTHENTICATING [USN: {student.usn}] ............... <span className="text-emerald-400 font-bold">OK</span></div>
                <div>&gt; LOADING WORKSPACE [{promptUser}@terminal] ........ <span className="text-emerald-400 font-bold">OK</span></div>
                <div>&gt; CONNECTING NETWORK [cybercore.terminal.edu] ....... <span className="text-emerald-400 font-bold">OK</span></div>
                <div className="text-cyan-300 font-bold pt-1">TERMINAL READY_</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-zinc-300 pt-1 font-mono text-[11px]">
                <div>* University USN   : <span className="text-emerald-400 font-bold">{student.usn}</span></div>
                <div>* Academic Stream  : <span className="text-zinc-200">Branch {student.branch} • Section {student.section}</span></div>
                <div>* Student Email    : <span className="text-zinc-400">{student.email}</span></div>
                <div>* Security Role    : <span className="text-purple-300 font-bold">{student.role === 'ADMIN' ? 'ROOT ADMIN' : 'STUDENT'}</span></div>
                <div>* Progress Matrix  : <span className="text-amber-400 font-bold">{progress.totalScore} PTS</span> ({progress.solvedCount} Solved • {progress.gamesPlayed} Arenas)</div>
                <div>* System Status    : <span className="text-emerald-400 font-bold">OPERATIONAL (100%)</span></div>
              </div>

              <div className="pt-2 border-t border-zinc-800 text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2">
                <span>Type <span className="text-cyan-400 font-bold font-mono">'help'</span> to view available commands.</span>
                {workspaceData?.unreadMessageCount > 0 && (
                  <span className="text-amber-400 font-bold animate-pulse">
                    ⚠ {workspaceData.unreadMessageCount} DIRECT TRANSMISSION(S) RECEIVED — type 'messages'
                  </span>
                )}
              </div>
            </div>

            {/* Output History Stream */}
            {outputs.length > 0 && (
              <div className="space-y-3 pt-2">
                {outputs.map(item => (
                  <div key={item.id} className={item.type === 'command' ? 'opacity-90 pt-1' : 'ml-1'}>
                    {item.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Dynamic Expandable Side Panel (Right) — takes 28-36% viewport width, fast transition */}
        <aside 
          aria-label="Command Telemetry Panel"
          className={`transition-all duration-200 ease-out overflow-hidden flex flex-col shrink-0 z-20 ${
            activePanel 
              ? 'w-[32%] min-w-[320px] max-w-[460px] max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:w-full max-md:z-30 opacity-100 pointer-events-auto border-l-2 border-cyan-500/80 shadow-[-6px_0_24px_rgba(0,0,0,0.7)]' 
              : 'w-0 min-w-0 max-w-0 opacity-0 pointer-events-none border-l-0'
          }`}
        >
          {activePanel && renderActivePanel()}
        </aside>
      </div>

      {/* PERMANENT TERMINAL ENTRY / COMMAND BAR — ALWAYS DOCKED AT THE BOTTOM */}
      <div className="p-2.5 sm:p-3 bg-[#0a0d16] border-t-2 border-cyan-500/60 shadow-[0_-4px_16px_rgba(0,0,0,0.6)] shrink-0 z-30 w-full">
        {activePanel && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 select-none">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>ACTIVE MODULE: <strong className="text-cyan-300 font-mono">/bin/{activePanel.name}</strong></span>
            </span>
            <span className="text-[10px]">Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-200 text-[9px] font-mono">Esc</kbd> to return to full terminal</span>
          </div>
        )}

        <TerminalInput 
          username={promptUser} 
          onCommand={handleCommand} 
          onClear={handleClear} 
          onEscape={handleClosePanel}
          isExecuting={isExecuting}
        />

        <div className="mt-1.5 text-[9px] sm:text-[10px] text-zinc-500 font-mono tracking-wider flex flex-wrap gap-4 select-none">
          <span>ENTER <span className="text-zinc-600">execute</span></span>
          <span>TAB <span className="text-zinc-600">autocomplete</span></span>
          <span>↑↓ <span className="text-zinc-600">history</span></span>
          <span>ESC <span className="text-zinc-600">close side panel</span></span>
          <span>CTRL+L <span className="text-zinc-600">clear</span></span>
        </div>
      </div>
    </div>
  );
};
