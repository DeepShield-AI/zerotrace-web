export function LiveIndicator({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase text-accent-danger">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-danger/40 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-danger" />
      </span>
      LIVE
    </span>
  );
}

export function StatusDot({ status, size = 'sm' }: { status: 'online' | 'warning' | 'offline' | 'error'; size?: 'sm' | 'md' }) {
  const colors = { online: 'bg-severity-ok', warning: 'bg-severity-warn', offline: 'bg-severity-alert', error: 'bg-severity-alert' };
  const sizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5' };
  return (
    <span className={`${sizes[size]} rounded-full inline-block shrink-0 relative ${colors[status]}`}>
      {status === 'online' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-severity-ok/40" />}
    </span>
  );
}

export function TimeRange({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="flex items-center rounded border border-border overflow-hidden">
      {options.map((opt, i) => (
        <button key={opt.key} onClick={() => onChange(opt.key)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''} ${
            value === opt.key ? 'bg-bg-subtle text-fg-primary' : 'bg-bg-elevated text-fg-secondary hover:text-fg-primary'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
