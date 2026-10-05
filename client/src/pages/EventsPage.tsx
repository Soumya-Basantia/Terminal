import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { DesignerLayout } from './DashboardPage';
import { Plus, Calendar } from 'lucide-react';
import { TerminalInput, TerminalButton, TerminalBadge } from '../components/ui';

export default function EventsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => api.get('/clubs').then(r => r.data),
  });
  const currentClub = clubs?.find((c: any) => c.id === clubId);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', clubId],
    queryFn: () => api.get(clubId ? `/events?clubId=${clubId}` : '/events').then(r => r.data),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = clubId ? { name, description, clubId } : { name, description };
      const res = await api.post('/events', payload);
      navigate(clubId ? `/clubs/${clubId}/events/${res.data.id}/edit` : `/events/${res.data.id}/edit`);
    } catch (err) {
      console.error(err);
    }
  };

  const statusVariant = (status: string) => {
    if (status === 'PUBLISHED') return 'green';
    if (status === 'ACTIVE') return 'cyan';
    return 'yellow';
  };

  return (
    <DesignerLayout clubId={clubId} clubName={currentClub?.name}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-[var(--term-cyan)] mb-1">// EVENT_MANAGER</div>
            <h1 className="font-mono font-black text-[clamp(1.5rem,5vw,2rem)] uppercase tracking-tight text-white">
              EVENT <span className="text-[var(--term-cyan)]">REGISTRY</span>
            </h1>
            <p className="font-mono text-xs text-[var(--term-text-secondary)] mt-1">MANAGE LIVE SESSIONS AND COMPETITIONS.</p>
          </div>
          <TerminalButton onClick={() => setIsCreating(!isCreating)} variant="primary" className="flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0">
            <Plus size={14} /> NEW EVENT
          </TerminalButton>
        </div>

        {/* Create Form */}
        {isCreating && (
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative mb-8">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// INITIALIZE_EVENT</span>
            </div>
            <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4">
              <TerminalInput
                label="EVENT DESIGNATION"
                placeholder="e.g. HACKATHON_2026"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <TerminalInput
                label="PARAMETERS (OPTIONAL)"
                placeholder="Event parameters..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="flex gap-3 mt-2">
                <TerminalButton type="submit" variant="primary">INITIALIZE</TerminalButton>
                <TerminalButton type="button" variant="secondary" onClick={() => setIsCreating(false)}>CANCEL</TerminalButton>
              </div>
            </form>
          </div>
        )}

        {/* Event Registry */}
        <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
          <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
            <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// EVENT_LIST</span>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[var(--term-bg-elevated)] border border-[var(--term-border-faint)] animate-pulse" />)}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center p-10 border border-dashed border-[var(--term-border-faint)]">
                <Calendar size={28} className="mx-auto mb-3 text-[var(--term-text-muted)]" />
                <p className="font-mono text-xs text-[var(--term-text-muted)]">// NO EVENTS REGISTERED</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map((event: any) => {
                  const editPath = clubId ? `/clubs/${clubId}/events/${event.id}/edit` : `/events/${event.id}/edit`;
                  return (
                    <div
                      key={event.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 border border-[var(--term-border-faint)] bg-[var(--term-bg-elevated)] hover:border-[var(--term-cyan)] hover:bg-[var(--term-bg-highlight)] cursor-pointer transition-all group"
                      onClick={() => navigate(editPath)}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-sm uppercase text-white group-hover:text-[var(--term-cyan)] transition-colors break-words">{event.name}</span>
                          <TerminalBadge variant={statusVariant(event.status) as any}>{event.status}</TerminalBadge>
                        </div>
                        <p className="font-mono text-[10px] text-[var(--term-text-muted)] break-words">{event.description || '// NO PARAMETERS SET'}</p>
                      </div>
                      <TerminalButton onClick={(e) => { e.stopPropagation(); navigate(editPath); }} className="text-[9px] min-h-[40px] sm:min-h-0 self-stretch sm:self-auto">
                        CONFIGURE
                      </TerminalButton>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DesignerLayout>
  );
}
