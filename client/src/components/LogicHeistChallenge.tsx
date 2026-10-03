import React, { useState, useCallback, useEffect, useRef } from 'react';
import api from '../lib/api';

/* ─── TYPES ─────────────────────────────────────────────── */
interface Block {
  id: number;
  label: string;
  operation: string;
  variable?: string;
  value?: number;
  loopCount?: number;
  isDecoy?: boolean;
  condition?: {
    variable: string;
    operator: string;
    value: number;
  };
  trueBranch?: {
    label: string;
    operation: string;
    variable: string;
    value: number;
  };
  falseBranch?: {
    label: string;
    operation: string;
    variable: string;
    value: number;
  };
}

interface VaultConfig {
  vault?: number;
  narrative?: string;
  initialState: Record<string, number>;
  targetState: Record<string, number>;
  blocks: Block[];
  hintText?: string;
  revealText?: string;
  difficulty?: string;
  concepts?: string[];
  allowedAttempts?: number;
}

interface LoopIteration {
  iteration: number;
  stateBefore: Record<string, number>;
  stateAfter: Record<string, number>;
}

interface TraceStep {
  blockId: number;
  label: string;
  stateBefore: Record<string, number>;
  stateAfter: Record<string, number>;
  iterations?: LoopIteration[];
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
}

interface Props {
  challenge: any;
  sessionCode: string;
  onSubmitted?: (result: any) => void;
}

/* ─── BLOCK CARD ──────────────────────────────────────────── */
function BlockCard({
  block,
  isSelected,
  onClick,
  disabled,
  index,
}: {
  block: Block;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
  index?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 6,
        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
        background: isSelected
          ? 'rgba(0,255,204,0.08)'
          : 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontWeight: 600,
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s ease',
        textAlign: 'left',
        width: '100%',
        position: 'relative' as const,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          background: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
          color: isSelected ? 'var(--bg-base)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {index !== undefined ? index + 1 : block.id}
      </span>
      {block.operation === 'IF' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{block.label}</span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(255,180,0,0.15)',
                color: 'var(--warning)',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              🔀 DECISION
            </span>
          </div>
          {block.condition && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 12, marginTop: 2 }}>
              <span>IF {block.condition.variable} {block.condition.operator} {block.condition.value}</span>
              {block.trueBranch && <span style={{ color: 'var(--success)' }}>✓ {block.trueBranch.label}</span>}
              {block.falseBranch && <span style={{ color: 'var(--accent-primary)' }}>✗ {block.falseBranch.label}</span>}
            </div>
          )}
        </div>
      ) : (
        <>
          <span style={{ flex: 1 }}>{block.label}</span>
          {block.operation === 'LOOP' && (
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(0,255,204,0.15)',
                color: 'var(--accent-primary)',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              🔁 REPEAT ×{block.loopCount || 3}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/* ─── EXECUTION TRACE DISPLAY ─────────────────────────────── */
function ExecutionTrace({
  steps,
  initialState,
  targetState,
  isCorrect,
}: {
  steps: TraceStep[];
  initialState: Record<string, number>;
  targetState: Record<string, number>;
  isCorrect: boolean;
}) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    setVisibleSteps(0);
    const interval = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev >= steps.length + 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [steps]);

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: 16,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.8,
        maxHeight: 280,
        overflowY: 'auto',
      }}
    >
      <div style={{ color: 'var(--accent-primary)', fontWeight: 700, marginBottom: 8 }}>
        {'>'} BREACH INITIATED...
      </div>

      {/* Initial state */}
      {visibleSteps >= 1 && (
        <div style={{ color: 'var(--text-secondary)', marginBottom: 6, paddingLeft: 16 }}>
          START ▸{' '}
          {Object.entries(initialState).map(([k, v]) => (
            <span key={k}>
              {k} = {v}{' '}
            </span>
          ))}
        </div>
      )}

      {/* Steps */}
      {steps.map((step, i) =>
        visibleSteps >= i + 2 ? (
          <div
            key={i}
            style={{
              borderLeft: '2px solid var(--accent-primary)',
              paddingLeft: 14,
              marginLeft: 8,
              marginBottom: 6,
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <div style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>
              STEP {i + 1}: {step.label}
            </div>
            {step.branchTaken ? (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  ↳ SENSOR READ: {step.conditionEvaluated?.variable} = {step.conditionEvaluated?.actualValue}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: step.conditionEvaluated?.result ? 'var(--success)' : 'var(--warning)',
                    fontWeight: 700,
                  }}
                >
                  ↳ CHECK: {step.conditionEvaluated?.variable} {step.conditionEvaluated?.operator} {step.conditionEvaluated?.value} →{' '}
                  {step.conditionEvaluated?.result ? 'TRUE' : 'FALSE'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600 }}>
                  ↳ BRANCH: {step.branchTaken === 'TRUE' ? '✓ TRUE PATH' : '✗ FALSE PATH'} ({step.executedAction?.label})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  ↳ {step.executedAction?.variable}:{' '}
                  <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>
                    {step.stateBefore[step.executedAction?.variable || ''] ?? '∅'}
                  </span>
                  {' → '}
                  <strong style={{ color: 'var(--accent-primary)' }}>
                    {step.stateAfter[step.executedAction?.variable || '']}
                  </strong>
                </div>
              </div>
            ) : step.iterations && step.iterations.length > 0 ? (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 8 }}>
                {step.iterations.map((iter) => (
                  <div
                    key={iter.iteration}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 11,
                      color: 'var(--accent-primary)',
                      background: 'rgba(0,255,204,0.04)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      borderLeft: '2px solid rgba(0,255,204,0.4)',
                    }}
                  >
                    <span style={{ fontWeight: 700, opacity: 0.8 }}>
                      ↳ CYCLE {iter.iteration}/{step.iterations!.length}:
                    </span>
                    {Object.entries(iter.stateAfter).map(([k, v]) => {
                      const before = iter.stateBefore[k];
                      return (
                        <span key={k}>
                          {k}: <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{before ?? '∅'}</span> → <strong>{v}</strong>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                {Object.entries(step.stateAfter).map(([k, v]) => {
                  const before = step.stateBefore[k];
                  const changed = before !== v;
                  return (
                    <span key={k} style={{ marginRight: 12 }}>
                      {k}:{' '}
                      {changed ? (
                        <>
                          <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{before ?? '∅'}</span>
                          {' → '}
                          <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{v}</span>
                        </>
                      ) : (
                        <span>{v}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ) : null
      )}

      {/* Final result */}
      {visibleSteps >= steps.length + 2 && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 6,
            background: isCorrect ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--error)'}`,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            FINAL STATE:{' '}
            {steps.length > 0
              ? Object.entries(steps[steps.length - 1].stateAfter).map(([k, v]) => `${k} = ${v}`).join(', ')
              : Object.entries(initialState).map(([k, v]) => `${k} = ${v}`).join(', ')
            }
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>
            TARGET:     {Object.entries(targetState).map(([k, v]) => `${k} = ${v}`).join(', ')}
          </div>
          <div
            style={{
              marginTop: 8,
              fontWeight: 800,
              fontSize: 14,
              color: isCorrect ? 'var(--success)' : 'var(--error)',
            }}
          >
            {isCorrect ? '✓ VAULT OPEN' : '✗ ACCESS DENIED — State mismatch'}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
export default function LogicHeistChallenge({ challenge, sessionCode, onSubmitted }: Props) {
  const config: VaultConfig = challenge.config || {};
  const blocks = config.blocks || [];
  const initialState = config.initialState || {};
  const targetState = config.targetState || {};
  const maxAttempts = config.allowedAttempts || 3;

  const [sequence, setSequence] = useState<number[]>([]);
  const [traceSteps, setTraceSteps] = useState<TraceStep[] | null>(null);
  const [traceCorrect, setTraceCorrect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; pointsAwarded: number } | null>(null);
  const [revealText, setRevealText] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [dryRunActive, setDryRunActive] = useState(false);

  // Reset when challenge changes
  useEffect(() => {
    setSequence([]);
    setTraceSteps(null);
    setTraceCorrect(false);
    setSubmitting(false);
    setSubmitted(false);
    setResult(null);
    setRevealText(null);
    setAttempts(0);
    setHintsUsed(0);
    setShowHint(false);
    setDryRunActive(false);
  }, [challenge.id]);

  const addBlock = useCallback(
    (blockId: number) => {
      if (submitted) return;
      setSequence((prev) => [...prev, blockId]);
      setTraceSteps(null);
    },
    [submitted]
  );

  const removeBlock = useCallback(
    (index: number) => {
      if (submitted) return;
      setSequence((prev) => prev.filter((_, i) => i !== index));
      setTraceSteps(null);
    },
    [submitted]
  );

  const clearSequence = useCallback(() => {
    if (submitted) return;
    setSequence([]);
    setTraceSteps(null);
  }, [submitted]);

  // Client-side dry run (preview only, no submission)
  const executeLocally = useCallback(() => {
    const state: Record<string, number> = { ...initialState };
    const steps: TraceStep[] = [];
    const blockMap = new Map(blocks.map((b) => [b.id, b]));

    for (const blockId of sequence) {
      const block = blockMap.get(blockId);
      if (!block) continue;
      const before = { ...state };

      if (block.operation === 'IF') {
        const cond = block.condition || { variable: '', operator: '>', value: 0 };
        const actualVal = state[cond.variable] ?? 0;
        let condResult = false;
        const targetVal = Number(cond.value);
        switch (cond.operator) {
          case '>': condResult = actualVal > targetVal; break;
          case '<': condResult = actualVal < targetVal; break;
          case '>=': condResult = actualVal >= targetVal; break;
          case '<=': condResult = actualVal <= targetVal; break;
          case '==':
          case '=': condResult = actualVal === targetVal; break;
          case '!=': condResult = actualVal !== targetVal; break;
        }

        const branchTaken = condResult ? 'TRUE' : 'FALSE';
        const actionToExecute = condResult ? block.trueBranch : block.falseBranch;

        let executedAction: any = undefined;
        if (actionToExecute) {
          const actVal = Number(actionToExecute.value);
          executedAction = {
            label: actionToExecute.label,
            operation: actionToExecute.operation,
            variable: actionToExecute.variable,
            value: actVal,
          };
          switch (actionToExecute.operation) {
            case 'SET': state[actionToExecute.variable] = actVal; break;
            case 'ADD': state[actionToExecute.variable] = (state[actionToExecute.variable] || 0) + actVal; break;
            case 'SUB': state[actionToExecute.variable] = (state[actionToExecute.variable] || 0) - actVal; break;
            case 'MUL': state[actionToExecute.variable] = (state[actionToExecute.variable] || 0) * actVal; break;
          }
        }

        steps.push({
          blockId,
          label: block.label,
          stateBefore: before,
          stateAfter: { ...state },
          branchTaken,
          conditionEvaluated: {
            variable: cond.variable,
            operator: cond.operator,
            value: targetVal,
            actualValue: actualVal,
            result: condResult,
          },
          executedAction,
        });
        continue;
      }

      if (!block.variable) continue;
      const vName = block.variable;
      const v = Number(block.value);
      let stepIterations: LoopIteration[] | undefined = undefined;
      switch (block.operation) {
        case 'SET':
          state[vName] = v;
          break;
        case 'ADD':
          state[vName] = (state[vName] || 0) + v;
          break;
        case 'SUB':
          state[vName] = (state[vName] || 0) - v;
          break;
        case 'MUL':
          state[vName] = (state[vName] || 0) * v;
          break;
        case 'LOOP': {
          const loopCount = Number(block.loopCount) || 0;
          const subOp = (block as any).subOperation || 'ADD';
          const loopIters: LoopIteration[] = [];
          for (let i = 1; i <= loopCount; i++) {
            const iterBefore = { ...state };
            if (subOp === 'SUB') {
              state[vName] = (state[vName] || 0) - v;
            } else if (subOp === 'MUL') {
              state[vName] = (state[vName] || 0) * v;
            } else {
              state[vName] = (state[vName] || 0) + v;
            }
            loopIters.push({
              iteration: i,
              stateBefore: iterBefore,
              stateAfter: { ...state },
            });
          }
          stepIterations = loopIters;
          break;
        }
      }
      steps.push({
        blockId,
        label: block.label,
        stateBefore: before,
        stateAfter: { ...state },
        iterations: stepIterations,
      });
    }

    const correct = Object.keys(targetState).every(
      (k) => state[k] === targetState[k]
    ) && Object.keys(state).length === Object.keys(targetState).length;

    setTraceSteps(steps);
    setTraceCorrect(correct);
    setDryRunActive(true);
  }, [sequence, initialState, targetState, blocks]);

  // BREACH — submit to server
  const handleBreach = useCallback(async () => {
    if (submitted || submitting || sequence.length === 0) return;
    setSubmitting(true);
    setAttempts((prev) => prev + 1);

    const payload = {
      answer: {
        sequence,
        finalState: {}, // Server will recompute; this is ignored
        attempts: attempts + 1,
        hintsUsed,
        blocksUsed: sequence.length,
        timeMs: 0,
      },
    };

    try {
      const token = JSON.parse(localStorage.getItem('terminal_user') || '{}').token ||
                    JSON.parse(localStorage.getItem('terminal_player') || '{}').token;
      const res = await api.post('/sessions/active/submit', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data;
      setResult({ isCorrect: data.isCorrect, pointsAwarded: data.pointsAwarded });

      if (data.executionTrace) {
        setTraceSteps(data.executionTrace.steps);
        setTraceCorrect(data.isCorrect);
      }

      if (data.isCorrect) {
        setSubmitted(true);
        // Show concept reveal if vault opens
        if (config.revealText) {
          setTimeout(() => setRevealText(config.revealText!), 2000);
        }
      }

      onSubmitted?.(data);
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.error === 'Already submitted') {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }, [sequence, submitted, submitting, attempts, hintsUsed, config, onSubmitted]);

  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 640,
        margin: '0 auto',
        padding: '16px 20px',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 8,
          padding: '14px 18px',
          boxShadow: '0 0 12px rgba(0,255,204,0.08)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--accent-primary)',
            letterSpacing: '0.1em',
            marginBottom: 6,
          }}
        >
          OPERATION NIGHTFALL — VAULT {config.vault || 1}
        </div>
        {config.narrative && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
            {config.narrative}
          </div>
        )}
        <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>CURRENT: </span>
            {Object.entries(initialState).map(([k, v]) => (
              <span key={k} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {k} = {v}{' '}
              </span>
            ))}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>TARGET: </span>
            {Object.entries(targetState).map(([k, v]) => (
              <span key={k} style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>
                {k} = {v}{' '}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATUS BAR ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-muted)',
          padding: '0 4px',
        }}
      >
        <span>
          Attempts: {attempts}/{maxAttempts}
        </span>
        <span>{challenge.points} PTS</span>
      </div>

      {/* ── AVAILABLE BLOCKS ── */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            marginBottom: 8,
          }}
        >
          AVAILABLE ACTIONS
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              isSelected={false}
              onClick={() => addBlock(block.id)}
              disabled={submitted}
            />
          ))}
        </div>
      </div>

      {/* ── MAGNETIC DOCK (SEQUENCE BUILDER) ── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 8,
          padding: '14px 16px',
          boxShadow: sequence.length > 0 ? '0 0 16px rgba(0,255,204,0.12)' : 'none',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: sequence.length > 0 ? 'var(--accent-primary)' : 'var(--text-muted)',
            letterSpacing: '0.12em',
            marginBottom: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧲 MAGNETIC DOCK</span>
            <span style={{ opacity: 0.6 }}>· {sequence.length} BLOCKS SNAPPED</span>
          </span>
          {sequence.length > 0 && !submitted && (
            <button
              onClick={clearSequence}
              style={{
                fontSize: 10,
                color: 'var(--error)',
                background: 'rgba(255,51,102,0.1)',
                border: '1px solid rgba(255,51,102,0.3)',
                borderRadius: 4,
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
              }}
            >
              CLEAR DOCK
            </button>
          )}
        </div>

        {sequence.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              border: '2px dashed var(--border-subtle)',
              borderRadius: 6,
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 6 }}>⚡</div>
            <div>MAGNETIC DOCK READY</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
              Tap available actions above to snap them into the execution sequence
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {sequence.map((blockId, i) => {
              const block = blockMap.get(blockId);
              if (!block) return null;
              return (
                <div key={`seq-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: 'var(--accent-primary)',
                      fontFamily: 'var(--font-mono)',
                      width: 20,
                      textAlign: 'center',
                    }}
                  >
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <BlockCard
                      block={block}
                      isSelected={true}
                      index={i}
                      onClick={() => removeBlock(i)}
                      disabled={submitted}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ACTION BUTTONS ── */}
      {!submitted && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={executeLocally}
            disabled={sequence.length === 0 || submitting}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              cursor: sequence.length === 0 ? 'not-allowed' : 'pointer',
              opacity: sequence.length === 0 ? 0.4 : 1,
            }}
          >
            ▶ DRY RUN
          </button>
          <button
            onClick={handleBreach}
            disabled={sequence.length === 0 || submitting}
            style={{
              flex: 2,
              padding: '10px 0',
              borderRadius: 6,
              border: '1px solid var(--accent-primary)',
              background: submitting
                ? 'var(--bg-elevated)'
                : 'rgba(0,255,204,0.1)',
              color: 'var(--accent-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 800,
              cursor: sequence.length === 0 ? 'not-allowed' : 'pointer',
              opacity: sequence.length === 0 ? 0.4 : 1,
              boxShadow: sequence.length > 0 ? '0 0 12px rgba(0,255,204,0.15)' : 'none',
              letterSpacing: '0.05em',
            }}
          >
            {submitting ? 'EXECUTING...' : '⚡ BREACH'}
          </button>
        </div>
      )}

      {/* ── HINT ── */}
      {config.hintText && !submitted && (
        <div style={{ textAlign: 'center' }}>
          {!showHint ? (
            <button
              onClick={() => {
                setShowHint(true);
                setHintsUsed((h) => h + 1);
              }}
              style={{
                fontSize: 11,
                color: 'var(--warning)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                textDecoration: 'underline',
              }}
            >
              Request Hint (−20% score)
            </button>
          ) : (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(255,180,0,0.08)',
                border: '1px solid var(--warning)',
                fontSize: 12,
                color: 'var(--warning)',
              }}
            >
              💡 {config.hintText}
            </div>
          )}
        </div>
      )}

      {/* ── EXECUTION TRACE ── */}
      {traceSteps && (
        <ExecutionTrace
          steps={traceSteps}
          initialState={initialState}
          targetState={targetState}
          isCorrect={traceCorrect}
        />
      )}

      {/* ── RESULT ── */}
      {result && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: result.isCorrect ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${result.isCorrect ? 'var(--success)' : 'var(--error)'}`,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: result.isCorrect ? 'var(--success)' : 'var(--error)',
              marginBottom: 4,
            }}
          >
            {result.isCorrect ? `✓ VAULT OPEN (+${result.pointsAwarded} XP)` : '✗ ACCESS DENIED'}
          </div>
          {!result.isCorrect && attempts < maxAttempts && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Adjust your sequence and try again.
            </div>
          )}
        </div>
      )}

      {/* ── CONCEPT REVEAL ── */}
      {revealText && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 8,
            background: 'rgba(0,255,204,0.05)',
            border: '1px solid var(--accent-primary)',
            animation: 'fadeIn 0.5s ease',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent-primary)',
              letterSpacing: '0.1em',
              marginBottom: 6,
            }}
          >
            CONCEPT UNLOCKED
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
            {revealText}
          </div>
          {config.concepts && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              {config.concepts.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(0,255,204,0.12)',
                    color: 'var(--accent-primary)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
