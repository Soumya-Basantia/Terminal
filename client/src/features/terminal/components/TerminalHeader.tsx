import React, { useState, useEffect } from 'react';
import { Terminal, LogOut, Clock } from 'lucide-react';
import { useSocketStatus, TerminalStatus } from './TerminalSystemState';


interface TerminalHeaderProps {
  username?: string;
  studentName?: string;
  usn?: string;
  branch?: string;
  section?: string;
  onLogout?: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({ 
  username = 'student',
  studentName = 'Student',
  usn = 'AUTHENTICATED',
  branch = 'CSE',
  section = 'A',
  onLogout 
}) => {
  const [timeStr, setTimeStr] = useState('');
  const socketStatus = useSocketStatus();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(' ')[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-3 py-1.5 bg-[#080b12] border-b border-cyan-500/50 select-none font-mono text-xs z-20 shrink-0 h-9">
      {/* Left: Terminal Wordmark, System State & Online Indicator */}
      <div className="flex items-center gap-2.5">
        {/* Linux window dots */}
        <div className="flex items-center gap-1.5 mr-1">
          <button
            onClick={onLogout}
            className="w-2.5 h-2.5 bg-red-500 hover:bg-red-400 border border-red-700 cursor-pointer"
            title="Exit / Logout"
          />
          <div className="w-2.5 h-2.5 bg-amber-500 border border-amber-700" />
          <div className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-700" />
        </div>

        {/* Wordmark */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#04060a] border border-cyan-500/60 shadow-[1px_1px_0px_#000]">
          <Terminal size={12} className="text-cyan-400" />
          <span className="font-black text-cyan-300 tracking-wider text-[11px]">
            &gt;_ TERMINAL
          </span>
        </div>

        {/* System Telemetry & Socket Connection Status */}
        <span className="text-[10px] text-zinc-500 hidden sm:inline">
          SYS: <strong className="text-zinc-300">LINUX-CYBERCORE</strong>
        </span>

        {/* Live Socket Status */}
        <TerminalStatus status={socketStatus} />
      </div>

      {/* Right: Telemetry, Clock & Exit Action */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Student Session Telemetry */}
        <div className="hidden md:flex items-center gap-2 text-[10px]">
          <div className="px-2 py-0.5 bg-[#05070c] border border-zinc-800 text-zinc-300 flex items-center gap-1">
            <span className="text-zinc-500">USER:</span>
            <span className="font-bold text-cyan-300 font-mono">{username}@terminal</span>
          </div>

          <div className="px-2 py-0.5 bg-[#05070c] border border-zinc-800 text-zinc-300 flex items-center gap-1">
            <span className="text-zinc-500">USN:</span>
            <span className="font-bold text-emerald-400">{usn}</span>
          </div>

          <div className="px-2 py-0.5 bg-[#05070c] border border-zinc-800 text-zinc-400 hidden xl:flex items-center gap-1">
            <span>{branch}-{section}</span>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#04060a] border border-cyan-500/40 text-cyan-300 text-[10px] font-bold">
          <Clock size={11} className="text-cyan-400" />
          <span>{timeStr || '00:00:00'}</span>
        </div>

        {/* Exit / Logout Action */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-950/70 hover:bg-red-900 border border-red-500/70 text-red-300 text-[10px] font-bold transition-all shadow-[1px_1px_0px_#000] cursor-pointer"
            title="Log out of student terminal session"
          >
            <LogOut size={11} />
            <span className="hidden sm:inline">EXIT</span>
          </button>
        )}
      </div>
    </header>
  );
};
