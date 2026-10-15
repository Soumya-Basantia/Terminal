import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Maximize2, Minimize2, Monitor, Eye, EyeOff, Radio } from 'lucide-react';
import { MOTION_TOKENS, REDUCED_MOTION_TRANSITION } from '../../styles/motion';

export type SpotlightModuleId = 'question' | 'leaderboard' | 'teams-progress' | 'session-stats' | 'recent-activity';

export interface SpotlightModuleConfig {
  id: SpotlightModuleId;
  label: string;
  keyHint: string;
}

export const ALL_SPOTLIGHT_MODULES: SpotlightModuleConfig[] = [
  { id: 'question', label: 'QUESTION', keyHint: 'Q' },
  { id: 'leaderboard', label: 'LEADERBOARD', keyHint: 'L' },
  { id: 'teams-progress', label: 'PROGRESS', keyHint: 'T' },
  { id: 'session-stats', label: 'STATS', keyHint: 'S' },
  { id: 'recent-activity', label: 'ACTIVITY', keyHint: 'A' },
];

export interface SpotlightModuleProps {
  id: SpotlightModuleId;
  title: string;
  icon: React.ReactNode;
  activeSpotlightId: SpotlightModuleId | null;
  onExpand: (id: SpotlightModuleId) => void;
  onMinimize: () => void;
  onDirectSwitch?: (targetId: SpotlightModuleId) => void;
  headerBadge?: React.ReactNode;
  headerControls?: React.ReactNode;
  children: React.ReactNode | ((isSpotlight: boolean) => React.ReactNode);
  className?: string;
  spotlightClassName?: string;
  isAudienceMode?: boolean;
  onToggleAudienceMode?: () => void;
}

export function SpotlightModule({
  id,
  title,
  icon,
  activeSpotlightId,
  onExpand,
  onMinimize,
  onDirectSwitch,
  headerBadge,
  headerControls,
  children,
  className = '',
  spotlightClassName = '',
  isAudienceMode = false,
  onToggleAudienceMode,
}: SpotlightModuleProps) {
  const isSpotlight = activeSpotlightId === id;
  const shouldReduceMotion = useReducedMotion();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync browser fullscreen status
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback silently if browser policy blocks Fullscreen API
    }
  };

  const currentModuleConfig = ALL_SPOTLIGHT_MODULES.find(m => m.id === id);
  const shortcutHint = currentModuleConfig?.keyHint || '';

  // Content render
  const renderedContent = typeof children === 'function' ? children(isSpotlight) : children;

  const transitionSettings = shouldReduceMotion
    ? REDUCED_MOTION_TRANSITION
    : MOTION_TOKENS.expandSpring;

  return (
    <>
      {/* ── NORMAL DASHBOARD PANEL ── */}
      <div
        className={`bg-[#0f141c] border border-[#1b2432] shadow-[3px_3px_0px_#000] flex flex-col relative transition-opacity duration-200 ${
          isSpotlight ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${className}`}
        data-testid={`module-${id}`}
      >
        {/* Module Header */}
        <div className="bg-[#121822] border-b border-[#1b2432] px-3.5 py-2 flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#00ffcc] shrink-0">{icon}</span>
            <span className="text-[#00ffcc] text-[10px] font-black tracking-[0.25em] uppercase truncate">
              &gt;_ {title}
            </span>
            {headerBadge}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerControls}

            {/* Expand / Maximize Button */}
            <button
              onClick={() => onExpand(id)}
              title={`Expand to Projector Spotlight [${shortcutHint}]`}
              aria-label={`Expand ${title} to projector spotlight (Shortcut: ${shortcutHint})`}
              className="p-1 text-[#8b99aa] hover:text-[#00ffcc] hover:bg-[#1b2432] border border-transparent hover:border-[#2d3848] transition-all cursor-pointer flex items-center gap-1 text-[10px] font-mono"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline text-[9px] text-[#5e6b7c]">[{shortcutHint}]</span>
            </button>
          </div>
        </div>

        {/* Module Body (Rendered in dashboard) */}
        {!isSpotlight && renderedContent}
      </div>

      {/* ── FULLSCREEN PROJECTOR SPOTLIGHT OVERLAY ── */}
      <AnimatePresence>
        {isSpotlight && (
          <motion.div
            key={`spotlight-${id}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${title} Spotlight Presentation`}
            className={`fixed inset-0 z-50 p-3 sm:p-5 md:p-8 bg-[#050608]/96 backdrop-blur-xl flex flex-col overflow-hidden font-mono select-none ${spotlightClassName}`}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={transitionSettings}
            data-testid={`spotlight-active-${id}`}
          >
            {/* Cyberpunk Grid Background */}
            <div
              className="absolute inset-0 pointer-events-none -z-10"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(0,255,204,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,204,0.03) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />

            {/* Neon Border Accent Sweep */}
            <div className="absolute inset-0 pointer-events-none border-2 border-[#00ffcc] shadow-[inset_0_0_24px_rgba(0,255,204,0.12),0_0_24px_rgba(0,255,204,0.15)]" />
            
            {/* Corner Bracket Accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white pointer-events-none" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white pointer-events-none" />

            {/* ── SPOTLIGHT CONTROL BAR ── */}
            <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 bg-[#0a0c10] border-2 border-[#16202c] p-2.5 sm:p-3 mb-3 sm:mb-5 shadow-[4px_4px_0_0_#000]">
              {/* Left: Module Identity & Live Indicator */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#00ffcc] flex items-center justify-center text-black font-black border border-black shadow-[2px_2px_0_0_#000]">
                  {icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm sm:text-base font-black tracking-wider uppercase">
                      {title}
                    </span>
                    <span className="px-1.5 py-0.5 bg-[rgba(0,255,204,0.15)] text-[#00ffcc] border border-[#00ffcc] text-[9px] font-black uppercase">
                      PROJECTOR SPOTLIGHT
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#8b99aa]">
                    <span className="flex items-center gap-1 text-[#3fb950] font-bold">
                      <Radio size={10} className="animate-pulse" /> LIVE TELEMETRY
                    </span>
                    <span>•</span>
                    <span className="text-[#5e6b7c]">PRESS [ESC] TO RESTORE DASHBOARD</span>
                  </div>
                </div>
              </div>

              {/* Center: Direct Module Switcher Pills */}
              <nav aria-label="Spotlight Module Navigation" className="hidden lg:flex items-center gap-1 bg-[#0f141c] p-1 border border-[#2d3848]">
                {ALL_SPOTLIGHT_MODULES.map(m => {
                  const isActive = m.id === id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => onDirectSwitch ? onDirectSwitch(m.id) : onExpand(m.id)}
                      className={`px-2.5 py-1 text-[10px] font-black tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                        isActive
                          ? 'bg-[#00ffcc] text-black shadow-[2px_2px_0_0_#000]'
                          : 'text-[#8b99aa] hover:text-white hover:bg-[#161c24]'
                      }`}
                    >
                      <span className={isActive ? 'text-black' : 'text-[#00ffcc]'}>[{m.keyHint}]</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Right: Stage Controls (Audience Preview, Browser Fullscreen, Close/Minimize) */}
              <div className="flex items-center gap-2">
                {/* Audience Mode Toggle */}
                {onToggleAudienceMode && (
                  <button
                    onClick={onToggleAudienceMode}
                    title={isAudienceMode ? 'Disable Audience Privacy (Show GM controls)' : 'Enable Audience Mode (Hide GM controls for student projector)'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black border transition-all cursor-pointer ${
                      isAudienceMode
                        ? 'bg-[rgba(252,238,10,0.2)] text-[#fcee0a] border-[#fcee0a]'
                        : 'bg-[#0f141c] text-[#8b99aa] hover:text-white border-[#2d3848]'
                    }`}
                  >
                    {isAudienceMode ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span className="hidden sm:inline">{isAudienceMode ? 'AUDIENCE SAFE [ON]' : 'AUDIENCE VIEW'}</span>
                  </button>
                )}

                {/* Browser Fullscreen API Toggle */}
                <button
                  onClick={toggleBrowserFullscreen}
                  title="Toggle Browser Fullscreen Mode [F]"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0f141c] hover:bg-[#161c24] text-[#8b99aa] hover:text-[#00ffcc] border border-[#2d3848] text-[10px] font-black transition-all cursor-pointer"
                >
                  <Monitor size={13} />
                  <span className="hidden md:inline">{isFullscreen ? 'EXIT FS' : 'FULLSCREEN [F]'}</span>
                </button>

                {/* Minimize / Restore Dashboard */}
                <button
                  onClick={onMinimize}
                  title="Minimize back to dashboard [ESC]"
                  aria-label="Minimize back to host dashboard (Escape)"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ff3366] hover:bg-[#ff1a53] text-white border-2 border-black shadow-[2px_2px_0_0_#000] text-xs font-black transition-all cursor-pointer"
                >
                  <Minimize2 size={14} />
                  <span>[ESC] MINIMIZE</span>
                </button>
              </div>
            </header>

            {/* ── SPOTLIGHT CONTENT CANVAS ── */}
            <main className="relative z-10 flex-1 overflow-y-auto flex flex-col">
              {renderedContent}
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
