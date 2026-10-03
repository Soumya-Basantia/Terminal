import React from 'react';

export function BrutalistPanel({ children, title, className = '' }: { children: React.ReactNode, title?: string, className?: string }) {
  return (
    <div className={`brutalist-panel ${className}`} style={{ padding: 0 }}>
      {/* Cybercore corner accents are handled by ::before/::after in CSS */}
      {title && (
        <div className="px-5 py-3 border-b border-[var(--term-border-faint)]">
          <span className="font-mono text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)] uppercase">
            // {title}
          </span>
        </div>
      )}
      <div className={title ? 'p-5' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}

interface BrutalistButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'secondary';
}

export function BrutalistButton({ 
  children, 
  variant = 'default',
  className = '',
  ...props
}: BrutalistButtonProps) {
  let btnClass = 'brutalist-button';
  if (variant === 'primary') btnClass = 'brutalist-button brutalist-button-primary';
  if (variant === 'danger') btnClass = 'brutalist-button brutalist-button-danger';
  
  return (
    <button 
      {...props}
      className={`${btnClass} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

