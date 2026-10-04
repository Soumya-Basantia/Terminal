import React, { useState, useEffect } from 'react';
import { LogOut, Clock } from 'lucide-react';
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
    <header className="flex items-center justify-between px-3 bg-[#080b12] border-b border-[#1c2638] select-none font-mono text-xs z-20 shrink-0 h-9">
      {/* Left: Terminal Brand & System State */}
      <div className="flex items-center gap-2">
        <span className="text-cyan-400 font-black tracking-wider text-xs">
          ■ TERMINAL-OS
        </span>
        <span className="text-[10px] text-zinc-600 hidden sm:inline font-mono">v3.4.0</span>
        <span className="text-[9px] px-1.5 py-0.2 bg-[#0c121e] border border-[#1c2638] text-cyan-300 font-bold uppercase tracking-wider hidden md:inline">
          NODE-7729-ALPHA
        </span>
        <TerminalStatus status={socketStatus} />
      </div>

      {/* Center: Operator Identity */}
      <div className="hidden lg:flex items-center gap-2 text-[10px]">
        <span className="text-zinc-500">OPERATOR:</span>
        <span className="text-cyan-300 font-bold">{username}@terminal</span>
        <span className="text-zinc-600 font-mono">[{usn}]</span>
        <span className="text-zinc-600">({branch}-{section})</span>
      </div>

      {/* Right: Telemetry, Clock & Exit Action */}
      <div className="flex items-center gap-2 text-xs">
        {/* Live Digital Clock */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#05070c] border border-[#1c2638] text-cyan-300 text-[10px] font-bold">
          <Clock size={11} className="text-cyan-400" />
          <span>{timeStr || '00:00:00'}</span>
        </div>

        {/* Exit / Logout Action */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1a0c10] hover:bg-[#2b1016] border border-red-500/50 text-red-300 text-[10px] font-bold transition-all cursor-pointer"
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
