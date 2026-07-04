import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function formatCurrency(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return '$' + n.toFixed(2);
}
function fmtNum(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/* ── KPI Card ── */
export function BillingKPI({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: 'green' | 'amber' | 'default';
}) {
  const colors: Record<string, string> = {
    green: 'border-emerald-200 bg-[#e8f5e9]/50',
    amber: 'border-[#ffcc80] bg-[#fff3e0]/50',
    default: 'border-border bg-bg-elevated',
  };
  return (
    <div className={`rounded-lg border p-5 ${colors[accent || 'default']}`}>
      <p className="text-xs text-fg-tertiary font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent === 'green' ? 'text-accent-success' : accent === 'amber' ? 'text-accent-warning' : 'text-fg-primary'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-fg-tertiary mt-1">{sub}</p>}
    </div>
  );
}

/* ── Usage Progress Bar ── */
export function UsageBar({ used, total, overage }: { used: number; total: number; overage?: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const over = overage && overage > 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-accent-warning-bg/0' : pct > 90 ? 'bg-severity-warn' : 'bg-accent-primary'}`}
          style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-mono font-medium shrink-0 ${over ? 'text-accent-warning' : 'text-fg-tertiary'}`}>
        {over ? `${Math.round(pct)}%` : `${fmtNum(used)}/${fmtNum(total)}`}
      </span>
    </div>
  );
}

/* ── Product Usage Row ── */
export interface ProductUsageRowData {
  product_key: string;
  product_name: string;
  billing_dimension: string;
  unit: string;
  committed_quantity: string;
  committed_unit_price: string;
  committed_total: string;
  on_demand_quantity: string;
  on_demand_unit_price: string;
  on_demand_total: string;
  line_total: string;
  usage_total: string;
  allotments: ProductAllotmentData[];
  is_addon: boolean;
  parent_product_key: string | null;
}

export interface ProductAllotmentData {
  product_key: string;
  free_quantity: string;
  used_quantity: string;
}

export function ProductUsageRow({ row }: { row: ProductUsageRowData }) {
  const { t } = useTranslation();
  const hasCommitment = parseFloat(row.committed_quantity) > 0;
  const hasOverage = parseFloat(row.on_demand_quantity) > 0;
  const used = parseFloat(row.usage_total);
  const total = parseFloat(row.committed_quantity);

  return (
    <div className="rounded-lg border border-border/60 bg-bg-elevated p-5 hover:border-border transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-fg-primary text-sm">{row.product_name}</span>
          <span className="text-xs text-fg-tertiary bg-bg-muted rounded-lg px-2 py-0.5 font-mono">{row.product_key}</span>
          {row.is_addon && <span className="text-xs text-accent-info bg-accent-info-bg rounded-lg px-2 py-0.5">{t('billing.addon')}</span>}
          {row.parent_product_key && <span className="text-xs text-fg-tertiary">· requires {row.parent_product_key}</span>}
        </div>
        <span className="text-lg font-bold text-fg-primary">{formatCurrency(row.line_total)}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-3">
        {/* Committed */}
        <div className="bg-bg-subtle rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-tertiary">{t('billing.commitment')}</span>
            <span className="text-sm font-semibold text-fg-secondary">{formatCurrency(row.committed_total)}</span>
          </div>
          {hasCommitment ? (
            <p className="text-xs text-fg-tertiary mt-1">
              {fmtNum(row.committed_quantity)} {row.unit} @ {formatCurrency(row.committed_unit_price)}/{row.unit}
            </p>
          ) : (
            <p className="text-xs text-fg-tertiary mt-1">{t('billing.noCommitment')}</p>
          )}
        </div>
        {/* On-Demand */}
        <div className={`rounded-lg p-3 ${hasOverage ? 'bg-accent-warning-bg' : 'bg-bg-subtle'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-tertiary">{t('billing.onDemand')}</span>
            <span className={`text-sm font-semibold ${hasOverage ? 'text-accent-warning' : 'text-fg-tertiary'}`}>
              {formatCurrency(row.on_demand_total)}
            </span>
          </div>
          {hasOverage ? (
            <p className="text-xs text-accent-warning mt-1">
              +{fmtNum(row.on_demand_quantity)} {row.unit} @ {formatCurrency(row.on_demand_unit_price)}/{row.unit}
            </p>
          ) : (
            <p className="text-xs text-fg-tertiary mt-1">{t('billing.withinCommitment')}</p>
          )}
        </div>
        {/* Usage */}
        <div className="bg-bg-subtle rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-fg-tertiary">{t('billing.usage')}</span>
            <span className="text-sm font-semibold text-fg-secondary">{fmtNum(row.usage_total)} {row.unit}</span>
          </div>
          <div className="mt-2">
            <UsageBar used={used} total={total} overage={hasOverage ? 1 : 0} />
          </div>
        </div>
      </div>

      {/* Allotments */}
      {row.allotments.length > 0 && (
        <div className="border-t border-border-subtle pt-3 mt-2">
          <p className="text-xs font-medium text-fg-tertiary mb-2">{t('billing.includedAllotments')}</p>
          <div className="grid grid-cols-2 gap-2">
            {row.allotments.map((a) => {
              const freeNum = parseFloat(a.free_quantity);
              const usedNum = parseFloat(a.used_quantity);
              const over = usedNum > freeNum;
              return (
                <div key={a.product_key} className={`rounded-lg p-2 ${over ? 'bg-[#fff3e0] border border-[#ffe0b2]' : 'bg-[#e8f5e9]/30'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fg-secondary">{a.product_key.replace(/_/g, ' ')}</span>
                    <span className={`text-xs font-medium ${over ? 'text-[#e67e22]' : 'text-[#28a745]'}`}>
                      {over ? `${fmtNum(usedNum - freeNum)} ${t('billing.over')}` : t('billing.free')}
                    </span>
                  </div>
                  <div className="mt-1">
                    <UsageBar used={usedNum} total={freeNum} overage={over ? 1 : 0} />
                  </div>
                  <p className="text-xs text-fg-tertiary mt-1">{fmtNum(freeNum)} {t('billing.included')} · {fmtNum(usedNum)} {t('billing.used')}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Product Family Section ── */
export function ProductFamilySection({ title, children, defaultOpen }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="mb-2">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-2 group">
        <svg className={`w-4 h-4 text-fg-tertiary transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-sm font-semibold text-fg-secondary group-hover:text-fg-primary">{title}</span>
      </button>
      {open && <div className="space-y-2 ml-6">{children}</div>}
    </div>
  );
}

