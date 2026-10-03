import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';
import { 
  Zap, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  HelpCircle, 
  Radio, 
  Trash2, 
  Layers, 
  Sparkles,
  Info,
  CornerDownRight,
  Wifi,
  Terminal,
  Crosshair
} from 'lucide-react';

/* ─── INTERFACES ─────────────────────────────────────────── */
export interface NetworkNode {
  id: string;
  label: string;
  type: 'INGRESS' | 'EGRESS' | 'CORE_ROUTER' | 'GATEWAY' | 'RELAY' | 'CHOKEPOINT' | 'UNSTABLE';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  description?: string;
}

export interface NetworkLink {
  id: string;
  from: string;
  to: string;
  capacityGbps: number;
  backgroundLoadGbps: number;
  latencyMs: number;
  lossRate?: number;
  isDirected?: boolean;
  description?: string;
}

export interface StreamSpec {
  payloadVolumeGbps: number;
  streamType?: string;
  slaMaxLatencyMs: number;
  slaMaxLossPercent: number;
}

export interface RouterChallengeConfig {
  scenarioId?: string;
  scenarioTitle?: string;
  missionBrief?: string;
  stream: StreamSpec;
  graph: {
    sourceNodeId: string;
    targetNodeId: string;
    nodes: NetworkNode[];
    links: NetworkLink[];
  };
  probeTokens?: number;
  scoring?: {
    basePoints?: number;
    zeroLossBonus?: number;
    firstRunCleanSheetBonus?: number;
    latencyHeadroomMaxBonus?: number;
    unusedProbeBonus?: number;
    overloadPenalty?: number;
  };
  revealConcept?: {
    title: string;
    summary: string;
  };
}

export interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (result: any) => void;
}

export const RouterChallenge: React.FC<Props> = ({ challenge, sessionCode, onSubmitted }) => {
  const config = (challenge?.config || {}) as RouterChallengeConfig;
  const graph = config.graph || { sourceNodeId: 'NODE_TX', targetNodeId: 'NODE_RX', nodes: [], links: [] };
  const stream = config.stream || { payloadVolumeGbps: 4.5, slaMaxLatencyMs: 80, slaMaxLossPercent: 0 };
  const nodes = useMemo(() => Array.isArray(graph.nodes) ? graph.nodes : [], [graph.nodes]);
  const links = useMemo(() => Array.isArray(graph.links) ? graph.links : [], [graph.links]);

  const sourceId = graph.sourceNodeId || 'NODE_TX';
  const targetId = graph.targetNodeId || 'NODE_RX';

  // Routing State
  const [selectedRoute, setSelectedRoute] = useState<string[]>([sourceId]);
  const [hoveredLink, setHoveredLink] = useState<NetworkLink | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

  // Probe & Transmit State
  const [probesRemaining, setProbesRemaining] = useState<number>(Number(config.probeTokens || 3));
  const [probesUsed, setProbesUsed] = useState<number>(0);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [lastSimulation, setLastSimulation] = useState<any>(null);
  const [probeTelemetry, setProbeTelemetry] = useState<any>(null);

  // Modals & Popups
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(true);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [failureReport, setFailureReport] = useState<any>(null);
  const [isDelivered, setIsDelivered] = useState<boolean>(false);
  const [scoreEarned, setScoreEarned] = useState<number>(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<any>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  // Animation pulse triggers
  const [animatingPulse, setAnimatingPulse] = useState<boolean>(false);

  // Fetch initial/reconnection state from server
  const fetchRouterState = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/${sessionCode}/router-state?challengeId=${challenge.id}`);
      if (res.data) {
        if (res.data.probesRemaining !== undefined) {
          setProbesRemaining(res.data.probesRemaining);
        }
        if (res.data.probesUsed !== undefined) {
          setProbesUsed(res.data.probesUsed);
        }
        if (Array.isArray(res.data.lastRoute) && res.data.lastRoute.length > 0) {
          setSelectedRoute(res.data.lastRoute);
        }
        if (res.data.lastSimulation) {
          setLastSimulation(res.data.lastSimulation);
        }
        if (res.data.isCompleted) {
          setIsDelivered(true);
          setScoreEarned(res.data.score || 0);
          setScoreBreakdown(res.data.lastSimulation?.scoreBreakdown || null);
          setShowBriefingModal(false);
        }
      }
    } catch {
      // Offline fallback
    }
  }, [sessionCode, challenge.id]);

  useEffect(() => {
    fetchRouterState();
  }, [fetchRouterState]);

  // Available next hops from current last node in route
  const currentHeadNodeId = selectedRoute[selectedRoute.length - 1] || sourceId;
  const isRouteComplete = currentHeadNodeId === targetId;

  // Neighbors of current head
  const availableNextHops = useMemo(() => {
    if (isRouteComplete) return [];
    const neighbors: string[] = [];
    links.forEach(l => {
      if (l.from === currentHeadNodeId && !selectedRoute.includes(l.to)) {
        neighbors.push(l.to);
      } else if (!l.isDirected && l.to === currentHeadNodeId && !selectedRoute.includes(l.from)) {
        neighbors.push(l.from);
      }
    });
    return neighbors;
  }, [currentHeadNodeId, links, selectedRoute, isRouteComplete]);

  // Helper: check if a link is in current selected route
  const isLinkInRoute = useCallback((u: string, v: string) => {
    for (let i = 0; i < selectedRoute.length - 1; i++) {
      if ((selectedRoute[i] === u && selectedRoute[i + 1] === v) || 
          (selectedRoute[i] === v && selectedRoute[i + 1] === u)) {
        return true;
      }
    }
    return false;
  }, [selectedRoute]);

  // Click handler for nodes
  const handleNodeClick = (nodeId: string) => {
    if (isDelivered || isTransmitting || isProbing) return;

    // If clicking head node, do nothing
    if (nodeId === currentHeadNodeId) return;

    // If clicking a previous node in route, truncate/splice to that node
    const existingIndex = selectedRoute.indexOf(nodeId);
    if (existingIndex !== -1) {
      setSelectedRoute(selectedRoute.slice(0, existingIndex + 1));
      setProbeTelemetry(null);
      setFailureReport(null);
      return;
    }

    // If clicking an available neighbor, extend path
    if (availableNextHops.includes(nodeId)) {
      setSelectedRoute([...selectedRoute, nodeId]);
      setProbeTelemetry(null);
      setFailureReport(null);
    }
  };

  // Click handler for links/cables
  const handleLinkClick = (link: NetworkLink) => {
    if (isDelivered || isTransmitting || isProbing) return;
    if (link.from === currentHeadNodeId && availableNextHops.includes(link.to)) {
      handleNodeClick(link.to);
    } else if (!link.isDirected && link.to === currentHeadNodeId && availableNextHops.includes(link.from)) {
      handleNodeClick(link.from);
    } else if (isLinkInRoute(link.from, link.to)) {
      const idxFrom = selectedRoute.indexOf(link.from);
      const idxTo = selectedRoute.indexOf(link.to);
      const targetIdx = Math.max(idxFrom, idxTo);
      if (targetIdx !== -1 && targetIdx < selectedRoute.length - 1) {
        setSelectedRoute(selectedRoute.slice(0, targetIdx + 1));
        setProbeTelemetry(null);
        setFailureReport(null);
      }
    }
  };

  // Remove last hop
  const handleRemoveLastHop = () => {
    if (selectedRoute.length > 1) {
      setSelectedRoute(selectedRoute.slice(0, selectedRoute.length - 1));
      setProbeTelemetry(null);
      setFailureReport(null);
    }
  };

  // Reset route
  const handleResetRoute = () => {
    setSelectedRoute([sourceId]);
    setProbeTelemetry(null);
    setFailureReport(null);
  };

  // Pre-flight calculation for current selected route
  const routePreflight = useMemo(() => {
    if (selectedRoute.length < 2) {
      return { totalLatency: 0, bottleneckLink: null, bottleneckHeadroom: 0, hasOverload: false, overloadAmount: 0 };
    }

    let totalLatency = 0;
    let minHeadroom = Infinity;
    let bottleneckLink: NetworkLink | null = null;
    let hasOverload = false;
    let maxOverload = 0;

    for (let i = 0; i < selectedRoute.length - 1; i++) {
      const u = selectedRoute[i];
      const v = selectedRoute[i + 1];
      const link = links.find(l => (l.from === u && l.to === v) || (!l.isDirected && l.from === v && l.to === u));
      if (link) {
        const capacity = Number(link.capacityGbps || 10);
        const load = Number(link.backgroundLoadGbps || 0);
        const headroom = Math.max(0, capacity - load);
        const latency = Number(link.latencyMs || 10);

        totalLatency += latency;
        if (headroom < minHeadroom) {
          minHeadroom = headroom;
          bottleneckLink = link;
        }

        if (load + stream.payloadVolumeGbps > capacity) {
          hasOverload = true;
          const overload = (load + stream.payloadVolumeGbps) - capacity;
          if (overload > maxOverload) maxOverload = overload;
        }
      }
    }

    return {
      totalLatency,
      bottleneckLink,
      bottleneckHeadroom: minHeadroom === Infinity ? 0 : Number(minHeadroom.toFixed(1)),
      hasOverload,
      overloadAmount: Number(maxOverload.toFixed(1))
    };
  }, [selectedRoute, links, stream.payloadVolumeGbps]);

  // Send Diagnostic Probe Pulse
  const handleSendProbe = async () => {
    if (probesRemaining <= 0 || isProbing || isTransmitting || selectedRoute.length < 2) return;

    setIsProbing(true);
    setAnimatingPulse(true);
    setProbeError(null);

    try {
      const res = await api.post(`/sessions/${sessionCode}/router-probe`, {
        challengeId: challenge.id,
        route: selectedRoute
      });

      if (res.data && res.data.success) {
        setProbesRemaining(res.data.probesRemaining);
        setProbesUsed(res.data.probesUsed);
        setProbeTelemetry(res.data.probeTelemetry);
      }
    } catch (err: any) {
      setProbeError(err.response?.data?.error || 'Diagnostic probe dispatch failed.');
    } finally {
      setTimeout(() => {
        setIsProbing(false);
        setAnimatingPulse(false);
      }, 1200);
    }
  };

  // Engage Primary Stream Transmission
  const handleTransmit = async () => {
    if (!isRouteComplete || isTransmitting || isDelivered) return;

    setIsTransmitting(true);
    setAnimatingPulse(true);
    setFailureReport(null);

    try {
      const res = await api.post(`/sessions/${sessionCode}/router-transmit`, {
        challengeId: challenge.id,
        route: selectedRoute
      });

      setLastSimulation(res.data.simulation);

      if (res.data.isDelivered) {
        setIsDelivered(true);
        setShowSuccessModal(true);
        setScoreEarned(res.data.score);
        setScoreBreakdown(res.data.scoreBreakdown);
        if (onSubmitted) {
          onSubmitted({ isCorrect: true, score: res.data.score });
        }
      } else {
        setFailureReport(res.data.failureTier);
      }
    } catch (err: any) {
      const errTier = err.response?.data?.failureTier || {
        whatYouRouted: selectedRoute.join(' ➔ '),
        whatHappened: err.response?.data?.error || 'Transmission failed.',
        whyFailed: 'Network rejected routing configuration.',
        adaptationHint: 'Inspect link capacities and re-evaluate path.'
      };
      setFailureReport(errTier);
    } finally {
      setIsTransmitting(false);
      setAnimatingPulse(false);
    }
  };

  // Splice & Reroute Handler
  const handleSpliceAndReroute = () => {
    if (!failureReport || !failureReport.failingHop) {
      setFailureReport(null);
      return;
    }

    const failingFromNode = failureReport.failingHop.from;
    const fromIdx = selectedRoute.indexOf(failingFromNode);
    if (fromIdx !== -1) {
      setSelectedRoute(selectedRoute.slice(0, fromIdx + 1));
    }
    setFailureReport(null);
    setProbeTelemetry(null);
  };

  // SVG coordinate transformation helpers
  const toSvgX = (x: number) => (x / 100) * 1000;
  const toSvgY = (y: number) => (y / 100) * 600;

  return (
    <div className="w-full max-w-[1440px] mx-auto text-white font-mono select-none px-2 sm:px-4 py-2">
      {/* ─── NEO-BRUTALIST OPERATIONS HUD HEADER ──────────────────── */}
      <header className="bg-[#0b0e14] border-2 border-[var(--border-subtle)] p-3 sm:p-4 mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] relative overflow-hidden">
        {/* Subtle top indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00ffcc] to-transparent opacity-80" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Mission & Sector ID */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00ffcc]/10 border-2 border-[#00ffcc] flex items-center justify-center text-[#00ffcc] shrink-0 shadow-[0_0_12px_rgba(0,255,204,0.3)]">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-1.5 py-0.2 bg-[#00ffcc] text-black font-black uppercase tracking-wider">
                  NOC // SIGNAL_ROUTER
                </span>
                <span className="text-[10px] text-[#fcee0a] border border-[#fcee0a]/40 px-1 font-bold">
                  {config.scenarioId || 'ROUTER-OP-01'}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] hidden md:inline">
                  TOPOLOGY MESH ACTIVE
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider mt-0.5 leading-none">
                {config.scenarioTitle || challenge?.prompt || 'OPTICAL TRANSIT INGRESS'}
              </h1>
            </div>
          </div>

          {/* Right: Technical Telemetry Strips */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap ml-auto">
            {/* Stream Payload Spec */}
            <div className="px-3 py-1.5 bg-black/60 border border-[var(--border-subtle)] text-right">
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-bold">STREAM PAYLOAD</div>
              <div className="text-base sm:text-lg font-black text-[#00ffcc] leading-none mt-0.5">
                ⚡ {stream.payloadVolumeGbps} <span className="text-[10px] font-normal text-cyan-200/70">Gbps</span>
              </div>
            </div>

            {/* Latency SLA Budget */}
            <div className="px-3 py-1.5 bg-black/60 border border-[var(--border-subtle)] text-right">
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-bold">LATENCY SLA</div>
              <div className="text-base sm:text-lg font-black text-[#fcee0a] leading-none mt-0.5">
                ⏱ ≤ {stream.slaMaxLatencyMs} <span className="text-[10px] font-normal text-amber-200/70">ms</span>
              </div>
            </div>

            {/* Canary Probes Cells */}
            <div className="px-3 py-1.5 bg-black/60 border border-[var(--border-subtle)] text-right">
              <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-bold">CANARY PROBES</div>
              <div className="flex items-center gap-1.5 justify-end mt-1">
                {[...Array(3)].map((_, i) => (
                  <span 
                    key={i} 
                    className={`w-3.5 h-3.5 border flex items-center justify-center text-[8px] font-black transition-all ${
                      i < probesRemaining 
                        ? 'bg-[#fcee0a] text-black border-amber-300 shadow-[0_0_8px_rgba(252,238,10,0.5)]' 
                        : 'bg-black/90 text-slate-700 border-slate-800'
                    }`}
                    title={i < probesRemaining ? `Available Diagnostic Probe (${i + 1})` : 'Depleted Diagnostic Probe'}
                  >
                    {i < probesRemaining ? '■' : '×'}
                  </span>
                ))}
              </div>
            </div>

            {/* Field Manual Help Trigger */}
            <button 
              onClick={() => setShowBriefingModal(true)}
              className="p-2 border-2 border-[var(--border-subtle)] hover:border-[#00ffcc] bg-black/60 hover:bg-[#00ffcc]/10 text-[var(--text-muted)] hover:text-[#00ffcc] transition shadow-sm"
              title="Open Tactical Field Manual"
              aria-label="Open Field Manual"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── DUAL PANEL GRID ────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4 items-start">
        
        {/* ─── LEFT: HERO NETWORK TOPOLOGY (8 COLS DESKTOP) ─────── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-2">
          <div className="bg-[#080b11] border-2 border-[var(--border-subtle)] p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col">
            
            {/* Canvas Header Bar */}
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--border-subtle)]/70 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#00ffcc] animate-ping inline-block" />
                <span className="font-black uppercase tracking-wider text-[#00ffcc]">
                  TOPOLOGY MESH // LIVE SWITCHBOARD
                </span>
                <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                  [{nodes.length} NODES // {links.length} FIBER LINKS]
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-3">
                <span className="hidden sm:inline">CLICK ADJACENT NODE / WIRE TO ROUTE</span>
                <span className="px-1.5 py-0.5 bg-black/70 border border-slate-700 text-slate-300 text-[10px] font-bold">
                  ROUTE: {selectedRoute.length} HOPS
                </span>
              </div>
            </div>

            {/* Error / Warning Alert Banner */}
            {probeError && (
              <div className="mb-3 p-2.5 bg-red-950/70 border-2 border-red-600/80 text-red-200 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-bold">{probeError}</span>
              </div>
            )}

            {/* SVG Interactive Canvas */}
            <div className="relative w-full h-[460px] sm:h-[530px] bg-[#05070a] border-2 border-[#1f242e] overflow-hidden select-none">
              
              {/* Corner CAD crosshairs */}
              <span className="absolute top-1 left-1 text-[10px] text-slate-600 font-mono select-none pointer-events-none">+</span>
              <span className="absolute top-1 right-1 text-[10px] text-slate-600 font-mono select-none pointer-events-none">+</span>
              <span className="absolute bottom-1 left-1 text-[10px] text-slate-600 font-mono select-none pointer-events-none">+</span>
              <span className="absolute bottom-1 right-1 text-[10px] text-slate-600 font-mono select-none pointer-events-none">+</span>

              <svg 
                className="w-full h-full absolute inset-0" 
                viewBox="0 0 1000 600" 
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Glow Filters */}
                  <filter id="sr-glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="sr-glow-red" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="sr-glow-amber" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Dot Grid Matrix Pattern */}
                  <pattern id="sr-dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="12" cy="12" r="1.1" fill="rgba(0,255,204,0.08)" />
                  </pattern>
                </defs>

                {/* Background Dot Grid */}
                <rect x="0" y="0" width="1000" height="600" fill="url(#sr-dot-grid)" />

                {/* Major CAD Gridlines */}
                <line x1="50" y1="300" x2="950" y2="300" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="6 6" />
                <line x1="500" y1="50" x2="500" y2="550" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="6 6" />

                {/* ─── RENDER LINKS ───────────────────────────────── */}
                {links.map((link) => {
                  const nodeFrom = nodes.find(n => n.id === link.from);
                  const nodeTo = nodes.find(n => n.id === link.to);
                  if (!nodeFrom || !nodeTo) return null;

                  const inRoute = isLinkInRoute(link.from, link.to);
                  const isHovered = hoveredLink?.id === link.id;

                  const cap = Number(link.capacityGbps || 10);
                  const bgLoad = Number(link.backgroundLoadGbps || 0);
                  const headroom = Math.max(0, cap - bgLoad);
                  const isOverloaded = inRoute && (bgLoad + stream.payloadVolumeGbps > cap);
                  const isStrained = (bgLoad + stream.payloadVolumeGbps > 0.75 * cap) && !isOverloaded;
                  const isInsufficientHeadroom = headroom < stream.payloadVolumeGbps;

                  const x1 = toSvgX(nodeFrom.x);
                  const y1 = toSvgY(nodeFrom.y);
                  const x2 = toSvgX(nodeTo.x);
                  const y2 = toSvgY(nodeTo.y);

                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;

                  // Stroke styling
                  let strokeColor = 'rgba(255, 255, 255, 0.20)';
                  let strokeWidth = 2.5;

                  if (inRoute) {
                    if (isOverloaded) {
                      strokeColor = '#ff0055';
                      strokeWidth = 6;
                    } else if (isStrained) {
                      strokeColor = '#fcee0a';
                      strokeWidth = 4.5;
                    } else {
                      strokeColor = '#00ffcc';
                      strokeWidth = 4.5;
                    }
                  } else if (isHovered) {
                    strokeColor = 'rgba(0, 255, 204, 0.7)';
                    strokeWidth = 3.5;
                  }

                  return (
                    <g 
                      key={link.id} 
                      onMouseEnter={() => setHoveredLink(link)} 
                      onMouseLeave={() => setHoveredLink(null)}
                      className="cursor-pointer group"
                    >
                      {/* Transparent wide hit area for easy clicking */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="transparent"
                        strokeWidth={28}
                        onClick={() => handleLinkClick(link)}
                      />

                      {/* Actual Link Cable Line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        className={inRoute ? (isOverloaded ? "sr-cable-overflow" : "sr-cable-active") : "transition-colors duration-150"}
                        filter={inRoute ? (isOverloaded ? "url(#sr-glow-red)" : "url(#sr-glow-cyan)") : undefined}
                        onClick={() => handleLinkClick(link)}
                      />

                      {/* Directional Chevrons on active route */}
                      {inRoute && (
                        <circle
                          cx={midX}
                          cy={midY}
                          r="4"
                          fill={isOverloaded ? '#ff0055' : '#00ffcc'}
                          filter={isOverloaded ? 'url(#sr-glow-red)' : 'url(#sr-glow-cyan)'}
                        />
                      )}

                      {/* Link Bandwidth Badge (Neo-Brutalist rectangular chip) */}
                      <g 
                        transform={`translate(${midX}, ${midY})`}
                        onClick={() => handleLinkClick(link)}
                      >
                        <rect
                          x={-46}
                          y={-12}
                          width={92}
                          height={24}
                          rx={0}
                          fill={
                            inRoute 
                              ? (isOverloaded ? "#380010" : "#002a24") 
                              : isInsufficientHeadroom 
                              ? "#24000b" 
                              : "#0c0f16"
                          }
                          stroke={
                            inRoute 
                              ? strokeColor 
                              : isInsufficientHeadroom 
                              ? "rgba(255, 0, 85, 0.6)" 
                              : "rgba(255, 255, 255, 0.25)"
                          }
                          strokeWidth={inRoute || isInsufficientHeadroom ? "1.5" : "1"}
                          className="transition-all"
                        />
                        <text
                          x={0}
                          y={4}
                          fill={
                            inRoute 
                              ? (isOverloaded ? "#ff7b72" : "#00ffcc") 
                              : isInsufficientHeadroom 
                              ? "#ff7b72" 
                              : "#cbd5e1"
                          }
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                          className="pointer-events-none select-none tracking-tight"
                        >
                          {isInsufficientHeadroom && !inRoute ? '▲ ' : ''}AVL {headroom.toFixed(1)}G / {cap}G
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* ─── ANIMATED PACKET PULSE ──────────────────────── */}
                {animatingPulse && selectedRoute.length > 1 && (
                  <circle r="7" fill="#00ffcc" filter="url(#sr-glow-cyan)">
                    <animateMotion
                      path={selectedRoute.map((nodeId, idx) => {
                        const n = nodes.find(x => x.id === nodeId);
                        const nx = toSvgX(n?.x ?? 0);
                        const ny = toSvgY(n?.y ?? 0);
                        return `${idx === 0 ? 'M' : 'L'} ${nx} ${ny}`;
                      }).join(' ')}
                      dur="1.1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </svg>

              {/* ─── RENDER NODES OVER CANVAS ─────────────────────── */}
              {nodes.map((node) => {
                const inRoute = selectedRoute.includes(node.id);
                const hopIndex = selectedRoute.indexOf(node.id);
                const isHead = currentHeadNodeId === node.id;
                const isSource = node.id === sourceId;
                const isTarget = node.id === targetId;
                const isAvailableHop = availableNextHops.includes(node.id);

                let nodeBorder = 'border-2 border-[var(--border-subtle)]';
                let nodeBg = 'bg-[#0f131a]';
                let nodeText = 'text-slate-300';
                let badgeAccent = 'bg-slate-800 text-slate-300';

                if (isSource) {
                  nodeBorder = 'border-2 border-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.4)]';
                  nodeBg = 'bg-[#00ffcc]/15';
                  nodeText = 'text-[#00ffcc]';
                  badgeAccent = 'bg-[#00ffcc] text-black';
                } else if (isTarget) {
                  nodeBorder = 'border-2 border-[#3fb950] shadow-[0_0_15px_rgba(63,185,80,0.4)]';
                  nodeBg = 'bg-[#3fb950]/15';
                  nodeText = 'text-[#3fb950]';
                  badgeAccent = 'bg-[#3fb950] text-black';
                } else if (isHead) {
                  nodeBorder = 'border-2 border-[#fcee0a] shadow-[0_0_12px_rgba(252,238,10,0.5)]';
                  nodeBg = 'bg-[#fcee0a]/20';
                  nodeText = 'text-[#fcee0a]';
                  badgeAccent = 'bg-[#fcee0a] text-black';
                } else if (inRoute) {
                  nodeBorder = 'border-2 border-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.25)]';
                  nodeBg = 'bg-[#00ffcc]/10';
                  nodeText = 'text-white';
                  badgeAccent = 'bg-[#00ffcc]/30 text-[#00ffcc]';
                } else if (isAvailableHop) {
                  nodeBorder = 'border-2 border-dashed border-[#fcee0a] shadow-[0_0_10px_rgba(252,238,10,0.3)] animate-pulse';
                  nodeBg = 'bg-[#fcee0a]/10';
                  nodeText = 'text-[#fcee0a]';
                  badgeAccent = 'bg-[#fcee0a] text-black';
                }

                return (
                  <div
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    onMouseEnter={() => setHoveredNode(node)}
                    onMouseLeave={() => setHoveredNode(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Node ${node.label || node.id}, type ${node.type}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNodeClick(node.id);
                      }
                    }}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute z-10 p-2 sm:p-2.5 rounded-none ${nodeBorder} ${nodeBg} cursor-pointer transition-all duration-150 flex flex-col items-center justify-center text-center hover:scale-105 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] min-w-[88px] sm:min-w-[96px]`}
                  >
                    {/* Top status indicator if in route */}
                    {inRoute && (
                      <div className="absolute -top-2.5 -left-2 px-1 py-0.2 bg-[#00ffcc] text-black text-[8px] font-black tracking-wider">
                        {String(hopIndex + 1).padStart(2, '0')}
                      </div>
                    )}

                    {/* Head marker badge */}
                    {isHead && !isTarget && (
                      <div className="absolute -top-2.5 -right-2 px-1 py-0.2 bg-[#fcee0a] text-black text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping" />
                        HEAD
                      </div>
                    )}

                    {/* Next hop action prompt */}
                    {isAvailableHop && (
                      <div className="absolute -bottom-2.5 px-1.5 py-0.2 bg-[#fcee0a] text-black text-[8.5px] font-black uppercase tracking-wider shadow">
                        + NEXT HOP
                      </div>
                    )}

                    <div className="flex items-center gap-1 mb-0.5">
                      {isSource ? (
                        <Zap className="w-3 h-3 text-[#00ffcc]" />
                      ) : isTarget ? (
                        <Crosshair className="w-3 h-3 text-[#3fb950]" />
                      ) : (
                        <Wifi className="w-3 h-3 text-slate-400" />
                      )}
                      <span className={`text-xs font-black uppercase tracking-wider ${nodeText}`}>
                        {node.label || node.id}
                      </span>
                    </div>

                    <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase font-bold tracking-tight">
                      {isSource ? 'CORE_INGRESS' : isTarget ? 'TARGET_EGRESS' : node.type}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Real-Time Telemetry Bar */}
            <div className="mt-2.5 p-2 sm:p-2.5 bg-[#05070a] border-2 border-[var(--border-subtle)] text-[11px] font-mono flex items-center justify-between gap-2 overflow-x-auto">
              {hoveredLink ? (
                <div className="flex items-center gap-3 sm:gap-5 text-white flex-wrap">
                  <span className="text-[#00ffcc] font-bold">LINK INSPECT: [{hoveredLink.from} ➔ {hoveredLink.to}]</span>
                  <span>CAPACITY: <strong className="text-cyan-300">{hoveredLink.capacityGbps}G</strong></span>
                  <span>LOAD: <strong className="text-amber-300">{hoveredLink.backgroundLoadGbps}G</strong></span>
                  <span>HEADROOM: <strong className="text-[#3fb950]">{(hoveredLink.capacityGbps - hoveredLink.backgroundLoadGbps).toFixed(1)}G</strong></span>
                  <span>LATENCY: <strong className="text-white">{hoveredLink.latencyMs}ms</strong></span>
                </div>
              ) : hoveredNode ? (
                <div className="flex items-center gap-3 sm:gap-4 text-white flex-wrap">
                  <span className="text-[#00ffcc] font-bold">NODE: [{hoveredNode.label || hoveredNode.id}]</span>
                  <span>ROLE: <strong className="text-cyan-300">{hoveredNode.type}</strong></span>
                  <span className="text-[var(--text-muted)]">{hoveredNode.description || 'Core network relay junction'}</span>
                </div>
              ) : (
                <div className="text-[var(--text-muted)] flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-[#00ffcc] shrink-0" />
                  <span>Hover link wire or node to inspect live capacity, background load, and propagation latency.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: TACTICAL ROUTE CORRIDOR & TELEMETRY (4 COLS) ── */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          
          {/* Waypoint Route Corridor Panel */}
          <div className="bg-[#0b0e14] border-2 border-[var(--border-subtle)] p-3 sm:p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-[#00ffcc] flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> WAYPOINT ROUTE CORRIDOR
              </span>
              <button
                onClick={handleResetRoute}
                disabled={selectedRoute.length <= 1 || isDelivered}
                className="text-[10px] text-[var(--text-muted)] hover:text-white flex items-center gap-1 px-1.5 py-0.5 border border-slate-700 bg-black/60 disabled:opacity-30 transition"
              >
                <RotateCcw className="w-3 h-3" /> RESET
              </button>
            </div>

            {/* Hop Sequence List */}
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1 mb-3">
              {selectedRoute.map((nodeId, idx) => {
                const node = nodes.find(n => n.id === nodeId);
                const isFirst = idx === 0;
                const isLast = idx === selectedRoute.length - 1;
                const isEnd = nodeId === targetId;

                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      if (!isLast && !isDelivered) {
                        handleNodeClick(nodeId);
                      }
                    }}
                    className={`flex items-center justify-between p-2 bg-[#06080d] border border-[var(--border-subtle)] text-xs font-mono transition ${
                      !isLast && !isDelivered
                        ? 'cursor-pointer hover:border-[#00ffcc] hover:bg-[#00ffcc]/5'
                        : ''
                    }`}
                    title={!isLast && !isDelivered ? `Click to backtrack route to hop ${idx + 1} (${node?.label || nodeId})` : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-black border border-slate-700 flex items-center justify-center font-bold text-[9px] text-[#00ffcc]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-black text-white text-xs tracking-wider">
                          {node?.label || nodeId}
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)] uppercase">
                          {isFirst ? 'SOURCE INGRESS' : isEnd ? 'TARGET EGRESS' : node?.type || 'ROUTER'}
                        </span>
                      </div>
                    </div>

                    {!isFirst && isLast && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLastHop();
                        }}
                        disabled={isDelivered}
                        className="p-1 hover:bg-red-950/60 border border-transparent hover:border-red-600/50 text-[var(--text-muted)] hover:text-red-400 transition"
                        title="Remove last hop"
                        aria-label="Remove last hop"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {!isRouteComplete && (
                <div className="p-2 border-2 border-dashed border-[#fcee0a]/50 text-center text-[10px] text-[#fcee0a] bg-[#fcee0a]/5 font-bold uppercase tracking-wider">
                  ➔ SELECT NEXT HOP FROM HIGHLIGHTED CANVAS NODES
                </div>
              )}
            </div>

            {/* Bottleneck Telemetry Box */}
            {routePreflight.bottleneckLink && (
              <div className={`p-2.5 border-2 text-xs mb-3 font-mono ${
                routePreflight.hasOverload 
                  ? 'bg-red-950/40 border-red-600 text-red-200 shadow-[0_0_12px_rgba(255,0,85,0.2)]' 
                  : 'bg-[#00ffcc]/5 border-[#00ffcc]/60 text-[#00ffcc]'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-1">
                  <span>BOTTLENECK LINK:</span>
                  <span>[{routePreflight.bottleneckLink.from} ➔ {routePreflight.bottleneckLink.to}]</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span>Headroom: <strong>{routePreflight.bottleneckHeadroom} Gbps</strong></span>
                  <span>Payload: <strong>{stream.payloadVolumeGbps} Gbps</strong></span>
                </div>
                {routePreflight.hasOverload && (
                  <div className="mt-1 text-red-400 font-black text-[9.5px] uppercase flex items-center gap-1 tracking-wider">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    BUFFER OVERRUN: +{routePreflight.overloadAmount} Gbps DEFICIT
                  </div>
                )}
              </div>
            )}

            {/* Pre-Flight Health Metrics */}
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              <div className="p-2 bg-black/60 border border-[var(--border-subtle)]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">PROJECTED LATENCY</div>
                <div className="text-base font-black mt-0.5 text-white flex items-center justify-between">
                  <span>{routePreflight.totalLatency} ms</span>
                  <span className={`text-[9px] font-bold ${routePreflight.totalLatency <= stream.slaMaxLatencyMs ? 'text-[#3fb950]' : 'text-red-400'}`}>
                    SLA ≤ {stream.slaMaxLatencyMs}ms
                  </span>
                </div>
              </div>
              <div className="p-2 bg-black/60 border border-[var(--border-subtle)]">
                <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-bold">STATUS FORECAST</div>
                <div className="text-xs font-black mt-1 uppercase">
                  {routePreflight.hasOverload ? (
                    <span className="text-red-400 flex items-center gap-1 font-bold">❌ OVERFLOW</span>
                  ) : isRouteComplete ? (
                    <span className="text-[#3fb950] flex items-center gap-1 font-bold">✓ CLEAR FLOW</span>
                  ) : (
                    <span className="text-[#fcee0a]">INCOMPLETE</span>
                  )}
                </div>
              </div>
            </div>

            {/* Diagnostic Probe Telemetry Card */}
            {probeTelemetry && (
              <div className="p-2.5 mb-3 bg-[#00ffcc]/10 border-2 border-[#00ffcc] text-xs font-mono">
                <div className="font-black text-[#00ffcc] mb-1 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5 animate-pulse" /> PROBE TELEMETRY:
                  </span>
                  <span>{probeTelemetry.totalLatencyMs}ms RTT</span>
                </div>
                <div className="text-[10px] text-cyan-100/90 leading-tight">
                  Verified {probeTelemetry.hops?.length || 0} hops. Bottleneck headroom: {probeTelemetry.bottleneckLink?.headroomGbps || 0} Gbps.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              {/* Probe Button */}
              <button
                onClick={handleSendProbe}
                disabled={probesRemaining <= 0 || isProbing || isTransmitting || selectedRoute.length < 2 || isDelivered}
                className="w-full py-2.5 px-3 bg-black/70 hover:bg-[#fcee0a]/10 border-2 border-slate-700 hover:border-[#fcee0a] text-slate-200 hover:text-[#fcee0a] font-bold text-xs uppercase flex items-center justify-center gap-2 transition disabled:opacity-40"
              >
                <Radio className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-[#fcee0a]' : 'text-[#fcee0a]'}`} />
                {isProbing ? 'PULSING CANARY PROBE...' : `DISPATCH CANARY PROBE (${probesRemaining} TOKENS)`}
              </button>

              {/* Primary Transmit Button */}
              <button
                onClick={handleTransmit}
                disabled={!isRouteComplete || isTransmitting || isDelivered}
                className={`w-full py-3 px-3 border-2 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                  isDelivered
                    ? 'bg-[#3fb950] text-black border-[#3fb950] cursor-default shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]'
                    : isRouteComplete
                    ? 'bg-[#00ffcc] text-black border-[#00ffcc] hover:bg-[#00ffcc]/90 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] cursor-pointer'
                    : 'bg-[#12161f] text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                }`}
              >
                {isTransmitting ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    TRANSMITTING STREAM...
                  </>
                ) : isDelivered ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    STREAM DELIVERED ({scoreEarned} PTS)
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    ENGAGE PRIMARY STREAM ({stream.payloadVolumeGbps} Gbps)
                  </>
                )}
              </button>

              {/* Completed State Notice */}
              {isDelivered && (
                <div className="p-2.5 bg-[#3fb950]/10 border-2 border-[#3fb950] flex items-center justify-between text-xs font-mono text-[#3fb950]">
                  <span className="flex items-center gap-1.5 font-black">
                    <CheckCircle2 className="w-4 h-4" />
                    TRANSMISSION LOCKED
                  </span>
                  <button
                    onClick={() => setShowSuccessModal(true)}
                    className="px-2 py-1 bg-[#3fb950] text-black font-black text-[10px] uppercase tracking-wider hover:bg-[#3fb950]/90 transition"
                  >
                    VIEW DEBRIEF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4-TIER CAUSAL FAILURE DIAGNOSTIC MODAL ─────────────── */}
      {failureReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#0b0e14] border-2 border-red-600 max-w-2xl w-full p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(255,0,85,0.4)] font-mono text-left">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-red-600/40 text-red-400">
              <ShieldAlert className="w-6 h-6 animate-bounce text-red-500" />
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-red-400">
                  TRANSMISSION ABORTED // BUFFER OVERFLOW DETECTED
                </h3>
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">
                  4-TIER DIAGNOSTIC CAUSAL TELEMETRY
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 my-4 text-xs">
              {/* Tier 1 */}
              <div className="p-2.5 bg-black/60 border border-slate-800">
                <div className="text-[10px] font-black text-[#00ffcc] uppercase tracking-wider mb-0.5">
                  1. WHAT YOU ROUTED:
                </div>
                <div className="text-white font-bold">{failureReport.whatYouRouted}</div>
              </div>

              {/* Tier 2 */}
              <div className="p-2.5 bg-red-950/40 border border-red-600/40">
                <div className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-0.5">
                  2. WHAT ACTUALLY HAPPENED:
                </div>
                <div className="text-red-200 font-bold">{failureReport.whatHappened}</div>
              </div>

              {/* Tier 3 */}
              <div className="p-2.5 bg-black/60 border border-slate-800">
                <div className="text-[10px] font-black text-[#fcee0a] uppercase tracking-wider mb-0.5">
                  3. WHY THE NETWORK FAILED:
                </div>
                <div className="text-slate-300 leading-relaxed">{failureReport.whyFailed}</div>
              </div>

              {/* Tier 4 */}
              <div className="p-2.5 bg-[#00ffcc]/10 border border-[#00ffcc]/40">
                <div className="text-[10px] font-black text-[#3fb950] uppercase tracking-wider mb-0.5">
                  4. WHAT INFORMATION YOU CAN USE TO ADAPT:
                </div>
                <div className="text-emerald-200 leading-relaxed">{failureReport.adaptationHint}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setFailureReport(null)}
                className="px-4 py-2 border-2 border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-xs uppercase"
              >
                Dismiss & Inspect
              </button>
              <button
                onClick={handleSpliceAndReroute}
                className="px-4 py-2 bg-[#00ffcc] text-black hover:bg-[#00ffcc]/90 font-black text-xs uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Splice & Reroute Path
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 30-SECOND FIELD MANUAL BRIEFING MODAL ──────────────── */}
      {showBriefingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#0b0e14] border-2 border-[#00ffcc] max-w-xl w-full p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(0,255,204,0.3)] font-mono text-left">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#00ffcc]/30">
              <div className="flex items-center gap-2 text-[#00ffcc]">
                <Radio className="w-5 h-5 animate-pulse" />
                <span className="font-black text-xs uppercase tracking-widest">
                  FIELD MANUAL // 30-SECOND BRIEFING
                </span>
              </div>
              <button 
                onClick={() => setShowBriefingModal(false)}
                className="text-[var(--text-muted)] hover:text-white text-xs font-bold px-2 py-0.5 border border-slate-700 hover:border-slate-500"
              >
                SKIP ✕
              </button>
            </div>

            <div className="my-4">
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider mb-2">
                MISSION OBJECTIVE: DELIVER THE SIGNAL
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {config.missionBrief || 'Route the critical high-volume data stream across the network mesh to destination egress without exceeding wire bandwidth or violating latency SLAs.'}
              </p>

              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-start gap-3 p-2.5 bg-black/60 border border-slate-800">
                  <span className="w-5 h-5 bg-[#00ffcc] text-black font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                  <div>
                    <strong className="text-white block uppercase text-[11px] mb-0.5">Connect the Path:</strong>
                    <span className="text-[var(--text-muted)] text-[11px]">Click adjacent nodes starting from [TX] to chart your route across the switchboard to [RX].</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-black/60 border border-slate-800">
                  <span className="w-5 h-5 bg-[#fcee0a] text-black font-black text-[10px] flex items-center justify-center shrink-0">2</span>
                  <div>
                    <strong className="text-white block uppercase text-[11px] mb-0.5">Watch Cable Headroom:</strong>
                    <span className="text-[var(--text-muted)] text-[11px]">Every cable has a max capacity. If stream volume exceeds available headroom, packets overflow and drop!</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-black/60 border border-slate-800">
                  <span className="w-5 h-5 bg-[#3fb950] text-black font-black text-[10px] flex items-center justify-center shrink-0">3</span>
                  <div>
                    <strong className="text-white block uppercase text-[11px] mb-0.5">Test with Canary Probes:</strong>
                    <span className="text-[var(--text-muted)] text-[11px]">Fire a diagnostic canary probe to inspect per-hop latency and verify throughput before engaging stream.</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBriefingModal(false)}
              className="w-full py-3 bg-[#00ffcc] text-black hover:bg-[#00ffcc]/90 font-black text-xs uppercase tracking-wider transition shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)] flex items-center justify-center gap-2"
            >
              INITIALIZE OPERATIONS CONSOLE ➔
            </button>
          </div>
        </div>
      )}

      {/* ─── SUCCESS DEBRIEF MODAL ─────────────────────────────── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in zoom-in-95">
          <div className="bg-[#0b0e14] border-2 border-[#3fb950] max-w-lg w-full p-5 sm:p-6 shadow-[6px_6px_0px_0px_rgba(63,185,80,0.4)] font-mono text-center">
            <div className="w-14 h-14 bg-[#3fb950]/20 border-2 border-[#3fb950] flex items-center justify-center mx-auto mb-3 text-[#3fb950] animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="text-[10px] font-black text-[#3fb950] uppercase tracking-widest">
              MISSION COMPLETE // ZERO PACKET LOSS VERIFIED
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider mt-1 mb-1">
              STREAM DELIVERED TO TARGET
            </h3>

            <div className="text-3xl font-black text-[#00ffcc] my-3">
              +{scoreEarned} PTS AWARDED
            </div>

            {/* Score Breakdown Table */}
            {scoreBreakdown && (
              <div className="p-3 bg-black/70 border border-slate-800 text-xs text-left mb-4 flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between text-white border-b border-slate-800 pb-1">
                  <span>Base Challenge Points:</span>
                  <span className="font-bold text-[#3fb950]">+{scoreBreakdown.base} pts</span>
                </div>
                {scoreBreakdown.zeroLoss > 0 && (
                  <div className="flex justify-between text-white border-b border-slate-800 pb-1">
                    <span>Zero-Loss Integrity Bonus:</span>
                    <span className="font-bold text-[#3fb950]">+{scoreBreakdown.zeroLoss} pts</span>
                  </div>
                )}
                {scoreBreakdown.cleanSheet > 0 && (
                  <div className="flex justify-between text-white border-b border-slate-800 pb-1">
                    <span>First-Run Clean Sheet Bonus:</span>
                    <span className="font-bold text-[#3fb950]">+{scoreBreakdown.cleanSheet} pts</span>
                  </div>
                )}
                {scoreBreakdown.latencyHeadroom > 0 && (
                  <div className="flex justify-between text-white border-b border-slate-800 pb-1">
                    <span>Latency SLA Margin Bonus:</span>
                    <span className="font-bold text-[#3fb950]">+{scoreBreakdown.latencyHeadroom} pts</span>
                  </div>
                )}
                {scoreBreakdown.unusedProbes > 0 && (
                  <div className="flex justify-between text-white">
                    <span>Probe Conservation Bonus:</span>
                    <span className="font-bold text-[#3fb950]">+{scoreBreakdown.unusedProbes} pts</span>
                  </div>
                )}
              </div>
            )}

            {/* Concept Reveal */}
            <div className="p-3 bg-[#00ffcc]/5 border border-[#00ffcc]/40 text-left text-xs leading-relaxed text-slate-300 mb-5">
              <div className="font-black text-[#00ffcc] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#00ffcc]" />
                {config.revealConcept?.title || 'GRAPH ROUTING & BOTTLENECK ANALYSIS'}
              </div>
              <p className="text-[11px] text-slate-300/90">
                {config.revealConcept?.summary || 'The shortest route (fewest hops) is frequently a bottleneck trap. Real distributed systems prioritize link throughput, buffer headroom, and congestion minimization over geometric distance.'}
              </p>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-3 bg-[#00ffcc] text-black hover:bg-[#00ffcc]/90 font-black text-xs uppercase tracking-wider transition shadow-[3px_3px_0px_0px_rgba(0,0,0,0.8)]"
            >
              DISMISS DEBRIEF / RESUME INSPECTION ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouterChallenge;
