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
    <div className="w-full flex-1 flex flex-col bg-[var(--term-bg-surface)] border-2 border-[var(--term-cyan)] shadow-[0_0_20px_var(--term-cyan-glow)] font-mono animate-in fade-in zoom-in-95 duration-150 relative overflow-hidden">
      {/* Cyber Corner Accents */}
      <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-[var(--term-cyan)] pointer-events-none z-10" />
      <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-[var(--term-cyan)] pointer-events-none z-10" />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-[var(--term-cyan)] pointer-events-none z-10" />
      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-[var(--term-cyan)] pointer-events-none z-10" />

      {/* Top Cyber Window Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--term-bg-elevated)] border-b-2 border-[var(--term-cyan)] select-none">
        <div className="flex items-center gap-2">
          {/* Unix/Linux dot controls */}
          <div className="flex items-center gap-1.5 mr-2">
            <button 
              onClick={onClose}
              className="w-3 h-3 rounded-none bg-[var(--term-red)] hover:opacity-80 border border-red-700 cursor-pointer"
              title="Close panel (Esc)"
            />
            <div className="w-3 h-3 rounded-none bg-[var(--term-yellow)] border border-amber-700" />
            <div className="w-3 h-3 rounded-none bg-[var(--term-green)] border border-emerald-700" />
          </div>

          <Terminal size={14} className="text-cyan-400" />
          <span className="text-xs text-zinc-400 font-mono tracking-wider hidden sm:inline">
            PANEL:
          </span>
          <span className="text-xs font-bold text-cyan-300 tracking-wider">
            {path}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950/80 border border-cyan-400/60 text-cyan-300 font-bold uppercase">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500 hidden md:inline">
            Press <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]">Esc</kbd> or type <span className="text-cyan-400">terminal</span> to return
          </span>

          <button
            onClick={onClose}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/60 text-red-400 text-xs font-bold transition-colors cursor-pointer"
            title="Close Panel and Return to Terminal"
          >
            <X size={13} />
            <span className="text-[11px]">ESC</span>
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 terminal-scroll text-zinc-200">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="border-b border-zinc-800 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-2">
              <span className="text-fuchsia-400">▶</span>
              <span>{title}</span>
            </h2>
            <div className="text-[11px] text-zinc-500 font-mono">
              STATUS: <span className="text-emerald-400 font-bold">ACTIVE</span>
            </div>
          </div>

          {children}
        </div>
      </div>

      {/* Bottom return hint bar */}
      <div className="px-3 py-1.5 bg-[#090b10] border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500 select-none">
        <div className="flex items-center gap-2">
          <CornerDownLeft size={12} className="text-cyan-400" />
          <span>Type <span className="text-cyan-300 font-bold">terminal</span> to close panel • Press <kbd className="px-1 py-0.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]">Esc</kbd> anytime</span>
        </div>
        <div className="text-[10px] text-zinc-600 hidden sm:block">
          SECURE_STUDENT_WORKSPACE // AUTH_VERIFIED
        </div>
      </div>
    </div>
  );
};
