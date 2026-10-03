import React from 'react';
import terminalLogoImg from '../../../assets/terminal-branding-logo.png';

interface TerminalLogoProps {
  className?: string;
}

export const TerminalLogo: React.FC<TerminalLogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center select-none font-mono ${className}`}>
      {/* Visual cyber glow backdrop */}
      <div className="relative w-full flex flex-col items-center justify-center max-w-2xl px-2">
        <div 
          className="absolute inset-0 max-w-lg mx-auto bg-gradient-to-r from-cyan-500/15 via-purple-500/15 to-pink-500/15 blur-2xl rounded-full pointer-events-none -z-10" 
        />

        {/* Primary Provided TERMINAL Pixel-Art Emblem */}
        <div className="relative group flex items-center justify-center">
          <img
            src={terminalLogoImg}
            alt="TERMINAL"
            className="w-full max-h-[220px] sm:max-h-[260px] md:max-h-[300px] object-contain drop-shadow-[0_0_20px_rgba(0,255,204,0.35)] transition-transform duration-300 pointer-events-none"
            loading="eager"
          />

          {/* Subtle Cyber Scanline Overlay across logo */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,255,204,0.25)_50%)] bg-[length:100%_4px]" 
          />
        </div>

        {/* Textual Branding Callout matching the specification */}
        <div className="text-center mt-2 space-y-1">
          <div className="text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-fuchsia-400 drop-shadow-[0_0_8px_rgba(0,255,204,0.5)]">
            WELCOME TO TERMINAL
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em] text-cyan-300/90 pt-0.5">
            <span className="text-zinc-600 select-none">═╡</span>
            <span className="text-cyan-400 hover:text-cyan-300 transition-colors">PLAY</span>
            <span className="text-zinc-600">|</span>
            <span className="text-emerald-400 hover:text-emerald-300 transition-colors">LEARN</span>
            <span className="text-zinc-600">|</span>
            <span className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">COMPETE</span>
            <span className="text-zinc-600">|</span>
            <span className="text-pink-400 hover:text-pink-300 transition-colors">CONNECT</span>
            <span className="text-zinc-600 select-none">╞═</span>
          </div>
        </div>
      </div>
    </div>
  );
};
