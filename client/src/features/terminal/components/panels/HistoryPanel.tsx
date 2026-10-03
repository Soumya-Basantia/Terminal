import React from 'react';
import { PanelFrame } from './PanelFrame';
import { History, Clock, Hash, Gamepad2 } from 'lucide-react';

interface HistoryPanelProps {
  data: any;
  onClose: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ data, onClose }) => {
  const sessions = data?.sessions || [];

  return (
    <PanelFrame
      title="SESSION & CHALLENGE PARTICIPATION HISTORY"
      path="/var/log/history"
      badge={`${sessions.length} SESSIONS`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {sessions.length > 0 ? (
          <div className="bg-[#121622] border border-cyan-500/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-[#0b0e17] text-zinc-400 border-b border-zinc-800">
                    <th className="p-3">ROOM CODE</th>
                    <th className="p-3">EVENT</th>
                    <th className="p-3">GAME</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">JOINED AT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {sessions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#181d2c] transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-1.5">
                        <Hash size={12} className="text-zinc-500" />
                        <span>{s.roomCode}</span>
                      </td>
                      <td className="p-3 text-zinc-200">{s.eventName}</td>
                      <td className="p-3 text-emerald-400">{s.gameName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-950 border border-cyan-500/50 text-cyan-300">
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-400">
                        {new Date(s.joinedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[#121622] border border-zinc-800 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto mb-3 text-zinc-500">
              <History size={24} />
            </div>
            <h4 className="text-sm font-bold text-zinc-300 mb-1">NO PREVIOUS SESSIONS DETECTED</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
              Your activity history will record every tournament arena and practice challenge you enter.
            </p>
            <div className="text-xs text-cyan-400 font-mono">
              Join an arena with: <span className="font-bold">battle &lt;room_code&gt;</span>
            </div>
          </div>
        )}
      </div>
    </PanelFrame>
  );
};
