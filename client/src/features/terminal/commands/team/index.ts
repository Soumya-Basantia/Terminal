import type { CommandDefinition } from '../../core/types';
import { commandRegistry } from '../../core/registry';
import React from 'react';
import { TerminalSection, TerminalText, TerminalSuccess, TerminalError } from '../../components/outputs';
import api from '../../../../lib/api';

function cleanHandle(h: string): string {
  return h.trim().replace(/^["']|["']$/g, '').replace(/@terminal$/i, '').replace(/^@/, '');
}

export const teamCommand: CommandDefinition = {
  name: 'team',
  aliases: ['squad'],
  category: 'team',
  description: 'Manage tournament battle squads, invitations, and team operations',
  usage: 'team [subcommand]\nteam create "Team Name"\nteam -j "Team Name"\nteam invite <handle>\nteam requests\nteam accept\nteam reject\nteam chat\nteam leave\nteam kick <handle>\nteam disband',
  examples: [
    'team',
    'team create "Cyber Wolves"',
    'team -j "Cyber Wolves"',
    'team invite rohan',
    'team requests',
    'team accept',
    'team reject',
    'team chat',
    'team leave',
    'team kick rohan',
    'team disband'
  ],
  execute: async (args, flags, ctx) => {
    const sub = (args[0] || '').toLowerCase();

    // ── team chat ────────────────────────────────────────────────────────
    if (sub === 'chat') {
      try {
        const res = await api.get('/teams/current');
        if (!res.data.team) {
          return React.createElement(TerminalError, null, 'You are not in a team. Join or create a team first with `team create "Name"`.');
        }
        ctx.openTeamChat?.();
        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: `TEAM CHANNEL // ${res.data.team.name.toUpperCase()}` }),
          React.createElement(TerminalText, { className: 'text-cyan-300 font-bold ml-2', children: '[TEAM] Real-time communications dock opened.' }),
          React.createElement(TerminalText, { className: 'text-zinc-500 text-[11px] ml-2', children: 'Type messages in the bottom channel. Press [ESC] to minimize.' })
        );
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to open team chat.');
      }
    }

    // ── team create "Name" ───────────────────────────────────────────────
    if (sub === 'create' || flags['c'] || flags['create']) {
      const rawName = flags['c'] || flags['create'] || args.slice(1).join(' ');
      if (!rawName || typeof rawName !== 'string') {
        return React.createElement(TerminalError, null, 'Usage: team create "Team Name"');
      }
      const name = String(rawName).replace(/^["']|["']$/g, '').trim();

      try {
        const res = await api.post('/teams/create', { name });
        ctx.openPanel?.('team');
        const team = res.data.team;
        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: 'TEAM CREATED' }),
          React.createElement('div', { className: 'ml-2 space-y-1' },
            React.createElement('div', { className: 'text-emerald-400 font-bold text-sm' }, team.name.toUpperCase()),
            React.createElement('div', { className: 'text-zinc-300' }, `Leader: ${team.leaderHandle}`),
            React.createElement('div', { className: 'text-zinc-500 text-[11px]' }, 'You are now the team leader. Use `team invite <handle>` to add members.')
          )
        );
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to create team.');
      }
    }

    // ── team -j "Name" or team join "Name" ───────────────────────────────
    if (sub === 'join' || flags['j'] || flags['join']) {
      const rawName = flags['j'] || flags['join'] || args.slice(1).join(' ');
      if (!rawName || typeof rawName !== 'string') {
        return React.createElement(TerminalError, null, 'Usage: team -j "Team Name"');
      }
      const name = String(rawName).replace(/^["']|["']$/g, '').trim();

      try {
        const res = await api.post('/teams/join', { name });
        ctx.openPanel?.('team');
        const team = res.data.team;
        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: 'TEAM JOINED' }),
          React.createElement('div', { className: 'ml-2 space-y-1' },
            React.createElement('div', { className: 'text-emerald-400 font-bold text-sm' }, team.name.toUpperCase()),
            React.createElement('div', { className: 'text-zinc-300' }, `Leader: ${team.leaderHandle}`),
            React.createElement('div', { className: 'text-cyan-300' }, `Members: ${team.membersCount}/${team.maxSize}`)
          )
        );
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to join team.');
      }
    }

    // ── team invite <handle> ─────────────────────────────────────────────
    if (sub === 'invite') {
      const handle = args[1];
      if (!handle) {
        return React.createElement(TerminalError, null, 'Usage: team invite <handle>');
      }

      try {
        const res = await api.post('/teams/invite', { handle: cleanHandle(handle) });
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        const data = err.response?.data;
        if (data?.error === 'USER_NOT_FOUND') {
          return React.createElement('div', { className: 'font-mono text-xs' },
            React.createElement(TerminalError, null, '[ERROR] USER_NOT_FOUND'),
            React.createElement('div', { className: 'ml-2 text-zinc-400' }, data.message)
          );
        }
        return React.createElement(TerminalError, null, data?.error || 'Failed to invite operative.');
      }
    }

    // ── team requests ────────────────────────────────────────────────────
    if (sub === 'requests' || sub === 'invites') {
      try {
        const res = await api.get('/teams/requests');
        const list = res.data.requests || [];

        if (list.length === 0) {
          return React.createElement('div', { className: 'font-mono text-xs my-1' },
            React.createElement(TerminalSection, { title: 'TEAM INVITATIONS' }),
            React.createElement('div', { className: 'text-zinc-400 ml-2' }, 'No pending team invitations.')
          );
        }

        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: 'TEAM INVITATIONS' }),
          React.createElement('div', { className: 'space-y-2 ml-2' },
            list.map((inv: any) =>
              React.createElement('div', { key: inv.id, className: 'border-l-2 border-cyan-500 pl-2' },
                React.createElement('div', { className: 'text-cyan-300 font-bold' }, inv.teamName.toUpperCase()),
                React.createElement('div', { className: 'text-zinc-400' }, `Leader: ${inv.leaderHandle}`),
                React.createElement('div', { className: 'text-emerald-400 text-[11px] font-bold' }, 'INVITED YOU')
              )
            ),
            React.createElement('div', { className: 'mt-2 text-zinc-500 text-[11px]' },
              "Type 'team accept' to accept invitation or 'team reject' to decline."
            )
          )
        );
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to fetch team invitations.');
      }
    }

    // ── team accept ──────────────────────────────────────────────────────
    if (sub === 'accept') {
      try {
        const res = await api.post('/teams/accept', {});
        ctx.openPanel?.('team');
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to accept team invitation.');
      }
    }

    // ── team reject ──────────────────────────────────────────────────────
    if (sub === 'reject') {
      try {
        const res = await api.post('/teams/reject', {});
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to reject invitation.');
      }
    }

    // ── team leave ───────────────────────────────────────────────────────
    if (sub === 'leave') {
      try {
        const res = await api.post('/teams/leave', {});
        ctx.openPanel?.('team');
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to leave team.');
      }
    }

    // ── team kick <handle> ───────────────────────────────────────────────
    if (sub === 'kick') {
      const handle = args[1];
      if (!handle) {
        return React.createElement(TerminalError, null, 'Usage: team kick <handle>');
      }

      try {
        const res = await api.post('/teams/kick', { handle: cleanHandle(handle) });
        ctx.openPanel?.('team');
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to kick member.');
      }
    }

    // ── team disband ─────────────────────────────────────────────────────
    if (sub === 'disband') {
      try {
        const res = await api.post('/teams/disband', {});
        ctx.openPanel?.('team');
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to disband team.');
      }
    }

    // ── team chat ─────────────────────────────────────────────────────────
    if (sub === 'chat') {
      try {
        const teamRes = await api.get('/teams/current');
        if (!teamRes.data.team) {
          return React.createElement(TerminalError, null, 'You are not currently in a team. Use `team create "Name"` or `team -j "Name"` first.');
        }
        ctx.openTeamChat?.();
        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: 'REAL-TIME TEAM CHANNEL ONLINE' }),
          React.createElement('div', { className: 'text-cyan-300 ml-2' }, `Connected to private channel for [${teamRes.data.team.name.toUpperCase()}].`),
          React.createElement('div', { className: 'text-zinc-500 text-[11px] ml-2' }, 'Bottom chat console opened. Press Esc to minimize, or transmit messages to teammates.')
        );
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to open team chat channel.');
      }
    }

    // ── Default: team (opens panel + prints live state) ──────────────────
    try {
      const res = await api.get('/teams/current');
      ctx.openPanel?.('team');
      if (res.data.team) {
        const team = res.data.team;
        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: `SQUAD MATRIX // ${team.name.toUpperCase()}` }),
          React.createElement('div', { className: 'ml-2 space-y-1' },
            React.createElement('div', { className: 'text-emerald-400 font-bold' }, `[ACTIVE SQUAD] ${team.name}`),
            React.createElement('div', { className: 'text-zinc-300' }, `Leader: ${team.leaderHandle} (${team.leaderName})`),
            React.createElement('div', { className: 'text-cyan-300' }, `Operatives: ${team.membersCount} / ${team.maxSize}`),
            React.createElement('div', { className: 'text-zinc-400 mt-1' },
              team.members.map((m: any) => `${m.handle}${m.isLeader ? ' (LEADER)' : ''} [${m.isOnline ? 'ONLINE' : 'OFFLINE'}]`).join(', ')
            ),
            React.createElement('div', { className: 'mt-2 text-zinc-500 text-[11px]' },
              "Directives: team invite <handle> • team chat • team leave • team kick <handle>"
            )
          )
        );
      } else {
        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: 'SQUAD & TEAM MATRIX' }),
          React.createElement(TerminalText, { className: 'text-zinc-400 ml-2', children: 'Status: Operating as Solo Agent (No squad membership).' }),
          React.createElement('div', { className: 'mt-2 text-zinc-500 ml-2 text-[11px]' },
            "Directives: team create \"Name\" • team -j \"Name\" • team requests"
          )
        );
      }
    } catch {
      ctx.openPanel?.('team');
      return React.createElement('div', { className: 'font-mono text-xs my-1' },
        React.createElement(TerminalSection, { title: 'SQUAD & TEAM MATRIX' }),
        React.createElement(TerminalText, { className: 'text-zinc-300 ml-2', children: 'Opening squad telemetry module in side panel...' })
      );
    }
  }
};

export const collabCommand: CommandDefinition = {
  name: 'collab',
  aliases: ['partner', 'coop', 'network'],
  category: 'team',
  description: 'Manage peer collaboration network and student connections',
  usage: 'collab\ncollab add <handle>\ncollab requests\ncollab accept <handle>\ncollab reject <handle>\ncollab remove <handle>',
  examples: [
    'collab',
    'collab add rohan',
    'collab requests',
    'collab accept rohan',
    'collab reject rohan',
    'collab remove rohan'
  ],
  execute: async (args, _flags, ctx) => {
    const sub = (args[0] || '').toLowerCase();

    // ── collab add <handle> ──────────────────────────────────────────────
    if (sub === 'add' || (args.length === 1 && sub !== 'requests' && sub !== 'req' && sub !== 'accept' && sub !== 'reject' && sub !== 'remove')) {
      const rawTarget = sub === 'add' ? args[1] : args[0];
      if (!rawTarget) {
        return React.createElement(TerminalError, null, 'Usage: collab add <handle>');
      }
      const handle = cleanHandle(rawTarget);

      try {
        const res = await api.post('/collab/add', { handle });
        ctx.openPanel?.('collab');
        return React.createElement('div', { className: 'font-mono text-xs' },
          React.createElement(TerminalSuccess, null, `[COLLAB] Request sent to ${res.data.handle}`)
        );
      } catch (err: any) {
        const data = err.response?.data;
        if (data?.error === 'USER_NOT_FOUND') {
          return React.createElement('div', { className: 'font-mono text-xs' },
            React.createElement(TerminalError, null, '[ERROR] USER_NOT_FOUND'),
            React.createElement('div', { className: 'ml-2 text-zinc-400' }, `No registered TERMINAL user: ${handle}`)
          );
        }
        if (data?.error === 'ALREADY_CONNECTED') {
          return React.createElement('div', { className: 'font-mono text-xs text-amber-300' },
            `[COLLAB] ${handle}@terminal is already in your network.`
          );
        }
        if (data?.error === 'ALREADY_PENDING') {
          return React.createElement('div', { className: 'font-mono text-xs text-amber-300' },
            '[COLLAB] Request already pending.'
          );
        }
        return React.createElement(TerminalError, null, data?.error || 'Failed to send collaboration request.');
      }
    }

    // ── collab requests ──────────────────────────────────────────────────
    if (sub === 'requests' || sub === 'req') {
      ctx.openPanel?.('collab', { isRequestsView: true });
      try {
        const res = await api.get('/collab/requests');
        const incoming = res.data.incoming || [];
        const outgoing = res.data.outgoing || [];

        return React.createElement('div', { className: 'font-mono text-xs my-1' },
          React.createElement(TerminalSection, { title: 'COLLAB REQUESTS' }),
          React.createElement('div', { className: 'ml-2 space-y-2' },
            React.createElement('div', { className: 'text-zinc-400 uppercase text-[10px] font-bold tracking-wider' }, 'INCOMING'),
            incoming.length > 0 ? incoming.map((r: any) =>
              React.createElement('div', { key: r.id, className: 'text-cyan-300 font-bold' },
                `${r.handle} wants to collaborate • PENDING`
              )
            ) : React.createElement('div', { className: 'text-zinc-500 text-[11px]' }, 'No incoming requests.'),
            React.createElement('div', { className: 'text-zinc-400 uppercase text-[10px] font-bold tracking-wider pt-1' }, 'OUTGOING'),
            outgoing.length > 0 ? outgoing.map((r: any) =>
              React.createElement('div', { key: r.id, className: 'text-purple-300' },
                `${r.handle} request pending`
              )
            ) : React.createElement('div', { className: 'text-zinc-500 text-[11px]' }, 'No outgoing requests.')
          )
        );
      } catch (err: any) {
        return React.createElement(TerminalError, null, 'Failed to fetch collaboration requests.');
      }
    }

    // ── collab accept <handle> ───────────────────────────────────────────
    if (sub === 'accept') {
      const handle = cleanHandle(args[1] || '');
      if (!handle) {
        return React.createElement(TerminalError, null, 'Usage: collab accept <handle>');
      }

      try {
        const res = await api.post('/collab/accept', { handle });
        ctx.openPanel?.('collab');
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to accept collaboration request.');
      }
    }

    // ── collab reject <handle> ───────────────────────────────────────────
    if (sub === 'reject') {
      const handle = cleanHandle(args[1] || '');
      if (!handle) {
        return React.createElement(TerminalError, null, 'Usage: collab reject <handle>');
      }

      try {
        const res = await api.post('/collab/reject', { handle });
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to reject request.');
      }
    }

    // ── collab remove <handle> ───────────────────────────────────────────
    if (sub === 'remove') {
      const handle = cleanHandle(args[1] || '');
      if (!handle) {
        return React.createElement(TerminalError, null, 'Usage: collab remove <handle>');
      }

      try {
        const res = await api.post('/collab/remove', { handle });
        ctx.openPanel?.('collab');
        return React.createElement(TerminalSuccess, null, res.data.message);
      } catch (err: any) {
        return React.createElement(TerminalError, null, err.response?.data?.error || 'Failed to remove connection.');
      }
    }

    // ── Default: collab (opens panel + prints live network) ──────────────
    try {
      const res = await api.get('/collab');
      ctx.openPanel?.('collab', { isRequestsView: false });
      const contacts = res.data.contacts || [];
      const directory = res.data.directory || [];

      return React.createElement('div', { className: 'font-mono text-xs my-1' },
        React.createElement(TerminalSection, { title: 'COLLABORATION NETWORK' }),
        React.createElement('div', { className: 'ml-2 space-y-2' },
          React.createElement('div', { className: 'text-zinc-400 font-bold uppercase text-[10px] tracking-wider' },
            `PEER CONTACTS (${contacts.length})`
          ),
          contacts.length > 0 ? (
            React.createElement('div', { className: 'space-y-1' },
              contacts.map((c: any) =>
                React.createElement('div', { key: c.id, className: 'flex items-center gap-2' },
                  React.createElement('span', { className: c.isOnline ? 'text-emerald-400' : 'text-zinc-600' }, '●'),
                  React.createElement('span', { className: 'text-zinc-100 font-bold' }, c.handle),
                  React.createElement('span', { className: 'text-zinc-500' }, `(${c.name})`),
                  React.createElement('span', { className: `text-[10px] font-bold ${c.isOnline ? 'text-emerald-400' : 'text-zinc-500'}` },
                    c.isOnline ? 'ONLINE' : 'OFFLINE'
                  )
                )
              )
            )
          ) : (
            React.createElement('div', { className: 'text-zinc-500 text-[11px]' },
              'No peer contacts connected. Add classmates via `collab add <handle>`.'
            )
          ),

          directory.length > 0 ? (
            React.createElement('div', { className: 'pt-2 border-t border-zinc-800' },
              React.createElement('div', { className: 'text-zinc-400 font-bold uppercase text-[10px] tracking-wider mb-1' },
                `CAMPUS DIRECTORY (${directory.length} OPERATIVES)`
              ),
              React.createElement('div', { className: 'space-y-1' },
                directory.map((u: any, index: number) => {
                  const key = u.handle || u.username || u.id || `user-${index}`;
                  return React.createElement('div', { key, className: 'flex items-center justify-between text-[11px]' },
                    React.createElement('div', { className: 'flex items-center gap-2' },
                      React.createElement('span', { className: u.isOnline ? 'text-emerald-400' : 'text-zinc-600' }, '●'),
                      React.createElement('span', { className: 'text-zinc-300 font-bold' }, u.handle),
                      React.createElement('span', { className: 'text-zinc-500' }, `— ${u.name}`)
                    ),
                    React.createElement('span', { className: 'text-cyan-400 font-mono text-[10px]' }, `collab add ${u.handle}`)
                  );
                })
              )
            )
          ) : null,

          React.createElement('div', { className: 'mt-2 text-zinc-500 text-[11px]' },
            'Directives: collab add <handle> • collab requests • collab accept <handle> • collab remove <handle>'
          )
        )
      );
    } catch {
      ctx.openPanel?.('collab', { isRequestsView: false });
      return React.createElement('div', { className: 'font-mono text-xs my-1' },
        React.createElement(TerminalSection, { title: 'COLLABORATION NETWORK' }),
        React.createElement(TerminalText, { className: 'text-zinc-300 ml-2', children: 'Collaboration network panel opened.' })
      );
    }
  }
};

export function registerTeamCommands() {
  commandRegistry.register(teamCommand);
  commandRegistry.register(collabCommand);
}
