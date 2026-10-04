import React, { useState, useEffect, useRef } from 'react';
import { getSocket, connectSocket } from '../../../lib/socket';
import api from '../../../lib/api';
import { Terminal, Send, Minimize2, Maximize2, X, MessageSquare, Radio } from 'lucide-react';
import { TerminalSprite } from '../sprites/TerminalSprite';
import { useSocketStatus } from './TerminalSystemState';

interface TeamChatMessage {
  id: string;
  senderHandle: string;
  senderName?: string;
  content: string;
  createdAt: string;
}

interface TeamChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  isGameMode?: boolean; // When rendered inside a live game overlay
  roomCode?: string;
}

export const TeamChatBox: React.FC<TeamChatBoxProps> = ({
  isOpen,
  onClose,
  isGameMode = false,
  roomCode
}) => {
  const [team, setTeam] = useState<any>(null);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMinimized, setIsMinimized] = useState(!isOpen);
  const socketStatus = useSocketStatus();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync isMinimized state with isOpen prop
  useEffect(() => {
    setIsMinimized(!isOpen);
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Load team info and recent messages
  useEffect(() => {
    let mounted = true;

    async function loadTeamData() {
      try {
        const teamRes = await api.get('/teams/current');
        if (!mounted) return;
        if (teamRes.data.team) {
          setTeam(teamRes.data.team);
          setOnlineCount(teamRes.data.team.membersCount || 1);

          // Fetch message history
          const msgRes = await api.get('/teams/messages');
          if (mounted && msgRes.data.messages) {
            setMessages(msgRes.data.messages);
          }
        }
      } catch (err) {
        console.error('Failed to load team data:', err);
      }
    }

    loadTeamData();

    return () => {
      mounted = false;
    };
  }, []);

  // Setup Socket.IO listener for real-time team messages
  useEffect(() => {
    const socket = connectSocket();

    const syncMessages = async () => {
      try {
        const msgRes = await api.get('/teams/messages');
        if (msgRes.data.messages) {
          setMessages(msgRes.data.messages);
        }
      } catch (err) {
        console.error('Failed to sync messages:', err);
      }
    };

    const handleConnect = () => {
      if (team?.id) {
        socket.emit('team:join', { teamId: team.id });
        syncMessages();
      }
    };

    socket.emit('team:join', { teamId: team?.id });

    const handleMessage = (msg: TeamChatMessage) => {
      setMessages(prev => {
        // Prevent duplicate messages if already present
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (isMinimized) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handlePresence = (data: { handle: string; status: string }) => {
      // Re-fetch team info or count if needed
    };

    const handleTeamDisbanded = () => {
      setTeam(null);
      onClose();
    };

    const handleChatCleared = () => {
      setMessages([]);
    };

    socket.on('connect', handleConnect);
    socket.on('team:message', handleMessage);
    socket.on('team:presence', handlePresence);
    socket.on('team:disbanded', handleTeamDisbanded);
    socket.on('team:chat_cleared', handleChatCleared);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('team:message', handleMessage);
      socket.off('team:presence', handlePresence);
      socket.off('team:disbanded', handleTeamDisbanded);
      socket.off('team:chat_cleared', handleChatCleared);
    };
  }, [team?.id, isMinimized]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current && (!isMinimized || isOpen)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isMinimized, isOpen]);

  // Send message handler
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    const socket = getSocket();
    socket.emit('team:send_message', {
      content: clean,
      teamId: team?.id
    });

    setInputText('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsMinimized(true);
      onClose();
    }
  };

  if (!team) {
    return null;
  }

  // Minimized Floating Bar (for games or when minimized)
  if (isMinimized) {
    return (
      <div 
        onClick={() => {
          setIsMinimized(false);
          setUnreadCount(0);
        }}
        className={`fixed z-50 cursor-pointer font-mono select-none transition-all ${
          isGameMode 
            ? 'bottom-3 right-4 shadow-[4px_4px_0px_#000]' 
            : 'bottom-2 right-4 shadow-[4px_4px_0px_#000]'
        }`}
      >
        <div className="bg-[#0e121c] border-2 border-cyan-500/80 px-3.5 py-1.5 flex items-center gap-2.5 hover:bg-[#141b2c] transition-colors">
          <MessageSquare size={13} className="text-cyan-400" />
          <span className="text-xs font-bold text-zinc-100 tracking-wider">
            TEAM CHAT :: {team.name.toUpperCase()}
          </span>
          {unreadCount > 0 ? (
            <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-black animate-pulse">
              ● {unreadCount} NEW
            </span>
          ) : socketStatus === 'reconnecting' ? (
            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <TerminalSprite animation="reconnecting" size={14} className="shrink-0" />
              RECONNECTING
            </span>
          ) : socketStatus === 'offline' ? (
            <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
              <TerminalSprite animation="error" size={14} loop={false} className="shrink-0" />
              OFFLINE
            </span>
          ) : (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <TerminalSprite animation="network" size={14} className="shrink-0" />
              ONLINE
            </span>
          )}
          <span className="text-[10px] text-zinc-500">[EXPAND]</span>
        </div>
      </div>
    );
  }

  // Full Bottom Terminal Team Chat Channel
  return (
    <div 
      className={`font-mono transition-all duration-300 ease-out z-40 select-text ${
        isGameMode
          ? 'fixed bottom-0 left-0 right-0 max-w-3xl mx-auto border-2 border-cyan-500/80 shadow-[0_-8px_30px_rgba(0,0,0,0.8)] bg-[#07090f]'
          : 'w-full border-t-2 border-cyan-500/80 bg-[#07090f] shadow-[0_-8px_24px_rgba(0,0,0,0.7)] animate-in slide-in-from-bottom-6 duration-200'
      }`}
      style={{ maxHeight: isGameMode ? '280px' : '260px' }}
    >
      {/* Top Channel Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e121c] border-b border-cyan-500/60 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-cyan-400 font-bold text-sm">┌</span>
          {socketStatus === 'reconnecting' ? (
            <TerminalSprite animation="reconnecting" size={15} className="shrink-0" />
          ) : socketStatus === 'offline' ? (
            <TerminalSprite animation="error" size={15} loop={false} className="shrink-0" />
          ) : (
            <TerminalSprite animation="network" size={15} className="shrink-0" />
          )}
          <span className="text-xs font-bold text-cyan-300 tracking-wider truncate">
            TEAM CHANNEL :: {team.name.toUpperCase()}
          </span>
          <span className="hidden sm:inline text-cyan-700 select-none">──────────────────────</span>
          <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.2 bg-emerald-950 border border-emerald-500/50 shrink-0">
            ● {team.membersCount} IN SQUAD
          </span>
          {socketStatus !== 'online' && (
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider shrink-0">
              [{socketStatus}]
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            Press <kbd className="px-1 py-0.2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px]">Esc</kbd> to minimize
          </span>
          <button
            onClick={() => {
              setIsMinimized(true);
              onClose();
            }}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            title="Minimize Team Chat (Esc)"
          >
            <Minimize2 size={13} />
          </button>
          <span className="text-cyan-400 font-bold text-sm">┐</span>
        </div>
      </div>

      {/* Message Feed Stream */}
      <div 
        ref={scrollRef}
        className="overflow-y-auto p-3 terminal-scroll space-y-1.5 text-xs bg-[#07090e]"
        style={{ height: isGameMode ? '160px' : '140px' }}
      >
        {messages.length === 0 ? (
          <div className="text-zinc-600 text-[11px] py-4 text-center">
            [TEAM CHANNEL ESTABLISHED] No transmissions yet. Use the prompt below to coordinate with squad.
          </div>
        ) : (
          messages.map((m) => {
            const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={m.id} className="flex items-baseline justify-between gap-3 text-xs leading-relaxed px-1">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-cyan-600 select-none">│</span>
                  <span className="text-cyan-300 font-bold select-none shrink-0 font-mono">
                    {m.senderHandle} &gt;
                  </span>
                  <span className="text-zinc-200 break-words whitespace-pre-wrap font-mono">
                    {m.content}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-zinc-600 select-none font-mono">
                    {time}
                  </span>
                  <span className="text-cyan-600 select-none">│</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Horizontal Divider Bar */}
      <div className="px-3 text-cyan-600 text-[10px] select-none flex items-center justify-between border-t border-cyan-500/40 bg-[#090c14]">
        <span>├───────────────────────────────────────────────────────────</span>
        <span>┤</span>
      </div>

      {/* Team Chat Command Input Line */}
      <form 
        onSubmit={handleSendMessage}
        className="flex items-center gap-2 px-3 py-2 bg-[#090b12]"
      >
        <span className="text-cyan-400 font-bold text-xs select-none pl-1 whitespace-nowrap font-mono">
          │ &gt;
        </span>

        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="type message... (Enter to send, Esc to minimize)"
          className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600 font-mono text-xs focus:ring-0 p-0 shadow-none caret-cyan-400"
          autoComplete="off"
          spellCheck={false}
        />

        <button
          type="submit"
          className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-[2px_2px_0px_#000]"
          title="Send Transmission (Enter)"
        >
          <span>SEND</span>
          <Send size={11} />
        </button>
        <span className="text-cyan-400 font-bold text-xs select-none">┘</span>
      </form>
    </div>
  );
};
