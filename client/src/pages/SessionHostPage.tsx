import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { connectSocket } from '../lib/socket';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';
import { Terminal, Users, Play, SkipForward, StopCircle, Lock, Trophy, Check, Cpu, Radio, Zap } from 'lucide-react';
import { TerminalBadge } from '../components/ui';

export default function SessionHostPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const code = sessionCode?.toUpperCase() || '';
  const socketRef = useRef<any>(null);

  const [sessionData, setSessionData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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

  const changeStatus = (status: string) => {
    socketRef.current?.emit('host:change_status', { status });
  };

  const advanceGame = () => {
    if (sessionData?.event?.mode === 'RANDOM') {
      socketRef.current?.emit('host:random_game');
    } else {
      if (window.confirm('Are you sure you want to skip to the next game?')) {
        socketRef.current?.emit('host:skip_game');
      }
    }
  };

  const replayGame = () => {
    if (window.confirm('Are you sure you want to replay the current game? Previous submissions will be preserved, but players will start over.')) {
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
      <div className="min-h-screen bg-[var(--term-bg-void)] flex items-center justify-center font-mono">
        <div className="text-[var(--term-text-secondary)] text-sm">// LOADING SESSION...</div>
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

  const stateColor = isQuestionActive || isRoundActive ? 'text-[var(--term-green)]'
    : isLobby ? 'text-[var(--term-yellow)]'
    : isEnded ? 'text-[var(--term-text-muted)]'
    : 'text-[var(--term-cyan)]';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--term-bg-void)] font-mono">

      {/* ── TOP BAR ── */}
      <header className="bg-[var(--term-bg-surface)] border-b border-[var(--term-border-muted)]"
        style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14, position: 'sticky', top: 0, zIndex: 50 }}>

        <div className="flex items-center gap-2">
          <div className="p-1 border border-[var(--term-cyan)] bg-[var(--term-bg-elevated)]">
            <Terminal size={14} className="text-[var(--term-cyan)]" />
          </div>
          <span className="font-mono font-black text-base tracking-tight text-white">TERMINAL</span>
        </div>

        <div className="w-px h-6 bg-[var(--term-border-faint)]" />

        <span className={`text-[10px] font-bold tracking-widest uppercase ${stateColor}`}>{state}</span>

        <span className="font-mono font-bold text-sm text-white truncate flex-1">{sessionData.event.name}</span>

        <button onClick={copyCode} className="flex items-center gap-2 px-3 py-1.5 border border-[var(--term-border-muted)] bg-[var(--term-bg-elevated)] hover:border-[var(--term-cyan)] transition-all cursor-pointer">
          <span className="font-mono font-black text-lg text-[var(--term-cyan)] tracking-widest">{code}</span>
          {codeCopied && <Check size={12} className="text-[var(--term-green)]" />}
        </button>

        <div className="flex items-center gap-2 text-xs text-[var(--term-text-secondary)]">
          <Users size={12} />
          <strong className="text-white">{sessionData.playerCount}</strong>
        </div>

        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${connected ? 'text-[var(--term-green)]' : 'text-[var(--term-red)]'}`}>
          <Radio size={10} />
          {connected ? 'ONLINE' : 'RECONNECTING'}
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="flex-1 p-5 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 overflow-auto">

        {/* Left Col */}
        <div className="flex flex-col gap-5">

          {/* Session Controls */}
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-4 py-2.5 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// SESSION_CONTROLS</span>
            </div>
            <div className="p-4 flex gap-3 flex-wrap">

              {isLobby && (
                <button onClick={() => changeStatus('STARTING')} className="btn btn-primary">
                  <Play size={13} /> START EVENT
                </button>
              )}
              {isStarting && (
                <button onClick={() => changeStatus('RESULTS')} className="btn btn-primary">
                  <Play size={13} /> START GAME
                </button>
              )}

              {isChainGame ? (
                <>
                  {(isLeaderboard || isStarting) && (
                    <button onClick={() => changeStatus('ROUND_ACTIVE')} className="btn btn-primary">
                      <Play size={13} /> START ROUND
                    </button>
                  )}
                  {isRoundActive && (
                    <button onClick={() => changeStatus('RESULTS')} className="btn btn-secondary">
                      <StopCircle size={13} /> END ROUND
                    </button>
                  )}
                  {isLeaderboard && !isStarting && (
                    <>
                      <button onClick={replayGame} className="btn btn-secondary">
                        <SkipForward size={13} /> REPLAY
                      </button>
                      <button onClick={advanceGame} className="btn btn-primary">
                        <SkipForward size={13} /> {sessionData.event.mode === 'RANDOM' ? 'RANDOM GAME' : 'NEXT GAME'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {isQuestionActive && (
                    <button onClick={() => changeStatus('QUESTION_LOCKED')} className="btn btn-secondary">
                      <Lock size={13} /> LOCK QUESTION
                    </button>
                  )}
                  {(isQuestionLocked || isQuestionActive) && (
                    <button onClick={() => changeStatus('QUESTION_RESULTS')} className="btn btn-secondary">
                      <Trophy size={13} /> SHOW RESULTS
                    </button>
                  )}
                  {isQuestionResults && (
                    <button onClick={() => changeStatus('RESULTS')} className="btn btn-secondary">
                      <Trophy size={13} /> LEADERBOARD
                    </button>
                  )}
                  {isLeaderboard && (
                    <>
                      <button onClick={replayGame} className="btn btn-secondary">
                        <SkipForward size={13} /> REPLAY
                      </button>
                      <button onClick={advanceGame} className="btn btn-primary">
                        <SkipForward size={13} /> {sessionData.event.mode === 'RANDOM' ? 'RANDOM GAME' : 'NEXT GAME'}
                      </button>
                    </>
                  )}
                </>
              )}

              {!isEnded && !isLobby && (
                <button onClick={endEvent} className="btn btn-danger">
                  <StopCircle size={13} /> END EVENT
                </button>
              )}
              {isEnded && (
                <button onClick={() => changeStatus('LOBBY')} className="btn">
                  OPEN LOBBY
                </button>
              )}
            </div>
          </div>

          {/* Challenge/Round Progress */}
          {sessionData.currentGame && (
            <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
              <div className="px-4 py-2.5 border-b border-[var(--term-border-faint)] flex items-center justify-between">
                <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">
                  // {isChainGame ? 'ROUND_PROGRESSION' : 'QUIZ_CONTROL'} — {sessionData.currentGame.name}
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {sessionData.currentGame.challenges?.map((c: any, i: number) => {
                  const isCurrent = sessionData.session.currentChallengeId === c.id;
                  let playersOnChallenge = 0;
                  if (isChainGame) {
                    playersOnChallenge = Object.values(sessionData.chainProgress || {}).filter(val => val === c.id).length;
                  }
                  return (
                    <div key={c.id} className={`flex items-center justify-between p-3 border transition-all ${
                      (isCurrent || (isChainGame && playersOnChallenge > 0))
                        ? 'border-[var(--term-cyan)] bg-[var(--term-bg-elevated)]'
                        : 'border-[var(--term-border-faint)] bg-[var(--term-bg-void)]'
                    }`}>
                      <div className="flex-1 min-w-0 mr-4">
                        <div className={`text-xs font-mono font-bold truncate ${
                          isCurrent || isChainGame ? 'text-[var(--term-cyan)]' : 'text-[var(--term-text-primary)]'
                        }`}>
                          {sessionData.currentGame.template === 'THE_WITNESS' ? `MYSTERY ${i+1}` :
                           sessionData.currentGame.template === 'LOGIC_HEIST' ? `VAULT ${i+1}` :
                           sessionData.currentGame.template === 'BUG_HUNT' ? `CASE ${i+1}` : `Q${i+1}`}: {c.prompt}
                        </div>
                      </div>
                      {isChainGame ? (
                        <span className="text-[10px] font-bold text-[var(--term-text-muted)] border border-[var(--term-border-faint)] px-2 py-0.5 whitespace-nowrap">{playersOnChallenge} PLAYING</span>
                      ) : isCurrent ? (
                        <span className="text-[10px] font-bold text-[var(--term-green)] border border-[var(--term-green)] px-2 py-0.5">LIVE</span>
                      ) : (
                        <button
                          onClick={() => socketRef.current?.emit('host:select_challenge', { challengeId: c.id })}
                          className="btn btn-sm btn-ghost"
                        >PLAY</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Event Flow */}
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-4 py-2.5 border-b border-[var(--term-border-faint)] flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">
                // EVENT_FLOW [{sessionData.event.mode}]
              </span>
            </div>
            <div className="p-4">
              {sessionData.event.mode === 'RANDOM' && (
                <button onClick={randomGame} className="btn btn-secondary w-full mb-3">
                  <Zap size={13} /> PICK RANDOM GAME
                </button>
              )}
              <div className="flex flex-col gap-2">
                {sessionData.event.games.map((g: any, index: number) => {
                  const isActive = ss.currentGameId === g.gameId && ss.currentPosition === g.position;
                  const isPast = ss.currentPosition > g.position;
                  const icon = isActive ? '→' : isPast ? '✓' : '○';

                  return (
                    <div key={g.id} className={`flex items-center justify-between p-3 border transition-all ${
                      isActive ? 'border-[var(--term-cyan)] bg-[var(--term-bg-elevated)]' : 'border-[var(--term-border-faint)] bg-[var(--term-bg-void)]'
                    } ${g.enabled === false ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`font-mono font-black text-sm ${
                          isActive ? 'text-[var(--term-cyan)]' : isPast ? 'text-[var(--term-green)]' : 'text-[var(--term-text-muted)]'
                        }`}>{icon}</div>
                        <div className="font-mono text-xs text-[var(--term-text-muted)]">{(index + 1).toString().padStart(2, '0')}</div>
                        <div className={`font-mono text-sm ${isActive ? 'font-bold text-[var(--term-cyan)]' : 'text-white'}`}>{g.game.name}</div>
                      </div>
                      {isActive ? (
                        <span className="text-[10px] font-bold text-[var(--term-green)] border border-[var(--term-green)] px-2 py-0.5">CURRENT</span>
                      ) : sessionData.event.mode === 'GM_CONTROLLED' ? (
                        <button onClick={() => selectSpecificGame(g.gameId, g.position)} className="btn btn-sm btn-ghost">JUMP</button>
                      ) : (
                        <span className="text-[9px] text-[var(--term-text-muted)] font-bold">{g.purpose}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col — Status + Stage Control */}
        <div className="flex flex-col gap-5">

          {/* Status Snapshot */}
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-4 py-2.5 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// STATUS_SNAPSHOT</span>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">ROOM CODE</div>
                <div className="font-mono font-black text-3xl text-[var(--term-cyan)] tracking-widest">{code}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">SESSION STATUS</div>
                <div className={`font-mono font-bold text-sm ${stateColor}`}>{state}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">PLAYERS CONNECTED</div>
                <div className="font-mono font-black text-2xl text-white">{sessionData.playerCount}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">TEAMS</div>
                <div className="font-mono font-black text-2xl text-white">{sessionData.teamCount}</div>
              </div>
            </div>
          </div>

          {/* Stage Control */}
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-4 py-2.5 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// STAGE_CONTROL</span>
            </div>
            <div className="p-4">
              <div className="text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-3">
                CURRENT MODE: <span className="text-white">{sessionData.session.stageMode}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {['LOBBY', 'ANNOUNCEMENT', 'COUNTDOWN', 'QUESTION', 'ANSWER_REVEAL', 'LEADERBOARD', 'TEAM_LEADERBOARD', 'FINAL_RESULTS', 'PAUSED', 'BLANK'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => socketRef.current?.emit('host:set_stage_mode', { mode })}
                    className={`btn btn-sm justify-start ${sessionData.session.stageMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <button
                onClick={() => window.open(`/stage/${code}`, '_blank')}
                className="btn btn-ghost w-full mt-3"
              >
                OPEN STAGE VIEW ↗
              </button>
              <Link
                to={`/presenter/${code}`}
                target="_blank"
                className="btn btn-ghost w-full mt-1.5 text-center"
                style={{ textDecoration: 'none' }}
              >
                PRESENTER VIEW ↗
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
