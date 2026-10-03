import React from 'react';

export function StagePanel({ children, title, className = '' }: { children: React.ReactNode, title?: string, className?: string }) {
  return (
    <div className={`bg-[rgba(10,10,12,0.85)] border border-[var(--accent-primary)] shadow-[0_0_30px_rgba(0,255,204,0.1)] p-12 backdrop-blur-md relative ${className}`}>
      {/* Cyberpunk accents */}
      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[var(--accent-primary)]" />
      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[var(--accent-primary)]" />
      <div className="absolute top-0 right-10 w-20 h-1 bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-primary)]" />
      
      {title && (
        <h1 className="font-display font-black text-5xl text-white tracking-tight uppercase mb-8 flex items-center gap-6">
          <div className="h-10 w-4 bg-[var(--accent-primary)]" />
          {title}
        </h1>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export function Countdown({ seconds, label }: { seconds: number, label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center w-48 h-48">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 rounded-full border-4 border-dashed border-[var(--accent-primary)] opacity-30 animate-spin-slow" style={{ animationDuration: '10s' }} />
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full border border-[var(--accent-secondary)] shadow-[0_0_30px_rgba(0,179,255,0.3)]" />
        
        <div className="font-mono font-bold text-6xl text-white z-10 shadow-black drop-shadow-lg">
          {seconds}
        </div>
      </div>
      {label && (
        <div className="mt-6 font-mono text-[var(--accent-primary)] uppercase tracking-widest text-xl">
          {label}
        </div>
      )}
    </div>
  );
}
