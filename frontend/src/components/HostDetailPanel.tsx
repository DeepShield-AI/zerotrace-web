import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CloseOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { AgentItem, L4Stats, L7Stats, FlowRatePoint, L4BandwidthPoint, L7RatePoint } from '../api/types';
import { ago, fmtN, fmtB, isOnline } from '../utils/format';

/* ── Types ── */

interface HostDetailPanelProps {
  host: AgentItem | null;
  open: boolean;
  onClose: () => void;
  l4Stats?: L4Stats;
  l7Stats?: L7Stats;
  flowRate?: FlowRatePoint[];
  l4Bandwidth?: L4BandwidthPoint[];
  l7Rate?: L7RatePoint[];
  topL7AvgLatency?: number;
}

type TabKey = 'overview' | 'flows' | 'processes' | 'tags';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'flows', label: 'Flows' },
  { key: 'processes', label: 'Processes' },
  { key: 'tags', label: 'Tags' },
];

/* ── Sparkline (smooth line chart) ── */

function Sparkline({ data, color, height = 80, width = 200 }: {
  data: number[]; color: string; height?: number; width?: number;
}) {
  const pathData = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pad = 2;

    const pts = data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return [x, y];
    });

    const linePath = `M ${pts.map(p => p.join(',')).join(' L ')}`;
    const areaPath = `M ${pts[0][0]},${height} L ${pts.map(p => p.join(',')).join(' L ')} L ${pts[pts.length - 1][0]},${height} Z`;
    const uid = `sp-${Math.random().toString(36).slice(2, 8)}`;

    return { linePath, areaPath, uid, lastPt: pts[pts.length - 1] };
  }, [data, width, height]);

  if (!pathData) return <div className={`w-[${width}px] h-[${height}px]`} />;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id={`${pathData.uid}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathData.areaPath} fill={`url(#${pathData.uid}-area)`} />
      <path d={pathData.linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pathData.lastPt[0]} cy={pathData.lastPt[1]} r="3" fill={color} stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Metric Card ── */

function MetricCard({ label, value, sub, color = '#632CA6' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-sm transition-shadow group cursor-pointer">
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 font-mono tracking-tight" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-zinc-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Chart Card ── */

function ChartCard({ title, value, unit, data, color }: {
  title: string; value: string | number; unit?: string; data: number[]; color: string;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{title}</p>
        <span className="text-[11px] font-mono text-zinc-600">
          {value}{unit && <span className="text-zinc-400 ml-0.5">{unit}</span>}
        </span>
      </div>
      <Sparkline data={data} color={color} height={60} width={280} />
    </div>
  );
}

/* ── Process Row ── */

function ProcessRow({ name, pid, cpu, memory, user }: {
  name: string; pid: number; cpu: number; memory: string; user: string;
}) {
  const cpuPct = Math.min(cpu, 100);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0 group cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-800 truncate group-hover:text-[#632CA6] transition-colors">{name}</p>
        <p className="text-[11px] text-zinc-400 font-mono mt-0.5">PID: {pid} · {user}</p>
      </div>
      <div className="w-24 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#632CA6] transition-all" style={{ width: `${cpuPct}%` }} />
          </div>
          <span className="text-[11px] font-mono text-zinc-600 w-10 text-right">{cpu.toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-20 shrink-0 text-right">
        <span className="text-[12px] font-mono text-zinc-700">{memory}</span>
      </div>
    </div>
  );
}

/* ── Empty state ── */

function TabEmpty({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-zinc-300 mb-3">{icon}</div>
      <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
      <p className="text-xs text-zinc-400 max-w-[260px]">{desc}</p>
    </div>
  );
}

/* ── Component ── */

export default function HostDetailPanel({
  host, open, onClose, l4Stats, l7Stats, flowRate, l4Bandwidth, l7Rate, topL7AvgLatency,
}: HostDetailPanelProps) {
  const [tab, setTab] = useState<TabKey>('overview');

  // ── Resizable panel ──
  const [panelWidth, setPanelWidth] = useState(480);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      const newWidth = Math.min(800, Math.max(320, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => { if (!open) setPanelWidth(480); }, [open]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success('Copied to clipboard'),
      () => message.error('Failed to copy'),
    );
  }, []);

  // ── Chart data ──
  const flowsChartData = useMemo(() => {
    if (!flowRate || flowRate.length < 2) return null;
    const ts = flowRate.map(p => { try { return p.ts ? p.ts.slice(11, 16) : ''; } catch { return ''; } });
    return {
      flowRateData: flowRate.map(p => p.cnt || 0),
      bwData: (l4Bandwidth || []).map(p => Number(p.tx || 0) + Number(p.rx || 0)),
      l7Data: (l7Rate || []).map(p => Number(p.cnt || 0)),
      timestamps: ts,
    };
  }, [flowRate, l4Bandwidth, l7Rate]);

  // Mock process data for demo
  const mockProcesses = [
    { name: 'nginx', pid: 1234, cpu: 12.5, memory: '245 MB', user: 'root' },
    { name: 'python3 app.py', pid: 5678, cpu: 8.3, memory: '128 MB', user: 'app' },
    { name: 'zerotrace-agent', pid: 9012, cpu: 3.1, memory: '89 MB', user: 'dd-agent' },
    { name: 'redis-server', pid: 3456, cpu: 1.8, memory: '456 MB', user: 'redis' },
    { name: 'postgres', pid: 7890, cpu: 0.9, memory: '312 MB', user: 'postgres' },
  ];

  if (!open || !host) return null;

  const on = isOnline(host);
  const statusLabel = on ? 'Online' : 'Offline';
  const statusColor = on ? '#22c55e' : '#ef4444';
  const l4FlowCount = l4Stats?.cnt;
  const l4TotalBandwidth = Number(l4Stats?.tx || 0) + Number(l4Stats?.rx || 0);
  const l7ReqCount = l7Stats?.cnt;
  const l7AvgLatency = topL7AvgLatency;

  const lastFlowVal = flowsChartData?.flowRateData[flowsChartData.flowRateData.length - 1];
  const lastBwVal = flowsChartData?.bwData[flowsChartData.bwData.length - 1];
  const lastL7Val = flowsChartData?.l7Data[flowsChartData.l7Data.length - 1];
  const lastTs = flowsChartData?.timestamps[flowsChartData.timestamps.length - 1];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-screen bg-white border-l border-zinc-200 shadow-2xl z-50 flex flex-col animate-slide-left"
        style={{ width: panelWidth }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute left-0 top-0 -ml-1 w-2 h-full cursor-ew-resize z-10
            hover:bg-[#632CA6]/10 active:bg-[#632CA6]/20 transition-colors
            before:content-[''] before:absolute before:left-1/2 before:top-[10%] before:-translate-x-px
            before:w-px before:h-[80%] before:bg-zinc-200 before:rounded-full"
          title="Drag to resize"
        />

        {/* ── Header ── */}
        <div className="shrink-0 px-5 py-4 border-b border-zinc-100">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                {on && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />}
                <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: statusColor }} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-zinc-900 font-mono truncate">{host.NAME}</h3>
                  <button
                    onClick={() => handleCopy(host.NAME)}
                    className="text-zinc-300 hover:text-[#632CA6] transition-colors p-0.5 rounded hover:bg-zinc-50 shrink-0"
                    title="Copy hostname"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">{host.CTRL_IP}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded hover:bg-zinc-50 shrink-0">
              <CloseOutlined />
            </button>
          </div>

          {/* Status + meta */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-[11px] ${
              on ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {statusLabel}
            </span>
            <span className="text-zinc-400">Last seen {ago(host.SYNCED_CONTROLLER_AT)}</span>
            <span className="text-zinc-300">|</span>
            <span className="text-zinc-400 font-mono text-[11px]">ID: #{host.ID}</span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="shrink-0 flex border-b border-zinc-100 px-5">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all -mb-[1px] ${
                tab === t.key
                  ? 'border-[#632CA6] text-[#632CA6]'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="L4 Flow Count" value={fmtN(l4FlowCount)} sub="total flows (1h)" color="#632CA6" />
                <MetricCard label="L4 Bandwidth" value={fmtB(l4TotalBandwidth)} sub="TX + RX" color="#2DB88D" />
                <MetricCard label="L7 Requests" value={fmtN(l7ReqCount)} sub="HTTP requests (1h)" color="#E2903C" />
                <MetricCard
                  label="Avg Latency"
                  value={l7AvgLatency != null ? (l7AvgLatency / 1000).toFixed(1) + 'ms' : '--'}
                  sub="L7 avg"
                  color="#4799EB"
                />
              </div>

              {/* Related links */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Related</h4>
                <Link
                  to={`/apm?view=traces`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:border-[#632CA6]/20 hover:bg-[#F3F0FA]/30 transition-all text-sm text-zinc-700 group"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#632CA6]/5 flex items-center justify-center text-[#632CA6] group-hover:bg-[#632CA6]/10 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </span>
                  <span className="flex-1">View traces from this host in APM</span>
                  <svg className="w-4 h-4 text-zinc-300 group-hover:text-[#632CA6] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to="/logs"
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:border-[#632CA6]/20 hover:bg-[#F3F0FA]/30 transition-all text-sm text-zinc-700 group"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#632CA6]/5 flex items-center justify-center text-[#632CA6] group-hover:bg-[#632CA6]/10 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                  <span className="flex-1">Search logs for {host.NAME}</span>
                  <svg className="w-4 h-4 text-zinc-300 group-hover:text-[#632CA6] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

          {/* ── Flows ── */}
          {tab === 'flows' && (
            <div className="p-5 space-y-4">
              {flowsChartData ? (
                <>
                  <ChartCard
                    title="L4 Flow Rate"
                    value={fmtN(lastFlowVal)}
                    unit="/min"
                    data={flowsChartData.flowRateData}
                    color="#632CA6"
                  />
                  <ChartCard
                    title="L4 Bandwidth"
                    value={fmtB(lastBwVal)}
                    unit="/s"
                    data={flowsChartData.bwData}
                    color="#2DB88D"
                  />
                  <ChartCard
                    title="L7 Request Rate"
                    value={fmtN(lastL7Val)}
                    unit="/min"
                    data={flowsChartData.l7Data}
                    color="#E2903C"
                  />
                </>
              ) : (
                <TabEmpty
                  icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
                  title="No flow data available"
                  desc="Flow rate timeseries data will appear here once the time range has active traffic."
                />
              )}
            </div>
          )}

          {/* ── Processes ── */}
          {tab === 'processes' && (
            <div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                <div className="flex items-center gap-2">
                  <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Processes</h4>
                  <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-200/60 px-1.5 py-0.5 rounded-full">{mockProcesses.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-100 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <span className="flex-1">Name</span>
                <span className="w-24 text-right">CPU</span>
                <span className="w-20 text-right">Memory</span>
              </div>
              {mockProcesses.map((p, i) => (
                <ProcessRow key={i} {...p} />
              ))}
            </div>
          )}

          {/* ── Tags ── */}
          {tab === 'tags' && (
            <div className="p-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {['env:production', 'team:platform', 'region:us-east', 'os:linux'].map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 text-zinc-700 text-[12px] font-mono rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-400">Tags are used to filter and group hosts in dashboards and monitors.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
