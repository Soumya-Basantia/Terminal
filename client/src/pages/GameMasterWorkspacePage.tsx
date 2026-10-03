import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';
import { 
  Shield, 
  Gamepad2, 
  Calendar, 
  Play, 
  Users, 
  Plus, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Sliders,
  Tv,
  Presentation
} from 'lucide-react';
import { TerminalPanel, TerminalButton, TerminalBadge } from '../components/ui';

interface GmWorkspaceData {
  gm: {
    id: string;
    name: string;
    email: string;
    phone: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    role: string;
  };
  notice?: string;
  events: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    mode: string;
    gameCount: number;
    sessionCount: number;
    games: Array<{ name: string; template: string }>;
    createdAt: string;
  }>;
  games: Array<{
    id: string;
    name: string;
    template: string;
    status: string;
    challengeCount: number;
    sessionCount: number;
    createdAt: string;
  }>;
  sessions: Array<{
    id: string;
    roomCode: string;
    status: string;
    stageMode: string;
    eventId: string;
    eventName: string;
    gameName: string;
    gameTemplate: string;
    playerCount: number;
    submissionCount: number;
    createdAt: string;
    leaderboard: Array<{
      playerId: string;
      userId: string;
      name: string;
      usn: string;
      email: string;
      score: number;
      rank: number;
      status: string;
    }>;
  }>;
}

export default function GameMasterWorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<GmWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'sessions' | 'events' | 'games'>('sessions');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // If user is a student, redirect to terminal
  useEffect(() => {
    if (user && user.role === 'PLAYER') {
      navigate('/terminal');
    }
  }, [user, navigate]);

  const loadWorkspace = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/workspace/gm');
      setData(res.data);
      if (res.data.sessions && res.data.sessions.length > 0 && !expandedSessionId) {
        setExpandedSessionId(res.data.sessions[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load Game Master workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleLaunchSession = async (eventId: string) => {
    setActionLoading(true);
    try {
      const res = await api.post('/sessions', { eventId });
      navigate(`/sessions/${res.data.session.roomCode}/host`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to initialize session');
    } finally {
      setActionLoading(false);
    }
  };

  const isPending = data?.gm.approvalStatus === 'PENDING';
  const isApproved = data?.gm.approvalStatus === 'APPROVED' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-[var(--term-bg-void)] text-[var(--term-text-primary)] font-mono p-4 md:p-6 flex flex-col relative select-none">
      {/* Background cyber grid */}
      <div 
        className="fixed inset-0 pointer-events-none term-grid-lines -z-10" 
      />

      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 relative z-10 flex-1">
        
        {/* GM WORKSPACE TOP BAR */}
        <TerminalPanel
          headerTag="// OPERATIONAL_ZONE"
          title="GAME MASTER WORKSPACE"
          cornerAccents={true}
          variant="cyber"
          headerActions={
            <div className="flex items-center gap-2">
              <TerminalButton
                onClick={loadWorkspace}
                disabled={loading}
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />}
              >
                SYNC
              </TerminalButton>

              {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                <Link to="/admin">
                  <TerminalButton variant="cyber" size="sm">
                    ROOT ADMIN
                  </TerminalButton>
                </Link>
              )}

              <TerminalButton
                onClick={logout}
                variant="danger"
                size="sm"
                icon={<LogOut size={13} />}
              >
                LOGOUT
              </TerminalButton>
            </div>
          }
          className="p-0 overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--term-border-subtle)] pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 border border-[var(--term-cyan)] bg-[var(--term-bg-base)] shadow-[2px_2px_0_0_var(--term-cyan)]">
                <Shield size={24} className="text-[var(--term-cyan)]" />
              </div>
              <div>
                <div className="text-[10px] tracking-widest text-[var(--term-text-secondary)] uppercase">
                  OPERATOR TELEMETRY
                </div>
                <h1 className="font-mono font-black text-xl sm:text-2xl text-white flex items-center gap-3">
                  <span>{data?.gm.name || user?.name || user?.username || 'Game Master'}</span>
                  <TerminalBadge 
                    variant={isApproved ? 'green' : 'yellow'} 
                    dot={true} 
                    pulse={!isApproved}
                  >
                    {data?.gm.approvalStatus || 'PENDING'}
                  </TerminalBadge>
                </h1>
              </div>
            </div>
          </div>

          {/* GM Identity Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="bg-[var(--term-bg-base)] p-3 border border-[var(--term-border-subtle)]">
              <span className="text-[var(--term-text-muted)] block text-[10px] uppercase">EMAIL IDENTITY</span>
              <span className="text-[var(--term-text-bright)] font-bold text-xs sm:text-sm block truncate">
                {data?.gm.email || user?.email}
              </span>
            </div>

            <div className="bg-[var(--term-bg-base)] p-3 border border-[var(--term-border-subtle)]">
              <span className="text-[var(--term-text-muted)] block text-[10px] uppercase">PHONE NUMBER</span>
              <span className="text-[var(--term-text-bright)] font-bold text-xs sm:text-sm block">
                {data?.gm.phone || 'Not registered'}
              </span>
            </div>

            <div className="bg-[var(--term-bg-base)] p-3 border border-[var(--term-border-subtle)]">
              <span className="text-[var(--term-text-muted)] block text-[10px] uppercase">AUTHORIZATION STATUS</span>
              <span className={`font-bold text-xs sm:text-sm flex items-center gap-1.5 ${
                isApproved ? 'text-[var(--term-green)]' : 'text-[var(--term-yellow)]'
              }`}>
                {isApproved ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{data?.gm.approvalStatus === 'APPROVED' ? 'FULL PRIVILEGES ACTIVE' : 'PENDING ROOT APPROVAL'}</span>
              </span>
            </div>
          </div>
        </TerminalPanel>

        {/* PENDING APPROVAL NOTICE */}
        {isPending && (
          <TerminalPanel
            variant="alert"
            headerTag="// AUTHORIZATION_GATE"
            title="APPROVAL REQUIRED"
            cornerAccents={true}
          >
            <div className="flex items-start gap-4">
              <AlertCircle size={28} className="text-[var(--term-yellow)] shrink-0 mt-1" />
              <div>
                <h3 className="font-mono font-bold text-base text-[var(--term-yellow)] uppercase tracking-tight">
                  ACCOUNT PENDING ROOT ADMINISTRATOR APPROVAL
                </h3>
                <p className="font-mono text-xs sm:text-sm text-[var(--term-text-secondary)] mt-2 leading-relaxed">
                  Your Game Master registration has been submitted. For platform integrity, Game Masters must be approved by the Root Administrator (`root`) before creating events, designing games, or hosting live sessions.
                </p>
                <div className="mt-3 p-2.5 bg-[var(--term-bg-base)] border border-[var(--term-border-subtle)] font-mono text-xs text-[var(--term-yellow)]">
                  STATUS: PENDING_APPROVAL • Once approved by root, your full GM controls and event staging interfaces will unlock immediately.
                </div>
              </div>
            </div>
          </TerminalPanel>
        )}

        {/* APPROVED GM CONTROLS & MANAGEMENT INTERFACE */}
        {isApproved && (
          <div className="flex flex-col gap-6">
            
            {/* WORKSPACE NAVIGATION TABS */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--term-border-subtle)] pb-2 font-mono">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab('sessions')}
                  className={`px-3 py-2 text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'sessions'
                      ? 'bg-[var(--term-cyan)] text-black border-[var(--term-cyan)] shadow-[2px_2px_0_0_#000]'
                      : 'bg-[var(--term-bg-surface)] text-[var(--term-text-secondary)] border-[var(--term-border-subtle)] hover:text-white'
                  }`}
                >
                  <Sliders size={14} />
                  <span>SESSIONS & LEADERBOARDS ({data?.sessions.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('events')}
                  className={`px-3 py-2 text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'events'
                      ? 'bg-[var(--term-cyan)] text-black border-[var(--term-cyan)] shadow-[2px_2px_0_0_#000]'
                      : 'bg-[var(--term-bg-surface)] text-[var(--term-text-secondary)] border-[var(--term-border-subtle)] hover:text-white'
                  }`}
                >
                  <Calendar size={14} />
                  <span>EVENTS ({data?.events.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('games')}
                  className={`px-3 py-2 text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'games'
                      ? 'bg-[var(--term-cyan)] text-black border-[var(--term-cyan)] shadow-[2px_2px_0_0_#000]'
                      : 'bg-[var(--term-bg-surface)] text-[var(--term-text-secondary)] border-[var(--term-border-subtle)] hover:text-white'
                  }`}
                >
                  <Gamepad2 size={14} />
                  <span>GAMES ({data?.games.length || 0})</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Link to="/clubs">
                  <TerminalButton variant="ghost" size="sm">
                    CLUB PORTAL
                  </TerminalButton>
                </Link>
                <Link to="/games/new">
                  <TerminalButton variant="primary" size="sm" icon={<Plus size={13} />}>
                    NEW GAME
                  </TerminalButton>
                </Link>
              </div>
            </div>

            {/* TAB 1: SESSIONS & PARTICIPANT LEADERBOARDS */}
            {activeTab === 'sessions' && (
              <div className="flex flex-col gap-6 animate-fade-in">
                {(!data?.sessions || data.sessions.length === 0) ? (
                  <TerminalPanel
                    headerTag="// SESSIONS"
                    title="TELEMETRY"
                    className="text-center p-8 font-mono"
                  >
                    <Sliders size={32} className="mx-auto text-[var(--term-text-muted)] mb-3" />
                    <h3 className="font-bold text-base text-[var(--term-text-secondary)]">NO ACTIVE OR PAST SESSIONS</h3>
                    <p className="text-xs text-[var(--term-text-muted)] mt-1">
                      Launch an event session to monitor participants, live telemetry, and leaderboard rankings.
                    </p>
                  </TerminalPanel>
                ) : (
                  <div className="grid grid-cols-1 gap-5">
                    {data.sessions.map(s => {
                      const isExpanded = expandedSessionId === s.id;
                      return (
                        <TerminalPanel
                          key={s.id}
                          variant="cyber"
                          className="p-0 overflow-hidden"
                          headerTag={`ROOM // ${s.roomCode}`}
                          title={s.eventName}
                          headerActions={
                            <div className="flex flex-wrap items-center gap-2">
                              <TerminalBadge 
                                variant={s.status.includes('ACTIVE') ? 'green' : s.status === 'ENDED' ? 'dim' : 'yellow'} 
                                dot={true}
                                pulse={s.status.includes('ACTIVE')}
                              >
                                {s.status}
                              </TerminalBadge>

                              <Link to={`/sessions/${s.roomCode}/host`}>
                                <TerminalButton variant="primary" size="sm" icon={<Play size={11} fill="currentColor" />}>
                                  HOST CONTROLS
                                </TerminalButton>
                              </Link>

                              <Link to={`/stage/${s.roomCode}`} target="_blank" rel="noreferrer">
                                <TerminalButton variant="secondary" size="sm" icon={<Tv size={11} />}>
                                  STAGE
                                </TerminalButton>
                              </Link>

                              <Link to={`/presenter/${s.roomCode}`} target="_blank" rel="noreferrer">
                                <TerminalButton variant="secondary" size="sm" icon={<Presentation size={11} />}>
                                  PRESENTER
                                </TerminalButton>
                              </Link>

                              <TerminalButton
                                onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                                variant="ghost"
                                size="sm"
                              >
                                {isExpanded ? 'HIDE LEADERBOARD' : 'VIEW LEADERBOARD'}
                              </TerminalButton>
                            </div>
                          }
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-[var(--term-border-subtle)] pb-3 mb-3">
                            <div className="flex items-center gap-4 text-[var(--term-text-secondary)]">
                              <span>Game: <strong className="text-[var(--term-cyan)]">{s.gameName}</strong></span>
                              <span>•</span>
                              <span>Template: <strong className="text-[var(--term-text-bright)]">{s.gameTemplate}</strong></span>
                              <span>•</span>
                              <span>Players: <strong className="text-[var(--term-green)]">{s.playerCount}</strong></span>
                              <span>•</span>
                              <span>Submissions: <strong className="text-[var(--term-yellow)]">{s.submissionCount}</strong></span>
                            </div>
                          </div>

                          {/* Collapsible Participant Leaderboard Table */}
                          {isExpanded && (
                            <div className="font-mono text-xs">
                              <div className="flex items-center justify-between mb-3 text-[var(--term-text-secondary)]">
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--term-cyan)]">
                                  <Users size={14} />
                                  <span>PARTICIPANTS & SCORES ({s.leaderboard.length})</span>
                                </span>
                              </div>

                              {s.leaderboard.length === 0 ? (
                                <div className="text-center py-6 text-[var(--term-text-muted)] bg-[var(--term-bg-base)] border border-[var(--term-border-subtle)]">
                                  No students enrolled in this session yet. Share Room Code <span className="text-[var(--term-cyan)] font-bold">{s.roomCode}</span>.
                                </div>
                              ) : (
                                <div className="overflow-x-auto border border-[var(--term-border-subtle)]">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-[var(--term-bg-elevated)] border-b border-[var(--term-border-subtle)] text-[10px] text-[var(--term-text-muted)] uppercase">
                                        <th className="p-2.5 w-12 text-center">RANK</th>
                                        <th className="p-2.5">STUDENT NAME</th>
                                        <th className="p-2.5">USN</th>
                                        <th className="p-2.5">EMAIL</th>
                                        <th className="p-2.5 text-right">SCORE</th>
                                        <th className="p-2.5 text-center">STATUS</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--term-border-subtle)] bg-[var(--term-bg-surface)]">
                                      {s.leaderboard.map(p => (
                                        <tr key={p.playerId} className="hover:bg-[var(--term-bg-highlight)] transition-colors">
                                          <td className="p-2.5 text-center font-bold">
                                            {p.rank === 1 ? '🥇 1' : p.rank === 2 ? '🥈 2' : p.rank === 3 ? '🥉 3' : `#${p.rank}`}
                                          </td>
                                          <td className="p-2.5 font-bold text-white">{p.name}</td>
                                          <td className="p-2.5 text-[var(--term-cyan)] font-medium">{p.usn}</td>
                                          <td className="p-2.5 text-[var(--term-text-secondary)] truncate max-w-[200px]">{p.email}</td>
                                          <td className="p-2.5 text-right font-bold text-[var(--term-green)]">{p.score} PTS</td>
                                          <td className="p-2.5 text-center">
                                            <TerminalBadge
                                              variant={p.status === 'ACTIVE' ? 'green' : 'dim'}
                                            >
                                              {p.status}
                                            </TerminalBadge>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </TerminalPanel>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EVENTS MANAGEMENT */}
            {activeTab === 'events' && (
              <div className="flex flex-col gap-4 animate-fade-in font-mono">
                {(!data?.events || data.events.length === 0) ? (
                  <TerminalPanel
                    headerTag="// TOURNAMENTS"
                    title="EVENTS CATALOG"
                    className="text-center p-8"
                  >
                    <Calendar size={32} className="mx-auto text-[var(--term-text-muted)] mb-3" />
                    <h3 className="font-bold text-base text-[var(--term-text-secondary)]">NO EVENTS CREATED</h3>
                    <p className="text-xs text-[var(--term-text-muted)] mt-1 mb-4">
                      Create a tournament event to group challenges and launch live sessions.
                    </p>
                    <Link to="/clubs">
                      <TerminalButton variant="primary" size="md">
                        GO TO EVENT CREATOR
                      </TerminalButton>
                    </Link>
                  </TerminalPanel>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.events.map(e => (
                      <TerminalPanel
                        key={e.id}
                        headerTag={`MODE // ${e.mode}`}
                        title={e.name}
                        headerActions={
                          <TerminalBadge variant={e.status === 'PUBLISHED' ? 'green' : 'dim'}>
                            {e.status}
                          </TerminalBadge>
                        }
                        className="flex flex-col justify-between"
                      >
                        <div>
                          <p className="text-xs text-[var(--term-text-secondary)] line-clamp-2 mb-4">
                            {e.description || 'No description provided.'}
                          </p>

                          <div className="text-xs text-[var(--term-text-muted)] mb-4 flex gap-4">
                            <span>Games: <strong className="text-[var(--term-cyan)]">{e.gameCount}</strong></span>
                            <span>Sessions: <strong className="text-[var(--term-green)]">{e.sessionCount}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-[var(--term-border-subtle)]">
                          <TerminalButton
                            onClick={() => handleLaunchSession(e.id)}
                            disabled={actionLoading || e.status !== 'PUBLISHED'}
                            variant="primary"
                            size="sm"
                            className="flex-1"
                            icon={<Play size={11} fill="currentColor" />}
                          >
                            LAUNCH SESSION
                          </TerminalButton>

                          <Link to={`/clubs/default/events/${e.id}/edit`}>
                            <TerminalButton variant="secondary" size="sm">
                              EDIT
                            </TerminalButton>
                          </Link>
                        </div>
                      </TerminalPanel>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: GAMES MANAGEMENT */}
            {activeTab === 'games' && (
              <div className="flex flex-col gap-4 animate-fade-in font-mono">
                {(!data?.games || data.games.length === 0) ? (
                  <TerminalPanel
                    headerTag="// MODULES"
                    title="GAMES INVENTORY"
                    className="text-center p-8"
                  >
                    <Gamepad2 size={32} className="mx-auto text-[var(--term-text-muted)] mb-3" />
                    <h3 className="font-bold text-base text-[var(--term-text-secondary)]">NO GAMES DESIGNED</h3>
                    <p className="text-xs text-[var(--term-text-muted)] mt-1 mb-4">
                      Create and deploy custom Quiz, Bug Hunt, Logic Heist, or Threshold game modules.
                    </p>
                    <Link to="/games/new">
                      <TerminalButton variant="primary" size="md">
                        CREATE YOUR FIRST GAME
                      </TerminalButton>
                    </Link>
                  </TerminalPanel>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.games.map(g => (
                      <TerminalPanel
                        key={g.id}
                        headerTag={g.template}
                        title={g.name}
                        headerActions={
                          <TerminalBadge variant={g.status === 'PUBLISHED' ? 'green' : 'dim'}>
                            {g.status}
                          </TerminalBadge>
                        }
                        className="flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs text-[var(--term-text-muted)] mb-4 flex gap-4">
                            <span>Questions: <strong className="text-[var(--term-cyan)]">{g.challengeCount}</strong></span>
                            <span>Hosted: <strong className="text-[var(--term-green)]">{g.sessionCount}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-[var(--term-border-subtle)]">
                          <Link to={`/clubs/default/games/${g.id}/edit`} className="flex-1">
                            <TerminalButton variant="secondary" size="sm" className="w-full">
                              EDIT QUESTIONS
                            </TerminalButton>
                          </Link>

                          <Link to={`/clubs/default/games/${g.id}/host`}>
                            <TerminalButton variant="primary" size="sm">
                              HOST
                            </TerminalButton>
                          </Link>
                        </div>
                      </TerminalPanel>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
