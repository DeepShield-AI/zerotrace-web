import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
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
import TracesExplorer from '../components/TracesExplorer';
import { useDebounce } from '../hooks/useDebounce';
import type { ApmServiceItem, ApmTraceItem, ApmTsRow, ApmHistBucket, ApmStats } from '../api/types';
echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// ════════════════════════ DATADOG-ALIGNED COLORS ════════════════════════
const DD = {
  primary: '#632CA6',      // brand purple (our Zerotrace brand)
  link: '#632CA6',
  text: '#212529',
  textSecondary: '#6C757D',
  textMuted: '#ADB5BD',
  border: '#DEE2E6',
  borderLight: '#E9ECEF',
  bg: '#FFFFFF',
  bgHover: '#F8F9FA',
  bgSelected: '#F3F0FF',
  success: '#28A745',
  warning: '#FFC107',
  error: '#DC3545',
  sidebarBg: '#282C35',
  sidebarText: '#A0A6B0',
  sidebarActive: '#FFFFFF',
  accent: '#007BFF',
} as const;

// ════════════════════════ HELPERS ════════════════════════
const num = (v: number | string | undefined): number => { if (v === undefined || v === null) return 0; const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };
function fmtN(n?: number | string): string { const v = num(n); if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(0); }
function fmtLatency(n?: number | string): string { const v = num(n); if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return Math.round(v) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function fmtDurationUs(us?: number | string): string { const v = num(us) / 1000; if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return v.toFixed(0) + 'ms'; return (v * 1000).toFixed(0) + 'μs'; }
function ago(s: string): string { if (!s) return '—'; try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; return Math.floor(h / 24) + 'd ago'; } catch { return ''; } }

function MiniDurationBar({ d, max, s }: { d: number; max: number; s: string }) {
  const p = max > 0 ? Math.min((d / max) * 100, 100) : 0;
  return (<div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: DD.borderLight }}><div className="h-full rounded-full" style={{ width: `${Math.max(p, 1)}%`, backgroundColor: s === 'ok' ? DD.primary : DD.error }} /></div><span className="text-[12px] font-mono text-zinc-500 w-16 text-right">{fmtDurationUs(d)}</span></div>);
}

function StatusBadge({ status }: { status: string }) {
  const isOk = status === 'ok';
  return <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded ${isOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-red-500'}`} />{isOk ? 'OK' : 'ERR'}
  </span>;
}

// ════════════════════════ TABLE SKELETON ════════════════════════
function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return <div className="divide-y divide-[#F1F3F5]">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-3">
        {Array.from({ length: cols }).map((_, j) => <div key={j} className="h-4 bg-[#F1F3F5] rounded animate-pulse" style={{ width: j === 0 ? 24 : 80 + Math.random() * 60, flexShrink: 0 }} />)}
      </div>
    ))}
  </div>;
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
    <div className="w-16 h-16 rounded-full bg-[#F8F9FA] flex items-center justify-center mb-4">{icon}</div>
    <h3 className="text-base font-semibold text-[#212529] mb-1">{title}</h3>
    <p className="text-sm text-[#6C757D] max-w-md">{description}</p>
  </div>;
}

// ════════════════════════ APM INTRO (no data) ════════════════════════
const LANGUAGES = ['☕ Java', '🐍 Python', '🔷 .NET', '💎 Ruby', '🐘 PHP', '🔵 Go', '⬢ Node.js', '⚙ C++'];

const APM_SETUP_NAV = [
  { key: 'setup', label: 'Set up APM', icon: 'gear' },
  { key: 'rules', label: 'Instrumentation Rules', icon: 'file' },
  { key: 'errors', label: 'Instrumentation Errors', icon: 'warn' },
];

// ════════════════════════ MAIN COMPONENT ════════════════════════
export default function APMPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vp = searchParams.get('view') as 'services' | 'traces' | 'topology' | null;
  const [view, setView] = useState<'services' | 'traces' | 'topology'>(vp === 'traces' || vp === 'topology' ? vp : 'services');
  const navigate = useNavigate(); const location = useLocation();
  const isIntroPage = location.pathname === '/apm/intro';
  const [range, setRange] = useState('1h');

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ApmServiceItem[]>([]);
  const [svcState, setSvcState] = useState<'loading' | 'empty' | 'error' | 'data'>('loading');
  const [svcError, setSvcError] = useState('');
  const [traces, setTraces] = useState<ApmTraceItem[]>([]);
  const [trState, setTrState] = useState<'loading' | 'empty' | 'error' | 'data'>('loading');
  const [trError, setTrError] = useState('');
  const [traceOffset, setTraceOffset] = useState(0);
  const [traceTotal, setTraceTotal] = useState(0);
  const [traceOkTotal, setTraceOkTotal] = useState(0);
  const [traceErrorTotal, setTraceErrorTotal] = useState(0);
  const TRACE_LIMIT = 30;
  const [stats, setStats] = useState<ApmStats | null>(null);
  const [hasMoreTraces, setHasMoreTraces] = useState(true);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDebounce(rawQuery, 300);
  // Restore facet state from URL params (survives navigation to trace detail and back)
  const [facetStatus, setFacetStatus] = useState(searchParams.get('f_status') || '');
  const [facetService, setFacetService] = useState(searchParams.get('f_service') || '');
  const [facetDuration, setFacetDuration] = useState(searchParams.get('f_duration') || '');

  // Persist facet state to URL so it survives navigation (trace detail → back)
  const updateFacet = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (view === 'services') next.delete('view'); else next.set('view', view);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, view]);
  const [tagKeys, setTagKeys] = useState<string[]>([]);
  const [svcSearch, setSvcSearch] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]);
  const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);
  const [topoSearch, setTopoSearch] = useState('');
  const [topoSizing, setTopoSizing] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [topoLayout, setTopoLayout] = useState<'force' | 'circular'>('force');
  const [topoHighlighted, setTopoHighlighted] = useState<string | undefined>();
  const [activeNav, setActiveNav] = useState('setup');

  useEffect(() => { const v = searchParams.get('view') as any; if (v === 'traces' || v === 'topology') setView(v); else if (!v) setView('services'); }, [searchParams]);
  const { start, end } = parseRange(range);
  const qp = useMemo(() => ({ query: query || undefined, start, end }), [query, start, end]);

  // Fetch services
  const fetchSvc = useCallback(async () => {
    setSvcState('loading'); setSvcError('');
    try {
      const [svcData, statsData] = await Promise.all([api.getApmServices(qp), api.getApmStats(qp).catch(() => null)]);
      const svcs = (svcData?.services || []).filter((s: any) => s?.service_name);
      setServices(svcs); setStats(statsData as ApmStats | null);
      setSvcState(svcs.length > 0 ? 'data' : 'empty');
    } catch (err: any) { setSvcError(err?.message || 'Failed'); setSvcState('error'); } finally { setLoading(false); }
  }, [qp]);

  // Fetch traces — loads first page, subsequent calls append
  const fetchTr = useCallback(async (append = false) => {
    if (!append) { setTrState('loading'); setTrError(''); }
    const offset = append ? traces.length : 0;
    try {
      const d = await api.getApmTraces({ ...qp, limit: TRACE_LIMIT, offset, status: facetStatus || undefined, service: facetService || undefined, query: facetDuration ? facetDuration : qp.query });
      const newTraces = d?.traces || [];
      setTraces(prev => append ? [...prev, ...newTraces] : newTraces);
      setTraceTotal(d?.total || 0);
      setTraceOkTotal(d?.ok_total ?? 0);
      setTraceErrorTotal(d?.error_total ?? 0);
      setHasMoreTraces(newTraces.length >= TRACE_LIMIT);
      if (!append) setTrState(newTraces.length > 0 ? 'data' : 'empty');
    } catch (err: any) {
      if (!append) { setTrError(err?.message || 'Failed'); setTrState('error'); }
    }
  }, [qp, traces.length, facetStatus, facetService, facetDuration]);

  const loadMoreTraces = useCallback(() => fetchTr(true), [fetchTr]);

  const fetchTopo = useCallback(async () => {
    setTopoLoading(true);
    try { const d = await api.getApmTopology({ query: query || undefined, start, end }); setTopoNodes(d.nodes || []); setTopoEdges(d.edges || []); } catch {} finally { setTopoLoading(false); }
  }, [query, start, end]);

  useEffect(() => { fetchSvc(); fetchTopo(); fetchTr(); api.getApmTags({ start, end }).then((d: any) => setTagKeys((d?.tags || []).map((t: any) => t.tag_key)), () => {}); }, [start, end]);
  useEffect(() => { if (view === 'traces') fetchTr(); if (view === 'topology') fetchTopo(); }, [view]);

  const realServices = useMemo(() => services.filter(s => s.service_name), [services]);

  // Redirect logic
  useEffect(() => {
    if (svcState === 'loading') return;
    if (realServices.length === 0 && location.pathname !== '/apm/intro') navigate('/apm/intro', { replace: true });
    else if (realServices.length > 0 && location.pathname === '/apm/intro') navigate('/apm', { replace: true });
  });

  const filteredServices = useMemo(() => {
    let list = svcSearch ? realServices.filter(s => s.service_name.toLowerCase().includes(svcSearch.toLowerCase())) : [...realServices];
    list.sort((a, b) => num(b.request_count) - num(a.request_count));
    return list;
  }, [realServices, svcSearch]);

  // Sync facet state to URL so it survives Trace Detail → back navigation
  const updateFacetParams = useCallback((status: string, service: string, duration: string) => {
    const params = new URLSearchParams(searchParams);
    if (status) params.set('f_status', status); else params.delete('f_status');
    if (service) params.set('f_service', service); else params.delete('f_service');
    if (duration) params.set('f_duration', duration); else params.delete('f_duration');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const toggleFavorite = (name: string) => {
    setFavorites(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  };

  const maxDuration = useMemo(() => traces.length > 0 ? Math.max(...traces.map(t => num(t.duration_us))) : 1, [traces]);

  // ════════════════════════ INTRO PAGE ════════════════════════
  if (isIntroPage || svcState === 'empty') {
    return (
      <div className="animate-fade-in" style={{ maxWidth: 1280 }} data-testid="apm-intro">
        <div className="flex items-center justify-between mb-1">
          <div><h1 className="text-xl font-bold text-[#212529]" style={{ fontSize: 20, fontWeight: 600 }}>APM</h1><p className="text-sm text-[#6C757D] mt-0.5">Application Performance Monitoring</p></div>
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${DD.border}`, background: DD.bg }}>
              {APM_SETUP_NAV.map(item => (
                <div key={item.key} onClick={() => setActiveNav(item.key)}
                  className="flex items-center gap-3 transition-all cursor-pointer"
                  style={{ padding: '10px 16px', fontSize: 13, borderLeft: `3px solid ${activeNav === item.key ? DD.primary : 'transparent'}`, background: activeNav === item.key ? DD.bgSelected : DD.bg, color: activeNav === item.key ? DD.text : DD.textSecondary, fontWeight: activeNav === item.key ? 600 : 400 }}>
                  {item.icon === 'gear' && <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>}
                  {item.icon === 'file' && <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
                  {item.icon === 'warn' && <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {activeNav === 'setup' && <>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: DD.text, marginBottom: 8 }}>Start monitoring your services with application observability</h1>
              <p style={{ fontSize: 14, color: DD.textSecondary, maxWidth: 520, lineHeight: 1.5, marginBottom: 20 }}>Instrument your applications to collect traces, metrics, and logs — with zero code changes in many environments.</p>
              <div className="flex items-center gap-4 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#632CA6] bg-[#F3F0FF] px-3 py-1 rounded-full border border-[#D4C4ED]"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>5-10 minutes setup</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#28A745] bg-[#E8F5E9] px-3 py-1 rounded-full border border-[#C8E6C9]"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>Zero code changes</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {LANGUAGES.map(l => <button key={l} className="px-3 py-1.5 text-[12px] font-medium text-[#6C757D] bg-white border border-[#DEE2E6] rounded-md hover:border-[#ADB5BD] transition-colors">{l}</button>)}
              </div>
              <div className="flex items-center gap-3 mb-8">
                <Link to="/apm/service-setup" className="inline-flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white rounded-md transition-colors hover:opacity-90" style={{ background: DD.primary }}>Get Started <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 5l7 7-7 7M5 12h14"/></svg></Link>
                <a href="#" className="px-4 py-2.5 text-[13px] font-medium text-[#632CA6] hover:underline">View Documentation →</a>
              </div>
              <h3 className="text-[14px] font-semibold text-[#212529] mb-4">After instrumentation you'll be able to...</h3>
              <div className="grid grid-cols-3 gap-4">
                {[{ theme: 'orange' as const, title: 'Monitor performance', desc: 'Track throughput, latency, and error rates across all your services.' },
                  { theme: 'purple' as const, title: 'Troubleshoot with tracing', desc: 'Distributed tracing across services with flame graphs and waterfall views.' },
                  { theme: 'green' as const, title: 'Optimize with AI', desc: 'AI-powered insights to identify bottlenecks and optimize performance.' }].map(card => (
                  <div key={card.title} className="bg-white border border-[#DEE2E6] rounded-lg overflow-hidden flex flex-col" style={{ minHeight: 240 }}>
                    <div style={{ height: 4, backgroundColor: card.theme === 'orange' ? '#FFC107' : card.theme === 'purple' ? DD.primary : '#28A745' }} />
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: card.theme === 'orange' ? '#FFF8E1' : card.theme === 'purple' ? '#F3F0FF' : '#E8F5E9' }}>
                        <svg className={`w-5 h-5 ${card.theme === 'orange' ? 'text-[#FFC107]' : card.theme === 'purple' ? 'text-[#632CA6]' : 'text-[#28A745]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 16l4-8 4 4 4-6"/></svg>
                      </div>
                      <h4 className="text-[14px] font-semibold text-[#212529] mb-2">{card.title}</h4>
                      <p className="text-[13px] text-[#6C757D] leading-relaxed">{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>}
            {activeNav === 'rules' && <EmptyState icon={<svg className="w-8 h-8 text-[#DEE2E6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} title="No instrumentation rules" description="Instrumentation rules will appear here once you configure auto-instrumentation policies." />}
            {activeNav === 'errors' && <EmptyState icon={<svg className="w-8 h-8 text-[#28A745]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg>} title="No instrumentation errors" description="No errors have been detected in your instrumentation configuration." />}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════ DATA VIEWS ════════════════════════
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-1">
        <div><h1 style={{ fontSize: 20, fontWeight: 600, color: DD.text }}>APM</h1><p className="text-sm text-[#6C757D] mt-0.5">Application Performance Monitoring</p></div>
        <div className="flex items-center gap-2"><TimeRangePicker value={range} onChange={v => setRange(v)} /><Button icon={<ReloadOutlined />} onClick={fetchSvc} size="small" /></div>
      </div>

      {/* Tab bar — Datadog style */}
      <div className="flex items-center gap-0 mb-4 border-b" style={{ borderColor: DD.border }}>
        {(['services','traces','topology','settings'] as const).map(k => (
          <button key={k} onClick={() => { if (k !== 'settings') { setView(k as any); setSearchParams(k === 'services' ? {} : { view: k }); } else navigate('/apm/settings'); }}
            style={{ padding: '10px 16px', fontSize: 13, fontWeight: view === k ? 600 : 400, color: view === k ? DD.primary : DD.textSecondary, borderBottom: view === k ? `2px solid ${DD.primary}` : '2px solid transparent', marginBottom: -1, transition: 'color 0.15s, border-color 0.15s' }}>
            {k === 'services' ? 'Services' : k === 'traces' ? 'Traces' : k === 'topology' ? 'Service Map' : 'Settings'}
          </button>
        ))}
        <div className="relative flex-1 ml-auto" style={{ maxWidth: 360 }}>
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADB5BD] w-4 h-4" />
          <input type="text" value={rawQuery} onChange={e => setRawQuery(e.target.value)}
            placeholder="Search for any tag or attribute on your spans..."
            style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 48, fontSize: 13, border: `1px solid ${DD.border}`, borderRadius: 6, background: DD.bg, color: DD.text }}
            className="placeholder:text-[#ADB5BD] focus:outline-none focus:border-[#632CA6] focus:ring-1 focus:ring-[#632CA6]/20" />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#ADB5BD] bg-[#F8F9FA] px-1.5 py-0.5 rounded font-mono border border-[#DEE2E6]">⌘/</kbd>
        </div>
      </div>

      {/* ═══ SERVICES VIEW ═══ */}
      {view === 'services' && (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: `1px solid ${DD.border}` }} data-testid="apm-services-table">
          <div className="p-5 border-b" style={{ borderColor: DD.border }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: DD.text, marginBottom: 4 }}>Choose an APM Service</h2>
                <p style={{ fontSize: 13, color: DD.textSecondary }}>Search or select a favorited or recently deployed service</p>
              </div>
              <a href="#" className="text-[13px] font-medium hover:underline" style={{ color: DD.primary }}>View All in Software Catalog</a>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <div className="relative flex-1" style={{ maxWidth: 360 }}>
                <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADB5BD] w-4 h-4" />
                <input value={svcSearch} onChange={e => setSvcSearch(e.target.value)} placeholder="Search services..."
                  style={{ width: '100%', height: 36, paddingLeft: 36, paddingRight: 12, fontSize: 13, border: `1px solid ${DD.border}`, borderRadius: 6, background: '#FAFBFC' }}
                  className="placeholder:text-[#ADB5BD] focus:outline-none focus:border-[#632CA6]" />
              </div>
              <span style={{ fontSize: 12, color: DD.textSecondary }}>{filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {svcState === 'loading' ? <TableSkeleton rows={6} cols={4} /> :
           svcState === 'error' ? <div className="py-16 text-center"><p className="text-sm text-red-500">{svcError || 'Failed'} — <button onClick={fetchSvc} className="underline">Retry</button></p></div> :
           <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${DD.border}`, background: '#FAFBFC' }}>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: DD.textSecondary, width: 40 }}></th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: DD.textSecondary }}>Service</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: DD.textSecondary }}>P95 Latency</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: DD.textSecondary }}>Error Rate</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: DD.textSecondary }}>Throughput</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: DD.textSecondary }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? <tr><td colSpan={6} className="py-16 text-center text-[13px]" style={{ color: DD.textSecondary }}>No services match your filter</td></tr> :
                filteredServices.map(s => { const p = num(s.error_rate_pct); const isFav = favorites.has(s.service_name); return (
                  <tr key={s.service_name} onClick={() => navigate('/apm/services/' + s.service_name)}
                    className="cursor-pointer transition-colors" style={{ borderBottom: `1px solid ${DD.borderLight}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = DD.bgHover)} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td className="pl-4 py-3" onClick={e => { e.stopPropagation(); toggleFavorite(s.service_name); }}>
                      {isFav ? <StarFilled className="text-yellow-500 text-sm" /> : <StarOutlined className="text-[#ADB5BD] text-sm hover:text-yellow-500" />}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p > 5 ? DD.error : p > 1 ? DD.warning : DD.success }} />
                        <span className="text-[13px] font-medium cursor-pointer hover:underline" style={{ color: DD.primary }}>{s.service_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums font-mono" style={{ color: DD.textSecondary }}>{fmtLatency(s.p95_ms)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: DD.borderLight }}>
                          <div className="h-full rounded-full" style={{ width: Math.min(p * 10, 100) + '%', backgroundColor: p > 5 ? DD.error : p > 1 ? DD.warning : DD.success }} />
                        </div>
                        <span className="text-[12px] tabular-nums font-mono" style={{ color: DD.textSecondary }}>{p.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tabular-nums font-mono" style={{ color: DD.textSecondary }}>{fmtN(s.request_count)}</td>
                    <td className="px-4 py-3 text-right text-[12px] tabular-nums" style={{ color: DD.textMuted }}>{ago(s.last_seen || '')}</td>
                  </tr>
                );})
              }
            </tbody>
          </table>}
        </div>
      )}

      {/* ═══ TRACES VIEW ═══ */}
      {view === 'traces' && (
        <TracesExplorer
          services={services}
          traces={traces}
          tracesTotal={traceTotal}
          okTotal={traceOkTotal}
          errorTotal={traceErrorTotal}
          trState={trState}
          trError={trError}
          latencyHistogram={stats?.latency_histogram}
          query={rawQuery}
          onQueryChange={setRawQuery}
          onTracesRefresh={() => fetchTr(false)}
          onLoadMore={loadMoreTraces}
          hasMore={hasMoreTraces}
          tagKeys={tagKeys}
          facetStatus={facetStatus}
          facetService={facetService}
          facetDuration={facetDuration}
          onFacetStatusChange={(s) => { setFacetStatus(s); setTraces([]); updateFacetParams(s, facetService, facetDuration); }}
          onFacetServiceChange={(s) => { setFacetService(s); setTraces([]); updateFacetParams(facetStatus, s, facetDuration); }}
          onFacetDurationChange={(q) => { setFacetDuration(q); setTraces([]); updateFacetParams(facetStatus, facetService, q); }}
          timeRange={range}
          onTimeRangeChange={setRange}
        />
      )}

      {/* ═══ TOPOLOGY VIEW ═══ */}
      {view === 'topology' && (
        <div className="flex gap-4">
          <TopologySidebar nodes={topoNodes} edges={topoEdges} activeSizing={topoSizing} onSizingChange={setTopoSizing} activeLayout={topoLayout} onLayoutChange={setTopoLayout} searchQuery={topoSearch} onSearchChange={setTopoSearch} highlightedNode={topoHighlighted} onNodeHighlight={setTopoHighlighted} />
          <div className="flex-1 min-w-0"><TopologyMap key={`topo-${topoNodes.length}`} nodes={topoNodes} edges={topoEdges} loading={topoLoading} onServiceClick={(svc) => navigate('/apm/services/' + svc)} onRefresh={fetchTopo} /></div>
        </div>
      )}
    </div>
  );
}
