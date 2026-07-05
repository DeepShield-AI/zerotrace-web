export function ProgressBar({ used, total, label, colorClass = 'bg-accent-primary' }: {
  used: number; total: number; label?: string; colorClass?: string;
}) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isOver = used > total;
  const overPct = isOver ? ((used - total) / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs text-fg-tertiary">
          <span>{label}</span>
          <span className="font-mono">{used.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
      )}
      <div className="h-2 bg-bg-muted rounded-full overflow-hidden flex">
        <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-severity-warn' : colorClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }} />
        {isOver && <div className="h-full bg-severity-alert rounded-r-full transition-all" style={{ width: `${Math.min(overPct, 100)}%` }} />}
      </div>
      {isOver && <p className="text-[11px] text-accent-danger font-medium">{Math.round(((used / total) - 1) * 100)}% over</p>}
    </div>
  );
}
