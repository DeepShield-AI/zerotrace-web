import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import TopologyMap, { TopologyNode, TopologyEdge } from '../../components/topology/TopologyMap';
import ChartCard from '../../components/charts/ChartCard';

// ════════════════════════ HELPERS ════════════════════════
const num = (v: number | string | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
function fmtN(n?: number | string): string { const v = num(n); if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(0); }
function fmtLatency(n?: number | string): string { const v = num(n); if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return Math.round(v) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function fmtDurationUs(us?: number | string): string { const v = num(us) / 1000; if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return v.toFixed(0) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }

// ════════════════════════ TAB TYPES ════════════════════════
type Tab = 'overview' | 'resources' | 'traces' | 'errors' | 'infrastructure';

// ════════════════════════ MAIN PAGE ════════════════════════
export default function ServiceDetailPage() {
  const { t } = useTranslation();
  const { serviceName } = useParams<{ serviceName: string }>();
  const [tab, setTab] = useState<Tab>('overview');

  const detailQuery = useQuery({
    queryKey: ['apm', 'serviceDetail', serviceName],
    queryFn: () => api.getApmServiceDetail(serviceName!),
    enabled: !!serviceName,
  });

  const depsQuery = useQuery({
    queryKey: ['apm', 'serviceDeps', serviceName],
    queryFn: () => api.getApmServiceDependencies(serviceName!),
    enabled: !!serviceName,
  });

  const topoQuery = useQuery({
    queryKey: ['apm', 'topology', serviceName],
    queryFn: () => api.getApmTopology({ service: serviceName! }).catch(() => ({ nodes: [], edges: [] })),
    enabled: !!serviceName,
  });

  const tracesQuery = useQuery({
    queryKey: ['apm', 'serviceTraces', serviceName],
    queryFn: () => api.getApmTraces({ service: serviceName!, limit: 20, offset: 0 }),
    enabled: !!serviceName && tab === 'traces',
  });

  const infraQuery = useQuery({
    queryKey: ['infra', 'hosts', serviceName],
    queryFn: () => api.getInfraHosts().then((d: any) => d.hosts || []),
    enabled: !!serviceName && tab === 'infrastructure',
  });

  const errorQuery = useQuery({
    queryKey: ['apm', 'errorTraces', serviceName],
    queryFn: () => api.getApmTraces({ service: serviceName!, status: 'error', limit: 20, offset: 0 }),
    enabled: !!serviceName && tab === 'errors',
  });

  const d = detailQuery.data as any;
  const overview = (d?.overview || [])[0] || null;
  const operations: any[] = d?.operations || [];
  const rate: any[] = d?.rate || [];

  const depsDown: any[] = (depsQuery.data as any)?.downstream || [];
  const depsUp: any[] = (depsQuery.data as any)?.upstream || [];

  const topoNodes: TopologyNode[] = (topoQuery.data as any)?.nodes || [];
  const topoEdges: TopologyEdge[] = (topoQuery.data as any)?.edges || [];

  const allTraces: any[] = (tracesQuery.data as any)?.traces || [];
  const totalTraces = (tracesQuery.data as any)?.total || 0;
  const errorTraces: any[] = (errorQuery.data as any)?.traces || [];
  const errorCount = (errorQuery.data as any)?.total || 0;
  const infraHosts: any[] = infraQuery.data || [];

  const loading = detailQuery.isLoading || depsQuery.isLoading;
  const fetchError = detailQuery.error || depsQuery.error;

  const handleRefresh = useCallback(() => {
    detailQuery.refetch(); depsQuery.refetch(); topoQuery.refetch();
    if (tab === 'traces') tracesQuery.refetch();
    if (tab === 'errors') errorQuery.refetch();
    if (tab === 'infrastructure') infraQuery.refetch();
  }, [detailQuery, depsQuery, topoQuery, tracesQuery, errorQuery, infraQuery, tab]);

  // ════════════════════════ LOADING / ERROR ═══════════════
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (fetchError) {
    const msg = fetchError instanceof Error ? fetchError.message : 'Failed to load service data';
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-danger-bg flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-accent-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <h3 className="text-lg font-semibold text-fg-primary mb-1">Failed to load service</h3>
        <p className="text-sm text-fg-secondary mb-4">{msg}</p>
        <Link to="/apm" className="text-accent-primary hover:underline text-sm">&larr; Back to APM</Link>
      </div>
    );
  }

  // ════════════════════════ RENDER ════════════════════════
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* Header — breadcrumb style */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/apm" className="text-fg-tertiary hover:text-fg-secondary">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>
        </Link>
        <span className="text-fg-disabled text-sm">/</span>
        <Link to="/apm" className="text-xs text-fg-secondary hover:text-fg-secondary">Services</Link>
        <span className="text-fg-disabled text-sm">/</span>
        <h2 className="text-sm font-bold text-fg-primary font-mono">{serviceName}</h2>
        <div className="flex-1" />
        <button onClick={handleRefresh} className="text-fg-tertiary hover:text-fg-secondary p-1" title="Refresh">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 0111.3-2.8M14 8a6 6 0 01-11.3 2.8M2 2v4h4M14 14v-4h-4"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <nav className="flex gap-0 mb-6 border-b border-border">
        {([
          { key: 'overview' as Tab, label: `${t('apm.overview')}` },
          { key: 'resources' as Tab, label: `${t('apm.resources')} (${operations.length})` },
          { key: 'traces' as Tab, label: `${t('apm.traces')} (${totalTraces})` },
          { key: 'errors' as Tab, label: `${t('apm.errors')} (${errorCount})` },
          { key: 'infrastructure' as Tab, label: `${t('apm.infrastructure')} (${infraHosts.length})` },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${
              tab === t.key ? 'text-accent-primary border-accent-primary' : 'text-fg-secondary border-transparent hover:text-fg-primary'}`}
          >{t.label}</button>
        ))}
      </nav>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === 'overview' && (
        <>
          {/* KPI row */}
          {overview && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              {[
                { label: t('apm.totalRequests'), value: fmtN(overview.total_requests), alert: false },
                { label: t('apm.avgLatency'), value: fmtLatency(overview.avg_latency_ms), sub: `P95 ${fmtLatency(overview.p95_ms)}`, alert: false },
                { label: t('apm.p99Latency'), value: fmtLatency(overview.p99_ms), alert: num(overview.p99_ms) > 1000 },
                { label: t('apm.errorRate'), value: `${num(overview.error_rate_pct).toFixed(2)}%`, sub: `${overview.error_count || 0} ${t('apm.errors')}`, alert: num(overview.error_rate_pct) > 5 },
                { label: t('apm.latencyP95'), value: fmtLatency(overview.p95_ms), alert: false },
              ].map((kpi, i) => (
                <div key={i} className="bg-bg-elevated border border-border rounded-lg px-4 py-3">
                  <p className="text-[11px] text-fg-tertiary font-medium uppercase tracking-wider mb-0.5">{kpi.label}</p>
                  <p className={`text-xl font-bold font-mono ${kpi.alert ? 'text-accent-danger' : 'text-fg-primary'}`}>{kpi.value}</p>
                  {kpi.sub && <p className="text-[10px] text-fg-tertiary mt-0.5">{kpi.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <ChartCard title="Request Rate" data={rate}
              series={[{ name: 'req/min', key: 'cnt', color: 'var(--accent-primary)' }]} areaStyle fmt={fmtN} />
            <ChartCard title="Latency" data={rate}
              series={[{ name: 'latency', key: 'avg_latency_ms', color: 'var(--accent-warning)' }]} areaStyle fmt={fmtLatency} />
            <ChartCard title="Errors" data={rate}
              series={[{ name: 'errors', key: 'error_cnt', color: 'var(--accent-danger)' }]} areaStyle fmt={fmtN} />
          </div>

          {/* Operations + Dependencies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle bg-bg-subtle/50 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">{t('apm.operations')}</h4>
                <button onClick={() => setTab('resources')} className="text-[11px] text-accent-primary hover:underline">View all</button>
              </div>
              {operations.length === 0 ? (
                <div className="py-12 text-center text-sm text-fg-tertiary">{t('apm.noOperations')}</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-border-subtle bg-bg-subtle/50">
                    {['Operation','Requests','Avg Latency','P95','Errors'].map(h => (
                      <th key={h} className={`text-[11px] font-semibold text-fg-secondary uppercase tracking-wider px-4 py-3 ${h==='Operation'?'text-left':'text-right'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {operations.slice(0, 10).map((op, i) => (
                      <tr key={op.operation_name || i}
                        onClick={() => window.open(`/apm?view=traces&q=operation:${encodeURIComponent(op.operation_name)}+service:${encodeURIComponent(serviceName!)}`, '_self')}
                        className="border-b border-border-subtle hover:bg-bg-subtle transition-colors cursor-pointer">
                        <td className="px-4 py-3 text-sm font-mono text-accent-primary hover:underline">{op.operation_name}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtN(op.cnt)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtLatency(op.avg_latency_ms)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtLatency(op.p95_ms)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono">{num(op.error_count) > 0 ? <span className="text-accent-danger font-medium">{op.error_count}</span> : <span className="text-fg-disabled">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Dependencies */}
            <div className="space-y-4">
              <DepList title="Upstream (Callers)" color="var(--accent-success)" items={depsUp.map((d: any) => ({ name: d.upstream_service, calls: d.call_count, latency: d.avg_latency_ms, errors: d.error_count }))} emptyMsg="No upstream callers found" />
              <DepList title="Downstream (Dependencies)" color="var(--accent-primary)" items={depsDown.map((d: any) => ({ name: d.downstream_service, calls: d.call_count, latency: d.avg_latency_ms, errors: d.error_count }))} emptyMsg="No downstream dependencies found" />
            </div>
          </div>

          {/* Topology */}
          <TopologyMap nodes={topoNodes} edges={topoEdges} loading={topoQuery.isFetching}
            onServiceClick={() => {}} onRefresh={() => topoQuery.refetch()} />
        </>
      )}

      {/* ═══ RESOURCES TAB ═══ */}
      {tab === 'resources' && (
        <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-border-subtle">
              {['Operation','Requests','Avg Latency','P95','Errors','Error Rate'].map(h => (
                <th key={h} className={`text-[11px] font-semibold text-fg-secondary uppercase tracking-wider px-4 py-3 ${h==='Operation'?'text-left':'text-right'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {operations.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-sm text-fg-tertiary">No resources found</td></tr>
              ) : operations.map((op, i) => (
                <tr key={op.operation_name || i}
                  onClick={() => window.open(`/apm?view=traces&q=operation:${encodeURIComponent(op.operation_name)}+service:${encodeURIComponent(serviceName!)}`, '_self')}
                  className="border-b border-border-subtle hover:bg-bg-subtle transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-sm font-mono text-accent-primary hover:underline max-w-[400px] truncate">{op.operation_name}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtN(op.cnt)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtLatency(op.avg_latency_ms)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtLatency(op.p95_ms)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono">{num(op.error_count) > 0 ? <span className="text-accent-danger">{op.error_count}</span> : <span className="text-fg-disabled">—</span>}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono">{num(op.cnt) > 0 ? ((num(op.error_count) / num(op.cnt)) * 100).toFixed(1) + '%' : '0%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TRACES TAB ═══ */}
      {tab === 'traces' && (
        <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle bg-bg-subtle/50 flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">Traces for {serviceName}</span>
            <span className="text-[10px] text-fg-tertiary">{totalTraces} total</span>
          </div>
          {allTraces.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-bg-subtle flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-fg-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <p className="text-sm text-fg-secondary">No traces found for this service</p>
            </div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border-subtle bg-bg-subtle/50">
                {['Date','Root Operation','Duration','Spans','Status'].map(h => (
                  <th key={h} className={`text-[11px] font-semibold text-fg-secondary uppercase tracking-wider px-4 py-3 ${h==='Date'?'text-left':'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {allTraces.map((t: any, i: number) => (
                  <tr key={t.trace_id || i} className="border-b border-border-subtle hover:bg-bg-subtle cursor-pointer transition-colors"
                    onClick={() => window.open(`/apm/traces/${t.trace_id}`, '_self')}>
                    <td className="px-4 py-3 text-xs font-mono text-fg-tertiary">{t.start_time?.slice(11, 19) || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-fg-secondary max-w-[300px] truncate">{t.root_operation || '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtDurationUs(t.duration_us)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{t.span_count || '—'}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${t.status === 'ok' ? 'bg-accent-success-bg text-accent-success' : 'bg-accent-danger-bg text-accent-danger'}`}>{t.status === 'ok' ? 'OK' : 'ERR'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ ERRORS TAB ═══ */}
      {tab === 'errors' && (
        <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle"><span className="text-sm font-semibold text-fg-secondary">Error Traces</span></div>
          {errorTraces.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-accent-success-bg flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-accent-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>
              </div>
              <p className="text-sm text-fg-secondary">No errors found for this service</p>
            </div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-border-subtle">
                {['Date','Root Operation','Duration','Spans','Errors'].map(h => (
                  <th key={h} className={`text-[11px] font-semibold text-fg-secondary uppercase tracking-wider px-4 py-3 ${h==='Date'?'text-left':'text-right'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {errorTraces.map((t: any, i: number) => (
                  <tr key={t.trace_id || i} className="border-b border-border-subtle hover:bg-accent-danger-bg/30 cursor-pointer transition-colors" onClick={() => window.open(`/apm/traces/${t.trace_id}`, '_self')}>
                    <td className="px-4 py-3 text-xs font-mono text-fg-secondary">{t.start_time?.slice(0, 19) || '—'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-fg-secondary max-w-[300px] truncate">{t.root_operation || '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{fmtDurationUs(t.duration_us)}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-fg-secondary">{t.span_count || '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-accent-danger">{t.error_span_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ INFRASTRUCTURE TAB ═══ */}
      {tab === 'infrastructure' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
              Hosts running {serviceName}
            </span>
            <span className="text-[10px] text-fg-tertiary">{infraHosts.length} hosts</span>
          </div>
          {infraHosts.length === 0 ? (
            <div className="py-16 text-center bg-bg-elevated border border-border rounded-lg">
              <div className="w-12 h-12 rounded-full bg-bg-subtle flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-fg-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <p className="text-sm text-fg-secondary">No infrastructure data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {infraHosts.map((host: any, i: number) => {
                const isOnline = host.status === 'online';
                return (
                  <div key={host.ID || i} className="bg-bg-elevated border border-border rounded-lg p-4 hover:border-border-strong transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-accent-success' : host.status === 'stale' ? 'bg-accent-warning' : 'bg-accent-danger'}`} />
                      <span className="text-sm font-semibold text-fg-primary font-mono truncate">{host.NAME}</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <MetricRow label="CPU" value={`${host.cpu_pct?.toFixed(1)}%`} pct={host.cpu_pct} color="var(--accent-primary)" />
                      <MetricRow label="Memory" value={`${host.memory_pct?.toFixed(1)}%`} pct={host.memory_pct} color="var(--accent-warning)" />
                      <MetricRow label="Disk" value={`${host.disk_pct?.toFixed(1)}%`} pct={host.disk_pct} color="var(--accent-info)" />
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border-subtle text-[10px] text-fg-tertiary">
                      <span>{host.os}</span>
                      <span>{host.cpu_cores} cores</span>
                      <span className="font-mono">{host.CTRL_IP}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════ SUB-COMPONENTS ══════════════════

function MetricRow({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-fg-tertiary shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-fg-secondary w-14 text-right tabular-nums">{value}</span>
    </div>
  );
}

// ════════════════════════ SUB-COMPONENT ═══════════════════

function DepList({ title, color, items, emptyMsg }: {
  title: string; color: string;
  items: { name?: string; calls: number | string; latency: number | string; errors: number | string }[];
  emptyMsg: string;
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle bg-bg-subtle/50">
        <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} /> {title}
        </h4>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-fg-tertiary">{emptyMsg}</div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {items.filter(d => d.name).map((d, i) => (
            <Link key={i} to={`/apm/services/${encodeURIComponent(d.name || '')}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-bg-subtle transition-colors block">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-accent-primary hover:underline">{d.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-fg-secondary">
                <span>{fmtN(d.calls)} calls</span>
                <span>{fmtLatency(d.latency)}</span>
                {num(d.errors) > 0 && <span className="text-accent-danger">{d.errors} err</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
