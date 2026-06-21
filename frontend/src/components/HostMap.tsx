import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentItem } from '../api/types';
import { isOnline, isStale } from '../utils/format';

/* ── Types ── */

interface HostMapProps {
  hosts: AgentItem[];
  selectedHost: string;
  onSelectHost: (name: string) => void;
  loading: boolean;
}

/* ── Hex geometry ── */

const R = 32;
const GAP = 8;
const SQ3 = Math.sqrt(3);
const HEX_W = R * SQ3 + GAP;
const HEX_H = R * 2 + GAP;

function hexPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

const OUTER_POINTS = hexPoints(R);
const INNER_POINTS = hexPoints(R * 0.72);

function hexPos(col: number, row: number) {
  return {
    x: col * HEX_W * 0.75 + HEX_W / 2,
    y: row * HEX_H + (col % 2) * HEX_H / 2 + HEX_H / 2,
  };
}

/* ── Status colors ── */

function statusFillColor(host: AgentItem): string {
  if (isOnline(host)) return '#22c55e';
  if (isStale(host)) return '#f59e0b';
  return '#ef4444';
}

/* ── Tooltip ── */

function HexTooltip({ host, x, y, containerWidth }: {
  host: AgentItem; x: number; y: number; containerWidth: number;
}) {
  const { t } = useTranslation();
  const online = isOnline(host);
  const st = isStale(host);
  const statusColor = online ? '#22c55e' : st ? '#f59e0b' : '#ef4444';
  const statusLabel = online ? 'Online' : st ? 'Stale' : 'Offline';

  const leftSide = x > containerWidth / 2;
  const style = leftSide
    ? { right: containerWidth - x + 16, top: y - 60 }
    : { left: x + 16, top: y - 60 };

  return (
    <div
      className="absolute z-30 bg-white border border-zinc-200 rounded-xl shadow-xl px-4 py-3 w-[220px] pointer-events-none animate-fade-in"
      style={style}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-100">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
        <strong className="text-sm font-semibold text-zinc-800 truncate">{host.NAME}</strong>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Status</p>
          <p className="font-semibold text-[11px] mt-0.5" style={{ color: statusColor }}>{statusLabel}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">IP</p>
          <p className="font-mono text-zinc-700 text-[11px] mt-0.5">{host.CTRL_IP}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Component ── */

export default function HostMap({ hosts, selectedHost, onSelectHost, loading }: HostMapProps) {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{ host: AgentItem; x: number; y: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const onlineCount = hosts.filter(isOnline).length;
  const staleCount = hosts.filter(isStale).length;
  const offlineCount = hosts.length - onlineCount - staleCount;

  // Layout hosts in hex grid
  const cells = useMemo(() => {
    const cols = Math.max(Math.ceil(Math.sqrt(hosts.length)), 4);
    return hosts.map((host, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const pos = hexPos(col, row);
      return { ...pos, host };
    });
  }, [hosts]);

  const viewBox = useMemo(() => {
    if (cells.length === 0) return '0 0 400 300';
    const maxX = Math.max(...cells.map(c => c.x)) + R + 20;
    const maxY = Math.max(...cells.map(c => c.y)) + R + 20;
    return `0 0 ${maxX} ${maxY}`;
  }, [cells]);

  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setContainerWidth(node.getBoundingClientRect().width);
  }, []);

  if (!loading && hosts.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Infrastructure Map</h4>
        </div>
        <div className="flex items-center justify-center py-20 text-sm text-zinc-400">
          No hosts found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Infrastructure Map</h4>
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">{hosts.length}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" />{onlineCount}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" />{staleCount}</span>
          {offlineCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />{offlineCount}</span>}
        </div>
      </div>

      {/* Map */}
      <div ref={measuredRef} className="relative overflow-x-auto bg-[#f8f9fb]" style={{ minHeight: 400 }}>
        {loading && hosts.length === 0 ? (
          <div className="p-4"><div className="skeleton h-[400px] w-full rounded-lg" /></div>
        ) : (
          <svg viewBox={viewBox} className="block w-full" style={{ minHeight: 400 }} preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="map-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="16" cy="16" r="0.8" fill="#e4e4e7" />
              </pattern>
              <filter id="hex-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#632CA6" floodOpacity="0.4" />
              </filter>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#map-grid)" />

            {/* Connection lines */}
            {cells.map((cell, i) => {
              if (i === cells.length - 1) return null;
              const next = cells[i + 1];
              return (
                <line
                  key={`line-${i}`}
                  x1={cell.x} y1={cell.y}
                  x2={next.x} y2={next.y}
                  stroke="#d4d4d8" strokeWidth="1" strokeOpacity="0.3"
                />
              );
            })}

            {/* Hexagons */}
            {cells.map((cell, i) => {
              const isSelected = selectedHost === cell.host.NAME;
              const fill = statusFillColor(cell.host);
              return (
                <g
                  key={i}
                  transform={`translate(${cell.x},${cell.y})`}
                  onClick={() => onSelectHost(cell.host.NAME)}
                  onMouseEnter={e => {
                    const svg = e.currentTarget.closest('svg') as SVGSVGElement;
                    const rect = svg.getBoundingClientRect();
                    setTooltip({
                      host: cell.host,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer hex */}
                  <polygon
                    points={OUTER_POINTS}
                    fill={isSelected ? '#632CA6' : fill}
                    fillOpacity={isSelected ? 1 : 0.6}
                    stroke={isSelected ? '#fff' : fill}
                    strokeWidth={isSelected ? 2 : 0.5}
                    strokeOpacity={isSelected ? 1 : 0.4}
                    filter={isSelected ? 'url(#hex-glow)' : undefined}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  {/* Inner hex */}
                  <polygon
                    points={INNER_POINTS}
                    fill={isSelected ? '#7c3aed' : fill}
                    fillOpacity={isSelected ? 1 : 0.8}
                    stroke="none"
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  {/* Host name label */}
                  <text
                    x="0" y="4"
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill={isSelected ? '#fff' : '#374151'}
                    fontFamily="system-ui, sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {cell.host.NAME.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {tooltip && (
          <HexTooltip host={tooltip.host} x={tooltip.x} y={tooltip.y} containerWidth={containerWidth} />
        )}
      </div>
    </div>
  );
}
