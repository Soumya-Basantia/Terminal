import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Share2, UserCheck, ShieldAlert } from 'lucide-react';

interface CollabPanelProps {
  target: string;
  onClose: () => void;
}

export const CollabPanel: React.FC<CollabPanelProps> = ({ target, onClose }) => {
  return (
    <PanelFrame
      title={`COLLABORATION REQUEST // PEER: ${target}`}
      path={`/collab/${target}`}
      badge="SENT"
      onClose={onClose}
    >
      <div className="bg-[#121622] border-2 border-emerald-500/40 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/60 border border-emerald-400 text-emerald-400">
            <UserCheck size={24} />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-base">
              COLLABORATION INVITATION DISPATCHED
            </h3>
            <p className="text-xs text-zinc-400">
              Invite transmitted to peer operative: <span className="text-cyan-300 font-bold font-mono">@{target}</span>
            </p>
          </div>
        </div>

        <div className="bg-[#0b0e17] p-3 border border-zinc-800 text-xs text-zinc-400 font-mono">
          <div>PEER_NODE: {target}</div>
          <div>PROTOCOL: COOP_HANDSHAKE_v1</div>
          <div>STATUS: WAITING_FOR_PEER_CONFIRMATION...</div>
        </div>
      </div>
    </PanelFrame>
  );
};
