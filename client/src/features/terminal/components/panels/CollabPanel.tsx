import React, { useState, useEffect } from 'react';
import { PanelFrame } from './PanelFrame';
import { Users, UserPlus, UserCheck, Shield, Globe } from 'lucide-react';
import api from '../../../../lib/api';
import { TerminalLoading, TerminalEmpty } from '../TerminalSystemState';
import { connectSocket } from '../../../../lib/socket';

interface CollabPanelProps {
  target?: string;
  isRequestsView?: boolean;
  onClose: () => void;
}

export const CollabPanel: React.FC<CollabPanelProps> = ({ 
  target, 
  isRequestsView = false, 
  onClose 
}) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <PanelFrame
      title={isRequestsView ? "// COLLAB REQUESTS" : "// COLLABORATION NETWORK"}
      path={isRequestsView ? "/etc/collab/requests" : (target ? `/etc/collab/${target}` : "/etc/collab")}
      badge={isRequestsView ? `${incoming.length} INCOMING` : `${contacts.length} CONTACTS`}
      onClose={onClose}
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Dispatched target alert if user ran `collab add <handle>` */}
        {target && (
          <div className="bg-[#121622] border-2 border-emerald-500/60 p-3 shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-950/60 border border-emerald-400 text-emerald-400">
                <UserCheck size={18} />
              </div>
              <div>
                <div className="font-bold text-zinc-100 text-xs">
                  [COLLAB] REQUEST TRANSMITTED
                </div>
                <div className="text-[11px] text-zinc-400">
                  Invitation sent to: <span className="text-cyan-300 font-bold font-mono">@{target}@terminal</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <TerminalLoading label="SYNCING COLLABORATION MESH" node="/etc/collab" />
        ) : isRequestsView ? (
          /* Request Queue View */
          <div className="space-y-4">
            {/* Incoming Requests */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800">
                INCOMING ({incoming.length})
              </div>

              {incoming.length > 0 ? (
                <div className="space-y-2">
                  {incoming.map(req => (
                    <div
                      key={req.id}
                      className="bg-[#10141f] border-2 border-cyan-500/60 p-3 flex items-center justify-between gap-3 shadow-[2px_2px_0px_#000]"
                    >
                      <div>
                        <div className="text-cyan-300 font-bold font-mono text-xs">
                          {req.handle}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          wants to collaborate • <span className="text-amber-400 font-bold">PENDING</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-zinc-400 font-mono">
                        Type: <span className="text-cyan-300 font-bold">collab accept {req.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#0b0e17] p-3 text-zinc-500 text-[11px] border border-zinc-800">
                  No incoming collaboration requests pending.
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800">
                OUTGOING ({outgoing.length})
              </div>

              {outgoing.length > 0 ? (
                <div className="space-y-2">
                  {outgoing.map(req => (
                    <div
                      key={req.id}
                      className="bg-[#0f121a] border border-zinc-800 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="text-purple-300 font-bold font-mono">
                        {req.handle}
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        request pending
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#0b0e17] p-3 text-zinc-500 text-[11px] border border-zinc-800">
                  No outgoing collaboration requests pending.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Contacts & Network View */
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-zinc-800 flex items-center justify-between">
                <span>CONTACTS ({contacts.length})</span>
                <span className="text-[10px] text-zinc-500">REAL NETWORK</span>
              </div>

              {contacts.length > 0 ? (
                <div className="space-y-1.5">
                  {contacts.map(c => (
                    <div
                      key={c.id}
                      className="bg-[#0e121c] border border-zinc-800 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${c.isOnline ? 'text-emerald-400' : 'text-zinc-600'}`}>●</span>
                        <span className="text-zinc-100 font-bold font-mono text-xs">
                          {c.handle}
                        </span>
                        <span className="text-[10px] text-zinc-500 hidden sm:inline">
                          ({c.name})
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold ${c.isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {c.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#121622] border-2 border-zinc-800 p-6 text-center text-zinc-500">
                  <Users size={22} className="mx-auto mb-2 text-zinc-600" />
                  <div className="text-xs font-bold text-zinc-300 mb-1">NO PEER CONTACTS CONNECTED</div>
                  <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                    Connect with classmates by handle. Run `collab add &lt;handle&gt;` to dispatch a request.
                  </p>
                </div>
              )}
            </div>

            {/* Campus Directory */}
            {directory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe size={12} className="text-cyan-400" />
                    CAMPUS DIRECTORY ({directory.length})
                  </span>
                  <span className="text-[10px] text-zinc-500">REGISTERED OPERATIVES</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {directory.map(u => (
                    <div
                      key={u.id}
                      className="bg-[#0b0e17] border border-zinc-800/80 p-2 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${u.isOnline ? 'text-emerald-400' : 'text-zinc-600'}`}>●</span>
                        <span className="text-zinc-200 font-mono text-xs">{u.handle}</span>
                        <span className="text-zinc-500 text-[10px]">{u.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold ${u.isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {u.isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        <span className="text-[10px] text-cyan-400/80 font-mono">
                          collab add {u.handle}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending count badges */}
            {(incoming.length > 0 || outgoing.length > 0) && (
              <div className="bg-[#0b0e17] p-3 border border-cyan-500/40 flex items-center justify-between">
                <span className="text-zinc-400 text-[11px]">
                  Pending requests: <strong className="text-cyan-300">{incoming.length} incoming</strong>, <strong className="text-purple-300">{outgoing.length} outgoing</strong>
                </span>
                <span className="text-[10px] text-cyan-400 font-bold">type 'collab requests'</span>
              </div>
            )}
          </div>
        )}

        {/* Command Reference Directives */}
        <div className="bg-[#090c14] border border-zinc-800 p-3 space-y-1.5 mt-3">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <Shield size={12} className="text-cyan-400" />
            <span>COLLAB COMMAND DIRECTIVE</span>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-400 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">collab add &lt;handle&gt;</span>
              <span className="text-zinc-500">Send request to handle</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">collab requests</span>
              <span className="text-zinc-500">View incoming/outgoing queue</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cyan-300 font-bold">collab accept &lt;handle&gt;</span>
              <span className="text-zinc-500">Accept peer connection</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-pink-400 font-bold">collab remove &lt;handle&gt;</span>
              <span className="text-zinc-500">Disconnect from network</span>
            </div>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
};
