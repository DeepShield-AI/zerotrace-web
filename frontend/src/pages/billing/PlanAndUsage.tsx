import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../../api/client';
import { KpiCard, StatusBadge, DataTable, Spinner as SharedSpinner } from '../../components/Components';

// ── Types ──
interface Plan { id: number; product_key: string; name: string; description: string; billing_dimension: string; aggregation_method: string; unit_price_monthly: number; unit_price_annual: number; is_addon: boolean; parent_product_key: string | null; }
interface Subscription { id: number; plan_id: number; commitment_type: string; committed_quantity: number; unit_price: number; status: string; }
interface InvoiceData { id: number; period_start: string; period_end: string; subtotal: number; discount: number; total: number; status: string; issued_at: string | null; }
interface EstimatedCost { estimated_total: number; breakdown: { product_key: string; estimated_cost: number; usage_total: number }[]; }
interface ProductUsageRow { product_key: string; product_name: string; line_total: number; committed_total: number; on_demand_total: number; usage_total: number; }
interface BillingSummary { committed_monthly_spend: number; on_demand_spend: number; projected_total: number; products: ProductUsageRow[]; invoices: InvoiceData[]; }

// ── Helpers ──
const fmt = (n?: number | string) => { const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0); return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
const fmtShort = (n?: number | string): string => { const v = typeof n === 'string' ? parseFloat(n) : n; if (!v) return '0'; if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`; if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`; return v.toFixed(1); };
const fmtNum = (n?: number) => n != null ? n.toLocaleString() : '0';

const FAMILIES: Record<string, { label: string; order: number }> = {
  infra: { label: 'Infrastructure', order: 1 }, apm: { label: 'APM', order: 2 }, log: { label: 'Log Management', order: 3 },
  dbm: { label: 'Database Monitoring', order: 4 }, rum: { label: 'Real User Monitoring', order: 5 },
  synthetic: { label: 'Synthetic Monitoring', order: 6 }, container: { label: 'Containers', order: 7 },
  security: { label: 'Security', order: 8 }, custom_metric: { label: 'Custom Metrics', order: 9 },
  network: { label: 'Network', order: 10 }, profiler: { label: 'Profiler', order: 11 }, serverless: { label: 'Serverless', order: 12 },
};
const familyOf = (key: string) => { for (const [p, f] of Object.entries(FAMILIES)) if (key.startsWith(p)) return f.label; return 'Other'; };

/* Using shared KpiCard, StatusBadge, Spinner from ../components/Components */

// ═══════════════════════ BILLING LAYOUT ═══════════════════════
export function BillingLayout() {
  const tabs = [
    { to: '/org/billing', label: 'Overview', end: true },
    { to: '/org/billing/plan', label: 'Plan', end: false },
    { to: '/org/billing/history', label: 'Billing History', end: false },
  ];
  return (
    <div className="animate-fade-in">
      <div className="mb-6"><h2 className="text-xl font-bold text-fg-primary">Plan &amp; Usage</h2><p className="text-sm text-fg-tertiary mt-0.5">Manage your subscriptions, monitor usage, and view billing history</p></div>
      <nav className="flex gap-1 mb-8 border-b border-border">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `px-5 py-3 text-sm font-medium border-b-[2px] -mb-[2px] transition-colors ${isActive ? 'text-accent-info border-accent-info' : 'text-fg-tertiary border-transparent hover:text-fg-secondary'}`}>{t.label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

// ═══════════════════════ OVERVIEW ═══════════════════════
export function BillingOverview() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [estCost, setEstCost] = useState<EstimatedCost | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all([api.getBillingSummary().catch(() => null), api.getBillingEstimatedCost().catch(() => null)]).then(([s, e]) => { setSummary(s as any); setEstCost(e as any); setLoading(false); }); }, []);
  const families = useMemo(() => {
    if (!summary?.products) return [];
    const m: Record<string, ProductUsageRow[]> = {};
    summary.products.forEach(p => { const f = familyOf(p.product_key); if (!m[f]) m[f] = []; m[f].push(p); });
    return Object.entries(m).sort((a, b) => (Object.values(FAMILIES).find(x => x.label === a[0])?.order ?? 99) - (Object.values(FAMILIES).find(x => x.label === b[0])?.order ?? 99));
  }, [summary]);
  if (loading) return <SharedSpinner />;
  return (
    <div className="space-y-6">
      {/* Filter bar — Zerotrace exact: Product Category + Billing Dimension dropdowns */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-fg-primary">Product Category</span>
          <select className="h-8 px-3 text-[13px] border border-border rounded bg-bg-elevated text-fg-secondary focus:outline-none focus:border-accent-info">
            <option>All</option>
            {Object.values(FAMILIES).map(f => <option key={f.label}>{f.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-fg-primary">Billing Dimension</span>
          <select className="h-8 px-3 text-[13px] border border-border rounded bg-bg-elevated text-fg-secondary focus:outline-none focus:border-accent-info">
            <option>All</option>
            <option>Host</option><option>Container</option><option>Custom Metric</option>
            <option>Log Ingestion</option><option>Indexed Span</option>
          </select>
        </div>
      </div>

      {/* KPI Cards — DD style: white cards, 8px radius, 1px #dee2e6 border, no shadow */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-elevated border border-border rounded-lg p-5">
          <p className="text-[13px] text-fg-tertiary mb-1">Estimated MTD Cost</p>
          <p className="text-2xl font-bold text-fg-primary">{fmt(estCost?.estimated_total)}</p>
          <p className="text-xs text-fg-tertiary mt-1">Month-to-date estimated cost</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-5">
          <p className="text-[13px] text-fg-tertiary mb-1">Committed Spend</p>
          <p className="text-2xl font-bold text-fg-primary">{fmt(summary?.committed_monthly_spend)}</p>
          <p className="text-xs text-fg-tertiary mt-1">Recurring monthly commitment</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-5">
          <p className="text-[13px] text-fg-tertiary mb-1">On-Demand Usage</p>
          <p className={`text-2xl font-bold ${(summary?.on_demand_spend ?? 0) > 0 ? 'text-accent-warning' : 'text-fg-primary'}`}>{fmt(summary?.on_demand_spend)}</p>
          <p className="text-xs text-fg-tertiary mt-1">Overage &amp; usage-based charges</p>
        </div>
      </div>

      {/* Usage Table — Zerotrace: grouped by product family, clean white */}
      {families.length === 0 ? (
        <div className="bg-bg-elevated border border-border rounded-lg py-20 text-center">
          <svg className="w-12 h-12 text-fg-disabled mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
          <h3 className="text-base font-semibold text-fg-primary mb-1">No usage changes found</h3>
          <p className="text-sm text-fg-tertiary max-w-md mx-auto">Usage data will appear here once products are subscribed and metrics begin flowing.</p>
        </div>
      ) : (
        <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-base font-semibold text-fg-primary">Usage Overview</h3>
            <span className="text-[13px] text-fg-tertiary">Current billing period</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[13px] font-medium text-fg-tertiary">
                  <th className="py-3 px-6">Product</th>
                  <th className="py-3 px-4 text-right">Usage</th>
                  <th className="py-3 px-4 text-right">Committed</th>
                  <th className="py-3 px-4 text-right">On-Demand</th>
                  <th className="py-3 px-6 text-right">Line Total</th>
                </tr>
              </thead>
              {families.map(([family, prods]) => (
                <tbody key={family}>
                  <tr className="bg-bg-subtle">
                    <td colSpan={5} className="py-2.5 px-6 text-[13px] font-semibold text-fg-secondary uppercase">{family}</td>
                  </tr>
                  {prods.map(p => (
                    <tr key={p.product_key} className="border-b border-[#f1f3f5] hover:bg-bg-subtle transition-colors">
                      <td className="py-3 px-6">
                        <span className="font-medium text-fg-primary">{p.product_name || p.product_key}</span>
                        <span className="text-xs text-fg-tertiary ml-2">{p.product_key}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-fg-secondary tabular-nums text-[13px]">{fmtShort(p.usage_total)}</td>
                      <td className="py-3 px-4 text-right text-fg-secondary tabular-nums text-[13px]">{fmt(p.committed_total)}</td>
                      <td className="py-3 px-4 text-right tabular-nums text-[13px]">
                        <span className={p.on_demand_total > 0 ? 'text-accent-warning font-medium' : 'text-fg-tertiary'}>{fmt(p.on_demand_total)}</span>
                      </td>
                      <td className="py-3 px-6 text-right font-semibold text-fg-primary tabular-nums text-[13px]">{fmt(p.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ PLAN (Zerotrace-style) ═══════════════════════
export function BillingPlan() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalPlan, setModalPlan] = useState<Plan | null>(null);
  const [modalEdit, setModalEdit] = useState<Subscription | null>(null);
  const [commitType, setCommitType] = useState<'annual' | 'monthly' | 'on_demand'>('annual');
  const [qty, setQty] = useState(1);
  const [subLoading, setSubLoading] = useState(false);
  // Admin: edit plan pricing
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [editName, setEditName] = useState('');
  const [editMonthly, setEditMonthly] = useState(0);
  const [editAnnual, setEditAnnual] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // Check if current user is super_admin (from users API)
  useEffect(() => {
    api.listUsers().then(d => setIsSuperAdmin(d.current_user_role === 'super_admin')).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([api.getBillingPlans().catch(() => ({ plans: [] })), api.getBillingSubscriptions().catch(() => ({ subscriptions: [] }))]);
    setPlans((p as any)?.plans || []); setSubs((s as any)?.subscriptions || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const activeByPid = useMemo(() => { const m: Record<number, Subscription> = {}; subs.filter(s => s.status === 'active').forEach(s => { m[s.plan_id] = s; }); return m; }, [subs]);

  const [subError, setSubError] = useState('');
  const doAction = async () => { if (!modalPlan) return; setSubLoading(true); setSubError(''); try { if (modalEdit) await api.updateBillingSubscription(modalEdit.id, qty); else await api.createBillingSubscription({ plan_id: modalPlan.id, commitment_type: commitType, committed_quantity: qty }); setModalPlan(null); setModalEdit(null); load(); } catch (err: any) { setSubError(err.message || 'Subscription failed'); } finally { setSubLoading(false); } };
  const doCancel = async (id: number) => { if (confirm('Cancel this subscription?')) { await api.cancelBillingSubscription(id); load(); } };
  const doEditSave = async () => { if (!editPlan) return; setEditSaving(true); try { await api.updateBillingPlan(editPlan.id, { name: editName, unit_price_monthly: editMonthly, unit_price_annual: editAnnual }); setEditPlan(null); load(); } finally { setEditSaving(false); } };
  const basePlans = plans.filter(p => !p.is_addon);
  const addonPlans = plans.filter(p => p.is_addon);
  if (loading) return <SharedSpinner />;

  return (
    <div className="space-y-8">
      {subs.filter(s => s.status === 'active').length > 0 && (
        <div className="bg-bg-elevated border border-accent-success/20 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-fg-primary mb-4">Active Subscriptions</h3>
          <div className="grid grid-cols-2 gap-4">
            {subs.filter(s => s.status === 'active').map(sub => { const plan = plans.find(p => p.id === sub.plan_id); return (
              <div key={sub.id} className="flex items-center justify-between border border-emerald-100 bg-[#e8f5e9]/30 rounded-lg px-4 py-3">
                <div><p className="font-semibold text-fg-primary text-sm">{plan?.name || 'Unknown'}</p><p className="text-xs text-fg-tertiary">{plan?.product_key} · {sub.commitment_type} · Qty: {fmtNum(sub.committed_quantity)}</p></div>
                <div className="flex gap-2"><button onClick={() => { setModalPlan(plan!); setModalEdit(sub); setCommitType(sub.commitment_type as any); setQty(sub.committed_quantity); setSubError(''); }} className="text-xs font-semibold text-accent-info hover:text-[#0056b3]">Modify</button><button onClick={() => doCancel(sub.id)} className="text-xs text-[#dc3545] hover:text-[#dc3545]">Cancel</button></div>
              </div>
            );})}
          </div>
        </div>
      )}

      {/* Products — Zerotrace: "Pricing shown below is based on the annual pro plan offering" */}
      <div>
        <h3 className="text-lg font-semibold text-fg-primary mb-0.5">Products</h3>
        <p className="text-[13px] text-fg-tertiary mb-6">Pricing shown below is based on the annual pro plan offering.</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {basePlans.map(plan => { const active = activeByPid[plan.id]; return (
            <div key={plan.id} className="bg-bg-elevated border-border rounded-lg p-6 flex flex-col">
              <h4 className="text-base font-semibold text-fg-primary">{plan.name}</h4>
              <p className="text-sm text-fg-secondary mt-0.5 mb-5 leading-relaxed">{plan.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-bold text-fg-primary">{fmt(plan.unit_price_annual)}</span>
              </div>
              <p className="text-xs text-fg-tertiary mb-5">per {plan.billing_dimension.replace('per_', '').replace(/_/g, ' ')}, per month</p>
              {isSuperAdmin && (
                <button onClick={() => { setEditPlan(plan); setEditName(plan.name); setEditMonthly(Number(plan.unit_price_monthly)); setEditAnnual(Number(plan.unit_price_annual)); }}
                  className="mb-3 text-[11px] text-fg-tertiary hover:text-accent-info transition-colors text-left">
                  ⚙ Edit pricing
                </button>
              )}
              {active ? (
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-[13px] text-[#28a745] font-medium">Active · {fmt(active.unit_price)}/unit</span>
                  <button onClick={() => { setModalPlan(plan); setModalEdit(active); setCommitType(active.commitment_type as any); setQty(active.committed_quantity); }} className="text-[13px] font-medium text-accent-info hover:text-[#0056b3]">Modify</button>
                </div>
              ) : (
                <button onClick={() => { setModalPlan(plan); setModalEdit(null); setCommitType('annual'); setQty(1); setSubError(''); }} className="mt-auto w-full py-2.5 bg-accent-info text-fg-inverse text-sm font-medium rounded hover:bg-accent-info transition-colors">Select Plan</button>
              )}
            </div>
          );})}
        </div>
      </div>

      {addonPlans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-fg-secondary uppercase tracking-wide mb-3">Additional Plans</h3>
          <div className="grid grid-cols-3 gap-4">
            {addonPlans.map(plan => { const active = activeByPid[plan.id]; return (
              <div key={plan.id} className="bg-bg-elevated border-border rounded-lg p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-base font-semibold text-fg-primary">{plan.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 bg-[#e8daef] text-accent-primary rounded font-medium">ADD-ON</span>
                </div>
                {plan.parent_product_key && <p className="text-xs text-accent-warning mb-2">Requires: {plan.parent_product_key}</p>}
                <div className="flex items-baseline gap-1 mt-2 mb-0.5"><span className="text-[22px] font-bold text-fg-primary">{fmt(plan.unit_price_annual)}</span></div>
                <p className="text-xs text-fg-tertiary mb-4">per {plan.billing_dimension.replace('per_', '').replace(/_/g, ' ')}, per month</p>
                {active ? (
                  <div className="mt-auto pt-3 border-t border-border flex justify-between">
                    <span className="text-[13px] text-[#28a745] font-medium">Active · {fmt(active.unit_price)}/unit</span>
                    <button onClick={() => doCancel(active.id)} className="text-[13px] text-[#dc3545] hover:text-accent-danger">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setModalPlan(plan); setModalEdit(null); setCommitType('monthly'); setQty(1); setSubError(''); }} className="mt-auto w-full py-2.5 bg-accent-info text-fg-inverse text-sm font-medium rounded hover:bg-accent-info transition-colors">Select Plan</button>
                )}
              </div>
            );})}
          </div>
        </div>
      )}

      {/* Subscribe/Modify Modal */}
      {modalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setModalPlan(null); setModalEdit(null); setSubError(''); }}>
          <div className="bg-bg-elevated rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-fg-primary mb-1">{modalEdit ? 'Modify Subscription' : 'Subscribe to Plan'}</h3>
            <p className="text-sm text-fg-tertiary mb-4">{modalPlan.name} · {fmt(commitType === 'annual' ? modalPlan.unit_price_annual : modalPlan.unit_price_monthly)}/{modalPlan.billing_dimension.replace('per_', '').replace(/_/g, ' ')}/mo</p>
            {subError && <div className="bg-[#ffebee] border border-[#f5c6cb] text-[#dc3545] rounded-md px-4 py-3 text-sm mb-4">{subError}</div>}
            {modalPlan.is_addon && modalPlan.parent_product_key && !modalEdit && (
              <div className="bg-[#fff3e0] border border-[#ffe0b2] text-accent-warning rounded-md px-4 py-3 text-xs mb-4">
                ⚠ This is an add-on and requires an active <strong>{modalPlan.parent_product_key}</strong> subscription.
              </div>
            )}
            {!modalEdit && <label className="block mb-4"><span className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Commitment</span><select value={commitType} onChange={e => setCommitType(e.target.value as any)} className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm"><option value="annual">Annual (save ~17%)</option><option value="monthly">Monthly</option><option value="on_demand">On-Demand (+50%)</option></select></label>}
            <label className="block mb-4"><span className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide">Quantity</span><input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} className="mt-1 w-full px-3 py-2 border border-border rounded-md text-sm" /></label>
            <div className="bg-bg-subtle rounded-md p-4 mb-6"><div className="flex justify-between text-sm"><span className="text-fg-tertiary">Estimated monthly</span><span className="font-bold text-fg-primary">{fmt(qty * (commitType === 'annual' ? modalPlan.unit_price_annual : commitType === 'on_demand' ? modalPlan.unit_price_monthly * 1.5 : modalPlan.unit_price_monthly))}</span></div></div>
            <div className="flex gap-3"><button onClick={() => { setModalPlan(null); setModalEdit(null); setSubError(''); }} className="flex-1 py-2.5 border border-border text-sm font-semibold text-fg-secondary rounded-md hover:bg-bg-subtle">Cancel</button><button onClick={doAction} disabled={subLoading} className="flex-1 py-2.5 bg-accent-info text-fg-inverse text-sm font-semibold rounded-md hover:bg-accent-info disabled:opacity-50">{subLoading ? 'Saving...' : modalEdit ? 'Update' : 'Subscribe'}</button></div>
          </div>
        </div>
      )}

      {/* Admin Edit Pricing Modal */}
      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setEditPlan(null)}>
          <div className="bg-bg-elevated rounded-lg p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-fg-primary mb-4">Edit Plan: {editPlan.name}</h3>
            <div className="space-y-4">
              <div><label className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide block mb-1">Name</label><input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 border border-border rounded-md text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide block mb-1">Annual Price ($)</label><input type="number" step="0.01" value={editAnnual} onChange={e => setEditAnnual(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border rounded-md text-sm" /></div>
                <div><label className="text-xs font-semibold text-fg-tertiary uppercase tracking-wide block mb-1">Monthly Price ($)</label><input type="number" step="0.01" value={editMonthly} onChange={e => setEditMonthly(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-border rounded-md text-sm" /></div>
              </div>
              <div className="bg-[#fff3e0] border border-[#ffe0b2] rounded-md p-3 text-xs text-accent-warning">⚠ Admins can modify plan pricing. Existing subscriptions keep their locked-in price.</div>
              <div className="flex gap-3"><button onClick={() => setEditPlan(null)} className="flex-1 py-2.5 border border-border text-sm font-semibold text-fg-secondary rounded-md hover:bg-bg-subtle">Cancel</button><button onClick={doEditSave} disabled={editSaving} className="flex-1 py-2.5 bg-accent-info text-fg-inverse text-sm font-semibold rounded-md hover:bg-accent-info disabled:opacity-50">{editSaving ? 'Saving...' : 'Save Changes'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ BILLING HISTORY ═══════════════════════
export function BillingHistory() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [selected, setSelected] = useState<InvoiceData | null>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => { api.getBillingInvoices().then(r => { setInvoices(r.invoices || []); setLoading(false); }); }, []);
  const loadDetail = async (inv: InvoiceData) => { setSelected(inv); setDetailLoading(true); try { const r = await api.getBillingInvoiceDetail(inv.id); setLines(r.line_items || []); } finally { setDetailLoading(false); } };
  if (loading) return <SharedSpinner />;
  return (
    <div className="space-y-6">
      {/* DD: Contact text */}
      <p className="text-sm text-fg-tertiary leading-relaxed">To inquire about an invoice statement, please email us at <a href="mailto:support@zerotrace.com" className="text-accent-info hover:underline font-medium">support@zerotrace.com</a> and a representative will reach out to you shortly.</p>
      {invoices.length === 0 ? (
        <div className="bg-bg-elevated border-border rounded-lg p-16 text-center">
          <div className="text-4xl mb-4 text-fg-disabled">📄</div>
          <h3 className="text-base font-semibold text-fg-secondary mb-2">No billing history</h3>
          <p className="text-sm text-fg-tertiary max-w-md mx-auto leading-relaxed">Invoices will appear once your first billing period ends. For more information on pricing, plans, and usage, visit the <NavLink to="/org/billing/plan" className="text-accent-info hover:underline font-medium">Plan page</NavLink>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {invoices.map(inv => (
              <button key={inv.id} onClick={() => loadDetail(inv)} className={`w-full text-left p-4 rounded-lg border transition-all ${selected?.id === inv.id ? 'border-accent-info ring-2 ring-accent-info-bg bg-accent-info-bg/30' : 'border-border bg-bg-elevated hover:border-border-strong hover:shadow-sm'}`}>
                <div className="flex justify-between items-start mb-1.5"><span className="text-xs text-fg-tertiary font-mono">{inv.period_start} – {inv.period_end}</span><StatusBadge status={inv.status} /></div>
                <p className="text-lg font-bold text-fg-primary">{fmt(inv.total)}</p>
                <p className="text-[11px] text-fg-tertiary mt-1">{inv.issued_at ? `Issued ${new Date(inv.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : 'Draft'}</p>
              </button>
            ))}
          </div>
          <div className="col-span-2 min-h-[400px]">
            {!selected ? <div className="flex items-center justify-center h-full bg-bg-elevated border border-border rounded-lg text-fg-disabled text-sm">Select an invoice to view details</div>
            : detailLoading ? <SharedSpinner /> : (
              <div className="bg-bg-elevated border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-6"><div><h3 className="text-lg font-semibold text-fg-primary">Invoice #{selected.id}</h3><p className="text-xs text-fg-tertiary mt-0.5">{selected.period_start} – {selected.period_end}</p></div><div className="text-right"><p className="text-2xl font-bold text-fg-primary">{fmt(selected.total)}</p><StatusBadge status={selected.status} /></div></div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider"><th className="pb-3">Product</th><th className="pb-3 text-right">Commitment</th><th className="pb-3 text-right">Overage</th><th className="pb-3 text-right">Total</th></tr></thead>
                  <tbody>{lines.map((l: any) => { const cq = parseFloat(l.commitment_quantity) || 0; const oq = parseFloat(l.overage_quantity) || 0; return (
                    <tr key={l.id} className="border-b border-[#f1f3f5]"><td className="py-3"><p className="font-medium text-fg-primary capitalize">{l.product_key.replace(/_/g, ' ')}</p><p className="text-[11px] text-fg-tertiary">{l.description}</p></td><td className="py-3 text-right">{cq > 0 ? <><p className="font-medium text-fg-secondary">{fmt(parseFloat(l.commitment_total))}</p><p className="text-[11px] text-fg-tertiary">{cq.toLocaleString()} × {fmt(parseFloat(l.commitment_unit_price))}</p></> : <span className="text-fg-disabled">—</span>}</td><td className="py-3 text-right">{oq > 0 ? <><p className="font-medium text-accent-warning">{fmt(parseFloat(l.overage_total))}</p><p className="text-[11px] text-fg-tertiary">{oq.toLocaleString()} × {fmt(parseFloat(l.overage_unit_price))}</p></> : <span className="text-fg-disabled">—</span>}</td><td className="py-3 text-right font-semibold text-fg-primary">{fmt(parseFloat(l.line_total))}</td></tr>
                  );})}</tbody>
                  <tfoot><tr className="border-t-2 border-border"><td colSpan={3} className="pt-3 text-right text-sm text-fg-tertiary">Subtotal</td><td className="pt-3 text-right text-sm font-bold">{fmt(selected.subtotal)}</td></tr>{selected.discount > 0 && <tr><td colSpan={3} className="text-right text-sm text-[#28a745]">Discount</td><td className="text-right text-sm font-medium text-[#28a745]">-{fmt(selected.discount)}</td></tr>}<tr><td colSpan={3} className="pt-2 text-right text-base font-semibold text-fg-primary">Total</td><td className="pt-2 text-right text-base font-bold">{fmt(selected.total)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="bg-bg-elevated border-border rounded-lg p-6"><h3 className="text-sm font-semibold text-fg-primary mb-4">Manage Billing Emails</h3><div className="flex gap-3"><input type="email" placeholder="Enter email address" className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm" /><button className="px-6 py-2.5 bg-accent-info text-fg-inverse text-sm font-semibold rounded-lg hover:bg-accent-info transition-colors">Add Email</button></div></div>
    </div>
  );
}

// ═══════════════════════ USAGE ═══════════════════════
export function BillingUsagePage() {
  const [usage, setUsage] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [hourly, setHourly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  useEffect(() => { api.getBillingUsage().then(r => { const p = r.products || []; setUsage(p); if (p.length > 0) setSelected(p[0].product_key); setLoading(false); }).catch(() => setLoading(false)); }, []);
  useEffect(() => { if (!selected) return; setChartLoading(true); api.getBillingHourlyUsage(selected).then(r => setHourly(r.records || [])).finally(() => setChartLoading(false)); }, [selected]);
  if (loading) return <SharedSpinner />;
  const quantities = hourly.map((d: any) => parseFloat(d.quantity) || 0);
  const stats = { total: quantities.reduce((a: number, b: number) => a + b, 0), max: Math.max(...quantities, 0), avg: quantities.length ? quantities.reduce((a: number, b: number) => a + b, 0) / quantities.length : 0, p99: [...quantities].sort((a, b) => a - b)[Math.floor(quantities.length * 0.99)] || 0 };
  const display = hourly.slice(-48); const barMax = Math.max(...display.map((d: any) => parseFloat(d.quantity) || 0), 1);
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">Hourly Usage</h2><p className="text-sm text-fg-tertiary mt-1">Per-hour usage breakdown by product</p></div>
      <div className="flex flex-wrap gap-2">{usage.map(p => (<button key={p.product_key} onClick={() => setSelected(p.product_key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selected === p.product_key ? 'bg-accent-info text-fg-inverse shadow-md' : 'bg-bg-elevated border-border text-fg-secondary hover:border-border-strong hover:bg-bg-subtle'}`}>{p.product_key}<span className={`ml-1.5 text-xs ${selected === p.product_key ? 'text-white/70' : 'text-fg-tertiary'}`}>{fmtShort(parseFloat(p.total_quantity))}</span></button>))}</div>
      <div className="grid grid-cols-4 gap-3">{[{ l: 'Total', v: fmtShort(stats.total), c: 'text-accent-info' },{ l: 'Peak', v: fmtShort(stats.max), c: 'text-accent-warning' },{ l: '99th%ile', v: fmtShort(stats.p99), c: 'text-accent-primary' },{ l: 'Average', v: fmtShort(stats.avg), c: 'text-accent-info' }].map(s => (<div key={s.l} className="bg-bg-elevated border-border rounded-lg p-4"><p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider">{s.l}</p><p className={`text-xl font-bold ${s.c}`}>{s.v}</p></div>))}</div>
      <div className="bg-bg-elevated border-border rounded-lg p-6">{chartLoading ? <SharedSpinner /> : display.length === 0 ? <p className="text-center py-16 text-fg-disabled text-sm">No hourly data</p> : (<div className="flex items-end gap-[2px] h-48 overflow-x-auto pb-6">{display.map((d: any, i: number) => { const q = parseFloat(d.quantity) || 0; const h = Math.max((q / barMax) * 100, 2); return (<div key={i} className="flex-1 flex flex-col items-center min-w-[8px]" title={`${d.hour}: ${q}`}><div className={`w-full rounded-t-sm transition-all hover:opacity-80 ${q === stats.max ? 'bg-severity-warn' : 'bg-[#f0f7ff]0'}`} style={{ height: `${h}%` }} />{(i % 6 === 0) && <span className="text-[9px] text-fg-tertiary mt-1.5">{new Date(d.hour + 'Z').getUTCHours().toString().padStart(2, '0')}:00</span>}</div>);})}</div>)}</div>
    </div>
  );
}
