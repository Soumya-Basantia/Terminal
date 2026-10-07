import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export interface TerminalBackButtonProps {
  to?: string;
  onClick?: () => void;
  label?: string;
  shortcut?: string;
  hasUnsavedChanges?: boolean;
  unsavedMessage?: string;
  className?: string;
  variant?: 'secondary' | 'ghost' | 'danger' | 'primary';
  size?: 'sm' | 'md' | 'lg';
}

export const TerminalBackButton: React.FC<TerminalBackButtonProps> = ({
  to,
  onClick,
  label = 'BACK',
  shortcut = 'ESC',
  hasUnsavedChanges = false,
  unsavedMessage = 'You have unsaved changes. Discard changes and return?',
  className = '',
  variant = 'secondary',
  size = 'md',
}) => {
  const navigate = useNavigate();

  const handleAction = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm(unsavedMessage);
      if (!confirmDiscard) return;
    }

    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  }, [hasUnsavedChanges, unsavedMessage, onClick, to, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable
        );

        // If currently focused on input, allow ESC to blur it first; if already blurred or not in input, trigger back
        if (isEditing) {
          (activeEl as HTMLElement).blur();
          return;
        }

        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction]);

  const sizeClasses = {
    sm: 'text-[10px] px-2.5 py-1 min-h-[34px]',
    md: 'text-xs px-3 py-1.5 min-h-[40px] sm:min-h-[38px]',
    lg: 'text-sm px-4 py-2.5 min-h-[44px]',
  }[size];

  const variantClasses = {
    secondary: 'bg-[var(--term-bg-elevated,#121722)] text-zinc-300 border-[var(--term-border-muted,#202938)] hover:text-white hover:border-[var(--term-cyan,#00E5FF)] hover:bg-[#1a2334]',
    ghost: 'bg-transparent text-zinc-400 border-transparent hover:text-white hover:bg-[var(--term-bg-elevated,#121722)] hover:border-[var(--term-border-muted,#202938)]',
    danger: 'bg-red-950/40 text-red-300 border-red-800/60 hover:text-white hover:border-red-500 hover:bg-red-900/60',
    primary: 'bg-[var(--term-cyan,#00E5FF)] text-black border-black font-black hover:bg-[#3bf1ff]',
  }[variant];

  return (
    <button
      type="button"
      onClick={handleAction}
      className={`font-mono font-bold uppercase tracking-wider border-2 flex items-center gap-2 transition-all cursor-pointer select-none active:translate-x-[1px] active:translate-y-[1px] ${sizeClasses} ${variantClasses} ${className}`}
      title={`${label} [${shortcut}]`}
      aria-label={`${label} (press ${shortcut})`}
    >
      <ArrowLeft size={size === 'sm' ? 12 : 14} className="shrink-0" />
      <span>{label}</span>
      {shortcut && (
        <span className="hidden xs:inline-block ml-0.5 px-1 py-0.2 text-[9px] font-bold border border-zinc-700 bg-black/40 text-zinc-400">
          {shortcut}
        </span>
      )}
    </button>
  );
};
