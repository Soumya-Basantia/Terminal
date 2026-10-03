import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalTable, TerminalError } from '../../components/outputs';
import api from '../../../../lib/api';

export const whoamiCommand: CommandDefinition = {
  name: 'whoami',
  aliases: ['username', 'id'],
  category: 'profile',
  description: 'Show your student identity and workspace profile',
  usage: 'whoami',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('whoami');
    try {
      const response = await api.get('/workspace/student');
      const { student, progress } = response.data;
      
      const role = student.role === 'GAME_MASTER' ? 'Game Master' : student.role === 'ADMIN' ? 'Root Admin' : 'Student (Player)';

      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'STUDENT IDENTITY' }),
        React.createElement('div', { className: 'grid grid-cols-[140px_1fr] gap-1 ml-2' },
          React.createElement('span', { className: 'text-zinc-400' }, 'Name:'),
          React.createElement('span', { className: 'text-cyan-400 font-bold' }, student.name),

          React.createElement('span', { className: 'text-zinc-400' }, 'USN:'),
          React.createElement('span', { className: 'text-emerald-400 font-bold' }, student.usn),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Email:'),
          React.createElement('span', { className: 'text-zinc-200' }, student.email),

          React.createElement('span', { className: 'text-zinc-400' }, 'Branch:'),
          React.createElement('span', { className: 'text-zinc-200' }, student.branch),

          React.createElement('span', { className: 'text-zinc-400' }, 'Section:'),
          React.createElement('span', { className: 'text-zinc-200' }, student.section),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Role:'),
          React.createElement('span', { className: 'text-zinc-200' }, role),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Status:'),
          React.createElement('span', { className: 'text-emerald-400' }, 'Online (Authorized)'),

          React.createElement('span', { className: 'text-zinc-400 mt-2' }, 'Total Score:'),
          React.createElement('span', { className: 'text-cyan-400 font-bold mt-2' }, `${progress.totalScore} PTS`)
        ),
        React.createElement('div', { className: 'mt-4 text-zinc-500 text-xs' }, 'STUDENT ID'),
        React.createElement('div', { className: 'text-zinc-600 text-xs' }, student.id)
      );
    } catch {
      try {
        const fallback = await api.get('/auth/me');
        const user = fallback.data.user;
        return React.createElement('div', { className: 'font-mono' },
          React.createElement(TerminalSection, { title: 'STUDENT IDENTITY' }),
          React.createElement('div', { className: 'grid grid-cols-[140px_1fr] gap-1 ml-2' },
            React.createElement('span', { className: 'text-zinc-400' }, 'Name:'),
            React.createElement('span', { className: 'text-cyan-400' }, user.name || user.username),
            React.createElement('span', { className: 'text-zinc-400' }, 'USN:'),
            React.createElement('span', { className: 'text-emerald-400' }, user.usn || 'N/A'),
            React.createElement('span', { className: 'text-zinc-400' }, 'Email:'),
            React.createElement('span', { className: 'text-zinc-200' }, user.email)
          )
        );
      } catch {
        return React.createElement(TerminalError, null, 'Failed to fetch user profile.');
      }
    }
  }
};

export const scorecardCommand: CommandDefinition = {
  name: 'scorecard',
  category: 'profile',
  description: 'Show your verified score and game progress',
  usage: 'scorecard',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('scorecard');
    try {
      const response = await api.get('/workspace/student');
      const { student, progress } = response.data;

      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'STUDENT PROGRESS & SCORECARD' }),
        React.createElement('div', { className: 'grid grid-cols-[180px_1fr] gap-1 ml-2' },
          React.createElement('span', { className: 'text-zinc-400' }, 'Student:'),
          React.createElement('span', { className: 'text-cyan-400 font-bold' }, `${student.name} (${student.usn})`),

          React.createElement('span', { className: 'text-zinc-400' }, 'Branch / Section:'),
          React.createElement('span', { className: 'text-zinc-200' }, `${student.branch} - Sec ${student.section}`),
          
          React.createElement('span', { className: 'text-zinc-400 mt-3' }, 'Total Points Earned:'),
          React.createElement('span', { className: 'text-emerald-400 font-bold text-lg mt-3' }, `${progress.totalScore} PTS`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Challenges Solved:'),
          React.createElement('span', { className: 'text-cyan-400 font-bold' }, `${progress.solvedCount}`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Total Attempts:'),
          React.createElement('span', { className: 'text-zinc-200' }, `${progress.attemptedCount}`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Sessions Participated:'),
          React.createElement('span', { className: 'text-amber-400 font-bold' }, `${progress.gamesPlayed}`)
        )
      );
    } catch {
      return React.createElement(TerminalError, null, 'Failed to fetch verified scorecard.');
    }
  }
};

export const historyCommand: CommandDefinition = {
  name: 'history',
  category: 'profile',
  description: 'Show your session and challenge participation history',
  usage: 'history',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('history');
    try {
      const response = await api.get('/workspace/student');
      const { sessions } = response.data;

      if (!sessions || sessions.length === 0) {
        return React.createElement('div', { className: 'font-mono' },
          React.createElement(TerminalSection, { title: 'PARTICIPATION HISTORY' }),
          React.createElement('div', { className: 'text-zinc-400 ml-2 my-2' }, 'No session history found yet. Join a battle with `battle <code>`!')
        );
      }

      const rows = sessions.map((s: any) => [
        s.roomCode,
        s.eventName,
        s.gameName,
        s.status,
        new Date(s.joinedAt).toLocaleTimeString()
      ]);
      
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'PARTICIPATION HISTORY' }),
        React.createElement(TerminalTable, { 
          headers: ['ROOM CODE', 'EVENT', 'GAME', 'STATUS', 'JOINED'], 
          rows 
        })
      );
    } catch {
      return React.createElement(TerminalError, null, 'Failed to fetch participation history.');
    }
  }
};

export function registerProfileCommands() {
  commandRegistry.register(whoamiCommand);
  commandRegistry.register(scorecardCommand);
  commandRegistry.register(historyCommand);
}
