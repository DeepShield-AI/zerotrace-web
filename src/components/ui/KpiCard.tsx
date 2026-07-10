import type { ReactNode } from 'react';

export function KpiCard({ label, value, subtitle, accent = 'default', icon }: {
  label: string; value: string; subtitle?: string;
  accent?: 'purple' | 'amber' | 'green' | 'red' | 'blue' | 'default';
  icon?: ReactNode;
}) {
  const colors: Record<string, { border: string; bg: string; value: string }> = {
    purple: { border: 'border-l-accent-primary', bg: 'bg-accent-primary/10', value: 'text-accent-primary' },
    amber: { border: 'border-l-amber-400', bg: 'bg-accent-warning-bg', value: 'text-accent-warning' },
    green: { border: 'border-l-emerald-500', bg: 'bg-accent-success-bg', value: 'text-accent-success' },
    red: { border: 'border-l-red-400', bg: 'bg-accent-danger-bg', value: 'text-accent-danger' },
    blue: { border: 'border-l-blue-500', bg: 'bg-accent-info-bg', value: 'text-accent-info' },
    default: { border: 'border-l-border', bg: 'bg-bg-elevated', value: 'text-fg-primary' },
  };
  const c = colors[accent];
  return (
    <div className={`rounded-lg border border-border border-l-4 ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      {subtitle && <p className="text-xs text-fg-tertiary mt-1">{subtitle}</p>}
    </div>
  );
}
