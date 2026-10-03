import React from 'react';
import { PanelFrame } from './PanelFrame';
import { ShieldCheck, User, Award, Mail, BookOpen, Layers } from 'lucide-react';

interface WhoamiPanelProps {
  data: any;
  onClose: () => void;
}

export const WhoamiPanel: React.FC<WhoamiPanelProps> = ({ data, onClose }) => {
  const student = data?.student || {
    name: 'Student',
    usn: 'N/A',
    email: 'student@terminal.edu',
    branch: 'CSE',
    section: 'A',
    role: 'PLAYER'
  };

  const progress = data?.progress || {
    totalScore: 0,
    solvedCount: 0,
    attemptedCount: 0,
    gamesPlayed: 0
  };

  const roleDisplay = student.role === 'GAME_MASTER' ? 'Game Master' : student.role === 'ADMIN' ? 'Root Admin' : 'Student (Player)';

  return (
    <PanelFrame
      title="STUDENT IDENTITY & PROFILE"
      path="/usr/bin/whoami"
      badge="VERIFIED"
      onClose={onClose}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Profile Card */}
        <div className="md:col-span-2 bg-[#121622] border-2 border-cyan-500/40 p-4 relative">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 mb-3">
            <div className="w-12 h-12 bg-cyan-950/60 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 font-bold text-lg">
              {student.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>{student.name}</span>
                <span className="text-xs px-2 py-0.5 bg-cyan-950 border border-cyan-500 text-cyan-300">
                  {student.usn}
                </span>
              </h3>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">AUTHENTICATED STUDENT</span>
                <span>•</span>
                <span>{roleDisplay}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex items-start gap-2.5">
              <Mail size={16} className="text-cyan-400 mt-0.5" />
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">EMAIL ADDRESS</span>
                <span className="text-zinc-200 font-medium">{student.email}</span>
              </div>
            </div>

            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex items-start gap-2.5">
              <BookOpen size={16} className="text-emerald-400 mt-0.5" />
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">ACADEMIC STREAM</span>
                <span className="text-zinc-200 font-medium">Branch {student.branch} • Section {student.section}</span>
              </div>
            </div>

            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex items-start gap-2.5">
              <Layers size={16} className="text-purple-400 mt-0.5" />
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">ROLE PERMISSIONS</span>
                <span className="text-purple-300 font-medium">{roleDisplay}</span>
              </div>
            </div>

            <div className="bg-[#0b0e17] p-2.5 border border-zinc-800 flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-cyan-400 mt-0.5" />
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">SECURITY LEVEL</span>
                <span className="text-emerald-400 font-medium">LEVEL 1 / WORKSPACE ACCESS</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500">
            INTERNAL ID: <span className="text-zinc-400 font-mono">{student.id}</span>
          </div>
        </div>

        {/* Telemetry Summary Card */}
        <div className="bg-[#121622] border-2 border-emerald-500/40 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-3">
              <span className="text-xs uppercase text-zinc-400 font-bold tracking-wider">SCORE TELEMETRY</span>
              <Award size={16} className="text-emerald-400" />
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">TOTAL POINTS</span>
                <div className="text-2xl font-black text-emerald-400">{progress.totalScore} <span className="text-xs font-normal text-zinc-400">PTS</span></div>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">CHALLENGES SOLVED</span>
                <div className="text-sm font-bold text-cyan-300">{progress.solvedCount} / {progress.attemptedCount} Solved</div>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 block uppercase">SESSIONS PARTICIPATED</span>
                <div className="text-sm font-bold text-amber-400">{progress.gamesPlayed} Recorded</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-500">
            Type <span className="text-cyan-400 font-bold">scorecard</span> for full performance matrix
          </div>
        </div>
      </div>
    </PanelFrame>
  );
};
