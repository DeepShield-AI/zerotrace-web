import MiniSparkline from './MiniSparkline';

export default function StatCard({ label, value, sub, color = 'var(--accent-primary)', sparkline }: {
  label: string; value: string; sub?: string; color?: string; sparkline?: number[];
}) {
  return (
    <div className="bg-bg-elevated rounded-lg px-4 py-3.5 hover:bg-bg-subtle/50 transition-colors">
      {/* Accent bar — Datadog style left color indicator */}
      <div className="flex items-start gap-3">
        <span className="mt-1 w-0.5 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-fg-tertiary font-semibold uppercase tracking-wider mb-1">{label}</p>
          <div className="flex items-end justify-between gap-2">
            <p className="text-xl font-bold text-fg-primary font-mono tracking-tight leading-none">
              {value}
            </p>
            {sparkline && sparkline.length >= 2 && (
              <MiniSparkline data={sparkline} color={color} />
            )}
          </div>
          {sub && <p className="text-[10px] text-fg-tertiary mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
