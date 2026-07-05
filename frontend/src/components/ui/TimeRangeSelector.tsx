import { useState } from 'react';

const TIME_RANGES = [
  { key: '15m', label: '15 min' }, { key: '1h', label: '1 hour' },
  { key: '4h', label: '4 hours' }, { key: '1d', label: '1 day' },
  { key: '1w', label: '1 week' }, { key: '1mo', label: '1 month' },
  { key: '3mo', label: '3 months' }, { key: 'custom', label: 'Custom...' },
];

export function TimeRangeSelector({ value, onChange }: {
  value: string; onChange: (range: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = TIME_RANGES.find(t => t.key === value);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg bg-bg-elevated hover:border-border transition-colors font-medium text-fg-secondary">
        <svg className="w-4 h-4 text-fg-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        {selected?.label || 'Custom'}
        <svg className="w-3.5 h-3.5 text-fg-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 w-44 bg-bg-elevated border border-border rounded-xl shadow-lg py-1.5 overflow-hidden">
            {TIME_RANGES.map(t => (
              <button key={t.key} onClick={() => { onChange(t.key); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${value === t.key ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-fg-secondary hover:bg-bg-subtle'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
