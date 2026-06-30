import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api } from '../api/client';
import TopologyMap, { TopologyNode, TopologyEdge } from '../components/TopologyMap';
import TopologySidebar from '../components/TopologySidebar';
import TimeRangePicker, { parseRange } from '../components/TimeRangePicker';
import FacetPanel from '../components/FacetPanel';
import { useDebounce } from '../hooks/useDebounce';
import type { ApmServiceItem, ApmTraceItem, ApmTsRow, ApmHistBucket, ApmStats } from '../api/types';
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// ════════════════════════ HELPERS ════════════════════════
const num = (v: number | string | undefined): number => { if (v === undefined || v === null) return 0; const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };
function fmtN(n?: number | string): string { const v = num(n); if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(0); }
function fmtLatency(n?: number | string): string { const v = num(n); if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return Math.round(v) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function fmtDurationUs(us?: number | string): string { const v = num(us) / 1000; if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return v.toFixed(0) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function ago(s: string): string { if (!s) return ''; try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; } catch { return ''; } }

function MiniDurationBar({ d, max, s }: { d: number; max: number; s: string }) {
  const p = max > 0 ? Math.min((d / max) * 100, 100) : 0;
  return (<div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(p, 1)}%`, backgroundColor: s === 'ok' ? '#632CA6' : '#E65C5C' }} /></div><span className="text-[12px] font-mono text-gray-500 w-16 text-right">{fmtDurationUs(d)}</span></div>);
}

// ════════════════════════ INTRO SIDEBAR (Datadog-style 3 items) ════════════════════════
const APM_SETUP_NAV = [
  { key: 'setup', labelKey: 'apmIntro.setupApm', icon: 'setup' },
  { key: 'rules', labelKey: 'apmIntro.instrumentationRules', icon: 'rules' },
  { key: 'errors', labelKey: 'apmIntro.instrumentationErrors', icon: 'warn' },
];

// ════════════════════════ PLATFORM LANGUAGES ════════════════════════
const LANGUAGES = ['☕ Java', '🐍 Python', '🔷 .NET', '💎 Ruby', '🐘 PHP', '🔵 Go', '⬢ Node.js', '⚙ C++'];

// ════════════════════════ SKELETON COMPONENTS ════════════════════════
function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-[#f0f2f5]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? 24 : 80 + Math.random() * 60, flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#f8f9fb] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#1C2B34] mb-1">{title}</h3>
      <p className="text-sm text-[#8b9bb4] max-w-md mb-4">{description}</p>
      {action}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#ffebee] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[#E65C5C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
      </div>
      <h3 className="text-base font-semibold text-[#E65C5C] mb-1">{message}</h3>
      <button onClick={onRetry} className="mt-3 px-5 py-2 bg-[#632CA6] text-white text-sm font-semibold rounded-md hover:bg-[#4a1d8a] transition-colors">
        Retry
      </button>
    </div>
  );
}

// ════════════════════════ CAPABILITY CARD ════════════════════════
function CapabilityCard({ title, description, theme, icon }: { title: string; description: string; theme: 'orange' | 'purple' | 'green'; icon: React.ReactNode }) {
  const themes = {
    orange: { accent: '#E2903C', bg: '#fff8f3', border: '#f5d5b0' },
    purple: { accent: '#632CA6', bg: '#f6f3fa', border: '#d4c4ed' },
    green: { accent: '#2DB88D', bg: '#e8f5e9', border: '#b8dfca' },
  };
  const t = themes[theme];

  return (
    <div className="bg-white border border-[#d1d9e0] rounded-lg overflow-hidden flex flex-col" style={{ minHeight: 280 }} data-testid={`apm-capability-card-${theme}`}>
      <div style={{ height: 4, backgroundColor: t.accent }} />
      <div className="p-5 flex-1 flex flex-col">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: t.bg, border: `1px solid ${t.border}` }}>
          {icon}
        </div>
        <h4 className="text-[14px] font-semibold text-[#1C2B34] mb-2">{title}</h4>
        <p className="text-[13px] text-[#506e81] leading-relaxed">{description}</p>

        {/* Mock visualization preview */}
        <div className="mt-auto pt-4">
          {theme === 'orange' && (
            <div className="flex items-end gap-1 h-16">
              {[40, 65, 35, 80, 50, 70, 45, 85, 55, 75, 60, 90].map((h, i) => (
                <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: h >= 70 ? '#E2903C' : '#f5d5b0', opacity: 0.7 + i * 0.02 }} />
              ))}
            </div>
          )}
          {theme === 'purple' && (
            <div className="flex flex-col gap-1.5">
              {[{ w: 85, c: '#632CA6' }, { w: 70, c: '#7a3ebf' }, { w: 55, c: '#8e62cc' }, { w: 40, c: '#a485d9' }].map((bar, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#8b9bb4] w-20 text-right">span-{i + 1}</span>
                  <div className="flex-1 h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bar.w}%`, backgroundColor: bar.c }} />
                  </div>
                  <span className="text-[10px] text-[#8b9bb4] w-8">{bar.w}ms</span>
                </div>
              ))}
            </div>
          )}
          {theme === 'green' && (
            <div className="space-y-1">
              <svg viewBox="0 0 120 40" className="w-full h-16">
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2DB88D" stopOpacity="0.3"/><stop offset="100%" stopColor="#2DB88D" stopOpacity="0.05"/></linearGradient></defs>
                <path d="M0 35 L10 28 L20 22 L30 25 L40 18 L50 15 L60 12 L70 8 L80 11 L90 6 L100 9 L110 5 L120 2" fill="none" stroke="#2DB88D" strokeWidth="2" />
                <path d="M0 35 L10 28 L20 22 L30 25 L40 18 L50 15 L60 12 L70 8 L80 11 L90 6 L100 9 L110 5 L120 2 L120 40 L0 40 Z" fill="url(#g1)" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════ MAIN COMPONENT ════════════════════════
export default function APMPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vp = searchParams.get('view') as 'services' | 'traces' | 'topology' | null;
  const [view, setView] = useState<'services' | 'traces' | 'topology'>(vp === 'traces' || vp === 'topology' ? vp : 'services');
  const navigate = useNavigate(); const location = useLocation();
  const isIntroPage = location.pathname === '/apm/intro';
  const [range, setRange] = useState('1h');

  // Services state
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ApmServiceItem[]>([]);
  const [svcState, setSvcState] = useState<'loading' | 'empty' | 'error' | 'data'>('loading');
  const [svcError, setSvcError] = useState('');

  // Traces state
  const [traces, setTraces] = useState<ApmTraceItem[]>([]);
  const [trState, setTrState] = useState<'loading' | 'empty' | 'error' | 'data'>('loading');
  const [trError, setTrError] = useState('');
  const [traceOffset, setTraceOffset] = useState(0);
  const [traceTotal, setTraceTotal] = useState(0);
  const TRACE_LIMIT = 20;

  // Stats for charts
  const [stats, setStats] = useState<ApmStats | null>(null);

  // Filters
  const [rawQuery, setRawQuery] = useState('');
  const query = useDebounce(rawQuery, 300);
  const [facetStatus, setFacetStatus] = useState('');
  const [facetService, setFacetService] = useState('');
  const [facetDuration, setFacetDuration] = useState('');
  const [svcSearch, setSvcSearch] = useState('');

  // Topology
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]);
  const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);
  const [topoSearch, setTopoSearch] = useState('');
  const [topoSizing, setTopoSizing] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [topoLayout, setTopoLayout] = useState<'force' | 'circular'>('force');
  const [topoHighlighted, setTopoHighlighted] = useState<string | undefined>();

  // Intro nav
  const [activeNav, setActiveNav] = useState('setup');

  useEffect(() => { const v = searchParams.get('view') as any; if (v === 'traces' || v === 'topology') setView(v); else if (!v) setView('services'); }, [searchParams]);
  const { start, end } = parseRange(range);
  const qp = useMemo(() => ({ query: query || undefined, start, end }), [query, start, end]);

  // Fetch services + stats
  const fetchSvc = useCallback(async () => {
    setSvcState('loading');
    setSvcError('');
    try {
      const [svcData, statsData] = await Promise.all([
        api.getApmServices(qp),
        api.getApmStats(qp).catch(() => null),
      ]);
      const svcs = (svcData?.services || []).filter((s: any) => s?.service_name);
      setServices(svcs);
      setStats(statsData as ApmStats | null);
      setSvcState(svcs.length > 0 ? 'data' : 'empty');
    } catch (err: any) {
      setSvcError(err?.message || 'Failed to load services');
      setSvcState('empty');
    } finally {
      setLoading(false);
    }
  }, [qp]);

  // Fetch traces
  const fetchTr = useCallback(async () => {
    setTrState('loading');
    setTrError('');
    try {
      const d = await api.getApmTraces({
        ...qp,
        limit: TRACE_LIMIT,
        offset: traceOffset,
        status: facetStatus || undefined,
        service: facetService || undefined,
        query: facetDuration ? facetDuration : qp.query,
      });
      const trs = d?.traces || [];
      setTraces(trs);
      setTraceTotal(d?.total || 0);
      setTrState(trs.length > 0 ? 'data' : 'empty');
    } catch (err: any) {
      setTrError(err?.message || 'Failed to load traces');
      setTrState('empty');
    }
  }, [qp, traceOffset, facetStatus]);

  const fetchTopo = useCallback(async () => {
    setTopoLoading(true);
    try {
      const d = await api.getApmTopology({ query: query || undefined, start, end });
      setTopoNodes(d.nodes || []);
      setTopoEdges(d.edges || []);
    } catch {} finally { setTopoLoading(false); }
  }, [query, start, end]);

  useEffect(() => { fetchSvc(); fetchTopo(); }, [start, end]);
  useEffect(() => { if (view === 'traces') fetchTr(); if (view === 'topology') fetchTopo(); }, [view]);

  const realServices = useMemo(() => services.filter(s => s.service_name), [services]);

  // ═══ BULLETPROOF REDIRECT: runs after every render, checks real data ═══
  useEffect(() => {
    if (svcState === 'loading') return;
    const onIntro = location.pathname === '/apm/intro';

    if (realServices.length === 0 && !onIntro) {
      // No services → redirect to intro
      navigate('/apm/intro', { replace: true });
    } else if (realServices.length > 0 && onIntro) {
      // Services appeared → redirect back to data views
      navigate('/apm', { replace: true });
    }
  }); // no deps — run after every render so location is always fresh

  const filteredServices = useMemo(() => {
    let list = svcSearch ? realServices.filter(s => s.service_name.toLowerCase().includes(svcSearch.toLowerCase())) : [...realServices];
    list.sort((a, b) => num(b.request_count) - num(a.request_count));
    return list;
  }, [realServices, svcSearch]);

  const maxDuration = useMemo(() => traces.length > 0 ? Math.max(...traces.map(t => num(t.duration_us))) : 1, [traces]);

  // ════════════════════════ ECHARTS OPTIONS ════════════════════════
  const rateChartOption = useMemo(() => ({
    grid: { left: 8, right: 8, top: 8, bottom: 8 },
    xAxis: { show: false, data: (stats?.rate || []).map((p: ApmTsRow) => p.ts?.substring(11, 19) || '') },
    yAxis: { show: false },
    series: [{
      type: 'line', data: (stats?.rate || []).map((p: ApmTsRow) => p.cnt || 0),
      smooth: true, symbol: 'none', lineStyle: { color: '#632CA6', width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(99,44,166,0.15)' }, { offset: 1, color: 'rgba(99,44,166,0.01)' }]) },
    }],
    tooltip: { trigger: 'axis' as const },
  }), [stats]);

  const latencyChartOption = useMemo(() => ({
    grid: { left: 8, right: 8, top: 8, bottom: 8 },
    xAxis: { show: false, data: (stats?.rate || []).map((p: ApmTsRow) => p.ts?.substring(11, 19) || '') },
    yAxis: { show: false },
    series: [{
      type: 'line', data: (stats?.rate || []).map((p: ApmTsRow) => p.avg_latency_ms || 0),
      smooth: true, symbol: 'none', lineStyle: { color: '#E2903C', width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(226,144,60,0.15)' }, { offset: 1, color: 'rgba(226,144,60,0.01)' }]) },
    }],
    tooltip: { trigger: 'axis' as const },
  }), [stats]);

  const errorChartOption = useMemo(() => ({
    grid: { left: 8, right: 8, top: 8, bottom: 8 },
    xAxis: { show: false, data: (stats?.rate || []).map((p: ApmTsRow) => p.ts?.substring(11, 19) || '') },
    yAxis: { show: false },
    series: [{
      type: 'line', data: (stats?.rate || []).map((p: ApmTsRow) => p.error_cnt || 0),
      smooth: true, symbol: 'none', lineStyle: { color: '#E65C5C', width: 2 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(230,92,92,0.15)' }, { offset: 1, color: 'rgba(230,92,92,0.01)' }]) },
    }],
    tooltip: { trigger: 'axis' as const },
  }), [stats]);

  const histogramOption = useMemo(() => ({
    grid: { left: 0, right: 8, top: 4, bottom: 14 },
    xAxis: { type: 'category' as const, data: (stats?.latency_histogram || []).map((b: ApmHistBucket) => b.bucket), axisLabel: { fontSize: 9, color: '#8b9bb4' }, axisTick: { show: false } },
    yAxis: { show: false },
    series: [{
      type: 'bar', data: (stats?.latency_histogram || []).map((b: ApmHistBucket) => num(b.cnt)),
      itemStyle: { color: '#632CA6', borderRadius: [2, 2, 0, 0] }, barMaxWidth: 20,
    }],
    tooltip: { trigger: 'axis' as const },
  }), [stats]);

  // ════════════════════════ INTRO PAGE RENDER ════════════════════════
  if (isIntroPage || svcState === 'empty') {
    return (
      <div className="animate-fade-in" style={{ maxWidth: 1480 }} data-testid="apm-intro">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div><h1 className="text-xl font-bold text-[#1C2B34]">APM</h1><p className="text-sm text-[#506e81] mt-0.5">Application Performance Monitoring</p></div>
          <div className="flex items-center gap-2"><TimeRangePicker value={range} onChange={v => setRange(v)} /></div>
        </div>

        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          {/* LEFT: Navigation sidebar (3 items — Datadog-style) */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="bg-white border border-[#d1d9e0] rounded-lg overflow-hidden">
              {APM_SETUP_NAV.map((item) => (
                <div
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  className="flex items-center gap-3 transition-all cursor-pointer"
                  style={{
                    padding: '12px 16px',
                    fontSize: 13,
                    borderLeft: `3px solid ${activeNav === item.key ? '#632CA6' : 'transparent'}`,
                    background: activeNav === item.key ? '#f6f3fa' : 'transparent',
                    color: activeNav === item.key ? '#1C2B34' : '#506e81',
                    fontWeight: activeNav === item.key ? 600 : 400,
                  }}
                >
                  {item.icon === 'setup' && (
                    <div style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: activeNav === item.key ? '#632CA6' : '#d1d9e0', flexShrink: 0 }} />
                  )}
                  {item.icon === 'rules' && (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: activeNav === item.key ? '#632CA6' : '#8b9bb4' }}>
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  )}
                  {item.icon === 'warn' && (
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: activeNav === item.key ? '#632CA6' : '#8b9bb4' }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
                    </svg>
                  )}
                  <span>{item.labelKey}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CENTER + RIGHT: Main content */}
          <div style={{ flex: 1 }}>
            {activeNav === 'setup' ? (
              <>
                {/* Hero section */}
                <div className="mb-10">
                  <h1 className="text-[28px] font-bold text-[#1E293B] mb-2 leading-tight" data-testid="apm-hero-title">
                    Start monitoring your services with application observability
                  </h1>
                  <p className="text-[14px] text-[#64748b] max-w-[560px] leading-relaxed mb-6">
                    Instrument your applications to collect traces, metrics, and logs — with zero code changes in many environments.
                  </p>

                  {/* Selling points */}
                  <div className="flex items-center gap-4 mb-6">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#632CA6] bg-[#f6f3fa] px-3 py-1 rounded-full border border-[#d4c4ed]">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      5-10 minutes setup
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2DB88D] bg-[#e8f5e9] px-3 py-1 rounded-full border border-[#b8dfca]">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                      Zero code changes
                    </span>
                  </div>

                  {/* Language chips */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {LANGUAGES.map(l => (
                      <button key={l} className="px-3 py-1.5 text-[12px] font-medium text-[#506e81] bg-white border border-[#d1d9e0] rounded-md hover:border-[#adb5bd] transition-colors">
                        {l}
                      </button>
                    ))}
                  </div>

                  {/* CTA buttons */}
                  <div className="flex items-center gap-3">
                    <Link
                      to="/apm/service-setup"
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-[14px] font-semibold text-white rounded-md transition-colors"
                      style={{ background: '#632CA6' }}
                      data-testid="apm-get-started-btn"
                    >
                      Get Started
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 5l7 7-7 7M5 12h14"/></svg>
                    </Link>
                    <a href="#" className="px-4 py-2.5 text-[13px] font-medium text-[#632CA6] hover:underline">View Documentation →</a>
                  </div>
                </div>

                {/* Capability cards */}
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1C2B34] mb-4">After instrumentation you'll be able to...</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <CapabilityCard
                      theme="orange"
                      title="Monitor performance"
                      description="Track throughput, latency, and error rates across all your services with pre-built dashboards."
                      icon={<svg className="w-6 h-6 text-[#E2903C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 16l4-8 4 4 4-6"/></svg>}
                    />
                    <CapabilityCard
                      theme="purple"
                      title="Troubleshoot with tracing"
                      description="Distributed tracing across services with flame graphs and waterfall views to pinpoint issues."
                      icon={<svg className="w-6 h-6 text-[#632CA6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
                    />
                    <CapabilityCard
                      theme="green"
                      title="Optimize with AI"
                      description="AI-powered insights to identify bottlenecks and optimize application performance automatically."
                      icon={<svg className="w-6 h-6 text-[#2DB88D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                    />
                  </div>
                </div>
              </>
            ) : activeNav === 'rules' ? (
              <EmptyState
                icon={<svg className="w-8 h-8 text-[#d1d9e0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
                title="No instrumentation rules"
                description="Instrumentation rules will appear here once you configure auto-instrumentation policies for your services."
              />
            ) : (
              <EmptyState
                icon={<svg className="w-8 h-8 text-[#2DB88D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>}
                title="No instrumentation errors"
                description="No errors have been detected in your instrumentation configuration."
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════ DATA VIEWS ════════════════════════
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div><h1 className="text-xl font-bold text-[#1C2B34]">APM</h1><p className="text-sm text-[#506e81] mt-0.5">Application Performance Monitoring</p></div>
        <div className="flex items-center gap-2"><TimeRangePicker value={range} onChange={v => setRange(v)} /><Button icon={<ReloadOutlined />} onClick={fetchSvc} size="small" /></div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 mb-4 border-b border-[#d1d9e0]">
        {(['services','traces','topology','settings'] as const).map(k => (
          <button
            key={`tab-${k}`}
            onClick={() => { if (k !== 'settings') { setView(k as any); setSearchParams(k === 'services' ? {} : { view: k }); } else navigate('/apm/settings'); }}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${view === k ? 'text-[#632CA6] border-[#632CA6]' : 'text-[#506e81] border-transparent hover:text-[#1C2B34]'}`}
          >
            {k === 'services' ? 'Services' : k === 'traces' ? 'Traces' : k === 'topology' ? 'Service Map' : 'Settings'}
          </button>
        ))}
        <div className="relative flex-1 ml-auto max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9bb4] w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" value={rawQuery} onChange={e => setRawQuery(e.target.value)} placeholder="Search services, traces, operations..." className="w-full h-9 pl-10 pr-12 text-[13px] border border-[#d1d9e0] rounded bg-white placeholder:text-[#8b9bb4] focus:outline-none focus:border-[#632CA6]" />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8b9bb4] bg-[#f0f2f5] px-1.5 py-0.5 rounded font-mono">⌘/</kbd>
        </div>
      </div>

      {/* Content per view */}
      {view === 'services' ? (
        <div>
          {/* Charts row */}
          {stats && (stats.rate?.length > 0) && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4">
                <h4 className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider mb-2">Request Rate</h4>
                <ReactEChartsCore echarts={echarts} option={rateChartOption} style={{ height: 80 }} notMerge />
              </div>
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4">
                <h4 className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider mb-2">Avg Latency</h4>
                <ReactEChartsCore echarts={echarts} option={latencyChartOption} style={{ height: 80 }} notMerge />
              </div>
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4">
                <h4 className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider mb-2">Error Count</h4>
                <ReactEChartsCore echarts={echarts} option={errorChartOption} style={{ height: 80 }} notMerge />
              </div>
            </div>
          )}

          {/* Services table */}
          <div className="bg-white border border-[#d1d9e0] rounded-lg" data-testid="apm-services-table">
            <div className="p-5 border-b border-[#d1d9e0]">
              <h2 className="text-base font-semibold text-[#1C2B34] mb-1">Choose an APM Service</h2>
              <p className="text-[13px] text-[#506e81]">Search or select a favorited or recently deployed service</p>
              <input value={svcSearch} onChange={e => setSvcSearch(e.target.value)} placeholder="Filter services..." className="mt-3 w-full max-w-md h-9 px-3 text-[13px] border border-[#d1d9e0] rounded bg-white placeholder:text-[#8b9bb4] focus:outline-none focus:border-[#632CA6]" />
            </div>
            {svcState === 'loading' ? (
              <TableSkeleton rows={5} cols={5} />
            ) : svcState === 'error' ? (
              <ErrorState message={svcError || 'Failed to load services'} onRetry={fetchSvc} />
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-[#d1d9e0]">{['','Service','Requests','P95 Latency','Error Rate','Last Seen'].map(h => (<th key={h} className="text-left text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider px-4 py-2.5">{h}</th>))}</tr></thead>
                <tbody>
                  {filteredServices.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-[13px] text-[#8b9bb4]">No services match your filter</td></tr>
                  ) : (
                    filteredServices.map(s => { const p = num(s.error_rate_pct); return (
                      <tr key={s.service_name} onClick={() => navigate('/apm/services/' + s.service_name)} className="border-b border-[#f0f2f5] hover:bg-[#f8f9fb] cursor-pointer">
                        <td className="pl-4 py-2.5 w-8"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p > 5 ? '#E65C5C' : p > 1 ? '#E2903C' : '#2DB88D' }} /></td>
                        <td className="py-2.5 pr-4"><span className="text-[13px] font-medium text-[#632CA6]">{s.service_name}</span></td>
                        <td className="px-4 py-2.5 text-[13px] text-[#506e81] tabular-nums">{fmtN(s.request_count)}</td>
                        <td className="px-4 py-2.5 text-[13px] text-[#8b9bb4] tabular-nums">{fmtLatency(s.p95_ms)}</td>
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-[#f0f2f5] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: Math.min(p * 10, 100) + '%', backgroundColor: p > 5 ? '#E65C5C' : p > 1 ? '#E2903C' : '#2DB88D' }} /></div><span className="text-[12px] tabular-nums">{p.toFixed(1)}%</span></div></td>
                        <td className="px-4 py-2.5 text-[12px] text-[#8b9bb4] tabular-nums">{ago(s.last_seen || '')}</td>
                      </tr>
                    );})
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : view === 'traces' ? (
        <div className="flex gap-4">
          {/* Facet sidebar — using shared FacetPanel component */}
          <div data-testid="facet-panel">
            <FacetPanel
              services={services}
              selectedStatus={facetStatus}
              selectedService={facetService}
              onStatusChange={(s) => { setFacetStatus(s); setTraceOffset(0); }}
              onServiceChange={(s) => { setFacetService(s); setTraceOffset(0); }}
              onDurationChange={(q) => { setFacetDuration(q); setTraceOffset(0); }}
              selectedDuration={facetDuration}
              tracesTotal={traceTotal}
            />
          </div>

          {/* Traces main */}
          <div className="flex-1 min-w-0" data-testid="apm-traces-table">
            {/* Duration histogram */}
            {stats?.latency_histogram && stats.latency_histogram.length > 0 && (
              <div className="bg-white border border-[#d1d9e0] rounded-lg p-4 mb-4">
                <h4 className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider mb-3">Duration Distribution</h4>
                <ReactEChartsCore echarts={echarts} option={histogramOption} style={{ height: 120 }} notMerge />
              </div>
            )}

            <div className="bg-white border border-[#d1d9e0] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[#d1d9e0]"><span className="text-sm font-semibold text-[#1C2B34]">Requests, Errors, and Latency</span></div>
              {trState === 'loading' ? (
                <TableSkeleton rows={6} cols={5} />
              ) : trState === 'error' ? (
                <ErrorState message={trError || 'Failed to load traces'} onRetry={fetchTr} />
              ) : traces.length === 0 ? (
                <EmptyState
                  icon={<svg className="w-8 h-8 text-[#d1d9e0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
                  title="No traces found"
                  description="Try adjusting your time range or search filters."
                />
              ) : (
                <>
                  <table className="w-full text-[12px]">
                    <thead><tr className="border-b border-[#d1d9e0] text-left">{['DATE', 'SERVICE', 'RESOURCE', 'DURATION', 'STATUS'].map(h => (<th key={h} className="px-3 py-2 text-[10px] font-semibold text-[#8b9bb4] uppercase tracking-wider">{h}</th>))}</tr></thead>
                    <tbody>
                      {traces.map(t => (
                        <tr key={t.trace_id} onClick={() => navigate('/apm/traces/' + t.trace_id)} className="border-b border-[#f0f2f5] hover:bg-[#f8f9fb] cursor-pointer">
                          <td className="px-3 py-2 font-mono text-[11px] text-[#8b9bb4] w-[140px]">{t.start_time}</td>
                          <td className="px-3 py-2"><span className="text-[#632CA6] font-medium">{t.root_service || '—'}</span></td>
                          <td className="px-3 py-2 text-[#506e81] font-mono truncate max-w-[200px] block">{t.root_operation || '—'}</td>
                          <td className="px-3 py-2 text-[#506e81] tabular-nums"><MiniDurationBar d={num(t.duration_us)} max={maxDuration} s={t.status} /></td>
                          <td className="px-3 py-2">{t.status === 'ok' ? <span className="text-[11px] text-[#2DB88D] bg-[#e8f5e9] px-1.5 py-0.5 rounded font-medium">200</span> : <span className="text-[11px] text-[#E65C5C] bg-[#ffebee] px-1.5 py-0.5 rounded font-medium">ERR</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {traceTotal > TRACE_LIMIT && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-[#d1d9e0] text-[12px] text-[#8b9bb4]">
                      <span>Showing {traceOffset + 1}–{Math.min(traceOffset + traces.length, traceTotal)} of {traceTotal}</span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={traceOffset === 0}
                          onClick={() => setTraceOffset(Math.max(0, traceOffset - TRACE_LIMIT))}
                          className="px-3 py-1 border border-[#d1d9e0] rounded text-[#506e81] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#adb5bd]"
                        >Prev</button>
                        <button
                          disabled={traceOffset + TRACE_LIMIT >= traceTotal}
                          onClick={() => setTraceOffset(traceOffset + TRACE_LIMIT)}
                          className="px-3 py-1 border border-[#d1d9e0] rounded text-[#506e81] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#adb5bd]"
                        >Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <TopologySidebar nodes={topoNodes} edges={topoEdges} activeSizing={topoSizing} onSizingChange={setTopoSizing} activeLayout={topoLayout} onLayoutChange={setTopoLayout} searchQuery={topoSearch} onSearchChange={setTopoSearch} highlightedNode={topoHighlighted} onNodeHighlight={setTopoHighlighted} />
          <div className="flex-1 min-w-0"><TopologyMap key={`topo-${topoNodes.length}`} nodes={topoNodes} edges={topoEdges} loading={topoLoading} onServiceClick={(svc) => navigate('/apm/services/' + svc)} onRefresh={fetchTopo} /></div>
        </div>
      )}
    </div>
  );
}
