import React from 'react';
import terminalLogoImg from '../../../assets/terminal-branding-logo.png';

interface TerminalLogoProps {
  className?: string;
}

export const TerminalLogo: React.FC<TerminalLogoProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center select-none font-mono ${className}`}>
      <div className="w-full max-w-xl bg-[#090d16] border-2 border-cyan-500/60 p-2 sm:p-2.5 shadow-[4px_4px_0px_#000] relative overflow-hidden">
        {/* Subtle Scanline Overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,255,204,0.3)_50%)] bg-[length:100%_4px]" 
        />

        <div className="flex items-center justify-between border-b border-zinc-800 pb-1 mb-1.5 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          <span className="text-cyan-400">&gt;_ TERMINAL SYSTEM ENVIRONMENT</span>
          <span className="text-emerald-400">STATUS: READY</span>
        </div>

        <div className="flex items-center justify-center py-1">
          <img
            src={terminalLogoImg}
            alt="TERMINAL"
            className="max-h-[64px] sm:max-h-[78px] w-auto object-contain drop-shadow-[0_0_12px_rgba(0,255,204,0.25)] pointer-events-none"
            loading="eager"
          />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 pt-1 text-[9px] sm:text-[10px] text-zinc-500">
          <span className="font-mono">KERNEL: 5.15.0-x86_64</span>
          <span className="text-zinc-400">UNIX-CYBERCORE / NEO-BRUTALIST CLI</span>
        </div>
      </div>
    </div>
  );
};
