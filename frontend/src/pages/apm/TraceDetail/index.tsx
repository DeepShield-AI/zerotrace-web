import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spin, Segmented } from 'antd';
import { WarningOutlined, FireOutlined, ColumnWidthOutlined, OrderedListOutlined } from '@ant-design/icons';
import { api } from '../../../api/client';
import FlameGraph from '../../../components/FlameGraph';
import type { TraceData, SpanNode } from './types';
import { buildTree } from './utils';
import { TraceHeader, WaterfallView, SpanListView, SpanDetailSidebar } from './components';

export default function TraceDetailPage() {
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

  const selectedSpan = useMemo(() => flatSpans.find((s) => s.span_id === selectedSpanId) || null, [flatSpans, selectedSpanId]);

  if (isLoading) return <div className="flex items-center justify-center py-32"><Spin size="large" /></div>;

  if (error || !trace) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent-danger-bg flex items-center justify-center mb-4"><WarningOutlined className="text-accent-danger text-2xl" /></div>
        <h3 className="text-lg font-semibold text-fg-primary mb-1">Failed to load trace</h3>
        <p className="text-sm text-fg-secondary mb-4">{error?.message || 'Trace not found'}</p>
        <Link to="/apm" className="text-accent-primary hover:underline text-sm">&larr; Back to APM</Link>
      </div>
    );
  }

  const mainContent = viewMode === 'waterfall'
    ? <WaterfallView spanNodes={flatSpans} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />
    : viewMode === 'flamegraph'
      ? <FlameGraph spans={trace.spans as any} height={520} onSpanSelect={setSelectedSpanId} selectedSpanId={selectedSpanId} />
      : <SpanListView spanNodes={flatSpans} selectedId={selectedSpanId} onSelect={setSelectedSpanId} />;

  return (
    <div className="animate-fade-in max-w-[1480px]">
      <TraceHeader trace={trace} services={services} />
      <div className="flex items-center justify-between mb-4">
        <Segmented
          options={[
            { label: <span className="flex items-center gap-1.5"><ColumnWidthOutlined /> Waterfall</span>, value: 'waterfall' },
            { label: <span className="flex items-center gap-1.5"><FireOutlined /> Flame Graph</span>, value: 'flamegraph' },
            { label: <span className="flex items-center gap-1.5"><OrderedListOutlined /> List</span>, value: 'list' },
          ]}
          value={viewMode}
          onChange={(v) => setViewMode(v as typeof viewMode)}
        />
      </div>
      <div className="flex gap-0">
        <div className="flex-1 min-w-0">{mainContent}</div>
        {selectedSpan && <SpanDetailSidebar span={selectedSpan} onClose={() => setSelectedSpanId(null)} />}
      </div>
    </div>
  );
}
