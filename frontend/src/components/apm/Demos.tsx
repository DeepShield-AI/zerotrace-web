import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import DurationHistogram from './DurationHistogram';

function fmtN(n?: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
}

export function SlowRequestsPanel() {
  const { t } = useTranslation();
  const [threshold, setThreshold] = useState(100);
  const q = useQuery({ queryKey: ['apm', 'slowRequests', threshold], queryFn: () => api.getSlowRequests({ min_duration_us: threshold * 1000, limit: 100 }) });
  const data = q.data?.slow_requests || [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[12px] font-medium text-fg-tertiary">{t('apm.minDuration')}:</span>
        {[10, 50, 100, 500, 1000].map(v => (
          <button key={v} onClick={() => setThreshold(v)}
            className={`px-3 py-1 text-[12px] font-medium rounded-full border transition-colors ${threshold === v ? 'bg-accent-primary text-fg-inverse border-accent-primary' : 'bg-bg-elevated text-fg-secondary border-border hover:border-border-strong'}`}>
            &gt;{v >= 1000 ? v / 1000 + 's' : v + 'ms'}
          </button>
        ))}
        <span className="text-[11px] ml-auto text-fg-tertiary">{data.length} slow requests</span>
      </div>
      {data.length > 0 && <DurationHistogram data={data} />}
      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        {q.isLoading ? <div className="py-12 text-center text-[13px] text-fg-tertiary">{t('apm.loadingEllipsis')}</div>
        : data.length === 0 ? <div className="py-12 text-center text-[13px] text-fg-tertiary">{t('apm.noSlowRequests', { threshold })}</div>
        : <table className="w-full text-[12px]"><thead><tr className="text-left text-[10px] font-semibold uppercase tracking-wider border-b border-border text-fg-tertiary"><th className="px-4 py-2.5">Time</th><th className="px-4 py-2.5">Service</th><th className="px-4 py-2.5">Resource</th><th className="px-4 py-2.5 text-right">Duration</th><th className="px-4 py-2.5 text-center">Status</th></tr></thead>
        <tbody>{data.map((r: any, i: number) => { const ms = parseFloat(r.latency_ms) || 0; const isSlow = ms > 1000; const isErr = parseInt(r.response_code) >= 400;
          return (<tr key={i} className="transition-colors hover:bg-bg-subtle border-b border-border-subtle"><td className="px-4 py-2 font-mono text-[11px] text-fg-tertiary">{r.time?.slice(11, 19)}</td><td className="px-4 py-2 font-medium truncate max-w-[180px] text-fg-primary">{r.service || '—'}</td><td className="px-4 py-2 font-mono text-[11px] truncate max-w-[300px] text-fg-tertiary">{r.request_resource || '—'}</td>
          <td className="px-4 py-2 text-right"><div className="flex items-center justify-end gap-2"><div className="w-16 h-1.5 rounded-full overflow-hidden bg-bg-muted"><div className="h-full rounded-full" style={{width:`${Math.min((ms/1000)*10,100)}%`,backgroundColor:isSlow?'var(--accent-danger)':isErr?'var(--accent-warning)':'var(--accent-success)'}}/></div><span className={`font-mono font-semibold tabular-nums ${isSlow?'text-accent-danger':'text-fg-secondary'}`}>{ms>=1000?(ms/1000).toFixed(2)+'s':ms.toFixed(0)+'ms'}</span></div></td>
          <td className="px-4 py-2 text-center"><span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${isErr?'bg-accent-danger-bg text-accent-danger':'bg-accent-success-bg text-accent-success'}`}>{r.response_code||'—'}</span></td></tr>); })}</tbody></table>}
      </div>
    </div>
  );
}

export function ErrorAnalysisPanel() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['apm', 'errorSummary'], queryFn: () => api.getErrorSummary() });
  const data = q.data?.errors || [];
  const totalErrors = data.reduce((s: number, e: any) => s + (parseInt(e.error_count) || 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="bg-bg-elevated border border-border rounded-lg px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">{t('apm.totalErrors1h')}</p>
          <p className="text-[24px] font-bold font-mono text-accent-danger">{fmtN(totalErrors)}</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-tertiary">{t('apm.endpointsWithErrors')}</p>
          <p className="text-[24px] font-bold font-mono text-accent-warning">{data.length}</p>
        </div>
      </div>
      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        {q.isLoading ? <div className="py-12 text-center text-[13px] text-fg-tertiary">{t('apm.loadingEllipsis')}</div>
        : data.length === 0 ? <div className="py-12 text-center text-[13px] text-fg-tertiary">{t('apm.noErrorsFound')}</div>
        : <table className="w-full text-[12px]"><thead><tr className="text-left text-[10px] font-semibold uppercase tracking-wider border-b border-border text-fg-tertiary"><th className="px-4 py-2.5">Endpoint</th><th className="px-4 py-2.5">Service</th><th className="px-4 py-2.5 text-right">Count</th><th className="px-4 py-2.5 text-right">Avg Latency</th><th className="px-4 py-2.5 text-right">Max Latency</th></tr></thead>
        <tbody>{data.map((r: any, i: number) => { const cnt = parseInt(r.error_count) || 0; const ratio = cnt / Math.max(totalErrors, 1);
          return (<tr key={i} className="transition-colors hover:bg-bg-subtle border-b border-border-subtle"><td className="px-4 py-2 font-mono text-[11px] truncate max-w-[300px] text-fg-primary">{r.endpoint||'—'}</td><td className="px-4 py-2 truncate max-w-[150px] text-fg-tertiary">{r.service||'—'}</td>
          <td className="px-4 py-2 text-right"><div className="flex items-center justify-end gap-2"><div className="w-12 h-1.5 rounded-full overflow-hidden bg-bg-muted"><div className="h-full rounded-full bg-accent-danger" style={{width:`${ratio*100}%`}}/></div><span className="font-mono font-semibold tabular-nums text-accent-danger">{cnt}</span></div></td>
          <td className="px-4 py-2 text-right font-mono tabular-nums text-fg-tertiary">{parseFloat(r.avg_latency_ms||0).toFixed(1)}ms</td>
          <td className="px-4 py-2 text-right font-mono tabular-nums text-fg-tertiary">{parseFloat(r.max_latency_ms||0).toFixed(1)}ms</td></tr>); })}</tbody></table>}
      </div>
    </div>
  );
}
