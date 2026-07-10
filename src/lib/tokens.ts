/**
 * tokens.ts - JS-only token consumption
 *
 * 用于 ECharts / Canvas / 动画数值等**不能用 CSS class** 的场景。
 *
 * ❌ 禁止事项：
 *   - 组件 <div style={{ color: chartColors[0] }}>  → 用 <div className="text-chart-1">
 *   - 任何背景/边框/文字色都不要从这里 import
 *
 * ✅ 允许场景：
 *   - ECharts option 里的 series.itemStyle.color
 *   - Canvas 2D 画图
 *   - GSAP / framer-motion 需要色值做插值动画
 */

/** ECharts series 循环用（10 色，Datadog 生产 palette） */
export const chartColors = [
  '#8c4fff', // purple - primary
  '#128fea', // blue
  '#01a88d', // teal
  '#ed7100', // orange
  '#e7157b', // pink
  '#41eba4', // mint
  '#5bceff', // sky
  '#fec866', // amber
  '#c925d1', // magenta
  '#7aa116', // olive
] as const;

/** Monitor 严重程度色（对应 CSS var --severity-*）*/
export const severityColors = {
  ok:        '#41c464',
  warn:      '#deab3e',
  alert:     '#eb364b',
  critical:  '#ca0812',
  'no-data': '#828ba4',
  unknown:   '#c4c4c4',
} as const;

/** ECharts 里的 axis / grid 引用 CSS 变量的方式 */
export const chartTheme = {
  /** 网格线颜色（从 CSS 变量取，随主题变）*/
  gridColor: () =>
    getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim(),

  /** axis 文字色 */
  axisColor: () =>
    getComputedStyle(document.documentElement).getPropertyValue('--fg-tertiary').trim(),

  /** tooltip 背景 */
  tooltipBg: () =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim(),

  /** tooltip 边框 */
  tooltipBorder: () =>
    getComputedStyle(document.documentElement).getPropertyValue('--border-default').trim(),
};

export type ChartColor = typeof chartColors[number];
export type SeverityKey = keyof typeof severityColors;
