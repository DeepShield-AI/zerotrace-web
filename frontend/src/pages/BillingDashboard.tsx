import { useEffect, useState, useCallback, useMemo } from 'react';
import { Spin, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { BillingKPI, UsageBar, ProductUsageRow, ProductFamilySection } from './BillingComponents';
import type { ProductUsageRowData } from './BillingComponents';
import { useAuth } from '../hooks/useAuth';

interface BillingSummary {
  org_id: number;
  period_start: string;
  period_end: string;
  committed_monthly_spend: string;
  on_demand_spend: string;
  projected_total: string;
  currency: string;
  subscriptions: any[];
  products: ProductUsageRowData[];
  invoices: InvoiceSummary[];
}

interface InvoiceSummary {
  id: number;
  period_start: string;
  period_end: string;
  subtotal: string;
  discount: string;
  total: string;
  currency: string;
  status: string;
  issued_at: string | null;
}

interface LineItem {
  id: number;
  product_key: string;
  description: string;
  commitment_quantity: string;
  commitment_unit_price: string;
  commitment_total: string;
  overage_quantity: string;
  overage_unit_price: string;
  overage_total: string;
  line_total: string;
}

function formatCurrency(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return '$' + n.toFixed(2);
}

function fmtShort(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

/* ── Main Dashboard ── */
export default function BillingDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<LineItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.getBillingSummary() as BillingSummary;
      setSummary(s);
    } catch (e: any) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleInvoice = async (id: number) => {
    if (expandedInvoice === id) { setExpandedInvoice(null); setInvoiceLines([]); return; }
    setExpandedInvoice(id); setDetailLoading(true);
    try { const d = await api.getBillingInvoiceDetail(id); setInvoiceLines(d.line_items || []); }
    catch (e: any) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  // Categorize products
  const families = useMemo(() => {
    if (!summary) return {};
    const f: Record<string, ProductUsageRowData[]> = {
      [t('billing.familyInfra')]: [],
      [t('billing.familyAPM')]: [],
      [t('billing.familyLogs')]: [],
      [t('billing.familyOther')]: [],
    };
    for (const p of summary.products) {
      const key = p.product_key;
      if (key.startsWith('infra') || key === 'containers' || key === 'custom_metrics') f[t('billing.familyInfra')].push(p);
      else if (key.startsWith('apm')) f[t('billing.familyAPM')].push(p);
      else if (key.startsWith('log')) f[t('billing.familyLogs')].push(p);
      else f[t('billing.familyOther')].push(p);
    }
    // Remove empty families
    for (const k of Object.keys(f)) { if (f[k].length === 0) delete f[k]; }
    return f;
  }, [summary, t]);

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const committed = parseFloat(summary?.committed_monthly_spend || '0');
  const onDemand = parseFloat(summary?.on_demand_spend || '0');
  const projected = parseFloat(summary?.projected_total || '0');
  const totalUsed = committed + onDemand > 0 ? (onDemand / (committed + onDemand)) * 100 : 0;

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{t('billing.title')}</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {summary?.period_start} — {summary?.period_end}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {summary?.subscriptions.length === 0 && (
            <a href="/org/billing/plans" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
              {t('billing.addSubscription')} →
            </a>
          )}
        </div>
      </div>

      {/* No subscriptions state */}
      {summary && summary.subscriptions.length === 0 ? (
        <div className="bento-card text-center py-16">
          <div className="w-16 h-16 rounded-lg bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-violet-500" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-800 mb-2">{t('billing.noActiveSubscriptions')}</h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">{t('billing.noSubscriptionsDesc')}</p>
          <a href="/org/billing/plans"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
            {t('billing.browsePlans')}
          </a>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <BillingKPI label={t('billing.committedMonthly')}
              value={formatCurrency(summary?.committed_monthly_spend || '0')}
              sub={summary ? `${summary.subscriptions.length} ${t('billing.activeSubscriptions')}` : ''} />
            <BillingKPI label={t('billing.onDemandUsage')}
              value={formatCurrency(summary?.on_demand_spend || '0')}
              accent={onDemand > 0 ? 'amber' : 'default'}
              sub={onDemand > 0 ? t('billing.aboveCommitment') : t('billing.withinCommitment')} />
            <BillingKPI label={t('billing.projectedTotal')}
              value={formatCurrency(summary?.projected_total || '0')}
              accent="green"
              sub={t('billing.currentMonth')} />
          </div>

          {/* Committed vs On-Demand bar */}
          {committed + onDemand > 0 && (
            <div className="bento-card mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-700">{t('billing.commitmentBreakdown')}</span>
                <span className="text-xs text-zinc-400">
                  {fmtShort(committed)} {t('billing.committed')} · {fmtShort(onDemand)} {t('billing.onDemand')}
                </span>
              </div>
              <div className="h-3 bg-zinc-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-violet-500 rounded-l-full transition-all" style={{ width: `${100 - totalUsed}%` }} />
                <div className="h-full bg-amber-400 rounded-r-full transition-all" style={{ width: `${totalUsed}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-violet-600 font-medium">{Math.round(100 - totalUsed)}% {t('billing.committed')}</span>
                <span className="text-xs text-[#e67e22] font-medium">{Math.round(totalUsed)}% {t('billing.onDemand')}</span>
              </div>
            </div>
          )}

          {/* Product Usage by Family */}
          <div className="mb-8">
            <h3 className="text-base font-semibold text-zinc-900 mb-4">{t('billing.usageByProduct')}</h3>
            {Object.entries(families).map(([family, rows]) => (
              <ProductFamilySection key={family} title={family} defaultOpen={true}>
                {rows.map((row) => (
                  <ProductUsageRow key={row.product_key} row={row} />
                ))}
              </ProductFamilySection>
            ))}
          </div>

          {/* Billing History */}
          {summary && summary.invoices.length > 0 && (
            <div className="mb-8">
              <h3 className="text-base font-semibold text-zinc-900 mb-4">{t('billing.invoicesTitle')}</h3>
              <div className="space-y-2">
                {summary.invoices.map((inv) => (
                  <div key={inv.id} className="bento-card">
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleInvoice(inv.id)}>
                      <div className="flex items-center gap-4">
                        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${expandedInvoice === inv.id ? 'rotate-90' : ''}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{inv.period_start} — {inv.period_end}</p>
                          <p className="text-xs text-zinc-400">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : t('billing.draft')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Tag color={inv.status === 'paid' ? 'green' : inv.status === 'open' ? 'blue' : 'default'}>{inv.status}</Tag>
                        <span className="text-sm font-bold text-zinc-900">{formatCurrency(inv.total)}</span>
                      </div>
                    </div>
                    {expandedInvoice === inv.id && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        {detailLoading ? <Spin size="small" /> : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-zinc-400 uppercase border-b border-zinc-100">
                                <th className="text-left pb-2 font-medium">{t('billing.product')}</th>
                                <th className="text-right pb-2 font-medium">{t('billing.commitment')}</th>
                                <th className="text-right pb-2 font-medium">{t('billing.overage')}</th>
                                <th className="text-right pb-2 font-medium">{t('billing.lineTotal')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoiceLines.map((li) => (
                                <tr key={li.id} className="border-b border-zinc-50">
                                  <td className="py-2">
                                    <p className="text-zinc-800 font-medium text-xs">{li.product_key.replace(/_/g, ' ')}</p>
                                    <p className="text-zinc-400 text-xs">{li.description}</p>
                                  </td>
                                  <td className="py-2 text-right text-xs text-zinc-600">{formatCurrency(li.commitment_total)}</td>
                                  <td className="py-2 text-right text-xs text-[#e67e22]">{formatCurrency(li.overage_total)}</td>
                                  <td className="py-2 text-right text-xs font-semibold text-zinc-800">{formatCurrency(li.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={3} className="pt-3 text-right text-xs font-medium text-zinc-600">{t('billing.subtotal')}</td>
                                <td className="pt-3 text-right text-xs font-bold text-zinc-900">{formatCurrency(inv.subtotal)}</td>
                              </tr>
                              {parseFloat(inv.discount) > 0 && (
                                <tr>
                                  <td colSpan={3} className="text-right text-xs text-zinc-500">{t('billing.discount')}</td>
                                  <td className="text-right text-xs text-[#28a745]">-{formatCurrency(inv.discount)}</td>
                                </tr>
                              )}
                              <tr>
                                <td colSpan={3} className="pt-1 text-right text-sm font-semibold text-zinc-900">{t('billing.total')}</td>
                                <td className="pt-1 text-right text-sm font-bold text-zinc-900">{formatCurrency(inv.total)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
