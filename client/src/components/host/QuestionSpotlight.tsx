import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Play, Lock, SkipForward, Pause, StopCircle, Trophy, Users, ShieldAlert, Sparkles, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { MOTION_TOKENS, REDUCED_MOTION_TRANSITION } from '../../styles/motion';

export interface QuestionSpotlightProps {
  isSpotlight: boolean;
  state: string; // 'LOBBY' | 'STARTING' | 'QUESTION_ACTIVE' | 'QUESTION_LOCKED' | 'QUESTION_RESULTS' | 'RESULTS' | 'ENDED'
  code: string;
  displayIdx: number;
  totalQuestions: number;
  displayChallenge: any;
  qRemaining: number | null;
  totalTimeLimit: number;
  timerPct: number;
  totalAnswers: number;
  totalParticipants: number;
  answersPct: number;
  teamsRespondedCount: number;
  totalTeams: number;
  teamsPct: number;
  isAudienceMode?: boolean;
  isStagePaused?: boolean;
  actionBusy: string | null;
  isPreviewing?: boolean;
  previewStatus?: 'LOCKED' | 'COMPLETED' | 'NOT STARTED' | null;
  onReturnToLive?: () => void;
  isReviewRevealed?: boolean;
  reviewQuestionIndex?: number;
  reviewChallenge?: any;
  onReviewNext?: () => void;
  onReviewPrev?: () => void;
  onRevealAnswers?: () => void;
  onStartGame?: () => void;
  onLockQuestion?: () => void;
  onNextQuestion?: () => void;
  onTogglePause?: () => void;
  onEndGame?: () => void;
}

const OPTION_THEMES = [
  { label: 'A', bg: '#00ffcc', border: '#00ffcc', text: 'text-black', badge: 'bg-[#00ffcc]' },
  { label: 'B', bg: '#ff007f', border: '#ff007f', text: 'text-white', badge: 'bg-[#ff007f]' },
  { label: 'C', bg: '#fcee0a', border: '#fcee0a', text: 'text-black', badge: 'bg-[#fcee0a]' },
  { label: 'D', bg: '#38bdf8', border: '#38bdf8', text: 'text-black', badge: 'bg-[#38bdf8]' },
];

export function QuestionSpotlight({
  isSpotlight,
  state,
  code,
  displayIdx,
  totalQuestions,
  displayChallenge,
  qRemaining,
  totalTimeLimit,
  timerPct,
  totalAnswers,
  totalParticipants,
  answersPct,
  teamsRespondedCount,
  totalTeams,
  teamsPct,
  isAudienceMode = false,
  isStagePaused = false,
  actionBusy,
  isPreviewing = false,
  previewStatus = null,
  onReturnToLive,
  isReviewRevealed = false,
  reviewQuestionIndex = 0,
  reviewChallenge,
  onReviewNext,
  onReviewPrev,
  onRevealAnswers,
  onStartGame,
  onLockQuestion,
  onNextQuestion,
  onTogglePause,
  onEndGame,
}: QuestionSpotlightProps) {
  const shouldReduceMotion = useReducedMotion();
  const isLobby = state === 'LOBBY' || state === 'STARTING';
  const isEnded = state === 'ENDED';
  const isLocked = state === 'QUESTION_LOCKED';
  const isResults = state === 'RESULTS' || state === 'QUESTION_RESULTS';

  // Timer color thresholds
  const timerColor = qRemaining !== null && qRemaining <= 5
    ? '#ff3366'
    : qRemaining !== null && qRemaining <= 10
    ? '#fcee0a'
    : '#00ffcc';

  const isTimerCritical = qRemaining !== null && qRemaining <= 5;

  const transitionSettings = shouldReduceMotion
    ? REDUCED_MOTION_TRANSITION
    : { duration: MOTION_TOKENS.questionTransitionDuration, ease: 'easeInOut' as const };

  const targetReviewChallenge = reviewChallenge || displayChallenge;

  return (
    <div className={`flex flex-col flex-1 w-full justify-between font-mono select-none min-h-[460px] lg:min-h-[500px] ${isSpotlight ? 'min-h-[85vh] p-2 sm:p-6' : 'p-3 md:p-5'}`}>
      {/* ── QUESTION DISPLAY CANVAS (STABLE FIXED-STAGE AREA) ── */}
      <AnimatePresence mode="wait">
        {isLobby ? (
          /* LOBBY / STANDBY SCREEN */
          <motion.div
            key="lobby-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionSettings}
            className={`flex flex-col items-center justify-center text-center my-auto min-h-[380px] ${isSpotlight ? 'py-16' : 'py-8'}`}
          >
            <div className="p-4 bg-[rgba(0,255,204,0.08)] border-2 border-[#00ffcc] shadow-[4px_4px_0_0_#000] mb-4">
              <Play size={isSpotlight ? 44 : 28} className="text-[#00ffcc]" />
            </div>
            <h1 className={`font-black uppercase tracking-tight text-white mb-2 ${isSpotlight ? 'text-4xl sm:text-6xl' : 'text-xl sm:text-2xl'}`}>
              ROOM OPEN // STANDBY
            </h1>
            <p className="text-[#8b99aa] text-xs sm:text-base max-w-lg mb-6">
              Join live tournament room on terminal with command:
            </p>
            <div className="bg-[#0a0c10] border-2 border-[#00ffcc] p-4 sm:p-6 shadow-[6px_6px_0px_#000] inline-block mb-6">
              <div className="text-[10px] sm:text-xs text-[#5e6b7c] font-black uppercase tracking-[0.25em] mb-1">
                STUDENT ROOM CODE
              </div>
              <div className={`font-black text-[#00ffcc] tracking-[0.2em] drop-shadow-[0_0_16px_rgba(0,255,204,0.4)] ${isSpotlight ? 'text-5xl sm:text-7xl' : 'text-3xl sm:text-4xl'}`}>
                {code}
              </div>
            </div>
            <div className="text-xs sm:text-sm text-[#3fb950] font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950] animate-pulse" />
              <span>{totalParticipants} PARTICIPANTS ENROLLED • {totalTeams} TEAMS READY</span>
            </div>
          </motion.div>
        ) : (isEnded || isResults) && targetReviewChallenge ? (
          /* DEDICATED REVIEW PRESENTATION (RESERVED STAGE WITH LOCKED OR REVEALED PREVIEW) */
          <motion.div
            key={`review-${targetReviewChallenge.id || reviewQuestionIndex}`}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
            transition={transitionSettings}
            className="flex flex-col flex-1 justify-between gap-4 my-auto overflow-y-auto max-h-[580px] pr-1"
          >
            {/* Review Header Badges & Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-[#121822] text-[#00ffcc] border border-[#00ffcc] font-black text-xs sm:text-sm">
                  REVIEW: QUESTION {(reviewQuestionIndex ?? 0) + 1} OF {totalQuestions}
                </span>
                {isReviewRevealed ? (
                  <span className="px-3 py-1 bg-[rgba(63,185,80,0.2)] text-[#3fb950] border border-[#3fb950] font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_0_12px_rgba(63,185,80,0.25)]">
                    <Sparkles size={13} />
                    ANSWER &amp; EXPLANATION REVEALED
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-[rgba(252,238,10,0.15)] text-[#fcee0a] border border-[#fcee0a] font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[0_0_12px_rgba(252,238,10,0.2)]">
                    <Lock size={13} className="animate-pulse" />
                    ANSWERS SEALED
                  </span>
                )}
                {targetReviewChallenge.category && (
                  <span className="px-2.5 py-1 bg-[#121822] text-[#a855f7] border border-[#a855f7] font-black text-xs">
                    {targetReviewChallenge.category}
                  </span>
                )}
              </div>

              {/* Prev / Next controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onReviewPrev}
                  disabled={!onReviewPrev || (reviewQuestionIndex ?? 0) <= 0}
                  className="px-3 py-1.5 bg-[#16202c] hover:bg-[#223042] text-white text-xs font-black border border-[#2d3848] disabled:opacity-30 cursor-pointer flex items-center gap-1 transition-colors">
                  <ChevronLeft size={13} />
                  <span>PREV</span>
                </button>
                <button
                  onClick={onReviewNext}
                  disabled={!onReviewNext || (reviewQuestionIndex ?? 0) >= totalQuestions - 1}
                  className="px-3 py-1.5 bg-[#00ffcc] hover:bg-[#33ffdd] text-black text-xs font-black border border-black disabled:opacity-30 cursor-pointer flex items-center gap-1 transition-colors">
                  <span>NEXT</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Question Prompt */}
            <div className="p-4 bg-[#0a0c10] border-2 border-[#1b2432] shadow-[3px_3px_0_0_#000]">
              <h2 className="font-mono text-base sm:text-xl font-bold text-white whitespace-pre-wrap leading-relaxed">
                {targetReviewChallenge.prompt}
              </h2>
            </div>

            {/* Options Grid (Stable spatial height) */}
            {targetReviewChallenge.options && Array.isArray(targetReviewChallenge.options) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {targetReviewChallenge.options.map((opt: string, optIdx: number) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isCorrect = isReviewRevealed && (
                    Array.isArray(targetReviewChallenge.correctAnswer)
                      ? targetReviewChallenge.correctAnswer.includes(letter) || targetReviewChallenge.correctAnswer.includes(opt)
                      : targetReviewChallenge.correctAnswer === letter || targetReviewChallenge.correctAnswer === opt
                  );

                  return (
                    <div
                      key={optIdx}
                      className={`p-3.5 sm:p-4 border-2 flex items-center justify-between gap-3 shadow-[3px_3px_0_0_#000] transition-all duration-300 ${
                        isReviewRevealed
                          ? isCorrect
                            ? 'border-[#3fb950] bg-[rgba(63,185,80,0.12)] shadow-[0_0_16px_rgba(63,185,80,0.2)]'
                            : 'border-[#1b2432] bg-[#0a0c10] opacity-60'
                          : 'border-[#1b2432] bg-[#0a0c10] text-[#cbd5e1]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-black font-mono text-xs sm:text-sm shrink-0 transition-colors ${
                            isReviewRevealed && isCorrect
                              ? 'bg-[#3fb950] text-black'
                              : 'bg-[#1b2432] text-white'
                          }`}
                        >
                          {letter}
                        </div>
                        <span className={`font-bold text-xs sm:text-base ${isReviewRevealed ? (isCorrect ? 'text-white' : 'text-[#8b99aa]') : 'text-zinc-200'}`}>
                          {opt}
                        </span>
                      </div>
                      {isReviewRevealed && isCorrect && (
                        <span className="px-2 py-0.5 bg-[#3fb950] text-black font-black text-[10px] uppercase shrink-0">
                          ✓ CORRECT
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Explanation / Solution Stage (Identical Reserved Height: Locked vs Revealed) */}
            <div className="relative min-h-[160px] flex flex-col justify-center">
              {isReviewRevealed ? (
                /* REVEALED EXPLANATION */
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitionSettings}
                  className="p-4 sm:p-5 bg-[#0d141e] border-2 border-[#00ffcc] shadow-[4px_4px_0_0_#000] text-left w-full"
                >
                  <div className="flex items-center gap-2 mb-2 text-[#00ffcc] text-xs font-black tracking-widest uppercase">
                    <Sparkles size={14} />
                    <span>// EXPLANATION &amp; LOGIC WALKTHROUGH:</span>
                  </div>
                  <p className="text-white text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap">
                    {targetReviewChallenge.explanation || 'No detailed walkthrough provided for this challenge.'}
                  </p>
                </motion.div>
              ) : (
                /* DELIBERATE LOCKED PREVIEW (STABLE SPATIAL RESERVATION) */
                <div className="relative overflow-hidden p-5 sm:p-6 bg-[#0a0e17] border-2 border-[#fcee0a]/40 shadow-[4px_4px_0_0_#000] flex flex-col items-center justify-center text-center w-full min-h-[160px]">
                  {/* Blurred / Obscured Preview Backdrop */}
                  <div className="absolute inset-0 p-4 select-none pointer-events-none filter blur-[5px] opacity-25 flex flex-col gap-2.5 overflow-hidden">
                    <div className="h-4 bg-cyan-400/50 rounded w-1/3" />
                    <div className="h-3 bg-zinc-300/40 rounded w-full" />
                    <div className="h-3 bg-zinc-300/40 rounded w-5/6" />
                    <div className="h-3 bg-zinc-300/40 rounded w-4/6" />
                    <div className="h-4 bg-emerald-400/50 rounded w-1/4 mt-1" />
                  </div>

                  {/* High-Impact Cyber Lock Overlay */}
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2.5 max-w-lg">
                    <div className="w-10 h-10 rounded-full bg-[#1c1808] border border-[#fcee0a] flex items-center justify-center text-[#fcee0a] shadow-[0_0_16px_rgba(252,238,10,0.35)]">
                      <Lock size={18} className="animate-pulse" />
                    </div>
                    <span className="font-black text-xs sm:text-sm text-white tracking-widest uppercase font-mono">
                      ANSWERS SEALED — WAITING FOR GM REVEAL
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#8b99aa] leading-relaxed">
                      Correct answer keys and explanation walkthroughs remain cryptographically sealed until explicit Game Master release.
                    </span>
                    {onRevealAnswers && !isAudienceMode && (
                      <button
                        onClick={onRevealAnswers}
                        className="mt-1 px-4 py-2 bg-[#fcee0a] hover:bg-[#fff033] text-black font-black text-xs border border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Eye size={13} />
                        <span>REVEAL ANSWERS &amp; EXPLANATIONS</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : isEnded ? (
          /* FALLBACK TOURNAMENT COMPLETE SCREEN */
          <motion.div
            key="ended-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionSettings}
            className={`flex flex-col items-center justify-center text-center my-auto min-h-[380px] ${isSpotlight ? 'py-16' : 'py-8'}`}
          >
            <div className="p-4 bg-[rgba(252,238,10,0.1)] border-2 border-[#fcee0a] shadow-[4px_4px_0_0_#000] mb-4">
              <Trophy size={isSpotlight ? 48 : 32} className="text-[#fcee0a]" />
            </div>
            <h1 className={`font-black uppercase tracking-tight text-white mb-2 ${isSpotlight ? 'text-4xl sm:text-6xl' : 'text-xl sm:text-2xl'}`}>
              TOURNAMENT COMPLETE
            </h1>
            <p className="text-[#8b99aa] text-xs sm:text-base max-w-lg mb-4">
              All challenges finalized. Check final rankings on the esports leaderboard.
            </p>
            {onRevealAnswers && !isReviewRevealed && (
              <button
                onClick={onRevealAnswers}
                className="mt-3 px-5 py-2.5 bg-[#fcee0a] hover:bg-[#fff033] text-black font-black text-xs sm:text-sm border-2 border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer flex items-center gap-2">
                <Eye size={15} />
                <span>REVEAL ANSWERS &amp; EXPLANATIONS</span>
              </button>
            )}
          </motion.div>
        ) : displayChallenge ? (
          /* ACTIVE / LOCKED QUESTION PRESENTATION */
          <motion.div
            key={`question-${displayChallenge.id || displayIdx}`}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            transition={transitionSettings}
            className="flex flex-col flex-1 justify-between gap-5 my-auto"
          >
            {/* Top Prompt Section + Prominent Countdown Ring */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                {/* Meta Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-2.5 py-1 bg-[#121822] text-[#00ffcc] border border-[#00ffcc] font-black ${isSpotlight ? 'text-xs' : 'text-[10px]'}`}>
                    QUESTION {displayIdx + 1} OF {totalQuestions}
                  </span>
                  <span className={`px-2.5 py-1 bg-[#121822] text-[#38bdf8] border border-[#38bdf8] font-black uppercase ${isSpotlight ? 'text-xs' : 'text-[10px]'}`}>
                    {displayChallenge.type?.replace(/_/g, ' ') || 'MULTIPLE CHOICE'}
                  </span>
                  <span className={`px-2.5 py-1 bg-[#121822] text-[#fcee0a] border border-[#fcee0a] font-black ${isSpotlight ? 'text-xs' : 'text-[10px]'}`}>
                    {displayChallenge.points || 10} PTS
                  </span>
                  {displayChallenge.category && (
                    <span className={`px-2.5 py-1 bg-[#121822] text-[#a855f7] border border-[#a855f7] font-black uppercase ${isSpotlight ? 'text-xs' : 'text-[10px]'}`}>
                      {displayChallenge.category}
                    </span>
                  )}
                  {isLocked && !isPreviewing && (
                    <span className="px-2.5 py-1 bg-[rgba(255,51,102,0.2)] text-[#ff3366] border border-[#ff3366] font-black flex items-center gap-1 text-xs">
                      <Lock size={12} /> QUESTION LOCKED
                    </span>
                  )}
                  {isPreviewing && (
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-[rgba(252,238,10,0.2)] text-[#fcee0a] border border-[#fcee0a] font-black text-xs">
                        {previewStatus || 'PREVIEW'}
                      </span>
                      {onReturnToLive && (
                        <button
                          type="button"
                          onClick={onReturnToLive}
                          className="px-2.5 py-1 bg-[#00ffcc] text-black font-black text-xs hover:bg-[#33ffdd] transition-colors cursor-pointer"
                        >
                          RETURN TO LIVE
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Question Prompt Text (Responsive 40-64px scale on projector) */}
                <h2
                  className={`font-black text-white font-mono tracking-tight leading-snug break-words ${
                    isSpotlight
                      ? 'text-[clamp(1.75rem,3.2vw,3.75rem)] drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] my-2'
                      : 'text-lg sm:text-2xl'
                  }`}
                >
                  {displayChallenge.prompt || 'Ready for challenge...'}
                </h2>
              </div>

              {/* Prominent Radial Countdown Ring */}
              <div className="shrink-0 flex items-center justify-center self-center lg:self-auto">
                <div className={`relative flex items-center justify-center ${isSpotlight ? 'w-36 h-36 sm:w-44 sm:h-44' : 'w-24 h-24'}`}>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Track */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#1b2432"
                      strokeWidth={isSpotlight ? '7' : '8'}
                      fill="transparent"
                      strokeDasharray="4 3"
                    />
                    {/* Active Timer Arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke={isPreviewing ? '#5e6b7c' : timerColor}
                      strokeWidth={isSpotlight ? '7' : '8'}
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={isPreviewing ? 0 : 2 * Math.PI * 40 * (1 - timerPct)}
                      strokeLinecap="square"
                      className="transition-all duration-200"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span
                      className={`font-black font-mono leading-none ${
                        isPreviewing
                          ? (isSpotlight ? 'text-lg sm:text-2xl' : 'text-xs sm:text-sm')
                          : (isSpotlight ? 'text-3xl sm:text-5xl' : 'text-xl')
                      } ${isTimerCritical && !isPreviewing ? 'animate-pulse' : ''}`}
                      style={{ color: isPreviewing ? '#8b99aa' : timerColor }}
                    >
                      {isPreviewing
                        ? (previewStatus || 'PREVIEW')
                        : (qRemaining !== null ? `${qRemaining}s` : '—')}
                    </span>
                    <span className="text-[8px] sm:text-[9px] text-[#5e6b7c] font-black uppercase mt-1">
                      {isPreviewing ? 'PREVIEW' : isLocked ? 'TIME UP' : 'REMAINING'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Answer Choices Grid (2×2 layout on projector) */}
            {displayChallenge.options && Array.isArray(displayChallenge.options) && displayChallenge.options.length > 0 && (
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 my-2 ${isSpotlight ? 'max-w-6xl' : ''}`}>
                {displayChallenge.options.map((opt: string, optIdx: number) => {
                  const theme = OPTION_THEMES[optIdx % OPTION_THEMES.length];
                  return (
                    <div
                      key={optIdx}
                      className={`p-3.5 sm:p-5 bg-[#0a0c10] border-2 flex items-center gap-3 sm:gap-4 shadow-[4px_4px_0_0_#000] transition-transform ${
                        isSpotlight ? 'border-[var(--term-border-muted)] hover:border-[#00ffcc]' : 'border-[#1b2432]'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center font-black shrink-0 font-mono shadow-[2px_2px_0_0_#000] ${
                          isSpotlight ? 'w-10 h-10 sm:w-14 sm:h-14 text-xl sm:text-2xl' : 'w-7 h-7 text-xs'
                        } ${theme.badge} ${theme.text}`}
                      >
                        {theme.label}
                      </div>
                      <span className={`font-bold text-white leading-snug break-words ${isSpotlight ? 'text-lg sm:text-2xl' : 'text-xs sm:text-sm'}`}>
                        {opt}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Submission Progress Ticker */}
            <div className="pt-3 border-t border-[#1b2432] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#8b99aa]">
                    <Users size={12} className="text-[#00ffcc]" />
                    <span>Answers submitted</span>
                  </div>
                  <span className="font-bold text-white font-mono">
                    {totalAnswers} / {totalParticipants} ({answersPct}%)
                  </span>
                </div>
                <div className="w-full bg-[#0a0c10] h-2.5 border border-[#1b2432]">
                  <div
                    className="bg-[#00ffcc] h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, answersPct))}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#8b99aa]">
                    <Users size={12} className="text-[#a855f7]" />
                    <span>Teams responded</span>
                  </div>
                  <span className="font-bold text-white font-mono">
                    {teamsRespondedCount} / {totalTeams || 1} ({teamsPct}%)
                  </span>
                </div>
                <div className="w-full bg-[#0a0c10] h-2.5 border border-[#1b2432]">
                  <div
                    className="bg-[#a855f7] h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, teamsPct))}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="py-12 text-center text-[#5e6b7c]">
            STANDBY FOR QUESTION PAYLOAD...
          </div>
        )}
      </AnimatePresence>

      {/* ── COMPACT GM-ONLY CONTROLS BAR (Hidden in Audience Mode) ── */}
      {isSpotlight && !isAudienceMode && (
        <div className="mt-4 pt-3 border-t-2 border-[#16202c] bg-[#0a0c10] p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-[2px_2px_0_0_#000]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#5e6b7c] font-black uppercase tracking-wider">
              GM ACTIONS:
            </span>

            {/* Lock Question */}
            {state === 'QUESTION_ACTIVE' && onLockQuestion && (
              <button
                onClick={onLockQuestion}
                disabled={!!actionBusy}
                className="px-3 py-1.5 bg-[#fcee0a] hover:bg-[#fff033] text-black font-black text-xs border border-black transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Lock size={12} />
                <span>{actionBusy === 'lock' ? 'LOCKING...' : 'LOCK QUESTION'}</span>
              </button>
            )}

            {/* Advance / Next Question */}
            {(state === 'QUESTION_ACTIVE' || state === 'QUESTION_LOCKED' || state === 'QUESTION_RESULTS') && onNextQuestion && (
              <button
                onClick={onNextQuestion}
                disabled={!!actionBusy}
                className="px-3 py-1.5 bg-[#00ffcc] hover:bg-[#33ffdd] text-black font-black text-xs border border-black transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <SkipForward size={12} fill="currentColor" />
                <span>{actionBusy === 'next' ? 'ADVANCING...' : 'NEXT QUESTION'}</span>
              </button>
            )}

            {/* Pause / Resume */}
            {onTogglePause && !isLobby && !isEnded && (
              <button
                onClick={onTogglePause}
                disabled={!!actionBusy}
                className="px-3 py-1.5 bg-[#161c24] text-[#a855f7] border border-[#a855f7] hover:bg-[rgba(168,85,247,0.15)] font-black text-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Pause size={12} />
                <span>{isStagePaused ? 'RESUME' : 'PAUSE'}</span>
              </button>
            )}

            {/* End Game */}
            {onEndGame && !isLobby && !isEnded && (
              <button
                onClick={onEndGame}
                disabled={!!actionBusy}
                className="px-3 py-1.5 bg-transparent text-[#ff3366] border border-[#ff3366] hover:bg-[rgba(255,51,102,0.15)] font-black text-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <StopCircle size={12} />
                <span>END GAME</span>
              </button>
            )}
          </div>

          <div className="text-[10px] text-[#5e6b7c]">
            AUDIENCE SAFE: ANSWER KEYS MASKED UNTIL REVEAL
          </div>
        </div>
      )}
    </div>
  );
}
