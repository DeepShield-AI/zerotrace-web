import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spin, Segmented } from 'antd';
import {
  ArrowLeftOutlined, WarningOutlined, FireOutlined,
  ColumnWidthOutlined, OrderedListOutlined, CloseOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';
import FlameGraph from '../components/FlameGraph';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpanData {
  trace_id: string; span_id: string; parent_span_id: string;
  span_kind?: string; service_name: string; app_service_name?: string;
  operation_name: string; request_type: string; duration_us: number | string;
  status_code: number | string; response_status?: number | string;
  start_time: string; start_time_us?: string; end_time_us?: string;
  span_status: string; flow_id: string; request_domain?: string;
  endpoint?: string; app_instance?: string; error_message?: string;
  x_request_id_0?: string; x_request_id_1?: string;
  attribute_names?: string[]; attribute_values?: string[];
  l7_protocol?: string; biz_protocol?: string;
  syscall_trace_id_request?: number; syscall_trace_id_response?: number;
}

interface SpanNode extends SpanData {
  children: SpanNode[]; depth: number;
}

interface TraceData {
  trace_id: string; start_time: string | null; end_time: string | null;
  duration_us: number; root_service: string | null;
  span_count: number; error_count: number; status: string;
  services?: string[]; tag_keys?: string[]; spans: SpanData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const num = (v: number | string | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
function fmtDuration(us?: number | string): string {
  const v = num(us) / 1000;
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return v.toFixed(1) + 'ms';
  return '<1ms';
}
function fmtDurationExact(us?: number | string): string {
  const v = num(us) / 1000;
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) {
    if (v < 10) return v.toFixed(2) + 'ms';
    return v.toFixed(1) + 'ms';
  }
  return num(us).toFixed(0) + 'μs';
}

const DD_COLORS = [
  '#632CA6', '#4799EB', '#DB3888', '#E2903C', '#2DB88D',
  '#8B5CF6', '#06B6D4', '#F472B6', '#F59E0B', '#10B981',
  '#6366F1', '#0EA5E9', '#EC4899', '#F97316', '#22C55E',
];
const colorForService = (() => {
  const map = new Map<string, string>();
  let idx = 0;
  return (name: string): string => {
    if (!name) return '#a1a1aa';
    if (map.has(name)) return map.get(name)!;
    const c = DD_COLORS[idx % DD_COLORS.length];
    map.set(name, c); idx++;
    return c;
  };
})();

// ---------------------------------------------------------------------------
// Build span tree — depth-based, no pixel layout
// ---------------------------------------------------------------------------

function buildTree(spans: SpanData[]): { flat: SpanNode[] } {
  const map = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const s of spans) {
    map.set(s.span_id, { ...s, children: [], depth: 0 });
  }

  for (const s of spans) {
    const node = map.get(s.span_id)!;
    const pid = s.parent_span_id;
    if (pid && pid !== '0' && map.has(pid)) {
      map.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by duration desc
  const sortFn = (n: SpanNode) => {
    n.children.sort((a, b) => num(b.duration_us) - num(a.duration_us));
    n.children.forEach(sortFn);
  };
  roots.forEach(sortFn);

  function assignDepth(ns: SpanNode[], d: number) {
    for (const n of ns) { n.depth = d; assignDepth(n.children, d + 1); }
  }
  assignDepth(roots, 0);

  const flat: SpanNode[] = [];
  function walk(ns: SpanNode[]) { for (const n of ns) { flat.push(n); n.children.length > 0 && walk(n.children); } }
  walk(roots);

  return { flat };
}

// ---------------------------------------------------------------------------
// Trace Header
// ---------------------------------------------------------------------------

function TraceHeader({ trace, services }: { trace: TraceData; services: string[] }) {
  return (
    <div className="mb-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={() => window.history.back()} className="text-zinc-400 hover:text-zinc-500"><ArrowLeftOutlined className="text-xs" /></button>
        <span className="text-zinc-300 text-xs">/</span>
        <Link to="/apm?view=traces" className="text-xs text-zinc-500 hover:text-zinc-700">Traces</Link>
        <span className="text-zinc-300 text-xs">/</span>
        <span className="text-xs font-mono font-semibold text-zinc-800 truncate max-w-[280px]">
          {trace.trace_id.length > 28 ? trace.trace_id.slice(0, 28) + '…' : trace.trace_id}
        </span>
        <button
          onClick={() => { navigator.clipboard.writeText(trace.trace_id); }}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded border border-zinc-200 transition-colors"
          title="Copy trace ID"
        >
          Copy ID
        </button>
      </div>

      {/* Status + Metadata row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status badge */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
          trace.status === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${trace.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {trace.status === 'ok' ? 'OK' : `${trace.error_count} error${trace.error_count !== 1 ? 's' : ''}`}
        </span>

        {/* Duration */}
        <span className="text-xs text-zinc-600 font-mono bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full">
          {fmtDurationExact(trace.duration_us)}
        </span>

        {/* Spans */}
        <span className="text-xs text-zinc-500">
          <strong className="text-zinc-700">{trace.span_count}</strong> spans
          {services.length > 0 && <> across <strong className="text-zinc-700">{services.length}</strong> service{services.length !== 1 ? 's' : ''}</>}
        </span>

        {/* Root service */}
        {trace.root_service && (
          <span className="text-xs text-zinc-500">
            Root: <span className="font-medium text-zinc-700">{trace.root_service}</span>
          </span>
        )}

        {/* Timestamp */}
        <span className="text-[11px] text-zinc-400 font-mono ml-auto">{trace.start_time}</span>
      </div>

      {/* Service legend */}
      {services.filter(Boolean).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-100">
          {services.filter(Boolean).map(svc => (
            <span key={svc} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 bg-white border border-zinc-200 rounded-full px-2.5 py-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorForService(svc) }} />
              {svc}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waterfall span view
// ---------------------------------------------------------------------------

const ROW_H = 36;
const INDENT_W = 14;
const DEPTH_LINE_W = 1;

function parseTimeUs(ts?: string): number {
  if (!ts) return 0;
  try {
    if (ts.includes('.')) {
      const [sec, frac] = ts.split('.');
      const dt = new Date(sec.replace(' ', 'T') + '+08:00').getTime();
      return dt * 1000 + parseInt((frac || '0').padEnd(6, '0').slice(0, 6));
    }
    return new Date(ts.replace(' ', 'T') + '+08:00').getTime() * 1000;
  } catch { return 0; }
}

function WaterfallView({ spanNodes, selectedId, onSelect }: {
  spanNodes: SpanNode[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  // Build timeline: compute each span's offset (relative to earliest) and width on a unified scale
  const timeline = useMemo(() => {
    if (!spanNodes.length) return { totalUs: 0, spans: [] as { node: SpanNode; offsetUs: number; widthUs: number }[] };

    let earliestUs = Number.MAX_SAFE_INTEGER;
    for (const s of spanNodes) {
      const t = parseTimeUs(s.start_time_us || s.start_time);
      if (t > 0 && t < earliestUs) earliestUs = t;
    }
    if (earliestUs === Number.MAX_SAFE_INTEGER) earliestUs = 0;

    const items = spanNodes.map(node => {
      const t = parseTimeUs(node.start_time_us || node.start_time);
      const offsetUs = Math.max(0, t - earliestUs);
      // Minimum 1ms display width for visibility
      return { node, offsetUs, widthUs: Math.max(num(node.duration_us), 1000) };
    });

    const maxEndUs = Math.max(...items.map(i => i.offsetUs + i.widthUs), 1);
    return { totalUs: maxEndUs, spans: items };
  }, [spanNodes]);

  const maxDepth = useMemo(() => Math.max(...spanNodes.map(s => s.depth), 0), [spanNodes]);

  // Timeline ruler markers
  const markers = useMemo(() => {
    if (timeline.totalUs <= 0) return [];
    const step = timeline.totalUs > 500_000 ? 100_000 : timeline.totalUs > 100_000 ? 20_000 : timeline.totalUs > 10_000 ? 5_000 : 1000;
    const result: { label: string; pct: number }[] = [];
    for (let us = 0; us <= timeline.totalUs; us += step) {
      result.push({ label: fmtDurationExact(us), pct: (us / timeline.totalUs) * 100 });
    }
    return result;
  }, [timeline.totalUs]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Header with timeline ruler */}
      <div className="flex items-center h-9 border-b border-zinc-200 bg-zinc-50 text-[10.5px] font-semibold text-zinc-500 uppercase tracking-wider">
        <div className="shrink-0 px-4 w-[400px]">Service &amp; Operation</div>
        <div className="flex-1 px-4 relative h-full flex items-center">
          Duration
          {markers.map((m, i) => (
            <span
              key={i}
              className="absolute top-6 text-[9px] text-zinc-400 font-mono leading-none"
              style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Span rows */}
      <div>
        {spanNodes.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-400">No spans found</div>
        ) : (
          timeline.spans.map(({ node, offsetUs, widthUs }, idx) => {
            const isSelected = selectedId === node.span_id;
            const color = colorForService(node.service_name);
            const offsetPct = timeline.totalUs > 0 ? (offsetUs / timeline.totalUs) * 100 : 0;
            const widthPct = timeline.totalUs > 0 ? Math.max((widthUs / timeline.totalUs) * 100, 0.5) : 0;
            const isError = node.span_status === 'error';
            const hasChildren = node.children.length > 0;

            return (
              <div
                key={`${node.span_id}-${idx}`}
                className={`flex items-center cursor-pointer transition-colors group border-b border-zinc-100 last:border-b-0 ${
                  isSelected ? 'bg-purple-50/70' : isError ? 'bg-red-50/30 hover:bg-red-50/50' : idx % 2 === 0 ? 'bg-white hover:bg-zinc-50' : 'bg-zinc-50/50 hover:bg-zinc-50'
                }`}
                style={{ height: ROW_H, minHeight: ROW_H }}
                onClick={() => onSelect(isSelected ? null : node.span_id)}
              >
                {/* Label column */}
                <div className="shrink-0 px-4 flex items-center gap-2 overflow-hidden" style={{ width: 400 }}>
                  {Array.from({ length: node.depth }).map((_, i) => (
                    <span key={i} className="shrink-0 flex items-center justify-center" style={{ width: INDENT_W }}>
                      <span className="block" style={{ width: DEPTH_LINE_W, height: ROW_H, background: i === node.depth - 1 ? '#d4d4d8' : 'transparent' }} />
                    </span>
                  ))}
                  {hasChildren ? <span className="shrink-0 text-zinc-400" style={{ fontSize: 8 }}>▼</span> : <span className="shrink-0" style={{ width: 8 }} />}
                  <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, backgroundColor: color, opacity: isSelected ? 1 : 0.85 }} />
                  <span className="text-xs font-semibold text-zinc-800 truncate max-w-[130px]">
                    {node.service_name || <span className="text-zinc-400 italic">unknown</span>}
                  </span>
                  <span className="text-zinc-300 text-xs shrink-0">·</span>
                  <span className="text-xs text-zinc-500 font-mono truncate flex-1 min-w-0">
                    {node.operation_name || <span className="text-zinc-400 italic">—</span>}
                  </span>
                  {isError && <span className="shrink-0 text-red-500" title={node.error_message || 'Error'}><WarningOutlined className="text-[11px]" /></span>}
                  {node.status_code != null && node.status_code !== '' && node.status_code !== 0 && (
                    <span className={`shrink-0 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                      num(node.status_code) >= 500 ? 'bg-red-100 text-red-600' :
                      num(node.status_code) >= 400 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>{node.status_code}</span>
                  )}
                </div>

                {/* Timeline bar column */}
                <div className="flex-1 flex items-center gap-2 px-4 relative">
                  {/* Gridlines from markers */}
                  {markers.map((m, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-100" style={{ left: `${m.pct}%` }} />
                  ))}
                  {/* Bar — positioned by offsetPct, sized by widthPct */}
                  <div className="flex-1 h-4 relative">
                    <div
                      className="absolute h-full rounded-full transition-all duration-150"
                      style={{
                        left: `${offsetPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: isSelected ? color : `${color}DD`,
                        minWidth: 4,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] font-mono text-zinc-500 w-14 text-right">
                    {fmtDuration(node.duration_us)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 flex items-center gap-4 text-[10px] text-zinc-400">
        <span>{spanNodes.length} spans</span>
        <span>&middot;</span>
        <span>Max depth: {maxDepth}</span>
        <span>&middot;</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Error</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> OK</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Span list view
// ---------------------------------------------------------------------------

function SpanListView({ spanNodes, selectedId, onSelect }: {
  spanNodes: SpanNode[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="divide-y divide-zinc-50">
        {spanNodes.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-400">No spans found</div>
        ) : (
          spanNodes.map((node) => {
            const isSelected = selectedId === node.span_id;
            const color = colorForService(node.service_name);
            const isError = node.span_status === 'error';

            return (
              <button
                key={node.span_id}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  isSelected ? 'bg-purple-50/80' : isError ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-zinc-50'
                }`}
                onClick={() => onSelect(isSelected ? null : node.span_id)}
              >
                {/* Indent */}
                <span style={{ width: node.depth * INDENT_W }} className="shrink-0" />

                {/* Service dot */}
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />

                {/* Info */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-700">{node.service_name || 'unknown'}</span>
                  <span className="text-zinc-400 text-xs">·</span>
                  <span className="text-xs text-zinc-500 font-mono truncate">{node.operation_name || '—'}</span>
                  {isError && <span className="shrink-0 text-red-500"><WarningOutlined className="text-[11px]" /></span>}
                </div>

                {/* Duration bar + time — DD style */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((num(node.duration_us) / Math.max(...spanNodes.map(s => num(s.duration_us)), 1)) * 100, 100)}%`, backgroundColor: color }} />
                  </div>
                  <div className="text-right w-20">
                    <p className="text-xs font-mono text-zinc-800 font-semibold">{fmtDurationExact(node.duration_us)}</p>
                    <p className="text-[10px] text-zinc-400">{(node.start_time || '').slice(11, 19) || '—'}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Span detail side panel
// ---------------------------------------------------------------------------

function SpanDetailSidebar({ span, onClose }: { span: SpanNode; onClose: () => void }) {
  const color = colorForService(span.service_name);

  // Collect span attributes
  const attrs: [string, string][] = [];
  if (span.attribute_names && span.attribute_values) {
    for (let i = 0; i < Math.min(span.attribute_names.length, span.attribute_values.length); i++) {
      attrs.push([span.attribute_names[i], span.attribute_values[i]]);
    }
  }

  const infoGroups = [
    {
      label: 'Span Info',
      items: [
        ['Service', span.app_service_name || span.service_name],
        ['Operation', span.operation_name],
        ['Duration', fmtDurationExact(span.duration_us)],
        ['Start Time', span.start_time],
        ['Span Kind', span.span_kind || '—'],
        ['Request Type', span.request_type || '—'],
        ['Status', span.span_status],
        ['Status Code', span.status_code != null ? String(span.status_code) : null],
      ],
    },
    {
      label: 'IDs',
      items: [
        ['Span ID', span.span_id],
        ['Parent Span ID', span.parent_span_id || '—'],
        ['Trace ID', span.trace_id],
      ],
    },
  ];

  return (
    <div className="bg-white border-l border-zinc-200 w-[340px] shrink-0 overflow-y-auto max-h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-zinc-100 px-5 py-3.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1" style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}22` }} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-800 truncate">{span.service_name || 'Unknown Service'}</h3>
            <p className="text-[11px] text-zinc-400 font-mono truncate">{span.operation_name || '—'}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded hover:bg-zinc-100">
          <CloseOutlined className="text-xs" />
        </button>
      </div>

      {/* Error banner */}
      {span.span_status === 'error' && span.error_message && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1.5">
            <WarningOutlined /> Error
          </p>
          <p className="text-[11px] text-red-600 font-mono break-all leading-relaxed">{span.error_message}</p>
        </div>
      )}

      {/* Info groups */}
      <div className="p-4 space-y-5">
        {infoGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">{group.label}</p>
            <div className="space-y-2">
              {group.items.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-[11px] text-zinc-500 shrink-0">{label}</span>
                  {label === 'Status' ? (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      span.span_status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>{value}</span>
                  ) : (
                    <span className="text-[11px] text-zinc-700 font-mono text-right break-all">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Attributes / Tags */}
        {attrs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2.5">
              Attributes ({attrs.length})
            </p>
            <div className="space-y-1.5">
              {attrs.map(([k, v]) => (
                <div key={k} className="bg-zinc-50 rounded-lg px-3 py-2 flex items-start gap-2">
                  <span className="text-[11px] text-zinc-500 font-mono shrink-0">{k}</span>
                  <span className="text-[11px] text-zinc-300">=</span>
                  <span className="text-[11px] text-zinc-800 font-mono break-all">{v || '(empty)'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Trace Detail Page
// ---------------------------------------------------------------------------

export default function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'waterfall' | 'list' | 'flamegraph'>('waterfall');

  const fetchTrace = useCallback(async () => {
    if (!traceId) return;
    setLoading(true); setError(null);
    try { setTrace(await api.getApmTraceDetail(traceId)); } catch (err: any) { setError(err.message || 'Failed to load trace'); }
    finally { setLoading(false); }
  }, [traceId]);

  useEffect(() => { fetchTrace(); }, [fetchTrace]);

  const flatSpans = useMemo(() => {
    if (!trace || !trace.spans?.length) return [] as SpanNode[];
    return buildTree(trace.spans).flat;
  }, [trace]);

  const services = useMemo(() => {
    const set = new Set<string>();
    trace?.spans?.forEach((s) => { if (s.service_name) set.add(s.service_name); });
    return [...set].sort();
  }, [trace]);

  const selectedSpan = useMemo(
    () => flatSpans.find((s) => s.span_id === selectedSpanId) || null,
    [flatSpans, selectedSpanId]
  );

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spin size="large" />
      </div>
    );
  }

  // ---- Error state ----
  if (error || !trace) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <WarningOutlined className="text-red-400 text-2xl" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-800 mb-1">Failed to load trace</h3>
        <p className="text-sm text-zinc-500 mb-4">{error || 'Trace not found'}</p>
        <Link to="/apm" className="text-purple-600 hover:underline text-sm">&larr; Back to APM</Link>
      </div>
    );
  }

  const mainContent = viewMode === 'waterfall' ? (
    <WaterfallView spanNodes={flatSpans} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />
  ) : viewMode === 'flamegraph' ? (
    <FlameGraph spans={trace.spans as any} height={520} onSpanSelect={setSelectedSpanId} selectedSpanId={selectedSpanId} />
  ) : (
    <SpanListView spanNodes={flatSpans} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />
  );

  return (
    <div className="animate-fade-in max-w-[1480px]">
      <TraceHeader trace={trace} services={services} />

      {/* View switch */}
      <div className="flex items-center justify-between mb-4">
        <Segmented
          options={[
            { label: <span className="flex items-center gap-1.5"><ColumnWidthOutlined /> Waterfall</span>, value: 'waterfall' },
            { label: <span className="flex items-center gap-1.5"><FireOutlined /> Flame Graph</span>, value: 'flamegraph' },
            { label: <span className="flex items-center gap-1.5"><OrderedListOutlined /> List</span>, value: 'list' },
          ]}
          value={viewMode}
          onChange={(v) => setViewMode(v as typeof viewMode)}
        />
      </div>

      {/* Content + optional sidebar */}
      <div className="flex gap-0">
        <div className="flex-1 min-w-0">{mainContent}</div>
        {selectedSpan && <SpanDetailSidebar span={selectedSpan} onClose={() => setSelectedSpanId(null)} />}
      </div>
    </div>
  );
}
