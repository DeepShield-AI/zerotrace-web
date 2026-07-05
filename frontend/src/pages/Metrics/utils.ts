import * as echarts from 'echarts';
import { chartTheme } from '../../lib/tokens';
import type { MetricPoint, MetricDef } from './types';

// ── Time label ───────────────────────────────────────────

export function tsLabel(ts: string): string {
  try { return ts ? ts.slice(11, 16) : ''; } catch { return ''; }
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
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data.map(p => p.value),
        smooth: true,
        symbol: 'none' as const,
        lineStyle: { color: hex, width: 1.5 },
        areaStyle: seriesList.length === 1 ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hex + '28' },
            { offset: 1, color: hex + '02' },
          ]),
        } : undefined,
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
