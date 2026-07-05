import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, TimeRangeSelector, Spinner, EmptyState, DataTable } from '../components/shared/Components';

interface Monitor {
  id: number;
  name: string;
  status: 'ok' | 'alert' | 'warn' | 'no_data';
  priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  muted: boolean;
  tags: string[];
  type: string;
  last_triggered?: string;
}

const MOCK_MONITORS: Monitor[] = [
  { id: 1, name: 'Host OK monitor', status: 'ok', priority: 'P1', muted: false, tags: ['host', 'infrastructure'], type: 'metric alert', last_triggered: '2026-06-26T10:00:00Z' },
  { id: 2, name: 'CPU usage above 90%', status: 'warn', priority: 'P2', muted: false, tags: ['cpu', 'infrastructure'], type: 'metric alert', last_triggered: '2026-06-26T09:30:00Z' },
  { id: 3, name: 'Disk space below 10%', status: 'alert', priority: 'P1', muted: false, tags: ['disk', 'storage'], type: 'metric alert', last_triggered: '2026-06-26T09:15:00Z' },
  { id: 4, name: 'Service latency P95 > 500ms', status: 'ok', priority: 'P2', muted: true, tags: ['apm', 'latency'], type: 'metric alert', last_triggered: '2026-06-25T22:00:00Z' },
  { id: 5, name: 'Error rate above 1%', status: 'alert', priority: 'P3', muted: false, tags: ['errors', 'apm'], type: 'metric alert', last_triggered: '2026-06-26T10:01:00Z' },
  { id: 6, name: 'Kubernetes Pod Restarts', status: 'ok', priority: 'P2', muted: false, tags: ['k8s', 'containers'], type: 'metric alert', last_triggered: '2026-06-24T15:00:00Z' },
  { id: 7, name: 'SSL Certificate Expiry', status: 'warn', priority: 'P1', muted: false, tags: ['ssl', 'security'], type: 'integration', last_triggered: '2026-06-26T08:00:00Z' },
  { id: 8, name: 'Memory usage above 85%', status: 'ok', priority: 'P3', muted: false, tags: ['memory', 'infrastructure'], type: 'metric alert', last_triggered: '2026-06-25T12:30:00Z' },
  { id: 9, name: 'Database connection pool 90%', status: 'warn', priority: 'P2', muted: false, tags: ['db', 'postgres'], type: 'metric alert', last_triggered: '2026-06-26T07:45:00Z' },
  { id: 10, name: 'Log error spike detected', status: 'alert', priority: 'P4', muted: false, tags: ['logs', 'errors'], type: 'log alert', last_triggered: '2026-06-26T11:00:00Z' },
  { id: 11, name: 'API response time > 2s', status: 'ok', priority: 'P2', muted: true, tags: ['apm', 'api', 'latency'], type: 'metric alert', last_triggered: '2026-06-23T18:00:00Z' },
  { id: 12, name: 'Ingestion rate anomaly', status: 'ok', priority: 'P5', muted: false, tags: ['apm', 'ingestion'], type: 'anomaly', last_triggered: '2026-06-20T10:00:00Z' },
];

const priorityColor = (p: string) => {
  const m: Record<string, string> = { P1: 'text-accent-danger', P2: 'text-accent-warning', P3: 'text-yellow-600', P4: 'text-accent-info', P5: 'text-fg-tertiary' };
  return m[p] || 'text-fg-tertiary';
};

export default function Monitors() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('1h');
  const [sortKey, setSortKey] = useState<string>('priority');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const stats = useMemo(() => ({
    total: MOCK_MONITORS.length,
    alerting: MOCK_MONITORS.filter(m => m.status === 'alert').length,
    warning: MOCK_MONITORS.filter(m => m.status === 'warn').length,
    muted: MOCK_MONITORS.filter(m => m.muted).length,
  }), []);

  const filtered = useMemo(() => {
    let m = MOCK_MONITORS;
    if (search) m = m.filter(x => x.name.toLowerCase().includes(search.toLowerCase()) || x.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
    if (statusFilter !== 'all') m = m.filter(x => x.status === statusFilter);
    m.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'priority') { const p = ['P1','P2','P3','P4','P5']; cmp = p.indexOf(a.priority) - p.indexOf(b.priority); }
      else if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return m;
  }, [search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const statusOptions = ['all', 'ok', 'alert', 'warn', 'no_data'];

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-fg-primary">Monitors</h2>
          <p className="text-sm text-fg-tertiary mt-0.5">Manage and configure monitoring alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <Link to="/monitors/create" className="inline-flex items-center px-4 py-2.5 bg-accent-primary text-fg-inverse text-sm font-semibold rounded-md hover:opacity-90 transition-colors">
            + New Monitor
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
          <p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">Total</p>
          <p className="text-xl font-bold text-fg-primary">{stats.total}</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-4 border-l-4 border-l-red-400">
          <p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">Alerting</p>
          <p className="text-xl font-bold text-accent-danger">{stats.alerting}</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-4 border-l-4 border-l-amber-400">
          <p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">Warning</p>
          <p className="text-xl font-bold text-accent-warning">{stats.warning}</p>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
          <p className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1">Muted</p>
          <p className="text-xl font-bold text-fg-tertiary">{stats.muted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter monitors..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="flex gap-1 bg-bg-muted rounded-md p-0.5">
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all capitalize ${
                statusFilter === s ? 'bg-bg-elevated text-fg-primary shadow-sm' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button className="px-3 py-1.5 text-xs font-medium text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted rounded transition-colors">Export</button>
          <Link to="/monitors/downtimes" className="px-3 py-1.5 text-xs font-medium text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted rounded transition-colors">Downtimes</Link>
        </div>
      </div>

      {/* Monitor table */}
      <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden">
        <DataTable
          columns={[
            {
              key: 'priority', header: 'Priority', width: '80px', align: 'center',
              render: (m: Monitor) => <span className={`text-xs font-bold ${priorityColor(m.priority)}`}>{m.priority}</span>,
            },
            {
              key: 'status', header: 'Status', width: '100px',
              render: (m: Monitor) => <StatusBadge status={m.status} />,
            },
            {
              key: 'muted', header: 'Muted', width: '70px', align: 'center',
              render: (m: Monitor) => m.muted ? <span className="text-accent-warning text-xs font-medium">Muted</span> : <span className="text-fg-disabled">—</span>,
            },
            {
              key: 'name', header: 'Name',
              render: (m: Monitor) => (
                <div>
                  <Link to={`/monitors/${m.id}`} className="text-sm font-medium text-fg-primary hover:text-accent-primary transition-colors">{m.name}</Link>
                  <p className="text-[11px] text-fg-tertiary">{m.type}</p>
                </div>
              ),
            },
            {
              key: 'tags', header: 'Tags',
              render: (m: Monitor) => (
                <div className="flex flex-wrap gap-1">
                  {m.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-bg-muted text-fg-tertiary rounded">{tag}</span>
                  ))}
                </div>
              ),
            },
          ]}
          rows={filtered}
          emptyMessage="No monitors found"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-fg-tertiary">
        <span>{filtered.length} of {MOCK_MONITORS.length} monitors</span>
        <span>Auto-refresh: 30s</span>
      </div>
    </div>
  );
}
