import React from 'react';
import { TerminalSprite } from '../sprites/TerminalSprite';

export const TerminalText = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`text-zinc-300 font-mono ${className}`}>{children}</div>
);

export const TerminalSuccess = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-emerald-400 font-mono">
    <TerminalSprite animation="success" size={16} loop={false} className="shrink-0" />
    <span>✓ {children}</span>
  </div>
);

export const TerminalWarning = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-amber-400 font-mono">
    <TerminalSprite animation="warning" size={16} className="shrink-0" />
    <span>⚠ {children}</span>
  </div>
);

export const TerminalError = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-rose-400 font-mono">
    <TerminalSprite animation="error" size={16} loop={false} className="shrink-0" />
    <span>✕ {children}</span>
  </div>
);

export const TerminalSection = ({ title }: { title: string }) => (
  <div className="mt-4 mb-2 font-mono text-zinc-400">
    <div>────────────────────────────────────</div>
    <div className="font-bold tracking-widest text-zinc-200">{title.toUpperCase()}</div>
    <div>────────────────────────────────────</div>
  </div>
);

export const TerminalTable = ({ headers, rows }: { headers: string[], rows: (string | React.ReactNode)[][] }) => (
  <div className="my-2 overflow-x-auto">
    <table className="text-left font-mono w-full min-w-max border-collapse">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="pb-2 pr-6 text-zinc-400 font-normal uppercase tracking-wider">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="py-1 pr-6 text-zinc-300">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
