import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Input } from 'antd';
import { SearchOutlined, CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import type { FlameNode, FlameSpan, FlameGraphProps, LayoutRect } from './types';
import {
  buildTree, wrapRoots, fmtDur, computeLayout, visibleRowCount,
  drawRoundedRect, hexToRgba, lighten, fitText,
} from './utils';

// ── Constants ───────────────────────────────────────────

const ROW = 25;
const PAD_X = 10;
const PAD_TOP = 8;
const MIN_W = 3;
const RADIUS = 3;

// ── Row helper ──────────────────────────────────────────

function TooltipRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-1 pr-4 text-fg-tertiary whitespace-nowrap align-top">{label}</td>
      <td className={`py-1 text-right text-fg-inverse ${mono ? 'font-mono' : ''}`}>{value}</td>
    </tr>
  );
}

// ── Component ───────────────────────────────────────────

export default function FlameGraph({ spans, height = 480, onSpanSelect, selectedSpanId }: FlameGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rectsRef = useRef<LayoutRect[]>([]);

  const [zoomStack, setZoomStack] = useState<FlameNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [cw, setCw] = useState(900);

  const roots = useMemo(() => buildTree(spans), [spans]);
  const fullTree = useMemo(() => wrapRoots(roots), [roots]);
  const currentRoot = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : fullTree;

  // Search match set
  const matchIds = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    const ids = new Set<string>();
    for (const s of spans) {
      if (s.service_name?.toLowerCase().includes(q) ||
          s.operation_name?.toLowerCase().includes(q) ||
          s.span_id.includes(q)) ids.add(s.span_id);
    }
    return ids;
  }, [spans, search]);

  const visRows = useMemo(() => visibleRowCount(currentRoot), [currentRoot]);
  const canvasH = Math.max(visRows * ROW + PAD_TOP * 2, height);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setCw(Math.max(entries[0]?.contentRect.width ?? 900, 400));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Canvas render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(cw, 400);
    const h = canvasH;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8f9fb';
    ctx.fillRect(0, 0, w, h);

    if (!currentRoot) return;

    try {
      // Depth grid lines
      for (let i = 0; i < visRows; i++) {
        const y = i * ROW + PAD_TOP + ROW;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD_X, y);
        ctx.lineTo(w - PAD_X, y);
        ctx.stroke();
      }

      const rects = computeLayout(currentRoot, w);
      rectsRef.current = rects;

      if (rects.length === 0) {
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '13px "Geist Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No spans to display — try zooming out', w / 2, h / 2);
        ctx.textAlign = 'left';
        return;
      }

      // Draw bars
      for (const r of rects) {
        const isHovered = r.spanId === hoveredId;
        const isSelected = r.spanId === selectedSpanId;
        const isMatch = matchIds.has(r.spanId);
        const isMuted = !!(search && !isMatch);
        const alpha = isMuted ? 0.15 : isHovered ? 1 : 0.88;

        const rw = Math.max(r.w, MIN_W);
        const gap = 1;
        const gx = r.x + gap, gy = r.y, gw = rw - gap, gh = r.h;

        if (gw < MIN_W) {
          ctx.fillStyle = isMuted ? 'rgba(212,212,216,0.2)' : hexToRgba(r.color, alpha);
          drawRoundedRect(ctx, gx, gy, Math.max(gw, 1), gh, 1);
          ctx.fill();
        } else {
          const grad = ctx.createLinearGradient(gx, gy, gx, gy + gh);
          if (isMuted) {
            grad.addColorStop(0, 'rgba(212,212,216,0.25)');
            grad.addColorStop(1, 'rgba(212,212,216,0.15)');
          } else {
            grad.addColorStop(0, hexToRgba(lighten(r.color, 30), alpha));
            grad.addColorStop(1, hexToRgba(r.color, alpha));
          }
          ctx.fillStyle = grad;
          drawRoundedRect(ctx, gx, gy, gw, gh, RADIUS);
          ctx.fill();
        }

        // Hover/selected outline
        if (isHovered || isSelected) {
          ctx.strokeStyle = isSelected ? '#632CA6' : 'rgba(255,255,255,0.9)';
          ctx.lineWidth = isSelected ? 2 : 1.5;
          drawRoundedRect(ctx, gx, gy, gw, gh, RADIUS);
          ctx.stroke();
        }

        // Search highlight
        if (isMatch && search) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 2]);
          drawRoundedRect(ctx, gx - 0.5, gy - 0.5, gw + 1, gh + 1, RADIUS + 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Error badge
        if (r.isError) {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.moveTo(gx + gw - 7, gy);
          ctx.lineTo(gx + gw, gy);
          ctx.lineTo(gx + gw, gy + 7);
          ctx.closePath();
          ctx.fill();
        }

        // Labels
        const txtY = gy + gh / 2 + 1;
        const innerW = Math.max(gw - PAD_X * 2, 0);
        if (!isMuted && gw > 30) {
          const showSvc = r.depth <= 1 || gw > 140;
          if (showSvc && innerW > 10) {
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font = '600 10.5px "Geist Sans", system-ui, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(fitText(ctx, r.serviceName || '?', innerW), gx + PAD_X, txtY);
          }
          if (gw > 160 && r.operationName && innerW > 60) {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '9.5px "Geist Mono", monospace';
            ctx.textBaseline = 'middle';
            const opMaxW = innerW * 0.45;
            if (opMaxW > 20) {
              ctx.fillText(fitText(ctx, r.operationName, opMaxW), gx + innerW * 0.52, txtY);
            }
          }
        }

        // Duration label
        if (gw > 60 && innerW > 30) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.font = '9px "Geist Mono", monospace';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'right';
          ctx.fillText(fmtDur(r.durationUs), gx + gw - PAD_X, txtY);
          ctx.textAlign = 'left';
        }
      }

      // Row depth markers
      ctx.fillStyle = '#d4d4d8';
      ctx.font = '8px "Geist Mono", monospace';
      ctx.textBaseline = 'top';
      for (let i = 1; i < visRows; i++) {
        ctx.fillText('' + i, 3, i * ROW + PAD_TOP + 2);
      }

    } catch (err) {
      ctx.fillStyle = '#EF4444';
      ctx.font = '13px "Geist Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Render error — check console', w / 2, h / 2);
      ctx.textAlign = 'left';
    }
  }, [currentRoot, cw, canvasH, hoveredId, selectedSpanId, matchIds, search, visRows]);

  // ── Mouse handlers ──
  const hitTest = useCallback((mx: number, my: number): LayoutRect | null => {
    for (let i = rectsRef.current.length - 1; i >= 0; i--) {
      const r = rectsRef.current[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return r;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    setHoveredId(hit?.spanId ?? null);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }, [hitTest]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;

    const findNode = (n: FlameNode): FlameNode | null => {
      if (n.span.span_id === hit.spanId) return n;
      for (const c of n.children) { const f = findNode(c); if (f) return f; }
      return null;
    };
    const node = findNode(currentRoot);
    if (node && node.children.length > 0) setZoomStack(prev => [...prev, node]);
    onSpanSelect?.(hit.spanId);
  }, [hitTest, currentRoot, onSpanSelect]);

  // Keyboard: Esc to reset zoom
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && zoomStack.length > 0) setZoomStack([]); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [zoomStack.length]);

  // Hovered span data for tooltip
  const hoveredSpan = useMemo(() => hoveredId ? spans.find(s => s.span_id === hoveredId) ?? null : null, [hoveredId, spans]);
  const hoveredRect = useMemo(() => hoveredId ? rectsRef.current.find(r => r.spanId === hoveredId) ?? null : null, [hoveredId]);

  // Empty state
  if (roots.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-fg-tertiary bg-bg-elevated border border-border rounded-lg">
        No span data available for flame graph
      </div>
    );
  }

  return (
    <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-bg-elevated">
        <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-x-auto">
          <button onClick={() => setZoomStack([])}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              zoomStack.length === 0 ? 'bg-accent-primary/10 text-accent-primary' : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'}`}>
            All spans
          </button>
          {zoomStack.map((node, i) => (
            <span key={node.span.span_id} className="flex items-center gap-1 shrink-0">
              <span className="text-fg-disabled select-none">/</span>
              <button onClick={() => setZoomStack(prev => prev.slice(0, i + 1))}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors truncate max-w-[180px] ${
                  i === zoomStack.length - 1 ? 'bg-accent-primary/10 text-accent-primary' : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'}`}
                title={`${node.span.service_name || '?'}: ${node.span.operation_name?.slice(0, 30) || ''}`}>
                {node.span.service_name || '?'}{node.span.operation_name ? `: ${node.span.operation_name.slice(0, 30)}` : ''}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Input size="small" prefix={<SearchOutlined className="text-fg-tertiary" />}
            placeholder="Search spans…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-40" allowClear />
          {zoomStack.length > 0 && (<>
            <button onClick={() => setZoomStack(prev => prev.slice(0, -1))}
              className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary bg-bg-muted hover:bg-bg-muted rounded-md px-2.5 py-1 font-medium transition-colors">
              <CompressOutlined /> Out
            </button>
            <button onClick={() => setZoomStack([])}
              className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary bg-bg-muted hover:bg-bg-muted rounded-md px-2.5 py-1 font-medium transition-colors">
              <ExpandOutlined /> Reset
            </button>
          </>)}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative" style={{ width: '100%', height: canvasH }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: canvasH, cursor: 'pointer' }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredId(null)} onClick={handleClick} />

        {/* Tooltip */}
        {hoveredSpan && hoveredRect && (
          <div className="fixed z-50 pointer-events-none"
            style={{ left: Math.min(hoverPos.x + 16, window.innerWidth - 300), top: hoverPos.y - 10 }}>
            <div className="bg-bg-elevated/95 backdrop-blur-sm text-fg-inverse rounded-xl shadow-2xl border border-border px-4 py-3 text-xs min-w-[240px]">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hoveredRect.color }} />
                <span className="font-semibold text-fg-inverse">{hoveredSpan.service_name || 'unknown'}</span>
                {hoveredSpan.span_status === 'error' && (
                  <span className="text-[10px] bg-accent-danger/25 text-accent-danger px-1.5 py-0.5 rounded-full ml-auto font-medium">error</span>
                )}
              </div>
              <table className="w-full text-[11px] border-collapse"><tbody>
                <TooltipRow label="Operation" value={hoveredSpan.operation_name || '—'} mono />
                <TooltipRow label="Duration" value={fmtDur(hoveredSpan.duration_us)} mono />
                {hoveredSpan.status_code != null && hoveredSpan.status_code !== '' && (
                  <TooltipRow label="Status code" value={String(hoveredSpan.status_code)} mono />
                )}
              </tbody></table>
              {hoveredSpan.error_message && (
                <div className="mt-2.5 pt-2 border-t border-white/10">
                  <p className="text-accent-danger font-mono text-[10px] leading-relaxed break-all line-clamp-3">{hoveredSpan.error_message}</p>
                </div>
              )}
              <div className="mt-2.5 pt-2 border-t border-white/10 text-[10px] text-fg-tertiary flex items-center justify-between">
                <span>Click to zoom in</span>
                <code className="text-fg-tertiary">{hoveredSpan.span_id.slice(0, 16)}…</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border-subtle bg-bg-subtle/50 px-4 py-1.5 flex items-center justify-between text-[10px] text-fg-tertiary">
        <span>{spans.length} spans · depth {visRows} · click a bar to zoom</span>
        {zoomStack.length > 0 && (
          <span className="text-fg-secondary font-medium">Zoomed {zoomStack.length} level{zoomStack.length > 1 ? 's' : ''} · Esc to reset</span>
        )}
      </div>
    </div>
  );
}

export type { FlameSpan, FlameNode, LayoutRect, FlameGraphProps } from './types';
