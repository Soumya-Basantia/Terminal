import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';
import { 
  Zap, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RotateCcw, 
  Play, 
  HelpCircle, 
  Cpu, 
  Lock, 
  Unlock, 
  Layers, 
  Terminal as TerminalIcon, 
  ArrowRight, 
  ChevronRight, 
  ChevronLeft, 
  ChevronUp,
  ChevronDown,
  Plus, 
  Trash2, 
  Flame, 
  Wind, 
  Radio, 
  Activity, 
  Award,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  Crosshair,
  Check
} from 'lucide-react';
import { MagneticDock, type DockItemData } from './ui/magnetic-dock';
import tacticalAudio from '../lib/tacticalAudio';

/* ─── INTERFACES ─────────────────────────────────────────── */
export interface ActionDefinition {
  id: string;
  label?: string;
  name?: string;
  description?: string;
  category?: 'POWER' | 'SECURITY' | 'ENVIRONMENT' | 'DATA' | 'MISSION' | string;
  cost: number;
  prerequisites?: Record<string, any>;
  prereqs?: Record<string, any>;
  postconditions?: Record<string, any>;
  postConditions?: Record<string, any>;
  failureNotice?: string;
  isIrreversible?: boolean;
  icon?: string;
}

export interface PlanStep {
  slot: number;
  actionId: string;
  params?: Record<string, any>;
}

export interface StepExecutionTrace {
  slot: number;
  actionId: string;
  label?: string;
  actionName?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  batteryCost: number;
  penaltyCost: number;
  failureReason?: string;
  causalExplanation?: string;
  missingState?: Record<string, any>;
  stateBefore?: Record<string, any>;
  stateChanges?: Record<string, any>;
  resultingState?: Record<string, any>;
  isIrreversible?: boolean;
}

export interface MissionConfig {
  scenarioId?: string;
  operationId?: string;
  title?: string;
  scenarioTitle?: string;
  briefing?: string;
  missionBrief?: string;
  initialBattery?: number;
  batteryCapacity?: number;
  initialState?: Record<string, any>;
  targetState?: Record<string, any>;
  actions: ActionDefinition[];
  scoring?: {
    basePoints?: number;
    batteryBonusPerUnit?: number;
    batteryBonusMultiplier?: number;
    firstRunBonus?: number;
    cleanSheetBonus?: number;
    retryPenalty?: number;
  };
}

export interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (result: any) => void;
}

interface DependencyCheckResult {
  isSatisfied: boolean;
  missingPrereqs: Array<{ key: string; expected: any; currentVal: any }>;
  suggestedActionId?: string;
  suggestedActionName?: string;
}

/**
 * Deterministic helper to evaluate prerequisites between sequential steps in the corridor
 */
const checkStepDependency = (
  stepIndex: number, 
  plan: PlanStep[], 
  allActions: ActionDefinition[], 
  initialState: Record<string, any>
): DependencyCheckResult => {
  if (stepIndex === 0) {
    const stepDef = allActions.find(a => a.id === plan[0]?.actionId);
    const prereqs = stepDef?.prerequisites || (stepDef as any)?.prereqs || {};
    const missing: Array<{ key: string; expected: any; currentVal: any }> = [];
    Object.entries(prereqs).forEach(([k, v]) => {
      if (String(initialState[k] ?? '').toUpperCase() !== String(v).toUpperCase()) {
        missing.push({ key: k, expected: v, currentVal: initialState[k] });
      }
    });
    let suggestedId: string | undefined;
    if (missing.length > 0) {
      const match = allActions.find(a => {
        const post = (a as any).postConditions || (a as any).postconditions || {};
        return Object.entries(post).some(([pk, pv]) => pk === missing[0].key && String(pv).toUpperCase() === String(missing[0].expected).toUpperCase());
      });
      suggestedId = match?.id;
    }
    return {
      isSatisfied: missing.length === 0,
      missingPrereqs: missing,
      suggestedActionId: suggestedId,
      suggestedActionName: suggestedId ? (allActions.find(a => a.id === suggestedId)?.label || (allActions.find(a => a.id === suggestedId) as any)?.name || suggestedId) : undefined
    };
  }

  // Accumulate states from step 0 to stepIndex - 1
  let accumulatedState = { ...initialState };
  for (let i = 0; i < stepIndex; i++) {
    const actDef = allActions.find(a => a.id === plan[i]?.actionId);
    const post = (actDef as any)?.postConditions || (actDef as any)?.postconditions || {};
    accumulatedState = { ...accumulatedState, ...post };
  }

  const currentStepDef = allActions.find(a => a.id === plan[stepIndex]?.actionId);
  const prereqs = currentStepDef?.prerequisites || (currentStepDef as any)?.prereqs || {};
  const missing: Array<{ key: string; expected: any; currentVal: any }> = [];
  Object.entries(prereqs).forEach(([k, v]) => {
    if (String(accumulatedState[k] ?? '').toUpperCase() !== String(v).toUpperCase()) {
      missing.push({ key: k, expected: v, currentVal: accumulatedState[k] });
    }
  });

  let suggestedId: string | undefined;
  if (missing.length > 0) {
    const match = allActions.find(a => {
      const post = (a as any).postConditions || (a as any).postconditions || {};
      return Object.entries(post).some(([pk, pv]) => pk === missing[0].key && String(pv).toUpperCase() === String(missing[0].expected).toUpperCase());
    });
    suggestedId = match?.id;
  }

  return {
    isSatisfied: missing.length === 0,
    missingPrereqs: missing,
    suggestedActionId: suggestedId,
    suggestedActionName: suggestedId ? (allActions.find(a => a.id === suggestedId)?.label || (allActions.find(a => a.id === suggestedId) as any)?.name || suggestedId) : undefined
  };
};

export const MissionChallenge: React.FC<Props> = ({ challenge, sessionCode, onSubmitted }) => {
  const config = (challenge?.config || {}) as MissionConfig;
  const initialBattery = Number(config.batteryCapacity || config.initialBattery || 40);
  const actions = useMemo(() => Array.isArray(config.actions) ? config.actions : [], [config.actions]);

  // Planning State
  const [actionPlan, setActionPlan] = useState<PlanStep[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [spliceSlotIndex, setSpliceSlotIndex] = useState<number | null>(null);
  const [lastEngagedAction, setLastEngagedAction] = useState<string | null>(null);

  // Execution & Server Authority State
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [executionTrace, setExecutionTrace] = useState<StepExecutionTrace[]>([]);
  const [environmentState, setEnvironmentState] = useState<Record<string, any>>(config.initialState || {});
  const [batteryRemaining, setBatteryRemaining] = useState<number>(initialBattery);
  const [isCompleted, setIsCompleted] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [scoreEarned, setScoreEarned] = useState<number | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<any>(null);
  const [failureExplanation, setFailureExplanation] = useState<string | null>(null);

  // Audio & Modals
  const [isMuted, setIsMuted] = useState<boolean>(tacticalAudio.getIsMuted());
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Mobile drawer collapse states
  const [mobileShowSensors, setMobileShowSensors] = useState<boolean>(false);
  const [mobileShowArsenal, setMobileShowArsenal] = useState<boolean>(true);
  const [mobileShowTrace, setMobileShowTrace] = useState<boolean>(false);

  // Fetch state on mount
  const fetchState = useCallback(async () => {
    try {
      const code = sessionCode || 'ACTIVE';
      const res = await api.get(`/sessions/${code}/mission-state?challengeId=${challenge.id}`);
      if (res.data) {
        if (Array.isArray(res.data.actionPlan) && res.data.actionPlan.length > 0) {
          setActionPlan(res.data.actionPlan);
        }
        if (Array.isArray(res.data.executionTrace) && res.data.executionTrace.length > 0) {
          setExecutionTrace(res.data.executionTrace);
          const lastStep = res.data.executionTrace[res.data.executionTrace.length - 1];
          if (lastStep?.resultingState) {
            setEnvironmentState(lastStep.resultingState);
          }
        }
        if (res.data.remainingBattery !== undefined) {
          setBatteryRemaining(res.data.remainingBattery);
        }
        if (res.data.scoreBreakdown) {
          setScoreBreakdown(res.data.scoreBreakdown);
        }
        if (res.data.failureExplanation) {
          setFailureExplanation(res.data.failureExplanation);
        }
        if (res.data.isCompleted) {
          setIsCompleted(true);
          setScoreEarned(res.data.score || 100);
        }
        if (res.data.attempts) {
          setAttemptsCount(res.data.attempts);
        }
      }
    } catch {
      // Offline fallback
    }
  }, [sessionCode, challenge.id]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // First-time onboarding trigger
  useEffect(() => {
    if (attemptsCount === 0 && actionPlan.length === 0 && !isCompleted) {
      setShowBriefingModal(true);
    }
  }, [attemptsCount, actionPlan.length, isCompleted]);

  // Sound toggle
  const handleToggleSound = () => {
    const next = tacticalAudio.toggleMute();
    setIsMuted(next);
  };

  // Planned battery cost computation
  const plannedBatteryCost = useMemo(() => {
    const actMap = new Map<string, ActionDefinition>();
    actions.forEach(a => actMap.set(a.id, a));
    return actionPlan.reduce((acc, step) => {
      const def = actMap.get(step.actionId);
      return acc + (def?.cost || 1);
    }, 0);
  }, [actionPlan, actions]);

  // Pre-calculate step-by-step circuit dependencies
  const stepDependencies = useMemo(() => {
    return actionPlan.map((_, idx) => checkStepDependency(idx, actionPlan, actions, config.initialState || {}));
  }, [actionPlan, actions, config.initialState]);

  // Check target state completion
  const targetEvaluation = useMemo(() => {
    const targets = config.targetState || {};
    const entries = Object.entries(targets);
    if (entries.length === 0) return { isComplete: false, targets: [] };
    
    let allMet = true;
    const evaluated = entries.map(([k, v]) => {
      const curr = environmentState[k];
      const isMet = String(curr ?? '').toUpperCase() === String(v).toUpperCase();
      if (!isMet) allMet = false;
      return { key: k, expected: v, current: curr, isMet };
    });

    return { isComplete: allMet, targets: evaluated };
  }, [config.targetState, environmentState]);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    actions.forEach(a => {
      if (a.category) set.add(a.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [actions]);

  const filteredActions = useMemo(() => {
    if (selectedCategory === 'ALL') return actions;
    return actions.filter(a => a.category === selectedCategory);
  }, [actions, selectedCategory]);

  // Add action to the plan
  const handleAddAction = (actionId: string, insertIndex?: number) => {
    if (isCompleted || isExecuting) return;
    tacticalAudio.playDockSnap();
    const act = actions.find(a => a.id === actionId);
    setLastEngagedAction(act?.label || (act as any)?.name || actionId);

    const newPlan = [...actionPlan];
    if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= newPlan.length) {
      newPlan.splice(insertIndex, 0, { slot: insertIndex, actionId });
      const reindexed = newPlan.map((s, idx) => ({ ...s, slot: idx }));
      setActionPlan(reindexed);
      setSpliceSlotIndex(null);
    } else {
      newPlan.push({ slot: newPlan.length, actionId });
      setActionPlan(newPlan);
    }
  };

  // Remove action
  const handleRemoveStep = (index: number) => {
    if (isCompleted || isExecuting) return;
    tacticalAudio.playClick();
    const updated = actionPlan.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, slot: idx }));
    setActionPlan(updated);
  };

  // Reorder step
  const handleMoveStep = (index: number, direction: 'LEFT' | 'RIGHT') => {
    if (isCompleted || isExecuting) return;
    const targetIdx = direction === 'LEFT' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= actionPlan.length) return;
    tacticalAudio.playClick();
    const updated = [...actionPlan];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setActionPlan(updated.map((s, idx) => ({ ...s, slot: idx })));
  };

  // Clear plan
  const handleClearPlan = () => {
    if (isCompleted || isExecuting) return;
    tacticalAudio.playClick();
    setActionPlan([]);
    setExecutionTrace([]);
    setSpliceSlotIndex(null);
  };

  // Execute mission simulation on server
  const handleExecuteMission = async () => {
    if (isExecuting || actionPlan.length === 0 || isCompleted) return;

    tacticalAudio.playRelay();
    setIsExecuting(true);
    setActiveStepIndex(0);
    setExecutionTrace([]);

    try {
      const code = sessionCode || 'ACTIVE';
      const res = await api.post(`/sessions/${code}/mission-execute`, {
        challengeId: challenge.id,
        actionPlan,
      });

      const sim = res.data.simulation;
      const trace: StepExecutionTrace[] = sim.executionTrace || [];

      // Step-by-step visual animation through execution trace
      for (let i = 0; i < trace.length; i++) {
        setActiveStepIndex(i);
        setExecutionTrace(trace.slice(0, i + 1));
        if (trace[i].resultingState) {
          setEnvironmentState(trace[i].resultingState!);
        }
        if (trace[i].status === 'FAILED') {
          tacticalAudio.playAlarm();
        } else {
          tacticalAudio.playClick();
        }
        await new Promise(r => setTimeout(r, 400));
      }

      setIsExecuting(false);
      setActiveStepIndex(null);
      setBatteryRemaining(sim.remainingBattery);
      setAttemptsCount(prev => prev + 1);
      setFailureExplanation(sim.failureExplanation || null);

      if (sim.isSuccess) {
        tacticalAudio.playSuccess();
        setIsCompleted(true);
        setScoreEarned(sim.scoreBreakdown?.totalScore ?? 100);
        setScoreBreakdown(sim.scoreBreakdown);
        setShowDebriefModal(true);
        if (onSubmitted) {
          onSubmitted({
            isCorrect: true,
            score: sim.scoreBreakdown?.totalScore ?? 100,
            isSilentMission: true,
            simulation: sim,
          });
        }
      } else {
        tacticalAudio.playAlarm();
        setShowFailureModal(true);
      }
    } catch (err: any) {
      setIsExecuting(false);
      setActiveStepIndex(null);
      alert(err.response?.data?.error || 'Failed to execute mission plan.');
    }
  };

  // Helper for category badge styling
  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'POWER': return 'bg-amber-950/80 text-amber-300 border-amber-600';
      case 'SECURITY':
      case 'ACCESS': return 'bg-rose-950/80 text-rose-300 border-rose-600';
      case 'ENVIRONMENT':
      case 'THERMAL': return 'bg-cyan-950/80 text-cyan-300 border-cyan-600';
      case 'DATA':
      case 'NETWORK':
      case 'CRYPTOGRAPHY': return 'bg-emerald-950/80 text-emerald-300 border-emerald-600';
      default: return 'bg-neutral-900 text-neutral-300 border-neutral-700';
    }
  };

  // Helper for action icon
  const renderActionIcon = (actionId: string, className = "w-4 h-4") => {
    if (actionId.includes('POWER') || actionId.includes('BREAKER') || actionId.includes('BATTERY') || actionId.includes('TRANSFORMER')) return <Zap className={className} />;
    if (actionId.includes('THERMITE') || actionId.includes('IGNITE') || actionId.includes('BURN')) return <Flame className={className} />;
    if (actionId.includes('VENT') || actionId.includes('AIR') || actionId.includes('DAMPER') || actionId.includes('COOLANT')) return <Wind className={className} />;
    if (actionId.includes('KEYPAD') || actionId.includes('DECRYPT') || actionId.includes('LOCK')) return <Lock className={className} />;
    if (actionId.includes('DOWNLOAD') || actionId.includes('BLACKBOX') || actionId.includes('CIPHER')) return <TerminalIcon className={className} />;
    if (actionId.includes('UPLINK') || actionId.includes('BURST') || actionId.includes('RADIO') || actionId.includes('FIBER')) return <Radio className={className} />;
    return <Cpu className={className} />;
  };

  // Helper for sensor state indicator tags
  const getSensorStateTag = (val: any, isTargetMet: boolean) => {
    const str = String(val).toUpperCase();
    if (isTargetMet || str.includes('AUTHENTICATED') || str.includes('ESCAPED') || str === 'READY') {
      return { tag: '[VERIFIED]', color: 'text-[#3fb950] border-[#3fb950]/60 bg-[#3fb950]/10' };
    }
    if (str.includes('VACUUM') || str === '0.0_BAR' || str === '0.0 BAR') {
      return { tag: '[VACUUM]', color: 'text-[#ff0055] border-[#ff0055]/60 bg-[#ff0055]/10 animate-pulse' };
    }
    if (str.includes('SEIZED')) {
      return { tag: '[SEIZED]', color: 'text-[#ff0055] border-[#ff0055]/60 bg-[#ff0055]/10 animate-pulse' };
    }
    if (str.includes('DRAINED')) {
      return { tag: '[DRAINED]', color: 'text-[#fcee0a] border-[#fcee0a]/60 bg-[#fcee0a]/10' };
    }
    if (str.includes('ALERT') || str.includes('OFFLINE') || str.includes('LOCKED') || str.includes('ARMED')) {
      return { tag: '[WARNING]', color: 'text-[#ff0055] border-[#ff0055]/60 bg-[#ff0055]/10' };
    }
    if (str.includes('STABLE') || str.includes('1.0_BAR') || str.includes('1.0 BAR') || str.includes('480V')) {
      return { tag: '[STABLE]', color: 'text-[#00ffcc] border-[#00ffcc]/60 bg-[#00ffcc]/10' };
    }
    if (str.includes('ONLINE') || str.includes('OPEN') || str.includes('BREACHED')) {
      return { tag: '[ACTIVE]', color: 'text-[#00ffcc] border-[#00ffcc]/60 bg-[#00ffcc]/10' };
    }
    if (str.includes('STANDBY') || str.includes('STATIONARY') || str.includes('CLOSED') || str.includes('SECURED')) {
      return { tag: '[STANDBY]', color: 'text-neutral-400 border-neutral-700 bg-neutral-900/60' };
    }
    return { tag: '[ONLINE]', color: 'text-neutral-300 border-neutral-700 bg-neutral-900/60' };
  };

  // Magnetic Dock items
  const dockItems: DockItemData[] = useMemo(() => {
    return actions.map(act => ({
      id: act.id,
      label: `${act.label || (act as any).name || act.id} (⚡${act.cost})`,
      icon: renderActionIcon(act.id, "w-5 h-5 text-[#00ffcc]"),
      onClick: () => handleAddAction(act.id, spliceSlotIndex ?? undefined),
      isActive: selectedActionId === act.id,
    }));
  }, [actions, selectedActionId, spliceSlotIndex]);

  const failedStep = executionTrace.find(t => t.status === 'FAILED');
  const isBatteryOverdrawn = plannedBatteryCost > batteryRemaining;

  return (
    <div className="flex flex-col min-h-screen bg-[#070a10] text-[#e6edf3] font-mono select-none antialiased relative">
      {/* Background Dot-Matrix Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 255, 204, 0.25) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* ─── 1. TOP MISSION HUD ─── */}
      <header className="border-b-2 border-neutral-800 bg-[#090d15]/95 backdrop-blur sticky top-0 z-40 px-3 sm:px-6 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left Title & Operation Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border-2 border-[#00ffcc] bg-[#00ffcc]/10 flex items-center justify-center text-[#00ffcc] shadow-[2px_2px_0px_0px_rgba(0,255,204,0.4)]">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.2 border border-[#00ffcc]/60 text-[#00ffcc] bg-[#00ffcc]/10 font-black uppercase tracking-widest">
                  SILENT_MISSION
                </span>
                <span className="text-[10px] text-neutral-400 font-bold">
                  {config.operationId || 'OP-01'} // COVERT CONSOLE
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black tracking-wider text-white uppercase truncate max-w-xs sm:max-w-md">
                {config.title || (config as any).scenarioTitle || 'FACILITY INFILTRATION'}
              </h1>
            </div>
          </div>

          {/* Right Status / Telemetry Meters & Actions */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Battery Cell Compact HUD */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0d121c] border-2 border-neutral-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]">
              <Zap className={`w-4 h-4 ${batteryRemaining <= 4 ? 'text-[#ff0055] animate-bounce' : 'text-[#fcee0a]'}`} />
              <div>
                <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">BATTERY</div>
                <div className="text-xs font-black text-[#fcee0a]">
                  ⚡ {batteryRemaining} <span className="text-neutral-500 text-[10px]">/ {initialBattery}</span>
                </div>
              </div>
            </div>

            {/* Mission Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0d121c] border-2 border-neutral-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]">
              <div>
                <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">STATUS</div>
                <div className={`text-xs font-black uppercase ${
                  isCompleted ? 'text-[#3fb950]' : isExecuting ? 'text-[#00ffcc] animate-pulse' : 'text-neutral-200'
                }`}>
                  {isCompleted ? 'VERIFIED' : isExecuting ? 'EXECUTING' : 'PLANNING'}
                </div>
              </div>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 border-2 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] ${
                isMuted 
                  ? 'border-neutral-800 text-neutral-500 hover:text-neutral-300' 
                  : 'border-[#00ffcc]/60 text-[#00ffcc] bg-[#00ffcc]/10'
              }`}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={isMuted ? 'Unmute tactical audio' : 'Mute tactical audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Briefing Button */}
            <button
              onClick={() => {
                tacticalAudio.playClick();
                setShowBriefingModal(true);
              }}
              className="px-2.5 py-1.5 text-xs font-bold border-2 border-neutral-700 bg-neutral-900 hover:border-[#00ffcc] hover:text-[#00ffcc] text-neutral-300 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#00ffcc]" />
              <span className="hidden sm:inline">FIELD MANUAL</span>
            </button>

            {/* Debrief Button (Always accessible once completed) */}
            {isCompleted && (
              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  setShowDebriefModal(true);
                }}
                className="px-3 py-1.5 text-xs font-black border-2 border-[#3fb950] bg-[#3fb950]/20 text-[#3fb950] hover:bg-[#3fb950] hover:text-black transition shadow-[3px_3px_0px_0px_rgba(63,185,80,0.4)] flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                <span>DEBRIEF</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── 2. MISSION OBJECTIVE & BATTERY TELEMETRY BANNER ─── */}
      <section className="bg-[#090d15] border-b-2 border-neutral-800 px-3 sm:px-6 py-3 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-center">
          {/* Target Objective Card */}
          <div className="md:col-span-6 bg-[#0c101a] border-2 border-neutral-800 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc] flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#00ffcc]" />
                PRIMARY MISSION OBJECTIVE
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                targetEvaluation.isComplete 
                  ? 'border-[#3fb950] text-[#3fb950] bg-[#3fb950]/15' 
                  : 'border-[#fcee0a]/60 text-[#fcee0a] bg-[#fcee0a]/10'
              }`}>
                {targetEvaluation.isComplete ? 'OBJECTIVE COMPLETE ✓' : 'TARGET LOCKED'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {targetEvaluation.targets.map(t => (
                <div 
                  key={t.key}
                  className={`px-2.5 py-1 border flex items-center gap-1.5 font-bold ${
                    t.isMet 
                      ? 'border-[#3fb950] bg-[#3fb950]/10 text-[#3fb950]' 
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300'
                  }`}
                >
                  {t.isMet ? <Check className="w-3.5 h-3.5 text-[#3fb950]" /> : <Lock className="w-3.5 h-3.5 text-neutral-400" />}
                  <span>{t.key}:</span>
                  <span className={t.isMet ? 'text-white' : 'text-[#fcee0a]'}>{String(t.expected)}</span>
                  {!t.isMet && <span className="text-[10px] text-neutral-500 font-normal">(CURR: {String(t.current || 'NONE')})</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Energy Fuel Gauges */}
          <div className="md:col-span-6 bg-[#0c101a] border-2 border-neutral-800 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#fcee0a] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#fcee0a]" /> ENERGY RESERVE
              </span>
              <div className="text-[11px] font-bold">
                <span className="text-neutral-400">PROJECTED: </span>
                <span className={isBatteryOverdrawn ? 'text-[#ff0055] font-black' : 'text-[#fcee0a]'}>{plannedBatteryCost}⚡</span>
                <span className="text-neutral-500"> / </span>
                <span className="text-neutral-400">BUFFER: </span>
                <span className={isBatteryOverdrawn ? 'text-[#ff0055] font-black' : 'text-[#00ffcc]'}>
                  {Math.max(0, batteryRemaining - plannedBatteryCost)}⚡
                </span>
              </div>
            </div>

            {/* Segmented Fuel Bar (20 Brutalist Blocks) */}
            <div className="grid grid-cols-20 gap-1 h-3.5 bg-neutral-950 p-0.5 border border-neutral-800">
              {Array.from({ length: 20 }).map((_, i) => {
                const threshold = (i + 1) * (initialBattery / 20);
                const isFilled = batteryRemaining >= threshold;
                const isDrainedByPlan = isFilled && (batteryRemaining - plannedBatteryCost < threshold);
                
                return (
                  <div
                    key={i}
                    className={`h-full transition-all ${
                      isFilled
                        ? isDrainedByPlan
                          ? isBatteryOverdrawn ? 'bg-[#ff0055] opacity-80' : 'bg-[#fcee0a] opacity-50'
                          : batteryRemaining <= 6 ? 'bg-[#ff0055]' : 'bg-[#00ffcc]'
                        : 'bg-neutral-800/40'
                    }`}
                  />
                );
              })}
            </div>

            {/* Exhaustion warning */}
            {isBatteryOverdrawn && (
              <div className="mt-1.5 text-[10px] font-bold text-[#ff0055] flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>BATTERY EXHAUSTION: PLAN OVERDRAWS FACILITY CELLS BY {plannedBatteryCost - batteryRemaining}⚡. ABORT IMMINENT.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── 3. MAIN COMMAND DECK ─── */}
      <main className="max-w-7xl mx-auto w-full p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 relative z-10">
        {/* LEFT COLUMN: ACTION ARSENAL & MAGNETIC DOCK (4 COLS ON DESKTOP) */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          {/* Mobile Accordion Header for Arsenal */}
          <div className="lg:hidden flex items-center justify-between bg-[#0c101a] border-2 border-neutral-800 p-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-[#00ffcc] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00ffcc]" /> ACTION ARSENAL ({actions.length})
            </span>
            <button
              onClick={() => setMobileShowArsenal(!mobileShowArsenal)}
              className="text-xs font-bold px-2 py-1 bg-neutral-900 border border-neutral-700 text-neutral-300"
            >
              {mobileShowArsenal ? 'COLLAPSE ▲' : 'EXPAND ▼'}
            </button>
          </div>

          <div className={`flex flex-col gap-4 ${mobileShowArsenal ? 'block' : 'hidden lg:flex'}`}>
            {/* Tactical Arsenal Header */}
            <div className="border-2 border-neutral-800 bg-[#0c101a] p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00ffcc]" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-white">
                    ACTION ARSENAL
                  </h2>
                </div>
                <span className="text-[10px] text-neutral-400 font-bold">
                  {actions.length} MODULES READY
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 mb-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      tacticalAudio.playClick();
                      setSelectedCategory(cat);
                    }}
                    className={`text-[9px] px-2 py-0.5 border font-bold uppercase transition ${
                      selectedCategory === cat
                        ? 'border-[#00ffcc] bg-[#00ffcc] text-black shadow-[2px_2px_0px_0px_rgba(0,255,204,0.3)]'
                        : 'border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Action Cards List */}
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[460px] pr-1">
                {filteredActions.map((act) => {
                  const actName = act.label || (act as any).name || act.id;
                  const post = act.postConditions || (act as any).postconditions;
                  const hasPrereq = act.prerequisites && Object.keys(act.prerequisites).length > 0;
                  const hasPost = post && Object.keys(post).length > 0;
                  const desc = (act as any).description;

                  return (
                    <div
                      key={act.id}
                      onClick={() => handleAddAction(act.id, spliceSlotIndex ?? undefined)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAddAction(act.id, spliceSlotIndex ?? undefined);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Insert action ${actName}, cost ${act.cost} battery`}
                      className={`p-2.5 border-2 transition-all cursor-pointer group text-left ${
                        selectedActionId === act.id 
                          ? 'border-[#00ffcc] bg-[#00ffcc]/10 shadow-[4px_4px_0px_0px_rgba(0,255,204,0.3)]' 
                          : 'border-neutral-800 bg-[#070a10] hover:border-neutral-600 hover:bg-[#0c101a] shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="p-1 border border-neutral-700 bg-neutral-900 text-[#00ffcc] group-hover:border-[#00ffcc]/60 transition">
                            {renderActionIcon(act.id)}
                          </div>
                          <div>
                            <div className="text-xs font-black text-white group-hover:text-[#00ffcc] transition-colors leading-tight">
                              {actName}
                            </div>
                            <span className={`text-[8px] uppercase px-1 py-0.2 border font-bold ${getCategoryBadge(act.category)}`}>
                              {act.category || 'OPERATION'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-black text-[#fcee0a] bg-[#fcee0a]/10 border border-[#fcee0a]/40 px-1.5 py-0.5 flex items-center gap-0.5">
                          <Zap className="w-3 h-3 text-[#fcee0a]" /> {act.cost}⚡
                        </span>
                      </div>

                      {/* Explicit description preserved from Phase 8A */}
                      {desc && (
                        <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed font-sans">
                          {desc}
                        </p>
                      )}

                      {/* Prerequisites info */}
                      {hasPrereq && (
                        <div className="text-[9px] text-neutral-400 mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="text-rose-400 font-bold uppercase">NEEDS:</span>
                          {Object.entries(act.prerequisites!).map(([k, v]) => (
                            <span key={k} className="px-1 py-0.2 bg-black border border-neutral-800 text-neutral-300">
                              {k}=={String(v)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Post-conditions info */}
                      {hasPost && (
                        <div className="text-[9px] text-neutral-400 mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[#3fb950] font-bold uppercase">EMITS:</span>
                          {Object.entries(post!).map(([k, v]) => (
                            <span key={k} className="px-1 py-0.2 bg-black border border-neutral-800 text-neutral-300">
                              {k}=={String(v)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Irreversible Flag */}
                      {act.isIrreversible && (
                        <div className="mt-1.5 text-[8px] font-black text-[#ff0055] bg-[#ff0055]/10 border border-[#ff0055]/40 px-1.5 py-0.5 flex items-center gap-1 uppercase">
                          <AlertTriangle className="w-3 h-3 text-[#ff0055]" />
                          [IRREVERSIBLE STATE TRANSITION]
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tactical Hardware Magnetic Dock */}
            <div className="border-2 border-neutral-800 bg-[#0c101a] p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#00ffcc] animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#00ffcc]">
                    HARDWARE MAGNETIC DOCK
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 font-bold">
                  {spliceSlotIndex !== null ? `[ TARGET: SLOT ${spliceSlotIndex + 1} ]` : `[ TARGET: END ]`}
                </span>
              </div>
              <div className="text-[9px] text-neutral-400 mb-2 flex items-center justify-between">
                <span>[ ACTION SOCKETS ]</span>
                <span className="text-[#fcee0a]">CLICK ICON TO DOCK</span>
              </div>
              <div className="bg-[#05080e] p-2 border border-neutral-800 flex justify-center relative overflow-hidden">
                <MagneticDock items={dockItems} iconSize={36} maxScale={1.3} magneticDistance={70} showLabels={true} />
              </div>
              {lastEngagedAction && (
                <div className="mt-2 text-[9px] font-bold text-[#3fb950] bg-[#3fb950]/10 border border-[#3fb950]/40 px-2 py-1 flex items-center justify-between animate-fade-in">
                  <span>SOCKET ENGAGED: {lastEngagedAction}</span>
                  <span className="text-neutral-400 font-normal">CORRIDOR UPDATED ✓</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: PLANNING CORRIDOR (HERO), SENSORS & TRACE (8 COLS) */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          {/* Corridor Control Deck Header */}
          <div className="border-2 border-neutral-800 bg-[#0c101a] p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-5 h-5 text-[#00ffcc]" />
              <div>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  PLANNING CORRIDOR // EXECUTION PIPELINE
                </h2>
                <div className="text-[10px] text-neutral-400 font-bold">
                  {actionPlan.length} STEPS COMMITTED // COST: {plannedBatteryCost}⚡
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClearPlan}
                disabled={isExecuting || actionPlan.length === 0}
                className="px-2.5 py-1.5 text-xs font-bold border-2 border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-[#ff0055] hover:border-[#ff0055] disabled:opacity-30 transition flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                <Trash2 className="w-3.5 h-3.5" /> CLEAR
              </button>
              <button
                onClick={handleExecuteMission}
                disabled={isExecuting || actionPlan.length === 0 || isCompleted}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center gap-2 border-2 transition shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] ${
                  isCompleted
                    ? 'border-[#3fb950] bg-[#3fb950] text-black cursor-default'
                    : actionPlan.length === 0
                    ? 'border-neutral-800 bg-neutral-900 text-neutral-600 cursor-not-allowed'
                    : 'border-[#00ffcc] bg-[#00ffcc] hover:bg-[#00ffcc]/90 text-black shadow-[3px_3px_0px_0px_rgba(0,255,204,0.4)] animate-pulse'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isExecuting ? 'SIMULATING SEQUENCE...' : isCompleted ? 'MISSION VERIFIED' : 'ENGAGE SEQUENCE'}
              </button>
            </div>
          </div>

          {/* Splicing Indicator Banner if Splicing Active */}
          {spliceSlotIndex !== null && (
            <div className="bg-amber-950/80 border-2 border-[#fcee0a] p-3 text-xs text-[#fcee0a] flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(252,238,10,0.3)] animate-fade-in">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#fcee0a] animate-spin" />
                <span className="font-bold">
                  SPLICING SLOT #{spliceSlotIndex + 1}: Select an action card from Arsenal or Dock to insert.
                </span>
              </div>
              <button 
                onClick={() => {
                  tacticalAudio.playClick();
                  setSpliceSlotIndex(null);
                }}
                className="px-2.5 py-1 border border-[#fcee0a] bg-black text-[#fcee0a] font-bold text-[10px] uppercase hover:bg-[#fcee0a] hover:text-black transition"
              >
                CANCEL ✕
              </button>
            </div>
          )}

          {/* Planning Corridor Execution Pipeline (HERO INTERACTION) */}
          <div className="bg-[#0c101a] border-2 border-neutral-800 p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] min-h-[260px] flex flex-col justify-center">
            {actionPlan.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center">
                <div className="w-14 h-14 border-2 border-dashed border-neutral-700 bg-neutral-950 flex items-center justify-center text-neutral-500 mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]">
                  <Plus className="w-6 h-6" />
                </div>
                <div className="text-sm font-black text-white uppercase tracking-wider">
                  EXECUTION PIPELINE EMPTY
                </div>
                <p className="text-xs text-neutral-400 max-w-sm mt-1.5 font-sans leading-relaxed">
                  Select action modules from the Arsenal or use the Magnetic Quick-Dock to sequence the drone’s instruction pipeline.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {actionPlan.map((step, idx) => {
                  const actDef = actions.find(a => a.id === step.actionId);
                  const traceStep = executionTrace[idx];
                  const isStepActive = activeStepIndex === idx;
                  const isStepSuccess = traceStep?.status === 'SUCCESS';
                  const isStepFailed = traceStep?.status === 'FAILED';
                  const depCheck = stepDependencies[idx] || { isSatisfied: true, missingPrereqs: [] };

                  return (
                    <React.Fragment key={`${step.actionId}-${idx}`}>
                      {/* ─── NATIVE SVG CIRCUIT CONNECTOR (Inter-Step Bridge) ─── */}
                      {idx > 0 && (
                        <div className="flex flex-col items-center my-1 relative group w-full">
                          <svg className="w-full h-8 overflow-visible" viewBox="0 0 200 32" preserveAspectRatio="none">
                            {/* Circuit trace background */}
                            <path
                              d="M 100 0 L 100 32"
                              stroke="#1e293b"
                              strokeWidth="3"
                              fill="none"
                            />
                            {/* Active or Warning line */}
                            <path
                              d="M 100 0 L 100 32"
                              stroke={depCheck.isSatisfied ? "#00ffcc" : "#ff0055"}
                              strokeWidth="2"
                              className={depCheck.isSatisfied ? "sm-circuit-active" : "sm-circuit-warning"}
                              fill="none"
                            />
                            {/* Top junction node */}
                            <circle cx="100" cy="2" r="3.5" fill="#070a10" stroke={depCheck.isSatisfied ? "#00ffcc" : "#ff0055"} strokeWidth="1.5" />
                            <circle cx="100" cy="2" r="1.5" fill={depCheck.isSatisfied ? "#00ffcc" : "#ff0055"} />
                            
                            {/* Bottom junction node */}
                            <circle cx="100" cy="30" r="3.5" fill="#070a10" stroke={depCheck.isSatisfied ? "#00ffcc" : "#ff0055"} strokeWidth="1.5" />
                            <circle cx="100" cy="30" r="1.5" fill={depCheck.isSatisfied ? "#00ffcc" : "#ff0055"} />

                            {/* Directional chevron indicator */}
                            <polygon
                              points="96,14 100,19 104,14"
                              fill={depCheck.isSatisfied ? "#00ffcc" : "#ff0055"}
                            />
                          </svg>

                          {/* Splicing Socket / Broken Dependency Warning */}
                          {!depCheck.isSatisfied ? (
                            <div className="z-10 mt-[-4px] mb-1 flex flex-col sm:flex-row items-center gap-2 bg-[#1a0812] border border-rose-600/70 px-3 py-1.5 shadow-[3px_3px_0px_0px_rgba(255,0,85,0.3)]">
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse text-rose-500" />
                                <span className="font-black uppercase tracking-wider">BROKEN DEPENDENCY:</span>
                                <span>MISSING {depCheck.missingPrereqs.map(p => `${p.key}=${p.expected}`).join(', ')}</span>
                              </div>
                              {depCheck.suggestedActionId && (
                                <button
                                  onClick={() => {
                                    handleAddAction(depCheck.suggestedActionId!, idx);
                                  }}
                                  className="text-[10px] font-mono font-black uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-black px-2.5 py-0.5 border border-amber-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] transition flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>INSERT {depCheck.suggestedActionName}</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Quick inline splice trigger button on hover or when in splice mode */
                            <div className="z-10 mt-[-6px] opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  tacticalAudio.playClick();
                                  setSpliceSlotIndex(idx);
                                }}
                                className="text-[9px] font-mono font-bold uppercase tracking-wider bg-[#0a0f18] text-[#00ffcc] hover:bg-[#00ffcc] hover:text-black border border-[#00ffcc]/60 px-2 py-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] transition flex items-center gap-1"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                <span>SPLICE STEP HERE</span>
                              </button>
                            </div>
                          )}

                          {/* Active splice slot target banner */}
                          {spliceSlotIndex === idx && (
                            <div className="z-10 my-1 bg-amber-950/80 border-2 border-amber-500 p-2 sm:p-2.5 flex items-center justify-between text-xs text-amber-300 font-mono shadow-[4px_4px_0px_0px_rgba(252,238,10,0.4)] w-full max-w-md animate-fade-in">
                              <div className="flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-amber-400 animate-spin" />
                                <span className="text-[11px] font-black uppercase">
                                  [ SPLICING SOCKET: INSERT AT SLOT {idx + 1} ]
                                </span>
                              </div>
                              <button
                                onClick={() => {
                                  tacticalAudio.playClick();
                                  setSpliceSlotIndex(null);
                                }}
                                className="px-2 py-0.5 bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-600 text-[10px] font-black uppercase"
                              >
                                CANCEL ✕
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ─── STEP CARD (Neo-Brutalism Block) ─── */}
                      <div
                        className={`relative p-3.5 border-2 transition-all font-mono select-none ${
                          isStepActive
                            ? 'border-[#00ffcc] bg-[#00ffcc]/10 shadow-[6px_6px_0px_0px_rgba(0,255,204,0.4)] sm-snap-active'
                            : isStepSuccess
                            ? 'border-[#3fb950] bg-[#3fb950]/10 shadow-[4px_4px_0px_0px_rgba(63,185,80,0.3)]'
                            : isStepFailed
                            ? 'border-[#ff0055] bg-[#ff0055]/15 shadow-[6px_6px_0px_0px_rgba(255,0,85,0.4)]'
                            : 'border-neutral-800 bg-[#070a10] shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2 py-0.5 bg-black border border-neutral-700 text-white">
                              STEP {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className={`text-[9px] uppercase px-1.5 py-0.2 border font-bold ${getCategoryBadge(actDef?.category)}`}>
                              {actDef?.category || 'OPERATION'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[#fcee0a] bg-[#fcee0a]/10 border border-[#fcee0a]/40 px-2 py-0.5 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 text-[#fcee0a]" /> {actDef?.cost || 1}⚡
                            </span>
                          </div>
                        </div>

                        {/* Title and Icon */}
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="p-1.5 border border-neutral-700 bg-neutral-900 text-[#00ffcc]">
                            {renderActionIcon(step.actionId, "w-5 h-5")}
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-black text-white">
                              {actDef?.label || (actDef as any)?.name || step.actionId}
                            </div>
                            {actDef?.description && (
                              <div className="text-[10px] text-neutral-400 font-sans mt-0.5">
                                {actDef.description}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Dependencies Readout */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-neutral-400 py-1.5 border-t border-b border-neutral-800/80 my-2">
                          {actDef?.prerequisites && Object.keys(actDef.prerequisites).length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-rose-400 font-bold">NEEDS:</span>
                              {Object.entries(actDef.prerequisites).map(([k, v]) => (
                                <span key={k} className="px-1 py-0.2 bg-black border border-neutral-800 text-neutral-300">
                                  {k}=={String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                          {((actDef as any)?.postconditions || actDef?.postConditions) && (
                            <div className="flex items-center gap-1">
                              <span className="text-[#3fb950] font-bold">EMITS:</span>
                              {Object.entries((actDef as any)?.postconditions || actDef?.postConditions || {}).map(([k, v]) => (
                                <span key={k} className="px-1 py-0.2 bg-black border border-neutral-800 text-neutral-300">
                                  {k}=={String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Step Execution Trace State */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <div>
                            {traceStep ? (
                              isStepSuccess ? (
                                <span className="text-[#3fb950] text-[10px] font-black flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3fb950]" />
                                  [✓ EXECUTED ⚡{traceStep.batteryCost} USED]
                                </span>
                              ) : isStepFailed ? (
                                <span className="text-[#ff0055] text-[10px] font-black flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-[#ff0055]" />
                                  [✕ STALLED // ⚡{traceStep.penaltyCost} PENALTY BURNED]
                                </span>
                              ) : null
                            ) : isStepActive ? (
                              <span className="text-[#00ffcc] text-[10px] font-black flex items-center gap-1 animate-pulse">
                                <Activity className="w-3.5 h-3.5" />
                                [▶ EXECUTING INSTRUCTION...]
                              </span>
                            ) : (
                              <span className="text-neutral-500 text-[10px] font-bold">
                                [STANDBY // READY]
                              </span>
                            )}
                          </div>

                          {/* Reorder and Splice Controls */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleMoveStep(idx, 'LEFT')}
                              disabled={idx === 0 || isExecuting}
                              className="p-1 border border-neutral-700 bg-neutral-900 hover:border-neutral-500 text-neutral-300 disabled:opacity-20"
                              title="Move Step Up/Earlier"
                              aria-label="Move step earlier in sequence"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveStep(idx, 'RIGHT')}
                              disabled={idx === actionPlan.length - 1 || isExecuting}
                              className="p-1 border border-neutral-700 bg-neutral-900 hover:border-neutral-500 text-neutral-300 disabled:opacity-20"
                              title="Move Step Down/Later"
                              aria-label="Move step later in sequence"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                tacticalAudio.playClick();
                                setSpliceSlotIndex(idx);
                              }}
                              disabled={isExecuting}
                              className="px-2 py-0.5 text-[10px] font-bold uppercase border border-[#00ffcc]/60 bg-[#00ffcc]/10 hover:bg-[#00ffcc] hover:text-black text-[#00ffcc] transition"
                              title="Splice action directly before this step"
                            >
                              SPLICE
                            </button>
                            <button
                              onClick={() => handleRemoveStep(idx)}
                              disabled={isExecuting}
                              className="p-1 border border-neutral-700 bg-neutral-900 hover:border-[#ff0055] hover:text-[#ff0055] text-neutral-400 disabled:opacity-20"
                              title="Remove step from pipeline"
                              aria-label="Remove step"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── 4. DYNAMIC ENVIRONMENTAL TELEMETRY GRID ─── */}
          <div className="border-2 border-neutral-800 bg-[#0c101a] p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#3fb950]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  FACILITY STATE TELEMETRY SENSORS
                </h3>
              </div>
              <span className="text-[10px] text-[#3fb950] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-ping" />
                ONLINE
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-2.5 text-xs">
              {Object.entries({ ...(config.initialState || {}), ...environmentState }).map(([key, val]) => {
                const targetVal = config.targetState ? config.targetState[key] : undefined;
                const isTarget = targetVal !== undefined;
                const isTargetMet = Boolean(isTarget && String(targetVal).toUpperCase() === String(val).toUpperCase());
                const indicator = getSensorStateTag(val, isTargetMet);

                return (
                  <div
                    key={key}
                    className={`p-2 border-2 flex flex-col justify-between transition-colors ${
                      isTargetMet 
                        ? 'border-[#3fb950] bg-[#3fb950]/10 shadow-[2px_2px_0px_0px_rgba(63,185,80,0.3)]' 
                        : isTarget
                        ? 'border-[#fcee0a]/60 bg-[#fcee0a]/5 shadow-[2px_2px_0px_0px_rgba(252,238,10,0.2)]'
                        : 'border-neutral-800 bg-[#070a10]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[9px] font-bold text-neutral-400 truncate" title={key}>
                        {key.replace(/_/g, ' ')}
                      </span>
                      {isTarget && (
                        <span className={`text-[8px] font-black uppercase px-1 border ${
                          isTargetMet ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#fcee0a] text-[#fcee0a]'
                        }`}>
                          {isTargetMet ? 'MET' : 'TARGET'}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-black text-white truncate" title={String(val)}>
                      {String(val).replace(/_/g, ' ')}
                    </div>

                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 border ${indicator.color}`}>
                        {indicator.tag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── 5. EXECUTION TRACE EVENT STREAM ─── */}
          {executionTrace.length > 0 && (
            <div className="border-2 border-neutral-800 bg-[#0c101a] p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800 mb-2">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-[#00ffcc]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    MISSION EXECUTION TELEMETRY TRACE
                  </h3>
                </div>
                <span className="text-[10px] text-neutral-400 font-bold">
                  {executionTrace.length} EVENTS LOGGED
                </span>
              </div>

              <div className="flex flex-col gap-1.5 text-xs overflow-y-auto max-h-48 pr-1 font-mono">
                {executionTrace.map((t, idx) => {
                  const isSuccess = t.status === 'SUCCESS';
                  return (
                    <div
                      key={idx}
                      className={`p-2 border flex items-center justify-between gap-2 text-[11px] ${
                        isSuccess 
                          ? 'border-neutral-800 bg-[#070a10] text-neutral-300' 
                          : 'border-[#ff0055]/60 bg-[#ff0055]/10 text-rose-300 font-bold'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-neutral-500 font-bold">[{String(idx + 1).padStart(2, '0')}]</span>
                        <span className="text-white font-black">{t.label || t.actionName || t.actionId}</span>
                        {t.stateChanges && Object.keys(t.stateChanges).length > 0 && (
                          <span className="text-[#00ffcc] truncate">
                            ➔ {Object.entries(t.stateChanges).map(([k, v]) => `${k}:${v}`).join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-neutral-400 text-[10px]">
                          ⚡{isSuccess ? t.batteryCost : t.penaltyCost}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 border ${
                          isSuccess ? 'border-[#3fb950] text-[#3fb950]' : 'border-[#ff0055] text-[#ff0055]'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ─── 4-TIER CAUSAL SYSTEMS DIAGNOSTIC MODAL ─── */}
      {showFailureModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0e14] border-2 border-red-600 max-w-2xl w-full p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(255,0,85,0.4)] font-mono text-left">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-red-600/40 text-red-400">
              <ShieldAlert className="w-6 h-6 animate-bounce text-red-500" />
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-red-400">
                  {failedStep ? 'MISSION STALL DETECTED' : 'MISSION TARGET INCOMPLETE'}
                </h3>
                <span className="text-[10px] text-neutral-400 font-bold uppercase">
                  4-TIER CAUSAL DIAGNOSTIC REPORT
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 my-4 text-xs">
              {/* Tier 1 */}
              <div className="p-2.5 bg-black border border-neutral-800">
                <div className="text-[10px] font-black text-[#00ffcc] uppercase tracking-wider mb-1">
                  1. WHAT YOU PLANNED:
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {actionPlan.map((s, i) => (
                    <span 
                      key={i} 
                      className={`px-2 py-0.5 border text-[11px] font-bold ${
                        failedStep && i === failedStep.slot 
                          ? 'border-red-500 bg-red-950/80 text-red-300' 
                          : 'border-neutral-700 bg-neutral-900 text-neutral-300'
                      }`}
                    >
                      {i + 1}. {s.actionId}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tier 2 */}
              <div className="p-2.5 bg-red-950/40 border border-red-600/40">
                <div className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-1">
                  2. WHAT ACTUALLY HAPPENED:
                </div>
                <div className="text-red-200 leading-relaxed font-bold">
                  {failedStep ? (
                    <>
                      Steps 1 through {failedStep.slot} completed and drained normal cell power. Step #{failedStep.slot + 1} [
                      <span className="text-white underline">{failedStep.label || failedStep.actionName}</span>] encountered an unsatisfied prerequisite and stalled the drone, burning a 1⚡ penalty.
                    </>
                  ) : (
                    <>
                      All {actionPlan.length} planned steps executed without stall, but the final facility environment state does not satisfy all required mission targets.
                    </>
                  )}
                </div>
              </div>

              {/* Tier 3 */}
              <div className="p-2.5 bg-black border border-neutral-800">
                <div className="text-[10px] font-black text-[#fcee0a] uppercase tracking-wider mb-1">
                  3. WHY THE FACILITY STALLED:
                </div>
                <div className="text-neutral-300 leading-relaxed font-sans text-xs">
                  {failedStep?.failureReason || failureExplanation || 'A required environmental switch or power line was not active before this step was triggered.'}
                </div>
              </div>

              {/* Tier 4 */}
              <div className="p-2.5 bg-[#00ffcc]/10 border border-[#00ffcc]/40">
                <div className="text-[10px] font-black text-[#3fb950] uppercase tracking-wider mb-1">
                  4. TACTICAL RECOVERY & ADAPTATION:
                </div>
                <div className="text-emerald-200 leading-relaxed font-sans text-xs">
                  {failedStep ? (
                    <>
                      Splice the missing prerequisite module immediately prior to Step #{failedStep.slot + 1}. Check the Action Arsenal for modules that emit the required state.
                    </>
                  ) : (
                    <>
                      Inspect the unachieved target conditions in the PRIMARY MISSION OBJECTIVE card above and add the appropriate sequence to conclude the infiltration.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              {failedStep && (
                <button
                  onClick={() => {
                    tacticalAudio.playClick();
                    setShowFailureModal(false);
                    setSpliceSlotIndex(failedStep.slot);
                  }}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>SPLICE BEFORE STEP #{failedStep.slot + 1}</span>
                </button>
              )}
              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  setShowFailureModal(false);
                }}
                className="px-4 py-2 border-2 border-neutral-700 hover:border-neutral-500 text-neutral-300 font-bold text-xs uppercase"
              >
                CLOSE & INSPECT PIPELINE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 30-SECOND FIELD MANUAL BRIEFING MODAL ─── */}
      {showBriefingModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0e14] border-2 border-[#00ffcc] max-w-xl w-full p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,255,204,0.3)] font-mono text-left">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#00ffcc]/30">
              <div className="flex items-center gap-2 text-[#00ffcc]">
                <Radio className="w-5 h-5 animate-pulse" />
                <span className="font-black text-xs uppercase tracking-widest">
                  FIELD MANUAL // 30-SECOND BRIEFING
                </span>
              </div>
              <button 
                onClick={() => {
                  tacticalAudio.playClick();
                  setShowBriefingModal(false);
                }}
                className="text-neutral-400 hover:text-white text-xs font-bold px-2 py-0.5 border border-neutral-700 hover:border-neutral-500"
              >
                SKIP ✕
              </button>
            </div>

            <div className="my-4">
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider mb-2">
                MISSION OBJECTIVE: SECURE THE FACILITY
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed mb-4 font-sans">
                {config.briefing || config.missionBrief || 'Construct an autonomous instruction pipeline to infiltrate the automated complex without draining battery cells or violating environmental prerequisites.'}
              </p>

              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-start gap-3 p-2.5 bg-black border border-neutral-800">
                  <span className="w-5 h-5 bg-[#00ffcc] text-black font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                  <div>
                    <strong className="text-white block uppercase text-[11px] mb-0.5">Autonomous Pipeline:</strong>
                    <span className="text-neutral-400 text-[11px] font-sans">You do not steer the probe in real time. Assemble an execution sequence in the Planning Corridor and engage.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-black border border-neutral-800">
                  <span className="w-5 h-5 bg-[#fcee0a] text-black font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                  <div>
                    <strong className="text-white block uppercase text-[11px] mb-0.5">Prerequisites & Energy Cost:</strong>
                    <span className="text-neutral-400 text-[11px] font-sans">Every action alters facility state and consumes battery (⚡). Ensure every action has its dependencies satisfied before calling it.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-black border border-neutral-800">
                  <span className="w-5 h-5 bg-[#3fb950] text-black font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                  <div>
                    <strong className="text-white block uppercase text-[11px] mb-0.5">Diagnose & In-Place Splice:</strong>
                    <span className="text-neutral-400 text-[11px] font-sans">If an instruction stalls, check the 4-tier diagnostic report. Splice the missing prerequisite directly into the sequence and re-engage.</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                setShowBriefingModal(false);
              }}
              className="w-full py-3 bg-[#00ffcc] text-black hover:bg-[#00ffcc]/90 font-black text-xs uppercase tracking-wider transition shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] flex items-center justify-center gap-2"
            >
              INITIALIZE OPERATIONS CONSOLE ➔
            </button>
          </div>
        </div>
      )}

      {/* ─── COVERT EXTRACTION DEBRIEF REPORT MODAL ─── */}
      {showDebriefModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b0e14] border-2 border-[#3fb950] max-w-xl w-full p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(63,185,80,0.4)] font-mono text-center">
            <div className="w-14 h-14 bg-[#3fb950]/20 border-2 border-[#3fb950] flex items-center justify-center mx-auto mb-3 text-[#3fb950] animate-bounce">
              <Award className="w-8 h-8" />
            </div>

            <span className="text-[10px] font-black text-[#3fb950] uppercase tracking-widest">
              COVERT EXTRACTION VERIFIED // MISSION COMPLETE
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mt-1 mb-1">
              OPERATION SUCCESSFUL
            </h3>

            <div className="text-3xl font-black text-[#00ffcc] my-3">
              +{scoreEarned} PTS AWARDED
            </div>

            {/* Score Breakdown Table */}
            {scoreBreakdown && (
              <div className="p-3 bg-black border border-neutral-800 text-xs text-left mb-4 flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between text-white border-b border-neutral-800 pb-1">
                  <span>Base Mission Points:</span>
                  <span className="font-bold text-[#3fb950]">+{scoreBreakdown.basePoints} pts</span>
                </div>
                {scoreBreakdown.batteryBonus > 0 && (
                  <div className="flex justify-between text-white border-b border-neutral-800 pb-1">
                    <span>Battery Cell Efficiency Bonus:</span>
                    <span className="font-bold text-[#fcee0a]">+{scoreBreakdown.batteryBonus} pts</span>
                  </div>
                )}
                {scoreBreakdown.firstRunBonus > 0 && (
                  <div className="flex justify-between text-white border-b border-neutral-800 pb-1">
                    <span>First-Run Surgical Infiltration Bonus:</span>
                    <span className="font-bold text-[#00ffcc]">+{scoreBreakdown.firstRunBonus} pts</span>
                  </div>
                )}
                {scoreBreakdown.cleanSheetBonus > 0 && (
                  <div className="flex justify-between text-white">
                    <span>Clean Sheet (Zero Stalls) Bonus:</span>
                    <span className="font-bold text-[#3fb950]">+{scoreBreakdown.cleanSheetBonus} pts</span>
                  </div>
                )}
              </div>
            )}

            {/* Systems Engineering Debrief */}
            <div className="p-3 bg-[#00ffcc]/5 border border-[#00ffcc]/40 text-left text-xs leading-relaxed text-neutral-300 mb-5">
              <div className="font-black text-[#00ffcc] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00ffcc]" />
                SYSTEMS ARCHITECTURE DEBRIEF: DIRECTED ACYCLIC GRAPHS (DAGs)
              </div>
              <p className="text-[11px] text-neutral-400 font-sans">
                You constructed an execution pipeline where steps had strict preconditions and postconditions. Production workflow engines (CI/CD pipelines, Kubernetes controllers, and AI agent plan graphs) sequence work using this exact dependency structure.
              </p>
            </div>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                setShowDebriefModal(false);
              }}
              className="w-full py-3 bg-[#00ffcc] text-black hover:bg-[#00ffcc]/90 font-black text-xs uppercase tracking-wider transition shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]"
            >
              DISMISS DEBRIEF / RESUME CONSOLE ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionChallenge;
