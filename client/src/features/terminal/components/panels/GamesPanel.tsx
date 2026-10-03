import React from 'react';
import { PanelFrame } from './PanelFrame';
import { Gamepad2, Shield, Terminal, Zap } from 'lucide-react';

interface GamesPanelProps {
  data: any;
  onClose: () => void;
}

export const GamesPanel: React.FC<GamesPanelProps> = ({ data, onClose }) => {
  const games = data?.games || [];

  return (
    <PanelFrame
      title="AVAILABLE PLATFORM GAMES"
      path="/games"
      badge={`${games.length} MODULES`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="text-xs text-zinc-400 bg-[#121622] p-3 border-l-4 border-cyan-400">
          <div className="font-bold text-cyan-300 uppercase mb-1">
            CYBER CHALLENGE ARENAS
          </div>
          <div>
            The platform hosts 7 real-time multiplayer simulation engines. To enter an active battle session launched by a Game Master, type <span className="text-cyan-300 font-bold font-mono">battle &lt;ROOM_CODE&gt;</span> below.
          </div>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {games.length > 0 ? (
            games.map((game: any) => (
              <div 
                key={game.id}
                className="bg-[#121622] border border-cyan-500/30 p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                      <Gamepad2 size={16} className="text-cyan-400" />
                      <span>{game.name}</span>
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-mono">
                      {game.template}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400 mb-3 line-clamp-2">
                    {game.description || 'Cyber battle arena challenge module.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-[11px]">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Zap size={12} /> {game.challengeCount || 0} Challenges
                  </span>
                  <span className="text-zinc-500 font-mono">
                    STATUS: <span className="text-cyan-400">PUBLISHED</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-zinc-500 text-xs p-4 bg-[#121622] text-center border border-zinc-800">
              No standalone games currently loaded. Check back shortly.
            </div>
          )}
        </div>

        <div className="bg-[#0b0e17] border border-zinc-800 p-3 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <span>Command Syntax:</span>
          <span className="text-cyan-300 font-mono font-bold">battle &lt;ROOM_CODE&gt;</span>
        </div>
      </div>
    </PanelFrame>
  );
};
