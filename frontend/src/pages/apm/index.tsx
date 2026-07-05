import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { api } from '../../api/client';
import TopologyMap, { TopologyNode, TopologyEdge } from '../../components/topology/TopologyMap';
import TopologySidebar from '../../components/topology/TopologySidebar';
import TimeRangePicker, { parseRange } from '../../components/shared/TimeRangePicker';
import { useDebounce } from '../../hooks/useDebounce';
import type { ApmServiceItem, ApmTraceItem, ApmStats } from '../../api/types';
import DurationHistogram from '../../components/apm/DurationHistogram';
import TraceScenarioPanels from '../../components/apm/TraceScenarioPanels';
import ExampleQueries from '../../components/search/ExampleQueries';
import SyntaxSearch from '../../components/search/SyntaxSearch';
import ApmServicesView from '../../components/apm/ApmServicesView';
import { TableSkeleton, EmptyState } from '../../components/ui';

// Helpers
const num = (v: number | string | undefined): number => { if (v === undefined || v === null) return 0; const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };
function ago(s: string): string { if (!s) return '—'; try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; } catch { return ''; } }
function parseQuery(raw: string): Record<string, string> { const p: Record<string, string> = {}; raw.split(/\s+/).filter(Boolean).forEach(part => { const i = part.indexOf(':'); if (i > 0) p[part.slice(0, i)] = part.slice(i + 1); }); return p; }

const INTRO_NAV = [{ key:'setup',label:'Set up APM',icon:'gear'},{ key:'rules',label:'Instrumentation Rules',icon:'file'},{ key:'errors',label:'Instrumentation Errors',icon:'warn' }];
const LANGUAGES = ['☕ Java','🐍 Python','🔷 .NET','💎 Ruby','🐘 PHP','🔵 Go','⬢ Node.js','⚙ C++'];

export default function APMPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vp = searchParams.get('view') as 'services'|'traces'|'topology'|null;
  const [view, setView] = useState<'services'|'traces'|'topology'>(vp==='traces'||vp==='topology'?vp:'services');
  const navigate = useNavigate(); const location = useLocation();
  const isIntro = location.pathname === '/apm/intro';
  const [range, setRange] = useState('1h');
  const [rawQuery, setRawQuery] = useState(searchParams.get('q') || '');
  const query = useDebounce(rawQuery, 300);
  const [facetStatus, setFacetStatus] = useState('');
  const [facetService, setFacetService] = useState('');
  const [facetDuration, setFacetDuration] = useState('');

  // Sync facet states FROM rawQuery (so typing/pasting queries updates facet UI)
  useEffect(() => {
    const p = parseQuery(rawQuery);
    if (p.status) setFacetStatus(p.status);
    else if (!rawQuery.includes('status:')) setFacetStatus('');
    if (p.duration) setFacetDuration(p.duration);
    else if (!rawQuery.includes('duration:')) setFacetDuration('');
    if (p.service) setFacetService(p.service);
    else if (!rawQuery.includes('service:')) setFacetService('');
  }, [rawQuery]);

  const [searchScope, setSearchScope] = useState('All Traces');
  const [topoSizing, setTopoSizing] = useState<'requests'|'latency'|'errors'>('requests');
  const [topoLayout, setTopoLayout] = useState<'force'|'circular'>('force');
  const [topoHighlighted, setTopoHighlighted] = useState<string|undefined>();
  const [activeNav, setActiveNav] = useState('setup');

  useEffect(() => { const v=searchParams.get('view') as any; if(v==='traces'||v==='topology') setView(v); else if(!v) setView('services'); },[searchParams]);
  // Sync search query to URL params (Datadog-style shareable state)
  useEffect(() => {
    if (view !== 'traces') return;
    const params = new URLSearchParams(searchParams);
    params.set('view', 'traces'); // Ensure view param is always preserved
    if (rawQuery) params.set('q', rawQuery); else params.delete('q');
    setSearchParams(params, { replace: true });
  }, [rawQuery]);
  const { start, end } = parseRange(range);
  const qp = useMemo(() => ({ query: query||undefined, start, end }),[query,start,end]);
  const TRACE_LIMIT = 20;

  // Services + stats query
  const svcQuery = useQuery({
    queryKey: ['apm', 'services', qp],
    queryFn: () => Promise.all([
      api.getApmServices(qp),
      api.getApmStats(qp).catch(() => null),
    ]),
  });

  const services: ApmServiceItem[] = (svcQuery.data?.[0]?.services || []).filter((s: any) => s?.service_name);
  const stats = (svcQuery.data?.[1] || null) as ApmStats | null;
  const svcState = svcQuery.isLoading ? 'loading' : services.length === 0 ? 'empty' : 'data';
  const svcError = svcQuery.error instanceof Error ? svcQuery.error.message : '';

  // Parse raw query to extract facet values for API call
  const parsedQuery = useMemo(() => {
    const p: Record<string, string> = {};
    const parts = query.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      const idx = part.indexOf(':');
      if (idx > 0) p[part.slice(0, idx)] = part.slice(idx + 1);
    }
    return p;
  }, [query]);

  // Traces query — uses BOTH explicit facets AND parsed rawQuery values
  const trQuery = useQuery({
    queryKey: ['apm', 'traces', qp, facetStatus, facetService, facetDuration, parsedQuery.status, parsedQuery.duration],
    queryFn: () => api.getApmTraces({
      ...qp,
      limit: TRACE_LIMIT,
      offset: 0,
      status: facetStatus || parsedQuery.status || undefined,
      service: facetService || parsedQuery.service || undefined,
      query: facetDuration || parsedQuery.duration || qp.query,
    }),
    enabled: view === 'traces',
  });

  const traces: ApmTraceItem[] = (trQuery.data?.traces || []) as ApmTraceItem[];
  const traceTotal = trQuery.data?.total || 0;
  const trState = trQuery.isLoading ? 'loading' : trQuery.error ? 'error' : traces.length > 0 ? 'data' : 'empty';
  const trError = trQuery.error instanceof Error ? trQuery.error.message : '';

  // Topology query
  const topoQuery = useQuery({
    queryKey: ['apm', 'topology', qp],
    queryFn: () => api.getApmTopology({ query: query || undefined, start, end }).then((d: any) => ({
      nodes: d.nodes || [],
      edges: d.edges || [],
    })),
  });

  const topoNodes: TopologyNode[] = (topoQuery.data?.nodes || []) as TopologyNode[];
  const topoEdges: TopologyEdge[] = (topoQuery.data?.edges || []) as TopologyEdge[];
  const topoLoading = topoQuery.isFetching;

  const hasNoData = svcState==='empty'&&!isIntro;
  useEffect(()=>{if(!isIntro&&hasNoData)navigate('/apm/intro',{replace:true});},[isIntro,hasNoData,navigate]);

  const maxDuration = useMemo(()=>traces.length>0?Math.max(...traces.map(t=>num(t.duration_us))):1,[traces]);

  // ═══ INTRO PAGE ═══
  if (isIntro || svcState === 'empty') return (
    <div className="animate-fade-in max-w-[1280px]" data-testid="apm-intro">
      <div className="flex items-center justify-between mb-1">
        <div><h1 className="text-h3">APM</h1><p className="text-sm text-fg-tertiary mt-0.5">Application Performance Monitoring</p></div>
        <TimeRangePicker value={range} onChange={setRange} />
      </div>
      <div className="flex gap-6 mt-5">
        <div className="w-[220px] shrink-0">
          <div className="rounded-lg overflow-hidden border border-border bg-bg-elevated">
            {INTRO_NAV.map(item => (
              <button key={item.key} onClick={()=>setActiveNav(item.key)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium border-l-[3px] transition-colors ${
                  activeNav===item.key ? 'border-accent-primary bg-accent-primary/5 text-fg-primary' : 'border-transparent text-fg-secondary hover:text-fg-primary'
                }`}>{item.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          {activeNav==='setup' && <>
            <h1 className="text-h1 mb-2">Start monitoring your services with application observability</h1>
            <p className="text-sm text-fg-secondary max-w-[560px] mb-5">Instrument your applications to collect traces, metrics, and logs — with zero code changes in many environments.</p>
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-primary bg-accent-primary/5 px-3 py-1 rounded-full border border-brand-200">⏱ 5-10 minutes setup</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-success bg-accent-success-bg px-3 py-1 rounded-full border border-accent-success/20">✓ Zero code changes</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-5">{LANGUAGES.map(l=><button key={l} className="px-3 py-1.5 text-xs font-medium text-fg-secondary bg-bg-elevated border border-border rounded-md hover:border-border-strong transition-colors">{l}</button>)}</div>
            <div className="flex items-center gap-3">
              <Link to="/apm/service-setup" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-fg-inverse rounded-md bg-accent-primary hover:opacity-90 transition-colors">Get Started →</Link>
              <a href="#" className="px-4 py-2.5 text-sm font-medium text-accent-primary hover:underline">View Documentation →</a>
            </div>
            <div className="mt-8">
              <h3 className="text-h4 mb-3">After instrumentation you&apos;ll be able to...</h3>
              <div className="grid grid-cols-3 gap-4">
                {[{t:'Monitor performance',d:'Track throughput, latency, and error rates across all your services.',c:'#e2903c'},{t:'Troubleshoot with tracing',d:'Distributed tracing across services with flame graphs and waterfall views.',c:'#632ca6'},{t:'Optimize with AI',d:'AI-powered insights to identify bottlenecks and optimize performance.',c:'#2db88d'}].map(card=>(
                  <div key={card.t} className="bg-bg-elevated border border-border rounded-lg overflow-hidden flex flex-col" style={{minHeight:200}}>
                    <div className="h-1" style={{backgroundColor:card.c}}/>
                    <div className="p-5 flex-1"><div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{background:card.c+'15'}}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={card.c} strokeWidth="2"><path d="M3 3v18h18M7 16l4-8 4 4 4-6"/></svg></div>
                    <h4 className="text-sm font-semibold text-fg-primary mb-1.5">{card.t}</h4><p className="text-xs text-fg-secondary leading-relaxed">{card.d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </>}
          {activeNav==='rules'&&<EmptyState icon="box" title="No instrumentation rules" description="Rules appear when you configure auto-instrumentation policies."/>}
          {activeNav==='errors'&&<EmptyState icon="check" title="No instrumentation errors" description="No errors detected in your instrumentation configuration."/>}
        </div>
      </div>
    </div>
  );

  // ═══ DATA VIEWS ═══
  return (
    <div className="animate-fade-in max-w-[1480px]">
      <div className="flex items-center justify-between mb-1">
        <div><h1 className="text-h3">APM</h1><p className="text-sm text-fg-tertiary mt-0.5">Application Performance Monitoring</p></div>
        <TimeRangePicker value={range} onChange={setRange}/>
      </div>

      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {(['services','traces','topology','settings'] as const).map(k=>(
          <button key={k} onClick={()=>{if(k!=='settings'){setView(k);setSearchParams(k==='services'?{}:{view:k});}else navigate('/apm/settings');}}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${view===k?'text-accent-primary border-accent-primary':'text-fg-secondary border-transparent hover:text-fg-primary'}`}>
            {k==='services'?'Services':k==='traces'?'Traces':k==='topology'?'Service Map':'Settings'}
          </button>
        ))}
        {/* Search bar only shown in Traces view (not in tab bar) */}
      </div>

      {view==='services' && <ApmServicesView services={services} svcState={svcState} onRetry={() => svcQuery.refetch()} range={range}/>}

      {view==='traces' && (<>
        {/* Search bar + quick filters (Datadog style) */}
        <div className="space-y-3 mb-4">
          <SyntaxSearch
            value={rawQuery}
            onChange={setRawQuery}
            scope={searchScope}
            scopeOptions={['All Traces', 'Error Traces', 'Slow Traces']}
            onScopeChange={v => {
              setSearchScope(v);
              if (v === 'Error Traces') setFacetStatus('error');
              else if (v === 'Slow Traces') setFacetDuration('duration:>500ms');
              else { setFacetStatus(''); setFacetDuration(''); }
            }}
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <ExampleQueries
              onSelect={q => setRawQuery(q)}
              services={services.map((s: any) => s.service_name).filter(Boolean)}
              operations={traces.map((t: any) => t.root_operation).filter(Boolean)}
            />
          </div>
        </div>

        {/* Main content: Facets + (Histogram + Table) */}
        <div className="flex gap-4">
          {/* Facet sidebar */}
          <div className="w-[190px] shrink-0">
            <div className="bg-bg-elevated border border-border rounded-lg p-3 sticky top-4">
              <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-2">Facets</h4>
              <div className="mb-3">
                <p className="text-[10px] font-medium text-fg-tertiary mb-1">Status</p>
                {[{k:'',l:'All'},{k:'ok',l:'OK'},{k:'error',l:'Error'}].map(f=>(
                  <button key={f.k} onClick={()=>{
                    const newStatus = facetStatus===f.k?'':f.k;
                    setFacetStatus(newStatus);
                    const parts: string[] = [];
                    if (newStatus) parts.push(`status:${newStatus}`);
                    if (facetDuration) parts.push(facetDuration);
                    setRawQuery(parts.join(' '));
                  }}
                    className={`w-full text-left px-2 py-1 text-[11px] rounded flex items-center gap-2 transition-colors ${facetStatus===f.k?'bg-accent-primary/10 text-accent-primary font-medium':'text-fg-secondary hover:bg-bg-subtle'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${f.k==='error'?'bg-accent-danger':f.k==='ok'?'bg-accent-success':'bg-fg-tertiary'}`}/>{f.l}
                  </button>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-medium text-fg-tertiary mb-1">Duration</p>
                {[{l:'<10ms',q:'duration:<10ms'},{l:'10-100ms',q:'duration:>10ms duration:<100ms'},{l:'100ms-1s',q:'duration:>100ms duration:<1s'},{l:'>1s',q:'duration:>1s'}].map(d=>(
                  <button key={d.l} onClick={()=>{
                    const newDur = facetDuration===d.q?'':d.q;
                    setFacetDuration(newDur);
                    const parts: string[] = [];
                    if (facetStatus) parts.push(`status:${facetStatus}`);
                    if (newDur) parts.push(newDur);
                    setRawQuery(parts.join(' '));
                  }}
                    className={`w-full text-left px-2 py-1 text-[11px] rounded transition-colors ${facetDuration===d.q?'bg-accent-primary/10 text-accent-primary font-medium':'text-fg-secondary hover:bg-bg-subtle'}`}>{d.l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Traces table + histogram */}
          <div className="flex-1 space-y-3 min-w-0">
            {traces.length > 0 && (
              <DurationHistogram
                data={traces.map(t => ({ latency_ms: num(t.duration_us) / 1000 }))}
                onSelectRange={(min, max) => {
                  const rangeQ = `duration:>${min}ms duration:<${max}ms`;
                  setFacetDuration(rangeQ);
                  const parts: string[] = [rangeQ];
                  if (facetStatus) parts.unshift(`status:${facetStatus}`);
                  setRawQuery(parts.join(' '));
                }}
              />
            )}
            <TraceScenarioPanels rawQuery={rawQuery} traces={traces} />
            <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
              {trState==='loading' ? <TableSkeleton cols={5} rows={6}/> :
               trState==='error' ? <EmptyState icon="search" title="Failed to load traces" description={trError}/> :
               traces.length===0 ? <EmptyState icon="search" title="No traces found" description="Try adjusting your time range or filters."/> : (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border-subtle text-left bg-bg-subtle">{['DATE','SERVICE','RESOURCE','DURATION','STATUS'].map(h=><th key={h} className="px-3 py-2.5 text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">{h}</th>)}</tr></thead>
                  <tbody>{traces.map(t=>{ const d=num(t.duration_us)/1000; const ok=t.status==='ok';
                    return(<tr key={t.trace_id} onClick={()=>navigate('/apm/traces/'+t.trace_id)} className="border-b border-border-subtle hover:bg-bg-subtle cursor-pointer transition-colors">
                      <td className="px-3 py-2 font-mono text-[11px] text-fg-tertiary">{t.start_time?.slice(11,19)}</td>
                      <td className="px-3 py-2 font-medium text-accent-primary">{t.root_service||'—'}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-fg-secondary truncate max-w-[200px]">{t.root_operation||'—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1 rounded-full bg-bg-muted"><div className={`h-full rounded-full ${ok?'bg-accent-primary':'bg-accent-danger'}`} style={{width:`${Math.min((d/maxDuration)*100,100)}%`}}/></div>
                          <span className="text-[11px] font-mono text-fg-secondary">{d>=1000?(d/1000).toFixed(2)+'s':d.toFixed(0)+'ms'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ok?'bg-accent-success-bg text-accent-success':'bg-accent-danger-bg text-accent-danger'}`}>{ok?'OK':'ERR'}</span></td>
                    </tr>);
                  })}</tbody></table>)}
              <div className="border-t border-border-subtle bg-bg-subtle px-4 py-2 text-[10px] text-fg-tertiary">
                Showing {traces.length} of {traceTotal} traces
              </div>
            </div>
          </div>
        </div>
      </>)}

      {view==='topology' && (
        <div className="flex gap-4">
          <TopologySidebar nodes={topoNodes} edges={topoEdges} activeSizing={topoSizing} onSizingChange={setTopoSizing} activeLayout={topoLayout} onLayoutChange={setTopoLayout} searchQuery="" onSearchChange={()=>{}} highlightedNode={topoHighlighted} onNodeHighlight={setTopoHighlighted}/>
          <div className="flex-1"><TopologyMap key={`topo-${topoNodes.length}`} nodes={topoNodes} edges={topoEdges} loading={topoLoading} onServiceClick={svc=>navigate('/apm/services/'+svc)} onRefresh={() => topoQuery.refetch()}/></div>
        </div>
      )}
    </div>
  );
}
