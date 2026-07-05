import { useState } from 'react';
import { DataTable, StatusBadge, TimeRangeSelector, Spinner, EmptyState, KpiCard, Tabs } from '../../components/shared/Components';

/* ═══════════════════ EVENTS ═══════════════════ */
const MOCK_EVENTS = [
  { id: 1, title: 'Deployment completed', source: 'CI/CD', status: 'info', priority: 'normal', date: '2026-06-26T10:30:00Z', tags: ['deploy', 'production'] },
  { id: 2, title: 'CPU spike detected on web-01', source: 'Monitor', status: 'warning', priority: 'high', date: '2026-06-26T10:15:00Z', tags: ['cpu', 'infrastructure'] },
  { id: 3, title: 'Memory usage above threshold', source: 'Monitor', status: 'warning', priority: 'medium', date: '2026-06-26T09:45:00Z', tags: ['memory', 'alert'] },
  { id: 4, title: 'SSL certificate expiring in 7 days', source: 'Security', status: 'error', priority: 'high', date: '2026-06-26T09:00:00Z', tags: ['security', 'ssl'] },
  { id: 5, title: 'Auto-scaling triggered: +2 instances', source: 'Infrastructure', status: 'success', priority: 'normal', date: '2026-06-26T08:30:00Z', tags: ['autoscaling', 'infrastructure'] },
];

export function EventsPage() {
  const [timeRange, setTimeRange] = useState('1h');
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-fg-primary">Events</h2><p className="text-sm text-fg-tertiary mt-1">Monitor and correlate events across your stack</p></div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'status', header: 'Status', width: '80px', render: (e: any) => <StatusBadge status={e.status} /> },
            { key: 'title', header: 'Title', render: (e: any) => <div><span className="text-sm font-medium text-fg-primary">{e.title}</span><p className="text-[11px] text-fg-tertiary">{e.source}</p></div> },
            { key: 'priority', header: 'Priority', width: '90px', render: (e: any) => <span className={`text-xs font-semibold ${e.priority === 'high' ? 'text-accent-danger' : e.priority === 'medium' ? 'text-accent-warning' : 'text-fg-tertiary'}`}>{e.priority}</span> },
            { key: 'date', header: 'Date', width: '140px', render: (e: any) => <span className="text-xs text-fg-tertiary">{new Date(e.date).toLocaleString()}</span> },
            { key: 'tags', header: 'Tags', render: (e: any) => <div className="flex flex-wrap gap-1">{e.tags.map((t: string) => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-bg-muted text-fg-tertiary rounded">{t}</span>)}</div> },
          ]}
          rows={MOCK_EVENTS} emptyMessage="No events"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ INCIDENTS ═══════════════════ */
const MOCK_INCIDENTS = [
  { id: 1, title: 'API latency spike — P99 > 2s', severity: 'critical', status: 'resolved', commander: 'alice@zt.com', created: '2026-06-26T08:00:00Z', duration: '2h 15m' },
  { id: 2, title: 'Database connection pool exhaustion', severity: 'high', status: 'active', commander: 'bob@zt.com', created: '2026-06-26T10:00:00Z', duration: 'ongoing' },
  { id: 3, title: 'CDN cache miss rate elevated', severity: 'medium', status: 'active', commander: '—', created: '2026-06-26T09:30:00Z', duration: '1h 30m' },
];
export function IncidentsPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-xl font-bold text-fg-primary">Incidents</h2><p className="text-sm text-fg-tertiary mt-1">Manage and respond to incidents</p></div>
        <button className="px-4 py-2 bg-accent-primary text-fg-inverse text-sm font-semibold rounded-lg hover:opacity-90 transition-colors">+ Declare Incident</button>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <KpiCard label="Active" value="2" accent="red" />
        <KpiCard label="Resolved (24h)" value="3" accent="green" />
        <KpiCard label="MTTR" value="2h 15m" accent="amber" />
        <KpiCard label="Open Incidents" value="2" accent="default" />
      </div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'severity', header: 'Severity', width: '90px', render: (i: any) => <span className={`text-xs font-bold ${i.severity === 'critical' ? 'text-accent-danger' : i.severity === 'high' ? 'text-accent-warning' : 'text-accent-info'}`}>{i.severity.toUpperCase()}</span> },
            { key: 'title', header: 'Title', render: (i: any) => <span className="text-sm font-medium text-fg-primary">{i.title}</span> },
            { key: 'status', header: 'Status', width: '90px', render: (i: any) => <StatusBadge status={i.status} /> },
            { key: 'commander', header: 'Commander', width: '130px', render: (i: any) => <span className="text-xs text-fg-secondary">{i.commander}</span> },
            { key: 'created', header: 'Created', width: '150px', render: (i: any) => <span className="text-xs text-fg-tertiary">{new Date(i.created).toLocaleString()}</span> },
            { key: 'duration', header: 'Duration', width: '90px', render: (i: any) => <span className="text-xs text-fg-tertiary">{i.duration}</span> },
          ]}
          rows={MOCK_INCIDENTS} emptyMessage="No incidents"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ WATCHDOG ═══════════════════ */
const MOCK_WATCHDOG = [
  { id: 1, finding: 'Unexpected CPU pattern on web-01', story: 'CPU usage deviated 3σ from baseline at 10:15 UTC', service: 'web', status: 'new', severity: 'high', time: '2026-06-26T10:15:00Z' },
  { id: 2, finding: 'Memory leak detected on db-02', story: 'Memory usage trend upward over 4 hours, never returning to baseline', service: 'database', status: 'investigating', severity: 'critical', time: '2026-06-26T08:00:00Z' },
  { id: 3, finding: 'Error rate anomaly in payment-svc', story: '5xx error rate spiked to 4.2% from 0.1% baseline', service: 'payment', status: 'new', severity: 'high', time: '2026-06-26T09:30:00Z' },
];
export function WatchdogPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <div><h2 className="text-xl font-bold text-fg-primary">Watchdog</h2><p className="text-sm text-fg-tertiary mt-1">ML-based anomaly detection across your services</p></div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'severity', header: 'Severity', width: '80px', render: (w: any) => <span className={`text-xs font-bold ${w.severity === 'critical' ? 'text-accent-danger' : w.severity === 'high' ? 'text-accent-warning' : 'text-accent-info'}`}>{w.severity.toUpperCase()}</span> },
            { key: 'finding', header: 'Finding', render: (w: any) => <div><span className="text-sm font-medium text-fg-primary">{w.finding}</span><p className="text-[11px] text-fg-tertiary">{w.story}</p></div> },
            { key: 'service', header: 'Service', width: '120px', render: (w: any) => <span className="text-xs text-fg-secondary">{w.service}</span> },
            { key: 'status', header: 'Status', width: '110px', render: (w: any) => <StatusBadge status={w.status} /> },
            { key: 'time', header: 'Time', width: '150px', render: (w: any) => <span className="text-xs text-fg-tertiary">{new Date(w.time).toLocaleString()}</span> },
          ]}
          rows={MOCK_WATCHDOG} emptyMessage="No anomalies detected"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ SLOs ═══════════════════ */
const MOCK_SLOS = [
  { id: 1, name: 'API Availability', target: '99.95%', current: '99.97%', budget: '85.2%', status: 'healthy', window: '30d' },
  { id: 2, name: 'Login P95 Latency', target: '< 500ms', current: '487ms', budget: '62.1%', status: 'healthy', window: '7d' },
  { id: 3, name: 'Checkout Error Rate', target: '< 0.1%', current: '0.12%', budget: '-12.5%', status: 'error', window: '7d' },
];
export function SLOsPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-fg-primary">SLOs</h2><p className="text-sm text-fg-tertiary mt-1">Service Level Objectives and error budgets</p></div><div className="flex items-center gap-3"><a href="/slo/manage" className="text-xs font-medium text-accent-primary hover:text-accent-primary">Learn More</a><button className="px-4 py-2 bg-accent-primary text-fg-inverse text-sm font-semibold rounded-lg hover:opacity-90 transition-colors">+ New SLO</button></div></div>
      {/* DD: 5 KPI cards — BREACHED / WARNING / OK / NO DATA / TOTAL */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Breached', value: '—', bg: 'bg-accent-danger-bg border-accent-danger/20', text: 'text-accent-danger' },
          { label: 'Warning', value: '—', bg: 'bg-accent-warning-bg border-accent-warning/20', text: 'text-accent-warning' },
          { label: 'OK', value: '—', bg: 'bg-accent-success-bg border-accent-success/20', text: 'text-accent-success' },
          { label: 'No Data', value: '—', bg: 'bg-bg-subtle border-border', text: 'text-fg-tertiary' },
          { label: 'Total', value: '—', bg: 'bg-bg-elevated border-border', text: 'text-fg-primary' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.text}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {/* DD: 7-column table — TYPE / NAME / TIME / TARGET / STATUS / ERROR BUDGET LEFT / TAGS */}
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'type', header: 'Type', width: '80px', render: (s: any) => <span className="text-xs font-medium text-fg-tertiary">{s.type || 'Metric'}</span> },
            { key: 'name', header: 'Name', render: (s: any) => <span className="text-sm font-medium text-fg-primary">{s.name}</span> },
            { key: 'time', header: 'Time', width: '70px', render: (s: any) => <span className="text-xs text-fg-tertiary">{s.window}</span> },
            { key: 'target', header: 'Target', width: '90px', render: (s: any) => <span className="text-sm text-fg-primary font-semibold">{s.target}</span> },
            { key: 'status', header: 'Status', width: '90px', render: (s: any) => <StatusBadge status={s.status} /> },
            { key: 'budget', header: 'Error Budget', width: '110px', render: (s: any) => <span className={`text-sm font-semibold ${parseFloat(s.budget) < 0 ? 'text-accent-danger' : parseFloat(s.budget) < 50 ? 'text-accent-warning' : 'text-accent-success'}`}>{s.budget}</span> },
            { key: 'tags', header: 'Tags', width: '120px', render: (s: any) => <div className="flex flex-wrap gap-1">{(s.tags || ['slo']).map((t: string) => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-bg-muted text-fg-tertiary rounded">{t}</span>)}</div> },
          ]}
          rows={MOCK_SLOS} emptyMessage="No matching results found"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ ERROR TRACKING ═══════════════════ */
const MOCK_ERRORS = [
  { id: 1, error: 'NullPointerException in OrderService.process()', type: 'RuntimeException', occurrences: 142, firstSeen: '2026-06-26T08:00:00Z', lastSeen: '2026-06-26T10:30:00Z', status: 'active' },
  { id: 2, error: 'ConnectionTimeout to external-payment-api', type: 'IOException', occurrences: 87, firstSeen: '2026-06-26T09:00:00Z', lastSeen: '2026-06-26T10:25:00Z', status: 'active' },
  { id: 3, error: 'ValidationError: email format invalid', type: 'ValidationError', occurrences: 23, firstSeen: '2026-06-26T10:00:00Z', lastSeen: '2026-06-26T10:28:00Z', status: 'resolved' },
];
export function ErrorTrackingPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <div><h2 className="text-xl font-bold text-fg-primary">Error Tracking</h2><p className="text-sm text-fg-tertiary mt-1">Track and resolve application errors</p></div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'error', header: 'Error', render: (e: any) => <div><span className="text-sm font-medium text-fg-primary font-mono">{e.error}</span><p className="text-[11px] text-fg-tertiary">{e.type}</p></div> },
            { key: 'occurrences', header: 'Count', width: '80px', align: 'right', render: (e: any) => <span className="text-sm font-bold text-fg-primary">{e.occurrences}</span> },
            { key: 'firstSeen', header: 'First Seen', width: '140px', render: (e: any) => <span className="text-xs text-fg-tertiary">{new Date(e.firstSeen).toLocaleString()}</span> },
            { key: 'lastSeen', header: 'Last Seen', width: '140px', render: (e: any) => <span className="text-xs text-fg-tertiary">{new Date(e.lastSeen).toLocaleString()}</span> },
            { key: 'status', header: 'Status', width: '90px', render: (e: any) => <StatusBadge status={e.status} /> },
          ]}
          rows={MOCK_ERRORS} emptyMessage="No errors"
        />
      </div>
    </div>
  );
}

/* ═══════════════════ PROFILING ═══════════════════ */
const MOCK_PROFILES = [
  { id: 1, service: 'web-api', language: 'Go', cpu: '23.5%', memory: '1.2 GB', goroutines: 452, lastProfile: '2026-06-26T10:30:00Z' },
  { id: 2, service: 'payment-worker', language: 'Java', cpu: '45.2%', memory: '3.8 GB', threads: 128, lastProfile: '2026-06-26T10:28:00Z' },
  { id: 3, service: 'user-auth', language: 'Rust', cpu: '8.1%', memory: '256 MB', threads: 16, lastProfile: '2026-06-26T10:29:00Z' },
];
export function ProfilingPage() {
  return (
    <div className="animate-fade-in space-y-4">
      <div><h2 className="text-xl font-bold text-fg-primary">Continuous Profiler</h2><p className="text-sm text-fg-tertiary mt-1">Code-level performance analysis across your services</p></div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <KpiCard label="Services Profiled" value="3" accent="purple" />
        <KpiCard label="Avg CPU" value="25.6%" accent="amber" />
        <KpiCard label="Avg Memory" value="1.75 GB" accent="blue" />
        <KpiCard label="Last Profile" value="2 min ago" accent="default" />
      </div>
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={[
            { key: 'service', header: 'Service', render: (p: any) => <span className="text-sm font-medium text-fg-primary">{p.service}</span> },
            { key: 'language', header: 'Language', width: '80px', render: (p: any) => <span className="text-xs px-2 py-1 bg-bg-muted rounded text-fg-secondary">{p.language}</span> },
            { key: 'cpu', header: 'CPU', width: '80px', align: 'right', render: (p: any) => <span className="text-sm font-semibold text-fg-primary">{p.cpu}</span> },
            { key: 'memory', header: 'Memory', width: '90px', align: 'right', render: (p: any) => <span className="text-sm font-semibold text-fg-primary">{p.memory}</span> },
            { key: 'goroutines', header: 'Threads/Goroutines', width: '110px', align: 'right', render: (p: any) => <span className="text-sm text-fg-secondary">{p.goroutines || p.threads}</span> },
            { key: 'lastProfile', header: 'Last Profile', width: '150px', render: (p: any) => <span className="text-xs text-fg-tertiary">{new Date(p.lastProfile).toLocaleString()}</span> },
          ]}
          rows={MOCK_PROFILES} emptyMessage="No profiled services"
        />
      </div>
    </div>
  );
}
