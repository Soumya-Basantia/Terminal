import { ValidationType } from './types';

export interface ValidationContext {
  challengeConfig: Record<string, any>;
  submission: string; // the raw answer from the student
}

export interface ValidationResult {
  isCorrect: boolean;
  scoreModifier?: number;
  details?: any;
}

export class Validator {
  static validate(type: ValidationType, context: ValidationContext): ValidationResult {
    switch (type) {
      case 'EXACT':
        return this.exact(context);
      case 'CASE_INSENSITIVE':
        return this.caseInsensitive(context);
      case 'MULTIPLE_CHOICE':
        return this.multipleChoice(context);
      case 'MULTI_SELECT':
        return this.multiSelect(context);
      case 'PATTERN':
        return this.pattern(context);
      case 'ORDER':
        return this.order(context);
      case 'MATCH':
        return this.match(context);
      case 'STATE_MATCH':
        return this.stateMatch(context);
      case 'BUG_HUNT':
        return this.validateBugHunt(context);
      case 'PIPELINE_MATCH':
        return this.validatePipeline(context);
      case 'THE_WITNESS':
        return this.validateTheWitness(context);
      case 'ROGUE_SCANNER':
        return this.validateRogueScanner(context);
      case 'SILENT_MISSION':
        return this.validateSilentMission(context);
      case 'SIGNAL_ROUTER':
        return this.validateSignalRouter(context);
      case 'THE_THRESHOLD':
        return this.validateThreshold(context);
      case 'CUSTOM':
        if (context.challengeConfig.costMatrix && (context.challengeConfig.phase1Baseline || context.challengeConfig.distributions)) {
          return this.validateThreshold(context);
        }
        if (context.challengeConfig.graph && (context.challengeConfig.stream || context.challengeConfig.nodes)) {
          return this.validateSignalRouter(context);
        }
        if (context.challengeConfig.actions && (context.challengeConfig.initialBattery !== undefined || context.challengeConfig.targetState)) {
          return this.validateSilentMission(context);
        }
        if (context.challengeConfig.events && (context.challengeConfig.anomalousEventIds || context.challengeConfig.anomalousEventId)) {
          return this.validateRogueScanner(context);
        }
        if (context.challengeConfig.secret || context.challengeConfig.suspects) {
          return this.validateTheWitness(context);
        }
        if (context.challengeConfig.rules && context.challengeConfig.regressionTests) {
          return this.validateBugHunt(context);
        }
        if (context.challengeConfig.correct !== undefined) {
          return { isCorrect: context.submission === context.challengeConfig.correct };
        }
        if (context.challengeConfig.answer !== undefined) {
          return { isCorrect: context.submission === context.challengeConfig.answer };
        }
        return { isCorrect: false };
      default:
        // By default, fail if we don't know how to validate
        return { isCorrect: false };
    }
  }

  private static exact(context: ValidationContext): ValidationResult {
    const expected = context.challengeConfig.answer;
    if (typeof expected === 'string' && typeof context.submission === 'string') {
        return { isCorrect: context.submission === expected };
    }
    return { isCorrect: String(context.submission) === String(expected) };
  }

  private static caseInsensitive(context: ValidationContext): ValidationResult {
    const expected = (context.challengeConfig.answer as string)?.toLowerCase();
    const actual = context.submission?.toLowerCase();
    return { isCorrect: actual === expected };
  }

  private static multipleChoice(context: ValidationContext): ValidationResult {
    // Usually MCQ is just an exact string match (e.g. "A", "B")
    const expected = context.challengeConfig.answer as string;
    return { isCorrect: context.submission === expected };
  }

  private static multiSelect(context: ValidationContext): ValidationResult {
    try {
      const expected = context.challengeConfig.answer as string[];
      const actual = JSON.parse(context.submission) as string[];
      if (!Array.isArray(expected) || !Array.isArray(actual)) return { isCorrect: false };
      
      const setA = new Set(expected);
      const setB = new Set(actual);
      
      if (setA.size !== setB.size) return { isCorrect: false };
      for (const a of setA) if (!setB.has(a)) return { isCorrect: false };
      return { isCorrect: true };
    } catch {
      return { isCorrect: false };
    }
  }

  private static pattern(context: ValidationContext): ValidationResult {
    try {
      const regexStr = context.challengeConfig.answer as string;
      const regex = new RegExp(regexStr);
      return { isCorrect: regex.test(context.submission) };
    } catch {
      return { isCorrect: false };
    }
  }

  private static order(context: ValidationContext): ValidationResult {
    try {
      const expected = context.challengeConfig.answer as string[];
      const actual = JSON.parse(context.submission) as string[];
      if (!Array.isArray(expected) || !Array.isArray(actual)) return { isCorrect: false };
      if (expected.length !== actual.length) return { isCorrect: false };
      for (let i = 0; i < expected.length; i++) {
        if (expected[i] !== actual[i]) return { isCorrect: false };
      }
      return { isCorrect: true };
    } catch {
      return { isCorrect: false };
    }
  }

  private static match(context: ValidationContext): ValidationResult {
    // For Match, answer could be an object mapping A -> B
    try {
      const expected = context.challengeConfig.answer as Record<string, string>;
      const actual = JSON.parse(context.submission) as Record<string, string>;
      if (!expected || !actual) return { isCorrect: false };
      
      const keys = Object.keys(expected);
      if (keys.length !== Object.keys(actual).length) return { isCorrect: false };
      
      for (const k of keys) {
        if (expected[k] !== actual[k]) return { isCorrect: false };
      }
      return { isCorrect: true };
    } catch {
      return { isCorrect: false };
    }
  }

  private static stateTransition(context: ValidationContext): ValidationResult {
    try {
      const expected = context.challengeConfig.finalState;
      const actual = JSON.parse(context.submission);
      if (!expected || !actual) return { isCorrect: false };
      
      const keys = Object.keys(expected);
      if (keys.length !== Object.keys(actual).length) return { isCorrect: false };
      
      for (const k of keys) {
        if (expected[k] !== actual[k]) return { isCorrect: false };
      }
      return { isCorrect: true };
    } catch {
      return { isCorrect: false };
    }
  }

  /**
   * STATE_MATCH — Logic Heist vault validation.
   * 
   * The client submits a JSON string: { finalState: {...}, sequence: [...], ... }
   * The server independently executes the submitted sequence against the challenge config,
   * computes the resulting state, and compares it to config.targetState.
   * 
   * The client-provided finalState is IGNORED for correctness — the server recomputes it.
   * This ensures server-authoritative validation.
   */
  private static stateMatch(context: ValidationContext): ValidationResult {
    try {
      const config = context.challengeConfig;
      const targetState = config.targetState;
      if (!targetState) {
        if (config.answer !== undefined) {
          return { isCorrect: String(context.submission).trim() === String(config.answer).trim() };
        }
        if (config.correct !== undefined) {
          return { isCorrect: String(context.submission).trim() === String(config.correct).trim() };
        }
        return { isCorrect: false };
      }

      // Parse submission
      let parsed: any;
      try {
        parsed = JSON.parse(context.submission);
      } catch {
        return { isCorrect: false };
      }

      if (!parsed || typeof parsed !== 'object') return { isCorrect: false };

      const sequence: number[] = parsed.sequence;
      if (!Array.isArray(sequence) || sequence.length === 0) {
        return { isCorrect: false };
      }

      // Validate all block IDs exist
      const blocks: any[] = config.blocks || [];
      const blockMap = new Map(blocks.map((b: any) => [b.id, b]));
      for (const blockId of sequence) {
        if (!blockMap.has(blockId)) return { isCorrect: false };
      }

      // Server-side execution of the block sequence
      const state: Record<string, number> = { ...config.initialState };

      for (const blockId of sequence) {
        const block = blockMap.get(blockId)!;
        Validator.executeBlock(block, state);
      }

      // Compare computed state against target
      const targetKeys = Object.keys(targetState);
      const stateKeys = Object.keys(state);
      if (targetKeys.length !== stateKeys.length) return { isCorrect: false };

      for (const k of targetKeys) {
        if (state[k] !== targetState[k]) return { isCorrect: false };
      }

      return { isCorrect: true };
    } catch {
      return { isCorrect: false };
    }
  }

  /**
   * Evaluate a condition against the current state.
   * Supports: >, <, >=, <=, ==, !=, =.
   */
  static evaluateCondition(condition: any, state: Record<string, number>): boolean {
    if (!condition || typeof condition !== 'object') return false;
    const varName = condition.variable;
    if (typeof varName !== 'string') return false;
    const actual = state[varName] ?? 0;
    const target = Number(condition.value);
    if (isNaN(target)) return false;

    switch (condition.operator) {
      case '>': return actual > target;
      case '<': return actual < target;
      case '>=': return actual >= target;
      case '<=': return actual <= target;
      case '==':
      case '=': return actual === target;
      case '!=': return actual !== target;
      default: return false;
    }
  }

  /**
   * Execute a single Logic Heist block against the current state.
   * Supports: SET, ADD, SUB, MUL, LOOP (with configurable loopCount and subOperation), IF (conditional branching).
   */
  static executeBlock(block: any, state: Record<string, number>): void {
    if (!block || typeof block !== 'object') return;

    if (block.operation === 'IF') {
      const condResult = Validator.evaluateCondition(block.condition, state);
      const branch = condResult ? block.trueBranch : block.falseBranch;
      if (branch) {
        Validator.executeBlock(branch, state);
      }
      return;
    }

    const variable = block.variable;
    const value = Number(block.value);
    if (typeof variable !== 'string' || isNaN(value)) return;

    switch (block.operation) {
      case 'SET':
        state[variable] = value;
        break;
      case 'ADD':
        state[variable] = (state[variable] || 0) + value;
        break;
      case 'SUB':
        state[variable] = (state[variable] || 0) - value;
        break;
      case 'MUL':
        state[variable] = (state[variable] || 0) * value;
        break;
      case 'LOOP': {
        const loopCount = Number(block.loopCount) || 0;
        const subOp = block.subOperation || 'ADD';
        for (let i = 0; i < loopCount; i++) {
          if (subOp === 'SUB') {
            state[variable] = (state[variable] || 0) - value;
          } else if (subOp === 'MUL') {
            state[variable] = (state[variable] || 0) * value;
          } else {
            state[variable] = (state[variable] || 0) + value;
          }
        }
        break;
      }
      default:
        // Unknown operation — no-op (safe rejection)
        break;
    }
  }

  /**
   * Server-side execution of a full block sequence.
   * Returns the execution trace for the Stage/Terminal.
   */
  static executeSequence(
    blocks: any[],
    sequence: number[],
    initialState: Record<string, number>
  ): {
    steps: Array<{
      blockId: number;
      label: string;
      stateBefore: Record<string, number>;
      stateAfter: Record<string, number>;
      iterations?: Array<{
        iteration: number;
        stateBefore: Record<string, number>;
        stateAfter: Record<string, number>;
      }>;
      conditionEvaluated?: {
        variable: string;
        operator: string;
        value: number;
        actualValue: number;
        result: boolean;
      };
      branchTaken?: 'TRUE' | 'FALSE';
      executedAction?: {
        label: string;
        operation: string;
        variable: string;
        value: number;
      };
    }>;
    finalState: Record<string, number>;
  } {
    const blockMap = new Map(blocks.map((b: any) => [b.id, b]));
    const state: Record<string, number> = { ...initialState };
    const steps: Array<{
      blockId: number;
      label: string;
      stateBefore: Record<string, number>;
      stateAfter: Record<string, number>;
      iterations?: Array<{
        iteration: number;
        stateBefore: Record<string, number>;
        stateAfter: Record<string, number>;
      }>;
      conditionEvaluated?: {
        variable: string;
        operator: string;
        value: number;
        actualValue: number;
        result: boolean;
      };
      branchTaken?: 'TRUE' | 'FALSE';
      executedAction?: {
        label: string;
        operation: string;
        variable: string;
        value: number;
      };
    }> = [];

    for (const blockId of sequence) {
      const block = blockMap.get(blockId);
      if (!block) continue;
      const before = { ...state };
      let iterations: Array<{
        iteration: number;
        stateBefore: Record<string, number>;
        stateAfter: Record<string, number>;
      }> | undefined = undefined;

      let conditionEvaluated: {
        variable: string;
        operator: string;
        value: number;
        actualValue: number;
        result: boolean;
      } | undefined = undefined;

      let branchTaken: 'TRUE' | 'FALSE' | undefined = undefined;

      let executedAction: {
        label: string;
        operation: string;
        variable: string;
        value: number;
      } | undefined = undefined;

      if (block.operation === 'IF') {
        const cond = block.condition || {};
        const actualVal = state[cond.variable] ?? 0;
        const condResult = Validator.evaluateCondition(cond, state);
        branchTaken = condResult ? 'TRUE' : 'FALSE';
        const actionToExecute = condResult ? block.trueBranch : block.falseBranch;

        conditionEvaluated = {
          variable: cond.variable,
          operator: cond.operator,
          value: Number(cond.value),
          actualValue: actualVal,
          result: condResult
        };

        if (actionToExecute) {
          executedAction = {
            label: actionToExecute.label || `${actionToExecute.operation} ${actionToExecute.variable} ${actionToExecute.value}`,
            operation: actionToExecute.operation,
            variable: actionToExecute.variable,
            value: Number(actionToExecute.value)
          };
          Validator.executeBlock(actionToExecute, state);
        }
      } else if (block.operation === 'LOOP') {
        iterations = [];
        const loopCount = Number(block.loopCount) || 0;
        const variable = block.variable;
        const value = Number(block.value);
        const subOp = block.subOperation || 'ADD';

        for (let i = 1; i <= loopCount; i++) {
          const iterBefore = { ...state };
          if (typeof variable === 'string' && !isNaN(value)) {
            if (subOp === 'SUB') {
              state[variable] = (state[variable] || 0) - value;
            } else if (subOp === 'MUL') {
              state[variable] = (state[variable] || 0) * value;
            } else {
              state[variable] = (state[variable] || 0) + value;
            }
          }
          iterations.push({
            iteration: i,
            stateBefore: iterBefore,
            stateAfter: { ...state }
          });
        }
      } else {
        Validator.executeBlock(block, state);
      }

      steps.push({
        blockId,
        label: block.label || `${block.operation} ${block.variable} ${block.value}`,
        stateBefore: before,
        stateAfter: { ...state },
        iterations,
        conditionEvaluated,
        branchTaken,
        executedAction
      });
    }

    return { steps, finalState: { ...state } };
  }

  /**
   * Helper to check condition for Bug Hunt rules
   */
  static checkBugHuntCondition(actual: any, operator: string, threshold: any): boolean {
    const numActual = Number(actual);
    const numThreshold = Number(threshold);
    const isNumeric = !isNaN(numActual) && !isNaN(numThreshold);

    const left = isNumeric ? numActual : String(actual ?? '');
    const right = isNumeric ? numThreshold : String(threshold ?? '');

    switch (operator) {
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '==':
      case '=': return left == right;
      case '!=': return left != right;
      default: return false;
    }
  }

  /**
   * Evaluate a set of rules against an input object in order.
   * Returns the output of the first rule whose condition is satisfied, or defaultOutput.
   */
  static evaluateBugHuntRules(
    rules: BugHuntRule[],
    input: Record<string, any>,
    defaultOutput: string = 'UNKNOWN'
  ): { output: string; matchedRuleId: string | null; matchedRule: BugHuntRule | null } {
    if (!Array.isArray(rules)) {
      return { output: defaultOutput, matchedRuleId: null, matchedRule: null };
    }

    for (const rule of rules) {
      const val = input?.[rule.field];
      if (val !== undefined && Validator.checkBugHuntCondition(val, rule.operator, rule.threshold)) {
        return { output: rule.output, matchedRuleId: rule.id, matchedRule: rule };
      }
    }

    return { output: defaultOutput, matchedRuleId: null, matchedRule: null };
  }

  /**
   * Run full regression test suite against a set of rules.
   */
  static runRegressionSuite(
    rules: BugHuntRule[],
    testCases: RegressionTestCase[],
    defaultOutput: string = 'UNKNOWN'
  ): {
    allPassed: boolean;
    passedCount: number;
    totalCount: number;
    results: Array<{
      input: Record<string, any>;
      expected: string;
      actual: string;
      passed: boolean;
      matchedRuleId: string | null;
      description?: string;
    }>;
  } {
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return { allPassed: true, passedCount: 0, totalCount: 0, results: [] };
    }

    const results = testCases.map(tc => {
      const evalRes = Validator.evaluateBugHuntRules(rules, tc.input, defaultOutput);
      const passed = String(evalRes.output).trim().toLowerCase() === String(tc.expected).trim().toLowerCase();
      return {
        input: tc.input,
        expected: tc.expected,
        actual: evalRes.output,
        passed,
        matchedRuleId: evalRes.matchedRuleId,
        description: tc.description,
      };
    });

    const passedCount = results.filter(r => r.passed).length;
    const allPassed = passedCount === testCases.length;

    return {
      allPassed,
      passedCount,
      totalCount: testCases.length,
      results,
    };
  }

  /**
   * Validate a BUG_HUNT submission against the challenge configuration.
   * Expects submission to contain patchedRuleId and patch changes.
   */
  static validateBugHunt(context: ValidationContext): ValidationResult & { details?: BugHuntValidationDetails } {
    const config = context.challengeConfig || {};
    const rules: BugHuntRule[] = config.rules || [];
    const testCases: RegressionTestCase[] = config.regressionTests || [];
    const defaultOutput: string = config.defaultOutput || 'UNKNOWN';

    let parsed: any = context.submission;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // If it's a simple string, treat it as ruleId or answer
        if (config.bug?.ruleId && parsed === config.bug.ruleId) {
          return { isCorrect: true };
        }
        return { isCorrect: false };
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { isCorrect: false };
    }

    const patchedRuleId = parsed.patchedRuleId || parsed.ruleId;
    const patch = parsed.patch;

    if (!patchedRuleId || !patch || typeof patch !== 'object') {
      return {
        isCorrect: false,
        details: {
          isCorrect: false,
          allPassed: false,
          passedCount: 0,
          totalCount: testCases.length,
          results: [],
        },
      };
    }

    // Deep clone rules to avoid mutating config
    const clonedRules: BugHuntRule[] = JSON.parse(JSON.stringify(rules));
    const targetRule = clonedRules.find(r => String(r.id) === String(patchedRuleId));

    if (!targetRule) {
      return {
        isCorrect: false,
        details: {
          isCorrect: false,
          allPassed: false,
          passedCount: 0,
          totalCount: testCases.length,
          results: [],
        },
      };
    }

    // Apply patch mutations
    if (patch.threshold !== undefined) targetRule.threshold = patch.threshold;
    if (patch.operator !== undefined) targetRule.operator = patch.operator;
    if (patch.output !== undefined) targetRule.output = patch.output;
    if (patch.field !== undefined) targetRule.field = patch.field;

    // Run regression suite
    const regressionResult = Validator.runRegressionSuite(clonedRules, testCases, defaultOutput);

    const hypothesisCorrect = config.bug?.ruleId
      ? String(parsed.hypothesis) === String(config.bug.ruleId)
      : undefined;

    return {
      isCorrect: regressionResult.allPassed,
      details: {
        ...regressionResult,
        isCorrect: regressionResult.allPassed,
        hypothesisCorrect,
        patchedRuleId,
      },
    };
  }

  /**
   * PIPELINE_MATCH — Magnetic Dock pipeline validation.
   */
  static validatePipeline(context: ValidationContext): ValidationResult & { details?: any } {
    const config = context.challengeConfig || {};
    const dockConfig: DockConfig = config.dock || config;
    if (!dockConfig || !dockConfig.nodes || !dockConfig.transitions) {
      if (config.answer !== undefined) {
        return { isCorrect: String(context.submission).trim() === String(config.answer).trim() };
      }
      return { isCorrect: false };
    }

    let parsed: any = context.submission;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        if (config.answer !== undefined) {
          return { isCorrect: String(context.submission).trim() === String(config.answer).trim() };
        }
        return { isCorrect: false };
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { isCorrect: false };
    }

    const connectionHistory: string[] = parsed.connections || parsed.completedConnections || [];
    const initialNodes = dockConfig.initialNodes || dockConfig.availableNodes || [];
    const maxEnergy = dockConfig.resourceBudget?.energy ?? 6;

    let simState: DockState = {
      unlockedNodes: [...initialNodes],
      completedConnections: [],
      energyRemaining: maxEnergy,
      consequences: [],
      isCompleted: false,
    };

    for (const conn of connectionHistory) {
      const parts = conn.split('->');
      if (parts.length !== 2) continue;
      const res = Validator.evaluateDockAction(dockConfig, simState, {
        action: 'CONNECT',
        sourceNodeId: parts[0],
        targetNodeId: parts[1],
      });
      simState = res.state;
      if (!res.valid && simState.energyRemaining <= 0) {
        break;
      }
    }

    const isCorrect = Boolean(simState.isCompleted && simState.energyRemaining >= 0);
    return {
      isCorrect,
      details: {
        ...simState,
        isCorrect,
      },
    };
  }

  /**
   * Authoritative single-action evaluator for Magnetic Dock interactions.
   * Called dynamically on each user connection attempt over WebSocket or API.
   */
  static evaluateDockAction(
    dockConfig: DockConfig,
    currentState: DockState,
    action: DockActionPayload
  ): {
    valid: boolean;
    state: DockState;
    consequence: string;
    isCompleted: boolean;
  } {
    const initialNodes = dockConfig.initialNodes || dockConfig.availableNodes || [];
    const maxEnergy = dockConfig.resourceBudget?.energy ?? 6;

    const state: DockState = {
      unlockedNodes: currentState?.unlockedNodes ? [...currentState.unlockedNodes] : [...initialNodes],
      completedConnections: currentState?.completedConnections ? [...currentState.completedConnections] : [],
      energyRemaining: currentState?.energyRemaining !== undefined ? currentState.energyRemaining : maxEnergy,
      consequences: currentState?.consequences ? [...currentState.consequences] : [],
      isCompleted: currentState?.isCompleted ?? false,
      score: currentState?.score ?? 0,
      revealed: currentState?.revealed ?? undefined,
    };

    if (action.action === 'RESET') {
      state.unlockedNodes = [...initialNodes];
      state.completedConnections = [];
      state.energyRemaining = maxEnergy;
      state.isCompleted = false;
      state.consequences.push({
        message: 'Investigation reset to baseline configuration.',
        type: 'INFO',
        timestamp: Date.now(),
      });
      return {
        valid: true,
        state,
        consequence: 'Investigation reset.',
        isCompleted: false,
      };
    }

    const { sourceNodeId, targetNodeId } = action;
    if (!sourceNodeId || !targetNodeId) {
      return {
        valid: false,
        state,
        consequence: 'Invalid action: Source and target nodes are required.',
        isCompleted: state.isCompleted,
      };
    }

    const nodeMap = new Map((dockConfig.nodes || []).map(n => [n.id, n]));
    const sourceNode = nodeMap.get(sourceNodeId);
    const targetNode = nodeMap.get(targetNodeId);

    if (!sourceNode || !targetNode) {
      return {
        valid: false,
        state,
        consequence: 'System Error: One or more selected nodes do not exist in the manifest.',
        isCompleted: state.isCompleted,
      };
    }

    const unlockedSet = new Set(state.unlockedNodes);
    if (!unlockedSet.has(sourceNodeId) || !unlockedSet.has(targetNodeId)) {
      return {
        valid: false,
        state,
        consequence: 'Access Denied: One or more selected nodes have not been unlocked yet.',
        isCompleted: state.isCompleted,
      };
    }

    const connectionKey = `${sourceNodeId}->${targetNodeId}`;
    if (state.completedConnections.includes(connectionKey)) {
      return {
        valid: false,
        state,
        consequence: 'Redundant Link: This connection has already been established.',
        isCompleted: state.isCompleted,
      };
    }

    const transition = dockConfig.transitions ? dockConfig.transitions[connectionKey] : undefined;

    if (!transition) {
      const penaltyCost = 1;
      state.energyRemaining = Math.max(0, state.energyRemaining - penaltyCost);
      const msg = `Incompatible Interface: Cannot bridge ${sourceNode.label} to ${targetNode.label}. (Energy -${penaltyCost})`;
      state.consequences.push({
        message: msg,
        type: 'WARNING',
        timestamp: Date.now(),
      });
      return {
        valid: false,
        state,
        consequence: msg,
        isCompleted: state.isCompleted,
      };
    }

    const cost = transition.energyCost ?? 1;
    if (state.energyRemaining < cost) {
      const msg = `Insufficient Energy: Action requires ${cost} units, but only ${state.energyRemaining} remains.`;
      state.consequences.push({
        message: msg,
        type: 'WARNING',
        timestamp: Date.now(),
      });
      return {
        valid: false,
        state,
        consequence: msg,
        isCompleted: state.isCompleted,
      };
    }

    state.energyRemaining -= cost;

    if (!transition.valid) {
      const msg = transition.consequence?.statusMessage || `Operational Failure: ${sourceNode.label} failed to process ${targetNode.label}.`;
      state.consequences.push({
        message: msg,
        type: 'WARNING',
        timestamp: Date.now(),
      });
      return {
        valid: false,
        state,
        consequence: msg,
        isCompleted: state.isCompleted,
      };
    }

    state.completedConnections.push(connectionKey);

    if (transition.consequence?.unlockedNodes) {
      for (const node of transition.consequence.unlockedNodes) {
        if (!unlockedSet.has(node)) {
          state.unlockedNodes.push(node);
          unlockedSet.add(node);
        }
      }
    }

    const msg = transition.consequence?.statusMessage || `Link Established: ${sourceNode.label} -> ${targetNode.label}`;
    state.consequences.push({
      message: msg,
      type: 'SUCCESS',
      timestamp: Date.now(),
    });

    if (transition.consequence?.isTerminalSuccess) {
      state.isCompleted = true;
      state.revealed = dockConfig.reveal;
    }

    return {
      valid: true,
      state,
      consequence: msg,
      isCompleted: state.isCompleted,
    };
  }

  /**
   * Validate THE_WITNESS accusation submission against challenge config.
   */
  static validateTheWitness(context: ValidationContext): ValidationResult {
    const config = context.challengeConfig || {};
    const secret = String(config.secret || config.culpritId || config.answer || '').trim();
    if (!secret) return { isCorrect: false };

    let accusedId = '';
    let accusedName = '';
    if (typeof context.submission === 'object' && context.submission !== null) {
      const sub = context.submission as any;
      accusedId = String(sub.accusedSuspectId || sub.suspectId || sub.id || sub.answer || '').trim();
      accusedName = String(sub.accusedSuspectName || sub.name || '').trim();
    } else {
      try {
        const parsed = JSON.parse(String(context.submission));
        if (typeof parsed === 'object' && parsed !== null) {
          accusedId = String(parsed.accusedSuspectId || parsed.suspectId || parsed.id || parsed.answer || '').trim();
          accusedName = String(parsed.accusedSuspectName || parsed.name || '').trim();
        } else {
          accusedId = String(parsed).trim();
        }
      } catch {
        accusedId = String(context.submission || '').trim();
      }
    }

    const suspects: Array<Record<string, any>> = Array.isArray(config.suspects) ? config.suspects : [];
    const targetSuspect = suspects.find(
      (s: any) => String(s.id).toLowerCase() === secret.toLowerCase() ||
                  String(s.name).toLowerCase() === secret.toLowerCase()
    );

    const isMatch = Boolean(
      (accusedId && accusedId.toLowerCase() === secret.toLowerCase()) ||
      (accusedName && targetSuspect && accusedName.toLowerCase() === String(targetSuspect.name).toLowerCase()) ||
      (accusedId && targetSuspect && accusedId.toLowerCase() === String(targetSuspect.name).toLowerCase())
    );

    return { isCorrect: isMatch };
  }

  static evaluateWitnessCondition(
    suspect: Record<string, any>,
    query: { attribute: string; operator: string; value: any }
  ): boolean {
    if (!suspect || !query) return false;
    const attr = String(query.attribute || '').trim();
    const rawVal = suspect[attr] !== undefined
      ? suspect[attr]
      : (attr === 'authType' ? suspect.authMethod : (attr === 'authMethod' ? suspect.authType : undefined));
    const targetVal = query.value;
    const op = String(query.operator || '==').toUpperCase().trim();

    // Direct suspect identification question
    if (attr === 'culprit' || attr === 'suspect' || attr === 'id' || attr === 'name') {
      const sId = String(suspect.id || '').toLowerCase();
      const sName = String(suspect.name || '').toLowerCase();
      const t = String(targetVal || '').toLowerCase();
      const eq = (sId === t || sName === t);
      return (op === '!=' || op === 'NOT_EQUALS' || op === '≠') ? !eq : eq;
    }

    if (rawVal === undefined || rawVal === null) return false;

    // Range / inequality operators
    if (op === '>=' || op === '<=' || op === '>' || op === '<') {
      const numRaw = Number(rawVal);
      const numTarget = Number(targetVal);
      if (!isNaN(numRaw) && !isNaN(numTarget)) {
        if (op === '>=') return numRaw >= numTarget;
        if (op === '<=') return numRaw <= numTarget;
        if (op === '>') return numRaw > numTarget;
        if (op === '<') return numRaw < numTarget;
      }
      // String timestamps / alpha e.g. "02:44" >= "02:30"
      const strRaw = String(rawVal);
      const strTarget = String(targetVal);
      if (op === '>=') return strRaw >= strTarget;
      if (op === '<=') return strRaw <= strTarget;
      if (op === '>') return strRaw > strTarget;
      if (op === '<') return strRaw < strTarget;
    }

    if (op === '==' || op === '=' || op === 'EQUALS') {
      return String(rawVal).trim().toLowerCase() === String(targetVal).trim().toLowerCase();
    }

    if (op === '!=' || op === 'NOT_EQUALS' || op === '≠') {
      return String(rawVal).trim().toLowerCase() !== String(targetVal).trim().toLowerCase();
    }

    if (op === 'CONTAINS') {
      return String(rawVal).toLowerCase().includes(String(targetVal).toLowerCase());
    }

    if (op === 'IN') {
      if (Array.isArray(targetVal)) {
        return targetVal.map(v => String(v).toLowerCase()).includes(String(rawVal).toLowerCase());
      }
      return String(targetVal).toLowerCase().includes(String(rawVal).toLowerCase());
    }

    return false;
  }

  /**
   * Validate ROGUE_SCANNER final accusation submission against challenge config.
   */
  static validateRogueScanner(context: ValidationContext): ValidationResult {
    const config = context.challengeConfig || {};
    const anomalousEventIds: string[] = Array.isArray(config.anomalousEventIds)
      ? config.anomalousEventIds.map((id: any) => String(id).toUpperCase().trim())
      : (config.anomalousEventId ? [String(config.anomalousEventId).toUpperCase().trim()] : ['EVT-11', 'EVT-17']);

    const expectedMechanism = String(config.anomalyMechanism || 'PERIODIC_BEACON').toUpperCase().trim();

    let targetEventId = '';
    let selectedMechanism = '';
    let supportingEvidence = '';

    if (typeof context.submission === 'object' && context.submission !== null) {
      const sub = context.submission as any;
      targetEventId = String(sub.anomalousEventId || sub.eventId || sub.targetEventId || sub.answer || '').toUpperCase().trim();
      selectedMechanism = String(sub.anomalyMechanism || sub.mechanism || '').toUpperCase().trim();
      supportingEvidence = String(sub.supportingEvidence || sub.corroboratingClue || sub.clue || '').toUpperCase().trim();
    } else {
      try {
        const parsed = JSON.parse(String(context.submission));
        if (typeof parsed === 'object' && parsed !== null) {
          targetEventId = String(parsed.anomalousEventId || parsed.eventId || parsed.targetEventId || parsed.answer || '').toUpperCase().trim();
          selectedMechanism = String(parsed.anomalyMechanism || parsed.mechanism || '').toUpperCase().trim();
          supportingEvidence = String(parsed.supportingEvidence || parsed.corroboratingClue || parsed.clue || '').toUpperCase().trim();
        } else {
          targetEventId = String(parsed).toUpperCase().trim();
        }
      } catch {
        targetEventId = String(context.submission || '').toUpperCase().trim();
      }
    }

    // Check if target event is one of the rogue events
    const isTargetCorrect = Boolean(targetEventId && anomalousEventIds.includes(targetEventId));

    // Mechanism check (if provided): matches periodic beacon / cadence / timing beacon / beaconing
    const mechanismValid = !selectedMechanism ||
      selectedMechanism === expectedMechanism ||
      selectedMechanism.includes('BEACON') ||
      expectedMechanism.includes(selectedMechanism) ||
      selectedMechanism.includes('PERIODIC') ||
      selectedMechanism.includes('CADENCE');

    const isCorrect = isTargetCorrect && mechanismValid;

    // Check for corroborating clue / supporting evidence
    // e.g. references the other rogue event (EVT-11 or EVT-17), 600s interval, or ext-staging-relay
    let hasCorroboratingClue = false;
    if (isCorrect) {
      const otherRogue = anomalousEventIds.find(id => id !== targetEventId);
      if (
        (otherRogue && supportingEvidence.includes(otherRogue)) ||
        supportingEvidence.includes('600') ||
        supportingEvidence.includes('RELAY') ||
        supportingEvidence.includes('CADENCE') ||
        supportingEvidence.includes('STAGING') ||
        (selectedMechanism && (selectedMechanism === expectedMechanism || selectedMechanism.includes('BEACON')))
      ) {
        hasCorroboratingClue = true;
      }
    }

    return {
      isCorrect,
      details: {
        targetEventId,
        selectedMechanism,
        supportingEvidence,
        hasCorroboratingClue,
      }
    };
  }

  /**
   * Server-authoritative probe processor for ROGUE_SCANNER.
   */
  static evaluateScannerProbe(
    config: Record<string, any>,
    currentState: Record<string, any>,
    actionPayload: {
      action: 'SCAN_BASELINE' | 'FILTER_STREAM' | 'PATTERN_OVERLAY' | 'COMPARE_EVENTS' | 'DEEP_TRACE' | 'SET_HYPOTHESIS';
      [key: string]: any;
    }
  ): {
    valid: boolean;
    error?: string;
    actionResult: any;
    updatedState: Record<string, any>;
  } {
    const events: Array<Record<string, any>> = Array.isArray(config.events) ? config.events : [];
    const baseline = config.baseline || {};
    const probeCosts: Record<string, number> = {
      SCAN_BASELINE: 1,
      FILTER_STREAM: 1,
      PATTERN_OVERLAY: 2,
      COMPARE_EVENTS: 2,
      DEEP_TRACE: 2,
      SET_HYPOTHESIS: 0,
      ...(config.probeCosts || {}),
    };

    const action = actionPayload.action;
    const cost = probeCosts[action] !== undefined ? probeCosts[action] : 1;

    // Security check: reject negative token cost injection from client
    if (cost < 0 || (actionPayload.cost !== undefined && Number(actionPayload.cost) < 0)) {
      return {
        valid: false,
        error: 'Negative token costs are forbidden',
        actionResult: null,
        updatedState: currentState,
      };
    }

    let tokensRemaining = Number(currentState.actionTokensRemaining ?? config.actionBudget ?? 10);
    let tokensUsed = Number(currentState.tokensUsed ?? 0);
    const unlockedTraces: string[] = Array.isArray(currentState.unlockedTraces) ? [...currentState.unlockedTraces] : [];
    let activeHypothesis = currentState.activeHypothesis || null;
    const overlayHistory: any[] = Array.isArray(currentState.overlayHistory) ? [...currentState.overlayHistory] : [];
    const clearedFalsePositives: string[] = Array.isArray(currentState.clearedFalsePositives) ? [...currentState.clearedFalsePositives] : [];
    const probeLog: any[] = Array.isArray(currentState.probeLog) ? [...currentState.probeLog] : [];

    if (tokensRemaining < cost) {
      return {
        valid: false,
        error: 'Investigation token budget exhausted',
        actionResult: null,
        updatedState: currentState,
      };
    }

    let actionResult: any = null;

    if (action === 'SCAN_BASELINE') {
      const targetProtocol = String(actionPayload.protocol || actionPayload.filterKey || '').trim().toUpperCase();
      const baselineTarget = targetProtocol || 'ALL_PROTOCOLS';

      if (probeLog.some(p => p.action === 'SCAN_BASELINE' && p.target === baselineTarget)) {
        return {
          valid: false,
          error: `Duplicate probe: baseline profile for ${baselineTarget} has already been retrieved`,
          actionResult: null,
          updatedState: currentState,
        };
      }

      const protocols = baseline.protocols || {};
      const profile = targetProtocol && protocols[targetProtocol]
        ? { [targetProtocol]: protocols[targetProtocol] }
        : baseline;
      actionResult = {
        type: 'BASELINE_DATA',
        data: profile,
        registeredNodes: baseline.registeredNodes || [],
        knownExternalRelays: baseline.knownExternalRelays || [],
      };
      tokensRemaining -= cost;
      tokensUsed += cost;
      probeLog.push({
        id: 'prb_' + Date.now(),
        action: 'SCAN_BASELINE',
        target: baselineTarget,
        summary: `Baseline profile accessed for ${baselineTarget}`,
        timestamp: Date.now(),
      });
    } else if (action === 'FILTER_STREAM') {
      const filterKey = String(actionPayload.filterKey || 'protocol').trim();
      const filterValue = String(actionPayload.filterValue || '').trim().toUpperCase();
      const filterTarget = `${filterKey}=${filterValue}`;

      if (probeLog.some(p => p.action === 'FILTER_STREAM' && p.target === filterTarget)) {
        return {
          valid: false,
          error: `Duplicate probe: stream filter [${filterTarget}] was already applied`,
          actionResult: null,
          updatedState: currentState,
        };
      }

      const matchingIds = events
        .filter((evt: any) => {
          if (!filterValue) return true;
          const val = String(evt[filterKey] || '').toUpperCase();
          return val === filterValue || val.includes(filterValue);
        })
        .map((evt: any) => evt.id);

      actionResult = {
        type: 'FILTER_RESULT',
        filterKey,
        filterValue,
        matchingIds,
        matchCount: matchingIds.length,
      };
      tokensRemaining -= cost;
      tokensUsed += cost;
      probeLog.push({
        id: 'prb_' + Date.now(),
        action: 'FILTER_STREAM',
        target: filterTarget,
        summary: `Stream filtered: ${matchingIds.length} events match`,
        timestamp: Date.now(),
      });
    } else if (action === 'PATTERN_OVERLAY' || action === 'COMPARE_EVENTS') {
      const selectedIds: string[] = Array.isArray(actionPayload.eventIds)
        ? actionPayload.eventIds.map((id: any) => String(id).toUpperCase().trim())
        : [];

      if (selectedIds.length < 2 || selectedIds.length > 4) {
        return {
          valid: false,
          error: 'Pattern Overlay requires selecting between 2 and 4 events',
          actionResult: null,
          updatedState: currentState,
        };
      }

      const sortedKey = selectedIds.slice().sort().join(',');
      if (overlayHistory.some(o => Array.isArray(o.selectedIds) && o.selectedIds.slice().sort().join(',') === sortedKey)) {
        return {
          valid: false,
          error: `Duplicate probe: pattern overlay for [${selectedIds.join(', ')}] was already analyzed`,
          actionResult: null,
          updatedState: currentState,
        };
      }

      const selectedEvents = events.filter((e: any) => selectedIds.includes(String(e.id).toUpperCase()));
      if (selectedEvents.length !== selectedIds.length) {
        return {
          valid: false,
          error: 'One or more selected event IDs do not exist in the active telemetry stream',
          actionResult: null,
          updatedState: currentState,
        };
      }

      // Sort by timestamp
      selectedEvents.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

      // Calculate time deltas
      const comparisons: any[] = [];
      let isMechanicalCadence = false;
      let hasIdenticalPayload = false;
      let hasSharedUnmappedTarget = false;

      for (let i = 0; i < selectedEvents.length - 1; i++) {
        const e1 = selectedEvents[i];
        const e2 = selectedEvents[i + 1];

        // Parse HH:MM:SS to seconds
        const toSeconds = (ts: string) => {
          const parts = ts.split(':').map(Number);
          return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
        };
        const deltaSec = Math.abs(toSeconds(e2.timestamp) - toSeconds(e1.timestamp));
        const payloadDelta = Math.abs(Number(e2.payloadSizeMb) - Number(e1.payloadSizeMb));

        // Exact 600.00s (10 min) or exact round intervals indicate mechanical clock
        if (deltaSec > 0 && deltaSec % 60 === 0) {
          isMechanicalCadence = true;
        }
        if (payloadDelta === 0) {
          hasIdenticalPayload = true;
        }
        if (e1.targetNode === 'ext-staging-relay' || e2.targetNode === 'ext-staging-relay') {
          hasSharedUnmappedTarget = true;
        }

        comparisons.push({
          pair: `${e1.id} ⟷ ${e2.id}`,
          deltaSeconds: deltaSec,
          payloadDeltaMb: payloadDelta,
          sameSource: e1.sourceNode === e2.sourceNode,
          sameTarget: e1.targetNode === e2.targetNode,
          sameProtocol: e1.protocol === e2.protocol,
        });
      }

      const includesRoguePair = selectedIds.includes('EVT-11') && selectedIds.includes('EVT-17');
      const correlationDetected = includesRoguePair || (isMechanicalCadence && hasIdenticalPayload && hasSharedUnmappedTarget);

      actionResult = {
        type: 'PATTERN_OVERLAY_MATRIX',
        selectedIds,
        comparisons,
        isMechanicalCadence,
        hasIdenticalPayload,
        hasSharedUnmappedTarget,
        correlationDetected,
        correlationSummary: correlationDetected
          ? 'STRONG CORRELATION: Strict 600.00s interval, identical payload size, and shared unmapped relay destination detected.'
          : 'NO ABNORMAL REPETITION: Events show natural variance and standard operational routing.',
      };

      tokensRemaining -= cost;
      tokensUsed += cost;
      overlayHistory.push(actionResult);
      probeLog.push({
        id: 'prb_' + Date.now(),
        action: 'PATTERN_OVERLAY',
        target: selectedIds.join(', '),
        summary: correlationDetected ? 'Correlation Detected (Automated Beacon)' : 'Pattern Overlay (Normal variance)',
        timestamp: Date.now(),
      });
    } else if (action === 'DEEP_TRACE') {
      const targetId = String(actionPayload.eventId || '').toUpperCase().trim();
      const targetEvent = events.find((e: any) => String(e.id).toUpperCase() === targetId);

      if (!targetEvent) {
        return {
          valid: false,
          error: 'Event not found in telemetry stream',
          actionResult: null,
          updatedState: currentState,
        };
      }

      if (unlockedTraces.includes(targetId)) {
        return {
          valid: false,
          error: `Duplicate probe: trace for event ${targetId} is already unlocked`,
          actionResult: null,
          updatedState: currentState,
        };
      }

      unlockedTraces.push(targetId);

      const falsePositiveIds = ['EVT-08', 'EVT-14', 'EVT-19'];
      if (falsePositiveIds.includes(targetId) && !clearedFalsePositives.includes(targetId)) {
        clearedFalsePositives.push(targetId);
      }

      const trace = targetEvent.traceDetails || {
        processName: 'unknown-process',
        verifiedSource: 'Standard cluster daemon',
        notes: 'No abnormal signatures logged in kernel journal.',
      };

      actionResult = {
        type: 'DEEP_TRACE_RESULT',
        eventId: targetId,
        traceDetails: trace,
        isClearedFalsePositive: falsePositiveIds.includes(targetId),
        isRogueEvent: ['EVT-11', 'EVT-17'].includes(targetId),
      };

      tokensRemaining -= cost;
      tokensUsed += cost;
      probeLog.push({
        id: 'prb_' + Date.now(),
        action: 'DEEP_TRACE',
        target: targetId,
        summary: `Trace on ${targetId}: ${trace.verifiedSource}`,
        timestamp: Date.now(),
      });
    } else if (action === 'SET_HYPOTHESIS') {
      const hypothesis = String(actionPayload.hypothesis || '').trim();
      activeHypothesis = hypothesis;
      actionResult = {
        type: 'HYPOTHESIS_SET',
        hypothesis,
      };
      probeLog.push({
        id: 'prb_' + Date.now(),
        action: 'SET_HYPOTHESIS',
        target: hypothesis,
        summary: `Hypothesis recorded: ${hypothesis}`,
        timestamp: Date.now(),
      });
    } else {
      return {
        valid: false,
        error: `Unknown scanner probe action: ${action}`,
        actionResult: null,
        updatedState: currentState,
      };
    }

    const updatedState = {
      actionTokensRemaining: tokensRemaining,
      tokensUsed,
      unlockedTraces,
      activeHypothesis,
      overlayHistory,
      clearedFalsePositives,
      probeLog,
    };

    return {
      valid: true,
      actionResult,
      updatedState,
    };
  }

  /**
   * Deterministic server-authoritative simulation for SILENT_MISSION.
   */
  static simulateMissionPlan(
    config: Record<string, any>,
    actionPlan: Array<{ slot: number; actionId: string; params?: Record<string, any> }>,
    attemptNumber: number = 1,
    failedRunsCount: number = 0
  ) {
    const initialBattery = Number(config.batteryCapacity ?? config.initialBattery ?? 40);
    let remainingBattery = initialBattery;
    let currentEnv: Record<string, any> = { ...(config.initialState || {}) };

    const configuredActions: Array<Record<string, any>> = Array.isArray(config.actions) ? config.actions : [];
    const actionMap = new Map<string, Record<string, any>>();
    for (const a of configuredActions) {
      if (a && a.id) {
        actionMap.set(String(a.id).trim(), a);
      }
    }

    const executionTrace: Array<{
      slot: number;
      actionId: string;
      label: string;
      actionName?: string;
      status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
      batteryCost: number;
      penaltyCost: number;
      failureReason?: string;
      causalExplanation?: string;
      missingState?: Record<string, any>;
      missingPrerequisite?: { key: string; required: any; actual: any } | null;
      stateChanges?: Record<string, any>;
      stateBefore?: Record<string, any>;
      resultingState: Record<string, any>;
      isIrreversible?: boolean;
    }> = [];

    let failedStepIndex: number | null = null;
    let failureExplanation: string | undefined = undefined;

    // Reject empty action plan
    if (!actionPlan || actionPlan.length === 0) {
      return {
        isSuccess: false,
        targetAchieved: false,
        executionTrace: [],
        finalState: currentEnv,
        initialBattery,
        remainingBattery,
        totalBatterySpent: 0,
        stepsCompleted: 0,
        totalSteps: 0,
        failedStepIndex: 0,
        failureExplanation: 'No actions programmed in planning corridor.',
        scoreBreakdown: {
          basePoints: 0,
          batteryBonus: 0,
          firstRunBonus: 0,
          cleanSheetBonus: 0,
          retryPenalty: Number(config.scoring?.retryPenalty ?? -15),
          totalScore: Number(config.scoring?.retryPenalty ?? -15),
        },
      };
    }

    let failedMissingPrerequisite: { key: string; required: any; actual: any } | null = null;

    // Step-by-step authoritative execution
    for (let i = 0; i < actionPlan.length; i++) {
      const step = actionPlan[i];
      const actionId = String(step.actionId || '').trim();
      const actionDef = actionMap.get(actionId);
      const stateBefore = { ...currentEnv };
      const actionName = actionDef?.name || actionDef?.label || actionId;

      // Check if action exists in configuration
      if (!actionDef) {
        const penalty = 1;
        remainingBattery = Math.max(0, remainingBattery - penalty);
        failedStepIndex = i;
        failureExplanation = `Unknown or unauthorized action: ${actionId}`;
        executionTrace.push({
          slot: step.slot ?? i,
          actionId,
          actionName,
          label: actionName,
          status: 'FAILED',
          batteryCost: 0,
          penaltyCost: penalty,
          stateBefore,
          failureReason: failureExplanation,
          causalExplanation: failureExplanation,
          resultingState: { ...currentEnv },
        });
        break;
      }

      const cost = Number(actionDef.cost ?? 1);
      // Security check: reject negative action cost
      if (cost < 0) {
        failedStepIndex = i;
        failureExplanation = 'Security violation: negative action costs are forbidden';
        executionTrace.push({
          slot: step.slot ?? i,
          actionId,
          actionName,
          label: actionName,
          status: 'FAILED',
          batteryCost: 0,
          penaltyCost: 0,
          stateBefore,
          failureReason: failureExplanation,
          causalExplanation: failureExplanation,
          resultingState: { ...currentEnv },
        });
        break;
      }

      // Check battery sufficiency
      if (remainingBattery < cost) {
        failedStepIndex = i;
        failureExplanation = `BATTERY EXHAUSTION: Battery depleted before executing [${actionName}]. Required: ⚡${cost}, Remaining: ⚡${remainingBattery}.`;
        executionTrace.push({
          slot: step.slot ?? i,
          actionId,
          actionName,
          label: actionName,
          status: 'FAILED',
          batteryCost: 0,
          penaltyCost: 0,
          stateBefore,
          failureReason: failureExplanation,
          causalExplanation: failureExplanation,
          resultingState: { ...currentEnv },
          isIrreversible: Boolean(actionDef.isIrreversible),
        });
        break;
      }

      // Check prerequisites
      const prerequisites: Record<string, any> = actionDef.prerequisites || actionDef.prereqs || {};
      let prerequisiteFailed = false;
      let missingState: Record<string, any> | undefined = undefined;
      let reason = '';

      for (const [key, expectedVal] of Object.entries(prerequisites)) {
        const actualVal = currentEnv[key];
        let matches = false;

        if (typeof expectedVal === 'boolean') {
          matches = Boolean(actualVal) === expectedVal;
        } else if (typeof expectedVal === 'number') {
          matches = Number(actualVal) === expectedVal;
        } else {
          matches = String(actualVal ?? '').toLowerCase() === String(expectedVal).toLowerCase();
        }

        if (!matches) {
          prerequisiteFailed = true;
          missingState = { [key]: expectedVal, actual: actualVal ?? null };
          failedMissingPrerequisite = { key, required: expectedVal, actual: actualVal ?? null };
          reason = actionDef.failureNotice ||
            `Action [${actionName}] requires environmental state [${key}] to be '${expectedVal}', but current state is '${actualVal ?? 'OFFLINE'}'.`;
          break;
        }
      }

      if (prerequisiteFailed) {
        const penalty = 1;
        remainingBattery = Math.max(0, remainingBattery - penalty);
        failedStepIndex = i;
        failureExplanation = reason;
        executionTrace.push({
          slot: step.slot ?? i,
          actionId,
          actionName,
          label: actionName,
          status: 'FAILED',
          batteryCost: 0,
          penaltyCost: penalty,
          stateBefore,
          failureReason: reason,
          causalExplanation: reason,
          missingState,
          resultingState: { ...currentEnv },
          isIrreversible: Boolean(actionDef.isIrreversible),
        });
        // Stop execution on failure to enable failure recovery / in-place splicing
        break;
      }

      // Action succeeds: deduct battery and apply post-conditions
      remainingBattery -= cost;
      const postConditions: Record<string, any> = actionDef.postconditions || actionDef.postConditions || {};
      const stateChanges: Record<string, any> = {};

      for (const [key, val] of Object.entries(postConditions)) {
        currentEnv[key] = val;
        stateChanges[key] = val;
      }

      executionTrace.push({
        slot: step.slot ?? i,
        actionId,
        actionName,
        label: actionName,
        status: 'SUCCESS',
        batteryCost: cost,
        penaltyCost: 0,
        stateBefore,
        stateChanges,
        resultingState: { ...currentEnv },
        isIrreversible: Boolean(actionDef.isIrreversible),
      });
    }

    // Mark any remaining planned steps as SKIPPED
    if (failedStepIndex !== null && failedStepIndex + 1 < actionPlan.length) {
      for (let j = failedStepIndex + 1; j < actionPlan.length; j++) {
        const step = actionPlan[j];
        const def = actionMap.get(String(step.actionId || '').trim());
        executionTrace.push({
          slot: step.slot ?? j,
          actionId: step.actionId,
          actionName: def?.name || def?.label || step.actionId,
          label: def?.name || def?.label || step.actionId,
          status: 'SKIPPED',
          batteryCost: 0,
          penaltyCost: 0,
          resultingState: { ...currentEnv },
        });
      }
    }

    // Evaluate Win Condition against targetState
    const targetState: Record<string, any> = config.targetState || {};
    let targetAchieved = true;

    for (const [key, expectedVal] of Object.entries(targetState)) {
      const actualVal = currentEnv[key];
      let matches = false;
      if (typeof expectedVal === 'boolean') {
        matches = Boolean(actualVal) === expectedVal;
      } else if (typeof expectedVal === 'number') {
        matches = Number(actualVal) === expectedVal;
      } else {
        matches = String(actualVal ?? '').toLowerCase() === String(expectedVal).toLowerCase();
      }
      if (!matches) {
        targetAchieved = false;
        break;
      }
    }

    const isSuccess = targetAchieved && failedStepIndex === null;

    if (!targetAchieved && failedStepIndex === null) {
      failureExplanation = 'TARGET INCOMPLETE: All planned actions executed successfully, but required target state was not reached. Review mission objectives.';
    }

    // Calculate Scoring Formula
    const scoring = config.scoring || {};
    const basePoints = Number(scoring.basePoints ?? 100);
    const batteryBonusPerUnit = Number(scoring.batteryBonusMultiplier ?? scoring.batteryBonusPerUnit ?? 10);
    const firstRunBonus = Number(scoring.firstRunBonus ?? 30);
    const cleanSheetBonus = Number(scoring.cleanSheetBonus ?? 20);
    const retryPenalty = Number(scoring.retryPenalty ?? -15);

    let totalScore = 0;
    let earnedBatteryBonus = 0;
    let earnedFirstRunBonus = 0;
    let earnedCleanSheetBonus = 0;

    if (isSuccess) {
      totalScore += basePoints;
      earnedBatteryBonus = remainingBattery * batteryBonusPerUnit;
      totalScore += earnedBatteryBonus;

      if (attemptNumber === 1) {
        earnedFirstRunBonus = firstRunBonus;
        totalScore += earnedFirstRunBonus;
      }

      if (failedRunsCount === 0 && failedStepIndex === null) {
        earnedCleanSheetBonus = cleanSheetBonus;
        totalScore += earnedCleanSheetBonus;
      }
    } else {
      totalScore = retryPenalty;
    }

    const totalBatterySpent = initialBattery - remainingBattery;
    const stepsCompleted = executionTrace.filter(t => t.status === 'SUCCESS').length;

    return {
      success: isSuccess,
      isSuccess,
      targetAchieved,
      executionTrace,
      finalState: currentEnv,
      initialBattery,
      remainingBattery,
      batteryUsed: totalBatterySpent,
      totalBatterySpent,
      completedSteps: stepsCompleted,
      stepsCompleted,
      totalSteps: actionPlan.length,
      failedStepIndex,
      failureReason: failureExplanation,
      failureExplanation,
      missingPrerequisite: failedMissingPrerequisite,
      scoreBreakdown: {
        basePoints: isSuccess ? basePoints : 0,
        batteryBonus: earnedBatteryBonus,
        firstRunBonus: earnedFirstRunBonus,
        cleanSheetBonus: earnedCleanSheetBonus,
        retryPenalty: isSuccess ? 0 : retryPenalty,
        totalScore,
      },
    };
  }

  /**
   * Helper to calculate mission score under different attempt conditions.
   */
  static calculateMissionScore(
    config: Record<string, any>,
    sim: { isSuccess?: boolean; success?: boolean; remainingBattery: number },
    attemptNumber: number = 1
  ): number {
    const scoring = config.scoring || {};
    const basePoints = Number(scoring.basePoints ?? 100);
    const batteryMultiplier = Number(scoring.batteryBonusMultiplier ?? scoring.batteryBonusPerUnit ?? 10);
    const firstRunBonus = Number(scoring.firstRunBonus ?? 30);
    const cleanSheetBonus = Number(scoring.cleanSheetBonus ?? 20);
    const retryPenalty = Number(scoring.retryPenalty ?? -15);

    const isSuccess = sim.isSuccess ?? sim.success;
    if (!isSuccess) {
      return (attemptNumber - 1) * retryPenalty;
    }

    let score = basePoints + (sim.remainingBattery * batteryMultiplier);
    if (attemptNumber === 1) {
      score += firstRunBonus + cleanSheetBonus;
    } else {
      score += (attemptNumber - 1) * retryPenalty;
    }
    return score;
  }

  /**
   * Helper to splice an action into an existing plan at a specific slot.
   */
  static spliceMissionPlan(
    existingPlan: Array<{ slot: number; actionId: string; params?: Record<string, any> }>,
    insertSlotIndex: number,
    newActionId: string,
    params: Record<string, any> = {}
  ): Array<{ slot: number; actionId: string; params?: Record<string, any> }> {
    const updated: Array<{ slot: number; actionId: string; params?: Record<string, any> }> = [];
    const index = Math.max(0, Math.min(insertSlotIndex, existingPlan.length));

    for (let i = 0; i < index; i++) {
      updated.push({ ...existingPlan[i], slot: i });
    }

    updated.push({
      slot: index,
      actionId: newActionId,
      params,
    });

    for (let i = index; i < existingPlan.length; i++) {
      updated.push({ ...existingPlan[i], slot: i + 1 });
    }

    return updated;
  }

  /**
   * Validator entry point for SILENT_MISSION.
   */
  static validateSilentMission(context: ValidationContext): ValidationResult {
    const config = context.challengeConfig || {};
    let actionPlan: Array<{ slot: number; actionId: string; params?: Record<string, any> }> = [];

    if (typeof context.submission === 'object' && context.submission !== null) {
      const sub = context.submission as any;
      if (Array.isArray(sub.actionPlan)) {
        actionPlan = sub.actionPlan;
      } else if (Array.isArray(sub)) {
        actionPlan = sub;
      } else if (Array.isArray(sub.actions)) {
        actionPlan = sub.actions.map((a: any, idx: number) => ({ slot: idx, actionId: typeof a === 'string' ? a : a.id || a.actionId }));
      }
    } else {
      try {
        const parsed = JSON.parse(String(context.submission));
        if (Array.isArray(parsed.actionPlan)) {
          actionPlan = parsed.actionPlan;
        } else if (Array.isArray(parsed)) {
          actionPlan = parsed;
        } else if (Array.isArray(parsed.actions)) {
          actionPlan = parsed.actions.map((a: any, idx: number) => ({ slot: idx, actionId: typeof a === 'string' ? a : a.id || a.actionId }));
        }
      } catch {
        // Fallback for simple comma-separated string
        actionPlan = String(context.submission || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map((id, idx) => ({ slot: idx, actionId: id }));
      }
    }

    const sim = this.simulateMissionPlan(config, actionPlan);

    return {
      isCorrect: sim.isSuccess,
      scoreModifier: sim.scoreBreakdown.totalScore,
      details: sim,
    };
  }

  static calculateWitnessPartition(
    suspects: Array<Record<string, any>>,
    query: { attribute: string; operator: string; value: any }
  ) {
    const yesSuspects: string[] = [];
    const noSuspects: string[] = [];

    for (const suspect of suspects) {
      if (this.evaluateWitnessCondition(suspect, query)) {
        yesSuspects.push(suspect.id);
      } else {
        noSuspects.push(suspect.id);
      }
    }

    return {
      yesSuspects,
      noSuspects,
      yesCount: yesSuspects.length,
      noCount: noSuspects.length,
    };
  }

  static evaluateWitnessQuery(
    config: Record<string, any>,
    query: { attribute: string; operator: string; value: any; questionText?: string },
    activeSuspects: Array<Record<string, any>>
  ) {
    const secretId = String(config.secret || config.culpritId || config.answer || '').trim().toLowerCase();
    const allSuspects: Array<Record<string, any>> = config.suspects || [];
    const culprit = allSuspects.find(
      s => String(s.id).toLowerCase() === secretId || String(s.name).toLowerCase() === secretId
    );

    if (!culprit) {
      throw new Error(`Culprit [${secretId}] not found in suspect roster`);
    }

    // Ground truth: Does culprit satisfy query?
    const verdict = this.evaluateWitnessCondition(culprit, query);

    // Calculate eliminated vs remaining active suspects
    const eliminatedSuspectIds: string[] = [];
    const remainingSuspectIds: string[] = [];

    for (const s of activeSuspects) {
      const match = this.evaluateWitnessCondition(s, query);
      if (verdict === true) {
        if (!match) {
          eliminatedSuspectIds.push(s.id);
        } else {
          remainingSuspectIds.push(s.id);
        }
      } else {
        if (match) {
          eliminatedSuspectIds.push(s.id);
        } else {
          remainingSuspectIds.push(s.id);
        }
      }
    }

    const qText = query.questionText || `${query.attribute} ${query.operator} ${query.value}`;
    const responseText = verdict
      ? `AFFIRMATIVE — Telemetry records verify: ${qText}. ${eliminatedSuspectIds.length} suspect(s) exonerated.`
      : `NEGATIVE — Telemetry records contradict: ${qText}. ${eliminatedSuspectIds.length} suspect(s) exonerated.`;

    return {
      verdict,
      responseText,
      eliminatedSuspectIds,
      remainingSuspectIds,
    };
  }

  /**
   * Simulates a signal route through the network graph.
   */
  static simulateSignalRoute(
    config: Record<string, any>,
    routeNodes: string[],
    attemptNumber: number = 1,
    prevFailedRuns: number = 0,
    isProbe: boolean = false
  ) {
    const graph = config.graph || {};
    const stream = config.stream || {};
    const nodes: Array<any> = Array.isArray(graph.nodes) ? graph.nodes : [];
    const links: Array<any> = Array.isArray(graph.links) ? graph.links : [];

    const sourceId = String(graph.sourceNodeId || graph.source || 'NODE_TX');
    const targetId = String(graph.targetNodeId || graph.target || 'NODE_RX');
    const streamVolume = Number(stream.payloadVolumeGbps || stream.payloadVolume || 1.0);
    const slaMaxLatencyMs = Number(stream.slaMaxLatencyMs || stream.maxLatency || 85);
    const slaMaxLossPercent = Number(stream.slaMaxLossPercent ?? stream.maxLossPercent ?? 0.0);

    const scoring = config.scoring || {};
    const basePoints = Number(scoring.basePoints ?? 100);
    const zeroLossBonus = Number(scoring.zeroLossBonus ?? 50);
    const firstRunCleanSheetBonus = Number(scoring.firstRunCleanSheetBonus ?? 50);
    const latencyHeadroomMaxBonus = Number(scoring.latencyHeadroomMaxBonus ?? 50);
    const overloadPenalty = Number(scoring.overloadPenalty ?? 25);

    // Validate path structure
    const path = Array.isArray(routeNodes) ? routeNodes.map(n => String(n).trim()) : [];
    
    if (path.length < 2) {
      return {
        isSuccess: false,
        isValidPath: false,
        isSlaMet: false,
        routeNodes: path,
        totalLatencyMs: 0,
        totalPacketLossPercent: 100,
        bottleneckLink: null,
        hops: [],
        failureTier: {
          whatYouRouted: path.join(' ➔ ') || 'EMPTY_ROUTE',
          whatHappened: 'Route path contains insufficient nodes.',
          whyFailed: 'A transmission corridor requires at least a source and a destination node.',
          adaptationHint: `Connect [${sourceId}] to [${targetId}] via network hops.`,
        },
        scoreBreakdown: { totalScore: 0, base: 0, zeroLoss: 0, cleanSheet: 0, latencyHeadroom: 0, penalty: 0 },
      };
    }

    if (path[0] !== sourceId) {
      return {
        isSuccess: false,
        isValidPath: false,
        isSlaMet: false,
        routeNodes: path,
        totalLatencyMs: 0,
        totalPacketLossPercent: 100,
        bottleneckLink: null,
        hops: [],
        failureTier: {
          whatYouRouted: path.join(' ➔ '),
          whatHappened: `Route starts at [${path[0]}] instead of source ingress [${sourceId}].`,
          whyFailed: 'Transmission stream must originate from the designated source ingress node.',
          adaptationHint: `Set the starting node to [${sourceId}].`,
        },
        scoreBreakdown: { totalScore: 0, base: 0, zeroLoss: 0, cleanSheet: 0, latencyHeadroom: 0, penalty: 0 },
      };
    }

    if (path[path.length - 1] !== targetId) {
      return {
        isSuccess: false,
        isValidPath: false,
        isSlaMet: false,
        routeNodes: path,
        totalLatencyMs: 0,
        totalPacketLossPercent: 100,
        bottleneckLink: null,
        hops: [],
        failureTier: {
          whatYouRouted: path.join(' ➔ '),
          whatHappened: `Route terminates at [${path[path.length - 1]}] instead of destination egress [${targetId}].`,
          whyFailed: 'Transmission stream must reach the target destination egress node.',
          adaptationHint: `Extend path to connect to [${targetId}].`,
        },
        scoreBreakdown: { totalScore: 0, base: 0, zeroLoss: 0, cleanSheet: 0, latencyHeadroom: 0, penalty: 0 },
      };
    }

    // Check for loops / cycles
    const visited = new Set<string>();
    let hasLoop = false;
    let loopNode = '';
    for (const node of path) {
      if (visited.has(node)) {
        hasLoop = true;
        loopNode = node;
        break;
      }
      visited.add(node);
    }

    if (hasLoop) {
      return {
        isSuccess: false,
        isValidPath: false,
        isSlaMet: false,
        routeNodes: path,
        totalLatencyMs: 0,
        totalPacketLossPercent: 100,
        bottleneckLink: null,
        hops: [],
        failureTier: {
          whatYouRouted: path.join(' ➔ '),
          whatHappened: `Routing loop detected at node [${loopNode}].`,
          whyFailed: 'Packets would enter an infinite forwarding cycle, congesting the network.',
          adaptationHint: 'Remove redundant loops and route directly towards destination.',
        },
        scoreBreakdown: { totalScore: 0, base: 0, zeroLoss: 0, cleanSheet: 0, latencyHeadroom: 0, penalty: 0 },
      };
    }

    // Step through each hop
    const hops: Array<{
      from: string;
      to: string;
      linkId: string;
      capacityGbps: number;
      backgroundLoadGbps: number;
      headroomGbps: number;
      totalLoadGbps: number;
      isCongested: boolean;
      isStrained: boolean;
      bufferDelayMs: number;
      effectiveLatencyMs: number;
      linkLossPercent: number;
      description?: string;
    }> = [];

    let totalLatencyMs = 0;
    let hasOverload = false;
    let worstCongestedHop: any = null;

    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];

      // Find link (directed or undirected)
      const link = links.find(
        (l: any) => (l.from === u && l.to === v) || (!l.isDirected && l.from === v && l.to === u)
      );

      if (!link) {
        return {
          isSuccess: false,
          isValidPath: false,
          isSlaMet: false,
          routeNodes: path,
          totalLatencyMs: 0,
          totalPacketLossPercent: 100,
          bottleneckLink: null,
          hops,
          failureTier: {
            whatYouRouted: path.join(' ➔ '),
            whatHappened: `No physical or logical link exists between [${u}] and [${v}].`,
            whyFailed: 'Packets cannot jump across disconnected network topology segments.',
            adaptationHint: `Inspect available connections from [${u}] on the network canvas.`,
          },
          scoreBreakdown: { totalScore: 0, base: 0, zeroLoss: 0, cleanSheet: 0, latencyHeadroom: 0, penalty: 0 },
        };
      }

      const capacity = Number(link.capacityGbps || link.capacity || 10.0);
      const backgroundLoad = Number(link.backgroundLoadGbps || link.backgroundLoad || 0.0);
      const headroom = Math.max(0, capacity - backgroundLoad);
      const latency = Number(link.latencyMs || link.latency || 10);
      const baseLoss = Number(link.lossRate || link.loss || 0.0) * 100;

      // In probe mode, volume is minimal (0.01G test pulse) so no congestion buffer spill
      const volume = isProbe ? 0.01 : streamVolume;
      const totalLoad = backgroundLoad + volume;
      const isCongested = totalLoad > capacity;
      const isStrained = !isCongested && totalLoad > 0.75 * capacity;

      // Buffer bloat queuing delay
      const bufferDelay = isCongested
        ? 150
        : (isStrained ? Math.round(((totalLoad - 0.75 * capacity) / (0.25 * capacity)) * 25) : 0);

      // Packet loss calculation
      const linkLoss = isCongested
        ? Math.max(0, 1.0 - (capacity - backgroundLoad) / volume) * 100
        : baseLoss;

      const effectiveLatency = latency + bufferDelay;
      totalLatencyMs += effectiveLatency;

      const hopData = {
        from: u,
        to: v,
        linkId: link.id || `LINK_${u}_${v}`,
        capacityGbps: capacity,
        backgroundLoadGbps: backgroundLoad,
        headroomGbps: Number(headroom.toFixed(2)),
        totalLoadGbps: Number(totalLoad.toFixed(2)),
        isCongested,
        isStrained,
        bufferDelayMs: bufferDelay,
        effectiveLatencyMs: effectiveLatency,
        linkLossPercent: Number(linkLoss.toFixed(2)),
        description: link.description || '',
      };

      hops.push(hopData);

      if (isCongested) {
        hasOverload = true;
        if (!worstCongestedHop || linkLoss > worstCongestedHop.linkLossPercent) {
          worstCongestedHop = hopData;
        }
      }
    }

    // Bottleneck link is the hop with lowest available headroom
    let bottleneckLink = hops[0];
    for (const h of hops) {
      if (h.headroomGbps < bottleneckLink.headroomGbps) {
        bottleneckLink = h;
      }
    }

    // Cumulative packet delivery calculation
    const totalRetention = hops.reduce((acc, h) => acc * (1 - h.linkLossPercent / 100), 1.0);
    const totalPacketLossPercent = Number((Math.max(0, 1.0 - totalRetention) * 100).toFixed(1));

    const latencySlaMet = totalLatencyMs <= slaMaxLatencyMs;
    const lossSlaMet = totalPacketLossPercent <= slaMaxLossPercent;
    const isSuccess = !hasLoop && latencySlaMet && lossSlaMet && !hasOverload;

    // Failure Tier Diagnostic construction
    let failureTier: any = null;
    if (!isSuccess) {
      if (hasOverload && worstCongestedHop) {
        const excess = (streamVolume - worstCongestedHop.headroomGbps).toFixed(1);
        
        // Find alternate egress from worstCongestedHop.from
        const alternateLinks = links.filter((l: any) => 
          (l.from === worstCongestedHop.from || (!l.isDirected && l.to === worstCongestedHop.from)) &&
          l.id !== worstCongestedHop.linkId
        );
        const bestAlt = alternateLinks.sort((a: any, b: any) => {
          const hrA = Number(a.capacityGbps || a.capacity || 10) - Number(a.backgroundLoadGbps || a.backgroundLoad || 0);
          const hrB = Number(b.capacityGbps || b.capacity || 10) - Number(b.backgroundLoadGbps || b.backgroundLoad || 0);
          return hrB - hrA;
        })[0];

        const altHint = bestAlt
          ? `Inspect [${worstCongestedHop.from}]: Egress [${bestAlt.id}] has ${bestAlt.capacityGbps || bestAlt.capacity} Gbps capacity with ${(Number(bestAlt.capacityGbps || bestAlt.capacity) - Number(bestAlt.backgroundLoadGbps || bestAlt.backgroundLoad || 0)).toFixed(1)} Gbps headroom.`
          : `Detour around [${worstCongestedHop.from}] via parallel high-capacity backbone lines.`;

        failureTier = {
          whatYouRouted: `Path: ${path.join(' ➔ ')} (Stream Volume: ${streamVolume} Gbps)`,
          whatHappened: `Buffer Overflow at Link [${worstCongestedHop.from} ➔ ${worstCongestedHop.to}]. Packet Loss: ${totalPacketLossPercent}%. Effective Latency: ${totalLatencyMs}ms.`,
          whyFailed: `Link capacity is ${worstCongestedHop.capacityGbps} Gbps with ${worstCongestedHop.backgroundLoadGbps} Gbps ambient load. Available headroom was only ${worstCongestedHop.headroomGbps} Gbps (Deficit: ${excess} Gbps).`,
          adaptationHint: altHint,
          failingHop: worstCongestedHop,
        };
      } else if (!latencySlaMet) {
        failureTier = {
          whatYouRouted: `Path: ${path.join(' ➔ ')} (Cumulative Latency: ${totalLatencyMs}ms)`,
          whatHappened: `Latency SLA breach: ${totalLatencyMs}ms exceeded the maximum threshold of ${slaMaxLatencyMs}ms.`,
          whyFailed: 'The route selected traversed too many high-latency intermediate hops or buffer delays.',
          adaptationHint: 'Seek a more direct corridor that still provides sufficient bandwidth headroom.',
        };
      } else if (!lossSlaMet) {
        failureTier = {
          whatYouRouted: `Path: ${path.join(' ➔ ')} (Packet Loss: ${totalPacketLossPercent}%)`,
          whatHappened: `Packet loss of ${totalPacketLossPercent}% violated the zero-tolerance SLA (${slaMaxLossPercent}%).`,
          whyFailed: 'Link noise or switch buffer congestion dropped packets in transit.',
          adaptationHint: 'Avoid noisy or constrained links and route along clean optical fiber trunks.',
        };
      }
    }

    // Scoring Breakdown
    const base = isSuccess ? basePoints : 0;
    const zeroLoss = isSuccess && totalPacketLossPercent === 0 ? zeroLossBonus : 0;
    const cleanSheet = isSuccess && prevFailedRuns === 0 ? firstRunCleanSheetBonus : 0;
    const latencyHeadroom = isSuccess
      ? Math.round(Math.max(0, (slaMaxLatencyMs - totalLatencyMs) / slaMaxLatencyMs) * latencyHeadroomMaxBonus)
      : 0;
    const penalty = !isSuccess && hasOverload ? overloadPenalty : 0;
    const totalScore = Math.max(0, base + zeroLoss + cleanSheet + latencyHeadroom - penalty);

    return {
      isSuccess,
      isValidPath: true,
      isSlaMet: latencySlaMet && lossSlaMet,
      latencySlaMet,
      lossSlaMet,
      routeNodes: path,
      totalLatencyMs,
      totalPacketLossPercent,
      bottleneckLink: {
        linkId: bottleneckLink.linkId,
        from: bottleneckLink.from,
        to: bottleneckLink.to,
        capacityGbps: bottleneckLink.capacityGbps,
        backgroundLoadGbps: bottleneckLink.backgroundLoadGbps,
        headroomGbps: bottleneckLink.headroomGbps,
      },
      hops,
      failureTier,
      scoreBreakdown: {
        totalScore,
        base,
        zeroLoss,
        cleanSheet,
        latencyHeadroom,
        penalty,
      },
    };
  }

  /**
   * Validator entry point for SIGNAL_ROUTER.
   */
  static validateSignalRouter(context: ValidationContext): ValidationResult {
    const config = context.challengeConfig || {};
    let routeNodes: string[] = [];

    if (typeof context.submission === 'object' && context.submission !== null) {
      const sub = context.submission as any;
      if (Array.isArray(sub.route)) {
        routeNodes = sub.route;
      } else if (Array.isArray(sub)) {
        routeNodes = sub;
      } else if (Array.isArray(sub.nodes)) {
        routeNodes = sub.nodes;
      } else if (Array.isArray(sub.path)) {
        routeNodes = sub.path;
      }
    } else {
      try {
        const parsed = JSON.parse(String(context.submission));
        if (Array.isArray(parsed.route)) {
          routeNodes = parsed.route;
        } else if (Array.isArray(parsed)) {
          routeNodes = parsed;
        } else if (Array.isArray(parsed.nodes)) {
          routeNodes = parsed.nodes;
        } else if (Array.isArray(parsed.path)) {
          routeNodes = parsed.path;
        }
      } catch {
        routeNodes = String(context.submission || '')
          .split(/[,➔\->]/)
          .map(s => s.trim())
          .filter(Boolean);
      }
    }

    const sim = this.simulateSignalRoute(config, routeNodes);

    return {
      isCorrect: sim.isSuccess,
      scoreModifier: sim.scoreBreakdown.totalScore,
      details: sim,
    };
  }

  /**
   * Evaluate a classification threshold deterministically against population data or Gaussian distributions.
   */
  static evaluateThreshold(
    config: Record<string, any>,
    threshold: number,
    phase: number = 1
  ): {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
    totalLoss: number;
    withinBudget: boolean;
    isOptimal: boolean;
    totalScore: number;
    failureTier: any;
  } {
    const phaseKey = phase === 2 ? 'phase2Shift' : 'phase1Baseline';
    const phaseConfig = config[phaseKey] || config.distributions || {};
    const costMatrix = config.costMatrix || {};
    const fnCost = Number(costMatrix.falseNegativeCost || 10000);
    const fpCost = Number(costMatrix.falsePositiveCost || 500);
    const maxBudget = Number(phaseConfig.maxIncidentBudget || costMatrix.maxIncidentBudget || 25000);

    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    if (Array.isArray(phaseConfig.cases) && phaseConfig.cases.length > 0) {
      for (const c of phaseConfig.cases) {
        const score = Number(c.riskScore ?? c.score ?? 0);
        if (c.isCritical) {
          if (score >= threshold) tp++;
          else fn++;
        } else {
          if (score >= threshold) fp++;
          else tn++;
        }
      }
    } else {
      const bDist = phaseConfig.benignDistribution || { mean: 32, stdDev: 10, count: 75 };
      const cDist = phaseConfig.criticalDistribution || { mean: 68, stdDev: 11, count: 25 };

      const bMean = Number(bDist.mean || 32);
      const bStd = Number(bDist.stdDev || 10) || 1;
      const bCount = Number(bDist.count || 75);

      const cMean = Number(cDist.mean || 68);
      const cStd = Number(cDist.stdDev || 11) || 1;
      const cCount = Number(cDist.count || 25);

      let bSum = 0;
      let cSum = 0;
      const bP = new Array(101);
      const cP = new Array(101);

      for (let x = 0; x <= 100; x++) {
        const zb = (x - bMean) / bStd;
        const zc = (x - cMean) / cStd;
        const pb = Math.exp(-0.5 * zb * zb);
        const pc = Math.exp(-0.5 * zc * zc);
        bP[x] = pb;
        cP[x] = pc;
        bSum += pb;
        cSum += pc;
      }

      for (let x = 0; x <= 100; x++) {
        const bCases = (bP[x] / (bSum || 1)) * bCount;
        const cCases = (cP[x] / (cSum || 1)) * cCount;
        if (x >= threshold) {
          fp += bCases;
          tp += cCases;
        } else {
          tn += bCases;
          fn += cCases;
        }
      }

      tp = Math.round(tp);
      fp = Math.round(fp);
      tn = Math.round(tn);
      fn = Math.round(fn);
    }

    const totalLoss = (fn * fnCost) + (fp * fpCost);
    const withinBudget = totalLoss <= maxBudget;

    const optimalRange = Array.isArray(phaseConfig.optimalThresholdRange)
      ? phaseConfig.optimalThresholdRange
      : (phase === 2 ? [26, 32] : [50, 56]);
    const isOptimal = threshold >= optimalRange[0] && threshold <= optimalRange[1];

    const scoring = config.scoring || {};
    const basePoints = Number(scoring.basePoints ?? 100);
    const optimalBonus = Number(scoring.optimalBonus ?? 50);
    const zeroLossBonus = Number(scoring.zeroLossBonus ?? 30);

    const totalScore = withinBudget
      ? Math.max(0, basePoints + (isOptimal ? optimalBonus : 0) + (fn === 0 ? zeroLossBonus : 0))
      : 0;

    let failureTier = null;
    if (!withinBudget) {
      const whyHint = fn > 0 && (fn * fnCost >= fp * fpCost)
        ? 'Slide the threshold leftward to increase Sensitivity and eliminate costly False Negatives.'
        : 'Slide the threshold rightward to increase Specificity and reduce excessive False Alarms.';

      failureTier = {
        whatYouSet: `Threshold Calibrated at T = ${threshold}.`,
        whatHappened: `${fn} Critical cases were missed, and ${fp} False Alarms occurred.`,
        whyFailed: `Total loss of $${totalLoss.toLocaleString()} exceeded the safety ceiling of $${maxBudget.toLocaleString()} (FN penalty: $${fnCost}/case, FP penalty: $${fpCost}/case).`,
        adaptationHint: whyHint,
      };
    }

    return {
      tp,
      fp,
      tn,
      fn,
      totalLoss,
      withinBudget,
      isOptimal,
      totalScore,
      failureTier,
    };
  }

  /**
   * Validate THE_THRESHOLD submission against challenge config.
   */
  static validateThreshold(context: ValidationContext): ValidationResult {
    const config = context.challengeConfig || {};
    let threshold = 50;
    let phase = 1;

    if (typeof context.submission === 'object' && context.submission !== null) {
      const sub = context.submission as any;
      threshold = Number(sub.threshold ?? sub.value ?? 50);
      phase = Number(sub.phase ?? 1);
    } else {
      try {
        const parsed = JSON.parse(String(context.submission));
        threshold = Number(parsed.threshold ?? parsed.value ?? 50);
        phase = Number(parsed.phase ?? 1);
      } catch {
        threshold = Number(context.submission) || 50;
      }
    }

    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return {
        isCorrect: false,
        scoreModifier: 0,
        details: { error: 'Threshold must be between 0 and 100' },
      };
    }

    const evaluation = this.evaluateThreshold(config, threshold, phase);

    return {
      isCorrect: evaluation.withinBudget,
      scoreModifier: evaluation.totalScore,
      details: evaluation,
    };
  }
}

export interface DockNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  icon?: string;
  isDecoy?: boolean;
}

export interface DockTransition {
  valid: boolean;
  energyCost: number;
  consequence: {
    statusMessage: string;
    unlockedNodes?: string[];
    isTerminalSuccess?: boolean;
    alertLevel?: number;
    penalty?: number;
  };
}

export interface DockConfig {
  availableNodes?: string[];
  initialNodes?: string[];
  nodes: DockNode[];
  transitions: Record<string, DockTransition>;
  resourceBudget?: {
    energy?: number;
  };
  validChain?: string[];
  reveal?: {
    title: string;
    summary: string;
    whatYouDid: string[];
    technicalConcepts: Array<{ term: string; explanation: string }>;
  };
}

export interface DockActionPayload {
  action: 'CONNECT' | 'RESET';
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface DockState {
  unlockedNodes: string[];
  completedConnections: string[];
  energyRemaining: number;
  consequences: Array<{ message: string; type: 'SUCCESS' | 'WARNING' | 'INFO'; timestamp: number }>;
  isCompleted: boolean;
  score?: number;
  revealed?: any;
}

export interface BugHuntRule {
  id: string;
  label: string;
  description?: string;
  field: string;
  operator: '>=' | '<=' | '>' | '<' | '==' | '!=' | '=';
  threshold: number | string;
  output: string;
  hasBug?: boolean;
}

export interface RegressionTestCase {
  input: Record<string, any>;
  expected: string;
  description?: string;
}

export interface BugHuntValidationDetails {
  isCorrect: boolean;
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  hypothesisCorrect?: boolean;
  patchedRuleId?: string;
  results: Array<{
    input: Record<string, any>;
    expected: string;
    actual: string;
    passed: boolean;
    matchedRuleId: string | null;
    description?: string;
  }>;
}

export function validateChallengeAnswer(challenge: any, answer: any): boolean {
  const config = challenge.config || {};
  let isCorrect = false;
  
  if (challenge.type === 'MULTIPLE_CHOICE' || challenge.type === 'MULTI_CHOICE') {
    let submitted: string[] = [];
    if (Array.isArray(answer)) {
      submitted = answer.slice(0, 20).map(String).map(s => s.substring(0, 100)).sort();
    }
    const correct = Array.isArray(config.answer) ? (config.answer as string[]).sort() : [];
    isCorrect = submitted.length === correct.length && submitted.every((v, i) => v === correct[i]);
  } else if (challenge.type === 'STATE_TRANSITION') {
    const expected = JSON.stringify(config.finalState);
    const actual = JSON.stringify(answer);
    isCorrect = expected === actual;
  } else {
    isCorrect = String(answer || '').trim().substring(0, 255).toLowerCase() === String(config.answer).toLowerCase();
  }
  return isCorrect;
}
