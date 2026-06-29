import { useState, useRef, useEffect, useCallback } from 'react';

export interface TimeRangeOption { value: string; label: string; shortLabel: string; }

const OPTIONS: TimeRangeOption[] = [
  { value: '5m', label: 'Past 5 Minutes', shortLabel: '5m' },
  { value: '15m', label: 'Past 15 Minutes', shortLabel: '15m' },
  { value: '30m', label: 'Past 30 Minutes', shortLabel: '30m' },
  { value: '1h', label: 'Past 1 Hour', shortLabel: '1h' },
  { value: '4h', label: 'Past 4 Hours', shortLabel: '4h' },
  { value: '24h', label: 'Past 1 Day', shortLabel: '1d' },
  { value: '7d', label: 'Past 7 Days', shortLabel: '7d' },
  { value: '30d', label: 'Past 30 Days', shortLabel: '30d' },
  { value: 'custom', label: 'Custom...', shortLabel: 'Custom' },
];

export function parseRange(val: string): { start: number; end: number } {
  const now = Math.floor(Date.now() / 1000);
  switch (val) {
    case '5m': return { start: now - 300, end: now };
    case '15m': return { start: now - 900, end: now };
    case '30m': return { start: now - 1800, end: now };
    case '1h': return { start: now - 3600, end: now };
    case '4h': return { start: now - 14400, end: now };
    case '24h': return { start: now - 86400, end: now };
    case '7d': return { start: now - 604800, end: now };
    case '30d': return { start: now - 2592000, end: now };
    default: return { start: now - 3600, end: now };
  }
}

/* ── Inline presets (horizontal pill buttons) ── */
export function TimeRangePresets({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 gap-0.5">
      {OPTIONS.filter(o => o.value !== 'custom').map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
            value === o.value
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}>
          {o.shortLabel}
        </button>
      ))}
    </div>
  );
}

/* ── DD-style dropdown picker ── */
export default function TimeRangePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = OPTIONS.find(o => o.value === value) || OPTIONS[3];

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);
  useEffect(() => { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, [handleClickOutside]);

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-200">
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>{selected.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L2 4h8z"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1.5 min-w-[190px]">
          {OPTIONS.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors flex items-center justify-between ${
                value === o.value ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <span>{o.label}</span>
              {value === o.value && (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
