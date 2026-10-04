import React, { useState, useEffect } from 'react';
import { PanelFrame } from './PanelFrame';
import { Users, Shield, Zap, Trophy, Crown } from 'lucide-react';
import api from '../../../../lib/api';
import { connectSocket } from '../../../../lib/socket';
import { TerminalLoading, TerminalError, TerminalEmpty } from '../TerminalSystemState';

interface TeamPanelProps {
  data?: any;
  onClose: () => void;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({ onClose }) => {
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeam = async () => {
    try {
      const res = await api.get('/teams/current');
      setTeam(res.data.team);
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

    socket.on('team:updated', handleUpdate);
    socket.on('team:member_joined', handleUpdate);
    socket.on('team:member_left', handleUpdate);
    socket.on('team:member_kicked', handleUpdate);
    socket.on('team:disbanded', handleUpdate);
    socket.on('team:leadership_transferred', handleUpdate);
    socket.on('team:presence', handleUpdate);

    return () => {
      socket.off('team:updated', handleUpdate);
      socket.off('team:member_joined', handleUpdate);
      socket.off('team:member_left', handleUpdate);
      socket.off('team:member_kicked', handleUpdate);
      socket.off('team:disbanded', handleUpdate);
      socket.off('team:leadership_transferred', handleUpdate);
      socket.off('team:presence', handleUpdate);
    };
  }, []);

  return (
    <PanelFrame
      title={team ? `// TEAM :: ${team.name.toUpperCase()}` : "SQUAD & TEAM MATRIX"}
      path={team ? `/etc/team/${team.name.toLowerCase()}` : "/etc/team"}
      badge={team ? `${team.membersCount}/${team.maxSize} SQUAD` : "SOLO OPERATIVE"}
      onClose={onClose}
    >
      <div className="space-y-4 font-mono text-xs">
        {loading ? (
          <TerminalLoading label="QUERYING SQUAD REGISTRY" node="/etc/team" />
        ) : team ? (
          <div className="space-y-4">
            {/* Team Banner */}
            <div className="bg-[#121622] border-2 border-purple-500/60 p-4 shadow-[2px_2px_0px_#000]">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-950/70 border-2 border-purple-400 text-purple-300 shadow-[2px_2px_0px_#000]">
                    <Users size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                      REGISTERED SQUAD
                    </div>
                    <h3 className="text-base font-black text-zinc-100 flex items-center gap-2">
                      <span>{team.name.toUpperCase()}</span>
                      {team.isLeader && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-950 border border-amber-500 text-amber-300 font-bold uppercase">
                          YOU ARE LEADER
                        </span>
                      )}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono">STATUS</span>
                  <span className="text-xs px-2 py-0.5 border border-emerald-500/70 bg-emerald-950/60 text-emerald-300 font-bold">
                    {team.status || 'READY'}
                  </span>
                </div>
              </div>

              {/* Leader Telemetry */}
              <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown size={14} className="text-amber-400" />
                  <span className="text-zinc-400 text-[11px] uppercase font-bold">LEADER:</span>
                  <span className="text-cyan-300 font-bold font-mono">
                    ⚡ {team.leaderHandle}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">{team.leaderName}</span>
              </div>
            </div>

            {/* Team Members List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                <span>MEMBERS ({team.membersCount} / {team.maxSize})</span>
                <span className="text-[10px] text-zinc-500">OPERATIVE ROSTER</span>
              </div>

              <div className="space-y-1.5">
                {team.members.map((m: any) => (
                  <div
                    key={m.id}
                    className="bg-[#0f131d] border border-zinc-800 p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs ${m.isOnline ? 'text-emerald-400' : 'text-zinc-600'}`}>●</span>
                      <span className="text-zinc-100 font-bold font-mono text-xs truncate">
                        {m.handle}
                      </span>
                      {m.isLeader && (
                        <span className="text-[9px] px-1 py-0.2 bg-amber-950 text-amber-300 border border-amber-600 font-bold">
                          LEADER
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                      <span className="text-zinc-400">{m.name}</span>
                      <span className={`font-bold ${m.isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {m.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#121622] p-3 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase block">TEAM SIZE</span>
                <span className="text-lg font-bold text-zinc-100">{team.membersCount} / {team.maxSize}</span>
              </div>
              <div className="bg-[#121622] p-3 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase block">CHANNEL</span>
                <span className="text-xs font-bold text-cyan-400 block mt-1">type 'team chat'</span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State: Solo Operative */
          <div className="bg-[#121622] border-2 border-zinc-800 p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-500">
              <Users size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-1">
                OPERATING AS SOLO AGENT
              </h4>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                You are not currently enrolled in a multi-student battle squad. Form a squad or join an existing team via terminal commands.
              </p>
            </div>
          </div>
        )}

        {/* Command Directives Guide (Command-driven interaction) */}
        <div className="bg-[#090c14] border border-zinc-800 p-3 space-y-2 mt-4">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <Shield size={12} className="text-cyan-400" />
            <span>SQUAD COMMAND DIRECTIVE</span>
          </div>

          <div className="space-y-1.5 text-[11px] text-zinc-400 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">team create "Name"</span>
              <span className="text-zinc-500">Establish squad as leader</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">team -j "Name"</span>
              <span className="text-zinc-500">Join existing open squad</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">team invite &lt;handle&gt;</span>
              <span className="text-zinc-500">Leader invites operative</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">team chat</span>
              <span className="text-zinc-500">Open real-time team channel</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-pink-400 font-bold">team leave</span>
              <span className="text-zinc-500">Depart squad</span>
            </div>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
};
