import { GameTemplateContract } from './types';

export class TemplateRegistry {
  private templates: Map<string, GameTemplateContract> = new Map();

  register(template: GameTemplateContract) {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): GameTemplateContract | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): GameTemplateContract[] {
    return Array.from(this.templates.values());
  }

  getPlayableTemplates(): GameTemplateContract[] {
    return this.getAllTemplates().filter(t => t.status === 'AVAILABLE');
  }
}

export const registry = new TemplateRegistry();

// Initialize Registry
registry.register({
  id: 'LOGIC_HEIST',
  name: 'Logic Heist',
  description: 'A CodeNex programming logic adventure.',
  category: 'Code',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'CHAIN', // usually sequence or conditional chain
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'BLOCK_CONSTRUCTION',
    validationType: 'STATE_MATCH',
    schema: {
      initialState: 'object',
      targetState: 'object',
      blocks: 'array',
      correctSequence: 'number[]',
      narrative: 'string',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: true,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'CHAIN',
    schema: {},
  },
});

registry.register({
  id: 'QUIZ',
  name: 'Quiz',
  description: 'Classic multiple choice and true/false trivia game.',
  category: 'Trivia',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    multipleChoice: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'CHOICE',
    validationType: 'MULTIPLE_CHOICE',
    schema: {
      options: 'string[]',
      answer: 'string',
      explanation: 'string',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: true,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'RAPID_FIRE',
  name: 'Rapid Fire',
  description: 'Fast-paced sequential questions. Speed is key.',
  category: 'Trivia',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    questionsCount: 'number',
    timerDefault: 'number',
    basePoints: 'number',
    speedBonus: 'number',
    streakBonus: 'boolean',
    maxStreakBonus: 'number',
    shuffleQuestions: 'boolean',
    shuffleOptions: 'boolean',
    allowLateAnswers: 'boolean',
  },
  challengeSchema: {
    interactionType: 'CHOICE', // Also supports TRUE_FALSE, SHORT_TEXT
    validationType: 'EXACT', // Fallback, handles CHOICE and TEXT
    schema: {
      options: 'string[]', // optional
      answer: 'string',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: true,
    streak: true,
    teamScoring: true,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'CHAIN_REACTION',
  name: 'Chain Reaction',
  description: 'Each correct answer unlocks the next challenge.',
  category: 'Puzzle',
  version: '0.1.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    multipleChoice: true,
    progression: 'CHAIN',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'CHOICE',
    validationType: 'MULTIPLE_CHOICE',
    schema: {
      options: 'string[]',
      answer: 'string',
      explanation: 'string',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: true,
    penalties: false,
  },
  progressionConfig: {
    type: 'CHAIN',
    schema: {},
  },
});

registry.register({
  id: 'TREASURE_HUNT',
  name: 'Treasure Hunt',
  description: 'Solve clues to uncover hidden flags.',
  category: 'CTF',
  version: '0.1.0',
  status: 'PLANNED',
  capabilities: {
    timer: true,
    teams: 'REQUIRED',
    stage: true,
    leaderboard: true,
    progression: 'CHAIN',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'TEXT_INPUT',
    validationType: 'EXACT',
    schema: {},
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: true,
    penalties: false,
  },
  progressionConfig: {
    type: 'CHAIN',
    schema: {},
  },
});

registry.register({
  id: 'MATCH',
  name: 'Model Match',
  description: 'Match items from column A to column B.',
  category: 'Puzzle',
  version: '0.1.0',
  status: 'PLANNED',
  capabilities: {
    timer: true,
    teams: 'DISABLED',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'MATCH',
    validationType: 'MATCH',
    schema: {},
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'ARRANGE',
  name: 'Arrange',
  description: 'Order a sequence of items correctly.',
  category: 'Puzzle',
  version: '0.1.0',
  status: 'PLANNED',
  capabilities: {
    timer: true,
    teams: 'DISABLED',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'ORDER',
    validationType: 'ORDER',
    schema: {},
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'TEXT_INPUT',
  name: 'Text Input',
  description: 'Open ended text input validated by rules.',
  category: 'Trivia',
  version: '0.1.0',
  status: 'PLANNED',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'TEXT_INPUT',
    validationType: 'PATTERN',
    schema: {},
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'BUG_HUNT',
  name: 'Dead Code: The Bug Hunt',
  description: 'Investigate malfunctioning systems, reproduce bugs, form hypotheses, apply patches, and verify with regression test suites.',
  category: 'Code',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    allowMultipleAttempts: 'boolean',
  },
  challengeSchema: {
    interactionType: 'DECISION',
    validationType: 'BUG_HUNT',
    schema: {
      title: 'string',
      narrative: 'string',
      system: 'string',
      reproduction: 'object',
      rules: 'array',
      bug: 'object',
      regressionTests: 'array',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: true,
    streak: false,
    teamScoring: false,
    penalties: true,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'TEAM_CHALLENGE',
  name: 'Agentic Arc: Magnetic Dock',
  description: 'Orchestrate agents, tasks, tools, and verifiers using the magnetic dock.',
  category: 'AI',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'TOOL_SELECTION',
    validationType: 'PIPELINE_MATCH',
    schema: {
      scenario: 'object',
      dock: 'object',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: true,
    streak: false,
    teamScoring: true,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'PACKET_RELAY',
  name: 'Packet Relay',
  description: 'Pass information between team members to solve puzzles.',
  category: 'Team',
  version: '0.1.0',
  status: 'PLANNED',
  capabilities: {
    timer: true,
    teams: 'REQUIRED',
    stage: true,
    leaderboard: true,
    progression: 'TEAM_UNLOCK',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'TEAM_ACTION',
    validationType: 'CUSTOM',
    schema: {},
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: true,
    penalties: false,
  },
  progressionConfig: {
    type: 'TEAM_UNLOCK',
    schema: {},
  },
});

registry.register({
  id: 'PROMPT_BATTLE',
  name: 'Prompt Battle',
  description: 'Craft the best prompt to achieve the required output.',
  category: 'AI',
  version: '0.1.0',
  status: 'EXPERIMENTAL',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {},
  challengeSchema: {
    interactionType: 'TEXT_INPUT',
    validationType: 'CUSTOM',
    schema: {},
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'DATA_HUNT',
  name: 'Story Investigation',
  description: 'Solve mysteries using data investigation and logic.',
  category: 'Puzzle',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    multipleChoice: true,
    progression: 'CHAIN',
  },
  configurationSchema: {
    story: 'string',
    dataset: 'array'
  },
  challengeSchema: {
    interactionType: 'FILTER',
    validationType: 'CUSTOM',
    schema: {
      clue: 'string',
      action: 'string',
      field: 'string',
      options: 'string[]',
      correct: 'string',
      onSuccess: 'string'
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: true,
    streak: false,
    teamScoring: true,
    penalties: false,
  },
  progressionConfig: {
    type: 'CHAIN',
    schema: {},
  },
});

registry.register({
  id: 'THE_WITNESS',
  name: 'The Witness',
  description: 'Forensic interrogation and deductive candidate elimination mystery.',
  category: 'Mystery',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    caseTitle: 'string',
    missionBrief: 'string',
    questionBudget: 'number',
    suspects: 'array',
  },
  challengeSchema: {
    interactionType: 'INTERROGATION',
    validationType: 'THE_WITNESS',
    schema: {
      missionBrief: 'string',
      questionBudget: 'number',
      suspects: 'array',
      secret: 'string',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: false,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'ROGUE_SCANNER',
  name: 'Rogue Scanner',
  description: 'AIERA Telemetry anomaly detection, baseline profiling, and multi-variable correlation forensics.',
  category: 'AI / Forensics',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    scenarioTitle: 'string',
    missionBrief: 'string',
    actionBudget: 'number',
    events: 'array',
    baseline: 'object',
  },
  challengeSchema: {
    interactionType: 'TELEMETRY_ANOMALY',
    validationType: 'ROGUE_SCANNER',
    schema: {
      scenarioTitle: 'string',
      missionBrief: 'string',
      actionBudget: 'number',
      events: 'array',
      baseline: 'object',
      anomalousEventIds: 'array',
      anomalyMechanism: 'string',
      scoring: 'object',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: true,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'SILENT_MISSION',
  name: 'Silent Mission',
  description: 'Autonomous mission planning under constraints, dependency orchestration, and causal state transitions.',
  category: 'Systems / Planning',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    scenarioId: 'string',
    title: 'string',
    briefing: 'string',
    initialBattery: 'number',
    initialState: 'object',
    targetState: 'object',
    actions: 'array',
    scoring: 'object',
  },
  challengeSchema: {
    interactionType: 'MISSION_PLAN',
    validationType: 'SILENT_MISSION',
    schema: {
      scenarioId: 'string',
      title: 'string',
      briefing: 'string',
      initialBattery: 'number',
      initialState: 'object',
      targetState: 'object',
      actions: 'array',
      scoring: 'object',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: true,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'SIGNAL_ROUTER',
  name: 'Signal Router',
  description: 'Graph routing, network flow optimization, capacity bottleneck avoidance, and dynamic congestion control.',
  category: 'Networks / Systems',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    scenarioId: 'string',
    scenarioTitle: 'string',
    missionBrief: 'string',
    stream: 'object',
    graph: 'object',
    probeTokens: 'number',
    scoring: 'object',
  },
  challengeSchema: {
    interactionType: 'NETWORK_ROUTING',
    validationType: 'SIGNAL_ROUTER',
    schema: {
      scenarioId: 'string',
      scenarioTitle: 'string',
      missionBrief: 'string',
      stream: 'object',
      graph: 'object',
      probeTokens: 'number',
      scoring: 'object',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: true,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});

registry.register({
  id: 'THE_THRESHOLD',
  name: 'The Threshold',
  description: 'Continuous distribution tuning, ROC confusion matrix trade-offs, asymmetric loss, and distribution drift calibration.',
  category: 'AI / Statistical Inference',
  version: '1.0.0',
  status: 'AVAILABLE',
  capabilities: {
    timer: true,
    teams: 'OPTIONAL',
    stage: true,
    leaderboard: true,
    progression: 'SEQUENTIAL',
  },
  configurationSchema: {
    scenarioId: 'string',
    title: 'string',
    briefing: 'string',
    distributions: 'object',
    probes: 'number',
    costMatrix: 'object',
    scoring: 'object',
  },
  challengeSchema: {
    interactionType: 'THRESHOLD_CALIBRATION',
    validationType: 'THE_THRESHOLD',
    schema: {
      scenarioId: 'string',
      title: 'string',
      briefing: 'string',
      distributions: 'object',
      probes: 'number',
      costMatrix: 'object',
      scoring: 'object',
    },
  },
  scoringConfig: {
    basePoints: true,
    speedBonus: false,
    streak: false,
    teamScoring: false,
    penalties: true,
  },
  progressionConfig: {
    type: 'SEQUENTIAL',
    schema: {},
  },
});
