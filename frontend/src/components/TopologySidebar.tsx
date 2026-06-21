import { useState, useMemo } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { Radio } from 'antd';
import type { TopologyNode, TopologyEdge } from './TopologyMap';

function num(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}
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

// ---------------------------------------------------------------------------
// TopologySidebar
// ---------------------------------------------------------------------------

export default function TopologySidebar({
  nodes,
  edges,
  activeSizing,
  onSizingChange,
  activeLayout,
  onLayoutChange,
  searchQuery,
  onSearchChange,
  highlightedNode,
  onNodeHighlight,
}: {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  activeSizing: 'requests' | 'latency' | 'errors';
  onSizingChange: (s: 'requests' | 'latency' | 'errors') => void;
  activeLayout: 'force' | 'circular';
  onLayoutChange: (l: 'force' | 'circular') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  highlightedNode?: string;
  onNodeHighlight: (node?: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => n.service_name.toLowerCase().includes(q));
  }, [nodes, searchQuery]);

  // Sort nodes by the active sizing metric
  const sortedNodes = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      switch (activeSizing) {
        case 'latency':
          return num(b.avg_latency_ms) - num(a.avg_latency_ms);
        case 'errors':
          return num(b.error_rate_pct) - num(a.error_rate_pct);
        default:
          return num(b.request_count) - num(a.request_count);
      }
    });
  }, [filteredNodes, activeSizing]);

  return (
    <div className="w-60 shrink-0 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-zinc-800 tracking-tight">Topology Controls</h3>
        <span className="text-[11px] font-mono text-zinc-400">{nodes.length} nodes</span>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-300 text-xs" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes…"
          className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-md bg-white placeholder:text-zinc-300 focus:outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-200 transition-all"
        />
      </div>

      {/* Layout controls */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">Layout</h4>
        <Radio.Group
          value={activeLayout}
          onChange={(e) => onLayoutChange(e.target.value)}
          size="small"
          className="w-full px-1"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="force" className="w-1/2 text-center text-xs">Force</Radio.Button>
          <Radio.Button value="circular" className="w-1/2 text-center text-xs">Circular</Radio.Button>
        </Radio.Group>
      </div>

      {/* Sizing controls */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">Node size by</h4>
        <Radio.Group
          value={activeSizing}
          onChange={(e) => onSizingChange(e.target.value)}
          size="small"
          className="w-full px-1"
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="requests" className="w-1/3 text-center text-xs">Reqs</Radio.Button>
          <Radio.Button value="latency" className="w-1/3 text-center text-xs">Lat</Radio.Button>
          <Radio.Button value="errors" className="w-1/3 text-center text-xs">Errs</Radio.Button>
        </Radio.Group>
      </div>

      {/* Color legend */}
      <div>
        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">Edge Colors</h4>
        <div className="space-y-1 px-1">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#2DB88D' }} />
            Low latency
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#E2903C' }} />
            Medium latency
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: '#E65C5C' }} />
            High latency / Errors
          </div>
        </div>
      </div>

      {/* Node list */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-700 transition-colors"
        >
          Node Legend
          <span className="text-zinc-400 font-mono text-[11px]">{sortedNodes.length}</span>
        </button>
        {expanded && (
          <div className="max-h-[300px] overflow-y-auto overscroll-contain space-y-px mt-1">
            {sortedNodes.length === 0 ? (
              <p className="text-[11px] text-zinc-400 px-2.5 py-2 italic">No nodes match search</p>
            ) : (
              sortedNodes.map((node) => {
                const errPct = num(node.error_rate_pct);
                const metricValue =
                  activeSizing === 'latency'
                    ? fmtLatency(node.avg_latency_ms)
                    : activeSizing === 'errors'
                    ? `${errPct.toFixed(1)}%`
                    : fmtN(node.request_count);
                return (
                  <button
                    key={node.service_name}
                    onClick={() => onNodeHighlight(highlightedNode === node.service_name ? undefined : node.service_name)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 border ${
                      highlightedNode === node.service_name
                        ? 'bg-purple-50 text-purple-700 font-medium border-purple-100'
                        : 'text-zinc-600 hover:bg-zinc-50 border-transparent'
                    }`}
                  >
                    {/* Health dot */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: errPct > 5 ? '#E65C5C' : errPct > 1 ? '#E2903C' : '#2DB88D' }}
                    />
                    {/* Name */}
                    <span className="flex-1 truncate">{node.service_name}</span>
                    {/* Metric value */}
                    <span className="font-mono text-[10px] text-zinc-400 shrink-0">{metricValue}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
