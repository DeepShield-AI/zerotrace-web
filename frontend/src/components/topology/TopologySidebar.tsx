import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TopologyNode, TopologyEdge } from './TopologyMap';

function num(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}
function fmtN(n?: number | string): string {
  const v = num(n);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}
function fmtLatency(n?: number | string): string {
  const v = num(n);
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return Math.round(v) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

// ── Button group (replaces antd Radio.Group) ────────────

function BtnGroup<T extends string>({ value, options, onChange }: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`flex-1 text-center text-[11px] font-medium py-1.5 transition-colors ${
            i > 0 ? 'border-l border-border' : ''
          } ${
            value === opt.key
              ? 'bg-accent-primary text-fg-inverse'
              : 'text-fg-secondary hover:bg-bg-subtle'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-fg-secondary hover:text-fg-primary">
      <div className={`relative w-7 h-4 rounded-full transition-colors ${checked ? 'bg-accent-primary' : 'bg-bg-muted border border-border'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}

// ── Main component ───────────────────────────────────────

export default function TopologySidebar({
  nodes, edges, activeSizing, onSizingChange, activeLayout, onLayoutChange,
  searchQuery, onSearchChange, highlightedNode, onNodeHighlight,
}: {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  activeSizing: 'requests' | 'latency' | 'errors';
  onSizingChange: (s: 'requests' | 'latency' | 'errors') => void;
  activeLayout: 'force' | 'circular';
  onLayoutChange: (l: 'force' | 'circular') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  highlightedNode?: string;
  onNodeHighlight: (node?: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [showInferred, setShowInferred] = useState(false);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => n.service_name.toLowerCase().includes(q));
  }, [nodes, searchQuery]);

  const sortedNodes = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      switch (activeSizing) {
        case 'latency': return num(b.avg_latency_ms) - num(a.avg_latency_ms);
        case 'errors': return num(b.error_rate_pct) - num(a.error_rate_pct);
        default: return num(b.request_count) - num(a.request_count);
      }
    });
  }, [filteredNodes, activeSizing]);

  // Edge width stats (Datadog style)
  const edgeStats = useMemo(() => {
    if (!edges.length) return { min: 0, max: 0, total: 0 };
    const counts = edges.map(e => num(e.call_count));
    return {
      min: Math.min(...counts),
      max: Math.max(...counts),
      total: counts.reduce((a, b) => a + b, 0),
    };
  }, [edges]);

  return (
    <div className="w-64 shrink-0 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg-primary">{t('apm.serviceMap')}</h3>
        <span className="text-[10px] font-mono text-fg-tertiary">{nodes.length} nodes · {edges.length} edges</span>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-tertiary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="5.5"/><path d="M11 11l3.5 3.5"/>
        </svg>
        <input type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)}
          placeholder={t('apm.searchNodes')}
          className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-border rounded-md bg-bg-elevated placeholder:text-fg-disabled focus:outline-none focus:border-accent-primary transition-all"
        />
      </div>

      {/* Datadog-style toggles */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">{t('apm.viewOptions')}</h4>
        <Toggle label="Grouped" checked={grouped} onChange={setGrouped} />
        <Toggle label="Error" checked={showErrors} onChange={setShowErrors} />
        <Toggle label="Inferred" checked={showInferred} onChange={setShowInferred} />
      </div>

      {/* Layout */}
      <div>
        <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">{t('apm.layout')}</h4>
        <BtnGroup value={activeLayout} onChange={onLayoutChange}
          options={[{ key: 'force' as const, label: 'Force' }, { key: 'circular' as const, label: 'Circular' }]} />
      </div>

      {/* Node sizing */}
      <div>
        <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">Node size by</h4>
        <BtnGroup value={activeSizing} onChange={onSizingChange}
          options={[
            { key: 'requests' as const, label: 'Reqs' },
            { key: 'latency' as const, label: 'Lat' },
            { key: 'errors' as const, label: 'Errs' },
          ]} />
      </div>

      {/* Edge Width legend (Datadog: "% of traces") */}
      {edges.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">Edge Width · % of traces</h4>
          <div className="space-y-1 text-[10px] font-mono text-fg-tertiary">
            <div className="flex items-center gap-2">
              <span className="w-8 h-0.5 rounded-full bg-border-subtle" />
              <span>Min: &lt; {((edgeStats.min / Math.max(edgeStats.total, 1)) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-1 rounded-full bg-accent-primary" />
              <span>Avg: {((edgeStats.total / edges.length / Math.max(edgeStats.total, 1)) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-1.5 rounded-full bg-accent-primary" />
              <span>Max: {((edgeStats.max / Math.max(edgeStats.total, 1)) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Error color legend */}
      <div>
        <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">Edge Colors</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-fg-tertiary">
            <span className="w-3 h-0.5 rounded-full bg-accent-success" /> Low latency
          </div>
          <div className="flex items-center gap-2 text-[11px] text-fg-tertiary">
            <span className="w-3 h-0.5 rounded-full bg-accent-warning" /> Medium latency
          </div>
          <div className="flex items-center gap-2 text-[11px] text-fg-tertiary">
            <span className="w-3 h-0.5 rounded-full bg-accent-danger" /> High latency / Errors
          </div>
        </div>
      </div>

      {/* Node list */}
      <div>
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-1 text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider hover:text-fg-secondary transition-colors">
          Node Legend
          <span className="font-mono text-[10px]">{sortedNodes.length}</span>
        </button>
        {expanded && (
          <div className="max-h-[260px] overflow-y-auto space-y-px mt-1">
            {sortedNodes.length === 0 ? (
              <p className="text-[11px] text-fg-tertiary px-2 py-2 italic">No nodes match search</p>
            ) : (
              sortedNodes.map((node) => {
                const errPct = num(node.error_rate_pct);
                const metricValue = activeSizing === 'latency'
                  ? fmtLatency(node.avg_latency_ms) : activeSizing === 'errors'
                  ? `${errPct.toFixed(1)}%` : fmtN(node.request_count);
                return (
                  <button key={node.service_name}
                    onClick={() => onNodeHighlight(highlightedNode === node.service_name ? undefined : node.service_name)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
                      highlightedNode === node.service_name
                        ? 'bg-accent-primary/10 text-accent-primary font-medium'
                        : 'text-fg-secondary hover:bg-bg-subtle'
                    }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      errPct > 5 ? 'bg-accent-danger' : errPct > 1 ? 'bg-accent-warning' : 'bg-accent-success'
                    }`} />
                    <span className="flex-1 truncate">{node.service_name}</span>
                    <span className="font-mono text-[10px] text-fg-tertiary shrink-0">{metricValue}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
