import type { FlameSpan, FlameNode, LayoutRect } from './types';

// ── Color palette ──────────────────────────────────────

const DD_COLORS = [
  '#6C3AB8', '#3B8EEA', '#D9347A', '#E07B2C', '#1EA87A',
  '#7C3AED', '#0891B2', '#E84D9B', '#F08C00', '#0D9488',
  '#5B5FC7', '#0099CC', '#D42C6B', '#F26B10', '#12A17D',
  '#6D28D9', '#0E7490', '#BE123C', '#D97706', '#047857',
];

export function svcColor(name: string, map: Map<string, string>): string {
  if (!name) return '#9ca3af';
  if (map.has(name)) return map.get(name)!;
  const c = DD_COLORS[map.size % DD_COLORS.length];
  map.set(name, c);
  return c;
}

// ── Tree builder ───────────────────────────────────────

export function buildTree(spans: FlameSpan[]): FlameNode[] {
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

  const sort = (n: FlameNode) => {
    n.children.sort((a, b) => (b.span.duration_us as number) - (a.span.duration_us as number));
    n.children.forEach(sort);
  };
  roots.forEach(sort);

  let depth = 0;
  const walk = (ns: FlameNode[], d: number) => { for (const n of ns) { n.depth = d; walk(n.children, d + 1); } };
  walk(roots, 0);

  return roots;
}

export function wrapRoots(roots: FlameNode[]): FlameNode {
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

// ── Duration formatter ──────────────────────────────────

export function fmtDur(us: number | string): string {
  const v = (typeof us === 'string' ? parseFloat(us) : us) / 1000;
  if (isNaN(v)) return '—';
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 100) return Math.round(v) + 'ms';
  if (v >= 1) return v.toFixed(1) + 'ms';
  return (v * 1000).toFixed(0) + 'μs';
}

// ── Layout engine ───────────────────────────────────────

const PAD_X = 10;
const PAD_TOP = 8;
const ROW = 25; // BAR_H + GAP
const MIN_W = 3;
const BAR_H = 22;

export function computeLayout(root: FlameNode, canvasW: number): LayoutRect[] {
  const rects: LayoutRect[] = [];
  const baseDepth = root.depth;
  const availW = canvasW - PAD_X * 2;
  const x0 = PAD_X;
  const colorMap = new Map<string, string>();

  function layout(node: FlameNode, x: number, w: number) {
    const dur = node.span.duration_us as number;
    const y = (node.depth - baseDepth) * ROW + PAD_TOP;

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

    const ideals = node.children.map(c => Math.max(w * (Math.max(c.span.duration_us as number, 1) / childTotal), MIN_W));
    const idealSum = ideals.reduce((s, v) => s + v, 0);
    const scale = w / Math.max(idealSum, 1);

    let cx = x;
    for (let i = 0; i < node.children.length; i++) {
      const cw = i === node.children.length - 1 ? Math.max(x + w - cx, MIN_W) : Math.max(ideals[i] * scale, MIN_W);
      layout(node.children[i], cx, cw);
      cx += cw;
    }
  }

  if (root.span.span_id !== '__root__') {
    layout(root, x0, availW);
  } else if (root.children.length > 0) {
    const childTotal = root.children.reduce((s, c) => s + Math.max(c.span.duration_us as number, 1), 0);
    const ideals = root.children.map(c => Math.max(availW * (Math.max(c.span.duration_us as number, 1) / childTotal), MIN_W));
    const idealSum = ideals.reduce((s, v) => s + v, 0);
    const scale = availW / Math.max(idealSum, 1);
    let cx = x0;
    for (let i = 0; i < root.children.length; i++) {
      const cw = i === root.children.length - 1 ? Math.max(x0 + availW - cx, MIN_W) : Math.max(ideals[i] * scale, MIN_W);
      layout(root.children[i], cx, cw);
      cx += cw;
    }
  }

  return rects;
}

export function visibleRowCount(root: FlameNode | undefined): number {
  if (!root) return 1;
  let max = root.depth;
  const walk = (n: FlameNode) => { if (n.depth > max) max = n.depth; n.children.forEach(walk); };
  walk(root);
  return Math.max(max - root.depth, 1);
}

// ── Canvas rendering helpers ────────────────────────────

export function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
