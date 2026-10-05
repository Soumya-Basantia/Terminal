import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';
import type { Game } from '../types';
import { Terminal, Plus, Play, Zap, LogOut, Code, User, Cpu } from 'lucide-react';
import { BrutalistPanel, BrutalistButton } from '../components/ui/Brutalist';

function DesignerLayout({ children, clubId, clubName }: { children: React.ReactNode, clubId?: string, clubName?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--term-bg-void)] font-mono">
      {/* ── CYBERCORE TOP NAV ── */}
      <header className="bg-[var(--term-bg-surface)] border-b border-[var(--term-border-muted)] sticky top-0 z-50 min-h-[56px] px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 border border-[var(--term-cyan)] bg-[var(--term-bg-elevated)] shadow-[2px_2px_0_0_var(--term-cyan)]">
            <Terminal size={14} className="text-[var(--term-cyan)]" />
          </div>
          <span className="font-mono font-black text-lg tracking-tighter text-white">TERMINAL</span>
          {clubName && (
            <span className="font-mono text-xs font-bold px-2 py-0.5 border border-[var(--term-border-muted)] text-[var(--term-cyan)] bg-[var(--term-bg-elevated)] truncate max-w-[120px] sm:max-w-none">
              {clubName}
            </span>
          )}
        </div>

        {/* Nav Links */}
        {clubId && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to={`/clubs/${clubId}`}
              className="px-2.5 sm:px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[var(--term-text-secondary)] hover:text-[var(--term-cyan)] hover:bg-[var(--term-bg-elevated)] transition-colors"
            >DASHBOARD</Link>
            <Link
              to={`/clubs/${clubId}/events`}
              className="px-2.5 sm:px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-[var(--term-text-secondary)] hover:text-[var(--term-cyan)] hover:bg-[var(--term-bg-elevated)] transition-colors"
            >EVENTS</Link>
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1 hidden md:block" />

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link to="/clubs" className="text-[10px] font-bold tracking-widest uppercase text-[var(--term-text-muted)] hover:text-[var(--term-cyan)] transition-colors hidden sm:inline">
            CHANGE CLUB
          </Link>
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[var(--term-border-faint)] bg-[var(--term-bg-elevated)]">
            <Cpu size={10} className="text-[var(--term-cyan)] shrink-0" />
            <span className="text-[10px] font-bold text-[var(--term-cyan)] uppercase tracking-widest truncate max-w-[90px] sm:max-w-none">
              {((user as any)?.username || user?.name || user?.email || 'OPERATOR').split('@')[0].toUpperCase()}
            </span>
          </div>
          <BrutalistButton onClick={logout} variant="danger" className="text-[10px] py-1 px-2.5 sm:px-3 min-h-[32px]">
            <span className="flex items-center gap-1"><LogOut size={11} /> <span className="hidden xs:inline">LOGOUT</span></span>
          </BrutalistButton>
        </div>
      </header>

      <main className="flex-1 p-3.5 sm:p-6 md:p-7 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => api.get('/clubs').then(r => r.data),
  });

  useEffect(() => {
    if (!clubId && clubs && clubs.length === 1) {
      navigate(`/clubs/${clubs[0].id}`);
    }
  }, [clubId, clubs, navigate]);

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ['games', clubId],
    queryFn: () => api.get(`/games?clubId=${clubId}`).then(r => r.data.games as Game[]),
    enabled: !!clubId,
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', clubId],
    queryFn: () => api.get(`/events?clubId=${clubId}`).then(r => r.data),
    enabled: !!clubId,
  });

  if (clubsLoading) {
    return <DesignerLayout><div className="text-center font-mono text-[var(--term-text-secondary)] py-16">// LOADING CLUBS...</div></DesignerLayout>;
  }

  // Club selection page
  if (!clubId) {
    return (
      <DesignerLayout>
        <div style={{ maxWidth: 720, margin: '0 auto', marginTop: 32 }}>
          <div className="mb-8">
            <div className="text-[10px] font-bold tracking-[0.3em] text-[var(--term-cyan)] mb-1">// SYSTEM ACCESS</div>
            <h1 className="font-mono font-black text-3xl uppercase tracking-tight text-white">
              SELECT <span className="text-[var(--term-cyan)]">CLUB</span>
            </h1>
          </div>

          {(!clubs || clubs.length === 0) ? (
            <BrutalistPanel title="SYSTEM NOTICE">
              <div className="p-6">
                <p className="font-mono text-sm text-[var(--term-text-secondary)]">
                  // ACCOUNT NOT ASSOCIATED WITH ANY CLUBS — CONTACT ADMINISTRATOR
                </p>
              </div>
            </BrutalistPanel>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {clubs.map((club: any) => (
                <div
                  key={club.id}
                  onClick={() => navigate(`/clubs/${club.id}`)}
                  className="flex items-center justify-between p-5 border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] hover:bg-[var(--term-bg-elevated)] hover:border-[var(--term-cyan)] cursor-pointer transition-all group"
                >
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">// CLUB NODE</div>
                    <h2 className="font-mono font-black text-xl uppercase tracking-tight text-white group-hover:text-[var(--term-cyan)] transition-colors">{club.name}</h2>
                    <p className="font-mono text-xs text-[var(--term-text-secondary)] mt-1">{club.focus || 'NO FOCUS DEFINED'}</p>
                  </div>
                  <BrutalistButton variant="primary" className="px-4 py-2 text-xs">
                    ENTER SYSTEM →
                  </BrutalistButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </DesignerLayout>
    );
  }

  const currentClub = clubs?.find((c: any) => c.id === clubId);
  if (clubs && !currentClub) {
    return <DesignerLayout><div className="text-center font-mono text-[var(--term-red)] py-16">// CLUB ACCESS DENIED OR NOT FOUND</div></DesignerLayout>;
  }

  const games = gamesData || [];
  const events = eventsData || [];
  const publishedGames = games.filter(g => g.status === 'PUBLISHED');
  const totalQuestions = games.reduce((sum, g) => sum + ((g._count as any)?.challenges || 0), 0);

  return (
    <DesignerLayout clubId={clubId} clubName={currentClub?.name}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div className="mb-8">
          <div className="text-[10px] font-bold tracking-[0.3em] text-[var(--term-cyan)] mb-1">// CLUB CENTER</div>
          <h1 className="font-mono font-black text-3xl uppercase tracking-tight text-white">
            {currentClub?.name || 'CLUB'} <span className="text-[var(--term-cyan)]">COMMAND</span>
          </h1>
          <p className="font-mono text-xs text-[var(--term-text-secondary)] mt-1">
            FOCUS: {currentClub?.focus?.toUpperCase() || 'UNKNOWN'} // OPERATOR: {((user as any)?.username || user?.name || user?.email || 'ADMIN').toUpperCase()}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-5">

            {/* Quick Actions */}
            <BrutalistPanel>
              <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
                <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// QUICK_ACTIONS</span>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <BrutalistButton
                    onClick={() => navigate(`/clubs/${clubId}/games/new`)}
                    variant="primary"
                    className="py-4 sm:py-5 flex-col gap-2 text-xs min-h-[48px]"
                  >
                    <Plus size={20} />
                    <span>NEW GAME</span>
                  </BrutalistButton>
                  <BrutalistButton
                    onClick={() => navigate(`/clubs/${clubId}/events`)}
                    className="py-4 sm:py-5 flex-col gap-2 text-xs min-h-[48px]"
                  >
                    <Play size={20} className="text-[var(--term-cyan)]" />
                    <span>MANAGE EVENTS</span>
                  </BrutalistButton>
                </div>
              </div>
            </BrutalistPanel>

            {/* Recent Games */}
            <BrutalistPanel>
              <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
                <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// RECENT_GAMES</span>
              </div>
              <div className="p-4 sm:p-5">
                {gamesLoading ? (
                  <div className="grid gap-2.5">
                    {[1, 2].map(i => <div key={i} className="h-14 bg-[var(--term-bg-elevated)] border border-[var(--term-border-faint)] animate-pulse" />)}
                  </div>
                ) : games.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-[var(--term-border-faint)]">
                    <Code size={28} className="mx-auto mb-3 text-[var(--term-text-muted)]" />
                    <p className="font-mono text-xs text-[var(--term-text-muted)]">// NO GAMES DETECTED IN DATABASE</p>
                  </div>
                ) : (
                  <div className="grid gap-2.5">
                    {games.slice(0, 5).map(game => (
                      <GameRow key={game.id} game={game} clubId={clubId!} />
                    ))}
                  </div>
                )}
              </div>
            </BrutalistPanel>
          </div>

          {/* Right sidebar — Club Stats */}
          <div className="lg:col-span-4">
            <BrutalistPanel>
              <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
                <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// CLUB_STATS</span>
              </div>
              <div className="p-4 sm:p-5 flex flex-col gap-5">
                <div>
                  <div className="font-mono text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">TOTAL EVENTS</div>
                  <div className="font-mono font-black text-3xl sm:text-4xl text-[var(--term-blue)]">{events.length}</div>
                </div>
                <div className="h-px bg-[var(--term-border-faint)]" />
                <div>
                  <div className="font-mono text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">PUBLISHED GAMES</div>
                  <div className="font-mono font-black text-3xl sm:text-4xl text-[var(--term-cyan)]">{publishedGames.length}</div>
                </div>
                <div className="h-px bg-[var(--term-border-faint)]" />
                <div>
                  <div className="font-mono text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] mb-1">TOTAL QUESTIONS</div>
                  <div className="font-mono font-black text-3xl sm:text-4xl text-[var(--term-yellow)]">{totalQuestions}</div>
                </div>
              </div>
            </BrutalistPanel>
          </div>
        </div>
      </div>
    </DesignerLayout>
  );
}

function GameRow({ game, clubId }: { game: Game, clubId: string }) {
  const navigate = useNavigate();
  const questionCount = (game._count as any)?.challenges || 0;

  return (
    <div
      className="flex items-center justify-between p-3 border border-[var(--term-border-faint)] bg-[var(--term-bg-elevated)] hover:border-[var(--term-cyan)] hover:bg-[var(--term-bg-highlight)] transition-all cursor-pointer group"
      onClick={() => navigate(`/clubs/${clubId}/games/${game.id}/edit`)}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono font-bold text-sm uppercase text-white group-hover:text-[var(--term-cyan)] transition-colors">{game.name}</span>
          <span className={`text-[9px] px-1.5 py-0.5 font-bold font-mono border uppercase ${
            game.status === 'PUBLISHED'
              ? 'text-[var(--term-green)] border-[var(--term-green)]'
              : 'text-[var(--term-yellow)] border-[var(--term-yellow)]'
          }`}>
            {game.status}
          </span>
        </div>
        <div className="font-mono text-[10px] text-[var(--term-text-muted)] flex gap-4">
          <span className="flex items-center gap-1"><Zap size={9} /> {questionCount} Qs</span>
          <span className="flex items-center gap-1"><User size={9} /> MAX {game.maxPlayers}</span>
        </div>
      </div>
      <BrutalistButton onClick={(e) => { e.stopPropagation(); navigate(`/clubs/${clubId}/games/${game.id}/edit`); }} className="text-[9px] px-3 py-1.5">
        EDIT
      </BrutalistButton>
    </div>
  );
}

export { DesignerLayout };
