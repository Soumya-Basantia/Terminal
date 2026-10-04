import React, { useState, useEffect, useRef } from 'react';
import { PanelFrame } from './PanelFrame';
import { Users, Shield, Send, Crown, MessageSquare } from 'lucide-react';
import api from '../../../../lib/api';
import { connectSocket, getSocket } from '../../../../lib/socket';
import { TerminalLoading, TerminalSprite, useSocketStatus } from '../TerminalSystemState';

interface TeamPanelProps {
  data?: any;
  onClose: () => void;
}

interface TeamChatMessage {
  id: string;
  senderHandle: string;
  senderName?: string;
  content: string;
  createdAt: string;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({ onClose }) => {
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<TeamChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const socketStatus = useSocketStatus();

  const fetchTeam = async () => {
    try {
      const res = await api.get('/teams/current');
      setTeam(res.data.team);
      if (res.data.team?.id) {
        // Fetch message history for the team
        try {
          const msgRes = await api.get('/teams/messages');
          if (msgRes.data.messages) {
            setChatMessages(msgRes.data.messages);
          }
        } catch (e) {
          console.error('Failed to load team messages:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();

    const socket = connectSocket();

    const handleUpdate = () => {
      fetchTeam();
    };

    const handleMessage = (msg: TeamChatMessage) => {
      setChatMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleDisbanded = () => {
      setTeam(null);
      setChatMessages([]);
    };

    const handleChatCleared = () => {
      setChatMessages([]);
    };

    socket.on('team:updated', handleUpdate);
    socket.on('team:member_joined', handleUpdate);
    socket.on('team:member_left', handleUpdate);
    socket.on('team:member_kicked', handleUpdate);
    socket.on('team:disbanded', handleDisbanded);
    socket.on('team:leadership_transferred', handleUpdate);
    socket.on('team:presence', handleUpdate);
    socket.on('team:message', handleMessage);
    socket.on('team:chat_cleared', handleChatCleared);

    return () => {
      socket.off('team:updated', handleUpdate);
      socket.off('team:member_joined', handleUpdate);
      socket.off('team:member_left', handleUpdate);
      socket.off('team:member_kicked', handleUpdate);
      socket.off('team:disbanded', handleDisbanded);
      socket.off('team:leadership_transferred', handleUpdate);
      socket.off('team:presence', handleUpdate);
      socket.off('team:message', handleMessage);
      socket.off('team:chat_cleared', handleChatCleared);
    };
  }, []);

  // Join the team room on socket when team is loaded
  useEffect(() => {
    if (team?.id) {
      const socket = getSocket();
      socket.emit('team:join', { teamId: team.id });
    }
  }, [team?.id]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !team?.id) return;

    const socket = getSocket();
    socket.emit('team:send_message', {
      content: clean,
      teamId: team.id
    });

    setInputText('');
    setTimeout(() => chatInputRef.current?.focus(), 50);
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // STOP propagation so global terminal keyboard listener never intercepts keystrokes
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const teamCapacity = team?.maxSize || 4;

  return (
    <PanelFrame
      title={team ? `// TEAM :: ${team.name.toUpperCase()}` : "SQUAD & TEAM MATRIX"}
      path={team ? `/etc/team/${team.name.toLowerCase()}` : "/etc/team"}
      badge={team ? `${team.membersCount}/${teamCapacity} SQUAD` : "SOLO OPERATIVE"}
      onClose={onClose}
    >
      <div className="space-y-3.5 font-mono text-xs select-text">
        {loading ? (
          <TerminalLoading label="QUERYING SQUAD REGISTRY" node="/etc/team" />
        ) : team ? (
          <div className="space-y-3.5">
            {/* 1. Compact Team Identity Banner */}
            <div className="bg-[#0a0d16] border border-[#1c2638] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-[#1c2638] pb-2">
                <div>
                  <div className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
                    TEAM IDENTITY
                  </div>
                  <h3 className="text-base font-black text-zinc-100 flex items-center gap-2">
                    <span className="text-cyan-300">{team.name.toUpperCase()}</span>
                    {team.isLeader && (
                      <span className="text-[9px] px-1.5 py-0.2 bg-amber-950 border border-amber-500 text-amber-300 font-bold uppercase">
                        YOU ARE LEADER
                      </span>
                    )}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[9px] text-zinc-500 uppercase block font-mono">STATUS</span>
                  <span className="text-[11px] px-2 py-0.5 border border-emerald-500/70 bg-emerald-950/60 text-emerald-300 font-bold">
                    {team.status || 'READY'}
                  </span>
                </div>
              </div>

              {/* Leader Telemetry & Team Size */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#07090e] p-2 border border-[#1c2638] flex items-center gap-1.5 min-w-0">
                  <Crown size={12} className="text-amber-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-zinc-500 text-[9px] block">LEADER</span>
                    <span className="text-cyan-300 font-bold truncate block">{team.leaderHandle}</span>
                  </div>
                </div>

                <div className="bg-[#07090e] p-2 border border-[#1c2638] flex items-center gap-1.5">
                  <Users size={12} className="text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-zinc-500 text-[9px] block">TEAM SIZE</span>
                    <span className="text-zinc-100 font-bold">{team.membersCount} / {teamCapacity}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Operative Roster (Members 1 / 4) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                <span>MEMBERS ({team.membersCount} / {teamCapacity})</span>
                <span className="text-[10px] text-zinc-500">MAX 4 OPERATIVES</span>
              </div>

              <div className="space-y-1">
                {team.members.map((m: any) => (
                  <div
                    key={m.id}
                    className="bg-[#0b0e17] border border-[#1c2638] px-2.5 py-1.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${m.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-zinc-100 font-bold font-mono text-xs truncate">
                        {m.handle}
                      </span>
                      {m.isLeader && (
                        <span className="text-[8px] px-1 py-0.2 bg-amber-950 text-amber-300 border border-amber-600 font-bold shrink-0">
                          LEADER
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                      <span className={`font-bold ${m.isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {m.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Real-Time Embedded Team Chat */}
            <div className="border border-[#1c2638] bg-[#07090e] flex flex-col overflow-hidden">
              {/* Chat Channel Header */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0d16] border-b border-[#1c2638] select-none">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={12} className="text-cyan-400" />
                  <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                    TEAM CHAT
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px]">
                  {socketStatus === 'reconnecting' ? (
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <TerminalSprite animation="reconnecting" size={12} className="shrink-0" />
                      RECONNECTING
                    </span>
                  ) : socketStatus === 'offline' ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <TerminalSprite animation="error" size={12} loop={false} className="shrink-0" />
                      OFFLINE
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <TerminalSprite animation="network" size={12} className="shrink-0" />
                      ONLINE
                    </span>
                  )}
                </div>
              </div>

              {/* Message Feed Stream */}
              <div
                ref={chatScrollRef}
                className="p-2.5 space-y-1.5 overflow-y-auto max-h-[190px] min-h-[110px] terminal-scroll text-xs bg-[#05070c]"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-zinc-600 text-center py-4 text-[11px]">
                    [TEAM CHANNEL OPEN] No messages yet. Coordinate with your squad below.
                  </div>
                ) : (
                  chatMessages.map(m => (
                    <div key={m.id} className="leading-relaxed flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-cyan-300 font-bold font-mono mr-1.5 select-none">{m.senderHandle} &gt;</span>
                        <span className="text-zinc-200 font-mono break-words">{m.content}</span>
                      </div>
                      <span className="text-[9px] text-zinc-600 font-mono shrink-0 select-none">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input Line */}
              <form
                onSubmit={handleSendMessage}
                className="p-2 bg-[#090b12] border-t border-[#1c2638] flex items-center gap-2"
              >
                <span className="text-cyan-400 font-bold text-xs select-none pl-1">&gt;</span>
                <input
                  ref={chatInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="type message... (Enter to send)"
                  className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600 font-mono text-xs focus:ring-0 p-0 shadow-none caret-cyan-400"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  title="Send Transmission (Enter)"
                >
                  <span>SEND</span>
                  <Send size={11} />
                </button>
              </form>
            </div>

            {/* 4. Squad Commands (Permission-Aware) */}
            <div className="bg-[#090c14] border border-[#1c2638] p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Shield size={11} className="text-cyan-400" />
                <span>SQUAD COMMANDS</span>
              </div>

              <div className="space-y-1 text-[11px] font-mono text-zinc-400">
                {team.isLeader && team.membersCount < teamCapacity && (
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-bold">team invite &lt;handle&gt;</span>
                    <span className="text-zinc-500">Invite member (max {teamCapacity})</span>
                  </div>
                )}
                {team.isLeader && (
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-bold">team kick &lt;handle&gt;</span>
                    <span className="text-zinc-500">Remove member</span>
                  </div>
                )}
                {team.isLeader && (
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-bold">team disband</span>
                    <span className="text-zinc-500">Disband team</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-pink-400 font-bold">team leave</span>
                  <span className="text-zinc-500">Depart squad</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State: Solo Operative */
          <div className="space-y-3">
            <div className="bg-[#0a0d16] border border-[#1c2638] p-5 text-center space-y-2.5">
              <div className="w-10 h-10 bg-[#07090e] border border-[#1c2638] flex items-center justify-center mx-auto text-zinc-500">
                <Users size={20} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-1">
                  OPERATING AS SOLO AGENT
                </h4>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                  You are not currently in a squad. Form a squad of up to 4 operatives or join an existing team.
                </p>
              </div>
            </div>

            {/* Solo Operative Commands */}
            <div className="bg-[#090c14] border border-[#1c2638] p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Shield size={11} className="text-cyan-400" />
                <span>AVAILABLE COMMANDS</span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-zinc-400">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold">team create "Name"</span>
                  <span className="text-zinc-500">Form squad (max 4)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold">team -j "Name"</span>
                  <span className="text-zinc-500">Join squad</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-cyan-300 font-bold">team requests</span>
                  <span className="text-zinc-500">View team invites</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelFrame>
  );
};
