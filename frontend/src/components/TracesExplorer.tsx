import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ApmServiceItem, ApmTraceItem, ApmHistBucket } from '../api/types';
import TimeRangePicker from '../components/TimeRangePicker';
import { StatusDot } from './ui';
echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const num = (v: any) => { if (v == null) return 0; const n = typeof v === 'string' ? parseFloat(v) : v; return isNaN(n) ? 0 : n; };
function fmtDurationUs(us?: number | string): string { const v = num(us) / 1000; if (v >= 1000) return (v / 1000).toFixed(2) + 's'; if (v >= 1) return Math.round(v) + 'ms'; return Math.round(v * 1000) + 'μs'; }
function formatDate(ts?: string): string { if (!ts) return '—'; try { const d = new Date(ts.replace(' ', 'T') + '+08:00'); const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]; return `${mon} ${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`; } catch { return ts; } }

interface Props {
  services: ApmServiceItem[]; traces: ApmTraceItem[]; tracesTotal: number;
  okTotal?: number; errorTotal?: number;
  trState: 'loading' | 'empty' | 'error' | 'data'; trError: string;
  latencyHistogram?: ApmHistBucket[];
  query: string; onQueryChange: (q: string) => void;
  onTracesRefresh: () => void; onLoadMore: () => void; hasMore: boolean;
  tagKeys?: string[];
  facetStatus: string; facetService: string; facetDuration: string;
  onFacetStatusChange: (s: string) => void; onFacetServiceChange: (s: string) => void; onFacetDurationChange: (q: string) => void;
  timeRange?: string; onTimeRangeChange?: (r: string) => void;
}

function FacetSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-edge-light">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:text-ink transition-colors">
        {open ? <DownOutlined style={{ fontSize: 8 }} /> : <RightOutlined style={{ fontSize: 8 }} />}{title}
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}

function CheckItem({ label, count, active, dotColor, onClick }: { label: string; count?: number; active: boolean; dotColor?: string; onClick: () => void }) {
  return (
    <label className="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-xs text-ink-secondary hover:bg-surface-hover select-none">
      <div onClick={onClick} className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-brand-600 border-brand-600' : 'bg-white border-edge'}`}>
        {active && <svg viewBox="0 0 16 16" fill="white" className="w-3 h-3"><path d="M3 8l3 3 7-7" stroke="white" strokeWidth="2" fill="none"/></svg>}
      </div>
      {dotColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />}
      <span className="flex-1 truncate">{label}</span>
      {count != null && <span className="text-2xs text-ink-muted">{count}</span>}
    </label>
  );
}

export default function TracesExplorer(props: Props) {
  const { services, traces, tracesTotal, okTotal, errorTotal, trState, trError, latencyHistogram, query, onQueryChange, onTracesRefresh, onLoadMore, hasMore,
    facetStatus, facetService, facetDuration, onFacetStatusChange, onFacetServiceChange, onFacetDurationChange, timeRange, onTimeRangeChange } = props;
  const navigate = useNavigate();
  const [svcSearch, setSvcSearch] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  const maxDuration = useMemo(() => Math.max(...traces.map(t => num(t.duration_us)), 1), [traces]);

  useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && hasMore && trState !== 'loading') onLoadMore(); }, { rootMargin: '200px' });
    obs.observe(el); return () => obs.disconnect();
  }, [hasMore, trState, onLoadMore]);

  const chips = useMemo(() => {
    const c: { label: string; remove: () => void }[] = [];
    if (facetStatus) c.push({ label: `status:${facetStatus}`, remove: () => onFacetStatusChange('') });
    if (facetService) c.push({ label: `service:${facetService}`, remove: () => onFacetServiceChange('') });
    if (facetDuration) c.push({ label: `duration:${facetDuration}`, remove: () => onFacetDurationChange('') });
    return c;
  }, [facetStatus, facetService, facetDuration]);
  const hasFilters = chips.length > 0;
  const okCnt = okTotal ?? traces.filter(t => t.status === 'ok').length;
  const errCnt = errorTotal ?? traces.filter(t => t.status !== 'ok').length;

  return (
    <div>
      {/* Search + time picker */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative flex-1">
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-placeholder" />
          <input type="text" value={query} onChange={e => onQueryChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onTracesRefresh(); }}
            placeholder="Search for any tag or attribute on your spans. Press Enter to search."
            className="w-full h-9 pl-10 pr-4 text-sm border rounded-md bg-white placeholder:text-ink-placeholder focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 transition-shadow" />
        </div>
        {timeRange && onTimeRangeChange && <TimeRangePicker value={timeRange} onChange={onTimeRangeChange} />}
      </div>

      {/* Filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className="text-xs font-semibold uppercase text-ink-secondary mr-1">Filters:</span>
          {chips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-surface-selected text-brand-600 border border-brand-200">
              {c.label}<button onClick={c.remove} className="text-brand-400 hover:text-brand-600 text-xs leading-none">×</button>
            </span>
          ))}
          <button onClick={() => { onFacetStatusChange(''); onFacetServiceChange(''); onFacetDurationChange(''); onQueryChange(''); }}
            className="text-xs font-medium text-brand-600 hover:underline ml-1">Clear all</button>
        </div>
      )}

      <div className="flex gap-4">
        {/* LEFT: Facets */}
        <div className="w-[200px] shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-ink">Facets</h3>
            {hasFilters && <button onClick={() => { onFacetStatusChange(''); onFacetServiceChange(''); onFacetDurationChange(''); }}
              className="text-xs font-medium text-brand-600">Clear</button>}
          </div>
          <FacetSection title="Status">
            <CheckItem label="OK" count={okCnt} active={facetStatus === 'ok'} dotColor="#2DB88D" onClick={() => onFacetStatusChange(facetStatus === 'ok' ? '' : 'ok')} />
            <CheckItem label="Error" count={errCnt} active={facetStatus === 'error'} dotColor="#E65C5C" onClick={() => onFacetStatusChange(facetStatus === 'error' ? '' : 'error')} />
          </FacetSection>
          <FacetSection title="Duration" defaultOpen={false}>
            {[{ label: '< 10 ms', query: 'duration:<10ms' },{ label: '10 – 100 ms', query: 'duration:>10ms duration:<100ms' },{ label: '100 ms – 1 s', query: 'duration:>100ms duration:<1s' },{ label: '> 1 s', query: 'duration:>1s' }].map(d => (
              <CheckItem key={d.label} label={d.label} active={facetDuration === d.query} onClick={() => onFacetDurationChange(facetDuration === d.query ? '' : d.query)} />
            ))}
          </FacetSection>
          <FacetSection title="Service" defaultOpen={false}>
            <input type="text" value={svcSearch} onChange={e => setSvcSearch(e.target.value)} placeholder="Filter services"
              className="w-full px-2 py-1.5 text-xs border border-edge rounded bg-white placeholder:text-ink-placeholder focus:outline-none focus:border-brand-600 mb-1" />
            <div className="space-y-0.5 max-h-52 overflow-y-auto">
              {services.filter(s => !svcSearch || s.service_name.toLowerCase().includes(svcSearch.toLowerCase())).slice(0, 30).map(s => {
                const p = num(s.error_rate_pct);
                return <CheckItem key={s.service_name} label={s.service_name} count={num(s.request_count)}
                  dotColor={p > 5 ? '#E65C5C' : p > 1 ? '#E2903C' : '#2DB88D'} active={facetService === s.service_name}
                  onClick={() => onFacetServiceChange(facetService === s.service_name ? '' : s.service_name)} />;
              })}
            </div>
          </FacetSection>
        </div>

        {/* RIGHT: Table */}
        <div className="flex-1 min-w-0">
          {latencyHistogram && latencyHistogram.length > 0 && (
            <div className="bg-white rounded-lg border border-edge p-4 mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-3">Duration Distribution</h4>
              <ReactEChartsCore echarts={echarts} option={{
                grid: { left: 0, right: 8, top: 4, bottom: 14 }, xAxis: { type: 'category', data: latencyHistogram.map(b => b.bucket), axisLabel: { fontSize: 9, color: '#ADB5BD' }, axisTick: { show: false } },
                yAxis: { show: false }, series: [{ type: 'bar', data: latencyHistogram.map(b => num(b.cnt)), itemStyle: { color: '#632CA6', borderRadius: [2, 2, 0, 0] }, barMaxWidth: 20 }], tooltip: { trigger: 'axis' as const },
              }} style={{ height: 100 }} notMerge />
            </div>
          )}

          <div className="bg-white rounded-lg border border-edge overflow-hidden">
            <div className="px-4 py-3 border-b border-edge-light bg-surface-zebra flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Spans</span>
              <span className="text-xs text-ink-secondary">{tracesTotal > 0 ? `${tracesTotal} span${tracesTotal !== 1 ? 's' : ''}` : `${traces.length} loaded`}</span>
            </div>

            {traces.length === 0 && trState !== 'loading' && (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-ink">No spans found</p>
                <p className="text-xs text-ink-secondary mt-1">Try adjusting your time range or search filters.</p>
              </div>
            )}

            <table className="w-full">
              <thead>
                <tr className="border-b border-edge-light bg-surface-zebra">
                  {['DATE','SERVICE','RESOURCE','DURATION','METHOD','STATUS'].map(h => (
                    <th key={h} className="text-left text-h6 px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traces.map(t => {
                  const isOk = t.status === 'ok';
                  return (
                    <tr key={t.trace_id} onClick={() => navigate('/apm/traces/' + t.trace_id)}
                      className="border-b border-edge-lighter hover:bg-surface-selected/50 cursor-pointer transition-colors">
                      <td className="px-3 py-3 font-mono text-2xs text-ink-muted min-w-[120px]">{formatDate(t.start_time)}</td>
                      <td className="px-3 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-brand-600" />
                          <span className="text-xs font-medium text-brand-600 truncate max-w-[160px]">{t.root_service || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-ink-secondary truncate max-w-[220px]">{t.root_operation || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full overflow-hidden bg-edge-lighter">
                            <div className="h-full rounded-full" style={{ width: `${Math.max((num(t.duration_us) / maxDuration) * 100, 1)}%`, backgroundColor: isOk ? '#632CA6' : '#E65C5C' }} />
                          </div>
                          <span className="text-2xs font-mono tabular-nums text-ink-secondary whitespace-nowrap">{fmtDurationUs(t.duration_us)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-2xs font-mono px-1.5 py-0.5 rounded border border-edge bg-surface text-ink-secondary">{t.root_operation?.split(' ')[0] || '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded ${isOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                          <StatusDot status={isOk ? 'online' : 'error'} />{isOk ? '200' : 'ERR'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div ref={sentinelRef} className="py-4 text-center">
              {trState === 'loading' && <span className="text-xs text-ink-muted">Loading more spans...</span>}
              {!hasMore && traces.length > 0 && <span className="text-xs text-ink-muted">All {tracesTotal > 0 ? tracesTotal : traces.length} spans loaded</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
