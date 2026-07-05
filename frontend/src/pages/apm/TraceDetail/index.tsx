import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api/client';
import FlameGraph from '../../../components/topology/FlameGraph';
import type { TraceData, SpanNode } from './types';
import { buildTree } from './utils';
import { TraceHeader, WaterfallView, SpanListView, SpanDetailSidebar } from './components';

export default function TraceDetailPage() {
  const { t } = useTranslation();
  const { traceId } = useParams<{ traceId: string }>();
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'waterfall' | 'list' | 'flamegraph'>('waterfall');

  const { data: trace, isLoading, error } = useQuery<TraceData>({
    queryKey: ['trace', traceId],
    queryFn: () => api.getApmTraceDetail(traceId!),
    enabled: !!traceId,
  });

  const flatSpans = useMemo(() => {
    if (!trace || !trace.spans?.length) return [] as SpanNode[];
    return buildTree(trace.spans).flat;
  }, [trace]);

  const services = useMemo(() => {
    const set = new Set<string>();
    trace?.spans?.forEach((s) => { if (s.service_name) set.add(s.service_name); });
    return [...set].sort();
  }, [trace]);

  const selectedSpan = useMemo(
    () => flatSpans.find((s) => s.span_id === selectedSpanId) || null,
    [flatSpans, selectedSpanId],
  );

  // ── Loading state ──
  if (isLoading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Error state ──
  if (error || !trace) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-danger-bg flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-accent-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <h3 className="text-lg font-semibold text-fg-primary mb-1">{t('apm.errorLoadingTraces')}</h3>
        <p className="text-sm text-fg-secondary mb-4">{error?.message || t('apm.noTracesFound')}</p>
        <Link to="/apm" className="text-accent-primary hover:underline text-sm">{t('apm.backToApm')}</Link>
      </div>
    );
  }

  // ── View mode toggle (self-built, replaces antd Segmented) ──
  const VIEWS: { key: typeof viewMode; label: string }[] = [
    { key: 'waterfall', label: t('apm.waterfall') },
    { key: 'flamegraph', label: t('apm.flameGraph') },
    { key: 'list', label: t('apm.spanList') },
  ];

  const mainContent = viewMode === 'waterfall'
    ? <WaterfallView spanNodes={flatSpans} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />
    : viewMode === 'flamegraph'
      ? <FlameGraph spans={trace.spans as any} height={520} onSpanSelect={setSelectedSpanId} selectedSpanId={selectedSpanId} />
      : <SpanListView spanNodes={flatSpans} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />;

  return (
    <div className="animate-fade-in max-w-[1480px]">
      <TraceHeader trace={trace} services={services} />
      <nav className="flex gap-0 mb-6 border-b border-border">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${
              viewMode === v.key
                ? 'text-accent-primary border-accent-primary'
                : 'text-fg-secondary border-transparent hover:text-fg-primary'
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <div className="flex gap-0">
        <div className="flex-1 min-w-0">{mainContent}</div>
        {selectedSpan && <SpanDetailSidebar span={selectedSpan} onClose={() => setSelectedSpanId(null)} />}
      </div>
    </div>
  );
}
