import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalText, TerminalError, TerminalSuccess } from '../../components/outputs';
import { BattleLobby } from './BattleLobby';
import api from '../../../../lib/api';

export const gamesCommand: CommandDefinition = {
  name: 'games',
  category: 'battle',
  description: 'Show available games and tournament events',
  usage: 'games',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('games');
    try {
      const response = await api.get('/workspace/student');
      const { games, events } = response.data;

      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'AVAILABLE PLATFORM GAMES' }),
        React.createElement('div', { className: 'flex flex-col gap-3 my-2 ml-2' },
          games.length > 0 ? games.map((g: any) => (
            React.createElement('div', { key: g.id, className: 'border-l-2 border-cyan-500 pl-3' },
              React.createElement('div', { className: 'text-cyan-400 font-bold' }, `${g.name} [${g.template}]`),
              React.createElement('div', { className: 'text-zinc-400 text-xs' }, g.description),
              React.createElement('div', { className: 'text-emerald-400 text-xs' }, `Status: PUBLISHED • ${g.challengeCount} Challenges`)
            )
          )) : (
            React.createElement('div', { className: 'text-zinc-500' }, 'No standalone games currently published.')
          )
        ),

        React.createElement(TerminalSection, { title: 'TOURNAMENT EVENTS' }),
        React.createElement('div', { className: 'flex flex-col gap-2 my-2 ml-2' },
          events.length > 0 ? events.map((e: any) => (
            React.createElement('div', { key: e.id, className: 'border-l-2 border-emerald-500 pl-3' },
              React.createElement('div', { className: 'text-emerald-400 font-bold' }, e.name),
              React.createElement('div', { className: 'text-zinc-400 text-xs' }, e.description),
              React.createElement('div', { className: 'text-zinc-500 text-xs' }, `Mode: ${e.mode}`)
            )
          )) : (
            React.createElement('div', { className: 'text-zinc-500' }, 'No active tournament events.')
          )
        ),

        React.createElement('div', { className: 'mt-4 text-xs text-zinc-500' }, 'Join an active room with: battle <code>')
      );
    } catch {
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'AVAILABLE BATTLES' }),
        React.createElement('div', { className: 'mb-4 ml-2' },
          React.createElement('div', { className: 'text-cyan-400 font-bold' }, 'Campus Cyber Arena'),
          React.createElement('div', { className: 'text-zinc-400' }, 'Status: ONLINE')
        )
      );
    }
  }
};

export const eventsCommand: CommandDefinition = {
  name: 'events',
  aliases: ['tournaments'],
  category: 'battle',
  description: 'Show active tournament events',
  usage: 'events',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('events');
    try {
      const response = await api.get('/workspace/student');
      const { events } = response.data;

      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'TOURNAMENT EVENTS' }),
        React.createElement('div', { className: 'flex flex-col gap-2 my-2 ml-2' },
          events && events.length > 0 ? events.map((e: any) => (
            React.createElement('div', { key: e.id, className: 'border-l-2 border-emerald-500 pl-3' },
              React.createElement('div', { className: 'text-emerald-400 font-bold' }, e.name),
              React.createElement('div', { className: 'text-zinc-400 text-xs' }, e.description),
              React.createElement('div', { className: 'text-zinc-500 text-xs' }, `Mode: ${e.mode}`)
            )
          )) : (
            React.createElement('div', { className: 'text-zinc-500' }, 'No active tournament events.')
          )
        )
      );
    } catch {
      return React.createElement(TerminalError, null, 'Failed to fetch events.');
    }
  }
};

export const battleCommand: CommandDefinition = {
  name: 'battle',
  aliases: ['play', 'join'],
  category: 'battle',
  description: 'Join a battle',
  usage: 'battle <code>',
  examples: ['battle G7K29', 'battle -c G7K29'],
  execute: (args, flags, ctx) => {
    // Keep support for -c just in case, but prefer args[0]
    const code = args[0] || flags['c'] || flags['code'];
    
    if (!code || typeof code !== 'string') {
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalError, null, 'Missing room code.'),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase text-xs tracking-widest' }, 'Usage:'),
        React.createElement('div', { className: 'ml-4 text-zinc-300' }, 'battle <code>'),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase text-xs tracking-widest' }, 'Example:'),
        React.createElement('div', { className: 'ml-4 text-zinc-300' }, 'battle G7K29'),
        React.createElement('div', { className: 'mt-2 text-zinc-500' }, "Type 'help battle' for more information.")
      );
    }
    
    ctx.openPanel?.('battle', { roomCode: code });
    return React.createElement(BattleLobby, { roomCode: code as string });
  }
};

export const roomCommand: CommandDefinition = {
  name: 'room',
  category: 'battle',
  description: 'Show current room',
  usage: 'room',
  execute: () => {
    return React.createElement('div', { className: 'font-mono' },
      React.createElement(TerminalSection, { title: 'CURRENT ROOM' }),
      React.createElement(TerminalText, { className: 'text-zinc-500', children: 'You are currently mocking a room connection.' }),
      React.createElement(TerminalText, { className: 'mt-2 text-zinc-300', children: 'Run `battle -c <code>` to simulate joining.' })
    );
  }
};

export const leaderboardCommand: CommandDefinition = {
  name: 'leaderboard',
  category: 'battle',
  description: 'Show current leaderboard',
  usage: 'leaderboard',
  execute: () => {
    return React.createElement('div', { className: 'font-mono' },
      React.createElement(TerminalSection, { title: 'LEADERBOARD' }),
      React.createElement(TerminalText, { className: 'text-zinc-500', children: 'Waiting for game engine integration.' })
    );
  }
};

export const submitCommand: CommandDefinition = {
  name: 'submit',
  category: 'battle',
  description: 'Submit an answer to the active question',
  usage: 'submit <answer>',
  execute: async (args, flags, ctx) => {
    let answer = args.join(' ');
    
    if (!answer) {
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalError, null, 'Missing answer.'),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase text-xs tracking-widest' }, 'Usage:'),
        React.createElement('div', { className: 'ml-4 text-zinc-300' }, 'submit <answer>')
      );
    }
    
    try {
      const { api } = await import('../../../../lib/api');
      const res = await api.post('/sessions/active/submit', { answer });
      const { isChainReaction, isCorrect, pointsAwarded } = res.data;
      
      if (isChainReaction) {
        if (isCorrect) {
          return React.createElement('div', { className: 'font-mono' },
            React.createElement(TerminalSuccess, null, '✓ CORRECT - ACCESS GRANTED'),
            React.createElement('div', { className: 'mt-2 text-amber-400 font-bold' }, `+${pointsAwarded} POINTS`),
            React.createElement('div', { className: 'mt-2 text-cyan-400 animate-pulse' }, 'CHAIN UNLOCKED. NEXT NODE AVAILABLE.')
          );
        } else {
          return React.createElement('div', { className: 'font-mono' },
            React.createElement(TerminalError, null, '✗ INCORRECT'),
            React.createElement('div', { className: 'mt-2 text-zinc-300' }, 'ACCESS DENIED. TRY AGAIN.')
          );
        }
      }

      if (res.data.isRapidFire) {
        return React.createElement('div', { className: 'font-mono' },
          React.createElement(TerminalSuccess, null, '✓ ANSWER LOCKED'),
          res.data.pointsAwarded > 0 
            ? React.createElement('div', { className: 'mt-2 text-emerald-400 font-bold' }, `+${res.data.pointsAwarded} POINTS`)
            : null,
          res.data.streak > 1
            ? React.createElement('div', { className: 'mt-2 text-amber-500 font-bold animate-pulse' }, `STREAK: ${res.data.streak} 🔥`)
            : null
        );
      }

      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSuccess, null, 'Answer submitted successfully.'),
        React.createElement('div', { className: 'mt-2 text-zinc-300' }, 'Wait for the game master to reveal the results.')
      );
    } catch (err: any) {
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalError, null, err.response?.data?.error || err.message || 'Submission failed')
      );
    }
  }
};

export function registerBattleCommands() {
  commandRegistry.register(gamesCommand);
  commandRegistry.register(eventsCommand);
  commandRegistry.register(battleCommand);
  commandRegistry.register(roomCommand);
  commandRegistry.register(leaderboardCommand);
  commandRegistry.register(submitCommand);
}
