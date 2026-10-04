import React, { useState, useEffect } from 'react';
import { PanelFrame } from './PanelFrame';
import { Inbox, Mail, UserCheck, ShieldAlert, Bell, Clock, CheckCircle2 } from 'lucide-react';
import api from '../../../../lib/api';
import { TerminalLoading, TerminalEmpty } from '../TerminalSystemState';

interface InboxPanelProps {
  data: any;
  onClose: () => void;
}

export const InboxPanel: React.FC<InboxPanelProps> = ({ data, onClose }) => {
  const [messages, setMessages] = useState<any[]>(data?.messages || []);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'MESSAGES' | 'SYSTEM'>('ALL');

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messages');
      setMessages(res.data.received || []);
    } catch (err) {
      console.error('Failed to load inbox items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/messages/${id}/read`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    } catch (err) {
      console.error('Failed to mark message as read', err);
    }
  };

  const unreadCount = messages.filter(m => !m.isRead).length;

  const filteredItems = messages.filter(m => {
    if (filter === 'MESSAGES') return m.senderRole !== 'SYSTEM';
    if (filter === 'SYSTEM') return m.senderRole === 'SYSTEM' || m.senderRole === 'ADMIN';
    return true;
  });

  return (
    <PanelFrame
      title="STUDENT NOTIFICATION & DISPATCH INBOX"
      path="/var/spool/inbox"
      badge={`${unreadCount} UNREAD`}
      onClose={onClose}
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Filter & Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-1.5 bg-[#0b0e17] p-1 border border-zinc-800">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-cyan-500 text-black shadow-[1px_1px_0px_#000]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ALL ({messages.length})
            </button>
            <button
              onClick={() => setFilter('MESSAGES')}
              className={`px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'MESSAGES'
                  ? 'bg-cyan-500 text-black shadow-[1px_1px_0px_#000]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              DIRECT TRANSMISSIONS
            </button>
            <button
              onClick={() => setFilter('SYSTEM')}
              className={`px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                filter === 'SYSTEM'
                  ? 'bg-cyan-500 text-black shadow-[1px_1px_0px_#000]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              SYSTEM ALERTS
            </button>
          </div>

          <button
            onClick={fetchInbox}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading
              ? <span className="terminal-glyph text-cyan-400" aria-hidden="true" />
              : <span className="text-cyan-400">↺</span>
            }
            <span>{loading ? 'SYNCING' : 'SYNC'}</span>
          </button>
        </div>

        {/* Notifications & Messages Stream */}
        {loading ? (
          <TerminalLoading label="FETCHING DISPATCH QUEUE" node="/var/spool/inbox" compact />
        ) : filteredItems.length === 0 ? (
          <TerminalEmpty
            title="INBOX ZERO"
            hint="inbox"
          >
            Administrative broadcasts and tournament notices will appear here automatically.
          </TerminalEmpty>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 terminal-scroll">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`p-3.5 border-2 transition-all ${
                  !item.isRead
                    ? 'bg-[#141b2d] border-cyan-500/80 shadow-[3px_3px_0px_#000]'
                    : 'bg-[#0f121b] border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${!item.isRead ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}`} />
                    <span className="font-bold text-xs text-cyan-300">
                      {item.sender?.name || item.sender?.username || item.sender || 'System Dispatch'}
                    </span>
                    <span className="px-1.5 py-0.2 bg-red-950/80 border border-red-700 text-[9px] text-red-300 font-bold uppercase">
                      {item.senderRole || item.sender?.role || 'NOTICE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Clock size={11} />
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-200 whitespace-pre-wrap bg-[#080a10] p-2.5 border border-zinc-800/80">
                  {item.content}
                </div>

                {!item.isRead && (
                  <div className="mt-2.5 flex justify-end">
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={11} />
                      <span>ACKNOWLEDGE / MARK READ</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelFrame>
  );
};
