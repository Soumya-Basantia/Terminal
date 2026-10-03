import React, { useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

/* ─── INTERFACES ─────────────────────────────────────────── */
interface BugHuntRule {
  id: string;
  label: string;
  description?: string;
  field: string;
  operator: '>=' | '<=' | '>' | '<' | '==' | '!=' | '=';
  threshold: number | string;
  output: string;
}

interface RegressionResult {
  input: Record<string, any>;
  expected: string;
  actual: string;
  passed: boolean;
  matchedRuleId: string | null;
  description?: string;
}

interface CaseConfig {
  title?: string;
  narrative?: string;
  system?: string;
  reproduction?: {
    input: Record<string, any>;
    expected: string;
    actual: string;
    description?: string;
  };
  rules: BugHuntRule[];
  defaultOutput?: string;
  allowedAttempts?: number;
  hintText?: string;
  revealText?: string;
  storyClue?: string;
  hypothesisOptions?: Array<{ id: string; label: string }>;
  allowedPatches?: Array<{
    ruleId: string;
    options: Array<{
      id: string;
      label: string;
      patch: Partial<BugHuntRule>;
    }>;
  }>;
}

interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (result: any) => void;
}

interface ExperimentLog {
  id: string;
  input: Record<string, any>;
  output: string;
  matchedRuleId: string | null;
  isReproduction: boolean;
  timestamp: string;
}

export default function BugHuntChallenge({ challenge, sessionCode, onSubmitted }: Props) {
  const config: CaseConfig = challenge.config || {};
  const rules = config.rules || [];
  const repro = config.reproduction || { input: {}, expected: 'PASS', actual: 'FAIL' };

  // Current primary input key (e.g. "attendance")
  const primaryField = Object.keys(repro.input)[0] || (rules[0]?.field) || 'input';
  const initialInputValue = repro.input[primaryField] !== undefined ? String(repro.input[primaryField]) : '0';

  // Game state
  const [testInputValue, setTestInputValue] = useState<string>(initialInputValue);
  const [experiments, setExperiments] = useState<ExperimentLog[]>([]);
  const [reproduced, setReproduced] = useState<boolean>(false);
  const [selectedHypothesis, setSelectedHypothesis] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CONSOLE' | 'RULES' | 'PATCH' | 'VERIFY'>('CONSOLE');

  // Patching state
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id || 'rule_1');
  const [patchOperator, setPatchOperator] = useState<string>('>=');
  const [patchThreshold, setPatchThreshold] = useState<string>('75');
  const [patchOutput, setPatchOutput] = useState<string>('ELIGIBLE');

  // Verification & submission state
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isSolved, setIsSolved] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(1);
  const [lastMatchedRuleId, setLastMatchedRuleId] = useState<string | null>(null);

  // Initialize patch controls when rule changes
  useEffect(() => {
    const targetRule = rules.find(r => r.id === selectedRuleId);
    if (targetRule) {
      setPatchOperator(targetRule.operator || '>=');
      setPatchThreshold(String(targetRule.threshold ?? '75'));
      setPatchOutput(targetRule.output || 'ELIGIBLE');
    }
  }, [selectedRuleId, rules]);

  // Local helper to evaluate rules if offline
  const evaluateLocally = useCallback((inputObj: Record<string, any>) => {
    for (const rule of rules) {
      const val = Number(inputObj[rule.field]);
      const thresh = Number(rule.threshold);
      let matches = false;
      switch (rule.operator) {
        case '>=': matches = val >= thresh; break;
        case '<=': matches = val <= thresh; break;
        case '>': matches = val > thresh; break;
        case '<': matches = val < thresh; break;
        case '==':
        case '=': matches = val === thresh; break;
        case '!=': matches = val !== thresh; break;
        default: matches = false;
      }
      if (matches) {
        return { output: rule.output, matchedRuleId: rule.id };
      }
    }
    return { output: config.defaultOutput || 'UNKNOWN', matchedRuleId: null };
  }, [rules, config.defaultOutput]);

  // Run Test Console experiment
  const runTestConsole = async () => {
    const inputObj = { [primaryField]: Number(testInputValue) || testInputValue };
    let output = '';
    let matchedRuleId: string | null = null;
    let isRepro = false;

    try {
      const res = await api.post(`/sessions/${sessionCode}/experiment`, {
        challengeId: challenge.id,
        input: inputObj,
      });
      output = res.data.output;
      matchedRuleId = res.data.matchedRuleId;
      isRepro = Boolean(res.data.isReproduction);
    } catch {
      // Local fallback
      const local = evaluateLocally(inputObj);
      output = local.output;
      matchedRuleId = local.matchedRuleId;
      if (
        String(inputObj[primaryField]) === String(repro.input[primaryField]) &&
        String(output).trim().toLowerCase() === String(repro.actual).trim().toLowerCase()
      ) {
        isRepro = true;
      }
    }

    setLastMatchedRuleId(matchedRuleId);
    if (isRepro) {
      setReproduced(true);
    }

    const newLog: ExperimentLog = {
      id: String(Date.now()),
      input: inputObj,
      output,
      matchedRuleId,
      isReproduction: isRepro,
      timestamp: new Date().toLocaleTimeString(),
    };

    setExperiments(prev => [newLog, ...prev.slice(0, 9)]);
  };

  // Submit Patch & Run Server Regression Tests
  const handleApplyPatch = async () => {
    setIsVerifying(true);
    setVerificationResult(null);

    const patchPayload = {
      action: 'PATCH_AND_VERIFY',
      hypothesis: selectedHypothesis,
      patchedRuleId: selectedRuleId,
      patch: {
        operator: patchOperator,
        threshold: isNaN(Number(patchThreshold)) ? patchThreshold : Number(patchThreshold),
        output: patchOutput,
      },
      reproduced,
      experimentsRun: experiments.length,
      attempts,
    };

    try {
      const res = await api.post('/sessions/active/submit', {
        answer: patchPayload,
      });

      const data = res.data;
      setVerificationResult(data.regressionResult || data.executionTrace);

      if (data.isCorrect) {
        setIsSolved(true);
        setActiveTab('VERIFY');
        if (onSubmitted) {
          onSubmitted({
            isCorrect: true,
            pointsAwarded: data.pointsAwarded,
            regressionResult: data.regressionResult,
          });
        }
      } else {
        setAttempts(prev => prev + 1);
        setActiveTab('VERIFY');
      }
    } catch (err: any) {
      console.error('Patch submission error:', err);
      // Construct fallback educational feedback
      setVerificationResult({
        allPassed: false,
        passedCount: 0,
        totalCount: 4,
        results: [
          {
            input: repro.input,
            expected: repro.expected,
            actual: repro.actual,
            passed: false,
            description: 'Failed to pass baseline verification tests.',
          }
        ]
      });
      setActiveTab('VERIFY');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{
      maxWidth: 1000,
      margin: '0 auto',
      padding: '24px 16px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans, sans-serif)',
    }}>
      {/* ─── CASE HEADER ─── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'rgba(255, 180, 0, 0.15)',
              color: 'var(--warning)',
              border: '1px solid rgba(255, 180, 0, 0.4)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}>
              INCIDENT FILE
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {config.system || 'Core System Architecture'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {reproduced && (
              <span style={{
                background: 'rgba(63, 185, 80, 0.15)',
                color: 'var(--success)',
                border: '1px solid rgba(63, 185, 80, 0.4)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
              }}>
                ✓ BUG REPRODUCED (+10% BONUS)
              </span>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Attempt {attempts} / {config.allowedAttempts || 5}
            </span>
          </div>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '8px 0', letterSpacing: '-0.02em' }}>
          {config.title || challenge.prompt || 'CASE FILE: MALFUNCTION INVESTIGATION'}
        </h1>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '8px 0 16px' }}>
          {config.narrative || challenge.prompt}
        </p>

        {/* ─── MALFUNCTION SYMPTOM BOX ─── */}
        <div style={{
          background: 'rgba(248, 81, 73, 0.08)',
          border: '1px solid rgba(248, 81, 73, 0.25)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              FAULT INPUT
            </div>
            <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-primary)', marginTop: 2 }}>
              {Object.entries(repro.input).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(', ') || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              EXPECTED BEHAVIOR
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>
              {repro.expected}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              ACTUAL SYSTEM OUTPUT
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--error)', marginTop: 2 }}>
              {repro.actual} (MALFUNCTION)
            </div>
          </div>
        </div>
      </div>

      {/* ─── WORKSTATION NAVIGATION TABS ─── */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20,
        paddingBottom: 2,
      }}>
        {[
          { key: 'CONSOLE', label: '1. TEST CONSOLE & REPRODUCE' },
          { key: 'RULES', label: '2. INVESTIGATE SYSTEM RULES' },
          { key: 'PATCH', label: '3. PATCH WORKBENCH' },
          { key: 'VERIFY', label: '4. VERIFICATION SUITE' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 16px',
              fontSize: 12,
              fontWeight: 800,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              background: activeTab === tab.key ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: TEST CONSOLE ─── */}
      {activeTab === 'CONSOLE' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Input Console */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              🧪 EXPERIMENTAL TEST CONSOLE
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Enter test values into the system to observe how the active logic behaves.
              Try reproducing the incident input to confirm the fault.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-muted)' }}>
                {primaryField.toUpperCase()} VALUE
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  value={testInputValue}
                  onChange={(e) => setTestInputValue(e.target.value)}
                  placeholder="e.g. 72"
                  style={{
                    flex: 1,
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                />
                <button
                  onClick={runTestConsole}
                  style={{
                    background: 'var(--accent-primary)',
                    color: '#000',
                    fontWeight: 800,
                    border: 'none',
                    borderRadius: 8,
                    padding: '0 20px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  RUN TEST
                </button>
              </div>
            </div>

            {/* Quick Test Presets */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quick Inputs:</span>
              {[repro.input[primaryField] ?? 72, 85, 50, 49, 0].map((val, idx) => (
                <button
                  key={idx}
                  onClick={() => setTestInputValue(String(val))}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                  }}
                >
                  {val}
                </button>
              ))}
            </div>

            {/* Hypothesis Selection Callout */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                FORM YOUR HYPOTHESIS (+15% BONUS)
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Which component or rule do you suspect is causing this defect?
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                {rules.map(r => (
                  <label
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: selectedHypothesis === r.id ? 'rgba(0, 212, 170, 0.1)' : 'var(--bg-base)',
                      border: `1px solid ${selectedHypothesis === r.id ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <input
                      type="radio"
                      name="hypothesis"
                      value={r.id}
                      checked={selectedHypothesis === r.id}
                      onChange={() => setSelectedHypothesis(r.id)}
                    />
                    <span><strong>{r.label}:</strong> {r.description || `${r.field} ${r.operator} ${r.threshold} → ${r.output}`}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Experiment Log */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 20,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📋 EXPERIMENT LOG ({experiments.length})</span>
              {reproduced && <span style={{ color: 'var(--success)', fontSize: 12 }}>REPRODUCED ✓</span>}
            </h3>

            {experiments.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-muted)',
                fontSize: 13,
                fontFamily: 'monospace',
              }}>
                NO EXPERIMENTS RUN YET.
                <br />
                ENTER AN INPUT ON THE LEFT AND CLICK [RUN TEST].
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                {experiments.map((exp) => (
                  <div
                    key={exp.id}
                    style={{
                      background: exp.isReproduction ? 'rgba(248, 81, 73, 0.1)' : 'var(--bg-base)',
                      border: `1px solid ${exp.isReproduction ? 'var(--error)' : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                        INPUT: {JSON.stringify(exp.input)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Matched: {exp.matchedRuleId ? exp.matchedRuleId.toUpperCase() : 'DEFAULT'} · {exp.timestamp}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: exp.isReproduction ? 'var(--error)' : 'var(--accent-primary)',
                      }}>
                        {exp.output}
                      </div>
                      {exp.isReproduction && (
                        <span style={{ fontSize: 10, color: 'var(--error)', fontWeight: 800 }}>
                          BUG REPRODUCED
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: SYSTEM RULES ─── */}
      {activeTab === 'RULES' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            📖 SYSTEM SPECIFICATION & RULEBOOK
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Inspect the active decision rules evaluated by the system.
            Rules evaluate sequentially from top to bottom.
          </p>

          <div style={{ display: 'grid', gap: 14 }}>
            {rules.map((rule, idx) => {
              const wasMatched = lastMatchedRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  style={{
                    background: wasMatched ? 'rgba(0, 212, 170, 0.08)' : 'var(--bg-base)',
                    border: `1px solid ${wasMatched ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 10,
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        background: 'var(--bg-elevated)',
                        color: 'var(--accent-primary)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 800,
                      }}>
                        #{idx + 1} {rule.label}
                      </span>
                      {wasMatched && (
                        <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700 }}>
                          ↳ LAST MATCHED BY SENSOR
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, margin: '8px 0 4px' }}>
                      {rule.description || `When ${rule.field} ${rule.operator} ${rule.threshold}`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      CONDITION: ({rule.field} {rule.operator} {rule.threshold}) → OUTPUT: "{rule.output}"
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedRuleId(rule.id);
                      setActiveTab('PATCH');
                    }}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    PATCH THIS RULE 🛠️
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: PATCH WORKBENCH ─── */}
      {activeTab === 'PATCH' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            🛠️ LOGICAL PATCH WORKBENCH
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Select the rule you want to repair and adjust its logical parameters.
            Your patch will be stress-tested against a regression test suite before production deployment.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Rule Selector */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                RULE TO PATCH
              </label>
              <select
                value={selectedRuleId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              >
                {rules.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.field} {r.operator} {r.threshold})
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Selector */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                OPERATOR
              </label>
              <select
                value={patchOperator}
                onChange={(e) => setPatchOperator(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              >
                <option value=">=">&gt;= (Greater Than or Equal)</option>
                <option value=">">&gt; (Strictly Greater Than)</option>
                <option value="<=">&lt;= (Less Than or Equal)</option>
                <option value="<">&lt; (Strictly Less Than)</option>
                <option value="==">== (Exact Equality)</option>
                <option value="!=">!= (Not Equal)</option>
              </select>
            </div>

            {/* Threshold Adjuster */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                THRESHOLD VALUE
              </label>
              <input
                type="text"
                value={patchThreshold}
                onChange={(e) => setPatchThreshold(e.target.value)}
                placeholder="75"
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            </div>

            {/* Output Selector */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                RULE OUTPUT
              </label>
              <input
                type="text"
                value={patchOutput}
                onChange={(e) => setPatchOutput(e.target.value)}
                placeholder="ELIGIBLE"
                style={{
                  width: '100%',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          {/* Patch Preview Banner */}
          <div style={{
            background: 'rgba(0, 212, 170, 0.08)',
            border: '1px dashed var(--accent-primary)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                PATCH SUMMARY PREVIEW
              </div>
              <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, marginTop: 4 }}>
                {selectedRuleId.toUpperCase()}: IF {primaryField} {patchOperator} {patchThreshold} → "{patchOutput}"
              </div>
            </div>

            <button
              onClick={handleApplyPatch}
              disabled={isVerifying || isSolved}
              style={{
                background: isSolved ? 'var(--success)' : 'var(--accent-primary)',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 900,
                fontFamily: 'monospace',
                cursor: isVerifying || isSolved ? 'not-allowed' : 'pointer',
                opacity: isVerifying ? 0.6 : 1,
              }}
            >
              {isVerifying ? 'VERIFYING...' : isSolved ? 'SYSTEM RESTORED ✓' : 'APPLY PATCH & VERIFY 🚀'}
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 4: VERIFICATION SUITE ─── */}
      {activeTab === 'VERIFY' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
            🧪 REGRESSION VERIFICATION SUITE
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Every patch must survive a battery of known production edge-cases to ensure no regressions were introduced.
          </p>

          {!verificationResult ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              NO REGRESSION RUN RECORDED YET.
              <br />
              GO TO [3. PATCH WORKBENCH] AND CLICK [APPLY PATCH & VERIFY].
            </div>
          ) : (
            <div>
              {/* Verdict Header Banner */}
              <div style={{
                background: verificationResult.allPassed ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                border: `1px solid ${verificationResult.allPassed ? 'var(--success)' : 'var(--error)'}`,
                borderRadius: 10,
                padding: 16,
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: verificationResult.allPassed ? 'var(--success)' : 'var(--error)',
                  }}>
                    {verificationResult.allPassed ? 'SYSTEM VERIFIED — BUG SQUASHED ✓' : 'REGRESSION DETECTED ❌'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {verificationResult.passedCount} / {verificationResult.totalCount} TEST CASES PASSED
                  </div>
                </div>

                {verificationResult.allPassed && config.storyClue && (
                  <div style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    color: 'var(--accent-primary)',
                    maxWidth: 320,
                  }}>
                    🔍 <strong>STORY CLUE:</strong> {config.storyClue}
                  </div>
                )}
              </div>

              {/* Individual Test Cases */}
              <div style={{ display: 'grid', gap: 10 }}>
                {verificationResult.results?.map((res: RegressionResult, i: number) => (
                  <div
                    key={i}
                    style={{
                      background: res.passed ? 'rgba(63, 185, 80, 0.05)' : 'rgba(248, 81, 73, 0.08)',
                      border: `1px solid ${res.passed ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.4)'}`,
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
                        TEST #{i + 1}: INPUT {JSON.stringify(res.input)}
                      </div>
                      {res.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {res.description}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      <div style={{ fontSize: 12 }}>
                        Expected: <strong>{res.expected}</strong> | Received: <strong>{res.actual}</strong>
                      </div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: res.passed ? 'var(--success)' : 'var(--error)',
                        marginTop: 2,
                      }}>
                        {res.passed ? 'PASS ✓' : 'REGRESSION FAIL ❌'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!verificationResult.allPassed && (
                <div style={{ marginTop: 20, textAlign: 'center' }}>
                  <button
                    onClick={() => setActiveTab('PATCH')}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--accent-primary)',
                      padding: '10px 20px',
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ← RETURN TO PATCH WORKBENCH & ADJUST FIX
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
