import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

const C = { purple: '#632CA6', green: '#2DB88D', orange: '#E2903C', red: '#E65C5C', gray: '#6C757D', muted: '#ADB5BD', border: '#DEE2E6', bg: '#F8F9FA', text: '#212529' };

function fmtN(n?: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
}

// ════════════════════════ DURATION HISTOGRAM ════════════════════════
function DurationHistogram({ data, onSelectRange }: { data: { latency_ms: number }[]; onSelectRange?: (min: number, max: number) => void }) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const buckets = [
    { label: '0-10', min: 0, max: 10 },
    { label: '10-100', min: 10, max: 100 },
    { label: '100-500', min: 100, max: 500 },
    { label: '500-1s', min: 500, max: 1000 },
    { label: '1-5s', min: 1000, max: 5000 },
    { label: '>5s', min: 5000, max: 99999 },
  ];
  const counts = buckets.map(b => data.filter(d => d.latency_ms >= b.min && d.latency_ms < b.max).length);
  const max = Math.max(...counts, 1);

  const handleMouseDown = (i: number) => (e: React.MouseEvent) => { e.preventDefault(); setDragStart(i); setDragEnd(i); };
  const handleMouseEnter = (i: number) => () => { if (dragStart != null) setDragEnd(i); };
  const handleMouseUp = () => {
    if (dragStart != null && dragEnd != null && onSelectRange) {
      const lo = Math.min(dragStart, dragEnd);
      const hi = Math.max(dragStart, dragEnd);
      onSelectRange(buckets[lo].min, buckets[hi].max);
    }
    setDragStart(null); setDragEnd(null);
  };

  const isSelected = (i: number) => dragStart != null && dragEnd != null && i >= Math.min(dragStart, dragEnd) && i <= Math.max(dragStart, dragEnd);

  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-tertiary">Duration Distribution</h4>
        {dragStart != null && dragEnd != null && (
          <span className="text-[11px] font-mono text-accent-primary">
            {buckets[Math.min(dragStart, dragEnd)].min}ms – {buckets[Math.max(dragStart, dragEnd)].max >= 99999 ? '∞' : (buckets[Math.max(dragStart, dragEnd)].max / 1000).toFixed(1) + 's'}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1 h-24 cursor-crosshair select-none">
        {buckets.map((b, i) => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1"
            onMouseDown={handleMouseDown(i)} onMouseEnter={handleMouseEnter(i)}>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: isSelected(i) ? C.purple : counts[i] > max * 0.5 ? C.red : C.gray }}>{counts[i]}</span>
            <div className="w-full rounded-t transition-all border border-transparent" style={{
              height: `${Math.max((counts[i] / max) * 72, 2)}px`,
              backgroundColor: isSelected(i) ? C.purple : b.min >= 500 ? C.red : b.min >= 100 ? C.orange : '#632CA620',
              opacity: isSelected(i) ? 1 : 0.7 + (i / buckets.length) * 0.3,
            }} />
            <span className="text-[9px] text-fg-disabled">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] mt-2 text-fg-disabled">Drag to select latency range</p>
    </div>
  );
}

// ════════════════════════ SLOW REQUESTS TABLE ════════════════════════
export function SlowRequestsPanel() {
  const [threshold, setThreshold] = useState(100);
  const [detail, setDetail] = useState<any | null>(null);

  const slowRequestsQuery = useQuery({
    queryKey: ['apm', 'slowRequests', threshold],
    queryFn: () => api.getSlowRequests({ min_duration_us: threshold * 1000, limit: 100 }),
  });

  const data = slowRequestsQuery.data?.slow_requests || [];
  const loading = slowRequestsQuery.isLoading;

  return (
    <div className="space-y-3">
      {/* Threshold selector */}
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-medium text-fg-tertiary">Min Duration:</span>
        {[10, 50, 100, 500, 1000].map(t => (
          <button key={t} onClick={() => setThreshold(t)}
            className={`px-3 py-1 text-[12px] font-medium rounded-full border transition-colors ${
              threshold === t ? 'text-fg-inverse border-transparent' : 'bg-bg-elevated hover:border-[#ADB5BD]'
            }`}
            style={threshold === t ? { background: C.purple, borderColor: C.purple } : { color: C.gray, borderColor: C.border }}>
            &gt;{t >= 1000 ? t / 1000 + 's' : t + 'ms'}
          </button>
        ))}
        <span className="text-[11px] ml-auto text-fg-disabled">{data.length} slow requests</span>
      </div>

      {data.length > 0 && <DurationHistogram data={data} />}

      {/* Table */}
      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-fg-disabled">Loading...</div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-fg-disabled">No slow requests found above {threshold}ms threshold</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider border-b border-border text-fg-disabled">
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Resource</th>
                <th className="px-4 py-2.5 text-right">Duration</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const ms = parseFloat(r.latency_ms) || 0;
                const isSlow = ms > 1000;
                const isErr = parseInt(r.response_code) >= 400;
                return (
                  <tr key={i} className="transition-colors hover:bg-purple-50/30 border-b border-border-subtle">
                    <td className="px-4 py-2 font-mono text-[11px] text-fg-disabled">{r.time?.slice(11, 19)}</td>
                    <td className="px-4 py-2 font-medium truncate max-w-[180px] text-fg-primary">{r.service || '—'}</td>
                    <td className="px-4 py-2 font-mono text-[11px] truncate max-w-[300px] text-fg-tertiary">{r.request_resource || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden bg-bg-subtle">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min((ms / 1000) * 10, 100)}%`,
                            backgroundColor: isSlow ? C.red : isErr ? C.orange : C.green,
                          }} />
                        </div>
                        <span className="font-mono font-semibold tabular-nums" style={{ color: isSlow ? C.red : C.gray }}>
                          {ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : ms.toFixed(0) + 'ms'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${isErr ? 'bg-accent-danger-bg text-accent-danger' : 'bg-accent-success-bg text-accent-success'}`}>
                        {r.response_code || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ════════════════════════ ERROR ANALYSIS ════════════════════════
export function ErrorAnalysisPanel() {
  const errorQuery = useQuery({
    queryKey: ['apm', 'errorSummary'],
    queryFn: () => api.getErrorSummary(),
  });

  const data = errorQuery.data?.errors || [];
  const loading = errorQuery.isLoading;

  const totalErrors = data.reduce((s, e) => s + (parseInt(e.error_count) || 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary stat */}
      <div className="flex items-center gap-4">
        <div className="bg-bg-elevated border border-border rounded-lg px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-disabled">Total Errors (1h)</p>
          <p className="text-[24px] font-bold font-mono text-accent-danger">{fmtN(totalErrors)}</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-disabled">Endpoints with Errors</p>
          <p className="text-[24px] font-bold font-mono text-accent-warning">{data.length}</p>
        </div>
      </div>

      {/* Error table */}
      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-fg-disabled">Loading...</div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-fg-disabled">No errors found in the last hour</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider border-b border-border text-fg-disabled">
                <th className="px-4 py-2.5">Endpoint</th>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5 text-right">Count</th>
                <th className="px-4 py-2.5 text-right">Avg Latency</th>
                <th className="px-4 py-2.5 text-right">Max Latency</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => {
                const cnt = parseInt(r.error_count) || 0;
                const ratio = cnt / Math.max(totalErrors, 1);
                return (
                  <tr key={i} className="transition-colors hover:bg-purple-50/30 border-b border-border-subtle">
                    <td className="px-4 py-2 font-mono text-[11px] truncate max-w-[300px] text-fg-primary">{r.endpoint || '—'}</td>
                    <td className="px-4 py-2 truncate max-w-[150px] text-fg-tertiary">{r.service || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full overflow-hidden bg-bg-subtle">
                          <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, backgroundColor: C.red }} />
                        </div>
                        <span className="font-mono font-semibold tabular-nums text-accent-danger">{cnt}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-fg-tertiary">
                      {parseFloat(r.avg_latency_ms || 0).toFixed(1)}ms
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-fg-tertiary">
                      {parseFloat(r.max_latency_ms || 0).toFixed(1)}ms
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
