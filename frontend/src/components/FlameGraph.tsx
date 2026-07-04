import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Input } from 'antd';
import { SearchOutlined, CompressOutlined, ExpandOutlined } from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlameSpan {
  span_id: string;
  parent_span_id: string;
  service_name: string;
  operation_name: string;
  duration_us: number | string;
  span_status: string;
  status_code?: number | string;
  error_message?: string;
  [key: string]: any;
}

interface FlameNode {
  span: FlameSpan;
  children: FlameNode[];
  depth: number;
}

interface LayoutRect {
  x: number; y: number; w: number; h: number;
  spanId: string;
  serviceName: string;
  operationName: string;
  durationUs: number;
  isError: boolean;
  hasChildren: boolean;
  depth: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const DD_COLORS = [
  '#6C3AB8', '#3B8EEA', '#D9347A', '#E07B2C', '#1EA87A',
  '#7C3AED', '#0891B2', '#E84D9B', '#F08C00', '#0D9488',
  '#5B5FC7', '#0099CC', '#D42C6B', '#F26B10', '#12A17D',
  '#6D28D9', '#0E7490', '#BE123C', '#D97706', '#047857',
];

function svcColor(name: string, map: Map<string, string>): string {
  if (!name) return '#9ca3af';
  if (map.has(name)) return map.get(name)!;
  const c = DD_COLORS[map.size % DD_COLORS.length];
  map.set(name, c);
  return c;
}

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

function buildTree(spans: FlameSpan[]): FlameNode[] {
  const nodeMap = new Map<string, FlameNode>();
  const roots: FlameNode[] = [];

  for (const s of spans) {
    nodeMap.set(s.span_id, {
      span: { ...s, duration_us: typeof s.duration_us === 'string' ? parseFloat(s.duration_us) : (s.duration_us || 0) },
      children: [],
      depth: 0,
    });
  }

  for (const s of spans) {
    const node = nodeMap.get(s.span_id)!;
    const pid = s.parent_span_id;
    if (pid && pid !== '0' && nodeMap.has(pid)) {
      nodeMap.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort: longest first
  const sort = (n: FlameNode) => {
    n.children.sort((a, b) => (b.span.duration_us as number) - (a.span.duration_us as number));
    n.children.forEach(sort);
  };
  roots.forEach(sort);

  // Assign depths
  const walk = (ns: FlameNode[], d: number) => { for (const n of ns) { n.depth = d; walk(n.children, d + 1); } };
  walk(roots, 0);

  return roots;
}

// Wrap multiple roots into a synthetic root so the flame graph has a single entry point
function wrapRoots(roots: FlameNode[]): FlameNode {
  if (roots.length === 0) {
    return { span: { span_id: '__root__', parent_span_id: '', service_name: '', operation_name: '', duration_us: 1, span_status: 'ok' }, children: [], depth: 0 };
  }
  if (roots.length === 1) return roots[0];
  const total = roots.reduce((s, r) => s + (r.span.duration_us as number), 0);
  return {
    span: { span_id: '__root__', parent_span_id: '', service_name: '', operation_name: '', duration_us: total || 1, span_status: 'ok' },
    children: roots,
    depth: -1,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_H = 22;
const GAP = 3;
const ROW = BAR_H + GAP;
const PAD_X = 10;
const PAD_TOP = 8;
const MIN_W = 3;
const RADIUS = 3;

// ---------------------------------------------------------------------------
// Duration formatter
// ---------------------------------------------------------------------------

function fmtDur(us: number | string): string {
  const v = (typeof us === 'string' ? parseFloat(us) : us) / 1000;
  if (isNaN(v)) return '—';
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 100) return Math.round(v) + 'ms';
  if (v >= 1) return v.toFixed(1) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

// ---------------------------------------------------------------------------
// Layout engine — computes x/y/w for every bar under a given root
// ---------------------------------------------------------------------------

function computeLayout(root: FlameNode, canvasW: number): LayoutRect[] {
  const rects: LayoutRect[] = [];
  const baseDepth = root.depth;
  const availW = canvasW - PAD_X * 2;
  const x0 = PAD_X;
  const colorMap = new Map<string, string>();

  function layout(node: FlameNode, x: number, w: number) {
    const dur = node.span.duration_us as number;
    const y = (node.depth - baseDepth) * ROW + PAD_TOP;

    // Only add rect for non-synthetic nodes
    if (node.span.span_id !== '__root__') {
      rects.push({
        x, y, w: Math.max(w, MIN_W), h: BAR_H,
        spanId: node.span.span_id,
        serviceName: node.span.service_name || '',
        operationName: node.span.operation_name || '',
        durationUs: dur,
        isError: node.span.span_status === 'error',
        hasChildren: node.children.length > 0,
        depth: node.depth,
        color: svcColor(node.span.service_name || '', colorMap),
      });
    }

    if (node.children.length === 0) return;

    const childTotal = node.children.reduce((s, c) => s + Math.max(c.span.duration_us as number, 1), 0);
    if (childTotal <= 0) return;

    // Compute ideal widths, then scale to fit parent
    const ideals = node.children.map(c =>
      Math.max(w * (Math.max(c.span.duration_us as number, 1) / childTotal), MIN_W)
    );
    const idealSum = ideals.reduce((s, v) => s + v, 0);
    const scale = w / Math.max(idealSum, 1);

    let cx = x;
    for (let i = 0; i < node.children.length; i++) {
      const cw = i === node.children.length - 1
        ? Math.max(x + w - cx, MIN_W)
        : Math.max(ideals[i] * scale, MIN_W);
      layout(node.children[i], cx, cw);
      cx += cw;
    }
  }

  // Root-level: if root is a real span (not synthetic __root__), draw it first
  // as the top bar spanning full width, then draw its children below.
  if (root.span.span_id !== '__root__') {
    layout(root, x0, availW);
  } else if (root.children.length > 0) {
    const childTotal = root.children.reduce((s, c) => s + Math.max(c.span.duration_us as number, 1), 0);
    const ideals = root.children.map(c =>
      Math.max(availW * (Math.max(c.span.duration_us as number, 1) / childTotal), MIN_W)
    );
    const idealSum = ideals.reduce((s, v) => s + v, 0);
    const scale = availW / Math.max(idealSum, 1);

    let cx = x0;
    for (let i = 0; i < root.children.length; i++) {
      const cw = i === root.children.length - 1
        ? Math.max(x0 + availW - cx, MIN_W)
        : Math.max(ideals[i] * scale, MIN_W);
      layout(root.children[i], cx, cw);
      cx += cw;
    }
  }

  return rects;
}

// ---------------------------------------------------------------------------
// Canvas rendering helpers
// ---------------------------------------------------------------------------

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < r * 2) r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Lighten a hex color, returns hex
function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FlameGraphProps {
  spans: FlameSpan[];
  height?: number;
  onSpanSelect?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

export default function FlameGraph({ spans, height = 480, onSpanSelect, selectedSpanId }: FlameGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rectsRef = useRef<LayoutRect[]>([]);

  const [zoomStack, setZoomStack] = useState<FlameNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState('');
  const [cw, setCw] = useState(900);

  // Build tree
  const roots = useMemo(() => buildTree(spans), [spans]);
  const fullTree = useMemo(() => wrapRoots(roots), [roots]);

  const currentRoot = zoomStack.length > 0 ? zoomStack[zoomStack.length - 1] : fullTree;

  // Search matches
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

  // Compute max visible depth
  const visibleRows = useMemo(() => {
    if (!currentRoot) return 1;
    let max = currentRoot.depth;
    const walk = (n: FlameNode) => { if (n.depth > max) max = n.depth; n.children.forEach(walk); };
    walk(currentRoot);
    return Math.max(max - currentRoot.depth, 1);
  }, [currentRoot]);

  const canvasH = Math.max(visibleRows * ROW + PAD_TOP * 2, height);

  // Handle resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setCw(Math.max(entries[0]?.contentRect.width ?? 900, 400));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Render ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(cw, 400);
    const h = canvasH;

    // Set canvas pixel dimensions (must happen every render)
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#f8f9fb';
    ctx.fillRect(0, 0, w, h);

    // No root? Nothing to draw
    if (!currentRoot) return;

    try {
      // Subtle depth markers for each row
      const rows = Math.max(visibleRows, 1);
      for (let i = 0; i < rows; i++) {
        const y = i * ROW + PAD_TOP + ROW;
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(PAD_X, y);
        ctx.lineTo(w - PAD_X, y);
        ctx.stroke();
      }

      // Compute layout
      const rects = computeLayout(currentRoot, w);
      rectsRef.current = rects;

      if (rects.length === 0) {
        // Draw a message when no rects
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
        const { x, y } = r;
        const rh = r.h;

        // Gradient fill with inset for subtle gap between adjacent bars
        const gap = 1;
        const gx = x + gap;
        const gy = y;
        const gw = rw - gap;
        const gh = rh;

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

        // Hover / selected outline (around the inset bar)
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

        // Error badge (top-right corner of bar)
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
        const isWide = gw > 60;

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
        if (isWide && innerW > 30) {
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
      for (let i = 1; i < rows; i++) {
        ctx.fillText('' + i, 3, i * ROW + PAD_TOP + 2);
      }

    } catch (err) {
      console.error('FlameGraph render error:', err);
      ctx.fillStyle = '#EF4444';
      ctx.font = '13px "Geist Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Render error — check console', w / 2, h / 2);
      ctx.textAlign = 'left';
    }
  }, [currentRoot, cw, canvasH, hoveredId, selectedSpanId, matchIds, search, visibleRows]);

  // ── Mouse ──
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
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);
    setHoveredId(hit?.spanId ?? null);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }, [hitTest]);

  const handleMouseLeave = useCallback(() => setHoveredId(null), []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;

    // Find the tree node for this span
    const findNode = (n: FlameNode): FlameNode | null => {
      if (n.span.span_id === hit.spanId) return n;
      for (const c of n.children) { const f = findNode(c); if (f) return f; }
      return null;
    };
    const node = findNode(currentRoot);
    if (node && node.children.length > 0) {
      setZoomStack(prev => [...prev, node]);
    }
    onSpanSelect?.(hit.spanId);
  }, [hitTest, currentRoot, onSpanSelect]);

  // ── Keyboard ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && zoomStack.length > 0) setZoomStack([]); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [zoomStack.length]);

  // ── Hovered span data for tooltip ──
  const hoveredSpan = useMemo(() => {
    if (!hoveredId) return null;
    return spans.find(s => s.span_id === hoveredId) ?? null;
  }, [hoveredId, spans]);
  const hoveredRect = useMemo(() => {
    if (!hoveredId) return null;
    return rectsRef.current.find(r => r.spanId === hoveredId) ?? null;
  }, [hoveredId]);

  // ── Empty state ──
  if (roots.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-fg-tertiary bg-bg-elevated border border-border rounded-lg">
        No span data available for flame graph
      </div>
    );
  }

  return (
    <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-bg-elevated">
        <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-x-auto">
          <button
            onClick={() => setZoomStack([])}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              zoomStack.length === 0
                ? 'bg-accent-primary/10 text-accent-primary'
                : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
            }`}
          >
            All spans
          </button>
          {zoomStack.map((node, i) => {
            const svc = node.span.service_name || '?';
            const op = node.span.operation_name?.slice(0, 30) || '';
            return (
              <span key={node.span.span_id} className="flex items-center gap-1 shrink-0">
                <span className="text-fg-disabled select-none">/</span>
                <button
                  onClick={() => setZoomStack(prev => prev.slice(0, i + 1))}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors truncate max-w-[180px] ${
                    i === zoomStack.length - 1
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
                  }`}
                  title={`${svc}: ${op}`}
                >
                  {svc}{op ? `: ${op}` : ''}
                </button>
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Input
            size="small"
            prefix={<SearchOutlined className="text-fg-tertiary" />}
            placeholder="Search spans…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-40"
            allowClear
          />
          {zoomStack.length > 0 && (
            <>
              <button
                onClick={() => setZoomStack(prev => prev.slice(0, -1))}
                className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary bg-bg-muted hover:bg-bg-muted rounded-md px-2.5 py-1 font-medium transition-colors"
              >
                <CompressOutlined /> Out
              </button>
              <button
                onClick={() => setZoomStack([])}
                className="flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary bg-bg-muted hover:bg-bg-muted rounded-md px-2.5 py-1 font-medium transition-colors"
              >
                <ExpandOutlined /> Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={containerRef} className="relative" style={{ width: '100%', height: canvasH }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: canvasH, cursor: 'pointer' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />

        {/* Tooltip */}
        {hoveredSpan && hoveredRect && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: Math.min(hoverPos.x + 16, window.innerWidth - 300),
              top: hoverPos.y - 10,
            }}
          >
            <div className="bg-bg-elevated/95 backdrop-blur-sm text-fg-inverse rounded-xl shadow-2xl border border-border px-4 py-3 text-xs min-w-[240px]">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hoveredRect.color }} />
                <span className="font-semibold text-fg-inverse">{hoveredSpan.service_name || 'unknown'}</span>
                {hoveredSpan.span_status === 'error' && (
                  <span className="text-[10px] bg-accent-danger/25 text-accent-danger px-1.5 py-0.5 rounded-full ml-auto font-medium">error</span>
                )}
              </div>

              <table className="w-full text-[11px] border-collapse">
                <tbody>
                  <Row label="Operation" value={hoveredSpan.operation_name || '—'} mono />
                  <Row label="Duration" value={fmtDur(hoveredSpan.duration_us)} mono />
                  <Row label="Duration" value={fmtDur(hoveredSpan.duration_us)} mono />
                  {hoveredSpan.status_code != null && hoveredSpan.status_code !== '' && (
                    <Row label="Status code" value={String(hoveredSpan.status_code)} mono />
                  )}
                </tbody>
              </table>

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

      {/* ── Footer ── */}
      <div className="border-t border-border-subtle bg-bg-subtle/50 px-4 py-1.5 flex items-center justify-between text-[10px] text-fg-tertiary">
        <span>{spans.length} spans · depth {visibleRows} · click a bar to zoom</span>
        {zoomStack.length > 0 && (
          <span className="text-purple-500 font-medium">Zoomed {zoomStack.length} level{zoomStack.length > 1 ? 's' : ''} · Esc to reset</span>
        )}
      </div>
    </div>
  );
}

// Tiny helper for tooltip rows
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-1 pr-4 text-fg-tertiary whitespace-nowrap align-top">{label}</td>
      <td className={`py-1 text-right text-fg-inverse ${mono ? 'font-mono' : ''}`}>{value}</td>
    </tr>
  );
}
