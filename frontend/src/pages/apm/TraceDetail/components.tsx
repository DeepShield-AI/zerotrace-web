import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftOutlined, WarningOutlined, CloseOutlined } from '@ant-design/icons';
import type { TraceData, SpanNode } from './types';
import { num, fmtDuration, fmtDurationExact, colorForService, parseTimeUs } from './utils';

// ── Constants ────────────────────────────────────────────

const ROW_H = 36;
const INDENT_W = 14;
const DEPTH_LINE_W = 1;

// ── TraceHeader ──────────────────────────────────────────

export function TraceHeader({ trace, services }: { trace: TraceData; services: string[] }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={() => window.history.back()} className="text-fg-tertiary hover:text-fg-secondary"><ArrowLeftOutlined className="text-xs" /></button>
        <span className="text-fg-disabled text-xs">/</span>
        <Link to="/apm?view=traces" className="text-xs text-fg-secondary hover:text-fg-secondary">Traces</Link>
        <span className="text-fg-disabled text-xs">/</span>
        <span className="text-xs font-mono font-semibold text-fg-primary truncate max-w-[280px]">
          {trace.trace_id.length > 28 ? trace.trace_id.slice(0, 28) + '…' : trace.trace_id}
        </span>
        <button onClick={() => { navigator.clipboard.writeText(trace.trace_id); }}
          className="text-[10px] text-fg-tertiary hover:text-fg-secondary bg-bg-muted hover:bg-bg-muted px-2 py-0.5 rounded border border-border transition-colors"
          title="Copy trace ID">Copy ID</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
          trace.status === 'ok' ? 'bg-accent-success-bg text-accent-success border border-emerald-200' : 'bg-accent-danger-bg text-accent-danger border border-red-200'
        }`}>
          <span className={`w-2 h-2 rounded-full ${trace.status === 'ok' ? 'bg-severity-ok' : 'bg-severity-alert'}`} />
          {trace.status === 'ok' ? 'OK' : `${trace.error_count} error${trace.error_count !== 1 ? 's' : ''}`}
        </span>
        <span className="text-xs text-fg-secondary font-mono bg-bg-muted border border-border px-2.5 py-1 rounded-full">{fmtDurationExact(trace.duration_us)}</span>
        <span className="text-xs text-fg-secondary">
          <strong className="text-fg-secondary">{trace.span_count}</strong> spans
          {services.length > 0 && <> across <strong className="text-fg-secondary">{services.length}</strong> service{services.length !== 1 ? 's' : ''}</>}
        </span>
        {trace.root_service && <span className="text-xs text-fg-secondary">Root: <span className="font-medium text-fg-secondary">{trace.root_service}</span></span>}
        <span className="text-[11px] text-fg-tertiary font-mono ml-auto">{trace.start_time}</span>
      </div>

      {services.filter(Boolean).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border-subtle">
          {services.filter(Boolean).map(svc => (
            <span key={svc} className="inline-flex items-center gap-1.5 text-[11px] text-fg-secondary bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorForService(svc) }} />{svc}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── WaterfallView ────────────────────────────────────────

export function WaterfallView({ spanNodes, selectedId, onSelect }: {
  spanNodes: SpanNode[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
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
      return { node, offsetUs: Math.max(0, t - earliestUs), widthUs: Math.max(num(node.duration_us), 1000) };
    });
    const maxEndUs = Math.max(...items.map(i => i.offsetUs + i.widthUs), 1);
    return { totalUs: maxEndUs, spans: items };
  }, [spanNodes]);

  const maxDepth = useMemo(() => Math.max(...spanNodes.map(s => s.depth), 0), [spanNodes]);

  const markers = useMemo(() => {
    if (timeline.totalUs <= 0) return [];
    const step = timeline.totalUs > 500_000 ? 100_000 : timeline.totalUs > 100_000 ? 20_000 : timeline.totalUs > 10_000 ? 5_000 : 1000;
    return Array.from({ length: Math.floor(timeline.totalUs / step) + 1 }, (_, i) => ({
      label: fmtDurationExact(i * step), pct: ((i * step) / timeline.totalUs) * 100,
    }));
  }, [timeline.totalUs]);

  return (
    <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
      <div className="flex items-center h-9 border-b border-border bg-bg-subtle text-[10.5px] font-semibold text-fg-secondary uppercase tracking-wider">
        <div className="shrink-0 px-4 w-[400px]">Service &amp; Operation</div>
        <div className="flex-1 px-4 relative h-full flex items-center">
          Duration
          {markers.map((m, i) => (
            <span key={i} className="absolute top-6 text-[9px] text-fg-tertiary font-mono leading-none" style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}>{m.label}</span>
          ))}
        </div>
      </div>
      <div>
        {spanNodes.length === 0 ? (
          <div className="py-20 text-center text-sm text-fg-tertiary">No spans found</div>
        ) : (
          timeline.spans.map(({ node, offsetUs, widthUs }, idx) => {
            const isSelected = selectedId === node.span_id;
            const color = colorForService(node.service_name);
            const offsetPct = timeline.totalUs > 0 ? (offsetUs / timeline.totalUs) * 100 : 0;
            const widthPct = timeline.totalUs > 0 ? Math.max((widthUs / timeline.totalUs) * 100, 0.5) : 0;
            const isError = node.span_status === 'error';
            const hasChildren = node.children.length > 0;

            return (
              <div key={`${node.span_id}-${idx}`}
                className={`flex items-center cursor-pointer transition-colors group border-b border-border-subtle last:border-b-0 ${
                  isSelected ? 'bg-purple-50/70' : isError ? 'bg-accent-danger-bg/30 hover:bg-accent-danger-bg/50' : idx % 2 === 0 ? 'bg-bg-elevated hover:bg-bg-subtle' : 'bg-bg-subtle/50 hover:bg-bg-subtle'
                }`}
                style={{ height: ROW_H, minHeight: ROW_H }}
                onClick={() => onSelect(isSelected ? null : node.span_id)}>
                <div className="shrink-0 px-4 flex items-center gap-2 overflow-hidden" style={{ width: 400 }}>
                  {Array.from({ length: node.depth }).map((_, i) => (
                    <span key={i} className="shrink-0 flex items-center justify-center" style={{ width: INDENT_W }}>
                      <span className="block" style={{ width: DEPTH_LINE_W, height: ROW_H, background: i === node.depth - 1 ? '#d4d4d8' : 'transparent' }} />
                    </span>
                  ))}
                  {hasChildren ? <span className="shrink-0 text-fg-tertiary" style={{ fontSize: 8 }}>▼</span> : <span className="shrink-0" style={{ width: 8 }} />}
                  <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, backgroundColor: color }} />
                  <span className="text-xs font-semibold text-fg-primary truncate max-w-[130px]">{node.service_name || <span className="text-fg-tertiary italic">unknown</span>}</span>
                  <span className="text-fg-disabled text-xs shrink-0">·</span>
                  <span className="text-xs text-fg-secondary font-mono truncate flex-1 min-w-0">{node.operation_name || <span className="text-fg-tertiary italic">—</span>}</span>
                  {isError && <span className="shrink-0 text-accent-danger" title={node.error_message || 'Error'}><WarningOutlined className="text-[11px]" /></span>}
                  {node.status_code != null && node.status_code !== '' && node.status_code !== 0 && (
                    <span className={`shrink-0 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                      num(node.status_code) >= 500 ? 'bg-accent-danger-bg text-accent-danger' : num(node.status_code) >= 400 ? 'bg-accent-warning-bg text-accent-warning' : 'bg-accent-success-bg text-accent-success'
                    }`}>{node.status_code}</span>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-2 px-4 relative">
                  {markers.map((m, i) => <div key={i} className="absolute top-0 bottom-0 border-l border-border-subtle" style={{ left: `${m.pct}%` }} />)}
                  <div className="flex-1 h-4 relative">
                    <div className="absolute h-full rounded-full transition-all duration-150"
                      style={{ left: `${offsetPct}%`, width: `${widthPct}%`, backgroundColor: isSelected ? color : `${color}DD`, minWidth: 4 }} />
                  </div>
                  <span className="shrink-0 text-[11px] font-mono text-fg-secondary w-14 text-right">{fmtDuration(node.duration_us)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border bg-bg-subtle px-4 py-2 flex items-center gap-4 text-[10px] text-fg-tertiary">
        <span>{spanNodes.length} spans</span><span>&middot;</span><span>Max depth: {maxDepth}</span><span>&middot;</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-severity-alert" /> Error</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-severity-ok" /> OK</span>
      </div>
    </div>
  );
}

// ── SpanListView ─────────────────────────────────────────

export function SpanListView({ spanNodes, selectedId, onSelect }: {
  spanNodes: SpanNode[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
      <div className="divide-y divide-zinc-50">
        {spanNodes.length === 0 ? (
          <div className="py-20 text-center text-sm text-fg-tertiary">No spans found</div>
        ) : (
          spanNodes.map((node) => {
            const isSelected = selectedId === node.span_id;
            const color = colorForService(node.service_name);
            const isError = node.span_status === 'error';
            return (
              <button key={node.span_id}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  isSelected ? 'bg-purple-50/80' : isError ? 'bg-accent-danger-bg/30 hover:bg-accent-danger-bg/60' : 'hover:bg-bg-subtle'
                }`}
                onClick={() => onSelect(isSelected ? null : node.span_id)}>
                <span style={{ width: node.depth * INDENT_W }} className="shrink-0" />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm font-semibold text-fg-secondary">{node.service_name || 'unknown'}</span>
                  <span className="text-fg-tertiary text-xs">·</span>
                  <span className="text-xs text-fg-secondary font-mono truncate">{node.operation_name || '—'}</span>
                  {isError && <span className="shrink-0 text-accent-danger"><WarningOutlined className="text-[11px]" /></span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 h-1.5 bg-bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((num(node.duration_us) / Math.max(...spanNodes.map(s => num(s.duration_us)), 1)) * 100, 100)}%`, backgroundColor: color }} />
                  </div>
                  <div className="text-right w-20">
                    <p className="text-xs font-mono text-fg-primary font-semibold">{fmtDurationExact(node.duration_us)}</p>
                    <p className="text-[10px] text-fg-tertiary">{(node.start_time || '').slice(11, 19) || '—'}</p>
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

// ── SpanDetailSidebar ────────────────────────────────────

export function SpanDetailSidebar({ span, onClose }: { span: SpanNode; onClose: () => void }) {
  const color = colorForService(span.service_name);
  const attrs: [string, string][] = [];
  if (span.attribute_names && span.attribute_values) {
    for (let i = 0; i < Math.min(span.attribute_names.length, span.attribute_values.length); i++) {
      attrs.push([span.attribute_names[i], span.attribute_values[i]]);
    }
  }
  const infoGroups = [
    { label: 'Span Info', items: [['Service', span.app_service_name || span.service_name], ['Operation', span.operation_name], ['Duration', fmtDurationExact(span.duration_us)], ['Start Time', span.start_time], ['Span Kind', span.span_kind || '—'], ['Request Type', span.request_type || '—'], ['Status', span.span_status], ['Status Code', span.status_code != null ? String(span.status_code) : null]] },
    { label: 'IDs', items: [['Span ID', span.span_id], ['Parent Span ID', span.parent_span_id || '—'], ['Trace ID', span.trace_id]] },
  ];

  return (
    <div className="bg-bg-elevated border-l border-border w-[340px] shrink-0 overflow-y-auto max-h-[calc(100vh-180px)]">
      <div className="sticky top-0 bg-bg-elevated border-b border-border-subtle px-5 py-3.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1" style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}22` }} />
          <div className="min-w-0"><h3 className="text-sm font-semibold text-fg-primary truncate">{span.service_name || 'Unknown Service'}</h3><p className="text-[11px] text-fg-tertiary font-mono truncate">{span.operation_name || '—'}</p></div>
        </div>
        <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary transition-colors p-1 rounded hover:bg-bg-muted"><CloseOutlined className="text-xs" /></button>
      </div>
      {span.span_status === 'error' && span.error_message && (
        <div className="mx-4 mt-4 bg-accent-danger-bg border border-red-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-accent-danger mb-1 flex items-center gap-1.5"><WarningOutlined /> Error</p>
          <p className="text-[11px] text-accent-danger font-mono break-all leading-relaxed">{span.error_message}</p>
        </div>
      )}
      <div className="p-4 space-y-5">
        {infoGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-2.5">{group.label}</p>
            <div className="space-y-2">
              {group.items.filter(([, v]) => v != null && v !== '').map(([label, value]) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-[11px] text-fg-secondary shrink-0">{label}</span>
                  {label === 'Status' ? (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${span.span_status === 'ok' ? 'bg-accent-success-bg text-accent-success' : 'bg-accent-danger-bg text-accent-danger'}`}>{value}</span>
                  ) : (
                    <span className="text-[11px] text-fg-secondary font-mono text-right break-all">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {attrs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-2.5">Attributes ({attrs.length})</p>
            <div className="space-y-1.5">
              {attrs.map(([k, v]) => (
                <div key={k} className="bg-bg-subtle rounded-lg px-3 py-2 flex items-start gap-2">
                  <span className="text-[11px] text-fg-secondary font-mono shrink-0">{k}</span>
                  <span className="text-[11px] text-fg-disabled">=</span>
                  <span className="text-[11px] text-fg-primary font-mono break-all">{v || '(empty)'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
