import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { DesignerLayout } from './DashboardPage';
import { Play, Save, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import type { Game } from '../types';
import { TerminalInput, TerminalButton, TerminalBadge } from '../components/ui';

export default function EventEditorPage() {
  const { id, clubId } = useParams<{ id: string, clubId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/events/${id}`).then(res => res.data),
  });
  const { data: games = [] } = useQuery({
    queryKey: ['games'],
    queryFn: () => api.get('/games').then(r => r.data.games),
  });
  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => api.get('/clubs').then(r => r.data),
  });
  const currentClub = clubs?.find((c: any) => c.id === clubId);

  useEffect(() => {
    if (event) {
      setName(event.name);
      setDescription(event.description || '');
      setMode(event.mode);
      setStatus(event.status);
    }
  }, [event]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put(`/events/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });
  const addGameMutation = useMutation({
    mutationFn: (gameId: string) => api.post(`/events/${id}/games`, { gameId, purpose: 'NORMAL', position: event?.games?.length || 0, enabled: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });
  const removeGameMutation = useMutation({
    mutationFn: (eventGameId: string) => api.delete(`/events/${id}/eventGames/${eventGameId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });
  const updateEventGameMutation = useMutation({
    mutationFn: (data: { eventGameId: string, purpose: string, enabled: boolean }) =>
      api.put(`/events/${id}/eventGames/${data.eventGameId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });
  const reorderGamesMutation = useMutation({
    mutationFn: (gameIds: string[]) => api.put(`/events/${id}/games/reorder`, { gameIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });

  const handleSave = () => saveMutation.mutate({ name, description, mode, status });

  const handleHost = async () => {
    try {
      if (status !== 'PUBLISHED') {
        alert('Event must be published before creating a session.');
        return;
      }
      const res = await api.post('/sessions', { eventId: id });
      navigate(`/sessions/${res.data.session.roomCode}/host`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to host session');
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const items = [...event.games];
    [items[index], items[index - 1]] = [items[index - 1], items[index]];
    reorderGamesMutation.mutate(items.map((g: any) => g.id));
  };
  const moveDown = (index: number) => {
    if (index === event.games.length - 1) return;
    const items = [...event.games];
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    reorderGamesMutation.mutate(items.map((g: any) => g.id));
  };

  const selectStyle = "w-full p-2.5 font-mono text-xs bg-[var(--term-bg-void)] text-[var(--term-text-primary)] border border-[var(--term-border-muted)] outline-none focus:border-[var(--term-cyan)] transition-colors";

  if (isLoading) return (
    <DesignerLayout clubId={clubId} clubName={currentClub?.name}>
      <div className="text-center font-mono text-[var(--term-text-secondary)] py-16">// LOADING EVENT DATA...</div>
    </DesignerLayout>
  );
  if (!event) return (
    <DesignerLayout clubId={clubId} clubName={currentClub?.name}>
      <div className="text-center font-mono text-[var(--term-red)] py-16">// EVENT CORRUPTED OR NOT FOUND</div>
    </DesignerLayout>
  );

  return (
    <DesignerLayout clubId={clubId} clubName={currentClub?.name}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* Left Column */}
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold tracking-[0.3em] text-[var(--term-cyan)] mb-1">// EVENT_BUILDER</div>
              <h1 className="font-mono font-black text-3xl uppercase tracking-tight text-white">
                EVENT <span className="text-[var(--term-cyan)]">EDITOR</span>
              </h1>
              <p className="font-mono text-[10px] text-[var(--term-text-muted)] mt-1">ID: {event.id}</p>
            </div>
            <div className="flex gap-3">
              <TerminalButton onClick={handleSave} variant="secondary" disabled={saveMutation.isPending}>
                <Save size={13} /> {saveMutation.isPending ? 'SAVING...' : 'SAVE'}
              </TerminalButton>
              <TerminalButton onClick={handleHost} variant="primary" disabled={status !== 'PUBLISHED'}>
                <Play size={13} /> INITIALIZE SESSION
              </TerminalButton>
            </div>
          </div>

          {/* 01. Parameters */}
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// 01. PARAMETERS</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <TerminalInput
                label="DESIGNATION"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <TerminalInput
                label="DESCRIPTION"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] uppercase block mb-1.5">EXECUTION MODE</label>
                  <select className={selectStyle} value={mode} onChange={e => setMode(e.target.value)}>
                    <option value="SEQUENCE">SEQUENCE (STRICT ORDER)</option>
                    <option value="GM_CONTROLLED">GM_CONTROLLED (FREE JUMP)</option>
                    <option value="RANDOM">RANDOM (SYSTEM PICK)</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[9px] font-bold tracking-widest text-[var(--term-text-muted)] uppercase block mb-1.5">NETWORK STATUS</label>
                  <select className={selectStyle} value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="DRAFT">DRAFT (OFFLINE)</option>
                    <option value="PUBLISHED">PUBLISHED (ONLINE)</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 02. Execution Flow */}
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// 02. EXECUTION_FLOW</span>
            </div>
            <div className="p-5">
              {event.games.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-[var(--term-border-faint)]">
                  <p className="font-mono text-xs text-[var(--term-text-muted)]">// NO GAMES MOUNTED IN SEQUENCE</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {event.games.map((eg: any, i: number) => (
                    <div key={eg.id} className="flex items-center gap-3 p-3 bg-[var(--term-bg-elevated)] border border-[var(--term-border-faint)]">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveUp(i)} disabled={i === 0} className="text-[var(--term-text-muted)] hover:text-[var(--term-cyan)] disabled:opacity-20 transition-colors cursor-pointer">
                          <ChevronUp size={14} />
                        </button>
                        <button onClick={() => moveDown(i)} disabled={i === event.games.length - 1} className="text-[var(--term-text-muted)] hover:text-[var(--term-cyan)] disabled:opacity-20 transition-colors cursor-pointer">
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <div className="font-mono font-black text-lg text-[var(--term-cyan)] opacity-40 w-8">{(i + 1).toString().padStart(2, '0')}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-bold text-sm uppercase text-white truncate">{eg.game.name}</div>
                        <div className="font-mono text-[9px] text-[var(--term-text-muted)] uppercase">{eg.game.template}</div>
                      </div>
                      <select
                        className="font-mono text-[9px] p-1.5 bg-[var(--term-bg-void)] text-[var(--term-text-primary)] border border-[var(--term-border-faint)] outline-none"
                        value={eg.purpose || 'NORMAL'}
                        onChange={(e) => updateEventGameMutation.mutate({ eventGameId: eg.id, purpose: e.target.value, enabled: eg.enabled ?? true })}
                      >
                        <option value="NORMAL">NORMAL</option>
                        <option value="FINAL">FINAL</option>
                        <option value="TIE_BREAKER">TIE BREAKER</option>
                        <option value="BONUS">BONUS</option>
                      </select>
                      <button
                        onClick={() => updateEventGameMutation.mutate({ eventGameId: eg.id, purpose: eg.purpose || 'NORMAL', enabled: !(eg.enabled ?? true) })}
                        className={`font-mono text-[9px] px-2 py-1 border transition-colors ${
                          eg.enabled !== false
                            ? 'text-[var(--term-cyan)] border-[var(--term-cyan)]'
                            : 'text-[var(--term-text-muted)] border-[var(--term-border-faint)]'
                        }`}
                      >
                        {eg.enabled !== false ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => removeGameMutation.mutate(eg.id)}
                        className="p-1.5 text-[var(--term-red)] hover:bg-[var(--term-red)] hover:text-black transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Module Library */}
        <div>
          <div className="border border-[var(--term-border-muted)] bg-[var(--term-bg-surface)] relative sticky top-24">
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[var(--term-cyan)]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[var(--term-cyan)]" />
            <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
              <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)]">// 03. AVAILABLE_MODULES</span>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {games.map((game: Game) => (
                <div key={game.id} className="flex items-center justify-between p-3 border border-[var(--term-border-faint)] bg-[var(--term-bg-elevated)] hover:border-[var(--term-border-muted)] transition-all">
                  <div>
                    <div className="font-mono font-bold text-xs uppercase text-white">{game.name}</div>
                    <div className="font-mono text-[9px] text-[var(--term-text-muted)] uppercase">
                      {game.template} • {game._count?.challenges ?? game.challenges?.length ?? 0} CHALLENGES
                    </div>
                  </div>
                  <TerminalButton onClick={() => addGameMutation.mutate(game.id)} variant="primary" className="text-[9px] px-2 py-1">
                    <Plus size={11} /> ADD
                  </TerminalButton>
                </div>
              ))}
              {games.length === 0 && (
                <p className="font-mono text-[10px] text-[var(--term-text-muted)] text-center py-4">// NO COMPATIBLE MODULES FOUND</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DesignerLayout>
  );
}
