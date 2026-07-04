import type { ReactNode } from 'react';

type Column<T> = { key: string; label: string; render: (row: T, i: number) => ReactNode; className?: string; sortable?: boolean };

export function Table<T>({ columns, data, loading, emptyTitle, emptyDesc, onRowClick, sortKey, sortDir, onSort, rowKey }: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string; emptyDesc?: string;
  onRowClick?: (row: T) => void;
  sortKey?: string; sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  rowKey: (row: T, i: number) => string;
}) {
  if (loading) return <TableSkeleton cols={columns.length} rows={6} />;
  if (data.length === 0) return <EmptyState icon="search" title={emptyTitle || 'No data'} description={emptyDesc || ''} />;

  return (
    <div className="bg-white rounded-lg border border-edge overflow-hidden">
      <table className="w-full font-sans">
        <thead>
          <tr className="text-left border-b border-edge-light bg-surface-zebra">
            {columns.map(col => (
              <th key={col.key}
                onClick={() => col.sortable && onSort?.(col.key)}
                className={`text-2xs font-semibold uppercase tracking-wider text-ink-muted px-4 py-2.5 select-none ${col.className || ''} ${col.sortable ? 'cursor-pointer hover:text-ink-secondary' : ''}`}>
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span className="ml-1 text-ink-secondary">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={rowKey(row, i)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-edge-lighter transition-colors cursor-pointer ${
                i % 2 === 0 ? 'bg-white' : 'bg-surface-zebra'
              } hover:bg-surface-selected/50`}>
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-2.5 text-sm ${col.className || ''}`}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div className="bg-white rounded-lg border border-edge overflow-hidden">
      <div className="divide-y divide-edge-lighter">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-4 rounded animate-pulse"
                style={{ width: j === 0 ? 24 : 60 + Math.random() * 80, background: '#F1F3F5', flexShrink: 0 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricCard({ label, value, sub, color = '#632CA6', className = '' }: {
  label: string; value: string | number; sub?: string; color?: string; className?: string;
}) {
  return (
    <div className={`bg-white border border-edge rounded-lg p-4 hover:border-edge transition-colors shadow-card ${className}`}>
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="text-[18px] font-bold font-mono leading-none mt-1 tracking-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-2xs text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function Badge({ label, variant = 'default' }: { label: string; variant?: 'success' | 'warning' | 'error' | 'default' | 'purple' }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    warning: 'bg-orange-50 text-orange-700 border-orange-100',
    error: 'bg-red-50 text-red-700 border-red-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    default: 'bg-surface text-ink-secondary border-edge-light',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${styles[variant]}`}>
      {label}
    </span>
  );
}

export function EmptyState({ icon = 'search', title, description }: { icon?: 'search' | 'box' | 'check'; title: string; description: string }) {
  const icons = {
    search: <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#DEE2E6" strokeWidth="1"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    box: <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#DEE2E6" strokeWidth="1"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>,
    check: <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="#DEE2E6" strokeWidth="1"><path d="M5 13l4 4L19 7"/></svg>,
  };
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-lg border border-edge">
      <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">{icons[icon]}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-ink-muted mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="w-full h-9 pl-8 pr-3 text-sm border border-edge rounded bg-white placeholder:text-ink-placeholder focus:outline-none focus:border-edge-focus focus:ring-1 focus:ring-edge-focus/10" />
    </div>
  );
}

export function Button({ label, onClick, variant = 'primary', size = 'md', className = '' }: {
  label: string; onClick?: () => void; variant?: 'primary' | 'default' | 'ghost'; size?: 'sm' | 'md'; className?: string;
}) {
  const base = 'inline-flex items-center font-medium rounded transition-colors';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-4 py-1.5 text-sm' };
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    default: 'bg-white text-ink-secondary border border-edge hover:border-edge hover:text-ink',
    ghost: 'text-ink-secondary hover:text-ink hover:bg-surface-hover',
  };
  return (
    <button onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {label}
    </button>
  );
}
