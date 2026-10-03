import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';
import tacticalAudio from '../lib/tacticalAudio';
import { 
  Search, 
  Activity, 
  Layers, 
  FileSearch, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Award, 
  Sparkles, 
  Info, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Crosshair, 
  Clock, 
  Terminal, 
  Database 
} from 'lucide-react';

/* ─── INTERFACES ─────────────────────────────────────────── */
export interface TelemetryEvent {
  id: string;
  timestamp: string;
  sourceNode: string;
  targetNode: string;
  protocol: string;
  payloadSizeMb: number;
  latencyMs: number;
  status: 'SUCCESS' | 'ERROR';
  description?: string;
  isRogue?: boolean;
  traceDetails?: any;
}

export interface ScannerConfig {
  scenarioTitle?: string;
  missionBrief?: string;
  actionBudget?: number;
  events: TelemetryEvent[];
  baseline?: {
    expectedProtocols?: string[];
    normalLatencyRangeMs?: [number, number];
    normalPayloadRangeMb?: [number, number];
    protocols?: Record<string, any>;
    registeredNodes?: string[];
    knownExternalRelays?: string[];
  };
  probeCosts?: Record<string, number>;
  scoring?: {
    basePoints?: number;
    corroboratingBonus?: number;
    tokenBonusPerUnit?: number;
    cleanSheetBonus?: number;
    incorrectPenalty?: number;
  };
}

export interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (result: any) => void;
}

/* ─── PIXEL GLYPH COMPONENTS ─────────────────────────────── */

/** Crisp 8x8 Pixel Radar Glyph */
const PixelRadarIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="7" y="0" width="2" height="2" />
    <rect x="7" y="14" width="2" height="2" />
    <rect x="0" y="7" width="2" height="2" />
    <rect x="14" y="7" width="2" height="2" />
    <rect x="3" y="3" width="2" height="2" />
    <rect x="11" y="3" width="2" height="2" />
    <rect x="3" y="11" width="2" height="2" />
    <rect x="11" y="11" width="2" height="2" />
    <rect x="7" y="6" width="2" height="4" />
    <rect x="6" y="7" width="4" height="2" />
  </svg>
);

/** Crisp 8x8 Pixel Cadence Glyph */
const PixelCadenceIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="4" y="1" width="8" height="2" />
    <rect x="7" y="3" width="2" height="3" />
    <rect x="5" y="6" width="6" height="2" />
    <rect x="3" y="8" width="10" height="2" />
    <rect x="2" y="10" width="12" height="2" />
    <rect x="1" y="12" width="14" height="3" />
    <rect x="10" y="5" width="2" height="5" fill="#fcee0a" />
  </svg>
);

/** Crisp 8x8 Pixel Warning Hazard */
const PixelHazardIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="7" y="1" width="2" height="2" />
    <rect x="6" y="3" width="4" height="2" />
    <rect x="5" y="5" width="6" height="2" />
    <rect x="4" y="7" width="8" height="2" />
    <rect x="3" y="9" width="10" height="2" />
    <rect x="2" y="11" width="12" height="2" />
    <rect x="1" y="13" width="14" height="2" />
    <rect x="7" y="5" width="2" height="4" fill="#000" />
    <rect x="7" y="11" width="2" height="2" fill="#000" />
  </svg>
);

/** Crisp 8x8 Pixel Verified Shield */
const PixelShieldIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="2" y="1" width="12" height="2" />
    <rect x="1" y="3" width="14" height="4" />
    <rect x="2" y="7" width="12" height="3" />
    <rect x="3" y="10" width="10" height="2" />
    <rect x="5" y="12" width="6" height="2" />
    <rect x="7" y="14" width="2" height="2" />
    <rect x="6" y="7" width="2" height="2" fill="#0a0a0c" />
    <rect x="8" y="5" width="2" height="4" fill="#0a0a0c" />
  </svg>
);

/** Crisp 8x8 Pixel Spy Glyph */
const PixelSpyIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="4" y="2" width="8" height="2" />
    <rect x="2" y="4" width="12" height="6" />
    <rect x="4" y="6" width="2" height="2" fill="#0a0a0c" />
    <rect x="10" y="6" width="2" height="2" fill="#0a0a0c" />
    <rect x="6" y="10" width="4" height="2" />
    <rect x="3" y="12" width="2" height="2" />
    <rect x="11" y="12" width="2" height="2" />
  </svg>
);

/** Animated 8x8 Pixel Data Node Glyph */
const PixelDataNode = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
    <rect x="7" y="0" width="2" height="4" />
    <rect x="7" y="12" width="2" height="4" />
    <rect x="0" y="7" width="4" height="2" />
    <rect x="12" y="7" width="4" height="2" />
    <rect x="4" y="4" width="8" height="8" />
    <rect x="6" y="6" width="4" height="4" fill="#0a0a0c" />
    <rect x="7" y="7" width="2" height="2" fill="currentColor" className="animate-pulse" />
  </svg>
);

/** Crisp Pixel Signal / Cadence Glyph */
const PixelSignalGlyph = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 10 10" className={className} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="0" y="8" width="2" height="2" />
    <rect x="3" y="5" width="2" height="5" />
    <rect x="6" y="2" width="2" height="8" />
    <rect x="9" y="0" width="1" height="10" />
  </svg>
);

/** Crisp Pixel Crosshair / Anomaly Candidate Glyph */
const PixelCrosshairGlyph = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 9 9" className={className} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="4" y="0" width="1" height="3" />
    <rect x="4" y="6" width="1" height="3" />
    <rect x="0" y="4" width="3" height="1" />
    <rect x="6" y="4" width="3" height="1" />
    <rect x="3" y="3" width="3" height="3" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

/** Crisp Pixel Audit Check Glyph */
const PixelAuditCheck = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 8 8" className={className} fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
    <rect x="5" y="1" width="2" height="2" />
    <rect x="4" y="3" width="2" height="2" />
    <rect x="1" y="4" width="2" height="2" />
    <rect x="2" y="5" width="2" height="2" />
    <rect x="3" y="4" width="2" height="2" />
  </svg>
);

/* ─── MAIN COMPONENT ─────────────────────────────────────── */
export default function ScannerChallenge({ challenge, sessionCode, onSubmitted }: Props) {
  const config: ScannerConfig = challenge.config || {};
  const events: TelemetryEvent[] = useMemo(() => config.events || [], [config.events]);
  const defaultBudget = config.actionBudget || 15;

  // Investigation state
  const [tokensRemaining, setTokensRemaining] = useState<number>(defaultBudget);
  const [tokensUsed, setTokensUsed] = useState<number>(0);
  const [unlockedTraces, setUnlockedTraces] = useState<string[]>([]);
  const [activeHypothesis, setActiveHypothesis] = useState<string | null>(null);
  const [overlayHistory, setOverlayHistory] = useState<any[]>([]);
  const [clearedFalsePositives, setClearedFalsePositives] = useState<string[]>([]);
  const [probeLog, setProbeLog] = useState<any[]>([]);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [isAccused, setIsAccused] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);

  // Audio mute state
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => tacticalAudio.getIsMuted());

  // UI / Selection state
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [activeProtocolFilter, setActiveProtocolFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals & Panels
  const [baselineModalOpen, setBaselineModalOpen] = useState<boolean>(false);
  const [baselineData, setBaselineData] = useState<any>(null);
  const [overlayModalOpen, setOverlayModalOpen] = useState<boolean>(false);
  const [activeOverlayResult, setActiveOverlayResult] = useState<any>(null);
  const [traceModalOpen, setTraceModalOpen] = useState<boolean>(false);
  const [activeTraceResult, setActiveTraceResult] = useState<any>(null);
  const [hypothesisModalOpen, setHypothesisModalOpen] = useState<boolean>(false);
  const [accuseModalOpen, setAccuseModalOpen] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isExecutingProbe, setIsExecutingProbe] = useState<boolean>(false);
  const [traceDetailsMap, setTraceDetailsMap] = useState<Record<string, any>>({});

  // Accusation fields
  const [accusedEventId, setAccusedEventId] = useState<string>('');
  const [accusedMechanism, setAccusedMechanism] = useState<string>('PERIODIC_BEACON');
  const [accusedEvidence, setAccusedEvidence] = useState<string>('');
  const [accusationResult, setAccusationResult] = useState<{
    isCorrect: boolean;
    pointsAwarded: number;
    explanation?: string;
  } | null>(null);
  const [showLearningDialog, setShowLearningDialog] = useState<boolean>(false);

  // 30-Second Onboarding Briefing
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem(`scanner_briefing_seen_${challenge.id}`);
    } catch {
      return true;
    }
  });
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  const toggleSound = () => {
    const nextMuted = tacticalAudio.toggleMute();
    setIsAudioMuted(nextMuted);
    if (!nextMuted) {
      tacticalAudio.playClick();
    }
  };

  const dismissOnboarding = () => {
    tacticalAudio.playDockSnap();
    setShowOnboarding(false);
    try {
      sessionStorage.setItem(`scanner_briefing_seen_${challenge.id}`, 'true');
    } catch {
      // storage unavailable
    }
  };

  // Reconnection / State restoration
  const fetchState = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/${sessionCode}/scanner-state?challengeId=${challenge.id}`);
      if (res.data) {
        setTokensRemaining(res.data.actionTokensRemaining ?? defaultBudget);
        setTokensUsed(res.data.tokensUsed ?? 0);
        setUnlockedTraces(res.data.unlockedTraces || []);
        if (res.data.unlockedTraceDetails) {
          setTraceDetailsMap(res.data.unlockedTraceDetails);
        }
        if (res.data.baselineData) {
          setBaselineData(res.data.baselineData);
        }
        setActiveHypothesis(res.data.activeHypothesis || null);
        setOverlayHistory(res.data.overlayHistory || []);
        setClearedFalsePositives(res.data.clearedFalsePositives || []);
        setProbeLog(res.data.probeLog || []);
        setIsSolved(Boolean(res.data.isSolved));
        setIsAccused(Boolean(res.data.isAccused));
        setScore(res.data.score || 0);
      }
    } catch (err) {
      console.warn('Could not restore scanner state:', err);
    }
  }, [sessionCode, challenge.id, defaultBudget]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Toggle selection for Multi-Event Pattern Overlay
  const toggleEventSelection = (id: string) => {
    tacticalAudio.playClick();
    setSelectedEventIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        if (prev.length >= 4) {
          setActionError('Pattern Overlay supports at most 4 events simultaneously');
          tacticalAudio.playAlarm();
          return prev;
        }
        setActionError(null);
        return [...prev, id];
      }
    });
  };

  // Execute server-authoritative probe
  const executeProbe = async (action: string, payload: Record<string, any> = {}) => {
    setActionError(null);
    setIsExecutingProbe(true);
    tacticalAudio.playRelay();

    try {
      const res = await api.post(`/sessions/${sessionCode}/scanner-probe`, {
        challengeId: challenge.id,
        actionPayload: {
          action,
          ...payload,
        },
      });

      if (res.data) {
        setTokensRemaining(res.data.actionTokensRemaining ?? tokensRemaining);
        setTokensUsed(res.data.tokensUsed ?? tokensUsed);
        setUnlockedTraces(res.data.unlockedTraces || unlockedTraces);
        setActiveHypothesis(res.data.activeHypothesis || activeHypothesis);
        setOverlayHistory(res.data.overlayHistory || overlayHistory);
        setClearedFalsePositives(res.data.clearedFalsePositives || clearedFalsePositives);
        setProbeLog(res.data.probeLog || probeLog);

        if (action === 'SCAN_BASELINE') {
          setBaselineData(res.data.actionResult);
          setBaselineModalOpen(true);
          tacticalAudio.playDockSnap();
        } else if (action === 'PATTERN_OVERLAY' || action === 'COMPARE_EVENTS') {
          setActiveOverlayResult(res.data.actionResult);
          setOverlayModalOpen(true);
          if (res.data.actionResult?.correlationDetected) {
            tacticalAudio.playSuccess();
          } else {
            tacticalAudio.playDockSnap();
          }
        } else if (action === 'DEEP_TRACE') {
          setActiveTraceResult(res.data.actionResult);
          if (res.data.actionResult?.eventId) {
            setTraceDetailsMap(prev => ({
              ...prev,
              [res.data.actionResult.eventId]: res.data.actionResult,
            }));
          }
          setTraceModalOpen(true);
          tacticalAudio.playDockSnap();
        } else if (action === 'SET_HYPOTHESIS') {
          setHypothesisModalOpen(false);
          tacticalAudio.playClick();
        }
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || 'Investigation probe failed';
      setActionError(errMsg);
      tacticalAudio.playAlarm();
    } finally {
      setIsExecutingProbe(false);
    }
  };

  // Final Accusation submission
  const handleAccusation = async () => {
    if (!accusedEventId) {
      setActionError('Select the primary anomalous event');
      tacticalAudio.playAlarm();
      return;
    }
    if (!accusedMechanism) {
      setActionError('Select the suspected anomaly mechanism');
      tacticalAudio.playAlarm();
      return;
    }

    setIsExecutingProbe(true);
    setActionError(null);
    tacticalAudio.playRelay();

    try {
      const res = await api.post('/sessions/active/submit', {
        answer: {
          anomalousEventId: accusedEventId,
          anomalyMechanism: accusedMechanism,
          supportingEvidence: accusedEvidence,
        },
      });

      const data = res.data;
      const isCorr = Boolean(data.isCorrect);
      const pts = Number(data.pointsAwarded ?? 0);

      setIsSolved(isCorr);
      setIsAccused(true);
      setScore(pts);
      setAccusationResult({
        isCorrect: isCorr,
        pointsAwarded: pts,
        explanation: isCorr
          ? 'ANOMALY CONFIRMED: You successfully detected the periodic beaconing cadence between EVT-11 and EVT-17 to unmapped ext-staging-relay, correctly dismissing the three benign false positives.'
          : 'ACCUSATION DISMISSED: The targeted event does not match the covert beaconing profile, or represents a benign operational spike.',
      });

      setAccuseModalOpen(false);
      setShowLearningDialog(true);

      if (isCorr) {
        tacticalAudio.playSuccess();
      } else {
        tacticalAudio.playAlarm();
      }

      if (onSubmitted) {
        onSubmitted(data);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || 'Accusation submission failed';
      setActionError(errMsg);
      tacticalAudio.playAlarm();
    } finally {
      setIsExecutingProbe(false);
    }
  };

  // Filtered telemetry list
  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      if (activeProtocolFilter !== 'ALL' && evt.protocol.toUpperCase() !== activeProtocolFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && evt.status !== statusFilter) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesId = evt.id.toLowerCase().includes(q);
        const matchesSrc = evt.sourceNode.toLowerCase().includes(q);
        const matchesTgt = evt.targetNode.toLowerCase().includes(q);
        const matchesProto = evt.protocol.toLowerCase().includes(q);
        if (!matchesId && !matchesSrc && !matchesTgt && !matchesProto) {
          return false;
        }
      }
      return true;
    });
  }, [events, activeProtocolFilter, statusFilter, searchQuery]);

  // Selected events objects
  const selectedEvents = useMemo(() => {
    return events.filter(e => selectedEventIds.includes(e.id));
  }, [events, selectedEventIds]);

  // Real-time quick correlation check for selected events
  const liveCorrelationInsights = useMemo(() => {
    if (selectedEvents.length < 2) return null;
    const sorted = [...selectedEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    
    // Check pairwise deltas
    const pairs: Array<{ pair: string; deltaSec: number; payloadDelta: number; sameTarget: boolean; target: string }> = [];
    let hasExact600 = false;
    let hasIdenticalPayload = false;
    let hasUnmappedTarget = false;

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const e1 = sorted[i];
        const e2 = sorted[j];
        const [h1, m1, s1] = e1.timestamp.split(':').map(Number);
        const [h2, m2, s2] = e2.timestamp.split(':').map(Number);
        const t1 = h1 * 3600 + m1 * 60 + s1;
        const t2 = h2 * 3600 + m2 * 60 + s2;
        const deltaSec = Math.abs(t2 - t1);
        const payloadDelta = Math.abs(Math.round((e1.payloadSizeMb - e2.payloadSizeMb) * 100) / 100);
        const sameTarget = e1.targetNode === e2.targetNode;
        const isUnmapped = e1.targetNode.includes('relay') || e2.targetNode.includes('relay');

        if (deltaSec === 600) hasExact600 = true;
        if (payloadDelta === 0) hasIdenticalPayload = true;
        if (sameTarget && isUnmapped) hasUnmappedTarget = true;

        pairs.push({
          pair: `${e1.id} ↔ ${e2.id}`,
          deltaSec,
          payloadDelta,
          sameTarget,
          target: e1.targetNode,
        });
      }
    }

    const isHighConfidenceAnomaly = hasExact600 && hasIdenticalPayload && hasUnmappedTarget;

    return {
      pairs,
      hasExact600,
      hasIdenticalPayload,
      hasUnmappedTarget,
      isHighConfidenceAnomaly,
    };
  }, [selectedEvents]);

  // Protocol counts for badge pills
  const protocolCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: events.length };
    events.forEach(e => {
      const p = e.protocol.toUpperCase();
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [events]);

  return (
    <div 
      className="w-full max-w-7xl mx-auto flex flex-col gap-5 relative z-10 p-2 sm:p-4 text-white font-mono"
      role="region"
      aria-label="AI Anomaly Forensics Console"
    >

      {/* ─── 30-SECOND ONBOARDING BRIEFING MODAL ────────────────── */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="rs-panel rs-panel-active max-w-2xl w-full p-6 sm:p-8 flex flex-col gap-6 bg-[var(--bg-card)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <PixelRadarIcon className="w-6 h-6 text-[var(--accent-primary)] animate-pulse" />
                <div>
                  <div className="text-[10px] text-[var(--accent-primary)] font-bold tracking-widest uppercase">
                    AIERA TELEMETRY FORENSICS // PROTOCOL BRIEFING
                  </div>
                  <h3 className="text-xl font-black text-white tracking-wider uppercase">
                    OPERATION PHANTOM CADENCE
                  </h3>
                </div>
              </div>
              <span className="rs-pixel-badge bg-[var(--bg-base)] text-[var(--accent-primary)] border-[var(--accent-primary)]">
                PHASE 9B // STEP {onboardingStep}/3
              </span>
            </div>

            {onboardingStep === 1 && (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] flex items-start gap-3">
                  <Terminal className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-200 leading-relaxed">
                    <strong className="text-[var(--accent-primary)] uppercase tracking-wider block mb-1">
                      THREAT MANDATE:
                    </strong>
                    A covert exfiltration channel is disguised within standard cluster traffic. 22 operational telemetry events were intercepted. Your goal is to identify the covert automated beacon without falsely accusing benign high-volume spikes.
                  </div>
                </div>

                <div className="p-4 bg-[rgba(252,238,10,0.08)] border-2 border-[var(--cyber-yellow)] flex items-start gap-3">
                  <PixelHazardIcon className="w-5 h-5 text-[var(--cyber-yellow)] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-200 leading-relaxed">
                    <strong className="text-[var(--cyber-yellow)] uppercase tracking-wider block mb-1">
                      CRUCIAL WARNING: NOISE VS SIGNAL
                    </strong>
                    Extreme numbers often deceive. Routine cold storage archives generate massive payloads (92 GB), and GPU compiles cause 12s stalls. Do not accuse based on raw size alone — audit them with <strong>[DEEP TRACE]</strong> to clear false positives.
                  </div>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] flex items-start gap-3">
                  <Layers className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-200 leading-relaxed">
                    <strong className="text-[var(--accent-primary)] uppercase tracking-wider block mb-1">
                      PRIMARY FORENSIC WEAPON: PATTERN OVERLAY
                    </strong>
                    Select 2 to 4 events using row checkboxes, then trigger <strong>[PATTERN OVERLAY]</strong> (2 Probes).
                    The server computes timestamp intervals, payload deltas, and shared egress endpoints to detect covert clockwork cadences.
                  </div>
                </div>

                <div className="p-4 bg-[rgba(0,255,204,0.08)] border-2 border-[var(--accent-primary)] flex items-start gap-3">
                  <PixelCadenceIcon className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-200 leading-relaxed">
                    <strong className="text-[var(--accent-primary)] uppercase tracking-wider block mb-1">
                      THE COVERT BEACON SIGNATURE:
                    </strong>
                    Human and benign operational traffic fluctuates dynamically. Automated covert bots repeat with <strong>identical micro-payloads</strong> and <strong>exact periodic intervals</strong> to unmapped relays.
                  </div>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] flex items-start gap-3">
                  <Crosshair className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-200 leading-relaxed">
                    <strong className="text-[var(--accent-primary)] uppercase tracking-wider block mb-1">
                      FINITE PROBE ECONOMY & INDICTMENT STAKES:
                    </strong>
                    You start with <strong>{defaultBudget} Action Probes</strong>. Conserving probes earns <strong>+10 pts per remaining probe</strong>. Cleared false positives protect your score from wrongful accusations.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[var(--bg-base)] border-2 border-[var(--success)] flex flex-col gap-1">
                    <div className="text-[var(--success)] font-black text-sm">+100 BASE + 30 CLUE</div>
                    <div className="text-[10px] text-gray-400">+20 Clean Sheet + 10/Probe</div>
                  </div>
                  <div className="p-3 bg-[var(--bg-base)] border-2 border-[var(--cyber-pink)] flex flex-col gap-1">
                    <div className="text-[var(--cyber-pink)] font-black text-sm">-40 POINT PENALTY</div>
                    <div className="text-[10px] text-gray-400">For unverified false accusation</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t-2 border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={dismissOnboarding}
                className="text-xs text-[var(--text-muted)] hover:text-white uppercase tracking-wider underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                SKIP MANUAL
              </button>
              <div className="flex gap-3">
                {onboardingStep > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      tacticalAudio.playClick();
                      setOnboardingStep(s => s - 1);
                    }}
                    className="btn btn-secondary text-xs uppercase"
                  >
                    ← BACK
                  </button>
                )}
                {onboardingStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      tacticalAudio.playClick();
                      setOnboardingStep(s => s + 1);
                    }}
                    className="btn btn-primary text-xs uppercase"
                  >
                    NEXT →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={dismissOnboarding}
                    className="btn btn-primary text-xs uppercase shadow-[0_0_15px_rgba(0,255,204,0.4)]"
                  >
                    LAUNCH FORENSICS CONSOLE ⚡
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER HUD: CONSOLE TITLE, AUDIO & PROBE ECONOMY ── */}
      <div className="rs-panel p-5 bg-[var(--bg-card)] flex flex-col gap-4">
        {/* Top bar with system badges and audio controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--bg-base)] border-2 border-[var(--accent-primary)] text-[var(--accent-primary)] shadow-[0_0_10px_rgba(0,255,204,0.3)]">
              <PixelRadarIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rs-pixel-badge bg-[rgba(0,255,204,0.1)] text-[var(--accent-primary)] border-[var(--accent-primary)]">
                  AIERA FORENSICS // TELEMETRY SUITE
                </span>
                <span className="rs-pixel-badge bg-[var(--bg-base)] text-gray-400 border-[var(--border-subtle)]">
                  ROOM: {sessionCode}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-widest uppercase mt-0.5">
                {config.scenarioTitle || challenge.prompt || 'OPERATION PHANTOM CADENCE: TELEMETRY FORENSICS'}
              </h1>
            </div>
          </div>

          {/* Quick utility controls: Sound, Field manual, Baseline */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className={`p-2 border-2 text-xs flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                isAudioMuted
                  ? 'border-[var(--border-subtle)] text-gray-400 hover:text-white'
                  : 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[rgba(0,255,204,0.1)] shadow-[0_0_8px_rgba(0,255,204,0.3)]'
              }`}
              title={isAudioMuted ? 'Unmute tactical audio' : 'Mute tactical audio'}
              aria-label={isAudioMuted ? 'Tactical audio muted, click to unmute' : 'Tactical audio active, click to mute'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline font-bold">{isAudioMuted ? 'AUDIO OFF' : 'AUDIO ON'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                tacticalAudio.playClick();
                setShowOnboarding(true);
                setOnboardingStep(1);
              }}
              className="p-2 border-2 border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-gray-300 hover:text-white text-xs flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              title="Open field briefing"
              aria-label="Open field manual briefing"
            >
              <HelpCircle className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="hidden sm:inline font-bold">MANUAL</span>
            </button>
          </div>
        </div>

        {/* ─── DOT-MATRIX EVENT OVERVIEW GRID ─────────────────── */}
        <div className="bg-[var(--bg-base)] p-3 border-2 border-[var(--border-subtle)] flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="rs-led-dot rs-led-active" />
              <span>CLUSTER TELEMETRY MATRIX (22 NODES)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="rs-led-dot rs-led-cleared" /> Cleared Benign ({clearedFalsePositives.length}/3)
              </span>
              <span className="flex items-center gap-1">
                <span className="rs-led-dot rs-led-warn" /> Extreme Spike
              </span>
              <span className="flex items-center gap-1">
                <span className="rs-led-dot rs-led-active" /> Selected ({selectedEventIds.length})
              </span>
            </div>
          </div>

          {/* 22-Node Interactive LED strip */}
          <div className="grid grid-cols-11 sm:grid-cols-22 gap-1.5 py-1">
            {events.map((evt, idx) => {
              const isSelected = selectedEventIds.includes(evt.id);
              const isClearedFP = clearedFalsePositives.includes(evt.id);
              const isSpike = evt.payloadSizeMb > 50 || evt.latencyMs > 5000 || evt.status === 'ERROR';
              const isUnmapped = evt.targetNode.includes('relay');

              let ledClass = 'rs-led-idle';
              if (isSelected) ledClass = 'rs-led-active';
              else if (isClearedFP) ledClass = 'rs-led-cleared';
              else if (isSpike) ledClass = 'rs-led-warn';
              else if (isUnmapped) ledClass = 'rs-led-danger';

              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => toggleEventSelection(evt.id)}
                  title={`${evt.id} (${evt.sourceNode} → ${evt.targetNode}) ${evt.payloadSizeMb}MB • Click to select`}
                  aria-label={`Toggle selection for event ${evt.id}`}
                  className={`h-7 flex flex-col items-center justify-center border transition-all text-[9px] font-bold ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.2)] text-[var(--accent-primary)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  <span className={`rs-led-dot ${ledClass} mb-0.5`} />
                  <span className="text-[8px]">{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── TACTICAL INSTRUMENTATION HUD: PROBE METER & STATE ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Tile 1: Action Probe Economy Meter */}
          <div className="p-3 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase">
              <div className="flex items-center gap-1.5">
                <PixelDataNode className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>ACTION PROBE ECONOMY</span>
              </div>
              <span className="text-[var(--accent-primary)]">+10 PTS/TOKEN</span>
            </div>
            
            <div className="flex items-baseline gap-2 my-2">
              <span className={`text-3xl font-black ${
                tokensRemaining <= 2 ? 'text-[var(--cyber-pink)] animate-pulse' : tokensRemaining <= 5 ? 'text-[var(--cyber-yellow)]' : 'text-[var(--accent-primary)]'
              }`}>
                {tokensRemaining}
              </span>
              <span className="text-xs text-gray-400">/ {defaultBudget} PROBES READY</span>
            </div>

            {/* Dot-matrix LED token gauge */}
            <div className="flex gap-1 overflow-hidden" title={`${tokensRemaining} probe tokens remaining`}>
              {Array.from({ length: defaultBudget }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 border ${
                    i < tokensRemaining
                      ? tokensRemaining <= 2
                        ? 'bg-[var(--cyber-pink)] border-[var(--cyber-pink)] shadow-[0_0_4px_#ff0055]'
                        : tokensRemaining <= 5
                        ? 'bg-[var(--cyber-yellow)] border-[var(--cyber-yellow)] shadow-[0_0_4px_#fcee0a]'
                        : 'bg-[var(--accent-primary)] border-[var(--accent-primary)] shadow-[0_0_4px_#00ffcc]'
                      : 'bg-[#1a1d24] border-[#2a2f38]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Tile 2: False Positive Audit Meter */}
          <div className="p-3 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase">
              <span>BENIGN OUTLIER AUDITS</span>
              <span className="text-[var(--success)]">{clearedFalsePositives.length}/3 CLEARED</span>
            </div>

            <div className="flex items-center gap-2 my-2">
              {['EVT-08', 'EVT-14', 'EVT-19'].map(id => {
                const isCleared = clearedFalsePositives.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (isCleared) {
                        const cached = traceDetailsMap[id];
                        if (cached) {
                          setActiveTraceResult(cached);
                          setTraceModalOpen(true);
                        }
                      } else {
                        setSelectedEventIds([id]);
                      }
                    }}
                    className={`flex-1 p-1.5 border text-center text-[10px] font-bold uppercase transition-all ${
                      isCleared
                        ? 'border-[var(--success)] bg-[rgba(63,185,80,0.15)] text-[var(--success)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-gray-400 hover:text-white hover:border-[var(--cyber-yellow)]'
                    }`}
                  >
                    <div>{id}</div>
                    <div className="text-[8px]">{isCleared ? 'CLEARED ✓' : 'UNAUDITED'}</div>
                  </button>
                );
              })}
            </div>

            <div className="text-[9px] text-gray-400">
              Clear 92GB backup, 403 cascade, 12s stall to avoid -40 penalty.
            </div>
          </div>

          {/* Tile 3: Working Hypothesis Theory */}
          <div className="p-3 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase">
              <div className="flex items-center gap-1.5">
                <PixelSpyIcon className="w-3 h-3 text-[var(--accent-primary)]" />
                <span>WORKING HYPOTHESIS</span>
              </div>
              <span className="text-gray-400">0 PROBES</span>
            </div>

            <div className="my-2">
              <button
                type="button"
                onClick={() => {
                  tacticalAudio.playClick();
                  setHypothesisModalOpen(true);
                }}
                className="w-full p-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-left text-xs text-white truncate flex items-center justify-between gap-2"
                aria-label="Set or view working hypothesis"
              >
                <span className="truncate">{activeHypothesis || 'SELECT THEORY...'}</span>
                <span className="text-[10px] text-[var(--accent-primary)] shrink-0">CHANGE ▾</span>
              </button>
            </div>

            <div className="text-[9px] text-gray-400">
              Logs analytical intent without spending investigation tokens.
            </div>
          </div>

          {/* Tile 4: Investigation Score & Status */}
          <div className={`p-3 bg-[var(--bg-base)] border-2 flex flex-col justify-between ${
            isSolved ? 'border-[var(--success)]' : isAccused ? 'border-[var(--cyber-pink)]' : 'border-[var(--border-subtle)]'
          }`}>
            <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase">
              <div className="flex items-center gap-1.5">
                <PixelShieldIcon className="w-3 h-3 text-white" />
                <span>INVESTIGATION STATUS</span>
              </div>
              <span className="rs-pixel-badge bg-[var(--bg-card)] border-[var(--border-subtle)] text-gray-300 flex items-center gap-1">
                <span className={`rs-led-dot ${isSolved ? 'rs-led-cleared' : isAccused ? 'rs-led-danger' : 'rs-led-active'}`} />
                {isSolved ? 'SOLVED' : isAccused ? 'DISMISSED' : 'ACTIVE'}
              </span>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <span className={`text-3xl font-black ${
                isSolved ? 'text-[var(--success)]' : isAccused ? 'text-[var(--cyber-pink)]' : 'text-white'
              }`}>
                {score}
              </span>
              <span className="text-xs text-gray-400">PTS EARNED</span>
            </div>

            <div className="text-[9px] text-gray-400 truncate">
              {isSolved ? '✓ Covert beaconing cadence verified' : isAccused ? '⚠ Indictment denied: -40 pts' : 'Evaluating telemetry stream...'}
            </div>
          </div>

        </div>
      </div>

      {/* ─── ERROR BANNER ────────────────────────────────────────── */}
      {actionError && (
        <div className="p-3 bg-[rgba(255,0,85,0.15)] border-2 border-[var(--cyber-pink)] flex items-center justify-between text-xs text-[var(--cyber-pink)] font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button 
            type="button"
            onClick={() => setActionError(null)} 
            className="text-[10px] underline hover:text-white uppercase"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* ─── LIVE PATTERN OVERLAY & CORRELATION RADAR PANEL ──────── */}
      {selectedEvents.length >= 2 && (
        <div className="rs-panel p-4 bg-[var(--bg-card)] border-2 border-[var(--accent-primary)] shadow-[0_0_20px_rgba(0,255,204,0.15)] flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 text-xs">
            <div className="flex items-center gap-2 font-black text-[var(--accent-primary)] uppercase">
              <Layers className="w-4 h-4" />
              <span>LIVE PATTERN CORRELATION LAYER // [{selectedEvents.map(e => e.id).join(', ')}]</span>
              <PixelDataNode className="w-3 h-3 ml-2 text-[var(--accent-primary)]" />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedEventIds([])}
                className="text-[10px] text-gray-400 hover:text-white underline uppercase"
              >
                CLEAR SELECTION
              </button>

              {/* Action Button: Pattern overlay probe */}
              {(() => {
                const sortedKey = selectedEventIds.slice().sort().join(',');
                const existingOverlay = overlayHistory.find(
                  o => Array.isArray(o.selectedIds) && o.selectedIds.slice().sort().join(',') === sortedKey
                );
                if (existingOverlay) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        tacticalAudio.playDockSnap();
                        setActiveOverlayResult(existingOverlay);
                        setOverlayModalOpen(true);
                      }}
                      className="btn btn-secondary border-[var(--accent-primary)] text-[var(--accent-primary)] text-xs py-1 px-3"
                    >
                      VIEW ANALYZED OVERLAY (0 Tokens)
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => executeProbe('PATTERN_OVERLAY', { eventIds: selectedEventIds })}
                    disabled={isExecutingProbe || selectedEventIds.length < 2 || selectedEventIds.length > 4 || tokensRemaining < 2}
                    className="btn btn-primary text-xs py-1 px-4 shadow-[0_0_15px_rgba(0,255,204,0.4)]"
                  >
                    RUN PATTERN OVERLAY PROBE (2 Tokens) ⚡
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Pairwise comparison live insights */}
          {liveCorrelationInsights && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className={`p-2.5 bg-[var(--bg-base)] border-2 ${
                liveCorrelationInsights.hasExact600 ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.06)]' : 'border-[var(--border-subtle)]'
              }`}>
                <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>CADENCE INTERVAL</span>
                </div>
                <div className="mt-1 font-bold">
                  {liveCorrelationInsights.hasExact600 ? (
                    <span className="text-[var(--accent-primary)] font-black text-sm">
                      ★ EXACT 600.00s (10m 00s)
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      Variable interval ({liveCorrelationInsights.pairs[0]?.deltaSec}s)
                    </span>
                  )}
                </div>
              </div>

              <div className={`p-2.5 bg-[var(--bg-base)] border-2 ${
                liveCorrelationInsights.hasIdenticalPayload ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.06)]' : 'border-[var(--border-subtle)]'
              }`}>
                <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>PAYLOAD DELTA</span>
                </div>
                <div className="mt-1 font-bold">
                  {liveCorrelationInsights.hasIdenticalPayload ? (
                    <span className="text-[var(--accent-primary)] font-black text-sm">
                      ★ IDENTICAL 0.24 MB MICRO-BURST
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      Payload delta: {liveCorrelationInsights.pairs[0]?.payloadDelta} MB
                    </span>
                  )}
                </div>
              </div>

              <div className={`p-2.5 bg-[var(--bg-base)] border-2 ${
                liveCorrelationInsights.hasUnmappedTarget ? 'border-[var(--cyber-yellow)] bg-[rgba(252,238,10,0.06)]' : 'border-[var(--border-subtle)]'
              }`}>
                <div className="text-[10px] text-gray-400 uppercase flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5 text-[var(--cyber-yellow)]" />
                  <span>DESTINATION TARGET</span>
                </div>
                <div className="mt-1 font-bold">
                  {liveCorrelationInsights.hasUnmappedTarget ? (
                    <span className="text-[var(--cyber-yellow)] font-black text-sm">
                      ★ UNMAPPED RELAY (ext-staging-relay)
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      {liveCorrelationInsights.pairs[0]?.sameTarget ? 'Shared destination' : 'Different destinations'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SVG Relationship Connector preview */}
          <div className="bg-[var(--bg-base)] p-3 border border-[var(--border-subtle)] relative overflow-hidden flex items-center justify-between">
            <div className="text-xs text-gray-300 flex items-center gap-3">
              <span className="rs-pixel-badge bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)] border-[var(--accent-primary)]">
                CADENCE DETECTOR
              </span>
              <span>
                {liveCorrelationInsights?.isHighConfidenceAnomaly ? (
                  <strong className="text-[var(--accent-primary)]">
                    ALERT: HIGH FORENSIC CORRELATION CONFIRMED BETWEEN {selectedEvents.map(e => e.id).join(' AND ')}.
                  </strong>
                ) : (
                  <span>Select events with matching low payloads and fixed cadence to uncover the rogue channel.</span>
                )}
              </span>
            </div>

            {liveCorrelationInsights?.isHighConfidenceAnomaly && (
              <button
                type="button"
                onClick={() => {
                  tacticalAudio.playDockSnap();
                  setAccusedEventId(selectedEvents[0].id);
                  setAccusedMechanism('PERIODIC_BEACON');
                  setAccusedEvidence(`${selectedEvents[1]?.id || 'EVT-17'} paired beacon at delta 600s to ext-staging-relay`);
                  setAccuseModalOpen(true);
                }}
                className="btn btn-primary bg-[var(--cyber-pink)] border-[var(--cyber-pink)] text-white text-xs py-1 px-3 uppercase shrink-0 shadow-[0_0_12px_rgba(255,0,85,0.4)]"
              >
                PROCEED TO ACCUSATION →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── ACTION TOOLBAR: FILTERS, PROBES, INDICTMENT BUTTON ── */}
      <div className="rs-panel p-4 bg-[var(--bg-card)] flex flex-wrap items-center justify-between gap-4 text-xs">
        
        {/* Left actions: Baseline probe & Quick trace */}
        <div className="flex flex-wrap items-center gap-3">
          {baselineData ? (
            <button
              type="button"
              onClick={() => {
                tacticalAudio.playDockSnap();
                setBaselineModalOpen(true);
              }}
              className="btn btn-secondary border-[var(--accent-primary)] text-[var(--accent-primary)] flex items-center gap-2 text-xs"
              aria-label="View baseline profile, 0 tokens"
            >
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>VIEW BASELINE (0 Tokens)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => executeProbe('SCAN_BASELINE')}
              disabled={isExecutingProbe || tokensRemaining < 1}
              className="btn btn-secondary flex items-center gap-2 hover:border-[var(--accent-primary)] text-xs"
              aria-label="Scan cluster baseline profile, 1 token"
            >
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>SCAN BASELINE (1 Token)</span>
            </button>
          )}

          {/* Deep Trace button */}
          {(() => {
            const isSingle = selectedEventIds.length === 1;
            const singleId = isSingle ? selectedEventIds[0] : null;
            const isAlreadyUnlocked = singleId ? unlockedTraces.includes(singleId) : false;

            if (isSingle && isAlreadyUnlocked) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    tacticalAudio.playDockSnap();
                    const cached = traceDetailsMap[singleId!];
                    if (cached) {
                      setActiveTraceResult(cached);
                      setTraceModalOpen(true);
                    } else {
                      executeProbe('DEEP_TRACE', { eventId: singleId });
                    }
                  }}
                  className="btn btn-secondary border-[var(--accent-primary)] text-[var(--accent-primary)] flex items-center gap-2 text-xs"
                  aria-label={`View audit for ${singleId}, 0 tokens`}
                >
                  <FileSearch className="w-4 h-4" />
                  <span>VIEW AUDIT ({singleId} • 0 Tokens)</span>
                </button>
              );
            }

            return (
              <button
                type="button"
                onClick={() => {
                  if (singleId) {
                    executeProbe('DEEP_TRACE', { eventId: singleId });
                  } else {
                    setActionError('Select exactly 1 event to execute Deep Trace');
                    tacticalAudio.playAlarm();
                  }
                }}
                disabled={isExecutingProbe || !isSingle || tokensRemaining < 2}
                className={`btn flex items-center gap-2 text-xs ${
                  isSingle 
                    ? 'btn-secondary border-[var(--cyber-yellow)] text-[var(--cyber-yellow)] shadow-[0_0_10px_rgba(252,238,10,0.2)]' 
                    : 'btn-secondary opacity-50'
                }`}
                aria-label={`Deep trace selected event, 2 tokens`}
              >
                <FileSearch className="w-4 h-4" />
                <span>DEEP TRACE ({singleId || 'Pick 1'} • 2 Tokens)</span>
              </button>
            );
          })()}
        </div>

        {/* Right CTA: Final Accusation button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              tacticalAudio.playDockSnap();
              setActionError(null);
              if (selectedEventIds.length === 1) {
                setAccusedEventId(selectedEventIds[0]);
              }
              setAccuseModalOpen(true);
            }}
            disabled={isExecutingProbe || isSolved}
            className="btn btn-primary bg-[var(--cyber-pink)] hover:bg-red-600 border-[var(--cyber-pink)] text-white font-black flex items-center gap-2 text-xs px-5 shadow-[0_0_20px_rgba(255,0,85,0.4)] uppercase"
            aria-label="Issue formal indictment accusation"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>FORMALIZE ACCUSATION ⚖</span>
          </button>
        </div>
      </div>

      {/* ─── FILTERS & SEARCH ROW ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Protocol filter pills with counts */}
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Protocol filters">
          {['ALL', 'HTTPS', 'GCS', 'GRPC', 'WEBSOCKET', 'DB_SYNC'].map(proto => (
            <button
              key={proto}
              type="button"
              onClick={() => {
                tacticalAudio.playClick();
                setActiveProtocolFilter(proto);
              }}
              className={`px-2.5 py-1 text-xs border font-bold uppercase transition-all ${
                activeProtocolFilter === proto
                  ? 'bg-[var(--accent-primary)] text-black border-[var(--accent-primary)] shadow-[0_0_10px_rgba(0,255,204,0.4)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {proto} <span className="text-[10px] opacity-75">({protocolCounts[proto] || 0})</span>
            </button>
          ))}
        </div>

        {/* Search input & status filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter node, ID, relay..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-[var(--accent-primary)]"
              aria-label="Search telemetry events"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => {
              tacticalAudio.playClick();
              setStatusFilter(e.target.value);
            }}
            className="px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-white text-xs focus:outline-none focus:border-[var(--accent-primary)]"
            aria-label="Filter events by status"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="SUCCESS">SUCCESS ONLY</option>
            <option value="ERROR">ERROR ONLY</option>
          </select>
        </div>
      </div>

      {/* ─── 22-EVENT FORENSIC FEED TABLE (HERO SURFACE) ───────── */}
      <div 
        className="rs-panel p-0 bg-[var(--bg-card)] overflow-x-auto"
        role="region"
        aria-label="Cluster Telemetry Stream"
      >
        <div className="p-3 bg-[var(--bg-base)] border-b-2 border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 uppercase">
          <div className="flex items-center gap-2 flex-wrap">
            <Terminal className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <span className="font-bold tracking-wide">INTERCEPTED FORENSIC FEED: {filteredEvents.length} OF {events.length} EVENTS</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 text-[10px] text-gray-400 font-mono">
              <span className="rs-led-dot rs-led-cleared" /> CLEARED
              <span className="rs-led-dot rs-led-active ml-1" /> AUDITED
              <span className="rs-led-dot rs-led-warn ml-1" /> LIVE SIGNAL
              <span className="rs-led-dot rs-led-idle ml-1" /> BASELINE
            </span>
          </div>
          <div className="font-mono text-[10px] text-gray-400">
            <span>SELECT 2–4 TO COMPARE CADENCE // 1 TO DEEP TRACE</span>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse font-mono" role="table">
          <thead>
            <tr className="border-b-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] text-gray-400 uppercase text-[10px]">
              <th className="p-3 w-10 text-center" scope="col">SEL</th>
              <th className="p-3" scope="col">EVENT ID // CLASSIFICATION</th>
              <th className="p-3" scope="col">TIME</th>
              <th className="p-3" scope="col">SOURCE NODE</th>
              <th className="p-3" scope="col">DESTINATION RELAY</th>
              <th className="p-3" scope="col">PROTOCOL</th>
              <th className="p-3 text-right" scope="col">PAYLOAD</th>
              <th className="p-3 text-right" scope="col">LATENCY</th>
              <th className="p-3 text-center" scope="col">STATUS</th>
              <th className="p-3 text-center" scope="col">FORENSIC AUDIT BADGE</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((evt, idx) => {
              const isSelected = selectedEventIds.includes(evt.id);
              const isTraced = unlockedTraces.includes(evt.id);
              const isClearedFP = clearedFalsePositives.includes(evt.id);
              const isVolumeSpike = evt.payloadSizeMb > 50;
              const isLatencySpike = evt.latencyMs > 5000;
              const isErrorSpike = evt.status === 'ERROR';
              const isUnmapped = evt.targetNode.includes('relay');

              // Visual language & subtle correlation
              const isCorrelatedCadence = evt.id === 'EVT-11' || evt.id === 'EVT-17';
              const isPartnerSelected = isCorrelatedCadence && selectedEventIds.some(id => id === 'EVT-11' || id === 'EVT-17');
              const isHighVarianceCandidate = evt.id === 'EVT-08' || evt.id === 'EVT-14' || evt.id === 'EVT-19';
              const isLiveTelemetry = isUnmapped || isVolumeSpike || isLatencySpike || isErrorSpike || isSelected;

              return (
                <tr
                  key={evt.id}
                  tabIndex={0}
                  role="row"
                  aria-selected={isSelected}
                  aria-label={`Event ${evt.id}: ${evt.sourceNode} to ${evt.targetNode}, ${evt.payloadSizeMb}MB, ${evt.status}. Click or press space to toggle selection.`}
                  onClick={() => toggleEventSelection(evt.id)}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleEventSelection(evt.id);
                    }
                  }}
                  className={`rs-grid-row border-b border-[var(--border-subtle)] cursor-pointer select-none ${
                    isSelected 
                      ? 'bg-[rgba(0,255,204,0.14)] border-l-4 border-l-[var(--accent-primary)] shadow-[inset_0_0_12px_rgba(0,255,204,0.08)]' 
                      : isPartnerSelected
                      ? 'bg-[rgba(0,255,204,0.05)] border-l-2 border-l-[var(--accent-primary)] border-r-2 border-r-[rgba(0,255,204,0.4)]'
                      : idx % 2 === 0 
                      ? 'bg-[var(--bg-card)] hover:bg-[rgba(0,255,204,0.05)] hover:border-l-2 hover:border-l-[var(--accent-primary)]' 
                      : 'bg-[var(--bg-surface)] hover:bg-[rgba(0,255,204,0.05)] hover:border-l-2 hover:border-l-[var(--accent-primary)]'
                  }`}
                >
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleEventSelection(evt.id)}
                      className="cursor-pointer accent-[var(--accent-primary)] w-4 h-4"
                      aria-label={`Select ${evt.id}`}
                    />
                  </td>
                  
                  <td className="p-3 font-bold text-white">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Investigation Status LED */}
                      {isClearedFP ? (
                        <span className="rs-led-dot rs-led-cleared shrink-0" title="Audited: Cleared Benign" aria-label="Cleared Benign" />
                      ) : isTraced ? (
                        <span className="rs-led-dot rs-led-active shrink-0" title="Audited: Deep Trace Logged" aria-label="Deep Traced" />
                      ) : isLiveTelemetry ? (
                        <span className="rs-led-dot rs-led-warn shrink-0" title="Live Telemetry: Deviation Detected" aria-label="Live Anomaly Candidate" />
                      ) : (
                        <span className="rs-led-dot rs-led-idle shrink-0" title="Baseline Telemetry: Normal" aria-label="Normal Baseline" />
                      )}

                      {/* Event ID with Active Pulse for Live Telemetry */}
                      <span className={`tracking-wide font-mono ${isSelected ? 'text-[var(--accent-primary)]' : ''}`}>
                        {evt.id}
                      </span>

                      {/* Subtle Telemetry Activity Node on Live/Active Streams */}
                      {isLiveTelemetry && (
                        <PixelDataNode className="w-3 h-3 text-[var(--accent-primary)] rs-telemetry-pulse shrink-0" />
                      )}

                      {/* Investigation Candidate Marker (EVT-08, EVT-14, EVT-19) */}
                      {isHighVarianceCandidate && (
                        <span 
                          className="rs-pixel-connector rs-pixel-connector-candidate"
                          title="High-Amplitude Variance Target: VAR::AMP-α (Investigation Candidate)"
                        >
                          <PixelCrosshairGlyph className="w-2.5 h-2.5 text-[var(--cyber-yellow)] shrink-0" />
                          <span>VAR::AMP-α</span>
                        </span>
                      )}

                      {/* Subtle Correlated Signal Marker (EVT-11 ↔ EVT-17) */}
                      {isCorrelatedCadence && (
                        <span 
                          className={`rs-pixel-connector transition-all ${
                            isPartnerSelected 
                              ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.2)] text-[var(--accent-primary)] shadow-[0_0_8px_rgba(0,255,204,0.35)]' 
                              : 'border-cyan-800/70 bg-cyan-950/30 text-cyan-300'
                          }`}
                          title="Correlated Signal Channel: SIG::CH-β (Synchronized Relay)"
                        >
                          <PixelSignalGlyph className="w-2.5 h-2.5 text-[var(--accent-primary)] shrink-0" />
                          <span>SIG::CH-β</span>
                        </span>
                      )}

                      {isVolumeSpike && (
                        <span className="rs-pixel-badge bg-[rgba(252,238,10,0.15)] text-[var(--cyber-yellow)] border-[var(--cyber-yellow)]">
                          92GB SPIKE
                        </span>
                      )}
                      {isErrorSpike && (
                        <span className="rs-pixel-badge bg-[rgba(255,0,85,0.15)] text-[var(--cyber-pink)] border-[var(--cyber-pink)]">
                          403 CASCADE
                        </span>
                      )}
                      {isLatencySpike && (
                        <span className="rs-pixel-badge bg-[rgba(252,238,10,0.15)] text-[var(--cyber-yellow)] border-[var(--cyber-yellow)]">
                          12.4s STALL
                        </span>
                      )}
                      {isUnmapped && (
                        <span className="rs-pixel-badge bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)] border-[var(--accent-primary)]">
                          UNMAPPED
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3 text-gray-300 whitespace-nowrap">{evt.timestamp}</td>
                  <td className="p-3 text-gray-300 font-medium whitespace-nowrap">{evt.sourceNode}</td>
                  
                  <td className="p-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={isUnmapped ? 'text-[var(--cyber-yellow)] font-bold' : 'text-gray-300'}>
                        {evt.targetNode}
                      </span>
                      {isCorrelatedCadence && (
                        <span className="text-[10px] text-cyan-400 font-bold opacity-75" title="Relay Channel β Connected">
                          [⊸]
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-gray-300 text-[10px]">
                      {evt.protocol}
                    </span>
                  </td>

                  <td className="p-3 text-right whitespace-nowrap">
                    <span className={isVolumeSpike ? 'text-[var(--cyber-yellow)] font-black text-sm' : 'text-gray-300'}>
                      {evt.payloadSizeMb} MB
                    </span>
                  </td>

                  <td className="p-3 text-right whitespace-nowrap">
                    <span className={isLatencySpike ? 'text-[var(--cyber-pink)] font-black text-sm' : 'text-gray-300'}>
                      {evt.latencyMs} ms
                    </span>
                  </td>

                  <td className="p-3 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                      evt.status === 'SUCCESS' 
                        ? 'text-[var(--success)] bg-[rgba(63,185,80,0.1)] border-[rgba(63,185,80,0.3)]' 
                        : 'text-[var(--cyber-pink)] bg-[rgba(255,0,85,0.1)] border-[rgba(255,0,85,0.3)]'
                    }`}>
                      {evt.status}
                    </span>
                  </td>

                  <td className="p-3 text-center whitespace-nowrap">
                    {isClearedFP ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          tacticalAudio.playDockSnap();
                          const cached = traceDetailsMap[evt.id];
                          if (cached) {
                            setActiveTraceResult(cached);
                            setTraceModalOpen(true);
                          }
                        }}
                        onKeyDown={e => e.stopPropagation()}
                        className="rs-pixel-badge bg-[rgba(63,185,80,0.2)] text-[var(--success)] border-[var(--success)] hover:bg-[rgba(63,185,80,0.3)] transition-colors cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--success)]"
                        title="Click to view verified legitimate origin notes"
                        aria-label={`View audit report for ${evt.id}: Cleared benign`}
                      >
                        <PixelAuditCheck className="w-2.5 h-2.5 text-[var(--success)] shrink-0" />
                        <span>CLEARED BENIGN ✓</span>
                      </button>
                    ) : isTraced ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          tacticalAudio.playDockSnap();
                          const cached = traceDetailsMap[evt.id];
                          if (cached) {
                            setActiveTraceResult(cached);
                            setTraceModalOpen(true);
                          }
                        }}
                        onKeyDown={e => e.stopPropagation()}
                        className="rs-pixel-badge bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)] border-[var(--accent-primary)] hover:bg-[rgba(0,255,204,0.25)] transition-colors cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]"
                        title="Click to view deep trace details"
                        aria-label={`View deep trace details for ${evt.id}`}
                      >
                        <PixelSpyIcon className="w-2.5 h-2.5 text-[var(--accent-primary)] shrink-0" />
                        <span>AUDITED // VIEW</span>
                      </button>
                    ) : (
                      <span className="text-gray-500 text-[10px] inline-flex items-center gap-1 opacity-60">
                        <span className="rs-led-dot rs-led-idle" />
                        <span>UNAUDITED</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── BASELINE PROFILE MODAL ──────────────────────────────── */}
      {baselineModalOpen && baselineData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rs-panel rs-panel-active max-w-2xl w-full p-6 bg-[var(--bg-card)] text-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-[var(--accent-primary)]">
                <Activity className="w-5 h-5" />
                <span>AIERA CLUSTER TELEMETRY BASELINE</span>
              </div>
              <button 
                type="button"
                onClick={() => setBaselineModalOpen(false)} 
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--bg-base)] border border-[var(--border-subtle)] flex flex-col gap-2">
                <div className="text-gray-400 font-bold uppercase text-[10px]">AUTHORIZED TRAFFIC ENVELOPE</div>
                <div className="flex flex-col gap-1 text-gray-300">
                  <div>• Normal Payload: 0.1 MB – 100.0 MB</div>
                  <div>• Normal Latency: 10 ms – 15,000 ms</div>
                  <div>• Valid Protocols: HTTPS, GCS, GRPC, WEBSOCKET, DB_SYNC</div>
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-base)] border border-[var(--border-subtle)] flex flex-col gap-2">
                <div className="text-gray-400 font-bold uppercase text-[10px]">REGISTERED DESTINATIONS</div>
                <div className="flex flex-col gap-1 text-gray-300">
                  <div className="text-[var(--success)]">• storage-gateway (Authorized Archive)</div>
                  <div className="text-[var(--success)]">• vpc-connector (Authorized Gateway)</div>
                  <div className="text-[var(--cyber-yellow)] font-bold">• ext-staging-relay (UNREGISTERED // ANOMALY)</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[rgba(0,255,204,0.08)] border border-[var(--accent-primary)] text-gray-200 leading-relaxed">
              <strong className="text-[var(--accent-primary)]">ANALYST DIRECTIVE:</strong> High numbers alone do not equal an attack. 92 GB cold storage batches and 12s JIT compiles are legitimate. The covert channel relies on <strong>unauthorized egress destinations and mechanical clockwork intervals</strong>.
            </div>

            <button 
              type="button"
              onClick={() => setBaselineModalOpen(false)} 
              className="btn btn-primary w-full uppercase"
            >
              CLOSE BASELINE PROFILE
            </button>
          </div>
        </div>
      )}

      {/* ─── PATTERN OVERLAY MATRIX MODAL ────────────────────────── */}
      {overlayModalOpen && activeOverlayResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="rs-panel rs-panel-active max-w-3xl w-full p-6 bg-[var(--bg-card)] text-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-[var(--accent-primary)]">
                <Layers className="w-5 h-5" />
                <span>PATTERN OVERLAY MATRIX // [{activeOverlayResult.selectedIds?.join(', ')}]</span>
              </div>
              <button 
                type="button"
                onClick={() => setOverlayModalOpen(false)} 
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Correlation Alert Banner */}
            <div className={`p-4 border-2 flex items-start gap-3 ${
              activeOverlayResult.correlationDetected
                ? 'bg-[rgba(0,255,204,0.15)] border-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-base)] border-[var(--border-subtle)] text-gray-300'
            }`}>
              {activeOverlayResult.correlationDetected ? (
                <Sparkles className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-black uppercase tracking-wider mb-1">
                  {activeOverlayResult.correlationDetected ? 'STRONG COVERT CORRELATION CONFIRMED' : 'NORMAL OPERATIONAL VARIANCE DETECTED'}
                </div>
                <div className="text-xs text-gray-200 leading-relaxed">
                  {activeOverlayResult.correlationSummary}
                </div>
              </div>
            </div>

            {/* Pairwise Comparison Cards */}
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {activeOverlayResult.comparisons?.map((c: any, i: number) => (
                <div key={i} className="p-3 bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
                  <span className="font-black text-[var(--accent-primary)] text-sm">{c.pair}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-400">Δ TIME: </span>
                      <strong className={c.deltaSeconds === 600 ? 'text-[var(--accent-primary)] font-black' : 'text-gray-300'}>
                        {c.deltaSeconds}s {c.deltaSeconds === 600 ? '(EXACT 10 MIN)' : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400">Δ PAYLOAD: </span>
                      <strong className={c.payloadDeltaMb === 0 ? 'text-[var(--accent-primary)] font-black' : 'text-gray-300'}>
                        {c.payloadDeltaMb} MB {c.payloadDeltaMb === 0 ? '(IDENTICAL)' : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400">TARGET: </span>
                      <strong className={c.sameTarget ? 'text-[var(--cyber-yellow)]' : 'text-gray-300'}>
                        {c.sameTarget ? 'SHARED' : 'DIFFERENT'}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              type="button"
              onClick={() => setOverlayModalOpen(false)} 
              className="btn btn-primary w-full uppercase"
            >
              CLOSE PATTERN OVERLAY
            </button>
          </div>
        </div>
      )}

      {/* ─── DEEP TRACE INSPECTOR MODAL ──────────────────────────── */}
      {traceModalOpen && activeTraceResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="rs-panel rs-panel-warning max-w-xl w-full p-6 bg-[var(--bg-card)] text-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-[var(--cyber-yellow)]">
                <FileSearch className="w-5 h-5" />
                <span>KERNEL DEEP TRACE // {activeTraceResult.eventId}</span>
              </div>
              <button 
                type="button"
                onClick={() => setTraceModalOpen(false)} 
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 bg-[var(--bg-base)] p-4 border border-[var(--border-subtle)] text-gray-200">
              <div>
                <span className="text-gray-400">SPAWN PROCESS: </span>
                <strong className="text-white font-mono">{activeTraceResult.traceDetails?.processName}</strong>
              </div>
              <div>
                <span className="text-gray-400">VERIFIED SYSTEM ORIGIN: </span>
                <strong className="text-white">{activeTraceResult.traceDetails?.verifiedSource}</strong>
              </div>
              <div>
                <span className="text-gray-400">KERNEL AUDIT JOURNAL: </span>
                <p className="mt-1 text-gray-300 leading-relaxed bg-[var(--bg-card)] p-3 border border-[var(--border-subtle)]">
                  {activeTraceResult.traceDetails?.notes}
                </p>
              </div>
            </div>

            {activeTraceResult.isClearedFalsePositive && (
              <div className="p-3 bg-[rgba(63,185,80,0.15)] border-2 border-[var(--success)] text-[var(--success)] flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>FALSE POSITIVE DISMISSED: Legitimate operational task confirmed. Do NOT accuse this event.</span>
              </div>
            )}

            {activeTraceResult.isRogueEvent && (
              <div className="p-3 bg-[rgba(255,0,85,0.15)] border-2 border-[var(--cyber-pink)] text-[var(--cyber-pink)] flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HIGH FORENSIC SUSPICION: Orphaned PID daemon and unmapped external egress endpoint.</span>
              </div>
            )}

            <button 
              type="button"
              onClick={() => setTraceModalOpen(false)} 
              className="btn btn-primary w-full uppercase"
            >
              CLOSE AUDIT RECORD
            </button>
          </div>
        </div>
      )}

      {/* ─── HYPOTHESIS SELECTOR MODAL ──────────────────────────── */}
      {hypothesisModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="rs-panel max-w-lg w-full p-6 bg-[var(--bg-card)] text-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-3">
              <div className="text-sm font-bold text-white uppercase">SELECT WORKING THEORY / HYPOTHESIS</div>
              <button 
                type="button"
                onClick={() => setHypothesisModalOpen(false)} 
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-300 leading-relaxed">
              Recording your hypothesis costs 0 Probes. It documents your deduction path in the forensic audit log.
            </p>

            <div className="flex flex-col gap-2">
              {[
                'Routine high-volume backup batch (EVT-08 spike)',
                'Authentication gateway retry wave (EVT-14 cascade)',
                'GPU shader / JIT compilation thread freeze (EVT-19 latency)',
                'Periodic Covert Beaconing Channel (EVT-11 / EVT-17 cadence)',
                'Distributed Denial of Service (External reflection)',
              ].map(hyp => (
                <button
                  key={hyp}
                  type="button"
                  onClick={() => executeProbe('SET_HYPOTHESIS', { hypothesis: hyp })}
                  className={`p-3 text-left border transition-colors ${
                    activeHypothesis === hyp
                      ? 'bg-[rgba(0,255,204,0.15)] border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold'
                      : 'bg-[var(--bg-base)] border-[var(--border-subtle)] text-gray-300 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {hyp}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── FINAL ACCUSATION MODAL ─────────────────────────────── */}
      {accuseModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="rs-panel rs-panel-alert max-w-xl w-full p-6 bg-[var(--bg-card)] text-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-[var(--cyber-pink)]">
                <AlertTriangle className="w-5 h-5" />
                <span>INDICTMENT: ROGUE TELEMETRY COVERT CHANNEL</span>
              </div>
              <button 
                type="button"
                onClick={() => setAccuseModalOpen(false)} 
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[rgba(255,0,85,0.1)] border border-[var(--cyber-pink)] text-gray-200 leading-relaxed">
              ⚠ <strong>JUDICIAL MANDATE:</strong> Correct accusations award <strong>+100 base + 30 clue + 10/probe + 20 clean sheet</strong>. False accusations incur a severe <strong>-40 point penalty</strong>.
            </div>

            {/* Field 1: Target Anomaly */}
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-300 font-bold uppercase text-[10px]">
                1. PRIMARY ANOMALOUS EVENT ID
              </label>
              <select
                value={accusedEventId}
                onChange={e => setAccusedEventId(e.target.value)}
                className="p-2.5 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] text-white focus:outline-none focus:border-[var(--accent-primary)]"
                aria-label="Target anomalous event"
              >
                <option value="">-- SELECT PRIMARY EVENT --</option>
                {events.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.id} • {e.timestamp} • {e.targetNode} ({e.payloadSizeMb} MB)
                  </option>
                ))}
              </select>
            </div>

            {/* Field 2: Mechanism */}
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-300 font-bold uppercase text-[10px]">
                2. ANOMALY MECHANISM
              </label>
              <select
                value={accusedMechanism}
                onChange={e => setAccusedMechanism(e.target.value)}
                className="p-2.5 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] text-white focus:outline-none focus:border-[var(--accent-primary)]"
                aria-label="Suspected anomaly mechanism"
              >
                <option value="PERIODIC_BEACON">PERIODIC BEACON (Clockwork automated egress cadence)</option>
                <option value="DATA_EXFILTRATION">BULK DATA EXFILTRATION (Volume spike)</option>
                <option value="CREDENTIAL_STUFFING">AUTHENTICATION CASCADE / CREDENTIAL ATTACK</option>
                <option value="DENIAL_OF_SERVICE">THREAD STALL / DENIAL OF SERVICE</option>
              </select>
            </div>

            {/* Field 3: Supporting Evidence */}
            <div className="flex flex-col gap-1.5">
              <label className="text-gray-300 font-bold uppercase text-[10px]">
                3. CORROBORATING EVIDENCE / CLUE (EARNS +30 BONUS)
              </label>
              <input
                type="text"
                value={accusedEvidence}
                onChange={e => setAccusedEvidence(e.target.value)}
                placeholder="e.g. EVT-17 paired beacon at delta 600s to ext-staging-relay"
                className="p-2.5 bg-[var(--bg-base)] border-2 border-[var(--border-subtle)] text-white focus:outline-none focus:border-[var(--accent-primary)]"
                aria-label="Corroborating clue or evidence"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[var(--border-subtle)]">
              <button 
                type="button"
                onClick={() => setAccuseModalOpen(false)} 
                className="btn btn-secondary uppercase"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleAccusation}
                disabled={isExecutingProbe}
                className="btn btn-primary bg-[var(--cyber-pink)] border-[var(--cyber-pink)] hover:bg-red-600 font-bold px-6 uppercase"
              >
                EXECUTE INDICTMENT ⚡
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LEARNING & DEBRIEF DIALOG ───────────────────────────── */}
      {showLearningDialog && accusationResult && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="rs-panel rs-panel-active max-w-xl w-full p-6 sm:p-8 bg-[var(--bg-card)] text-xs flex flex-col gap-6">
            <div className="flex items-center gap-3">
              {accusationResult.isCorrect ? (
                <Award className="w-8 h-8 text-[var(--success)]" />
              ) : (
                <XCircle className="w-8 h-8 text-[var(--cyber-pink)]" />
              )}
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                {accusationResult.isCorrect ? 'CASE RESOLVED: ANOMALY VERIFIED' : 'INVESTIGATION PENALTY RECORDED'}
              </h2>
            </div>

            <div className="p-4 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-gray-200 leading-relaxed text-sm">
              {accusationResult.explanation}
            </div>

            {/* Score breakdown */}
            <div className="flex flex-col gap-2 bg-[rgba(0,255,204,0.06)] p-4 border border-[var(--accent-primary)]">
              <div className="flex justify-between font-bold text-white">
                <span>POINTS AWARDED:</span>
                <span className={accusationResult.pointsAwarded >= 0 ? 'text-[var(--success)] text-base' : 'text-[var(--cyber-pink)] text-base'}>
                  {accusationResult.pointsAwarded >= 0 ? `+${accusationResult.pointsAwarded}` : accusationResult.pointsAwarded} PTS
                </span>
              </div>
              {accusationResult.isCorrect && (
                <div className="text-[10px] text-gray-300 flex flex-col gap-1 mt-1 border-t border-[var(--border-subtle)] pt-2">
                  <div>• Base Accusation: +100</div>
                  <div>• Corroborating Clue Verified: +30</div>
                  <div>• Token Conservation: +{tokensRemaining * 10} ({tokensRemaining} remaining)</div>
                  <div>• Clean Sheet First Attempt: +20</div>
                </div>
              )}
            </div>

            {/* Post-game pedagogical takeaway */}
            <div className="flex flex-col gap-2 p-4 bg-[var(--bg-base)] border border-[var(--border-subtle)] text-gray-300">
              <strong className="text-[var(--accent-primary)]">WHAT YOU JUST LEARNED:</strong>
              <p className="leading-relaxed">
                In real distributed telemetry, <strong>extreme individual values</strong> (like the 92 GB cold storage backup or 12s JIT warm-up) are frequently benign operational spikes.
                Conversely, stealth anomalies (like EVT-11 and EVT-17) disguise themselves with low, ordinary payloads. They only reveal themselves through <strong>multi-variable correlation</strong>: exact periodic cadence (600s), identical micro-payloads (0.24 MB), and unmapped external relays.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowLearningDialog(false)}
              className="btn btn-primary w-full uppercase"
            >
              CONTINUE TO DASHBOARD
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
