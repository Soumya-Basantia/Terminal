import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ArrowRight, Shield } from 'lucide-react';

export default function JoinPage() {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCode.trim().toUpperCase();
    if (clean) {
      navigate(`/play/${clean}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--term-bg-void)]">
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,255,204,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        zIndex: 0
      }} />

      <div className="w-full max-w-md relative z-10">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="p-2 border border-[var(--term-cyan)] bg-[var(--term-bg-elevated)] shadow-[3px_3px_0_0_var(--term-cyan)]">
            <Terminal size={22} className="text-[var(--term-cyan)]" />
          </div>
          <span className="font-mono font-black text-3xl tracking-tight text-white">TERMINAL</span>
        </div>

        <div className="bg-[var(--term-bg-surface)] border border-[var(--term-border-muted)] shadow-[6px_6px_0_0_#000] overflow-hidden relative">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--term-cyan)]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--term-cyan)]" />

          <div className="bg-[var(--term-bg-elevated)] px-5 py-3 border-b border-[var(--term-border-faint)] flex items-center gap-2">
            <Shield size={12} className="text-[var(--term-cyan)]" />
            <span className="font-mono text-[9px] text-[var(--term-cyan)] font-bold tracking-[0.3em] uppercase">
              LIVE ACCESS // JOIN SESSION
            </span>
          </div>

          <form onSubmit={handleJoin} className="p-6 flex flex-col gap-5">
            <div>
              <label className="block text-[9px] font-mono font-bold tracking-[0.2em] uppercase text-[var(--term-text-muted)] mb-2">
                ROOM CODE
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. WITNZ"
                maxLength={8}
                required
                autoFocus
                className="w-full bg-[var(--term-bg-void)] border border-[var(--term-border-muted)] focus:border-[var(--term-cyan)] px-4 py-4 font-mono text-2xl tracking-widest text-center text-[var(--term-cyan)] uppercase outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[var(--term-cyan)] text-black font-mono font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:translate-y-0.5 transition-all shadow-[3px_3px_0_0_#000] hover:shadow-[0_0_20px_var(--term-cyan-glow)]"
            >
              <span>ENTER SESSION</span>
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
