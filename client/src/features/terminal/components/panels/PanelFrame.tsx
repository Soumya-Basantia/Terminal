import React, { useEffect } from 'react';
import { Terminal, X } from 'lucide-react';

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
    <div className="w-full h-full flex flex-col bg-[#090d16] border-l border-[#1c2638] font-mono relative overflow-hidden select-text">
      {/* Top Cyber Window Bar */}
      <div className="flex items-center justify-between px-3 h-8 bg-[#0e1422] border-b border-[#1c2638] select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal size={12} className="text-cyan-400 shrink-0" />
          <span className="text-[10px] font-bold text-cyan-300 tracking-wider truncate">
            {path}
          </span>
          {badge && (
            <span className="text-[8px] px-1 py-0.2 bg-[#05070c] border border-cyan-500/50 text-cyan-300 font-bold uppercase shrink-0">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-[#141b2c] hover:bg-[#1a2338] border border-[#1c2638] hover:border-cyan-400 text-zinc-300 hover:text-cyan-300 text-[9px] font-bold transition-colors cursor-pointer"
            title="Close Panel and Return to Full Terminal (Esc)"
          >
            <X size={10} />
            <span>ESC</span>
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-3 terminal-scroll text-zinc-200 min-h-0 bg-[#090d16]">
        <div className="space-y-3">
          <div className="border-b border-[#1c2638] pb-1.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 truncate">
              <span className="text-cyan-400">■</span>
              <span className="truncate">{title}</span>
            </h2>
            <div className="text-[9px] text-zinc-500 font-mono shrink-0">
              STATUS: <span className="text-emerald-400 font-bold">NOMINAL</span>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
};
