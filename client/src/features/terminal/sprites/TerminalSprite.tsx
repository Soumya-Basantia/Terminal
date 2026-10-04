/**
 * TerminalSprite Component
 *
 * Official Animated Sprite Component for the TERMINAL project.
 * Renders authentic pixel-art frames from the centralized sprite registry.
 *
 * Usage:
 *   <TerminalSprite animation="loading" size={32} loop />
 *   <TerminalSprite animation="success" size={28} loop={false} />
 *   <TerminalSprite animation="error" size={32} />
 *   <TerminalSprite animation="terminal-boot" size={64} />
 */

import React, { useRef } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './spriteRegistry';
import { useSpriteAnimator } from './useSpriteAnimator';
import type { TerminalSpriteProps } from './spriteTypes';

export const TerminalSprite: React.FC<TerminalSpriteProps> = ({
  animation = 'loading',
  state,
  size = 32,
  width,
  height,
  fps,
  loop,
  paused = false,
  onComplete,
  className = '',
  style = {},
  title,
  ariaLabel,
  pixelated = true,
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animName = state || animation;

  useSpriteAnimator(canvasRef, {
    animation: animName,
    fps,
    loop,
    paused,
    onComplete,
  });

  // Calculate pixel-perfect proportional dimensions (65 x 113 aspect ratio)
  const displayHeight = height ?? size;
  const displayWidth = width ?? Math.max(1, Math.round(displayHeight * (CANVAS_WIDTH / CANVAS_HEIGHT)));

  const pixelStyle: React.CSSProperties = pixelated
    ? {
        imageRendering: 'pixelated',
        // Fallback for older Safari/WebKit
        // @ts-ignore
        msInterpolationMode: 'nearest-neighbor',
      }
    : {};

  return (
    <span
      className={`inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{
        display: 'inline-flex',
        width: displayWidth,
        height: displayHeight,
        overflow: 'hidden',
        lineHeight: 0,
        ...style,
      }}
      title={title || `[SPRITE:${animName.toUpperCase()}]`}
      role="img"
      aria-label={ariaLabel || `Terminal ${animName} sprite animation`}
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block"
        style={{
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
          backgroundColor: 'transparent',
          ...pixelStyle,
        }}
      />
    </span>
  );
};

export default TerminalSprite;
