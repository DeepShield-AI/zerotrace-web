import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { MetricDef } from './types';

export default function MetricSelector({ value, onChange, metrics }: {
  value: string; onChange: (v: string) => void; metrics: MetricDef[];
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Categories collapsed state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const q = value.toLowerCase();
    const map = new Map<string, MetricDef[]>();
    metrics.forEach(m => {
      if (q && !m.display_name.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)) return;
      const l = map.get(m.category) || [];
      l.push(m); map.set(m.category, l);
    });
    return map;
  }, [metrics, value]);

  return (
    <div ref={ref} className="relative" style={{ width: 170 }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        placeholder="Metric name..."
        className="w-full h-7 px-2 text-[12px] font-mono border bg-bg-elevated text-fg-primary placeholder:text-fg-tertiary focus:outline-none transition-all rounded"
        style={{ borderColor: focused || open ? 'var(--accent-primary, #4799eb)' : 'var(--border-default, #d1d9e0)' }}
      />
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-elevated border border-border rounded-lg shadow-xl z-50 w-[380px] max-h-[400px] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto py-1">
            {grouped.size === 0 && <p className="text-xs text-fg-tertiary text-center py-8">No metrics found</p>}
            {Array.from(grouped.entries()).map(([cat, list]) => (
              <div key={cat}>
                <button
                  onClick={() => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-fg-tertiary hover:text-fg-secondary hover:bg-bg-subtle transition-colors">
                  <span className="flex-1 text-left capitalize">{cat}</span>
                  <span className="text-[10px]">{list.length}</span>
                  <svg className={`w-3 h-3 transition-transform ${!collapsed[cat] ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z"/></svg>
                </button>
                {!collapsed[cat] && list.map(m => (
                  <button key={m.name}
                    onClick={() => { onChange(m.name); setOpen(false); }}
                    className={`w-full text-left pl-5 pr-3 py-2 transition-colors border-b border-border-subtle hover:bg-bg-subtle ${
                      value === m.name ? 'bg-accent-primary/10 border-l-[2px] border-l-accent-primary' : 'border-l-[2px] border-l-transparent'
                    }`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-fg-primary truncate flex-1">{m.display_name}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-bg-muted text-fg-tertiary">{m.type}</span>
                    </div>
                    <p className="text-[10px] text-fg-tertiary font-mono mt-0.5 truncate">{m.name}</p>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
