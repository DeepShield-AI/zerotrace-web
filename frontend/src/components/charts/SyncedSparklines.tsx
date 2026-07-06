import { useMemo, useState, useCallback, useRef } from 'react';

type TsPoint = { ts: string; process_name: string; request_count: string; avg_latency_ms: string; error_count: string };

// Group time-series data by process name, returning { name, color, data: [{ts, value}] }[]
function groupByProcess(raw: TsPoint[], field: keyof TsPoint, colors: string[]): {
  name: string; color: string; data: { ts: string; val: number }[];
}[] {
  const map = new Map<string, { ts: string; val: number }[]>();
  for (const r of raw) {
    if (r.process_name && r[field] !== undefined) {
      const list = map.get(r.process_name) || [];
      list.push({ ts: r.ts, val: parseFloat(String(r[field])) || 0 });
      map.set(r.process_name, list);
    }
  }
  return Array.from(map.entries())
    .filter(([, data]) => data.length >= 2)
    .sort((a, b) => b[1].reduce((s, d) => s + d.val, 0) - a[1].reduce((s, d) => s + d.val, 0))
    .slice(0, 5)
    .map(([name, data], i) => ({ name, data, color: colors[i % colors.length] }));
}

export default function SyncedSparklines({ data, field, title, unit, colors }: {
  data: TsPoint[]; field: keyof TsPoint; title: string; unit: string; colors: string[];
}) {
  const series = useMemo(() => groupByProcess(data, field, colors), [data, field, colors]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const W = 320, H = 36;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Use the first series' data length for index calculation
    const firstLen = series[0]?.data.length || 1;
    const idx = Math.min(Math.floor((x / W) * firstLen), firstLen - 1);
    setHoverIdx(Math.max(0, idx));
  }, [series]);

  if (series.length === 0) return null;

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4 mt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-tertiary mb-3">{title}</h3>
      <div className="space-y-1.5" ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
        {series.map((s) => {
          const max = Math.max(...s.data.map(d => d.val), 1);
          const hoverVal = hoverIdx != null && hoverIdx < s.data.length ? s.data[hoverIdx] : null;
          const points = s.data.map((d, i) => {
            const x = (i / Math.max(s.data.length - 1, 1)) * W;
            const y = H - 3 - ((d.val / max) * (H - 8));
            return `${x},${y}`;
          }).join(' ');
          return (
            <div key={s.name} className="flex items-center gap-3 relative">
              <span className="text-[11px] font-mono w-28 truncate shrink-0 text-fg-primary">{s.name}</span>
              <svg width={W} height={H} className="shrink-0">
                <polyline points={points} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Area fill */}
                <polygon
                  points={`0,${H} ${points} ${W},${H}`}
                  fill={s.color} opacity="0.08"
                />
                {/* Crosshair */}
                {hoverIdx != null && hoverIdx < s.data.length && (
                  <line
                    x1={(hoverIdx / Math.max(s.data.length - 1, 1)) * W}
                    y1="0"
                    x2={(hoverIdx / Math.max(s.data.length - 1, 1)) * W}
                    y2={H}
                    stroke={s.color} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6"
                  />
                )}
              </svg>
              <span className="text-[11px] font-mono tabular-nums w-16 text-right shrink-0" style={{ color: s.color }}>
                {hoverVal ? (hoverVal.val >= 1000 ? (hoverVal.val / 1000).toFixed(1) + 'K' : hoverVal.val.toFixed(1)) : '—'}
                <span className="text-[10px] text-fg-disabled ml-0.5">{unit}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
