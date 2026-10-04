import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalText, TerminalError, TerminalSuccess } from '../../components/outputs';
import api from '../../../../lib/api';

export const helpCommand: CommandDefinition = {
  name: 'help',
  aliases: ['h', 'man'],
  category: 'system',
  description: 'Show complete command manual and system instructions',
  usage: 'help [command]',
  examples: ['help', 'help battle', 'help collab'],
  execute: (args, _flags, ctx) => {
    if (args.length > 0) {
      const target = args[0].toLowerCase();
      const cmd = commandRegistry.getCommand(target);
      if (!cmd) {
        return React.createElement(TerminalError, { children: `Command '${target}' not found.` });
      }
      return React.createElement('div', { className: 'flex flex-col gap-2 my-2 font-mono text-xs' },
        React.createElement(TerminalSection, { title: cmd.name.toUpperCase() }),
        React.createElement(TerminalText, { children: cmd.description }),
        React.createElement('div', { className: 'mt-2 text-zinc-400 uppercase tracking-widest text-[11px]' }, 'Usage:'),
        React.createElement(TerminalText, { className: 'ml-3 text-cyan-300 font-bold', children: cmd.usage }),
        cmd.aliases && cmd.aliases.length > 0 && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'mt-1 text-zinc-400 uppercase tracking-widest text-[11px]' }, 'Aliases:'),
          React.createElement(TerminalText, { className: 'ml-3 text-zinc-300', children: cmd.aliases.join(', ') })
        ),
        cmd.examples && cmd.examples.length > 0 && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'mt-1 text-zinc-400 uppercase tracking-widest text-[11px]' }, 'Examples:'),
          cmd.examples.map(ex => React.createElement(TerminalText, { key: ex, className: 'ml-3 text-emerald-400', children: ex }))
        )
      );
    }

    ctx.openPanel?.('help');

    // Supported Student Terminal Commands
    const manualList = [
      { cmd: 'help', usage: 'help [cmd]', desc: 'Display complete command manual' },
      { cmd: 'whoami', usage: 'whoami', desc: 'Display student identity, USN, academic stream & security level' },
      { cmd: 'scorecard', usage: 'scorecard', desc: 'View verified points, accuracy ratio, and challenge solve count' },
      { cmd: 'history', usage: 'history', desc: 'Inspect session and arena participation history' },
      { cmd: 'won', usage: 'won', desc: 'Inspect arena victories, achievements, and milestone badges' },
      { cmd: 'team', usage: 'team [-c|-j <name>]', desc: 'Manage battle squad, establish or join a team' },
      { cmd: 'collab', usage: 'collab [username]', desc: 'Dispatch peer collaboration invite or view network' },
      { cmd: 'collab requests', usage: 'collab requests', desc: 'View and manage incoming/outgoing collaboration requests' },
      { cmd: 'messages', usage: 'messages', desc: 'Access encrypted direct transmissions from administrators' },
      { cmd: 'inbox', usage: 'inbox', desc: 'View notifications, requests, and system alerts' },
      { cmd: 'battle', usage: 'battle -c <ROOMCODE>', desc: 'Join a live multiplayer combat arena session' }
    ];

    return React.createElement('div', { className: 'flex flex-col gap-2 my-2 font-mono text-xs' },
      React.createElement(TerminalSection, { title: 'TERMINAL COMMAND MANUAL' }),
      React.createElement('div', { className: 'space-y-1.5 ml-2 mt-1' },
        manualList.map(item =>
          React.createElement('div', { key: item.cmd, className: 'grid grid-cols-[190px_1fr] gap-2 items-baseline' },
            React.createElement('span', { className: 'text-cyan-400 font-bold' }, item.usage),
            React.createElement('span', { className: 'text-zinc-400 text-[11px]' }, item.desc)
          )
        )
      ),
      React.createElement('div', { className: 'mt-3 pt-2 border-t border-zinc-800 text-[11px] text-zinc-500' },
        React.createElement('span', null, 'Type any command to open its visual telemetry module. Press '),
        React.createElement('kbd', { className: 'px-1 py-0.2 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]' }, 'Esc'),
        React.createElement('span', null, ' to return to full terminal width.')
      )
    );
  }
};

export const exitCommand: CommandDefinition = {
  name: 'exit',
  aliases: ['logout', 'quit'],
  category: 'system',
  description: 'Log out of TERMINAL session',
  usage: 'exit',
  execute: (_args, _flags, ctx) => {
    return React.createElement(function ExitPrompt() {
      const [status, setStatus] = React.useState<'prompt' | 'exiting' | 'cancelled'>('prompt');
      
      if (status === 'exiting') {
        return React.createElement(TerminalText, null, 'Disconnecting student node... logging out.');
      }
      if (status === 'cancelled') {
        return React.createElement(TerminalText, null, 'Exit aborted. Session remains active.');
      }
      
      return React.createElement('div', { className: 'font-mono text-xs my-2' },
        React.createElement(TerminalText, { className: 'mb-2 text-amber-300 font-bold', children: 'Terminate active session and log out of TERMINAL?' }),
        React.createElement('div', { className: 'flex items-center gap-4 ml-2' },
          React.createElement('button', { 
            className: 'px-3 py-1 bg-red-950 border border-red-500 text-red-300 hover:bg-red-900 cursor-pointer font-bold',
            onClick: () => {
              setStatus('exiting');
              if (ctx.logout) setTimeout(() => ctx.logout!(), 600);
            }
          }, '[Y] Yes, Log Out'),
          React.createElement('button', {
            className: 'px-3 py-1 bg-zinc-800 border border-zinc-600 text-zinc-200 hover:bg-zinc-700 cursor-pointer font-bold',
            onClick: () => setStatus('cancelled')
          }, '[N] Cancel')
        )
      );
    });
  }
};

export const messagesCommand: CommandDefinition = {
  name: 'messages',
  aliases: ['msg'],
  category: 'system',
  description: 'Inspect direct transmissions and administrator messages',
  usage: 'messages',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('messages');
    try {
      const res = await api.get('/messages');
      const list = res.data.received || [];
      const unread = list.filter((m: any) => !m.isRead).length;

      return React.createElement('div', { className: 'font-mono text-xs' },
        React.createElement(TerminalSection, { title: 'DIRECT MESSAGES' }),
        React.createElement('div', { className: 'ml-2' },
          React.createElement('span', { className: 'text-zinc-400' }, 'Incoming transmissions: '),
          React.createElement('span', { className: 'text-cyan-400 font-bold' }, `${list.length} received`),
          React.createElement('span', { className: 'text-zinc-500' }, ' • '),
          React.createElement('span', { className: 'text-amber-400 font-bold' }, `${unread} unread`),
          React.createElement('div', { className: 'text-zinc-500 text-[11px] mt-1' }, 'Transmissions console opened in side panel.')
        )
      );
    } catch {
      return React.createElement(TerminalSuccess, null, 'Opening direct messages console...');
    }
  }
};

export const inboxCommand: CommandDefinition = {
  name: 'inbox',
  aliases: ['notifications', 'notices'],
  category: 'system',
  description: 'Inspect centralized notification & request inbox',
  usage: 'inbox',
  execute: async (_args, _flags, ctx) => {
    ctx.openPanel?.('inbox');
    return React.createElement('div', { className: 'font-mono text-xs' },
      React.createElement(TerminalSection, { title: 'NOTIFICATION INBOX' }),
      React.createElement('div', { className: 'text-zinc-400 ml-2' },
        'Opening notification and request dispatch queue...'
      )
    );
  }
};

export function registerSystemCommands() {
  commandRegistry.register(helpCommand);
  commandRegistry.register(messagesCommand);
  commandRegistry.register(inboxCommand);
  commandRegistry.register(exitCommand);
}
