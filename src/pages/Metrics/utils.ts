import { chartTheme, chartColors } from '../../lib/tokens';
import type { MetricPoint } from './types';
import type { ActiveModifier } from './transforms';
import { fmtN, fmtB, fmtLatency } from '../../utils/format';

// ── Helpers ──────────────────────────────────────────────

export function tsLabel(ts: string): string {
  try { return ts ? ts.slice(11, 16) : ''; } catch { return ''; }
}

export function formatValue(v: number, unit: string): string {
  switch (unit) {
    case 'bytes': return fmtB(v);
    case 'μs': case 'us': return fmtLatency(v);
    case '%': return v.toFixed(2) + '%';
    default: return fmtN(v);
  }
}

function cssVar(name: string, fb: string): string {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch { return fb; }
}

/** Apply alpha to a hex color, stripping any existing alpha first */
function withAlpha(color: string, alpha: string): string {
  const base = color.length === 9 ? color.slice(0, 7) : color;
  return base + alpha;
}

// ── Query formatting ─────────────────────────────────────

/** Build Datadog-style compact query expression: `avg:system.cpu.user{*} by {host}` */
export function fmtQuery(agg: string, metric: string, by: string, modifiers: ActiveModifier[]): string {
  const modPrefix = modifiers.length > 0
    ? modifiers.map(m => m.fn.toLowerCase().replace(/ /g, '_')).join('') + '(' : '';
  const modSuffix = modifiers.length > 0 ? ')' : '';
  const byClause = by === 'everything' ? '{*}' : `{*} by {${by}}`;
  return `${modPrefix}${agg}:${metric}${byClause}${modSuffix}`;
}

// ── Chart display options ────────────────────────────────

export type LineStyle = 'Solid' | 'Dashed' | 'Dotted';
export type StrokeWidth = 'Normal' | 'Thin' | 'Thick';
export type ChartDisplay = 'Lines' | 'Bars' | 'Area';

const STROKE_MAP: Record<StrokeWidth, number> = { Thin: 1, Normal: 1.5, Thick: 2.5 };
const STYLE_MAP: Record<LineStyle, 'solid' | 'dashed' | 'dotted'> = { Solid: 'solid', Dashed: 'dashed', Dotted: 'dotted' };

// ── Chart series types ───────────────────────────────────

export type SeriesStyle = 'line' | 'dashed' | 'band' | 'scatter';

export interface ChartSeries {
  name: string;
  data: MetricPoint[];
  color: string;
  style?: SeriesStyle;
  /** For 'band' style: paired upper/lower data */
  bandLower?: MetricPoint[];
  bandColor?: string;
}

// ── Chart option builder ─────────────────────────────────

export interface ChartDisplayOptions {
  display: ChartDisplay;
  lineStyle: LineStyle;
  stroke: StrokeWidth;
}

export function buildChartOption(
  seriesList: ChartSeries[],
  opts: ChartDisplayOptions = { display: 'Lines', lineStyle: 'Solid', stroke: 'Normal' },
) {
  if (!seriesList.length || seriesList.every(s => !s.data.length)) return null;

  const axisColor = chartTheme.axisColor();
  const gridColor = chartTheme.gridColor();
  const tooltipBg = chartTheme.tooltipBg();
  const tooltipBorder = chartTheme.tooltipBorder();
  const timestamps = seriesList[0].data.map(p => tsLabel(p.ts));
  const dashType = STYLE_MAP[opts.lineStyle];
  const lineWidth = STROKE_MAP[opts.stroke];

  const echartsSeries: any[] = [];

  seriesList.forEach((s, idx) => {
    const color = s.color || chartColors[idx % chartColors.length];

    switch (s.style) {
      case 'band': {
        if (s.bandLower) {
          const bandColor = s.bandColor || color;
          // Unique stack group so multiple bands don't interfere
          const stackGroup = `__band_${idx}`;

          // 1. Invisible anchor at lower bound (provides the stacking baseline)
          echartsSeries.push({
            type: 'line',
            data: s.bandLower.map(p => p.value),
            stack: stackGroup,
            smooth: false,
            symbol: 'none',
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
            tooltip: { show: false },
            legendHoverLink: false,
            silent: true,
          });

          // 2. Visible area fill: renders as diff between upper and lower, stacked on top of anchor
          echartsSeries.push({
            type: 'line',
            data: s.data.map((p, i) => p.value - (s.bandLower?.[i]?.value ?? 0)),
            stack: stackGroup,
            smooth: false,
            symbol: 'none',
            lineStyle: { opacity: 0 },
            areaStyle: { color: withAlpha(bandColor, '14') },
            tooltip: { show: false },
            legendHoverLink: false,
            silent: true,
          });

          // 3. Upper dashed boundary line
          echartsSeries.push({
            name: s.name + ' (upper)',
            type: 'line',
            data: s.data.map(p => p.value),
            smooth: false,
            symbol: 'none',
            lineStyle: { color: bandColor, width: 1, type: 'dashed' },
          });

          // 4. Lower dashed boundary line
          echartsSeries.push({
            name: s.name + ' (lower)',
            type: 'line',
            data: s.bandLower.map(p => p.value),
            smooth: false,
            symbol: 'none',
            lineStyle: { color: bandColor, width: 1, type: 'dashed' },
          });
        }
        break;
      }
      case 'scatter': {
        echartsSeries.push({
          name: s.name,
          type: 'scatter',
          data: s.data.map((p, i) => p.value !== 0 ? [i, p.value] : null).filter(Boolean),
          symbolSize: 8,
          itemStyle: { color },
        });
        break;
      }
      default: {
        const isArea = opts.display === 'Area';
        echartsSeries.push({
          name: s.name,
          type: 'line',
          data: s.data.map(p => p.value),
          smooth: false,
          symbol: 'none',
          lineStyle: { color, width: lineWidth, type: dashType },
          areaStyle: isArea ? { color: withAlpha(color, '28'), opacity: 0.6 } : undefined,
        });
      }
    }
  });

  return {
    animation: false,
    grid: { left: 52, right: 20, top: 12, bottom: 36 },
    xAxis: {
      type: 'category', data: timestamps,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: {
        fontSize: 10, color: axisColor, fontFamily: 'Geist Mono, monospace',
        interval: Math.max(1, Math.floor(timestamps.length / 8)) - 1, margin: 10,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: gridColor, type: 'dashed', width: 0.5 } },
      axisLabel: { fontSize: 10, color: axisColor, fontFamily: 'Geist Mono, monospace', margin: 10 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: echartsSeries,
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg, borderColor: tooltipBorder, borderWidth: 0.5,
      padding: [8, 12],
      textStyle: { fontSize: 11, color: cssVar('--fg-primary', '#1c2b34') },
    },
    legend: {
      bottom: 0,
      itemWidth: 8, itemHeight: 8, itemGap: 16,
      textStyle: { fontSize: 11, color: axisColor },
    },
  };
}
