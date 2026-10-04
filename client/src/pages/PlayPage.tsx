import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket } from '../lib/socket';
import type { SafeChallenge, SessionStatePayload, LeaderboardEntry } from '../types';
import { Trophy, Wifi, WifiOff, CheckCircle, XCircle, Users } from 'lucide-react';
import LogicHeistChallenge from '../components/LogicHeistChallenge';
import BugHuntChallenge from '../components/BugHuntChallenge';
import WitnessChallenge from '../components/WitnessChallenge';
import ScannerChallenge from '../components/ScannerChallenge';
import MissionChallenge from '../components/MissionChallenge';
import RouterChallenge from '../components/RouterChallenge';
import ThresholdChallenge from '../components/ThresholdChallenge';
import api from '../lib/api';
import { TeamPanel } from '../features/terminal/components/panels/TeamPanel';
import { TerminalInput } from '../features/terminal/components/TerminalInput';
import { TerminalLoading, TerminalWarning, TerminalOutputError } from '../features/terminal/components/TerminalSystemState';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function TimerRing({ endsAt, timerSecs }: { endsAt: string; timerSecs: number }) {
  const [secondsLeft, setSecondsLeft] = useState(timerSecs);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  const progress = secondsLeft / timerSecs;
  const dashOffset = circumference * (1 - progress);
  const color = secondsLeft <= 5 ? 'var(--error)' : secondsLeft <= 10 ? 'var(--warning)' : 'var(--accent-primary)';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={45} cy={45} r={radius} fill="none" stroke="var(--bg-elevated)" strokeWidth={4} />
        <circle
          cx={45} cy={45} r={radius} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span style={{
        position: 'absolute', fontFamily: 'var(--font-mono)', fontWeight: 800,
        fontSize: secondsLeft >= 10 ? 24 : 28, color,
        animation: secondsLeft <= 3 ? 'number-pop 0.3s ease' : 'none',
      }}>
        {secondsLeft}
      </span>
    </div>
  );
}

export default function PlayPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const code = sessionCode?.toUpperCase() || '';

  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<SafeChallenge | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; score: number; explanation: string | null } | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | string[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameState, setGameState] = useState<string>('');
  const [broadcast, setBroadcast] = useState<{ message: string; id: string } | null>(null);
  const [poll, setPoll] = useState<{ id: string; question: string; options: string[]; results?: Record<number, number> } | null>(null);
  const [pollAnswered, setPollAnswered] = useState(false);
  const [roundEnded, setRoundEnded] = useState<string | null>(null);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [unreadTeamCount, setUnreadTeamCount] = useState(0);
  const [terminalNotice, setTerminalNotice] = useState<string | null>(null);
  const socketRef = useRef<any>(null);

  const user = JSON.parse(localStorage.getItem('terminal_user') || 'null');
  const player = user || JSON.parse(localStorage.getItem('terminal_player') || 'null');

  useEffect(() => {
    if (isTeamOpen) {
      setUnreadTeamCount(0);
    }
  }, [isTeamOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTeamOpen) {
        setIsTeamOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTeamOpen]);

  useEffect(() => {
    if (!player) {
      navigate('/login');
      return;
    }

    const onSessionState = (data: any) => {
      if (!data) return;
      setState(data);
      setGameState(data.session?.state || data.session?.status || 'LOBBY');
      const currentPlayerScore = data.leaderboard?.find(
        (entry: { name?: string; score?: number }) => entry.name === player?.username,
      )?.score;
      if (typeof currentPlayerScore === 'number' && Number.isFinite(currentPlayerScore)) {
        setMyScore(currentPlayerScore);
      }
      const chal = data.currentChallenge || 
                   data.currentGame?.challenges?.find((c: any) => c.id === data.session?.currentChallengeId) || 
                   (data.currentGame?.challenges?.length ? data.currentGame.challenges[0] : null);
      if (chal) {
        setCurrentChallenge(chal as SafeChallenge);
        setSubmitted(false);
        setSelectedAnswer(null);
        setResult(null);
        setCorrectAnswer(null);
      }
    };

    // Auto-join session in DB first
    api.post('/sessions/join', { roomCode: code })
      .then(res => {
        if (res.data?.sessionPlayer) {
          localStorage.setItem('terminal_player', JSON.stringify({
            ...player,
            id: res.data.sessionPlayer.id,
            sessionPlayerId: res.data.sessionPlayer.id,
          }));
        }
      })
      .catch(() => {});

    // Pre-fetch session state so UI loads immediately
    api.get(`/sessions/${code}`)
      .then(res => {
        if (res.data) onSessionState(res.data);
      })
      .catch(() => {});

    const socket = connectSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('player:join', { roomCode: code });
    };
    const onDisconnect = () => setConnected(false);
    const onChallengeStarted = (challenge: SafeChallenge) => {
      setCurrentChallenge(challenge);
      setSubmitted(false);
      setSubmissionError(null);
      setSelectedAnswer(null);
      setResult(null);
      setCorrectAnswer(null);
      setGameState('ROUND_ACTIVE');
      setRoundEnded(null);
    };
    const onChallengeEnded = (data: { challengeId: string; correctAnswer: string | string[]; explanation: string | null }) => {
      setCorrectAnswer(data.correctAnswer);
    };
    const onLeaderboardUpdated = (data: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(data.leaderboard);
      setGameState('LEADERBOARD');
    };
    const onGameEnded = () => {
      setGameState('FINAL');
      navigate(`/results/${code}`);
    };
    const onGamePaused = () => setGameState('PAUSED');
    const onGameResumed = () => setGameState('ROUND_ACTIVE');
    const onBroadcastCreated = (data: { id: string; message: string }) => {
      setBroadcast(data);
      setTimeout(() => setBroadcast(null), 8000);
    };
    const onRoundEnded = (data: { message: string }) => {
      setRoundEnded(data.message);
    };
    const onPollCreated = (data: any) => {
      setPoll({ ...data, results: {} });
      setPollAnswered(false);
    };
    const onPollClosed = (data: { pollId: string; results: Array<{ optionIndex: number; count: number }> }) => {
      if (poll?.id === data.pollId) {
        const resultsMap: Record<number, number> = {};
        data.results.forEach(r => { resultsMap[r.optionIndex] = r.count; });
        setPoll(p => p ? { ...p, results: resultsMap } : null);
      }
    };
    const onPlayerRemoved = (data: { message?: string }) => {
      if (data.message) {
        alert(data.message);
        navigate('/login');
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session:state', onSessionState);
    socket.on('session_state_update', onSessionState);
    socket.on('challenge:started', onChallengeStarted);
    socket.on('challenge:ended', onChallengeEnded);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('game:ended', onGameEnded);
    socket.on('game:paused', onGamePaused);
    socket.on('game:resumed', onGameResumed);
    socket.on('broadcast:created', onBroadcastCreated);
    socket.on('round:ended', onRoundEnded);
    socket.on('poll:created', onPollCreated);
    const handleTeamMsg = () => {
      setIsTeamOpen(curr => {
        if (!curr) {
          setUnreadTeamCount(c => c + 1);
        }
        return curr;
      });
    };
    const handleChatCleared = () => {
      setUnreadTeamCount(0);
    };

    socket.on('poll:closed', onPollClosed);
    socket.on('player:removed', onPlayerRemoved);
    socket.on('team:message', handleTeamMsg);
    socket.on('team:chat_cleared', handleChatCleared);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session:state', onSessionState);
      socket.off('session_state_update', onSessionState);
      socket.off('challenge:started', onChallengeStarted);
      socket.off('challenge:ended', onChallengeEnded);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('game:ended', onGameEnded);
      socket.off('game:paused', onGamePaused);
      socket.off('game:resumed', onGameResumed);
      socket.off('broadcast:created', onBroadcastCreated);
      socket.off('round:ended', onRoundEnded);
      socket.off('poll:created', onPollCreated);
      socket.off('poll:closed', onPollClosed);
      socket.off('player:removed', onPlayerRemoved);
      socket.off('team:message', handleTeamMsg);
      socket.off('team:chat_cleared', handleChatCleared);
    };
  }, [code]);

  const rawPromptName = player?.username || player?.name || player?.displayName || 'player';
  const promptUser = rawPromptName.toLowerCase().trim().split(' ')[0].replace(/[^a-z0-9_-]/g, '') || 'player';

  const handleTerminalCommand = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;
    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd === 'submit') {
      if (arg) {
        submitAnswer(arg.toUpperCase());
        setTerminalNotice(`> SUBMITTED: ${arg.toUpperCase()}`);
      } else {
        setTerminalNotice(`> ERROR: specify answer (e.g., submit A)`);
      }
    } else if (cmd === 'team') {
      setIsTeamOpen(prev => !prev);
      setTerminalNotice(isTeamOpen ? `> TEAM PANEL CLOSED` : `> TEAM PANEL EXPANDED`);
    } else if (cmd === 'score') {
      setTerminalNotice(`> CURRENT SCORE: ${myScore} PTS`);
    } else if (cmd === 'status') {
      setTerminalNotice(`> ARENA STATUS: ${gameState} // ROOM: ${code}`);
    } else if (cmd === 'help') {
      setTerminalNotice(`> COMMANDS: submit <ans> | team | score | status | clear`);
    } else if (cmd === 'clear') {
      setTerminalNotice(null);
    } else if (['a', 'b', 'c', 'd'].includes(cmd)) {
      submitAnswer(cmd.toUpperCase());
      setTerminalNotice(`> SUBMITTED: ${cmd.toUpperCase()}`);
    } else {
      setTerminalNotice(`> UNKNOWN COMMAND: ${cmd}. Type 'help' for options.`);
    }
  };

  async function submitAnswer(answer: string | string[]) {
    if (submitted || !currentChallenge) return;
    setSelectedAnswer(answer);
    setSubmitted(true);
    setSubmissionError(null);
    try {
      const response = await api.post('/sessions/active/submit', { answer });
      const pointsAwarded = response.data.pointsAwarded || 0;
      setResult({
        isCorrect: response.data.isCorrect,
        score: pointsAwarded,
        explanation: null,
      });
    } catch (error: any) {
      setSubmitted(false);
      setSelectedAnswer(null);
      setSubmissionError(error.response?.data?.error || 'Answer could not be submitted. Please try again.');
    }
  }

  function toggleMultiChoice(opt: string) {
    if (submitted) return;
    const current = Array.isArray(selectedAnswer) ? selectedAnswer : [];
    if (current.includes(opt)) {
      setSelectedAnswer(current.filter(a => a !== opt));
    } else {
      setSelectedAnswer([...current, opt]);
    }
  }

  function respondToPoll(optionIndex: number) {
    if (pollAnswered || !poll) return;
    setPollAnswered(true);
    socketRef.current?.emit('player:poll_respond', { pollId: poll.id, optionIndex });
  }

  const isCorrect = (opt: string) => {
    if (!correctAnswer) return false;
    return Array.isArray(correctAnswer) ? correctAnswer.includes(opt) : correctAnswer === opt;
  };

  // ── PAUSED ────────────────────────────────────────────────
  if (gameState === 'PAUSED') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-8 font-mono">
        <div className="max-w-sm w-full">
          <TerminalWarning title="GAME PAUSED // STANDBY">
            <div>The Game Master has paused the session.</div>
            <div className="text-zinc-500 text-[11px] mt-1">Hang tight — the arena will resume shortly.</div>
          </TerminalWarning>
        </div>
      </div>
    );
  }

  // ── LEADERBOARD ───────────────────────────────────────────
  if (gameState === 'LEADERBOARD' && !currentChallenge) {
    const myEntry = leaderboard.find(e => e.id === player?.id);
    return (
      <div className="min-h-screen p-8 max-w-lg mx-auto">
        <div className="text-center mb-6">
          <Trophy size={36} className="text-[var(--game-gold)] mx-auto mb-2" />
          <h2 className="text-2xl font-black font-sans uppercase">Leaderboard</h2>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {leaderboard.slice(0, 10).map((entry, i) => (
            <div key={entry.id} className={`p-3 rounded flex items-center gap-3 border ${entry.id === player?.id ? 'bg-[rgba(0,255,204,0.1)] border-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-glow)]' : 'bg-[var(--bg-card)] border-[var(--border-subtle)]'}`}>
              <span className={`w-7 text-center font-black font-mono ${i === 0 ? 'text-[var(--game-gold)]' : i === 1 ? 'text-[var(--game-silver)]' : i === 2 ? 'text-[var(--game-bronze)]' : 'text-[var(--text-muted)]'}`}>
                {i + 1}
              </span>
              <span className="flex-1 font-semibold">{entry.displayName || entry.name}</span>
              <span className="font-mono font-bold text-[var(--accent-primary)]">{entry.score}</span>
            </div>
          ))}
        </div>
        {myEntry && (myEntry.rank || 0) > 10 && (
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 28, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-primary)' }}>#{myEntry.rank}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{player?.displayName} (You)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>{myEntry.score}</span>
          </div>
        )}
        {roundEnded && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginTop: 16 }}>{roundEnded}</p>
        )}
      </div>
    );
  }

  // ── ACTIVE CHALLENGE ──────────────────────────────────────
  if (!currentChallenge) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-8 font-mono">
        <div className="max-w-sm w-full">
          <TerminalLoading
            label={!connected ? 'RECONNECTING TO ARENA' : 'AWAITING NEXT CHALLENGE'}
            node={`/arena/${code}`}
          />
        </div>
      </div>
    );
  }

  const options = currentChallenge.options || [];
  const isMulti = currentChallenge.type === 'MULTIPLE_CHOICE';
  const isLogicHeist = state?.currentGame?.template === 'LOGIC_HEIST' || 
                       state?.game?.template === 'LOGIC_HEIST';
  const isBugHunt = state?.currentGame?.template === 'BUG_HUNT' || 
                    state?.game?.template === 'BUG_HUNT';
  const isWitness = state?.currentGame?.template === 'THE_WITNESS' || 
                    state?.game?.template === 'THE_WITNESS';
  const isRogueScanner = state?.currentGame?.template === 'ROGUE_SCANNER' || 
                         state?.game?.template === 'ROGUE_SCANNER' ||
                         (currentChallenge as any)?.type === 'TELEMETRY_ANOMALY';
  const isSilentMission = state?.currentGame?.template === 'SILENT_MISSION' ||
                          state?.game?.template === 'SILENT_MISSION' ||
                          (currentChallenge as any)?.type === 'MISSION_PLAN';
  const isSignalRouter = state?.currentGame?.template === 'SIGNAL_ROUTER' ||
                         state?.game?.template === 'SIGNAL_ROUTER' ||
                         (currentChallenge as any)?.type === 'NETWORK_ROUTING';
  const isThreshold = state?.currentGame?.template === 'THE_THRESHOLD' ||
                      state?.game?.template === 'THE_THRESHOLD' ||
                      (currentChallenge as any)?.type === 'THRESHOLD_CALIBRATION';
  const challengeProgress = Number.isFinite(currentChallenge.challengeIndex) &&
    Number.isFinite(currentChallenge.totalChallenges) &&
    currentChallenge.totalChallenges > 0
    ? `${currentChallenge.roundTitle ? `${currentChallenge.roundTitle} · ` : ''}Q${currentChallenge.challengeIndex + 1}/${currentChallenge.totalChallenges}`
    : currentChallenge.roundTitle || '';
  const hasChallengeTimer = Number.isFinite(currentChallenge.timerSecs) &&
    currentChallenge.timerSecs > 0 &&
    Boolean(currentChallenge.challengeEndsAt) &&
    Number.isFinite(Date.parse(currentChallenge.challengeEndsAt));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Broadcast banner */}
      {broadcast && (
        <div style={{
          background: 'rgba(0,212,170,0.1)', borderBottom: '1px solid rgba(0,212,170,0.3)',
          padding: '8px 16px', textAlign: 'center', fontSize: 13, color: 'var(--accent-primary)',
        }}>
          📢 {broadcast.message}
        </div>
      )}

      {submissionError && (
        <p role="alert" style={{ textAlign: 'center', color: 'var(--error)', fontSize: 13, marginTop: 12 }}>
          {submissionError}
        </p>
      )}

      {/* Top bar */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-4 h-12 flex items-center justify-between shadow-md relative z-10">
        <div>
          <span className="font-bold text-sm text-[var(--text-primary)] tracking-wide">
            {state?.game?.name || state?.currentGame?.name || 'TERMINAL'}
          </span>
          {challengeProgress && (
            <span className="text-xs text-[var(--text-secondary)] ml-2 font-mono">
              {challengeProgress}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)', fontSize: 16 }}>
            {myScore}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>pts</span>
          {connected
            ? <Wifi size={12} color="var(--success)" />
            : <WifiOff size={12} color="var(--error)" />}
        </div>
      </div>

      {/* Central Area: Main Game Challenge + Expandable Team Side Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <main className="flex-1 overflow-y-auto flex flex-col relative transition-all duration-200">
          {/* Quick Floating [TEAM >] Trigger on right edge when panel is closed */}
          {!isTeamOpen && (
            <button
              onClick={() => setIsTeamOpen(true)}
              className="absolute top-3 right-4 z-20 px-2.5 py-1 bg-[#090d16] hover:bg-[#121622] border border-cyan-500/70 text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-[2px_2px_0px_#000] cursor-pointer transition-colors"
              title="Open Squad Workspace & Live Chat (team)"
            >
              <Users size={12} className="text-cyan-400" />
              <span>TEAM &gt;</span>
              {unreadTeamCount > 0 && (
                <span className="px-1 py-0.2 bg-amber-500 text-black text-[9px] font-black animate-pulse">
                  ● {unreadTeamCount}
                </span>
              )}
            </button>
          )}

          {/* Poll overlay */}
      {poll && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 440, width: '100%', padding: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{poll.question}</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {poll.options.map((opt, i) => (
                <button key={i} onClick={() => respondToPoll(i)}
                  className={`mcq-option ${pollAnswered ? 'disabled' : ''}`}
                  disabled={pollAnswered}
                >
                  <span className="option-label">{OPTION_LABELS[i] || i + 1}</span>
                  {opt}
                  {pollAnswered && poll.results && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {poll.results[i] || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {pollAnswered && (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginTop: 12 }}>
                Response recorded! ✓
              </p>
            )}
          </div>
        </div>
      )}

      {/* Challenge content */}
      {isLogicHeist ? (
        <LogicHeistChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.pointsAwarded || 0));
            }
          }}
        />
      ) : isBugHunt ? (
        <BugHuntChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.pointsAwarded || 0));
            }
          }}
        />
      ) : isWitness ? (
        <WitnessChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.pointsAwarded || 0));
            }
          }}
        />
      ) : isRogueScanner ? (
        <ScannerChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.pointsAwarded || 0));
            }
          }}
        />
      ) : isSilentMission ? (
        <MissionChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.pointsAwarded || 0));
            }
          }}
        />
      ) : isSignalRouter ? (
        <RouterChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.score || data.pointsAwarded || 0));
            }
          }}
        />
      ) : isThreshold ? (
        <ThresholdChallenge
          challenge={currentChallenge}
          sessionCode={code}
          onSubmitted={(data) => {
            if (data.isCorrect) {
              setMyScore(s => s + (data.score || data.pointsAwarded || 0));
            }
          }}
        />
      ) : (
      <div className="flex-1 max-w-2xl mx-auto w-full p-6 flex flex-col relative z-10 mt-4 card-glow">
        {/* Difficulty */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: currentChallenge.difficulty === 'HARD' ? 'var(--error)' : currentChallenge.difficulty === 'MEDIUM' ? 'var(--warning)' : 'var(--success)',
          }}>
            {currentChallenge.difficulty}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {currentChallenge.points} points
          </span>
        </div>

        {/* Question */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4 }}>
            {currentChallenge.prompt}
          </h2>
          {isMulti && !submitted && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>Select all that apply</p>
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'grid', gap: 10, flex: 1 }}>
          {options.map((opt, i) => {
            const isSelected = Array.isArray(selectedAnswer)
              ? selectedAnswer.includes(opt)
              : selectedAnswer === opt;
            const showResult = submitted && correctAnswer !== null;
            const isOpt_Correct = isCorrect(opt);
            const isOpt_Wrong = isSelected && !isOpt_Correct && showResult;

            return (
              <button
                key={i}
                onClick={() => {
                  if (submitted) return;
                  if (isMulti) {
                    toggleMultiChoice(opt);
                  } else {
                    submitAnswer(opt);
                  }
                }}
                className={`mcq-option ${isSelected ? 'selected' : ''} ${showResult && isOpt_Correct ? 'correct' : ''} ${showResult && isOpt_Wrong ? 'wrong' : ''} ${submitted && !isMulti ? 'disabled' : ''}`}
              >
                <span className="option-label" style={{
                  background: showResult && isOpt_Correct ? 'rgba(63,185,80,0.2)' : showResult && isOpt_Wrong ? 'rgba(248,81,73,0.2)' : undefined,
                  borderColor: showResult && isOpt_Correct ? 'var(--success)' : showResult && isOpt_Wrong ? 'var(--error)' : undefined,
                  color: showResult && isOpt_Correct ? 'var(--success)' : showResult && isOpt_Wrong ? 'var(--error)' : undefined,
                }}>
                  {showResult && isOpt_Correct ? <CheckCircle size={14} /> : showResult && isOpt_Wrong ? <XCircle size={14} /> : OPTION_LABELS[i]}
                </span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Multi-choice submit */}
        {isMulti && !submitted && Array.isArray(selectedAnswer) && selectedAnswer.length > 0 && (
          <button
            onClick={() => submitAnswer(selectedAnswer)}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16, padding: '13px 0', fontSize: 15 }}
          >
            Submit Answer
          </button>
        )}

        {/* Result */}
        {result && (
          <div className={`mt-4 p-4 rounded-sm border ${result.isCorrect ? 'bg-[rgba(63,185,80,0.1)] border-[var(--success)] shadow-[0_0_15px_rgba(63,185,80,0.2)]' : 'bg-[rgba(255,51,102,0.1)] border-[var(--error)] shadow-[0_0_15px_rgba(255,51,102,0.2)]'}`}>
            <div className={`flex items-center gap-2 ${result.explanation ? 'mb-2' : ''}`}>
              {result.isCorrect
                ? <CheckCircle size={18} color="var(--success)" />
                : <XCircle size={18} color="var(--error)" />}
              <span className={`font-bold font-mono ${result.isCorrect ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                {result.isCorrect ? `> VALIDATION SUCCESS (+${result.score} XP)` : '> VALIDATION FAILED'}
              </span>
            </div>
            {result.explanation && (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">{result.explanation}</p>
            )}
          </div>
        )}

        {/* No submission yet — waiting */}
        {submitted && !result && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginTop: 12 }}>
            Answer submitted ✓ Waiting for round to end...
          </p>
        )}
      </div>
      )}
        </main>

        {/* Dynamic Expandable Side Panel (Right) — takes 28-36% viewport width, fast transition */}
        <aside 
          aria-label="Command Telemetry Panel"
          className={`transition-all duration-200 ease-out overflow-hidden flex flex-col shrink-0 z-20 ${
            isTeamOpen 
              ? 'w-[32%] min-w-[320px] max-w-[460px] max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:w-full max-md:z-30 opacity-100 pointer-events-auto border-l-2 border-cyan-500/80 shadow-[-6px_0_24px_rgba(0,0,0,0.7)]' 
              : 'w-0 min-w-0 max-w-0 opacity-0 pointer-events-none border-l-0'
          }`}
        >
          {isTeamOpen && (
            <TeamPanel onClose={() => setIsTeamOpen(false)} />
          )}
        </aside>
      </div>

      {/* Timer — bottom fixed above terminal bar */}
      {hasChallengeTimer && (
        <div style={{
          position: 'fixed', bottom: 74, right: isTeamOpen ? 'calc(32% + 24px)' : 24,
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          borderRadius: 999, padding: '4px 4px', zIndex: 30,
        }}>
          <TimerRing endsAt={currentChallenge.challengeEndsAt} timerSecs={currentChallenge.timerSecs} />
        </div>
      )}

      {/* PERMANENT TERMINAL ENTRY / COMMAND BAR — ALWAYS DOCKED AT THE BOTTOM */}
      <div className="p-2 sm:p-2.5 bg-[#0a0d16] border-t-2 border-cyan-500/60 shadow-[0_-4px_16px_rgba(0,0,0,0.6)] shrink-0 z-30 w-full font-mono">
        {terminalNotice && (
          <div className="text-[11px] text-cyan-300 pb-1 flex items-center justify-between">
            <span>{terminalNotice}</span>
            <button onClick={() => setTerminalNotice(null)} className="text-zinc-500 hover:text-zinc-300 text-[10px]">✕</button>
          </div>
        )}
        <TerminalInput 
          username={promptUser} 
          onCommand={handleTerminalCommand} 
          onClear={() => setTerminalNotice(null)} 
          onEscape={() => setIsTeamOpen(false)}
        />
        <div className="mt-1 text-[9px] text-zinc-500 font-mono tracking-wider flex flex-wrap gap-4 select-none">
          <span>ENTER <span className="text-zinc-600">submit</span></span>
          <span>team <span className="text-zinc-600">toggle squad</span></span>
          <span>ESC <span className="text-zinc-600">close panel</span></span>
          <span>help <span className="text-zinc-600">commands</span></span>
        </div>
      </div>
    </div>
  );
}
