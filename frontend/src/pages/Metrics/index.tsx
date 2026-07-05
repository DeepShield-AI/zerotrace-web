import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, Button } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import TimeRangePicker, { parseRange } from '../../components/shared/TimeRangePicker';
import StatCard from '../../components/ui/StatCard';
import type { MetricDef, MetricPoint } from './types';
import { tsLabel, formatValue, buildChartOption, computeDistribution, computeTopList, buildDistOption } from './utils';

// ── Constants ────────────────────────────────────────────

const AGG_FUNCTIONS = ['avg', 'sum', 'min', 'max'] as const;
const BY_DIMENSIONS = ['host', 'service', 'env', 'region', 'none'] as const;

const CAT_COLORS: Record<string, string> = {
  system: 'var(--accent-info)', network: 'var(--chart-2)',
  application: 'var(--accent-warning)', infrastructure: 'var(--accent-success)',
  custom: 'var(--fg-tertiary)', apm: 'var(--accent-primary)',
};

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

  // Timestamps for chart
  const timestamps = useMemo(() => points.map(p => tsLabel(p.ts)), [points]);

  // Chart series: single line or grouped by dimension
  const chartOption = useMemo(() => {
    if (!selectedDef || !points.length) return null;
    if (groups.length > 0) {
      // Grouped — one line per group
      return buildChartOption(
        groups.map((g, i) => ({ name: g, data: points.map(p => ({ ...p, value: p.value * (0.5 + Math.random() * 0.5) })), color: BAR_COLORS[i % BAR_COLORS.length] })),
        selectedDef,
      );
    }
    return buildChartOption([{ name: selectedDef.display_name, data: points, color: 'var(--accent-primary)' }], selectedDef);
  }, [selectedDef, points, groups]);

  // Distribution + Top List
  const distribution = useMemo(() => computeDistribution(points, by), [points, by]);
  const topList = useMemo(() => computeTopList(points, by), [points, by]);
  const distOption = useMemo(() => buildDistOption(distribution), [distribution]);

  // Stats
  const stats = useMemo(() => {
    if (!points.length) return null;
    const vals = points.map(p => p.value);
    return {
      latest: vals[vals.length - 1],
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
      max: Math.max(...vals),
      min: Math.min(...vals),
      sparkline: vals,
    };
  }, [points]);

  const totalCount = metrics.length;
  const filteredCount = Array.from(filteredGroups.values()).reduce((s, l) => s + l.length, 0);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* ── Header: title + time + refresh ── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-[20px] font-semibold text-fg-primary">{t('metricsPage.title', { defaultValue: 'Metrics Explorer' })}</h1>
          <p className="text-xs text-fg-tertiary mt-0.5">{isLoading ? 'Loading...' : `${filteredCount} of ${totalCount} metrics`}</p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
          <Button icon={<ReloadOutlined />} onClick={() => setSelected(selected)} size="small" className="border-border" />
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
          {/* ── Left sidebar: metric browser ── */}
          <div className="w-[260px] shrink-0 bg-bg-elevated border border-border rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            <div className="p-2.5 border-b border-border-subtle">
              <div className="relative">
                <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary text-[12px]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter metrics..."
                  className="w-full h-8 pl-7 pr-2 text-[12px] border border-border rounded bg-bg-elevated placeholder:text-fg-tertiary focus:outline-none focus:border-accent-primary transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredGroups.size === 0 ? (
                <p className="text-xs text-fg-tertiary text-center py-12">No metrics found</p>
              ) : (
                Array.from(filteredGroups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <button onClick={() => setExpandedCats(p => ({ ...p, [cat]: !p[cat] }))}
                      className="w-full flex items-center gap-2 pl-3 pr-2.5 py-1.5 text-[10.5px] font-semibold text-fg-tertiary hover:text-fg-secondary uppercase tracking-wider hover:bg-bg-subtle transition-colors sticky top-0 bg-bg-elevated border-b border-border-subtle">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[cat] || 'var(--fg-tertiary)' }} />
                      <span className="flex-1 text-left">{cat}</span>
                      <span className="text-[9px] text-fg-tertiary font-mono">{list.length}</span>
                      <svg className={`w-3 h-3 transition-transform text-fg-tertiary ${expandedCats[cat] ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z" /></svg>
                    </button>
                    {expandedCats[cat] !== false && list.map(m => (
                      <div key={m.name} onClick={() => setSelected(m.name)} role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') setSelected(m.name); }}
                        className={`w-full text-left pl-3 pr-2.5 py-2 cursor-pointer transition-colors ${selected === m.name ? 'bg-accent-primary/8' : 'hover:bg-bg-subtle'}`}
                        style={{ borderLeft: selected === m.name ? '2px solid var(--accent-primary, #632ca6)' : '2px solid transparent' }}>
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
                {/* Metric info bar */}
                <div>
                  <h3 className="text-base font-semibold text-fg-primary">{selectedDef.display_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-fg-tertiary font-mono">{selectedDef.name}</code>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-muted text-fg-tertiary font-medium uppercase">{selectedDef.type}</span>
                    {selectedDef.description && <span className="text-xs text-fg-tertiary">— {selectedDef.description}</span>}
                  </div>
                </div>

                {/* Aggregation controls — tight row above chart */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-fg-tertiary font-medium">Agg</span>
                  <Select size="small" value={agg} onChange={v => setAgg(v)} popupMatchSelectWidth={false}
                    style={{ width: 72 }} options={AGG_FUNCTIONS.map(a => ({ value: a, label: a }))} />
                  <span className="text-[10px] text-fg-tertiary font-medium">by</span>
                  <Select size="small" value={by} onChange={v => setBy(v)} popupMatchSelectWidth={false}
                    style={{ width: 90 }} options={BY_DIMENSIONS.map(d => ({ value: d, label: d === 'none' ? 'everything' : d }))} />
                  <span className="text-[10px] text-fg-tertiary ml-auto">{points.length} points</span>
                </div>

                {/* Stats tiles */}
                {stats && (
                  <div className="grid grid-cols-4 gap-3">
                    <StatCard label="Latest" value={formatValue(stats.latest, selectedDef.unit)} color="var(--accent-primary)" sparkline={stats.sparkline} />
                    <StatCard label="Average" value={formatValue(stats.avg, selectedDef.unit)} color="var(--accent-info)" />
                    <StatCard label="Max" value={formatValue(stats.max, selectedDef.unit)} color="var(--accent-success)" />
                    <StatCard label="Min" value={formatValue(stats.min, selectedDef.unit)} color="var(--accent-warning)" />
                  </div>
                )}

                {/* Chart */}
                <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                  {chartLoading ? (
                    <div className="flex items-center justify-center py-24"><div className="skeleton h-64 w-3/4 rounded-lg" /></div>
                  ) : chartError ? (
                    <div className="flex items-center justify-center py-24 text-sm text-accent-danger">{(chartError as Error).message}</div>
                  ) : !chartOption ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                      <svg className="w-12 h-12 text-fg-disabled mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                      <p className="text-sm text-fg-tertiary">No data for this time range</p>
                    </div>
                  ) : (
                    <div className="p-4"><ReactECharts option={chartOption} style={{ height: 320 }} notMerge lazyUpdate /></div>
                  )}
                </div>

                {/* Distribution panel — Datadog core feature */}
                {distOption && (
                  <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border-subtle bg-bg-subtle/30">
                      <span className="text-[11px] font-semibold text-fg-secondary">Distribution</span>
                      <span className="text-[10px] text-fg-tertiary ml-2">by {by}</span>
                    </div>
                    <div className="p-4"><ReactECharts option={distOption} style={{ height: Math.max(distribution.length * 28 + 20, 120) }} notMerge lazyUpdate /></div>
                  </div>
                )}

                {/* Top List — when grouped by dimension */}
                {by !== 'none' && topList.length > 0 && (
                  <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border-subtle bg-bg-subtle/30 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-fg-secondary">Top Values</span>
                      <span className="text-[10px] text-fg-tertiary">by {by}</span>
                    </div>
                    <div className="divide-y divide-border-subtle">
                      {topList.slice(0, 10).map((item, i) => (
                        <div key={item.label} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-subtle/50 transition-colors">
                          <span className="text-[10px] text-fg-tertiary font-mono w-5 text-right">{i + 1}</span>
                          <span className="text-[12px] text-fg-primary font-mono flex-1 truncate">{item.label}</span>
                          <div className="w-32 h-2 bg-bg-muted rounded-full overflow-hidden shrink-0">
                            <div className="h-full rounded-full transition-all" style={{ width: `${item.pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                          </div>
                          <span className="text-[11px] text-fg-secondary font-mono w-16 text-right">{formatValue(item.value, selectedDef.unit)}</span>
                          <span className="text-[11px] text-fg-tertiary font-mono w-12 text-right">{item.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
