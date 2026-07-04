import type { SpanData, SpanNode } from './types';

// ── Number coercion ─────────────────────────────────────

export function num(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

// ── Duration formatters ──────────────────────────────────

export function fmtDuration(us?: number | string): string {
  const v = num(us) / 1000;
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) return v.toFixed(1) + 'ms';
  return '<1ms';
}

export function fmtDurationExact(us?: number | string): string {
  const v = num(us) / 1000;
  if (v >= 1000) return (v / 1000).toFixed(2) + 's';
  if (v >= 1) {
    if (v < 10) return v.toFixed(2) + 'ms';
    return v.toFixed(1) + 'ms';
  }
  return num(us).toFixed(0) + 'μs';
}

// ── Service colors ───────────────────────────────────────

const DD_COLORS = [
  '#632CA6', '#4799EB', '#DB3888', '#E2903C', '#2DB88D',
  '#8B5CF6', '#06B6D4', '#F472B6', '#F59E0B', '#10B981',
  '#6366F1', '#0EA5E9', '#EC4899', '#F97316', '#22C55E',
];

export const colorForService = (() => {
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

// ── Span tree builder ────────────────────────────────────

export function buildTree(spans: SpanData[]): { flat: SpanNode[] } {
  const map = new Map<string, SpanNode>();
  const roots: SpanNode[] = [];

  for (const s of spans) map.set(s.span_id, { ...s, children: [], depth: 0 });

  for (const s of spans) {
    const node = map.get(s.span_id)!;
    const pid = s.parent_span_id;
    if (pid && pid !== '0' && map.has(pid)) map.get(pid)!.children.push(node);
    else roots.push(node);
  }

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

// ── Time helpers ─────────────────────────────────────────

export function parseTimeUs(ts?: string): number {
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
