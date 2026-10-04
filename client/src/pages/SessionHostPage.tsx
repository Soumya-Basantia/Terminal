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
} from 'lucide-react';

export default function SessionHostPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const code = sessionCode?.toUpperCase() || '';
  const socketRef = useRef<any>(null);

  const [sessionData, setSessionData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const socket = connectSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('host:join', { roomCode: code });
    };
    const onDisconnect = () => setConnected(false);
    const onStateUpdate = (data: any) => setSessionData(data);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session_state_update', onStateUpdate);

    api.get(`/sessions/${code}`).then(res => {
      setSessionData(res.data);
    }).catch(() => navigate('/events'));

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session_state_update', onStateUpdate);
    };
  }, [code, user, navigate]);

  const changeStatus = (status: string) => socketRef.current?.emit('host:change_status', { status });
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
  const endEvent = () => {
    if (window.confirm('END EVENT?\n\nThis will stop the live session for all players.')) {
      socketRef.current?.emit('host:end_event');
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

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00ffcc] border-t-transparent animate-spin" style={{ borderRadius: 0 }} />
          <div className="text-[#5e6b7c] text-xs tracking-[0.3em] uppercase">// LOADING SESSION...</div>
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
        className="relative z-50 w-full bg-[#0a0c10] border-b-2 border-[#1a222e] px-4 py-0 flex items-center gap-3"
        style={{ borderRadius: 0, height: 52 }}>

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-[#00ffcc] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]" style={{ borderRadius: 0 }}>
            <span className="text-black font-black text-xs">&gt;_</span>
          </div>
          <span className="font-black text-xs tracking-widest text-white hidden sm:block" style={{ fontFamily: "'Orbitron', monospace" }}>TERMINAL</span>
        </div>

        <div className="w-px h-6 bg-[#1a222e] shrink-0" />

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
                <button onClick={() => changeStatus('STARTING')}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#3fb950] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#4bcc5c] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  style={{ borderRadius: 0 }}>
                  <Play size={13} fill="currentColor" /> START EVENT
                </button>
              )}

              {/* STARTING → START GAME */}
              {isStarting && (
                <button onClick={() => changeStatus('RESULTS')}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all"
                  style={{ borderRadius: 0 }}>
                  <Play size={13} fill="currentColor" /> START GAME
                </button>
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
                    <button onClick={() => changeStatus('QUESTION_LOCKED')}
                      className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#fcce0a] border border-[rgba(252,206,10,0.4)] shadow-[2px_2px_0px_#000] hover:bg-[rgba(252,206,10,0.1)] transition-all"
                      style={{ borderRadius: 0 }}>
                      <Lock size={13} /> LOCK QUESTION
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
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-black bg-transparent text-[#ff3366] border-2 border-[#ff3366] shadow-[2px_2px_0px_rgba(255,51,102,0.5)] hover:bg-[rgba(255,51,102,0.1)] transition-all"
                  style={{ borderRadius: 0 }}>
                  <StopCircle size={13} /> END EVENT
                </button>
              )}

              {/* REOPEN LOBBY */}
              {isEnded && (
                <button onClick={() => changeStatus('LOBBY')}
                  className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold bg-[#161c24] text-[#e6edf3] border border-[#2d3848] shadow-[2px_2px_0px_#000] hover:border-[#48566a] transition-all"
                  style={{ borderRadius: 0 }}>
                  OPEN LOBBY
                </button>
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
