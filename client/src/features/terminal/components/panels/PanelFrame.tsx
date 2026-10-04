import React, { useEffect } from 'react';
import { Terminal, X, CornerDownLeft } from 'lucide-react';

interface PanelFrameProps {
  title: string;
  path: string;
  badge?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const PanelFrame: React.FC<PanelFrameProps> = ({
  title,
  path,
  badge,
  onClose,
  children
}) => {
  // Global Escape key listener for this panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0e17] border-l-2 border-cyan-500/70 font-mono relative overflow-hidden select-text">
      {/* Top Cyber Window Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#121622] border-b-2 border-cyan-500/60 select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Linux dot controls */}
          <div className="flex items-center gap-1.5 mr-1.5 shrink-0">
            <button 
              onClick={onClose}
              className="w-2.5 h-2.5 bg-red-500 hover:bg-red-400 border border-red-700 cursor-pointer"
              title="Close panel (Esc)"
            />
            <div className="w-2.5 h-2.5 bg-amber-500 border border-amber-700" />
            <div className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-700" />
          </div>

          <Terminal size={13} className="text-cyan-400 shrink-0" />
          <span className="text-[11px] font-bold text-cyan-300 tracking-wider truncate">
            {path}
          </span>
          {badge && (
            <span className="text-[9px] px-1.5 py-0.2 bg-cyan-950 border border-cyan-400/60 text-cyan-300 font-bold uppercase shrink-0">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-950/60 hover:bg-red-900 border border-red-500/70 text-red-300 text-[10px] font-bold transition-colors cursor-pointer"
            title="Close Panel and Return to Full Terminal (Esc)"
          >
            <X size={11} />
            <span>ESC</span>
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 terminal-scroll text-zinc-200 min-h-0">
        <div className="space-y-4">
          <div className="border-b border-zinc-800 pb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-2 truncate">
              <span className="text-fuchsia-400">▶</span>
              <span className="truncate">{title}</span>
            </h2>
            <div className="text-[10px] text-zinc-500 font-mono shrink-0">
              STATUS: <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </div>

          {children}
        </div>
      </div>

      {/* Bottom return hint bar */}
      <div className="px-3 py-1 bg-[#07090f] border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 select-none shrink-0">
        <div className="flex items-center gap-1.5">
          <CornerDownLeft size={10} className="text-cyan-400" />
          <span>Press <kbd className="px-1 py-0.2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[9px]">Esc</kbd> to return</span>
        </div>
        <div className="text-[9px] text-zinc-600">
          RESPONSIVE_HUD
        </div>
      </div>
    </div>
  );
};
