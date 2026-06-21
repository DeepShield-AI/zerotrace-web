import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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

import TimeRangePicker, { parseRange } from '../components/TimeRangePicker';

function tsLabel(ts: string): string {
  try { return ts ? ts.slice(11, 16) : ''; } catch { return ''; }
}

/* ── Sparkline ── */

function MiniSparkline({ data, color = '#632CA6', width = 70, height = 24 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = 2 + (i / (data.length - 1)) * (width - 4);
    const y = 2 + (1 - (v - min) / range) * (height - 4);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Stat Card ── */

function StatCard({ label, value, sub, color = '#632CA6', sparkline }: {
  label: string; value: string; sub?: string; color?: string; sparkline?: number[];
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-sm transition-shadow group cursor-pointer">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-zinc-900 font-mono tracking-tight" style={{ color }}>
          {value}
        </p>
        {sparkline && sparkline.length >= 2 && (
          <MiniSparkline data={sparkline} color={color} />
        )}
      </div>
      {sub && <p className="text-[11px] text-zinc-400 mt-1">{sub}</p>}
    </div>
  );
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

  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [range, setRange] = useState('1h');
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');
  const [loadError, setLoadError] = useState('');

  const { start, end } = parseRange(range);

  useEffect(() => {
    setLoading(true);
    setLoadError('');
    api.getMetricsList().then(d => {
      const all = d.metrics || [];
      setMetrics(all);
      if (all.length > 0 && !selected) setSelected(all[0].name);
      // Expand all categories by default
      const cats: Record<string, boolean> = {};
      all.forEach(m => { cats[m.category] = true; });
      setExpandedCats(cats);
      setLoading(false);
    }).catch(err => {
      setLoadError(err.message || 'Failed to load metrics');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setChartLoading(true);
    setChartError('');
    api.queryMetrics({ name: selected, start, end, interval: 60 })
      .then(d => setPoints(d.points || []))
      .catch(e => setChartError(e.message || 'Failed to load'))
      .finally(() => setChartLoading(false));
  }, [selected, start, end]);

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
    const color = '#632CA6';
    const unit = selectedDef?.unit || '';

    inst.setOption({
      animation: false,
      grid: { left: 56, right: 20, top: 16, bottom: 28 },
      xAxis: {
        type: 'category', data: timestamps,
        axisLine: { lineStyle: { color: '#e4e4e7' } },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 10, color: '#a1a1aa',
          fontFamily: 'Geist Mono, monospace',
          interval: Math.max(1, Math.floor(timestamps.length / 8)) - 1,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f4f4f5' } },
        axisLabel: { fontSize: 10, color: '#a1a1aa', fontFamily: 'Geist Mono, monospace' },
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
        backgroundColor: '#fff',
        borderColor: '#e4e4e7',
        textStyle: { fontSize: 11, color: '#27272a', fontFamily: 'Geist Sans, system-ui, sans-serif' },
        formatter: (params: any) => {
          const p = params[0];
          return `<span style="font-family:Geist Mono,monospace;font-size:10px;color:#a1a1aa">${p.axisValue}</span><br/>
            <strong style="font-size:15px">${fmtN(p.value)}</strong>
            <span style="font-size:11px;color:#71717a;margin-left:4px">${unit}</span>`;
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
          <h1 className="text-[22px] font-bold text-zinc-900">{t('metricsPage.title', { defaultValue: 'Metrics Explorer' })}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {loading ? 'Loading...' : `${filteredCount} of ${totalCount} metrics`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              if (selected) {
                setChartLoading(true);
                api.queryMetrics({ name: selected, start, end, interval: 60 })
                  .then(d => setPoints(d.points || []))
                  .finally(() => setChartLoading(false));
              }
            }}
            size="small"
            className="border-zinc-200"
          />
        </div>
      </div>

      {/* ── Main content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-24"><Spin size="large" /></div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-600 mb-1">Failed to load metrics</p>
          <p className="text-xs text-zinc-400 max-w-md">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* ── Left sidebar: metric list ── */}
          <div className="w-[260px] shrink-0 bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {/* Search */}
            <div className="p-3 border-b border-zinc-100">
              <div className="relative mb-3">
                <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[12px]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filter metrics..."
                  className="w-full h-8 pl-8 pr-2 text-[12px] border border-zinc-200 rounded bg-white
                    placeholder:text-zinc-400 focus:outline-none focus:border-[#632CA6] focus:ring-1 focus:ring-[#632CA6]/10 transition-all"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {Array.from(filteredGroups.keys()).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full transition-all ${
                      expandedCats[cat]
                        ? 'bg-zinc-800 text-white'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
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
                <p className="text-xs text-zinc-400 text-center py-12">No metrics match your search</p>
              ) : (
                Array.from(filteredGroups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <button
                      onClick={() => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider hover:bg-zinc-50 transition-colors sticky top-0 bg-white border-b border-zinc-100"
                    >
                      <CategoryIcon category={cat} />
                      <span className="flex-1 text-left">{cat}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{list.length}</span>
                      <svg className={`w-3 h-3 transition-transform ${expandedCats[cat] ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 8L2 4h8z" />
                      </svg>
                    </button>
                    {expandedCats[cat] !== false && list.map(m => (
                      <button
                        key={m.name}
                        onClick={() => setSelected(m.name)}
                        className={`w-full text-left px-3 py-2.5 transition-colors border-b border-zinc-50 ${
                          selected === m.name
                            ? 'bg-[#F3F0FA] border-l-[3px] border-l-[#632CA6]'
                            : 'hover:bg-zinc-50 border-l-[3px] border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-zinc-800 truncate flex-1">
                            {m.display_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-mono">
                            {m.type}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">{m.name}</p>
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
                    <h3 className="text-lg font-bold text-zinc-900">{selectedDef.display_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-zinc-500 font-mono">{selectedDef.name}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium uppercase">
                        {selectedDef.type}
                      </span>
                      {selectedDef.description && (
                        <span className="text-xs text-zinc-400">{selectedDef.description}</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Tooltip title="Copy query">
                      <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(selectedDef.name)} className="border-zinc-200 text-xs" />
                    </Tooltip>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => navigate('/dashboards')}
                      className="border-zinc-200 text-xs">
                      Dashboard
                    </Button>
                    <Button size="small" icon={<LinkOutlined />} onClick={() => navigate('/monitors')}
                      className="border-zinc-200 text-xs">
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
                      color="#632CA6"
                      sparkline={sparklineData}
                    />
                    <StatCard
                      label="Average"
                      value={avgValue != null ? formatValue(avgValue, selectedDef.unit) : '--'}
                      color="#4799EB"
                    />
                    <StatCard
                      label="Maximum"
                      value={maxValue != null ? formatValue(maxValue, selectedDef.unit) : '--'}
                      color="#22c55e"
                    />
                    <StatCard
                      label="Minimum"
                      value={minValue != null ? formatValue(minValue, selectedDef.unit) : '--'}
                      color="#e2903c"
                    />
                  </div>
                )}

                {/* Chart */}
                <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Time Series</h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-400 font-mono">{points.length} points</span>
                      <span className="text-[10px] text-zinc-400">
                        Agg: <span className="font-semibold text-zinc-600">avg</span>
                      </span>
                    </div>
                  </div>
                  {chartLoading ? (
                    <div className="flex items-center justify-center py-20"><Spin /></div>
                  ) : chartError ? (
                    <div className="flex items-center justify-center py-20 text-sm text-red-500">{chartError}</div>
                  ) : points.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <svg className="w-12 h-12 text-zinc-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      <p className="text-sm text-zinc-400">No data for this time range</p>
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
