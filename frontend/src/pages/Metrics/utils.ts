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
  'var(--accent-primary)',
  'var(--accent-info)',
  'var(--accent-success)',
  'var(--accent-warning)',
  'var(--accent-danger)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
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
    grid: { left: 56, right: 24, top: 16, bottom: 28 },
    xAxis: {
      type: 'category' as const,
      data: allTimestamps,
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 10, color: axisColor,
        fontFamily: 'Geist Mono, monospace',
        interval: Math.max(1, Math.floor(allTimestamps.length / 8)) - 1,
      },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: gridColor } },
      axisLabel: { fontSize: 10, color: axisColor, fontFamily: 'Geist Mono, monospace' },
    },
    series: seriesList.map((s, i) => {
      const hex = resolveColor(s.color || CHART_COLORS[i % CHART_COLORS.length]);
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data.map(p => p.value),
        smooth: true,
        symbol: 'none' as const,
        lineStyle: { color: hex, width: 2 },
        areaStyle: seriesList.length === 1 ? {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hex + '20' },
            { offset: 1, color: hex + '00' },
          ]),
        } : undefined,
      };
    }),
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { fontSize: 11, color: cssVar('--fg-primary', '#1c2b34'), fontFamily: 'Geist Sans, system-ui, sans-serif' },
    },
    legend: seriesList.length > 1 ? {
      bottom: 0,
      textStyle: { fontSize: 10, color: axisColor },
    } : undefined,
  };
}
