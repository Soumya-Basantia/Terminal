import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Game, Challenge, ChallengeType, Difficulty } from '../types';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Copy,
  Save, Rocket, GripVertical, Check, Zap, Clock, HelpCircle, Play, AlertCircle, X
} from 'lucide-react';
import { BrutalistPanel, BrutalistButton } from '../components/ui/Brutalist';
import { TerminalBackButton } from '../components/ui/TerminalBackButton';
import { TerminalModal, TerminalButton } from '../components/ui';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function normalizeChallengeType(
  targetType: ChallengeType,
  current: Challenge
): Partial<Challenge> {
  const isCurrentTF = current.type === 'TRUE_FALSE' ||
    (Array.isArray(current.options) &&
     current.options.length === 2 &&
     current.options[0]?.toLowerCase() === 'true' &&
     current.options[1]?.toLowerCase() === 'false');

  if (targetType === 'TRUE_FALSE') {
    let answer = 'True';
    if (typeof current.answer === 'string' && current.answer.toLowerCase() === 'false') {
      answer = 'False';
    }
    return {
      type: 'TRUE_FALSE',
      options: ['True', 'False'],
      answer,
    };
  }

  // Target is SINGLE_CHOICE or MULTIPLE_CHOICE
  let newOptions: string[];
  if (isCurrentTF || !Array.isArray(current.options) || current.options.length < 2) {
    newOptions = ['', '', '', ''];
  } else {
    // Preserve existing options, ensure at least 4 options
    newOptions = [...current.options];
    while (newOptions.length < 4) {
      newOptions.push('');
    }
  }

  if (targetType === 'SINGLE_CHOICE') {
    let singleAns = '';
    if (Array.isArray(current.answer)) {
      singleAns = current.answer[0] || '';
    } else if (typeof current.answer === 'string') {
      singleAns = current.answer;
    }
    // If coming from TF, clean up 'True'/'False'
    if (isCurrentTF && (singleAns.toLowerCase() === 'true' || singleAns.toLowerCase() === 'false')) {
      singleAns = '';
    }
    return {
      type: 'SINGLE_CHOICE',
      options: newOptions,
      answer: singleAns,
    };
  }

  if (targetType === 'MULTIPLE_CHOICE') {
    let multiAns: string[] = [];
    if (Array.isArray(current.answer)) {
      multiAns = current.answer.filter(a => typeof a === 'string' && a.trim() !== '');
    } else if (typeof current.answer === 'string' && current.answer.trim() !== '') {
      multiAns = [current.answer.trim()];
    }
    if (isCurrentTF) {
      multiAns = [];
    }
    return {
      type: 'MULTIPLE_CHOICE',
      options: newOptions,
      answer: multiAns,
    };
  }

  return { type: targetType };
}

interface ChallengeEditorProps {
  challenge: Challenge;
  index: number;
  total: number;
  gameId: string;
  onUpdate: (c: Challenge) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDirtyChange?: (id: string, isDirty: boolean, saveFn: () => Promise<boolean>) => void;
}

function ChallengeEditor({
  challenge, index, total, gameId,
  onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown,
  onDirtyChange
}: ChallengeEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [local, setLocal] = useState<Challenge>(challenge);
  const localRef = useRef(local);
  localRef.current = local;
  const [hasChanges, setHasChanges] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasChanges) {
      setLocal(challenge);
    }
  }, [challenge, hasChanges]);

  useEffect(() => {
    onDirtyChange?.(challenge.id, hasChanges, save);
  }, [hasChanges, challenge.id]);

  function update(updates: Partial<Challenge>) {
    const updated = { ...local, ...updates };
    setLocal(updated);
    setHasChanges(true);
    setValidationError(null);
  }

  function handleTypeSwitch(targetType: ChallengeType) {
    if (local.type === targetType) return;
    const normalized = normalizeChallengeType(targetType, local);
    update(normalized);
  }

  function isOptionCorrect(opt: string, oi: number): boolean {
    const label = OPTION_LABELS[oi];
    const cleanOpt = opt.trim();
    if (local.type === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(local.answer)) return false;
      return local.answer.some(a => {
        if (!a || typeof a !== 'string') return false;
        const cleanA = a.trim();
        if (cleanOpt !== '' && cleanA.toLowerCase() === cleanOpt.toLowerCase()) return true;
        if (cleanA.toUpperCase() === label) {
          const matchingOther = (local.options || []).some((o, otherIdx) => otherIdx !== oi && o.trim() !== '' && o.trim().toUpperCase() === label);
          if (!matchingOther) return true;
        }
        return false;
      });
    }
    if (typeof local.answer !== 'string' || !local.answer.trim()) return false;
    const cleanAns = local.answer.trim();
    if (cleanOpt !== '' && cleanAns.toLowerCase() === cleanOpt.toLowerCase()) return true;
    if (cleanAns.toUpperCase() === label) {
      const matchingOther = (local.options || []).some((o, otherIdx) => otherIdx !== oi && o.trim() !== '' && o.trim().toUpperCase() === label);
      if (!matchingOther) return true;
    }
    return false;
  }

  function toggleOptionCorrect(opt: string, oi: number) {
    const targetId = opt.trim() !== '' ? opt.trim() : OPTION_LABELS[oi];
    if (local.type === 'MULTIPLE_CHOICE') {
      const current = Array.isArray(local.answer) ? [...local.answer] : (local.answer ? [local.answer] : []);
      const isCurrentlyCorrect = isOptionCorrect(opt, oi);
      if (isCurrentlyCorrect) {
        update({
          answer: current.filter(a => {
            if (!a || typeof a !== 'string') return false;
            const ca = a.trim();
            if (opt.trim() !== '' && ca.toLowerCase() === opt.trim().toLowerCase()) return false;
            if (ca.toUpperCase() === OPTION_LABELS[oi]) return false;
            return true;
          })
        });
      } else {
        update({ answer: [...current, targetId] });
      }
    } else {
      // SINGLE_CHOICE: exactly one answer selected
      update({ answer: targetId });
    }
  }

  function handleOptionTextChange(oi: number, newText: string) {
    const opts = [...(local.options || ['', '', '', ''])];
    const oldText = opts[oi] ?? '';
    opts[oi] = newText;

    if (local.type === 'SINGLE_CHOICE') {
      const isCurrentAns = isOptionCorrect(oldText, oi);
      if (isCurrentAns) {
        update({
          options: opts,
          answer: newText.trim() !== '' ? newText.trim() : OPTION_LABELS[oi]
        });
        return;
      }
    } else if (local.type === 'MULTIPLE_CHOICE') {
      if (Array.isArray(local.answer)) {
        const isCurrentAns = isOptionCorrect(oldText, oi);
        if (isCurrentAns) {
          const replacement = newText.trim() !== '' ? newText.trim() : OPTION_LABELS[oi];
          const oldTarget = oldText.trim() !== '' ? oldText.trim() : OPTION_LABELS[oi];
          const newAns = local.answer.map(a => {
            if (!a || typeof a !== 'string') return a;
            const ca = a.trim();
            if ((oldText.trim() !== '' && ca.toLowerCase() === oldText.trim().toLowerCase()) ||
                ca.toUpperCase() === OPTION_LABELS[oi] ||
                ca === oldTarget) {
              return replacement;
            }
            return a;
          });
          update({ options: opts, answer: newAns });
          return;
        }
      }
    }
    update({ options: opts });
  }

  function discardChanges() {
    setLocal({ ...challenge });
    setHasChanges(false);
    setValidationError(null);
  }

  async function save(): Promise<boolean> {
    const cur = localRef.current;
    setValidationError(null);
    if (!cur.prompt || cur.prompt.trim() === '') {
      setValidationError('Query parameters (prompt) are required.');
      return false;
    }

    if (cur.type === 'SINGLE_CHOICE') {
      const validOpts = (cur.options || []).filter(o => typeof o === 'string' && o.trim() !== '');
      if (validOpts.length < 2) {
        setValidationError('Single Choice requires at least 2 non-empty options.');
        return false;
      }
      if (!cur.answer || (Array.isArray(cur.answer) && cur.answer.length === 0)) {
        setValidationError('Single Choice requires exactly one correct answer selected.');
        return false;
      }
    } else if (cur.type === 'MULTIPLE_CHOICE') {
      const validOpts = (cur.options || []).filter(o => typeof o === 'string' && o.trim() !== '');
      if (validOpts.length < 2) {
        setValidationError('Multiple Choice requires at least 2 non-empty options.');
        return false;
      }
      if (!Array.isArray(cur.answer) || cur.answer.length === 0) {
        setValidationError('Multiple Choice requires at least one correct answer selected.');
        return false;
      }
    } else if (cur.type === 'TRUE_FALSE') {
      if (!cur.answer || (cur.answer !== 'True' && cur.answer !== 'False')) {
        setValidationError('True/False requires selecting True or False.');
        return false;
      }
    }

    setIsSaving(true);
    try {
      const { id, config, ...data } = cur as any;
      const res = await api.patch(`/games/${gameId}/challenges/${id}`, {
        ...data,
        options: cur.options,
        answer: cur.answer,
        explanation: cur.explanation,
      });
      onUpdate(res.data.challenge);
      setHasChanges(false);
      return true;
    } catch (err: any) {
      setValidationError(err.response?.data?.error || 'Failed to save module.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={`border-2 transition-colors ${isExpanded ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]' : 'border-[var(--border-brutal)] bg-[var(--bg-surface)]'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--bg-elevated)] select-none"
        onClick={() => {
          if (hasChanges && isExpanded) {
            if (!window.confirm('Discard unsaved changes to this protocol?')) {
              return;
            }
            discardChanges();
          }
          setIsExpanded(p => !p);
        }}
      >
        <div className="text-[var(--text-muted)] cursor-grab hover:text-white" onClick={e => e.stopPropagation()} title="Drag to reorder">
          <GripVertical size={16} />
        </div>
        <div className="w-8 h-8 flex items-center justify-center font-mono font-black text-lg border-2 border-[var(--border-brutal)] text-[var(--accent-primary)] bg-[var(--bg-base)] shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-bold text-sm" style={{ color: local.prompt ? 'white' : 'var(--text-muted)' }}>
            {local.prompt || 'CLICK TO CONFIGURE PROTOCOL...'}
          </p>
          <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-0.5">
            TYPE: <span className="text-[var(--accent-primary)]">{local.type.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="font-mono text-xs flex items-center gap-1 text-[var(--text-secondary)]">
            <Zap size={12} /> {local.points}PT
          </span>
          <span className="font-mono text-xs flex items-center gap-1 text-[var(--text-secondary)]">
            <Clock size={12} /> {local.timerSecs}S
          </span>
          {hasChanges && <span className="w-2.5 h-2.5 rounded-full bg-[var(--warning)] animate-pulse" title="Unsaved changes" />}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-4 border-t-2 border-[var(--border-brutal)] bg-[var(--bg-base)]" onClick={e => e.stopPropagation()}>
          {validationError && (
            <div className="mb-4 p-3 bg-red-950/60 border-2 border-[var(--error)] text-[var(--error)] text-xs font-mono font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{validationError}</span>
              </div>
              <button onClick={() => setValidationError(null)} className="text-[var(--error)] hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Question type selection */}
          <div className="mb-6">
            <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; PROTOCOL QUESTION TYPE</label>
            <div className="flex flex-wrap gap-2">
              {(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'] as ChallengeType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeSwitch(t)}
                  className={`px-3 py-1.5 font-mono text-xs font-bold uppercase border-2 transition-colors cursor-pointer ${
                    local.type === t
                      ? 'border-[var(--accent-primary)] bg-[rgba(0,212,170,0.15)] text-[var(--accent-primary)] shadow-[2px_2px_0px_#000]'
                      : 'border-[var(--border-brutal)] text-[var(--text-secondary)] hover:border-white hover:text-white bg-[var(--bg-surface)]'
                  }`}
                >
                  {t === 'SINGLE_CHOICE' ? '○ SINGLE CHOICE (1 ANSWER)' :
                   t === 'MULTIPLE_CHOICE' ? '☑ MULTIPLE CHOICE (1+ ANSWERS)' :
                   '● TRUE / FALSE'}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div className="mb-6">
            <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; QUERY PARAMETERS (QUESTION TEXT)</label>
            <textarea
              className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[80px]"
              placeholder="Enter question text or query prompt..."
              value={local.prompt}
              onChange={e => update({ prompt: e.target.value })}
            />
          </div>

          {/* Options Display */}
          {local.type !== 'TRUE_FALSE' ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block">
                  &gt; EXPECTED OUTPUTS ({local.type === 'SINGLE_CHOICE' ? 'SELECT EXACTLY ONE CORRECT' : 'SELECT ONE OR MORE CORRECT'})
                </label>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {local.type === 'SINGLE_CHOICE' ? 'RADIO: Clicking an option selects it exclusively' : 'CHECKBOX: Toggle individual options'}
                </span>
              </div>
              <div className="grid gap-3">
                {(local.options || ['', '', '', '']).map((opt, oi) => {
                  const isCorrect = isOptionCorrect(opt, oi);
                  return (
                    <div key={oi} className="flex gap-3 items-center">
                      <button
                        type="button"
                        role={local.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                        aria-checked={isCorrect}
                        onClick={() => toggleOptionCorrect(opt, oi)}
                        title={local.type === 'SINGLE_CHOICE' ? `Set ${OPTION_LABELS[oi]} as exclusive correct answer` : `Toggle ${OPTION_LABELS[oi]} as correct answer`}
                        className={`w-12 h-12 flex-shrink-0 flex items-center justify-center border-2 font-black font-mono transition-colors cursor-pointer ${
                          isCorrect
                            ? 'border-[var(--success)] bg-[rgba(63,185,80,0.18)] text-[var(--success)] shadow-[2px_2px_0px_#000]'
                            : 'border-[var(--border-brutal)] text-[var(--text-muted)] hover:border-[var(--text-secondary)] hover:text-white bg-[var(--bg-surface)]'
                        } ${local.type === 'SINGLE_CHOICE' ? 'rounded-full' : 'rounded-none'}`}
                      >
                        {local.type === 'SINGLE_CHOICE' ? (
                          <span className="text-base">{isCorrect ? '●' : '○'} <span className="text-xs">{OPTION_LABELS[oi]}</span></span>
                        ) : (
                          <span className="text-base">{isCorrect ? '☑' : '☐'} <span className="text-xs">{OPTION_LABELS[oi]}</span></span>
                        )}
                      </button>
                      <input
                        className="brutalist-input flex-1 p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none"
                        placeholder={`Output Vector ${OPTION_LABELS[oi]} text...`}
                        value={opt}
                        onChange={e => handleOptionTextChange(oi, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; BOOLEAN TARGET (EXACTLY ONE CORRECT)</label>
              <div className="flex gap-4">
                {['True', 'False'].map(v => {
                  const isSelected = local.answer === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => update({ answer: v, options: ['True', 'False'] })}
                      className={`flex-1 py-3.5 font-mono font-black text-sm uppercase border-2 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                        isSelected
                          ? 'border-[var(--success)] bg-[rgba(63,185,80,0.18)] text-[var(--success)] shadow-[3px_3px_0px_#000]'
                          : 'border-[var(--border-brutal)] text-[var(--text-secondary)] hover:border-white hover:text-white bg-[var(--bg-surface)]'
                      }`}
                    >
                      <span>{isSelected ? '●' : '○'}</span>
                      <span>{v}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Points + Timer */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; POINTS</label>
              <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" min={1} max={100} value={local.points} onChange={e => update({ points: Number(e.target.value) })} />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; TIME (S)</label>
              <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" min={5} max={300} value={local.timerSecs} onChange={e => update({ timerSecs: Number(e.target.value) })} />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; DIFF LEVEL</label>
              <select className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" value={local.difficulty} onChange={e => update({ difficulty: e.target.value as Difficulty })}>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; RESOLUTION LOG (EXPLANATION)</label>
            <input className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" placeholder="Context provided upon completion..." value={local.explanation || ''} onChange={e => update({ explanation: e.target.value })} />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-between items-center gap-3 mt-8 pt-4 border-t-2 border-[var(--border-brutal)]">
            <div className="flex gap-2">
              <button onClick={onMoveUp} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white disabled:opacity-30 cursor-pointer" disabled={index === 0} title="Move up">
                <ChevronUp size={16} />
              </button>
              <button onClick={onMoveDown} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white disabled:opacity-30 cursor-pointer" disabled={index === total - 1} title="Move down">
                <ChevronDown size={16} />
              </button>
              <button onClick={onDuplicate} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white cursor-pointer" title="Duplicate">
                <Copy size={16} />
              </button>
              <button onClick={onDelete} className="p-2 border-2 border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-white cursor-pointer" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
            {hasChanges && (
              <div className="flex items-center gap-2">
                <BrutalistButton onClick={discardChanges} variant="default" disabled={isSaving} className="flex items-center gap-1.5 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white">
                  DISCARD CHANGES
                </BrutalistButton>
                <BrutalistButton onClick={save} variant="primary" disabled={isSaving} className="flex items-center gap-2">
                  <Save size={16} /> {isSaving ? 'SAVING...' : 'SAVE MODULE'}
                </BrutalistButton>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DataHuntEditor({
  challenge, index, total, gameId,
  onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown
}: ChallengeEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [local, setLocal] = useState<Challenge>(challenge);
  const [hasChanges, setHasChanges] = useState(false);

  function update(updates: Partial<Challenge>) {
    const updated = { ...local, ...updates };
    setLocal(updated);
    setHasChanges(true);
  }

  async function save() {
    setIsSaving(true);
    try {
      const { id, ...data } = local;
      const res = await api.patch(`/games/${gameId}/challenges/${id}`, {
        ...data,
      });
      onUpdate(res.data.challenge);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={`border-2 transition-colors ${isExpanded ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]' : 'border-[var(--border-brutal)] bg-[var(--bg-surface)]'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--bg-elevated)]"
        onClick={() => setIsExpanded(p => !p)}
      >
        <div className="text-[var(--text-muted)] cursor-grab hover:text-white" onClick={e => e.stopPropagation()} title="Drag to reorder">
          <GripVertical size={16} />
        </div>
        <div className="w-8 h-8 flex items-center justify-center font-mono font-black text-lg border-2 border-[var(--border-brutal)] text-[var(--accent-primary)] bg-[var(--bg-base)]">
          {index + 1}
        </div>
        <p className="flex-1 truncate font-bold text-sm" style={{ color: local.prompt ? 'white' : 'var(--text-muted)' }}>
          {local.prompt || 'CLICK TO CONFIGURE NODE...'}
        </p>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs flex items-center gap-1 text-[var(--text-secondary)]">
            <Zap size={12} /> {local.points}PT
          </span>
          <span className="font-mono text-xs flex items-center gap-1 text-[var(--text-secondary)]">
            <Clock size={12} /> {local.timerSecs}S
          </span>
          {hasChanges && <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-4 border-t-2 border-[var(--border-brutal)] bg-[var(--bg-base)]" onClick={e => e.stopPropagation()}>
          {/* Action Type */}
          <div className="flex flex-wrap gap-2 mb-6">
            {(['FILTER', 'MULTI_FILTER', 'SORT', 'LIMIT', 'FIELD_IDENTIFICATION', 'RECORD_IDENTIFICATION'] as ChallengeType[]).map(t => (
              <button
                key={t}
                onClick={() => update({ type: t })}
                className={`px-3 py-1 font-mono text-xs font-bold uppercase border-2 transition-colors ${
                  local.type === t
                    ? 'border-[var(--accent-primary)] bg-[rgba(0,212,170,0.1)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-brutal)] text-[var(--text-secondary)] hover:border-white'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Narrative / Prompt */}
          <div className="mb-6">
            <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; NARRATIVE / SCENARIO</label>
            <textarea
              className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[80px]"
              placeholder="Enter narrative context for this node..."
              value={local.prompt}
              onChange={e => update({ prompt: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; CLUE (VISIBLE HINT)</label>
              <textarea
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[80px]"
                placeholder="E.g., Look for records modified on 2024-05-12..."
                value={local.clue || ''}
                onChange={e => update({ clue: e.target.value })}
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; SUCCESS LOG</label>
              <textarea
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[80px]"
                placeholder="Log revealed upon completion..."
                value={local.onSuccess || ''}
                onChange={e => update({ onSuccess: e.target.value })}
              />
            </div>
          </div>

          {/* Data config */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; TARGET FIELD(S) / PARAMETER(S)</label>
              <input
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none"
                placeholder="E.g., timestamp, status..."
                value={local.field || ''}
                onChange={e => update({ field: e.target.value })}
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; EXPECTED VALUE(S)</label>
              <input
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none"
                placeholder="E.g., 2024-05-12, error..."
                value={local.correct || ''}
                onChange={e => update({ correct: e.target.value })}
              />
            </div>
          </div>

          {/* Points + Timer */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; POINTS</label>
              <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" min={1} max={100} value={local.points} onChange={e => update({ points: Number(e.target.value) })} />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; TIME (S)</label>
              <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" min={5} max={300} value={local.timerSecs} onChange={e => update({ timerSecs: Number(e.target.value) })} />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; DIFF LEVEL</label>
              <select className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" value={local.difficulty} onChange={e => update({ difficulty: e.target.value as Difficulty })}>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t-2 border-[var(--border-brutal)]">
            <div className="flex gap-2">
              <button onClick={onMoveUp} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white disabled:opacity-30" disabled={index === 0} title="Move up">
                <ChevronUp size={16} />
              </button>
              <button onClick={onMoveDown} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white disabled:opacity-30" disabled={index === total - 1} title="Move down">
                <ChevronDown size={16} />
              </button>
              <button onClick={onDuplicate} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white" title="Duplicate">
                <Copy size={16} />
              </button>
              <button onClick={onDelete} className="p-2 border-2 border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-white" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
            {hasChanges && (
              <BrutalistButton onClick={save} variant="primary" disabled={isSaving} className="flex items-center gap-2">
                <Save size={16} /> {isSaving ? 'SAVING...' : 'SAVE NODE'}
              </BrutalistButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogicHeistEditor({
  challenge, index, total, gameId,
  onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown
}: ChallengeEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [local, setLocal] = useState<Challenge>(challenge);
  const [hasChanges, setHasChanges] = useState(false);

  function update(updates: Partial<Challenge>) {
    const updated = { ...local, ...updates };
    setLocal(updated);
    setHasChanges(true);
  }

  async function save() {
    setIsSaving(true);
    try {
      const { id, ...data } = local;
      const res = await api.patch(`/games/${gameId}/challenges/${id}`, {
        ...data,
      });
      onUpdate(res.data.challenge);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }

  const heistTypes: ChallengeType[] = [
    'VARIABLE_SIMULATION', 'LOOP_SIMULATION', 'BLOCK_CONSTRUCTION',
    'DECISION', 'CONSEQUENCE', 'CODE_REVEAL', 'PREDICTION'
  ];

  return (
    <div className={`border-2 transition-colors ${isExpanded ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]' : 'border-[var(--border-brutal)] bg-[var(--bg-surface)]'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[var(--bg-elevated)]"
        onClick={() => setIsExpanded(p => !p)}
      >
        <div className="text-[var(--text-muted)] cursor-grab hover:text-white" onClick={e => e.stopPropagation()} title="Drag to reorder">
          <GripVertical size={16} />
        </div>
        <div className="w-8 h-8 flex items-center justify-center font-mono font-black text-lg border-2 border-[var(--border-brutal)] text-[var(--accent-primary)] bg-[var(--bg-base)]">
          {index + 1}
        </div>
        <p className="flex-1 truncate font-bold text-sm" style={{ color: local.prompt ? 'white' : 'var(--text-muted)' }}>
          {local.prompt || 'CLICK TO CONFIGURE VAULT NODE...'}
        </p>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs flex items-center gap-1 text-[var(--text-secondary)]">
            <Zap size={12} /> {local.points}PT
          </span>
          <span className="font-mono text-xs flex items-center gap-1 text-[var(--text-secondary)]">
            <Clock size={12} /> {local.timerSecs}S
          </span>
          {hasChanges && <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />}
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-4 border-t-2 border-[var(--border-brutal)] bg-[var(--bg-base)]" onClick={e => e.stopPropagation()}>
          {/* Action Type */}
          <div className="flex flex-wrap gap-2 mb-6">
            {heistTypes.map(t => (
              <button
                key={t}
                onClick={() => update({ type: t })}
                className={`px-3 py-1 font-mono text-xs font-bold uppercase border-2 transition-colors ${
                  local.type === t
                    ? 'border-[var(--accent-primary)] bg-[rgba(0,212,170,0.1)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-brutal)] text-[var(--text-secondary)] hover:border-white'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Scenario */}
          <div className="mb-6">
            <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; SCENARIO / CODE SNIPPET</label>
            <textarea
              className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[100px]"
              placeholder="e.g., A = 5\nB = 3\nCODE = A + B\nWhat is the code?"
              value={local.prompt}
              onChange={e => update({ prompt: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; EXPECTED OUTCOME / ANSWER</label>
              <input
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none"
                placeholder="e.g., 8, LOCK VAULT, or array of block IDs"
                value={typeof local.answer === 'string' ? local.answer : (local.answer || []).join(',')}
                onChange={e => update({ answer: e.target.value })}
              />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; SUCCESS LOG / CODE REVEAL TEXT</label>
              <textarea
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none h-12"
                placeholder="Message shown after solving..."
                value={local.onSuccess || ''}
                onChange={e => update({ onSuccess: e.target.value })}
              />
            </div>
          </div>

          {local.type === 'BLOCK_CONSTRUCTION' && (
            <div className="mb-6">
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; AVAILABLE BLOCKS (COMMA SEPARATED)</label>
              <input
                className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none"
                placeholder="e.g., REPEAT,MOVE RIGHT,IF COIN,COLLECT,STOP"
                value={local.options?.join(',') || ''}
                onChange={e => update({ options: e.target.value.split(',').map(s => s.trim()) })}
              />
            </div>
          )}

          {/* Points + Timer */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; POINTS</label>
              <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" min={1} max={100} value={local.points} onChange={e => update({ points: Number(e.target.value) })} />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; TIME (S)</label>
              <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" min={5} max={300} value={local.timerSecs} onChange={e => update({ timerSecs: Number(e.target.value) })} />
            </div>
            <div>
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; DIFF LEVEL</label>
              <select className="brutalist-input w-full p-2 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" value={local.difficulty} onChange={e => update({ difficulty: e.target.value as Difficulty })}>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t-2 border-[var(--border-brutal)]">
            <div className="flex gap-2">
              <button onClick={onMoveUp} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white disabled:opacity-30" disabled={index === 0} title="Move up">
                <ChevronUp size={16} />
              </button>
              <button onClick={onMoveDown} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white disabled:opacity-30" disabled={index === total - 1} title="Move down">
                <ChevronDown size={16} />
              </button>
              <button onClick={onDuplicate} className="p-2 border-2 border-[var(--border-brutal)] text-[var(--text-secondary)] hover:text-white hover:border-white" title="Duplicate">
                <Copy size={16} />
              </button>
              <button onClick={onDelete} className="p-2 border-2 border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-white" title="Delete">
                <Trash2 size={16} />
              </button>
            </div>
            {hasChanges && (
              <BrutalistButton onClick={save} variant="primary" disabled={isSaving} className="flex items-center gap-2">
                <Save size={16} /> {isSaving ? 'SAVING...' : 'SAVE VAULT NODE'}
              </BrutalistButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GameEditorPage() {
  const { id, clubId } = useParams<{ id: string, clubId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: () => api.get(`/games/${id}`).then(r => r.data.game as Game),
  });

  const game = data as any;
  const [gameData, setGameData] = useState<Partial<Game>>({});
  const [addingChallenge, setAddingChallenge] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const dirtySavesRef = useRef<Map<string, () => Promise<boolean>>>(new Map());

  function handleDirtyChange(challengeId: string, isDirty: boolean, saveFn: () => Promise<boolean>) {
    if (isDirty) {
      dirtySavesRef.current.set(challengeId, saveFn);
    } else {
      dirtySavesRef.current.delete(challengeId);
    }
  }

  async function saveDirtyChallenges(): Promise<boolean> {
    if (dirtySavesRef.current.size === 0) return true;
    for (const [, saveFn] of Array.from(dirtySavesRef.current.entries())) {
      const ok = await saveFn();
      if (!ok) {
        setSessionError('Please resolve query validation errors before compiling.');
        return false;
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['game', id] });
    return true;
  }
  
  const activeRound = { id: 'default', title: 'QUESTION BANK', challenges: game?.challenges || [] };

  async function addChallenge() {
    if (!data) return;
    setAddingChallenge(true);
    try {
      await api.post(`/games/${data.id}/challenges`, {
        type: 'SINGLE_CHOICE',
        prompt: 'New Question',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        answer: 'Option A',
        points: 10,
        timerSecs: 20,
        difficulty: 'EASY',
      });
      queryClient.invalidateQueries({ queryKey: ['game', id] });
    } finally {
      setAddingChallenge(false);
    }
  }

  async function deleteChallenge(challengeId: string) {
    if (!game) return;
    dirtySavesRef.current.delete(challengeId);
    await api.delete(`/games/${game.id}/challenges/${challengeId}`);
    queryClient.invalidateQueries({ queryKey: ['game', id] });
  }

  async function duplicateChallenge(c: Challenge) {
    if (!game) return;
    await api.post(`/games/${game.id}/challenges`, {
      type: c.type, prompt: c.prompt + ' (COPY)', options: c.options,
      answer: c.answer, points: c.points, timerSecs: c.timerSecs,
      difficulty: c.difficulty, explanation: c.explanation, hint: c.hint,
    });
    queryClient.invalidateQueries({ queryKey: ['game', id] });
  }

  async function moveChallenge(index: number, direction: 'up' | 'down') {
    if (!game) return;
    const challenges = [...game.challenges];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= challenges.length) return;
    [challenges[index], challenges[newIndex]] = [challenges[newIndex], challenges[index]];
    await api.post(`/games/${game.id}/challenges/reorder`, {
      orderedIds: challenges.map(c => c.id),
    });
    queryClient.invalidateQueries({ queryKey: ['game', id] });
  }

  async function saveGameSettings() {
    if (!game) return;
    await api.patch(`/games/${game.id}`, gameData);
    queryClient.invalidateQueries({ queryKey: ['game', id] });
    setGameData({});
  }

  async function publish() {
    if (!data) return;
    const ok = await saveDirtyChallenges();
    if (!ok) return;
    setPublishing(true);
    setPublishMsg('');
    try {
      await api.post(`/games/${game.id}/publish`);
      queryClient.invalidateQueries({ queryKey: ['game', id] });
      setPublishMsg('SYS: DEPLOYED SUCCESSFULLY');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'SYS: DEPLOYMENT FAILED';
      setPublishMsg(msg);
      setSessionError(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function startSession() {
    if (!data) return;
    const ok = await saveDirtyChallenges();
    if (!ok) return;
    try {
      const res = await api.post('/sessions', { gameId: game.id });
      const roomCode = res.data.session.code || res.data.session.roomCode;
      navigate(`/sessions/${roomCode}/host`);
    } catch (err: any) {
      setSessionError(err.response?.data?.error || 'Failed to create session');
    }
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center font-mono uppercase">LOADING MODULE...</div>;
  if (!game) return <div className="min-h-screen flex items-center justify-center font-mono uppercase text-[var(--error)]">MODULE CORRUPTED</div>;

  const totalQ = game.challenges ? game.challenges.length : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--term-bg-void)] font-mono">
      {/* Top bar */}
      <header className="bg-[var(--term-bg-surface)] border-b border-[var(--term-border-muted)] px-3 sm:px-5 py-2 min-h-[56px] flex flex-wrap items-center justify-between gap-2.5 sticky top-0 z-50">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <TerminalBackButton
            to={clubId ? `/clubs/${clubId}` : '/gm?tab=games'}
            label="[ESC / BACK]"
            hasUnsavedChanges={Object.keys(gameData).length > 0}
            unsavedMessage="You have unsaved module settings. Discard and return to games?"
            className="shrink-0"
          />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="font-mono font-black text-sm sm:text-base uppercase tracking-tight text-white truncate max-w-[140px] sm:max-w-xs">{game.name}</span>
            <span className={`text-[9px] px-1.5 sm:px-2 py-0.5 font-bold font-mono border uppercase shrink-0 ${
              game.status === 'PUBLISHED' ? 'text-[var(--term-green)] border-[var(--term-green)]' : 'text-[var(--term-yellow)] border-[var(--term-yellow)]'
            }`}>
              {game.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-[10px] sm:text-xs text-[var(--term-text-muted)] font-bold hidden xs:inline">{totalQ} QUERIES</span>
          {game.status === 'PUBLISHED' ? (
            <BrutalistButton onClick={startSession} variant="primary" className="flex items-center gap-2">
              <Play size={14} /> COMPILE RUN
            </BrutalistButton>
          ) : (
            <BrutalistButton onClick={publish} variant="default" disabled={publishing} className="flex items-center gap-2">
              <Rocket size={14} /> {publishing ? 'DEPLOYING...' : 'DEPLOY MODULE'}
            </BrutalistButton>
          )}
        </div>
      </header>

      {publishMsg && (
        <div className={`p-2 font-mono text-xs font-bold text-center border-b ${
          publishMsg.includes('SUCCESS')
            ? 'bg-[var(--term-green-glow)] text-[var(--term-green)] border-[var(--term-green)]'
            : 'bg-[var(--term-red-glow)] text-[var(--term-red)] border-[var(--term-red)]'
        }`}>
          {publishMsg}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 bg-[var(--term-bg-surface)] border-r border-[var(--term-border-muted)] p-5 overflow-y-auto hidden md:block">
          <BrutalistPanel title="CONFIG_VARS">
            <div className="flex flex-col gap-4">
              <div>
                <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-1">Max Players</label>
                <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-base)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="number" defaultValue={game.maxPlayers} onChange={e => setGameData(p => ({ ...p, maxPlayers: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center justify-between border-b-2 border-dashed border-[var(--border-brutal)] pb-3">
                <span className="font-mono text-xs font-bold uppercase text-[var(--text-secondary)]">Teams Auth</span>
                <input type="checkbox" defaultChecked={game.teamsEnabled} onChange={e => setGameData(p => ({ ...p, teamsEnabled: e.target.checked }))} className="w-4 h-4" />
              </div>
              <div className="flex items-center justify-between border-b-2 border-dashed border-[var(--border-brutal)] pb-3">
                <span className="font-mono text-xs font-bold uppercase text-[var(--text-secondary)]">Speed Bonus</span>
                <input type="checkbox" defaultChecked={game.speedBonus} onChange={e => setGameData(p => ({ ...p, speedBonus: e.target.checked }))} className="w-4 h-4" />
              </div>
              <div className="border-b-2 border-dashed border-[var(--border-brutal)] pb-3">
                <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-1">Time Bonus (End Game)</label>
                <input
                  className="brutalist-input w-full p-2 font-mono bg-[var(--bg-base)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none text-xs"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={game.config?.timeBonusPoints ?? 10}
                  onChange={e => setGameData(p => ({
                    ...p,
                    config: {
                      ...((p.config || game.config) as any),
                      timeBonusPoints: Number(e.target.value) || 0,
                    }
                  }))}
                />
                <span className="text-[10px] text-[var(--term-text-muted)] block mt-1">
                  Bonus points added upon game finalization. Does not skew per-question averages.
                </span>
              </div>
              {game.template === 'DATA_HUNT' && (
                <>
                  <div>
                    <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-1">Dataset Config URL</label>
                    <input className="brutalist-input w-full p-2 font-mono bg-[var(--bg-base)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none" type="text" placeholder="https://api.example.com/dataset.json" defaultValue={game.config?.datasetUrl || ''} onChange={e => setGameData(p => ({ ...p, config: { ...((p.config || game.config) as any), datasetUrl: e.target.value } }))} />
                  </div>
                  <div>
                    <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-1">Master Story Context</label>
                    <textarea className="brutalist-input w-full p-2 font-mono bg-[var(--bg-base)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[100px]" placeholder="Global story context for this hunt..." defaultValue={game.config?.story || ''} onChange={e => setGameData(p => ({ ...p, config: { ...((p.config || game.config) as any), story: e.target.value } }))} />
                  </div>
                </>
              )}
              {Object.keys(gameData).length > 0 && (
                <BrutalistButton onClick={saveGameSettings} variant="primary" className="w-full mt-2">
                  SAVE CONFIG
                </BrutalistButton>
              )}
            </div>
          </BrutalistPanel>
        </div>

        {/* Main: questions */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-[9px] font-bold tracking-[0.3em] text-[var(--term-cyan)] mb-1">// QUERY_REPOSITORY</div>
                <h2 className="font-mono font-black text-2xl uppercase tracking-tight text-white">{activeRound.title}</h2>
                <p className="font-mono text-xs text-[var(--term-text-muted)] uppercase mt-0.5">TOTAL: {activeRound.challenges.length}</p>
              </div>
              <BrutalistButton onClick={addChallenge} variant="primary" disabled={addingChallenge} className="flex items-center gap-2">
                <Plus size={14} /> {addingChallenge ? '...' : 'ADD QUERY'}
              </BrutalistButton>
            </div>

            {activeRound.challenges.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-[var(--term-border-faint)] bg-[var(--term-bg-surface)]">
                <HelpCircle size={36} className="mx-auto mb-5 text-[var(--term-text-muted)]" />
                <p className="font-mono text-sm text-[var(--term-text-muted)] font-bold mb-5">// NO QUERIES FOUND IN REPOSITORY</p>
                <BrutalistButton onClick={addChallenge} variant="primary" disabled={addingChallenge}>
                  <Plus size={14} /> INITIALIZE FIRST QUERY
                </BrutalistButton>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeRound.challenges.map((c, i) => {
                  const EditorComponent = game.template === 'DATA_HUNT' ? DataHuntEditor : game.template === 'LOGIC_HEIST' ? LogicHeistEditor : ChallengeEditor;
                  return (
                    <EditorComponent
                      key={c.id}
                      challenge={c}
                      index={i}
                      total={activeRound.challenges.length}
                      gameId={game.id}
                      onUpdate={() => queryClient.invalidateQueries({ queryKey: ['game', id] })}
                      onDelete={() => deleteChallenge(c.id)}
                      onDuplicate={() => duplicateChallenge(c)}
                      onMoveUp={() => moveChallenge(i, 'up')}
                      onMoveDown={() => moveChallenge(i, 'down')}
                      onDirtyChange={handleDirtyChange}
                    />
                  );
                })}
                <BrutalistButton onClick={addChallenge} variant="default" className="w-full py-3" disabled={addingChallenge}>
                  <Plus size={14} /> APPEND NEW QUERY
                </BrutalistButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Validation Error Modal */}
      <TerminalModal
        isOpen={!!sessionError}
        onClose={() => setSessionError(null)}
        title="PROTOCOL VALIDATION ERROR"
        headerTag="// SYSTEM_VALIDATION_FAILED"
        maxWidth="md"
      >
        <div className="p-4 sm:p-5 flex flex-col gap-4 font-mono">
          <div className="flex items-start gap-3 p-3.5 bg-red-950/70 border-2 border-[var(--error)] text-white">
            <AlertCircle className="w-5 h-5 text-[var(--error)] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--error)] mb-1">// ERROR_DETAILS</div>
              <p className="text-sm font-bold text-white leading-relaxed break-words">{sessionError}</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <TerminalButton
              variant="primary"
              onClick={() => setSessionError(null)}
              className="flex items-center gap-2"
            >
              [ BACK TO EDITOR ]
            </TerminalButton>
          </div>
        </div>
      </TerminalModal>
    </div>
  );
}
