import { useState, useRef, useEffect, useCallback } from 'react';

export type CompactSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  width?: number;
};

export default function CompactSelect({ value, onChange, options, width = 64 }: CompactSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleSelect = useCallback((opt: string) => {
    onChange(opt);
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={ref} className="relative inline-flex" style={{ width }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-1 px-2 py-0.5 text-[12px] font-medium text-fg-primary bg-bg-elevated border border-border rounded hover:border-accent-primary transition-colors"
      >
        <span className="truncate">{value}</span>
        <svg className={`w-2.5 h-2.5 text-fg-tertiary transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-elevated border border-border rounded-md shadow-lg z-50 py-1 min-w-full overflow-hidden">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-2.5 py-1.5 text-[12px] transition-colors ${
                opt === value ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-fg-primary hover:bg-bg-subtle'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
