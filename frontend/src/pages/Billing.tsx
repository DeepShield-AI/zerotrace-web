import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Spin, Tag, message, Modal, InputNumber, Select, Input, Switch, Slider } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface Plan {
  id: number;
  product_key: string;
  name: string;
  description: string;
  billing_dimension: string;
  aggregation_method: string;
  unit_price_monthly: string;
  unit_price_annual: string;
  currency: string;
  is_addon: boolean;
  parent_product_key: string | null;
  allotments: PlanAllotment[];
}

interface PlanAllotment {
  id: number;
  plan_id: number;
  allotted_product_key: string;
  allotted_quantity: string;
  per_unit: string;
}

interface Subscription {
  id: number;
  org_id: number;
  plan_id: number;
  commitment_type: string;
  committed_quantity: string;
  unit_price: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  plan: Plan;
}

interface UsageProduct {
  product_key: string;
  total_quantity: string;
  hourly_count: number;
}

interface EstimatedCost {
  estimated_total: string;
  currency: string;
  breakdown: EstimatedProductCost[];
}

interface EstimatedProductCost {
  product_key: string;
  estimated_cost: string;
  usage_total: string;
}

interface UsageAlert {
  id: number;
  product_key: string;
  threshold_pct: number;
  threshold_absolute: string | null;
  channel: string;
  last_triggered_at: string | null;
  is_enabled: boolean;
}

function formatCurrency(val: string | number): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return '$' + n.toFixed(2);
}

function PlanCard({
  plan, subscribed, onSubscribe, onCancel, isAdmin, onEdit, onDelete,
}: {
  plan: Plan; subscribed: Subscription | undefined; onSubscribe: (plan: Plan) => void;
  onCancel: (sub: Subscription) => void; isAdmin: boolean;
  onEdit: (plan: Plan) => void; onDelete: (plan: Plan) => void;
}) {
  const { t } = useTranslation();
  const isActive = subscribed?.status === 'active';
  const annual = parseFloat(plan.unit_price_annual);
  const monthly = parseFloat(plan.unit_price_monthly);

  return (
    <Card className={`rounded-lg border ${isActive ? 'border-accent-success bg-accent-success-bg/20' : 'border-border/60'} hover:shadow-md transition-shadow`}
      title={<div className="flex items-center justify-between">
        <span className="text-base font-semibold text-fg-primary">{plan.name}</span>
        <span className="flex gap-1">{plan.is_addon && <Tag color="blue">{t('billing.addon')}</Tag>}
          <Tag color="default"><code>{plan.product_key}</code></Tag>
        </span>
      </div>}
    >
      <p className="text-sm text-fg-tertiary mb-4">{plan.description}</p>
      <div className="flex gap-4 mb-4">
        <div className="flex-1 text-center p-3 bg-bg-subtle rounded-lg">
          <p className="text-xs text-fg-tertiary">{t('billing.annual')}</p>
          <p className="text-lg font-bold text-fg-primary">{formatCurrency(annual)}</p>
          <p className="text-xs text-fg-tertiary">/{plan.billing_dimension.replace('per_', '')}/mo</p>
        </div>
        <div className="flex-1 text-center p-3 bg-bg-subtle rounded-lg">
          <p className="text-xs text-fg-tertiary">{t('billing.monthly')}</p>
          <p className="text-lg font-bold text-fg-primary">{formatCurrency(monthly)}</p>
          <p className="text-xs text-fg-tertiary">/{plan.billing_dimension.replace('per_', '')}/mo</p>
        </div>
      </div>
      <div className="text-xs text-fg-tertiary mb-4 space-y-1">
        <p>{t('billing.aggregation')}: <code className="text-fg-secondary">{plan.aggregation_method}</code></p>
        {plan.parent_product_key && <p>{t('billing.requires')}: <code className="text-fg-secondary">{plan.parent_product_key}</code></p>}
      </div>
      {plan.allotments.length > 0 && (
        <div className="mb-4 p-3 bg-accent-warning-bg rounded-lg border border-accent-warning">
          <p className="text-xs font-medium text-accent-warning mb-1">{t('billing.includes')}:</p>
          {plan.allotments.map((a) => (
            <p key={a.id} className="text-xs text-accent-warning">{a.allotted_quantity} {a.allotted_product_key} ({a.per_unit})</p>
          ))}
        </div>
      )}
      {isActive ? (
        <div className="space-y-2">
          <Tag color="green">{t('billing.active')} — {subscribed!.commitment_type}</Tag>
          <p className="text-xs text-fg-tertiary">{parseFloat(subscribed!.committed_quantity).toLocaleString()} {plan.billing_dimension.replace('per_', '')}s @ {formatCurrency(subscribed!.unit_price)} each/mo</p>
          <div className="flex gap-2">
            <Button size="small" onClick={() => onSubscribe(plan)}>{t('billing.changeQuantity')}</Button>
            <Button danger size="small" onClick={() => onCancel(subscribed!)}>{t('billing.cancelSubscription')}</Button>
          </div>
        </div>
      ) : (
        <Button type="primary" block onClick={() => onSubscribe(plan)}>{t('billing.subscribe')}</Button>
      )}
      {isAdmin && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <Button size="small" onClick={() => onEdit(plan)}>{t('common.edit')}</Button>
          <Button size="small" danger onClick={() => onDelete(plan)}>{t('common.delete')}</Button>
        </div>
      )}
    </Card>
  );
}

export default function Billing() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [usage, setUsage] = useState<UsageProduct[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<EstimatedCost | null>(null);
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe/Create modal
  const [subscribeModal, setSubscribeModal] = useState<Plan | null>(null);
  const [commitType, setCommitType] = useState<string>('annual');
  const [quantity, setQuantity] = useState<number>(10);
  const [subscribing, setSubscribing] = useState(false);
  const [isUpgrade, setIsUpgrade] = useState(false);

  // Plan edit modal (admin)
  const [editModal, setEditModal] = useState<Plan | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMonthly, setEditMonthly] = useState(0);
  const [editAnnual, setEditAnnual] = useState(0);
  const [editAgg, setEditAgg] = useState('sum');
  const [editSaving, setEditSaving] = useState(false);

  // Create plan modal (admin)
  const [createModal, setCreateModal] = useState(false);
  const [createKey, setCreateKey] = useState('');
  const [createName, setCreateName] = useState('');
  const [createMonthly, setCreateMonthly] = useState(10);
  const [createAnnual, setCreateAnnual] = useState(8);
  const [createDim, setCreateDim] = useState('per_host');
  const [createAgg, setCreateAgg] = useState('hwmp_99p');
  const [createAddon, setCreateAddon] = useState(false);

  // Alert modal
  const [alertModal, setAlertModal] = useState(false);
  const [alertProduct, setAlertProduct] = useState('*');
  const [alertPct, setAlertPct] = useState(80);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, u, e, a] = await Promise.all([
        api.getBillingPlans(), api.getBillingSubscriptions(),
        api.getBillingUsage(), api.getBillingEstimatedCost(),
        api.getBillingAlerts().catch(() => ({ alerts: [] })),
      ]);
      setPlans(p.plans || []);
      setSubscriptions(s.subscriptions || []);
      setUsage(u.products || []);
      setEstimatedCost(e);
      setAlerts(a.alerts || []);
    } catch (err: any) { console.error('Failed to load billing data:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ---- Subscription handlers ----
  const handleSubscribe = (plan: Plan) => {
    const existing = subscriptions.find(s => s.plan_id === plan.id);
    setSubscribeModal(plan);
    if (existing?.status === 'active') { setIsUpgrade(true); setQuantity(parseFloat(existing.committed_quantity)); setCommitType(existing.commitment_type); }
    else { setIsUpgrade(false); setCommitType('annual'); setQuantity(plan.billing_dimension === 'per_host' ? 10 : 100); }
  };

  const doSubscribe = async () => {
    if (!subscribeModal) return;
    setSubscribing(true);
    try {
      if (isUpgrade) {
        const existing = subscriptions.find(s => s.plan_id === subscribeModal.id);
        if (existing) {
          await api.updateBillingSubscription(existing.id, quantity);
          message.success(t('billing.quantityUpdated'));
        }
      } else {
        await api.createBillingSubscription({ plan_id: subscribeModal.id, commitment_type: commitType, committed_quantity: quantity });
        message.success(t('billing.subscribed'));
      }
      setSubscribeModal(null);
      loadData();
    } catch (err: any) { message.error(err.message || 'Failed'); }
    finally { setSubscribing(false); }
  };

  const handleCancel = async (sub: Subscription) => {
    try { await api.cancelBillingSubscription(sub.id); message.success(t('billing.canceled')); loadData(); }
    catch (err: any) { message.error(err.message || 'Failed'); }
  };

  // ---- Admin plan management ----
  const handleEdit = (plan: Plan) => {
    setEditModal(plan); setEditName(plan.name); setEditDesc(plan.description);
    setEditMonthly(parseFloat(plan.unit_price_monthly)); setEditAnnual(parseFloat(plan.unit_price_annual));
    setEditAgg(plan.aggregation_method);
  };

  const doEdit = async () => {
    if (!editModal) return; setEditSaving(true);
    try {
      await api.updateBillingPlan(editModal.id, {
        name: editName, description: editDesc,
        unit_price_monthly: editMonthly, unit_price_annual: editAnnual,
        aggregation_method: editAgg,
      });
      message.success('Plan updated'); setEditModal(null); loadData();
    } catch (err: any) { message.error(err.message || 'Failed'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (plan: Plan) => {
    try { await api.deleteBillingPlan(plan.id); message.success('Plan deleted'); loadData(); }
    catch (err: any) { message.error(err.message || 'Failed'); }
  };

  const doCreatePlan = async () => {
    if (!createKey.trim() || !createName.trim()) return;
    setEditSaving(true);
    try {
      await api.createBillingPlan({
        product_key: createKey.trim(), name: createName.trim(),
        description: '', billing_dimension: createDim, aggregation_method: createAgg,
        unit_price_monthly: createMonthly, unit_price_annual: createAnnual,
        is_addon: createAddon,
      });
      message.success('Plan created'); setCreateModal(false); loadData();
    } catch (err: any) { message.error(err.message || 'Failed'); }
    finally { setEditSaving(false); }
  };

  // ---- Alert management ----
  const doCreateAlert = async () => {
    try {
      await api.createBillingAlert({ product_key: alertProduct, threshold_pct: alertPct });
      message.success('Alert created'); setAlertModal(false); loadData();
    } catch (err: any) { message.error(err.message || 'Failed'); }
  };

  const handleDeleteAlert = async (alert: UsageAlert) => {
    try { await api.deleteBillingAlert(alert.id); message.success('Alert deleted'); loadData(); }
    catch (err: any) { message.error(err.message || 'Failed'); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;

  const basePlans = plans.filter(p => !p.is_addon);
  const addonPlans = plans.filter(p => p.is_addon);

  return (
    <div className="animate-fade-in">
      {/* Usage & Estimated Cost */}
      {estimatedCost && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bento-card bg-accent-success-bg/30 border border-accent-success-bg">
            <p className="text-xs text-accent-success font-medium">{t('billing.estimatedCost')}</p>
            <p className="text-2xl font-bold text-accent-success mt-1">{formatCurrency(estimatedCost.estimated_total)}</p>
            <p className="text-xs text-accent-success mt-1">{t('billing.currentMonth')}</p>
          </div>
          {estimatedCost.breakdown.slice(0, 4).map(b => (
            <div key={b.product_key} className="bento-card">
              <p className="text-xs text-fg-tertiary font-medium uppercase">{b.product_key.replace(/_/g, ' ')}</p>
              <p className="text-xl font-bold text-fg-primary mt-1">{formatCurrency(b.estimated_cost)}</p>
              <p className="text-xs text-fg-tertiary mt-1">{parseFloat(b.usage_total).toLocaleString()} billable used</p>
            </div>
          ))}
        </div>
      )}

      {/* Current Usage */}
      {usage.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-fg-primary mb-4">{t('billing.currentUsage')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {usage.map(u => (
              <div key={u.product_key} className="bento-card">
                <p className="text-xs text-fg-tertiary">{u.product_key.replace(/_/g, ' ')}</p>
                <p className="text-lg font-bold text-fg-primary mt-1">{parseFloat(u.total_quantity).toLocaleString()}</p>
                <p className="text-xs text-fg-tertiary">{u.hourly_count} {t('billing.hoursTracked')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-fg-primary">{t('billing.plans')}</h3>
        {isAdmin && <Button onClick={() => setCreateModal(true)}>{t('billing.createPlan')}</Button>}
      </div>

      <h4 className="text-sm font-medium text-fg-secondary mb-3">{t('billing.baseProducts')}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {basePlans.map(plan => (
          <PlanCard key={plan.id} plan={plan} subscribed={subscriptions.find(s => s.plan_id === plan.id)}
            onSubscribe={handleSubscribe} onCancel={handleCancel} isAdmin={isAdmin}
            onEdit={handleEdit} onDelete={handleDelete} />
        ))}
      </div>

      {addonPlans.length > 0 && (<>
        <h4 className="text-sm font-medium text-fg-secondary mb-3">{t('billing.addonProducts')}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {addonPlans.map(plan => (
            <PlanCard key={plan.id} plan={plan} subscribed={subscriptions.find(s => s.plan_id === plan.id)}
              onSubscribe={handleSubscribe} onCancel={handleCancel} isAdmin={isAdmin}
              onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      </>)}

      {/* Usage Alerts */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-fg-primary">{t('billing.usageAlerts')}</h3>
          <Button size="small" onClick={() => setAlertModal(true)}>{t('billing.createAlert')}</Button>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-fg-tertiary">{t('billing.noAlerts')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map(a => (
              <div key={a.id} className="bento-card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-fg-primary">{a.product_key === '*' ? t('billing.allProducts') : a.product_key}</p>
                  <p className="text-xs text-fg-tertiary">{t('billing.alertAt')} {a.threshold_pct}% · {a.channel}</p>
                </div>
                <Button size="small" danger onClick={() => handleDeleteAlert(a)}>{t('common.delete')}</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === Modals === */}

      {/* Subscribe / Upgrade modal */}
      <Modal title={subscribeModal ? (isUpgrade ? t('billing.changeQuantityTitle') : `${t('billing.subscribeTo')} ${subscribeModal.name}`) : ''}
        open={!!subscribeModal} onCancel={() => setSubscribeModal(null)} onOk={doSubscribe} confirmLoading={subscribing}
        okText={isUpgrade ? t('billing.updateQuantity') : t('billing.confirmSubscription')}>
        {subscribeModal && (
          <div className="space-y-4 py-4">
            {!isUpgrade && (<div>
              <label className="text-sm font-medium text-fg-secondary block mb-1">{t('billing.commitmentType')}</label>
              <Select value={commitType} onChange={setCommitType} className="w-full" size="large"
                options={[
                  { value: 'annual', label: `${t('billing.annual')} — ${formatCurrency(subscribeModal.unit_price_annual)}/${subscribeModal.billing_dimension.replace('per_', '')}/mo` },
                  { value: 'monthly', label: `${t('billing.monthly')} — ${formatCurrency(subscribeModal.unit_price_monthly)}/${subscribeModal.billing_dimension.replace('per_', '')}/mo` },
                  { value: 'on_demand', label: `${t('billing.onDemand')} — ${formatCurrency(parseFloat(subscribeModal.unit_price_monthly) * 1.5)}` },
                ]} />
            </div>)}
            <div>
              <label className="text-sm font-medium text-fg-secondary block mb-1">{t('billing.quantity')}</label>
              <InputNumber value={quantity} onChange={v => setQuantity(v || 1)} min={1} max={100000} className="w-full" size="large" />
            </div>
            <div className="p-3 bg-bg-subtle rounded-lg">
              <p className="text-xs text-fg-tertiary">{t('billing.estimatedMonthly')}:</p>
              <p className="text-lg font-bold text-fg-primary">{formatCurrency(parseFloat(subscribeModal.unit_price_annual) * quantity)}/mo</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit plan modal (admin) */}
      <Modal title={t('billing.editPlan')} open={!!editModal} onCancel={() => setEditModal(null)} onOk={doEdit}
        confirmLoading={editSaving} okText={t('common.save')}>
        {editModal && (<div className="space-y-3 py-4">
          <div><label className="text-sm text-fg-secondary block mb-1">{t('common.name')}</label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
          <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.description')}</label>
            <Input.TextArea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.annualPrice')}</label>
              <InputNumber value={editAnnual} onChange={v => setEditAnnual(v || 0)} className="w-full" min={0} step={0.01} /></div>
            <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.monthlyPrice')}</label>
              <InputNumber value={editMonthly} onChange={v => setEditMonthly(v || 0)} className="w-full" min={0} step={0.01} /></div>
          </div>
          <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.aggregation')}</label>
            <Select value={editAgg} onChange={setEditAgg} className="w-full"
              options={[{ value: 'hwmp_99p', label: 'HWMP 99th percentile' }, { value: 'sum', label: 'Sum' }, { value: 'average', label: 'Average' }]} /></div>
        </div>)}
      </Modal>

      {/* Create plan modal (admin) */}
      <Modal title={t('billing.createPlan')} open={createModal} onCancel={() => setCreateModal(false)} onOk={doCreatePlan}
        confirmLoading={editSaving} okText={t('common.create')}>
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-fg-secondary block mb-1">Product Key</label>
              <Input value={createKey} onChange={e => setCreateKey(e.target.value)} placeholder="infra_pro" /></div>
            <div><label className="text-sm text-fg-secondary block mb-1">{t('common.name')}</label>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Infrastructure Pro" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.dimension')}</label>
              <Select value={createDim} onChange={setCreateDim} className="w-full"
                options={[{ value: 'per_host', label: 'Per Host' }, { value: 'per_gb', label: 'Per GB' }, { value: 'per_million_events', label: 'Per Million Events' }, { value: 'per_metric', label: 'Per Metric' }, { value: 'per_container', label: 'Per Container' }]} /></div>
            <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.aggregation')}</label>
              <Select value={createAgg} onChange={setCreateAgg} className="w-full"
                options={[{ value: 'hwmp_99p', label: 'HWMP 99p' }, { value: 'sum', label: 'Sum' }, { value: 'average', label: 'Average' }]} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.annualPrice')}</label>
              <InputNumber value={createAnnual} onChange={v => setCreateAnnual(v || 0)} className="w-full" min={0} step={0.01} /></div>
            <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.monthlyPrice')}</label>
              <InputNumber value={createMonthly} onChange={v => setCreateMonthly(v || 0)} className="w-full" min={0} step={0.01} /></div>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-fg-secondary">{t('billing.addon')}</label>
            <Switch checked={createAddon} onChange={setCreateAddon} />
          </div>
        </div>
      </Modal>

      {/* Create alert modal */}
      <Modal title={t('billing.createAlert')} open={alertModal} onCancel={() => setAlertModal(false)} onOk={doCreateAlert}
        okText={t('common.create')}>
        <div className="space-y-4 py-4">
          <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.product')}</label>
            <Select value={alertProduct} onChange={setAlertProduct} className="w-full"
              options={[{ value: '*', label: t('billing.allProducts') + ' (*)' },
                ...plans.map(p => ({ value: p.product_key, label: `${p.name} (${p.product_key})` })),
              ]} /></div>
          <div><label className="text-sm text-fg-secondary block mb-1">{t('billing.thresholdPercent')}: {alertPct}%</label>
            <Slider value={alertPct} onChange={setAlertPct} min={10} max={200} step={5}
              marks={{ 50: '50%', 80: '80%', 100: '100%', 150: '150%' }} /></div>
        </div>
      </Modal>
    </div>
  );
}
