import React from 'react';

export interface TerminalPanelProps {
  title?: React.ReactNode;
  headerTag?: string;
  headerActions?: React.ReactNode;
  variant?: 'default' | 'cyber' | 'alert';
  cornerAccents?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  title,
  headerTag,
  headerActions,
  variant = 'default',
  cornerAccents = false,
  className = '',
  children,
}) => {
  const variantClass = {
    default: '',
    cyber: 'term-panel-cyber',
    alert: 'term-panel-alert',
  }[variant];

  return (
    <div className={`term-panel ${variantClass} ${className}`}>
      {/* Corner Brackets */}
      {cornerAccents && (
        <>
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[var(--term-cyan)] pointer-events-none z-10" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[var(--term-cyan)] pointer-events-none z-10" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[var(--term-cyan)] pointer-events-none z-10" />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[var(--term-cyan)] pointer-events-none z-10" />
        </>
      )}

      {/* Panel Header */}
      {(title || headerTag || headerActions) && (
        <div className="term-panel-header">
          <div className="flex items-center gap-2 min-w-0">
            {headerTag && (
              <span className="text-[var(--term-cyan)] font-bold shrink-0">{headerTag}</span>
            )}
            {title && (
              <span className="text-[var(--term-text-primary)] font-bold truncate">
                {title}
              </span>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
          )}
        </div>
      )}

      {/* Panel Content */}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
};
