import React from 'react';

export interface TerminalBadgeProps {
  children: React.ReactNode;
  variant?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'dim';
  dot?: boolean;
  pulse?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const TerminalBadge: React.FC<TerminalBadgeProps> = ({
  children,
  variant = 'cyan',
  dot = false,
  pulse = false,
  icon,
  className = '',
}) => {
  const variantClass = {
    cyan: 'term-badge-cyan',
    green: 'term-badge-green',
    yellow: 'term-badge-yellow',
    red: 'term-badge-red',
    blue: 'term-badge-blue',
    dim: 'term-badge-dim',
  }[variant];

  const dotColorClass = {
    cyan: 'bg-[var(--term-cyan)]',
    green: 'bg-[var(--term-green)]',
    yellow: 'bg-[var(--term-yellow)]',
    red: 'bg-[var(--term-red)]',
    blue: 'bg-[var(--term-blue)]',
    dim: 'bg-[var(--term-text-muted)]',
  }[variant];

  return (
    <span className={`term-badge ${variantClass} ${className}`}>
      {dot && (
        <span 
          className={`term-dot ${dotColorClass} ${pulse ? 'term-dot-pulse' : ''}`} 
        />
      )}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
