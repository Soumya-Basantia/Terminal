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
  Presentation,
  Activity,
  Terminal,
  Radio,
  Zap,
  ChevronRight,
  Eye,
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

function MetricCard({
  label,
  value,
  accent,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="bg-[#0f1319] border border-[#2d3848] p-4 relative flex flex-col gap-2 shadow-[4px_4px_0px_#000]"
      style={{ borderRadius: 0 }}>
      {/* accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.2em] text-[#5e6b7c] uppercase">{label}</span>
        <Icon size={13} style={{ color: accent }} />
      </div>
      <div className="font-black text-3xl font-mono" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[9px] text-[#3d4754] font-mono uppercase tracking-widest">{sub}</div>}
    </div>
  );
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (user && user.role === 'PLAYER') navigate('/terminal');
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

  useEffect(() => { loadWorkspace(); }, []);

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
  const isApproved =
    data?.gm.approvalStatus === 'APPROVED' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SUPER_ADMIN';

  const cursor = tick % 2 === 0 ? '█' : ' ';
  const activeSessions = data?.sessions.filter(s => s.status.includes('ACTIVE') || s.status === 'LOBBY') || [];

  return (
    <div
      className="min-h-screen bg-[#050608] text-[#e6edf3] font-mono flex flex-col relative"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}>

      {/* ── Cyber Grid ─── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0,255,204,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── TOP HEADER BAR ─── */}
      <header
        className="relative z-20 w-full bg-[#0a0c10] border-b-2 border-[#1a222e] px-4 sm:px-6 py-3 flex items-center justify-between shadow-[0_2px_0px_#000]"
        style={{ borderRadius: 0 }}>
        {/* Left: Identity */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#00ffcc] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]" style={{ borderRadius: 0 }}>
            <span className="text-black font-black text-sm font-mono">&gt;_</span>
          </div>
          <div>
            <div className="font-black text-sm tracking-widest text-white" style={{ fontFamily: "'Orbitron', monospace" }}>
              TERMINAL <span className="text-[#00ffcc]">GM</span>
            </div>
            <div className="text-[9px] text-[#5e6b7c] tracking-[0.2em] font-mono uppercase">
              // GAME_MASTER_WORKSPACE {cursor}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Active session pulse */}
          {activeSessions.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1.5 border border-[rgba(255,0,127,0.5)] text-[#ff007f] bg-[rgba(255,0,127,0.07)]" style={{ borderRadius: 0 }}>
              <span className="w-1.5 h-1.5 bg-[#ff007f] rounded-full animate-pulse" />
              <span>{activeSessions.length} LIVE SESSION{activeSessions.length > 1 ? 'S' : ''}</span>
            </div>
          )}

          <button
            onClick={loadWorkspace}
            disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1.5 border border-[#2d3848] text-[#8b99aa] bg-[#161c24] hover:text-white hover:border-[#48566a] transition-all"
            style={{ borderRadius: 0 }}>
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">SYNC</span>
          </button>

          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <Link to="/admin">
              <button className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1.5 border border-[rgba(168,85,247,0.5)] text-[#a855f7] bg-[rgba(168,85,247,0.07)] hover:bg-[rgba(168,85,247,0.15)] transition-all" style={{ borderRadius: 0 }}>
                <Shield size={11} />
                <span className="hidden sm:inline">ROOT ADMIN</span>
              </button>
            </Link>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1.5 border border-[rgba(255,51,102,0.4)] text-[#ff3366] bg-[rgba(255,51,102,0.07)] hover:bg-[rgba(255,51,102,0.15)] transition-all"
            style={{ borderRadius: 0 }}>
            <LogOut size={11} />
            <span className="hidden sm:inline">LOGOUT</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ─── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 flex-1">

        {/* ── OPERATOR IDENTITY STRIP ─── */}
        <div
          className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative overflow-hidden"
          style={{ borderRadius: 0 }}>
          {/* Cyan top accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00ffcc]" />
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ffcc] pointer-events-none" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ffcc] pointer-events-none" />

          <div className="p-5 flex flex-wrap items-center gap-5 justify-between">
            {/* GM Identity */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[rgba(0,255,204,0.1)] border-2 border-[rgba(0,255,204,0.4)] flex items-center justify-center shadow-[2px_2px_0px_#000]" style={{ borderRadius: 0 }}>
                <Shield size={22} className="text-[#00ffcc]" />
              </div>
              <div>
                <div className="text-[10px] text-[#5e6b7c] tracking-[0.2em] uppercase mb-0.5">// OPERATOR TELEMETRY</div>
                <h1 className="font-black text-xl text-white" style={{ fontFamily: "'Orbitron', monospace" }}>
                  {data?.gm.name || user?.name || user?.username || 'GAME MASTER'}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold tracking-widest px-2 py-0.5 border flex items-center gap-1.5 ${
                    isApproved
                      ? 'border-[rgba(63,185,80,0.5)] text-[#3fb950] bg-[rgba(63,185,80,0.08)]'
                      : 'border-[rgba(252,206,10,0.5)] text-[#fcce0a] bg-[rgba(252,206,10,0.08)]'
                  }`} style={{ borderRadius: 0 }}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-[#3fb950]' : 'bg-[#fcce0a] animate-pulse'}`} />
                    {data?.gm.approvalStatus || 'PENDING'}
                  </span>
                  <span className="text-[10px] text-[#5e6b7c] font-mono">GAME_MASTER@terminal</span>
                </div>
              </div>
            </div>

            {/* Identity metadata */}
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">EMAIL</div>
                <div className="text-white font-bold truncate max-w-[200px]">{data?.gm.email || user?.email || '—'}</div>
              </div>
              <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">PHONE</div>
                <div className="text-white font-bold">{data?.gm.phone || '—'}</div>
              </div>
              <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">AUTH STATUS</div>
                <div className={`font-bold flex items-center gap-1.5 ${isApproved ? 'text-[#3fb950]' : 'text-[#fcce0a]'}`}>
                  {isApproved ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  <span className="text-[11px]">{isApproved ? 'FULL ACCESS GRANTED' : 'PENDING APPROVAL'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ERROR STATE ─── */}
        {error && (
          <div className="bg-[rgba(255,51,102,0.08)] border-2 border-[#ff3366] p-4 flex items-center gap-3 shadow-[3px_3px_0px_#000]" style={{ borderRadius: 0 }}>
            <AlertCircle size={18} className="text-[#ff3366] shrink-0" />
            <span className="text-xs font-bold text-[#ff8099] uppercase">{error}</span>
            <button onClick={loadWorkspace} className="ml-auto text-[10px] font-bold text-[#ff3366] border border-[rgba(255,51,102,0.4)] px-2 py-1 hover:bg-[rgba(255,51,102,0.1)] transition-all" style={{ borderRadius: 0 }}>RETRY</button>
          </div>
        )}

        {/* ── PENDING NOTICE ─── */}
        {isPending && (
          <div className="bg-[rgba(252,206,10,0.06)] border-2 border-[#fcce0a] p-5 flex items-start gap-4 shadow-[4px_4px_0px_#000]" style={{ borderRadius: 0 }}>
            <div className="w-10 h-10 bg-[rgba(252,206,10,0.1)] border border-[rgba(252,206,10,0.4)] flex items-center justify-center shrink-0 mt-1" style={{ borderRadius: 0 }}>
              <AlertCircle size={20} className="text-[#fcce0a]" />
            </div>
            <div>
              <h3 className="font-black text-sm text-[#fcce0a] uppercase tracking-wider mb-2">
                ACCOUNT PENDING ROOT ADMINISTRATOR APPROVAL
              </h3>
              <p className="text-xs text-[#8b99aa] leading-relaxed max-w-2xl">
                Your Game Master registration has been submitted. For platform integrity, GMs must be approved
                by the Root Administrator before creating events, designing games, or hosting live sessions.
              </p>
              <div className="mt-3 px-3 py-2 bg-[#050608] border border-[rgba(252,206,10,0.3)] text-[10px] text-[#fcce0a] font-mono" style={{ borderRadius: 0 }}>
                STATUS: PENDING_APPROVAL • Controls unlock immediately upon root approval.
              </div>
            </div>
          </div>
        )}

        {/* ── METRICS STRIP (approved only) ─── */}
        {isApproved && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total Sessions" value={data?.sessions.length ?? '—'} accent="#00ffcc" sub="all time" icon={Sliders} />
              <MetricCard label="Active Events" value={data?.events.length ?? '—'} accent="#a855f7" sub="published" icon={Calendar} />
              <MetricCard label="Game Modules" value={data?.games.length ?? '—'} accent="#fcce0a" sub="designed" icon={Gamepad2} />
              <MetricCard label="Live Now" value={activeSessions.length} accent="#ff007f" sub="in-progress" icon={Radio} />
            </div>

            {/* ── NAV TABS + QUICK ACTIONS ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1a222e] pb-0">
              {/* Tabs */}
              <div className="flex items-center gap-0">
                {([
                  { key: 'sessions', label: `SESSIONS (${data?.sessions.length || 0})`, icon: Sliders },
                  { key: 'events', label: `EVENTS (${data?.events.length || 0})`, icon: Calendar },
                  { key: 'games', label: `GAMES (${data?.games.length || 0})`, icon: Gamepad2 },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black tracking-widest border-t border-l border-r transition-all cursor-pointer ${
                      activeTab === tab.key
                        ? 'bg-[#00ffcc] text-black border-[#00ffcc] shadow-[2px_0px_0px_#000,-1px_0px_0px_#000]'
                        : 'bg-[#0f1319] text-[#5e6b7c] border-[#1a222e] hover:text-white hover:bg-[#161c24]'
                    }`}
                    style={{ borderRadius: 0, marginBottom: '-2px' }}>
                    <tab.icon size={11} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.key.toUpperCase()}</span>
                  </button>
                ))}
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-2">
                <Link to="/clubs">
                  <button className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-3 py-2 border border-[#2d3848] text-[#8b99aa] bg-[#0f1319] hover:text-white hover:border-[#48566a] transition-all" style={{ borderRadius: 0 }}>
                    <Users size={11} />
                    <span className="hidden sm:inline">CLUB PORTAL</span>
                  </button>
                </Link>
                <Link to="/games/new">
                  <button className="flex items-center gap-1.5 text-[10px] font-black tracking-widest px-3 py-2 border-2 border-black bg-[#00ffcc] text-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] active:translate-x-0.5 active:translate-y-0.5 transition-all" style={{ borderRadius: 0 }}>
                    <Plus size={11} />
                    <span>NEW GAME</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* ── TAB: SESSIONS ─── */}
            {activeTab === 'sessions' && (
              <div className="flex flex-col gap-5">
                {(!data?.sessions || data.sessions.length === 0) ? (
                  <div className="bg-[#0f1319] border border-[#1a222e] p-12 text-center shadow-[4px_4px_0px_#000]" style={{ borderRadius: 0 }}>
                    <Sliders size={32} className="mx-auto text-[#3d4754] mb-4" />
                    <div className="text-sm font-black text-[#5e6b7c] uppercase mb-2">NO SESSIONS INITIALIZED</div>
                    <p className="text-xs text-[#3d4754]">Launch an event session to monitor participants and leaderboard rankings.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {data.sessions.map(s => {
                      const isExpanded = expandedSessionId === s.id;
                      const isActive = s.status.includes('ACTIVE') || s.status === 'LOBBY';
                      return (
                        <div key={s.id} className={`bg-[#0f1319] border shadow-[4px_4px_0px_#000] relative overflow-hidden ${
                          isActive ? 'border-[rgba(0,255,204,0.5)]' : 'border-[#2d3848]'
                        }`} style={{ borderRadius: 0 }}>
                          {/* Active session top accent */}
                          {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#00ffcc]" />}

                          {/* Session Header */}
                          <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[#00ffcc] text-[10px] font-bold tracking-[0.2em]">// ROOM:{s.roomCode}</span>
                              <span className="font-black text-sm text-white">{s.eventName}</span>
                              <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 border flex items-center gap-1.5 ${
                                isActive
                                  ? 'border-[rgba(0,255,204,0.5)] text-[#00ffcc] bg-[rgba(0,255,204,0.06)]'
                                  : s.status === 'ENDED'
                                  ? 'border-[#2d3848] text-[#5e6b7c] bg-[#0a0c10]'
                                  : 'border-[rgba(252,206,10,0.5)] text-[#fcce0a] bg-[rgba(252,206,10,0.06)]'
                              }`} style={{ borderRadius: 0 }}>
                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                                {s.status}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Link to={`/sessions/${s.roomCode}/host`}>
                                <button className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1.5 bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all" style={{ borderRadius: 0 }}>
                                  <Play size={9} fill="currentColor" />
                                  HOST
                                </button>
                              </Link>
                              <Link to={`/stage/${s.roomCode}`} target="_blank">
                                <button className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-1.5 border border-[#2d3848] text-[#8b99aa] bg-[#0f1319] hover:text-white hover:border-[#48566a] transition-all" style={{ borderRadius: 0 }}>
                                  <Tv size={9} />
                                  STAGE
                                </button>
                              </Link>
                              <Link to={`/presenter/${s.roomCode}`} target="_blank">
                                <button className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-1.5 border border-[#2d3848] text-[#8b99aa] bg-[#0f1319] hover:text-white hover:border-[#48566a] transition-all" style={{ borderRadius: 0 }}>
                                  <Presentation size={9} />
                                  PRESENTER
                                </button>
                              </Link>
                              <button
                                onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                                className="flex items-center gap-1 text-[9px] font-bold px-2.5 py-1.5 border border-[rgba(0,255,204,0.3)] text-[#00ffcc] bg-[rgba(0,255,204,0.05)] hover:bg-[rgba(0,255,204,0.1)] transition-all" style={{ borderRadius: 0 }}>
                                <Eye size={9} />
                                {isExpanded ? 'HIDE' : 'BOARD'}
                              </button>
                            </div>
                          </div>

                          {/* Session Metrics */}
                          <div className="px-4 py-3 flex flex-wrap items-center gap-5 text-xs border-b border-[#1a222e]">
                            <span className="text-[#5e6b7c]">GAME: <strong className="text-[#00ffcc]">{s.gameName}</strong></span>
                            <span className="text-[#5e6b7c]">TEMPLATE: <strong className="text-white">{s.gameTemplate}</strong></span>
                            <span className="text-[#5e6b7c]">PLAYERS: <strong className="text-[#3fb950]">{s.playerCount}</strong></span>
                            <span className="text-[#5e6b7c]">SUBMISSIONS: <strong className="text-[#fcce0a]">{s.submissionCount}</strong></span>
                          </div>

                          {/* Collapsible Leaderboard */}
                          {isExpanded && (
                            <div className="p-4 font-mono text-xs">
                              <div className="flex items-center gap-2 mb-3">
                                <Users size={12} className="text-[#00ffcc]" />
                                <span className="text-[10px] font-bold text-[#00ffcc] tracking-[0.2em] uppercase">
                                  PARTICIPANTS & SCORES ({s.leaderboard.length})
                                </span>
                              </div>
                              {s.leaderboard.length === 0 ? (
                                <div className="text-center py-6 text-[#3d4754] bg-[#0a0c10] border border-[#1a222e]" style={{ borderRadius: 0 }}>
                                  No students enrolled yet. Share Room Code{' '}
                                  <span className="text-[#00ffcc] font-bold">{s.roomCode}</span>
                                </div>
                              ) : (
                                <div className="overflow-x-auto border border-[#1a222e]" style={{ borderRadius: 0 }}>
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-[#161c24] border-b border-[#1a222e] text-[9px] text-[#5e6b7c] uppercase tracking-widest">
                                        <th className="p-2.5 w-12 text-center">RANK</th>
                                        <th className="p-2.5">STUDENT</th>
                                        <th className="p-2.5">USN</th>
                                        <th className="p-2.5 hidden md:table-cell">EMAIL</th>
                                        <th className="p-2.5 text-right">SCORE</th>
                                        <th className="p-2.5 text-center">STATUS</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1a222e] bg-[#0f1319]">
                                      {s.leaderboard.map(p => (
                                        <tr key={p.playerId} className="hover:bg-[#161c24] transition-colors">
                                          <td className="p-2.5 text-center font-black text-sm">
                                            {p.rank === 1 ? (
                                              <span className="text-[#fcce0a]">🥇 1</span>
                                            ) : p.rank === 2 ? (
                                              <span className="text-[#c0c0c0]">🥈 2</span>
                                            ) : p.rank === 3 ? (
                                              <span className="text-[#cd7f32]">🥉 3</span>
                                            ) : (
                                              <span className="text-[#5e6b7c]">#{p.rank}</span>
                                            )}
                                          </td>
                                          <td className="p-2.5 font-bold text-white">{p.name}</td>
                                          <td className="p-2.5 text-[#00ffcc] font-mono">{p.usn}</td>
                                          <td className="p-2.5 text-[#8b99aa] truncate max-w-[200px] hidden md:table-cell">{p.email}</td>
                                          <td className="p-2.5 text-right font-black text-[#3fb950]">{p.score} <span className="text-[#5e6b7c] font-normal text-[9px]">PTS</span></td>
                                          <td className="p-2.5 text-center">
                                            <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 border ${
                                              p.status === 'ACTIVE'
                                                ? 'border-[rgba(63,185,80,0.4)] text-[#3fb950] bg-[rgba(63,185,80,0.08)]'
                                                : 'border-[#1a222e] text-[#5e6b7c]'
                                            }`} style={{ borderRadius: 0 }}>
                                              {p.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: EVENTS ─── */}
            {activeTab === 'events' && (
              <div className="flex flex-col gap-4">
                {(!data?.events || data.events.length === 0) ? (
                  <div className="bg-[#0f1319] border border-[#1a222e] p-12 text-center shadow-[4px_4px_0px_#000]" style={{ borderRadius: 0 }}>
                    <Calendar size={32} className="mx-auto text-[#3d4754] mb-4" />
                    <div className="text-sm font-black text-[#5e6b7c] uppercase mb-2">NO EVENTS CREATED</div>
                    <p className="text-xs text-[#3d4754] mb-5">Create a tournament event to group challenges and launch live sessions.</p>
                    <Link to="/clubs">
                      <button className="text-[10px] font-black px-4 py-2.5 bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all" style={{ borderRadius: 0 }}>
                        GO TO EVENT CREATOR
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.events.map(e => (
                      <div key={e.id} className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative flex flex-col" style={{ borderRadius: 0 }}>
                        {/* Mode tag top */}
                        <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2 flex items-center justify-between">
                          <span className="text-[9px] text-[#5e6b7c] font-bold tracking-[0.2em] uppercase">// MODE:{e.mode}</span>
                          <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 border ${
                            e.status === 'PUBLISHED'
                              ? 'border-[rgba(63,185,80,0.4)] text-[#3fb950] bg-[rgba(63,185,80,0.08)]'
                              : 'border-[#1a222e] text-[#5e6b7c]'
                          }`} style={{ borderRadius: 0 }}>{e.status}</span>
                        </div>

                        <div className="p-4 flex-1">
                          <h3 className="font-black text-base text-white mb-2">{e.name}</h3>
                          <p className="text-xs text-[#8b99aa] line-clamp-2 mb-4">{e.description || 'No description provided.'}</p>
                          <div className="flex gap-4 text-xs text-[#5e6b7c]">
                            <span>Games: <strong className="text-[#00ffcc]">{e.gameCount}</strong></span>
                            <span>Sessions: <strong className="text-[#3fb950]">{e.sessionCount}</strong></span>
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-2 border-t border-[#1a222e] flex gap-2">
                          <button
                            onClick={() => handleLaunchSession(e.id)}
                            disabled={actionLoading || e.status !== 'PUBLISHED'}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-black px-3 py-2 bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ borderRadius: 0 }}>
                            <Play size={10} fill="currentColor" />
                            LAUNCH SESSION
                          </button>
                          <Link to={`/clubs/default/events/${e.id}/edit`}>
                            <button className="text-[10px] font-bold px-3 py-2 border border-[#2d3848] text-[#8b99aa] bg-[#161c24] hover:text-white hover:border-[#48566a] transition-all" style={{ borderRadius: 0 }}>
                              EDIT
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: GAMES ─── */}
            {activeTab === 'games' && (
              <div className="flex flex-col gap-4">
                {(!data?.games || data.games.length === 0) ? (
                  <div className="bg-[#0f1319] border border-[#1a222e] p-12 text-center shadow-[4px_4px_0px_#000]" style={{ borderRadius: 0 }}>
                    <Gamepad2 size={32} className="mx-auto text-[#3d4754] mb-4" />
                    <div className="text-sm font-black text-[#5e6b7c] uppercase mb-2">NO GAMES DESIGNED</div>
                    <p className="text-xs text-[#3d4754] mb-5">Create Quiz, Bug Hunt, Logic Heist, or Threshold game modules.</p>
                    <Link to="/games/new">
                      <button className="text-[10px] font-black px-4 py-2.5 bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all" style={{ borderRadius: 0 }}>
                        CREATE YOUR FIRST GAME
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.games.map(g => (
                      <div key={g.id} className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative flex flex-col" style={{ borderRadius: 0 }}>
                        <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2 flex items-center justify-between">
                          <span className="text-[9px] text-[#a855f7] font-bold tracking-[0.2em] uppercase">// {g.template}</span>
                          <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 border ${
                            g.status === 'PUBLISHED'
                              ? 'border-[rgba(63,185,80,0.4)] text-[#3fb950] bg-[rgba(63,185,80,0.08)]'
                              : 'border-[#1a222e] text-[#5e6b7c]'
                          }`} style={{ borderRadius: 0 }}>{g.status}</span>
                        </div>
                        <div className="p-4 flex-1">
                          <h3 className="font-black text-sm text-white mb-3">{g.name}</h3>
                          <div className="flex gap-4 text-xs text-[#5e6b7c]">
                            <span>Questions: <strong className="text-[#00ffcc]">{g.challengeCount}</strong></span>
                            <span>Hosted: <strong className="text-[#3fb950]">{g.sessionCount}</strong></span>
                          </div>
                        </div>
                        <div className="px-4 pb-4 pt-2 border-t border-[#1a222e] flex gap-2">
                          <Link to={`/clubs/default/games/${g.id}/edit`} className="flex-1">
                            <button className="w-full text-[10px] font-bold px-3 py-2 border border-[#2d3848] text-[#8b99aa] bg-[#161c24] hover:text-white hover:border-[#48566a] transition-all" style={{ borderRadius: 0 }}>
                              EDIT QUESTIONS
                            </button>
                          </Link>
                          <Link to={`/clubs/default/games/${g.id}/host`}>
                            <button className="text-[10px] font-black px-3 py-2 bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all" style={{ borderRadius: 0 }}>
                              HOST
                            </button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── FOOTER STATUS BAR ─── */}
      <footer className="relative z-20 w-full bg-[#0a0c10] border-t border-[#1a222e] px-4 py-1.5 flex items-center justify-between text-[9px] font-mono text-[#3d4754]">
        <div className="flex items-center gap-3">
          <span className="text-[#00ffcc]">GM_WORKSPACE</span>
          <span>•</span>
          <span>ROLE: GAME_MASTER</span>
          {data && <><span>•</span><span>{data.sessions.length} SESSION(S) TOTAL</span></>}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-pulse" />
          <span className="text-[#3fb950]">SYSTEM NOMINAL</span>
        </div>
      </footer>
    </div>
  );
}
