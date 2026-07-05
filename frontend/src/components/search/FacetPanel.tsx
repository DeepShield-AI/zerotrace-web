import { useState, useEffect } from 'react';
import { CloseOutlined, SearchOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

interface ServiceItem {
  service_name: string;
  request_count: number | string;
  avg_latency_ms: number | string;
  p50_ms: number | string;
  p95_ms: number | string;
  p99_ms: number | string;
  error_count: number | string;
  error_rate_pct: number | string;
  trace_count: number | string;
}

function num(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}
function fmtN(n?: number | string): string {
  const v = num(n);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function CollapsibleSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-semibold text-fg-tertiary uppercase tracking-wider hover:text-fg-secondary transition-colors"
      >
        {title}
        <span className="text-fg-disabled">{open ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}</span>
      </button>
      {open && <div className="space-y-0.5 mt-0.5">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini bar for distribution
// ---------------------------------------------------------------------------

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-12 h-1 bg-bg-muted rounded-full overflow-hidden shrink-0">
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// FacetPanel
// ---------------------------------------------------------------------------

export default function FacetPanel({
  services,
  selectedStatus,
  selectedService,
  onStatusChange,
  onServiceChange,
  onDurationChange,
  selectedDuration,
  tracesTotal,
  errorCount,
  okCount,
  loading,
}: {
  services: ServiceItem[];
  selectedStatus: string;
  selectedService: string;
  onStatusChange: (s: string) => void;
  onServiceChange: (s: string) => void;
  onDurationChange?: (q: string) => void;
  selectedDuration?: string;
  tracesTotal: number;
  errorCount?: number;
  okCount?: number;
  loading?: boolean;
}) {
  const [search, setSearch] = useState('');
  const hasFilters = selectedStatus !== '' || selectedService !== '';
  const maxServiceCount = Math.max(...services.map(s => num(s.request_count)), 1);

  // Compute status counts: use explicit props if provided, otherwise from trace total
  // (service-level error counts are NOT trace status counts — don't mix them)
  const errCnt = errorCount ?? 0;
  const okCnt = okCount ?? Math.max(0, tracesTotal - errCnt);

  // Filter services by search
  const filteredServices = search
    ? services.filter(s => s.service_name.toLowerCase().includes(search.toLowerCase()))
    : services;

  // Group services by health for the list view
  const groupedServices = {
    healthy: filteredServices.filter(s => num(s.error_rate_pct) < 1),
    warning: filteredServices.filter(s => num(s.error_rate_pct) >= 1 && num(s.error_rate_pct) <= 5),
    error: filteredServices.filter(s => num(s.error_rate_pct) > 5),
  };

  const statusItems = [
    { key: '', label: 'All', count: tracesTotal, dot: 'bg-fg-disabled' },
    { key: 'ok', label: 'OK', count: okCnt, dot: 'bg-severity-ok' },
    { key: 'error', label: 'Error', count: errCnt, dot: 'bg-severity-alert' },
  ];

  return (
    <div className="w-60 shrink-0 space-y-3" style={{ fontFamily: 'inherit' }}>
      {/* Title + clear */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-fg-primary">Filters</h3>
        {hasFilters && (
          <button onClick={() => { onStatusChange(''); onServiceChange(''); }}
            className="text-[11px] font-medium transition-colors flex items-center gap-1 text-accent-primary">
            <CloseOutlined style={{ fontSize: 10 }} /> Clear
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-fg-disabled" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter facets…"
          className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-border rounded-md bg-bg-elevated placeholder:text-fg-disabled focus:outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200 transition-all"
        />
      </div>

      {/* Status section */}
      <CollapsibleSection title="Status">
        {statusItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onStatusChange(item.key)}
            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2.5 ${
              selectedStatus === item.key
                ? 'bg-accent-primary/10 text-accent-primary font-medium border border-purple-100'
                : 'text-fg-secondary hover:bg-bg-subtle border border-transparent'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
            <span className="flex-1">{item.label}</span>
            <span className="text-fg-tertiary font-mono text-[11px]">{fmtN(item.count)}</span>
          </button>
        ))}
      </CollapsibleSection>

      {/* Duration section */}
      <CollapsibleSection title="Duration">
        <div className="space-y-0.5">
          {[
            { label: '< 10ms', query: 'duration:<10ms' },
            { label: '10ms – 100ms', query: 'duration:>10ms duration:<100ms' },
            { label: '100ms – 1s', query: 'duration:>100ms duration:<1s' },
            { label: '> 1s', query: 'duration:>1s' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => onDurationChange?.(item.query)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors border ${
                selectedDuration === item.query
                  ? 'bg-accent-primary/10 text-accent-primary font-medium border-purple-100'
                  : 'text-fg-secondary hover:bg-bg-subtle border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </CollapsibleSection>

      {/* Top Services section */}
      <CollapsibleSection title="Top Services" defaultOpen={false}>
        {loading && services.length === 0 ? (
          <div className="space-y-1 px-2.5 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-5 w-full rounded" />
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <p className="text-[11px] text-fg-tertiary px-2.5 py-2 italic">No services match</p>
        ) : (
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {filteredServices.slice(0, 30).map((s) => (
              <button
                key={s.service_name}
                onClick={() => onServiceChange(selectedService === s.service_name ? '' : s.service_name)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 border ${
                  selectedService === s.service_name
                    ? 'bg-accent-primary/10 text-accent-primary font-medium border-purple-100'
                    : 'text-fg-secondary hover:bg-bg-subtle border-transparent'
                }`}
              >
                {/* Health dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: num(s.error_rate_pct) > 5 ? '#E65C5C' : num(s.error_rate_pct) > 1 ? '#E2903C' : '#2DB88D' }}
                />
                {/* Name */}
                <span className="flex-1 truncate">{s.service_name}</span>
                {/* Request count + mini bar */}
                <span className="flex items-center gap-1.5 shrink-0">
                  <MiniBar value={num(s.request_count)} max={maxServiceCount} color="#632CA6" />
                  <span className="text-fg-tertiary font-mono text-[10px] w-10 text-right">{fmtN(s.request_count)}</span>
                </span>
              </button>
            ))}
            {filteredServices.length > 30 && (
              <p className="text-[11px] text-fg-tertiary px-2.5 py-1.5 italic">
                +{filteredServices.length - 30} more — use search to narrow
              </p>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
