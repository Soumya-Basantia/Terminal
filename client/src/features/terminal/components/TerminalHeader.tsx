import React from 'react';
import { Terminal, LogOut } from 'lucide-react';

interface TerminalHeaderProps {
  username?: string;
  usn?: string;
  onLogout?: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({ 
  username = 'student', 
  usn = 'AUTHENTICATED', 
  onLogout 
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-[#121622] border-b-2 border-cyan-500/40 select-none font-mono">
      <div className="flex items-center gap-2">
        {/* Linux window control lights */}
        <div className="flex items-center gap-1.5 mr-2">
          <button
            onClick={onLogout}
            className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 border border-red-700 cursor-pointer"
            title="Log out (exit)"
          />
          <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-700" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-700" />
        </div>

        <Terminal className="w-4 h-4 text-cyan-400" />
        <span className="text-xs text-zinc-300 font-bold tracking-wider">
          {username}@terminal:~
        </span>
        <span className="text-[11px] text-zinc-500 hidden sm:inline">
          (bash - tty1)
        </span>
        {usn && (
          <span className="text-[10px] px-1.5 py-0.2 bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono hidden md:inline">
            USN: {usn}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-[11px] font-bold text-emerald-400 tracking-wider">ONLINE</span>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/50 text-red-400 text-xs font-bold transition-colors cursor-pointer"
            title="Log out of Terminal session"
          >
            <LogOut size={12} />
            <span className="hidden sm:inline text-[11px]">EXIT</span>
          </button>
        )}
      </div>
    </div>
  );
};
