import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';
import { 
  ShieldAlert, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Search, 
  ChevronRight, 
  Award, 
  FileText, 
  Clock, 
  UserCheck, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';

/* ─── INTERFACES ─────────────────────────────────────────── */
export interface Suspect {
  id: string;
  name: string;
  role: string;
  clearance: number;
  accessTime: string;
  authType: string;
  subnet: string;
  location: string;
  avatar?: string;
  notes?: string;
}

export interface InquiryRecord {
  id: string;
  queryKey?: string;
  questionText: string;
  attribute: string;
  operator: string;
  value: any;
  verdict: boolean;
  responseText: string;
  eliminatedSuspectIds: string[];
  timestamp: number;
}

export interface WitnessConfig {
  caseTitle?: string;
  missionBrief?: string;
  questionBudget?: number;
  suspects: Suspect[];
  allowedAttempts?: number;
  revealText?: string;
}

export interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (result: any) => void;
}

export default function WitnessChallenge({ challenge, sessionCode, onSubmitted }: Props) {
  const config: WitnessConfig = challenge.config || {};
  const suspects: Suspect[] = useMemo(() => config.suspects || [], [config.suspects]);
  const defaultBudget = config.questionBudget || 5;

  // Investigation state
  const [questionsRemaining, setQuestionsRemaining] = useState<number>(defaultBudget);
  const [questionsUsed, setQuestionsUsed] = useState<number>(0);
  const [activeSuspectIds, setActiveSuspectIds] = useState<string[]>([]);
  const [eliminatedSuspectIds, setEliminatedSuspectIds] = useState<string[]>([]);
  const [inquiryHistory, setInquiryHistory] = useState<InquiryRecord[]>([]);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<{ text: string; verdict: boolean } | null>(null);

  // Question Builder state
  const [selectedAttribute, setSelectedAttribute] = useState<string>('clearance');
  const [selectedOperator, setSelectedOperator] = useState<string>('>=');
  const [selectedValue, setSelectedValue] = useState<any>(3);
  const [partitionPreview, setPartitionPreview] = useState<{ yesCount: number; noCount: number; yesSuspects: string[]; noSuspects: string[] } | null>(null);

  // Accusation modal state
  const [accuseModalOpen, setAccuseModalOpen] = useState<boolean>(false);
  const [selectedAccusedId, setSelectedAccusedId] = useState<string>('');
  const [showLearningDialog, setShowLearningDialog] = useState<boolean>(false);

  const briefingStorageKey = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('terminal_user') || 'null');
      const player = JSON.parse(localStorage.getItem('terminal_player') || 'null');
      return `witness_briefing_seen_${challenge.id}_${user?.id || player?.id || 'guest'}`;
    } catch {
      return `witness_briefing_seen_${challenge.id}`;
    }
  })();

  // 30-Second Onboarding state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem(briefingStorageKey);
    } catch {
      return true;
    }
  });
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try {
      sessionStorage.setItem(briefingStorageKey, 'true');
    } catch {}
  };

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedSuspectId, setExpandedSuspectId] = useState<string | null>(null);

  // Initialize and restore state from server
  const fetchInvestigationState = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/${sessionCode}/witness-state?challengeId=${challenge.id}`);
      const data = res.data;
      if (data) {
        setQuestionsRemaining(data.questionsRemaining ?? defaultBudget);
        setQuestionsUsed(data.questionsUsed ?? 0);
        setActiveSuspectIds(data.activeSuspectIds && data.activeSuspectIds.length > 0 
          ? data.activeSuspectIds 
          : suspects.map(s => s.id));
        setEliminatedSuspectIds(data.eliminatedSuspectIds || []);
        setInquiryHistory(data.inquiryHistory || []);
        setIsSolved(Boolean(data.isSolved));
        setShowLearningDialog(Boolean(data.isSolved));
      }
    } catch {
      // Default to initial suspects
      setActiveSuspectIds(suspects.map(s => s.id));
      setQuestionsRemaining(defaultBudget);
    }
  }, [sessionCode, challenge.id, defaultBudget, suspects]);

  useEffect(() => {
    fetchInvestigationState();
  }, [fetchInvestigationState]);

  // Available attributes configuration
  const attributeDefinitions: Array<{
    id: string;
    label: string;
    operators: string[];
    values: Array<string | number>;
  }> = useMemo(() => {
    const rawAttrs: any[] = (challenge.config?.queryableAttributes as any[]) || [];
    if (Array.isArray(rawAttrs) && rawAttrs.length > 0) {
      const defs = rawAttrs.map(attr => {
        const key = attr.key || attr.id;
        const vals = Array.from(new Set(
          suspects.map((s: any) => s[key] !== undefined ? s[key] : (key === 'authMethod' ? s.authType : (key === 'authType' ? s.authMethod : undefined)))
            .filter((v: any) => v !== undefined && v !== null && v !== '')
        )).sort();
        return {
          id: key,
          label: attr.label || key,
          operators: attr.operators || ['==', '!='],
          values: vals.length > 0 ? vals : [attr.defaultValue || 'Default'],
        };
      });
      defs.push({
        id: 'culprit',
        label: 'Direct Suspect Name',
        operators: ['=='],
        values: suspects.map(s => s.name),
      });
      return defs;
    }

    return [
      { id: 'clearance', label: 'Clearance Level', operators: ['>=', '<=', '=='], values: [1, 2, 3, 4] },
      { id: 'accessTime', label: 'Access Timestamp', operators: ['>=', '<='], values: ['01:15', '01:45', '02:00', '02:15', '02:30', '02:44', '02:50', '03:10'] },
      { id: 'authMethod', label: 'Authentication Method', operators: ['==', '!='], values: ['BIOMETRIC', 'HARDWARE_TOKEN', 'PASSWORD', 'SMARTCARD', 'SSH_KEY', 'VPN_CERT'] },
      { id: 'location', label: 'Building Location', operators: ['==', '!='], values: ['Data Center Vault', 'East Wing Office', 'IDF Closet 4', 'Remote Workstation', 'Server Room B', 'SOC Control Room', 'Testing Lab C'] },
      { id: 'subnet', label: 'Origin Subnet', operators: ['==', '!='], values: ['ALPHA', 'BETA', 'DELTA', 'GAMMA'] },
      { id: 'culprit', label: 'Direct Suspect Name', operators: ['=='], values: suspects.map(s => s.name), },
    ];
  }, [challenge.config, suspects]);

  // Update selected value options when attribute changes
  useEffect(() => {
    const def = attributeDefinitions.find(a => a.id === selectedAttribute);
    if (def) {
      if (!def.operators.includes(selectedOperator)) {
        setSelectedOperator(def.operators[0]);
      }
      if (!def.values.includes(selectedValue)) {
        setSelectedValue(def.values[0]);
      }
    }
  }, [selectedAttribute, attributeDefinitions, selectedOperator, selectedValue]);

  // Compute question text
  const currentQuestionText = useMemo(() => {
    const attrDef = attributeDefinitions.find(a => a.id === selectedAttribute);
    const attrLabel = attrDef?.label || selectedAttribute;
    
    if (selectedAttribute === 'culprit') {
      return `Is the culprit directly ${selectedValue}?`;
    }
    if (selectedOperator === '>=') {
      return `Did the culprit have ${attrLabel} of at least ${selectedValue}?`;
    }
    if (selectedOperator === '<=') {
      return `Did the culprit have ${attrLabel} at or before ${selectedValue}?`;
    }
    if (selectedOperator === '==') {
      return `Was the culprit's ${attrLabel} equal to ${selectedValue}?`;
    }
    if (selectedOperator === '!=') {
      return `Was the culprit's ${attrLabel} different from ${selectedValue}?`;
    }
    return `Does the culprit match ${attrLabel} ${selectedOperator} ${selectedValue}?`;
  }, [selectedAttribute, selectedOperator, selectedValue, attributeDefinitions]);

  // Client-side instant Partition Preview calculation
  useEffect(() => {
    const currentActive = suspects.filter(s => activeSuspectIds.includes(s.id));
    if (currentActive.length === 0) {
      setPartitionPreview({ yesCount: 0, noCount: 0, yesSuspects: [], noSuspects: [] });
      return;
    }

    const yesSuspects: string[] = [];
    const noSuspects: string[] = [];

    const evaluateCondition = (s: Suspect) => {
      if (selectedAttribute === 'culprit') {
        const eq = s.name.toLowerCase() === String(selectedValue).toLowerCase() || s.id === String(selectedValue);
        return selectedOperator === '!=' ? !eq : eq;
      }
      const raw = (s as any)[selectedAttribute];
      if (raw === undefined || raw === null) return false;

      if (selectedOperator === '>=' || selectedOperator === '<=') {
        const numRaw = Number(raw);
        const numTarget = Number(selectedValue);
        if (!isNaN(numRaw) && !isNaN(numTarget)) {
          return selectedOperator === '>=' ? numRaw >= numTarget : numRaw <= numTarget;
        }
        return selectedOperator === '>=' ? String(raw) >= String(selectedValue) : String(raw) <= String(selectedValue);
      }
      if (selectedOperator === '==') {
        return String(raw).toLowerCase() === String(selectedValue).toLowerCase();
      }
      if (selectedOperator === '!=') {
        return String(raw).toLowerCase() !== String(selectedValue).toLowerCase();
      }
      return false;
    };

    for (const s of currentActive) {
      if (evaluateCondition(s)) {
        yesSuspects.push(s.id);
      } else {
        noSuspects.push(s.id);
      }
    }

    setPartitionPreview({
      yesCount: yesSuspects.length,
      noCount: noSuspects.length,
      yesSuspects,
      noSuspects,
    });
  }, [suspects, activeSuspectIds, selectedAttribute, selectedOperator, selectedValue]);

  // Dispatch Question
  const handleDispatchQuestion = async () => {
    if (questionsRemaining <= 0 || loading || isSolved) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await api.post(`/sessions/${sessionCode}/witness-query`, {
        challengeId: challenge.id,
        query: {
          attribute: selectedAttribute,
          operator: selectedOperator,
          value: selectedValue,
          questionText: currentQuestionText,
        },
      });

      const data = res.data;
      if (data.success) {
        setQuestionsRemaining(data.questionsRemaining);
        setQuestionsUsed(data.questionsUsed);
        setActiveSuspectIds(data.activeSuspectIds);
        setEliminatedSuspectIds(prev => Array.from(new Set([...prev, ...data.eliminatedSuspectIds])));
        setInquiryHistory(data.inquiryHistory);
        setLastResponse({
          text: data.responseText,
          verdict: data.verdict,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to dispatch inquiry to The Witness');
    } finally {
      setLoading(false);
    }
  };

  // Submit Final Accusation
  const handleFinalAccusation = async () => {
    if (!selectedAccusedId || loading) return;
    setLoading(true);
    setErrorMsg(null);

    const suspectObj = suspects.find(s => s.id === selectedAccusedId);

    try {
      const res = await api.post(`/sessions/active/submit`, {
        challengeId: challenge.id,
        answer: {
          type: 'WITNESS_ACCUSATION',
          accusedSuspectId: selectedAccusedId,
          accusedSuspectName: suspectObj?.name || selectedAccusedId,
          questionsRemaining,
          questionsUsed,
        },
      });

      const data = res.data;
      if (data.isCorrect) {
        setIsSolved(true);
        setShowLearningDialog(true);
      } else {
        setErrorMsg(`ACCUSATION FAILED — Evidence contradicts ${suspectObj?.name}. Warrant denied.`);
      }

      if (onSubmitted) {
        onSubmitted(data);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to file accusation warrant');
    } finally {
      setLoading(false);
      setAccuseModalOpen(false);
    }
  };

  const isPrimeSuspect = activeSuspectIds.length === 1;
  const primeSuspect = isPrimeSuspect ? suspects.find(s => s.id === activeSuspectIds[0]) : null;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 flex flex-col gap-6 font-mono text-[var(--text-primary)]">
      
      {/* ─── CASE HEADER BANNER ─── */}
      <div className="bg-[rgba(20,24,32,0.95)] border-2 border-[var(--border-subtle)] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[rgba(0,255,204,0.1)] border border-[var(--accent-primary)] rounded-lg text-[var(--accent-primary)]">
            <ShieldAlert size={28} />
          </div>
          <div>
            <div className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase">
              CODENEX FORENSIC LOG // THE WITNESS
            </div>
            <h1 className="text-2xl font-black tracking-wide text-white uppercase">
              {config.caseTitle || challenge.prompt || 'OPERATION BLACKOUT'}
            </h1>
          </div>
        </div>

        {/* Header Controls: Briefing, Budget, Accuse */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setOnboardingStep(1); setShowOnboarding(true); }}
            className="px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.04)] text-xs font-bold text-gray-300 hover:text-white hover:border-[var(--accent-primary)] flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Read 30-second Field Manual"
          >
            <HelpCircle size={16} className="text-[var(--accent-primary)]" />
            <span>HOW TO PLAY (30s)</span>
          </button>

          <div className={`px-4 py-2 rounded-lg border-2 flex items-center gap-3 ${
            questionsRemaining <= 1 
              ? 'bg-[rgba(248,81,73,0.15)] border-[var(--error)] text-[var(--error)] animate-pulse' 
              : 'bg-[rgba(0,255,204,0.08)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
          }`}>
            <Clock size={20} />
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                QUERY BUDGET
              </div>
              <div className="text-xl font-black">
                {questionsRemaining} REMAINING
              </div>
            </div>
          </div>

          <button
            onClick={() => setAccuseModalOpen(true)}
            disabled={isSolved}
            className={`px-5 py-3 rounded-lg font-black text-sm uppercase tracking-wider transition-all flex items-center gap-2 ${
              isPrimeSuspect
                ? 'bg-[var(--accent-primary)] text-black shadow-[0_0_20px_rgba(0,255,204,0.5)] animate-bounce'
                : 'bg-[rgba(255,180,0,0.15)] border border-[var(--warning)] text-[var(--warning)] hover:bg-[rgba(255,180,0,0.25)]'
            }`}
          >
            <UserCheck size={18} />
            {isPrimeSuspect ? 'INDICT PRIME SUSPECT' : 'FILE ACCUSATION'}
          </button>
        </div>
      </div>

      {/* ─── MISSION BRIEF ALERT ─── */}
      {config.missionBrief && (
        <div className="bg-[rgba(15,20,30,0.7)] border-l-4 border-[var(--accent-primary)] p-4 rounded-r-lg text-sm text-[var(--text-secondary)] leading-relaxed">
          <span className="text-[var(--accent-primary)] font-bold uppercase mr-2">[INCIDENT BRIEF]:</span>
          {config.missionBrief}
        </div>
      )}

      {/* ─── PRIME SUSPECT ALERT (IF N=1) ─── */}
      {isPrimeSuspect && primeSuspect && !isSolved && (
        <div className="bg-[rgba(0,255,204,0.1)] border-2 border-[var(--accent-primary)] p-4 rounded-xl flex items-center justify-between gap-4 shadow-[0_0_25px_rgba(0,255,204,0.25)]">
          <div className="flex items-center gap-3">
            <Sparkles className="text-[var(--accent-primary)] animate-spin" size={24} />
            <div>
              <div className="text-xs text-[var(--accent-primary)] font-bold uppercase tracking-widest">
                DEDUCTIVE LOCK-ON ESTABLISHED (N = 1)
              </div>
              <div className="text-base font-bold text-white">
                All contradictory suspects exonerated. Sole remaining candidate: <span className="text-[var(--accent-primary)] font-black uppercase underline">{primeSuspect.name}</span>.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedAccusedId(primeSuspect.id);
              setAccuseModalOpen(true);
            }}
            className="px-4 py-2 bg-[var(--accent-primary)] text-black font-black rounded-lg text-xs uppercase tracking-wider"
          >
            Confirm Warrant
          </button>
        </div>
      )}

      {/* ─── MAIN TWO-COLUMN SPLIT: QUESTION BUILDER + EVIDENCE BOARD ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: QUESTION BUILDER (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="bg-[rgba(20,24,32,0.9)] border-2 border-[var(--border-subtle)] rounded-xl p-5 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--accent-primary)] uppercase tracking-wider">
                <Search size={16} /> Structured Question Matrix
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">COST: 1 TOKEN</span>
            </div>

            {/* Slot 1: Attribute Target */}
            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">
                Target Attribute:
              </label>
              <select
                value={selectedAttribute}
                onChange={e => setSelectedAttribute(e.target.value)}
                disabled={questionsRemaining <= 0 || isSolved}
                className="w-full bg-[rgba(10,12,18,0.9)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
              >
                {attributeDefinitions.map(attr => (
                  <option key={attr.id} value={attr.id}>{attr.label}</option>
                ))}
              </select>
            </div>

            {/* Slot 2 & 3: Operator & Value */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">
                  Condition:
                </label>
                <select
                  value={selectedOperator}
                  onChange={e => setSelectedOperator(e.target.value)}
                  disabled={questionsRemaining <= 0 || isSolved}
                  className="w-full bg-[rgba(10,12,18,0.9)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                >
                  {(attributeDefinitions.find(a => a.id === selectedAttribute)?.operators || ['==']).map(op => (
                    <option key={op} value={op}>
                      {op === '==' ? 'Equals (=)' : op === '!=' ? 'Not Equal (≠)' : op === '>=' ? 'At Least (≥)' : op === '<=' ? 'At Most (≤)' : op}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-1 block">
                  Value:
                </label>
                <select
                  value={selectedValue}
                  onChange={e => setSelectedValue(e.target.value)}
                  disabled={questionsRemaining <= 0 || isSolved}
                  className="w-full bg-[rgba(10,12,18,0.9)] border border-[var(--border-subtle)] rounded-lg p-2.5 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                >
                  {(attributeDefinitions.find(a => a.id === selectedAttribute)?.values || []).map(val => (
                    <option key={String(val)} value={val}>
                      {selectedAttribute === 'clearance' ? `Level ${val}` : String(val)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Synthesis Preview */}
            <div className="bg-[rgba(10,14,20,0.8)] border border-[var(--border-subtle)] rounded-lg p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">
                INQUIRY SYNTHESIS:
              </div>
              <div className="text-white font-bold italic">
                "{currentQuestionText}"
              </div>
            </div>

            {/* ─── PARTITION PREVIEW (CORE PEDAGOGICAL FEATURE) ─── */}
            {partitionPreview && (
              <div className="bg-[rgba(0,255,204,0.04)] border border-[rgba(0,255,204,0.2)] rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-1">
                    <Search size={12} /> Partition Preview
                  </span>
                  {partitionPreview.yesCount === partitionPreview.noCount && partitionPreview.yesCount > 0 && (
                    <span className="text-[9px] bg-[rgba(0,255,204,0.2)] text-[var(--accent-primary)] px-2 py-0.5 rounded font-black">
                      50/50 PERFECT SPLIT
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2 bg-[rgba(63,185,80,0.1)] border border-[var(--success)] rounded">
                    <div className="text-xs text-[var(--success)] font-bold uppercase">IF YES</div>
                    <div className="text-lg font-black text-white">{partitionPreview.yesCount} Suspects</div>
                  </div>
                  <div className="p-2 bg-[rgba(248,81,73,0.1)] border border-[var(--error)] rounded">
                    <div className="text-xs text-[var(--error)] font-bold uppercase">IF NO</div>
                    <div className="text-lg font-black text-white">{partitionPreview.noCount} Suspects</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] text-center mt-2">
                  Whichever answer The Witness gives, the other group will be immediately eliminated.
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-[rgba(248,81,73,0.15)] border border-[var(--error)] rounded-lg text-xs text-[var(--error)] flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Dispatch Button */}
            <button
              onClick={handleDispatchQuestion}
              disabled={questionsRemaining <= 0 || loading || isSolved}
              className={`w-full py-3.5 rounded-lg font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                questionsRemaining <= 0 || isSolved
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-[var(--accent-primary)] text-black hover:opacity-95 shadow-[0_0_15px_rgba(0,255,204,0.3)]'
              }`}
            >
              {loading ? (
                <>QUERYING WITNESS...</>
              ) : questionsRemaining <= 0 ? (
                <>BUDGET EXHAUSTED (ACCUSE ONLY)</>
              ) : (
                <>DISPATCH TO THE WITNESS (-1 TOKEN) <ChevronRight size={16} /></>
              )}
            </button>
          </div>

          {/* Latest Witness Response Teletype */}
          {lastResponse && (
            <div className={`p-4 rounded-xl border-2 flex flex-col gap-2 ${
              lastResponse.verdict 
                ? 'bg-[rgba(63,185,80,0.08)] border-[var(--success)]' 
                : 'bg-[rgba(248,81,73,0.08)] border-[var(--error)]'
            }`}>
              <div className="flex items-center justify-between text-xs font-bold tracking-wider uppercase">
                <span className="flex items-center gap-1.5">
                  {lastResponse.verdict ? <CheckCircle2 size={16} className="text-[var(--success)]" /> : <XCircle size={16} className="text-[var(--error)]" />}
                  LATEST WITNESS TESTIMONY
                </span>
                <span className={lastResponse.verdict ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
                  {lastResponse.verdict ? 'VERIFIED' : 'CONTRADICTED'}
                </span>
              </div>
              <div className="text-sm font-mono text-white leading-relaxed">
                {lastResponse.text}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SUSPECT ROSTER & EVIDENCE BOARD (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Suspect Dossier Cards */}
          <div className="bg-[rgba(20,24,32,0.9)] border-2 border-[var(--border-subtle)] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-4">
              <div className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-[var(--accent-primary)]" />
                Suspect Roster ({activeSuspectIds.length} Active / {eliminatedSuspectIds.length} Exonerated)
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">Click card to inspect dossier</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suspects.map(suspect => {
                const isEliminated = eliminatedSuspectIds.includes(suspect.id);
                const isSoloPrime = isPrimeSuspect && activeSuspectIds[0] === suspect.id;
                const isExpanded = expandedSuspectId === suspect.id;

                return (
                  <div
                    key={suspect.id}
                    onClick={() => setExpandedSuspectId(isExpanded ? null : suspect.id)}
                    className={`p-3.5 rounded-lg border-2 transition-all cursor-pointer relative overflow-hidden ${
                      isEliminated
                        ? 'bg-[rgba(10,12,18,0.5)] border-[rgba(255,255,255,0.06)] opacity-40 grayscale'
                        : isSoloPrime
                        ? 'bg-[rgba(0,255,204,0.08)] border-[var(--accent-primary)] shadow-[0_0_15px_rgba(0,255,204,0.3)]'
                        : 'bg-[rgba(15,20,30,0.8)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
                    }`}
                  >
                    {/* Elimination Strikethrough Stamp */}
                    {isEliminated && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <span className="border-2 border-[var(--error)] text-[var(--error)] font-black text-xs px-3 py-1 uppercase tracking-widest rotate-[-12deg] bg-black/80">
                          EXONERATED
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-mono font-bold text-[var(--accent-primary)]">
                          [{suspect.id}]
                        </div>
                        <div className="text-base font-bold text-white">
                          {suspect.name}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {suspect.role}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] bg-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded font-mono text-[var(--text-muted)]">
                          Lvl {suspect.clearance}
                        </span>
                      </div>
                    </div>

                    {/* Quick Attributes */}
                    <div className="mt-3 pt-2 border-t border-[rgba(255,255,255,0.08)] grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)] font-mono">
                      <div>📍 {suspect.location}</div>
                      <div>⏰ {suspect.accessTime}</div>
                      <div>🔑 {suspect.authType}</div>
                      <div>🌐 {suspect.subnet}</div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                        <div className="font-bold text-white mb-1">Dossier Telemetry:</div>
                        <div>Assigned Subnet: {suspect.subnet}</div>
                        <div>Authentication Vector: {suspect.authType}</div>
                        <div>Last Active: {suspect.accessTime} at {suspect.location}</div>
                        {suspect.notes && <div className="mt-1 italic text-[11px]">{suspect.notes}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Evidence Board (Inquiry Log) */}
          <div className="bg-[rgba(20,24,32,0.9)] border-2 border-[var(--border-subtle)] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 mb-3">
              <div className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-[var(--accent-primary)]" />
                Interrogation Log & Pinned Clues ({inquiryHistory.length})
              </div>
            </div>

            {inquiryHistory.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] italic py-6 text-center">
                No inquiries dispatched yet. Construct your first question on the left to extract evidence.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                {inquiryHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-[rgba(10,14,20,0.8)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white">#{idx + 1}: "{item.questionText}"</span>
                      <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                        item.verdict 
                          ? 'bg-[rgba(63,185,80,0.2)] text-[var(--success)]' 
                          : 'bg-[rgba(248,81,73,0.2)] text-[var(--error)]'
                      }`}>
                        {item.verdict ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div className="text-[var(--text-secondary)] text-[11px]">
                      {item.responseText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ─── 30-SECOND ONBOARDING BRIEFING MODAL ─── */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[rgba(18,22,30,0.98)] border-2 border-[var(--accent-primary)] rounded-2xl p-6 max-w-xl w-full shadow-[0_0_40px_rgba(0,255,204,0.3)] flex flex-col gap-5 font-mono animate-fade-in text-[var(--text-primary)]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[rgba(0,255,204,0.1)] border border-[var(--accent-primary)] rounded-lg text-[var(--accent-primary)]">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="text-[10px] text-[var(--accent-primary)] font-bold tracking-widest uppercase">
                    FIELD MANUAL // 30-SECOND BRIEFING
                  </div>
                  <div className="text-base font-black text-white uppercase tracking-wide">
                    HOW THE INVESTIGATION WORKS
                  </div>
                </div>
              </div>
              <button
                onClick={dismissOnboarding}
                className="text-gray-400 hover:text-white text-sm font-bold px-2 py-1 rounded bg-gray-800/50 hover:bg-gray-800"
              >
                ✕ SKIP
              </button>
            </div>

            {/* Step Indicators */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setOnboardingStep(1)}
                className={`py-1.5 px-2 rounded border transition-all ${
                  onboardingStep === 1 
                    ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)]' 
                    : 'border-[var(--border-subtle)] text-gray-500 hover:text-gray-300'
                }`}
              >
                1. Case & Budget
              </button>
              <button
                onClick={() => setOnboardingStep(2)}
                className={`py-1.5 px-2 rounded border transition-all ${
                  onboardingStep === 2 
                    ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)]' 
                    : 'border-[var(--border-subtle)] text-gray-500 hover:text-gray-300'
                }`}
              >
                2. Question & Preview
              </button>
              <button
                onClick={() => setOnboardingStep(3)}
                className={`py-1.5 px-2 rounded border transition-all ${
                  onboardingStep === 3 
                    ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.15)] text-[var(--accent-primary)]' 
                    : 'border-[var(--border-subtle)] text-gray-500 hover:text-gray-300'
                }`}
              >
                3. Evidence & Accuse
              </button>
            </div>

            {/* Step 1 Content */}
            {onboardingStep === 1 && (
              <div className="flex flex-col gap-3 py-2 text-xs leading-relaxed text-gray-300">
                <div className="p-3 bg-[rgba(0,255,204,0.06)] border-l-4 border-[var(--accent-primary)] rounded-r-lg font-bold text-white">
                  OBJECTIVE: Exactly one of the active staff members committed the unauthorized security export.
                </div>
                <ul className="list-disc pl-5 flex flex-col gap-2 text-gray-300">
                  <li>
                    <strong className="text-white">Strict Question Budget:</strong> You have only <span className="text-[var(--accent-primary)] font-bold">{defaultBudget} Question Tokens</span>.
                  </li>
                  <li>
                    Every inquiry you dispatch consumes <strong className="text-white">1 token</strong> from your reserve.
                  </li>
                  <li>
                    Guessing names randomly will burn through all your tokens. You must ask questions that eliminate suspects in batches!
                  </li>
                </ul>
              </div>
            )}

            {/* Step 2 Content */}
            {onboardingStep === 2 && (
              <div className="flex flex-col gap-3 py-2 text-xs leading-relaxed text-gray-300">
                <div className="p-3 bg-[rgba(255,180,0,0.08)] border-l-4 border-[var(--warning)] rounded-r-lg font-bold text-white">
                  PARTITION PREVIEW: Look at the YES / NO split before asking!
                </div>
                <ul className="list-disc pl-5 flex flex-col gap-2 text-gray-300">
                  <li>
                    Use the <strong className="text-white">Question Builder</strong> to choose an attribute, comparison, and value (e.g. <em>Clearance Level &ge; 3</em>).
                  </li>
                  <li>
                    The live <strong className="text-[var(--warning)]">Partition Preview</strong> shows how many remaining suspects answer YES vs NO:
                    <div className="mt-1.5 py-1.5 px-3 bg-black/60 rounded border border-gray-800 text-[11px] font-mono text-gray-300 flex items-center justify-around">
                      <span>YES: 4 suspects</span>
                      <span className="text-gray-600">|</span>
                      <span>NO: 4 suspects</span>
                    </div>
                  </li>
                  <li>
                    <strong className="text-white">Pro Tip:</strong> Balanced questions (like 4 vs 4) eliminate half the suspects <em>no matter what the answer is</em>!
                  </li>
                </ul>
              </div>
            )}

            {/* Step 3 Content */}
            {onboardingStep === 3 && (
              <div className="flex flex-col gap-3 py-2 text-xs leading-relaxed text-gray-300">
                <div className="p-3 bg-[rgba(63,185,80,0.08)] border-l-4 border-[var(--success)] rounded-r-lg font-bold text-white">
                  EVIDENCE BOARD & FINAL ACCUSATION
                </div>
                <ul className="list-disc pl-5 flex flex-col gap-2 text-gray-300">
                  <li>
                    The <strong className="text-white">Evidence Board</strong> automatically exonerates innocent candidates. Look for the <span className="text-[var(--error)] font-bold">EXONERATED</span> stamp.
                  </li>
                  <li>
                    When only one suspect remains (or your question budget hits 0), click <strong className="text-[var(--accent-primary)]">FINAL ACCUSATION</strong> to indict them.
                  </li>
                  <li>
                    <strong className="text-white">High Efficiency Scoring:</strong> Conserving question tokens awards huge bonus points (+20 pts each)!
                  </li>
                </ul>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="flex justify-between items-center border-t border-[var(--border-subtle)] pt-4 mt-1">
              <div className="text-[11px] text-[var(--text-muted)]">
                Step {onboardingStep} of 3
              </div>
              <div className="flex items-center gap-2">
                {onboardingStep > 1 && (
                  <button
                    onClick={() => setOnboardingStep(s => s - 1)}
                    className="px-3 py-2 rounded-lg border border-gray-700 text-xs font-bold text-gray-300 hover:text-white hover:border-gray-500"
                  >
                    PREVIOUS
                  </button>
                )}
                {onboardingStep < 3 ? (
                  <button
                    onClick={() => setOnboardingStep(s => s + 1)}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-black text-xs font-black uppercase tracking-wider hover:opacity-95"
                  >
                    NEXT STEP →
                  </button>
                ) : (
                  <button
                    onClick={dismissOnboarding}
                    className="px-5 py-2.5 rounded-lg bg-[var(--success)] text-black text-xs font-black uppercase tracking-wider hover:opacity-95 shadow-[0_0_15px_rgba(63,185,80,0.4)]"
                  >
                    START INVESTIGATION ✓
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── FINAL ACCUSATION MODAL ─── */}
      {accuseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[rgba(20,24,32,0.98)] border-2 border-[var(--accent-primary)] rounded-xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 font-mono">
            <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
              <div className="text-base font-bold text-white uppercase flex items-center gap-2">
                <ShieldAlert size={20} className="text-[var(--accent-primary)]" />
                Issue Formal Accusation Warrant
              </div>
              <button 
                onClick={() => setAccuseModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Filing a warrant concludes the investigation if correct. Incorrect accusations earn no points; you can continue investigating and try again.
            </p>

            <div>
              <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">
                Select Prime Culprit:
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                {suspects.map(s => {
                  const isElim = eliminatedSuspectIds.includes(s.id);
                  const isSelected = selectedAccusedId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedAccusedId(s.id)}
                      className={`p-3 rounded-lg border text-left flex items-center justify-between text-xs transition-all ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[rgba(0,255,204,0.15)] text-white'
                          : isElim
                          ? 'border-gray-800 bg-gray-900/50 text-gray-500 line-through'
                          : 'border-[var(--border-subtle)] bg-[rgba(10,14,20,0.8)] text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <div>
                        <span className="font-bold">[{s.id}] {s.name}</span> — {s.role}
                      </div>
                      {isElim && <span className="text-[10px] text-[var(--error)] font-bold">EXONERATED</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setAccuseModalOpen(false)}
                className="px-4 py-2 border border-gray-700 rounded-lg text-xs font-bold text-gray-400 hover:text-white"
              >
                CANCEL
              </button>
              <button
                onClick={handleFinalAccusation}
                disabled={!selectedAccusedId || loading}
                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider ${
                  !selectedAccusedId || loading
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-[var(--accent-primary)] text-black hover:opacity-95'
                }`}
              >
                {loading ? 'FILING WARRANT...' : 'CONFIRM INDICTMENT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── POST-GAME LEARNING DIALOG ("WHAT YOU JUST DID") ─── */}
      {showLearningDialog && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[rgba(18,22,30,0.98)] border-2 border-[var(--success)] rounded-2xl p-7 max-w-xl w-full shadow-[0_0_50px_rgba(63,185,80,0.4)] flex flex-col gap-5 font-mono animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[rgba(63,185,80,0.2)] border border-[var(--success)] rounded-xl text-[var(--success)]">
                <Award size={32} />
              </div>
              <div>
                <div className="text-xs text-[var(--success)] font-bold tracking-widest uppercase">
                  CASE CLOSED // DEBRIEF
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                  WHAT YOU JUST DID
                </h2>
              </div>
            </div>

            <div className="text-sm text-gray-200 leading-relaxed flex flex-col gap-3">
              <p>
                You successfully uncovered the culprit in <strong className="text-white">{questionsUsed} questions</strong> with <strong className="text-[var(--success)]">{questionsRemaining} query tokens</strong> in reserve!
              </p>
              
              <div className="bg-[rgba(0,0,0,0.5)] border border-[rgba(255,255,255,0.1)] rounded-xl p-4 text-xs flex flex-col gap-2">
                <div className="font-bold text-[var(--accent-primary)] uppercase">
                  The Key Forensic Insight:
                </div>
                <p className="text-gray-300">
                  Questions that split the remaining possibilities into equal halves gave you the maximum amount of usable information.
                </p>
                <p className="text-gray-400">
                  If you had guessed individual suspect names one by one, it could have required up to 8 questions — depleting your budget entirely!
                </p>
              </div>

              {/* Optional Concept Badge */}
              <div className="pt-2 border-t border-[rgba(255,255,255,0.1)] text-[11px] text-gray-400">
                <span className="font-bold text-white uppercase">Behind The Scenes: </span>
                This core technique is called <span className="text-[var(--accent-primary)] font-bold">Binary Search & Information Gain</span>. Computer systems use this exact logic to search millions of database records in mere milliseconds.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowLearningDialog(false)}
                className="px-6 py-2.5 bg-[var(--success)] text-black font-black text-xs uppercase tracking-wider rounded-lg hover:opacity-90 transition-all"
              >
                RETURN TO TERMINAL
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
