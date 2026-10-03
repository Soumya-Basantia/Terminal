import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket } from '../lib/socket';
import type { LeaderboardEntry } from '../types';
import api from '../lib/api';
import { Trophy, Home, RotateCcw, Terminal, Medal } from 'lucide-react';

export default function ResultsPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const code = sessionCode?.toUpperCase() || '';
  const player = JSON.parse(localStorage.getItem('terminal_player') || 'null');

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/sessions/${code}/leaderboard`)
      .then(res => setLeaderboard(res.data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code]);

  const myEntry = leaderboard.find(e => e.id === player?.id);

  const rankColors = [
    'var(--term-yellow)',   // Gold
    '#9CA3AF',              // Silver
    '#B45309',              // Bronze
  ];

  return (
    <div className="min-h-screen bg-[var(--term-bg-void)] font-mono p-4 pb-16">
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,255,204,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px', zIndex: 0,
      }} />

      <div className="max-w-lg mx-auto relative z-10 pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Terminal size={14} className="text-[var(--term-cyan)]" />
            <span className="text-[9px] tracking-[0.3em] text-[var(--term-cyan)] font-bold uppercase">TERMINAL</span>
          </div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy size={32} className="text-[var(--term-yellow)]" />
            <h1 className="font-mono font-black text-3xl uppercase tracking-tight text-white">
              FINAL RESULTS
            </h1>
          </div>
          <p className="text-[var(--term-text-muted)] text-xs uppercase tracking-widest font-bold">
            SESSION: {code}
          </p>
        </div>

        {/* My Result */}
        {myEntry && (
          <div className="mb-6 bg-[var(--term-bg-surface)] border border-[var(--term-cyan)] shadow-[4px_4px_0_0_var(--term-cyan)] p-5 relative">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--term-cyan)]" />

            <div className="text-[9px] tracking-[0.3em] text-[var(--term-cyan)] font-bold uppercase mb-3">
              // YOUR_RESULT
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-base">{player?.displayName || player?.username}</p>
                <p className="text-[var(--term-text-muted)] text-xs mt-0.5">RANK #{myEntry.rank}</p>
              </div>
              <div className="text-right">
                <div className="font-mono font-black text-4xl text-[var(--term-cyan)]">{myEntry.score}</div>
                <div className="text-[9px] text-[var(--term-text-muted)] uppercase tracking-widest">PTS</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="bg-[var(--term-bg-surface)] border border-[var(--term-border-muted)] mb-6">
          <div className="px-4 py-3 border-b border-[var(--term-border-faint)] flex items-center gap-2">
            <Medal size={12} className="text-[var(--term-yellow)]" />
            <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-yellow)] uppercase">
              // LEADERBOARD_FINAL
            </span>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 bg-[var(--term-bg-elevated)] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-[var(--term-border-faint)]">
              {leaderboard.slice(0, 10).map((entry, i) => {
                const isMe = entry.id === player?.id;
                const rankColor = i < 3 ? rankColors[i] : 'var(--term-text-muted)';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isMe ? 'bg-[rgba(0,255,204,0.06)]' : 'hover:bg-[var(--term-bg-elevated)]'
                    }`}
                  >
                    <span
                      className="font-mono font-black text-sm w-7 shrink-0 text-center"
                      style={{ color: rankColor }}
                    >
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </span>
                    <span className={`flex-1 text-sm font-bold ${isMe ? 'text-[var(--term-cyan)]' : 'text-[var(--term-text-primary)]'}`}>
                      {entry.displayName || entry.name}
                      {isMe && <span className="text-[9px] ml-2 opacity-60 font-normal">← you</span>}
                    </span>
                    <span className="font-mono font-black text-sm" style={{ color: rankColor }}>
                      {entry.score} <span className="text-[9px] font-normal text-[var(--term-text-muted)]">pts</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/join')}
            className="flex-1 py-3 bg-[var(--term-cyan)] text-black font-mono font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-[3px_3px_0_0_#000]"
          >
            <RotateCcw size={13} /> PLAY AGAIN
          </button>
          <button
            onClick={() => { localStorage.removeItem('terminal_player'); navigate('/'); }}
            className="flex-1 py-3 bg-transparent border border-[var(--term-border-muted)] text-[var(--term-text-secondary)] font-mono font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-[var(--term-cyan)] hover:text-white transition-all"
          >
            <Home size={13} /> EXIT
          </button>
        </div>
      </div>
    </div>
  );
}
