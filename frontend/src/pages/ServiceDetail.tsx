import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spin, Segmented, Tooltip } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined, WarningOutlined, ApiOutlined, NodeIndexOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api } from '../api/client';
import TopologyMap, { TopologyNode, TopologyEdge } from '../components/TopologyMap';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OperationItem {
  operation_name: string;
  cnt: number | string;
  avg_latency_ms: number | string;
  p95_ms: number | string;
  error_count: number | string;
}

interface TsRow {
  ts?: string;
  cnt?: number;
  avg_latency_ms?: number;
  error_cnt?: number;
}

interface DepItem {
  downstream_service?: string;
  upstream_service?: string;
  call_count: number | string;
  avg_latency_ms: number | string;
  p95_latency_ms: number | string;
  error_count: number | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const num = (v: number | string | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
function fmtN(n?: number | string): string {
  const v = num(n);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}
function fmtLatency(n?: number | string): string {
  const v = num(n);
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return Math.round(v) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

const chartTheme = {
  color: ['#632CA6', '#2DB88D', '#E2903C', '#E65C5C', '#4799EB'],
  textStyle: { fontFamily: 'Geist Sans, system-ui, sans-serif', fontSize: 11, color: '#a1a1aa' },
  grid: { left: 50, right: 16, top: 12, bottom: 28 },
  xAxis: { axisLine: { lineStyle: { color: '#e4e4e7' } }, axisTick: { show: false }, splitLine: { show: false } },
  yAxis: { splitLine: { lineStyle: { color: '#f4f4f5' } } },
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [rate, setRate] = useState<TsRow[]>([]);
  const [depsDown, setDepsDown] = useState<DepItem[]>([]);
  const [depsUp, setDepsUp] = useState<DepItem[]>([]);
  const [topoNodes, setTopoNodes] = useState<TopologyNode[]>([]);
  const [topoEdges, setTopoEdges] = useState<TopologyEdge[]>([]);
  const [topoLoading, setTopoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!serviceName) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, deps, topo] = await Promise.all([
        api.getApmServiceDetail(serviceName),
        api.getApmServiceDependencies(serviceName),
        api.getApmTopology({ service: serviceName }),
      ]);
      setOverview((detail.overview || [])[0] || null);
      setOperations(detail.operations || []);
      setRate(detail.rate || []);
      setDepsDown(deps.downstream || []);
      setDepsUp(deps.upstream || []);
      setTopoNodes(topo.nodes || []);
      setTopoEdges(topo.edges || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load service data');
    } finally {
      setLoading(false);
    }
  }, [serviceName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTopoRefresh = useCallback(async () => {
    if (!serviceName) return;
    setTopoLoading(true);
    try {
      const topo = await api.getApmTopology({ service: serviceName });
      setTopoNodes(topo.nodes || []);
      setTopoEdges(topo.edges || []);
    } catch { /* ignore */ }
    finally { setTopoLoading(false); }
  }, [serviceName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <WarningOutlined className="text-red-400 text-2xl" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-800 mb-1">Failed to load service</h3>
        <p className="text-sm text-zinc-500 mb-4">{error}</p>
        <Link to="/apm" className="text-purple-600 hover:underline text-sm">&larr; Back to APM</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/apm" className="text-zinc-400 hover:text-zinc-600 transition-colors">
          <ArrowLeftOutlined />
        </Link>
        <span className="text-zinc-300 text-sm">/</span>
        <span className="text-xs text-zinc-500">Services</span>
        <span className="text-zinc-300 text-sm">/</span>
        <h2 className="text-sm font-bold text-zinc-900 font-mono">{serviceName}</h2>
        <div className="flex-1" />
        <Tooltip title="Refresh">
          <button onClick={fetchData} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <ReloadOutlined />
          </button>
        </Tooltip>
      </div>

      {/* KPI row */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Requests', value: fmtN(overview.total_requests), sub: null, alert: false },
            { label: 'Avg Latency', value: fmtLatency(overview.avg_latency_ms), sub: `P95 ${fmtLatency(overview.p95_ms)}`, alert: false },
            { label: 'P99 Latency', value: fmtLatency(overview.p99_ms), sub: null, alert: num(overview.p99_ms) > 1000 },
            { label: 'Error Rate', value: `${num(overview.error_rate_pct).toFixed(2)}%`, sub: `${overview.error_count || 0} errors`, alert: num(overview.error_rate_pct) > 5 },
            { label: 'P95 Latency', value: fmtLatency(overview.p95_ms), sub: null, alert: false },
          ].map((kpi, i) => (
            <div key={i} className="bg-white border border-zinc-200 rounded-lg px-4 py-3">
              <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-0.5">{kpi.label}</p>
              <p className={`text-xl font-bold tracking-tight ${kpi.alert ? 'text-red-500' : 'text-zinc-900'}`} style={{ fontFamily: "'Geist Mono', monospace" }}>
                {kpi.value}
              </p>
              {kpi.sub && <p className="text-[10px] text-zinc-400 mt-0.5">{kpi.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Request Rate</h4>
          <TimeseriesChart data={rate} height={160} series={[{ name: 'req/min', key: 'cnt', color: '#632CA6' }]} areaStyle yFormatter={fmtN} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Latency</h4>
          <TimeseriesChart data={rate} height={160} series={[{ name: 'latency', key: 'avg_latency_ms', color: '#E2903C' }]} areaStyle yFormatter={(v) => fmtLatency(v)} />
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Errors</h4>
          <TimeseriesChart data={rate} height={160} series={[{ name: 'errors', key: 'error_cnt', color: '#E65C5C' }]} areaStyle yFormatter={fmtN} />
        </div>
      </div>

      {/* Operations table */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Top Operations</h4>
        </div>
        {operations.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-400">No operations found</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 text-left">Operation</th>
                <th className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 text-right">Requests</th>
                <th className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 text-right">Avg Latency</th>
                <th className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 text-right">P95</th>
                <th className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-4 py-3 text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op, i) => (
                <tr key={op.operation_name || i} className="border-b border-zinc-50 hover:bg-purple-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-zinc-700">{op.operation_name}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-zinc-600">{fmtN(op.cnt)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-zinc-600">{fmtLatency(op.avg_latency_ms)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-zinc-500">{fmtLatency(op.p95_ms)}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono">
                    {num(op.error_count) > 0 ? (
                      <span className="text-red-500 font-medium">{op.error_count}</span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Upstream (callers) */}
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Upstream (Callers)
            </h4>
          </div>
          {depsUp.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">No upstream callers found</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {depsUp.map((d, i) => (
                <Link
                  key={i}
                  to={`/apm/services/${encodeURIComponent(d.upstream_service || '')}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-purple-50/30 transition-colors block"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-sm font-medium text-purple-700 hover:underline">{d.upstream_service}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                    <span>{fmtN(d.call_count)} calls</span>
                    <span>{fmtLatency(d.avg_latency_ms)}</span>
                    {num(d.error_count) > 0 && <span className="text-red-500">{d.error_count} err</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Downstream (dependencies) */}
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Downstream (Dependencies)
            </h4>
          </div>
          {depsDown.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">No downstream dependencies found</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {depsDown.map((d, i) => (
                <Link
                  key={i}
                  to={`/apm/services/${encodeURIComponent(d.downstream_service || '')}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-purple-50/30 transition-colors block"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                    <span className="text-sm font-medium text-purple-700 hover:underline">{d.downstream_service}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                    <span>{fmtN(d.call_count)} calls</span>
                    <span>{fmtLatency(d.avg_latency_ms)}</span>
                    {num(d.error_count) > 0 && <span className="text-red-500">{d.error_count} err</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Service topology map */}
      <div className="mb-6">
        <TopologyMap
          nodes={topoNodes}
          edges={topoEdges}
          loading={topoLoading}
          onServiceClick={(svc) => { /* handled by refresh - could also navigate */ }}
          onRefresh={handleTopoRefresh}
        />
      </div>

      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-6 pb-8">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" /> Data from ClickHouse via zerotrace-server
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeseries mini chart
// ---------------------------------------------------------------------------

function TimeseriesChart({ data, series, height, yFormatter, areaStyle }: {
  data: TsRow[];
  series: { name: string; key: string; color?: string }[];
  height?: number;
  yFormatter?: (v: number) => string;
  areaStyle?: boolean;
}) {
  const h = height || 200;
  if (!data.length) return <div className="flex items-center justify-center text-xs text-zinc-400" style={{ height: h }}>No data yet</div>;
  const ts = data.map(d => (d.ts || '').slice(11, 16));
  const option = {
    ...chartTheme,
    tooltip: { trigger: 'axis' as const, valueFormatter: yFormatter ? (v: any) => yFormatter(v) : undefined },
    xAxis: { ...chartTheme.xAxis, data: ts, axisLabel: { interval: Math.max(Math.floor(ts.length / 8), 0) } },
    yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: yFormatter } },
    series: series.map(s => ({
      name: s.name, type: 'line', data: data.map(d => num((d as any)[s.key])),
      smooth: true, symbol: 'none', lineStyle: { width: 2, color: s.color },
      areaStyle: areaStyle ? {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: (s.color || '#632CA6') + '20' },
          { offset: 1, color: (s.color || '#632CA6') + '02' },
        ])
      } : undefined,
    })),
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: h }} notMerge lazyUpdate />;
}
