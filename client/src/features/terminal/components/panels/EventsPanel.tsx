import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Calendar, Flag, Trophy, Clock } from 'lucide-react';

interface EventsPanelProps {
  data: any;
  onClose: () => void;
}

export const EventsPanel: React.FC<EventsPanelProps> = ({ data, onClose }) => {
  const events = data?.events || [];

  return (
    <PanelFrame
      title="TOURNAMENT & COMPETITIVE EVENTS"
      path="/events"
      badge={`${events.length} ACTIVE`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="text-xs text-zinc-400 bg-[#121622] p-3 border-l-4 border-emerald-400">
          <div className="font-bold text-emerald-300 uppercase mb-1">
            SCHEDULED TOURNAMENTS
          </div>
          <div>
            Events are multi-stage tournaments organized by Game Masters. When a tournament session opens, use the provided room code to join via <span className="text-cyan-300 font-bold font-mono">battle &lt;ROOM_CODE&gt;</span>.
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {events.length > 0 ? (
            events.map((event: any) => (
              <div 
                key={event.id}
                className="bg-[#121622] border border-emerald-500/30 p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                      <Trophy size={16} className="text-emerald-400" />
                      <span>{event.name}</span>
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-mono">
                      {event.mode || 'TOURNAMENT'}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 mb-3">
                    {event.description || 'Campus competitive arena tournament.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[11px]">
                  <span className="text-zinc-500 flex items-center gap-1 font-mono">
                    <Clock size={12} /> {event.createdAt ? new Date(event.createdAt).toLocaleDateString() : 'Active'}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold">
                    ONLINE
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-zinc-500 text-xs p-4 bg-[#121622] text-center border border-zinc-800">
              No tournament events currently active.
            </div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
};
