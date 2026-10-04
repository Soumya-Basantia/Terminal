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
    <header className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#0e121c] border-b-2 border-cyan-500/60 select-none font-mono text-xs z-20 shrink-0">
      {/* Left: Terminal Logo & System Info */}
      <div className="flex items-center gap-3">
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

        {/* Brand Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#07090f] border border-cyan-500/70 shadow-[2px_2px_0px_#000]">
          <Terminal size={14} className="text-cyan-400" />
          <span className="font-black text-cyan-300 tracking-wider">
            &gt;_ TERMINAL
          </span>
        </div>

        {/* System Version */}
        <span className="text-[11px] text-zinc-400 hidden lg:inline">
          TERMINAL-OS v3.4.0 <span className="text-zinc-600">(x86_64-cybercore)</span>
        </span>

        {/* Live Socket Status */}
        <TerminalStatus status={socketStatus} />
      </div>

      {/* Right: Authenticated Student Telemetry, Real-time Clock & Logout */}
      <div className="flex items-center gap-3">
        {/* Student Details Chips */}
        <div className="hidden md:flex items-center gap-2 text-[11px]">
          <div className="px-2 py-0.5 bg-[#080b12] border border-zinc-800 text-zinc-300 flex items-center gap-1">
            <span className="text-zinc-500 text-[10px]">USN:</span>
            <span className="font-bold text-emerald-400">{usn}</span>
          </div>

          <div className="px-2 py-0.5 bg-[#080b12] border border-zinc-800 text-zinc-300 flex items-center gap-1">
            <span className="text-zinc-500 text-[10px]">USER:</span>
            <span className="font-bold text-cyan-300">{studentName}</span>
          </div>

          <div className="px-2 py-0.5 bg-[#080b12] border border-zinc-800 text-zinc-300 flex items-center gap-1">
            <span className="text-zinc-500 text-[10px]">STREAM:</span>
            <span className="text-zinc-200">{branch}-{section}</span>
          </div>
        </div>

        {/* Live Digital Clock */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#06080d] border border-cyan-500/40 text-cyan-300 text-[11px] font-bold">
          <Clock size={12} className="text-cyan-400" />
          <span>{timeStr || '00:00:00'}</span>
        </div>

        {/* Exit / Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2.5 py-1 bg-red-950/70 hover:bg-red-900 border border-red-500/70 text-red-300 text-[11px] font-bold transition-all shadow-[2px_2px_0px_#000] cursor-pointer"
            title="Log out of student terminal session"
          >
            <LogOut size={12} />
            <span className="hidden sm:inline">EXIT / LOGOUT</span>
          </button>
        )}
      </div>
    </header>
  );
};
