import React from 'react';
import { PanelFrame } from './PanelFrame';
import { BattleLobby } from '../../commands/battle/BattleLobby';

interface BattlePanelProps {
  roomCode: string;
  onClose: () => void;
}

export const BattlePanel: React.FC<BattlePanelProps> = ({ roomCode, onClose }) => {
  return (
    <PanelFrame
      title={`BATTLE ARENA // ROOM: ${roomCode}`}
      path={`/battle/${roomCode}`}
      badge="LIVE COMBAT"
      onClose={onClose}
    >
      <div className="w-full">
        <BattleLobby roomCode={roomCode} />
      </div>
    </PanelFrame>
  );
};
