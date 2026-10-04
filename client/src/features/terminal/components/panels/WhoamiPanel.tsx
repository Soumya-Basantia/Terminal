import React from 'react';
import { PanelFrame } from './PanelFrame';
import { ShieldCheck, Award, Terminal as TerminalIcon, Sparkles } from 'lucide-react';

interface WhoamiPanelProps {
  data: any;
  onClose: () => void;
}

export const WhoamiPanel: React.FC<WhoamiPanelProps> = ({ data, onClose }) => {
  const student = data?.student || {
    name: 'DOMO',
    username: 'domo',
    usn: '1VA24CI102',
    email: 'student@terminal.edu',
    branch: 'CSE',
    section: 'A',
    role: 'PLAYER',
    club: 'CODENEX'
  };

  const progress = data?.progress || {
    totalScore: 0,
    solvedCount: 0,
    attemptedCount: 0,
    gamesPlayed: 0
  };

  // Authoritative Canonical Public Handle (strictly username@terminal, never USN)
  const canonicalUsername = (student.username || student.name || 'student')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '');
  const publicHandle = `${canonicalUsername}@terminal`;
  const displayName = (student.name || canonicalUsername).toUpperCase();
  const roleDisplay = student.role === 'ADMIN' || student.role === 'SUPER_ADMIN' 
    ? 'ROOT ADMIN' 
    : student.role === 'GAME_MASTER' 
      ? 'GAME MASTER' 
      : 'STUDENT / PLAYER';
  const academicStream = `Branch ${student.branch || 'CSE'} · Section ${student.section || 'A'}`;
  const clubDisplay = student.club || 'CODENEX // DEPT OF CSE';

  return (
    <PanelFrame
      title="STUDENT IDENTITY & PROFILE"
      path="/usr/bin/whoami"
      badge="VERIFIED"
      onClose={onClose}
    >
      <div className="space-y-3 font-mono text-xs select-text">
        {/* Top Identity Hero Block */}
        <div className="bg-[#090d16] border border-[#1c2638] p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#1c2638] pb-2">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-cyan-400">■</span> STUDENT IDENTITY &amp; PROFILE
            </span>
            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE / ACTIVE
            </span>
          </div>

          {/* Primary Public Handle & Operator Name */}
          <div className="space-y-1">
            <div className="text-lg sm:text-xl font-black text-cyan-300 tracking-wide break-all">
              {publicHandle}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <span className="text-sm font-bold text-zinc-100 tracking-wider">
                {displayName}
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-[#121622] border border-purple-500/60 text-purple-300 font-bold uppercase tracking-wider">
                {roleDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Specification Matrix */}
        <div className="bg-[#07090e] border border-[#1c2638] divide-y divide-[#1c2638] text-[11px]">
          {/* Row 1: Public Handle */}
          <div className="p-2.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
              TERMINAL HANDLE
            </span>
            <span className="text-cyan-300 font-bold text-right font-mono truncate">
              {publicHandle}
            </span>
          </div>

          {/* Row 2: Academic USN (Strictly demoted to institutional identifier) */}
          <div className="p-2.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
              USN (ACADEMIC ID)
            </span>
            <span className="text-amber-400 font-bold px-1.5 py-0.2 bg-amber-950/40 border border-amber-600/60 text-[10px] font-mono">
              {student.usn || 'N/A'}
            </span>
          </div>

          {/* Row 3: Academic Stream */}
          <div className="p-2.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
              ACADEMIC STREAM
            </span>
            <span className="text-zinc-200 text-right">
              {academicStream}
            </span>
          </div>

          {/* Row 4: Club Workspace */}
          <div className="p-2.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
              CLUB / WORKSPACE
            </span>
            <span className="text-zinc-300 font-bold text-right">
              {clubDisplay}
            </span>
          </div>

          {/* Row 5: Session State */}
          <div className="p-2.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
              SESSION STATE
            </span>
            <span className="text-emerald-400 font-bold text-right flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400 inline" />
              ACTIVE (LEVEL 1)
            </span>
          </div>

          {/* Row 6: Registered Email */}
          <div className="p-2.5 flex items-center justify-between gap-3">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] shrink-0">
              EMAIL
            </span>
            <span className="text-zinc-400 text-right font-mono text-[10px] truncate">
              {student.email}
            </span>
          </div>
        </div>

        {/* Score Telemetry Block */}
        <div className="bg-[#090d16] border border-[#1c2638] p-3 space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-[10px] font-bold uppercase tracking-wider border-b border-[#1c2638] pb-1.5">
            <span className="flex items-center gap-1.5">
              <Award size={12} className="text-amber-400" />
              SCORE TELEMETRY
            </span>
            <span className="text-cyan-400">STATUS: RECORDED</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
            <div className="bg-[#07090e] border border-[#1c2638] p-2">
              <div className="text-[9px] text-zinc-500 font-bold uppercase">SCORE</div>
              <div className="text-sm font-black text-amber-400 mt-0.5">{progress.totalScore} <span className="text-[9px] font-normal text-zinc-500">PTS</span></div>
            </div>

            <div className="bg-[#07090e] border border-[#1c2638] p-2">
              <div className="text-[9px] text-zinc-500 font-bold uppercase">CHALLENGES</div>
              <div className="text-sm font-black text-cyan-300 mt-0.5">{progress.solvedCount}</div>
            </div>

            <div className="bg-[#07090e] border border-[#1c2638] p-2">
              <div className="text-[9px] text-zinc-500 font-bold uppercase">SESSIONS</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{progress.gamesPlayed}</div>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 pt-1 flex items-center justify-between">
            <span>Type <span className="text-cyan-400 font-bold">'scorecard'</span> for breakdown</span>
            <span className="text-zinc-600 font-mono">tty1/pts0</span>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
};
