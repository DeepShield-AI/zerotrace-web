import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api } from '../api/client';
import TopologyMap, { TopologyNode, TopologyEdge } from '../components/TopologyMap';
import TopologySidebar from '../components/TopologySidebar';
import TimeRangePicker, { parseRange } from '../components/TimeRangePicker';
import { useDebounce } from '../hooks/useDebounce';
import type { ApmServiceItem, ApmTraceItem, ApmTsRow, ApmHistBucket, ApmStats } from '../api/types';
import { SlowRequestsPanel, ErrorAnalysisPanel } from '../components/ApmDemos';
import ApmServicesView from '../components/ApmServicesView';
import { TableSkeleton, Badge, EmptyState, SearchInput, FilterBar, StatusDot } from '../components/ui';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

// Helpers
const num = (v: number | string | undefined): number => { if (v === undefined || v === null) return 0; const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };
function ago(s: string): string { if (!s) return '—'; try { const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime(); const m = Math.floor(d / 60000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; } catch { return ''; } }

const INTRO_NAV = [{ key:'setup',label:'Set up APM',icon:'gear'},{ key:'rules',label:'Instrumentation Rules',icon:'file'},{ key:'errors',label:'Instrumentation Errors',icon:'warn' }];
const LANGUAGES = ['☕ Java','🐍 Python','🔷 .NET','💎 Ruby','🐘 PHP','🔵 Go','⬢ Node.js','⚙ C++'];

export default function APMPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vp = searchParams.get('view') as 'services'|'traces'|'topology'|null;
  const [view, setView] = useState<'services'|'traces'|'topology'>(vp==='traces'||vp==='topology'?vp:'services');
  const navigate = useNavigate(); const location = useLocation();
  const isIntro = location.pathname === '/apm/intro';
  const [range, setRange] = useState('1h');
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ApmServiceItem[]>([]);
  const [svcState, setSvcState] = useState<'loading'|'empty'|'error'|'data'>('loading');
  const [svcError, setSvcError] = useState('');
  const [traces, setTraces] = useState<ApmTraceItem[]>([]);
  const [trState, setTrState] = useState<'loading'|'empty'|'error'|'data'>('loading');
  const [trError, setTrError] = useState('');
  const [traceOffset, setTraceOffset] = useState(0);
  const [traceTotal, setTraceTotal] = useState(0);
  const TRACE_LIMIT = 20;
  const [stats, setStats] = useState<ApmStats|null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const query = useDebounce(rawQuery, 300);
  const [facetStatus, setFacetStatus] = useState('');
  const [facetService, setFacetService] = useState('');
  const [facetDuration, setFacetDuration] = useState('');
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]);
  const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);
  const [topoSizing, setTopoSizing] = useState<'requests'|'latency'|'errors'>('requests');
  const [topoLayout, setTopoLayout] = useState<'force'|'circular'>('force');
  const [topoHighlighted, setTopoHighlighted] = useState<string|undefined>();
  const [activeNav, setActiveNav] = useState('setup');
  const [demoView, setDemoView] = useState<'traces'|'slow'|'errors'>('traces');

  useEffect(() => { const v=searchParams.get('view') as any; if(v==='traces'||v==='topology') setView(v); else if(!v) setView('services'); },[searchParams]);
  const { start, end } = parseRange(range);
  const qp = useMemo(() => ({ query: query||undefined, start, end }),[query,start,end]);

  const fetchSvc = useCallback(async () => {
    setSvcState('loading'); setSvcError('');
    try {
      const [svcData, statsData] = await Promise.all([api.getApmServices(qp), api.getApmStats(qp).catch(()=>null)]);
      const svcs = (svcData?.services||[]).filter((s:any)=>s?.service_name);
      setServices(svcs); setStats(statsData as ApmStats|null);
      const isEmpty = svcs.length === 0;
      setSvcState(isEmpty?'empty':'data');
      if (isEmpty && location.pathname !== '/apm/intro') navigate('/apm/intro',{replace:true});
    } catch { setSvcState('empty'); } finally { setLoading(false); }
  },[qp,navigate]);

  const fetchTr = useCallback(async (append=false) => {
    setTrState('loading');
    try {
      const d = await api.getApmTraces({...qp,limit:TRACE_LIMIT,offset:append?traces.length:0,status:facetStatus||undefined,service:facetService||undefined,query:facetDuration||qp.query});
      const trs = d?.traces||[];
      setTraces(append?[...traces,...trs]:trs); setTraceTotal(d?.total||0); setTrState(trs.length>0?'data':'empty');
    } catch { setTrState('empty'); }
  },[qp,traces.length,facetStatus,facetService,facetDuration]);
  const loadMoreTraces = useCallback(() => { if(traces.length<traceTotal) fetchTr(true); },[traces.length,traceTotal,fetchTr]);

  const fetchTopo = useCallback(async () => {
    setTopoLoading(true);
    try { const d=await api.getApmTopology({query:query||undefined,start,end}); setTopoNodes(d.nodes||[]); setTopoEdges(d.edges||[]); } catch{} finally { setTopoLoading(false); }
  },[query,start,end]);

  useEffect(()=>{fetchSvc();fetchTopo();},[start,end]);
  useEffect(()=>{if(view==='traces')fetchTr();if(view==='topology')fetchTopo();},[view]);

  const hasNoData = svcState==='empty'&&!isIntro;
  useEffect(()=>{if(!isIntro&&hasNoData)navigate('/apm/intro',{replace:true});},[isIntro,hasNoData,navigate]);

  const maxDuration = useMemo(()=>traces.length>0?Math.max(...traces.map(t=>num(t.duration_us))):1,[traces]);

  // ═══ INTRO PAGE ═══
  if (isIntro || svcState === 'empty') return (
    <div className="animate-fade-in max-w-[1280px]" data-testid="apm-intro">
      <div className="flex items-center justify-between mb-1">
        <div><h1 className="text-h3">APM</h1><p className="text-sm text-ink-muted mt-0.5">Application Performance Monitoring</p></div>
        <TimeRangePicker value={range} onChange={setRange} />
      </div>
      <div className="flex gap-6 mt-5">
        <div className="w-[220px] shrink-0">
          <div className="rounded-lg overflow-hidden border border-edge bg-white">
            {INTRO_NAV.map(item => (
              <button key={item.key} onClick={()=>setActiveNav(item.key)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium border-l-[3px] transition-colors ${
                  activeNav===item.key ? 'border-brand-600 bg-surface-selected text-ink' : 'border-transparent text-ink-secondary hover:text-ink'
                }`}>{item.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          {activeNav==='setup' && <>
            <h1 className="text-h1 mb-2">Start monitoring your services with application observability</h1>
            <p className="text-sm text-ink-secondary max-w-[560px] mb-5">Instrument your applications to collect traces, metrics, and logs — with zero code changes in many environments.</p>
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 bg-surface-selected px-3 py-1 rounded-full border border-brand-200">⏱ 5-10 minutes setup</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-status-success bg-status-success-soft px-3 py-1 rounded-full border border-green-200">✓ Zero code changes</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-5">{LANGUAGES.map(l=><button key={l} className="px-3 py-1.5 text-xs font-medium text-ink-secondary bg-white border border-edge rounded-md hover:border-edge-strong transition-colors">{l}</button>)}</div>
            <div className="flex items-center gap-3">
              <Link to="/apm/service-setup" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-md bg-brand-600 hover:bg-brand-700 transition-colors">Get Started →</Link>
              <a href="#" className="px-4 py-2.5 text-sm font-medium text-brand-600 hover:underline">View Documentation →</a>
            </div>
            <div className="mt-8">
              <h3 className="text-h4 mb-3">After instrumentation you&apos;ll be able to...</h3>
              <div className="grid grid-cols-3 gap-4">
                {[{t:'Monitor performance',d:'Track throughput, latency, and error rates across all your services.',c:'#E2903C'},{t:'Troubleshoot with tracing',d:'Distributed tracing across services with flame graphs and waterfall views.',c:'#632CA6'},{t:'Optimize with AI',d:'AI-powered insights to identify bottlenecks and optimize performance.',c:'#2DB88D'}].map(card=>(
                  <div key={card.t} className="bg-white border border-edge rounded-lg overflow-hidden flex flex-col" style={{minHeight:200}}>
                    <div className="h-1" style={{backgroundColor:card.c}}/>
                    <div className="p-5 flex-1"><div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{background:card.c+'15'}}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={card.c} strokeWidth="2"><path d="M3 3v18h18M7 16l4-8 4 4 4-6"/></svg></div>
                    <h4 className="text-sm font-semibold text-ink mb-1.5">{card.t}</h4><p className="text-xs text-ink-secondary leading-relaxed">{card.d}</p></div>
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
        <div><h1 className="text-h3">APM</h1><p className="text-sm text-ink-muted mt-0.5">Application Performance Monitoring</p></div>
        <TimeRangePicker value={range} onChange={setRange}/>
      </div>

      <div className="flex items-center gap-0 mb-4 border-b border-edge">
        {(['services','traces','topology','settings'] as const).map(k=>(
          <button key={k} onClick={()=>{if(k!=='settings'){setView(k);setSearchParams(k==='services'?{}:{view:k});}else navigate('/apm/settings');}}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${view===k?'text-brand-600 border-brand-600':'text-ink-secondary border-transparent hover:text-ink'}`}>
            {k==='services'?'Services':k==='traces'?'Traces':k==='topology'?'Service Map':'Settings'}
          </button>
        ))}
        <div className="flex-1 ml-auto max-w-[360px]"><SearchInput value={rawQuery} onChange={setRawQuery} placeholder="Search traces… service:name status:error duration:>500ms"/></div>
      </div>

      {view==='traces' && (
        <FilterBar items={[{key:'',label:'All'},{key:'duration:>500ms',label:'Slow >500ms'},{key:'duration:>1s',label:'Slow >1s'},{key:'status:error',label:'Errors'}]}
          value={rawQuery} onChange={setRawQuery}/>
      )}

      {view==='services' && <ApmServicesView services={services} svcState={svcState} onRetry={fetchSvc} range={range}/>}

      {view==='traces' && (<>
        <div className="flex items-center gap-1 mt-3 mb-3">
          {[{k:'traces'as const,l:'All Traces'},{k:'slow'as const,l:'Slow Requests'},{k:'errors'as const,l:'Error Analysis'}].map(t=>(
            <button key={t.k} onClick={()=>setDemoView(t.k)} className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${demoView===t.k?'bg-brand-600 text-white border-brand-600':'bg-white text-ink-secondary border-edge hover:border-edge-strong'}`}>{t.l}</button>
          ))}
        </div>
        {demoView==='traces' && (
          <div className="flex gap-4">
            <div className="w-[200px] shrink-0"><div className="bg-white border border-edge rounded-lg p-3">
              <h4 className="text-h6 mb-2">Facets</h4>
              {[{k:'',l:'All'},{k:'ok',l:'OK'},{k:'error',l:'Error'}].map(f=>(
                <button key={f.k} onClick={()=>{setFacetStatus(facetStatus===f.k?'':f.k);setTraceOffset(0);}}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded flex items-center gap-2 transition-colors ${facetStatus===f.k?'bg-brand-50 text-brand-700 font-medium':'text-ink-secondary hover:bg-surface-hover'}`}>
                  <StatusDot status={f.k==='error'?'error':'online'}/><span className="flex-1">{f.l}</span>
                </button>
              ))}
              <div className="mt-3 pt-3 border-t border-edge-lighter"><h5 className="text-h6 mb-1">Duration</h5>
                {[{l:'<10ms',q:'duration:<10ms'},{l:'10-100ms',q:'duration:>10ms duration:<100ms'},{l:'100ms-1s',q:'duration:>100ms duration:<1s'},{l:'>1s',q:'duration:>1s'}].map(d=>(
                  <button key={d.l} onClick={()=>{setFacetDuration(facetDuration===d.q?'':d.q);setTraceOffset(0);}}
                    className={`w-full text-left px-2.5 py-1 text-xs rounded transition-colors ${facetDuration===d.q?'bg-brand-50 text-brand-700 font-medium':'text-ink-secondary hover:bg-surface-hover'}`}>{d.l}</button>
                ))}
              </div>
            </div></div>
            <div className="flex-1"><div className="bg-white border border-edge rounded-lg overflow-hidden">
              {trState==='loading' ? <TableSkeleton cols={5} rows={6}/> :
               trState==='error' ? <EmptyState icon="search" title="Failed to load traces" description={trError}/> :
               traces.length===0 ? <EmptyState icon="search" title="No traces found" description="Try adjusting your time range or filters."/> : (
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-edge-light text-left text-h6 bg-surface-zebra">{['DATE','SERVICE','RESOURCE','DURATION','STATUS'].map(h=><th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead>
                  <tbody>{traces.map(t=>{ const d=num(t.duration_us)/1000; const ok=t.status==='ok';
                    return(<tr key={t.trace_id} onClick={()=>navigate('/apm/traces/'+t.trace_id)} className="border-b border-edge-lighter hover:bg-surface-selected/50 cursor-pointer transition-colors">
                      <td className="px-3 py-2 font-mono text-2xs text-ink-muted w-[120px]">{t.start_time?.slice(11,19)}</td>
                      <td className="px-3 py-2 font-medium text-brand-600">{t.root_service||'—'}</td>
                      <td className="px-3 py-2 font-mono text-2xs text-ink-secondary truncate max-w-[200px]">{t.root_operation||'—'}</td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="w-12 h-1 rounded-full bg-edge-lighter"><div className="h-full rounded-full" style={{width:`${Math.min((d/maxDuration)*100,100)}%`,backgroundColor:ok?'#632CA6':'#E65C5C'}}/></div><span className="text-2xs font-mono text-ink-secondary">{d>=1000?(d/1000).toFixed(2)+'s':d.toFixed(0)+'ms'}</span></div></td>
                      <td className="px-3 py-2"><Badge label={ok?'200':'ERR'} variant={ok?'success':'error'}/></td>
                    </tr>);
                  })}</tbody></table>)}
            </div></div>
          </div>
        )}
        {demoView==='slow' && <SlowRequestsPanel/>}
        {demoView==='errors' && <ErrorAnalysisPanel/>}
      </>)}

      {view==='topology' && (
        <div className="flex gap-4">
          <TopologySidebar nodes={topoNodes} edges={topoEdges} activeSizing={topoSizing} onSizingChange={setTopoSizing} activeLayout={topoLayout} onLayoutChange={setTopoLayout} searchQuery="" onSearchChange={()=>{}} highlightedNode={topoHighlighted} onNodeHighlight={setTopoHighlighted}/>
          <div className="flex-1"><TopologyMap key={`topo-${topoNodes.length}`} nodes={topoNodes} edges={topoEdges} loading={topoLoading} onServiceClick={svc=>navigate('/apm/services/'+svc)} onRefresh={fetchTopo}/></div>
        </div>
      )}
    </div>
  );
}
