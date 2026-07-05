import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spin, Tooltip } from 'antd';
import { ArrowLeftOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { api } from '../../api/client';
import TopologyMap, { TopologyNode, TopologyEdge } from '../../components/TopologyMap';

// ════════════════════════ HELPERS ════════════════════════
const num = (v: number | string | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
function fmtN(n?: number | string): string { const v = num(n); if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(0); }
function fmtLatency(n?: number | string): string { const v = num(n); if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return Math.round(v) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function fmtDurationUs(us?: number | string): string { const v = num(us) / 1000; if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return v.toFixed(0) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }

// ════════════════════════ CHART THEME ════════════════════════
const chartTheme = {
  color: ['#632CA6', '#2DB88D', '#E2903C', '#E65C5C', '#4799EB'],
  textStyle: { fontFamily: 'inherit', fontSize: 11, color: '#a1a1aa' },
  grid: { left: 50, right: 16, top: 12, bottom: 28 },
  xAxis: { axisLine: { lineStyle: { color: '#e4e4e7' } }, axisTick: { show: false }, splitLine: { show: false } },
  yAxis: { splitLine: { lineStyle: { color: '#f4f4f5' } } },
};

// ════════════════════════ TAB TYPES ════════════════════════
type Tab = 'overview' | 'resources' | 'errors';

// ════════════════════════ MAIN PAGE ════════════════════════
export default function ServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overview data
  const [overview, setOverview] = useState<any>(null);
  const [operations, setOperations] = useState<any[]>([]);
  const [rate, setRate] = useState<any[]>([]);
  const [depsDown, setDepsDown] = useState<any[]>([]);
  const [depsUp, setDepsUp] = useState<any[]>([]);
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]);
  const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);

  // Error traces
  const [errorTraces, setErrorTraces] = useState<any[]>([]);
  const [errorCount, setErrorCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!serviceName) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, deps, topo] = await Promise.all([
        api.getApmServiceDetail(serviceName),
        api.getApmServiceDependencies(serviceName),
        api.getApmTopology({ service: serviceName }).catch(() => ({ nodes: [], edges: [] })),
      ]);
      setOverview((detail.overview || [])[0] || null);
      setOperations(detail.operations || []);
      setRate(detail.rate || []);
      setDepsDown(deps.downstream || []);
      setDepsUp(deps.upstream || []);
      setTopoNodes(topo.nodes || []);
      setTopoEdges(topo.edges || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load service data');
    } finally {
      setLoading(false);
    }
  }, [serviceName]);

  const fetchErrors = useCallback(async () => {
    if (!serviceName) return;
    try {
      const d = await api.getApmTraces({ service: serviceName, status: 'error', limit: 20, offset: 0 });
      setErrorTraces(d.traces || []);
      setErrorCount(d.total || 0);
    } catch { /* ignore */ }
  }, [serviceName]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'errors') fetchErrors(); }, [tab, fetchErrors]);

  const handleTopoRefresh = useCallback(async () => {
    if (!serviceName) return;
    setTopoLoading(true);
    try {
      const topo = await api.getApmTopology({ service: serviceName });
      setTopoNodes(topo.nodes || []);
      setTopoEdges(topo.edges || []);
    } catch { /* ignore */ } finally { setTopoLoading(false); }
  }, [serviceName]);

  // ════════════════════════ LOADING / ERROR ════════════════════════
  if (loading) return <div className="flex items-center justify-center py-32"><Spin size="large" /></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <WarningOutlined className="text-accent-danger text-2xl mb-4" />
      <h3 className="text-lg font-semibold text-fg-primary mb-1">Failed to load service</h3>
      <p className="text-sm text-fg-secondary mb-4">{error}</p>
      <Link to="/apm" className="text-accent-primary hover:underline text-sm">&larr; Back to APM</Link>
    </div>
  );

  // ════════════════════════ RENDER ════════════════════════
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link to="/apm" className="text-fg-tertiary hover:text-fg-secondary"><ArrowLeftOutlined /></Link>
        <span className="text-fg-disabled text-sm">/</span>
        <Link to="/apm" className="text-xs text-fg-secondary hover:text-fg-secondary">Services</Link>
        <span className="text-fg-disabled text-sm">/</span>
        <h2 className="text-sm font-bold text-fg-primary font-mono">{serviceName}</h2>
        <div className="flex-1" />
        <Tooltip title="Refresh"><button onClick={fetchData} className="text-fg-tertiary hover:text-fg-secondary"><ReloadOutlined /></button></Tooltip>
      </div>

      {/* Tabs */}
      <nav className="flex gap-0 mb-6 border-b border-border">
        {([
          { key: 'overview' as Tab, label: 'Overview' },
          { key: 'resources' as Tab, label: `Resources (${operations.length})` },
          { key: 'errors' as Tab, label: `Errors (${errorCount})` },
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
                { label: 'Total Requests', value: fmtN(overview.total_requests), sub: null, alert: false },
                { label: 'Avg Latency', value: fmtLatency(overview.avg_latency_ms), sub: `P95 ${fmtLatency(overview.p95_ms)}`, alert: false },
                { label: 'P99 Latency', value: fmtLatency(overview.p99_ms), sub: null, alert: num(overview.p99_ms) > 1000 },
                { label: 'Error Rate', value: `${num(overview.error_rate_pct).toFixed(2)}%`, sub: `${overview.error_count || 0} errors`, alert: num(overview.error_rate_pct) > 5 },
                { label: 'P95 Latency', value: fmtLatency(overview.p95_ms), sub: null, alert: false },
              ].map((kpi, i) => (
                <div key={i} className="bg-bg-elevated border border-border rounded-lg px-4 py-3">
                  <p className="text-[11px] text-fg-tertiary font-medium uppercase tracking-wider mb-0.5">{kpi.label}</p>
                  <p className={`text-xl font-bold ${kpi.alert ? 'text-accent-danger' : 'text-fg-primary'}`} style={{ fontFamily: "'Geist Mono', monospace" }}>{kpi.value}</p>
                  {kpi.sub && <p className="text-[10px] text-fg-tertiary mt-0.5">{kpi.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <ChartCard title="Request Rate" data={rate} series={[{ name: 'req/min', key: 'cnt', color: '#632CA6' }]} areaStyle fmt={fmtN} />
            <ChartCard title="Latency" data={rate} series={[{ name: 'latency', key: 'avg_latency_ms', color: '#E2903C' }]} areaStyle fmt={fmtLatency} />
            <ChartCard title="Errors" data={rate} series={[{ name: 'errors', key: 'error_cnt', color: '#E65C5C' }]} areaStyle fmt={fmtN} />
          </div>

          {/* Operations + Dependencies row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Operations table */}
            <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border-subtle bg-bg-subtle/50 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">Top Operations</h4>
                <button onClick={() => setTab('resources')} className="text-[11px] text-accent-primary hover:underline">View all</button>
              </div>
              {operations.length === 0 ? (
                <div className="py-12 text-center text-sm text-fg-tertiary">No operations found</div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-border-subtle bg-bg-subtle/50">
                    {['Operation','Requests','Avg Latency','P95','Errors'].map(h => (
                      <th key={h} className={`text-[11px] font-semibold text-fg-secondary uppercase tracking-wider px-4 py-3 ${h==='Operation'?'text-left':'text-right'}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {operations.slice(0, 10).map((op, i) => (
                      <tr key={op.operation_name || i} className="border-b border-border-subtle hover:bg-purple-50/30">
                        <td className="px-4 py-3 text-sm font-mono text-fg-secondary">{op.operation_name}</td>
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
              <DepList title="Upstream (Callers)" color="#2DB88D" items={depsUp.map(d => ({ name: d.upstream_service, calls: d.call_count, latency: d.avg_latency_ms, errors: d.error_count }))} emptyMsg="No upstream callers found" />
              <DepList title="Downstream (Dependencies)" color="#632CA6" items={depsDown.map(d => ({ name: d.downstream_service, calls: d.call_count, latency: d.avg_latency_ms, errors: d.error_count }))} emptyMsg="No downstream dependencies found" />
            </div>
          </div>

          {/* Topology */}
          <TopologyMap nodes={topoNodes} edges={topoEdges} loading={topoLoading} onServiceClick={(svc) => {}} onRefresh={handleTopoRefresh} />
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
                <tr key={op.operation_name || i} className="border-b border-border-subtle hover:bg-purple-50/30">
                  <td className="px-4 py-3 text-sm font-mono text-fg-secondary max-w-[400px] truncate">{op.operation_name}</td>
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
                  <tr key={t.trace_id || i} className="border-b border-border-subtle hover:bg-accent-danger-bg/30 cursor-pointer" onClick={() => window.open(`/apm/traces/${t.trace_id}`, '_self')}>
                    <td className="px-4 py-3 text-xs font-mono text-fg-secondary">{t.start_time || '—'}</td>
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

      <div className="flex items-center gap-2 text-[10px] text-fg-tertiary mt-6 pb-8">
        <span className="w-1.5 h-1.5 rounded-full bg-severity-ok" /> Data from ClickHouse via zerotrace-server
      </div>
    </div>
  );
}

// ════════════════════════ SUB-COMPONENTS ════════════════════════

function ChartCard({ title, data, series, areaStyle, fmt }: {
  title: string; data: any[]; series: { name: string; key: string; color?: string }[]; areaStyle?: boolean; fmt?: (v: number) => string;
}) {
  const h = 140;
  if (!data.length) return <div className="bg-bg-elevated border border-border rounded-lg p-4"><h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">{title}</h4><div className="flex items-center justify-center text-xs text-fg-tertiary" style={{ height: h }}>No data yet</div></div>;
  const ts = data.map(d => (d.ts || '').slice(11, 16));
  const option = {
    ...chartTheme, tooltip: { trigger: 'axis' as const, valueFormatter: fmt ? (v: any) => fmt(v) : undefined },
    xAxis: { ...chartTheme.xAxis, data: ts, axisLabel: { interval: Math.max(Math.floor(ts.length / 8), 0) } },
    yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: fmt } },
    series: series.map(s => ({
      name: s.name, type: 'line', data: data.map(d => num(d[s.key])), smooth: true, symbol: 'none', lineStyle: { width: 2, color: s.color },
      areaStyle: areaStyle ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: (s.color || '#632CA6') + '20' }, { offset: 1, color: (s.color || '#632CA6') + '02' }]) } : undefined,
    })),
  };
  return <div className="bg-bg-elevated border border-border rounded-lg p-4"><h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">{title}</h4><ReactECharts option={option} style={{ height: h }} notMerge lazyUpdate /></div>;
}

function DepList({ title, color, items, emptyMsg }: { title: string; color: string; items: { name?: string; calls: number | string; latency: number | string; errors: number | string }[]; emptyMsg: string }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle bg-bg-subtle/50"><h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} /> {title}</h4></div>
      {items.length === 0 ? <div className="py-8 text-center text-xs text-fg-tertiary">{emptyMsg}</div> : (
        <div className="divide-y divide-zinc-50">
          {items.filter(d => d.name).map((d, i) => (
            <Link key={i} to={`/apm/services/${encodeURIComponent(d.name || '')}`} className="flex items-center justify-between px-4 py-3 hover:bg-purple-50/30 block">
              <div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} /><span className="text-sm font-medium text-accent-primary hover:underline">{d.name}</span></div>
              <div className="flex items-center gap-4 text-xs font-mono text-fg-secondary"><span>{fmtN(d.calls)} calls</span><span>{fmtLatency(d.latency)}</span>{num(d.errors) > 0 && <span className="text-accent-danger">{d.errors} err</span>}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
