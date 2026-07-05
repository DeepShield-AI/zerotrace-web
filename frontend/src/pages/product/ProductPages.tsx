import { useState } from 'react';
import { DataTable, StatusBadge, KpiCard, Spinner } from '../../components/shared/Components';

/* ═══════════════════ DASHBOARDS ═══════════════════ */
const MOCK_DASHBOARDS = [
  { id: 1, name: 'Infrastructure Overview', author: 'admin', type: 'Timeboard', modified: '2026-06-26T09:00:00Z', popularity: 42, status: 'active' },
  { id: 2, name: 'APM — Service Health', author: 'dev-team', type: 'Screenboard', modified: '2026-06-25T18:00:00Z', popularity: 128, status: 'active' },
  { id: 3, name: 'Kubernetes Cluster Metrics', author: 'ops', type: 'Timeboard', modified: '2026-06-24T14:00:00Z', popularity: 15, status: 'active' },
  { id: 4, name: 'Security Posture Summary', author: 'security', type: 'Screenboard', modified: '2026-06-23T10:00:00Z', popularity: 67, status: 'active' },
];
export function DashboardsPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-fg-primary">Dashboards</h2><p className="text-sm text-fg-tertiary mt-1">Create and manage dashboards for your team</p></div>
        <button className="px-4 py-2 bg-accent-primary text-fg-inverse text-sm font-semibold rounded-lg hover:opacity-90 transition-colors">+ New Dashboard</button>
      </div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'name', header: 'Name', render: (d: any) => <span className="text-sm font-medium text-fg-primary">{d.name}</span> },
            { key: 'author', header: 'Author', width: '100px', render: (d: any) => <span className="text-xs text-fg-tertiary">{d.author}</span> },
            { key: 'type', header: 'Type', width: '100px', render: (d: any) => <span className="text-xs px-2 py-0.5 bg-bg-muted rounded text-fg-secondary">{d.type}</span> },
            { key: 'modified', header: 'Modified', width: '140px', render: (d: any) => <span className="text-xs text-fg-tertiary">{new Date(d.modified).toLocaleDateString()}</span> },
            { key: 'popularity', header: 'Popularity', width: '90px', align: 'right', render: (d: any) => <span className="text-sm text-fg-secondary">{d.popularity}</span> },
          ]}
          rows={MOCK_DASHBOARDS} emptyMessage="No dashboards"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ DIGITAL EXPERIENCE ═══════════════════ */
export function DigitalExperiencePage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">Digital Experience</h2><p className="text-sm text-fg-tertiary mt-1">Monitor user experience across web and mobile</p></div>
      <div className="grid grid-cols-2 gap-6">
        <a href="/rum" className="block bg-bg-elevated border border-border rounded-xl p-6 hover:shadow-md hover:border-border-strong transition-all">
          <h3 className="text-lg font-semibold text-fg-primary mb-2">Real User Monitoring</h3>
          <p className="text-sm text-fg-tertiary mb-4">Track user sessions, load times, and frontend errors in real time</p>
          <span className="text-xs font-semibold text-accent-primary hover:text-accent-primary">View RUM →</span>
        </a>
        <a href="/synthetic-tests" className="block bg-bg-elevated border border-border rounded-xl p-6 hover:shadow-md hover:border-border-strong transition-all">
          <h3 className="text-lg font-semibold text-fg-primary mb-2">Synthetic Monitoring</h3>
          <p className="text-sm text-fg-tertiary mb-4">Proactively test API endpoints and browser workflows from global locations</p>
          <span className="text-xs font-semibold text-accent-primary hover:text-accent-primary">View Synthetics →</span>
        </a>
      </div>
    </div>
  );
}

/* ═══════════════════ SOFTWARE DELIVERY ═══════════════════ */
export function SoftwareDeliveryPage() {
  const [rows] = useState([
    { id: 1, pipeline: 'main-build', branch: 'main', status: 'success', duration: '4m 32s', commit: 'a1b2c3d', author: 'alice', time: '2026-06-26T10:30:00Z' },
    { id: 2, pipeline: 'staging-deploy', branch: 'staging', status: 'success', duration: '2m 15s', commit: 'e4f5g6h', author: 'bob', time: '2026-06-26T10:28:00Z' },
    { id: 3, pipeline: 'integration-tests', branch: 'feature/auth', status: 'failed', duration: '8m 10s', commit: 'i7j8k9l', author: 'carol', time: '2026-06-26T10:20:00Z' },
    { id: 4, pipeline: 'production-deploy', branch: 'main', status: 'running', duration: '1m 5s', commit: 'a1b2c3d', author: 'alice', time: '2026-06-26T10:32:00Z' },
  ]);
  return (
    <div className="animate-fade-in space-y-4">
      <div><h2 className="text-xl font-bold text-fg-primary">CI Visibility</h2><p className="text-sm text-fg-tertiary mt-1">Monitor pipeline performance and deployment health</p></div>
      <div className="grid grid-cols-4 gap-3 mb-2">
        <KpiCard label="Total Pipelines" value="4" accent="purple" />
        <KpiCard label="Success Rate" value="50%" accent="green" />
        <KpiCard label="Avg Duration" value="4m 1s" accent="default" />
        <KpiCard label="Failed (24h)" value="1" accent="red" />
      </div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'status', header: 'Status', width: '80px', render: (p: any) => <StatusBadge status={p.status} /> },
            { key: 'pipeline', header: 'Pipeline', render: (p: any) => <div><span className="text-sm font-medium text-fg-primary">{p.pipeline}</span><p className="text-[11px] text-fg-tertiary">{p.branch}</p></div> },
            { key: 'commit', header: 'Commit', width: '90px', render: (p: any) => <code className="text-xs font-mono text-fg-secondary">{p.commit}</code> },
            { key: 'author', header: 'Author', width: '80px', render: (p: any) => <span className="text-xs text-fg-tertiary">{p.author}</span> },
            { key: 'duration', header: 'Duration', width: '90px', render: (p: any) => <span className="text-xs text-fg-secondary font-mono">{p.duration}</span> },
            { key: 'time', header: 'Time', width: '150px', render: (p: any) => <span className="text-xs text-fg-tertiary">{new Date(p.time).toLocaleString()}</span> },
          ]}
          rows={rows} emptyMessage="No pipelines"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ CLOUD COST ═══════════════════ */
export function CloudCostPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">Cloud Cost</h2><p className="text-sm text-fg-tertiary mt-1">Track and optimize cloud infrastructure spending</p></div>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="MTD Spend" value="$1,247.50" accent="purple" />
        <KpiCard label="Projected" value="$2,495.00" accent="amber" />
        <KpiCard label="Last Month" value="$2,180.00" accent="default" />
        <KpiCard label="Savings (RI)" value="$312.40" accent="green" />
      </div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'service', header: 'Service', render: (s: any) => <span className="text-sm font-medium text-fg-primary">{s.service}</span> },
            { key: 'mtd', header: 'MTD', align: 'right', render: (s: any) => <span className="text-sm font-semibold text-fg-primary">{s.mtd}</span> },
            { key: 'projected', header: 'Projected', align: 'right', render: (s: any) => <span className="text-sm text-fg-secondary">{s.projected}</span> },
            { key: 'change', header: 'MoM Change', align: 'right', render: (s: any) => <span className={`text-sm font-semibold ${s.change.startsWith('+') ? 'text-accent-danger' : 'text-accent-success'}`}>{s.change}</span> },
            { key: 'pct', header: '% of Total', align: 'right', render: (s: any) => <span className="text-sm text-fg-tertiary">{s.pct}</span> },
          ]}
          rows={[
            { service: 'EC2', mtd: '$542.00', projected: '$1,084.00', change: '+12.3%', pct: '43.5%' },
            { service: 'RDS', mtd: '$312.00', projected: '$624.00', change: '-3.1%', pct: '25.0%' },
            { service: 'S3', mtd: '$198.50', projected: '$397.00', change: '+1.8%', pct: '15.9%' },
            { service: 'Lambda', mtd: '$105.00', projected: '$210.00', change: '-8.5%', pct: '8.4%' },
            { service: 'Other', mtd: '$90.00', projected: '$180.00', change: '+2.1%', pct: '7.2%' },
          ]} emptyMessage="No cost data"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ AUTOMATION ═══════════════════ */
export function AutomationPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">Automation</h2><p className="text-sm text-fg-tertiary mt-1">Workflow automation and action management</p></div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'Workflow Automation', desc: 'Build automated workflows triggered by monitors, events, or schedules', label: 'Workflows', to: '/automation/workflows' },
          { title: 'Action Catalog', desc: 'Browse and configure actions for notifications, remediation, and integrations', label: 'Actions', to: '/automation/actions' },
          { title: 'App Builder', desc: 'Create custom apps and dashboards without code', label: 'Apps', badge: 'new', to: '/automation/app-builder' },
        ].map(card => (
          <a key={card.title} href={card.to} className="block bg-bg-elevated border border-border rounded-xl p-6 hover:shadow-md hover:border-border-strong transition-all">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-fg-primary">{card.title}</h3>
              {card.badge && <span className="text-[10px] px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary rounded font-bold">{card.badge.toUpperCase()}</span>}
            </div>
            <p className="text-sm text-fg-tertiary mb-4">{card.desc}</p>
            <span className="text-xs font-semibold text-accent-primary">{card.label} →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ DATA OBSERVABILITY ═══════════════════ */
export function DataObservabilityPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">Data Observability</h2><p className="text-sm text-fg-tertiary mt-1">Monitor data pipelines, quality, and lineage</p></div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'Catalog', desc: 'Discover and understand your data assets across all sources', to: '/data-observability/catalog' },
          { title: 'Jobs Monitoring', desc: 'Track data pipeline jobs, schedules, and failures', to: '/data-observability/jobs' },
          { title: 'Lineage', desc: 'Visualize data flow and dependencies across your stack', to: '/data-observability/lineage' },
        ].map(card => (
          <a key={card.title} href={card.to} className="block bg-bg-elevated border border-border rounded-xl p-6 hover:shadow-md hover:border-border-strong transition-all">
            <h3 className="text-lg font-semibold text-fg-primary mb-2">{card.title}</h3>
            <p className="text-sm text-fg-tertiary mb-4">{card.desc}</p>
            <span className="text-xs font-semibold text-accent-primary">Explore →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ AI OBSERVABILITY ═══════════════════ */
export function AIObservabilityPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">AI Observability</h2><p className="text-sm text-fg-tertiary mt-1">Monitor LLM applications, agents, and AI pipelines</p></div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'LLM Applications', desc: 'Monitor LLM calls, token usage, and latency across your AI apps', to: '/ai-observability/apps' },
          { title: 'Agent Observability', desc: 'Track AI agent behavior, tool calls, and decision paths', to: '/ai-observability/agents' },
          { title: 'Evaluations', desc: 'Run evaluations to measure model quality and accuracy', to: '/ai-observability/evaluations' },
        ].map(card => (
          <a key={card.title} href={card.to} className="block bg-bg-elevated border border-border rounded-xl p-6 hover:shadow-md hover:border-border-strong transition-all">
            <h3 className="text-lg font-semibold text-fg-primary mb-2">{card.title}</h3>
            <p className="text-sm text-fg-tertiary mb-4">{card.desc}</p>
            <span className="text-xs font-semibold text-accent-primary">Explore →</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ SECURITY ═══════════════════ */
export function SecurityPage() {
  return (
    <div className="animate-fade-in space-y-6">
      <div><h2 className="text-xl font-bold text-fg-primary">Security</h2><p className="text-sm text-fg-tertiary mt-1">Cloud SIEM, CSM, and application security</p></div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: 'Cloud SIEM', desc: 'Real-time threat detection and security log analysis', to: '/security/siem' },
          { title: 'Cloud Security Management', desc: 'Posture management, vulnerability scanning, and compliance', to: '/security/csm' },
          { title: 'Workload Protection', desc: 'Runtime security for hosts, containers, and serverless', to: '/security/workload' },
          { title: 'Application Security', desc: 'Protect APIs and applications from attacks', to: '/security/appsec' },
        ].map(card => (
          <a key={card.title} href={card.to} className="block bg-bg-elevated border border-border rounded-xl p-5 hover:shadow-md hover:border-border-strong transition-all">
            <h3 className="text-base font-semibold text-fg-primary mb-1">{card.title}</h3>
            <p className="text-sm text-fg-tertiary mb-3">{card.desc}</p>
            <span className="text-xs font-semibold text-accent-primary">View →</span>
          </a>
        ))}
      </div>
    </div>
  );
}
