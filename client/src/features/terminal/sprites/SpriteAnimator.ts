/**
 * TERMINAL Sprite Animator Engine
 *
 * Efficient requestAnimationFrame-based frame scheduler for pixel-art sprites.
 * Zero DOM allocations per frame, singleton decoded image cache,
 * respects prefers-reduced-motion, and cleans up cleanly on unmount.
 */

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  getPreRenderedFrame,
  getCachedSpriteImage,
} from './spriteRegistry';
import type { SpriteAnimation, SpriteFrame } from './spriteTypes';

export interface AnimatorOptions {
  animation: SpriteAnimation;
  fps?: number;
  loop?: boolean;
  paused?: boolean;
  onComplete?: () => void;
  onFrame?: (frameIndex: number, frame: SpriteFrame) => void;
}

/** Check if reduced motion is requested by system preferences */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class SpriteAnimator {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animation: SpriteAnimation;
  private fps: number;
  private loop: boolean;
  private paused: boolean;
  private onComplete?: () => void;
  private onFrame?: (frameIndex: number, frame: SpriteFrame) => void;

  private currentFrameIndex = 0;
  private rafId: number | null = null;
  private lastTime = 0;
  private isDestroyed = false;

  constructor(options: AnimatorOptions) {
    this.animation = options.animation;
    this.fps = options.fps ?? options.animation.fps ?? 8;
    this.loop = options.loop ?? options.animation.loop ?? true;
    this.paused = options.paused ?? false;
    this.onComplete = options.onComplete;
    this.onFrame = options.onFrame;
  }

  /** Attach canvas element and render initial frame */
  public attachCanvas(canvas: HTMLCanvasElement | null): void {
    if (this.isDestroyed) return;
    this.canvas = canvas;
    if (canvas) {
      this.ctx = canvas.getContext('2d', { alpha: true });
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = false;
      }
      this.renderCurrentFrame();
    }
  }

  /** Update animation preset */
  public setAnimation(animation: SpriteAnimation): void {
    const isSame = this.animation.name === animation.name;
    this.animation = animation;
    this.fps = animation.fps || this.fps;
    this.loop = animation.loop !== undefined ? animation.loop : this.loop;

    if (!isSame) {
      this.currentFrameIndex = 0;
      this.renderCurrentFrame();
    }
  }

  public setFps(fps: number): void {
    this.fps = Math.max(1, Math.min(60, fps));
  }

  public setLoop(loop: boolean): void {
    this.loop = loop;
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused && !this.isDestroyed) {
      this.start();
    } else {
      this.stop();
    }
  }

  public setOnComplete(fn?: () => void): void {
    this.onComplete = fn;
  }

  /** Reset animation to beginning */
  public reset(): void {
    this.currentFrameIndex = 0;
    this.lastTime = performance.now();
    this.renderCurrentFrame();
    if (!this.paused && !this.isDestroyed) {
      this.start();
    }
  }

  /** Start RAF loop */
  public start(): void {
    if (this.isDestroyed || this.paused) return;

    // If reduced-motion is requested, stop at fallback frame without animating
    if (prefersReducedMotion()) {
      const fallbackIdx = this.animation.fallbackFrameIndex ?? 0;
      this.currentFrameIndex = Math.min(fallbackIdx, Math.max(0, this.animation.frames.length - 1));
      this.renderCurrentFrame();
      return;
    }

    if (this.rafId !== null) return; // already running

    this.lastTime = performance.now();
    const frameInterval = 1000 / this.fps;

    const tick = (now: number) => {
      if (this.isDestroyed || this.paused) {
        this.rafId = null;
        return;
      }

      const elapsed = now - this.lastTime;

      if (elapsed >= frameInterval) {
        this.lastTime = now - (elapsed % frameInterval);
        this.advanceFrame();
      }

      if (!this.isDestroyed && !this.paused) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /** Stop RAF loop */
  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Step to next frame */
  private advanceFrame(): void {
    const frameCount = this.animation.frames.length;
    if (frameCount === 0) return;

    const nextIndex = this.currentFrameIndex + 1;

    if (nextIndex >= frameCount) {
      if (this.loop) {
        this.currentFrameIndex = 0;
        this.renderCurrentFrame();
      } else {
        // One-shot: hold last frame and fire callback
        this.currentFrameIndex = frameCount - 1;
        this.renderCurrentFrame();
        this.stop();
        if (this.onComplete) {
          try {
            this.onComplete();
          } catch {
            // guard
          }
        }
      }
    } else {
      this.currentFrameIndex = nextIndex;
      this.renderCurrentFrame();
    }
  }

  /** Render the current frame to the canvas */
  public renderCurrentFrame(): void {
    if (!this.ctx || !this.canvas) return;

    const frames = this.animation.frames;
    if (!frames || frames.length === 0) return;

    const frame = frames[this.currentFrameIndex] || frames[0];
    if (!frame) return;

    // Clear transparent canvas
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Fast path: pre-rendered composite canvas
    const preRendered = getPreRenderedFrame(frame.name);
    if (preRendered) {
      this.ctx.drawImage(preRendered, 0, 0);
    } else {
      // Direct cached image draw at exact (x, y) offset
      const img = getCachedSpriteImage(frame.name);
      if (img && img.complete && img.naturalWidth > 0) {
        this.ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height);
      } else if (img) {
        // Image still decoding in background; redraw once ready
        img.onload = () => {
          if (!this.isDestroyed && this.ctx) {
            this.renderCurrentFrame();
          }
        };
      }
    }

    if (this.onFrame) {
      this.onFrame(this.currentFrameIndex, frame);
    }
  }

  /** Current frame index */
  public getFrameIndex(): number {
    return this.currentFrameIndex;
  }

  /** Teardown and cancel RAF */
  public destroy(): void {
    this.isDestroyed = true;
    this.stop();
    this.canvas = null;
    this.ctx = null;
    this.onComplete = undefined;
    this.onFrame = undefined;
  }
}
