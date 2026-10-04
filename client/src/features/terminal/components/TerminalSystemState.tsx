/**
 * TERMINAL System State Components
 * Cybercore + Neo-Brutalism + Cyberpunk + Real Terminal
 *
 * Reusable visual/interaction system for all loading, error, success,
 * warning, empty, offline, reconnecting, and processing states.
 *
 * Do NOT use generic spinners, SaaS alerts, or plain text.
 * Every state must feel like part of the TERMINAL operating environment.
 */

import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, RefreshCw, WifiOff, Wifi, Zap } from 'lucide-react';
import { TerminalSprite } from '../sprites/TerminalSprite';
export { TerminalSprite };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Map raw HTTP status / error codes to TERMINAL-language messages */
export function mapApiError(err: any): { code: string; message: string; hint?: string } {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.error || err?.response?.data?.message || '';

  if (!status && !err?.response) {
    return { code: 'NETWORK_OFFLINE', message: 'Unable to reach TERMINAL network.', hint: 'Check your connection and retry.' };
  }

  switch (status) {
    case 400: return { code: 'INVALID_INPUT', message: serverMsg || 'Input validation failed.', hint: 'Review the fields and try again.' };
    case 401: return { code: 'ACCESS_DENIED', message: 'Authentication credentials invalid or expired.', hint: 'Re-authenticate and try again.' };
    case 403: return { code: 'OPERATION_NOT_AUTHORIZED', message: serverMsg || 'You do not have permission for this action.', hint: 'Contact your Game Master.' };
    case 404: return { code: 'RESOURCE_NOT_FOUND', message: serverMsg || 'The requested resource does not exist.', hint: 'Verify the handle, code, or path.' };
    case 409: return { code: 'CONFLICT', message: serverMsg || 'This resource already exists or is in conflict.', hint: undefined };
    case 422: return { code: 'INVALID_INPUT', message: serverMsg || 'The submitted data is malformed.', hint: 'Check all fields and retry.' };
    case 429: return { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.', hint: 'Wait a moment before retrying.' };
    default:
      if (status >= 500) return { code: 'TERMINAL_SERVICE_ERROR', message: 'An internal system failure occurred.', hint: 'Try again. If persists, contact Admin.' };
      return { code: 'UNKNOWN_ERROR', message: serverMsg || 'An unexpected error occurred.', hint: undefined };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TerminalLoading — Indeterminate + optional progress
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalLoadingProps {
  label?: string;
  node?: string;
  progress?: number; // 0-100, omit for indeterminate
  compact?: boolean; // inline compact mode for panels
}

export const TerminalLoading: React.FC<TerminalLoadingProps> = ({
  label = 'LOADING DATA',
  node,
  progress,
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 py-1.5 px-2.5 bg-[#0e121c] border border-zinc-800 font-mono text-xs"
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <TerminalSprite animation="loading" size={18} className="shrink-0" />
        <span className="text-zinc-400">{label}</span>
        <span className="terminal-cursor text-zinc-600 text-[10px]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="bg-[#0b0e17] border-2 border-zinc-800 font-mono text-xs terminal-fade-in"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121622] border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <TerminalSprite animation="loading" size={18} className="shrink-0" />
          <span className="text-[10px] font-bold text-zinc-500 tracking-widest">// LOADING</span>
        </div>
        <span className="text-[10px] text-cyan-400 font-bold terminal-cursor" aria-hidden="true">
          {progress != null ? `${progress}%` : 'PROCESSING'}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <div className="text-zinc-200 font-bold tracking-wider">{label}</div>

        {/* Progress track */}
        <div className="bg-[#050608] border border-zinc-800 h-3 relative overflow-hidden" aria-hidden="true">
          {progress != null ? (
            <div
              className="h-full bg-cyan-500/80 terminal-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          ) : (
            /* Indeterminate scanner */
            <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent terminal-scan-bar" />
          )}
        </div>

        {node && (
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>NODE: <span className="text-zinc-300 font-bold">{node}</span></span>
            <span className="text-cyan-400/70">STATE: PROCESSING</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. TerminalProcessing — Command execution in-progress feedback
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalProcessingProps {
  steps?: string[];   // list of processing steps to show
  current?: string;   // current operation label
  compact?: boolean;
}

export const TerminalProcessing: React.FC<TerminalProcessingProps> = ({
  steps,
  current = 'PROCESSING',
  compact = false,
}) => {
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-cyan-300 font-mono text-xs"
        role="status"
        aria-live="polite"
        aria-label={current}
      >
        <TerminalSprite animation="processing" size={16} className="shrink-0" />
        {current}
      </span>
    );
  }

  return (
    <div
      className="font-mono text-xs space-y-1 terminal-fade-in"
      role="status"
      aria-live="polite"
      aria-label={current}
    >
      <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold tracking-widest mb-1">
        <TerminalSprite animation="processing" size={20} className="shrink-0" />
        <span>[PROCESSING]</span>
      </div>
      {steps ? steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-zinc-300">
          <span className="text-cyan-400 text-[10px]">◈</span>
          <span>{step}</span>
        </div>
      )) : (
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="text-cyan-400 font-mono">▶</span>
          <span>{current}...</span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. TerminalSuccess — Operation complete
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalSuccessProps {
  title?: string;
  children?: React.ReactNode;
  compact?: boolean;
}

export const TerminalSuccess: React.FC<TerminalSuccessProps> = ({
  title = 'OPERATION COMPLETE',
  children,
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 text-emerald-400 font-mono text-xs terminal-success-reveal"
        role="status"
        aria-live="polite"
      >
        <TerminalSprite animation="success" size={18} loop={false} className="shrink-0" />
        <span>{children || title}</span>
      </div>
    );
  }

  return (
    <div
      className="bg-[#0b1410] border-2 border-emerald-500/50 font-mono text-xs terminal-success-reveal"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e1a16] border-b border-emerald-500/30">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-emerald-300 font-bold tracking-widest text-[10px]">{title}</span>
        </div>
        <TerminalSprite animation="success" size={24} loop={false} className="shrink-0" />
      </div>
      {children && (
        <div className="p-3 text-zinc-200 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. TerminalError — System error with optional retry
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalErrorProps {
  code?: string;
  message: React.ReactNode;
  hint?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const TerminalError: React.FC<TerminalErrorProps> = ({
  code = 'SYSTEM_ERROR',
  message,
  hint,
  onRetry,
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 text-rose-400 font-mono text-xs terminal-error-pulse"
        role="alert"
        aria-live="assertive"
      >
        <TerminalSprite animation="error" size={18} loop={false} className="shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      className="bg-[#12080e] border-2 border-rose-500/60 font-mono text-xs terminal-error-pulse"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a0c14] border-b border-rose-500/40">
        <div className="flex items-center gap-2">
          <span className="text-rose-400 font-bold">!</span>
          <span className="text-rose-300 font-bold tracking-widest text-[10px]">SYSTEM ERROR</span>
        </div>
        <TerminalSprite animation="error" size={24} loop={false} className="shrink-0" />
      </div>

      <div className="p-3 space-y-2">
        <div className="text-rose-300 font-bold tracking-wider">{code}</div>
        <div className="text-zinc-300 leading-relaxed">{message}</div>

        {hint && (
          <div className="text-zinc-500 text-[11px] border-l-2 border-zinc-700 pl-2">
            Try: <span className="text-cyan-400 font-bold">{hint}</span>
          </div>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-3 py-1 border-2 border-rose-500/70 bg-rose-950/40 text-rose-300 font-bold text-[10px] tracking-widest hover:bg-rose-900/40 transition-colors cursor-pointer shadow-[2px_2px_0px_#000] focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            [ RETRY ]
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. TerminalWarning — Non-fatal condition
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalWarningProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}

export const TerminalWarning: React.FC<TerminalWarningProps> = ({
  title = 'WARNING',
  children,
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className="flex items-center gap-2 text-amber-400 font-mono text-xs terminal-warn-pulse"
        role="alert"
        aria-live="polite"
      >
        <TerminalSprite animation="warning" size={18} className="shrink-0" />
        <span>{children}</span>
      </div>
    );
  }

  return (
    <div
      className="bg-[#110e03] border-2 border-amber-500/60 font-mono text-xs terminal-warn-pulse"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1504] border-b border-amber-500/30">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold">⚠</span>
          <span className="text-amber-300 font-bold tracking-widest text-[10px]">// {title}</span>
        </div>
        <TerminalSprite animation="warning" size={24} className="shrink-0" />
      </div>
      <div className="p-3 text-zinc-200 leading-relaxed space-y-1">
        {children}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. TerminalEmpty — No data / no results
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalEmptyProps {
  title?: string;
  children?: React.ReactNode;
  hint?: string; // suggested command
}

export const TerminalEmpty: React.FC<TerminalEmptyProps> = ({
  title = 'NO DATA',
  children,
  hint,
}) => (
  <div
    className="font-mono text-xs terminal-fade-in py-4 px-3 space-y-2 text-center"
    role="status"
    aria-live="polite"
  >
    <TerminalSprite animation="scanning" size={32} className="mx-auto mb-1 opacity-75" />
    <div className="text-zinc-600 text-[10px] font-bold tracking-widest">// {title}</div>
    {children && <div className="text-zinc-400 leading-relaxed">{children}</div>}
    {hint && (
      <div className="text-zinc-600 text-[11px] pt-1">
        Suggested: <span className="text-cyan-400 font-bold font-mono">{hint}</span>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. TerminalOffline — Full connection failure panel
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalOfflineProps {
  reason?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const TerminalOffline: React.FC<TerminalOfflineProps> = ({
  reason = 'SOCKET_CONNECTION_FAILED',
  onRetry,
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-rose-400 font-mono text-[11px]" role="alert">
        <TerminalSprite animation="reconnecting" size={14} className="shrink-0" />
        <span className="font-bold">OFFLINE</span>
        {onRetry && (
          <button onClick={onRetry} className="underline text-rose-300 hover:text-rose-200 cursor-pointer text-[10px] ml-1">
            [RETRY]
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="bg-[#0d0608] border-2 border-rose-500/70 font-mono text-xs terminal-offline-flicker"
      role="alert"
      aria-live="assertive"
      aria-label="Network offline"
    >
      {/* Double border top */}
      <div className="border-t-2 border-rose-500/30 -mt-0" />
      <div className="flex items-center justify-between px-3 py-2 bg-[#170a10] border-b border-rose-500/40">
        <div className="flex items-center gap-2">
          <WifiOff size={13} className="text-rose-400 shrink-0" />
          <span className="text-rose-300 font-bold tracking-widest text-[10px]">// NETWORK OFFLINE</span>
        </div>
        <TerminalSprite animation="error" size={24} loop={false} className="shrink-0" />
      </div>

      <div className="p-4 space-y-3">
        <div className="text-rose-300 font-bold text-sm tracking-wider">{reason}</div>
        <div className="text-zinc-400">TERMINAL NETWORK IS UNREACHABLE.</div>
        <div className="text-zinc-500 text-[11px]">Check your connection or wait for automatic recovery.</div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-1.5 border-2 border-rose-500 bg-rose-950/60 text-rose-200 font-bold text-[11px] tracking-widest hover:bg-rose-900/60 transition-colors cursor-pointer shadow-[3px_3px_0px_#000] focus:outline-none focus:ring-1 focus:ring-rose-400"
            aria-label="Retry connection"
          >
            <RefreshCw size={12} />
            [ RETRY CONNECTION ]
          </button>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. TerminalReconnect — Active reconnection state
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalReconnectProps {
  steps?: string[];
  done?: boolean; // true when reconnected
  compact?: boolean;
}

const DEFAULT_RECONNECT_STEPS = [
  'AUTHENTICATING',
  'RESTORING SESSION',
  'RESTORING TEAM CHANNEL',
];

export const TerminalReconnect: React.FC<TerminalReconnectProps> = ({
  steps = DEFAULT_RECONNECT_STEPS,
  done = false,
  compact = false,
}) => {
  if (done) {
    return (
      <div
        className="flex items-center gap-2 text-emerald-400 font-mono text-xs terminal-success-reveal"
        role="status"
        aria-live="polite"
      >
        <Wifi size={12} className="shrink-0" />
        <span className="font-bold">✓ CONNECTION RESTORED</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 font-mono text-[11px] text-amber-400 terminal-signal"
        role="status"
        aria-live="polite"
        aria-label="Reconnecting to network"
      >
        <TerminalSprite animation="reconnecting" size={16} className="shrink-0" />
        <span className="font-bold">◐ RECONNECTING</span>
      </div>
    );
  }

  return (
    <div
      className="bg-[#0e0c03] border-2 border-amber-500/50 font-mono text-xs terminal-signal"
      role="status"
      aria-live="polite"
      aria-label="Reconnecting to TERMINAL network"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1504] border-b border-amber-500/30">
        <div className="flex items-center gap-2">
          <Wifi size={12} className="text-amber-400 shrink-0" />
          <span className="text-amber-300 font-bold tracking-widest text-[10px]">// NETWORK RECOVERY</span>
        </div>
        <TerminalSprite animation="reconnecting" size={24} className="shrink-0" />
      </div>

      <div className="p-3 space-y-2">
        <div className="text-zinc-300">RECONNECTING TO TERMINAL NETWORK...</div>
        <div className="space-y-1 pt-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-zinc-400 text-[11px]">
              <span className="text-amber-400 terminal-glyph shrink-0" aria-hidden="true" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. TerminalStatus — Inline connection status indicator
// ─────────────────────────────────────────────────────────────────────────────

type ConnectionStatus = 'online' | 'offline' | 'reconnecting';

interface TerminalStatusProps {
  status: ConnectionStatus;
  label?: string;
}

export const TerminalStatus: React.FC<TerminalStatusProps> = ({
  status,
  label,
}) => {
  const configs: Record<ConnectionStatus, { dot: string; text: string; glyph: string; bg: string; border: string }> = {
    online: {
      dot: 'bg-emerald-400 animate-pulse',
      text: 'text-emerald-300',
      glyph: '●',
      bg: 'bg-emerald-950/60',
      border: 'border-emerald-500/60',
    },
    offline: {
      dot: 'bg-rose-500',
      text: 'text-rose-300',
      glyph: '○',
      bg: 'bg-rose-950/60',
      border: 'border-rose-500/60',
    },
    reconnecting: {
      dot: 'bg-amber-400 animate-pulse',
      text: 'text-amber-300',
      glyph: '◐',
      bg: 'bg-amber-950/60',
      border: 'border-amber-500/60',
    },
  };

  const cfg = configs[status];
  const displayLabel = label || status.toUpperCase();

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 ${cfg.bg} border ${cfg.border} ${cfg.text} font-bold text-[10px] font-mono`}
      role="status"
      aria-label={`Network status: ${displayLabel}`}
    >
      {status === 'reconnecting' ? (
        <TerminalSprite animation="reconnecting" size={13} className="shrink-0" />
      ) : status === 'offline' ? (
        <TerminalSprite animation="error" size={13} loop={false} className="shrink-0" />
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} aria-hidden="true" />
      )}
      <span>{displayLabel}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. TerminalBoot — Boot sequence for workspace initialization
// ─────────────────────────────────────────────────────────────────────────────

interface BootLine {
  label: string;
  status?: 'OK' | 'SYNCED' | 'READY' | 'PENDING';
  delay?: number; // ms delay before this line appears
}

const DEFAULT_BOOT_LINES: BootLine[] = [
  { label: 'INITIALIZING CORE', status: 'OK', delay: 0 },
  { label: 'AUTHENTICATING WORKSPACE', status: 'OK', delay: 120 },
  { label: 'LOADING PLAYER DATA', status: 'OK', delay: 240 },
  { label: 'CONNECTING NETWORK', status: 'OK', delay: 360 },
  { label: 'SYNCHRONIZING SESSION', status: 'SYNCED', delay: 480 },
];

interface TerminalBootProps {
  lines?: BootLine[];
  title?: string;
}

export const TerminalBoot: React.FC<TerminalBootProps> = ({
  lines = DEFAULT_BOOT_LINES,
  title = 'TERMINAL-OS INITIALIZATION',
}) => {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((line, i) => {
      const t = setTimeout(() => {
        setVisibleLines(prev => [...prev, i]);
      }, line.delay ?? i * 120);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [lines]);

  const statusColor: Record<string, string> = {
    OK: 'text-emerald-400',
    SYNCED: 'text-cyan-300',
    READY: 'text-emerald-300',
    PENDING: 'text-amber-300',
  };

  return (
    <div
      className="bg-[#05060a] border-2 border-cyan-500/70 font-mono text-xs p-5 max-w-md w-full shadow-[6px_6px_0px_#000]"
      role="status"
      aria-live="polite"
      aria-label="Terminal booting"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-cyan-400 shrink-0" />
          <span className="text-[11px] font-bold tracking-widest text-zinc-100 uppercase">
            // {title}
          </span>
        </div>
        <TerminalSprite animation="terminal-boot" size={36} loop={false} className="shrink-0" />
      </div>

      {/* Boot lines */}
      <div className="space-y-1.5">
        {lines.map((line, i) => {
          const visible = visibleLines.includes(i);
          const isLast = i === lines.length - 1;
          const statusKey = line.status || 'OK';
          const color = statusColor[statusKey] || 'text-emerald-400';

          if (!visible) return null;

          return (
            <div
              key={i}
              className={`flex items-baseline justify-between gap-4 terminal-boot-line ${isLast ? 'text-emerald-300' : 'text-zinc-400'}`}
              aria-hidden={!visible}
            >
              <span>
                {isLast ? <span className="text-emerald-400 mr-1">▶</span> : <span className="text-zinc-600 mr-1">›</span>}
                {line.label.padEnd(30, '.')}
              </span>
              {line.status && (
                <span className={`font-bold shrink-0 ${color}`}>{statusKey}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Cursor at end */}
      {visibleLines.length === lines.length && (
        <div className="mt-3 text-emerald-400 font-bold terminal-cursor" aria-hidden="true">
          TERMINAL READY
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. TerminalUnauthorized — 401 / 403 access block
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalUnauthorizedProps {
  code?: '401' | '403';
  message?: string;
  onLogout?: () => void;
}

export const TerminalUnauthorized: React.FC<TerminalUnauthorizedProps> = ({
  code = '401',
  message,
  onLogout,
}) => (
  <div
    className="bg-[#0f0910] border-2 border-purple-500/70 font-mono text-xs terminal-error-pulse"
    role="alert"
    aria-live="assertive"
  >
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#180d1c] border-b border-purple-500/40">
      <span className="text-purple-400 font-bold">⛔</span>
      <span className="text-purple-300 font-bold tracking-widest text-[10px]">
        {code === '401' ? '! ACCESS DENIED' : '! OPERATION NOT AUTHORIZED'}
      </span>
    </div>
    <div className="p-3 space-y-2">
      <div className="text-zinc-300">
        {message || (code === '401' ? 'Authentication credentials invalid or expired.' : 'You do not have permission for this action.')}
      </div>
      {onLogout && (
        <button
          onClick={onLogout}
          className="px-3 py-1 border border-purple-500/60 bg-purple-950/40 text-purple-300 font-bold text-[10px] tracking-widest hover:bg-purple-900/40 transition-colors cursor-pointer shadow-[2px_2px_0px_#000]"
        >
          [ RE-AUTHENTICATE ]
        </button>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 12. TerminalNotFound — 404 resource not found
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalNotFoundProps {
  resource?: string;
  hint?: string;
}

export const TerminalNotFound: React.FC<TerminalNotFoundProps> = ({
  resource,
  hint,
}) => (
  <div
    className="bg-[#0b0c10] border border-zinc-700 font-mono text-xs terminal-fade-in p-3 space-y-1"
    role="alert"
    aria-live="polite"
  >
    <div className="text-zinc-500 text-[10px] font-bold tracking-widest">// RESOURCE NOT FOUND</div>
    <div className="text-zinc-300">
      {resource ? (
        <>No resource found: <span className="text-rose-400 font-bold">{resource}</span></>
      ) : 'The requested resource does not exist.'}
    </div>
    {hint && (
      <div className="text-zinc-500 text-[11px] pt-1">
        Try: <span className="text-cyan-400 font-bold">{hint}</span>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 13. useSocketStatus — Hook for real-time socket status
// ─────────────────────────────────────────────────────────────────────────────

import { getSocket } from '../../../lib/socket';

export function useSocketStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    try {
      const s = getSocket();
      return s.connected ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  });

  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onConnect = () => setStatus('online');
    const onDisconnect = () => setStatus('offline');
    const onReconnecting = () => setStatus('reconnecting');
    const onReconnectFailed = () => setStatus('offline');
    const onReconnect = () => setStatus('online');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnecting);
    socket.io.on('reconnect_failed', onReconnectFailed);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnecting);
      socket.io.off('reconnect_failed', onReconnectFailed);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  return status;
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Compact inline state renderer for terminal output stream
// ─────────────────────────────────────────────────────────────────────────────

/** Use these in terminal command outputs (React.createElement-compatible) */
export const TerminalOutputSuccess = ({ children }: { children: React.ReactNode }) => (
  <div className="text-emerald-400 font-mono text-xs terminal-success-reveal" role="status" aria-live="polite">
    ✓ {children}
  </div>
);

export const TerminalOutputError = ({ children }: { children: React.ReactNode }) => (
  <div className="text-rose-400 font-mono text-xs terminal-error-pulse" role="alert" aria-live="assertive">
    ! {children}
  </div>
);

export const TerminalOutputWarning = ({ children }: { children: React.ReactNode }) => (
  <div className="text-amber-400 font-mono text-xs terminal-warn-pulse" role="alert" aria-live="polite">
    ⚠ {children}
  </div>
);

export const TerminalOutputInfo = ({ children }: { children: React.ReactNode }) => (
  <div className="text-cyan-300 font-mono text-xs terminal-fade-in" role="status" aria-live="polite">
    ◈ {children}
  </div>
);
