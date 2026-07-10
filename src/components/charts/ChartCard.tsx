import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

/* ── Helpers ── */

function num(v: number | string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

const chartTheme = {
  color: ['#632ca6', '#2db88d', '#e2903c', '#e65c5c', '#4799eb'],
  textStyle: { fontFamily: 'inherit', fontSize: 11, color: '#a1a1aa' },
  grid: { left: 50, right: 16, top: 12, bottom: 28 },
  xAxis: { axisLine: { lineStyle: { color: '#e4e4e7' } }, axisTick: { show: false }, splitLine: { show: false } },
  yAxis: { splitLine: { lineStyle: { color: '#f4f4f5' } } },
};

/* ── ECharts Wrapper Card ── */

export default function ChartCard({ title, data, series, areaStyle, fmt }: {
  title: string; data: any[]; series: { name: string; key: string; color?: string }[]; areaStyle?: boolean; fmt?: (v: number) => string;
}) {
  const h = 140;
  if (!data.length) {
    return (
      <div className="bg-bg-elevated border border-border rounded-lg p-4">
        <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">{title}</h4>
        <div className="flex items-center justify-center text-xs text-fg-tertiary" style={{ height: h }}>No data yet</div>
      </div>
    );
  }
  const ts = data.map(d => (d.ts || '').slice(11, 16));
  const option = {
    ...chartTheme,
    tooltip: { trigger: 'axis' as const, valueFormatter: fmt ? (v: any) => fmt(v) : undefined },
    xAxis: { ...chartTheme.xAxis, data: ts, axisLabel: { interval: Math.max(Math.floor(ts.length / 8), 0) } },
    yAxis: { ...chartTheme.yAxis, axisLabel: { formatter: fmt } },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      data: data.map(d => num(d[s.key])),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: s.color },
      areaStyle: areaStyle
        ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: (s.color || '#632ca6') + '20' },
              { offset: 1, color: (s.color || '#632ca6') + '02' },
            ]),
          }
        : undefined,
    })),
  };
  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4">
      <h4 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider mb-3">{title}</h4>
      <ReactECharts option={option} style={{ height: h }} notMerge lazyUpdate />
    </div>
  );
}
