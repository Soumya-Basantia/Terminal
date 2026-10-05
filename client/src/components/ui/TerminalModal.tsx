import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  headerTag?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  children: React.ReactNode;
}

export const TerminalModal: React.FC<TerminalModalProps> = ({
  isOpen,
  onClose,
  title,
  headerTag = '// TERMINAL_DIALOG',
  maxWidth = 'lg',
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      {/* Clickable Backdrop */}
      <div 
        className="fixed inset-0 -z-10" 
        onClick={onClose} 
      />

      {/* Modal Dialog Card */}
      <div 
        className={`w-full ${maxWidthClass} bg-[var(--term-bg-surface)] border-2 border-[var(--term-border-crisp)] shadow-[8px_8px_0_0_rgba(0,0,0,0.85)] max-h-[92vh] sm:max-h-[90vh] flex flex-col relative animate-fade-in-scale`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cyber Corner Brackets */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-[var(--term-cyan)] pointer-events-none" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-[var(--term-cyan)] pointer-events-none" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-[var(--term-cyan)] pointer-events-none" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-[var(--term-cyan)] pointer-events-none" />

        {/* Modal Header */}
        <div className="bg-[var(--term-bg-elevated)] border-b-2 border-[var(--term-border-subtle)] p-3 sm:p-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <span className="text-[10px] font-bold text-[var(--term-cyan)] uppercase tracking-wider select-none shrink-0">
              {headerTag}
            </span>
            <span className="text-zinc-600 select-none">|</span>
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-[var(--term-text-muted)] hover:text-white hover:bg-[var(--term-bg-highlight)] transition-colors cursor-pointer shrink-0 border border-transparent hover:border-[var(--term-border-muted)]"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 scroll-area">
          {children}
        </div>
      </div>
    </div>
  );
};
