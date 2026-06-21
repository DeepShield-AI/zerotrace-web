import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SearchOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

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
function fmtLatency(n?: number | string): string {
  const v = num(n);
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return Math.round(v) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

// ---------------------------------------------------------------------------
// Collapsible group section
// ---------------------------------------------------------------------------

function GroupSection({
  label,
  color,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  color: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-1 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {label}
        <span className="text-zinc-400 font-mono text-[11px] ml-auto">{count}</span>
        <span className="text-zinc-300">{open ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}</span>
      </button>
      {open && <div className="space-y-px">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini latency bar
// ---------------------------------------------------------------------------

function MiniLatencyBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = value > 1000 ? '#E65C5C' : value > 100 ? '#E2903C' : '#2DB88D';
  return (
    <div className="w-10 h-1 bg-zinc-100 rounded-full overflow-hidden shrink-0">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ServiceDirectory
// ---------------------------------------------------------------------------

export default function ServiceDirectory({
  services,
  selectedService,
  onServiceSelect,
  sortBy,
  loading,
}: {
  services: ServiceItem[];
  selectedService?: string;
  onServiceSelect: (serviceName: string) => void;
  sortBy: 'latency' | 'requests' | 'errors';
  loading?: boolean;
}) {
  const [search, setSearch] = useState('');

  // Filter + sort
  const filtered = useMemo(() => {
    let list = search
      ? services.filter(s => s.service_name.toLowerCase().includes(search.toLowerCase()))
      : [...services];

    switch (sortBy) {
      case 'latency':
        list.sort((a, b) => num(b.avg_latency_ms) - num(a.avg_latency_ms));
        break;
      case 'errors':
        list.sort((a, b) => num(b.error_rate_pct) - num(a.error_rate_pct));
        break;
      default:
        list.sort((a, b) => num(b.request_count) - num(a.request_count));
    }
    return list;
  }, [services, search, sortBy]);

  // Health groups
  const groups = useMemo(() => ({
    error: filtered.filter(s => num(s.error_rate_pct) > 5),
    warning: filtered.filter(s => num(s.error_rate_pct) >= 1 && num(s.error_rate_pct) <= 5),
    healthy: filtered.filter(s => num(s.error_rate_pct) < 1),
  }), [filtered]);

  const maxLatency = Math.max(...filtered.map(s => num(s.avg_latency_ms)), 1);

  const totalCount = services.length;

  return (
    <div className="w-60 shrink-0 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-zinc-800 tracking-tight">
          Service Directory
        </h3>
        <span className="text-[11px] font-mono text-zinc-400">{totalCount}</span>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-300 text-xs" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter services…"
          className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-md bg-white placeholder:text-zinc-300 focus:outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200 transition-all"
        />
      </div>

      {/* Loading skeleton */}
      {loading && services.length === 0 && (
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-xs text-zinc-400">{search ? 'No services match' : 'No services found'}</p>
        </div>
      )}

      {/* Groups */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto overscroll-contain space-y-1">
        {/* Error group */}
        {groups.error.length > 0 && (
          <GroupSection label="Error" color="#E65C5C" count={groups.error.length} defaultOpen={true}>
            {groups.error.map((s) => (
              <ServiceRow
                key={s.service_name}
                service={s}
                selected={selectedService === s.service_name}
                maxLatency={maxLatency}
                onClick={() => onServiceSelect(s.service_name)}
              />
            ))}
          </GroupSection>
        )}

        {/* Warning group */}
        {groups.warning.length > 0 && (
          <GroupSection label="Warning" color="#E2903C" count={groups.warning.length} defaultOpen={true}>
            {groups.warning.map((s) => (
              <ServiceRow
                key={s.service_name}
                service={s}
                selected={selectedService === s.service_name}
                maxLatency={maxLatency}
                onClick={() => onServiceSelect(s.service_name)}
              />
            ))}
          </GroupSection>
        )}

        {/* Healthy group */}
        {groups.healthy.length > 0 && (
          <GroupSection label="Healthy" color="#2DB88D" count={groups.healthy.length} defaultOpen={false}>
            {groups.healthy.slice(0, 50).map((s) => (
              <ServiceRow
                key={s.service_name}
                service={s}
                selected={selectedService === s.service_name}
                maxLatency={maxLatency}
                onClick={() => onServiceSelect(s.service_name)}
              />
            ))}
            {groups.healthy.length > 50 && (
              <p className="text-[11px] text-zinc-400 px-3 py-1.5 italic">
                +{groups.healthy.length - 50} more — use search to narrow
              </p>
            )}
          </GroupSection>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single service row
// ---------------------------------------------------------------------------

function ServiceRow({
  service,
  selected,
  maxLatency,
  onClick,
}: {
  service: ServiceItem;
  selected: boolean;
  maxLatency: number;
  onClick: () => void;
}) {
  const errPct = num(service.error_rate_pct);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors flex items-center gap-2 group ${
        selected
          ? 'bg-purple-50 text-purple-700 font-medium border border-purple-100'
          : 'text-zinc-600 hover:bg-zinc-50 border border-transparent'
      }`}
    >
      {/* Health dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: errPct > 5 ? '#E65C5C' : errPct > 1 ? '#E2903C' : '#2DB88D' }}
      />

      {/* Service info */}
      <div className="flex-1 min-w-0">
        <Link
          to={`/apm/services/${encodeURIComponent(service.service_name)}`}
          onClick={(e) => e.stopPropagation()}
          className={`text-xs font-medium truncate block hover:underline ${
            selected ? 'text-purple-700' : 'text-zinc-700'
          }`}
        >
          {service.service_name}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-zinc-400">{fmtN(service.request_count)} req</span>
          <span className="text-[10px] font-mono text-zinc-400">{fmtLatency(service.avg_latency_ms)}</span>
          {errPct > 0 && (
            <span className={`text-[10px] font-mono font-medium ${errPct > 5 ? 'text-red-500' : 'text-amber-500'}`}>
              {errPct.toFixed(1)}% err
            </span>
          )}
        </div>
      </div>

      {/* Mini latency bar */}
      <MiniLatencyBar value={num(service.avg_latency_ms)} max={maxLatency} />
    </button>
  );
}
