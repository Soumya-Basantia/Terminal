import React, { forwardRef } from 'react';

export interface TerminalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefixSymbol?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  endAdornment?: React.ReactNode;
}

export const TerminalInput = forwardRef<HTMLInputElement, TerminalInputProps>(({
  label,
  prefixSymbol = '>',
  error,
  hint,
  icon,
  endAdornment,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? `term-input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full font-mono">
      {label && (
        <label 
          htmlFor={inputId}
          className="text-[11px] font-bold tracking-wider uppercase text-[var(--term-cyan)] flex items-center gap-1.5"
        >
          <span className="text-[var(--term-cyan)] select-none">{prefixSymbol}</span>
          <span>{label}</span>
        </label>
      )}

      <div className="relative flex items-center w-full">
        {icon && (
          <span className="absolute left-3 text-[var(--term-text-muted)] pointer-events-none flex items-center">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          className={`term-input ${icon ? 'pl-9' : ''} ${endAdornment ? 'pr-10' : ''} ${
            error ? 'border-[var(--term-red)] focus:border-[var(--term-red)] focus:shadow-[0_0_0_1px_var(--term-red)]' : ''
          } ${className}`}
          {...props}
        />

        {endAdornment && (
          <span className="absolute right-3 flex items-center">
            {endAdornment}
          </span>
        )}
      </div>

      {error && (
        <span className="text-[11px] font-mono text-[var(--term-red)] flex items-center gap-1 mt-0.5">
          <span>✕</span>
          <span className="uppercase">{error}</span>
        </span>
      )}

      {hint && !error && (
        <span className="text-[10px] font-mono text-[var(--term-text-muted)] mt-0.5">
          {hint}
        </span>
      )}
    </div>
  );
});

TerminalInput.displayName = 'TerminalInput';
