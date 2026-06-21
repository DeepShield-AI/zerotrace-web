import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TopEndpoint, TopTalker } from '../api/types';
import { fmtN, fmtLatency } from '../utils/format';

/* ── Types ── */

interface TopEndpointsProps {
  l7Endpoints: TopEndpoint[];
  l4Talkers: TopTalker[];
  loading: boolean;
}

/* ── Rank badge ── */

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold ${
      rank === 1 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
      rank === 2 ? 'bg-zinc-100 text-zinc-600 border border-zinc-200' :
      rank === 3 ? 'bg-orange-50 text-orange-600 border border-orange-100' :
      'text-zinc-400'
    }`}>
      {rank}
    </span>
  );
}

/* ── Background bar (relative value) ── */

function RowBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      className="absolute inset-y-0.5 left-0 rounded-r transition-all"
      style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.06 }}
    />
  );
}

/* ── Empty state ── */

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center mb-3 border border-zinc-100">
        <svg className="w-6 h-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}

/* ── TopEndpoints ── */

export default function TopEndpoints({ l7Endpoints, l4Talkers, loading }: TopEndpointsProps) {
  const { t } = useTranslation();
  const [showMoreL7, setShowMoreL7] = useState(false);
  const [showMoreL4, setShowMoreL4] = useState(false);

  const defaultLimit = 5;

  const maxL7 = useMemo(() => Math.max(...l7Endpoints.map(r => r.cnt), 1), [l7Endpoints]);
  const maxL4 = useMemo(() => Math.max(...l4Talkers.map(r => r.cnt), 1), [l4Talkers]);

  const l7Visible = showMoreL7 ? l7Endpoints : l7Endpoints.slice(0, defaultLimit);
  const l4Visible = showMoreL4 ? l4Talkers : l4Talkers.slice(0, defaultLimit);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
              <div className="skeleton h-4 w-32 rounded" />
            </div>
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="skeleton h-9 w-full rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Top L7 Endpoints ── */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden card-hover">
        <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Top L7 Endpoints</h4>
            <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-200/60 px-1.5 py-0.5 rounded-full">{l7Endpoints.length}</span>
          </div>
        </div>

        {l7Endpoints.length === 0 ? (
          <EmptyState label={t('common.noData')} />
        ) : (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span className="w-6 shrink-0">#</span>
              <span className="flex-1">Endpoint</span>
              <span className="w-16 text-right">Latency</span>
              <span className="w-16 text-right">Count</span>
              <span className="w-10 text-right">%</span>
            </div>
            {l7Visible.map((r, i) => (
              <div
                key={i}
                className="relative flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-default group border-b border-zinc-50 last:border-0"
              >
                <RowBar value={r.cnt} max={maxL7} color="#632CA6" />
                <RankBadge rank={i + 1} />
                <code className="relative z-10 flex-1 text-[13px] text-zinc-700 truncate group-hover:text-zinc-900 transition-colors font-medium">
                  {r.name || '(root)'}
                </code>
                <span className="relative z-10 w-16 text-right text-[11px] text-zinc-400 font-mono tabular-nums">
                  {r.avg_latency != null && r.avg_latency > 0 ? fmtLatency(r.avg_latency) : '--'}
                </span>
                <span className="relative z-10 w-16 text-right text-[13px] text-zinc-600 font-semibold font-mono tabular-nums">
                  {fmtN(r.cnt)}
                </span>
                <span className="relative z-10 w-10 text-right text-[10px] text-zinc-400 font-mono tabular-nums">
                  {maxL7 > 0 ? Math.round((r.cnt / maxL7) * 100) : 0}%
                </span>
              </div>
            ))}

            {l7Endpoints.length > defaultLimit && (
              <button
                onClick={() => setShowMoreL7(!showMoreL7)}
                className="w-full px-4 py-2.5 text-[11px] text-[#632CA6] hover:text-[#4a1f8c] hover:bg-[#F3F0FA]/40 transition-colors text-center font-medium border-t border-zinc-100"
              >
                {showMoreL7 ? t('common.collapse') : `Show all ${l7Endpoints.length}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Top L4 Talkers ── */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden card-hover">
        <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Top L4 Talkers</h4>
            <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-200/60 px-1.5 py-0.5 rounded-full">{l4Talkers.length}</span>
          </div>
        </div>

        {l4Talkers.length === 0 ? (
          <EmptyState label={t('common.noData')} />
        ) : (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              <span className="w-6 shrink-0">#</span>
              <span className="flex-1">Source → Dest</span>
              <span className="w-16 text-right">Count</span>
              <span className="w-10 text-right">%</span>
            </div>
            {l4Visible.map((r, i) => (
              <div
                key={i}
                className="relative flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-default group border-b border-zinc-50 last:border-0"
              >
                <RowBar value={r.cnt} max={maxL4} color="#4799EB" />
                <RankBadge rank={i + 1} />
                <div className="relative z-10 flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="text-[13px] text-zinc-700 font-mono font-medium truncate max-w-[80px] group-hover:text-zinc-900">
                    {r.src}
                  </span>
                  <span className="text-zinc-300 shrink-0 text-[10px]">→</span>
                  <span className="text-[13px] text-zinc-700 font-mono font-medium truncate max-w-[80px] group-hover:text-zinc-900">
                    {r.dst}
                  </span>
                </div>
                <span className="relative z-10 w-16 text-right text-[13px] text-zinc-600 font-semibold font-mono tabular-nums shrink-0">
                  {fmtN(r.cnt)}
                </span>
                <span className="relative z-10 w-10 text-right text-[10px] text-zinc-400 font-mono tabular-nums shrink-0">
                  {maxL4 > 0 ? Math.round((r.cnt / maxL4) * 100) : 0}%
                </span>
              </div>
            ))}

            {l4Talkers.length > defaultLimit && (
              <button
                onClick={() => setShowMoreL4(!showMoreL4)}
                className="w-full px-4 py-2.5 text-[11px] text-[#632CA6] hover:text-[#4a1f8c] hover:bg-[#F3F0FA]/40 transition-colors text-center font-medium border-t border-zinc-100"
              >
                {showMoreL4 ? t('common.collapse') : `Show all ${l4Talkers.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
