import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable, StatusBadge, KpiCard } from '../components/Components';

function PageShell({ title, desc, children }: { title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-8">{desc}</p>
      {children || (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <DataPlaceholder />
        </div>
      )}
    </div>
  );
}

function DataPlaceholder() {
  return (
    <div className="py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-600 mb-1">No data yet</h3>
      <p className="text-xs text-gray-400 max-w-sm mx-auto">Connect your infrastructure to start seeing data here.</p>
    </div>
  );
}

function CardGrid({ items }: { items: { title: string; desc: string; to: string; badge?: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(item => (
        <Link key={item.to} to={item.to} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
            {item.badge && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded font-bold">{item.badge}</span>}
          </div>
          <p className="text-xs text-gray-500">{item.desc}</p>
        </Link>
      ))}
    </div>
  );
}

// ── Infrastructure sub-pages ──
export const ContainersPage = () => <PageShell title="Containers" desc="Monitor Docker and Kubernetes containers" />;
export const KubernetesPage = () => <PageShell title="Kubernetes" desc="Monitor clusters, pods, deployments, and services" />;
export const ServerlessPage = () => <PageShell title="Serverless" desc="Monitor AWS Lambda, Azure Functions, and GCP Cloud Functions" />;
export const NetworkPage = () => <PageShell title="Network" desc="Monitor network traffic, topology, and device health" />;
export const ProcessesPage = () => <PageShell title="Processes" desc="Live process monitoring across your infrastructure" />;

// ── APM sub-pages ──
export const DatabaseMonitoringPage = () => <PageShell title="Database Monitoring" desc="Monitor query performance, explain plans, and host metrics" />;
export const DataStreamsPage = () => <PageShell title="Data Streams Monitoring" desc="Track end-to-end pipeline latency and health" />;

// ── Logs sub-pages ──
export const LogsLiveTail = () => <PageShell title="Live Tail" desc="Stream logs in real time across all your services" />;
export const LogsPipelines = () => <PageShell title="Pipelines" desc="Process and transform logs before indexing" />;
export const LogsIndexes = () => <PageShell title="Indexes" desc="Manage log retention and indexing policies" />;

// ── Security sub-pages ──
export const CloudSIEMPage = () => <PageShell title="Cloud SIEM" desc="Real-time threat detection and security log analysis" />;
export const CSMPage = () => <PageShell title="Cloud Security Management" desc="Posture management, vulnerability scanning, and compliance" />;
export const AppSecPage = () => <PageShell title="Application Security" desc="Protect web applications and APIs from threats" />;
export const SensitiveDataPage = () => <PageShell title="Sensitive Data Scanner" desc="Discover and classify sensitive data across your stack" />;
export const CodeSecurityPage = () => <PageShell title="Code Security" desc="Static analysis and vulnerability scanning in your codebase" />;

// ── Digital Experience sub-pages ──
export const RUMPage = () => <PageShell title="Real User Monitoring" desc="Track user sessions, page loads, and frontend errors" />;
export const SyntheticsPage = () => <PageShell title="Synthetic Monitoring" desc="Proactive API and browser testing from global locations" />;
export const SessionReplayPage = () => <PageShell title="Session Replay" desc="Replay user sessions to debug frontend issues" />;

// ── CI Visibility sub-pages ──
export const DORAPage = () => <PageShell title="DORA Metrics" desc="Deployment frequency, lead time, MTTR, and change failure rate" />;

// ── Automation sub-pages ──
export const ActionCatalogPage = () => <PageShell title="Action Catalog" desc="Browse and configure automated remediation actions" />;
export const AppBuilderPage = () => <PageShell title="App Builder" desc="Build custom apps and dashboards without code" />;

// ── Settings / Management ──
export const APMSettingsPage = () => (
  <PageShell title="APM Settings" desc="Configure ingestion, retention, and metric generation">
    <CardGrid items={[
      { title: 'Ingestion Control', desc: 'Configure sampling rates and volume controls', to: '/apm/settings/ingestion' },
      { title: 'Retention Filters', desc: 'Manage trace retention policies', to: '/apm/settings/retention' },
      { title: 'Generate Metrics', desc: 'Create custom metrics from span data', to: '/apm/settings/generate-metrics' },
    ]} />
  </PageShell>
);

export const IntegrationsPage = () => <PageShell title="Integrations" desc="Connect Zerotrace with 1000+ services and tools" />;

/* ════════════════════════ LOGS EXPLORER ════════════════════════ */
const MOCK_LOGS = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  timestamp: new Date(Date.now() - i * 120000 - Math.random() * 3600000).toISOString(),
  level: ['info', 'info', 'info', 'warn', 'error', 'info', 'info', 'debug'][Math.floor(Math.random() * 8)],
  service: ['web-api', 'auth-service', 'payment-worker', 'cache-layer', 'db-proxy'][Math.floor(Math.random() * 5)],
  message: [
    'GET /api/v1/users 200 45ms',
    'POST /api/v1/auth/login 201 120ms',
    'Cache miss for key: user:session:abc123',
    'Connection pool depleted, retrying...',
    'Database query timeout after 5000ms: SELECT * FROM orders',
    'Scheduled job completed: daily_report',
    'Rate limit exceeded for IP 10.0.1.45',
    'Service health check passed',
  ][Math.floor(Math.random() * 8)],
  trace_id: `trace-${Math.random().toString(36).slice(2, 10)}`,
}));

export function LogsExplorerPage() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const levels = ['error', 'warn', 'info', 'debug'];

  const filteredLogs = MOCK_LOGS.filter(l => {
    if (levelFilter && l.level !== levelFilter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase()) && !l.service.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const levelColor: Record<string, string> = { error: 'bg-red-100 text-red-700 border-red-200', warn: 'bg-amber-100 text-amber-700 border-amber-200', info: 'bg-blue-100 text-blue-700 border-blue-200', debug: 'bg-gray-100 text-gray-500 border-gray-200' };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Logs</h2>
          <p className="text-sm text-gray-400 mt-0.5">Search and analyze logs across all services</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 dot-live" />
            Live
          </span>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full h-9 pl-10 pr-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10" />
          </div>
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
            {levels.map(l => (
              <button key={l} onClick={() => setLevelFilter(levelFilter === l ? '' : l)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${levelFilter === l ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-500 hover:text-gray-700'} ${l !== levels[0] ? 'border-l border-gray-200' : ''}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log entries */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <tbody>
              {filteredLogs.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                  <td className="py-2 px-4 text-gray-400 whitespace-nowrap w-[180px]">{new Date(l.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td className="py-2 px-2 w-16">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${levelColor[l.level] || levelColor.info}`}>{l.level.toUpperCase()}</span>
                  </td>
                  <td className="py-2 px-3 text-gray-500 whitespace-nowrap w-[120px]">{l.service}</td>
                  <td className="py-2 px-4 text-gray-700">{l.message}</td>
                  <td className="py-2 px-3 text-gray-400 whitespace-nowrap w-[140px] text-right">{l.trace_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
          <span className="text-xs text-gray-500">Showing {filteredLogs.length} of {MOCK_LOGS.length} log entries</span>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <button className="px-2 py-1 rounded hover:bg-gray-200 transition-colors">Prev</button>
            <button className="px-2 py-1 rounded hover:bg-gray-200 transition-colors">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ TRIGGERED MONITORS ════════════════════════ */
const MOCK_TRIGGERED = [
  { id: 1, name: 'High CPU on web-01', type: 'Metric', status: 'triggered', severity: 'critical', triggered: '2026-06-27 10:45:00', host: 'web-01.prod', message: 'CPU usage > 95% for 5 minutes' },
  { id: 2, name: 'SSL Certificate Expiry', type: 'Integration', status: 'triggered', severity: 'warning', triggered: '2026-06-27 09:30:00', host: 'api.example.com', message: 'SSL cert expires in 7 days' },
  { id: 3, name: 'Disk Space Low on db-02', type: 'Metric', status: 'triggered', severity: 'warning', triggered: '2026-06-27 08:15:00', host: 'db-02.prod', message: 'Disk usage > 85%' },
  { id: 4, name: 'Error Rate Spike', type: 'APM', status: 'triggered', severity: 'critical', triggered: '2026-06-27 07:50:00', host: 'payment-svc', message: 'Error rate exceeded 5% threshold' },
  { id: 5, name: 'Kubernetes Pod CrashLoop', type: 'Metric', status: 'triggered', severity: 'critical', triggered: '2026-06-27 06:20:00', host: 'k8s-cluster-1', message: 'Pod in CrashLoopBackOff state' },
  { id: 6, name: 'Memory Usage Warning', type: 'Metric', status: 'triggered', severity: 'warning', triggered: '2026-06-27 05:10:00', host: 'cache-01.prod', message: 'Memory usage > 80%' },
];

export function TriggeredMonitorsPage() {
  const severityColor: Record<string, string> = { critical: 'text-red-600 bg-red-50', warning: 'text-amber-600 bg-amber-50' };
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Triggered Monitors</h2>
          <p className="text-sm text-gray-400 mt-0.5">{MOCK_TRIGGERED.length} monitors currently triggering</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Mute All</button>
          <button className="px-3 py-1.5 text-xs font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors">Resolve All</button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={[
            { key: 'severity', header: 'Severity', width: '100px', render: (m) => (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${severityColor[m.severity]}`}>{m.severity}</span>
            )},
            { key: 'name', header: 'Monitor', render: (m) => (
              <div><p className="text-sm font-medium text-gray-900">{m.name}</p><p className="text-xs text-gray-400">{m.type} Monitor</p></div>
            )},
            { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} size="sm" /> },
            { key: 'triggered', header: 'Triggered', render: (m) => <span className="text-sm text-gray-500">{m.triggered}</span> },
            { key: 'host', header: 'Host', render: (m) => <span className="text-sm text-gray-600 font-mono">{m.host}</span> },
            { key: 'message', header: 'Message', render: (m) => <span className="text-sm text-gray-500">{m.message}</span> },
          ]}
          rows={MOCK_TRIGGERED}
        />
      </div>
    </div>
  );
}

/* ════════════════════════ NEW MONITOR FORM ════════════════════════ */
export function MonitorCreatePage() {
  const [monitorType, setMonitorType] = useState('metric');
  const types = [
    { key: 'metric', label: 'Metric', desc: 'Alert on any metric value crossing a threshold' },
    { key: 'apm', label: 'APM', desc: 'Alert on error rate, latency, or request rate' },
    { key: 'log', label: 'Log', desc: 'Alert when log patterns match criteria' },
    { key: 'integration', label: 'Integration', desc: 'Monitor 3rd party service health' },
  ];
  return (
    <div className="animate-fade-in" style={{ maxWidth: 720 }}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">New Monitor</h2>
      <p className="text-sm text-gray-400 mb-6">Create a monitor to alert on metrics, logs, and events</p>

      {/* Type selector */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Monitor Type</h3>
        <div className="grid grid-cols-4 gap-3">
          {types.map(t => (
            <button key={t.key} onClick={() => setMonitorType(t.key)}
              className={`text-left p-4 rounded-lg border-2 transition-colors ${monitorType === t.key ? 'border-brand-600 bg-brand-50/30' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{t.label}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-5 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Monitor Name</label>
          <input type="text" placeholder="e.g., High CPU on production servers"
            className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-brand-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Metric</label>
            <select className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-brand-500">
              <option>system.cpu.user</option>
              <option>system.mem.pct_usage</option>
              <option>system.disk.free</option>
              <option>system.net.bytes_rcvd</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Aggregation</label>
            <select className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-brand-500">
              <option>Average</option>
              <option>Maximum</option>
              <option>Minimum</option>
              <option>Sum</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Alert Threshold</label>
          <div className="flex items-center gap-2">
            <select className="h-9 px-3 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-brand-500">
              <option>Above</option><option>Below</option>
            </select>
            <input type="number" defaultValue={90} className="w-24 h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-brand-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notification</label>
          <input type="text" placeholder="@email or @slack-channel"
            className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Tags</label>
          <input type="text" placeholder="env:production, team:platform"
            className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-brand-500" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="px-6 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 transition-colors">Create Monitor</button>
        <button className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

/* ════════════════════════ DOWNTIME MANAGEMENT ════════════════════════ */
const MOCK_DOWNTIMES = [
  { id: 1, name: 'Weekly DB Maintenance', scope: 'host:db-*', schedule: 'Every Sunday 02:00–04:00 UTC', status: 'active', created: '2026-05-01' },
  { id: 2, name: 'Deploy Window', scope: 'service:web-api', schedule: 'Tue/Thu 00:00–01:00 UTC', status: 'active', created: '2026-04-15' },
  { id: 3, name: 'Holiday Blackout', scope: '*', schedule: '2026-12-25 00:00 – 2026-12-26 00:00', status: 'scheduled', created: '2026-06-10' },
  { id: 4, name: 'Migration Downtime', scope: 'host:db-master-*', schedule: '2026-07-01 06:00–12:00 UTC', status: 'scheduled', created: '2026-06-20' },
  { id: 5, name: 'Test Environment Silence', scope: 'env:staging', schedule: 'Weekdays 22:00–06:00 UTC', status: 'active', created: '2026-03-01' },
];

export function DowntimeManagementPage() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Downtimes</h2>
          <p className="text-sm text-gray-400 mt-0.5">Schedule monitor silence periods for maintenance</p>
        </div>
        <button className="px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 transition-colors flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Schedule Downtime
        </button>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <DataTable
          columns={[
            { key: 'name', header: 'Name', render: (d) => <span className="text-sm font-medium text-gray-900">{d.name}</span> },
            { key: 'scope', header: 'Scope', render: (d) => <code className="text-xs bg-gray-50 px-2 py-0.5 rounded text-gray-600">{d.scope}</code> },
            { key: 'schedule', header: 'Schedule', render: (d) => <span className="text-sm text-gray-500">{d.schedule}</span> },
            { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} size="sm" /> },
            { key: 'created', header: 'Created', render: (d) => <span className="text-sm text-gray-400">{d.created}</span> },
            { key: 'actions', header: '', render: () => (
              <div className="flex gap-1">
                <button className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">Edit</button>
                <button className="px-2 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors">Delete</button>
              </div>
            )},
          ]}
          rows={MOCK_DOWNTIMES}
        />
      </div>
    </div>
  );
}
export const FleetPage = () => <PageShell title="Fleet Automation" desc="Install and manage agents at scale" />;
export const IDEPluginsPage = () => <PageShell title="IDE Plugins" desc="Zerotrace integration for VS Code, JetBrains, and more" />;
export const SourceCodePage = () => <PageShell title="Source Code Integration" desc="Link repositories for code-to-telemetry correlation" />;
export const ReferenceTablesPage = () => <PageShell title="Reference Tables" desc="Enrich your telemetry with custom lookup data" />;
export const MarketplacePage = () => <PageShell title="Marketplace" desc="Browse integrations, apps, and add-ons" />;

export const AgentStatusPage = () => <PageShell title="Agent Status" desc="View connected agents and their health" />;
export const AgentUpgradesPage = () => <PageShell title="Agent Upgrades" desc="Manage agent version upgrades across your fleet" />;
export const OnCallTeamsPage = () => <PageShell title="On-Call Teams" desc="Manage on-call schedules and escalation policies" />;
export const OnCallPagesPage = () => <PageShell title="Pages" desc="View and manage incident pages" />;
export const OnCallSettingsPage = () => <PageShell title="On-Call Settings" desc="Configure notification rules and integrations" />;
export const StatusPagesPage = () => <PageShell title="Status Pages" desc="Create and manage public status pages" />;
export const CasesPage = () => <PageShell title="Case Management" desc="Track and manage support cases" />;
