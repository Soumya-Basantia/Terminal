import React from 'react';

// For this project we will simulate pixel art with some simple blocky SVGs or emojis wrapped in pixel styles.
// True pixel art would be imported images, but we'll use CSS blocky representations for now.

export function PixelIcon({ type, className = '' }: { type: 'git' | 'db' | 'network' | 'ai' | 'terminal' | 'trophy', className?: string }) {
  // We'll use emojis mapped to concepts, but apply a "pixelated" filter class if possible.
  // In a real app we'd load an 8-bit PNG. 
  const icons = {
    git: '📁',
    db: '💽',
    network: '🌐',
    ai: '🤖',
    terminal: '💻',
    trophy: '🏆'
  };

  return (
    <span className={`inline-block pixel-rendered text-2xl drop-shadow-md ${className}`} style={{ imageRendering: 'pixelated' }}>
      {icons[type] || '👾'}
    </span>
  );
}

export function PixelBadge({ text, icon }: { text: string, icon?: 'git' | 'db' | 'network' | 'ai' | 'terminal' | 'trophy' }) {
  return (
    <div className="inline-flex items-center gap-2 bg-[#2a2a2a] border-[3px] border-[#555] border-b-[#222] border-r-[#222] px-3 py-1 font-mono text-xs uppercase text-white shadow-sm">
      {icon && <PixelIcon type={icon} className="text-base" />}
      {text}
    </div>
  );
}
