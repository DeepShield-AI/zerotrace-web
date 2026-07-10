import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentItem } from '../../api/types';
import { ago, isOnline, isStale } from '../../utils/format';

/* ── Types ── */

interface HostTableProps {
  agents: AgentItem[];
  selectedHost: string;
  detailHostName?: string;
  detailOpen?: boolean;
  onSelectHost: (name: string) => void;
  onOpenDetail: (agent: AgentItem) => void;
  sortKey: 'name' | 'status' | 'seen';
  sortDir: 'asc' | 'desc';
  onSortChange: (key: 'name' | 'status' | 'seen') => void;
  groupBy: string;
  loading: boolean;
}

/* ── Sort caret ── */

function SortCaret({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 inline-flex flex-col leading-none ${active ? 'text-accent-primary' : 'text-fg-disabled'}`}>
      <svg width="8" height="4" viewBox="0 0 8 4" className={dir === 'asc' && active ? 'opacity-100' : 'opacity-30'}>
        <path d="M4 0L0 4h8z" fill="currentColor" />
      </svg>
      <svg width="8" height="4" viewBox="0 0 8 4" className={dir === 'desc' && active ? 'opacity-100' : 'opacity-30'}>
        <path d="M4 4L0 0h8z" fill="currentColor" />
      </svg>
    </span>
  );
}

/* ── Status dot ── */

function StatusDot({ agent }: { agent: AgentItem }) {
  const on = isOnline(agent);
  const st = isStale(agent);
  const color = on ? '#22c55e' : st ? '#f59e0b' : '#ef4444';
  const label = on ? 'Online' : st ? 'Stale' : 'Offline';
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {on && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-severity-ok opacity-30" />}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
      </span>
      <span className="text-[12px] text-fg-secondary">{label}</span>
    </div>
  );
}

/* ── Mini sparkline ── */

function MiniSparkline({ data, color = '#632CA6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div className="h-8 w-[100px]" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 96;
    const y = 28 - ((v - min) / range) * 26 - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100" height="32" viewBox="0 0 100 32" className="block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Column definitions ── */

interface ColumnDef {
  key: string;
  label: string;
  sortKey?: 'name' | 'status' | 'seen';
  defaultWidth: number;
  minWidth: number;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColumnDef[] = [
  { key: 'hostname', label: 'Host', sortKey: 'name', defaultWidth: 200, minWidth: 120 },
  { key: 'status', label: 'Status', sortKey: 'status', defaultWidth: 130, minWidth: 100 },
  { key: 'cpu', label: 'CPU', defaultWidth: 140, minWidth: 100 },
  { key: 'memory', label: 'Memory', defaultWidth: 140, minWidth: 100 },
  { key: 'tx', label: 'TX', defaultWidth: 120, minWidth: 80 },
  { key: 'rx', label: 'RX', defaultWidth: 120, minWidth: 80 },
  { key: 'seen', label: 'Last Seen', sortKey: 'seen', defaultWidth: 100, minWidth: 70, align: 'right' as const },
];

/* ── Column resize hook ── */

const STORAGE_KEY = 'host-table-columns';

function useColumnWidths() {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const saveWidths = useCallback((newWidths: Record<string, number>) => {
    setWidths(newWidths);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newWidths)); } catch {}
  }, []);

  const getWidth = (col: ColumnDef) => widths[col.key] || col.defaultWidth;

  const handleResize = useCallback((colKey: string, delta: number, cols: ColumnDef[]) => {
    const col = cols.find(c => c.key === colKey);
    if (!col) return;
    const current = widths[colKey] || col.defaultWidth;
    const newW = Math.max(col.minWidth, current + delta);
    setWidths(prev => {
      const updated = { ...prev, [colKey]: newW };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [widths]);

  return { getWidth, handleResize };
}

/* ── Filter dropdown ── */

function FilterDropdown({
  colKey,
  values,
  active,
  onClose,
}: {
  colKey: string;
  values: string[];
  active: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return values;
    return values.filter(v => v.toLowerCase().includes(search.toLowerCase()));
  }, [values, search]);

  if (!active) return null;

  return (
    <div className="absolute top-full left-0 mt-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-20 min-w-[180px] max-h-[260px] overflow-hidden">
      <div className="p-2 border-b border-border-subtle">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Filter ${colKey}...`}
          className="w-full h-7 px-2 text-[12px] border border-border rounded bg-bg-elevated focus:outline-none focus:border-accent-primary"
          autoFocus
          onClick={e => e.stopPropagation()}
        />
      </div>
      <div className="overflow-y-auto max-h-[200px]">
        {filtered.length === 0 && (
          <p className="text-[12px] text-fg-tertiary py-4 text-center">No matches</p>
        )}
        {filtered.map(v => (
          <label key={v} className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-subtle cursor-pointer text-[12px] text-fg-secondary">
            <input type="checkbox" className="w-3.5 h-3.5 rounded border-border text-accent-primary" />
            {v}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ── Resize handle ── */

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const handleRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onResize(delta);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize]);

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent-primary/20 active:bg-accent-primary/30 transition-colors z-10"
      style={{ marginRight: -3 }}
    />
  );
}

/* ── HostTable ── */

export default function HostTable({
  agents, detailHostName, detailOpen, onOpenDetail,
  sortKey, sortDir, onSortChange, groupBy, loading,
}: HostTableProps) {
  const { t } = useTranslation();
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const { getWidth, handleResize } = useColumnWidths();

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilter]);

  const sorted = useMemo(() => {
    const list = [...agents];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.NAME.localeCompare(b.NAME); break;
        case 'status': {
          const getState = (x: AgentItem) => (isOnline(x) ? 0 : isStale(x) ? 1 : 2);
          cmp = getState(a) - getState(b);
          break;
        }
        case 'seen':
          cmp = (a.SYNCED_CONTROLLER_AT || '').localeCompare(b.SYNCED_CONTROLLER_AT || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [agents, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (groupBy !== 'status') return null;
    const online = sorted.filter(isOnline);
    const stale = sorted.filter(isStale);
    const offline = sorted.filter(a => !isOnline(a) && !isStale(a));
    return [
      { label: 'Online', color: '#22c55e', agents: online },
      { label: 'Stale', color: '#f59e0b', agents: stale },
      { label: 'Offline', color: '#ef4444', agents: offline },
    ].filter(g => g.agents.length > 0);
  }, [sorted, groupBy]);

  const onlineCount = agents.filter(isOnline).length;
  const staleCount = agents.filter(isStale).length;
  const offlineCount = agents.length - onlineCount - staleCount;

  const getSparkline = () => [20, 35, 25, 45, 30, 50, 40, 55, 45, 60, 35, 50, 42, 48, 38, 52, 44, 58];

  // Filter values for dropdowns
  const statusValues = ['Online', 'Stale', 'Offline'];

  const renderRow = (a: AgentItem) => {
    const isSelected = detailHostName === a.NAME && detailOpen;
    return (
      <tr
        key={a.ID}
        onClick={() => onOpenDetail(a)}
        className={`border-b border-border-subtle cursor-pointer transition-colors duration-100 group ${
          isSelected ? 'bg-accent-primary/10' : 'hover:bg-bg-subtle'
        }`}
      >
        <td className="px-4 py-3" style={{ width: getWidth(COLUMNS[0]) }}>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-fg-primary leading-tight group-hover:text-accent-primary transition-colors">
              {a.NAME}
            </span>
            <span className="text-[11px] font-mono text-fg-tertiary leading-tight mt-0.5">{a.CTRL_IP}</span>
          </div>
        </td>
        <td className="px-4 py-3" style={{ width: getWidth(COLUMNS[1]) }}>
          <StatusDot agent={a} />
        </td>
        <td className="px-4 py-3" style={{ width: getWidth(COLUMNS[2]) }}>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-fg-secondary w-10 text-right">{Math.floor(Math.random() * 30 + 10)}%</span>
            <MiniSparkline data={getSparkline()} color="#3b82f6" />
          </div>
        </td>
        <td className="px-4 py-3" style={{ width: getWidth(COLUMNS[3]) }}>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono text-fg-secondary w-10 text-right">{Math.floor(Math.random() * 50 + 20)}%</span>
            <MiniSparkline data={getSparkline()} color="#8b5cf6" />
          </div>
        </td>
        <td className="px-4 py-3" style={{ width: getWidth(COLUMNS[4]) }}>
          <span className="text-[12px] font-mono text-fg-secondary">{Math.floor(Math.random() * 500 + 100)} KB/s</span>
        </td>
        <td className="px-4 py-3" style={{ width: getWidth(COLUMNS[5]) }}>
          <span className="text-[12px] font-mono text-fg-secondary">{Math.floor(Math.random() * 300 + 50)} KB/s</span>
        </td>
        <td className="px-4 py-3 text-right text-[11px] text-fg-tertiary font-mono" style={{ width: getWidth(COLUMNS[6]) }}>
          {ago(a.SYNCED_CONTROLLER_AT)}
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-bg-elevated border border-border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-bg-elevated">
        <div className="flex items-center gap-2">
          <h4 className="text-[14px] font-bold text-fg-primary">{t('infrastructure.hosts')}</h4>
          <span className="text-[11px] font-mono text-fg-tertiary bg-bg-muted px-2 py-0.5 rounded-full">{sorted.length}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-fg-tertiary"><span className="w-2 h-2 rounded-full bg-severity-ok" />{onlineCount} Online</span>
          <span className="flex items-center gap-1.5 text-fg-tertiary"><span className="w-2 h-2 rounded-full bg-severity-warn" />{staleCount} Stale</span>
          {offlineCount > 0 && (
            <span className="flex items-center gap-1.5 text-fg-tertiary"><span className="w-2 h-2 rounded-full bg-severity-alert" />{offlineCount} Offline</span>
          )}
        </div>
      </div>

      {/* Table */}
      {loading && agents.length === 0 ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12 w-full rounded" />)}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              {COLUMNS.map(col => <col key={col.key} style={{ width: getWidth(col) }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((col, idx) => (
                  <th
                    key={col.key}
                    className={`relative text-[11px] font-semibold text-fg-tertiary uppercase tracking-wider px-4 py-2.5 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    style={{ width: getWidth(col) }}
                  >
                    <div className="flex items-center gap-1" style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                      {col.sortKey ? (
                        <button
                          onClick={() => onSortChange(col.sortKey!)}
                          className="hover:text-fg-primary transition-colors inline-flex items-center"
                        >
                          {col.label}{sortKey === col.sortKey && <SortCaret active dir={sortDir} />}
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                      {/* Filter toggle */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setOpenFilter(openFilter === col.key ? null : col.key);
                        }}
                        className={`p-0.5 rounded hover:bg-bg-muted transition-colors ${openFilter === col.key ? 'text-accent-primary' : 'text-fg-tertiary'}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                      </button>
                    </div>

                    {/* Resize handle */}
                    {idx < COLUMNS.length - 1 && (
                      <ResizeHandle onResize={delta => handleResize(col.key, delta, COLUMNS)} />
                    )}

                    {/* Filter dropdown */}
                    {openFilter === col.key && (
                      <div ref={filterRef} className="relative">
                        <FilterDropdown
                          colKey={col.key}
                          values={col.key === 'status' ? statusValues : sorted.map(a => a.NAME).slice(0, 10)}
                          active
                          onClose={() => setOpenFilter(null)}
                        />
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 text-fg-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5.25 14.25h13.5m-16.5 0a2.25 2.25 0 01-2.25-2.25V6.75a2.25 2.25 0 012.25-2.25h16.5a2.25 2.25 0 012.25 2.25v5.25a2.25 2.25 0 01-2.25 2.25m-16.5 0v2.25m16.5-2.25v2.25m-16.5 0a2.25 2.25 0 00-2.25 2.25v2.25a2.25 2.25 0 002.25 2.25h16.5a2.25 2.25 0 002.25-2.25v-2.25a2.25 2.25 0 00-2.25-2.25m-16.5 0z" />
                      </svg>
                      <p className="text-sm text-fg-tertiary">{t('hostTable.noHosts')}</p>
                    </div>
                  </td>
                </tr>
              ) : grouped ? (
                grouped.map(g => (
                  <>
                    <tr key={`g-${g.label}`} className="bg-bg-subtle/60 border-b border-border-subtle">
                      <td colSpan={7} className="px-4 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">{g.label}</span>
                          <span className="text-[10px] font-mono text-fg-tertiary">{g.agents.length}</span>
                        </div>
                      </td>
                    </tr>
                    {g.agents.map(renderRow)}
                  </>
                ))
              ) : (
                sorted.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
