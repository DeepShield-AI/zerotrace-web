import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Button, Tooltip, Select, Spin, Segmented } from 'antd';
import { ReloadOutlined, AimOutlined, NodeIndexOutlined } from '@ant-design/icons';
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// ---------------------------------------------------------------------------
// Register ECharts modules
// ---------------------------------------------------------------------------

let registered = false;
function ensureRegistered() {
  if (registered) return;
  echarts.use([GraphChart, TooltipComponent, LegendComponent, CanvasRenderer]);
  registered = true;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopologyNode {
  service_name: string;
  request_count: number | string;
  avg_latency_ms: number | string;
  p95_latency_ms: number | string;
  p99_latency_ms: number | string;
  error_count: number | string;
  error_rate_pct: number | string;
}

export interface TopologyEdge {
  source: string;
  target: string;
  call_count: number | string;
  avg_latency_ms: number | string;
  p95_latency_ms: number | string;
  error_count: number | string;
}

interface TopologyMapProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  loading?: boolean;
  onServiceClick?: (serviceName: string) => void;
  onRefresh?: () => void;
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

// Color scale helpers
const NODE_COLORS = [
  '#632CA6', '#4799EB', '#DB3888', '#E2903C', '#2DB88D',
  '#8B5CF6', '#06B6D4', '#F472B6', '#F59E0B', '#10B981',
  '#6366F1', '#0EA5E9', '#EC4899', '#F97316', '#22C55E',
];

function nodeColor(name: string, idx: number): string {
  return NODE_COLORS[idx % NODE_COLORS.length];
}

function edgeColor(avgLatMs: number, errorCount: number): string {
  if (errorCount > 0) return '#EF4444';
  if (avgLatMs > 500) return '#F59E0B';
  if (avgLatMs > 100) return '#E2903C';
  return '#94A3B8';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TopologyMap({ nodes, edges, loading, onServiceClick, onRefresh }: TopologyMapProps) {
  ensureRegistered();

  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const [layout, setLayout] = useState<'force' | 'circular'>('force');
  const [sizing, setSizing] = useState<'requests' | 'latency' | 'errors'>('requests');
  const [collapsed, setCollapsed] = useState(false);

  // Compute sizing metric for node symbol sizes
  const sizingValues = useMemo(() => {
    if (!nodes.length) return new Map<string, number>();
    const map = new Map<string, number>();
    let values: number[] = [];

    for (const n of nodes) {
      let val: number;
      switch (sizing) {
        case 'requests': val = num(n.request_count); break;
        case 'latency': val = num(n.p95_latency_ms); break;
        case 'errors': val = num(n.error_count); break;
        default: val = num(n.request_count);
      }
      if (sizing === 'errors') val = Math.max(val, 0.5); // ensure visible
      map.set(n.service_name, val);
      values.push(val);
    }

    return map;
  }, [nodes, sizing]);

  const minSizeVal = useMemo(() => {
    const vals = Array.from(sizingValues.values()).filter(v => v > 0);
    return vals.length > 0 ? Math.min(...vals) : 1;
  }, [sizingValues]);

  const maxSizeVal = useMemo(() => {
    const vals = Array.from(sizingValues.values());
    return vals.length > 0 ? Math.max(...vals) : 100;
  }, [sizingValues]);

  function nodeSymbolSize(name: string): number {
    const val = sizingValues.get(name) ?? minSizeVal;
    if (maxSizeVal === minSizeVal) return 24;
    // Map to 18–64 range
    const ratio = (val - minSizeVal) / (maxSizeVal - minSizeVal);
    return 18 + ratio * 46;
  }

  // Build ECharts option
  const option = useMemo(() => {
    if (!nodes.length) return null;

    const maxCallCount = Math.max(...edges.map(e => num(e.call_count)), 1);
    const maxLatency = Math.max(...edges.map(e => num(e.avg_latency_ms)), 1);

    // ECharts graph categories by service
    const categories = nodes.map((n, i) => ({
      name: n.service_name,
      itemStyle: {
        color: nodeColor(n.service_name, i),
        borderColor: '#fff',
        borderWidth: 2,
        shadowBlur: 6,
        shadowColor: 'rgba(0,0,0,0.1)',
      },
      label: {
        show: true,
        position: 'right' as const,
        fontSize: 12,
        fontWeight: 500,
        color: '#3f3f46',
        fontFamily: 'Geist Sans, system-ui, sans-serif',
      },
    }));

    const graphNodes = nodes.map((n, i) => {
      const symbolSize = nodeSymbolSize(n.service_name);
      const errorRate = num(n.error_rate_pct);
      return {
        name: n.service_name,
        category: i,
        symbolSize,
        // Store extra data for tooltip
        request_count: n.request_count,
        avg_latency_ms: n.avg_latency_ms,
        p95_latency_ms: n.p95_latency_ms,
        p99_latency_ms: n.p99_latency_ms,
        error_count: n.error_count,
        error_rate_pct: n.error_rate_pct,
        itemStyle: {
          borderColor: errorRate > 5 ? '#EF4444' : errorRate > 1 ? '#F59E0B' : '#fff',
          borderWidth: errorRate > 1 ? 3 : 2,
          shadowBlur: errorRate > 5 ? 12 : 6,
          shadowColor: errorRate > 5 ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.1)',
        },
        label: {
          formatter: (p: any) => {
            const reqCount = fmtN(n.request_count);
            return `{name|${p.name}}\n{stat|${reqCount} req}`;
          },
          rich: {
            name: {
              fontSize: 12,
              fontWeight: 600,
              color: '#3f3f46',
              fontFamily: 'Geist Sans, system-ui, sans-serif',
              lineHeight: 18,
            },
            stat: {
              fontSize: 10,
              color: '#a1a1aa',
              fontFamily: 'Geist Mono, monospace',
              lineHeight: 14,
            },
          },
        },
      };
    });

    const graphLinks = edges.map(e => {
      const callCount = num(e.call_count);
      const avgLatM = num(e.avg_latency_ms);
      const errCount = num(e.error_count);
      const edgeW = 0.5 + (callCount / Math.max(maxCallCount, 1)) * 5;

      return {
        source: e.source,
        target: e.target,
        value: callCount,
        lineStyle: {
          width: edgeW,
          color: edgeColor(avgLatM, errCount),
          opacity: 0.6,
          curveness: 0.2,
        },
        label: {
          show: callCount > maxCallCount * 0.1,
          formatter: fmtN(callCount),
          fontSize: 9,
          color: '#a1a1aa',
          fontFamily: 'Geist Mono, monospace',
        },
        // Extra data
        call_count: callCount,
        avg_latency_ms: avgLatM,
        error_count: errCount,
      };
    });

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(24,24,27,0.95)',
        borderColor: '#3f3f46',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Geist Sans, system-ui, sans-serif' },
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            const d = params.data;
            return `
              <div style="font-weight:600;margin-bottom:4px">${params.data.source} → ${params.data.target}</div>
              <div style="font-size:11px;color:#a1a1aa;line-height:1.6">
                Calls: <b style="color:#fff">${fmtN(d.call_count || d.value)}</b><br/>
                Avg latency: <b style="color:#fff">${fmtLatency(d.avg_latency_ms)}</b><br/>
                Errors: <b style="color:#fff">${d.error_count || 0}</b>
              </div>
            `;
          }
          const d = params.data;
          return `
            <div style="font-weight:600;margin-bottom:4px">${params.name}</div>
            <div style="font-size:11px;color:#a1a1aa;line-height:1.6">
              Requests: <b style="color:#fff">${fmtN(d.request_count)}</b><br/>
              Avg latency: <b style="color:#fff">${fmtLatency(d.avg_latency_ms)}</b><br/>
              P95: <b style="color:#fff">${fmtLatency(d.p95_latency_ms)}</b><br/>
              Error rate: <b style="color:${num(d.error_rate_pct) > 5 ? '#EF4444' : '#fff'}">${num(d.error_rate_pct).toFixed(1)}%</b>
            </div>
          `;
        },
      },
      legend: {
        show: nodes.length <= 12,
        bottom: 0,
        textStyle: { fontSize: 11, color: '#71717a' },
        data: categories.map(c => c.name),
      },
      series: [{
        type: 'graph',
        layout: layout,
        data: graphNodes,
        links: graphLinks,
        categories,
        roam: true,
        draggable: true,
        force: {
          repulsion: 500,
          gravity: 0.08,
          edgeLength: [120, 300],
          layoutAnimation: true,
          friction: 0.6,
        },
        circular: {
          rotateLabel: true,
        },
        zoom: 0.8,
        center: ['50%', '48%'],
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 3 },
          itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.2)' },
        },
        scaleLimit: { min: 0.3, max: 4 },
        lineStyle: {
          color: 'source',
          curveness: 0.2,
          opacity: 0.5,
        },
        label: {
          show: !collapsed,
          position: 'right',
          fontSize: 11,
          color: '#52525b',
          fontFamily: 'Geist Sans, system-ui, sans-serif',
        },
      }],
    };
  }, [nodes, edges, layout, sizing, collapsed, minSizeVal, maxSizeVal]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;
    const instance = echarts.init(chartRef.current, undefined, {
      renderer: 'canvas',
      devicePixelRatio: window.devicePixelRatio || 1,
    });
    instanceRef.current = instance;

    const handleResize = () => instance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      instance.dispose();
    };
  }, []);

  // Update option
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.setOption(option, true);
  }, [option]);

  // Handle click
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !onServiceClick) return;

    const handler = (params: any) => {
      if (params.dataType === 'node') {
        onServiceClick(params.name);
      }
    };
    instance.on('click', handler);
    return () => { instance.off('click', handler); };
  }, [onServiceClick]);

  const handleResetView = useCallback(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.dispatchAction({ type: 'restore' });
  }, []);

  if (!nodes.length && !loading) {
    return null;
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <NodeIndexOutlined className="text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Service Map</span>
        </div>
        <div className="flex-1" />

        {/* Sizing selector */}
        <Select
          value={sizing}
          onChange={(v) => setSizing(v)}
          size="small"
          className="w-28"
          options={[
            { value: 'requests', label: 'By requests' },
            { value: 'latency', label: 'By latency' },
            { value: 'errors', label: 'By errors' },
          ]}
        />

        {/* Layout selector */}
        <Segmented
          value={layout}
          onChange={(v) => setLayout(v as 'force' | 'circular')}
          size="small"
          options={[
            { label: 'Force', value: 'force' },
            { label: 'Circle', value: 'circular' },
          ]}
        />

        <Tooltip title="Reset view">
          <Button size="small" type="text" icon={<AimOutlined />} onClick={handleResetView} />
        </Tooltip>

        {onRefresh && (
          <Tooltip title="Refresh">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={onRefresh} />
          </Tooltip>
        )}
      </div>

      {/* Graph area */}
      <div style={{ position: 'relative', height: 520 }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Spin size="large" />
          </div>
        ) : (
          <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
        )}

        {/* Legend footer */}
        <div className="absolute bottom-3 left-3 flex items-center gap-4 text-[10px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: '#94A3B8' }} /> Low latency
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} /> High latency
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: '#EF4444' }} /> Errors
          </span>
          <span>&middot;</span>
          <span>{nodes.length} services &middot; {edges.length} edges</span>
          <span>&middot;</span>
          <span className="text-zinc-300">Drag to pan &middot; Scroll to zoom &middot; Click node for details</span>
        </div>
      </div>
    </div>
  );
}
