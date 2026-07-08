import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { chartColors } from '../../lib/tokens';
import { api } from '../../api/client';
import TimeRangePicker, { parseRange } from '../../components/shared/TimeRangePicker';
import CompactSelect from '../../components/ui/CompactSelect';
import QueryBuilder, { type QueryDef } from './QueryBuilder';
import {
  buildChartOption,
  fmtQuery,
  type ChartSeries,
  type ChartDisplay,
  type LineStyle,
  type StrokeWidth,
} from './utils';
import { applyModifier, resetOverlayColors, type ActiveModifier } from './transforms';
import type { MetricDef, MetricPoint } from './types';

// ── Constants ────────────────────────────────────────────

const DISPLAYS: ChartDisplay[] = ['Lines', 'Bars', 'Area'];
const STYLES: LineStyle[] = ['Solid', 'Dashed', 'Dotted'];
const STROKES: StrokeWidth[] = ['Normal', 'Thin', 'Thick'];

let qid = 1;
function newQuery(label: string): QueryDef {
  return {
    id: `q${qid++}`, label, metric: 'system.cpu.user', agg: 'avg',
    by: 'everything', scope: 'everywhere',
    color: chartColors[(qid - 1) % chartColors.length], modifiers: [],
  };
}

// ═══════════════════════ PAGE ══════════════════════════════

export default function MetricsPage() {
  const [range, setRange] = useState('1h');
  const [queries, setQueries] = useState<QueryDef[]>([newQuery('a')]);
  const [display, setDisplay] = useState<ChartDisplay>('Lines');
  const [lineStyle, setLineStyle] = useState<LineStyle>('Solid');
  const [stroke, setStroke] = useState<StrokeWidth>('Normal');

  // Memoize so start/end (Date.now()-derived) stay stable across renders
  // unless `range` actually changes — avoids infinite refetch → re-render loop.
  const { start, end } = useMemo(() => parseRange(range), [range]);

  // ── Metrics list ──
  const {
    data: metricsListData,
    isLoading: metricsLoading,
    isError: metricsError,
  } = useQuery({
    queryKey: ['metrics-list'], queryFn: () => api.getMetricsList(),
  });
  const metrics: MetricDef[] = metricsListData?.metrics || [];

  // ── Data per query ──
  const queryResults = queries.map((q) => ({
    ...q,
    query: useQuery({
      queryKey: ['metrics-points', q.metric, start, end, q.agg, q.by],
      queryFn: () => api.queryMetrics({
        name: q.metric, start, end, interval: 60, agg: q.agg,
        by: q.by === 'everything' ? undefined : q.by,
      }),
      enabled: !!q.metric,
    }),
  }));

  // ── Chart series ──
  const chartOption = useMemo(() => {
    resetOverlayColors();
    const series: ChartSeries[] = [];
    queryResults.forEach((qr) => {
      const pts = qr.query.data?.points as MetricPoint[] | undefined;
      if (!pts?.length) return;
      const name = fmtQuery(qr.agg, qr.metric, qr.by, qr.modifiers);
      series.push({ name, data: pts, color: qr.color });
      qr.modifiers.forEach((mod) => {
        const overlay = applyModifier([...pts], mod, name);
        series.push(...overlay);
      });
    });
    if (!series.length) return null;
    return buildChartOption(series, { display, lineStyle, stroke });
  }, [queryResults, display, lineStyle, stroke]);

  // ── Handlers ──
  const addQuery = useCallback(() => {
    setQueries(q => [...q, newQuery(String.fromCharCode(97 + q.length))]);
  }, []);

  const addFormula = useCallback((formulaText: string) => {
    const label = String.fromCharCode(97 + queries.length);
    setQueries(q => [...q, { ...newQuery(label), metric: `formula:${formulaText}` }]);
  }, [queries.length]);

  const removeQuery = useCallback((id: string) => {
    if (queries.length <= 1) return;
    setQueries(q => q.filter(x => x.id !== id));
  }, [queries.length]);

  const updateQuery = useCallback((id: string, patch: Partial<QueryDef>) => {
    setQueries(q => q.map(x => x.id === id ? { ...x, ...patch } : x));
  }, []);

  const isLoading = queryResults.some(qr => qr.query.isLoading);

  // ── Look up metric type for badge ──
  const getMetricType = (name: string): string =>
    metrics.find(x => x.name === name)?.type ?? '';

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1400 }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-fg-primary">Metrics</h1>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[13px] font-medium text-accent-primary border-b-2 border-accent-primary pb-1">
              Explorer
            </span>
            <span className="text-[13px] text-fg-tertiary hover:text-fg-secondary cursor-pointer pb-1">
              Overview
            </span>
          </div>
        </div>
        <TimeRangePicker value={range} onChange={v => setRange(v)} />
      </div>

      {/* ── Query Builder ── */}
      <QueryBuilder
        queries={queries}
        metrics={metrics}
        onAddQuery={addQuery}
        onRemoveQuery={removeQuery}
        onUpdateQuery={updateQuery}
        onAddFormula={addFormula}
      />

      {/* ── Display Options ── */}
      <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
        <span className="text-[10px] text-fg-tertiary font-medium">Display</span>
        <CompactSelect value={display} onChange={v => setDisplay(v as ChartDisplay)} options={DISPLAYS} width={64} />
        <span className="text-[10px] text-fg-tertiary font-medium">Style</span>
        <CompactSelect value={lineStyle} onChange={v => setLineStyle(v as LineStyle)} options={STYLES} width={64} />
        <span className="text-[10px] text-fg-tertiary font-medium">Stroke</span>
        <CompactSelect value={stroke} onChange={v => setStroke(v as StrokeWidth)} options={STROKES} width={64} />
      </div>

      {/* ── Chart ── */}
      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        {metricsError ? (
          <div className="flex flex-col items-center justify-center text-center gap-3" style={{ height: 420 }}>
            <p className="text-sm text-fg-tertiary">Failed to load metrics list</p>
            <button onClick={() => window.location.reload()}
              className="text-[12px] text-accent-primary hover:text-accent-primary/80 font-medium">Retry</button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center" style={{ height: 420 }}>
            <div className="skeleton h-64 w-3/4 rounded-lg" />
          </div>
        ) : !chartOption ? (
          <div className="flex flex-col items-center justify-center text-center gap-2" style={{ height: 420 }}>
            {metricsLoading ? (
              <p className="text-sm text-fg-tertiary">Loading metrics...</p>
            ) : (
              <>
                <p className="text-sm text-fg-tertiary">Enter a metric name to query data</p>
                <p className="text-[11px] text-fg-tertiary/60">
                  Try <code className="font-mono text-fg-secondary">system.cpu.user</code> or browse the metric selector
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4">
            {/* Query expression + type badge (Datadog chart title style) */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 flex-wrap">
                {queries.map((q) => {
                  const typeStr = getMetricType(q.metric);
                  return (
                    <div key={q.id} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: q.color }} />
                      <code className="text-[11px] font-semibold font-mono text-fg-primary">
                        {fmtQuery(q.agg, q.metric, q.by, q.modifiers)}
                      </code>
                      {typeStr && (
                        <span className="text-[9px] px-1 py-px rounded-sm bg-bg-muted text-fg-tertiary font-medium">
                          {typeStr}
                        </span>
                      )}
                      {q.modifiers.length > 0 && (
                        <span className="text-[9px] text-fg-tertiary ml-0.5">+{q.modifiers.length}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Export + fullscreen */}
              <div className="flex items-center gap-1.5">
                <button className="text-fg-tertiary hover:text-fg-secondary p-0.5" title="Export">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 1v10M3 6l5 5 5-5M2 13h12" />
                  </svg>
                </button>
                <button className="text-fg-tertiary hover:text-fg-secondary p-0.5" title="Fullscreen">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 6V2h4M10 2h4v4M13 10v4H9M6 14H2v-4" />
                  </svg>
                </button>
              </div>
            </div>
            <ReactECharts option={chartOption} style={{ height: 380 }} notMerge lazyUpdate />
          </div>
        )}
      </div>
    </div>
  );
}
