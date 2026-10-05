import React from 'react';

export function StagePanel({ children, title, className = '' }: { children: React.ReactNode, title?: string, className?: string }) {
  return (
    <div className={`bg-[rgba(10,10,12,0.85)] border border-[var(--accent-primary)] shadow-[0_0_30px_rgba(0,255,204,0.1)] p-4 sm:p-6 md:p-8 lg:p-12 backdrop-blur-md relative ${className}`}>
      {/* Cyberpunk accents */}
      <div className="absolute -top-1 -left-1 w-4 sm:w-6 h-4 sm:h-6 border-t-2 sm:border-t-4 border-l-2 sm:border-l-4 border-[var(--accent-primary)]" />
      <div className="absolute -bottom-1 -right-1 w-4 sm:w-6 h-4 sm:h-6 border-b-2 sm:border-b-4 border-r-2 sm:border-r-4 border-[var(--accent-primary)]" />
      <div className="absolute top-0 right-4 sm:right-10 w-12 sm:w-20 h-1 bg-[var(--accent-primary)] shadow-[0_0_10px_var(--accent-primary)]" />
      
      {title && (
        <h1 className="font-display font-black text-xl sm:text-3xl md:text-5xl text-white tracking-tight uppercase mb-4 sm:mb-8 flex items-center gap-3 sm:gap-6 min-w-0">
          <div className="h-6 sm:h-10 w-2 sm:w-4 bg-[var(--accent-primary)] shrink-0" />
          <span className="truncate">{title}</span>
        </h1>
      )}
      <div className="relative z-10 w-full min-w-0">
        {children}
      </div>
    </div>
  );
}

export function Countdown({ seconds, label }: { seconds: number, label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative flex items-center justify-center w-32 h-32 sm:w-48 sm:h-48">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-dashed border-[var(--accent-primary)] opacity-30 animate-spin-slow" style={{ animationDuration: '10s' }} />
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full border border-[var(--accent-secondary)] shadow-[0_0_30px_rgba(0,179,255,0.3)]" />
        
        <div className="font-mono font-bold text-4xl sm:text-6xl text-white z-10 shadow-black drop-shadow-lg">
          {seconds}
        </div>
      </div>
      {label && (
        <div className="mt-3 sm:mt-6 font-mono text-[var(--accent-primary)] uppercase tracking-widest text-xs sm:text-xl text-center px-2">
          {label}
        </div>
      )}
    </div>
  );
}
