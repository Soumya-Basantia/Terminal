import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { SessionStatePayload, Player, Team } from '../types';
import { Users, Terminal, Wifi, WifiOff, UserCircle, Radio } from 'lucide-react';
import api from '../lib/api';

export default function LobbyPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [players, setPlayers] = useState<Array<{ id: string; displayName: string; teamId?: string }>>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Array<{ message: string; id: string }>>([]);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  const user = JSON.parse(localStorage.getItem('terminal_user') || 'null');
  const player = JSON.parse(localStorage.getItem('terminal_player') || 'null') || user;
  const code = sessionCode?.toUpperCase() || '';

  useEffect(() => {
    if (!player) { navigate('/login'); return; }

    const socket = connectSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('player:join', { roomCode: code });
    });
    socket.on('disconnect', () => setConnected(false));

    const onStateUpdate = (data: SessionStatePayload) => {
      setState(data);
      setPlayerCount(data.playerCount);
    };

    socket.on('session:state', onStateUpdate);
    socket.on('session_state_update', onStateUpdate);

    socket.on('player:joined', (data: { player: any; playerCount: number; teamCount: number }) => {
      setPlayers(p => {
        if (p.find(x => x.id === data.player.id)) return p;
        return [...p, data.player];
      });
      setPlayerCount(data.playerCount);
    });

    socket.on('player:left', (data: { playerId: string }) => {
      setPlayers(p => p.filter(x => x.id !== data.playerId));
      setPlayerCount(c => Math.max(0, c - 1));
    });

    socket.on('player:removed', (data: { message?: string; playerId?: string }) => {
      if (data.message) { alert(data.message); navigate('/join'); }
    });

    socket.on('game:started', () => navigate(`/play/${code}`));

    socket.on('broadcast:created', (data: { id: string; message: string }) => {
      setBroadcasts(b => [data, ...b].slice(0, 5));
    });

    socket.on('team:created', (team: Team) => {
      setTeams(t => [...t, team]);
    });

    api.get(`/sessions/${code}`).then(res => {
      setPlayers(res.data.session.players || []);
      setTeams(res.data.session.teams || []);
      setPlayerCount(res.data.session.players?.length || 0);
    }).catch(() => navigate('/login'));

    return () => {
      socket.off('connect'); socket.off('disconnect');
      socket.off('session:state'); socket.off('session_state_update');
      socket.off('player:joined'); socket.off('player:left');
      socket.off('player:removed'); socket.off('game:started');
      socket.off('broadcast:created'); socket.off('team:created');
    };
  }, [code]);

  const gameName = state?.game.name || '...';
  const teamsEnabled = state?.game.teamsEnabled;
  const playerTeam = teams.find(t => t.id === player?.teamId);

  return (
    <div className="min-h-screen bg-[var(--term-bg-void)] font-mono flex flex-col items-center p-4">
      {/* Grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(0,255,204,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.025) 1px, transparent 1px)',
        backgroundSize: '40px 40px', zIndex: 0,
      }} />

      <div className="w-full max-w-lg relative z-10 flex flex-col gap-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 border border-[var(--term-cyan)] bg-[var(--term-bg-surface)]">
              <Terminal size={14} className="text-[var(--term-cyan)]" />
            </div>
            <span className="font-mono font-black text-sm tracking-tight text-white">TERMINAL</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            {connected
              ? <><Wifi size={12} className="text-[var(--term-green)]" /><span className="text-[var(--term-green)]">CONNECTED</span></>
              : <><WifiOff size={12} className="text-[var(--term-red)]" /><span className="text-[var(--term-red)]">RECONNECTING</span></>}
          </div>
        </div>

        {/* Main lobby card */}
        <div className="bg-[var(--term-bg-surface)] border border-[var(--term-border-muted)] shadow-[6px_6px_0_0_#000] relative">
          {/* Neon corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[var(--term-cyan)]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[var(--term-cyan)]" />

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-[var(--term-border-faint)] flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)] uppercase">// LOBBY_STAGING</span>
            <span className="font-mono text-[9px] text-[var(--term-text-muted)] ml-auto">$ join {code}</span>
          </div>

          <div className="p-5 text-center">
            {/* Game name */}
            <h1 className="font-mono font-black text-2xl uppercase tracking-tight text-white mb-2">{gameName}</h1>

            {/* Room code */}
            <div className="inline-flex items-center gap-3 bg-[var(--term-bg-void)] border border-[var(--term-cyan)] px-4 py-2 mb-5 shadow-[2px_2px_0_0_var(--term-cyan)]">
              <span className="w-2 h-2 rounded-full bg-[var(--term-cyan)] animate-pulse inline-block" />
              <span className="font-mono font-black text-2xl text-[var(--term-cyan)] tracking-[0.3em]">{code}</span>
            </div>

            {/* Player count */}
            <div className="flex items-center justify-center gap-2 mb-5">
              <Users size={14} className="text-[var(--term-text-muted)]" />
              <span className="font-mono font-black text-xl text-white">{playerCount}</span>
              <span className="text-[var(--term-text-muted)] text-xs uppercase tracking-widest">
                {playerCount !== 1 ? 'OPERATORS JOINED' : 'OPERATOR JOINED'}
              </span>
            </div>

            {/* Player identity */}
            <div className="bg-[var(--term-bg-void)] border border-[var(--term-border-subtle)] p-3 mb-4 text-left flex items-center gap-3">
              <UserCircle size={24} className="text-[var(--term-cyan)] shrink-0" />
              <div>
                <p className="font-mono font-bold text-sm text-white">{player?.displayName}</p>
                {playerTeam && (
                  <p className="text-[10px] text-[var(--term-text-muted)] mt-0.5">
                    TEAM: <strong style={{ color: playerTeam.color }}>{playerTeam.name}</strong>
                  </p>
                )}
                {!teamsEnabled && (
                  <p className="text-[10px] text-[var(--term-text-muted)] mt-0.5">SOLO MODE</p>
                )}
              </div>
            </div>

            {/* Waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-[var(--term-text-muted)] text-xs animate-pulse">
              <Radio size={12} />
              <span className="uppercase tracking-widest font-bold">AWAITING GAME MASTER SIGNAL</span>
            </div>
          </div>
        </div>

        {/* Broadcasts */}
        {broadcasts.length > 0 && (
          <div className="space-y-2">
            {broadcasts.map(b => (
              <div key={b.id} className="bg-[var(--term-bg-surface)] border border-[var(--term-yellow)] p-3 flex items-start gap-2 shadow-[3px_3px_0_0_#000] text-[11px]">
                <span className="text-[var(--term-yellow)] font-bold shrink-0">📢</span>
                <p className="text-[var(--term-text-primary)] font-bold uppercase tracking-wide">{b.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Players grid */}
        {players.length > 0 && (
          <div className="bg-[var(--term-bg-surface)] border border-[var(--term-border-faint)] p-4">
            <div className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-text-muted)] uppercase mb-3">
              // CONNECTED OPERATORS ({players.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {players.slice(0, 24).map(p => (
                <div
                  key={p.id}
                  className={`px-2 py-1 text-[10px] font-bold border ${
                    p.id === player?.id
                      ? 'border-[var(--term-cyan)] text-[var(--term-cyan)] bg-[rgba(0,255,204,0.08)]'
                      : 'border-[var(--term-border-faint)] text-[var(--term-text-muted)]'
                  }`}
                >
                  {p.displayName}
                </div>
              ))}
              {playerCount > 24 && (
                <div className="px-2 py-1 text-[10px] text-[var(--term-text-dim)]">+{playerCount - 24} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
