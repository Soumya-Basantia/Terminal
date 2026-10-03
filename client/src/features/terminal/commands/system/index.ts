import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalText, TerminalSuccess, TerminalError } from '../../components/outputs';
import api from '../../../../lib/api';

export const helpCommand: CommandDefinition = {
  name: 'help',
  aliases: ['h'],
  category: 'system',
  description: 'Show available commands',
  usage: 'help [command]',
  examples: ['help', 'help battle'],
  execute: (args, _flags, ctx) => {
    if (args.length > 0) {
      const target = args[0];
      const cmd = commandRegistry.getCommand(target);
      if (!cmd) {
        return React.createElement(TerminalError, { children: `Command '${target}' not found.` });
      }
      return React.createElement('div', { className: 'flex flex-col gap-2 my-2 font-mono' },
        React.createElement(TerminalSection, { title: cmd.name.toUpperCase() }),
        React.createElement(TerminalText, { children: cmd.description }),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase tracking-widest text-xs' }, 'Usage'),
        React.createElement(TerminalText, { className: 'ml-4', children: cmd.usage }),
        cmd.aliases && cmd.aliases.length > 0 && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase tracking-widest text-xs' }, 'Aliases'),
          React.createElement(TerminalText, { className: 'ml-4', children: cmd.aliases.join(', ') })
        ),
        cmd.options && Object.keys(cmd.options).length > 0 && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase tracking-widest text-xs' }, 'Options'),
          Object.entries(cmd.options).map(([opt, desc]) => 
            React.createElement('div', { key: opt, className: 'ml-4 flex gap-4' },
              React.createElement('span', { className: 'text-cyan-400' }, opt),
              React.createElement('span', { className: 'text-zinc-300' }, desc)
            )
          )
        ),
        cmd.examples && cmd.examples.length > 0 && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase tracking-widest text-xs' }, 'Examples'),
          cmd.examples.map(ex => React.createElement(TerminalText, { key: ex, className: 'ml-4', children: ex }))
        )
      );
    }

    ctx.openPanel?.('help');
    const commands = commandRegistry.getAllCommands();
    const categories: Record<string, CommandDefinition[]> = {
      system: [],
      profile: [],
      battle: [],
      team: []
    };

    commands.forEach(cmd => {
      if (categories[cmd.category]) {
        categories[cmd.category].push(cmd);
      }
    });

      return React.createElement('div', { className: 'flex flex-col gap-4 my-2 font-mono' },
        React.createElement(TerminalText, { className: 'font-bold text-cyan-400', children: 'TERMINAL COMMANDS' }),
        React.createElement(TerminalText, { className: 'text-zinc-500', children: '────────────────────────────────────────' }),
      Object.entries(categories).map(([cat, cmds]) => {
        if (cmds.length === 0) return null;
        return React.createElement('div', { key: cat, className: 'mb-4' },
          React.createElement(TerminalText, { className: 'uppercase font-bold text-zinc-200 mb-1 tracking-widest', children: cat }),
          cmds.map(c => 
            React.createElement('div', { key: c.name, className: 'flex ml-2' },
              React.createElement('div', { className: 'w-48 text-cyan-400' }, c.usage.split('\n')[0]),
              React.createElement('div', { className: 'text-zinc-400' }, c.description)
            )
          )
        );
      }),
      React.createElement('div', { className: 'mt-4' },
        React.createElement(TerminalText, { children: 'Type:' }),
        React.createElement(TerminalText, { className: 'ml-4 my-1 text-cyan-400', children: 'help <command>' }),
        React.createElement(TerminalText, { children: 'for detailed information.' })
      )
    );
  }
};

export const clearCommand: CommandDefinition = {
  name: 'clear',
  aliases: ['cls'],
  category: 'system',
  description: 'Clear terminal output',
  usage: 'clear',
  execute: (_args, _flags, ctx) => {
    ctx.clearTerminal();
    ctx.closePanel?.();
    return null; // Return nothing, clear handles the state
  }
};

export const statusCommand: CommandDefinition = {
  name: 'status',
  category: 'system',
  description: 'Show current system and workspace status',
  usage: 'status',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('status');
    try {
      const response = await api.get('/workspace/student');
      const { student, progress } = response.data;
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'WORKSPACE STATUS' }),
        React.createElement('div', { className: 'grid grid-cols-[140px_1fr] gap-1 ml-2' },
          React.createElement('span', { className: 'text-zinc-400' }, 'Student:'),
          React.createElement('span', { className: 'text-cyan-400 font-bold' }, `${student.name} (${student.usn})`),

          React.createElement('span', { className: 'text-zinc-400' }, 'Academic:'),
          React.createElement('span', { className: 'text-zinc-200' }, `${student.branch} - Section ${student.section}`),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Authorization:'),
          React.createElement('span', { className: 'text-emerald-400 font-bold' }, 'ONLINE / VERIFIED'),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Progress:'),
          React.createElement('span', { className: 'text-zinc-200 font-bold' }, `${progress.totalScore} PTS | ${progress.solvedCount} Solved`),
          
          React.createElement('span', { className: 'text-zinc-400 mt-2' }, 'Terminal:'),
          React.createElement('span', { className: 'text-zinc-500 mt-2' }, 'v3.0.0')
        )
      );
    } catch {
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalSection, { title: 'SYSTEM STATUS' }),
        React.createElement('div', { className: 'grid grid-cols-[120px_1fr] gap-1 ml-2' },
          React.createElement('span', { className: 'text-zinc-400' }, 'User:'),
          React.createElement('span', { className: 'text-zinc-200' }, ctx.username),
          
          React.createElement('span', { className: 'text-zinc-400' }, 'Connection:'),
          React.createElement('span', { className: 'text-emerald-400' }, 'Online'),
          
          React.createElement('span', { className: 'text-zinc-400 mt-2' }, 'Terminal:'),
          React.createElement('span', { className: 'text-zinc-500 mt-2' }, 'v3.0.0')
        )
      );
    }
  }
};

export const exitCommand: CommandDefinition = {
  name: 'exit',
  category: 'system',
  description: 'Log out of TERMINAL',
  usage: 'exit',
  execute: (_args, _flags, ctx) => {
    return React.createElement(function ExitPrompt() {
      const [status, setStatus] = React.useState<'prompt' | 'exiting' | 'cancelled'>('prompt');
      
      if (status === 'exiting') {
        return React.createElement(TerminalText, null, 'Disconnecting... logging out.');
      }
      if (status === 'cancelled') {
        return React.createElement(TerminalText, null, 'Exit cancelled.');
      }
      
      return React.createElement('div', { className: 'font-mono' },
        React.createElement(TerminalText, { className: 'mb-4', children: 'Are you sure you want to exit?' }),
        React.createElement('div', { className: 'flex flex-col gap-2' },
          React.createElement('button', { 
            className: 'text-left hover:text-cyan-400 focus:outline-none focus:text-cyan-400 w-max cursor-pointer',
            onClick: () => {
              setStatus('exiting');
              if (ctx.logout) setTimeout(() => ctx.logout!(), 800);
            }
          }, '[Y] Yes'),
          React.createElement('button', {
            className: 'text-left hover:text-cyan-400 focus:outline-none focus:text-cyan-400 w-max cursor-pointer',
            onClick: () => setStatus('cancelled')
          }, '[N] No')
        )
      );
    });
  }
};

export const terminalCommand: CommandDefinition = {
  name: 'terminal',
  aliases: ['home', 'main', 'welcome'],
  category: 'system',
  description: 'Return to the main Welcome Terminal screen from any panel',
  usage: 'terminal',
  execute: (_args, _flags, ctx) => {
    ctx.closePanel?.();
    return React.createElement(TerminalSuccess, null, 'Returned to main terminal workspace.');
  }
};

export function registerSystemCommands() {
  commandRegistry.register(terminalCommand);
  commandRegistry.register(helpCommand);
  commandRegistry.register(clearCommand);
  commandRegistry.register(statusCommand);
  commandRegistry.register(exitCommand);
}
