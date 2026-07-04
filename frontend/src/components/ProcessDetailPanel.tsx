import { useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseOutlined } from '@ant-design/icons';

const C = { purple: '#632CA6', green: '#2DB88D', orange: '#E2903C', red: '#E65C5C', blue: '#4799EB', gray: '#6C757D', muted: '#ADB5BD', border: '#DEE2E6', bg: '#F8F9FA', text: '#212529' };

// ════════════════════════ CONTEXT MENU ════════════════════════
function ContextMenu({ x, y, onViewTraces, onClose }: {
  x: number; y: number; onViewTraces: () => void; onClose: () => void;
}) {
  // Close on any click outside
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div ref={ref} className="fixed z-[70] bg-bg-elevated border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
        style={{ left: x, top: y }}>
        <button onClick={onViewTraces} className="w-full text-left px-4 py-2 text-[13px] hover:bg-purple-50 flex items-center gap-2.5 transition-colors text-fg-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          View Traces
        </button>
        <button onClick={() => window.open('/apm?view=traces', '_self')}
          className="w-full text-left px-4 py-2 text-[13px] hover:bg-purple-50 flex items-center gap-2.5 transition-colors text-fg-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.purple} strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          View All Traces
        </button>
      </div>
    </>
  );
}

// ════════════════════════ SYNCED SPARKLINE ════════════════════════
function ChartCard({ title, data, color, unit, height = 100, hoverIdx, crosshairX, onHover, onContextMenu }: {
  title: string; data: { ts: string; val: number }[];
  color: string; unit: string; height?: number;
  hoverIdx: number | null; crosshairX: number | null;
  onHover: (idx: number | null, x: number | null) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const SVG_W = 430;

  const max = Math.max(...data.map(d => d.val), 1);
  const range = max || 1;

  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * SVG_W,
    y: height - 4 - ((d.val) / range) * (height - 10),
    val: d.val, ts: d.ts, i,
  }));

  const linePath = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `0,${height} ${linePath} ${SVG_W},${height}`;
  const gradientId = `g-${title.replace(/\s/g, '')}`;

  const handleMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round((x / w) * (points.length - 1))));
    onHover(idx, (x / w) * SVG_W); // normalize to SVG coordinate space
  }, [points.length, onHover]);

  const hoverPt = hoverIdx != null && hoverIdx < points.length ? points[hoverIdx] : null;
  const lineX = crosshairX; // already in SVG coords

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-3.5"
      onMouseLeave={() => onHover(null, null)}
      onContextMenu={onContextMenu}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">{title}</span>
        {hoverPt && (
          <span className="text-[11px] font-mono font-semibold tabular-nums" style={{ color }}>
            {hoverPt.val >= 1000 ? (hoverPt.val / 1000).toFixed(1) + 'K' : hoverPt.val.toFixed(1)}
            <span className="ml-0.5 font-normal text-fg-disabled">{unit}</span>
            <span className="ml-2 text-[10px] text-fg-disabled">{hoverPt.ts?.slice(11, 19)}</span>
          </span>
        )}
      </div>
      <svg ref={svgRef} width="100%" height={height} viewBox={`0 0 ${SVG_W} ${height}`}
        preserveAspectRatio="none" className="block" onMouseMove={handleMove}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPath} fill={`url(#${gradientId})`} />
        <polyline points={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {lineX != null && (
          <line x1={lineX} y1="0" x2={lineX} y2={height}
            stroke="#212529" strokeWidth="1.5" opacity="0.4" />
        )}
        {hoverPt && (
          <circle cx={hoverPt.x} cy={hoverPt.y} r="4" fill={color} stroke="white" strokeWidth="2" />
        )}
      </svg>
    </div>
  );
}

// ════════════════════════ MAIN ════════════════════════
export default function ProcessDetailPanel({ process, open, onClose, tsData }: {
  process: { process_name: string; host_id: number; request_count: string | number; avg_latency_ms: string | number; error_count: string | number } | null;
  open: boolean; onClose: () => void;
  tsData?: { ts: string; process_name: string; request_count: string; avg_latency_ms: string; error_count: string }[];
}) {
  const navigate = useNavigate();

  // All hooks must be called before any early return (React rules of hooks)
  const name = process?.process_name || '';
  const requests = parseInt(String(process?.request_count)) || 0;
  const latency = parseFloat(String(process?.avg_latency_ms)) || 0;
  const errors = parseInt(String(process?.error_count)) || 0;
  const errRate = requests > 0 ? (errors / requests * 100).toFixed(2) : '0.00';

  const tsPoints = useMemo(() => {
    if (!tsData || !name) return [];
    return tsData.filter(p => p.process_name === name)
      .map(p => ({ ts: p.ts, requests: parseFloat(p.request_count) || 0, latency: parseFloat(p.avg_latency_ms) || 0, errors: parseFloat(p.error_count) || 0 }))
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [tsData, name]);

  const reqData = tsPoints.map(d => ({ ts: d.ts, val: d.requests }));
  const latData = tsPoints.map(d => ({ ts: d.ts, val: d.latency }));
  const errData = tsPoints.map(d => ({ ts: d.ts, val: d.errors }));

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [crosshairX, setCrosshairX] = useState<number | null>(null);
  const handleHover = useCallback((idx: number | null, x: number | null) => { setHoverIdx(idx); setCrosshairX(x); }, []);

  const [menuPos, setMenuPos] = useState<{ x: number; y: number; source: string } | null>(null);
  const buildCtxHandler = useCallback((source: string) => (e: React.MouseEvent) => {
    e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY, source });
  }, []);

  const handleViewTraces = useCallback(() => {
    if (!menuPos) return;
    setMenuPos(null);
    const params = new URLSearchParams();
    params.set('view', 'traces');
    // Use `query` for free-text search — process_kname is in the ClickHouse row
    // but not the same as traces' SERVICE column (which uses request_domain/app_service).
    params.set('query', name);
    if (menuPos.source === 'Errors') params.set('f_status', 'error');
    navigate(`/apm?${params.toString()}`);
  }, [menuPos, name, navigate]);

  if (!open || !process) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/15 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen bg-bg-elevated border-l border-border shadow-2xl z-50 flex flex-col animate-slide-left" style={{ width: 500 }}>
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{
                  backgroundColor: parseFloat(errRate) > 5 ? C.red : parseFloat(errRate) > 1 ? C.orange : C.green
                }} />
                <h3 className="text-[15px] font-bold font-mono truncate text-fg-primary">{name}</h3>
              </div>
              <p className="text-[12px] mt-0.5 text-fg-disabled">Host ID: {process.host_id} · {reqData.length} points · Right-click chart → View Traces</p>
            </div>
            <button onClick={onClose} className="text-fg-disabled hover:text-fg-secondary p-1 rounded shrink-0">
              <CloseOutlined style={{ fontSize: 14 }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            parseFloat(errRate) > 5 ? 'bg-accent-danger-bg text-accent-danger border-red-100' :
            parseFloat(errRate) > 1 ? 'bg-orange-50 text-orange-700 border-orange-100' :
            'bg-accent-success-bg text-accent-success border-emerald-100'
          }`}>
            {parseFloat(errRate) > 5 ? '⚠ Unhealthy' : parseFloat(errRate) > 1 ? '● Degraded' : '✓ Healthy'}
            <span className="opacity-60">({errRate}% error rate)</span>
          </span>

          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Requests', v: fmtN(requests), c: C.purple },
              { l: 'Avg Latency', v: `${latency.toFixed(1)}ms`, c: latency > 100 ? C.red : C.green },
              { l: 'Errors', v: String(errors), c: errors > 0 ? C.red : C.green },
            ].map(m => (
              <div key={m.l} className="bg-bg-elevated border border-border rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-disabled">{m.l}</p>
                <p className="text-[16px] font-bold font-mono mt-0.5" style={{ color: m.c }}>{m.v}</p>
              </div>
            ))}
          </div>

          {reqData.length >= 2 ? (
            <div className="space-y-2">
              <ChartCard title="Request Rate" data={reqData} color={C.purple} unit="/min" height={100}
                hoverIdx={hoverIdx} crosshairX={crosshairX} onHover={handleHover} onContextMenu={buildCtxHandler('Request Rate')} />
              <ChartCard title="Avg Latency" data={latData} color={C.orange} unit="ms" height={100}
                hoverIdx={hoverIdx} crosshairX={crosshairX} onHover={handleHover} onContextMenu={buildCtxHandler('Avg Latency')} />
              <ChartCard title="Errors" data={errData} color={C.red} unit="" height={100}
                hoverIdx={hoverIdx} crosshairX={crosshairX} onHover={handleHover} onContextMenu={buildCtxHandler('Errors')} />
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-[12px] text-fg-disabled">No time-series data yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right-click context menu */}
      {menuPos && (
        <ContextMenu x={menuPos.x} y={menuPos.y}
          onViewTraces={handleViewTraces}
          onClose={() => setMenuPos(null)} />
      )}
    </>
  );
}

function fmtN(n?: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
}
