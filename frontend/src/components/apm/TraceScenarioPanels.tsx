import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import type { ApmTraceItem } from '../../api/types';

const num = (v: number | string | undefined): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};
const fmtN = (n: number): string => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
};

function parseQuery(rawQuery: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = rawQuery.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const colonIdx = p.indexOf(':');
    if (colonIdx > 0) {
      result[p.slice(0, colonIdx)] = p.slice(colonIdx + 1);
    }
  }
  return result;
}

// ── Main component ───────────────────────────────────────

export default function TraceScenarioPanels({ rawQuery, traces }: {
  rawQuery: string;
  traces: ApmTraceItem[];
}) {
  const { t } = useTranslation();
  const parsed = useMemo(() => parseQuery(rawQuery), [rawQuery]);
  const hasError = 'status' in parsed && parsed.status === 'error';
  const hasSlow = 'duration' in parsed;
  const hasService = 'service' in parsed;
  const serviceName = parsed.service || '';

  // Compute stats from traces
  const stats = useMemo(() => {
    const services = new Map<string, { count: number; avgDur: number; errors: number }>();
    traces.forEach(t => {
      const svc = t.root_service || 'unknown';
      const s = services.get(svc) || { count: 0, avgDur: 0, errors: 0 };
      s.count++;
      s.avgDur += num(t.duration_us);
      s.errors += t.status === 'error' ? 1 : 0;
      services.set(svc, s);
    });
    services.forEach(s => { s.avgDur = s.avgDur / Math.max(s.count, 1); });
    return {
      serviceCount: services.size,
      services: Array.from(services.entries())
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.count - a.count),
    };
  }, [traces]);

  // Load error summary when error filter is active
  const { data: errorData } = useQuery({
    queryKey: ['apm', 'errorSummary'],
    queryFn: () => api.getErrorSummary(),
    enabled: hasError,
  });
  const errorSummary = (errorData as any)?.errors || [];
  const totalErrors = errorSummary.reduce((s: number, e: any) => s + (parseInt(e.error_count) || 0), 0);

  return (
    <div className="space-y-3">
      {/* ── Error Analysis Panel ── */}
      {hasError && (
        <div className="bg-accent-danger/3 border border-accent-danger/15 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-danger" />
            <h3 className="text-sm font-semibold text-accent-danger">{t('apm.errorAnalysisTitle')}</h3>
            <span className="text-[10px] text-fg-tertiary ml-auto">{totalErrors} {t('apm.errors')}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.foundErrors')}</p>
              <p className="text-lg font-bold font-mono text-accent-danger">{totalErrors}</p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.affectedServices')}</p>
              <p className="text-lg font-bold font-mono text-fg-primary">{stats.serviceCount}</p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.errorTraces')}</p>
              <p className="text-lg font-bold font-mono text-fg-primary">{traces.length}</p>
            </div>
          </div>
          {errorSummary.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-fg-tertiary uppercase mb-1.5">{t('apm.topErrorEndpoints')}</p>
              <div className="space-y-1">
                {errorSummary.slice(0, 5).map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 text-fg-secondary font-mono truncate">{e.endpoint || '—'}</span>
                    <span className="text-accent-danger font-mono font-medium">{e.error_count}</span>
                    <span className="text-fg-tertiary font-mono">{parseFloat(e.avg_latency_ms || 0).toFixed(0)}ms avg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── {t('apm.slowRequestTitle')} Panel ── */}
      {hasSlow && (
        <div className="bg-accent-warning/5 border border-accent-warning/15 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-warning" />
            <h3 className="text-sm font-semibold text-fg-primary">{t('apm.slowRequestTitle')}</h3>
            <span className="text-[10px] text-fg-tertiary ml-auto">{traces.length} slow traces</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.slowTraces')}</p>
              <p className="text-lg font-bold font-mono text-accent-warning">{traces.length}</p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.avgDuration')}</p>
              <p className="text-lg font-bold font-mono text-fg-primary">
                {traces.length > 0
                  ? (traces.reduce((s, t) => s + num(t.duration_us), 0) / traces.length / 1000).toFixed(0) + 'ms'
                  : '—'}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.maxDuration')}</p>
              <p className="text-lg font-bold font-mono text-fg-primary">
                {traces.length > 0
                  ? (Math.max(...traces.map(t => num(t.duration_us))) / 1000).toFixed(0) + 'ms'
                  : '—'}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">Services</p>
              <p className="text-lg font-bold font-mono text-fg-primary">{stats.serviceCount}</p>
            </div>
          </div>
          <div className="mt-3 p-2.5 bg-bg-elevated rounded-lg text-[11px] text-fg-secondary flex items-start gap-2">
            <span className="text-accent-warning shrink-0 mt-0.5">💡</span>
            <span>Click the <strong className="text-accent-primary">slowest trace</strong> above to open the Waterfall view.
            {t('apm.bottleneckHint')}</span>
          </div>
        </div>
      )}

      {/* ── Service Overview Mini-Panel ── */}
      {hasService && serviceName && (
        <div className="bg-accent-primary/3 border border-accent-primary/15 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-accent-primary" />
            <h3 className="text-sm font-semibold text-fg-primary">Service: <span className="font-mono text-accent-primary">{serviceName}</span></h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">Traces</p>
              <p className="text-lg font-bold font-mono text-fg-primary">{traces.length}</p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">Error Rate</p>
              <p className="text-lg font-bold font-mono text-accent-danger">
                {traces.length > 0
                  ? ((traces.filter(t => t.status === 'error').length / traces.length) * 100).toFixed(1) + '%'
                  : '0%'}
              </p>
            </div>
            <div className="bg-bg-elevated rounded-lg px-3 py-2">
              <p className="text-[10px] text-fg-tertiary uppercase">{t('apm.avgDuration')}</p>
              <p className="text-lg font-bold font-mono text-fg-primary">
                {traces.length > 0
                  ? (traces.reduce((s, t) => s + num(t.duration_us), 0) / traces.length / 1000).toFixed(0) + 'ms'
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Services (always visible as context) ── */}
      {!hasError && !hasSlow && !hasService && stats.services.length > 0 && (
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">{t('apm.topServicesTitle')}</h3>
            <span className="text-[10px] text-fg-tertiary font-mono">{stats.serviceCount} {t('apm.services')}</span>
          </div>
          <div className="flex items-end gap-2 h-16">
            {stats.services.slice(0, 8).map((svc, i) => {
              const maxCount = stats.services[0]?.count || 1;
              const pct = (svc.count / maxCount) * 100;
              const hasErr = svc.errors > 0;
              return (
                <div key={svc.name} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[10px] font-mono tabular-nums text-fg-tertiary">{svc.count}</span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(pct * 0.48, 4)}px`,
                      backgroundColor: hasErr ? 'var(--accent-danger)' : 'var(--accent-primary)',
                      opacity: 0.5 + (1 - i / stats.services.length) * 0.5,
                    }}
                  />
                  <span className="text-[8px] text-fg-tertiary truncate max-w-full" title={svc.name}>
                    {svc.name.length > 10 ? svc.name.slice(0, 9) + '…' : svc.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
