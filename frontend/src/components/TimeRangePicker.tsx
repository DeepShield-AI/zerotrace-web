import { useState, useRef, useEffect, useCallback } from 'react';

/* ── Types & config ── */

export interface TimeRangeOption {
  value: string;
  label: string;
  shortLabel: string;
}

export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: '5m', label: 'Past 5 Minutes', shortLabel: '5m' },
  { value: '15m', label: 'Past 15 Minutes', shortLabel: '15m' },
  { value: '30m', label: 'Past 30 Minutes', shortLabel: '30m' },
  { value: '1h', label: 'Past 1 Hour', shortLabel: '1h' },
  { value: '4h', label: 'Past 4 Hours', shortLabel: '4h' },
  { value: '24h', label: 'Past 1 Day', shortLabel: '1d' },
  { value: '7d', label: 'Past 7 Days', shortLabel: '7d' },
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
    default: return { start: now - 3600, end: now };
  }
}

/* ── TimeRangePresets (horizontal presets for use inline) ── */

export function TimeRangePresets({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center rounded border border-zinc-200 overflow-hidden">
      {TIME_RANGE_OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-[11px] font-medium transition-colors
            ${i > 0 ? 'border-l border-zinc-200' : ''}
            ${value === opt.value
              ? 'bg-[#632CA6] text-white border-l-[#632CA6]'
              : 'bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'}
          `}
        >
          {opt.shortLabel}
        </button>
      ))}
    </div>
  );
}

/* ── TimeRangeDropdown (Datadog-style dropdown button) ── */

export default function TimeRangePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = TIME_RANGE_OPTIONS.find(o => o.value === value);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-zinc-600
          bg-white border border-zinc-200 rounded-md hover:border-zinc-300 hover:bg-zinc-50
          transition-all focus:outline-none focus:border-[#632CA6] focus:ring-1 focus:ring-[#632CA6]/10"
      >
        <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>{selected?.label || 'Past 1 Hour'}</span>
        <svg className={`w-3 h-3 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L2 4h8z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
          {TIME_RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[13px] transition-colors flex items-center justify-between
                ${value === opt.value
                  ? 'bg-[#F3F0FA] text-[#632CA6] font-semibold'
                  : 'text-zinc-600 hover:bg-zinc-50'}
              `}
            >
              <span>{opt.label}</span>
              {value === opt.value && (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
