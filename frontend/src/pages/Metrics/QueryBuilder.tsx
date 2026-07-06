import { useState, useCallback } from 'react';
import CompactSelect from '../../components/ui/CompactSelect';
import MetricSelector from './MetricSelector';
import ModifyMenu from './ModifyMenu';
import { fmtQuery } from './utils';
import type { ActiveModifier } from './transforms';
import type { MetricDef } from './types';

// ── Types ────────────────────────────────────────────────

export interface QueryDef {
  id: string; label: string; metric: string; agg: string; by: string; scope: string;
  color: string; modifiers: ActiveModifier[];
}

// ── Constants ────────────────────────────────────────────

const AGG_FUNCTIONS = ['avg', 'sum', 'min', 'max', 'count'] as const;
const BY_DIMS = ['everything', 'host', 'service', 'env', 'region'] as const;
const SCOPE_OPTIONS = ['everywhere', 'host:web-01', 'host:db-01', 'env:prod', 'env:staging'] as const;

// ── Component ────────────────────────────────────────────

export default function QueryBuilder({
  queries,
  metrics,
  onAddQuery,
  onRemoveQuery,
  onUpdateQuery,
  onAddFormula,
}: {
  queries: QueryDef[];
  metrics: MetricDef[];
  onAddQuery: () => void;
  onRemoveQuery: (id: string) => void;
  onUpdateQuery: (id: string, patch: Partial<QueryDef>) => void;
  onAddFormula: (text: string) => void;
}) {
  const [showModify, setShowModify] = useState<string | null>(null);
  const [codeMode, setCodeMode] = useState(false);
  const [formulaMode, setFormulaMode] = useState(false);
  const [formulaText, setFormulaText] = useState('');

  const handleAddFormula = useCallback(() => {
    if (!formulaText.trim()) return;
    onAddFormula(formulaText.trim());
    setFormulaText('');
    setFormulaMode(false);
  }, [formulaText, onAddFormula]);

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4 mb-4 space-y-3">
      {/* Code mode: raw query string editor */}
      {codeMode ? (
        <div className="space-y-2">
          {queries.map((q) => (
            <div key={q.id} className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-fg-tertiary font-mono w-5">{q.label}.</span>
              <input
                value={fmtQuery(q.agg, q.metric, q.by, q.modifiers)}
                onChange={e => {
                  const v = e.target.value;
                  const match = v.match(/(\w+):([\w.]+)/);
                  if (match) onUpdateQuery(q.id, { agg: match[1], metric: match[2] });
                }}
                className="flex-1 h-7 px-2 text-[12px] font-mono border border-border rounded bg-bg-elevated text-fg-primary focus:outline-none focus:border-accent-primary"
              />
              {queries.length > 1 && (
                <button onClick={() => onRemoveQuery(q.id)}
                  className="text-[12px] text-fg-tertiary hover:text-accent-danger px-1">×</button>
              )}
            </div>
          ))}
          <button onClick={() => setCodeMode(false)}
            className="text-[11px] text-accent-primary hover:text-accent-primary/80 font-medium">
            ← Back to visual editor
          </button>
        </div>
      ) : (
        <>
          {queries.map((q) => (
            <div key={q.id} className="flex items-center gap-2 flex-wrap">
              {/* Label */}
              <span className="text-[12px] font-bold text-fg-tertiary font-mono w-5">{q.label}.</span>

              {/* Type */}
              <CompactSelect value="Metrics" onChange={() => {}} options={['Metrics']} width={72} />

              {/* Metric name */}
              <MetricSelector
                value={q.metric}
                onChange={v => onUpdateQuery(q.id, { metric: v })}
                metrics={metrics}
              />

              {/* from scope */}
              <span className="text-[11px] text-fg-tertiary">from</span>
              <CompactSelect
                value={q.scope}
                onChange={v => onUpdateQuery(q.id, { scope: v })}
                options={SCOPE_OPTIONS}
                width={110}
              />

              {/* agg */}
              <CompactSelect value={q.agg} onChange={v => onUpdateQuery(q.id, { agg: v })}
                options={AGG_FUNCTIONS} width={56} />
              <span className="text-[11px] text-fg-tertiary">by</span>
              <CompactSelect value={q.by} onChange={v => onUpdateQuery(q.id, { by: v })}
                options={BY_DIMS} width={90} />

              {/* Σ Modify */}
              <div className="relative">
                <button
                  onClick={() => setShowModify(showModify === q.id ? null : q.id)}
                  className="text-[11px] text-fg-secondary hover:text-fg-primary px-2.5 py-1 rounded border border-border bg-bg-subtle font-medium transition-colors"
                >
                  Σ Modify
                </button>
                {showModify === q.id && (
                  <ModifyMenu
                    onSelect={(cat, fn, params) => {
                      onUpdateQuery(q.id, { modifiers: [...q.modifiers, { category: cat, fn, params }] });
                      setShowModify(null);
                    }}
                    onClose={() => setShowModify(null)}
                  />
                )}
              </div>

              {/* Active modifier tags */}
              {q.modifiers.map((mod, j) => (
                <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded">
                  {mod.fn}
                  <button onClick={() => {
                    onUpdateQuery(q.id, { modifiers: q.modifiers.filter((_, k) => k !== j) });
                  }} className="hover:text-accent-danger">×</button>
                </span>
              ))}

              {/* </> code toggle */}
              <button
                onClick={() => setCodeMode(true)}
                className="text-[12px] text-fg-tertiary hover:text-fg-secondary px-1 font-mono transition-colors"
                title="Edit raw query"
              >
                &lt;/&gt;
              </button>

              {/* Remove */}
              {queries.length > 1 && (
                <button onClick={() => onRemoveQuery(q.id)}
                  className="text-[12px] text-fg-tertiary hover:text-accent-danger px-1">×</button>
              )}
            </div>
          ))}

          {/* + Add Query / + Add Formula */}
          <div className="flex items-center gap-2">
            <button onClick={onAddQuery}
              className="text-[11px] text-fg-secondary hover:text-accent-primary px-2 py-1 rounded border border-dashed border-border hover:border-accent-primary transition-colors">
              + Add Query
            </button>
            {formulaMode ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={formulaText}
                  onChange={e => setFormulaText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddFormula(); if (e.key === 'Escape') setFormulaMode(false); }}
                  placeholder="e.g. a + b"
                  autoFocus
                  className="w-[120px] h-6 px-2 text-[11px] font-mono border border-border rounded bg-bg-elevated text-fg-primary focus:outline-none focus:border-accent-primary"
                />
                <button onClick={handleAddFormula}
                  className="text-[11px] text-accent-primary font-medium hover:text-accent-primary/80">Apply</button>
                <button onClick={() => setFormulaMode(false)}
                  className="text-[11px] text-fg-tertiary hover:text-fg-secondary">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setFormulaMode(true)}
                className="text-[11px] text-fg-tertiary hover:text-accent-primary px-2 py-1 rounded border border-dashed border-border hover:border-accent-primary transition-colors">
                + Add Formula
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
