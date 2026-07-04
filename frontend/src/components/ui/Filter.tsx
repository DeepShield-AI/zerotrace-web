export function FilterPill({ label, active, count, onClick }: { label: string; active?: boolean; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
        active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-secondary border-edge hover:border-edge-strong'
      }`}>
      {label}
      {count != null && <span className="text-2xs opacity-70">{count}</span>}
    </button>
  );
}

export function FilterBar({ items, value, onChange }: {
  items: { key: string; label: string; count?: number }[];
  value: string; onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map(item => (
        <FilterPill key={item.key} label={item.label} count={item.count} active={value === item.key} onClick={() => onChange(item.key)} />
      ))}
    </div>
  );
}
