import React, { useState, useRef, useEffect } from 'react';
import { commandRegistry } from '../core/registry';

interface TerminalInputProps {
  username: string;
  onCommand: (cmd: string) => void;
  onClear: () => void;
  onEscape?: () => void;
  placeholder?: string;
}

export const TerminalInput: React.FC<TerminalInputProps> = ({ 
  username, 
  onCommand, 
  onClear,
  onEscape,
  placeholder 
}) => {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input
  useEffect(() => {
    const focusInput = () => {
      // Don't focus if user is selecting text
      if (window.getSelection()?.toString()) return;
      inputRef.current?.focus();
    };
    
    document.addEventListener('click', focusInput);
    document.addEventListener('keydown', focusInput);
    return () => {
      document.removeEventListener('click', focusInput);
      document.removeEventListener('keydown', focusInput);
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
    <div className="flex items-center text-zinc-100 font-mono w-full text-xs sm:text-sm">
      <span className="text-emerald-400 font-bold mr-2 select-none whitespace-nowrap">
        {username}@terminal:~$
      </span>
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
          placeholder={placeholder || ''}
          autoFocus
        />
        {input.length === 0 && (
          <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse pointer-events-none select-none -ml-px" />
        )}
      </div>
    </div>
  );
};
