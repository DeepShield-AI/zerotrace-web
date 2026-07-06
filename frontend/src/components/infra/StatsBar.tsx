import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FlowRatePoint, L4BandwidthPoint, L7RatePoint } from '../../api/types';
import { fmtN, fmtB } from '../../utils/format';

/* ── Types ── */

export interface StatsBarData {
  l4: { cnt: number; tx: number; rx: number };
  l7: { cnt: number };
  flowRate: FlowRatePoint[];
  l4Bandwidth: L4BandwidthPoint[];
  l7Rate: L7RatePoint[];
}

interface StatsBarProps {
  stats: StatsBarData;
  loading: boolean;
}

/* ── Sparkline ── */

function Sparkline({ data, color, width = 80, height = 30 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  const pathData = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * (width - 4);
      const y = height - 4 - ((v - min) / range) * (height - 8) - 2;
      return [x, y];
    });

    const linePath = `M ${pts.map(p => p.join(',')).join(' L ')}`;
    const areaPath = `M ${pts[0][0]},${height} L ${pts.map(p => p.join(',')).join(' L ')} L ${pts[pts.length - 1][0]},${height} Z`;

    return { linePath, areaPath };
  }, [data, width, height]);

  if (!pathData) return <div className={`w-[${width}px] h-[${height}px]`} />;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathData.areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={pathData.linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Stat Card ── */

function StatCard({
  label,
  value,
  unit,
  sub,
  sparklineData,
  color = '#632CA6',
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  sparklineData?: number[];
  color?: string;
}) {
  return (
    <div className="relative bg-bg-elevated rounded-lg border border-border p-4 hover:shadow-sm transition-shadow cursor-pointer group">
      {/* Top label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider">{label}</span>
      </div>

      {/* Value + sparkline row */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold text-fg-primary tracking-tight font-mono leading-none">
            {value}
          </span>
          {unit && <span className="text-[11px] font-semibold text-fg-tertiary">{unit}</span>}
        </div>

        {sparklineData && sparklineData.length >= 2 && (
          <div className="shrink-0">
            <Sparkline data={sparklineData} color={color} width={80} height={30} />
          </div>
        )}
      </div>

      {/* Sub info */}
      {sub && (
        <p className="text-[11px] text-fg-tertiary mt-2 leading-tight">{sub}</p>
      )}
    </div>
  );
}

/* ── Skeleton ── */

function SkeletonCard() {
  return (
    <div className="bg-bg-elevated rounded-lg border border-border p-4">
      <div className="skeleton h-3 w-20 mb-3 rounded" />
      <div className="flex items-end justify-between">
        <div className="skeleton h-8 w-28 rounded" />
        <div className="skeleton h-8 w-20 rounded" />
      </div>
    </div>
  );
}

/* ── StatsBar ── */

export default function StatsBar({ stats, loading }: StatsBarProps) {
  const { t } = useTranslation();
  const { l4, l7, flowRate, l4Bandwidth, l7Rate } = stats;

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  // Sparkline data (last 30 points) — ClickHouse returns strings, must coerce
  const flowSparkline = flowRate?.slice(-30).map(p => Number(p.cnt || 0)) || [];
  const bwSparkline = l4Bandwidth?.slice(-30).map(p => Number(p.tx || 0) + Number(p.rx || 0)) || [];
  const l7Sparkline = l7Rate?.slice(-30).map(p => Number(p.cnt || 0)) || [];

  const lastBw = l4Bandwidth.length > 0
    ? Number(l4Bandwidth[l4Bandwidth.length - 1].tx || 0) + Number(l4Bandwidth[l4Bandwidth.length - 1].rx || 0)
    : 0;
  const lastL7 = l7Rate.length > 0 ? Number(l7Rate[l7Rate.length - 1].cnt || 0) : 0;
  const lastFlow = flowRate.length > 0 ? Number(flowRate[flowRate.length - 1].cnt || 0) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <StatCard
        label={t('statsBar.l4Bandwidth')}
        value={fmtB(lastBw)}
        unit="/s"
        sub={t('statsBar.l4BandwidthSub', { total: fmtB(Number(l4.tx || 0) + Number(l4.rx || 0)) })}
        sparklineData={bwSparkline}
        color="#2DB88D"
      />

      <StatCard
        label={t('statsBar.l7Requests')}
        value={fmtN(lastL7)}
        unit="/min"
        sub={t('statsBar.l7RequestsSub', { total: fmtN(l7.cnt) })}
        sparklineData={l7Sparkline}
        color="#E2903C"
      />

      <StatCard
        label={t('statsBar.l4Flows')}
        value={fmtN(l4.cnt)}
        sub={t('statsBar.l4FlowsSub', { tx: fmtB(l4.tx), rx: fmtB(l4.rx) })}
        sparklineData={flowSparkline}
        color="#4799EB"
      />

      <StatCard
        label={t('statsBar.flowRate')}
        value={fmtN(lastFlow)}
        unit="/min"
        sub={t('statsBar.flowRateSub')}
        sparklineData={flowSparkline}
        color="#632CA6"
      />
    </div>
  );
}
