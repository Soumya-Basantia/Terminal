import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { DesignerLayout } from './DashboardPage';
import { HelpCircle, Zap, ArrowRight } from 'lucide-react';
import { TerminalInput, TerminalButton, TerminalBadge } from '../components/ui';

const TEMPLATES = [
  {
    id: 'QUIZ',
    name: 'Quiz',
    icon: <HelpCircle size={22} />,
    description: 'MCQ, True/False, Multiple-choice questions. Classic game show format.',
    color: 'var(--term-cyan)',
    recommended: true,
  },
  {
    id: 'RAPID_FIRE',
    name: 'Rapid Fire',
    icon: <Zap size={22} />,
    description: 'Faster pacing, shorter timers. Perfect for energetic rounds.',
    color: 'var(--term-yellow)',
    recommended: false,
  },
];

export default function NewGamePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [template, setTemplate] = useState<'QUIZ' | 'RAPID_FIRE'>('QUIZ');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    teamsEnabled: false,
    maxPlayers: 200,
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!formData.name.trim()) {
      setError('Game name is required');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const payload = clubId
        ? { ...formData, template, leaderboardVisibility: 'LIVE', speedBonus: template === 'RAPID_FIRE', clubId }
        : { ...formData, template, leaderboardVisibility: 'LIVE', speedBonus: template === 'RAPID_FIRE' };
      const res = await api.post('/games', payload);
      navigate(clubId ? `/clubs/${clubId}/games/${res.data.game.id}/edit` : `/games/${res.data.game.id}/edit`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  }

  return (
    <DesignerLayout clubId={clubId}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="text-[10px] font-bold tracking-[0.3em] text-[var(--term-cyan)] mb-1">
            // STEP {step} OF 2
          </div>
          <h1 className="font-mono font-black text-[clamp(1.5rem,5vw,2rem)] uppercase tracking-tight text-white">
            INITIALIZE <span className="text-[var(--term-cyan)]">GAME</span>
          </h1>
          <p className="font-mono text-xs text-[var(--term-text-secondary)] mt-1">CONFIGURE NEW GAME INSTANCE.</p>
        </div>

        <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />

          {step === 1 && (
            <>
              <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
                <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// CHOOSE_TEMPLATE</span>
              </div>
              <div className="p-4 sm:p-5">
                <p className="font-mono text-xs text-[var(--term-text-secondary)] mb-5">WHAT KIND OF GAME DO YOU WANT TO CREATE?</p>

                <div className="flex flex-col gap-3 mb-6">
                  {TEMPLATES.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setTemplate(t.id as any)}
                      className={`p-3.5 sm:p-4 border cursor-pointer flex items-start gap-3 sm:gap-4 transition-all ${
                        template === t.id
                          ? 'border-[var(--term-cyan)] bg-[var(--term-bg-elevated)]'
                          : 'border-[var(--term-border-faint)] bg-[var(--term-bg-void)] hover:border-[var(--term-border-muted)] hover:bg-[var(--term-bg-elevated)]'
                      }`}
                    >
                      <div style={{ color: t.color, flexShrink: 0, marginTop: 2 }}>{t.icon}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono font-black text-base uppercase tracking-tight text-white">{t.name}</span>
                          {t.recommended && (
                            <TerminalBadge variant="cyan">RECOMMENDED</TerminalBadge>
                          )}
                        </div>
                        <p className="font-mono text-xs text-[var(--term-text-secondary)]">{t.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <TerminalButton onClick={() => navigate(clubId ? `/clubs/${clubId}` : '/dashboard')} variant="secondary" className="flex-1 min-h-[44px]">
                    CANCEL
                  </TerminalButton>
                  <TerminalButton onClick={() => setStep(2)} variant="primary" className="flex-1 min-h-[44px]">
                    CONTINUE <ArrowRight size={13} />
                  </TerminalButton>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
                <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// GAME_PARAMETERS</span>
              </div>
              <div className="p-4 sm:p-5">
                <p className="font-mono text-xs text-[var(--term-text-secondary)] mb-5">CONFIGURE BASIC INSTANCE SETTINGS.</p>

                <div className="flex flex-col gap-5">
                  <TerminalInput
                    label="GAME NAME *"
                    placeholder="e.g. CORE.HACK // ROUND 1"
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    autoFocus
                    required
                  />
                  <TerminalInput
                    label="DESCRIPTION (OPTIONAL)"
                    placeholder="Brief description of the game..."
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TerminalInput
                      label="MAX PLAYERS"
                      type="number"
                      min="2"
                      max="1000"
                      value={String(formData.maxPlayers)}
                      onChange={e => setFormData(p => ({ ...p, maxPlayers: Number(e.target.value) }))}
                    />
                    <div className="flex items-center sm:items-end pb-1 gap-3 min-h-[44px]">
                      <input
                        type="checkbox"
                        id="teams"
                        checked={formData.teamsEnabled}
                        onChange={e => setFormData(p => ({ ...p, teamsEnabled: e.target.checked }))}
                        className="w-4 h-4 cursor-pointer"
                        style={{ accentColor: 'var(--term-cyan)' }}
                      />
                      <label htmlFor="teams" className="font-mono text-xs font-bold text-[var(--term-text-secondary)] uppercase cursor-pointer">
                        ENABLE TEAMS
                      </label>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mt-5 p-3 border border-[var(--term-red)] bg-[var(--term-red-glow)] text-[var(--term-red)] font-mono text-xs">
                    // ERROR: {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <TerminalButton onClick={() => setStep(1)} variant="secondary" className="flex-1 min-h-[44px]">
                    BACK
                  </TerminalButton>
                  <TerminalButton onClick={handleCreate} variant="primary" className="flex-1 sm:flex-[2] min-h-[44px]" disabled={creating}>
                    {creating ? 'INITIALIZING...' : 'CREATE GAME INSTANCE'}
                  </TerminalButton>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DesignerLayout>
  );
}
