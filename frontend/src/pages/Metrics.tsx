import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select, Button, Spin, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined, CopyOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { fmtN, fmtB, fmtLatency } from '../utils/format';
import { chartTheme } from '../lib/tokens';

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

/* ── Types ── */

interface MetricDef {
  name: string;
  display_name: string;
  type: string;
  unit: string;
  description: string;
  category: string;
}

interface MetricPoint {
  ts: string;
  value: number;
}

import TimeRangePicker, { parseRange } from '../components/shared/TimeRangePicker';
import StatCard from '../components/StatCard';

function tsLabel(ts: string): string {
  try { return ts ? ts.slice(11, 16) : ''; } catch { return ''; }
}

/* ── Format value ── */

function formatValue(v: number, unit: string): string {
  switch (unit) {
    case 'bytes': return fmtB(v);
    case 'μs': case 'us': return fmtLatency(v);
    case '%': return v.toFixed(2) + '%';
    default: return fmtN(v);
  }
}

function formatUnit(unit: string): string {
  if (unit === 'μs') return 'μs';
  return unit;
}

/* ── Category icon ── */

function CategoryIcon({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    system: '#3b82f6',
    network: '#8b5cf6',
    application: '#e2903c',
    infrastructure: '#22c55e',
    custom: '#6b7280',
  };
  const color = colorMap[category] || '#632CA6';

  return (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
  );
}

/* ── Main Page ── */

export default function MetricsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState('1h');

  const { start, end } = parseRange(range);

  // Metrics list
  const { data: metricsListData, isLoading: loading, error: loadError } = useQuery({
    queryKey: ['metrics-list'],
    queryFn: () => api.getMetricsList(),
  });
  const metrics: MetricDef[] = metricsListData?.metrics || [];

  // Initialize selected metric and expanded categories on first load
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

  // Metric points (chart data)
  const pointsQuery = useQuery({
    queryKey: ['metrics-points', selected, start, end],
    queryFn: () => api.queryMetrics({ name: selected!, start, end, interval: 60 }),
    enabled: !!selected,
  });
  const points: MetricPoint[] = pointsQuery.data?.points || [];
  const chartLoading = pointsQuery.isLoading;
  const chartError = pointsQuery.error ? (pointsQuery.error as Error).message || 'Failed to load' : '';

  // Group by category
  const groupedMetrics = useMemo(() => {
    const map = new Map<string, MetricDef[]>();
    metrics.forEach(m => {
      const list = map.get(m.category) || [];
      list.push(m);
      map.set(m.category, list);
    });
    return map;
  }, [metrics]);

  const filteredGroups = useMemo(() => {
    if (!search) return groupedMetrics;
    const q = search.toLowerCase();
    const filtered = new Map<string, MetricDef[]>();
    groupedMetrics.forEach((list, cat) => {
      const matched = list.filter(m =>
        m.display_name.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
      );
      if (matched.length > 0) filtered.set(cat, matched);
    });
    return filtered;
  }, [groupedMetrics, search]);

  const selectedDef = useMemo(() => metrics.find(m => m.name === selected), [metrics, selected]);

  // Chart
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    return () => { if (chartRef.current) echarts.dispose(chartRef.current); };
  }, []);

  useEffect(() => {
    const dom = chartRef.current;
    if (!dom) return;
    let inst = echarts.getInstanceByDom(dom);
    if (!inst) inst = echarts.init(dom);

    if (points.length === 0) { inst.clear(); return; }

    const data = points.map(p => p.value);
    const timestamps = points.map(p => tsLabel(p.ts));
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#632CA6';
    const unit = selectedDef?.unit || '';
    const axisColor = chartTheme.axisColor();
    const gridColor = chartTheme.gridColor();
    const tooltipBg = chartTheme.tooltipBg();
    const tooltipBorder = chartTheme.tooltipBorder();
    const fgPrimary = getComputedStyle(document.documentElement).getPropertyValue('--fg-primary').trim() || '#27272a';
    const fgSecondary = getComputedStyle(document.documentElement).getPropertyValue('--fg-secondary').trim() || '#71717a';

    inst.setOption({
      animation: false,
      grid: { left: 56, right: 20, top: 16, bottom: 28 },
      xAxis: {
        type: 'category', data: timestamps,
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10, color: axisColor,
          fontFamily: 'Geist Mono, monospace',
          interval: Math.max(1, Math.floor(timestamps.length / 8)) - 1,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { fontSize: 10, color: axisColor, fontFamily: 'Geist Mono, monospace' },
      },
      series: [{
        type: 'line', data, smooth: true, symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: color + '20' },
            { offset: 1, color: color + '00' },
          ]),
        },
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { fontSize: 11, color: fgPrimary, fontFamily: 'Geist Sans, system-ui, sans-serif' },
        formatter: (params: any) => {
          const p = params[0];
          return `<span style="font-family:Geist Mono,monospace;font-size:10px;color:${axisColor}">${p.axisValue}</span><br/>
            <strong style="font-size:15px;color:${fgPrimary}">${fmtN(p.value)}</strong>
            <span style="font-size:11px;color:${fgSecondary};margin-left:4px">${unit}</span>`;
        },
      },
    }, { notMerge: true });

    const onResize = () => inst.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [points, selectedDef]);

  // Stats
  const latestValue = points.length > 0 ? points[points.length - 1].value : null;
  const avgValue = points.length > 0 ? points.reduce((s, p) => s + p.value, 0) / points.length : null;
  const maxValue = points.length > 0 ? Math.max(...points.map(p => p.value)) : null;
  const minValue = points.length > 0 ? Math.min(...points.map(p => p.value)) : null;
  const sparklineData = points.map(p => p.value);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {}).catch(() => {});
  }, []);

  const totalCount = metrics.length;
  const filteredCount = Array.from(filteredGroups.values()).reduce((s, l) => s + l.length, 0);

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-[22px] font-bold text-fg-primary">{t('metricsPage.title', { defaultValue: 'Metrics Explorer' })}</h1>
          <p className="text-xs text-fg-tertiary mt-0.5">
            {loading ? 'Loading...' : `${filteredCount} of ${totalCount} metrics`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { if (selected) pointsQuery.refetch(); }}
            size="small"
            className="border-border"
          />
        </div>
      </div>

      {/* ── Main content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Spin size="large" /></div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-accent-danger-bg flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent-danger">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-fg-secondary mb-1">Failed to load metrics</p>
          <p className="text-xs text-fg-tertiary max-w-md">{loadError.message || 'Failed to load metrics'}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-xs font-medium bg-bg-muted hover:bg-bg-muted rounded-lg transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* ── Left sidebar: metric list ── */}
          <div className="w-[260px] shrink-0 bg-bg-elevated border border-border rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {/* Search */}
            <div className="p-3 border-b border-border-subtle">
              <div className="relative mb-3">
                <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary text-[12px]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter metrics..."
                  className="w-full h-8 pl-8 pr-2 text-[12px] border border-border rounded bg-bg-elevated
                    placeholder:text-fg-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/10 transition-all"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {Array.from(filteredGroups.keys()).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full transition-all ${
                      expandedCats[cat]
                        ? 'bg-bg-elevated text-fg-inverse'
                        : 'bg-bg-muted text-fg-tertiary hover:bg-bg-muted'
                    }`}
                  >
                    <CategoryIcon category={cat} />
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric list */}
            <div className="flex-1 overflow-y-auto">
              {filteredGroups.size === 0 ? (
                <p className="text-xs text-fg-tertiary text-center py-12">No metrics match your search</p>
              ) : (
                Array.from(filteredGroups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <button
                      onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider hover:bg-bg-subtle transition-colors sticky top-0 bg-bg-elevated border-b border-border-subtle"
                    >
                      <CategoryIcon category={cat} />
                      <span className="flex-1 text-left">{cat}</span>
                      <span className="text-[10px] text-fg-tertiary font-mono">{list.length}</span>
                      <svg className={`w-3 h-3 transition-transform ${expandedCats[cat] ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 8L2 4h8z" />
                      </svg>
                    </button>
                    {expandedCats[cat] !== false && list.map(m => (
                      <button
                        key={m.name}
                        onClick={() => setSelected(m.name)}
                        className={`w-full text-left px-3 py-2.5 transition-colors border-b border-border-subtle ${
                          selected === m.name
                            ? 'bg-accent-primary/10 border-l-[3px] border-l-accent-primary'
                            : 'hover:bg-bg-subtle border-l-[3px] border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-fg-primary truncate flex-1">
                            {m.display_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-muted text-fg-tertiary font-mono">
                            {m.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-fg-tertiary font-mono mt-0.5 truncate">{m.name}</p>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Right: content ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {selectedDef && (
              <>
                {/* Metric header + actions */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-fg-primary">{selectedDef.display_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-fg-tertiary font-mono">{selectedDef.name}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-muted text-fg-tertiary font-medium uppercase">
                        {selectedDef.type}
                      </span>
                      {selectedDef.description && (
                        <span className="text-xs text-fg-tertiary">{selectedDef.description}</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Tooltip title="Copy query">
                      <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(selectedDef.name)} className="border-border text-xs" />
                    </Tooltip>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => navigate('/dashboards')}
                      className="border-border text-xs">
                      Dashboard
                    </Button>
                    <Button size="small" icon={<LinkOutlined />} onClick={() => navigate('/monitors')}
                      className="border-border text-xs">
                      Monitor
                    </Button>
                  </div>
                </div>

                {/* Stats tiles */}
                {latestValue != null && (
                  <div className="grid grid-cols-4 gap-3">
                    <StatCard
                      label="Latest"
                      value={formatValue(latestValue, selectedDef.unit)}
                      color="var(--accent-primary)"
                      sparkline={sparklineData}
                    />
                    <StatCard
                      label="Average"
                      value={avgValue != null ? formatValue(avgValue, selectedDef.unit) : '--'}
                      color="var(--accent-info)"
                    />
                    <StatCard
                      label="Maximum"
                      value={maxValue != null ? formatValue(maxValue, selectedDef.unit) : '--'}
                      color="var(--accent-success)"
                    />
                    <StatCard
                      label="Minimum"
                      value={minValue != null ? formatValue(minValue, selectedDef.unit) : '--'}
                      color="var(--accent-warning)"
                    />
                  </div>
                )}

                {/* Chart */}
                <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between bg-bg-subtle/50">
                    <h4 className="text-[11px] font-bold text-fg-tertiary uppercase tracking-wider">Time Series</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-fg-tertiary font-mono">{points.length} points</span>
                      <span className="text-[10px] text-fg-tertiary">
                        Agg: <span className="font-semibold text-fg-secondary">avg</span>
                      </span>
                    </div>
                  </div>
                  {chartLoading ? (
                    <div className="flex items-center justify-center py-20"><Spin /></div>
                  ) : chartError ? (
                    <div className="flex items-center justify-center py-20 text-sm text-accent-danger">{chartError}</div>
                  ) : points.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <svg className="w-12 h-12 text-fg-disabled mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      <p className="text-sm text-fg-tertiary">No data for this time range</p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <div ref={chartRef} style={{ height: 340, width: '100%' }} />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
