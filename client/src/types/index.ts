// ─── Shared types between client and server ───────────────────────────────

export type UserRole = 'PLAYER' | 'GAME_MASTER' | 'SUPER_ADMIN' | 'DESIGNER' | 'ADMIN';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type GameTemplate = 'QUIZ' | 'RAPID_FIRE' | 'CHAIN_REACTION' | 'DATA_HUNT' | 'LOGIC_HEIST' | 'BUG_HUNT' | 'THE_WITNESS' | 'ROGUE_SCANNER' | 'SILENT_MISSION' | 'SIGNAL_ROUTER' | 'THE_THRESHOLD';
export type GameStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LeaderboardVisibility = 'HIDDEN' | 'LIVE' | 'FINAL';
export type SessionState = 'LOBBY' | 'ROUND_ACTIVE' | 'SCORING' | 'LEADERBOARD' | 'PAUSED' | 'FINAL';
export type ChallengeType = 'CHOICE' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILTER' | 'MULTI_FILTER' | 'SORT' | 'LIMIT' | 'FIELD_IDENTIFICATION' | 'RECORD_IDENTIFICATION' | 'VARIABLE_SIMULATION' | 'LOOP_SIMULATION' | 'BLOCK_CONSTRUCTION' | 'DECISION' | 'RESOURCE_SELECTION' | 'TOOL_SELECTION' | 'PREDICTION' | 'CONSEQUENCE' | 'CODE_REVEAL' | 'NARRATIVE_CLUE' | 'INTERROGATION' | 'TELEMETRY_ANOMALY' | 'MISSION_PLAN' | 'NETWORK_ROUTING' | 'THRESHOLD_CALIBRATION';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type PlayerStatus = 'ACTIVE' | 'DISCONNECTED' | 'REMOVED';
export type EventMode = 'SEQUENCE' | 'GM_CONTROLLED' | 'RANDOM';
export type GamePurpose = 'NORMAL' | 'FINAL' | 'TIE_BREAKER' | 'BONUS';

export interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
  usn?: string;
  branch?: string;
  section?: string;
  phoneNumber?: string;
  role: UserRole;
  approvalStatus?: ApprovalStatus;
}

export interface Game {
  id: string;
  name: string;
  description?: string;
  template: GameTemplate;
  status: GameStatus;
  maxPlayers: number;
  teamsEnabled: boolean;
  maxTeamSize: number;
  allowLateJoin: boolean;
  allowSpectators: boolean;
  leaderboardVisibility: LeaderboardVisibility;
  allowAnswerChange: boolean;
  negativeMarking: boolean;
  speedBonus: boolean;
  designerId: string;
  createdAt: string;
  updatedAt: string;
  config?: any;
  rounds?: Round[];
  challenges?: Challenge[];
  _count?: { sessions: number; challenges?: number };
}

export interface Round {
  id: string;
  title: string;
  description?: string;
  order: number;
  gameId: string;
  challenges: Challenge[];
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  prompt: string;
  options?: string[];
  answer: string | string[];
  points: number;
  timerSecs: number;
  explanation?: string;
  difficulty: Difficulty;
  hint?: string;
  clue?: string;
  action?: string;
  field?: string;
  correct?: string;
  onSuccess?: string;
  order: number;
  roundId: string;
}

// Safe challenge (no answer) — sent to players
export interface SafeChallenge {
  id: string;
  type: ChallengeType;
  prompt: string;
  options?: string[];
  points: number;
  timerSecs: number;
  hint?: string;
  clue?: string;
  action?: string;
  field?: string;
  difficulty: Difficulty;
  order: number;
  // Enriched from socket
  roundIndex: number;
  challengeIndex: number;
  totalChallenges: number;
  totalRounds: number;
  roundTitle: string;
  challengeEndsAt: string;
}

export interface Session {
  id: string;
  code: string;
  state: SessionState;
  currentRoundIndex: number;
  currentChallengeIndex: number;
  challengeEndsAt?: string;
  startedAt?: string;
  endedAt?: string;
  gameId: string;
  game: {
    name: string;
    template: GameTemplate;
    teamsEnabled: boolean;
    allowLateJoin: boolean;
    leaderboardVisibility: LeaderboardVisibility;
  };
  players: Player[];
  teams: Team[];
}

export interface Player {
  id: string;
  displayName: string;
  socketId?: string;
  status: PlayerStatus;
  score: number;
  isHost: boolean;
  joinedAt: string;
  sessionId: string;
  teamId?: string;
  team?: Team;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  color: string;
  sessionId: string;
  players?: Player[];
}

export interface Submission {
  id: string;
  answer: string | string[];
  isCorrect: boolean;
  score: number;
  timeMs: number;
  submittedAt: string;
  playerId: string;
  teamId?: string;
  challengeId: string;
  sessionId: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName?: string; // for individuals
  name?: string;        // for teams
  score: number;
  color?: string;       // team color
  teamId?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  durationSecs: number;
  status: 'ACTIVE' | 'CLOSED';
}

export interface PollResult {
  optionIndex: number;
  count: number;
}

export interface ActivityLogEntry {
  id: string;
  event: string;
  createdAt: string;
}

// ─── Socket event payloads ───────────────────────────────────────────────────

export interface SessionStatePayload {
  session: {
    id: string;
    code?: string;
    roomCode?: string;
    state?: SessionState;
    status?: string;
    stageMode?: string;
    currentRoundIndex?: number;
    currentChallengeIndex?: number;
    currentPosition?: number;
    currentRun?: number;
    challengeEndsAt?: string | null;
    challengeStartTime?: string | Date | null;
    startedAt?: string | Date | null;
    endedAt?: string | Date | null;
    currentGameId?: string | null;
    currentChallengeId?: string | null;
  };
  game: {
    id: string;
    name: string;
    template: GameTemplate;
    teamsEnabled: boolean;
    leaderboardVisibility: LeaderboardVisibility;
    speedBonus: boolean;
  };
  currentGame?: {
    id: string;
    name: string;
    template: string;
    challenges?: any[];
  } | null;
  event?: any;
  currentChallenge?: SafeChallenge | null;
  currentRound?: { id: string; title: string; order: number } | null;
  totalRounds?: number;
  totalChallengesInRound?: number;
  playerCount: number;
  teamCount: number;
  answersCount?: number;
  leaderboard?: any[];
  chainProgress?: Record<string, string>;
  dockProgress?: any;
  witnessProgress?: any;
  scannerProgress?: any;
  missionProgress?: any;
  routerProgress?: any;
}

export interface EventGame {
  id: string;
  eventId: string;
  gameId: string;
  position: number;
  enabled: boolean;
  purpose: GamePurpose;
  game?: Game;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  clubId?: string;
  creatorId: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  mode: EventMode;
  scheduledFor?: string;
  games?: EventGame[];
  sessions?: Session[];
}
