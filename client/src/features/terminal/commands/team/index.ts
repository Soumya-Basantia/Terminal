import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalText, TerminalSuccess, TerminalError } from '../../components/outputs';

export const teamCommand: CommandDefinition = {
  name: 'team',
  category: 'team',
  description: 'Team management',
  usage: 'team [options]\nteam info\nteam leave',
  options: {
    '-c, --create <name>': 'Create a new team',
    '-j, --join <name>': 'Join an existing team'
  },
  examples: [
    'team',
    'team -c "Bug Busters"',
    'team -j "Phoenix"',
    'team leave',
    'team info'
  ],
  execute: (args, flags, ctx) => {
    ctx.openPanel?.('team');
    if (args[0] === 'leave') {
      return React.createElement(TerminalSuccess, null, 'Left team.');
    }
    if (args[0] === 'info') {
      return React.createElement(TerminalSection, { title: 'TEAM INFO' });
    }
    
    if (flags['c'] || flags['create']) {
      const name = flags['c'] || flags['create'];
      return React.createElement(TerminalSuccess, null, `Created and joined team: ${name}`);
    }
    
    if (flags['j'] || flags['join']) {
      const name = flags['j'] || flags['join'];
      return React.createElement(TerminalSuccess, null, `Joined team: ${name}`);
    }

    // Default `team` command
    return React.createElement('div', { className: 'font-mono' },
      React.createElement(TerminalSection, { title: 'TEAM STATUS' }),
      React.createElement(TerminalText, { className: 'text-zinc-300', children: 'You are not currently in a team.' }),
      React.createElement('div', { className: 'mt-4 text-zinc-500' }, 'Available:'),
      React.createElement('div', { className: 'ml-4 text-cyan-400' }, 'team -c "Team Name"'),
      React.createElement('div', { className: 'ml-4 text-cyan-400' }, 'team -j "Team Name"')
    );
  }
};

export const collabCommand: CommandDefinition = {
  name: 'collab',
  category: 'team',
  description: 'Collaboration requests',
  usage: 'collab <username>',
  examples: ['collab rahul'],
  execute: (args, _flags, ctx) => {
    if (args.length === 0) {
      return React.createElement(TerminalError, null, 'Usage: collab <username>');
    }
    const target = args[0];
    ctx.openPanel?.('collab', { target });
    return React.createElement(TerminalSuccess, null, `Collaboration request sent to ${target}.`);
  }
};

export function registerTeamCommands() {
  commandRegistry.register(teamCommand);
  commandRegistry.register(collabCommand);
}
