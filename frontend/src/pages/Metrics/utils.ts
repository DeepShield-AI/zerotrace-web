import * as echarts from 'echarts';
import { chartTheme } from '../../lib/tokens';
import type { MetricPoint, MetricDef, DistributionItem, TopListItem } from './types';

// ── Time label ───────────────────────────────────────────

export function tsLabel(ts: string): string {
  try { return ts ? ts.slice(11, 16) : ''; } catch { return ''; }
}

// ── Distribution & Top List ───────────────────────────────

const FAKE_TAG_VALUES: Record<string, string[]> = {
  host: ['web-01.prod', 'web-02.prod', 'db-01.prod', 'db-02.prod', 'cache-01.prod', 'worker-01.prod', 'api-01.prod', 'bastion.prod'],
  service: ['api-gateway', 'auth-svc', 'user-svc', 'payment-svc', 'search-svc', 'notification-svc'],
  env: ['prod', 'staging', 'dev'],
  region: ['us-east-1', 'ap-northeast-1', 'eu-west-1'],
};

export function computeDistribution(points: MetricPoint[], by: string): DistributionItem[] {
  if (!by || points.length === 0 || by === 'none') return [];
  const labels = FAKE_TAG_VALUES[by] || ['value-1', 'value-2', 'value-3'];
  const base = points.reduce((s, p) => s + p.value, 0) / points.length;
  const items: DistributionItem[] = labels.map((label, i) => {
    const factor = 0.3 + Math.random() * 1.4;
    const value = base * factor * (labels.length / (i + 1));
    return { label, value: Math.round(value * 100) / 100, pct: 0 };
  });
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  items.forEach(i => { i.pct = Math.round((i.value / total) * 1000) / 10; });
  items.sort((a, b) => b.value - a.value);
  return items;
}

export function computeTopList(points: MetricPoint[], by: string): TopListItem[] {
  return computeDistribution(points, by).map(d => ({ label: d.label, value: d.value, pct: d.pct }));
}

// ── Distribution chart option (Datadog-style horizontal bar) ──

const DIST_COLORS = ['#8c4fff', '#128fea', '#01a88d', '#ed7100', '#e7157b', '#41eba4', '#5bceff', '#fec866'];

export function buildDistOption(items: DistributionItem[]) {
  if (!items.length) return null;
  const labels = items.map(i => i.label);
  const values = items.map(i => i.value);
  const maxVal = Math.max(...values, 1);
  const axisColor = chartTheme.axisColor();
  const tooltipBg = chartTheme.tooltipBg();
  const tooltipBorder = chartTheme.tooltipBorder();

  return {
    animation: false,
    grid: { left: 140, right: 80, top: 8, bottom: 4 },
    xAxis: { type: 'value' as const, show: false, max: maxVal },
    yAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: { fontSize: 10, fontFamily: 'Geist Mono, monospace', color: axisColor },
      axisTick: { show: false },
      axisLine: { show: false },
      inverse: true,
    },
    series: [{
      type: 'bar' as const,
      data: values.map((v, i) => ({ value: v, itemStyle: { color: DIST_COLORS[i % DIST_COLORS.length], borderRadius: [0, 3, 3, 0] } })),
      barMaxWidth: 16,
      label: {
        show: true, position: 'right' as const,
        fontSize: 10, fontFamily: 'Geist Mono, monospace', color: axisColor,
        formatter: (p: any) => `${items[p.dataIndex].pct}%`,
      },
    }],
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: tooltipBg, borderColor: tooltipBorder, borderWidth: 0.5,
      padding: [8, 12],
      textStyle: { fontSize: 11, fontFamily: 'Geist Sans, system-ui, sans-serif' },
      formatter: (p: any) => {
        const d = p[0];
        return `<strong>${d.name}</strong><br/>${formatValue(d.value, '')} · ${items[d.dataIndex].pct}%`;
      },
    },
  };
}

// ── Value formatter ──────────────────────────────────────

import { fmtN, fmtB, fmtLatency } from '../../utils/format';

export function formatValue(v: number, unit: string): string {
  switch (unit) {
    case 'bytes': return fmtB(v);
    case 'μs': case 'us': return fmtLatency(v);
    case '%': return v.toFixed(2) + '%';
    default: return fmtN(v);
  }
}

// ── CSS variable reader ──────────────────────────────────

function cssVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// ── Chart option builder ─────────────────────────────────

const CHART_COLORS = [
  'var(--chart-1)',  // purple
  'var(--chart-2)',  // blue
  'var(--chart-3)',  // teal
  'var(--chart-4)',  // orange
  'var(--chart-5)',  // pink
  'var(--chart-6)',  // mint
  'var(--chart-7)',  // sky
  'var(--chart-8)',  // amber
];

function resolveColor(colorVar: string): string {
  if (colorVar.startsWith('var(')) {
    const name = colorVar.slice(4, -1).trim();
    return cssVar(name, '#632CA6');
  }
  return colorVar;
}

export interface ChartSeries {
  name: string;
  data: MetricPoint[];
  color?: string;
  unit?: string;
}

export function buildChartOption(seriesList: ChartSeries[], _def?: MetricDef) {
  if (!seriesList.length || seriesList.every(s => !s.data.length)) return null;

  const allTimestamps = seriesList[0].data.map(p => tsLabel(p.ts));
  const axisColor = chartTheme.axisColor();
  const gridColor = chartTheme.gridColor();
  const tooltipBg = chartTheme.tooltipBg();
  const tooltipBorder = chartTheme.tooltipBorder();

  return {
    animation: false,
    grid: { left: 60, right: 28, top: 20, bottom: seriesList.length > 1 ? 36 : 28 },
    xAxis: {
      type: 'category' as const,
      data: allTimestamps,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10, color: axisColor,
        fontFamily: 'Geist Mono, monospace',
        interval: Math.max(1, Math.floor(allTimestamps.length / 10)) - 1,
        margin: 12,
      },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: gridColor, type: 'dashed' as const, width: 0.5 } },
      axisLabel: { fontSize: 10, color: axisColor, fontFamily: 'Geist Mono, monospace', margin: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: seriesList.map((s, i) => {
      const hex = resolveColor(s.color || CHART_COLORS[i % CHART_COLORS.length]);
      const isMulti = seriesList.length > 1;
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data.map(p => p.value),
        smooth: true,
        symbol: 'none' as const,
        lineStyle: { color: hex, width: isMulti ? 1 : 1.5 },
        stack: isMulti ? 'total' : undefined,
        areaStyle: {
          color: hex + (isMulti ? '40' : '28'),
          opacity: isMulti ? 0.7 : 1,
        },
      };
    }),
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 0.5,
      padding: [8, 12],
      textStyle: { fontSize: 11, color: cssVar('--fg-primary', '#1c2b34'), fontFamily: 'Geist Sans, system-ui, sans-serif' },
      extraCssText: 'border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);',
    },
    legend: seriesList.length > 1 ? {
      bottom: 0,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { fontSize: 11, color: axisColor, fontFamily: 'Geist Sans, system-ui, sans-serif' },
    } : undefined,
  };
}
