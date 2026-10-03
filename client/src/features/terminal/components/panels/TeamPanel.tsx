import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Users, UserPlus, Shield, Flag } from 'lucide-react';

interface TeamPanelProps {
  data: any;
  onClose: () => void;
}

export const TeamPanel: React.FC<TeamPanelProps> = ({ data, onClose }) => {
  const student = data?.student;

  return (
    <PanelFrame
      title="SQUAD & COOPERATIVE MATRIX"
      path="/etc/team"
      badge="SOLO OPERATIVE"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Current status */}
        <div className="bg-[#121622] border-2 border-purple-500/40 p-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 mb-3">
            <div className="p-3 bg-purple-950/60 border border-purple-400 text-purple-400">
              <Users size={24} />
            </div>
            <div>
              <div className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                ACTIVE SQUAD STATUS
              </div>
              <div className="text-base font-bold text-zinc-200">
                Operating as: <span className="text-purple-300 font-mono font-bold">SOLO AGENT</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            You are not currently enrolled in a multi-student battle squad. In team-enabled tournament events, you can join or establish a team using terminal commands.
          </p>
        </div>

        {/* Command Reference for Teams */}
        <div className="bg-[#121622] border border-zinc-800 p-4">
          <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield size={14} className="text-cyan-400" />
            <span>SQUAD COMMAND DIRECTIVE</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-cyan-400 font-bold">team -c "Squad Name"</span>
              <span className="text-zinc-400">Establish and register a new squad</span>
            </div>

            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-cyan-400 font-bold">team -j "Squad Name"</span>
              <span className="text-zinc-400">Join an established squad</span>
            </div>

            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-pink-400 font-bold">team leave</span>
              <span className="text-zinc-400">Depart current squad</span>
            </div>

            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-emerald-400 font-bold">collab &lt;username&gt;</span>
              <span className="text-zinc-400">Dispatch collaboration request to peer</span>
            </div>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
};
