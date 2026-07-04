export function LiveIndicator({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase text-red-600">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      LIVE
    </span>
  );
}

export function StatusDot({ status, size = 'sm' }: { status: 'online' | 'warning' | 'offline' | 'error'; size?: 'sm' | 'md' }) {
  const colors = { online: 'bg-green-600', warning: 'bg-orange-500', offline: 'bg-red-600', error: 'bg-red-600' };
  const sizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5' };
  return (
    <span className={`${sizes[size]} rounded-full inline-block shrink-0 relative ${colors[status]}`}>
      {status === 'online' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-40" />}
    </span>
  );
}

export function TimeRange({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="flex items-center rounded border border-edge overflow-hidden">
      {options.map((opt, i) => (
        <button key={opt.key} onClick={() => onChange(opt.key)}
          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${i > 0 ? 'border-l border-edge' : ''} ${
            value === opt.key ? 'bg-surface-hover text-ink' : 'bg-white text-ink-secondary hover:text-ink'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
