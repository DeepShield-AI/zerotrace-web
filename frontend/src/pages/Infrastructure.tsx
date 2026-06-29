import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Spin, Select, Button, message } from 'antd';
import {
  ReloadOutlined,
  CloseOutlined,
  UnorderedListOutlined,
  GlobalOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
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
    <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-all relative
            ${active === tab.key ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {tab.label}
          {active === tab.key && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-600 rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Toolbar ── */

function Toolbar({
  searchQuery,
  onSearchChange,
  groupBy,
  onGroupByChange,
  infraView,
  onViewChange,
  onExport,
  searchRef,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  groupBy: string;
  onGroupByChange: (g: string) => void;
  infraView: 'table' | 'map';
  onViewChange: (v: 'table' | 'map') => void;
  timeRange: string;
  onTimeRangeChange: (v: string) => void;
  onExport: (format: 'csv' | 'json') => void;
  searchRef: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-3 py-1.5">
      <div className="flex items-center gap-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Filter hosts..."
            className="w-[260px] h-8 pl-8 pr-3 text-[13px] border border-gray-200 rounded bg-white
              placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 transition-all"
          />
        </div>
        <div className="flex items-center rounded border border-gray-200 overflow-hidden">
          <button onClick={() => onGroupByChange('none')}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${groupBy === 'none' ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-500 hover:text-gray-700'}`}>
            No Grouping
          </button>
          <button onClick={() => onGroupByChange('status')}
            className={`px-2.5 py-1 text-[11px] font-medium border-l border-gray-200 transition-colors ${groupBy === 'status' ? 'bg-gray-100 text-gray-800' : 'bg-white text-gray-500 hover:text-gray-700'}`}>
            Status
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative group">
          <button className="flex items-center gap-1 px-2.5 h-7 text-[11px] font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded bg-white hover:bg-gray-50 transition-colors">
            <DownloadOutlined style={{ fontSize: 12 }} />
            Export
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z" /></svg>
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 hidden group-hover:block py-1 min-w-[120px]">
            <button onClick={() => onExport('csv')} className="w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">Export CSV</button>
            <button onClick={() => onExport('json')} className="w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">Export JSON</button>
          </div>
        </div>

        <div className="flex items-center rounded border border-gray-200 overflow-hidden">
          <button onClick={() => onViewChange('table')}
            className={`p-1.5 transition-colors ${infraView === 'table' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            title="Table"><UnorderedListOutlined style={{ fontSize: 14 }} /></button>
          <button onClick={() => onViewChange('map')}
            className={`p-1.5 border-l border-gray-200 transition-colors ${infraView === 'map' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            title="Map"><GlobalOutlined style={{ fontSize: 14 }} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Keyboard shortcut hint ── */

function KeyboardHint({ visible, shortcut, label }: { visible: boolean; shortcut: string; label: string }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl text-[12px] z-50 flex items-center gap-3 animate-fade-in">
      <kbd className="bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded text-[11px] font-mono">{shortcut}</kbd>
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
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const [refreshInterval, setRefreshInterval] = useState(10000); // Adaptive polling

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
      const result = await api.getDataOverview({ start, end });
      setData(result);
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

  const agents: AgentItem[] = data?.agents?.list || [];
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
          <h1 className="text-xl font-bold text-gray-900">Infrastructure</h1>
          <p className="text-sm text-gray-400 mt-0.5">Host List</p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="default"
            options={[{ value: 'default', label: 'Default View' }, { value: 'cpu', label: 'High CPU' }, { value: 'memory', label: 'High Memory' }]}
            size="small" className="w-40" />
          <TimeRangePicker value={range} onChange={v => setRange(v)} />
          <Button icon={<ReloadOutlined />} onClick={fetch} size="small" className="border-gray-200" />
        </div>
      </div>

      {/* ── Nav Tabs ── */}
      <NavTabs active="hosts" />

      {/* ── Stats bar ── */}
      <StatsBar stats={statsData} loading={loading} />

      {/* ── Layout ── */}
      <div className="flex gap-4 min-h-[600px]">
        <InfrastructureDirectory
          agents={agents} selectedHost={selectedHost}
          onHostSelect={name => setSelectedHost(selectedHost === name ? '' : name)} loading={loading}
        />

        <div className="flex-1 min-w-0 space-y-4">
          <Toolbar
            searchQuery={searchQuery} onSearchChange={setSearchQuery}
            groupBy={groupBy} onGroupByChange={setGroupBy}
            infraView={infraView} onViewChange={setInfraView}
            timeRange={range} onTimeRangeChange={setRange}
            onExport={handleExport} searchRef={searchRef}
          />

          {selectedHost && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#632CA6]/5 border border-[#632CA6]/10 rounded-md text-[12px] text-[#632CA6] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#632CA6]" />
                <span className="font-mono font-semibold">{selectedHost}</span>
                <button onClick={() => setSelectedHost('')} className="ml-1 text-[#632CA6]/50 hover:text-[#632CA6]"><CloseOutlined className="text-[10px]" /></button>
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

      {/* Footer with keyboard shortcut hint */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-4 pb-8">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
          {t('infrastructure.autoRefresh')}
        </div>
        <div className="flex items-center gap-3 text-gray-300">
          <span><kbd className="bg-gray-100 text-gray-400 px-1 py-0.5 rounded text-[10px] font-mono">/</kbd> Search</span>
          <span><kbd className="bg-gray-100 text-gray-400 px-1 py-0.5 rounded text-[10px] font-mono">R</kbd> Refresh</span>
          <span><kbd className="bg-gray-100 text-gray-400 px-1 py-0.5 rounded text-[10px] font-mono">Esc</kbd> Close</span>
        </div>
      </div>

      <HostDetailPanel
        host={detailHost} open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailHost(null); }}
        l4Stats={l4} l7Stats={l7}
        flowRate={flowRate} l4Bandwidth={l4Bandwidth} l7Rate={l7Rate}
        topL7AvgLatency={topL7[0]?.avg_latency}
      />

      {/* Keyboard hint toast */}
      {keyboardHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl text-[12px] z-50 animate-fade-in">
          {keyboardHint}
        </div>
      )}
    </div>
  );
}
