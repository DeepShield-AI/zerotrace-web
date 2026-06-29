import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, TimeRangeSelector, Spinner, EmptyState, DataTable } from '../components/Components';

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
  const m: Record<string, string> = { P1: 'text-red-600', P2: 'text-amber-600', P3: 'text-yellow-600', P4: 'text-blue-600', P5: 'text-gray-500' };
  return m[p] || 'text-gray-500';
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
          <h2 className="text-xl font-bold text-gray-900">Monitors</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage and configure monitoring alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <Link to="/monitors/create" className="inline-flex items-center px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-md hover:bg-brand-700 transition-colors">
            + New Monitor
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Total</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-red-400">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Alerting</p>
          <p className="text-xl font-bold text-red-600">{stats.alerting}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-amber-400">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Warning</p>
          <p className="text-xl font-bold text-amber-600">{stats.warning}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Muted</p>
          <p className="text-xl font-bold text-gray-400">{stats.muted}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter monitors..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all capitalize ${
                statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{s === 'all' ? 'All' : s.replace('_', ' ')}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">Export</button>
          <Link to="/monitors/downtimes" className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">Downtimes</Link>
        </div>
      </div>

      {/* Monitor table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
              render: (m: Monitor) => m.muted ? <span className="text-amber-500 text-xs font-medium">Muted</span> : <span className="text-gray-300">—</span>,
            },
            {
              key: 'name', header: 'Name',
              render: (m: Monitor) => (
                <div>
                  <Link to={`/monitors/${m.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600 transition-colors">{m.name}</Link>
                  <p className="text-[11px] text-gray-400">{m.type}</p>
                </div>
              ),
            },
            {
              key: 'tags', header: 'Tags',
              render: (m: Monitor) => (
                <div className="flex flex-wrap gap-1">
                  {m.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{tag}</span>
                  ))}
                </div>
              ),
            },
          ]}
          rows={filtered}
          emptyMessage="No monitors found"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{filtered.length} of {MOCK_MONITORS.length} monitors</span>
        <span>Auto-refresh: 30s</span>
      </div>
    </div>
  );
}
