import { GameTemplate as PrismaGameTemplate } from '@prisma/client';

export type TemplateStatus = 'AVAILABLE' | 'EXPERIMENTAL' | 'PLANNED';
export type ProgressionType = 'SEQUENTIAL' | 'FREE_ORDER' | 'CHAIN' | 'CONDITIONAL' | 'TEAM_UNLOCK' | 'BRANCHING_PATH' | 'NARRATIVE' | 'UNLOCK';
export type ValidationType = 'EXACT' | 'CASE_INSENSITIVE' | 'MULTIPLE_CHOICE' | 'MULTI_SELECT' | 'PATTERN' | 'ORDER' | 'MATCH' | 'CUSTOM' | 'STATE_TRANSITION' | 'STATE_MATCH' | 'BUG_HUNT' | 'PIPELINE_MATCH' | 'THE_WITNESS' | 'ROGUE_SCANNER' | 'SILENT_MISSION' | 'SIGNAL_ROUTER' | 'THE_THRESHOLD';
export type InteractionType = 'CHOICE' | 'MULTI_CHOICE' | 'TEXT_INPUT' | 'MATCH' | 'ORDER' | 'SEQUENCE' | 'CODE_LIKE_INPUT' | 'TEAM_ACTION' | 'CHAIN' | 'PUZZLE' | 'FILTER' | 'MULTI_FILTER' | 'SORT' | 'LIMIT' | 'FIELD_IDENTIFICATION' | 'RECORD_IDENTIFICATION' | 'VARIABLE_SIMULATION' | 'LOOP_SIMULATION' | 'BLOCK_CONSTRUCTION' | 'DECISION' | 'RESOURCE_SELECTION' | 'TOOL_SELECTION' | 'PREDICTION' | 'CONSEQUENCE' | 'CODE_REVEAL' | 'NARRATIVE_CLUE' | 'INTERROGATION' | 'TELEMETRY_ANOMALY' | 'MISSION_PLAN' | 'NETWORK_ROUTING' | 'THRESHOLD_CALIBRATION';

export interface TemplateCapabilities {
  timer: boolean;
  teams: 'REQUIRED' | 'OPTIONAL' | 'DISABLED';
  stage: boolean;
  leaderboard: boolean;
  multipleChoice?: boolean;
  progression: ProgressionType;
}

export interface GameTemplateContract {
  id: PrismaGameTemplate;
  name: string;
  description: string;
  category: string;
  version: string;
  status: TemplateStatus;
  capabilities: TemplateCapabilities;
  configurationSchema: Record<string, any>;
  challengeSchema: {
    interactionType: InteractionType;
    validationType: ValidationType;
    schema: Record<string, any>;
  };
  scoringConfig: {
    basePoints: boolean;
    speedBonus: boolean;
    streak: boolean;
    teamScoring: boolean;
    penalties: boolean;
  };
  progressionConfig: {
    type: ProgressionType;
    schema: Record<string, any>;
  };
}
