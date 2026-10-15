import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TerminalHeader } from './TerminalHeader';
import { TerminalInput } from './TerminalInput';
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
  const navigate = useNavigate();
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
    const handleChatCleared = () => {
      setUnreadTeamCount(0);
    };
    socket.on('team:message', handleTeamMsg);
    socket.on('team:chat_cleared', handleChatCleared);
    return () => {
      socket.off('team:message', handleTeamMsg);
      socket.off('team:chat_cleared', handleChatCleared);
    };
  }, []);

  const student = workspaceData?.student || {
    name: username.toUpperCase(),
    username: username,
    usn: 'AUTHENTICATED',
    email: `${username.toLowerCase()}@terminal.edu`,
    branch: 'CSE',
    section: 'A',
    role: 'PLAYER'
  };

  // Authoritative Public Operator Handle (never USN or split first name)
  const rawPromptName = student.username || username || 'student';
  const promptUser = rawPromptName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'student';

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
        isTeamChatOpen: activePanel?.name === 'team',
        navigate: (path: string) => navigate(path),
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
    <div className="w-full h-full flex flex-col bg-[#05070c] overflow-hidden font-mono select-text relative">
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
              className="absolute top-3 right-4 z-10 px-2.5 py-1 bg-[#090d16] hover:bg-[#121826] border border-[#1c2638] hover:border-cyan-500/70 text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors select-none"
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

          {/* Scrollable Output Stream with Full Workspace Proportion */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 terminal-scroll space-y-5 text-xs select-text"
          >
            {/* Terminal Monospaced ASCII Header & System Architecture Banner */}
            <div className="space-y-4 font-mono text-xs w-full max-w-7xl mx-auto">
              {/* Scaled High-Impact Cybercore ASCII Banner */}
              <div className="border border-[#182638] bg-[#060911]/90 p-3 sm:p-4 rounded-sm shadow-[0_0_24px_rgba(0,240,255,0.06)] relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-[#0b1322] border-b border-l border-[#182638] text-[10px] text-cyan-400 font-mono tracking-widest uppercase hidden md:flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>CORE: ONLINE // TTY1</span>
                </div>

                <pre className="text-cyan-400 font-bold text-[9px] sm:text-xs md:text-[13px] lg:text-[14px] leading-tight select-none tracking-tight sm:tracking-normal overflow-x-auto no-scrollbar drop-shadow-[0_0_10px_rgba(0,240,255,0.25)]">
{`  ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     
  ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║     
     ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║     
     ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     
     ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝`}
                </pre>

                <div className="mt-2.5 pt-2 border-t border-[#142030] flex flex-wrap items-center justify-between gap-2 text-zinc-400 text-[11px]">
                  <div>
                    <span className="text-zinc-100 font-bold">TERMINAL-OS v3.4.0-release</span> &bull; 
                    <span className="text-cyan-300 ml-1 font-mono">x86_64-cybercore-linux-gnu</span> &bull; 
                    <span className="text-zinc-500 ml-1">Kernel 6.8.0-42 SMP PREEMPT_DYNAMIC</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    SECURITY LEVEL: <span className="text-emerald-400 font-bold">ALPHA-ENCRYPTED (TLSv1.3)</span>
                  </div>
                </div>
              </div>

              {/* 4-Sector Operational Command Telemetry Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 w-full">
                {/* Sector 1: Operator Profile */}
                <div className="bg-[#080d16] border border-[#16253b] p-3.5 rounded-sm shadow-[2px_2px_0px_#000] relative overflow-hidden flex flex-col justify-between">
                  <div className="border-b border-[#142030] pb-2 mb-2.5 flex items-center justify-between">
                    <span className="text-cyan-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm" />
                      OPERATOR IDENTITY
                    </span>
                    <span className="text-emerald-400 text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/30">
                      AUTHENTICATED
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Handle:</span>
                      <span className="text-cyan-300 font-bold">{promptUser}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">University USN:</span>
                      <span className="text-emerald-400 font-bold">{student.usn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Academic Stream:</span>
                      <span className="text-zinc-200">{student.branch} &bull; Sec {student.section}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Privilege:</span>
                      <span className="text-purple-300 font-bold">{student.role === 'ADMIN' ? 'ROOT ADMIN' : 'STUDENT OPERATOR'}</span>
                    </div>
                  </div>
                </div>

                {/* Sector 2: Arena & Tournament Matrix */}
                <div className="bg-[#080d16] border border-[#16253b] p-3.5 rounded-sm shadow-[2px_2px_0px_#000] relative overflow-hidden flex flex-col justify-between">
                  <div className="border-b border-[#142030] pb-2 mb-2.5 flex items-center justify-between">
                    <span className="text-amber-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-amber-400 rounded-sm" />
                      ARENA PERFORMANCE
                    </span>
                    <span className="text-amber-400 text-[9px] font-bold px-1.5 py-0.2 bg-amber-500/10 border border-amber-500/30">
                      RANKED
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Total Score:</span>
                      <span className="text-amber-300 font-black">{progress.totalScore} PTS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Challenges Solved:</span>
                      <span className="text-emerald-400 font-bold">{progress.solvedCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Attempts Registered:</span>
                      <span className="text-zinc-300">{progress.attemptedCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Tournaments Played:</span>
                      <span className="text-cyan-300 font-bold">{progress.gamesPlayed} Arenas</span>
                    </div>
                  </div>
                </div>

                {/* Sector 3: System Telemetry & Socket Link */}
                <div className="bg-[#080d16] border border-[#16253b] p-3.5 rounded-sm shadow-[2px_2px_0px_#000] relative overflow-hidden flex flex-col justify-between">
                  <div className="border-b border-[#142030] pb-2 mb-2.5 flex items-center justify-between">
                    <span className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-sm" />
                      NETWORK TELEMETRY
                    </span>
                    <span className="text-emerald-400 text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/30">
                      100% QUALITY
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Socket Uplink:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        SYNCED (24ms)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Crypto Cipher:</span>
                      <span className="text-zinc-300">AES-256-GCM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Telemetry Frame:</span>
                      <span className="text-zinc-300">60 FPS REALTIME</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Memory Buffer:</span>
                      <span className="text-cyan-300 font-bold">64KB ALLOCATED</span>
                    </div>
                  </div>
                </div>

                {/* Sector 4: Comms & Tactical Operations */}
                <div className="bg-[#080d16] border border-[#16253b] p-3.5 rounded-sm shadow-[2px_2px_0px_#000] relative overflow-hidden flex flex-col justify-between">
                  <div className="border-b border-[#142030] pb-2 mb-2.5 flex items-center justify-between">
                    <span className="text-purple-400 font-bold text-[10px] tracking-widest uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-sm" />
                      TACTICAL OPERATIONS
                    </span>
                    <span className="text-cyan-400 text-[9px] font-bold px-1.5 py-0.2 bg-cyan-500/10 border border-cyan-500/30">
                      READY
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-zinc-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Squad Uplink:</span>
                      <button 
                        onClick={() => handleCommand('team')} 
                        className="text-cyan-300 font-bold hover:underline cursor-pointer"
                      >
                        [OPEN COMMS &gt;]
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Transmissions:</span>
                      {workspaceData?.unreadMessageCount > 0 ? (
                        <span className="text-amber-400 font-black animate-pulse">
                          {workspaceData.unreadMessageCount} UNREAD
                        </span>
                      ) : (
                        <span className="text-zinc-500">0 PENDING</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Battle Room:</span>
                      <span className="text-zinc-400">Type 'battle &lt;code&gt;'</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Manual Guide:</span>
                      <button 
                        onClick={() => handleCommand('help')} 
                        className="text-purple-300 font-bold hover:underline cursor-pointer"
                      >
                        [EXECUTE 'help']
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time System Activity Strip */}
              <div className="bg-[#090d16]/80 border border-[#16253b] p-3 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="text-cyan-400 font-bold tracking-wider">[SYS_LOG]</span>
                  <span className="text-zinc-500">23:28:46</span>
                  <span className="text-zinc-300">Central broadcast stream active. Terminal shell initialized in high-precision mode.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-zinc-500 text-[10px]">SHORTCUTS:</span>
                  {['help', 'whoami', 'scorecard', 'team', 'battle'].map(c => (
                    <button
                      key={c}
                      onClick={() => handleCommand(c)}
                      className="px-2 py-0.5 bg-[#0e1726] hover:bg-[#152238] border border-[#20324c] hover:border-cyan-400 text-cyan-300 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Output History Stream */}
            {outputs.length > 0 && (
              <div className="space-y-3 pt-3 max-w-7xl mx-auto w-full">
                {outputs.map(item => (
                  <div key={item.id} className={item.type === 'command' ? 'opacity-95 pt-1' : 'ml-1'}>
                    {item.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Dynamic Expandable Side Panel — on desktop takes right column, on mobile becomes bottom expandable module */}
        <aside 
          aria-label="Command Telemetry Panel"
          className={`transition-all duration-200 ease-out overflow-hidden flex flex-col shrink-0 z-20 ${
            activePanel 
              ? 'w-[32%] min-w-[320px] max-w-[460px] max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[65vh] max-md:w-full max-md:z-20 max-md:border-t-2 max-md:border-cyan-500/80 max-md:border-l-0 opacity-100 pointer-events-auto border-l border-[#1c2638] bg-[#07090e] shadow-2xl' 
              : 'w-0 min-w-0 max-w-0 opacity-0 pointer-events-none border-l-0'
          }`}
        >
          {activePanel && renderActivePanel()}
        </aside>
      </div>

      {/* PERMANENT TERMINAL ENTRY / COMMAND BAR — ALWAYS DOCKED AT THE BOTTOM */}
      <div className="p-2.5 sm:p-3 bg-[#080b12] border-t border-[#1c2638] shrink-0 z-30 w-full relative">
        {activePanel && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 select-none">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>ACTIVE MODULE: <strong className="text-cyan-300 font-mono">/bin/{activePanel.name}</strong></span>
            </span>
            <button 
              type="button" 
              onClick={handleClosePanel}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
            >
              [Close / Esc]
            </button>
          </div>
        )}

        {/* Mobile Quick Touch Command Chips */}
        <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1.5 mb-1.5 no-scrollbar select-none text-[10px] font-mono">
          <span className="text-zinc-500 text-[9px] uppercase tracking-wider shrink-0 mr-0.5">RUN:</span>
          {['help', 'team', 'whoami', 'battle', 'scorecard', 'history', 'messages', 'clear'].map(cmd => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                if (cmd === 'clear') {
                  handleClear();
                } else {
                  handleCommand(cmd);
                }
              }}
              className="px-2 py-1 bg-[#121622] hover:bg-[#1a2030] active:bg-cyan-950 text-cyan-300 border border-[#232d42] active:border-cyan-400 shrink-0 touch-manipulation cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>

        <TerminalInput 
          username={promptUser} 
          onCommand={handleCommand} 
          onClear={handleClear} 
          onEscape={handleClosePanel}
          isExecuting={isExecuting}
        />

        <div className="mt-1.5 text-[9px] sm:text-[10px] text-zinc-500 font-mono tracking-wider flex flex-wrap gap-4 select-none">
          <span>ENTER <span className="text-zinc-600">execute</span></span>
          <span className="hidden xs:inline">TAB <span className="text-zinc-600">autocomplete</span></span>
          <span className="hidden sm:inline">↑↓ <span className="text-zinc-600">history</span></span>
          <span>ESC <span className="text-zinc-600">close panel</span></span>
          <span className="hidden sm:inline">CTRL+L <span className="text-zinc-600">clear</span></span>
        </div>
      </div>
    </div>
  );
};
