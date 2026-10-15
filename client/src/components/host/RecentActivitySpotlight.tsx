import React from 'react';
import { Zap, Play, Check, User, Trophy, AlertTriangle, Radio } from 'lucide-react';

export interface ActivityItem {
  id: string;
  time: string;
  text: string;
  icon: 'play' | 'check' | 'user' | 'trophy' | 'warn';
}

export interface RecentActivitySpotlightProps {
  isSpotlight: boolean;
  activities: ActivityItem[];
}

export function RecentActivitySpotlight({
  isSpotlight,
  activities,
}: RecentActivitySpotlightProps) {
  return (
    <div className={`flex flex-col flex-1 w-full font-mono select-none ${isSpotlight ? 'p-4 sm:p-8 max-w-5xl mx-auto' : 'p-3'}`}>
      {isSpotlight && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-[#16202c]">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
              LIVE TELEMETRY LOG STREAM
            </h1>
            <p className="text-[#8b99aa] text-xs sm:text-sm">
              Authoritative real-time game server event ledger.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0c10] border border-[#3fb950] text-[#3fb950] text-xs font-bold">
            <Radio size={14} className="animate-pulse" />
            <span>STREAM CONNECTED</span>
          </div>
        </div>
      )}

      <div className={`flex flex-col gap-2 overflow-y-auto flex-1 ${isSpotlight ? 'max-h-[70vh]' : ''}`}>
        {activities.length === 0 ? (
          <div className="text-center py-12 text-[#5e6b7c] text-xs">
            // AWAITING TELEMETRY EVENTS FROM SESSION ORCHESTRATOR...
          </div>
        ) : (
          activities.map(act => (
            <div
              key={act.id}
              className={`flex items-start justify-between gap-3 border-b border-[#16202c] transition-colors ${
                isSpotlight ? 'p-3.5 bg-[#0a0c10] border-l-4 border-l-[#00ffcc] text-sm' : 'py-1.5 text-[11px]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-[#e6edf3] min-w-0">
                {act.icon === 'play' && <Play size={isSpotlight ? 16 : 11} className="text-[#00ffcc] shrink-0" />}
                {act.icon === 'check' && <Check size={isSpotlight ? 16 : 11} className="text-[#3fb950] shrink-0" />}
                {act.icon === 'user' && <User size={isSpotlight ? 16 : 11} className="text-[#38bdf8] shrink-0" />}
                {act.icon === 'trophy' && <Trophy size={isSpotlight ? 16 : 11} className="text-[#fcee0a] shrink-0" />}
                {act.icon === 'warn' && <AlertTriangle size={isSpotlight ? 16 : 11} className="text-[#ff3366] shrink-0" />}
                <span className="truncate">{act.text}</span>
              </div>
              <span className="text-[#5e6b7c] text-[10px] sm:text-xs shrink-0 font-bold">
                {act.time}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
