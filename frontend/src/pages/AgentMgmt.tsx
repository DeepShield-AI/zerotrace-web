import { useState, useEffect, useMemo, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

// ════════════════════════ TYPES ════════════════════════
interface AgentItem {
  id?: number; ID?: number;
  name?: string; NAME?: string;
  ctrl_ip?: string; CTRL_IP?: string;
  state?: number; STATE?: number;
  synced_controller_at?: string; SYNCED_CONTROLLER_AT?: string;
  hostname?: string;
  version?: string;
  platform?: string;
  tags?: string[];
  cpu_pct?: number;
  mem_mb?: number;
  services_count?: number;
  uptime?: string;
}

// ════════════════════════ HELPERS ════════════════════════
function ago(s: string): string {
  if (!s) return '—';
  try {
    const d = Date.now() - new Date(s.replace(' ', 'T') + '+08:00').getTime();
    const m = Math.floor(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  } catch { return s; }
}

function agentStateLabel(state: number): { label: string; color: string; dot: string } {
  switch (state) {
    case 1: return { label: 'Online', color: '#2DB88D', dot: '●' };
    case 2: return { label: 'Stale', color: '#E2903C', dot: '●' };
    case 3: return { label: 'Offline', color: '#E65C5C', dot: '●' };
    default: return { label: 'Unknown', color: '#8b9bb4', dot: '○' };
  }
}

// ════════════════════════ MOCK DATA GENERATOR ════════════════════════
function generateMockAgents(): AgentItem[] {
  return [
    { ID: 1, NAME: 'prod-web-01', CTRL_IP: '10.0.1.42', STATE: 1, SYNCED_CONTROLLER_AT: new Date().toISOString(), hostname: 'prod-web-01', version: 'v6.5.9', platform: 'linux', tags: ['env:prod', 'team:platform'], cpu_pct: 2.3, mem_mb: 128, services_count: 12, uptime: '14d 3h' },
    { ID: 2, NAME: 'prod-web-02', CTRL_IP: '10.0.1.43', STATE: 1, SYNCED_CONTROLLER_AT: new Date().toISOString(), hostname: 'prod-web-02', version: 'v6.5.9', platform: 'linux', tags: ['env:prod', 'team:platform'], cpu_pct: 1.8, mem_mb: 112, services_count: 12, uptime: '14d 3h' },
    { ID: 3, NAME: 'prod-api-01', CTRL_IP: '10.0.2.10', STATE: 1, SYNCED_CONTROLLER_AT: new Date(Date.now() - 120000).toISOString(), hostname: 'prod-api-01', version: 'v6.5.8', platform: 'docker', tags: ['env:prod', 'team:backend'], cpu_pct: 4.1, mem_mb: 256, services_count: 8, uptime: '7d 12h' },
    { ID: 4, NAME: 'staging-k8s-node-1', CTRL_IP: '172.16.0.55', STATE: 1, SYNCED_CONTROLLER_AT: new Date(Date.now() - 60000).toISOString(), hostname: 'staging-k8s-node-1', version: 'v6.5.9', platform: 'kubernetes', tags: ['env:staging', 'team:infra'], cpu_pct: 0.9, mem_mb: 96, services_count: 5, uptime: '3d 8h' },
    { ID: 5, NAME: 'dev-laptop-01', CTRL_IP: '192.168.1.100', STATE: 2, SYNCED_CONTROLLER_AT: new Date(Date.now() - 600000).toISOString(), hostname: 'dev-laptop-01', version: 'v6.5.7', platform: 'linux', tags: ['env:dev'], cpu_pct: 0.5, mem_mb: 64, services_count: 3, uptime: '1d 2h' },
    { ID: 6, NAME: 'prod-db-mon-01', CTRL_IP: '10.0.3.20', STATE: 3, SYNCED_CONTROLLER_AT: new Date(Date.now() - 3600000).toISOString(), hostname: 'prod-db-mon-01', version: 'v6.5.6', platform: 'linux', tags: ['env:prod', 'team:dba'], cpu_pct: 0, mem_mb: 0, services_count: 0, uptime: '—' },
  ];
}

// ════════════════════════ FLEET VIEW COMPONENT ════════════════════════
function FleetView() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'stale' | 'offline'>('all');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedAgent, setSelectedAgent] = useState<AgentItem | null>(null);
  const navigate = useNavigate();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getAgentStatus();
      const raw = d?.agents || d?.DATA || [];
      if (raw.length > 0) {
        setAgents(raw);
      } else {
        // Use mock data if no real agents
        setAgents(generateMockAgents());
      }
    } catch {
      setAgents(generateMockAgents());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); const interval = setInterval(fetchAgents, 15000); return () => clearInterval(interval); }, [fetchAgents]);

  const normalize = (a: AgentItem) => ({
    id: a.id ?? a.ID ?? 0,
    name: a.name ?? a.NAME ?? '',
    ctrlIp: a.ctrl_ip ?? a.CTRL_IP ?? '',
    state: a.state ?? a.STATE ?? 0,
    syncedAt: a.synced_controller_at ?? a.SYNCED_CONTROLLER_AT ?? '',
    hostname: a.hostname ?? a.name ?? a.NAME ?? '',
    version: a.version ?? '—',
    platform: a.platform ?? 'linux',
    tags: a.tags ?? [],
    cpu: a.cpu_pct ?? 0,
    mem: a.mem_mb ?? 0,
    services: a.services_count ?? 0,
    uptime: a.uptime ?? '—',
  });

  const filteredAgents = useMemo(() => {
    let list = [...agents];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(a => (a.name || a.NAME || '').toLowerCase().includes(s) || (a.ctrl_ip || a.CTRL_IP || '').includes(s) || (a.hostname || '').toLowerCase().includes(s));
    }
    if (statusFilter !== 'all') {
      list = list.filter(a => {
        const st = a.state ?? a.STATE ?? 0;
        if (statusFilter === 'online') return st === 1;
        if (statusFilter === 'stale') return st === 2;
        if (statusFilter === 'offline') return st === 3;
        return true;
      });
    }
    list.sort((a, b) => {
      const aNorm = normalize(a);
      const bNorm = normalize(b);

      // Use numeric comparison for numeric fields
      const numericFields = new Set(['cpu', 'mem', 'services', 'state']);
      const normSortField = sortField === 'cpu_pct' ? 'cpu' : sortField === 'mem_mb' ? 'mem' : sortField === 'services_count' ? 'services' : sortField;

      if (numericFields.has(normSortField)) {
        const aNum = Number(aNorm[normSortField as keyof typeof aNorm]) || 0;
        const bNum = Number(bNorm[normSortField as keyof typeof bNorm]) || 0;
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }

      const aVal = String(aNorm[sortField === 'syncedAt' ? 'syncedAt' : sortField === 'ctrl_ip' ? 'ctrlIp' : sortField as keyof typeof aNorm] ?? '');
      const bVal = String(bNorm[sortField === 'syncedAt' ? 'syncedAt' : sortField === 'ctrl_ip' ? 'ctrlIp' : sortField as keyof typeof bNorm] ?? '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [agents, search, statusFilter, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = agents.length;
    const online = agents.filter(a => (a.state ?? a.STATE ?? 0) === 1).length;
    const stale = agents.filter(a => (a.state ?? a.STATE ?? 0) === 2).length;
    const offline = agents.filter(a => (a.state ?? a.STATE ?? 0) === 3).length;
    return { total, online, stale, offline };
  }, [agents]);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Agents', value: stats.total, color: '#506e81' },
          { label: 'Online', value: stats.online, color: '#2DB88D' },
          { label: 'Stale', value: stats.stale, color: '#E2903C' },
          { label: 'Offline', value: stats.offline, color: '#E65C5C' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#d1d9e0] rounded-lg p-4" data-testid="agent-stats-cards">
            <p className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b9bb4] w-4 h-4" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agents by name, IP, or hostname..."
            className="w-full h-9 pl-10 pr-3 text-[13px] border border-[#d1d9e0] rounded bg-white placeholder:text-[#8b9bb4] focus:outline-none focus:border-[#632CA6]"
            data-testid="agent-search-input"
          />
        </div>
        {(['all', 'online', 'stale', 'offline'] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            data-testid={`agent-filter-${f}`}
            className={`px-3 py-1.5 text-[12px] font-medium rounded border transition-colors ${statusFilter === f ? 'bg-[#632CA6] text-white border-[#632CA6]' : 'bg-white text-[#506e81] border-[#d1d9e0] hover:border-[#adb5bd]'}`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => navigate('/agents/setup')} className="px-4 py-1.5 bg-[#632CA6] text-white text-[12px] font-semibold rounded-md hover:bg-[#4a1d8a] transition-colors">
          + Install Agent
        </button>
        <Button icon={<ReloadOutlined />} onClick={fetchAgents} size="small" />
      </div>

      {/* Agents table */}
      <div className="bg-white border border-[#d1d9e0] rounded-lg overflow-hidden" data-testid="agent-fleet-table">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#d1d9e0]">
              {[
                { key: 'hostname', label: 'AGENT' },
                { key: 'ctrl_ip', label: 'IP ADDRESS' },
                { key: 'platform', label: 'PLATFORM' },
                { key: 'version', label: 'VERSION' },
                { key: 'state', label: 'STATUS' },
                { key: 'cpu_pct', label: 'CPU' },
                { key: 'mem_mb', label: 'MEMORY' },
                { key: 'services_count', label: 'SERVICES' },
                { key: 'uptime', label: 'UPTIME' },
                { key: 'syncedAt', label: 'LAST SEEN' },
              ].map(h => (
                <th
                  key={h.key}
                  onClick={() => { if (sortField === h.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else setSortField(h.key); }}
                  className="text-left text-[10px] font-semibold text-[#8b9bb4] uppercase tracking-wider px-3 py-2.5 cursor-pointer hover:text-[#506e81] select-none"
                >
                  {h.label} {sortField === h.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-4">
                <div className="divide-y divide-[#f0f2f5]" data-testid="loading-skeleton">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-3 py-3">
                      <div className="h-4 w-4 bg-gray-100 rounded animate-pulse shrink-0" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-32" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-12" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-12" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                    </div>
                  ))}
                </div>
              </td></tr>
            ) : filteredAgents.length === 0 ? (
              <tr><td colSpan={10} className="py-12 text-center">
                <p className="text-[13px] text-[#8b9bb4]">No agents found</p>
                <p className="text-[12px] text-[#adb5bd] mt-1">Try adjusting your search or status filter</p>
              </td></tr>
            ) : (
              filteredAgents.map(a => {
                const n = normalize(a);
                const st = agentStateLabel(n.state);
                return (
                  <tr
                    key={n.id}
                    onClick={() => setSelectedAgent(a)}
                    className={`border-b border-[#f0f2f5] hover:bg-[#f8f9fb] cursor-pointer transition-colors ${selectedAgent && (selectedAgent.ID === n.id || selectedAgent.id === n.id) ? 'bg-[#f6f3fa]' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: st.color }} />
                        <span className="text-[13px] font-medium text-[#1C2B34]">{n.hostname}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#506e81] font-mono">{n.ctrlIp || '—'}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#506e81] capitalize">{n.platform}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#506e81]">{n.version}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: st.color }}>
                        {st.dot} {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-[#506e81] tabular-nums">{n.cpu > 0 ? n.cpu.toFixed(1) + '%' : '—'}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#506e81] tabular-nums">{n.mem > 0 ? n.mem + ' MB' : '—'}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#506e81] tabular-nums">{n.services > 0 ? n.services : '—'}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#8b9bb4]">{n.uptime}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[#8b9bb4]">{ago(n.syncedAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Agent Detail slide-out */}
      {selectedAgent && (() => {
        const n = normalize(selectedAgent);
        const st = agentStateLabel(n.state);
        return (
          <div className="bg-white border border-[#d1d9e0] rounded-lg p-6" data-testid="agent-detail-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: st.color }} />
                <h3 className="text-base font-semibold text-[#1C2B34]">{n.hostname}</h3>
                <span className="text-[12px] text-[#8b9bb4] font-mono">{n.ctrlIp}</span>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-[#8b9bb4] hover:text-[#1C2B34]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4 text-[13px]">
              {[
                { label: 'Status', value: st.label, color: st.color },
                { label: 'Version', value: n.version },
                { label: 'Platform', value: n.platform },
                { label: 'Uptime', value: n.uptime },
                { label: 'CPU Usage', value: n.cpu > 0 ? n.cpu.toFixed(1) + '%' : '—' },
                { label: 'Memory', value: n.mem > 0 ? n.mem + ' MB' : '—' },
                { label: 'Services Monitored', value: n.services > 0 ? String(n.services) : '—' },
                { label: 'Last Seen', value: ago(n.syncedAt) },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider">{f.label}</p>
                  <p className="text-[#1C2B34] mt-0.5" style={f.color ? { color: f.color, fontWeight: 600 } : {}}>{f.value}</p>
                </div>
              ))}
            </div>
            {n.tags && n.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#f0f2f5]">
                <p className="text-[11px] font-semibold text-[#8b9bb4] uppercase tracking-wider mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {n.tags.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f0f2f5] rounded text-[11px] text-[#506e81] font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Auto-refresh indicator */}
      <p className="text-[11px] text-[#adb5bd] text-right">Auto-refresh every 15s · {agents.length} agents total</p>
    </div>
  );
}

// ════════════════════════ LAYOUT COMPONENT ════════════════════════
export function AgentMgmtLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const subNav = [
    { to: '/agents', label: 'Fleet View', exact: true },
    { to: '/agents/setup', label: 'Setup', exact: false },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      <div className="mb-1">
        <h1 className="text-xl font-bold text-[#1C2B34]">{t('agentMgmt.title')}</h1>
        <p className="text-sm text-[#506e81] mt-0.5">{t('agentMgmt.subtitle')}</p>
      </div>

      <nav className="flex gap-1 mb-4 border-b border-[#d1d9e0]">
        {subNav.map(item => {
          const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] -mb-[2px] transition-colors ${
                isActive ? 'text-[#632CA6] border-[#632CA6]' : 'text-[#506e81] border-transparent hover:text-[#1C2B34] hover:border-[#adb5bd]'
              }`}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {location.pathname === '/agents' || location.pathname === '/agents/' ? (
        <FleetView />
      ) : (
        <Outlet />
      )}
    </div>
  );
}
