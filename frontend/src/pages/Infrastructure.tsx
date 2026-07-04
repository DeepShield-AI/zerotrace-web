import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Spin, Select, Button, message } from 'antd';
import { ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { AgentItem, DataOverviewResponse, L4Stats, L7Stats, TopEndpoint, TopTalker, FlowRatePoint, L4BandwidthPoint, L7RatePoint } from '../api/types';
import { isOnline, isStale } from '../utils/format';
import InfrastructureDirectory from '../components/InfrastructureDirectory';
import HostDetailPanel from '../components/HostDetailPanel';
import StatsBar from '../components/StatsBar';
import HostTable from '../components/HostTable';
import HostMap from '../components/HostMap';
import TopEndpoints from '../components/TopEndpoints';

/* ── Saved Views persistence ── */
const VIEW_STORAGE_KEY = 'infrastructure-view';

interface SavedView {
  range: string;
  sortKey: string;
  sortDir: string;
  groupBy: string;
  infraView: string;
  searchQuery: string;
}

function loadView(): Partial<SavedView> {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveView(view: Partial<SavedView>) {
  try {
    const saved = loadView();
    const merged = { ...saved, ...view };
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

import TimeRangePicker, { parseRange } from '../components/TimeRangePicker';

/* ── Quick nav tabs ── */

function NavTabs({ active }: { active: string }) {
  const { t } = useTranslation();
  const tabs = [
    { key: 'hosts', label: t('infrastructure.navHosts', { defaultValue: 'Hosts' }) },
    { key: 'containers', label: t('infrastructure.navContainers', { defaultValue: 'Containers' }) },
    { key: 'processes', label: t('infrastructure.navProcesses', { defaultValue: 'Processes' }) },
  ];

  return (
    <div className="flex items-center gap-1 mb-4 border-b border-border">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-all relative
            ${active === tab.key ? 'text-accent-primary' : 'text-fg-tertiary hover:text-fg-secondary'}`}
        >
          {tab.label}
          {active === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}

import InfraToolbar from '../components/InfraToolbar';

/* ── Keyboard shortcut hint ── */

function KeyboardHint({ visible, shortcut, label }: { visible: boolean; shortcut: string; label: string }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-bg-inverse text-fg-inverse px-4 py-2 rounded-lg shadow-xl text-[12px] z-50 flex items-center gap-3 animate-fade-in">
      <kbd className="bg-bg-elevated/20 text-fg-inverse/80 px-1.5 py-0.5 rounded text-[11px] font-mono">{shortcut}</kbd>
      <span>{label}</span>
    </div>
  );
}

/* ── Main Page ── */

export default function Infrastructure() {
  const { t } = useTranslation();
  const searchRef = useRef<HTMLInputElement>(null);

  const saved = useMemo(() => loadView(), []);

  // Restore saved view state
  const [data, setData] = useState<DataOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(saved.range || '30m');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedHost, setSelectedHost] = useState('');
  const [detailHost, setDetailHost] = useState<AgentItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'seen'>((saved.sortKey as any) || 'status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>((saved.sortDir as any) || 'asc');
  const [searchQuery, setSearchQuery] = useState(saved.searchQuery || '');
  const [groupBy, setGroupBy] = useState(saved.groupBy || 'none');
  const [infraView, setInfraView] = useState<'table' | 'map'>((saved.infraView as any) || 'table');
  const [keyboardHint, setKeyboardHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [activeNav, setActiveNav] = useState<'hosts' | 'containers' | 'processes'>('hosts');
  const [processes, setProcesses] = useState<any[]>([]);
  const [hostsData, setHostsData] = useState<any[]>([]);

  const { start, end } = parseRange(range);

  // Persist view state
  useEffect(() => {
    saveView({ range, sortKey, sortDir, groupBy, infraView, searchQuery });
  }, [range, sortKey, sortDir, groupBy, infraView, searchQuery]);

  // Show keyboard hint
  const showHint = useCallback((shortcut: string, label: string) => {
    setKeyboardHint(`${shortcut}: ${label}`);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setKeyboardHint(null), 2000);
  }, []);

  const fetch = useCallback(async () => {
    try {
      const [overview, hosts, procs] = await Promise.all([
        api.getDataOverview({ start, end }),
        api.getInfraHosts({ start, end }).catch(() => ({ hosts: [] })),
        api.getInfraProcesses({ start, end }).catch(() => ({ processes: [] })),
      ]);
      setData(overview);
      setHostsData(hosts.hosts || []);
      setProcesses(procs.processes || []);
      setLastUpdated(new Date());
    } catch { /* keep previous data */ }
    finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { fetch(); }, [fetch]);

  // Adaptive polling: slow down when tab is hidden
  useEffect(() => {
    const updateInterval = () => {
      setRefreshInterval(document.hidden ? 30000 : 10000);
    };
    document.addEventListener('visibilitychange', updateInterval);
    return () => document.removeEventListener('visibilitychange', updateInterval);
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      api.getDataOverview({ start, end }).then(d => { setData(d); setLastUpdated(new Date()); }).catch(() => {});
    }, refreshInterval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [start, end, refreshInterval]);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't capture when in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          searchRef.current?.focus();
          showHint('/', 'Focus search');
          break;
        case 'r':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            fetch();
            showHint('R', 'Refresh data');
          }
          break;
        case 'Escape':
          if (detailOpen) {
            setDetailOpen(false);
            setDetailHost(null);
            showHint('Esc', 'Close detail panel');
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fetch, detailOpen, showHint]);

  // Use hostsData from GET /infra/hosts (enriched with metrics) when available,
  // fall back to getDataOverview's agent list for backward compatibility
  const agents: any[] = hostsData.length > 0 ? hostsData : (data?.agents?.list || []);
  const l4: L4Stats = (data?.l4_stats || [])[0] || { cnt: 0, tx: 0, rx: 0 };
  const l7: L7Stats = (data?.l7_stats || [])[0] || { cnt: 0 };
  const topL7: TopEndpoint[] = data?.top_l7 || [];
  const topL4: TopTalker[] = data?.top_l4 || [];
  const flowRate: FlowRatePoint[] = data?.flow_rate || [];
  const l4Bandwidth: L4BandwidthPoint[] = data?.l4_bandwidth || [];
  const l7Rate: L7RatePoint[] = data?.l7_rate || [];

  const searchedAgents = useMemo(() => {
    if (!searchQuery) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(a => a.NAME.toLowerCase().includes(q) || a.CTRL_IP.toLowerCase().includes(q));
  }, [agents, searchQuery]);

  const filteredAgents = useMemo(() => {
    let list = selectedHost
      ? searchedAgents.filter(a => a.NAME === selectedHost || a.CTRL_IP === selectedHost)
      : [...searchedAgents];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.NAME.localeCompare(b.NAME); break;
        case 'status': {
          cmp = (isOnline(a) ? 0 : isStale(a) ? 1 : 2) - (isOnline(b) ? 0 : isStale(b) ? 1 : 2);
          break;
        }
        case 'seen': cmp = (a.SYNCED_CONTROLLER_AT || '').localeCompare(b.SYNCED_CONTROLLER_AT || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [searchedAgents, selectedHost, sortKey, sortDir]);

  const statsData = useMemo(() => ({
    l4: { cnt: l4.cnt, tx: l4.tx, rx: l4.rx },
    l7: { cnt: l7.cnt },
    flowRate, l4Bandwidth, l7Rate,
  }), [l4, l7, flowRate, l4Bandwidth, l7Rate]);

  // ── Export ──
  const handleExport = useCallback((format: 'csv' | 'json') => {
    try {
      let content: string;
      let filename: string;
      const hostData = filteredAgents.map(a => ({
        hostname: a.NAME,
        ip: a.CTRL_IP,
        status: isOnline(a) ? 'Online' : isStale(a) ? 'Stale' : 'Offline',
        lastSeen: a.SYNCED_CONTROLLER_AT || '',
      }));

      if (format === 'json') {
        content = JSON.stringify(hostData, null, 2);
        filename = `infrastructure-hosts-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        const headers = ['Hostname', 'IP', 'Status', 'Last Seen'];
        const rows = hostData.map(h => [h.hostname, h.ip, h.status, h.lastSeen].map(v => `"${v}"`).join(','));
        content = [headers.join(','), ...rows].join('\n');
        filename = `infrastructure-hosts-${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(`Exported ${filteredAgents.length} hosts as ${format.toUpperCase()}`);
    } catch {
      message.error('Export failed');
    }
  }, [filteredAgents]);

  if (loading && !data) {
    return <div className="flex items-center justify-center py-24"><Spin size="large" /></div>;
  }

  const handleSortChange = (key: 'name' | 'status' | 'seen') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const openHostDetail = (agent: AgentItem) => {
    setDetailHost(agent);
    setDetailOpen(true);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1480 }}>
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-fg-primary">Infrastructure</h1>
          <p className="text-sm text-fg-tertiary mt-0.5">Host List</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="default"
            options={[{ value: 'default', label: 'Default View' }, { value: 'cpu', label: 'High CPU' }, { value: 'memory', label: 'High Memory' }]}
            size="small" className="w-40" />
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
          <Button icon={<ReloadOutlined />} onClick={fetch} size="small" className="border-border" />
        </div>
      </div>

      {/* ── Nav Tabs ── */}
      <div className="flex items-center gap-0 mb-3 border-b border-border">
        {(['hosts', 'containers', 'processes'] as const).map(k => (
          <button key={k} onClick={() => setActiveNav(k)}
            className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
              activeNav === k ? 'text-accent-primary' : 'text-fg-tertiary hover:text-fg-primary'
            }`}
          >
            {k === 'hosts' ? 'Hosts' : k === 'containers' ? 'Containers' : 'Processes'}
            {activeNav === k && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary rounded-t" />}
          </button>
        ))}
      </div>

      {/* ── Stats bar ── */}
      {activeNav === 'hosts' && <StatsBar stats={statsData} loading={loading} />}

      {/* ── Process view ── */}
      {activeNav === 'processes' && (
        <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden mt-3">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-fg-primary">Processes</h2>
            <p className="text-[12px] text-fg-tertiary mt-0.5">Processes discovered from L7 traffic (applications generating HTTP/gRPC requests)</p>
          </div>
          {processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-12 h-12 text-fg-disabled mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              <p className="text-[13px] font-medium text-fg-primary">No process data</p>
              <p className="text-[12px] text-fg-tertiary mt-1 max-w-md">Processes appear here when applications generate L7 traffic. Deploy a web service and the eBPF agent will discover it automatically.</p>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-border text-left text-[10px] font-semibold text-fg-disabled uppercase tracking-wider">
                <th className="px-4 py-2">Process</th><th className="px-4 py-2">Host ID</th><th className="px-4 py-2">Requests</th><th className="px-4 py-2">Avg Latency</th><th className="px-4 py-2">Errors</th>
              </tr></thead>
              <tbody>
                {processes.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border-subtle hover:bg-bg-subtle">
                    <td className="px-4 py-2 font-medium text-fg-primary font-mono">{p.process_name}</td>
                    <td className="px-4 py-2 text-fg-tertiary">{p.host_id}</td>
                    <td className="px-4 py-2 text-fg-tertiary tabular-nums">{p.request_count}</td>
                    <td className="px-4 py-2 text-fg-tertiary tabular-nums">{parseFloat(p.avg_latency_ms||0).toFixed(1)}ms</td>
                    <td className="px-4 py-2"><span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${parseInt(p.error_count||0) > 0 ? 'text-accent-danger bg-accent-danger-bg' : 'text-accent-success bg-accent-success-bg'}`}>{p.error_count}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Containers placeholder ── */}
      {activeNav === 'containers' && (
        <div className="bg-bg-elevated border border-border rounded-lg overflow-hidden mt-3">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-fg-disabled mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5"><rect x="1" y="1" width="22" height="22" rx="4"/><rect x="5" y="5" width="14" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
            <h3 className="text-base font-semibold text-fg-primary mb-1">No containers detected</h3>
            <p className="text-sm text-fg-tertiary max-w-md">Connect a Kubernetes cluster to enable container monitoring. The eBPF agent will auto-discover pods, services, and deployments.</p>
          </div>
        </div>
      )}

      {/* ── Hosts Layout ── */}
      {activeNav === 'hosts' && (<><div className="flex gap-4 min-h-[600px]">
        <InfrastructureDirectory
          agents={agents} selectedHost={selectedHost}
          onHostSelect={name => setSelectedHost(selectedHost === name ? '' : name)} loading={loading}
        />

        <div className="flex-1 min-w-0 space-y-4">
          <InfraToolbar
            searchQuery={searchQuery} onSearchChange={setSearchQuery}
            groupBy={groupBy} onGroupByChange={setGroupBy}
            infraView={infraView} onViewChange={setInfraView}
            onExport={handleExport} searchRef={searchRef}
          />

          {selectedHost && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary/5 border border-accent-primary/10 rounded-md text-[12px] text-accent-primary font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                <span className="font-mono font-semibold">{selectedHost}</span>
                <button onClick={() => setSelectedHost('')} className="ml-1 text-accent-primary/50 hover:text-accent-primary"><CloseOutlined className="text-[10px]" /></button>
              </span>
            </div>
          )}

          {infraView === 'table' ? (
            <HostTable
              agents={filteredAgents} selectedHost={selectedHost}
              detailHostName={detailHost?.NAME} detailOpen={detailOpen}
              onSelectHost={name => setSelectedHost(selectedHost === name ? '' : name)}
              onOpenDetail={openHostDetail}
              sortKey={sortKey} sortDir={sortDir} onSortChange={handleSortChange}
              groupBy={groupBy} loading={loading}
            />
          ) : (
            <HostMap
              hosts={filteredAgents} selectedHost={selectedHost}
              onSelectHost={name => { setSelectedHost(name); const a = agents.find(h => h.NAME === name); if (a) openHostDetail(a); }}
              loading={loading}
            />
          )}

          <TopEndpoints l7Endpoints={topL7} l4Talkers={topL4} loading={loading} />
        </div>
      </div>
      </>)}  {/* close activeNav === hosts fragment */}

      {/* Footer with keyboard shortcut hint */}
      <div className="flex items-center justify-between text-[10px] text-fg-tertiary mt-4 pb-8">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-severity-ok dot-live" />
          {t('infrastructure.autoRefresh')}
        </div>
        <div className="flex items-center gap-3 text-fg-disabled">
          <span><kbd className="bg-bg-muted text-fg-tertiary px-1 py-0.5 rounded text-[10px] font-mono">/</kbd> Search</span>
          <span><kbd className="bg-bg-muted text-fg-tertiary px-1 py-0.5 rounded text-[10px] font-mono">R</kbd> Refresh</span>
          <span><kbd className="bg-bg-muted text-fg-tertiary px-1 py-0.5 rounded text-[10px] font-mono">Esc</kbd> Close</span>
        </div>
      </div>

      {detailOpen && detailHost && (<>
        <HostDetailPanel
          host={detailHost} open={detailOpen}
          onClose={() => { setDetailOpen(false); setDetailHost(null); }}
          l4Stats={l4} l7Stats={l7}
          flowRate={flowRate} l4Bandwidth={l4Bandwidth} l7Rate={l7Rate}
          topL7AvgLatency={topL7[0]?.avg_latency}
        />
      </>)}

      {/* Keyboard hint toast */}
      {keyboardHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-bg-inverse text-fg-inverse px-4 py-2 rounded-lg shadow-xl text-[12px] z-50 animate-fade-in">
          {keyboardHint}
        </div>
      )}
    </div>
  );
}
