import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { connectSocket, getSocket } from '../lib/socket';
import type { SafeChallenge, SessionStatePayload, LeaderboardEntry } from '../types';
import { 
  Trophy, 
  Clock, 
  Hourglass, 
  Copy, 
  Check, 
  Send, 
  Users, 
  Crown, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  Maximize2, 
  Minimize2, 
  X, 
  CheckCircle, 
  CheckCircle2,
  XCircle,
  Lock,
  Sparkles,
  Radio,
  User,
  Activity,
  Shield,
  Zap,
  BarChart2,
  Target,
  Flame,
  ArrowRight,
  Info
} from 'lucide-react';
import api from '../lib/api';

// Optional exploratory challenge components
import LogicHeistChallenge from '../components/LogicHeistChallenge';
import BugHuntChallenge from '../components/BugHuntChallenge';
import WitnessChallenge from '../components/WitnessChallenge';
import ScannerChallenge from '../components/ScannerChallenge';
import MissionChallenge from '../components/MissionChallenge';
import RouterChallenge from '../components/RouterChallenge';
import ThresholdChallenge from '../components/ThresholdChallenge';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function formatSubmittedAnswer(ans: any): string {
  if (ans === null || ans === undefined) return 'None';
  if (Array.isArray(ans)) {
    return ans.join(', ');
  }
  return String(ans);
}

function formatCorrectAnswer(ans: any, options?: string[]): string {
  if (ans === null || ans === undefined) return 'Revealed on server';
  if (Array.isArray(ans)) {
    return ans.map(a => {
      const s = String(a).trim();
      if (s.length === 1 && /^[a-zA-Z]$/.test(s) && Array.isArray(options)) {
        const idx = s.toUpperCase().charCodeAt(0) - 65;
        if (options[idx]) return `${s.toUpperCase()}. ${options[idx]}`;
      }
      return s;
    }).join(' • ');
  }
  const str = String(ans).trim();
  if (str.length === 1 && /^[a-zA-Z]$/.test(str) && Array.isArray(options)) {
    const idx = str.toUpperCase().charCodeAt(0) - 65;
    if (options[idx]) return `${str.toUpperCase()}. ${options[idx]}`;
  }
  return str;
}

function CyanPulseWaveform() {
  return (
    <svg className="w-8 h-3 text-[#00f0ff] opacity-80 shrink-0" viewBox="0 0 32 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 6H10L13 1L17 11L20 4L22 6H32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function renderDifficultyBlocks(diff: string = 'MEDIUM') {
  const upper = (diff || 'MEDIUM').toUpperCase();
  const filled = upper === 'HARD' ? 4 : upper === 'EASY' ? 2 : 3;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i} 
          className={`w-2.5 h-2.5 rounded-xs transition-colors ${
            i < filled ? 'bg-[#00ffaa] shadow-[0_0_6px_#00ffaa]' : 'bg-[#15273b]'
          }`} 
        />
      ))}
    </div>
  );
}

function renderFormattedPrompt(rawPrompt: string) {
  if (!rawPrompt) return null;

  // 1. Check for markdown code blocks ``` ... ```
  const codeBlockMatch = rawPrompt.match(/```(?:python|py|javascript|js|sql)?\s*([\s\S]*?)```/i);
  let codeSnippet: string | null = null;
  let remainingText = rawPrompt;

  if (codeBlockMatch) {
    codeSnippet = codeBlockMatch[1].trim();
    remainingText = (rawPrompt.slice(0, codeBlockMatch.index) + '\n' + rawPrompt.slice(codeBlockMatch.index! + codeBlockMatch[0].length)).trim();
  } else {
    const lines = rawPrompt.split('\n');
    const potentialCode: string[] = [];
    const nonCode: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (
        trimmed.startsWith('Select all') || 
        trimmed.startsWith('Statement:') || 
        trimmed.startsWith('Which of') ||
        trimmed.startsWith('What is') ||
        trimmed.startsWith('Consider the following') ||
        trimmed.endsWith('?') ||
        trimmed.endsWith(':')
      ) {
        nonCode.push(line);
      } else if (
        /^(let|const|var|def|class|import|from|x\s*=|y\s*=|for|while|if|return|print)/.test(trimmed) ||
        /^[a-zA-Z_]\w*\s*=[^=]/.test(trimmed) ||
        /^\s{2,}/.test(line)
      ) {
        potentialCode.push(line);
      } else if (potentialCode.length > 0 && nonCode.length === 0) {
        potentialCode.push(line);
      } else {
        nonCode.push(line);
      }
    }

    if (potentialCode.length > 0) {
      codeSnippet = potentialCode.join('\n');
      remainingText = nonCode.join('\n');
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-4">
      {codeSnippet && (
        <div className="rounded-md border border-[#16283d] bg-[#030712] overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <div className="bg-[#0b1322] px-3.5 py-2 border-b border-[#16283d] flex items-center justify-between select-none">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
              <span className="text-[10px] font-bold text-[#8ea4c0] ml-2 tracking-widest uppercase font-mono">
                PYTHON 3 // SNIPPET
              </span>
            </div>
            <span className="text-[9px] text-[#00f0ff] font-bold tracking-wider uppercase font-mono">UTF-8</span>
          </div>
          <pre className="font-mono text-sm sm:text-base text-[#38bdf8] p-4 sm:p-5 overflow-x-auto whitespace-pre leading-relaxed select-text font-bold">
            {codeSnippet}
          </pre>
        </div>
      )}

      {remainingText ? (
        <div className="text-white font-mono font-bold text-sm sm:text-base tracking-wide leading-relaxed">
          {remainingText}
        </div>
      ) : null}
    </div>
  );
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderHandle: string;
  content: string;
  createdAt: string;
  isSelf?: boolean;
}

export default function PlayPage() {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const navigate = useNavigate();
  const code = (sessionCode || '').toUpperCase();

  // Session & Game State
  const [sessionData, setSessionData] = useState<SessionStatePayload | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<SafeChallenge | null>(null);
  const currentChallengeIdRef = useRef<string | null>(null);
  const [gameState, setGameState] = useState<string>('LOBBY'); // LOBBY | QUESTION_ACTIVE | QUESTION_LOCKED | RESULTS | FINAL
  
  // Student answer state
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Timer countdown
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  // Team & Teammates
  const [myTeam, setMyTeam] = useState<{ id?: string; name?: string; color?: string; members?: any[] } | null>(null);
  const [copiedRoom, setCopiedRoom] = useState(false);

  // Team Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatExpanded, setIsChatExpanded] = useState(true);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [squadTab, setSquadTab] = useState<'CHAT' | 'INFO'>('CHAT');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Final Results state
  const [finalLeaderboard, setFinalLeaderboard] = useState<any[]>([]);

  // Post-game review state
  const [postGameTab, setPostGameTab] = useState<'LEADERBOARD' | 'REVIEW'>('LEADERBOARD');
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);
  const [localReviewIdx, setLocalReviewIdx] = useState<number>(0);
  const [chatError, setChatError] = useState<string | null>(null);

  const isReviewRevealed = Boolean(sessionData?.session?.isReviewRevealed);

  useEffect(() => {
    if (isReviewRevealed) {
      setPostGameTab('REVIEW');
      if (code) {
        api.get(`/sessions/${code}/review`)
          .then(res => {
            if (res.data?.questions) {
              setReviewQuestions(res.data.questions);
              setLocalReviewIdx(0);
            }
          })
          .catch(() => {});
      }
    }
  }, [isReviewRevealed, code]);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  const localUser = (() => {
    try {
      const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('terminal_user') : null)
        || (typeof localStorage !== 'undefined' ? localStorage.getItem('terminal_user') : null);
      return JSON.parse(raw || 'null');
    } catch {
      return null;
    }
  })();
  const localPlayer = (() => {
    try {
      const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('terminal_player') : null)
        || (typeof localStorage !== 'undefined' ? localStorage.getItem('terminal_player') : null);
      return JSON.parse(raw || 'null') || localUser;
    } catch {
      return localUser;
    }
  })();
  const currentUsername = localPlayer?.username || localUser?.username || 'player';

  // ── Copy Room Code ──────────────────────────────────────────────
  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

  // ── Auto-scroll Team Chat ───────────────────────────────────────
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatExpanded]);

  // ── Timer Logic ─────────────────────────────────────────────────
  useEffect(() => {
    let endsAtStr: string | null = null;

    if (currentChallenge?.challengeEndsAt) {
      endsAtStr = currentChallenge.challengeEndsAt;
    } else if (sessionData?.session?.questionEndsAt) {
      endsAtStr = String(sessionData.session.questionEndsAt);
    }

    if (!endsAtStr) {
      if (currentChallenge?.timerSecs) {
        setSecondsRemaining(currentChallenge.timerSecs);
      }
      return;
    }

    const targetTime = new Date(endsAtStr).getTime();
    const updateCountdown = () => {
      const diff = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setSecondsRemaining(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 250);
    return () => clearInterval(interval);
  }, [currentChallenge, sessionData?.session?.questionEndsAt]);

  // ── Initialize Socket & Session Data ────────────────────────────
  useEffect(() => {
    if (!localPlayer && !localUser) {
      navigate('/login');
      return;
    }

    // Join session in DB first
    api.post('/sessions/join', { roomCode: code })
      .then(res => {
        if (res.data?.sessionPlayer) {
          localStorage.setItem('terminal_player', JSON.stringify({
            ...localPlayer,
            id: res.data.sessionPlayer.id,
            sessionPlayerId: res.data.sessionPlayer.id,
          }));
        }
        if (socketRef.current?.connected) {
          socketRef.current.emit('player:join', { roomCode: code });
        }
      })
      .catch(() => {});

    // Pre-fetch team info
    api.get('/teams/current')
      .then(res => {
        if (res.data?.team) {
          setMyTeam(res.data.team);
        }
      })
      .catch(() => {});

    // Pre-fetch message history
    api.get('/teams/messages')
      .then(res => {
        if (res.data?.messages) {
          setChatMessages(res.data.messages.map((m: any) => ({
            id: m.id || String(Math.random()),
            senderName: m.senderName || m.senderHandle?.split('@')[0] || 'Teammate',
            senderHandle: m.senderHandle || 'team@terminal',
            content: m.content,
            createdAt: m.createdAt || new Date().toISOString(),
            isSelf: m.senderHandle?.toLowerCase().startsWith(currentUsername.toLowerCase()),
          })));
        }
      })
      .catch(() => {});

    // Connect socket
    const socket = connectSocket();
    socketRef.current = socket;

    const onConnect = () => {
      socket.emit('player:join', { roomCode: code });
    };

    socket.on('connect', onConnect);
    if (socket.connected) {
      socket.emit('player:join', { roomCode: code });
    }

    const handleStateUpdate = (data: any) => {
      if (!data) return;
      setSessionData(data);
      
      const status = data.session?.status || data.session?.state || 'LOBBY';
      setGameState(status);

      // Extract current challenge
      let chal = data.currentChallenge ||
                 data.currentGame?.challenges?.find((c: any) => c.id === data.session?.currentChallengeId);
      
      // If questions are active but currentChallenge is null, pick from list
      if (!chal && data.currentGame?.challenges?.length && (status === 'QUESTION_ACTIVE' || status === 'ROUND_ACTIVE')) {
        chal = data.currentGame.challenges[data.session?.currentPosition || 0] || data.currentGame.challenges[0];
      }

      if (chal && chal.id !== currentChallengeIdRef.current) {
        currentChallengeIdRef.current = chal.id;
        setCurrentChallenge(chal as SafeChallenge);
        setSubmitted(false);
        setSelectedAnswer(null);
        setSubmissionResult(null);
        setSubmissionError(null);
      }

      // Check team from teamRoster if not loaded
      if (data.teamRoster?.teams) {
        const found = data.teamRoster.teams.find((t: any) => 
          t.members?.some((m: any) => m.username?.toLowerCase() === currentUsername.toLowerCase())
        );
        if (found) {
          setMyTeam({
            id: found.teamId || found.id,
            name: found.teamName || found.name,
            ...found,
          });
        }
      }

      // If game is in final/results state
      if (status === 'ENDED' || status === 'FINAL' || status === 'RESULTS') {
        const board = data.teamLeaderboard?.length 
          ? data.teamLeaderboard 
          : (data.individualLeaderboard?.length ? data.individualLeaderboard : (data.leaderboard || []));
        setFinalLeaderboard(board);
      }
    };

    const handleChallengeStarted = (challenge: SafeChallenge) => {
      currentChallengeIdRef.current = challenge.id;
      setCurrentChallenge(challenge);
      setGameState('QUESTION_ACTIVE');
      setSubmitted(false);
      setSelectedAnswer(null);
      setSubmissionResult(null);
      setSubmissionError(null);
    };

    const handleGameEnded = () => {
      setGameState('FINAL');
      // Fetch leaderboard
      api.get(`/sessions/${code}/leaderboard`)
        .then(res => setFinalLeaderboard(res.data.leaderboard || []))
        .catch(() => {});
    };

    const handleTeamMessage = (msg: any) => {
      setChatMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const isSelf = msg.senderHandle?.toLowerCase().startsWith(currentUsername.toLowerCase());
        return [...prev, {
          id: msg.id || String(Date.now()),
          senderName: msg.senderName || msg.senderHandle?.split('@')[0] || 'Teammate',
          senderHandle: msg.senderHandle || 'team@terminal',
          content: msg.content,
          createdAt: msg.createdAt || new Date().toISOString(),
          isSelf,
        }];
      });
      if (!isChatExpanded) {
        setUnreadChatCount(c => c + 1);
      }
    };

    const handleChatCleared = () => {
      setChatMessages([]);
    };

    const handleTeamError = (err: any) => {
      setChatError(err?.message || 'Chat message delivery failed.');
      setTimeout(() => setChatError(null), 4000);
    };

    socket.on('session:state', handleStateUpdate);
    socket.on('session_state_update', handleStateUpdate);
    socket.on('challenge:started', handleChallengeStarted);
    socket.on('game:ended', handleGameEnded);
    socket.on('team:message', handleTeamMessage);
    socket.on('team:chat_cleared', handleChatCleared);
    socket.on('team:error', handleTeamError);

    // Initial load from REST
    api.get(`/sessions/${code}`)
      .then(res => {
        if (res.data) handleStateUpdate(res.data);
      })
      .catch(() => {});

    return () => {
      socket.off('connect', onConnect);
      socket.off('session:state', handleStateUpdate);
      socket.off('session_state_update', handleStateUpdate);
      socket.off('challenge:started', handleChallengeStarted);
      socket.off('game:ended', handleGameEnded);
      socket.off('team:message', handleTeamMessage);
      socket.off('team:chat_cleared', handleChatCleared);
      socket.off('team:error', handleTeamError);
    };
  }, [code, currentUsername]);

  // Join team room when team info loads
  const currentTeamId = myTeam?.id || (myTeam as any)?.teamId;
  useEffect(() => {
    if (currentTeamId && socketRef.current) {
      socketRef.current.emit('team:join', { teamId: currentTeamId });
    }
  }, [currentTeamId]);

  // ── Rehydrate Submission Feedback on Mount or Challenge Change ───
  useEffect(() => {
    if (!code || !currentChallenge?.id) return;
    api.get(`/sessions/${code}/my-submission`)
      .then(res => {
        if (res.data?.hasSubmitted) {
          setSubmitted(true);
          setSelectedAnswer(res.data.submittedAnswer);
          setSubmissionResult(res.data);
        }
      })
      .catch(() => {});
  }, [code, currentChallenge?.id]);

  // ── Send Team Chat Message ──────────────────────────────────────
  const handleSendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;

    const targetTeamId = myTeam?.id || (myTeam as any)?.teamId;
    if (!targetTeamId) {
      setChatError('No squad uplink found. Team chat requires an active squad.');
      setTimeout(() => setChatError(null), 3000);
      return;
    }

    const socket = getSocket();
    if (socket) {
      socket.emit('team:send_message', {
        content: clean,
        teamId: targetTeamId,
        roomCode: code,
      });
    }

    setChatInput('');
  };

  // ── Handle Option Selection ─────────────────────────────────────
  const handleSelectOption = (opt: string) => {
    if (submitted || isSubmitting) return;

    const isMultiChoice = currentChallenge?.type === 'MULTIPLE_CHOICE' || currentChallenge?.type === 'MULTI_CHOICE';

    if (isMultiChoice) {
      const cur = Array.isArray(selectedAnswer) ? selectedAnswer : [];
      if (cur.includes(opt)) {
        setSelectedAnswer(cur.filter(a => a !== opt));
      } else {
        setSelectedAnswer([...cur, opt]);
      }
    } else {
      setSelectedAnswer(opt);
    }
  };

  // ── Submit Answer ───────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (submitted || isSubmitting || !selectedAnswer || !currentChallenge) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await api.post('/sessions/active/submit', { answer: selectedAnswer });
      setSubmitted(true);
      setSubmissionResult(response.data);
    } catch (err: any) {
      // Fallback submit endpoint
      try {
        const response = await api.post(`/sessions/${code}/submit`, { answer: selectedAnswer });
        setSubmitted(true);
        setSubmissionResult(response.data);
      } catch (fallbackErr: any) {
        setSubmissionError(fallbackErr.response?.data?.error || err.response?.data?.error || 'Failed to submit answer.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────
  const isTeamsMode = Boolean(
    sessionData?.game?.teamsEnabled ??
    (sessionData?.currentGame as any)?.teamsEnabled ??
    (sessionData?.session?.snapshot as any)?.game?.teamsEnabled ??
    (sessionData?.session?.snapshot as any)?.teamsEnabled ??
    false
  );

  const totalQuestions = currentChallenge?.totalChallenges || 
                         sessionData?.currentGame?.challenges?.length || 10;
  const currentQuestionIdx = currentChallenge?.challengeIndex !== undefined
    ? currentChallenge.challengeIndex
    : (sessionData?.session?.currentPosition || 0);

  const teamName = isTeamsMode 
    ? (myTeam?.name || sessionData?.teamRoster?.teams?.[0]?.teamName || 'SQUAD')
    : `${currentUsername}@terminal`;

  // Teammates list
  const teammates = (isTeamsMode && myTeam?.members?.length)
    ? myTeam.members 
    : [
        { username: currentUsername, handle: `${currentUsername}@terminal`, connected: true, isYou: true },
      ];

  const onlineMembersCount = teammates.filter((m: any) => m.connected !== false).length;
  const totalMembersCount = teammates.length;

  // Response progress for State 3 (Answer Submitted)
  const currentTeamResponse = isTeamsMode ? sessionData?.teamResponses?.find((t: any) => 
    t.teamName?.toLowerCase() === teamName.toLowerCase() || t.teamId === myTeam?.id
  ) : null;
  const answeredCount = currentTeamResponse?.respondedCount ?? (submitted ? 1 : 0);
  const teamTotalMembers = currentTeamResponse?.totalMembers ?? Math.max(1, totalMembersCount);
  const teamProgressPercent = Math.min(100, Math.round((answeredCount / teamTotalMembers) * 100));

  // Player Rank and Score
  const myEntry = finalLeaderboard.find((entry: any) => {
    if (isTeamsMode) {
      return entry.teamId === myTeam?.id || entry.name?.toLowerCase() === myTeam?.name?.toLowerCase();
    }
    return (
      entry.username?.toLowerCase() === currentUsername.toLowerCase() ||
      entry.displayName?.toLowerCase() === currentUsername.toLowerCase() ||
      entry.name?.toLowerCase() === currentUsername.toLowerCase() ||
      entry.handle?.toLowerCase() === `${currentUsername.toLowerCase()}@terminal`
    );
  });
  const myRank = myEntry?.rank ?? (finalLeaderboard.length > 0 && myEntry ? finalLeaderboard.indexOf(myEntry) + 1 : null);
  const myScore = myEntry?.score ?? (myEntry?.totalScore !== undefined ? myEntry.totalScore : null);

  const gameCategory = (sessionData?.currentGame as any)?.category || (sessionData?.session?.snapshot as any)?.game?.category || 'CYBERCORE';
  const gameDifficulty = (sessionData?.currentGame as any)?.difficulty || (sessionData?.session?.snapshot as any)?.game?.difficulty || 'MEDIUM';
  const diffLevel = gameDifficulty.toUpperCase() === 'HARD' ? 3 : gameDifficulty.toUpperCase() === 'EASY' ? 1 : 2;

  const liveScore = myScore ?? (
    ((sessionData as any)?.individualLeaderboard || sessionData?.leaderboard || []).find((e: any) =>
      e.username?.toLowerCase() === currentUsername.toLowerCase() ||
      e.displayName?.toLowerCase() === currentUsername.toLowerCase()
    )?.score ?? (submissionResult?.score ?? 0)
  );

  const liveRank = myRank ? `#${myRank}` : (() => {
    const board = (sessionData as any)?.individualLeaderboard || sessionData?.leaderboard || [];
    const idx = board.findIndex((e: any) =>
      e.username?.toLowerCase() === currentUsername.toLowerCase() ||
      e.displayName?.toLowerCase() === currentUsername.toLowerCase()
    );
    return idx >= 0 ? `#${idx + 1}` : '#3';
  })();

  const streakCount = submissionResult?.streak ?? (myEntry?.streak || (submissionResult?.correct ? 4 : 4));
  const correctCount = submissionResult?.correctCount ?? (myEntry?.correctCount ?? (submissionResult?.correct ? 4 : 4));
  const totalAnsweredSoFar = Math.max(4, currentQuestionIdx + (submitted ? 1 : 0));

  // Determine which of the 5 visual screens to show
  const isGameCompleted = gameState === 'FINAL' || gameState === 'ENDED' || gameState === 'RESULTS';
  const isWaiting = !isGameCompleted && (
    gameState === 'LOBBY' || 
    gameState === 'STARTING' || 
    !currentChallenge
  );
  const isQuestionActive = !isGameCompleted && !isWaiting && !submitted;
  const isAnswerSubmitted = !isGameCompleted && !isWaiting && submitted;

  // Question options
  const options = currentChallenge?.options || [
    'A type of fruit',
    'A programming language',
    'A color',
    'A pet animal'
  ];

  const isMultiChoice = currentChallenge?.type === 'MULTIPLE_CHOICE' || currentChallenge?.type === 'MULTI_CHOICE';

  const avatarColors = ['#00e5ff', '#ff007f', '#00ffaa', '#eab308'];

  // Check if exploratory challenge
  const isExploratory = currentChallenge && (
    sessionData?.currentGame?.template === 'LOGIC_HEIST' ||
    sessionData?.currentGame?.template === 'BUG_HUNT' ||
    sessionData?.currentGame?.template === 'THE_WITNESS' ||
    sessionData?.currentGame?.template === 'ROGUE_SCANNER' ||
    sessionData?.currentGame?.template === 'SILENT_MISSION' ||
    sessionData?.currentGame?.template === 'SIGNAL_ROUTER' ||
    sessionData?.currentGame?.template === 'THE_THRESHOLD'
  );

  return (
    <div className="min-h-screen bg-[#040711] text-[#e6edf3] font-mono flex flex-col relative select-text overflow-x-hidden">
      {/* ── LIVING CYBERPUNK ARENA ATMOSPHERE ────────────────────── */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(4, 7, 17, 0.45) 0%, rgba(4, 7, 17, 0.7) 65%, rgba(4, 7, 17, 0.9) 100%), url('/cyberpunk_arena_bg.jpg')`
        }} 
      />

      {/* Horizon Perspective Grid Vignette Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(0, 240, 255, 0.08), transparent 70%), linear-gradient(180deg, rgba(3,5,10,0.2) 0%, transparent 40%, rgba(3,5,10,0.85) 100%)'
        }}
      />

      {/* Restrained Technical HUD Reticles */}
      <div className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden hidden md:block opacity-30">
        <div className="absolute top-14 left-6 text-[10px] font-mono text-cyan-400/50 flex items-center gap-1.5">
          <span>┌── [ARENA_SYS // ONLINE]</span>
        </div>
        <div className="absolute top-14 right-6 text-[10px] font-mono text-purple-400/50 flex items-center gap-1.5">
          <span>[LATENCY: 18MS // TLSv1.3] ──┐</span>
        </div>
        <div className="absolute bottom-6 left-6 text-[10px] font-mono text-cyan-400/50 flex items-center gap-1.5">
          <span>└── SECTOR_01 // CYBERCORE_UPLINK</span>
        </div>
        <div className="absolute bottom-6 right-6 text-[10px] font-mono text-cyan-400/50 flex items-center gap-1.5">
          <span>TERMINAL_PROTOCOL_v3.4 ──┘</span>
        </div>
      </div>

      {/* ── TOP HEADER ───────────────────────────────────────────── */}
      <header className="relative z-20 w-full bg-[#040813]/90 backdrop-blur-md border-b border-[#122236] px-4 sm:px-8 py-3 flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        {/* Left: Terminal Logo & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-[#071320] border-2 border-[#00f0ff] flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.4)] shrink-0">
            <span className="text-[#00f0ff] font-black text-xs font-mono select-none">&gt;_</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black tracking-widest text-sm sm:text-base leading-none font-mono">
              TERMINAL
            </span>
            <span className="text-[#00f0ff] text-[9px] font-bold tracking-[0.25em] uppercase leading-tight mt-0.5 font-mono">
              STUDENT TERMINAL
            </span>
          </div>
        </div>

        {/* Center: Question Progress Bar */}
        {!isWaiting && !isGameCompleted && (
          <div className="flex flex-col items-center gap-1.5 min-w-[220px]">
            <span className="text-[#00f0ff] text-xs font-bold tracking-widest uppercase font-mono">
              QUESTION {currentQuestionIdx + 1} / {totalQuestions}
            </span>
            <div className="w-56 sm:w-64 h-2 bg-[#091322] border border-[#142842] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00f0ff] transition-all duration-300 shadow-[0_0_10px_#00f0ff] rounded-full"
                style={{ width: `${Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Right: Timer / Status */}
        <div className="flex items-center gap-3">
          {isWaiting ? (
            <div className="flex items-center gap-2 bg-[#0c1424] border border-[#1a304e] px-3.5 py-1.5 rounded-sm">
              <span className="text-[#5e6b7c] text-[10px] tracking-widest font-bold uppercase font-mono">ROOM CODE</span>
              <span className="text-[#00f0ff] font-black text-xs sm:text-sm tracking-wider font-mono">{code}</span>
              <button 
                onClick={handleCopyCode}
                className="text-[#5e6b7c] hover:text-[#00f0ff] transition-colors ml-0.5" 
                title="Copy room code"
              >
                {copiedRoom ? <Check size={13} className="text-[#00ffaa]" /> : <Copy size={13} />}
              </button>
            </div>
          ) : isGameCompleted ? (
            <div className="flex items-center gap-2 text-[#fcce0a] bg-[rgba(252,206,10,0.08)] border border-[#fcce0a]/40 px-3.5 py-1.5 rounded-md font-bold text-xs font-mono">
              <Trophy size={14} className="text-[#fcce0a]" />
              <span className="tracking-widest uppercase">GAME COMPLETE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-[#121408]/90 border-2 border-[#fcce0a] px-3.5 py-1.5 rounded-md shadow-[0_0_14px_rgba(252,206,10,0.25)]">
              <Clock size={16} className="text-[#fcce0a] animate-pulse" />
              <span className="text-[#fcce0a] font-black text-sm sm:text-base font-mono tracking-wider">
                {secondsRemaining}s
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">

        {/* ═════════════════════════════════════════════════════════ */}
        {/* STATE 1: JOIN / WAITING FOR GAME                          */}
        {/* ═════════════════════════════════════════════════════════ */}
        {isWaiting && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full gap-4 my-auto py-8">
            {/* Solo vs Squad Card */}
            {isTeamsMode ? (
              <div className="w-full bg-[#090e18] border border-[#16273d] p-6 rounded-sm shadow-[0_0_24px_rgba(0,0,0,0.6)] text-center relative overflow-hidden">
                <div className="text-[#6b7d96] text-[10px] tracking-[0.3em] font-bold uppercase mb-2">
                  SQUAD UPLINK // READY
                </div>
                <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-black text-[#d946ef] tracking-wider mb-2" style={{ textShadow: '0 0 16px rgba(217,70,239,0.4)' }}>
                  <span>{teamName}</span>
                  <Crown size={22} className="text-[#fcce0a]" />
                </div>
                <div className="text-[#6b7d96] text-xs font-semibold mb-6 tracking-wide">
                  {onlineMembersCount} / {totalMembersCount} TEAMMATES ONLINE
                </div>

                {/* Teammates Avatar Row */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2">
                  {teammates.slice(0, 4).map((member: any, idx: number) => {
                    const isYou = member.isYou || member.username?.toLowerCase() === currentUsername.toLowerCase();
                    const isOnline = member.connected !== false;
                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5">
                        <div className="relative">
                          <div 
                            className="w-12 h-12 rounded-full border-2 flex items-center justify-center"
                            style={{
                              borderColor: isYou ? '#00ffaa' : isOnline ? avatarColors[idx % avatarColors.length] : '#334155',
                              backgroundColor: '#0d1524'
                            }}
                          >
                            <Users 
                              size={18} 
                              style={{ color: isYou ? '#00ffaa' : isOnline ? avatarColors[idx % avatarColors.length] : '#475569' }} 
                            />
                          </div>
                          {isYou && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#fcce0a] text-black flex items-center justify-center font-black text-[10px]">
                              👑
                            </div>
                          )}
                          {isOnline && !isYou && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00ffaa] border-2 border-[#090e18]" />
                          )}
                        </div>
                        <span className={`text-xs font-bold ${isYou ? 'text-[#00ffaa]' : isOnline ? 'text-zinc-200' : 'text-[#475569]'}`}>
                          {isYou ? 'You' : member.username}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="w-full bg-[#090e18] border border-[#00f0ff]/30 p-6 rounded-sm shadow-[0_0_24px_rgba(0,240,255,0.15)] text-center relative overflow-hidden">
                <div className="text-[#00f0ff] text-[10px] tracking-[0.3em] font-bold uppercase mb-2">
                  SOLO OPERATOR // READY
                </div>
                <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-black text-white tracking-wider mb-2 drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]">
                  <span>{currentUsername}@terminal</span>
                </div>
                <div className="text-[#6b7d96] text-xs font-semibold mb-5 tracking-wide">
                  INDIVIDUAL COMPETITOR MODE ACTIVE
                </div>

                <div className="flex items-center justify-center gap-3 bg-[#0d1524] border border-[#16273d] p-3 rounded-sm">
                  <div className="w-3 h-3 rounded-full bg-[#00ffaa] animate-pulse" />
                  <span className="text-xs font-mono font-bold text-zinc-200">
                    TERMINAL UPLINK CONNECTED
                  </span>
                </div>
              </div>
            )}

            {/* Game Starts Soon Card */}
            <div className="w-full bg-[#090e18] border border-[#16273d] p-4 rounded-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-sm bg-[#1a1708] border border-[#fcce0a]/50 flex items-center justify-center shrink-0">
                <Hourglass size={20} className="text-[#fcce0a] animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="flex flex-col">
                <span className="text-[#fcce0a] font-bold text-sm tracking-wider uppercase">
                  GAME STARTS SOON
                </span>
                <span className="text-[#6b7d96] text-xs">
                  Waiting for your host to start the game...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════ */}
        {/* STATE 2 & 4: ACTIVE QUESTION & TEAM CHAT                  */}
        {/* ═════════════════════════════════════════════════════════ */}
        {/* ═════════════════════════════════════════════════════════ */}
        {/* STATE 2 & 3: ACTIVE QUESTION / SUBMITTED ANSWER            */}
        {/* ═════════════════════════════════════════════════════════ */}
        {(isQuestionActive || isAnswerSubmitted) && (
          <div className="flex-1 min-h-0 w-full flex flex-col gap-4">
            {/* Mobile / Tablet Compact Telemetry Bar (< lg) */}
            <div className="lg:hidden bg-[#060c18]/90 border border-[#00f0ff]/30 p-3 rounded-md flex items-center justify-between text-xs font-mono shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3">
                <span className="text-[#64748b]">ROOM: <span className="text-[#00f0ff] font-bold">{code}</span></span>
                <span className="text-[#64748b]">SCORE: <span className="text-[#00ffaa] font-bold">{liveScore}</span></span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#64748b]">RANK: <span className="text-[#fcce0a] font-bold">{liveRank}</span></span>
                <span className="px-1.5 py-0.5 bg-[#00f0ff]/10 border border-[#00f0ff]/40 text-[#00f0ff] text-[10px] font-bold rounded-sm uppercase">
                  {isTeamsMode ? 'SQUAD' : 'SOLO'}
                </span>
                {isTeamsMode && (
                  <button 
                    type="button"
                    onClick={() => setIsMobileChatOpen(true)}
                    className="px-2 py-0.5 bg-[#d946ef]/20 border border-[#d946ef]/60 text-[#d946ef] text-[10px] font-bold rounded-sm uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <Users size={10} />
                    <span>CHAT</span>
                  </button>
                )}
              </div>
            </div>

            {/* Desktop 3-Column Cyberpunk Grid (Proportions: 18-20% left, 60-62% center, 18-20% right) */}
            <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_250px] xl:grid-cols-[270px_minmax(0,1fr)_270px] 2xl:grid-cols-[290px_minmax(0,1fr)_290px] gap-6 w-full flex-1 min-h-0 items-start">
              
              {/* ── LEFT COLUMN: SESSION & YOUR STATS ────────────────── */}
              <div className="hidden lg:flex flex-col gap-4 h-full">
                {/* Panel 1: SESSION */}
                <div className="bg-[#060c18]/90 backdrop-blur-md border border-[#00f0ff]/30 p-4 rounded-lg shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#14243b]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00ffaa] shadow-[0_0_6px_#00ffaa]" />
                      <span className="text-[#00f0ff] font-black text-xs tracking-widest uppercase font-mono">SESSION</span>
                    </div>
                    <CyanPulseWaveform />
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b] tracking-wider">ROOM CODE</span>
                      <span className="text-[#00f0ff] font-black tracking-widest text-sm">{code}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b] tracking-wider">MODE</span>
                      <span className="text-white font-bold">{isTeamsMode ? 'SQUAD' : 'SOLO'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b] tracking-wider">CATEGORY</span>
                      <span className="text-white font-bold uppercase truncate max-w-[130px] text-right">{gameCategory}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748b] tracking-wider">DIFFICULTY</span>
                      {renderDifficultyBlocks(gameDifficulty)}
                    </div>
                  </div>
                </div>

                {/* Panel 2: YOUR STATS */}
                <div className="bg-[#060c18]/90 backdrop-blur-md border border-[#00f0ff]/30 p-4 rounded-lg shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#14243b]">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-[#00f0ff] flex items-center justify-center">
                        <User size={10} className="text-[#00f0ff]" />
                      </div>
                      <span className="text-[#00f0ff] font-black text-xs tracking-widest uppercase font-mono">YOUR STATS</span>
                    </div>
                    <CyanPulseWaveform />
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#64748b]">
                        <Trophy size={13} className="text-[#00ffaa]" />
                        <span>SCORE</span>
                      </div>
                      <span className="text-[#00f0ff] font-black text-sm">{liveScore}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#64748b]">
                        <User size={13} className="text-[#00f0ff]" />
                        <span>RANK</span>
                      </div>
                      <span className="text-white font-black text-sm">{liveRank}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#64748b]">
                        <CheckCircle2 size={13} className="text-[#00ffaa]" />
                        <span>CORRECT</span>
                      </div>
                      <span className="text-white font-black text-sm">{correctCount} / {totalAnsweredSoFar}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#64748b]">
                        <Flame size={13} className="text-[#ff5533]" />
                        <span>STREAK</span>
                      </div>
                      <span className="text-white font-black text-sm">{streakCount}</span>
                    </div>
                  </div>
                </div>

                {/* Floating Bottom Navigation Markings */}
                <div className="mt-auto pt-6 pb-2 flex flex-col gap-0.5 text-[11px] font-mono font-bold tracking-[0.25em] text-[#00f0ff]/60 select-none">
                  <div>EXPLORE</div>
                  <div>LEARN</div>
                  <div>COMPETE</div>
                  <div className="text-[#00f0ff] animate-pulse text-xs mt-0.5">&gt;_</div>
                </div>
              </div>

              {/* ── CENTER COLUMN: CENTRAL QUESTION CARD ──────────────── */}
              <div className="flex flex-col bg-[#060c18]/95 backdrop-blur-md border-2 border-[#00f0ff]/50 rounded-xl p-6 sm:p-7 shadow-[0_0_35px_rgba(0,240,255,0.12)] min-h-[500px] justify-between">
                <div>
                  {/* Question Badges */}
                  <div className="flex items-center gap-2.5 mb-5">
                    <span className="px-3 py-1 bg-[#1a1708] border border-[#fcce0a] text-[#fcce0a] text-xs font-black tracking-widest uppercase rounded-sm shadow-[0_0_8px_rgba(252,206,10,0.2)]">
                      {currentChallenge?.points || 100} POINTS
                    </span>
                    <span className="px-3 py-1 bg-[#23122e] border border-[#d946ef] text-[#d946ef] text-xs font-black tracking-widest uppercase rounded-sm shadow-[0_0_8px_rgba(217,70,239,0.2)]">
                      {isMultiChoice ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE'}
                    </span>
                  </div>

                  {/* Exploratory Challenge Fallback or Standard Question */}
                  {isExploratory ? (
                    <div className="my-2">
                      {sessionData?.currentGame?.template === 'LOGIC_HEIST' && (
                        <LogicHeistChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                      {sessionData?.currentGame?.template === 'BUG_HUNT' && (
                        <BugHuntChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                      {sessionData?.currentGame?.template === 'THE_WITNESS' && (
                        <WitnessChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                      {sessionData?.currentGame?.template === 'ROGUE_SCANNER' && (
                        <ScannerChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                      {sessionData?.currentGame?.template === 'SILENT_MISSION' && (
                        <MissionChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                      {sessionData?.currentGame?.template === 'SIGNAL_ROUTER' && (
                        <RouterChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                      {sessionData?.currentGame?.template === 'THE_THRESHOLD' && (
                        <ThresholdChallenge challenge={currentChallenge} sessionCode={code} onSubmitted={() => setSubmitted(true)} />
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Formatted Question Prompt & Code Snippet */}
                      {renderFormattedPrompt(currentChallenge?.prompt || 'WHAT IS AN ORANGE?')}

                      {/* Options List */}
                      <div className="flex-1 flex flex-col gap-3 mb-6">
                        {options.map((opt: string, idx: number) => {
                          const letter = OPTION_LETTERS[idx] || String(idx + 1);
                          const isSelected = isMultiChoice 
                            ? Array.isArray(selectedAnswer) && selectedAnswer.includes(opt)
                            : selectedAnswer === opt;

                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={submitted || isSubmitting}
                              onClick={() => handleSelectOption(opt)}
                              className={`w-full p-3.5 sm:p-4 rounded-md border text-left flex items-center gap-4 transition-all ${
                                isSelected 
                                  ? 'border-2 border-[#00f0ff] bg-[rgba(0,240,255,0.06)] shadow-[0_0_18px_rgba(0,240,255,0.22)]' 
                                  : 'border border-[#142338] bg-[#070e1c] hover:border-[#00f0ff]/40 hover:bg-[#0b162a]'
                              } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              <div className={`w-9 h-9 rounded-sm flex items-center justify-center font-black text-xs font-mono shrink-0 transition-colors ${
                                isSelected 
                                  ? 'bg-[#00f0ff] text-black shadow-[0_0_10px_#00f0ff]' 
                                  : 'bg-[#0f1b2d] text-[#8ea4c0] border border-[#1e3452]'
                              }`}>
                                {letter}
                              </div>
                              <span className={`font-bold text-sm sm:text-base font-mono tracking-wide ${isSelected ? 'text-white' : 'text-[#cbd5e1]'}`}>
                                {opt}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {submissionError && (
                        <div className="mb-4 text-xs text-[#ff3366] font-bold bg-[#ff3366]/10 border border-[#ff3366]/30 p-2.5 rounded-sm">
                          {submissionError}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Bottom Action Area: Submit Button OR Locked Status */}
                {!submitted ? (
                  <button
                    type="button"
                    disabled={!selectedAnswer || isSubmitting}
                    onClick={handleSubmitAnswer}
                    className={`w-full py-4 px-6 font-black text-sm tracking-widest uppercase transition-all rounded-sm flex items-center justify-center gap-2 ${
                      selectedAnswer && !isSubmitting
                        ? 'bg-[#00f0ff] hover:bg-[#3bf5ff] text-black shadow-[0_0_24px_rgba(0,240,255,0.5)] cursor-pointer'
                        : 'bg-[#152233] text-[#5e6b7c] border border-[#23354d] cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'SUBMITTING...' : 'SUBMIT ANSWER'}
                    <ArrowRight size={16} className="stroke-[3]" />
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="w-full py-4 px-6 bg-[rgba(0,240,255,0.08)] border-2 border-[#00f0ff] text-[#00f0ff] font-mono font-black text-sm tracking-widest uppercase rounded-sm flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(0,240,255,0.25)]">
                      <CheckCircle2 size={18} className="text-[#00ffaa]" />
                      <span>Answer submitted. Locked // Waiting for host reveal</span>
                    </div>
                    {isTeamsMode && (
                      <div className="bg-[#0b1320] border border-[#142338] px-4 py-2.5 rounded-sm flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 text-[#c084fc]">
                          <Users size={14} />
                          <span className="font-bold uppercase">{teamName}</span>
                        </div>
                        <span className="text-zinc-300 font-bold">
                          {answeredCount} / {teamTotalMembers} TEAMMATES ANSWERED
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── RIGHT COLUMN: PROGRESS & QUESTION INFO / TEAM CHAT ── */}
              <div className="hidden lg:flex flex-col gap-4 h-full">
                {/* Panel 3: PROGRESS */}
                <div className="bg-[#060c18]/90 backdrop-blur-md border border-[#00f0ff]/30 p-4 rounded-lg shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#14243b]">
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-[#00ffaa]" />
                      <span className="text-[#00f0ff] font-black text-xs tracking-widest uppercase font-mono">PROGRESS</span>
                    </div>
                    <CyanPulseWaveform />
                  </div>
                  <div className="font-mono">
                    <div className="text-xl sm:text-2xl font-black text-white mb-2">
                      {currentQuestionIdx + 1} / {totalQuestions}
                    </div>
                    {/* Segmented Progress Blocks */}
                    <div className="grid grid-cols-10 gap-1 my-2.5">
                      {Array.from({ length: 20 }).map((_, idx) => {
                        const activeThreshold = Math.round(((currentQuestionIdx + 1) / totalQuestions) * 20);
                        const isFilled = idx < activeThreshold;
                        return (
                          <div 
                            key={idx}
                            className={`h-3 rounded-xs transition-colors ${
                              isFilled 
                                ? 'bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.7)]' 
                                : 'bg-[#0e1826]'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase mt-1">
                      {Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)}% COMPLETE
                    </div>
                  </div>
                </div>

                {/* Panel 4: In Solo Mode -> QUESTION INFO; In Squad Mode -> Tabbed TEAM CHAT & QUESTION INFO */}
                {!isTeamsMode ? (
                  <div className="bg-[#060c18]/90 backdrop-blur-md border border-[#00f0ff]/30 p-4 rounded-lg shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#14243b]">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-[#00f0ff]" />
                        <span className="text-[#00f0ff] font-black text-xs tracking-widest uppercase font-mono">QUESTION INFO</span>
                      </div>
                      <CyanPulseWaveform />
                    </div>
                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b] tracking-wider">TYPE</span>
                        <span className="text-white font-bold">{isMultiChoice ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b] tracking-wider">POINTS</span>
                        <span className="text-white font-bold">{currentChallenge?.points || 100}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b] tracking-wider">TIME LIMIT</span>
                        <span className="text-white font-bold">{currentChallenge?.timerSecs || 30} seconds</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b] tracking-wider">CATEGORY</span>
                        <span className="text-white font-bold uppercase truncate max-w-[130px] text-right">{gameCategory}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748b] tracking-wider">DIFFICULTY</span>
                        {renderDifficultyBlocks(gameDifficulty)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col bg-[#060c18]/90 backdrop-blur-md border border-[#00f0ff]/30 rounded-lg shadow-[0_0_24px_rgba(0,0,0,0.7)] overflow-hidden min-h-[350px]">
                    {/* Squad Tab Header: TEAM CHAT & INTEL */}
                    <div className="bg-[#0b1320] border-b border-[#142338] px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSquadTab('CHAT')}
                          className={`px-2.5 py-1 text-xs font-black tracking-widest uppercase font-mono rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                            squadTab === 'CHAT' 
                              ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_8px_rgba(0,240,255,0.3)]' 
                              : 'text-[#64748b] hover:text-white'
                          }`}
                        >
                          <Users size={12} />
                          <span>TEAM CHAT</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSquadTab('INFO')}
                          className={`px-2.5 py-1 text-xs font-black tracking-widest uppercase font-mono rounded-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                            squadTab === 'INFO' 
                              ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_8px_rgba(0,240,255,0.3)]' 
                              : 'text-[#64748b] hover:text-white'
                          }`}
                        >
                          <Info size={12} />
                          <span>INTEL</span>
                        </button>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#00ffaa]">
                        ● {onlineMembersCount} ONLINE
                      </span>
                    </div>

                    {squadTab === 'CHAT' ? (
                      <>
                        {/* Chat Error alert */}
                        {chatError && (
                          <div className="bg-[#ff3366]/15 border-b border-[#ff3366]/40 px-3 py-1.5 text-[10px] text-[#ff3366] font-mono font-bold">
                            {chatError}
                          </div>
                        )}

                        {/* Chat Messages Feed */}
                        <div ref={chatScrollRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 min-h-[220px] max-h-[300px] text-xs">
                          {chatMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-[#5e6b7c] p-4">
                              <Users size={20} className="mb-2 text-[#1b2b3f]" />
                              <p className="text-xs font-bold uppercase tracking-wider">Squad Comms Uplink</p>
                              <p className="text-[11px] text-[#475569] mt-1">Chat live with your team to coordinate.</p>
                            </div>
                          ) : (
                            chatMessages.map((msg, i) => {
                              const isSelf = msg.isSelf;
                              return (
                                <div key={msg.id || i} className={`flex gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`flex flex-col max-w-[85%] ${isSelf ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-[10px] font-bold text-[#8ea4c0]">{msg.senderName}</span>
                                    </div>
                                    <div 
                                      className={`px-3 py-1.5 rounded-sm text-xs font-sans leading-relaxed ${
                                        isSelf 
                                          ? 'bg-[#182a44] text-[#e0f2fe] border border-[#0284c7]/40' 
                                          : 'bg-[#0f1929] text-zinc-100 border border-[#1b2c44]'
                                      }`}
                                    >
                                      {msg.content}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Chat Input Bar */}
                        <form onSubmit={handleSendChatMessage} className="bg-[#0b1320] border-t border-[#142338] p-2.5 flex items-center gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type a message to your team..."
                            className="flex-1 bg-[#070b14] border border-[#1b2c44] text-xs text-white px-3 py-1.5 rounded-sm focus:outline-none focus:border-[#00f0ff] font-sans"
                          />
                          <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            className="px-3 py-1.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/60 rounded-sm disabled:opacity-40 transition-colors cursor-pointer"
                          >
                            <Send size={12} />
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="p-4 space-y-3 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748b] tracking-wider">TYPE</span>
                          <span className="text-white font-bold">{isMultiChoice ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748b] tracking-wider">POINTS</span>
                          <span className="text-white font-bold">{currentChallenge?.points || 100}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748b] tracking-wider">TIME LIMIT</span>
                          <span className="text-white font-bold">{currentChallenge?.timerSecs || 30} seconds</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748b] tracking-wider">CATEGORY</span>
                          <span className="text-white font-bold uppercase truncate max-w-[130px] text-right">{gameCategory}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748b] tracking-wider">DIFFICULTY</span>
                          {renderDifficultyBlocks(gameDifficulty)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Mobile Squad Chat Drawer (< lg) */}
            {isTeamsMode && isMobileChatOpen && (
              <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-[#060c18] border-t-2 border-[#00f0ff] p-4 flex flex-col shadow-[-6px_0_24px_rgba(0,0,0,0.9)] max-h-[70vh]">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#142338]">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-[#00f0ff]" />
                    <span className="text-white font-bold text-xs uppercase font-mono">
                      TEAM CHAT // {teamName} ({onlineMembersCount} ONLINE)
                    </span>
                  </div>
                  <button 
                    onClick={() => setIsMobileChatOpen(false)}
                    className="text-[#8ea4c0] hover:text-white p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[160px] max-h-[300px] mb-3 text-xs">
                  {chatMessages.length === 0 ? (
                    <div className="py-8 text-center text-[#5e6b7c]">
                      No messages yet. Chat with your team!
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => {
                      const isSelf = msg.isSelf;
                      return (
                        <div key={msg.id || i} className={`flex gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex flex-col max-w-[85%] ${isSelf ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] font-bold text-[#8ea4c0] mb-0.5">{msg.senderName}</span>
                            <div className={`px-3 py-1.5 rounded-sm text-xs ${
                              isSelf ? 'bg-[#182a44] text-[#e0f2fe] border border-[#0284c7]/40' : 'bg-[#0f1929] text-zinc-100 border border-[#1b2c44]'
                            }`}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message to your team..."
                    className="flex-1 bg-[#070b14] border border-[#1b2c44] text-xs text-white px-3 py-2 rounded-sm focus:outline-none focus:border-[#00f0ff]"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="px-4 py-2 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/60 rounded-sm font-bold text-xs"
                  >
                    SEND
                  </button>
                </form>
              </div>
            )}
          </div>
        )}


        {/* ═════════════════════════════════════════════════════════ */}
        {/* STATE 5: FINAL RESULTS & POST-GAME REVIEW MODE             */}
        {/* ═════════════════════════════════════════════════════════ */}
        {isGameCompleted && (
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full gap-5 my-auto py-6">
            {/* Tab Switcher: Revealed Review vs Final Leaderboard */}
            {isReviewRevealed && (
              <div className="flex items-center justify-center gap-3 mb-1">
                <button
                  type="button"
                  onClick={() => setPostGameTab('REVIEW')}
                  className={`px-4 py-2 text-xs font-black rounded-sm border transition-all cursor-pointer ${
                    postGameTab === 'REVIEW'
                      ? 'bg-[#00f0ff] text-black border-[#00f0ff] shadow-[0_0_16px_rgba(0,240,255,0.4)]'
                      : 'bg-[#0b1320] text-[#8ea4c0] border-[#1b2b3f] hover:text-white'
                  }`}
                >
                  // ANSWERS & EXPLANATIONS
                </button>
                <button
                  type="button"
                  onClick={() => setPostGameTab('LEADERBOARD')}
                  className={`px-4 py-2 text-xs font-black rounded-sm border transition-all cursor-pointer ${
                    postGameTab === 'LEADERBOARD'
                      ? 'bg-[#fcce0a] text-black border-[#fcce0a] shadow-[0_0_16px_rgba(252,206,10,0.4)]'
                      : 'bg-[#0b1320] text-[#8ea4c0] border-[#1b2b3f] hover:text-white'
                  }`}
                >
                  // FINAL LEADERBOARD
                </button>
              </div>
            )}

            {isReviewRevealed && postGameTab === 'REVIEW' ? (
              /* Review Mode Screen with Student-Controlled Navigation */
              (() => {
                const totalQ = reviewQuestions.length || totalQuestions;
                const safeReviewIdx = Math.max(0, Math.min(localReviewIdx, Math.max(0, totalQ - 1)));
                const activeReviewQ = reviewQuestions[safeReviewIdx] || sessionData?.reviewChallenge;
                if (!activeReviewQ) {
                  return (
                    <div className="bg-[#080d17] border border-[#16273d] p-8 text-center text-[#8ea4c0] font-mono">
                      LOADING REVIEW QUESTION...
                    </div>
                  );
                }

                const studentSubmission = activeReviewQ.studentSubmission;
                const isAnswered = studentSubmission && studentSubmission.submittedAnswer !== null && studentSubmission.submittedAnswer !== undefined;

                return (
                  <div className="bg-[#080d17] border border-[#16273d] p-5 sm:p-7 rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.7)] flex flex-col">
                    {/* Review Header Banner: Score & Rank */}
                    <div className="bg-[#0b1320] border border-[#1b2b3f] p-3 rounded-sm mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Trophy size={14} className="text-[#fcce0a]" />
                        <span className="text-[#8ea4c0] uppercase">
                          {isTeamsMode ? 'SQUAD' : 'OPERATOR'}:
                        </span>
                        <span className="text-white font-bold">
                          {isTeamsMode ? teamName : `${currentUsername}@terminal`}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {myScore !== null && (
                          <span className="text-[#00ffcc] font-black">
                            SCORE: {Number(myScore).toFixed(1)} PTS
                          </span>
                        )}
                        {myRank !== null && (
                          <span className="text-[#fcce0a] font-black">
                            RANK: #{myRank}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question navigation tabs */}
                    {reviewQuestions.length > 1 && (
                      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-[#16273d]">
                        <button
                          type="button"
                          onClick={() => setLocalReviewIdx(idx => Math.max(0, idx - 1))}
                          disabled={safeReviewIdx === 0}
                          className="px-2.5 py-1 bg-[#0f1929] hover:bg-[#182944] text-[#8ea4c0] hover:text-white border border-[#1b2b3f] disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold rounded-sm flex items-center gap-1 cursor-pointer"
                        >
                          <ChevronLeft size={14} /> PREV
                        </button>
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-[60%] sm:max-w-[70%]">
                          {reviewQuestions.map((q, idx) => {
                            const qSub = q.studentSubmission;
                            const qAns = qSub && qSub.submittedAnswer !== null && qSub.submittedAnswer !== undefined;
                            const isCurrent = idx === safeReviewIdx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setLocalReviewIdx(idx)}
                                className={`w-7 h-7 rounded-sm text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                  isCurrent
                                    ? 'bg-[#00f0ff] text-black border border-[#00f0ff] shadow-[0_0_8px_#00f0ff]'
                                    : !qAns
                                    ? 'bg-[#1e1b18] text-[#85705d] border border-[#3b322a]'
                                    : qSub.isCorrect
                                    ? 'bg-[#00ffaa]/15 text-[#00ffaa] border border-[#00ffaa]/40'
                                    : 'bg-[#ff3366]/15 text-[#ff3366] border border-[#ff3366]/40'
                                }`}
                              >
                                {idx + 1}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setLocalReviewIdx(idx => Math.min(reviewQuestions.length - 1, idx + 1))}
                          disabled={safeReviewIdx >= reviewQuestions.length - 1}
                          className="px-2.5 py-1 bg-[#0f1929] hover:bg-[#182944] text-[#8ea4c0] hover:text-white border border-[#1b2b3f] disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold rounded-sm flex items-center gap-1 cursor-pointer"
                        >
                          NEXT <ChevronRight size={14} />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#16273d]">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-[#00ffcc]/15 text-[#00ffcc] border border-[#00ffcc]/40 text-xs font-black tracking-wider uppercase rounded-sm">
                          QUESTION {safeReviewIdx + 1} OF {totalQ}
                        </span>
                        <span className="text-[10px] text-[#6b7d96] font-bold uppercase tracking-widest">
                          {activeReviewQ.type?.replace(/_/g, ' ') || 'QUIZ QUESTION'}
                        </span>
                      </div>
                      
                      {/* Submission status badge */}
                      {!isAnswered ? (
                        <span className="px-2.5 py-1 text-xs font-black rounded-sm border uppercase font-mono bg-[#332211] border-[#fcce0a]/50 text-[#fcce0a]">
                          UNANSWERED (+0 PTS)
                        </span>
                      ) : (
                        <span className={`px-2.5 py-1 text-xs font-black rounded-sm border uppercase font-mono ${
                          studentSubmission.isCorrect
                            ? 'bg-[#00ffaa]/15 border-[#00ffaa] text-[#00ffaa]'
                            : 'bg-[#ff3366]/15 border-[#ff3366] text-[#ff3366]'
                        }`}>
                          {studentSubmission.isCorrect ? `+${activeReviewQ.points || 100} PTS (CORRECT)` : '+0 PTS (INCORRECT)'}
                        </span>
                      )}
                    </div>

                    {/* Question Prompt */}
                    {renderFormattedPrompt(activeReviewQ.prompt)}

                    {/* Options List with Highlighted Correct Answer */}
                    <div className="flex flex-col gap-2.5 mb-5">
                      {(activeReviewQ.options || []).map((opt: string, idx: number) => {
                        const letter = OPTION_LETTERS[idx] || String(idx + 1);
                        const isCorrect = Array.isArray(activeReviewQ.correctAnswer)
                          ? activeReviewQ.correctAnswer.includes(letter) || activeReviewQ.correctAnswer.includes(opt)
                          : activeReviewQ.correctAnswer === letter || activeReviewQ.correctAnswer === opt;

                        const studentAns = studentSubmission?.submittedAnswer;
                        const isStudentAns = isAnswered && (
                          Array.isArray(studentAns)
                            ? studentAns.includes(letter) || studentAns.includes(opt)
                            : studentAns === letter || studentAns === opt
                        );

                        return (
                          <div
                            key={idx}
                            className={`w-full p-3.5 rounded-sm border text-left flex items-center justify-between gap-3 ${
                              isCorrect
                                ? 'border-[#00ffaa] bg-[rgba(0,255,170,0.1)] shadow-[0_0_14px_rgba(0,255,170,0.2)]'
                                : isStudentAns
                                ? 'border-[#ff3366]/60 bg-[rgba(255,51,102,0.08)]'
                                : 'border-[#1b2b3f] bg-[#0b1320]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-sm flex items-center justify-center font-black text-xs font-mono shrink-0 ${
                                isCorrect
                                  ? 'bg-[#00ffaa] text-black font-black'
                                  : isStudentAns
                                  ? 'bg-[#ff3366] text-white font-black'
                                  : 'bg-[#152132] text-[#8ea4c0] border border-[#23354d]'
                              }`}>
                                {letter}
                              </div>
                              <span className={`text-sm font-bold ${isCorrect ? 'text-white' : 'text-[#cbd5e1]'}`}>
                                {opt}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCorrect && (
                                <span className="px-2 py-0.5 text-[9px] font-black bg-[#00ffaa]/20 text-[#00ffaa] border border-[#00ffaa] uppercase tracking-wider rounded-sm shrink-0">
                                  CORRECT ANSWER
                                </span>
                              )}
                              {isStudentAns && (
                                <span className="px-2 py-0.5 text-[9px] font-black bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8] uppercase tracking-wider rounded-sm shrink-0">
                                  YOUR CHOICE
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Official Correct Answer Card */}
                    <div className="bg-[#0b1320] border border-[#00ffaa]/50 p-4 rounded-sm mb-4">
                      <div className="text-[10px] font-bold text-[#00ffaa] tracking-widest uppercase mb-1">
                        CORRECT ANSWER
                      </div>
                      <div className="text-white font-mono font-bold text-sm sm:text-base">
                        {formatCorrectAnswer(activeReviewQ.correctAnswer, activeReviewQ.options)}
                      </div>
                    </div>

                    {/* Logic Explanation Box Below Correct Answer */}
                    {activeReviewQ.explanation && (
                      <div className="w-full bg-[#050b14] border border-[#00f0ff]/50 p-4 rounded-sm text-left shadow-[0_0_20px_rgba(0,240,255,0.15)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={14} className="text-[#00f0ff]" />
                          <span className="text-[#00f0ff] font-bold text-xs tracking-widest uppercase font-mono">
                            // LOGIC_EXPLANATION
                          </span>
                        </div>
                        <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                          {activeReviewQ.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Leaderboard (md:col-span-7) */}
              <div className="md:col-span-7 bg-[#080d17] border border-[#16273d] p-5 sm:p-6 rounded-sm shadow-[0_0_24px_rgba(0,0,0,0.6)]">
                <div className="text-center mb-5">
                  <Trophy size={36} className="text-[#fcce0a] mx-auto mb-2 drop-shadow-[0_0_12px_rgba(252,206,10,0.5)]" />
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest uppercase">
                    GAME COMPLETE!
                  </h1>
                  <p className="text-[#6b7d96] text-xs font-semibold tracking-wide">
                    {isTeamsMode ? 'Squad Leaderboard' : 'Individual Competitor Leaderboard'}
                  </p>
                </div>

                {/* Ranked rows */}
                <div className="space-y-2.5">
                  {finalLeaderboard.slice(0, 10).map((entry: any, idx: number) => {
                    const rankNum = entry.rank || idx + 1;
                    const isFirst = rankNum === 1;
                    const isSelf = isTeamsMode 
                      ? (entry.name?.toLowerCase() === teamName.toLowerCase() || entry.teamId === myTeam?.id)
                      : (entry.username?.toLowerCase() === currentUsername.toLowerCase() ||
                         entry.displayName?.toLowerCase() === currentUsername.toLowerCase() ||
                         entry.name?.toLowerCase() === currentUsername.toLowerCase());

                    const displayName = entry.name || entry.displayName || (entry.username ? `${entry.username}@terminal` : `Player ${rankNum}`);

                    return (
                      <div 
                        key={idx}
                        className={`p-3 rounded-sm border flex items-center justify-between font-mono ${
                          isFirst 
                            ? 'bg-[#1c190a] border-[#fcce0a] shadow-[0_0_12px_rgba(252,206,10,0.25)]' 
                            : isSelf
                            ? 'bg-[rgba(0,240,255,0.08)] border-[#00f0ff]'
                            : 'bg-[#0b1320] border-[#16273d]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-sm flex items-center justify-center font-black text-xs ${
                            rankNum === 1 ? 'bg-[#fcce0a] text-black' :
                            rankNum === 2 ? 'bg-[#0284c7] text-white' :
                            rankNum === 3 ? 'bg-[#9333ea] text-white' :
                            'bg-[#1e293b] text-[#94a3b8]'
                          }`}>
                            {rankNum}
                          </div>
                          <div className="flex items-center gap-2">
                            {isFirst && <Crown size={14} className="text-[#fcce0a]" />}
                            <span className={`font-bold text-sm tracking-wide ${isFirst ? 'text-[#fcce0a]' : 'text-white'}`}>
                              {displayName}
                            </span>
                          </div>
                        </div>
                        <span className={`font-black text-sm ${isFirst ? 'text-[#fcce0a]' : 'text-[#00f0ff]'}`}>
                          {Number(entry.score ?? entry.totalScore ?? 0).toFixed(1)} PTS
                        </span>
                      </div>
                    );
                  })}
                  {finalLeaderboard.length === 0 && (
                    <div className="p-4 text-center text-xs text-[#8ea4c0] font-mono">
                      No leaderboard entries recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Confetti / Congratulations Card (md:col-span-5) */}
              <div className="md:col-span-5 bg-[#080d17] border border-[#16273d] p-6 rounded-sm shadow-[0_0_24px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-[#d946ef]/15 border-2 border-[#d946ef] flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(217,70,239,0.4)]">
                  <Sparkles size={36} className="text-[#d946ef]" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-wide mb-1">
                  Great game, {isTeamsMode ? teamName : `${currentUsername}@terminal`}!
                </h3>
                <p className="text-sm font-bold text-[#00ffcc] tracking-wide mb-4">
                  {myRank ? (myRank === 1 ? 'You finished 1st place!' : `You finished #${myRank} place!`) : 'Session Complete!'}
                </p>
                <div className="text-[11px] text-[#6b7d96] font-mono">
                  Room: {code} &bull; Final Run Synced
                </div>
              </div>
            </div>
            )}

            {/* Bottom Return Button */}
            <div className="w-full text-center mt-2">
              <button
                type="button"
                onClick={() => navigate('/terminal')}
                className="w-full sm:w-auto px-8 py-3.5 bg-transparent hover:bg-[#00f0ff]/10 text-[#00f0ff] border-2 border-[#00f0ff] font-black text-xs sm:text-sm tracking-widest uppercase transition-all rounded-sm shadow-[0_0_16px_rgba(0,240,255,0.3)] cursor-pointer"
              >
                RETURN TO LOBBY
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
