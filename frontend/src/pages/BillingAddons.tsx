import { useState } from 'react';
import { DataTable, StatusBadge, Spinner } from '../components/Components';

/* ═══════════════════ SEAT MANAGEMENT ═══════════════════ */
export function BillingSeats() {
  const [seats] = useState([
    { id: 1, email: 'admin@zerotrace.com', role: 'Admin', status: 'active', lastActive: '2026-06-26T10:00:00Z', joined: '2026-01-15' },
    { id: 2, email: 'dev@zerotrace.com', role: 'Standard', status: 'active', lastActive: '2026-06-25T18:30:00Z', joined: '2026-03-20' },
    { id: 3, email: 'ops@zerotrace.com', role: 'Read Only', status: 'invited', lastActive: null, joined: '—' },
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-fg-primary">Seat Management</h2>
          <p className="text-sm text-fg-tertiary mt-1">Manage user seats and access for your organization</p>
        </div>
        <button className="px-4 py-2 bg-accent-info text-fg-inverse text-sm font-semibold rounded-lg hover:bg-accent-info transition-colors">
          + Invite User
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Seats', value: '3', sub: 'across all plans', accent: 'default' as const },
          { label: 'Active Users', value: '2', sub: 'currently active', accent: 'green' as const },
          { label: 'Pending Invites', value: '1', sub: 'awaiting acceptance', accent: 'amber' as const },
        ].map(k => (
          <div key={k.label} className={`bg-bg-elevated border border-border rounded-lg p-5 ${k.accent === 'green' ? 'border-l-4 border-l-accent-success' : k.accent === 'amber' ? 'border-l-4 border-l-amber-400' : ''}`}>
            <p className="text-xs font-semibold text-fg-tertiary uppercase tracking-wider mb-1">{k.label}</p>
            <p className="text-2xl font-bold text-fg-primary">{k.value}</p>
            <p className="text-xs text-fg-tertiary mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        <DataTable
          columns={[
            { key: 'email', header: 'Email', render: (s: any) => <span className="font-medium text-fg-primary text-sm">{s.email}</span> },
            { key: 'role', header: 'Role', render: (s: any) => <span className="text-sm text-fg-secondary">{s.role}</span> },
            { key: 'status', header: 'Status', render: (s: any) => <StatusBadge status={s.status} /> },
            { key: 'lastActive', header: 'Last Active', render: (s: any) => <span className="text-xs text-fg-tertiary">{s.lastActive ? new Date(s.lastActive).toLocaleDateString() : '—'}</span> },
            { key: 'joined', header: 'Joined', render: (s: any) => <span className="text-xs text-fg-tertiary">{s.joined}</span> },
          ]}
          rows={seats}
          emptyMessage="No users found"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ TRIAL MANAGEMENT ═══════════════════ */
export function TrialManagement() {
  const trialDaysLeft = 14;
  const trialEnd = new Date(Date.now() + trialDaysLeft * 86400000).toLocaleDateString();

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-r from-accent-primary/10 to-purple-50 border border-accent-info-bg rounded-lg p-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-fg-primary">Trial Management</h2>
            <p className="text-sm text-fg-tertiary mt-1">You're on a free trial. Upgrade to unlock full access.</p>
          </div>
          <button className="px-6 py-2.5 bg-accent-info text-fg-inverse text-sm font-semibold rounded-lg hover:bg-accent-info transition-colors shadow-sm">
            Upgrade Now
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Days Remaining', value: String(trialDaysLeft), accent: 'text-accent-info' },
            { label: 'Trial End Date', value: trialEnd, accent: 'text-fg-primary' },
            { label: 'Hosts Monitored', value: '0', accent: 'text-fg-primary' },
            { label: 'Data Retention', value: '1 day', accent: 'text-fg-primary' },
          ].map(k => (
            <div key={k.label} className="bg-bg-elevated/80 rounded-lg p-4">
              <p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">{k.label}</p>
              <p className={`text-lg font-bold ${k.accent}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-elevated border border-border rounded-lg p-6">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">Plan Comparison</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { name: 'Free', price: '$0', features: ['Up to 5 hosts', '1 day retention', 'Core features'] },
            { name: 'Pro', price: '$15/host/mo', features: ['Unlimited hosts', '15 month retention', '1000+ integrations', 'ML-based alerts'], featured: true },
            { name: 'Enterprise', price: '$23/host/mo', features: ['Everything in Pro', 'Live Processes', 'SAML/RBAC', 'Premium support'] },
          ].map(p => (
            <div key={p.name} className={`rounded-lg border p-5 ${p.featured ? 'border-accent-info bg-accent-info-bg/30 ring-2 ring-accent-info-bg' : 'border-border'}`}>
              <h4 className="font-semibold text-fg-primary">{p.name}</h4>
              <p className="text-2xl font-bold text-fg-primary mt-2">{p.price}</p>
              <ul className="mt-4 space-y-2">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-fg-secondary">
                    <svg className="w-3.5 h-3.5 text-accent-success flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button className={`mt-6 w-full py-2 rounded-lg text-xs font-semibold transition-colors ${p.featured ? 'bg-accent-info text-fg-inverse hover:bg-accent-info' : 'border-2 border-accent-info text-accent-info hover:bg-accent-info-bg'}`}>
                {p.featured ? 'Start Free Trial' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ USAGE ATTRIBUTION ═══════════════════ */
export function UsageAttribution() {
  const [rows] = useState([
    { id: 1, dimension: 'infra_hosts', usage: '0', cost: '$0.00', pct: '—' },
    { id: 2, dimension: 'apm_hosts', usage: '0', cost: '$0.00', pct: '—' },
    { id: 3, dimension: 'log_ingestion', usage: '0 GB', cost: '$0.00', pct: '—' },
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold text-fg-primary">Usage Attribution</h2>
        <p className="text-sm text-fg-tertiary mt-1">Break down usage and costs by dimension, tag, or team</p>
      </div>

      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        <DataTable
          columns={[
            { key: 'dimension', header: 'Dimension', render: (r: any) => <span className="font-medium text-fg-primary text-sm">{r.dimension}</span> },
            { key: 'usage', header: 'Usage', align: 'right', render: (r: any) => <span className="text-sm text-fg-secondary">{r.usage}</span> },
            { key: 'cost', header: 'Cost', align: 'right', render: (r: any) => <span className="text-sm font-semibold text-fg-primary">{r.cost}</span> },
            { key: 'pct', header: '% of Total', align: 'right', render: (r: any) => <span className="text-sm text-fg-tertiary">{r.pct}</span> },
          ]}
          rows={rows}
          emptyMessage="No usage data available"
        />
      </div>

      <div className="bg-bg-elevated border border-border rounded-lg p-10 text-center">
        <p className="text-sm text-fg-tertiary max-w-md mx-auto leading-relaxed">
          Usage attribution provides detailed breakdowns by tag and dimension.
          Enable tagging on your infrastructure to see granular cost and usage analytics.
        </p>
      </div>
    </div>
  );
}
