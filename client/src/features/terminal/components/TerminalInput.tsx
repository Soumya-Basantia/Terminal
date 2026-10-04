import React, { useState, useRef, useEffect } from 'react';
import { commandRegistry } from '../core/registry';
import { TerminalSprite } from '../sprites/TerminalSprite';

interface TerminalInputProps {
  username: string;
  onCommand: (cmd: string) => void;
  onClear: () => void;
  onEscape?: () => void;
  placeholder?: string;
  isExecuting?: boolean;
}

export const TerminalInput: React.FC<TerminalInputProps> = ({ 
  username, 
  onCommand, 
  onClear,
  onEscape,
  placeholder,
  isExecuting = false,
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input ONLY when no other input or interactive element is focused
  useEffect(() => {
    const isInteractiveElement = (el: Element | null): boolean => {
      if (!el) return false;
      return !!el.closest('input, textarea, [contenteditable="true"], button, a, select, [role="button"]');
    };

    const handleFocus = (e: MouseEvent | KeyboardEvent) => {
      // Never steal focus if target or activeElement is inside another input/textarea
      const target = e.target as Element | null;
      if (isInteractiveElement(target)) return;

      const activeEl = document.activeElement;
      if (isInteractiveElement(activeEl)) return;

      // Don't focus if user is selecting text
      if (window.getSelection()?.toString()) return;

      // For keydown events, ignore modifier/control keys
      if ('key' in e) {
        if (e.key === 'Escape' || e.key === 'Tab' || e.altKey || e.ctrlKey || e.metaKey) {
          return;
        }
      }

      inputRef.current?.focus();
    };
    
    document.addEventListener('click', handleFocus);
    document.addEventListener('keydown', handleFocus);
    return () => {
      document.removeEventListener('click', handleFocus);
      document.removeEventListener('keydown', handleFocus);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input.trim();
      if (cmd) {
        setHistory(prev => [...prev, cmd]);
      }
      setHistoryIndex(-1);
      setInput('');
      onCommand(input); // pass raw input even if empty, the shell handles empty commands
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIdx = historyIndex + 1;
        if (newIdx >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIdx);
          setInput(history[newIdx]);
        }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      onClear();
    } else if (e.key === 'Escape') {
      setInput('');
      setHistoryIndex(-1);
      onEscape?.();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.split(' ');
      if (parts.length === 1) {
        const current = parts[0].toLowerCase();
        const match = commandRegistry.getCommandNames().find(name => name.startsWith(current));
        if (match) {
          setInput(match + ' ');
        }
      } else {
        const cmdName = parts[0].toLowerCase();
        const cmd = commandRegistry.getCommand(cmdName);
        if (cmd) {
          const currentOpt = parts[parts.length - 1];
          if (currentOpt.startsWith('-')) {
            const optKeys: string[] = ['-h', '--help'];
            if (cmd.options) {
              Object.keys(cmd.options).forEach(k => {
                const matches = k.match(/(-[a-zA-Z0-9-]+)/g);
                if (matches) optKeys.push(...matches);
              });
            }
            const match = optKeys.find(o => o.startsWith(currentOpt));
            if (match) {
              parts[parts.length - 1] = match;
              setInput(parts.join(' ') + ' ');
            }
          }
        }
      }
    }
  };

  return (
    <div className="flex items-center justify-between text-zinc-100 font-mono w-full text-xs sm:text-sm bg-[#06080e] border border-[#1c2638] focus-within:border-cyan-500/80 px-2.5 py-1.5 transition-colors">
      <div className="flex items-center flex-1 min-w-0 mr-2">
        {/* Live Status indicator */}
        <div className="flex items-center mr-2.5 shrink-0 select-none">
          {isExecuting ? (
            <TerminalSprite animation="processing" size={14} className="mr-1 shrink-0" />
          ) : (
            <span className="flex items-center gap-1 px-1.5 py-0.2 bg-emerald-950/70 border border-emerald-500/60 text-emerald-400 font-black text-[9px] tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Strong Prompt */}
        <div className="flex items-center mr-2 shrink-0 select-none">
          <span className="text-cyan-400 font-bold whitespace-nowrap">
            {username}@terminal:~$
          </span>
        </div>

        {/* Monospaced Command Buffer */}
        <div className="flex-1 flex items-center relative min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-none outline-none text-zinc-100 focus:ring-0 p-0 shadow-none caret-cyan-400 font-mono text-xs sm:text-sm"
            spellCheck={false}
            autoComplete="off"
            placeholder={isExecuting ? 'Processing command...' : (placeholder || '')}
            disabled={isExecuting}
            autoFocus
          />
          {input.length === 0 && !isExecuting && (
            <span className="inline-block w-2 h-3.5 bg-cyan-400 animate-pulse pointer-events-none select-none -ml-px" />
          )}
        </div>
      </div>

      {/* Return / Enter indicator */}
      <button
        type="button"
        onClick={() => {
          if (input.trim() || !isExecuting) {
            const cmd = input.trim();
            if (cmd) setHistory(prev => [...prev, cmd]);
            setHistoryIndex(-1);
            setInput('');
            onCommand(input);
          }
        }}
        className="px-1.5 py-0.5 bg-[#0f1422] hover:bg-cyan-500 hover:text-black border border-[#1c2638] text-zinc-400 text-[10px] font-bold shrink-0 transition-colors cursor-pointer select-none"
        title="Execute Command (Enter)"
      >
        ↵
      </button>
    </div>
  );
};
