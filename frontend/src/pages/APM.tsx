import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
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
import { KpiCard, StatusBadge } from '../components/Components';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

/* ── Types ── */
interface ServiceItem {
  service_name: string; request_count: number | string; avg_latency_ms: number | string;
  p50_ms: number | string; p95_ms: number | string; p99_ms: number | string;
  error_count: number | string; error_rate_pct: number | string; trace_count: number | string;
  first_seen?: string; last_seen?: string;
}
interface TraceItem {
  trace_id: string; start_time: string; end_time: string; duration_us: number | string;
  root_service: string; root_operation: string; span_count: number | string;
  error_span_count: number | string; status: string; services?: string[]; app_instance?: string;
}
interface TsRow { ts?: string; cnt?: number; avg_latency_ms?: number; error_cnt?: number; }
interface HistBucket { bucket: string; cnt: number | string; }

/* ── Helpers ── */
const num = (v: number | string | undefined): number => { if (v === undefined || v === null) return 0; const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };
function fmtN(n?: number | string): string { const v = num(n); if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(0); }
function fmtLatency(n?: number | string): string { const v = num(n); if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return Math.round(v) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function fmtDurationUs(us?: number | string): string { const v = num(us) / 1000; if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return v.toFixed(0) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function tsLabel(ts: string): string { return ts ? ts.slice(11, 16) : ''; }
function ago(s: string): string { if (!s) return ''; try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; } catch { return ''; } }

const chartTheme = {
  color: ['#632CA6', '#2DB88D', '#E2903C', '#E65C5C', '#4799EB'],
  textStyle: { fontFamily: 'Geist Sans, system-ui, sans-serif', fontSize: 11, color: '#a1a1aa' },
  grid: { left: 50, right: 16, top: 12, bottom: 28 },
  xAxis: { axisLine: { lineStyle: { color: '#e4e4e7' } }, axisTick: { show: false }, splitLine: { show: false } },
  yAxis: { splitLine: { lineStyle: { color: '#f4f4f5' } } },
};

function TimeseriesChart({ data, series, height, yFormatter, areaStyle }: { data: TsRow[]; series: { name: string; key: string; color?: string }[]; height?: number; yFormatter?: (v: number) => string; areaStyle?: boolean; }) {
  const h = height || 200; const { t } = useTranslation();
  if (!data.length) return <div className="flex items-center justify-center text-xs text-gray-400" style={{ height: h }}>{t('apm.noData')}</div>;
  const ts = data.map(d => tsLabel(d.ts || ''));
  const option = { ...chartTheme, tooltip: { trigger: 'axis' as const, valueFormatter: yFormatter ? (v: any) => yFormatter(v) : undefined }, xAxis: { ...chartTheme.xAxis, data: ts, axisLabel: { interval: Math.max(Math.floor(ts.length / 8), 0) } }, yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: yFormatter } }, series: series.map(s => ({ name: s.name, type: 'line', data: data.map(d => num((d as any)[s.key])), smooth: true, symbol: 'none', lineStyle: { width: 2, color: s.color }, areaStyle: areaStyle ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: (s.color || '#632CA6') + '20' }, { offset: 1, color: (s.color || '#632CA6') + '02' }]) } : undefined, })), };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: h }} notMerge lazyUpdate />;
}
function LatencyHistogram({ data }: { data: HistBucket[] }) { if (!data.length) return null; const h = 180;
  const option = { ...chartTheme, tooltip: { trigger: 'axis' as const }, xAxis: { ...chartTheme.xAxis, data: data.map(d => d.bucket), axisLabel: { fontSize: 10, rotate: 30 } }, yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: (v: number) => fmtN(v) } }, series: [{ type: 'bar', data: data.map(d => num(d.cnt)), barWidth: '60%', itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#8B5CF6' }, { offset: 1, color: '#A78BFA' }]), borderRadius: [6, 6, 0, 0] }, }], };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: h }} notMerge lazyUpdate />;
}
function MiniDurationBar({ durationUs, maxDurationUs, status }: { durationUs: number; maxDurationUs: number; status: string }) { const pct = maxDurationUs > 0 ? Math.min((durationUs / maxDurationUs) * 100, 100) : 0; const color = status === 'ok' ? '#632CA6' : '#E65C5C'; return (<div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }} /></div><span className="text-[12px] font-mono text-gray-500 w-16 text-right">{fmtDurationUs(durationUs)}</span></div>); }
function TableSkeleton({ rows = 5 }: { rows?: number }) { return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => (<div key={i} className="flex items-center gap-4 py-2"><div className="skeleton h-5 w-32 rounded" /></div>))}</div>; }
function MiniSparkline({ data, color = '#632CA6' }: { data: number[]; color?: string }) { if (!data || data.length < 2) return <div className="h-6 w-20" />; const max = Math.max(...data, 1); const min = Math.min(...data, 0); const range = max - min || 1; const pts = data.map((v, i) => `${2 + (i / (data.length - 1)) * 76},${2 + (1 - (v - min) / range) * 20}`).join(' '); return <svg width="80" height="24" viewBox="0 0 80 24" className="block"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

/* ════════════════════════ MAIN APM PAGE ════════════════════════ */
export default function APMPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view') as 'services' | 'traces' | 'topology' | null;
  const validView = viewParam === 'traces' || viewParam === 'topology' ? viewParam : 'services';
  const [view, setView] = useState<'services' | 'traces' | 'topology'>(validView);
  const navigate = useNavigate();
  const location = useLocation();
  const isIntroPage = location.pathname === '/apm/intro';
  const [range, setRange] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [traces, setTraces] = useState<TraceItem[]>([]); const [tracesTotal, setTracesTotal] = useState(0); const [tracesPage, setTracesPage] = useState(0);
  const [statsOverall, setStatsOverall] = useState<any>(null); const [statsRate, setStatsRate] = useState<TsRow[]>([]); const [statsHistogram, setStatsHistogram] = useState<HistBucket[]>([]);
  const [query, setQuery] = useState(''); const [facetStatus, setFacetStatus] = useState(''); const [facetService, setFacetService] = useState('');
  const [serviceSearch, setServiceSearch] = useState(''); const [sortBy, setSortBy] = useState<'latency' | 'requests' | 'errors'>('requests');
  const [traceSortBy, setTraceSortBy] = useState<string>('time'); const [traceSortDir, setTraceSortDir] = useState<string>('desc');
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]); const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]); const [topoLoading, setTopoLoading] = useState(false);
  const [topoSearch, setTopoSearch] = useState(''); const [topoSizing, setTopoSizing] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [topoLayout, setTopoLayout] = useState<'force' | 'circular'>('force'); const [topoHighlighted, setTopoHighlighted] = useState<string | undefined>();
  const [activeNavItem, setActiveNavItem] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const v = searchParams.get('view') as 'services' | 'traces' | 'topology' | null; if (v === 'traces' || v === 'topology') setView(v); else if (!v) setView('services'); }, [searchParams]);
  const { start, end } = parseRange(range);
  const effectiveQuery = useMemo(() => { const parts: string[] = []; if (query) parts.push(query); if (facetStatus) parts.push(`status:${facetStatus}`); if (facetService) parts.push(`service:${facetService}`); return parts.join(' ').trim(); }, [query, facetStatus, facetService]);
  const queryParams = useMemo(() => ({ query: effectiveQuery || undefined, start, end }), [effectiveQuery, start, end]);
  const fetchServices = useCallback(async () => { try { const data = await api.getApmServices(queryParams); setServices(data.services || []); } catch {} }, [queryParams]);
  const fetchStats = useCallback(async () => { try { const data = await api.getApmStats(queryParams); setStatsOverall((data.overall || [])[0] || null); setStatsRate(data.rate || []); setStatsHistogram(data.latency_histogram || []); } catch {} }, [queryParams]);
  const fetchTraces = useCallback(async (page = 0) => { try { const data = await api.getApmTraces({ ...queryParams, limit: 20, offset: page * 20, sort: traceSortBy, sort_dir: traceSortDir }); setTraces(data.traces || []); setTracesTotal(data.total || 0); setTracesPage(page); } catch {} }, [queryParams, traceSortBy, traceSortDir]);
  const fetchTopology = useCallback(async () => { setTopoLoading(true); try { const data = await api.getApmTopology({ query: effectiveQuery || undefined, start, end }); setTopoNodes(data.nodes || []); setTopoEdges(data.edges || []); } catch {} finally { setTopoLoading(false); } }, [effectiveQuery, start, end]);
  const fetchAll = useCallback(() => { setLoading(true); Promise.all([fetchServices(), fetchStats(), fetchTraces(0), fetchTopology()]).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetchAll(); }, [start, end]);
  useEffect(() => { const t = setTimeout(() => { fetchServices(); fetchStats(); if (view === 'traces') fetchTraces(0); if (view === 'topology') fetchTopology(); }, 300); return () => clearTimeout(t); }, [query, facetStatus, facetService]);
  useEffect(() => { if (view === 'traces') fetchTraces(0); if (view === 'topology') fetchTopology(); }, [view, traceSortBy, traceSortDir]);

  // Filter out ClickHouse error entries
  const realServices = useMemo(() => services.filter(s => s.service_name), [services]);
  const hasNoData = !loading && realServices.length === 0;

  // DD: redirect /apm → /apm/intro when no data
  useEffect(() => { if (!isIntroPage && hasNoData) { navigate('/apm/intro', { replace: true }); } }, [isIntroPage, hasNoData, navigate]);

  const overall = statsOverall;
  const maxDuration = useMemo(() => traces.length > 0 ? Math.max(...traces.map(t => num(t.duration_us))) : 1, [traces]);
  const filteredServices = useMemo(() => {
    let list = serviceSearch ? realServices.filter(s => s.service_name.toLowerCase().includes(serviceSearch.toLowerCase())) : [...realServices];
    switch (sortBy) { case 'latency': list.sort((a, b) => num(b.avg_latency_ms) - num(a.avg_latency_ms)); break; case 'errors': list.sort((a, b) => num(b.error_rate_pct) - num(a.error_rate_pct)); break; default: list.sort((a, b) => num(b.request_count) - num(a.request_count)); }
    return list;
  }, [realServices, serviceSearch, sortBy]);
  const serviceGroups = useMemo(() => ({ error: filteredServices.filter(s => num(s.error_rate_pct) > 5), warning: filteredServices.filter(s => num(s.error_rate_pct) >= 1 && num(s.error_rate_pct) <= 5), healthy: filteredServices.filter(s => num(s.error_rate_pct) < 1), }), [filteredServices]);
  const toggleTraceSort = (col: string) => { if (traceSortBy === col) setTraceSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setTraceSortBy(col); setTraceSortDir('desc'); } };

  const apmNavItems = ['Overview', 'Service Map', 'Service Performance Dashboards', 'Live Search', 'Connect Logs and Distributed Traces', 'Analytics', 'Connect Synthetics and Traces', 'Continuous Profiler', 'Data Streams Monitoring'];
  const showDataView = !isIntroPage && !hasNoData && realServices.length > 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-1">
        <div><h1 className="text-xl font-bold text-[#1C2B34]">APM</h1><p className="text-sm text-[#506e81] mt-0.5">Application Performance Monitoring</p></div>
        <div className="flex items-center gap-2"><TimeRangePicker value={range} onChange={v => setRange(v)} /><Button icon={<ReloadOutlined />} onClick={fetchAll} size="small" /></div>
      </div>

      {/* Sub-nav tabs + Search (hidden on intro page) */}
      {!isIntroPage && (
        <div className="flex items-center gap-3 mb-4 border-b border-[#d1d9e0]">
          {(['services', 'traces', 'topology', 'settings'] as const).map(k => { const labels = { services: 'Services', traces: 'Traces', topology: 'Service Map', settings: 'Settings' };
            return <button key={`tab-${k}`} onClick={() => { if (k !== 'settings') { setView(k as any); setSearchParams(k === 'services' ? {} : { view: k }); } else navigate('/apm/settings'); }} className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${view === k ? 'text-[#632CA6] border-[#632CA6]' : 'text-[#506e81] border-transparent hover:text-[#1C2B34] hover:border-[#d1d9e0]'}`}>{labels[k]}</button>;
          })}
          <div className="relative flex-1 ml-auto max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9bb4] w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={searchInputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search services, traces, operations..." className="w-full h-9 pl-10 pr-12 text-[13px] border border-[#d1d9e0] rounded bg-white placeholder:text-[#8b9bb4] focus:outline-none focus:border-[#632CA6] transition-all" />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8b9bb4] bg-[#f0f2f5] px-1.5 py-0.5 rounded font-mono">⌘/</kbd>
          </div>
        </div>
      )}

      {/* ─────── DD INTRO PAGE / NO DATA ─────── */}
      {(isIntroPage || hasNoData) && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          {/* LEFT: APM feature nav */}
          <div style={{ width: 208, flexShrink: 0 }}>
            <div className="bg-white border border-[#d1d9e0] rounded-lg overflow-hidden">
              {apmNavItems.map((item, i) => (
                <div key={i} onClick={() => setActiveNavItem(i)} style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', borderLeft: `3px solid ${activeNavItem === i ? '#f5a623' : 'transparent'}`, background: activeNavItem === i ? '#fff9e6' : 'transparent', color: activeNavItem === i ? '#1C2B34' : '#506e81', fontWeight: activeNavItem === i ? 600 : 400 }}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* CENTER: Onboarding content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', marginBottom: 4, lineHeight: 1.2 }}>Discover Zerotrace APM</h1>
            <p style={{ fontSize: 14, color: '#64748b', maxWidth: 480, lineHeight: 1.5, marginBottom: 24 }}>Now that you've set up the agent, the next step is to instrument your first service and start sending traces.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {['☕ Java','🐍 Python','🔷 .NET','💎 Ruby','🐘 PHP','🔵 Go','⬢ Node.js','⚙ C++'].map(lang => (
                <button key={lang} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#506e81', background: '#f8f9fb', border: '1px solid #d1d9e0', borderRadius: 6, cursor: 'pointer' }}>{lang}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <a href="/agents/setup" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#0E4C7A', borderRadius: 6, textDecoration: 'none' }}>Get Started<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 5l7 7-7 7M5 12h14"/></svg></a>
              <a href="#" style={{ padding: '10px 16px', fontSize: 14, fontWeight: 500, color: '#0E4C7A', textDecoration: 'none' }}>View Documentation →</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[{ t: 'Out-of-the-box performance dashboards', d: 'with easy-to-create alerts for web services, queues, and databases to monitor requests, errors, and latency' }, { t: 'Distributed traces that seamlessly correlate', d: 'to browser sessions, logs, synthetic checks, network, processes, and infrastructure metrics across hosts, containers, proxies, and serverless functions' }, { t: 'Live search on 100% of your ingested traces', d: 'with no sampling during an outage, while Zerotrace intelligently retains traces that represent errors and high latency' }].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, minWidth: 22, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2DB88D" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg></div>
                  <div><p style={{ fontSize: 14, fontWeight: 600, color: '#1E293B', marginBottom: 2 }}>{f.t}</p><p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{f.d}</p></div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Product screenshots */}
          <div style={{ width: 440, flexShrink: 0 }} className="hidden lg:block">
            <div style={{ position: 'relative', height: 420 }}>
              <div style={{ position: 'absolute', left: 0, top: 20, width: 260, height: 340, background: '#1a1d24', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', zIndex: 1, border: '1px solid #2d313a' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #2d313a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }}/><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }}/><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }}/>
                  <span style={{ fontSize: 11, color: '#8b9bb4', marginLeft: 8 }}>Service Map — 46 Services</span>
                </div>
                <div style={{ padding: 16 }}>
                  {['shopist-browser','post-payment','ad-server-grpc','jaeger-query','redis-cache','mysql-db'].map((svc, idx) => (
                    <div key={svc} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 4, background: idx % 2 === 0 ? '#252830' : 'transparent', borderRadius: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: idx === 2 ? '#E65C5C' : '#2DB88D' }}/>
                      <span style={{ fontSize: 11, color: '#c8cdd0', fontFamily: 'monospace' }}>{svc}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: idx === 2 ? '#E65C5C' : '#64748b' }}>{idx === 2 ? '3.2k err' : `${(Math.random()*5+1).toFixed(1)}k req/s`}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ position: 'absolute', right: 0, top: 40, width: 240, height: 320, background: '#1a1d24', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.25)', zIndex: 2, border: '1px solid #2d313a' }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #2d313a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }}/><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }}/><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }}/>
                  <span style={{ fontSize: 11, color: '#8b9bb4', marginLeft: 8 }}>Traces</span>
                </div>
                <div style={{ padding: 12 }}>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#c8cdd0', marginBottom: 8 }}>shopist-browser-http-client | post</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>Jun 10 13:34:58 · Duration <b style={{ color: '#E65C5C' }}>1.44 s</b></div>
                  {[{ w: 85, c: '#632CA6', l: 'browser-request' }, { w: 70, c: '#632CA6', l: 'checkout' }, { w: 45, c: '#E65C5C', l: 'PaymentSvc Error' }, { w: 55, c: '#632CA6', l: 'cart-svc' }, { w: 30, c: '#8B5CF6', l: 'inventory' }].map((bar, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#8b9bb4', width: 70, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bar.l}</span>
                      <div style={{ flex: 1, height: 8, background: '#252830', borderRadius: 2, overflow: 'hidden' }}><div style={{ width: `${bar.w}%`, height: '100%', background: bar.c, borderRadius: 2 }}/></div>
                      <span style={{ fontSize: 10, color: '#64748b', width: 30 }}>{bar.w}ms</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, padding: '4px 8px', background: '#2d1518', borderRadius: 4, border: '1px solid #5c1a1f' }}>
                    <span style={{ fontSize: 10, color: '#E65C5C' }}>⚠ PaymentServiceUnavailableError</span>
                    <span style={{ fontSize: 10, color: '#8b9bb4', display: 'block' }}>503 Unavailable</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────── DATA VIEW (only when real services exist) ─────── */}
      {showDataView && (
        <>
          {/* KPI Row */}
          {overall && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <KpiCard label="Total Requests" value={fmtN(overall.total_requests)} accent="purple" />
              <KpiCard label="Avg Latency" value={fmtLatency(overall.avg_latency_ms)} subtitle={`P95 ${fmtLatency(overall.p95_ms)}`} accent="amber" />
              <KpiCard label="P99 Latency" value={fmtLatency(overall.p99_ms)} subtitle={`Max ${fmtLatency(overall.max_latency_ms)}`} accent={num(overall.p99_ms) > 1000 ? 'red' : 'blue'} />
              <KpiCard label="Error Rate" value={`${num(overall.error_rate_pct).toFixed(2)}%`} subtitle={`${overall.error_count || 0} errors`} accent={num(overall.error_rate_pct) > 5 ? 'red' : 'green'} />
              <KpiCard label="Trace Count" value={fmtN(overall.trace_count)} subtitle={`${overall.service_count || 0} services`} accent="green" />
            </div>
          )}

          {/* Charts */}
          {statsRate.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4"><h4 className="text-[11px] font-bold text-[#506e81] uppercase tracking-wider mb-3">Request Rate</h4><TimeseriesChart data={statsRate} height={160} series={[{ name: 'req/min', key: 'cnt', color: '#632CA6' }]} areaStyle yFormatter={fmtN} /></div>
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4"><h4 className="text-[11px] font-bold text-[#506e81] uppercase tracking-wider mb-3">Latency</h4><TimeseriesChart data={statsRate} height={160} series={[{ name: 'latency', key: 'avg_latency_ms', color: '#E2903C' }]} areaStyle yFormatter={(v) => fmtLatency(v)} /></div>
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4"><h4 className="text-[11px] font-bold text-[#506e81] uppercase tracking-wider mb-3">Errors</h4><TimeseriesChart data={statsRate} height={160} series={[{ name: 'errors', key: 'error_cnt', color: '#E65C5C' }]} areaStyle yFormatter={fmtN} /></div>
            </div>
          )}

          {/* Services / Traces / Topology */}
          {view === 'services' ? (
            <div className="flex gap-4">
              <div className="w-[220px] shrink-0 bg-white border border-[#d1d9e0] rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 520px)' }}>
                <div className="px-3 py-2.5 border-b border-[#d1d9e0]">
                  <div className="flex items-center justify-between mb-2"><h4 className="text-[11px] font-semibold text-[#506e81] uppercase tracking-wider">Services</h4><span className="text-[10px] text-[#8b9bb4]">{realServices.length}</span></div>
                  <div className="flex items-center rounded bg-[#f0f2f5] p-0.5">
                    {(['requests', 'latency', 'errors'] as const).map(opt => (<button key={opt} onClick={() => setSortBy(opt)} className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${sortBy === opt ? 'bg-white text-[#1C2B34] shadow-sm' : 'text-[#8b9bb4] hover:text-[#506e81]'}`}>{opt === 'requests' ? 'Requests' : opt === 'latency' ? 'Latency' : 'Errors'}</button>))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {serviceGroups.error.length > 0 && <div><div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-[#E65C5C] uppercase">Error · {serviceGroups.error.length}</div>{serviceGroups.error.map(s => <ServiceRow key={s.service_name} s={s} selected={facetService === s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)} sortBy={sortBy} />)}</div>}
                  {serviceGroups.warning.length > 0 && <div><div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[#E2903C] uppercase">Warning · {serviceGroups.warning.length}</div>{serviceGroups.warning.map(s => <ServiceRow key={s.service_name} s={s} selected={facetService === s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)} sortBy={sortBy} />)}</div>}
                  <div><div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[#8b9bb4] uppercase">Healthy · {serviceGroups.healthy.length}</div>{serviceGroups.healthy.slice(0, 50).map(s => <ServiceRow key={s.service_name} s={s} selected={facetService === s.service_name} onClick={() => setFacetService(facetService === s.service_name ? '' : s.service_name)} sortBy={sortBy} />)}</div>
                </div>
              </div>
              <div className="flex-1 min-w-0 bg-white border border-[#d1d9e0] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-[#d1d9e0]">{['Service','Requests','Avg Latency','P95','P99','Error Rate','Traces','Seen'].map(h => (<th key={h} className="text-left text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider px-4 py-2.5">{h}</th>))}</tr></thead>
                  <tbody>{realServices.map(s => { const pct = num(s.error_rate_pct); return (<tr key={s.service_name} onClick={() => navigate(`/apm/services/${encodeURIComponent(s.service_name)}`)} className="border-b border-[#f0f2f5] hover:bg-[#f8f9fb] transition-colors cursor-pointer"><td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pct > 5 ? '#E65C5C' : pct > 1 ? '#E2903C' : '#2DB88D' }} /><Link to={`/apm/services/${encodeURIComponent(s.service_name)}`} onClick={e => e.stopPropagation()} className="text-[13px] font-medium text-[#632CA6] hover:underline">{s.service_name}</Link></div></td><td className="px-4 py-2.5"><span className="text-[13px] text-[#506e81] tabular-nums">{fmtN(s.request_count)}</span></td><td className="px-4 py-2.5"><span className="text-[13px] text-[#506e81] tabular-nums">{fmtLatency(s.avg_latency_ms)}</span></td><td className="px-4 py-2.5"><span className="text-[12px] text-[#8b9bb4] tabular-nums">{fmtLatency(s.p95_ms)}</span></td><td className="px-4 py-2.5"><span className="text-[12px] text-[#8b9bb4] tabular-nums">{fmtLatency(s.p99_ms)}</span></td><td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="w-10 h-1 bg-[#f0f2f5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(pct * 10, 100)}%`, backgroundColor: pct > 5 ? '#E65C5C' : pct > 1 ? '#E2903C' : '#2DB88D' }} /></div><span className={`text-[12px] tabular-nums font-medium ${pct > 5 ? 'text-[#E65C5C]' : pct > 1 ? 'text-[#E2903C]' : 'text-[#8b9bb4]'}`}>{pct.toFixed(1)}%</span></div></td><td className="px-4 py-2.5"><span className="text-[13px] text-[#8b9bb4] tabular-nums">{fmtN(s.trace_count)}</span></td><td className="px-4 py-2.5 text-right"><span className="text-[12px] text-[#8b9bb4]">{ago(s.last_seen || '')}</span></td></tr>);})}</tbody>
                </table>
              </div>
            </div>
          ) : view === 'traces' ? (
            <div className="flex gap-4">
              <div className="w-[220px] shrink-0 bg-white border border-[#d1d9e0] rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 520px)' }}><div className="p-3 border-b border-[#d1d9e0]"><h4 className="text-[12px] font-semibold text-[#1C2B34]">Filters</h4></div><div className="flex-1 overflow-y-auto"><div className="border-b border-[#f0f2f5]"><div className="px-3 py-2 text-[10px] font-semibold text-[#8b9bb4] uppercase tracking-wider">Status</div>{[{ key: '', label: 'All', dot: 'bg-[#8b9bb4]' },{ key: 'ok', label: 'OK', dot: 'bg-[#2DB88D]' },{ key: 'error', label: 'Error', dot: 'bg-[#E65C5C]' }].map(item => (<button key={item.key} onClick={() => setFacetStatus(item.key)} className={`w-full text-left px-3 py-2 text-[12px] transition-all flex items-center gap-2.5 ${facetStatus === item.key ? 'bg-[#f0f2f5] border-l-[2px] border-l-[#632CA6]' : 'hover:bg-[#f8f9fb] border-l-[2px] border-l-transparent'}`}><span className={`w-2 h-2 rounded-full ${item.dot}`}/>{item.label}</button>))}</div></div></div>
              <div className="flex-1 min-w-0 bg-white border border-[#d1d9e0] rounded-lg overflow-hidden">
                {traces.length > 0 ? (<table className="w-full"><thead><tr className="border-b border-[#d1d9e0]">{['','Trace','Date','Root Operation','Duration','Spans','Errors'].map(h => (<th key={h} className="text-left text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider px-4 py-2.5">{h}</th>))}</tr></thead><tbody>{traces.map(t => (<tr key={t.trace_id} onClick={() => navigate(`/apm/traces/${encodeURIComponent(t.trace_id)}`)} className="border-b border-[#f0f2f5] hover:bg-[#f8f9fb] transition-colors cursor-pointer"><td className="px-4 py-3"><span className={`w-2 h-2 rounded-full inline-block ${t.status === 'ok' ? 'bg-[#2DB88D]' : 'bg-[#E65C5C]'}`}/></td><td className="px-4 py-3"><Link to={`/apm/traces/${encodeURIComponent(t.trace_id)}`} onClick={e => e.stopPropagation()} className="font-mono text-[12px] text-[#632CA6] hover:underline">{t.trace_id?.length > 20 ? t.trace_id.slice(0, 20) + '…' : (t.trace_id || '—')}</Link><p className="text-[10px] text-[#8b9bb4] mt-0.5">{t.root_service}</p></td><td className="px-4 py-3"><span className="text-[12px] text-[#8b9bb4] font-mono">{t.start_time}</span></td><td className="px-4 py-3"><span className="text-[12px] text-[#506e81] font-mono truncate max-w-[200px] block">{t.root_operation || '—'}</span></td><td className="px-4 py-3"><MiniDurationBar durationUs={num(t.duration_us)} maxDurationUs={maxDuration} status={t.status}/></td><td className="px-4 py-3 text-right"><span className="text-[12px] font-mono text-[#8b9bb4]">{t.span_count}</span></td><td className="px-4 py-3 text-right">{num(t.error_span_count) > 0 ? <span className="text-[12px] font-mono text-[#E65C5C] font-medium">{t.error_span_count}</span> : <span className="text-[#d1d9e0]">—</span>}</td></tr>))}</tbody></table>) : (<div className="py-20 text-center"><p className="text-sm text-[#8b9bb4]">No traces found</p></div>)}
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <TopologySidebar nodes={topoNodes} edges={topoEdges} activeSizing={topoSizing} onSizingChange={setTopoSizing} activeLayout={topoLayout} onLayoutChange={setTopoLayout} searchQuery={topoSearch} onSearchChange={setTopoSearch} highlightedNode={topoHighlighted} onNodeHighlight={setTopoHighlighted}/>
              <div className="flex-1 min-w-0"><TopologyMap key={`topo-${topoNodes.length}`} nodes={topoNodes} edges={topoEdges} loading={topoLoading} onServiceClick={(svc) => navigate(`/apm/services/${encodeURIComponent(svc)}`)} onRefresh={fetchTopology}/></div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
    </div>
  );
}

/* ── Service row in sidebar ── */
function ServiceRow({ s, selected, onClick, sortBy }: { s: ServiceItem; selected: boolean; onClick: () => void; sortBy: string; }) {
  const errPct = num(s.error_rate_pct);
  const healthColor = errPct > 5 ? '#E65C5C' : errPct > 1 ? '#E2903C' : '#2DB88D';
  const secondary = sortBy === 'latency' ? fmtLatency(s.avg_latency_ms) : sortBy === 'errors' ? `${errPct.toFixed(1)}%` : fmtN(s.request_count);
  return (<button onClick={onClick} className={`w-full text-left px-3 py-2 text-[11px] transition-all flex items-center gap-2 ${selected ? 'bg-[#f0f2f5] border-l-[2px] border-l-[#632CA6]' : 'hover:bg-[#f8f9fb] border-l-[2px] border-l-transparent'}`}><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: healthColor }}/><div className="flex-1 min-w-0"><p className="text-[#1C2B34] truncate">{s.service_name}</p></div><span className="text-[10px] text-[#8b9bb4] tabular-nums shrink-0">{secondary}</span></button>);
}
