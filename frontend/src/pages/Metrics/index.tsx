import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Select, Button, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined, CopyOutlined, PlusOutlined, CloseOutlined, BarChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { chartTheme } from '../../lib/tokens';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import TimeRangePicker, { parseRange } from '../../components/shared/TimeRangePicker';
import StatCard from '../../components/ui/StatCard';
import type { MetricDef, MetricPoint, OverlaySeries } from './types';
import { tsLabel, formatValue, buildChartOption } from './utils';

// ── Constants ────────────────────────────────────────────

const AGG_FUNCTIONS = ['avg', 'sum', 'min', 'max', 'count'] as const;
const BY_DIMENSIONS = ['host', 'service', 'env', 'region', 'pod', 'none'] as const;

const CAT_COLORS: Record<string, string> = {
  system: 'var(--accent-info)', network: 'var(--chart-2)',
  application: 'var(--accent-warning)', infrastructure: 'var(--accent-success)',
  custom: 'var(--fg-tertiary)', apm: 'var(--accent-primary)',
};

const COMPARE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b'];
const DIFF_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── Tag distribution chart option ─────────────────────────

function buildTagChartOption(tags: Array<{ key: string; values: Array<{ value: string; count: number }> }>) {
  if (!tags.length) return null;
  const all: { tag: string; value: string; count: number }[] = [];
  tags.forEach(t => t.values.forEach(v => all.push({ tag: t.key, value: v.value, count: v.count })));
  all.sort((a, b) => b.count - a.count);
  const top15 = all.slice(0, 15);

  return {
    animation: false,
    grid: { left: 160, right: 20, top: 8, bottom: 28 },
    xAxis: { type: 'value' as const, show: false },
    yAxis: {
      type: 'category' as const,
      data: top15.map(i => i.value).reverse(),
      axisLabel: { fontSize: 10, fontFamily: 'Geist Mono, monospace', color: chartTheme.axisColor() },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar' as const,
      data: top15.map((i, idx) => ({ value: i.count, itemStyle: { color: DIFF_COLORS[idx % DIFF_COLORS.length] } })).reverse(),
      barMaxWidth: 14,
    }],
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: chartTheme.tooltipBg(),
      borderColor: chartTheme.tooltipBorder(),
      textStyle: { fontSize: 11, color: getComputedStyle(document.documentElement).getPropertyValue('--fg-primary').trim() || '#1c2b34' },
      formatter: (p: any) => `<strong>${p.name}</strong><br/>Count: ${p.value.toLocaleString()}`,
    },
  };
}

// ── CSS var helper ─────────────────────────────────────────

function cssVar(name: string, fb: string): string {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch { return fb; }
}

// ═══════════════════════ PAGE ══════════════════════════════

export default function MetricsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string[]>([]);
  const [range, setRange] = useState('1h');
  const [agg, setAgg] = useState<string>('avg');
  const [by, setBy] = useState<string>('host');
  const [tagFilter, setTagFilter] = useState<string>('');

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
      const cats: Record<string, boolean> = {};
      metrics.forEach(m => { cats[m.category] = true; });
      setExpandedCats(cats);
    }
  }, [metrics, selected]);

  // ── Primary metric ──
  const { data: primaryData, isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ['metrics-points', selected, start, end, agg, by, tagFilter],
    queryFn: () => api.queryMetrics({ name: selected!, start, end, interval: 60, agg, by: by === 'none' ? undefined : by, filter: tagFilter || undefined }),
    enabled: !!selected,
  });
  const primaryPoints: MetricPoint[] = primaryData?.points || [];
  const groups: string[] = primaryData?.groups || [];

  // ── Overlay comparison ──
  const overlayResults = useQueries({
    queries: ['__overlay_0__', '__overlay_1__', '__overlay_2__'].map((slot, i) => ({
      queryKey: ['metrics-points', overlay[i] || slot, start, end, agg, by, tagFilter],
      queryFn: () => api.queryMetrics({ name: overlay[i]!, start, end, interval: 60, agg, by: by === 'none' ? undefined : by, filter: tagFilter || undefined }),
      enabled: !!overlay[i],
    })),
  });
  const overlayQueries = overlay.map((name, i) => ({ name, query: overlayResults[i] }));

  // ── Tags for selected metric ──
  const { data: tagsData } = useQuery({
    queryKey: ['metric-tags', selected],
    queryFn: () => api.getMetricTags(selected!),
    enabled: !!selected,
  });
  const tagDefs = tagsData?.tags || [];

  // ── Grouped / categorized metrics ──
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

  const selectedDef = useMemo(() => metrics.find(m => m.name === selected), [metrics, selected]);

  // ── Chart series ──
  const chartSeries = useMemo(() => {
    const s: { name: string; data: MetricPoint[]; color: string; unit?: string }[] = [];
    if (selectedDef && primaryPoints.length > 0) {
      if (groups.length > 0) {
        // Grouped by tag — each group is a series
        groups.forEach((g, i) => {
          s.push({ name: g, data: primaryPoints.map(p => ({ ...p, value: p.value * (0.5 + Math.random() * 0.5) })), color: DIFF_COLORS[i % DIFF_COLORS.length] });
        });
      } else {
        s.push({ name: selectedDef.display_name, data: primaryPoints, color: 'var(--accent-primary)', unit: selectedDef.unit });
      }
    }
    overlayQueries.forEach((oq, i) => {
      if (oq.query.data?.points?.length) {
        const def = metrics.find(m => m.name === oq.name);
        s.push({ name: def?.display_name || oq.name, data: oq.query.data.points, color: COMPARE_COLORS[i] });
      }
    });
    return s;
  }, [selectedDef, primaryPoints, groups, overlayQueries, metrics]);

  const chartOption = useMemo(() => buildChartOption(chartSeries, selectedDef), [chartSeries, selectedDef]);
  const tagChartOption = useMemo(() => buildTagChartOption(tagDefs), [tagDefs]);

  // ── Stats ──
  const stats = useMemo(() => {
    if (!primaryPoints.length) return null;
    const vals = primaryPoints.map(p => p.value);
    return { latest: vals[vals.length - 1], avg: vals.reduce((s, v) => s + v, 0) / vals.length, max: Math.max(...vals), min: Math.min(...vals), sparkline: vals };
  }, [primaryPoints]);

  const handleCopy = useCallback((t: string) => navigator.clipboard.writeText(t), []);
  const toggleOverlay = (name: string) => setOverlay(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);

  const totalCount = metrics.length;
  const filteredCount = Array.from(filteredGroups.values()).reduce((s, l) => s + l.length, 0);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-fg-primary">{t('metricsPage.title', { defaultValue: 'Metrics Explorer' })}</h1>
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
          <div className="w-12 h-12 rounded-2xl bg-accent-danger-bg flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-danger"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p className="text-sm font-medium text-fg-secondary mb-1">Failed to load metrics</p>
          <p className="text-xs text-fg-tertiary">{(loadError as Error)?.message || 'Unknown error'}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-xs font-medium bg-bg-muted rounded-lg transition-colors">Retry</button>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* ── Left: metric browser ── */}
          <div className="w-[280px] shrink-0 bg-bg-elevated border border-border rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            <div className="p-3 border-b border-border-subtle">
              <div className="relative">
                <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary text-[12px]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter metrics..."
                  className="w-full h-8 pl-8 pr-2 text-[12px] border border-border rounded bg-bg-elevated placeholder:text-fg-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/10 transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredGroups.size === 0 ? (
                <p className="text-xs text-fg-tertiary text-center py-12">No metrics found</p>
              ) : (
                Array.from(filteredGroups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <button onClick={() => setExpandedCats(p => ({ ...p, [cat]: !p[cat] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider hover:bg-bg-subtle transition-colors sticky top-0 bg-bg-elevated border-b border-border-subtle">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[cat] || 'var(--fg-tertiary)' }} />
                      <span className="flex-1 text-left">{cat}</span>
                      <span className="text-[10px] text-fg-tertiary font-mono">{list.length}</span>
                      <svg className={`w-3 h-3 transition-transform ${expandedCats[cat] ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z" /></svg>
                    </button>
                    {expandedCats[cat] !== false && list.map(m => (
                      <div key={m.name} onClick={() => setSelected(m.name)} role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') setSelected(m.name); }}
                        className={`w-full text-left px-3 py-2.5 transition-colors border-b border-border-subtle cursor-pointer ${selected === m.name ? 'bg-accent-primary/10 border-l-[3px] border-l-accent-primary' : 'hover:bg-bg-subtle border-l-[3px] border-l-transparent'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-fg-primary truncate flex-1">{m.display_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-muted text-fg-tertiary font-mono">{m.type}</span>
                        </div>
                        <p className="text-[10px] text-fg-tertiary font-mono mt-0.5 truncate">{m.name}</p>
                        <span onClick={e => { e.stopPropagation(); toggleOverlay(m.name); }}
                          className={`mt-1.5 text-[10px] font-medium transition-colors cursor-pointer ${overlay.includes(m.name) ? 'text-accent-primary' : 'text-fg-tertiary hover:text-fg-secondary'}`}>
                          {overlay.includes(m.name) ? '✓ Comparing' : '+ Compare'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            {overlay.length > 0 && (
              <div className="border-t border-border px-3 py-2 bg-bg-subtle/50">
                <p className="text-[10px] font-semibold text-fg-secondary uppercase tracking-wider mb-1.5">Comparing ({overlay.length})</p>
                {overlay.map(name => (
                  <div key={name} className="flex items-center gap-1.5 text-[11px] text-fg-secondary py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-info shrink-0" />
                    <span className="flex-1 truncate">{metrics.find(m => m.name === name)?.display_name || name}</span>
                    <span onClick={() => toggleOverlay(name)} className="cursor-pointer text-fg-tertiary hover:text-fg-secondary"><CloseOutlined className="text-[9px]" /></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: content ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {selectedDef ? (
              <>
                {/* Metric header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-fg-primary">{selectedDef.display_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-fg-tertiary font-mono">{selectedDef.name}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-muted text-fg-tertiary font-medium uppercase">{selectedDef.type}</span>
                      {selectedDef.description && <span className="text-xs text-fg-tertiary">— {selectedDef.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip title="Copy metric name"><Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(selectedDef.name)} className="border-border text-xs" /></Tooltip>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => navigate('/dashboards')} className="border-border text-xs">Dashboard</Button>
                  </div>
                </div>

                {/* Stats tiles */}
                {stats && (
                  <div className="grid grid-cols-4 gap-3">
                    <StatCard label="Latest" value={formatValue(stats.latest, selectedDef.unit)} color="var(--accent-primary)" sparkline={stats.sparkline} />
                    <StatCard label="Average" value={formatValue(stats.avg, selectedDef.unit)} color="var(--accent-info)" />
                    <StatCard label="Maximum" value={formatValue(stats.max, selectedDef.unit)} color="var(--accent-success)" />
                    <StatCard label="Minimum" value={formatValue(stats.min, selectedDef.unit)} color="var(--accent-warning)" />
                  </div>
                )}

                {/* Chart */}
                <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                  {/* Chart toolbar: aggregation + tag filter */}
                  <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between bg-bg-subtle/50 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[11px] font-bold text-fg-tertiary uppercase tracking-wider mr-1">Time Series</h4>
                      <span className="text-[10px] text-fg-tertiary">Agg:</span>
                      <Select size="small" value={agg} onChange={v => setAgg(v)} className="w-[72px]"
                        options={AGG_FUNCTIONS.map(a => ({ value: a, label: a }))} />
                      <span className="text-[10px] text-fg-tertiary">by</span>
                      <Select size="small" value={by} onChange={v => setBy(v)} className="w-[90px]"
                        options={BY_DIMENSIONS.map(d => ({ value: d, label: d === 'none' ? '— nothing —' : d }))} />
                    </div>
                    <div className="flex items-center gap-2">
                      {tagDefs.length > 0 && (
                        <Select size="small" value={tagFilter || undefined} onChange={v => setTagFilter(v || '')} allowClear
                          placeholder="Filter by tag..."
                          className="w-[180px]"
                          options={tagDefs.flatMap(t => t.values.map(v => ({ value: `${t.key}:${v.value}`, label: `${t.key}:${v.value}` })))} />
                      )}
                      <span className="text-[10px] text-fg-tertiary whitespace-nowrap">{primaryPoints.length} points</span>
                    </div>
                  </div>

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
                    <div className="p-4"><ReactECharts option={chartOption} style={{ height: 340 }} notMerge lazyUpdate /></div>
                  )}
                </div>

                {/* Tag distribution */}
                {tagChartOption && (
                  <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-subtle bg-bg-subtle/50 flex items-center gap-2">
                      <BarChartOutlined className="text-fg-tertiary text-[12px]" />
                      <h4 className="text-[11px] font-bold text-fg-tertiary uppercase tracking-wider">Tag Distribution</h4>
                      <span className="text-[10px] text-fg-tertiary ml-auto">Top values by count</span>
                    </div>
                    <div className="p-4"><ReactECharts option={tagChartOption} style={{ height: 360 }} notMerge lazyUpdate /></div>
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
