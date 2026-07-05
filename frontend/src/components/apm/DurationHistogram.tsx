import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function DurationHistogram({ data, onSelectRange }: {
  data: { latency_ms: number }[];
  onSelectRange?: (min: number, max: number) => void;
}) {
  const { t } = useTranslation();
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);

  const buckets = [
    { label: '0-10ms', min: 0, max: 10 },
    { label: '10-100ms', min: 10, max: 100 },
    { label: '100-500ms', min: 100, max: 500 },
    { label: '500ms-1s', min: 500, max: 1000 },
    { label: '1-5s', min: 1000, max: 5000 },
    { label: '>5s', min: 5000, max: 99999 },
  ];

  const counts = buckets.map(b => data.filter(d => d.latency_ms >= b.min && d.latency_ms < b.max).length);
  const max = Math.max(...counts, 1);

  const handleMouseDown = (i: number) => (e: React.MouseEvent) => { e.preventDefault(); setDragStart(i); setDragEnd(i); };
  const handleMouseEnter = (i: number) => () => { if (dragStart != null) setDragEnd(i); };
  const handleMouseUp = () => {
    if (dragStart != null && dragEnd != null && onSelectRange) {
      const lo = Math.min(dragStart, dragEnd);
      const hi = Math.max(dragStart, dragEnd);
      onSelectRange(buckets[lo].min, buckets[hi].max);
    }
    setDragStart(null); setDragEnd(null);
  };

  const isSelected = (i: number) =>
    dragStart != null && dragEnd != null &&
    i >= Math.min(dragStart, dragEnd) && i <= Math.max(dragStart, dragEnd);

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-tertiary">{t('apm.durationDistribution')}</h4>
        {dragStart != null && dragEnd != null && (
          <span className="text-[11px] font-mono text-accent-primary">
            {buckets[Math.min(dragStart, dragEnd)].min}ms – {buckets[Math.max(dragStart, dragEnd)].max >= 99999 ? '∞' : fmtRange(buckets[Math.max(dragStart, dragEnd)].max)}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1 h-24 cursor-crosshair select-none">
        {buckets.map((b, i) => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1"
            onMouseDown={handleMouseDown(i)} onMouseEnter={handleMouseEnter(i)}>
            <span className={`text-[10px] font-mono tabular-nums ${
              isSelected(i) ? 'text-accent-primary' : counts[i] > max * 0.5 ? 'text-accent-danger' : 'text-fg-secondary'
            }`}>{counts[i]}</span>
            <div className="w-full rounded-t transition-all" style={{
              height: `${Math.max((counts[i] / max) * 72, 2)}px`,
              backgroundColor: isSelected(i)
                ? 'var(--accent-primary)'
                : b.min >= 500 ? 'var(--accent-danger)' : b.min >= 100 ? 'var(--accent-warning)' : 'var(--accent-primary)',
              opacity: isSelected(i) ? 1 : 0.25 + (i / buckets.length) * 0.25,
            }} />
            <span className="text-[9px] text-fg-tertiary">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] mt-2 text-fg-tertiary">{t('apm.dragToSelect')}</p>
    </div>
  );
}

function fmtRange(ms: number): string {
  if (ms >= 5000) return (ms / 1000).toFixed(1) + 's';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}
