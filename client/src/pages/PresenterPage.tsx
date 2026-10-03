import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import type { SafeChallenge, LeaderboardEntry, SessionStatePayload } from '../types';
import { Terminal, Trophy, Users, ShieldAlert, Award, Clock } from 'lucide-react';
import { TerminalBadge } from '../components/ui';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = ['var(--term-cyan)', 'var(--term-magenta)', 'var(--term-yellow)', 'var(--term-blue)'];
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export default function PresenterPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const code = sessionCode?.toUpperCase() || '';

  const [screen, setScreen] = useState<'lobby' | 'challenge' | 'answer' | 'leaderboard' | 'final'>('lobby');
  const [challenge, setChallenge] = useState<SafeChallenge | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | string[] | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [gameName, setGameName] = useState('');
  const [roundEnded, setRoundEnded] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);
  const [pollData, setPollData] = useState<{ question: string; options: string[]; results: Record<number, number> } | null>(null);
  const [stats, setStats] = useState<{ submissionCount: number; correctCount: number } | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { isStage: true } });

    const onConnect = () => socket.emit('stage:join', { roomCode: code });
    const onSessionState = (data: SessionStatePayload) => {
      setGameName(data.game?.name || data.currentGame?.name || data.event?.name || '');
      setPlayerCount(data.playerCount);
      const challenges = data.currentGame?.challenges || [];
      const challengeIndex = challenges.findIndex(
        (item: SafeChallenge) => item.id === data.session.currentChallengeId,
      );
      const candidate = data.currentChallenge || challenges[challengeIndex];
      const activeChallenge = candidate ? {
        ...candidate,
        challengeIndex: Number.isFinite(candidate.challengeIndex) ? candidate.challengeIndex : Math.max(challengeIndex, 0),
        totalChallenges: Number.isFinite(candidate.totalChallenges) ? candidate.totalChallenges : challenges.length,
      } as SafeChallenge : null;
      if (data.session.status === 'LOBBY') setScreen('lobby');
      else if (data.session.status === 'ENDED' || data.session.status === 'FINAL') setScreen('final');
      else if (data.session.status === 'RESULTS' || data.session.status === 'LEADERBOARD') setScreen('leaderboard');
      else if (activeChallenge) {
        setChallenge(activeChallenge as SafeChallenge);
        setScreen('challenge');
      }
    };
    const onPlayerJoined = (data: { playerCount: number }) => setPlayerCount(data.playerCount);
    const onGameStarted = () => setScreen('challenge');
    const onChallengeStarted = (c: SafeChallenge) => {
      setChallenge(c);
      setCorrectAnswer(null);
      setExplanation(null);
      setStats(null);
      setScreen('challenge');
      setRoundEnded(null);
    };
    const onChallengeEnded = (data: { correctAnswer: string | string[]; explanation: string | null }) => {
      setCorrectAnswer(data.correctAnswer);
      setExplanation(data.explanation);
      setScreen('answer');
    };
    const onChallengeStats = (data: { submissionCount: number; correctCount: number }) => setStats(data);
    const onLeaderboardUpdated = (data: { leaderboard: LeaderboardEntry[] }) => {
      setLeaderboard(data.leaderboard);
      setScreen('leaderboard');
    };
    const onGameEnded = () => setScreen('final');
    const onRoundEnded = (data: { message: string }) => setRoundEnded(data.message);
    const onBroadcastCreated = (data: { message: string }) => {
      setBroadcastMsg(data.message);
      setTimeout(() => setBroadcastMsg(null), 10000);
    };
    const onPollCreated = (data: any) => setPollData({ question: data.question, options: data.options, results: {} });
    const onPollUpdated = (data: { results: Array<{ optionIndex: number; count: number }> }) => {
      const map: Record<number, number> = {};
      data.results.forEach(r => { map[r.optionIndex] = r.count; });
      setPollData(p => p ? { ...p, results: map } : null);
    };
    const onPollClosed = (data: { results: Array<{ optionIndex: number; count: number }> }) => {
      const map: Record<number, number> = {};
      data.results.forEach(r => { map[r.optionIndex] = r.count; });
      setPollData(p => p ? { ...p, results: map } : null);
      setTimeout(() => setPollData(null), 15000);
    };

    socket.on('connect', onConnect);
    socket.on('session_state_update', onSessionState);
    socket.on('player:joined', onPlayerJoined);
    socket.on('game:started', onGameStarted);
    socket.on('challenge:started', onChallengeStarted);
    socket.on('challenge:ended', onChallengeEnded);
    socket.on('challenge:stats', onChallengeStats);
    socket.on('leaderboard:updated', onLeaderboardUpdated);
    socket.on('game:ended', onGameEnded);
    socket.on('round:ended', onRoundEnded);
    socket.on('broadcast:created', onBroadcastCreated);
    socket.on('poll:created', onPollCreated);
    socket.on('poll:updated', onPollUpdated);
    socket.on('poll:closed', onPollClosed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('session_state_update', onSessionState);
      socket.off('player:joined', onPlayerJoined);
      socket.off('game:started', onGameStarted);
      socket.off('challenge:started', onChallengeStarted);
      socket.off('challenge:ended', onChallengeEnded);
      socket.off('challenge:stats', onChallengeStats);
      socket.off('leaderboard:updated', onLeaderboardUpdated);
      socket.off('game:ended', onGameEnded);
      socket.off('round:ended', onRoundEnded);
      socket.off('broadcast:created', onBroadcastCreated);
      socket.off('poll:created', onPollCreated);
      socket.off('poll:updated', onPollUpdated);
      socket.off('poll:closed', onPollClosed);
      socket.disconnect();
    };
  }, [code]);

  // Timer countdown
  useEffect(() => {
    if (!challenge?.challengeEndsAt || screen !== 'challenge') { setSecondsLeft(null); return; }
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((new Date(challenge.challengeEndsAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    }, 100);
    return () => clearInterval(interval);
  }, [challenge?.challengeEndsAt, screen]);

  const timerColor = secondsLeft !== null && secondsLeft <= 5 
    ? 'var(--term-red)' 
    : secondsLeft !== null && secondsLeft <= 10 
    ? 'var(--term-yellow)' 
    : 'var(--term-cyan)';

  // ── LOBBY SCREEN ───────────────────────────────────────
  if (screen === 'lobby') {
    return (
      <div className="min-h-screen bg-[var(--term-bg-void)] text-white flex flex-col items-center justify-center p-6 md:p-12 relative font-mono select-none">
        {/* Ambient Grid & Scanlines */}
        <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />
        <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_center,rgba(0,255,204,0.08)_0%,transparent_75%)] -z-10" />

        <div className="w-full max-w-4xl flex flex-col items-center text-center animate-fade-in-scale">
          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 border-2 border-[var(--term-cyan)] bg-[var(--term-bg-elevated)] shadow-[4px_4px_0_0_var(--term-cyan)]">
              <Terminal size={36} className="text-[var(--term-cyan)]" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold tracking-[0.3em] text-[var(--term-cyan)]">LIVE TOURNAMENT STAGE</div>
              <div className="text-3xl font-black tracking-tighter text-white">TERMINAL</div>
            </div>
          </div>

          {/* Game Title */}
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white mb-8 max-w-3xl leading-tight">
            {gameName || 'STANDBY FOR OPERATIONAL EVENT'}
          </h1>

          {/* Join Code Giant Display */}
          <div className="relative mb-10 w-full max-w-lg">
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[var(--term-cyan)]" />

            <div className="bg-[var(--term-bg-surface)] border-2 border-[var(--term-cyan)] p-6 md:p-8 shadow-[8px_8px_0_0_#000]">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--term-text-secondary)] mb-2">
                JOIN WITH ROOM CODE:
              </div>
              <div className="text-6xl md:text-8xl font-black text-[var(--term-cyan)] tracking-[0.15em] drop-shadow-[0_0_20px_var(--term-cyan-glow-strong)]">
                {code}
              </div>
            </div>
          </div>

          {/* Enrolled Players Indicator */}
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-[var(--term-bg-elevated)] border border-[var(--term-border-muted)] shadow-[4px_4px_0_0_#000]">
            <Users size={24} className="text-[var(--term-cyan)]" />
            <span className="text-xl md:text-2xl font-bold">
              <strong className="text-[var(--term-green)]">{playerCount}</strong> PLAYERS ENROLLED
            </span>
            <span className="w-2.5 h-2.5 rounded-none bg-[var(--term-green)] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── CHALLENGE SCREEN ───────────────────────────────────
  if (screen === 'challenge' && challenge) {
    const options = challenge.options || [];
    return (
      <div className="min-h-screen bg-[var(--term-bg-void)] text-white p-6 md:p-12 flex flex-col font-mono select-none relative">
        <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />

        {/* Broadcast banner */}
        {broadcastMsg && (
          <div className="fixed top-0 left-0 right-0 bg-cyan-950/90 border-b-2 border-[var(--term-cyan)] p-3 text-center z-50 animate-slide-in-up">
            <span className="text-[var(--term-cyan)] font-bold text-lg tracking-wider">
              📢 BROADCAST: {broadcastMsg}
            </span>
          </div>
        )}

        {/* Top Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--term-border-subtle)] pb-4 mb-8">
          <div>
            <div className="text-xs text-[var(--term-text-muted)] uppercase tracking-wider">
              {challenge.roundTitle || 'ACTIVE STAGE ROUND'}
            </div>
            <div className="text-xl md:text-2xl font-black text-white mt-0.5">
              CHALLENGE {challenge.challengeIndex + 1} OF {challenge.totalChallenges}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-[var(--term-text-muted)] block uppercase">REWARD</span>
              <span className="text-xl font-bold text-[var(--term-cyan)]">{challenge.points} PTS</span>
            </div>

            <div 
              className="text-5xl md:text-6xl font-black px-5 py-2 bg-[var(--term-bg-surface)] border-2 border-[var(--term-border-muted)] min-w-[120px] text-center shadow-[4px_4px_0_0_#000]"
              style={{ color: timerColor, borderColor: timerColor }}
            >
              {secondsLeft !== null ? secondsLeft : '—'}
            </div>
          </div>
        </div>

        {/* Question Prompt */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
          <div className="w-full bg-[var(--term-bg-surface)] border-2 border-[var(--term-cyan)] p-8 md:p-12 shadow-[8px_8px_0_0_#000] relative mb-8">
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white" />

            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-center text-white leading-snug">
              {challenge.prompt}
            </h1>
          </div>

          {/* Options Grid */}
          {options.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {options.map((opt, i) => (
                <div 
                  key={i} 
                  className="bg-[var(--term-bg-surface)] border-2 p-5 flex items-center gap-4 shadow-[4px_4px_0_0_#000] transition-transform"
                  style={{ borderColor: OPTION_COLORS[i] || 'var(--term-cyan)' }}
                >
                  <div 
                    className="w-12 h-12 flex items-center justify-center font-black text-xl text-black shrink-0 font-mono shadow-[2px_2px_0_0_#000]"
                    style={{ background: OPTION_COLORS[i] || 'var(--term-cyan)' }}
                  >
                    {OPTION_LABELS[i]}
                  </div>
                  <span className="text-lg md:text-xl font-bold text-white leading-tight">
                    {opt}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ANSWER REVEAL SCREEN ───────────────────────────────
  if (screen === 'answer' && challenge) {
    const options = challenge.options || [];
    const isCorrect = (opt: string) => {
      if (!correctAnswer) return false;
      return Array.isArray(correctAnswer) ? correctAnswer.includes(opt) : correctAnswer === opt;
    };

    return (
      <div className="min-h-screen bg-[var(--term-bg-void)] text-white p-6 md:p-12 flex flex-col font-mono select-none relative">
        <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />

        <div className="text-center mb-6">
          <TerminalBadge variant="cyan" dot={true}>
            CHALLENGE {challenge.challengeIndex + 1} // ANSWER VERIFICATION
          </TerminalBadge>
        </div>

        <h1 className="text-2xl md:text-4xl font-black text-center text-white max-w-4xl mx-auto mb-8">
          {challenge.prompt}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto w-full mb-6">
          {options.map((opt, i) => {
            const correct = isCorrect(opt);
            return (
              <div 
                key={i} 
                className={`p-5 flex items-center gap-4 border-2 transition-all ${
                  correct 
                    ? 'bg-emerald-950/40 border-[var(--term-green)] shadow-[0_0_20px_var(--term-green-glow)]' 
                    : 'bg-[var(--term-bg-surface)] border-[var(--term-border-subtle)] opacity-40'
                }`}
              >
                <div 
                  className={`w-12 h-12 flex items-center justify-center font-black text-xl shrink-0 ${
                    correct ? 'bg-[var(--term-green)] text-black' : 'bg-[var(--term-bg-elevated)] text-[var(--term-text-muted)]'
                  }`}
                >
                  {correct ? '✓' : OPTION_LABELS[i]}
                </div>
                <span className={`text-lg md:text-xl font-bold ${correct ? 'text-[var(--term-green)]' : 'text-zinc-400'}`}>
                  {opt}
                </span>
              </div>
            );
          })}
        </div>

        {explanation && (
          <div className="max-w-4xl mx-auto w-full p-4 bg-[var(--term-bg-surface)] border border-[var(--term-cyan)] text-center text-zinc-300 text-sm">
            <span className="text-[var(--term-cyan)] font-bold mr-2">// EXPLANATION:</span>
            <span>{explanation}</span>
          </div>
        )}

        {stats && (
          <div className="text-center mt-6 text-sm text-[var(--term-text-secondary)]">
            <strong className="text-[var(--term-cyan)]">{stats.submissionCount}</strong> SUBMISSIONS RECORDED •{' '}
            <strong className="text-[var(--term-green)]">{stats.correctCount}</strong> ACCURATE
          </div>
        )}
      </div>
    );
  }

  // ── LEADERBOARD SCREEN ─────────────────────────────────
  if (screen === 'leaderboard') {
    return (
      <div className="min-h-screen bg-[var(--term-bg-void)] text-white p-6 md:p-12 flex flex-col items-center font-mono select-none relative">
        <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />

        <div className="text-center mb-8">
          <Trophy size={48} className="text-[var(--term-yellow)] mx-auto mb-3 drop-shadow-[0_0_12px_var(--term-yellow-glow)]" />
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
            STAGE LEADERBOARD
          </h1>
          {roundEnded && (
            <p className="text-sm text-[var(--term-cyan)] mt-2 uppercase tracking-wider">{roundEnded}</p>
          )}
        </div>

        <div className="w-full max-w-3xl flex flex-col gap-3">
          {leaderboard.slice(0, 10).map((entry, i) => (
            <div 
              key={entry.id} 
              className={`p-4 border-2 flex items-center gap-4 transition-all shadow-[4px_4px_0_0_#000] ${
                i === 0 
                  ? 'bg-amber-950/30 border-amber-400 shadow-[0_0_20px_rgba(252,238,10,0.25)]' 
                  : i === 1 
                  ? 'bg-zinc-900 border-zinc-400' 
                  : i === 2 
                  ? 'bg-orange-950/20 border-orange-400' 
                  : 'bg-[var(--term-bg-surface)] border-[var(--term-border-subtle)]'
              }`}
            >
              <span className={`w-12 text-center font-black text-2xl ${
                i === 0 ? 'text-[var(--term-yellow)]' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-orange-400' : 'text-zinc-600'
              }`}>
                #{i + 1}
              </span>
              <span className="flex-1 font-bold text-xl truncate text-white">
                {entry.displayName || entry.name}
              </span>
              <span className="text-2xl md:text-3xl font-black text-[var(--term-cyan)]">
                {entry.score} <span className="text-xs text-[var(--term-text-muted)] font-normal">PTS</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── POLL SCREEN ────────────────────────────────────────
  if (pollData) {
    const total = Object.values(pollData.results).reduce((a, b) => a + b, 0);
    return (
      <div className="min-h-screen bg-[var(--term-bg-void)] text-white p-6 md:p-12 flex flex-col items-center justify-center font-mono select-none relative">
        <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />

        <h2 className="text-3xl md:text-4xl font-black text-center max-w-3xl mb-8 uppercase leading-tight">
          {pollData.question}
        </h2>

        <div className="w-full max-w-2xl flex flex-col gap-4">
          {pollData.options.map((opt, i) => {
            const count = pollData.results[i] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={i} className="bg-[var(--term-bg-surface)] border border-[var(--term-border-muted)] p-4 shadow-[4px_4px_0_0_#000]">
                <div className="flex justify-between items-center mb-2 font-bold text-base">
                  <span>{opt}</span>
                  <span className="text-[var(--term-cyan)]">{pct}% ({count})</span>
                </div>
                <div className="bg-[var(--term-bg-base)] h-3 w-full border border-zinc-800">
                  <div 
                    className="h-full bg-[var(--term-cyan)] transition-all duration-500" 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-sm text-[var(--term-text-muted)]">{total} LIVE RESPONSES CAPTURED</p>
      </div>
    );
  }

  // ── FINAL SCREEN ───────────────────────────────────────
  if (screen === 'final') {
    return (
      <div className="min-h-screen bg-[var(--term-bg-void)] text-white p-6 md:p-12 flex flex-col items-center justify-center font-mono select-none relative">
        <div className="fixed inset-0 pointer-events-none term-grid-lines -z-10" />

        <div className="text-center max-w-xl">
          <Trophy size={72} className="text-[var(--term-yellow)] mx-auto mb-4 drop-shadow-[0_0_20px_var(--term-yellow-glow)]" />
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tight mb-2">
            MISSION COMPLETE
          </h1>
          <p className="text-lg text-[var(--term-text-secondary)] mb-8">
            SESSION CONCLUDED // {gameName}
          </p>

          {leaderboard[0] && (
            <div className="bg-[var(--term-bg-surface)] border-2 border-[var(--term-yellow)] p-8 shadow-[8px_8px_0_0_#000] relative">
              <div className="text-xs font-bold text-[var(--term-yellow)] uppercase tracking-[0.25em] mb-2">
                🏆 TOURNAMENT CHAMPION
              </div>
              <div className="text-3xl md:text-4xl font-black text-white mb-2">
                {leaderboard[0].displayName || leaderboard[0].name}
              </div>
              <div className="text-2xl font-black text-[var(--term-cyan)]">
                {leaderboard[0].score} PTS
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--term-bg-void)] text-white flex items-center justify-center font-mono p-4">
      <div className="text-center text-[var(--term-text-secondary)]">
        <Terminal size={36} className="text-[var(--term-cyan)] mx-auto mb-3 animate-pulse" />
        <p className="text-sm uppercase tracking-wider">ESTABLISHING STAGE FEED // {code}</p>
      </div>
    </div>
  );
}
