import { useState, useMemo } from 'react';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AgentItem } from '../api/types';
import { ago, isOnline, isStale } from '../utils/format';

/* ── Status checkbox item ── */
function StatusFilterItem({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-all select-none ${
        active ? 'bg-[#F3F0FA]' : 'hover:bg-bg-subtle/50'
      }`}
    >
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          active ? 'border-accent-primary bg-accent-primary' : 'border-border bg-bg-elevated'
        }`}
      >
        {active && (
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[12px] text-fg-secondary flex-1">{label}</span>
      <span className="text-[11px] text-fg-tertiary font-mono tabular-nums">{count}</span>
    </div>
  );
}

/* ── Host list item ── */
function HostItem({
  agent,
  selected,
  onClick,
}: {
  agent: AgentItem;
  selected: boolean;
  onClick: () => void;
}) {
  const online = isOnline(agent);
  const stale = isStale(agent);
  const statusColor = online ? '#22c55e' : stale ? '#f59e0b' : '#ef4444';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 text-[12px] transition-all flex items-center gap-2.5 group ${
        selected
          ? 'bg-[#F3F0FA] border-l-[3px] border-accent-primary'
          : 'hover:bg-bg-subtle border-l-[3px] border-transparent'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white"
        style={{ backgroundColor: statusColor }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-fg-primary truncate group-hover:text-fg-primary">
          {agent.NAME}
        </div>
        <div className="text-[11px] font-mono text-fg-tertiary truncate mt-0.5">
          {agent.CTRL_IP}
        </div>
      </div>
      <span className="text-[10px] text-fg-tertiary font-mono shrink-0">
        {ago(agent.SYNCED_CONTROLLER_AT)}
      </span>
    </button>
  );
}

/* ── InfrastructureDirectory ── */
export default function InfrastructureDirectory({
  agents,
  selectedHost,
  onHostSelect,
  loading,
}: {
  agents: AgentItem[];
  selectedHost?: string;
  onHostSelect: (hostName: string) => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    status: true,
    hosts: true,
  });

  const filtered = useMemo(() => {
    if (!search) return agents;
    const q = search.toLowerCase();
    return agents.filter(a => a.NAME.toLowerCase().includes(q) || a.CTRL_IP.toLowerCase().includes(q));
  }, [agents, search]);

  const onlineCount = filtered.filter(isOnline).length;
  const staleCount = filtered.filter(isStale).length;
  const offlineCount = filtered.filter(a => !isOnline(a) && !isStale(a)).length;

  const [statusFilter, setStatusFilter] = useState<{
    online: boolean;
    stale: boolean;
    offline: boolean;
  }>({ online: true, stale: true, offline: true });

  const displayAgents = useMemo(() => {
    return filtered.filter(a => {
      if (isOnline(a) && statusFilter.online) return true;
      if (isStale(a) && statusFilter.stale) return true;
      if (!isOnline(a) && !isStale(a) && statusFilter.offline) return true;
      return false;
    });
  }, [filtered, statusFilter]);

  const toggleSection = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="w-[240px] shrink-0 bg-bg-elevated border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-fg-primary">Filter</h3>
        <span className="text-[11px] font-mono text-fg-tertiary bg-bg-muted px-2 py-0.5 rounded-full">
          {agents.length}
        </span>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border-subtle">
        <div className="relative">
          <SearchOutlined className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary text-[12px]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('infrastructure.filterHostsPlaceholder')}
            className="w-full h-8 pl-8 pr-2 text-[12px] border border-border rounded bg-bg-elevated
              placeholder:text-fg-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/10 transition-all"
          />
        </div>
      </div>

      {/* Status Section */}
      <div className="border-b border-border-subtle">
        <button
          onClick={() => toggleSection('status')}
          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider hover:bg-bg-subtle transition-colors"
        >
          <span>Status</span>
          <svg
            className={`w-3 h-3 transition-transform ${expanded.status ? 'rotate-180' : ''}`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M6 8L2 4h8z" />
          </svg>
        </button>
        {expanded.status && (
          <div className="px-2 pb-2 space-y-0.5">
            <StatusFilterItem
              label="Online"
              count={onlineCount}
              color="bg-severity-ok"
              active={statusFilter.online}
              onClick={() => setStatusFilter(p => ({ ...p, online: !p.online }))}
            />
            <StatusFilterItem
              label="Stale"
              count={staleCount}
              color="bg-severity-warn"
              active={statusFilter.stale}
              onClick={() => setStatusFilter(p => ({ ...p, stale: !p.stale }))}
            />
            <StatusFilterItem
              label="Offline"
              count={offlineCount}
              color="bg-severity-alert"
              active={statusFilter.offline}
              onClick={() => setStatusFilter(p => ({ ...p, offline: !p.offline }))}
            />
          </div>
        )}
      </div>

      {/* Hosts Section */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <button
          onClick={() => toggleSection('hosts')}
          className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider hover:bg-bg-subtle transition-colors"
        >
          <span>{t('infrastructure.hosts')}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-fg-tertiary">{displayAgents.length}</span>
            <svg
              className={`w-3 h-3 transition-transform ${expanded.hosts ? 'rotate-180' : ''}`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M6 8L2 4h8z" />
            </svg>
          </div>
        </button>
        {expanded.hosts && (
          <div className="flex-1 overflow-y-auto">
            {loading && agents.length === 0 && (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 w-full rounded" />
                ))}
              </div>
            )}
            {!loading && displayAgents.length === 0 && (
              <p className="text-[12px] text-fg-tertiary text-center py-8 px-3">
                {search ? 'No hosts match your search' : 'No hosts available'}
              </p>
            )}
            {displayAgents.map(agent => (
              <HostItem
                key={agent.ID}
                agent={agent}
                selected={selectedHost === agent.NAME}
                onClick={() => onHostSelect(selectedHost === agent.NAME ? '' : agent.NAME)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
