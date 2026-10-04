/**
 * React hook for orchestrating SpriteAnimator lifecycle
 */

import { useEffect, useRef, useState } from 'react';
import { SpriteAnimator } from './SpriteAnimator';
import { getSpriteAnimation } from './spriteRegistry';
import type { SpriteAnimationName } from './spriteTypes';

export interface UseSpriteAnimatorOptions {
  animation?: SpriteAnimationName;
  fps?: number;
  loop?: boolean;
  paused?: boolean;
  onComplete?: () => void;
}

export function useSpriteAnimator(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseSpriteAnimatorOptions = {}
) {
  const {
    animation = 'loading',
    fps,
    loop,
    paused = false,
    onComplete,
  } = options;

  const [frameIndex, setFrameIndex] = useState(0);
  const animatorRef = useRef<SpriteAnimator | null>(null);

  // Initialize animator
  useEffect(() => {
    const compiledAnimation = getSpriteAnimation(animation);

    const animator = new SpriteAnimator({
      animation: compiledAnimation,
      fps,
      loop,
      paused,
      onComplete,
      onFrame: (idx) => setFrameIndex(idx),
    });

    animatorRef.current = animator;
    if (canvasRef.current) {
      animator.attachCanvas(canvasRef.current);
      animator.start();
    }

    return () => {
      animator.destroy();
      animatorRef.current = null;
    };
  }, []); // mounted once

  // Canvas element attachment
  useEffect(() => {
    if (animatorRef.current && canvasRef.current) {
      animatorRef.current.attachCanvas(canvasRef.current);
      if (!paused) {
        animatorRef.current.start();
      }
    }
  }, [canvasRef.current]);

  // Reactive animation change
  useEffect(() => {
    if (animatorRef.current) {
      const compiledAnimation = getSpriteAnimation(animation);
      animatorRef.current.setAnimation(compiledAnimation);
      if (fps !== undefined) animatorRef.current.setFps(fps);
      if (loop !== undefined) animatorRef.current.setLoop(loop);
      animatorRef.current.reset();
    }
  }, [animation]);

  // Reactive FPS
  useEffect(() => {
    if (animatorRef.current && fps !== undefined) {
      animatorRef.current.setFps(fps);
    }
  }, [fps]);

  // Reactive Loop
  useEffect(() => {
    if (animatorRef.current && loop !== undefined) {
      animatorRef.current.setLoop(loop);
    }
  }, [loop]);

  // Reactive Paused
  useEffect(() => {
    if (animatorRef.current) {
      animatorRef.current.setPaused(paused);
    }
  }, [paused]);

  // Reactive onComplete
  useEffect(() => {
    if (animatorRef.current) {
      animatorRef.current.setOnComplete(onComplete);
    }
  }, [onComplete]);

  return {
    frameIndex,
    animator: animatorRef.current,
    reset: () => animatorRef.current?.reset(),
    pause: () => animatorRef.current?.setPaused(true),
    resume: () => animatorRef.current?.setPaused(false),
  };
}
