import MiniSparkline from './MiniSparkline';

/* ── KPI Stat Card ── */

export default function StatCard({ label, value, sub, color = '#632CA6', sparkline }: {
  label: string; value: string; sub?: string; color?: string; sparkline?: number[];
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded-lg p-4 hover:shadow-sm transition-shadow group cursor-pointer">
      <p className="text-[11px] text-fg-tertiary font-medium uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-fg-primary font-mono tracking-tight" style={{ color }}>
          {value}
        </p>
        {sparkline && sparkline.length >= 2 && (
          <MiniSparkline data={sparkline} color={color} />
        )}
      </div>
      {sub && <p className="text-[11px] text-fg-tertiary mt-1">{sub}</p>}
    </div>
  );
}
