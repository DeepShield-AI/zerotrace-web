import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const fmtN = (n?: number | string): string => { const v = typeof n === 'string' ? parseFloat(n) : (n || 0); if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return String(Math.round(v)); };
const fmtMs = (n?: number | string): string => { const v = typeof n === 'string' ? parseFloat(n) : (n || 0); if (v >= 1000) return (v / 1000).toFixed(2) + 's'; return v.toFixed(0) + 'ms'; };

function StatusDot({ errorRate }: { errorRate: number }) {
  const c = errorRate > 5 ? 'var(--accent-danger)' : errorRate > 1 ? 'var(--accent-warning)' : 'var(--accent-success)';
  const status = errorRate > 5 ? 'warning' : errorRate > 1 ? 'degraded' : 'healthy';
  return <span title={status} className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: c }} />;
}

function MiniBar({ value, max, color = 'var(--accent-primary)', label = '' }: { value: number; max: number; color?: string; label?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="w-12 h-1 rounded-full overflow-hidden bg-bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function ApmServicesView({ services, svcState, onRetry, range }: {
  services: any[];
  svcState: 'loading' | 'data' | 'empty' | 'error';
  onRetry: () => void;
  range: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let list = search ? services.filter(s => s.service_name?.toLowerCase().includes(search.toLowerCase())) : [...services];
    const keyFn = sortKey === 'latency' ? (s: any) => Number(s.p95_ms || 0) : sortKey === 'errors' ? (s: any) => Number(s.error_rate_pct || 0) : (s: any) => Number(s.request_count || 0);
    list.sort((a, b) => sortDir === 'asc' ? keyFn(a) - keyFn(b) : keyFn(b) - keyFn(a));
    return list;
  }, [services, search, sortKey, sortDir]);

  const maxReq = Math.max(...filtered.map(s => Number(s.request_count || 0)), 1);

  const toggleSort = (k: typeof sortKey) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('desc'); } };

  if (svcState === 'loading') {
    return (
      <div className="bg-bg-elevated rounded-lg border overflow-hidden border-border">
        <div className="divide-y border-border-subtle">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-bg-muted animate-pulse shrink-0" />
              <div className="h-4 bg-bg-muted rounded animate-pulse w-36" />
              <div className="h-4 bg-bg-muted rounded animate-pulse w-16 ml-auto" />
              <div className="h-4 bg-bg-muted rounded animate-pulse w-20" />
              <div className="h-4 bg-bg-muted rounded animate-pulse w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (svcState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-elevated rounded-lg border border-border">
        <div className="w-14 h-14 rounded-full bg-accent-danger-bg flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-danger"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <p className="text-sm font-semibold text-accent-danger">Failed to load services</p>
        <button onClick={onRetry} className="mt-3 px-4 py-1.5 text-[13px] font-medium text-white rounded-md hover:opacity-90 transition-opacity bg-accent-primary">Retry</button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-elevated rounded-lg border border-border">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-bg-subtle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-fg-disabled"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        </div>
        <p className="text-sm font-semibold text-fg-primary">{search ? 'No services match your search' : 'No services found'}</p>
        <p className="text-[12px] mt-1 text-fg-tertiary">
          {search ? 'Try adjusting your search terms' : 'Instrument your first service to see it here'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-elevated rounded-lg border overflow-hidden border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle bg-bg-subtle">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-disabled" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter services..."
            className="w-full h-8 pl-8 pr-3 text-[13px] border rounded bg-bg-elevated placeholder:text-fg-disabled focus:outline-none focus:border-accent-primary border-border"
             />
        </div>
        <span className="text-[11px] text-fg-tertiary">{filtered.length} services</span>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-wider border-b text-fg-tertiary border-border-subtle">
            <th className="w-8 pl-4 py-2"></th>
            <th className="py-2 pr-4 cursor-pointer hover:text-fg-secondary" onClick={() => toggleSort('requests')}>Service {sortKey === 'requests' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th className="px-4 py-2 text-right w-24 cursor-pointer hover:text-fg-secondary" onClick={() => toggleSort('requests')}>Requests</th>
            <th className="px-4 py-2 text-right w-24 cursor-pointer hover:text-fg-secondary" onClick={() => toggleSort('latency')}>P95 Latency</th>
            <th className="px-4 py-2 text-right w-28 cursor-pointer hover:text-fg-secondary" onClick={() => toggleSort('errors')}>Error Rate</th>
            <th className="px-4 py-2 text-right w-20 pr-4">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s, i) => {
            const ep = Number(s.error_rate_pct || 0);
            const p95 = Number(s.p95_ms || 0);
            const reqs = Number(s.request_count || 0);
            const isFav = favorites.has(s.service_name);
            return (
              <tr key={s.service_name || i}
                onClick={() => navigate('/apm/services/' + s.service_name)}
                className={`cursor-pointer transition-colors border-b ${i === filtered.length - 1 ? 'border-transparent' : 'border-border-subtle'} ${i % 2 === 0 ? 'bg-bg-elevated' : 'bg-bg-subtle'} hover:bg-accent-primary/5`}>
                {/* Favorite */}
                <td className="pl-4 py-2.5 w-8" onClick={e => { e.stopPropagation(); setFavorites(prev => { const n = new Set(prev); n.has(s.service_name) ? n.delete(s.service_name) : n.add(s.service_name); return n; }); }}>
                  <span className={`text-[13px] cursor-pointer ${isFav ? 'text-accent-primary' : 'text-fg-disabled hover:text-fg-tertiary'}`}>{isFav ? '★' : '☆'}</span>
                </td>
                {/* Service name + dot */}
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    <StatusDot errorRate={ep} />
                    <span className="text-[13px] font-medium truncate max-w-[200px] text-accent-primary">{s.service_name}</span>
                  </div>
                </td>
                {/* Requests + mini bar */}
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <MiniBar value={reqs} max={maxReq} />
                    <span className="text-[12px] font-mono tabular-nums text-fg-secondary">{fmtN(reqs)}</span>
                  </div>
                </td>
                {/* P95 Latency */}
                <td className="px-4 py-2.5 text-right">
                  <span className="text-[12px] font-mono tabular-nums" style={{ color: p95 > 500 ? 'var(--accent-danger)' : p95 > 100 ? 'var(--accent-warning)' : 'var(--fg-secondary)' }}>{fmtMs(p95)}</span>
                </td>
                {/* Error Rate */}
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <MiniBar value={ep * 10} max={100} color={ep > 5 ? 'var(--accent-danger)' : ep > 1 ? 'var(--accent-warning)' : 'var(--accent-success)'} />
                    <span className="text-[12px] font-mono tabular-nums" style={{ color: ep > 5 ? 'var(--accent-danger)' : ep > 1 ? 'var(--accent-warning)' : 'var(--fg-secondary)' }}>{ep.toFixed(1)}%</span>
                  </div>
                </td>
                {/* Last Seen */}
                <td className="px-4 py-2.5 text-right pr-4">
                  <span className="text-[11px] font-mono text-fg-tertiary">{ago(s.last_seen)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ago(s: string): string {
  if (!s) return '—';
  try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; } catch { return ''; }
}
