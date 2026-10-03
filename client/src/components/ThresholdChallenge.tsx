import React, { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Sparkles, 
  Gauge, 
  Lock,
  Cpu
} from 'lucide-react';

interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (data: any) => void;
}

export default function ThresholdChallenge({ challenge, sessionCode, onSubmitted }: Props) {
  const config = challenge?.config || {};
  const [threshold, setThreshold] = useState<number>(50);
  const [activePhase, setActivePhase] = useState<number>(1);
  const [probesRemaining, setProbesRemaining] = useState<number>(config.probeTokens ?? 3);
  const [phase1Completed, setPhase1Completed] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [serverResult, setServerResult] = useState<any>(null);
  const [scenarioState, setScenarioState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api.get(`/sessions/${sessionCode}/threshold-state`).then(res => {
      if (!mounted || !res.data) return;
      const d = res.data;
      setScenarioState(d);
      if (d.probesRemaining !== undefined) setProbesRemaining(d.probesRemaining);
      if (d.isCompleted || d.phase2Completed || d.activePhase === 'COMPLETED') {
        setIsCompleted(true);
        setActivePhase(2);
        if (d.phase2Threshold !== null && d.phase2Threshold !== undefined) {
          setThreshold(d.phase2Threshold);
        } else if (d.phase1Threshold !== null && d.phase1Threshold !== undefined) {
          setThreshold(d.phase1Threshold);
        }
      } else if (d.activePhase === 2 || (d.phase1Completed && !d.phase2Completed)) {
        setActivePhase(2);
        if (d.phase2Threshold !== null && d.phase2Threshold !== undefined) {
          setThreshold(d.phase2Threshold);
        }
      } else if (d.phase1Threshold !== null && d.phase1Threshold !== undefined) {
        setThreshold(d.phase1Threshold);
      }
      if (d.lastEvaluation) setServerResult(d.lastEvaluation);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [sessionCode]);

  const phaseConfig = useMemo(() => activePhase === 2
    ? (scenarioState?.phase2Shift || config.phase2Shift || {})
    : (scenarioState?.phase1Baseline || config.phase1Baseline || config.distributions || {}),
  [activePhase, scenarioState, config]);

  const costMatrix = scenarioState?.costMatrix || config.costMatrix || {};
  const fnCost = Number(costMatrix.falseNegativeCost || 10000);
  const fpCost = Number(costMatrix.falsePositiveCost || 500);
  const maxBudget = Number(phaseConfig.maxIncidentBudget || costMatrix.maxIncidentBudget || 25000);

  // SVG Geometry Dimensions
  const svgWidth = 680;
  const svgHeight = 230;
  const padX = 32;
  const padTop = 26;
  const padBottom = 34;

  const { bPath, cPath, previewMatrix, previewLoss, bDist, cDist, bPeak, cPeak } = useMemo(() => {
    const bDistribution = phaseConfig.benignDistribution || { mean: 32, stdDev: 10, count: 75 };
    const cDistribution = phaseConfig.criticalDistribution || { mean: 68, stdDev: 11, count: 25 };
    
    let bSum = 0; 
    let cSum = 0;
    const bRaw: number[] = new Array(101); 
    const cRaw: number[] = new Array(101);

    for (let x = 0; x <= 100; x++) {
      const zb = (x - (bDistribution.mean || 32)) / (bDistribution.stdDev || 10);
      const zc = (x - (cDistribution.mean || 68)) / (cDistribution.stdDev || 11);
      const pb = Math.exp(-0.5 * zb * zb); 
      const pc = Math.exp(-0.5 * zc * zc);
      bRaw[x] = pb; 
      cRaw[x] = pc; 
      bSum += pb; 
      cSum += pc;
    }

    let tp = 0; 
    let fp = 0; 
    let tn = 0; 
    let fn = 0; 
    let maxPeak = 0;
    let bPeakVal = 0;
    let cPeakVal = 0;
    const bCases: number[] = new Array(101); 
    const cCases: number[] = new Array(101);

    for (let x = 0; x <= 100; x++) {
      const bc = (bRaw[x] / (bSum || 1)) * (bDistribution.count || 75);
      const cc = (cRaw[x] / (cSum || 1)) * (cDistribution.count || 25);
      bCases[x] = bc; 
      cCases[x] = cc;
      if (bc > maxPeak) maxPeak = bc; 
      if (cc > maxPeak) maxPeak = cc;
      if (bc > bPeakVal) bPeakVal = bc;
      if (cc > cPeakVal) cPeakVal = cc;
      if (x >= threshold) { 
        fp += bc; 
        tp += cc; 
      } else { 
        tn += bc; 
        fn += cc; 
      }
    }

    const scaleX = (x: number) => padX + (x / 100) * (svgWidth - 2 * padX);
    const scaleY = (val: number) => (svgHeight - padBottom) - (val / (maxPeak || 1)) * (svgHeight - padBottom - padTop);

    const buildPath = (cases: number[]) => {
      let p = `M ${scaleX(0)} ${scaleY(cases[0])}`;
      for (let x = 1; x <= 100; x++) {
        p += ` L ${scaleX(x)} ${scaleY(cases[x])}`;
      }
      return p + ` L ${scaleX(100)} ${svgHeight - padBottom} L ${scaleX(0)} ${svgHeight - padBottom} Z`;
    };

    return {
      bPath: buildPath(bCases), 
      cPath: buildPath(cCases),
      bDist: bDistribution,
      cDist: cDistribution,
      bPeak: { x: scaleX(bDistribution.mean || 32), y: scaleY(bPeakVal) },
      cPeak: { x: scaleX(cDistribution.mean || 68), y: scaleY(cPeakVal) },
      previewMatrix: { tp: Math.round(tp), fp: Math.round(fp), tn: Math.round(tn), fn: Math.round(fn) },
      previewLoss: Math.round(fn) * fnCost + Math.round(fp) * fpCost,
    };
  }, [phaseConfig, threshold, fnCost, fpCost, svgWidth, svgHeight, padX, padTop, padBottom]);

  const handleAction = async (isProbe: boolean) => {
    setLoading(true); 
    setError(null);
    try {
      const res = await api.post('/sessions/active/submit', {
        challengeId: challenge.id,
        answer: { threshold, phase: activePhase, isProbe },
      });
      const data = res.data;
      if (isProbe) {
        setProbesRemaining(data.probesRemaining ?? (probesRemaining - 1));
        setServerResult({
          withinBudget: data.withinBudget, 
          totalLoss: data.totalLoss,
          tp: data.confusionMatrix?.tp, 
          fp: data.confusionMatrix?.fp,
          tn: data.confusionMatrix?.tn, 
          fn: data.confusionMatrix?.fn,
          failureTier: data.failureTier, 
          isProbe: true,
        });
      } else {
        const isPhase1 = activePhase === 1;
        const hasPhase2 = Boolean(config.phase2Shift || scenarioState?.phase2Shift);
        if (data.isCorrect || data.submission?.metadata?.phase1Completed) {
          if (isPhase1 && hasPhase2) {
            setPhase1Completed(true); 
            setActivePhase(2);
            setServerResult(data.submission?.metadata?.lastEvaluation);
          } else {
            setIsCompleted(true);
            setServerResult(data.submission?.metadata?.lastEvaluation);
            onSubmitted?.(data);
          }
        } else {
          setServerResult(data.submission?.metadata?.lastEvaluation);
          setError(data.submission?.metadata?.lastEvaluation?.failureTier?.whyFailed || 'Incident loss exceeded safety ceiling.');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit calibration');
    } finally {
      setLoading(false);
    }
  };

  const bladeX = padX + (threshold / 100) * (svgWidth - 2 * padX);
  const isLossOverBudget = previewLoss > maxBudget;
  const budgetUtilizationPercent = Math.min(200, Math.round((previewLoss / (maxBudget || 1)) * 100));

  // Compute 20-segment budget meter
  const totalSegments = 20;
  const activeSegments = Math.min(totalSegments, Math.ceil((previewLoss / (maxBudget || 1)) * totalSegments));

  return (
    <div className="flex-1 flex flex-col p-3 md:p-6 max-w-5xl mx-auto w-full gap-4 font-mono text-xs text-[var(--text-primary)] select-none">
      
      {/* ── TOP OPERATIONAL STATUS BAR (Neo-Brutalist HUD) ──────── */}
      <header className="bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] p-3 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black/80 border border-[var(--accent-primary)]/40 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-[var(--accent-primary)] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider uppercase text-[var(--text-primary)]">
                {config.scenarioTitle || challenge?.prompt || 'THE THRESHOLD // CLASSIFICATION MATRIX'}
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 bg-[var(--accent-glow)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/40 text-[9px] uppercase tracking-widest">
                AI_OPS
              </span>
            </div>
            <p className="text-[var(--text-secondary)] text-[11px] line-clamp-1">
              {config.missionBrief || 'Calibrate precision decision boundary under asymmetric operational penalties.'}
            </p>
          </div>
        </div>

        {/* HUD Telemetry Stats */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[var(--border-subtle)] pt-2 md:pt-0">
          
          {/* Phase Tracker */}
          <div className="flex flex-col items-center sm:items-end">
            <span className="text-[9px] text-[var(--text-muted)] tracking-widest uppercase">PROTOCOL PHASE</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider border ${
                activePhase === 1 
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(0,255,204,0.3)]' 
                  : 'bg-black/60 text-slate-500 border-slate-700'
              }`}>
                01_BASELINE {phase1Completed && '✓'}
              </span>
              <span className="text-slate-600 text-[10px]">➔</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider border ${
                activePhase === 2 && !isCompleted
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500 shadow-[0_0_8px_rgba(255,0,85,0.3)] animate-pulse' 
                  : isCompleted
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                  : 'bg-black/60 text-slate-500 border-slate-700'
              }`}>
                02_DRIFT {isCompleted && '✓'}
              </span>
            </div>
          </div>

          {/* Canary Probes Available */}
          <div className="flex flex-col items-center sm:items-end border-l-2 border-[var(--border-subtle)] pl-3">
            <span className="text-[9px] text-[var(--text-muted)] tracking-widest uppercase">CANARY PROBES</span>
            <div className="flex items-center gap-1 mt-1">
              {[...Array(3)].map((_, i) => (
                <span 
                  key={i} 
                  className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] font-black transition-all ${
                    i < probesRemaining 
                      ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_8px_rgba(252,238,10,0.5)]' 
                      : 'bg-black/80 text-slate-700 border-slate-800'
                  }`}
                  title={i < probesRemaining ? 'Available Probe' : 'Depleted Probe'}
                >
                  {i < probesRemaining ? '●' : '×'}
                </span>
              ))}
            </div>
          </div>

          {/* Current Calibrated Threshold Badge */}
          <div className="flex flex-col items-end border-l-2 border-[var(--border-subtle)] pl-3">
            <span className="text-[9px] text-[var(--text-muted)] tracking-widest uppercase">BOUNDARY</span>
            <div className="font-mono text-base font-black text-[#fcee0a] tracking-wider leading-none mt-0.5">
              T = {threshold}
            </div>
          </div>
        </div>
      </header>

      {/* ── PHASE 2 DEMOGRAPHIC DRIFT EMERGENCY ALERT ───────────── */}
      {activePhase === 2 && (
        <div className="bg-red-950/60 border-2 border-red-600/80 p-3 rounded-none shadow-[0_0_15px_rgba(255,0,85,0.25)] flex items-start sm:items-center gap-3 text-red-200">
          <div className="w-6 h-6 rounded-none bg-red-600 text-black font-black flex items-center justify-center shrink-0 text-xs">
            ▲
          </div>
          <div className="text-[11px] flex-1">
            <div className="font-black tracking-wider uppercase text-red-400 flex items-center gap-2">
              <span>ALERT // DEMOGRAPHIC DRIFT ACTIVE</span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
            </div>
            <p className="mt-0.5 text-red-200/90 font-mono">
              {phaseConfig.shiftNarrative || 'Adversarial camouflage detected. Critical vector mean compressed leftward to 58.0. Recalibrate boundary to prevent budget breach.'}
            </p>
          </div>
        </div>
      )}

      {/* ── HERO DISTRIBUTION GRAPH (Instrumentation Canvas) ────── */}
      <section className="bg-[#080a0f] border-2 border-[var(--border-subtle)] p-3 md:p-4 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] flex flex-col relative overflow-hidden">
        
        {/* Graph Header HUD */}
        <div className="w-full flex flex-wrap justify-between items-center mb-2 text-[11px] border-b border-[var(--border-subtle)]/60 pb-2 gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-cyan-500/20 border-2 border-cyan-400 inline-block" />
              <span className="text-cyan-400 font-bold uppercase tracking-wider">
                Benign Traffic ({bDist.count} Cases)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-rose-500/30 border-2 border-rose-500 inline-block" />
              <span className="text-rose-400 font-bold uppercase tracking-wider">
                Critical Threats ({cDist.count} Cases)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase hidden sm:inline">
              DECISION PARTITION:
            </span>
            <span className="px-2 py-0.5 bg-[#fcee0a]/10 border border-[#fcee0a]/50 text-[#fcee0a] font-bold text-[11px] tracking-widest uppercase">
              T = {threshold}.00
            </span>
          </div>
        </div>

        {/* SVG Hero Canvas */}
        <div className="relative w-full overflow-hidden bg-black/60 border border-white/5">
          
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-52 sm:h-64 select-none">
            <defs>
              {/* Glow Filters */}
              <filter id="th-glow-beam" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="th-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="th-glow-red" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Curve Area Gradients */}
              <linearGradient id="th-grad-benign" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.35" />
                <stop offset="70%" stopColor="#00e5ff" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="th-grad-critical" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff0055" stopOpacity="0.38" />
                <stop offset="70%" stopColor="#ff0055" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ff0055" stopOpacity="0.0" />
              </linearGradient>

              {/* Dot Art Background Pattern */}
              <pattern id="th-dot-matrix" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="8" cy="8" r="0.8" fill="rgba(255,255,255,0.06)" />
              </pattern>
            </defs>

            {/* Background Dot Matrix */}
            <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="url(#th-dot-matrix)" />

            {/* Horizontal Amplitude Gridlines */}
            {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
              const yPos = (svgHeight - padBottom) - frac * (svgHeight - padBottom - padTop);
              return (
                <g key={idx}>
                  <line 
                    x1={padX} 
                    y1={yPos} 
                    x2={svgWidth - padX} 
                    y2={yPos} 
                    stroke="rgba(255,255,255,0.05)" 
                    strokeWidth="1" 
                    strokeDasharray="4 4" 
                  />
                  <text 
                    x={padX - 4} 
                    y={yPos + 3} 
                    fill="rgba(255,255,255,0.2)" 
                    fontSize="8" 
                    textAnchor="end" 
                    fontFamily="var(--font-mono)"
                  >
                    {Math.round(frac * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Vertical Coordinate Gridlines */}
            {[0, 25, 50, 75, 100].map((tickVal) => {
              const xPos = padX + (tickVal / 100) * (svgWidth - 2 * padX);
              return (
                <line 
                  key={tickVal} 
                  x1={xPos} 
                  y1={padTop} 
                  x2={xPos} 
                  y2={svgHeight - padBottom} 
                  stroke="rgba(255,255,255,0.04)" 
                  strokeWidth="1" 
                />
              );
            })}

            {/* Classification Zone Shading */}
            {/* Predicted Benign Zone (x < threshold) */}
            <rect 
              x={padX} 
              y={padTop} 
              width={Math.max(0, bladeX - padX)} 
              height={svgHeight - padBottom - padTop} 
              fill="rgba(0, 229, 255, 0.03)" 
            />
            {/* Predicted Critical Zone (x >= threshold) */}
            <rect 
              x={bladeX} 
              y={padTop} 
              width={Math.max(0, svgWidth - padX - bladeX)} 
              height={svgHeight - padBottom - padTop} 
              fill="rgba(255, 0, 85, 0.03)" 
            />

            {/* Zone Labels Inside SVG Canvas */}
            <text 
              x={padX + 8} 
              y={padTop + 14} 
              fill="rgba(0, 229, 255, 0.45)" 
              fontSize="9" 
              fontWeight="bold" 
              letterSpacing="0.08em" 
              fontFamily="var(--font-mono)"
            >
              ◄ PREDICTED BENIGN (SPECIFICITY)
            </text>
            <text 
              x={svgWidth - padX - 8} 
              y={padTop + 14} 
              fill="rgba(255, 0, 85, 0.45)" 
              fontSize="9" 
              fontWeight="bold" 
              letterSpacing="0.08em" 
              textAnchor="end" 
              fontFamily="var(--font-mono)"
            >
              PREDICTED CRITICAL (SENSITIVITY) ►
            </text>

            {/* Distribution Curve 1: Benign (Cyan) */}
            <path 
              d={bPath} 
              fill="url(#th-grad-benign)" 
              stroke="#00e5ff" 
              strokeWidth="2.5" 
              filter="url(#th-glow-cyan)" 
            />

            {/* Distribution Curve 2: Critical (Cyber-Pink) */}
            <path 
              d={cPath} 
              fill="url(#th-grad-critical)" 
              stroke="#ff0055" 
              strokeWidth="2.5" 
              filter="url(#th-glow-red)" 
            />

            {/* Baseline Axis */}
            <line 
              x1={padX} 
              y1={svgHeight - padBottom} 
              x2={svgWidth - padX} 
              y2={svgHeight - padBottom} 
              stroke="rgba(255, 255, 255, 0.3)" 
              strokeWidth="1.5" 
            />

            {/* Axis Tick Marks & Numbers */}
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
              const xPos = padX + (tick / 100) * (svgWidth - 2 * padX);
              const isMajor = tick % 25 === 0;
              return (
                <g key={tick}>
                  <line 
                    x1={xPos} 
                    y1={svgHeight - padBottom} 
                    x2={xPos} 
                    y2={svgHeight - padBottom + (isMajor ? 6 : 3)} 
                    stroke={isMajor ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.2)"} 
                    strokeWidth={isMajor ? "1.5" : "1"} 
                  />
                  {isMajor && (
                    <text 
                      x={xPos} 
                      y={svgHeight - padBottom + 18} 
                      fill="rgba(255, 255, 255, 0.45)" 
                      fontSize="9" 
                      fontWeight="bold" 
                      textAnchor="middle" 
                      fontFamily="var(--font-mono)"
                    >
                      {tick}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── THRESHOLD BEAM (The Hero Calibration Blade) ── */}
            {/* Ambient Beam Glow */}
            <line 
              x1={bladeX} 
              y1={padTop} 
              x2={bladeX} 
              y2={svgHeight - padBottom} 
              stroke="#fcee0a" 
              strokeWidth="6" 
              opacity="0.25" 
              filter="url(#th-glow-beam)" 
            />
            {/* Laser Blade Core */}
            <line 
              x1={bladeX} 
              y1={padTop} 
              x2={bladeX} 
              y2={svgHeight - padBottom} 
              stroke="#fcee0a" 
              strokeWidth="2.5" 
              strokeDasharray="4 2" 
            />

            {/* Top Calibration Reticle Badge */}
            <rect 
              x={bladeX - 26} 
              y={padTop - 16} 
              width="52" 
              height="18" 
              fill="#080a0f" 
              stroke="#fcee0a" 
              strokeWidth="1.5" 
              className="shadow-[0_0_10px_rgba(252,238,10,0.5)]"
            />
            <text 
              x={bladeX} 
              y={padTop - 4} 
              fill="#fcee0a" 
              fontSize="10" 
              fontWeight="900" 
              textAnchor="middle" 
              fontFamily="var(--font-mono)" 
              letterSpacing="0.05em"
            >
              T={threshold}
            </text>
            <circle cx={bladeX} cy={padTop} r="3" fill="#fcee0a" />
            <circle cx={bladeX} cy={svgHeight - padBottom} r="3" fill="#fcee0a" />

            {/* Corner Registration Reticles (Pixel Art Accent) */}
            <path d="M 8 16 L 8 8 L 16 8" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
            <path d={`M ${svgWidth - 8} 16 L ${svgWidth - 8} 8 L ${svgWidth - 16} 8`} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
            <path d={`M 8 ${svgHeight - 16} L 8 ${svgHeight - 8} L 16 ${svgHeight - 8}`} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
            <path d={`M ${svgWidth - 8} ${svgHeight - 16} L ${svgWidth - 8} ${svgHeight - 8} L ${svgWidth - 16} ${svgHeight - 8}`} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
          </svg>
        </div>

        {/* ── PRECISION POTENTIOMETER (Slider Control) ─────────────── */}
        <div className="w-full px-2 sm:px-4 mt-3">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-bold tracking-widest uppercase mb-1">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span>◄</span> MAX SENSITIVITY
            </span>
            <span className="text-[#fcee0a] bg-black/60 px-2 py-0.5 border border-[#fcee0a]/30">
              CALIBRATION POTENTIOMETER
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              MAX SPECIFICITY <span>►</span>
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            disabled={isCompleted}
            aria-label="Classification decision threshold"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="threshold-slider"
          />

          {/* Mechanical Scale Markings */}
          <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-1 px-1">
            <span>[00] FLAG ALL</span>
            <span className="hidden sm:inline">[25]</span>
            <span>[50] MID</span>
            <span className="hidden sm:inline">[75]</span>
            <span>[100] CLEAR ALL</span>
          </div>

          <div className="text-center text-[9px] text-[var(--text-muted)] mt-1 font-mono tracking-wider">
            {isCompleted ? (
              <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" /> CALIBRATION LOCKED — PROTOCOL COMPLETE
              </span>
            ) : (
              <span>TUNE VIA SLIDER OR ARROW KEYS (← / →) FOR PRECISION BOUNDARY ADJUSTMENT</span>
            )}
          </div>
        </div>
      </section>

      {/* ── OPERATIONAL TELEMETRY & INCIDENT CONTROLS ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT: CONFUSION MATRIX TELEMETRY (4 Quadrants) - 7 cols */}
        <div className="lg:col-span-7 bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] p-3.5 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] flex flex-col justify-between">
          <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-2 flex items-center justify-between border-b border-[var(--border-subtle)]/60 pb-1.5">
            <span className="flex items-center gap-2 text-cyan-400 font-mono">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              CONFUSION MATRIX TELEMETRY
            </span>
            <span className="text-[9px] text-[var(--text-muted)]">N = 100 POPULATION</span>
          </div>

          {/* 4 Quadrants Grid */}
          <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
            
            {/* TRUE POSITIVES (TP) */}
            <div className="bg-[#0b1017] border-2 border-cyan-500/40 p-2.5 rounded-none flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black tracking-wider text-cyan-400">TP</span>
                <span className="text-[8px] px-1 bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 font-mono">
                  CORRECT
                </span>
              </div>
              <span className="text-cyan-400 font-mono font-black text-2xl my-1 block">
                {previewMatrix.tp}
              </span>
              <div className="text-left border-t border-cyan-950 pt-1">
                <span className="text-[10px] font-bold text-slate-200 block">Flagged Critical</span>
                <span className="text-[9px] text-cyan-400/80 block">Secured Intrusions</span>
              </div>
            </div>

            {/* FALSE POSITIVES (FP) */}
            <div className="bg-[#121008] border-2 border-amber-500/40 p-2.5 rounded-none flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black tracking-wider text-amber-400">FP</span>
                <span className="text-[8px] px-1 bg-amber-950/80 text-amber-300 border border-amber-800/40 font-mono">
                  COST ${fpCost}
                </span>
              </div>
              <span className="text-amber-400 font-mono font-black text-2xl my-1 block">
                {previewMatrix.fp}
              </span>
              <div className="text-left border-t border-amber-950 pt-1">
                <span className="text-[10px] font-bold text-slate-200 block">False Alarm</span>
                <span className="text-[9px] text-amber-400/80 block">${fpCost} per incident</span>
              </div>
            </div>

            {/* TRUE NEGATIVES (TN) */}
            <div className="bg-[#090d14] border-2 border-blue-500/40 p-2.5 rounded-none flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black tracking-wider text-blue-400">TN</span>
                <span className="text-[8px] px-1 bg-blue-950/80 text-blue-300 border border-blue-800/40 font-mono">
                  CORRECT
                </span>
              </div>
              <span className="text-blue-400 font-mono font-black text-2xl my-1 block">
                {previewMatrix.tn}
              </span>
              <div className="text-left border-t border-blue-950 pt-1">
                <span className="text-[10px] font-bold text-slate-200 block">Cleared Benign</span>
                <span className="text-[9px] text-blue-400/80 block">Unobstructed Flow</span>
              </div>
            </div>

            {/* FALSE NEGATIVES (FN) - ASYMMETRIC CATASTROPHE */}
            <div className={`bg-[#14080b] border-2 ${
              previewMatrix.fn > 0 
                ? 'border-rose-500 shadow-[0_0_12px_rgba(255,0,85,0.25)]' 
                : 'border-rose-500/40'
            } p-2.5 rounded-none flex flex-col justify-between`}>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black tracking-wider text-rose-400">FN</span>
                <span className="text-[8px] px-1 bg-rose-950 text-rose-200 border border-rose-600 font-mono font-bold animate-pulse">
                  CRITICAL ${fnCost}
                </span>
              </div>
              <span className="text-rose-400 font-mono font-black text-2xl my-1 block">
                {previewMatrix.fn}
              </span>
              <div className="text-left border-t border-rose-950 pt-1">
                <span className="text-[10px] font-bold text-rose-200 block">Missed Critical</span>
                <span className="text-[9px] text-rose-400 font-bold block">${fnCost} per disaster</span>
              </div>
            </div>

          </div>

          {/* Asymmetric Loss Formula Legend */}
          <div className="mt-3 pt-2 border-t border-[var(--border-subtle)]/60 text-[9px] text-[var(--text-muted)] flex justify-between items-center font-mono">
            <span>COST FORMULA: (FN × ${fnCost}) + (FP × ${fpCost})</span>
            <span className="text-rose-400 font-bold">20:1 PENALTY ASYMMETRY</span>
          </div>
        </div>

        {/* RIGHT: INCIDENT LOSS & ACTION DISPATCH - 5 cols */}
        <div className="lg:col-span-5 bg-[var(--bg-surface)] border-2 border-[var(--border-subtle)] p-3.5 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.6)] flex flex-col justify-between gap-3">
          
          {/* Real-Time Incident Loss Monitor */}
          <div>
            <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase mb-2 flex items-center justify-between border-b border-[var(--border-subtle)]/60 pb-1.5">
              <span className="flex items-center gap-1.5 text-amber-400 font-mono">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                INCIDENT LOSS TELEMETRY
              </span>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 border ${
                isLossOverBudget 
                  ? 'bg-rose-950 text-rose-400 border-rose-600 animate-pulse' 
                  : 'bg-emerald-950 text-emerald-400 border-emerald-600'
              }`}>
                {isLossOverBudget ? 'BREACH' : 'SAFE'}
              </span>
            </div>

            {/* Big Loss Readout */}
            <div className="bg-black/60 border border-[var(--border-subtle)] p-2.5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Estimated Loss:</span>
                <span className={`font-mono text-xl font-black ${
                  isLossOverBudget ? 'text-rose-500 animate-pulse' : 'text-emerald-400'
                }`}>
                  ${previewLoss.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-[10px] text-[var(--text-secondary)] border-t border-white/5 pt-1">
                <span>Budget Ceiling:</span>
                <span className="font-mono font-bold text-slate-300">${maxBudget.toLocaleString()}</span>
              </div>

              {/* Segmented Loss Progress Bar */}
              <div className="mt-2 font-mono text-[10px] tracking-tight">
                <div className="flex items-center gap-0.5">
                  {[...Array(totalSegments)].map((_, idx) => {
                    const isFilled = idx < activeSegments;
                    return (
                      <span
                        key={idx}
                        className={`h-2.5 flex-1 transition-all ${
                          isFilled
                            ? isLossOverBudget
                              ? 'bg-rose-500 shadow-[0_0_4px_rgba(255,0,85,0.8)]'
                              : 'bg-emerald-400 shadow-[0_0_4px_rgba(0,255,204,0.5)]'
                            : 'bg-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-[var(--text-muted)] mt-1">
                  <span>$0</span>
                  <span>{budgetUtilizationPercent}% BUDGET UTILIZED</span>
                  <span>${maxBudget / 1000}K</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {/* Canary Probe Button */}
            <button
              onClick={() => handleAction(true)}
              disabled={loading || probesRemaining <= 0 || isCompleted}
              className="w-full py-2.5 bg-black hover:bg-slate-900 text-amber-300 border-2 border-amber-500/60 rounded-none font-bold font-mono text-xs transition flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(252,238,10,0.3)] active:translate-x-0.5 active:translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>DISPATCH CANARY PROBE ({probesRemaining}/3 REMAINING)</span>
            </button>

            {/* Commit / Final Lock Calibration Button */}
            <button
              onClick={() => handleAction(false)}
              disabled={loading || isCompleted}
              className={`w-full py-3 font-mono font-black text-xs uppercase tracking-wider rounded-none transition flex items-center justify-center gap-2 border-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                isCompleted 
                  ? 'bg-slate-800 text-slate-400 border-slate-700' 
                  : 'bg-[#fcee0a] hover:bg-[#fff033] text-black border-black shadow-[0_0_15px_rgba(252,238,10,0.4)]'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>
                {loading 
                  ? 'PROCESSING CALIBRATION PROTOCOL...' 
                  : (activePhase === 1 ? 'COMMIT PHASE 1 CALIBRATION' : 'LOCK FINAL SHIFT BOUNDARY')}
              </span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-950/80 border-2 border-rose-600 text-rose-200 p-2.5 rounded-none text-[11px] font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Completed State Banner */}
          {isCompleted && (
            <div className="bg-emerald-950/80 border-2 border-emerald-500 text-emerald-200 p-3 rounded-none text-[11px] font-mono space-y-1 shadow-[0_0_15px_rgba(0,255,204,0.2)]">
              <div className="flex items-center gap-2 font-black text-emerald-400 tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>CALIBRATION PROTOCOL COMPLETE // POPULATIONS SECURED</span>
              </div>
              <p className="text-emerald-300/80 text-[10px]">
                Final Boundary T={threshold}. Both baseline and distribution drift calibrated within incident budget ceilings.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── CANARY PROBE VERIFIED TELEMETRY (Passing Probe) ──────── */}
      {serverResult?.isProbe && serverResult.withinBudget && (
        <div className="bg-[#081512] border-2 border-emerald-500/60 p-3.5 rounded-none text-[11px] space-y-1 text-emerald-300 font-mono shadow-[0_0_15px_rgba(0,255,204,0.15)]">
          <div className="font-black uppercase text-[10px] tracking-widest flex items-center gap-2 text-emerald-400 border-b border-emerald-900/80 pb-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>CANARY PROBE TELEMETRY // VERIFIED WITHIN SAFETY CEILING</span>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <div>
              <span className="text-[var(--text-muted)]">Estimated Loss: </span>
              <strong className="text-emerald-300 font-mono">${serverResult.totalLoss?.toLocaleString()}</strong>
              <span className="text-[var(--text-muted)]"> (Max Budget: ${maxBudget.toLocaleString()})</span>
            </div>
            <div className="text-emerald-300/80">
              Confusion Matrix: <strong>TP: {serverResult.tp}</strong> | <strong>FP: {serverResult.fp}</strong> | <strong>TN: {serverResult.tn}</strong> | <strong>FN: {serverResult.fn}</strong>
            </div>
          </div>
          <div className="text-[10px] text-emerald-400/90 pt-0.5">
            ✓ Live verification confirmed safe boundary. Decision partition ready for commitment.
          </div>
        </div>
      )}

      {/* ── 4-TIER DIAGNOSTIC TELEMETRY (Failure / Incident Debrief) ─ */}
      {serverResult?.failureTier && (
        <div className="bg-[#12080a] border-2 border-rose-500/60 p-3.5 rounded-none text-[11px] space-y-1.5 text-slate-200 font-mono shadow-[0_0_15px_rgba(255,0,85,0.15)]">
          <div className="font-black text-rose-400 uppercase text-[10px] tracking-widest flex items-center gap-2 border-b border-rose-950 pb-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>4-TIER DIAGNOSTIC TELEMETRY // INCIDENT DEBRIEF</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] font-bold">OBSERVATION: </span> 
            <span>{serverResult.failureTier.whatHappened}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] font-bold">ROOT CAUSE: </span> 
            <span className="text-rose-300 font-bold">{serverResult.failureTier.whyFailed}</span>
          </div>
          <div className="text-emerald-400 font-bold pt-0.5">
            <span className="text-[var(--text-muted)]">TACTICAL CORRECTION: </span> 
            <span>{serverResult.failureTier.adaptationHint}</span>
          </div>
        </div>
      )}

    </div>
  );
}
