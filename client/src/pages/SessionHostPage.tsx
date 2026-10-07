import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { connectSocket } from '../lib/socket';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';
import {
  Terminal,
  Users,
  Play,
  SkipForward,
  StopCircle,
  Lock,
  Trophy,
  Check,
  Cpu,
  Radio,
  Zap,
  Pause,
  AlertTriangle,
  Tv,
  Presentation,
  Copy,
  ChevronRight,
  Activity,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

import { TerminalBackButton } from '../components/ui/TerminalBackButton';

export default function SessionHostPage() {
  const { sessionCode, clubId } = useParams<{ sessionCode: string; clubId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const code = sessionCode?.toUpperCase() || '';
  const socketRef = useRef<any>(null);
  const hadSocketRef = useRef(false);

  const [hostLoad, setHostLoad] = useState<'loading' | 'live' | 'notfound' | 'unauthorized' | 'error'>('loading');
  const [hostError, setHostError] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [sessionData, setSessionData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [tick, setTick] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [leaderboardTab, setLeaderboardTab] = useState<'TEAM' | 'SOLO'>('TEAM');
  const [rosterTab, setRosterTab] = useState<'TEAMS' | 'PLAYERS'>('TEAMS');

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    let cancelled = false;

    // Authenticated authoritative host load — distinguishes NOT FOUND /
    // UNAUTHORIZED / LIVE instead of a silent redirect back to the workspace.
    const loadHost = async () => {
      try {
        const res = await api.get(`/sessions/${code}/host`);
        if (cancelled) return;
        setSessionData((prev: any) => prev
          ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } }
          : res.data);
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) setHostLoad('notfound');
        else if (status === 403) setHostLoad('unauthorized');
        else {
          setHostLoad('error');
          setHostError(err?.response?.data?.error || err?.message || 'Failed to load host session.');
        }
      } finally {
        if (!cancelled) setHostLoad(h => (h === 'loading' ? 'live' : h));
      }
    };

    const socket = connectSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('host:join', { roomCode: code });
    };
    const onDisconnect = () => setConnected(false);
    const onStateUpdate = (data: any) => setSessionData(data);
    const onSocketError = (err: any) => {
      if (err?.message) setActionError(err.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session_state_update', onStateUpdate);
    socket.on('error', onSocketError);

    void loadHost();

    // Public state (leaderboard / roster / presence) — non-fatal if it fails.
    api.get(`/sessions/${code}`).then(res => {
      if (!cancelled) setSessionData(res.data);
    }).catch(() => {});

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session_state_update', onStateUpdate);
      socket.off('error', onSocketError);
    };
  }, [code, user, navigate]);

  // Reconnect recovery: after a socket drop, re-subscribe as HOST and refetch
  // both the authoritative host state and the public room state. The server
  // remains the source of truth — a GM refresh always restores the room.
  useEffect(() => {
    if (connected) {
      if (hadSocketRef.current) {
        socketRef.current?.emit('host:join', { roomCode: code });
        api.get(`/sessions/${code}`).then((res: any) => setSessionData(res.data)).catch(() => {});
        api.get(`/sessions/${code}/host`).then((res: any) => {
          setSessionData((prev: any) => prev ? { ...prev, session: { ...prev.session, ...res.data.session } } : res.data);
        }).catch(() => {});
      } else {
        hadSocketRef.current = true;
      }
    }
  }, [connected, code]);

  const changeStatus = (status: string) => socketRef.current?.emit('host:change_status', { status });
  const refreshPublicState = () => {
    api.get(`/sessions/${code}`).then((res: any) => setSessionData(res.data)).catch(() => {});
  };
  const sendHostCommand = async (route: string, label: string) => {
    if (actionBusy) return;
    setActionBusy(label);
    setActionError(null);
    try {
      await api.post(`/sessions/${code}${route}`);
      refreshPublicState();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Command rejected by the server.');
    } finally {
      setActionBusy(null);
    }
  };
  const advanceGame = () => {
    if (sessionData?.event?.mode === 'RANDOM') {
      socketRef.current?.emit('host:random_game');
    } else if (window.confirm('Skip to the next game?')) {
      socketRef.current?.emit('host:skip_game');
    }
  };
  const replayGame = () => {
    if (window.confirm('Replay current game? Previous submissions will be preserved.')) {
      socketRef.current?.emit('host:replay_game');
    }
  };
  const randomGame = () => socketRef.current?.emit('host:random_game');
  const endEvent = async () => {
    if (actionBusy) return;
    if (window.confirm('END EVENT?\n\nThis will stop the live session for all players.')) {
      await sendHostCommand('/end', 'end');
    }
  };
  const newSession = async () => {
    // ENDED is terminal — a fresh HOST creates a brand-new session + room code.
    const gameId = sessionData?.session?.currentGameId;
    if (!gameId) {
      setActionError('Cannot re-host: game reference missing.');
      return;
    }
    setActionBusy('new');
    setActionError(null);
    try {
      const res = await api.post('/sessions', { gameId });
      const newCode = res.data.session.code || res.data.session.roomCode;
      navigate(`/sessions/${newCode}/host`);
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to create a new session.');
      setActionBusy(null);
    }
  };
  const selectSpecificGame = (gameId: string, position: number) => {
    socketRef.current?.emit('host:select_game', { gameId, position });
  };
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const downloadReport = async () => {
    if (!sessionData?.session?.id) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const token = localStorage.getItem('terminal_token');
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/sessions/${sessionData.session.id}/report`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDownloadError(body.message || body.error || `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      // Extract filename from Content-Disposition header if available
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `TERMINAL_${code}_REPORT.xlsx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadError(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (hostLoad === 'loading' || !sessionData) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00ffcc] border-t-transparent animate-spin" style={{ borderRadius: 0 }} />
          <div className="text-[#5e6b7c] text-xs tracking-[0.3em] uppercase">// LOADING SESSION...</div>
          <div className="text-[#3d4754] text-[10px] font-mono">ROOM {code}</div>
        </div>
      </div>
    );
  }

  if (hostLoad === 'notfound') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#fcce0a] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#fcce0a] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// SESSION NOT FOUND</div>
          <div className="text-white font-black text-lg mb-1">No live session for room {code}</div>
          <div className="text-[#5e6b7c] text-xs mb-5">Check the room code, or host the game again from the Game Master workspace.</div>
          <button
            onClick={() => navigate('/gm?tab=games')}
            className="px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all w-full"
            style={{ borderRadius: 0 }}>
            [ BACK TO GM WORKSPACE ]
          </button>
        </div>
      </div>
    );
  }

  if (hostLoad === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#ff3366] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#ff3366] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// ACCESS DENIED</div>
          <div className="text-white font-black text-lg mb-1">You are not authorized to control room {code}</div>
          <div className="text-[#5e6b7c] text-xs mb-5">Only the hosting Game Master (or a club admin) can control this live session.</div>
          <button
            onClick={() => navigate('/gm')}
            className="px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all w-full"
            style={{ borderRadius: 0 }}>
            [ BACK TO GM WORKSPACE ]
          </button>
        </div>
      </div>
    );
  }

  if (hostLoad === 'error') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#ff3366] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#ff3366] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// HOST LOAD FAILED</div>
          <div className="text-white font-black text-lg mb-1">Could not load session state</div>
          <div className="text-[#e6edf3] text-xs mb-5 whitespace-pre-wrap">{hostError}</div>
          <button
            onClick={() => { setHostLoad('loading'); setHostError(''); api.get(`/sessions/${code}/host`).then((res: any) => {
              setSessionData((prev: any) => prev ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } } : res.data);
              setHostLoad('live');
            }).catch((err: any) => {
              setHostLoad('error');
              setHostError(err?.response?.data?.error || err?.message || 'Retry failed.');
            }); }}
            className="px-4 py-2.5 text-[11px] font-black bg-[#fcce0a] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#ffd92b] transition-all w-full"
            style={{ borderRadius: 0 }}>
            [ RETRY ]
          </button>
        </div>
      </div>
    );
  }

  const ss = sessionData.session;
  const state = ss.status;
  const isLobby = state === 'LOBBY';
  const isStarting = state === 'STARTING';
  const isQuestionActive = state === 'QUESTION_ACTIVE';
  const isQuestionLocked = state === 'QUESTION_LOCKED';
  const isQuestionResults = state === 'QUESTION_RESULTS';
  const isLeaderboard = state === 'RESULTS';
  const isEnded = state === 'ENDED';
  const isRoundActive = state === 'ROUND_ACTIVE';
  const isChainGame = ['CHAIN_REACTION', 'DATA_HUNT', 'LOGIC_HEIST', 'BUG_HUNT', 'THE_WITNESS'].includes(sessionData.currentGame?.template);

  const stateColor =
    isQuestionActive || isRoundActive ? '#3fb950' :
    isLobby ? '#fcce0a' :
    isEnded ? '#5e6b7c' :
    '#00ffcc';

  const cursor = tick % 2 === 0 ? '█' : ' ';

  // Server-authoritative question countdown (from session.questionEndsAt).
  const endsAt = sessionData?.session?.questionEndsAt ? new Date(sessionData.session.questionEndsAt).getTime() : null;
  const qRemaining = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null;
  const qExpired = qRemaining !== null && qRemaining <= 0;
  const busyLabel = actionBusy ? `[${actionBusy.toUpperCase()}...]` : null;

  const stageModes = ['LOBBY', 'ANNOUNCEMENT', 'COUNTDOWN', 'QUESTION', 'ANSWER_REVEAL', 'LEADERBOARD', 'TEAM_LEADERBOARD', 'FINAL_RESULTS', 'PAUSED', 'BLANK'];

  return (
    <div className="min-h-screen flex flex-col bg-[#050608] font-mono text-[#e6edf3]">

      {/* ── Cyber Grid Background ─── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0,255,204,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── STICKY TOP COMMAND BAR ─── */}
      <header
        className="relative z-50 w-full bg-[#0a0c10] border-b-2 border-[#1a222e] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 min-h-[52px]"
        style={{ borderRadius: 0 }}>

        {/* Back Button */}
        <div className="flex items-center gap-2 shrink-0">
          <TerminalBackButton
            to={clubId ? `/clubs/${clubId}` : '/gm?tab=sessions'}
            label="[ESC / BACK]"
            hasUnsavedChanges={!isEnded}
            unsavedMessage="Session is active. Return to GM workspace? (Live session will remain running)"
            className="shrink-0"
          />
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 bg-[#00ffcc] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]" style={{ borderRadius: 0 }}>
              <span className="text-black font-black text-xs">&gt;_</span>
            </div>
            <span className="font-black text-xs tracking-widest text-white hidden sm:block" style={{ fontFamily: "'Orbitron', monospace" }}>TERMINAL</span>
          </div>
        </div>

        <div className="w-px h-6 bg-[#1a222e] shrink-0 hidden sm:block" />

        {/* Session status badge */}
        <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest" style={{ color: stateColor }}>
          {(isQuestionActive || isRoundActive) && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: stateColor }} />}
          <span>{state}</span>
        </div>

        {/* Event name */}
        <span className="font-black text-sm text-white truncate flex-1 hidden md:block">
          {sessionData.event.name}
        </span>

        {/* Room code — clickable copy */}
        <button
          onClick={copyCode}
          className="flex items-center gap-2 px-3 py-1.5 border border-[rgba(0,255,204,0.4)] bg-[rgba(0,255,204,0.06)] hover:bg-[rgba(0,255,204,0.12)] transition-all shrink-0"
          style={{ borderRadius: 0 }}>
          <span className="font-black text-base text-[#00ffcc] tracking-[0.3em] font-mono">{code}</span>
          {codeCopied
            ? <Check size={12} className="text-[#3fb950]" />
            : <Copy size={10} className="text-[#5e6b7c]" />}
        </button>

        {/* Players */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <Users size={12} className="text-[#5e6b7c]" />
          <strong className="text-white font-black">{sessionData.playerCount}</strong>
        </div>

        {/* Connection status */}
        <div className={`flex items-center gap-1.5 text-[10px] font-bold tracking-widest shrink-0 ${connected ? 'text-[#3fb950]' : 'text-[#fcce0a]'}`}>
          <Radio size={10} className={connected ? '' : 'animate-pulse'} />
          <span className="hidden sm:inline">{connected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </header>

      {/* ── STATUS BANNERS ─── */}
      {!connected && (
        <div className="relative z-30 w-full bg-[rgba(252,206,10,0.12)] border-b border-[rgba(252,206,10,0.4)] px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-[#fcce0a] font-mono">
          <Radio size={10} className="animate-pulse" />
          SOCKET DISCONNECTED — RECONNECTING... HOST CONTROLS STAY ACTIVE VIA REST
        </div>
      )}
      {actionError && (
        <div className="relative z-30 w-full bg-[rgba(255,51,102,0.1)] border-b border-[rgba(255,51,102,0.4)] px-4 py-2 flex items-center justify-between gap-2 text-[10px] font-mono text-[#ff3366]">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={10} className="shrink-0" />
            <span className="truncate">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="font-black shrink-0 hover:text-white transition-colors">[X]</button>
        </div>
      )}

      {/* ── MAIN GRID ─── */}
      <div className="relative z-10 flex-1 p-4 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 overflow-auto">

        {/* ══ LEFT COLUMN ══ */}
        <div className="flex flex-col gap-4">

          {/* SESSION CONTROL PANEL */}
          <div className="bg-[#0f1319] border-2 border-[rgba(0,255,204,0.4)] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ffcc] pointer-events-none" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ffcc] pointer-events-none" />

            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex items-center justify-between">
              <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">// SESSION_CONTROLS</span>
              <div className="flex items-center gap-2 text-[9px] text-[#5e6b7c] font-mono">
                <Activity size={10} />
                <span>ROOM {code}{cursor}</span>
              </div>
            </div>

            <div className="p-4 flex flex-wrap gap-2">

              {/* LOBBY → START EVENT */}
              {isLobby && (
                <button onClick={() => sendHostCommand('/start', 'start')}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#3fb950] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#4bcc5c] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderRadius: 0 }}>
                  <Play size={13} fill="currentColor" /> {actionBusy === 'start' ? 'STARTING...' : 'START EVENT'}
                </button>
              )}

              {/* STARTING → START GAME */}
              {isStarting && (
                <button onClick={() => sendHostCommand('/start', 'start')}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderRadius: 0 }}>
                  <Play size={13} fill="currentColor" /> {actionBusy === 'start' ? 'STARTING...' : 'START GAME'}
                </button>
              )}

              {/* Authoritative question countdown (server clock) */}
              {isQuestionActive && qRemaining !== null && (
                <div
                  className={`flex items-center gap-2 px-3 py-2.5 text-[11px] font-black border-2 border-black shadow-[2px_2px_0px_#000] ${
                    qExpired ? 'bg-[#ff3366] text-white' : qRemaining <= 10 ? 'bg-[#fcce0a] text-black animate-pulse' : 'bg-[#0a0c10] text-[#00ffcc] border-[#00ffcc]'
                  }`}
                  style={{ borderRadius: 0 }}>
                  <Zap size={12} /> {qExpired ? 'TIME EXPIRED — LOCK' : `${qRemaining}s`}
                </div>
              )}

              {/* Chain game controls */}
              {isChainGame ? (
                <>
                  {(isLeaderboard || isStarting) && (
                    <button onClick={() => changeStatus('ROUND_ACTIVE')}
                      className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#3fb950] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#4bcc5c] transition-all"
                      style={{ borderRadius: 0 }}>
                      <Play size={13} fill="currentColor" /> START ROUND
                    </button>
                  )}
                  {isRoundActive && (
                    <button onClick={() => changeStatus('RESULTS')}
                      className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#161c24] text-[#e6edf3] border-2 border-[#2d3848] shadow-[2px_2px_0px_#000] hover:border-[#48566a] transition-all"
                      style={{ borderRadius: 0 }}>
                      <StopCircle size={13} /> END ROUND
                    </button>
                  )}
                  {isLeaderboard && !isStarting && (
                    <>
                      <button onClick={replayGame}
                        className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#e6edf3] border border-[#2d3848] shadow-[2px_2px_0px_#000] hover:border-[#48566a] transition-all"
                        style={{ borderRadius: 0 }}>
                        <SkipForward size={13} /> REPLAY
                      </button>
                      <button onClick={advanceGame}
                        className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all"
                        style={{ borderRadius: 0 }}>
                        <SkipForward size={13} /> {sessionData.event.mode === 'RANDOM' ? 'RANDOM GAME' : 'NEXT GAME'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {isQuestionActive && (
                    <button onClick={() => sendHostCommand('/lock', 'lock')}
                      disabled={!!actionBusy}
                      className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#fcce0a] border border-[rgba(252,206,10,0.4)] shadow-[2px_2px_0px_#000] hover:bg-[rgba(252,206,10,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderRadius: 0 }}>
                      <Lock size={13} /> {actionBusy === 'lock' ? 'LOCKING...' : 'LOCK QUESTION'}
                    </button>
                  )}
                  {(isQuestionLocked || isQuestionActive) && (
                    <button onClick={() => changeStatus('QUESTION_RESULTS')}
                      className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#e6edf3] border border-[#2d3848] shadow-[2px_2px_0px_#000] hover:border-[#48566a] transition-all"
                      style={{ borderRadius: 0 }}>
                      <Trophy size={13} /> SHOW RESULTS
                    </button>
                  )}
                  {isQuestionResults && (
                    <button onClick={() => changeStatus('RESULTS')}
                      className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all"
                      style={{ borderRadius: 0 }}>
                      <Trophy size={13} /> LEADERBOARD
                    </button>
                  )}
                  {isLeaderboard && (
                    <>
                      <button onClick={replayGame}
                        className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#e6edf3] border border-[#2d3848] shadow-[2px_2px_0px_#000] hover:border-[#48566a] transition-all"
                        style={{ borderRadius: 0 }}>
                        <SkipForward size={13} /> REPLAY
                      </button>
                      <button onClick={advanceGame}
                        className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all"
                        style={{ borderRadius: 0 }}>
                        <SkipForward size={13} /> {sessionData.event.mode === 'RANDOM' ? 'RANDOM GAME' : 'NEXT GAME'}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* END EVENT */}
              {!isEnded && !isLobby && (
                <button onClick={endEvent}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-transparent text-[#ff3366] border-2 border-[#ff3366] shadow-[2px_2px_0px_rgba(255,51,102,0.5)] hover:bg-[rgba(255,51,102,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderRadius: 0 }}>
                  <StopCircle size={13} /> {actionBusy === 'end' ? 'ENDING...' : 'END EVENT'}
                </button>
              )}

              {/* ENDED — terminal. Host again for a new session. */}
              {isEnded && (
                <button onClick={newSession}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderRadius: 0 }}>
                  <Play size={13} fill="currentColor" /> {actionBusy === 'new' ? 'HOSTING...' : 'NEW SESSION'}
                </button>
              )}
            </div>
          </div>

          {/* ── GAME COMPLETE PANEL (shown only when ENDED) ── */}
          {isEnded && (
            <div className="bg-[#0f1319] border-2 border-[rgba(0,255,204,0.4)] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00ffcc] pointer-events-none" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00ffcc] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00ffcc] pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00ffcc] pointer-events-none" />

              <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">// GAME_COMPLETE</span>
                <Trophy size={14} className="text-[#00ffcc]" />
              </div>

              <div className="p-4 flex flex-col gap-3">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                    <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">Players</div>
                    <div className="font-black text-xl text-white font-mono">{sessionData.playerCount}</div>
                  </div>
                  <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                    <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">Teams</div>
                    <div className="font-black text-xl text-white font-mono">{sessionData.teamCount || '—'}</div>
                  </div>
                </div>

                {/* Room code display */}
                <div className="bg-[#0a0c10] border border-[#1a222e] p-3 text-center" style={{ borderRadius: 0 }}>
                  <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">Room Code</div>
                  <div className="font-black text-2xl text-[#00ffcc] tracking-[0.4em] font-mono">{code}</div>
                </div>

                {/* Download error */}
                {downloadError && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-[rgba(255,51,102,0.4)] bg-[rgba(255,51,102,0.08)] text-[#ff3366] text-[10px] font-mono" style={{ borderRadius: 0 }}>
                    <AlertTriangle size={11} />
                    <span className="truncate">{downloadError}</span>
                  </div>
                )}

                {/* Download button */}
                <button
                  id="btn-download-report"
                  onClick={downloadReport}
                  disabled={downloading}
                  className={`flex items-center justify-center gap-2.5 px-4 py-3 text-[12px] font-black tracking-widest border-2 transition-all w-full ${
                    downloading
                      ? 'bg-[#0f1319] text-[#5e6b7c] border-[#2d3848] cursor-not-allowed'
                      : 'bg-[#00ffcc] text-black border-black shadow-[3px_3px_0px_#000] hover:bg-[#00ffd5] active:translate-x-0.5 active:translate-y-0.5'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  {downloading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#5e6b7c] border-t-transparent animate-spin" style={{ borderRadius: 0 }} />
                      GENERATING...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet size={14} />
                      DOWNLOAD GAME REPORT
                    </>
                  )}
                </button>

                <p className="text-[8px] text-[#3d4754] font-mono text-center leading-relaxed">
                  TERMINAL_{sessionData.game?.name?.toUpperCase().replace(/\s+/g, '_') || 'GAME'}_{code}_REPORT.xlsx
                </p>
              </div>
            </div>
          )}

          {/* ── LIVE LEADERBOARD / SCOREBOARD ── */}
          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy size={13} className="text-[#00ffcc]" />
                <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">
                  // LIVE_SCOREBOARD {sessionData.timeBonusConfig?.enabled ? '[TIME_BONUS_CONFIGURED]' : ''}
                </span>
              </div>
              {/* Tab toggle */}
              <div className="flex items-center gap-1 bg-[#0a0c10] p-0.5 border border-[#1a222e]">
                <button
                  onClick={() => setLeaderboardTab('TEAM')}
                  className={`px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase transition-all ${
                    leaderboardTab === 'TEAM'
                      ? 'bg-[#00ffcc] text-black shadow-[1px_1px_0px_#000]'
                      : 'text-[#5e6b7c] hover:text-white'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  TEAMS ({sessionData.teamLeaderboard?.length || 0})
                </button>
                <button
                  onClick={() => setLeaderboardTab('SOLO')}
                  className={`px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase transition-all ${
                    leaderboardTab === 'SOLO'
                      ? 'bg-[#00ffcc] text-black shadow-[1px_1px_0px_#000]'
                      : 'text-[#5e6b7c] hover:text-white'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  SOLO ({sessionData.individualLeaderboard?.length || 0})
                </button>
              </div>
            </div>

            <div className="p-3">
              {leaderboardTab === 'TEAM' ? (
                <div className="flex flex-col gap-2">
                  {(!sessionData.teamLeaderboard || sessionData.teamLeaderboard.length === 0) ? (
                    <div className="text-center py-6 text-xs text-[#5e6b7c] font-mono">
                      // NO ACTIVE SQUADS REGISTERED YET
                    </div>
                  ) : (
                    sessionData.teamLeaderboard.map((team: any, idx: number) => {
                      const rank = team.rank ?? idx + 1;
                      const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#5e6b7c';
                      return (
                        <div
                          key={team.teamId || idx}
                          className="bg-[#0a0c10] border border-[#1a222e] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-[rgba(0,255,204,0.3)] transition-all"
                          style={{ borderRadius: 0 }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-7 h-7 flex items-center justify-center font-black text-xs shrink-0 border border-[#2d3848]"
                              style={{ color: rankColor, borderColor: rank <= 3 ? rankColor : '#2d3848' }}
                            >
                              #{rank}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-white truncate flex items-center gap-2">
                                <span>{team.teamName}</span>
                                <span className="text-[10px] text-[#5e6b7c] font-mono">({team.members?.length || 0} agents)</span>
                              </div>
                              <div className="text-[10px] text-[#8b99aa] font-mono truncate mt-0.5">
                                {team.members?.map((m: any) => `${m.username}@terminal (${m.score} pts)`).join(' • ') || 'No members'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            {sessionData.timeBonusConfig?.enabled && (
                              <div className="text-right">
                                <div className="text-[8px] text-[#5e6b7c] uppercase">Base + Bonus</div>
                                <div className="text-xs font-mono text-[#8b99aa]">
                                  {team.baseScore ?? team.finalScore} + <span className="text-[#3fb950] font-bold">{team.timeBonus || 0}</span>
                                </div>
                              </div>
                            )}
                            <div className="text-right min-w-[70px]">
                              <div className="text-[8px] text-[#5e6b7c] uppercase">Total Score</div>
                              <div className="text-base font-black text-[#00ffcc] font-mono">
                                {team.finalScore ?? team.baseScore ?? 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {(!sessionData.individualLeaderboard || sessionData.individualLeaderboard.length === 0) ? (
                    <div className="text-center py-6 text-xs text-[#5e6b7c] font-mono">
                      // NO INDIVIDUAL SCORES LOGGED
                    </div>
                  ) : (
                    sessionData.individualLeaderboard.map((ind: any, idx: number) => {
                      const rank = ind.rank ?? idx + 1;
                      const rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#5e6b7c';
                      return (
                        <div
                          key={ind.playerId || idx}
                          className="bg-[#0a0c10] border border-[#1a222e] p-2.5 flex items-center justify-between gap-2 hover:border-[rgba(0,255,204,0.3)] transition-all"
                          style={{ borderRadius: 0 }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-6 h-6 flex items-center justify-center font-black text-xs shrink-0 border border-[#2d3848]"
                              style={{ color: rankColor, borderColor: rank <= 3 ? rankColor : '#2d3848' }}
                            >
                              #{rank}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white truncate font-mono">
                                {ind.username}@terminal
                              </div>
                              <div className="text-[9px] text-[#5e6b7c] font-mono truncate">
                                {ind.teamName ? `TEAM: ${ind.teamName}` : 'SOLO'} • {ind.questionsCorrect ?? 0}/{ind.questionsAttempted ?? 0} ACCURACY
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-black text-[#00ffcc] font-mono">
                              {ind.score} PTS
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── PARTICIPANT ROSTER & SQUAD MONITOR ── */}
          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-[#00ffcc]" />
                <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">
                  // PARTICIPANT_ROSTER & SQUAD_MONITOR
                </span>
              </div>
              <div className="flex items-center gap-1 bg-[#0a0c10] p-0.5 border border-[#1a222e]">
                <button
                  onClick={() => setRosterTab('TEAMS')}
                  className={`px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase transition-all ${
                    rosterTab === 'TEAMS'
                      ? 'bg-[#00ffcc] text-black shadow-[1px_1px_0px_#000]'
                      : 'text-[#5e6b7c] hover:text-white'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  SQUADS ({sessionData.teamRoster?.teams?.length || 0})
                </button>
                <button
                  onClick={() => setRosterTab('PLAYERS')}
                  className={`px-2.5 py-1 text-[9px] font-bold tracking-widest uppercase transition-all ${
                    rosterTab === 'PLAYERS'
                      ? 'bg-[#00ffcc] text-black shadow-[1px_1px_0px_#000]'
                      : 'text-[#5e6b7c] hover:text-white'
                  }`}
                  style={{ borderRadius: 0 }}
                >
                  ALL AGENTS ({sessionData.playerRoster?.length || sessionData.playerCount || 0})
                </button>
              </div>
            </div>

            <div className="p-3">
              {rosterTab === 'TEAMS' ? (
                <div className="flex flex-col gap-3">
                  {/* Squad Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sessionData.teamRoster?.teams?.map((team: any) => {
                      const isFull = team.membersCount >= team.maxSize;
                      return (
                        <div
                          key={team.teamId}
                          className={`p-3 border bg-[#0a0c10] flex flex-col gap-2 transition-all ${
                            isFull ? 'border-[rgba(63,185,80,0.4)]' : 'border-[#1a222e]'
                          }`}
                          style={{ borderRadius: 0 }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-white truncate font-mono">
                              {team.teamName}
                            </span>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 border font-mono ${
                                isFull
                                  ? 'text-[#3fb950] border-[rgba(63,185,80,0.4)] bg-[rgba(63,185,80,0.08)]'
                                  : 'text-[#fcce0a] border-[rgba(252,206,10,0.4)] bg-[rgba(252,206,10,0.08)]'
                              }`}
                              style={{ borderRadius: 0 }}
                            >
                              {team.membersCount}/{team.maxSize} AGENTS
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 border-t border-[#161c24] pt-2">
                            {team.members?.map((m: any) => (
                              <div key={m.playerId} className="flex items-center justify-between text-[10px] font-mono">
                                <span className="text-[#8b99aa] truncate">{m.handle}</span>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    m.connected ? 'bg-[#3fb950]' : 'bg-[#5e6b7c]'
                                  }`}
                                  title={m.connected ? 'Connected' : 'Offline'}
                                />
                              </div>
                            ))}
                            {(!team.members || team.members.length === 0) && (
                              <div className="text-[10px] text-[#5e6b7c] italic font-mono">
                                No agents assigned
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Unassigned Agents Banner */}
                  {(sessionData.teamRoster?.unassignedCount ?? 0) > 0 && (
                    <div className="p-3 border border-[rgba(252,206,10,0.3)] bg-[rgba(252,206,10,0.05)] flex flex-col gap-2" style={{ borderRadius: 0 }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#fcce0a] uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle size={12} /> UNASSIGNED AGENTS ({sessionData.teamRoster.unassignedCount})
                        </span>
                        <span className="text-[9px] text-[#5e6b7c] font-mono">Students awaiting squad placement</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sessionData.teamRoster.unassignedPlayers?.map((p: any) => (
                          <span
                            key={p.playerId}
                            className="px-2 py-0.5 bg-[#0a0c10] border border-[#2d3848] text-[9px] font-mono text-[#8b99aa] flex items-center gap-1.5"
                            style={{ borderRadius: 0 }}
                          >
                            <span className={`w-1 h-1 rounded-full ${p.connected ? 'bg-[#3fb950]' : 'bg-[#5e6b7c]'}`} />
                            {p.handle}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* All Agents List */
                <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                  {sessionData.playerRoster?.map((p: any) => (
                    <div
                      key={p.id}
                      className="p-2 border border-[#1a222e] bg-[#0a0c10] flex items-center justify-between gap-2 text-xs font-mono"
                      style={{ borderRadius: 0 }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${p.connected ? 'bg-[#3fb950]' : 'bg-[#5e6b7c]'}`} />
                        <span className="text-white font-bold truncate">{p.handle}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-[#5e6b7c] uppercase">
                          {p.teamName ? `[${p.teamName}]` : '[UNASSIGNED]'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 border border-[#2d3848] text-[#8b99aa]" style={{ borderRadius: 0 }}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CHALLENGE / ROUND PROGRESS */}
          {sessionData.currentGame && (
            <div className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
              <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">
                  // {isChainGame ? 'ROUND_PROGRESSION' : 'QUIZ_CONTROL'} — {sessionData.currentGame.name}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                {sessionData.currentGame.challenges?.map((c: any, i: number) => {
                  const isCurrent = sessionData.session.currentChallengeId === c.id;
                  let playersOnChallenge = 0;
                  if (isChainGame) {
                    playersOnChallenge = Object.values(sessionData.chainProgress || {}).filter((val: any) => val === c.id).length;
                  }
                  return (
                    <div key={c.id} className={`flex items-center justify-between p-2.5 border transition-all ${
                      (isCurrent || (isChainGame && playersOnChallenge > 0))
                        ? 'border-[rgba(0,255,204,0.5)] bg-[rgba(0,255,204,0.05)]'
                        : 'border-[#1a222e] bg-[#0a0c10]'
                    }`} style={{ borderRadius: 0 }}>
                      <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                        <span className={`text-[10px] font-black w-5 shrink-0 ${isCurrent ? 'text-[#00ffcc]' : 'text-[#3d4754]'}`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className={`text-xs font-mono truncate ${isCurrent ? 'text-[#00ffcc] font-bold' : 'text-[#8b99aa]'}`}>
                          {sessionData.currentGame.template === 'THE_WITNESS' ? `MYSTERY ${i+1}` :
                           sessionData.currentGame.template === 'LOGIC_HEIST' ? `VAULT ${i+1}` :
                           sessionData.currentGame.template === 'BUG_HUNT' ? `CASE ${i+1}` : `Q${i+1}`}: {c.prompt}
                        </span>
                      </div>
                      {isChainGame ? (
                        <span className="text-[9px] font-bold text-[#5e6b7c] border border-[#1a222e] px-2 py-0.5 shrink-0" style={{ borderRadius: 0 }}>{playersOnChallenge} PLAYING</span>
                      ) : isCurrent ? (
                        <span className="text-[9px] font-bold text-[#3fb950] border border-[rgba(63,185,80,0.4)] px-2 py-0.5 bg-[rgba(63,185,80,0.08)] shrink-0" style={{ borderRadius: 0 }}>LIVE</span>
                      ) : (
                        <button
                          onClick={() => socketRef.current?.emit('host:select_challenge', { challengeId: c.id })}
                          className="text-[9px] font-bold text-[#5e6b7c] border border-[#1a222e] px-2 py-0.5 hover:text-white hover:border-[#48566a] transition-all shrink-0"
                          style={{ borderRadius: 0 }}>PLAY</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* EVENT FLOW */}
          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex items-center justify-between">
              <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">
                // EVENT_FLOW [{sessionData.event.mode}]
              </span>
              {sessionData.event.mode === 'RANDOM' && (
                <button onClick={randomGame}
                  className="flex items-center gap-1 text-[9px] font-black px-2.5 py-1 border border-[rgba(168,85,247,0.5)] text-[#a855f7] bg-[rgba(168,85,247,0.08)] hover:bg-[rgba(168,85,247,0.15)] transition-all"
                  style={{ borderRadius: 0 }}>
                  <Zap size={9} /> RANDOM
                </button>
              )}
            </div>
            <div className="p-3 flex flex-col gap-1.5">
              {sessionData.event.games.map((g: any, index: number) => {
                const isActive = ss.currentGameId === g.gameId && ss.currentPosition === g.position;
                const isPast = ss.currentPosition > g.position;
                return (
                  <div key={g.id} className={`flex items-center justify-between p-2.5 border transition-all ${
                    isActive ? 'border-[rgba(0,255,204,0.5)] bg-[rgba(0,255,204,0.05)]' : 'border-[#1a222e] bg-[#0a0c10]'
                  } ${g.enabled === false ? 'opacity-40' : ''}`} style={{ borderRadius: 0 }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`font-black text-xs shrink-0 ${
                        isActive ? 'text-[#00ffcc]' : isPast ? 'text-[#3fb950]' : 'text-[#3d4754]'
                      }`}>
                        {isActive ? '→' : isPast ? '✓' : '○'}
                      </span>
                      <span className="text-[10px] text-[#5e6b7c] font-mono shrink-0">{String(index + 1).padStart(2, '0')}</span>
                      <span className={`text-xs truncate ${isActive ? 'font-bold text-[#00ffcc]' : 'text-white'}`}>{g.game.name}</span>
                    </div>
                    {isActive ? (
                      <span className="text-[9px] font-bold text-[#3fb950] border border-[rgba(63,185,80,0.4)] px-2 py-0.5 bg-[rgba(63,185,80,0.08)] shrink-0" style={{ borderRadius: 0 }}>CURRENT</span>
                    ) : sessionData.event.mode === 'GM_CONTROLLED' ? (
                      <button onClick={() => selectSpecificGame(g.gameId, g.position)}
                        className="text-[9px] font-bold text-[#5e6b7c] border border-[#1a222e] px-2 py-0.5 hover:text-white hover:border-[#48566a] transition-all shrink-0"
                        style={{ borderRadius: 0 }}>JUMP</button>
                    ) : (
                      <span className="text-[9px] text-[#3d4754] font-mono shrink-0">{g.purpose}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ RIGHT COLUMN ══ */}
        <div className="flex flex-col gap-4">

          {/* STATUS SNAPSHOT */}
          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000] relative" style={{ borderRadius: 0 }}>
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00ffcc] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00ffcc] pointer-events-none" />
            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5">
              <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">// STATUS_SNAPSHOT</span>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[#5e6b7c] mb-1 uppercase">Room Code</div>
                <div className="font-black text-3xl text-[#00ffcc] tracking-[0.4em] font-mono">{code}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[#5e6b7c] mb-1 uppercase">Session Status</div>
                <div className="font-black text-sm flex items-center gap-2" style={{ color: stateColor }}>
                  {(isQuestionActive || isRoundActive) && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: stateColor }} />}
                  {state}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[8px] font-mono text-[#3d4754]">
                  <span className="px-1.5 py-0.5 border border-[#1a222e]">SEQ {sessionData.session.sequence ?? 0}</span>
                  {sessionData.session.snapshotVersion && (
                    <span className="px-1.5 py-0.5 border border-[#1a222e] truncate max-w-[120px]" title="Frozen game snapshot version">
                      SNAP {sessionData.session.snapshotVersion}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                  <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">Players</div>
                  <div className="font-black text-2xl text-white font-mono">{sessionData.playerCount}</div>
                </div>
                <div className="bg-[#0a0c10] border border-[#1a222e] p-3" style={{ borderRadius: 0 }}>
                  <div className="text-[9px] text-[#5e6b7c] uppercase tracking-widest mb-1">Teams</div>
                  <div className="font-black text-2xl text-white font-mono">{sessionData.teamCount}</div>
                </div>
              </div>
            </div>
          </div>

          {/* STAGE CONTROL */}
          <div className="bg-[#0f1319] border border-[#2d3848] shadow-[4px_4px_0px_#000]" style={{ borderRadius: 0 }}>
            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5">
              <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.3em] uppercase">// STAGE_CONTROL</span>
            </div>
            <div className="p-3">
              <div className="text-[9px] font-bold tracking-widest text-[#5e6b7c] mb-2 uppercase">
                CURRENT: <span className="text-white">{sessionData.session.stageMode}</span>
              </div>
              <div className="flex flex-col gap-1">
                {stageModes.map(mode => (
                  <button
                    key={mode}
                    onClick={() => socketRef.current?.emit('host:set_stage_mode', { mode })}
                    className={`text-left text-[9px] font-bold tracking-widest px-3 py-1.5 border transition-all ${
                      sessionData.session.stageMode === mode
                        ? 'bg-[#00ffcc] text-black border-black border-2 shadow-[2px_2px_0px_#000]'
                        : 'bg-[#0a0c10] text-[#5e6b7c] border-[#1a222e] hover:text-white hover:border-[#48566a]'
                    }`}
                    style={{ borderRadius: 0 }}>
                    {mode}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-[#1a222e]">
                <button onClick={() => window.open(`/stage/${code}`, '_blank')}
                  className="flex items-center justify-between text-[10px] font-bold px-3 py-2 border border-[#2d3848] text-[#8b99aa] bg-[#161c24] hover:text-white hover:border-[#48566a] transition-all"
                  style={{ borderRadius: 0 }}>
                  <span className="flex items-center gap-1.5"><Tv size={10} /> STAGE VIEW</span>
                  <span>↗</span>
                </button>
                <button onClick={() => window.open(`/presenter/${code}`, '_blank')}
                  className="flex items-center justify-between text-[10px] font-bold px-3 py-2 border border-[#2d3848] text-[#8b99aa] bg-[#161c24] hover:text-white hover:border-[#48566a] transition-all"
                  style={{ borderRadius: 0 }}>
                  <span className="flex items-center gap-1.5"><Presentation size={10} /> PRESENTER</span>
                  <span>↗</span>
                </button>
              </div>
            </div>
          </div>

          {/* GM BACK LINK */}
          <Link to="/gm">
            <button className="w-full flex items-center justify-center gap-2 text-[10px] font-bold px-3 py-2.5 border border-[#1a222e] text-[#5e6b7c] bg-[#0f1319] hover:text-white hover:border-[#2d3848] transition-all"
              style={{ borderRadius: 0 }}>
              <ChevronRight size={10} className="rotate-180" />
              BACK TO GM WORKSPACE
            </button>
          </Link>
        </div>
      </div>

      {/* ── STATUS FOOTER ─── */}
      <footer className="relative z-20 w-full bg-[#0a0c10] border-t border-[#1a222e] px-4 py-1.5 flex items-center justify-between text-[9px] font-mono text-[#3d4754]">
        <div className="flex items-center gap-3">
          <span className="text-[#00ffcc]">HOST_CONTROL</span>
          <span>•</span>
          <span>SESSION: {code}</span>
          <span>•</span>
          <span style={{ color: stateColor }}>{state}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#3fb950] animate-pulse' : 'bg-[#fcce0a]'}`} />
          <span style={{ color: connected ? '#3fb950' : '#fcce0a' }}>
            {connected ? 'SOCKET LIVE' : 'RECONNECTING'}
          </span>
        </div>
      </footer>
    </div>
  );
}
