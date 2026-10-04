/**
 * TERMINAL Official Sprite Animation System Types
 * 
 * Reusable sprite animation types for the official TERMINAL pixel-art sprite engine.
 */

export interface SpriteFrameRaw {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  base64?: string;
}

export interface SpriteFrame extends SpriteFrameRaw {
  /** Decoded HTMLImageElement (cached in memory) */
  image?: HTMLImageElement;
  /** Composite offscreen canvas at native 65x113 canvas size */
  compositeCanvas?: HTMLCanvasElement;
}

export type StandardAnimationName =
  | 'loading'
  | 'processing'
  | 'success'
  | 'error'
  | 'warning'
  | 'network'
  | 'reconnecting'
  | 'scanning'
  | 'glitch'
  | 'data-transfer'
  | 'data_transfer'
  | 'dataTransfer'
  | 'terminal-boot'
  | 'terminal_boot'
  | 'terminalBoot'
  | 'heartbeat'
  | 'ping'
  | 'level-up'
  | 'level_up'
  | 'levelUp'
  | 'cursor'
  | 'idle'
  | 'full_loop'
  | 'raw_sequence';

export type SpriteAnimationName = StandardAnimationName | string;

export interface SpriteAnimation {
  name: string;
  frames: SpriteFrame[];
  frameNames: string[];
  fps: number;
  loop: boolean;
  description: string;
  /** Index of iconic frame to show when prefers-reduced-motion is true */
  fallbackFrameIndex?: number;
}

export interface TerminalSpriteProps {
  /** Animation preset to play (loading, processing, success, etc.) */
  animation?: SpriteAnimationName;
  /** Alias for animation */
  state?: SpriteAnimationName;
  /** Standard display size (acts as height in pixels by default) */
  size?: number;
  /** Explicit display width (overrides size-based calculation) */
  width?: number;
  /** Explicit display height (overrides size) */
  height?: number;
  /** Configurable frames per second (defaults to animation's native fps) */
  fps?: number;
  /** Whether the animation should loop continuously (defaults to animation default) */
  loop?: boolean;
  /** Pause the animation playback */
  paused?: boolean;
  /** Callback fired when a non-looping animation reaches its final frame */
  onComplete?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Tooltip or accessible title */
  title?: string;
  /** Accessible ARIA label */
  ariaLabel?: string;
  /** Ensure pixelated nearest-neighbor rendering (defaults to true) */
  pixelated?: boolean;
  /** Optional click handler */
  onClick?: () => void;
}
