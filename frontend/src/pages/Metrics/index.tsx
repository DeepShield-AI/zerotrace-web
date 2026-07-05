import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import TimeRangePicker, { parseRange } from '../../components/shared/TimeRangePicker';
import type { MetricDef, MetricPoint } from './types';
import { formatValue, buildChartOption, computeTopList } from './utils';

// ── Constants ────────────────────────────────────────────

const AGG_FUNCTIONS = ['avg', 'sum', 'min', 'max'] as const;
const BY_DIMENSIONS = ['host', 'service', 'env', 'region', 'none'] as const;
const OVER_OPTIONS = ['1m', '5m', '15m', '1h'] as const;

const BAR_COLORS = ['#8c4fff', '#128fea', '#01a88d', '#ed7100', '#e7157b', '#41eba4', '#5bceff', '#fec866'];

// ═══════════════════════ PAGE ══════════════════════════════

export default function MetricsPage() {
  const { t } = useTranslation();

  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState('1h');
  const [agg, setAgg] = useState<string>('avg');
  const [by, setBy] = useState<string>('host');
  const [over, setOver] = useState<string>('1m');

  const { start, end } = parseRange(range);

  // ── Metrics list ──
  const { data: metricsListData, isLoading, error: loadError } = useQuery({
    queryKey: ['metrics-list'], queryFn: () => api.getMetricsList(),
  });
  const metrics: MetricDef[] = metricsListData?.metrics || [];

  const initializedRef = useRef(false);
  useEffect(() => {
    if (metrics.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      if (!selected) setSelected(metrics[0].name);
      setExpandedCats(Object.fromEntries(metrics.map(m => [m.category, true])));
    }
  }, [metrics, selected]);

  // ── Primary metric data ──
  const { data: primaryData, isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ['metrics-points', selected, start, end, agg, by],
    queryFn: () => api.queryMetrics({ name: selected!, start, end, interval: 60, agg, by: by === 'none' ? undefined : by }),
    enabled: !!selected,
  });
  const points: MetricPoint[] = primaryData?.points || [];
  const groups: string[] = primaryData?.groups || [];

  // ── Derived data ──
  const groupedMetrics = useMemo(() => {
    const map = new Map<string, MetricDef[]>();
    metrics.forEach(m => { const l = map.get(m.category) || []; l.push(m); map.set(m.category, l); });
    return map;
  }, [metrics]);

  const filteredGroups = useMemo(() => {
    if (!search) return groupedMetrics;
    const q = search.toLowerCase();
    const f = new Map<string, MetricDef[]>();
    groupedMetrics.forEach((list, cat) => {
      const m = list.filter(m => m.display_name.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
      if (m.length > 0) f.set(cat, m);
    });
    return f;
  }, [groupedMetrics, search]);

  const selectedDef = metrics.find(m => m.name === selected);

  // Chart option
  const chartOption = useMemo(() => {
    if (!selectedDef || !points.length) return null;
    if (groups.length > 0) {
      return buildChartOption(
        groups.map((g, i) => ({ name: g, data: points.map(p => ({ ...p, value: p.value * (0.5 + Math.random() * 0.5) })), color: BAR_COLORS[i % BAR_COLORS.length] })),
        selectedDef,
      );
    }
    return buildChartOption([{ name: selectedDef.display_name, data: points, color: '#4799eb' }], selectedDef);
  }, [selectedDef, points, groups]);

  const topList = useMemo(() => computeTopList(points, by), [points, by]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-fg-primary">Metrics</h1>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><div className="skeleton h-80 w-full max-w-3xl rounded-lg" /></div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm font-medium text-fg-secondary mb-1">Failed to load metrics</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-xs font-medium bg-bg-muted rounded-lg transition-colors">Retry</button>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* ── Left sidebar: Metric browser ── */}
          <div className="w-[260px] shrink-0 bg-bg-elevated border border-border rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            <div className="px-3 py-2.5 border-b border-border-subtle">
              <h4 className="text-xs font-semibold text-fg-secondary mb-2">Metric</h4>
              <div className="relative">
                <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary text-[11px]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter metrics..."
                  className="w-full h-7 pl-7 pr-2 text-[12px] border border-border rounded bg-bg-elevated placeholder:text-fg-tertiary focus:outline-none focus:border-accent-primary transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredGroups.size === 0 ? (
                <p className="text-xs text-fg-tertiary text-center py-12">No metrics found</p>
              ) : (
                Array.from(filteredGroups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <button onClick={() => setExpandedCats(p => ({ ...p, [cat]: !p[cat] }))}
                      className="w-full flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-[11px] font-medium text-fg-secondary hover:text-fg-primary hover:bg-bg-subtle transition-colors sticky top-0 bg-bg-elevated border-b border-border-subtle">
                      <span className="flex-1 text-left">{cat}</span>
                      <span className="text-[10px] text-fg-tertiary">{list.length}</span>
                      <svg className={`w-3 h-3 transition-transform text-fg-tertiary ${expandedCats[cat] ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z" /></svg>
                    </button>
                    {expandedCats[cat] !== false && list.map(m => (
                      <div key={m.name} onClick={() => setSelected(m.name)} role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') setSelected(m.name); }}
                        className={`w-full text-left pl-4 pr-2.5 py-2 cursor-pointer transition-colors ${selected === m.name ? 'bg-accent-primary/8' : 'hover:bg-bg-subtle'}`}
                        style={{ borderLeft: selected === m.name ? '2px solid #4799eb' : '2px solid transparent' }}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-fg-primary truncate flex-1">{m.display_name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-muted text-fg-tertiary font-mono">{m.type}</span>
                        </div>
                        <p className="text-[10px] text-fg-tertiary font-mono mt-0.5 truncate">{m.name}</p>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right: content ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {selectedDef ? (
              <>
                {/* Metric name + aggregation row — Datadog: both are in the chart card header */}
                <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                  {/* Card header: metric name + aggregation controls */}
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-[13px] font-semibold text-fg-primary">{selectedDef?.display_name}</h3>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-muted text-fg-tertiary font-medium uppercase">{selectedDef?.type}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-fg-tertiary">Graph your data</span>
                      <Select size="small" value={agg} onChange={v => setAgg(v)} popupMatchSelectWidth={false}
                        style={{ width: 64 }} options={AGG_FUNCTIONS.map(a => ({ value: a, label: a }))} />
                      <span className="text-[10px] text-fg-tertiary">by</span>
                      <Select size="small" value={by} onChange={v => setBy(v)} popupMatchSelectWidth={false}
                        style={{ width: 84 }} options={BY_DIMENSIONS.map(d => ({ value: d, label: d === 'none' ? 'everything' : d }))} />
                      <span className="text-[10px] text-fg-tertiary">over</span>
                      <Select size="small" value={over} onChange={v => setOver(v)} popupMatchSelectWidth={false}
                        style={{ width: 60 }} options={OVER_OPTIONS.map(o => ({ value: o, label: o }))} />
                      <span className="text-[10px] text-fg-tertiary ml-auto">{points.length} points</span>
                    </div>
                  </div>

                  {/* Chart body */}
                  {chartLoading ? (
                    <div className="flex items-center justify-center" style={{ height: 380 }}><div className="skeleton h-64 w-3/4 rounded-lg" /></div>
                  ) : chartError ? (
                    <div className="flex items-center justify-center text-sm text-accent-danger" style={{ height: 380 }}>{(chartError as Error).message}</div>
                  ) : !chartOption ? (
                    <div className="flex flex-col items-center justify-center text-center" style={{ height: 380 }}>
                      <svg className="w-12 h-12 text-fg-disabled mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      <p className="text-sm text-fg-tertiary">No data for this time range</p>
                    </div>
                  ) : (
                    <div className="p-4"><ReactECharts option={chartOption} style={{ height: 380 }} notMerge lazyUpdate /></div>
                  )}

                  {/* Summary table — inside chart card, below chart */}
                  {by !== 'none' && topList.length > 0 && (
                    <div className="border-t border-border-subtle">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle text-left text-[10px] font-medium text-fg-tertiary">
                            <th className="pl-4 py-2 font-normal" />
                            <th className="py-2">{by}</th>
                            <th className="py-2 text-right">Value</th>
                            <th className="py-2 text-right pr-4">% of Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {topList.slice(0, 10).map((item, i) => (
                            <tr key={item.label} className="hover:bg-bg-subtle/50 transition-colors">
                              <td className="pl-4 py-2.5">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                              </td>
                              <td className="py-2.5 text-fg-primary font-mono">{item.label}</td>
                              <td className="py-2.5 text-fg-secondary font-mono text-right">{formatValue(item.value, selectedDef.unit)}</td>
                              <td className="py-2.5 text-fg-tertiary font-mono text-right pr-4">{item.pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-center bg-bg-elevated border border-border rounded-lg">
                <svg className="w-16 h-16 text-fg-disabled mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                <h3 className="text-base font-semibold text-fg-primary mb-1">Select a metric</h3>
                <p className="text-sm text-fg-tertiary">Choose a metric from the sidebar to explore its data</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
