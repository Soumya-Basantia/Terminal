import type { ReactNode } from 'react';

export type TerminalContext = {
  username: string;
  clearTerminal: () => void;
  // Can expand with user context (team, game, auth token, etc.)
  userToken?: string;
  logout?: () => void;
  pushOutput?: (output: TerminalOutputItem) => void;
  openPanel?: (panelName: string, panelData?: any) => void;
  closePanel?: () => void;
  activePanel?: string | null;
  workspaceData?: any;
  openTeamChat?: () => void;
  closeTeamChat?: () => void;
  isTeamChatOpen?: boolean;
  /** Navigate to a client-side route (React Router navigate) */
  navigate?: (path: string) => void;
};

export type CommandDefinition = {
  name: string;
  aliases?: string[];
  category: 'system' | 'profile' | 'battle' | 'team';
  description: string;
  usage: string;
  examples?: string[];
  options?: Record<string, string>; // e.g. { '-c, --code': 'Join a battle' }
  execute: (
    args: string[],
    flags: Record<string, string | boolean>,
    context: TerminalContext
  ) => ReactNode | Promise<ReactNode>;
};

export type TerminalOutputItem = {
  id: string;
  type: 'command' | 'output';
  content: ReactNode;
};
