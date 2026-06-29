import { useState, type ReactNode } from 'react';

// ════════════════════════ KPI CARD ════════════════════════
export function KpiCard({ label, value, subtitle, accent = 'default', icon }: {
  label: string; value: string; subtitle?: string;
  accent?: 'purple' | 'amber' | 'green' | 'red' | 'blue' | 'default';
  icon?: ReactNode;
}) {
  const colors: Record<string, { border: string; bg: string; value: string }> = {
    purple: { border: 'border-l-brand-600', bg: 'bg-brand-50/30', value: 'text-brand-700' },
    amber: { border: 'border-l-amber-400', bg: 'bg-amber-50/30', value: 'text-amber-700' },
    green: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/30', value: 'text-emerald-700' },
    red: { border: 'border-l-red-400', bg: 'bg-red-50/30', value: 'text-red-700' },
    blue: { border: 'border-l-blue-500', bg: 'bg-blue-50/30', value: 'text-blue-700' },
    default: { border: 'border-l-gray-200', bg: 'bg-white', value: 'text-gray-900' },
  };
  const c = colors[accent];
  return (
    <div className={`rounded-lg border border-gray-200 border-l-4 ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ════════════════════════ STATUS BADGE ════════════════════════
export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' | 'md' }) {
  const m: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700', paid: 'bg-emerald-100 text-emerald-700',
    open: 'bg-blue-100 text-blue-700', pending: 'bg-amber-100 text-amber-700',
    draft: 'bg-gray-100 text-gray-600', canceled: 'bg-red-100 text-red-500',
    error: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600',
    success: 'bg-emerald-100 text-emerald-600', info: 'bg-blue-100 text-blue-600',
    failed: 'bg-red-100 text-red-600', triggered: 'bg-red-100 text-red-600',
    resolved: 'bg-emerald-100 text-emerald-600', muted: 'bg-gray-100 text-gray-500',
    critical: 'bg-red-100 text-red-700', healthy: 'bg-emerald-100 text-emerald-700',
  };
  const sizes = { xs: 'px-1.5 py-0 text-[10px]', sm: 'px-2.5 py-0.5 text-[11px]', md: 'px-3 py-1 text-xs' };
  return (
    <span className={`${sizes[size]} rounded-full font-semibold inline-flex items-center gap-1 ${m[status] || m.draft}`}>
      {status.toUpperCase()}
    </span>
  );
}

// ════════════════════════ PROGRESS BAR ════════════════════════
export function ProgressBar({ used, total, label, colorClass = 'bg-brand-600' }: {
  used: number; total: number; label?: string; colorClass?: string;
}) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isOver = used > total;
  const overPct = isOver ? ((used - total) / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{label}</span>
          <span className="font-mono">{used.toLocaleString()} / {total.toLocaleString()}</span>
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
        <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-amber-400' : colorClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }} />
        {isOver && <div className="h-full bg-red-400 rounded-r-full transition-all" style={{ width: `${Math.min(overPct, 100)}%` }} />}
      </div>
      {isOver && <p className="text-[11px] text-red-500 font-medium">{Math.round(((used / total) - 1) * 100)}% over</p>}
    </div>
  );
}

// ════════════════════════ TIME RANGE SELECTOR ════════════════════════
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
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-colors font-medium text-gray-700">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        {selected?.label || 'Custom'}
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 z-50 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 overflow-hidden">
            {TIME_RANGES.map(t => (
              <button key={t.key} onClick={() => { onChange(t.key); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${value === t.key ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════ EMPTY STATE ════════════════════════
export function EmptyState({ icon, title, description, action }: {
  icon?: string; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
      {icon && <div className="text-4xl mb-4 text-gray-200">{icon}</div>}
      <h3 className="text-base font-semibold text-gray-700 mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ════════════════════════ SPINNER ════════════════════════
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex justify-center py-20">
      <div className={`animate-spin ${sizes[size]} border-2 border-brand-600 border-t-transparent rounded-full`} />
    </div>
  );
}

// ════════════════════════ DATA TABLE ════════════════════════
interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id?: number | string }>({
  columns, rows, onRowClick, emptyMessage = 'No data',
}: {
  columns: Column<T>[]; rows: T[]; onRowClick?: (row: T) => void; emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {columns.map(col => (
              <th key={col.key} className={`py-2 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                style={col.width ? { width: col.width } : {}}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-16 text-center text-gray-300 text-sm">{emptyMessage}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i} onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-50 ${onRowClick ? 'cursor-pointer hover:bg-gray-50/50 transition-colors' : ''}`}>
                {columns.map(col => (
                  <td key={col.key} className={`py-2.5 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ════════════════════════ MODAL ════════════════════════
export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">{footer}</div>}
      </div>
    </div>
  );
}

// ════════════════════════ TABS ════════════════════════
export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-5 py-3 text-sm font-medium border-b-[2px] -mb-[2px] transition-colors ${
            active === t.key ? 'text-brand-600 border-brand-600' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
          }`}>
          {t.label}
          {t.count != null && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              active === t.key ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-500'
            }`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════ UTILITY HELPERS ════════════════════════
export const fmt = (n?: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
};

export const fmtNum = (n?: number | string): string => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return v != null ? v.toLocaleString() : '0';
};

export const fmtShort = (n?: number): string => {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(1);
};
