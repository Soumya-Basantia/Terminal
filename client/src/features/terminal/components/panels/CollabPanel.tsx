import React, { useState, useEffect, useRef } from 'react';
import { PanelFrame } from './PanelFrame';
import { Users, UserPlus, UserCheck, Shield, Globe, Search, Check, Clock } from 'lucide-react';
import api from '../../../../lib/api';
import { TerminalLoading } from '../TerminalSystemState';
import { connectSocket } from '../../../../lib/socket';

interface CollabPanelProps {
  target?: string;
  isRequestsView?: boolean;
  onClose: () => void;
}

interface DirectoryOperative {
  handle: string;
  username: string;
  isOnline: boolean;
  relation: 'CONNECTED' | 'PENDING' | 'ADD';
}

export const CollabPanel: React.FC<CollabPanelProps> = ({ 
  target, 
  isRequestsView = false, 
  onClose 
}) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [directory, setDirectory] = useState<DirectoryOperative[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'directory' | 'connected' | 'requests'>(
    isRequestsView ? 'requests' : 'directory'
  );
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchCollabData = async () => {
    try {
      const res = await api.get('/collab');
      setContacts(res.data.contacts || []);
      setIncoming(res.data.incoming || []);
      setOutgoing(res.data.outgoing || []);
      setDirectory(res.data.directory || []);
    } catch (err) {
      console.error('Failed to load collaboration data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollabData();

    // Subscribe to dynamic collab updates via Socket.IO
    const s = connectSocket();
    const handleCollabUpdate = () => {
      fetchCollabData();
    };

    if (s) {
      s.on('collab:request', handleCollabUpdate);
      s.on('collab:accepted', handleCollabUpdate);
      s.on('collab:rejected', handleCollabUpdate);
      s.on('collab:removed', handleCollabUpdate);
      s.on('collab:updated', handleCollabUpdate);
      s.on('team:presence', handleCollabUpdate);
    }

    return () => {
      if (s) {
        s.off('collab:request', handleCollabUpdate);
        s.off('collab:accepted', handleCollabUpdate);
        s.off('collab:rejected', handleCollabUpdate);
        s.off('collab:removed', handleCollabUpdate);
        s.off('collab:updated', handleCollabUpdate);
        s.off('team:presence', handleCollabUpdate);
      }
    };
  }, []);

  const handleAddOperative = async (handle: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionInProgress(handle);
    try {
      await api.post('/collab/add', { handle });
      await fetchCollabData();
    } catch (err: any) {
      console.error('Failed to add operative:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAcceptRequest = async (handle: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionInProgress(handle);
    try {
      await api.post('/collab/accept', { handle });
      await fetchCollabData();
    } catch (err) {
      console.error('Failed to accept request:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Keyboard isolation: never let search input keystrokes bubble to TerminalShell
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      if (searchQuery) {
        setSearchQuery('');
      } else {
        onClose();
      }
    }
  };

  // Filter directory operatives based on search query
  const filteredDirectory = directory.filter(op => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return op.handle.toLowerCase().includes(q) || op.username.toLowerCase().includes(q);
  });

  const onlineCount = directory.filter(d => d.isOnline).length;
  const pendingCount = directory.filter(d => d.relation === 'PENDING').length + incoming.length;

  return (
    <PanelFrame
      title="COLLAB :: OPERATIVES"
      path="/etc/collab"
      badge={`${directory.length} OPERATIVES`}
      onClose={onClose}
    >
      <div className="space-y-3 font-mono text-xs select-text">
        {/* Dispatched target alert if user ran `collab add <handle>` */}
        {target && (
          <div className="bg-[#090d16] border border-emerald-500/60 p-2.5 flex items-center gap-2">
            <UserCheck size={14} className="text-emerald-400 shrink-0" />
            <div className="text-[11px] min-w-0">
              <span className="text-emerald-300 font-bold block">TRANSMISSION DISPATCHED</span>
              <span className="text-zinc-400 truncate block">Request sent to: <strong className="text-cyan-300">{target}</strong></span>
            </div>
          </div>
        )}

        {/* Tab Controls: OPERATIVES / CONNECTED / REQUESTS */}
        <div className="grid grid-cols-3 gap-1 bg-[#07090e] p-1 border border-[#1c2638] text-[10px]">
          <button
            onClick={() => setActiveTab('directory')}
            className={`py-1 text-center font-bold tracking-wider uppercase transition-colors cursor-pointer ${
              activeTab === 'directory'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            OPERATIVES ({directory.length})
          </button>
          <button
            onClick={() => setActiveTab('connected')}
            className={`py-1 text-center font-bold tracking-wider uppercase transition-colors cursor-pointer ${
              activeTab === 'connected'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            CONNECTED ({contacts.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-1 text-center font-bold tracking-wider uppercase transition-colors cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            REQUESTS {incoming.length > 0 && <span className="text-amber-400 font-black">({incoming.length})</span>}
          </button>
        </div>

        {/* Search Bar with Keyboard Isolation */}
        {activeTab === 'directory' && (
          <div className="bg-[#090d16] border border-[#1c2638] focus-within:border-cyan-500/80 px-2.5 py-1.5 flex items-center gap-2">
            <span className="text-cyan-400 font-bold text-xs select-none">&gt;</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => e.stopPropagation()}
              placeholder="find operative... (e.g. alice, rohan)"
              className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-600 font-mono text-xs focus:ring-0 p-0 shadow-none caret-cyan-400"
              spellCheck={false}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 select-none cursor-pointer"
              >
                CLEAR
              </button>
            )}
          </div>
        )}

        {loading ? (
          <TerminalLoading label="QUERYING CAMPUS DIRECTORY" node="/etc/collab" />
        ) : activeTab === 'directory' ? (
          /* Directory List: strictly public handles only */
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider px-1">
              <span>PUBLIC HANDLE</span>
              <span>STATUS / RELATION</span>
            </div>

            <div className="space-y-1 max-h-[340px] overflow-y-auto terminal-scroll pr-1">
              {filteredDirectory.length === 0 ? (
                <div className="bg-[#07090e] border border-[#1c2638] p-4 text-center text-zinc-500 text-[11px]">
                  {searchQuery ? `No operatives matching "${searchQuery}"` : 'No registered campus operatives available.'}
                </div>
              ) : (
                filteredDirectory.map((op) => (
                  <div
                    key={op.handle}
                    className="bg-[#090d16] border border-[#1c2638] hover:border-zinc-700 px-2.5 py-2 flex items-center justify-between gap-2 transition-colors"
                  >
                    {/* Public Handle + Presence Dot */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${op.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-zinc-200 font-bold font-mono text-xs truncate">
                        {op.handle}
                      </span>
                    </div>

                    {/* Presence & Relation Action */}
                    <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono">
                      <span className={op.isOnline ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                        {op.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>

                      {op.relation === 'CONNECTED' ? (
                        <span className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/70 text-emerald-300 font-bold uppercase tracking-wider">
                          CONNECTED
                        </span>
                      ) : op.relation === 'PENDING' ? (
                        <span className="px-2 py-0.5 bg-amber-950/60 border border-amber-500/70 text-amber-300 font-bold uppercase tracking-wider">
                          PENDING
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleAddOperative(op.handle, e)}
                          disabled={actionInProgress === op.handle}
                          className="px-2 py-0.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                          title={`Send collaboration invite to ${op.handle}`}
                        >
                          {actionInProgress === op.handle ? 'SENDING...' : '+ ADD'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Directory Telemetry */}
            <div className="border-t border-[#1c2638] pt-2 text-[10px] text-zinc-500 font-mono flex items-center justify-between">
              <span>{directory.length} OPERATIVES &bull; {onlineCount} ONLINE</span>
              <span>{pendingCount} PENDING</span>
            </div>
          </div>
        ) : activeTab === 'connected' ? (
          /* Connected Contacts */
          <div className="space-y-1.5">
            <div className="space-y-1 max-h-[340px] overflow-y-auto terminal-scroll pr-1">
              {contacts.length === 0 ? (
                <div className="bg-[#07090e] border border-[#1c2638] p-5 text-center text-zinc-500 text-[11px] space-y-1">
                  <div className="font-bold text-zinc-300">NO PEER CONTACTS CONNECTED</div>
                  <p className="text-[10px]">Switch to OPERATIVES tab and click [+ ADD] or execute `collab add &lt;handle&gt;`.</p>
                </div>
              ) : (
                contacts.map((c) => (
                  <div
                    key={c.id}
                    className="bg-[#090d16] border border-[#1c2638] px-2.5 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${c.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-zinc-200 font-bold font-mono text-xs truncate">
                        {c.handle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px]">
                      <span className={c.isOnline ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                        {c.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <span className="px-1.5 py-0.2 bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 font-bold text-[9px]">
                        MUTUAL
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Requests View */
          <div className="space-y-3">
            {/* Incoming Requests */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                INCOMING REQUESTS ({incoming.length})
              </div>

              {incoming.length === 0 ? (
                <div className="bg-[#07090e] border border-[#1c2638] p-3 text-zinc-500 text-[11px]">
                  No incoming requests pending.
                </div>
              ) : (
                incoming.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#090d16] border border-cyan-500/60 p-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-cyan-300 font-bold font-mono text-xs">{r.handle}</div>
                      <div className="text-[10px] text-zinc-400">requests network connection</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleAcceptRequest(r.username || r.handle, e)}
                        className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] uppercase cursor-pointer"
                      >
                        ACCEPT
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Outgoing Requests */}
            <div className="space-y-1.5 pt-2 border-t border-[#1c2638]">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                OUTGOING REQUESTS ({outgoing.length})
              </div>

              {outgoing.length === 0 ? (
                <div className="bg-[#07090e] border border-[#1c2638] p-3 text-zinc-500 text-[11px]">
                  No outgoing requests sent.
                </div>
              ) : (
                outgoing.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#090d16] border border-[#1c2638] p-2 flex items-center justify-between text-[11px]"
                  >
                    <span className="text-purple-300 font-bold font-mono">{r.handle}</span>
                    <span className="text-amber-400 font-mono text-[10px]">AWAITING PEER</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </PanelFrame>
  );
};
