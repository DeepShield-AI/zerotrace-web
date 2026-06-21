import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { ReloadOutlined, ApiOutlined, NodeIndexOutlined, ClockCircleOutlined, AimOutlined, SearchOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { usePageContext } from '../hooks/usePageContext';
import TopologyMap, { TopologyNode, TopologyEdge } from '../components/TopologyMap';
import TopologySidebar from '../components/TopologySidebar';
import TimeRangePicker, { parseRange } from '../components/TimeRangePicker';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

/* ── Types ── */

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
  first_seen?: string;
  last_seen?: string;
}

interface TraceItem {
  trace_id: string;
  start_time: string;
  end_time: string;
  duration_us: number | string;
  root_service: string;
  root_operation: string;
  span_count: number | string;
  error_span_count: number | string;
  status: string;
  services?: string[];
  app_instance?: string;
}

interface TsRow {
  ts?: string; cnt?: number; avg_latency_ms?: number; error_cnt?: number;
}

interface HistBucket {
  bucket: string; cnt: number | string;
}

/* ── Helpers ── */

const num = (v: number | string | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
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
function fmtDurationUs(us?: number | string): string {
  const v = num(us) / 1000;
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return v.toFixed(0) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}
function tsLabel(ts: string): string { return ts ? ts.slice(11, 16) : ''; }
function ago(s: string): string {
  if (!s) return ''; try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; } catch { return ''; }
}

/* ── Sparkline ── */

function MiniSparkline({ data, color = '#632CA6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div className="h-6 w-20" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = 2 + (i / (data.length - 1)) * 76;
    const y = 2 + (1 - (v - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Chart theme ── */

const chartTheme = {
  color: ['#632CA6', '#2DB88D', '#E2903C', '#E65C5C', '#4799EB'],
  textStyle: { fontFamily: 'Geist Sans, system-ui, sans-serif', fontSize: 11, color: '#a1a1aa' },
  grid: { left: 50, right: 16, top: 12, bottom: 28 },
  xAxis: { axisLine: { lineStyle: { color: '#e4e4e7' } }, axisTick: { show: false }, splitLine: { show: false } },
  yAxis: { splitLine: { lineStyle: { color: '#f4f4f5' } } },
};

/* ── Timeseries Chart ── */

function TimeseriesChart({ data, series, height, yFormatter, areaStyle }: {
  data: TsRow[]; series: { name: string; key: string; color?: string }[]; height?: number;
  yFormatter?: (v: number) => string; areaStyle?: boolean;
}) {
  const h = height || 200;
  const { t } = useTranslation();
  if (!data.length) return <div className="flex items-center justify-center text-xs text-zinc-400" style={{ height: h }}>{t('apm.noData')}</div>;
  const ts = data.map(d => tsLabel(d.ts || ''));
  const option = {
    ...chartTheme,
    tooltip: { trigger: 'axis' as const, valueFormatter: yFormatter ? (v: any) => yFormatter(v) : undefined },
    xAxis: { ...chartTheme.xAxis, data: ts, axisLabel: { interval: Math.max(Math.floor(ts.length / 8), 0) } },
    yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: yFormatter } },
    series: series.map(s => ({
      name: s.name, type: 'line', data: data.map(d => num((d as any)[s.key])),
      smooth: true, symbol: 'none', lineStyle: { width: 2, color: s.color },
      areaStyle: areaStyle ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: (s.color || '#632CA6') + '20' }, { offset: 1, color: (s.color || '#632CA6') + '02' }
      ]) } : undefined,
    })),
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: h }} notMerge lazyUpdate />;
}

/* ── Latency Histogram ── */

function LatencyHistogram({ data }: { data: HistBucket[] }) {
  if (!data.length) return null;
  const h = 180;
  const option = {
    ...chartTheme,
    tooltip: { trigger: 'axis' as const },
    xAxis: { ...chartTheme.xAxis, data: data.map(d => d.bucket), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: (v: number) => fmtN(v) } },
    series: [{
      type: 'bar', data: data.map(d => num(d.cnt)), barWidth: '60%',
      itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#8B5CF6' }, { offset: 1, color: '#A78BFA' }]), borderRadius: [6, 6, 0, 0] },
    }],
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: h }} notMerge lazyUpdate />;
}

/* ── Mini duration bar ── */

function MiniDurationBar({ durationUs, maxDurationUs, status }: {
  durationUs: number; maxDurationUs: number; status: string;
}) {
  const pct = maxDurationUs > 0 ? Math.min((durationUs / maxDurationUs) * 100, 100) : 0;
  const color = status === 'ok' ? '#632CA6' : '#E65C5C';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-mono text-zinc-500 w-16 text-right">{fmtDurationUs(durationUs)}</span>
    </div>
  );
}

/* ── Skeleton ── */

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2"><div className="skeleton h-5 w-32 rounded" /></div>
      ))}
    </div>
  );
}

/* ── SortCaret ── */

function SortCaret({ active, dir }: { active: boolean; dir: string }) {
  return (
    <span className={`ml-1 inline-flex flex-col leading-none ${active ? 'text-[#632CA6]' : 'text-zinc-300'}`}>
      <svg width="8" height="4" viewBox="0 0 8 4" className={dir === 'asc' && active ? 'opacity-100' : 'opacity-30'}><path d="M4 0L0 4h8z" fill="currentColor"/></svg>
      <svg width="8" height="4" viewBox="0 0 8 4" className={dir === 'desc' && active ? 'opacity-100' : 'opacity-30'}><path d="M4 4L0 0h8z" fill="currentColor"/></svg>
    </span>
  );
}

/* ── KPI Card ── */

function KpiCard({ label, value, sub, sparkline, color = '#632CA6', alert }: {
  label: string; value: string; sub?: string; sparkline?: number[]; color?: string; alert?: boolean;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className={`text-2xl font-bold font-mono tracking-tight ${alert ? 'text-red-500' : ''}`} style={{ color: alert ? undefined : color }}>
          {value}
        </p>
        {sparkline && sparkline.length >= 2 && <MiniSparkline data={sparkline} color={color} />}
      </div>
      {sub && <p className="text-[11px] text-zinc-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Service list item (compact sidebar style) ── */

function ServiceRow({ service, selected, onClick, sortBy }: {
  service: ServiceItem; selected: boolean; onClick: () => void; sortBy: string;
}) {
  const errPct = num(service.error_rate_pct);
  const healthColor = errPct > 5 ? '#E65C5C' : errPct > 1 ? '#E2903C' : '#2DB88D';
  const secondary = sortBy === 'latency' ? fmtLatency(service.avg_latency_ms) :
    sortBy === 'errors' ? `${errPct.toFixed(1)}%` : fmtN(service.request_count);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 text-[12px] transition-all flex items-center gap-2.5 group border-b border-zinc-50 ${
        selected ? 'bg-[#F3F0FA] border-l-[3px] border-l-[#632CA6]' : 'hover:bg-zinc-50 border-l-[3px] border-l-transparent'
      }`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: healthColor }} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-800 truncate group-hover:text-[#632CA6] transition-colors">{service.service_name}</p>
      </div>
      <span className="text-[10px] text-zinc-400 font-mono shrink-0">{secondary}</span>
    </button>
  );
}

/* ── Main Page ── */

export default function APMPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') as 'services' | 'traces' | 'topology' | null;
  const validView = viewParam === 'traces' || viewParam === 'topology' ? viewParam : 'services';
  const [view, setView] = useState<'services' | 'traces' | 'topology'>(validView);
  const navigate = useNavigate();
  const [range, setRange] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [tracesTotal, setTracesTotal] = useState(0);
  const [tracesPage, setTracesPage] = useState(0);
  const [statsOverall, setStatsOverall] = useState<any>(null);
  const [statsRate, setStatsRate] = useState<TsRow[]>([]);
  const [statsHistogram, setStatsHistogram] = useState<HistBucket[]>([]);
  const [query, setQuery] = useState('');
  const [facetStatus, setFacetStatus] = useState('');
  const [facetService, setFacetService] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [sortBy, setSortBy] = useState<'latency' | 'requests' | 'errors'>('requests');
  const [traceSortBy, setTraceSortBy] = useState<string>('time');
  const [traceSortDir, setTraceSortDir] = useState<string>('desc');
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]);
  const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);
  const [topoSearch, setTopoSearch] = useState('');
  const [topoSizing, setTopoSizing] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [topoLayout, setTopoLayout] = useState<'force' | 'circular'>('force');
  const [topoHighlighted, setTopoHighlighted] = useState<string | undefined>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const { setPageContext } = usePageContext();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const v = searchParams.get('view') as 'services' | 'traces' | 'topology' | null;
    if (v === 'traces' || v === 'topology') setView(v);
    else if (!v) setView('services');
  }, [searchParams]);

  const { start, end } = parseRange(range);

  const effectiveQuery = useMemo(() => {
    const parts: string[] = [];
    if (query) parts.push(query);
    if (facetStatus) parts.push(`status:${facetStatus}`);
    if (facetService) parts.push(`service:${facetService}`);
    return parts.join(' ').trim();
  }, [query, facetStatus, facetService]);

  const queryParams = useMemo(() => ({ query: effectiveQuery || undefined, start, end }), [effectiveQuery, start, end]);

  useEffect(() => {
    setPageContext({ currentPage: 'apm', activeView: view, timeRange: range, query: effectiveQuery || undefined, services: services.map(s => s.service_name).slice(0, 20) });
  }, [view, range, effectiveQuery, services, setPageContext]);

  const fetchServices = useCallback(async () => {
    try { const data = await api.getApmServices(queryParams); setServices(data.services || []); } catch {}
  }, [queryParams]);

  const fetchStats = useCallback(async () => {
    try { const data = await api.getApmStats(queryParams); setStatsOverall((data.overall || [])[0] || null); setStatsRate(data.rate || []); setStatsHistogram(data.latency_histogram || []); } catch {}
  }, [queryParams]);

  const fetchTraces = useCallback(async (page = 0) => {
    try { const data = await api.getApmTraces({ ...queryParams, limit: 20, offset: page * 20, sort: traceSortBy, sort_dir: traceSortDir }); setTraces(data.traces || []); setTracesTotal(data.total || 0); setTracesPage(page); } catch {}
  }, [queryParams, traceSortBy, traceSortDir]);

  const fetchTopology = useCallback(async () => {
    setTopoLoading(true);
    try { const data = await api.getApmTopology({ query: effectiveQuery || undefined, start, end }); setTopoNodes(data.nodes || []); setTopoEdges(data.edges || []); } catch {} finally { setTopoLoading(false); }
  }, [effectiveQuery, start, end]);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchServices(), fetchStats(), fetchTraces(0), fetchTopology()]).finally(() => setLoading(false));
  }, [fetchServices, fetchStats, fetchTraces, fetchTopology]);

  useEffect(() => { fetchAll(); }, [start, end]);
  useEffect(() => { const t = setTimeout(() => { fetchServices(); fetchStats(); if (view === 'traces') fetchTraces(0); if (view === 'topology') fetchTopology(); }, 300); return () => clearTimeout(t); }, [query, facetStatus, facetService]);
  useEffect(() => { if (view === 'traces') fetchTraces(0); if (view === 'topology') fetchTopology(); }, [view, traceSortBy, traceSortDir]);
  useEffect(() => {
    intervalRef.current = setInterval(() => { fetchStats(); if (view === 'traces') fetchTraces(tracesPage); if (view === 'topology') fetchTopology(); }, 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [view, tracesPage, traceSortBy, traceSortDir, fetchStats, fetchTraces, fetchTopology]);

  // Keyboard shortcut: Cmd/Ctrl+K for search focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const overall = statsOverall;
  const maxDuration = useMemo(() => traces.length > 0 ? Math.max(...traces.map(t => num(t.duration_us))) : 1, [traces]);

  // Filtered services for sidebar
  const filteredServices = useMemo(() => {
    let list = serviceSearch
      ? services.filter(s => s.service_name.toLowerCase().includes(serviceSearch.toLowerCase()))
      : [...services];
    switch (sortBy) {
      case 'latency': list.sort((a, b) => num(b.avg_latency_ms) - num(a.avg_latency_ms)); break;
      case 'errors': list.sort((a, b) => num(b.error_rate_pct) - num(a.error_rate_pct)); break;
      default: list.sort((a, b) => num(b.request_count) - num(a.request_count));
    }
    return list;
  }, [services, serviceSearch, sortBy]);

  // Group services for list
  const serviceGroups = useMemo(() => ({
    error: filteredServices.filter(s => num(s.error_rate_pct) > 5),
    warning: filteredServices.filter(s => num(s.error_rate_pct) >= 1 && num(s.error_rate_pct) <= 5),
    healthy: filteredServices.filter(s => num(s.error_rate_pct) < 1),
  }), [filteredServices]);

  const toggleTraceSort = (col: string) => {
    if (traceSortBy === col) setTraceSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setTraceSortBy(col); setTraceSortDir('desc'); }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-bold text-zinc-900">APM</h1>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
          <Button icon={<ReloadOutlined />} onClick={fetchAll} size="small" className="border-zinc-200" />
        </div>
      </div>

      {/* ── Environment / search bar ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('apm.searchPlaceholder', { defaultValue: 'Search services, traces, operations...' })}
            className="w-full h-9 pl-10 pr-3 text-[13px] border border-zinc-200 rounded-lg bg-white
              placeholder:text-zinc-400 focus:outline-none focus:border-[#632CA6] focus:ring-1 focus:ring-[#632CA6]/10 transition-all"
          />
        </div>
        {/* Active filters */}
        {facetStatus && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3F0FA] border border-[#632CA6]/20 rounded-full text-[11px] text-[#632CA6] font-medium">
            status:{facetStatus}
            <button onClick={() => setFacetStatus('')} className="hover:text-[#632CA6]">×</button>
          </span>
        )}
        {facetService && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3F0FA] border border-[#632CA6]/20 rounded-full text-[11px] text-[#632CA6] font-medium">
            service:{facetService}
            <button onClick={() => setFacetService('')} className="hover:text-[#632CA6]">×</button>
          </span>
        )}
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span>/</span>
        </kbd>
      </div>

      {/* ── Nav tabs ── */}
      <div className="flex items-center border-b border-zinc-200 mb-4">
        {[
          { key: 'services' as const, label: t('apm.services'), icon: <ApiOutlined />, count: services.length },
          { key: 'traces' as const, label: t('apm.traces'), icon: <NodeIndexOutlined />, count: tracesTotal },
          { key: 'topology' as const, label: t('apm.topology'), icon: <AimOutlined />, count: topoNodes.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setView(tab.key); setSearchParams(tab.key === 'services' ? {} : { view: tab.key }, { replace: true }); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors -mb-[1px] ${
              view === tab.key ? 'border-[#632CA6] text-[#632CA6]' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            {tab.label}
            <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-mono ${
              view === tab.key ? 'bg-[#F3F0FA] text-[#632CA6]' : 'bg-zinc-100 text-zinc-500'
            }`}>{fmtN(tab.count)}</span>
          </button>
        ))}
      </div>

      {/* ── KPI row ── */}
      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <KpiCard label={t('apm.totalRequests')} value={fmtN(overall.total_requests)} color="#632CA6" sparkline={statsRate.map(r => r.cnt || 0)} />
          <KpiCard label={t('apm.avgLatency')} value={fmtLatency(overall.avg_latency_ms)} sub={`P95 ${fmtLatency(overall.p95_ms)}`} color="#E2903C" sparkline={statsRate.map(r => r.avg_latency_ms || 0)} />
          <KpiCard label={t('apm.p99Latency')} value={fmtLatency(overall.p99_ms)} sub={`Max ${fmtLatency(overall.max_latency_ms)}`} color="#4799EB" alert={num(overall.p99_ms) > 1000} />
          <KpiCard label={t('apm.errorRate')} value={`${num(overall.error_rate_pct).toFixed(2)}%`} sub={`${overall.error_count || 0} errors`} color="#E65C5C" alert={num(overall.error_rate_pct) > 5} sparkline={statsRate.map(r => r.error_cnt || 0)} />
          <KpiCard label={t('apm.traceCount')} value={fmtN(overall.trace_count)} sub={`${overall.service_count || 0} services`} color="#22c55e" />
        </div>
      )}

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">{t('apm.requestRate')}</h4>
          <TimeseriesChart data={statsRate} height={160} series={[{ name: 'req/min', key: 'cnt', color: '#632CA6' }]} areaStyle yFormatter={fmtN} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">{t('apm.latency')}</h4>
          <TimeseriesChart data={statsRate} height={160} series={[{ name: 'latency', key: 'avg_latency_ms', color: '#E2903C' }]} areaStyle yFormatter={(v) => fmtLatency(v)} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">{t('apm.errors')}</h4>
          <TimeseriesChart data={statsRate} height={160} series={[{ name: 'errors', key: 'error_cnt', color: '#E65C5C' }]} areaStyle yFormatter={fmtN} />
        </div>
      </div>

      {/* ── Latency distribution ── */}
      {statsHistogram.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-4">
          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-3">{t('apm.latencyDistribution')}</h4>
          <LatencyHistogram data={statsHistogram} />
        </div>
      )}

      {/* ── Content ── */}
      {view === 'services' ? (
        <div className="flex gap-4">
          {/* Service sidebar — Datadog-style directory */}
          <div className="w-[240px] shrink-0 bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 520px)' }}>
            <div className="p-3 border-b border-zinc-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-zinc-800">Services</h4>
                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{services.length}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: 'requests' as const, label: 'Requests' },
                  { key: 'latency' as const, label: 'Latency' },
                  { key: 'errors' as const, label: 'Errors' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded-full transition-all ${
                      sortBy === opt.key ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
              <input
                type="text" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}
                placeholder="Filter..."
                className="w-full h-7 mt-2 px-2 text-[11px] border border-zinc-200 rounded bg-white focus:outline-none focus:border-[#632CA6]"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && services.length === 0 ? <TableSkeleton rows={6} /> :
               filteredServices.length === 0 ? <p className="text-xs text-zinc-400 text-center py-8">No services</p> :
               <>
                 {serviceGroups.error.length > 0 && (
                   <div>
                     <div className="px-3 py-1.5 text-[9px] font-semibold text-red-500 uppercase tracking-wider">Error · {serviceGroups.error.length}</div>
                     {serviceGroups.error.map(s => <ServiceRow key={s.service_name} service={s} selected={facetService === s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)} sortBy={sortBy} />)}
                   </div>
                 )}
                 {serviceGroups.warning.length > 0 && (
                   <div>
                     <div className="px-3 py-1.5 text-[9px] font-semibold text-amber-500 uppercase tracking-wider">Warning · {serviceGroups.warning.length}</div>
                     {serviceGroups.warning.map(s => <ServiceRow key={s.service_name} service={s} selected={facetService === s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)} sortBy={sortBy} />)}
                   </div>
                 )}
                 <div>
                   <div className="px-3 py-1.5 text-[9px] font-semibold text-emerald-500 uppercase tracking-wider">Healthy · {serviceGroups.healthy.length}</div>
                   {serviceGroups.healthy.slice(0, 50).map(s => <ServiceRow key={s.service_name} service={s} selected={facetService === s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)} sortBy={sortBy} />)}
                 </div>
               </>
              }
            </div>
          </div>

          {/* Services table */}
          <div className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-lg overflow-hidden">
            {loading && services.length === 0 ? <TableSkeleton rows={8} /> :
             services.length === 0 ? (
              <div className="py-20 text-center">
                <ApiOutlined className="text-zinc-200 text-3xl mb-3 block mx-auto" />
                <p className="text-sm text-zinc-500">No services found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50">
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3">Service</th>
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-28">Requests</th>
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-28">Avg Latency</th>
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-20">P95</th>
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-20">P99</th>
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-32">Error Rate</th>
                    <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-20">Traces</th>
                    <th className="text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-20">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => {
                    const pct = num(s.error_rate_pct);
                    return (
                      <tr
                        key={s.service_name}
                        onClick={() => navigate(`/apm/services/${encodeURIComponent(s.service_name)}`)}
                        className="border-b border-zinc-100 hover:bg-[#F3F0FA]/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pct > 5 ? '#E65C5C' : pct > 1 ? '#E2903C' : '#2DB88D' }} />
                            <Link to={`/apm/services/${encodeURIComponent(s.service_name)}`} onClick={e => e.stopPropagation()} className="text-[13px] font-semibold text-[#632CA6] hover:underline">
                              {s.service_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-[13px] font-mono text-zinc-700">{fmtN(s.request_count)}</span></td>
                        <td className="px-4 py-3"><span className="text-[13px] font-mono text-zinc-700">{fmtLatency(s.avg_latency_ms)}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] font-mono text-zinc-500">{fmtLatency(s.p95_ms)}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] font-mono text-zinc-500">{fmtLatency(s.p99_ms)}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pct * 10, 100)}%`, backgroundColor: pct > 5 ? '#E65C5C' : pct > 1 ? '#E2903C' : '#2DB88D' }} />
                            </div>
                            <span className={`text-[12px] font-mono font-medium ${pct > 5 ? 'text-red-500' : pct > 1 ? 'text-amber-500' : 'text-zinc-500'}`}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-[13px] font-mono text-zinc-500">{fmtN(s.trace_count)}</span></td>
                        <td className="px-4 py-3 text-right"><span className="text-[12px] text-zinc-400">{ago(s.last_seen || '')}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : view === 'traces' ? (
        /* ── Traces view ── */
        <div className="flex gap-4">
          {/* Facet panel */}
          <div className="w-[220px] shrink-0 bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 520px)' }}>
            <div className="p-3 border-b border-zinc-100">
              <h4 className="text-[12px] font-semibold text-zinc-800">Filters</h4>
              {(facetStatus || facetService) && (
                <button onClick={() => { setFacetStatus(''); setFacetService(''); }}
                  className="text-[10px] text-[#632CA6] hover:underline mt-1">Clear all</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Status */}
              <div className="border-b border-zinc-100">
                <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Status</div>
                {[ { key: '', label: 'All', count: tracesTotal, dot: 'bg-zinc-400' },
                   { key: 'ok', label: 'OK', count: tracesTotal - (services.reduce((s, sv) => s + num(sv.error_count), 0)), dot: 'bg-emerald-400' },
                   { key: 'error', label: 'Error', count: services.reduce((s, sv) => s + num(sv.error_count), 0), dot: 'bg-red-400' },
                ].map(item => (
                  <button key={item.key} onClick={() => setFacetStatus(item.key)}
                    className={`w-full text-left px-3 py-2 text-[12px] transition-all flex items-center gap-2.5 ${
                      facetStatus === item.key ? 'bg-[#F3F0FA] border-l-[3px] border-l-[#632CA6]' : 'hover:bg-zinc-50 border-l-[3px] border-l-transparent'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                    {item.label}
                    <span className="ml-auto text-[10px] text-zinc-400 font-mono">{fmtN(item.count)}</span>
                  </button>
                ))}
              </div>
              {/* Top Services */}
              <div>
                <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Top Services</div>
                {services.slice(0, 20).map(s => (
                  <button key={s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)}
                    className={`w-full text-left px-3 py-2 text-[12px] transition-all flex items-center gap-2.5 ${
                      facetService === s.service_name ? 'bg-[#F3F0FA] border-l-[3px] border-l-[#632CA6]' : 'hover:bg-zinc-50 border-l-[3px] border-l-transparent'
                    }`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: num(s.error_rate_pct) > 5 ? '#E65C5C' : num(s.error_rate_pct) > 1 ? '#E2903C' : '#2DB88D' }} />
                    <span className="truncate">{s.service_name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Traces table */}
          <div className="flex-1 min-w-0 bg-white border border-zinc-200 rounded-lg overflow-hidden">
            {loading && traces.length === 0 ? <TableSkeleton rows={10} /> :
             traces.length === 0 ? (
              <div className="py-20 text-center">
                <NodeIndexOutlined className="text-zinc-200 text-3xl mb-3 block mx-auto" />
                <p className="text-sm text-zinc-500">No traces found</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/50">
                      <th className="w-8 px-4 py-3" />
                      <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-[220px]">Trace</th>
                      <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3">
                        <button onClick={() => toggleTraceSort('time')} className="hover:text-zinc-700 inline-flex items-center">Date<SortCaret active={traceSortBy==='time'} dir={traceSortDir} /></button>
                      </th>
                      <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3">Root Operation</th>
                      <th className="text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-[160px]">
                        <button onClick={() => toggleTraceSort('duration')} className="hover:text-zinc-700 inline-flex items-center">Duration<SortCaret active={traceSortBy==='duration'} dir={traceSortDir} /></button>
                      </th>
                      <th className="text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-[72px]">
                        <button onClick={() => toggleTraceSort('spans')} className="hover:text-zinc-700 inline-flex items-center">Spans<SortCaret active={traceSortBy==='spans'} dir={traceSortDir} /></button>
                      </th>
                      <th className="text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 w-16">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map(t => (
                      <tr
                        key={t.trace_id}
                        onClick={() => navigate(`/apm/traces/${encodeURIComponent(t.trace_id)}`)}
                        className="border-b border-zinc-100 hover:bg-[#F3F0FA]/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3"><span className={`w-2 h-2 rounded-full inline-block ${t.status === 'ok' ? 'bg-emerald-400' : 'bg-red-400'}`} /></td>
                        <td className="px-4 py-3">
                          <div>
                            <Link to={`/apm/traces/${encodeURIComponent(t.trace_id)}`} onClick={e => e.stopPropagation()} className="font-mono text-[12px] text-[#632CA6] hover:underline">{t.trace_id.length > 20 ? t.trace_id.slice(0, 20) + '…' : t.trace_id}</Link>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{t.root_service}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="text-[12px] text-zinc-500 font-mono">{t.start_time}</span></td>
                        <td className="px-4 py-3"><span className="text-[12px] text-zinc-600 font-mono truncate max-w-[200px] block">{t.root_operation || '—'}</span></td>
                        <td className="px-4 py-3"><MiniDurationBar durationUs={num(t.duration_us)} maxDurationUs={maxDuration} status={t.status} /></td>
                        <td className="px-4 py-3 text-right"><span className="text-[12px] font-mono text-zinc-500">{t.span_count}</span></td>
                        <td className="px-4 py-3 text-right">{num(t.error_span_count) > 0 ? <span className="text-[12px] font-mono text-red-500 font-medium">{t.error_span_count}</span> : <span className="text-zinc-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tracesTotal > 20 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 bg-zinc-50/30">
                    <span className="text-xs text-zinc-500">{tracesPage * 20 + 1}–{Math.min((tracesPage + 1) * 20, tracesTotal)} of {tracesTotal.toLocaleString()}</span>
                    <div className="flex gap-1">
                      <Button size="small" disabled={tracesPage === 0} onClick={() => fetchTraces(tracesPage - 1)}>Prev</Button>
                      <Button size="small" disabled={(tracesPage + 1) * 20 >= tracesTotal} onClick={() => fetchTraces(tracesPage + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Topology view ── */
        <div className="flex gap-4">
          <TopologySidebar
            nodes={topoNodes} edges={topoEdges}
            activeSizing={topoSizing} onSizingChange={setTopoSizing}
            activeLayout={topoLayout} onLayoutChange={setTopoLayout}
            searchQuery={topoSearch} onSearchChange={setTopoSearch}
            highlightedNode={topoHighlighted} onNodeHighlight={setTopoHighlighted}
          />
          <div className="flex-1 min-w-0">
            <TopologyMap
              nodes={topoNodes} edges={topoEdges} loading={topoLoading}
              onServiceClick={(svc) => navigate(`/apm/services/${encodeURIComponent(svc)}`)}
              onRefresh={fetchTopology}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-4 pb-8">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
        {t('apm.autoRefresh')}
      </div>
    </div>
  );
}
