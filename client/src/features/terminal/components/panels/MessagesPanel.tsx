import React, { useState, useEffect } from 'react';
import { PanelFrame } from './PanelFrame';
import { Mail, MessageSquare, Check, ShieldAlert, Clock } from 'lucide-react';
import api from '../../../../lib/api';
import { TerminalEmpty } from '../TerminalSystemState';

interface MessagesPanelProps {
  data: any;
  onClose: () => void;
}

export const MessagesPanel: React.FC<MessagesPanelProps> = ({ data, onClose }) => {
  const [messages, setMessages] = useState<any[]>(data?.messages || []);
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/messages');
      setMessages(res.data.received || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/messages/${id}/read`);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m));
    } catch (err) {
      console.error('Failed to mark message as read', err);
    }
  };

  return (
    <PanelFrame
      title="DIRECT TRANSMISSIONS & NOTICES"
      path="/usr/bin/messages"
      badge={`${messages.filter(m => !m.isRead).length} UNREAD`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Mail size={16} className="text-cyan-400" />
            <span>ENCRYPTED ADMIN CHANNELS // DIRECT MESSAGING</span>
          </div>
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs border border-zinc-700 disabled:opacity-50"
          >
            {loading
              ? <span className="terminal-glyph text-cyan-400" aria-hidden="true" />
              : <span className="text-cyan-400">↺</span>
            }
            <span>{loading ? 'SYNCING' : 'SYNC INBOX'}</span>
          </button>
        </div>

        {messages.length === 0 ? (
          <TerminalEmpty
            title="NO TRANSMISSIONS"
            hint="inbox"
          >
            No incoming direct transmissions recorded. Messages sent by administrators will appear here.
          </TerminalEmpty>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`p-4 border-2 transition-all ${
                  !msg.isRead
                    ? 'bg-[#141b2d] border-cyan-500/80 shadow-[0_0_15px_rgba(0,255,204,0.12)]'
                    : 'bg-[#10131c] border-zinc-800 text-zinc-400'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-bold text-xs text-cyan-300">
                      FROM: {msg.sender?.name || msg.sender?.username || msg.sender || 'Administrator'}
                    </span>
                    <span className="px-1.5 py-0.5 bg-red-950/80 border border-red-700 text-[10px] text-red-300 font-bold uppercase">
                      {msg.sender?.role || msg.senderRole || 'ADMIN'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <Clock size={12} />
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-xs font-mono text-zinc-200 whitespace-pre-wrap bg-[#080a10] p-3 border border-zinc-800/80 mt-2">
                  {msg.content}
                </div>

                <div className="mt-3 flex items-center justify-end">
                  {!msg.isRead ? (
                    <button
                      onClick={() => markAsRead(msg.id)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] uppercase transition-all"
                    >
                      <Check size={12} />
                      <span>ACKNOWLEDGE & MARK READ</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                      <Check size={10} className="text-emerald-500" />
                      <span>ACKNOWLEDGED</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelFrame>
  );
};
