import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket } from '../lib/socket';
import { useAuth } from '../features/auth/AuthContext';
import api from '../lib/api';
import {
  Terminal,
  Users,
  User,
  Play,
  Pause,
  StopCircle,
  Trophy,
  Check,
  CheckCircle2,
  Copy,
  Activity,
  FileSpreadsheet,
  Clock,
  Radio,
  Wifi,
  Crown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
  X,
  ExternalLink,
  Lock,
  SkipForward,
  Eye,
  EyeOff,
  Monitor,
} from 'lucide-react';
import { TerminalBackButton } from '../components/ui/TerminalBackButton';
import {
  SpotlightModule,
  type SpotlightModuleId,
  useHostKeyboardShortcuts,
  EsportsLeaderboard,
  QuestionSpotlight,
  TeamsProgressSpotlight,
  SessionStatsSpotlight,
  RecentActivitySpotlight,
} from '../components/host';

interface ActivityItem {
  id: string;
  time: string;
  text: string;
  icon: 'play' | 'check' | 'user' | 'trophy' | 'warn';
}

export default function SessionHostPage() {
  const { sessionCode, clubId } = useParams<{ sessionCode: string; clubId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const code = sessionCode?.toUpperCase() || '';
  const socketRef = useRef<any>(null);
  const hadSocketRef = useRef(false);

  // Loading & session state
  const [hostLoad, setHostLoad] = useState<'loading' | 'live' | 'notfound' | 'unauthorized' | 'error'>('loading');
  const [hostError, setHostError] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Time & tick
  const [tick, setTick] = useState(0);

  // Spotlight & Audience presentation mode
  const [activeSpotlightId, setActiveSpotlightId] = useState<SpotlightModuleId | null>(null);
  const [isAudienceMode, setIsAudienceMode] = useState(false);

  // Modals & UI controls
  const [showEndModal, setShowEndModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [leaderboardTab, setLeaderboardTab] = useState<'TEAMS' | 'PLAYERS'>('TEAMS');

  // Previewing questions (host can browse questions without changing server active question)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  // Live activities feed
  const activitiesRef = useRef<ActivityItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const prevStatusRef = useRef<string | null>(null);
  const prevAnswersCountRef = useRef<number | null>(null);
  const prevPlayerCountRef = useRef<number | null>(null);
  const prevChallengeIdRef = useRef<string | null>(null);
  const latestLeaderboardRevisionRef = useRef<number>(0);

  // Keyboard shortcut listener
  useHostKeyboardShortcuts({
    activeSpotlightId,
    onSelectSpotlight: setActiveSpotlightId,
    isModalOpen: showEndModal || showParticipantsModal || showTeamsModal,
  });

  // Clock tick for timer and elapsed time
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Main load and socket connection
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    let cancelled = false;

    const loadHost = async () => {
      try {
        const res = await api.get(`/sessions/${code}/host`);
        if (cancelled) return;
        setSessionData((prev: any) => prev
          ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } }
          : res.data);
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) setHostLoad('notfound');
        else if (status === 403) setHostLoad('unauthorized');
        else {
          setHostLoad('error');
          setHostError(err?.response?.data?.error || err?.message || 'Failed to load host session.');
        }
      } finally {
        if (!cancelled) setHostLoad(h => (h === 'loading' ? 'live' : h));
      }
    };

    const socket = connectSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('host:join', { roomCode: code });
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onLeaderboardUpdate = (data: any) => {
      if (!data) return;
      if (data.revision && data.revision < latestLeaderboardRevisionRef.current) {
        return; // Ignore stale snapshot that arrived out of order
      }
      if (data.revision) {
        latestLeaderboardRevisionRef.current = data.revision;
      }
      setSessionData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          teamLeaderboard: data.teamLeaderboard || prev.teamLeaderboard,
          individualLeaderboard: data.individualLeaderboard || prev.individualLeaderboard,
          leaderboard: data.leaderboard || prev.leaderboard,
          timeBonusConfig: data.timeBonusConfig || prev.timeBonusConfig,
        };
      });
    };

    const onStateUpdate = (data: any) => {
      setSessionData((prev: any) => {
        if (!prev) return data;
        return {
          ...prev,
          ...data,
          session: { ...prev.session, ...(data?.session || {}) },
          game: prev.game || data?.game,
          currentGame: data?.currentGame || prev.currentGame,
          teamLeaderboard: data?.teamLeaderboard || prev.teamLeaderboard,
          individualLeaderboard: data?.individualLeaderboard || prev.individualLeaderboard,
          leaderboard: data?.leaderboard || prev.leaderboard,
          timeBonusConfig: data?.timeBonusConfig || prev.timeBonusConfig,
        };
      });

      if (data?.session?.currentChallengeId && data.session.currentChallengeId !== prevChallengeIdRef.current) {
        prevChallengeIdRef.current = data.session.currentChallengeId;
        setPreviewIdx(null); // Return GM view to the active question
      }

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const currentStatus = data?.session?.status;
      const currentAnswers = data?.answersCount ?? 0;
      const currentPlayers = data?.playerCount ?? 0;

      // When starting the game or transitioning from LOBBY, ensure GM automatically views Question 1
      if (currentStatus === 'QUESTION_ACTIVE' && (prevStatusRef.current === 'LOBBY' || prevStatusRef.current === 'STARTING')) {
        setPreviewIdx(null);
      }

      // Detect question start
      if (currentStatus === 'QUESTION_ACTIVE' && prevStatusRef.current !== 'QUESTION_ACTIVE') {
        const qNum = (data?.currentGame?.challenges?.findIndex((c: any) => c.id === data?.session?.currentChallengeId) ?? 0) + 1;
        setActivities(prev => [
          { id: Math.random().toString(), time: nowStr, text: `Question ${qNum} started`, icon: 'play' },
          ...prev.slice(0, 24),
        ]);
      } else if (currentStatus === 'QUESTION_LOCKED' && prevStatusRef.current === 'QUESTION_ACTIVE') {
        setActivities(prev => [
          { id: Math.random().toString(), time: nowStr, text: 'Question locked & scored', icon: 'check' },
          ...prev.slice(0, 24),
        ]);
      } else if (currentStatus === 'RESULTS' && prevStatusRef.current !== 'RESULTS') {
        setActivities(prev => [
          { id: Math.random().toString(), time: nowStr, text: 'Finalizing session scores', icon: 'trophy' },
          ...prev.slice(0, 24),
        ]);
      } else if (currentStatus === 'ENDED' && prevStatusRef.current !== 'ENDED') {
        setActivities(prev => [
          { id: Math.random().toString(), time: nowStr, text: 'Game completed', icon: 'trophy' },
          ...prev.slice(0, 24),
        ]);
      }

      // Detect submission increment
      if (prevAnswersCountRef.current !== null && currentAnswers > prevAnswersCountRef.current) {
        const delta = currentAnswers - prevAnswersCountRef.current;
        setActivities(prev => [
          {
            id: Math.random().toString(),
            time: nowStr,
            text: delta === 1 ? 'New answer submitted' : `${delta} answers submitted`,
            icon: 'check',
          },
          ...prev.slice(0, 24),
        ]);
      }

      // Detect player join
      if (prevPlayerCountRef.current !== null && currentPlayers > prevPlayerCountRef.current) {
        const delta = currentPlayers - prevPlayerCountRef.current;
        setActivities(prev => [
          {
            id: Math.random().toString(),
            time: nowStr,
            text: `${delta} participant${delta > 1 ? 's' : ''} joined`,
            icon: 'user',
          },
          ...prev.slice(0, 24),
        ]);
      }

      prevStatusRef.current = currentStatus;
      prevAnswersCountRef.current = currentAnswers;
      prevPlayerCountRef.current = currentPlayers;
    };

    const onSocketError = (err: any) => {
      if (err?.message) setActionError(err.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session_state_update', onStateUpdate);
    socket.on('leaderboard:update', onLeaderboardUpdate);
    socket.on('error', onSocketError);

    void loadHost();

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session_state_update', onStateUpdate);
      socket.off('leaderboard:update', onLeaderboardUpdate);
      socket.off('error', onSocketError);
    };
  }, [code, user, navigate]);

  // Re-join on reconnect
  useEffect(() => {
    if (connected) {
      if (hadSocketRef.current) {
        socketRef.current?.emit('host:join', { roomCode: code });
        api.get(`/sessions/${code}/leaderboard`).then((res: any) => {
          if (res.data) {
            setSessionData((prev: any) => prev ? {
              ...prev,
              teamLeaderboard: res.data.teamLeaderboard || prev.teamLeaderboard,
              individualLeaderboard: res.data.individualLeaderboard || prev.individualLeaderboard,
              leaderboard: res.data.leaderboard || prev.leaderboard,
              timeBonusConfig: res.data.timeBonusConfig || prev.timeBonusConfig,
            } : prev);
          }
        }).catch(() => {});
        api.get(`/sessions/${code}/host`).then((res: any) => {
          setSessionData((prev: any) => prev ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } } : res.data);
        }).catch(() => {
          api.get(`/sessions/${code}`).then((res: any) => {
            setSessionData((prev: any) => prev ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } } : res.data);
          }).catch(() => {});
        });
      } else {
        hadSocketRef.current = true;
      }
    }
  }, [connected, code]);

  const refreshState = async () => {
    try {
      const res = await api.get(`/sessions/${code}/host`);
      setSessionData((prev: any) => prev
        ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } }
        : res.data);
    } catch {
      api.get(`/sessions/${code}`).then((res: any) => {
        setSessionData((prev: any) => prev
          ? { ...prev, ...res.data, session: { ...prev.session, ...res.data.session } }
          : res.data);
      }).catch(() => {});
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // GM START GAME: Single-click flow
  const startGame = async () => {
    if (actionBusy) return;
    setActionBusy('start');
    setActionError(null);
    try {
      const res = await api.post(`/sessions/${code}/start`);
      // If server transition produced STARTING, immediately invoke start again to activate Q1
      if (res.data?.session?.status === 'STARTING') {
        await api.post(`/sessions/${code}/start`);
      }
      refreshState();
    } catch (err: any) {
      if (err?.response?.status === 403) {
        const gmName = sessionData?.session?.gm?.name || sessionData?.session?.gm?.username || 'the host Game Master';
        setActionError(
          err?.response?.data?.error ||
          `Forbidden: You are not authorized to start session ${code}. This session is hosted by ${gmName}.`
        );
      } else {
        setActionError(err?.response?.data?.error || err?.message || 'Failed to start game.');
      }
    } finally {
      setActionBusy(null);
    }
  };

  // GM END GAME
  const confirmEndGame = async () => {
    if (actionBusy) return;
    setActionBusy('end');
    setActionError(null);
    setShowEndModal(false);
    try {
      await api.post(`/sessions/${code}/end`);
      refreshState();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to end game.');
    } finally {
      setActionBusy(null);
    }
  };

  // GM LOCK QUESTION
  const lockQuestion = async () => {
    if (actionBusy) return;
    setActionBusy('lock');
    setActionError(null);
    try {
      await api.post(`/sessions/${code}/lock`);
      refreshState();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to lock question.');
    } finally {
      setActionBusy(null);
    }
  };

  // GM NEXT QUESTION
  const nextQuestion = async () => {
    if (actionBusy) return;
    setActionBusy('next');
    setActionError(null);
    try {
      await api.post(`/sessions/${code}/next`, { currentChallengeId: displayChallenge?.id });
      setPreviewIdx(null);
      refreshState();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to advance question.');
    } finally {
      setActionBusy(null);
    }
  };

  // Toggle stage pause if GM clicks Pause
  const togglePause = () => {
    if (!sessionData?.session) return;
    const isStagePaused = sessionData.session.stageMode === 'PAUSED';
    if (socketRef.current) {
      socketRef.current.emit('host:set_stage_mode', {
        mode: isStagePaused ? 'QUESTION' : 'PAUSED',
      });
    }
  };

  // Download official Excel report
  const downloadReport = async () => {
    const sessId = sessionData?.session?.id;
    if (!sessId) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const token = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('terminal_token') : null)
        || localStorage.getItem('terminal_token');
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/sessions/${sessId}/report`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDownloadError(body.message || body.error || `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `TERMINAL_${code}_REPORT.xlsx`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setDownloadError(e.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  // Host New Session
  const newSession = async () => {
    const gameId = sessionData?.session?.currentGameId;
    if (!gameId) {
      setActionError('Cannot re-host: game reference missing.');
      return;
    }
    setActionBusy('new');
    setActionError(null);
    try {
      const res = await api.post('/sessions', { gameId });
      const newCode = res.data.session.code || res.data.session.roomCode;
      navigate(`/sessions/${newCode}/host`);
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to create a new session.');
      setActionBusy(null);
    }
  };

  // Format elapsed time (HH:MM:SS)
  const elapsedTimeStr = useMemo(() => {
    if (!sessionData?.session?.startedAt) return '00:00:00';
    const startMs = new Date(sessionData.session.startedAt).getTime();
    const endMs = sessionData.session.endedAt ? new Date(sessionData.session.endedAt).getTime() : Date.now();
    const totalSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [sessionData?.session?.startedAt, sessionData?.session?.endedAt, tick]);

  // Loading and Error Screens
  if (hostLoad === 'loading' || !sessionData) {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00ffcc] border-t-transparent animate-spin" style={{ borderRadius: 0 }} />
          <div className="text-[#00ffcc] text-xs tracking-[0.3em] uppercase">// LOADING HOST SESSION...</div>
          <div className="text-[#5e6b7c] text-[10px] font-mono">ROOM: {code}</div>
        </div>
      </div>
    );
  }

  if (hostLoad === 'notfound') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#fcee0a] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#fcee0a] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// SESSION NOT FOUND</div>
          <div className="text-white font-black text-lg mb-1">No live session found for room {code}</div>
          <div className="text-[#5e6b7c] text-xs mb-5">Verify room code or host a session from the Game Master workspace.</div>
          <button
            onClick={() => navigate('/gm?tab=games')}
            className="px-4 py-2.5 text-xs font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all w-full cursor-pointer"
            style={{ borderRadius: 0 }}>
            [ RETURN TO GM WORKSPACE ]
          </button>
        </div>
      </div>
    );
  }

  if (hostLoad === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#ff3366] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#ff3366] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// ACCESS DENIED</div>
          <div className="text-white font-black text-lg mb-1">You are not authorized to control room {code}</div>
          <div className="text-[#5e6b7c] text-xs mb-5">Only the hosting Game Master or an administrator can access this control room.</div>
          <button
            onClick={() => navigate('/gm')}
            className="px-4 py-2.5 text-xs font-black bg-[#00ffcc] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all w-full cursor-pointer"
            style={{ borderRadius: 0 }}>
            [ RETURN TO GM WORKSPACE ]
          </button>
        </div>
      </div>
    );
  }

  if (hostLoad === 'error') {
    return (
      <div className="min-h-screen bg-[#050608] flex items-center justify-center p-4 font-mono">
        <div className="w-full max-w-lg bg-[#0f1319] border-2 border-[#ff3366] shadow-[6px_6px_0px_#000] p-6" style={{ borderRadius: 0 }}>
          <div className="text-[#ff3366] text-[10px] font-black tracking-[0.3em] uppercase mb-3">// HOST LOAD ERROR</div>
          <div className="text-white font-black text-lg mb-1">Failed to load session state</div>
          <div className="text-[#e6edf3] text-xs mb-5 whitespace-pre-wrap">{hostError}</div>
          <button
            onClick={() => {
              setHostLoad('loading');
              setHostError('');
              api.get(`/sessions/${code}/host`).then(res => {
                setSessionData(res.data);
                setHostLoad('live');
              }).catch(err => {
                setHostLoad('error');
                setHostError(err?.response?.data?.error || err?.message || 'Retry failed.');
              });
            }}
            className="px-4 py-2.5 text-xs font-black bg-[#fcee0a] text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#ffd92b] transition-all w-full cursor-pointer"
            style={{ borderRadius: 0 }}>
            [ RETRY CONNECTION ]
          </button>
        </div>
      </div>
    );
  }

  const ss = sessionData.session || {};
  const state = ss.status || 'LOBBY';
  const isLobby = state === 'LOBBY';
  const isStarting = state === 'STARTING';
  const isQuestionActive = state === 'QUESTION_ACTIVE';
  const isQuestionLocked = state === 'QUESTION_LOCKED';
  const isQuestionResults = state === 'QUESTION_RESULTS';
  const isResults = state === 'RESULTS';
  const isEnded = state === 'ENDED';
  const isStagePaused = ss.stageMode === 'PAUSED';

  // Questions and active question
  const challenges: any[] = sessionData.currentGame?.challenges || sessionData.game?.challenges || [];
  const totalQuestions = sessionData.game?.challengeCount || challenges.length || 0;
  const activeChallengeIdx = challenges.findIndex((c: any) => c.id === ss.currentChallengeId);
  const currentChallengeIndex = activeChallengeIdx >= 0 ? activeChallengeIdx : 0;

  // Review Mode state
  const isReviewRevealed = Boolean(sessionData?.isReviewRevealed ?? ss?.isReviewRevealed ?? ss?.snapshot?.reviewState?.revealed);
  const reviewQuestionIndex = Number(sessionData?.reviewQuestionIndex ?? ss?.reviewQuestionIndex ?? ss?.snapshot?.reviewState?.currentQuestionIndex ?? 0);
  const reviewChallenge = sessionData?.reviewChallenge ?? ss?.reviewChallenge ?? challenges[reviewQuestionIndex] ?? null;

  // GM REVEAL ANSWERS & EXPLANATIONS
  const revealAnswers = async () => {
    if (actionBusy) return;
    setActionBusy('reveal');
    setActionError(null);
    try {
      await api.post(`/sessions/${code}/reveal-answers`);
      refreshState();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to reveal answers.');
    } finally {
      setActionBusy(null);
    }
  };

  // GM REVIEW NAVIGATE
  const reviewNavigate = async (direction: 'next' | 'prev') => {
    if (actionBusy) return;
    setActionBusy('review-nav');
    setActionError(null);
    try {
      await api.post(`/sessions/${code}/review-navigate`, { direction });
      refreshState();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || 'Failed to navigate review.');
    } finally {
      setActionBusy(null);
    }
  };
  
  // Host preview selection (defaults to active question)
  const displayIdx = previewIdx !== null && previewIdx >= 0 && previewIdx < challenges.length ? previewIdx : currentChallengeIndex;
  const displayChallenge = challenges[displayIdx] || challenges[0] || null;

  // Server-authoritative timer: only active for the live question
  const isPreviewing = previewIdx !== null && previewIdx !== currentChallengeIndex;
  const previewStatus: 'LOCKED' | 'COMPLETED' | 'NOT STARTED' | null = isPreviewing
    ? (displayIdx > currentChallengeIndex ? 'LOCKED' : 'COMPLETED')
    : null;
  const isViewingLive = displayIdx === currentChallengeIndex && (state === 'QUESTION_ACTIVE' || state === 'QUESTION_LOCKED');
  const endsAt = ss.questionEndsAt ? new Date(ss.questionEndsAt).getTime() : null;
  const qRemaining = (isViewingLive && endsAt) ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : null;
  const totalTimeLimit = displayChallenge?.timeLimit || displayChallenge?.timerSecs || 30;
  const timerPct = qRemaining !== null && totalTimeLimit > 0 ? Math.min(1, Math.max(0, qRemaining / totalTimeLimit)) : 0;

  // Real participant counts
  const totalParticipants = sessionData.playerCount ?? sessionData.playerRoster?.length ?? 0;
  const maxCapacity = sessionData.game?.maxPlayers || sessionData.currentGame?.maxPlayers || 200;
  const totalTeams = sessionData.teamCount ?? sessionData.teamRoster?.teams?.length ?? 0;
  const totalAnswers = sessionData.answersCount ?? 0;
  const onlineConnections = sessionData.playerRoster?.filter((p: any) => p.connected).length ?? totalParticipants;

  // Submissions progress percentages
  const answersPct = totalParticipants > 0 ? Math.round((totalAnswers / totalParticipants) * 100) : 0;
  const teamsRespondedCount = sessionData.teamsRespondedCount ?? (sessionData.teamResponses?.filter((t: any) => t.respondedCount > 0).length ?? 0);
  const teamsPct = totalTeams > 0 ? Math.round((teamsRespondedCount / totalTeams) * 100) : 0;

  // Team response progress list
  const teamResponsesList: Array<{ teamId: string; teamName: string; respondedCount: number; totalMembers: number }> = 
    sessionData.teamResponses || (sessionData.teamRoster?.teams || []).map((t: any) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      respondedCount: 0,
      totalMembers: t.membersCount,
    }));

  return (
    <div className="min-h-screen flex flex-col bg-[#050608] font-mono text-[#e6edf3] select-none overflow-x-hidden w-full max-w-full">
      
      {/* Background Cyber Grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,255,204,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. TOP HEADER
      ───────────────────────────────────────────────────────────── */}
      <header className="relative z-40 w-full max-w-full overflow-x-hidden bg-[#0a0c10] border-b-2 border-[#16202c] px-2.5 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Brand & Game Meta */}
        <div className="flex items-center gap-3">
          <TerminalBackButton
            to={clubId ? `/clubs/${clubId}` : '/gm?tab=sessions'}
            label="[BACK]"
            hasUnsavedChanges={!isEnded}
            unsavedMessage="Session is active. Return to GM workspace?"
          />
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#00ffcc] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]">
              <span className="text-black font-black text-sm">&gt;_</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs tracking-wider text-white uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  TERMINAL
                </span>
                <span className="text-[9px] text-[#00ffcc] tracking-[0.2em] uppercase font-bold">
                  LIVE GAME HOST
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#8b99aa]">
                <span className="text-white font-bold uppercase truncate max-w-[200px]">
                  {sessionData.game?.name || sessionData.currentGame?.name || sessionData.event?.name || 'LIVE GAME'}
                </span>
                <span>•</span>
                <span className="text-[#00ffcc]">{totalQuestions} QUESTIONS</span>
                <span>•</span>
                <span>{displayChallenge?.timeLimit || 30}s PER QUESTION</span>
                <span>•</span>
                <span className="text-[#a855f7]">{sessionData.game?.teamsEnabled ? 'TEAMS MODE' : 'SOLO MODE'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Room Code, Live Status, Stage Launcher, Audience Toggle, GM Badge */}
        <div className="flex items-center gap-2.5">
          {/* Dedicated Stage / Projector Link */}
          <a
            href={`/stage/${code}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Projector Stage display in a new tab"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161c24] hover:bg-[#1f2733] text-[#00ffcc] border border-[#00ffcc] text-[10px] font-black uppercase shadow-[2px_2px_0_#000] transition-all cursor-pointer"
          >
            <Monitor size={12} />
            <span className="hidden sm:inline">PROJECTOR STAGE</span>
            <ExternalLink size={10} />
          </a>

          {/* Audience Safe Mode Preview Toggle */}
          <button
            onClick={() => setIsAudienceMode(v => !v)}
            title={isAudienceMode ? 'Disable Audience Privacy (Show GM controls)' : 'Enable Audience Mode (Hide GM controls for student projector)'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase border transition-all cursor-pointer ${
              isAudienceMode
                ? 'bg-[rgba(252,238,10,0.2)] text-[#fcee0a] border-[#fcee0a]'
                : 'bg-[#161c24] text-[#8b99aa] hover:text-white border-[#2d3848]'
            }`}
          >
            {isAudienceMode ? <EyeOff size={12} /> : <Eye size={12} />}
            <span className="hidden md:inline">{isAudienceMode ? 'AUDIENCE SAFE [ON]' : 'AUDIENCE PREVIEW'}</span>
          </button>

          {/* Room Code */}
          <div className="flex items-center gap-2.5 px-3 py-1 bg-[#0f141c] border border-[rgba(0,255,204,0.4)] shadow-[2px_2px_0px_#000]">
            <div className="text-right">
              <div className="text-[8px] text-[#5e6b7c] font-black uppercase tracking-wider">ROOM CODE</div>
              <div className="font-black text-base text-[#00ffcc] tracking-[0.2em] font-mono leading-none">{code}</div>
            </div>
            <button
              onClick={copyCode}
              title="Copy Room Code"
              className="p-1 text-[#8b99aa] hover:text-[#00ffcc] transition-colors cursor-pointer border border-[#2d3848] bg-[#0a0c10]">
              {codeCopied ? <Check size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
            </button>
          </div>

          {/* Session Live & Elapsed Timer */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f141c] border border-[#2d3848]">
            <div className={`w-2 h-2 rounded-full ${isEnded ? 'bg-[#5e6b7c]' : 'bg-[#3fb950] animate-pulse'}`} />
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className={`text-[11px] font-black ${isEnded ? 'text-[#5e6b7c]' : 'text-[#3fb950]'}`}>
                  {isEnded ? 'ENDED' : 'LIVE'}
                </span>
                <span className="text-[10px] text-white font-bold font-mono">{elapsedTimeStr}</span>
              </div>
              <div className="text-[8px] text-[#5e6b7c] uppercase">ELAPSED</div>
            </div>
          </div>

          {/* GM Host Control Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0f141c] border border-[#2d3848]">
            <Crown size={14} className="text-[#fcee0a]" />
            <div className="leading-tight">
              <div className="text-[11px] font-black text-white">GM</div>
              <div className="text-[8px] text-[#5e6b7c] uppercase">Host Control</div>
            </div>
          </div>
        </div>
      </header>

      {/* Error / Warning Alert Banner */}
      {actionError && (
        <div className="relative z-30 w-full bg-[rgba(255,51,102,0.15)] border-b-2 border-[#ff3366] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#ff3366] font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{actionError}</span>
          </div>
          <div className="flex items-center gap-3">
            {actionError.toLowerCase().includes('forbidden') && (
              <button
                onClick={() => {
                  try {
                    sessionStorage.removeItem('terminal_token');
                    sessionStorage.removeItem('terminal_user');
                  } catch {}
                  localStorage.removeItem('terminal_token');
                  localStorage.removeItem('terminal_user');
                  window.location.href = `/login?redirect=/host/${code}`;
                }}
                className="px-2 py-0.5 bg-[#ff3366] text-white font-bold hover:bg-[#ff1a53] text-[10px] uppercase cursor-pointer"
              >
                [RE-AUTHENTICATE AS HOST GM]
              </button>
            )}
            <button onClick={() => setActionError(null)} className="font-black hover:text-white cursor-pointer">[DISMISS]</button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN DASHBOARD CONTENT (3-COLUMN DENSE GRID)
      ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 p-2 sm:p-3 md:p-4 grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-3 sm:gap-3.5 overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0">

        {/* ── LEFT COLUMN: GAME PROGRESS & SESSION STATS ── */}
        <section className="flex flex-col gap-3 sm:gap-3.5 min-w-0 max-w-full overflow-hidden">

          {/* Game Progress Panel */}
          <div className="bg-[#0f141c] border border-[#1b2432] shadow-[3px_3px_0px_#000]">
            <div className="bg-[#121822] border-b border-[#1b2432] px-3.5 py-2 flex items-center justify-between">
              <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.25em] uppercase">&gt;_ GAME PROGRESS</span>
              <Activity size={12} className="text-[#00ffcc]" />
            </div>
            
            <div className="p-3.5 flex flex-col gap-3">
              {/* Stepper Node 1: WAITING */}
              <div className="flex items-start gap-3 relative">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 flex items-center justify-center border-2 ${
                    isLobby || isStarting
                      ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.15)] text-[#00ffcc]'
                      : 'border-[#3fb950] bg-[#3fb950] text-black'
                  }`}>
                    {(!isLobby && !isStarting) ? <Check size={11} strokeWidth={3} /> : <div className="w-1.5 h-1.5 bg-[#00ffcc] rounded-full" />}
                  </div>
                  <div className="w-0.5 h-7 bg-[#1b2432] my-0.5" />
                </div>
                <div className="pt-0.5">
                  <div className={`text-xs font-black uppercase ${isLobby || isStarting ? 'text-[#00ffcc]' : 'text-white'}`}>
                    WAITING
                  </div>
                  <div className="text-[10px] text-[#5e6b7c]">Room open for players</div>
                </div>
              </div>

              {/* Stepper Node 2: IN PROGRESS */}
              <div className="flex items-start gap-3 relative">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 flex items-center justify-center border-2 ${
                    isQuestionActive || isQuestionLocked || isQuestionResults
                      ? 'border-[#00ffcc] bg-[rgba(0,255,204,0.2)] text-[#00ffcc] ring-2 ring-[rgba(0,255,204,0.3)]'
                      : isResults || isEnded
                      ? 'border-[#3fb950] bg-[#3fb950] text-black'
                      : 'border-[#2d3848] bg-[#0a0c10] text-[#3d4754]'
                  }`}>
                    {(isResults || isEnded) ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (isQuestionActive || isQuestionLocked || isQuestionResults) ? (
                      <div className="w-2 h-2 bg-[#00ffcc] animate-pulse" />
                    ) : null}
                  </div>
                  <div className="w-0.5 h-7 bg-[#1b2432] my-0.5" />
                </div>
                <div className="pt-0.5">
                  <div className={`text-xs font-black uppercase ${
                    isQuestionActive || isQuestionLocked || isQuestionResults ? 'text-[#00ffcc]' : 'text-white'
                  }`}>
                    IN PROGRESS
                  </div>
                  <div className="text-[10px] text-[#5e6b7c]">
                    {isQuestionActive || isQuestionLocked ? `Question ${currentChallengeIndex + 1} of ${totalQuestions}` : 'Questions queued'}
                  </div>
                </div>
              </div>

              {/* Stepper Node 3: FINALIZING */}
              <div className="flex items-start gap-3 relative">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 flex items-center justify-center border-2 ${
                    isResults
                      ? 'border-[#fcee0a] bg-[rgba(252,238,10,0.2)] text-[#fcee0a] ring-2 ring-[rgba(252,238,10,0.3)]'
                      : isEnded
                      ? 'border-[#3fb950] bg-[#3fb950] text-black'
                      : 'border-[#2d3848] bg-[#0a0c10] text-[#3d4754]'
                  }`}>
                    {isEnded ? <Check size={11} strokeWidth={3} /> : isResults ? <div className="w-2 h-2 bg-[#fcee0a] animate-pulse" /> : null}
                  </div>
                  <div className="w-0.5 h-7 bg-[#1b2432] my-0.5" />
                </div>
                <div className="pt-0.5">
                  <div className={`text-xs font-black uppercase ${isResults ? 'text-[#fcee0a]' : 'text-white'}`}>
                    FINALIZING
                  </div>
                  <div className="text-[10px] text-[#5e6b7c]">Calculating results</div>
                </div>
              </div>

              {/* Stepper Node 4: COMPLETED */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 flex items-center justify-center border-2 ${
                    isEnded
                      ? 'border-[#3fb950] bg-[#3fb950] text-black ring-2 ring-[rgba(63,185,80,0.3)]'
                      : 'border-[#2d3848] bg-[#0a0c10] text-[#3d4754]'
                  }`}>
                    {isEnded ? <Check size={11} strokeWidth={3} /> : null}
                  </div>
                </div>
                <div className="pt-0.5">
                  <div className={`text-xs font-black uppercase ${isEnded ? 'text-[#3fb950]' : 'text-white'}`}>
                    COMPLETED
                  </div>
                  <div className="text-[10px] text-[#5e6b7c]">Game finished</div>
                </div>
              </div>
            </div>
          </div>

          {/* Module 4: Session Stats Panel (Spotlight Capable) */}
          <SpotlightModule
            id="session-stats"
            title="SESSION STATS"
            icon={<Users size={12} />}
            activeSpotlightId={activeSpotlightId}
            onExpand={setActiveSpotlightId}
            onMinimize={() => setActiveSpotlightId(null)}
            onDirectSwitch={setActiveSpotlightId}
            isAudienceMode={isAudienceMode}
            onToggleAudienceMode={() => setIsAudienceMode(v => !v)}
          >
            {(isSpotlight) => (
              <SessionStatsSpotlight
                isSpotlight={isSpotlight}
                totalParticipants={totalParticipants}
                maxCapacity={maxCapacity}
                totalTeams={totalTeams}
                totalAnswers={totalAnswers}
                onlineConnections={onlineConnections}
                elapsedTimeStr={elapsedTimeStr}
                totalQuestions={totalQuestions}
                currentChallengeIndex={currentChallengeIndex}
              />
            )}
          </SpotlightModule>
        </section>

        {/* ── CENTER COLUMN: CURRENT QUESTION & TIMER (Module 1: Spotlight Capable) ── */}
        <section className="flex flex-col gap-3.5 min-w-0 max-w-full overflow-hidden">
          <SpotlightModule
            id="question"
            title="CURRENT QUESTION"
            icon={<Play size={13} />}
            className="min-h-[480px] lg:min-h-[520px] flex flex-col justify-between"
            activeSpotlightId={activeSpotlightId}
            onExpand={setActiveSpotlightId}
            onMinimize={() => setActiveSpotlightId(null)}
            onDirectSwitch={setActiveSpotlightId}
            isAudienceMode={isAudienceMode}
            onToggleAudienceMode={() => setIsAudienceMode(v => !v)}
            headerBadge={
              previewIdx !== null && previewIdx !== currentChallengeIndex ? (
                <span className="text-[9px] px-1.5 py-0.5 bg-[rgba(252,238,10,0.15)] text-[#fcee0a] border border-[#fcee0a]">
                  PREVIEWING Q{previewIdx + 1}
                </span>
              ) : undefined
            }
            headerControls={
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white font-mono mr-1">
                  Q{displayIdx + 1}/{totalQuestions || 1}
                </span>
                <div className="flex items-center gap-1 border border-[#2d3848] bg-[#0a0c10]">
                  <button
                    onClick={() => setPreviewIdx(Math.max(0, displayIdx - 1))}
                    disabled={displayIdx <= 0}
                    title="Previous question"
                    className="p-1 text-[#8b99aa] hover:text-[#00ffcc] disabled:opacity-30 cursor-pointer">
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    onClick={() => setPreviewIdx(Math.min(totalQuestions - 1, displayIdx + 1))}
                    disabled={displayIdx >= totalQuestions - 1}
                    title="Next question"
                    className="p-1 text-[#8b99aa] hover:text-[#00ffcc] disabled:opacity-30 cursor-pointer">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            }
          >
            {(isSpotlight) => (
              <QuestionSpotlight
                isSpotlight={isSpotlight}
                state={state}
                code={code}
                displayIdx={displayIdx}
                totalQuestions={totalQuestions}
                displayChallenge={displayChallenge}
                qRemaining={qRemaining}
                totalTimeLimit={totalTimeLimit}
                timerPct={timerPct}
                totalAnswers={totalAnswers}
                totalParticipants={totalParticipants}
                answersPct={answersPct}
                teamsRespondedCount={teamsRespondedCount}
                totalTeams={totalTeams}
                teamsPct={teamsPct}
                isAudienceMode={isAudienceMode}
                isStagePaused={isStagePaused}
                actionBusy={actionBusy}
                isPreviewing={isPreviewing}
                previewStatus={previewStatus}
                onReturnToLive={() => setPreviewIdx(null)}
                isReviewRevealed={isReviewRevealed}
                reviewQuestionIndex={reviewQuestionIndex}
                reviewChallenge={reviewChallenge}
                onReviewNext={() => reviewNavigate('next')}
                onReviewPrev={() => reviewNavigate('prev')}
                onRevealAnswers={revealAnswers}
                onStartGame={startGame}
                onLockQuestion={lockQuestion}
                onNextQuestion={nextQuestion}
                onTogglePause={togglePause}
                onEndGame={() => setShowEndModal(true)}
              />
            )}
          </SpotlightModule>
        </section>

        {/* ── RIGHT COLUMN: QUESTION INFO & QUESTION PROGRESS (Module 3: Spotlight Capable) ── */}
        <section className="flex flex-col gap-3.5 min-w-0 max-w-full overflow-hidden">

          {/* Question Info Panel */}
          <div className="bg-[#0f141c] border border-[#1b2432] shadow-[3px_3px_0px_#000]">
            <div className="bg-[#121822] border-b border-[#1b2432] px-3.5 py-2 flex items-center justify-between">
              <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.25em] uppercase">&gt; QUESTION INFO</span>
            </div>

            <div className="p-3.5 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5e6b7c] uppercase">Type</span>
                <span className="font-bold text-white truncate max-w-[150px]">
                  {displayChallenge?.type?.replace(/_/g, ' ') || 'Multiple Choice'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e6b7c] uppercase">Points</span>
                <span className="font-bold text-white font-mono">{displayChallenge?.points || 10}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e6b7c] uppercase">Time Limit</span>
                <span className="font-bold text-white font-mono">{displayChallenge?.timeLimit || 30} seconds</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e6b7c] uppercase">Category</span>
                <span className="font-bold text-white truncate max-w-[150px]">
                  {displayChallenge?.category || sessionData.game?.name || 'Rapid Fire'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5e6b7c] uppercase">Difficulty</span>
                <div className="flex items-center gap-1">
                  {['EASY', 'MEDIUM', 'HARD'].map((diff, i) => {
                    const activeDiff = (displayChallenge?.difficulty || 'EASY').toUpperCase();
                    const isPassed =
                      (activeDiff === 'EASY' && i === 0) ||
                      (activeDiff === 'MEDIUM' && i <= 1) ||
                      (activeDiff === 'HARD' && i <= 2);
                    return (
                      <div
                        key={diff}
                        className={`w-3 h-2 ${isPassed ? 'bg-[#3fb950]' : 'bg-[#1b2432]'}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Module 3: Question Progress & Teams Telemetry (Spotlight Capable) */}
          <SpotlightModule
            id="teams-progress"
            title="QUESTION PROGRESS"
            icon={<Activity size={13} />}
            activeSpotlightId={activeSpotlightId}
            onExpand={setActiveSpotlightId}
            onMinimize={() => setActiveSpotlightId(null)}
            onDirectSwitch={setActiveSpotlightId}
            isAudienceMode={isAudienceMode}
            onToggleAudienceMode={() => setIsAudienceMode(v => !v)}
            className="flex-1 min-h-[220px]"
          >
            {(isSpotlight) => (
              <TeamsProgressSpotlight
                isSpotlight={isSpotlight}
                teamsEnabled={Boolean(sessionData.game?.teamsEnabled ?? sessionData.currentGame?.teamsEnabled ?? false)}
                playerRoster={sessionData.playerRoster || []}
                teamResponsesList={teamResponsesList}
                totalParticipants={totalParticipants}
                maxCapacity={maxCapacity}
                totalTeams={totalTeams}
                totalAnswers={totalAnswers}
                onlineConnections={onlineConnections}
                currentChallengeIndex={currentChallengeIndex}
                totalQuestions={totalQuestions}
                challenges={challenges}
                state={state}
              />
            )}
          </SpotlightModule>

        </section>

        {/* ── LOWER SECTION: LIVE SCOREBOARD (Module 2: Spotlight Capable) ── */}
        <section className="lg:col-span-2 flex flex-col min-h-[300px] min-w-0 max-w-full overflow-hidden">
          <SpotlightModule
            id="leaderboard"
            title="LIVE SCOREBOARD"
            icon={<Trophy size={14} />}
            activeSpotlightId={activeSpotlightId}
            onExpand={setActiveSpotlightId}
            onMinimize={() => setActiveSpotlightId(null)}
            onDirectSwitch={setActiveSpotlightId}
            isAudienceMode={isAudienceMode}
            onToggleAudienceMode={() => setIsAudienceMode(v => !v)}
            className="flex-1"
          >
            {(isSpotlight) => (
              <EsportsLeaderboard
                sessionCode={code}
                teamsEnabled={Boolean(sessionData.game?.teamsEnabled ?? sessionData.currentGame?.teamsEnabled ?? false)}
                teamLeaderboard={sessionData.teamLeaderboard || []}
                individualLeaderboard={sessionData.individualLeaderboard || []}
                teamResponsesList={teamResponsesList}
                challenges={challenges}
                isSpotlight={isSpotlight}
              />
            )}
          </SpotlightModule>
        </section>

        {/* ── LOWER RIGHT: RECENT ACTIVITY (Module 5: Spotlight Capable) ── */}
        <section className="flex flex-col min-h-[300px] min-w-0 max-w-full overflow-hidden">
          <SpotlightModule
            id="recent-activity"
            title="RECENT ACTIVITY"
            icon={<Zap size={13} />}
            activeSpotlightId={activeSpotlightId}
            onExpand={setActiveSpotlightId}
            onMinimize={() => setActiveSpotlightId(null)}
            onDirectSwitch={setActiveSpotlightId}
            isAudienceMode={isAudienceMode}
            onToggleAudienceMode={() => setIsAudienceMode(v => !v)}
            headerBadge={
              <div className="flex items-center gap-1 text-[9px] text-[#3fb950] ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
                <span>LIVE</span>
              </div>
            }
            className="flex-1"
          >
            {(isSpotlight) => (
              <RecentActivitySpotlight
                isSpotlight={isSpotlight}
                activities={activities}
              />
            )}
          </SpotlightModule>
        </section>

      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. BOTTOM HOST CONTROLS BAR (Hidden in Audience Mode)
      ───────────────────────────────────────────────────────────── */}
      {!isAudienceMode ? (
        <footer className="relative z-40 w-full max-w-full overflow-x-hidden bg-[#0a0c10] border-t-2 border-[#16202c] p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          {/* Left: Host Controls Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[#00ffcc] text-xs font-black tracking-wider uppercase mr-1">&gt; HOST CONTROLS</span>

            {/* Start Game Button (only in LOBBY or STARTING) */}
            {(isLobby || isStarting) && (
              <button
                onClick={startGame}
                disabled={!!actionBusy}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#3fb950] hover:bg-[#4bd15d] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer disabled:opacity-50">
                <Play size={14} fill="currentColor" />
                <span>{actionBusy === 'start' ? 'STARTING...' : 'START GAME'}</span>
              </button>
            )}

            {/* Lock Question Button (Question Active) */}
            {isQuestionActive && (
              <button
                onClick={lockQuestion}
                disabled={!!actionBusy}
                className="flex items-center gap-2 px-4 py-2 bg-[#fcee0a] hover:bg-[#fff033] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer disabled:opacity-50">
                <Lock size={13} />
                <span>{actionBusy === 'lock' ? 'LOCKING...' : 'LOCK QUESTION'}</span>
              </button>
            )}

            {/* Next Question Button (Active or Locked or Results) */}
            {(isQuestionActive || isQuestionLocked || isQuestionResults) && (
              <button
                onClick={nextQuestion}
                disabled={!!actionBusy}
                className="flex items-center gap-2 px-4 py-2 bg-[#00ffcc] hover:bg-[#33ffdd] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer disabled:opacity-50">
                <SkipForward size={13} fill="currentColor" />
                <span>{actionBusy === 'next' ? 'ADVANCING...' : 'NEXT QUESTION'}</span>
              </button>
            )}

            {/* Pause Button (Active states) */}
            {!isLobby && !isEnded && (
              <button
                onClick={togglePause}
                disabled={!!actionBusy}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-black border-2 shadow-[2px_2px_0px_#000] transition-all cursor-pointer ${
                  isStagePaused
                    ? 'bg-[#a855f7] text-white border-white'
                    : 'bg-transparent text-[#a855f7] border-[#a855f7] hover:bg-[rgba(168,85,247,0.15)]'
                }`}>
                <Pause size={13} />
                <span>{isStagePaused ? 'RESUME' : 'PAUSE'}</span>
              </button>
            )}

            {/* End Game Button (Active states) */}
            {!isLobby && !isEnded && (
              <button
                onClick={() => setShowEndModal(true)}
                disabled={!!actionBusy}
                className="flex items-center gap-2 px-4 py-2 bg-transparent text-[#ff3366] border-2 border-[#ff3366] shadow-[2px_2px_0px_rgba(255,51,102,0.4)] hover:bg-[rgba(255,51,102,0.15)] text-xs font-black transition-all cursor-pointer">
                <StopCircle size={13} />
                <span>END GAME</span>
              </button>
            )}

            {/* View Participants Modal Trigger */}
            <button
              onClick={() => setShowParticipantsModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#0f141c] text-[#8b99aa] hover:text-white border border-[#2d3848] text-xs font-bold transition-all cursor-pointer">
              <User size={13} />
              <span>VIEW PARTICIPANTS</span>
            </button>

            {/* View Teams Modal Trigger */}
            <button
              onClick={() => setShowTeamsModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#0f141c] text-[#8b99aa] hover:text-white border border-[#2d3848] text-xs font-bold transition-all cursor-pointer">
              <Users size={13} />
              <span>VIEW TEAMS</span>
            </button>

            {/* Download Report Button */}
            <button
              onClick={downloadReport}
              disabled={downloading}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#0f141c] text-[#00ffcc] hover:bg-[rgba(0,255,204,0.1)] border border-[#00ffcc] text-xs font-bold transition-all cursor-pointer disabled:opacity-50">
              <FileSpreadsheet size={13} />
              <span>{downloading ? 'GENERATING...' : 'DOWNLOAD REPORT'}</span>
            </button>

            {/* Reveal Answers & Explanations Button (Results or Ended) */}
            {(isResults || isEnded) && (
              !isReviewRevealed ? (
                <button
                  onClick={revealAnswers}
                  disabled={!!actionBusy}
                  className="flex items-center gap-2 px-4 py-2 bg-[#fcee0a] hover:bg-[#fff033] text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer disabled:opacity-50">
                  <Eye size={14} />
                  <span>{actionBusy === 'reveal' ? 'REVEALING...' : 'REVEAL ANSWERS & EXPLANATIONS'}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-[#0a0c10] border-2 border-[#00ffcc] p-1 shadow-[2px_2px_0px_#000]">
                  <span className="text-[#00ffcc] text-xs font-black uppercase px-2">
                    REVIEW: Q{reviewQuestionIndex + 1} / {totalQuestions}
                  </span>
                  <button
                    onClick={() => reviewNavigate('prev')}
                    disabled={!!actionBusy || reviewQuestionIndex <= 0}
                    className="px-3 py-1.5 bg-[#16202c] hover:bg-[#223042] text-white text-xs font-black border border-[#2d3848] disabled:opacity-30 cursor-pointer flex items-center gap-1">
                    <ChevronLeft size={13} />
                    <span>PREV</span>
                  </button>
                  <button
                    onClick={() => reviewNavigate('next')}
                    disabled={!!actionBusy || reviewQuestionIndex >= totalQuestions - 1}
                    className="px-3 py-1.5 bg-[#00ffcc] hover:bg-[#33ffdd] text-black text-xs font-black border border-black disabled:opacity-30 cursor-pointer flex items-center gap-1">
                    <span>NEXT</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )
            )}

            {/* New Session Button (if ended) */}
            {isEnded && (
              <button
                onClick={newSession}
                disabled={!!actionBusy}
                className="flex items-center gap-2 px-4 py-2 bg-[#00ffcc] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#00ffd5] transition-all cursor-pointer">
                <Play size={13} fill="currentColor" />
                <span>HOST NEW SESSION</span>
              </button>
            )}
          </div>

          {/* Right: Informational Auto-Advance Status */}
          <div className="flex items-center gap-3 bg-[#0f141c] px-3.5 py-1.5 border border-[#1b2432]">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-xs">
                <span className="text-[#5e6b7c] uppercase font-bold">NEXT</span>
                <span className="text-[#3fb950] font-black">Auto-advance: ON</span>
                <div className="w-8 h-4 bg-[#3fb950] p-0.5 flex items-center justify-end">
                  <div className="w-3 h-3 bg-black" />
                </div>
              </div>
              <div className="text-[9px] text-[#5e6b7c]">Next question starts automatically when timer ends</div>
            </div>
          </div>
        </footer>
      ) : (
        /* AUDIENCE BAR (Subtle watermark for presentation mode) */
        <footer className="relative z-40 w-full bg-[#0a0c10] border-t-2 border-[#16202c] p-2.5 flex items-center justify-between text-xs text-[#5e6b7c]">
          <div className="flex items-center gap-2 text-[#00ffcc]">
            <Radio size={12} className="animate-pulse" />
            <span className="font-bold">AUDIENCE PRESENTATION SAFE MODE</span>
          </div>
          <button
            onClick={() => setIsAudienceMode(false)}
            className="text-[10px] text-[#8b99aa] hover:text-[#00ffcc] font-mono cursor-pointer border border-[#2d3848] px-2 py-1 bg-[#161c24]"
          >
            [SHOW GM HOST CONTROLS]
          </button>
        </footer>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MODALS (PARTICIPANTS, TEAMS, END GAME CONFIRM)
      ───────────────────────────────────────────────────────────── */}

      {/* Participants Modal */}
      {showParticipantsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f141c] border-2 border-[#00ffcc] shadow-[6px_6px_0px_#000] w-full max-w-2xl max-h-[80vh] flex flex-col font-mono">
            <div className="bg-[#121822] border-b border-[#1b2432] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#00ffcc]" />
                <span className="font-black text-sm text-white uppercase">PARTICIPANTS ROSTER ({totalParticipants})</span>
              </div>
              <button onClick={() => setShowParticipantsModal(false)} className="text-[#5e6b7c] hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
              {(!sessionData.playerRoster || sessionData.playerRoster.length === 0) ? (
                <div className="text-center py-8 text-xs text-[#5e6b7c]">// NO PLAYERS JOINED YET</div>
              ) : (
                sessionData.playerRoster.map((p: any) => (
                  <div key={p.id} className="p-2.5 bg-[#0a0c10] border border-[#1b2432] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${p.connected ? 'bg-[#3fb950]' : 'bg-[#5e6b7c]'}`} />
                      <div>
                        <div className="font-bold text-white">{p.username}@terminal</div>
                        {p.name && <div className="text-[10px] text-[#5e6b7c]">{p.name}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#a855f7] font-bold">{p.teamName || 'SOLO'}</div>
                      <div className="text-[9px] text-[#5e6b7c]">{p.connected ? 'ONLINE' : 'OFFLINE'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-[#121822] border-t border-[#1b2432] flex justify-end">
              <button onClick={() => setShowParticipantsModal(false)} className="px-4 py-2 bg-[#00ffcc] text-black font-black text-xs cursor-pointer">
                [CLOSE]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teams Modal */}
      {showTeamsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f141c] border-2 border-[#a855f7] shadow-[6px_6px_0px_#000] w-full max-w-2xl max-h-[80vh] flex flex-col font-mono">
            <div className="bg-[#121822] border-b border-[#1b2432] p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#a855f7]" />
                <span className="font-black text-sm text-white uppercase">REGISTERED TEAMS ({totalTeams})</span>
              </div>
              <button onClick={() => setShowTeamsModal(false)} className="text-[#5e6b7c] hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              {(!sessionData.teamRoster?.teams || sessionData.teamRoster.teams.length === 0) ? (
                <div className="text-center py-8 text-xs text-[#5e6b7c]">// NO TEAMS FORMED YET</div>
              ) : (
                sessionData.teamRoster.teams.map((t: any) => (
                  <div key={t.teamId} className="p-3 bg-[#0a0c10] border border-[#1b2432] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-white">{t.teamName}</span>
                      <span className="text-xs text-[#a855f7] font-bold font-mono">{t.membersCount} members</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-[#16202c]">
                      {t.members?.map((m: any) => (
                        <span key={m.playerId} className="px-2 py-0.5 bg-[#121822] text-[#8b99aa] text-[10px] font-mono border border-[#2d3848]">
                          {m.username}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 bg-[#121822] border-t border-[#1b2432] flex justify-end">
              <button onClick={() => setShowTeamsModal(false)} className="px-4 py-2 bg-[#a855f7] text-white font-black text-xs cursor-pointer">
                [CLOSE]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Game Confirmation Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0f141c] border-2 border-[#ff3366] shadow-[6px_6px_0px_#000] w-full max-w-md p-6 font-mono">
            <div className="flex items-center gap-2 text-[#ff3366] text-xs font-black tracking-widest uppercase mb-3">
              <AlertTriangle size={16} />
              <span>// TERMINATE SESSION</span>
            </div>
            <h3 className="text-white font-black text-lg mb-2">END LIVE GAME?</h3>
            <p className="text-[#8b99aa] text-xs mb-6 leading-relaxed">
              This will stop all submissions, finalize scores, award final completion time bonuses, and lock the leaderboard.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 bg-transparent text-[#8b99aa] hover:text-white border border-[#2d3848] text-xs font-black cursor-pointer">
                [ CANCEL ]
              </button>
              <button
                onClick={confirmEndGame}
                className="px-4 py-2 bg-[#ff3366] text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#ff1a53] transition-all cursor-pointer">
                [ CONFIRM END GAME ]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
