import React from 'react';

export interface TerminalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'cyber' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  glow?: boolean;
}

export const TerminalButton: React.FC<TerminalButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  glow = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass = {
    primary: 'term-btn-primary',
    secondary: 'term-btn-secondary',
    danger: 'term-btn-danger',
    cyber: 'term-btn-cyber',
    ghost: 'term-btn-ghost',
  }[variant];

  const sizeClass = {
    sm: 'term-btn-sm',
    md: '',
    lg: 'term-btn-lg',
  }[size];

  const glowClass = glow && !disabled ? 'animate-glow' : '';

  return (
    <button
      className={`term-btn ${variantClass} ${sizeClass} ${glowClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
};
