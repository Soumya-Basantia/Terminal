import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalText, TerminalError, TerminalSuccess } from '../../components/outputs';
import { BattleLobby } from './BattleLobby';

export const battleCommand: CommandDefinition = {
  name: 'battle',
  aliases: ['play', 'join'],
  category: 'battle',
  description: 'Join a live multiplayer combat arena session',
  usage: 'battle -c <ROOMCODE>',
  options: {
    '-c, --code <ROOMCODE>': 'Specify the 4-8 character room access code'
  },
  examples: ['battle -c J62S3', 'battle WITNZ'],
  execute: (args, flags, ctx) => {
    // Robustly extract room code from flags (-c, --code) or first positional argument
    const rawCode = flags['c'] || flags['code'] || args[0];
    
    if (!rawCode || typeof rawCode !== 'string') {
      return React.createElement('div', { className: 'font-mono text-xs my-1' },
        React.createElement(TerminalError, null, 'Missing room access code.'),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase text-[10px] tracking-widest' }, 'Usage:'),
        React.createElement('div', { className: 'ml-3 text-cyan-300 font-bold' }, 'battle -c <ROOMCODE>'),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase text-[10px] tracking-widest' }, 'Example:'),
        React.createElement('div', { className: 'ml-3 text-emerald-400 font-bold' }, 'battle -c J62S3'),
        React.createElement('div', { className: 'mt-2 text-zinc-500 text-[11px]' }, "Type 'help battle' for command options.")
      );
    }
    
    const cleanCode = rawCode.trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 10) {
      return React.createElement(TerminalError, null, `Invalid room code '${cleanCode}'. Room codes are typically 4-8 characters.`);
    }

    ctx.openPanel?.('battle', { roomCode: cleanCode });
    return React.createElement('div', { className: 'font-mono text-xs my-1' },
      React.createElement(TerminalSection, { title: `CONNECTING TO ARENA // ${cleanCode}` }),
      React.createElement(TerminalText, { className: 'text-cyan-300 font-bold ml-2', children: `Connecting student socket to room: ${cleanCode}...` }),
      React.createElement(TerminalText, { className: 'text-zinc-500 text-[11px] ml-2', children: 'Arena lobby opened in side panel.' })
    );
  }
};

export function registerBattleCommands() {
  commandRegistry.register(battleCommand);
}
