import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { SessionStatePayload, Player, Team } from '../types';
import { Users, Terminal, Radio, UserCircle, Wifi, WifiOff, Shield, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { TerminalStatus } from '../features/terminal/components/TerminalSystemState';

export default function LobbyPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [players, setPlayers] = useState<Array<{ id: string; displayName: string; teamId?: string }>>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [broadcasts, setBroadcasts] = useState<Array<{ message: string; id: string }>>([]);
  const [tick, setTick] = useState(0);
  const socketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  const user = JSON.parse(localStorage.getItem('terminal_user') || 'null');
  const player = JSON.parse(localStorage.getItem('terminal_player') || 'null') || user;
  const code = sessionCode?.toUpperCase() || '';

  // Blinking cursor tick
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 600);
    return () => clearInterval(id);
  }, []);

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
  const cursor = tick % 2 === 0 ? '█' : ' ';

  return (
    <div className="min-h-screen bg-[#050608] text-[#e6edf3] font-mono flex flex-col relative overflow-hidden">

      {/* ── Cyber Grid Background ─────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(0,255,204,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Radial glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,255,204,0.04) 0%, transparent 70%)',
      }} />

      {/* ── TOP NAVBAR ────────────────────────────────────────── */}
      <nav style={{ borderRadius: 0 }} className="relative z-20 w-full bg-[#0a0c10] border-b-2 border-[#1a222e] px-4 py-2.5 flex items-center justify-between shadow-[0_2px_0px_#000]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#00ffcc] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]" style={{ borderRadius: 0 }}>
            <span className="text-black font-black text-xs font-mono">&gt;_</span>
          </div>
          <span className="text-white font-black tracking-widest text-sm" style={{ fontFamily: "'Orbitron', monospace" }}>TERMINAL</span>
          <span className="text-[#5e6b7c] text-xs font-mono hidden sm:inline">// LOBBY_STAGING</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1 border ${
            connected
              ? 'border-[rgba(63,185,80,0.5)] text-[#3fb950] bg-[rgba(63,185,80,0.08)]'
              : 'border-[rgba(252,206,10,0.5)] text-[#fcce0a] bg-[rgba(252,206,10,0.08)]'
          }`} style={{ borderRadius: 0 }}>
            {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
            <span>{connected ? 'ONLINE' : 'RECONNECTING'}</span>
          </div>

          {/* Room code badge */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest px-2.5 py-1 border border-[rgba(0,255,204,0.4)] text-[#00ffcc] bg-[rgba(0,255,204,0.06)]" style={{ borderRadius: 0 }}>
            <span className="text-[#5e6b7c]">ROOM</span>
            <span className="text-[#00ffcc] font-black">{code}</span>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4">

        {/* ── BROADCASTS ─────────────────────────────────────── */}
        {broadcasts.length > 0 && (
          <div className="space-y-2">
            {broadcasts.map(b => (
              <div key={b.id}
                className="bg-[rgba(252,206,10,0.08)] border-2 border-[#fcce0a] p-3 flex items-start gap-3 shadow-[3px_3px_0px_#000]"
                style={{ borderRadius: 0 }}>
                <span className="text-[#fcce0a] font-bold text-xs shrink-0 mt-0.5">📢 BROADCAST</span>
                <p className="text-[#e6edf3] font-bold text-xs uppercase tracking-wide">{b.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── MAIN LOBBY PANEL ───────────────────────────────── */}
        <div className="bg-[#0f1319] border-2 border-[#2d3848] shadow-[6px_6px_0px_#000] relative" style={{ borderRadius: 0 }}>
          {/* Corner accents */}
          <div className="absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-[#00ffcc] pointer-events-none" />
          <div className="absolute -top-[1px] -right-[1px] w-4 h-4 border-t-2 border-r-2 border-[#00ffcc] pointer-events-none" />
          <div className="absolute -bottom-[1px] -left-[1px] w-4 h-4 border-b-2 border-l-2 border-[#00ffcc] pointer-events-none" />
          <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-[#00ffcc] pointer-events-none" />

          {/* Panel Header */}
          <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#00ffcc] text-[10px] font-bold tracking-[0.3em] uppercase">// LOBBY_STAGING</span>
              <span className="text-[#5e6b7c] text-[9px] font-mono">$ battle -c {code}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full animate-pulse inline-block" />
              <span className="text-[10px] text-[#00ffcc] font-bold tracking-widest">LIVE</span>
            </div>
          </div>

          <div className="p-4 sm:p-6 text-center">
            {/* Game name */}
            <div className="mb-1 text-[10px] font-bold tracking-[0.3em] text-[#5e6b7c] uppercase">// ACTIVE SESSION</div>
            <h1 className="font-black text-[clamp(1.3rem,4.5vw,2.2rem)] uppercase tracking-tight text-white mb-5 break-words"
              style={{ fontFamily: "'Orbitron', monospace" }}>
              {gameName}
            </h1>

            {/* Room code display */}
            <div className="inline-flex flex-col items-center gap-1 mb-6 max-w-full">
              <span className="text-[10px] text-[#5e6b7c] tracking-[0.3em] uppercase font-bold">ROOM CODE</span>
              <div className="flex items-center gap-2 sm:gap-3 bg-[#0a0c10] border-2 border-[#00ffcc] px-4 sm:px-6 py-2.5 sm:py-3 shadow-[3px_3px_0px_var(--term-cyan)] max-w-full" style={{ borderRadius: 0 }}>
                <span className="w-2 h-2 bg-[#00ffcc] rounded-full animate-pulse inline-block shrink-0" />
                <span className="font-black text-[clamp(1.5rem,6vw,2.25rem)] text-[#00ffcc] tracking-[0.2em] sm:tracking-[0.4em] font-mono truncate">{code}</span>
              </div>
              <span className="text-[9px] text-[#3d4754] font-mono">terminal.join /{code.toLowerCase()}</span>
            </div>

            {/* Player count metric */}
            <div className="flex items-center justify-center gap-3 mb-6 bg-[#0a0c10] border border-[#2d3848] px-4 sm:px-6 py-2.5 sm:py-3 mx-auto w-fit" style={{ borderRadius: 0 }}>
              <Users size={16} className="text-[#8b99aa]" />
              <span className="font-black text-2xl sm:text-3xl text-white font-mono">{playerCount}</span>
              <div className="text-left">
                <div className="text-[10px] text-[#3fb950] font-bold tracking-widest uppercase">OPERATORS</div>
                <div className="text-[9px] text-[#5e6b7c] font-mono">JOINED</div>
              </div>
            </div>

            {/* Player identity card */}
            <div className="bg-[#0a0c10] border border-[#2d3848] p-3 mb-5 text-left flex items-center gap-3 mx-auto max-w-sm" style={{ borderRadius: 0 }}>
              <div className="w-9 h-9 bg-[rgba(0,255,204,0.1)] border border-[rgba(0,255,204,0.4)] flex items-center justify-center shrink-0" style={{ borderRadius: 0 }}>
                <UserCircle size={20} className="text-[#00ffcc]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] text-[#5e6b7c] font-bold tracking-[0.2em] uppercase mb-0.5">OPERATOR ID</div>
                <p className="font-mono font-black text-sm text-[#00ffcc] truncate">
                  {player?.displayName}<span className="text-[#5e6b7c]">@terminal</span>
                </p>
                {playerTeam ? (
                  <p className="text-[10px] mt-0.5">
                    <span className="text-[#5e6b7c]">SQUAD:</span>{' '}
                    <strong style={{ color: playerTeam.color }}>{playerTeam.name}</strong>
                  </p>
                ) : teamsEnabled ? (
                  <p className="text-[10px] text-[#5e6b7c] mt-0.5">AWAITING SQUAD ASSIGNMENT</p>
                ) : (
                  <p className="text-[10px] text-[#5e6b7c] mt-0.5">SOLO COMBAT MODE</p>
                )}
              </div>
              <div className="shrink-0">
                <div className="text-[9px] text-[#3fb950] font-bold tracking-widest">READY</div>
              </div>
            </div>

            {/* Waiting signal */}
            <div className="flex items-center justify-center gap-2 text-[#5e6b7c] text-[10px] tracking-[0.25em] uppercase font-bold">
              <Radio size={11} className="animate-pulse" />
              <span>AWAITING GAME MASTER SIGNAL</span>
              <span className="text-[#00ffcc] w-3 text-left">{cursor}</span>
            </div>
          </div>
        </div>

        {/* ── CONNECTED OPERATORS GRID ───────────────────────── */}
        {players.length > 0 && (
          <div className="bg-[#0f1319] border border-[#1a222e] shadow-[4px_4px_0px_#000]" style={{ borderRadius: 0 }}>
            <div className="bg-[#161c24] border-b border-[#1a222e] px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={11} className="text-[#5e6b7c]" />
                <span className="text-[10px] font-bold tracking-[0.3em] text-[#5e6b7c] uppercase">CONNECTED OPERATORS</span>
              </div>
              <span className="text-[10px] font-mono text-[#3fb950] font-bold">{players.length} ONLINE</span>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {players.slice(0, 32).map(p => (
                  <div
                    key={p.id}
                    className={`px-2.5 py-1 text-[10px] font-bold border flex items-center gap-1.5 ${
                      p.id === player?.id
                        ? 'border-[rgba(0,255,204,0.6)] text-[#00ffcc] bg-[rgba(0,255,204,0.08)] shadow-[1px_1px_0px_#000]'
                        : 'border-[#1a222e] text-[#5e6b7c] bg-[#0a0c10]'
                    }`}
                    style={{ borderRadius: 0 }}>
                    {p.id === player?.id && (
                      <span className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full inline-block" />
                    )}
                    <span className="font-mono">{p.displayName}</span>
                    {p.id === player?.id && <span className="text-[8px] text-[#00ffcc] ml-0.5">[YOU]</span>}
                  </div>
                ))}
                {playerCount > 32 && (
                  <div className="px-2.5 py-1 text-[10px] text-[#3d4754] border border-[#1a222e]" style={{ borderRadius: 0 }}>
                    +{playerCount - 32} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BOOT LOG / STATUS TERMINAL ─────────────────────── */}
        <div className="bg-[#050608] border border-[#1a222e] p-4 font-mono text-xs space-y-1" style={{ borderRadius: 0 }}>
          <div className="text-[#3fb950]">
            <span className="text-[#5e6b7c]">[SYS]</span> Connected to session node <span className="text-[#00ffcc]">{code}</span>
          </div>
          <div className="text-[#8b99aa]">
            <span className="text-[#5e6b7c]">[NET]</span> WebSocket bridge {connected ? <span className="text-[#3fb950]">ESTABLISHED</span> : <span className="text-[#fcce0a]">RECONNECTING</span>}
          </div>
          <div className="text-[#8b99aa]">
            <span className="text-[#5e6b7c]">[PLY]</span> Operator <span className="text-[#00ffcc]">{player?.displayName}@terminal</span> registered
          </div>
          {state && (
            <div className="text-[#8b99aa]">
              <span className="text-[#5e6b7c]">[GAME]</span> Module loaded: <span className="text-white font-bold">{gameName}</span>
            </div>
          )}
          <div className="text-[#5e6b7c] flex items-center gap-1">
            <ChevronRight size={11} className="text-[#00ffcc]" />
            <span>waiting for gm signal{cursor}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
