import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Game, Challenge, ChallengeType, Difficulty } from '../types';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Copy,
  Save, Rocket, GripVertical, Check, Zap, Clock, HelpCircle, Play
} from 'lucide-react';
import { BrutalistPanel, BrutalistButton } from '../components/ui/Brutalist';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

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
}

function ChallengeEditor({
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
        options: data.options,
        answer: data.answer,
      });
      onUpdate(res.data.challenge);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }

  function setCorrectAnswer(value: string) {
    if (local.type === 'MULTIPLE_CHOICE') {
      const current = Array.isArray(local.answer) ? local.answer : [local.answer];
      if (current.includes(value)) {
        update({ answer: current.filter(a => a !== value) });
      } else {
        update({ answer: [...current, value] });
      }
    } else {
      update({ answer: value });
    }
  }

  function isOptionCorrect(opt: string): boolean {
    if (Array.isArray(local.answer)) return local.answer.includes(opt);
    return local.answer === opt;
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
          {local.prompt || 'CLICK TO CONFIGURE PROTOCOL...'}
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
          {/* Question type */}
          <div className="flex gap-2 mb-6">
            {(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'] as ChallengeType[]).map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === 'TRUE_FALSE') {
                    update({ type: t, options: ['True', 'False'], answer: 'True' });
                  } else {
                    update({ type: t, options: local.options || ['', '', '', ''], answer: t === 'MULTIPLE_CHOICE' ? [] : '' });
                  }
                }}
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

          {/* Prompt */}
          <div className="mb-6">
            <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; QUERY PARAMETERS</label>
            <textarea
              className="brutalist-input w-full p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none min-h-[80px]"
              placeholder="Enter query string..."
              value={local.prompt}
              onChange={e => update({ prompt: e.target.value })}
            />
          </div>

          {/* Options */}
          {local.type !== 'TRUE_FALSE' ? (
            <div className="mb-6">
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; EXPECTED OUTPUTS</label>
              <div className="grid gap-3">
                {(local.options || ['', '', '', '']).map((opt, oi) => (
                  <div key={oi} className="flex gap-3 items-center">
                    <button
                      onClick={() => setCorrectAnswer(opt)}
                      className={`w-10 h-10 flex-shrink-0 flex items-center justify-center border-2 font-black font-mono transition-colors ${
                        isOptionCorrect(opt)
                          ? 'border-[var(--success)] bg-[rgba(63,185,80,0.1)] text-[var(--success)]'
                          : 'border-[var(--border-brutal)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                      }`}
                    >
                      {isOptionCorrect(opt) ? <Check size={18} /> : OPTION_LABELS[oi]}
                    </button>
                    <input
                      className="brutalist-input flex-1 p-3 font-mono bg-[var(--bg-surface)] text-white border-2 border-[var(--border-brutal)] focus:border-[var(--accent-primary)] outline-none"
                      placeholder={`Output Vector ${OPTION_LABELS[oi]}`}
                      value={opt}
                      onChange={e => {
                        const opts = [...(local.options || ['', '', '', ''])];
                        opts[oi] = e.target.value;
                        update({ options: opts });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <label className="font-mono text-xs font-bold text-[var(--text-secondary)] uppercase block mb-2">&gt; BOOLEAN TARGET</label>
              <div className="flex gap-4">
                {['True', 'False'].map(v => (
                  <button
                    key={v}
                    onClick={() => update({ answer: v })}
                    className={`flex-1 py-3 font-mono font-black uppercase border-2 transition-colors ${
                      local.answer === v
                        ? 'border-[var(--success)] bg-[rgba(63,185,80,0.1)] text-[var(--success)]'
                        : 'border-[var(--border-brutal)] text-[var(--text-secondary)] hover:border-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
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
                <Save size={16} /> {isSaving ? 'SAVING...' : 'SAVE MODULE'}
              </BrutalistButton>
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
  
  const activeRound = { id: 'default', title: 'QUESTION BANK', challenges: game?.challenges || [] };

  async function addChallenge() {
    if (!data) return;
    setAddingChallenge(true);
    try {
      await api.post(`/games/${data.id}/challenges`, {
        type: 'SINGLE_CHOICE', prompt: 'New question', options: ['', '', '', ''],
        answer: '', points: 10, timerSecs: 20, difficulty: 'EASY',
      });
      queryClient.invalidateQueries({ queryKey: ['game', id] });
    } finally {
      setAddingChallenge(false);
    }
  }

  async function deleteChallenge(challengeId: string) {
    if (!game) return;
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
    setPublishing(true);
    setPublishMsg('');
    try {
      await api.post(`/games/${game.id}/publish`);
      queryClient.invalidateQueries({ queryKey: ['game', id] });
      setPublishMsg('SYS: DEPLOYED SUCCESSFULLY');
    } catch (err: any) {
      setPublishMsg(err.response?.data?.error || 'SYS: DEPLOYMENT FAILED');
    } finally {
      setPublishing(false);
    }
  }

  async function startSession() {
    if (!data) return;
    try {
      const res = await api.post('/sessions', { gameId: game.id });
      navigate(clubId ? `/clubs/${clubId}/sessions/${res.data.session.code}/host` : `/sessions/${res.data.session.code}/host`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create session');
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
          <BrutalistButton onClick={() => navigate(clubId ? `/clubs/${clubId}` : '/dashboard')} variant="default" className="p-2 shrink-0 min-h-[36px] min-w-[36px]">
            <ArrowLeft size={14} />
          </BrutalistButton>
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
    </div>
  );
}
