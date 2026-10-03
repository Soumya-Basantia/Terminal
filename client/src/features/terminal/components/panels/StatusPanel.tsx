import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Activity, Server, Cpu, Database, Wifi, Shield } from 'lucide-react';

interface StatusPanelProps {
  data: any;
  onClose: () => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ data, onClose }) => {
  const student = data?.student;
  const progress = data?.progress;

  return (
    <PanelFrame
      title="SYSTEM & WORKSPACE TELEMETRY"
      path="/sys/status"
      badge="ONLINE"
      onClose={onClose}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {/* Node Health */}
        <div className="bg-[#121622] border border-cyan-500/30 p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold flex items-center gap-1.5 text-cyan-300">
              <Server size={14} /> HOST NODE
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-sm font-bold text-zinc-100">terminal.internal</div>
          <div className="text-[11px] text-emerald-400 mt-1">STATUS: OPERATIONAL (200 OK)</div>
        </div>

        {/* Security & Auth */}
        <div className="bg-[#121622] border border-emerald-500/30 p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold flex items-center gap-1.5 text-emerald-300">
              <Shield size={14} /> AUTHORIZATION
            </span>
            <span className="text-[10px] px-1 bg-emerald-950 text-emerald-300 border border-emerald-500">ACTIVE</span>
          </div>
          <div className="text-sm font-bold text-zinc-100">{student?.usn || 'AUTHENTICATED'}</div>
          <div className="text-[11px] text-zinc-400 mt-1">SESSION: JWT_VERIFIED (LEVEL 1)</div>
        </div>

        {/* Database Link */}
        <div className="bg-[#121622] border border-purple-500/30 p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold flex items-center gap-1.5 text-purple-300">
              <Database size={14} /> POSTGRESQL LINK
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">CONNECTED</span>
          </div>
          <div className="text-sm font-bold text-zinc-100">PRISMA ORM POOL</div>
          <div className="text-[11px] text-purple-300 mt-1">LATENCY: &lt; 2ms (LOCAL)</div>
        </div>

        {/* Real-time Socket */}
        <div className="bg-[#121622] border border-amber-500/30 p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold flex items-center gap-1.5 text-amber-300">
              <Wifi size={14} /> SOCKET GATEWAY
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">READY</span>
          </div>
          <div className="text-sm font-bold text-zinc-100">WS://ACTIVE-HUB</div>
          <div className="text-[11px] text-zinc-400 mt-1">MULTIPLAYER MULTI-TENANT BUS</div>
        </div>

        {/* Platform Modules */}
        <div className="bg-[#121622] border border-pink-500/30 p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold flex items-center gap-1.5 text-pink-300">
              <Cpu size={14} /> ENGINE CORES
            </span>
            <span className="text-[10px] text-cyan-300 font-bold">7 MODULES</span>
          </div>
          <div className="text-sm font-bold text-zinc-100">CYBERCORE ENGINES</div>
          <div className="text-[11px] text-pink-400 mt-1">THE WITNESS • DEAD CODE • THRESHOLD</div>
        </div>

        {/* Workspace Telemetry */}
        <div className="bg-[#121622] border border-cyan-500/30 p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span className="font-bold flex items-center gap-1.5 text-cyan-300">
              <Activity size={14} /> WORKSPACE SYNC
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">SYNCED</span>
          </div>
          <div className="text-sm font-bold text-zinc-100">{progress?.totalScore || 0} PTS RECORDED</div>
          <div className="text-[11px] text-cyan-400 mt-1">{progress?.solvedCount || 0} CHALLENGES SOLVED</div>
        </div>
      </div>
    </PanelFrame>
  );
};
