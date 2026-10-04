/**
 * TERMINAL Official Sprite Registry & Loader
 *
 * Source of Truth: client/src/assets/spritesheet.json
 * Preserves the original sprite artwork, offsets, and embedded Base64 PNG data.
 */

import rawSheetData from '../../../assets/spritesheet.json';
import type {
  SpriteFrame,
  SpriteFrameRaw,
  SpriteAnimation,
  SpriteAnimationName,
} from './spriteTypes';

/** Native composite canvas bounds across all sprite frames */
export const CANVAS_WIDTH = 65;
export const CANVAS_HEIGHT = 113;
export const SPRITE_COLUMNS = (rawSheetData as any).columns ?? 8;

/** Raw sprite list filtered for active artwork (excluding empty placeholders) */
const rawSprites: SpriteFrameRaw[] = (
  (rawSheetData as any).layers?.[0]?.sprites ?? []
).filter((s: any) => s && s.base64 && s.base64.length > 50 && s.width > 0 && s.height > 0);

/** In-memory frame dictionary keyed by name and by ID */
export const SPRITE_FRAMES: Map<string, SpriteFrame> = new Map();

/** Decoded Image Cache (Singleton across app lifecycle) */
const imageCache: Map<string, HTMLImageElement> = new Map();

/** Pre-rendered 65x113 Offscreen Canvas Cache for 1-blit zero-allocation renders */
const compositeCanvasCache: Map<string, HTMLCanvasElement> = new Map();

// Populate frame registry
for (const s of rawSprites) {
  const frame: SpriteFrame = {
    id: s.id,
    name: s.name,
    width: s.width,
    height: s.height,
    x: s.x,
    y: s.y,
    rotation: s.rotation ?? 0,
    flipX: s.flipX ?? false,
    flipY: s.flipY ?? false,
    base64: s.base64,
  };
  SPRITE_FRAMES.set(s.name, frame);
  SPRITE_FRAMES.set(s.id, frame);
}

/**
 * Decode and retrieve the cached HTMLImageElement for a sprite frame.
 * Converts embedded Base64 data into an Image source without modifying original artwork.
 */
export function getCachedSpriteImage(frameKey: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;

  if (imageCache.has(frameKey)) {
    return imageCache.get(frameKey)!;
  }

  const frame = SPRITE_FRAMES.get(frameKey);
  if (!frame || !frame.base64) return null;

  const img = new Image();
  img.src = frame.base64;
  imageCache.set(frameKey, img);
  if (frame.name && frame.name !== frameKey) {
    imageCache.set(frame.name, img);
  }
  if (frame.id && frame.id !== frameKey) {
    imageCache.set(frame.id, img);
  }

  // Pre-render composite canvas once the image loads
  img.onload = () => {
    frame.image = img;
    createCompositeCanvas(frame, img);
  };

  return img;
}

/**
 * Pre-render an offscreen 65x113 canvas where the sprite is drawn at its exact (x, y) offset.
 * Allows lightning-fast 1-blit rendering onto the active canvas.
 */
function createCompositeCanvas(frame: SpriteFrame, img: HTMLImageElement): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height);

    frame.compositeCanvas = offscreen;
    compositeCanvasCache.set(frame.name, offscreen);
    compositeCanvasCache.set(frame.id, offscreen);
    return offscreen;
  } catch {
    return null;
  }
}

/**
 * Retrieve the pre-rendered composite canvas for a frame, or create it if image is already loaded.
 */
export function getPreRenderedFrame(frameKey: string): HTMLCanvasElement | null {
  if (compositeCanvasCache.has(frameKey)) {
    return compositeCanvasCache.get(frameKey)!;
  }

  const frame = SPRITE_FRAMES.get(frameKey);
  if (!frame) return null;

  const img = getCachedSpriteImage(frameKey);
  if (img && img.complete && img.naturalWidth > 0) {
    return createCompositeCanvas(frame, img);
  }

  return null;
}

/** Eagerly pre-load and decode all sprite frames */
export function preloadAllSprites(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  const promises: Promise<void>[] = [];

  for (const [, frame] of SPRITE_FRAMES.entries()) {
    if (imageCache.has(frame.name)) continue;

    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        frame.image = img;
        createCompositeCanvas(frame, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = frame.base64!;
      imageCache.set(frame.name, img);
      imageCache.set(frame.id, img);
    });
    promises.push(promise);
  }

  return Promise.all(promises).then(() => undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION PRESETS
// ─────────────────────────────────────────────────────────────────────────────

interface PresetConfig {
  frameNames: string[];
  fps: number;
  loop: boolean;
  description: string;
  fallbackFrameIndex?: number;
}

const PRESET_DEFINITIONS: Record<string, PresetConfig> = {
  // 1. Loading: focus and readiness cycle
  loading: {
    frameNames: ['sprite_12.png', 'sprite_11.png', 'sprite_10.png', 'sprite_11.png'],
    fps: 7,
    loop: true,
    description: 'Pulsing stance during data acquisition',
    fallbackFrameIndex: 0,
  },

  // 2. Processing: active command execution
  processing: {
    frameNames: ['sprite_4.png', 'sprite_5.png', 'sprite_6.png', 'sprite_5.png'],
    fps: 9,
    loop: true,
    description: 'Dynamic execution phase',
    fallbackFrameIndex: 1,
  },

  // 3. Success: triumphant leap and victory pose
  success: {
    frameNames: ['sprite_12.png', 'sprite_2.png', 'sprite_3.png'],
    fps: 8,
    loop: false,
    description: 'Triumphant strike on operation completion',
    fallbackFrameIndex: 2,
  },

  // 4. Error: downward impact and recovery
  error: {
    frameNames: ['sprite_6.png', 'sprite_7.png', 'sprite_8.png', 'sprite_9.png', 'sprite_10.png', 'sprite_11.png'],
    fps: 9,
    loop: false,
    description: 'Impact absorption upon failure',
    fallbackFrameIndex: 5,
  },

  // 5. Warning: guarded alert stance
  warning: {
    frameNames: ['sprite_11.png', 'sprite_10.png', 'sprite_11.png', 'sprite_12.png'],
    fps: 6,
    loop: true,
    description: 'Alert stance on non-fatal condition',
    fallbackFrameIndex: 0,
  },

  // 6. Network: communication beacon
  network: {
    frameNames: ['sprite_3.png', 'sprite_4.png', 'sprite_3.png', 'sprite_2.png'],
    fps: 7,
    loop: true,
    description: 'Network communication activity',
    fallbackFrameIndex: 0,
  },

  // 7. Reconnecting: rising recovery
  reconnecting: {
    frameNames: ['sprite_11.png', 'sprite_10.png', 'sprite_9.png', 'sprite_8.png', 'sprite_7.png', 'sprite_12.png'],
    fps: 8,
    loop: true,
    description: 'Reconnection recovery cycle',
    fallbackFrameIndex: 0,
  },

  // 8. Scanning: panoramic mid-air scan
  scanning: {
    frameNames: ['sprite_4.png', 'sprite_3.png', 'sprite_4.png', 'sprite_5.png'],
    fps: 6,
    loop: true,
    description: 'Scanning environmental matrix',
    fallbackFrameIndex: 0,
  },

  // 9. Glitch: rapid matrix stutter
  glitch: {
    frameNames: ['sprite_2.png', 'sprite_12.png', 'sprite_6.png', 'sprite_3.png', 'sprite_10.png'],
    fps: 14,
    loop: true,
    description: 'Signal interference glitch cycle',
    fallbackFrameIndex: 0,
  },

  // 10. Data Transfer: projectile flow
  data_transfer: {
    frameNames: ['sprite_5.png', 'sprite_6.png', 'sprite_4.png', 'sprite_5.png'],
    fps: 10,
    loop: true,
    description: 'High-throughput data packet transit',
    fallbackFrameIndex: 1,
  },

  // 11. Terminal Boot: grand initialization sequence
  terminal_boot: {
    frameNames: [
      'sprite_12.png',
      'sprite_2.png',
      'sprite_3.png',
      'sprite_4.png',
      'sprite_5.png',
      'sprite_6.png',
      'sprite_7.png',
      'sprite_8.png',
      'sprite_9.png',
      'sprite_10.png',
      'sprite_11.png',
      'sprite_12.png',
    ],
    fps: 9,
    loop: false,
    description: 'Full startup sequence to combat-ready stance',
    fallbackFrameIndex: 0,
  },

  // 12. Heartbeat: subtle idling breath
  heartbeat: {
    frameNames: ['sprite_12.png', 'sprite_11.png', 'sprite_12.png'],
    fps: 4,
    loop: true,
    description: 'Idle system vitality pulse',
    fallbackFrameIndex: 0,
  },

  // 13. Ping: quick echo blip
  ping: {
    frameNames: ['sprite_12.png', 'sprite_2.png', 'sprite_3.png', 'sprite_12.png'],
    fps: 12,
    loop: false,
    description: 'Network echo response',
    fallbackFrameIndex: 0,
  },

  // 14. Level Up: celebratory leap
  level_up: {
    frameNames: ['sprite_12.png', 'sprite_2.png', 'sprite_3.png'],
    fps: 8,
    loop: false,
    description: 'Celebratory power surge',
    fallbackFrameIndex: 2,
  },

  // 15. Cursor: micro typing cadence
  cursor: {
    frameNames: ['sprite_12.png', 'sprite_11.png'],
    fps: 4,
    loop: true,
    description: 'Micro terminal typing rhythm',
    fallbackFrameIndex: 0,
  },

  // 16. Idle: stationary ready pose
  idle: {
    frameNames: ['sprite_12.png'],
    fps: 1,
    loop: true,
    description: 'Ready combat stance',
    fallbackFrameIndex: 0,
  },

  // 17. Full Loop: complete chronological 11-frame cycle
  full_loop: {
    frameNames: [
      'sprite_12.png',
      'sprite_2.png',
      'sprite_3.png',
      'sprite_4.png',
      'sprite_5.png',
      'sprite_6.png',
      'sprite_7.png',
      'sprite_8.png',
      'sprite_9.png',
      'sprite_10.png',
      'sprite_11.png',
    ],
    fps: 9,
    loop: true,
    description: 'All 11 unique sprite frames in sequence',
    fallbackFrameIndex: 0,
  },

  // 18. Raw sequence: original JSON layer order
  raw_sequence: {
    frameNames: rawSprites.map((s) => s.name),
    fps: 8,
    loop: true,
    description: 'Raw sequence from spritesheet JSON',
    fallbackFrameIndex: 0,
  },
};

/** Normalize animation name lookup (handles kebab-case, snake_case, camelCase) */
export function normalizeAnimationName(name: string): string {
  const lower = (name || '').toLowerCase().trim();
  switch (lower) {
    case 'data-transfer':
    case 'datatransfer':
    case 'data_transfer':
    case 'transfer':
      return 'data_transfer';
    case 'terminal-boot':
    case 'terminalboot':
    case 'terminal_boot':
    case 'boot':
      return 'terminal_boot';
    case 'level-up':
    case 'levelup':
    case 'level_up':
      return 'level_up';
    case 'full':
    case 'full_sequence':
    case 'full-sequence':
    case 'fullloop':
    case 'full-loop':
      return 'full_loop';
    case 'raw':
      return 'raw_sequence';
    default:
      return lower;
  }
}

/** Get the compiled SpriteAnimation for a requested name */
export function getSpriteAnimation(name: SpriteAnimationName): SpriteAnimation {
  const normalized = normalizeAnimationName(name);
  const preset = PRESET_DEFINITIONS[normalized] || PRESET_DEFINITIONS.loading;

  const frames: SpriteFrame[] = [];
  for (const fName of preset.frameNames) {
    const f = SPRITE_FRAMES.get(fName);
    if (f) frames.push(f);
  }

  // Fallback to first available frame if preset frames are missing
  if (frames.length === 0 && rawSprites.length > 0) {
    const fallback = SPRITE_FRAMES.get(rawSprites[0].name);
    if (fallback) frames.push(fallback);
  }

  return {
    name: normalized,
    frames,
    frameNames: preset.frameNames,
    fps: preset.fps,
    loop: preset.loop,
    description: preset.description,
    fallbackFrameIndex: preset.fallbackFrameIndex ?? 0,
  };
}

/** Return list of all available animation names */
export function listSpriteAnimations(): string[] {
  return Object.keys(PRESET_DEFINITIONS);
}

// Proactively initiate sprite preload on modern browsers
if (typeof window !== 'undefined' && typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => preloadAllSprites());
} else if (typeof window !== 'undefined') {
  setTimeout(() => preloadAllSprites(), 50);
}
