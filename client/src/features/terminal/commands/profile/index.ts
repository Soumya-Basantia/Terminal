import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalTable, TerminalError, TerminalSuccess } from '../../components/outputs';
import api from '../../../../lib/api';

export const whoamiCommand: CommandDefinition = {
  name: 'whoami',
  aliases: ['username', 'id', 'user'],
  category: 'profile',
  description: 'Show your student identity, USN, academic stream & security clearance',
  usage: 'whoami',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('whoami');
    try {
      const response = await api.get('/workspace/student');
      const { student, progress } = response.data;
      
      const canonicalUser = (student.username || student.name || 'student')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_-]/g, '');
      const cleanHandle = `${canonicalUser}@terminal`;
      const displayName = (student.name || canonicalUser).toUpperCase();
      const roleStr = student.role === 'GAME_MASTER' ? 'GAME MASTER' : student.role === 'ADMIN' ? 'ROOT ADMIN' : 'STUDENT / PLAYER';
      const academicStream = `Branch ${student.branch || 'CSE'} · Section ${student.section || 'A'}`;
      const clubStr = student.club || 'CODENEX';

      return React.createElement('div', { className: 'font-mono text-xs my-1 select-text' },
        React.createElement('div', { className: 'text-cyan-400 font-bold tracking-wider mb-1' }, 'STUDENT IDENTITY'),
        React.createElement('div', { className: 'text-[#1c2638] select-none text-[10px]' }, '──────────────────────────────────────────────'),
        React.createElement('div', { className: 'grid grid-cols-[130px_1fr] gap-x-2 gap-y-1 text-zinc-200 py-1' },
          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'TERMINAL HANDLE'),
          React.createElement('span', { className: 'text-cyan-300 font-bold' }, cleanHandle),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'OPERATOR NAME'),
          React.createElement('span', { className: 'text-zinc-100 font-bold' }, displayName),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'ROLE'),
          React.createElement('span', { className: 'text-purple-300 font-bold' }, roleStr),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'STATUS'),
          React.createElement('span', { className: 'text-emerald-400 font-bold' }, 'ONLINE / ACTIVE'),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'ACADEMIC STREAM'),
          React.createElement('span', { className: 'text-zinc-300' }, academicStream),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'USN (ACADEMIC ID)'),
          React.createElement('span', { className: 'text-amber-400 font-bold' }, student.usn || 'N/A'),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'CLUB / WORKSPACE'),
          React.createElement('span', { className: 'text-zinc-300' }, clubStr),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'SESSION'),
          React.createElement('span', { className: 'text-emerald-300 font-bold' }, 'ACTIVE (LEVEL 1)'),

          React.createElement('span', { className: 'text-zinc-500 font-bold' }, 'SCORE'),
          React.createElement('span', { className: 'text-amber-400 font-bold' }, `${progress?.totalScore ?? 0} PTS`)
        ),
        React.createElement('div', { className: 'text-[#1c2638] select-none text-[10px]' }, '──────────────────────────────────────────────')
      );
    } catch {
      return React.createElement(TerminalSuccess, null, 'Opening student identity telemetry panel...');
    }
  }
};

export const scorecardCommand: CommandDefinition = {
  name: 'scorecard',
  aliases: ['score', 'stats', 'points'],
  category: 'profile',
  description: 'Show your verified score, challenges solved, and competitive stats',
  usage: 'scorecard',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('scorecard');
    try {
      const response = await api.get('/workspace/student');
      const { student, progress } = response.data;
      const accuracy = progress.attemptedCount > 0 
        ? Math.round((progress.solvedCount / progress.attemptedCount) * 100) 
        : 100;

      return React.createElement('div', { className: 'font-mono text-xs' },
        React.createElement(TerminalSection, { title: 'COMPETITIVE SCORECARD' }),
        React.createElement('div', { className: 'grid grid-cols-[160px_1fr] gap-1 ml-2' },
          React.createElement('span', { className: 'text-zinc-400' }, 'Total Points Earned:'),
          React.createElement('span', { className: 'text-emerald-400 font-bold' }, `${progress.totalScore} PTS`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Challenges Solved:'),
          React.createElement('span', { className: 'text-cyan-400 font-bold' }, `${progress.solvedCount}`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Total Submissions:'),
          React.createElement('span', { className: 'text-zinc-200' }, `${progress.attemptedCount}`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Accuracy Ratio:'),
          React.createElement('span', { className: 'text-amber-400 font-bold' }, `${accuracy}%`),

          React.createElement('span', { className: 'text-zinc-400' }, 'Arenas Entered:'),
          React.createElement('span', { className: 'text-fuchsia-400 font-bold' }, `${progress.gamesPlayed}`)
        )
      );
    } catch {
      return React.createElement(TerminalSuccess, null, 'Opening verified scorecard...');
    }
  }
};

export const historyCommand: CommandDefinition = {
  name: 'history',
  aliases: ['sessions', 'log'],
  category: 'profile',
  description: 'Show your arena session and challenge participation history',
  usage: 'history',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('history');
    try {
      const response = await api.get('/workspace/student');
      const { sessions } = response.data;

      if (!sessions || sessions.length === 0) {
        return React.createElement('div', { className: 'font-mono text-xs' },
          React.createElement(TerminalSection, { title: 'SESSION PARTICIPATION HISTORY' }),
          React.createElement('div', { className: 'text-zinc-400 ml-2 my-1' }, 
            'No session records found yet. Join a battle with: battle -c <ROOMCODE>'
          )
        );
      }

      const rows = sessions.map((s: any) => [
        s.roomCode,
        s.eventName,
        s.gameName,
        s.status,
        new Date(s.joinedAt).toLocaleTimeString()
      ]);
      
      return React.createElement('div', { className: 'font-mono text-xs' },
        React.createElement(TerminalSection, { title: 'SESSION PARTICIPATION HISTORY' }),
        React.createElement(TerminalTable, { 
          headers: ['ROOM', 'EVENT', 'GAME', 'STATUS', 'JOINED'], 
          rows 
        })
      );
    } catch {
      return React.createElement(TerminalSuccess, null, 'Opening participation history...');
    }
  }
};

export const wonCommand: CommandDefinition = {
  name: 'won',
  aliases: ['wins', 'victories', 'achievements'],
  category: 'profile',
  description: 'Inspect tournament victories, achievements, and milestone badges',
  usage: 'won',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('won');
    try {
      const response = await api.get('/workspace/student');
      const { progress, sessions } = response.data;
      const victories = sessions?.filter((s: any) => s.status === 'COMPLETED' || s.status === 'FINISHED') || [];

      return React.createElement('div', { className: 'font-mono text-xs' },
        React.createElement(TerminalSection, { title: 'VICTORIES & ACHIEVEMENTS' }),
        React.createElement('div', { className: 'ml-2 space-y-1' },
          React.createElement('div', null,
            React.createElement('span', { className: 'text-zinc-400' }, 'Arena Victories: '),
            React.createElement('span', { className: 'text-amber-400 font-bold' }, `${victories.length} Wins`)
          ),
          React.createElement('div', null,
            React.createElement('span', { className: 'text-zinc-400' }, 'Challenges Solved: '),
            React.createElement('span', { className: 'text-cyan-400 font-bold' }, `${progress.solvedCount}`)
          ),
          React.createElement('div', null,
            React.createElement('span', { className: 'text-zinc-400' }, 'Score Milestone: '),
            React.createElement('span', { className: 'text-emerald-400 font-bold' }, `${progress.totalScore} PTS`)
          ),
          React.createElement('div', { className: 'text-[11px] text-zinc-500 pt-1' },
            'Interactive achievements and medals opened in side panel.'
          )
        )
      );
    } catch {
      return React.createElement(TerminalSuccess, null, 'Opening victories and achievements panel...');
    }
  }
};

export function registerProfileCommands() {
  commandRegistry.register(whoamiCommand);
  commandRegistry.register(scorecardCommand);
  commandRegistry.register(historyCommand);
  commandRegistry.register(wonCommand);
}
