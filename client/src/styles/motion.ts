/**
 * TERMINAL Motion Tokens & Presets
 * Consistent esports and cybercore animation timings
 */

export const MOTION_TOKENS = {
  // Maximize / Expand
  expandDuration: 0.52,
  expandSpring: {
    type: 'spring' as const,
    stiffness: 280,
    damping: 26,
    mass: 0.9,
  },

  // Minimize / Restore
  minimizeDuration: 0.4,
  minimizeEase: [0.22, 1, 0.36, 1] as const,

  // Leaderboard Row Reorder
  leaderboardReorderSpring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 28,
    mass: 0.8,
  },

  // Score Count-up & Delta Chip
  scoreDeltaDuration: 0.65,
  scoreDeltaEase: [0.16, 1, 0.3, 1] as const,

  // Question Transition Glitch / Wipe
  questionTransitionDuration: 0.32,

  // Banner / Toast
  toastEntryDuration: 0.28,
  toastExitDuration: 0.18,
};

export const REDUCED_MOTION_TRANSITION = {
  duration: 0.08,
  ease: 'linear' as const,
};
