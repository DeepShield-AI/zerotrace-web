import React from 'react';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';

/* ---------- Types ---------- */

export type MetricType =
  | 'agents'
  | 'l4_flows'
  | 'l7_requests'
  | 'flow_rate'
  | 'l4_bandwidth'
  | 'l7_rate';

interface MetricContextMenuProps {
  metricLabel: string;
  metricValue: string;
  metricType: MetricType;
  metricKey?: string;
  onHover?: (key: string | null) => void;
  children: React.ReactNode;
}

/* ---------- Menu item icons (inline SVG) ---------- */

const iconHosts = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const iconTraces = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const iconLogs = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
);

const iconCopy = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const iconDashboard = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

/* ---------- Component ---------- */

export default function MetricContextMenu({
  metricLabel,
  metricValue,
  metricType,
  metricKey,
  onHover,
  children,
}: MetricContextMenuProps) {
  const navigate = useNavigate();
  const highlightKey = metricKey || metricType;

  const menuItems: MenuProps['items'] = [
    {
      key: 'hosts',
      label: 'View related hosts',
      icon: iconHosts,
    },
    {
      key: 'traces',
      label: 'View related traces',
      icon: iconTraces,
    },
    {
      key: 'logs',
      label: 'View related logs',
      icon: iconLogs,
    },
    { type: 'divider' },
    {
      key: 'dashboard',
      label: 'Open in dashboard',
      icon: iconDashboard,
    },
    {
      key: 'copy',
      label: 'Copy value',
      icon: iconCopy,
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'hosts':
        // Scroll to agent list / emphasize host directory
        break;
      case 'traces':
        navigate('/apm');
        break;
      case 'logs':
        navigate('/logs');
        break;
      case 'dashboard':
        // Placeholder for future dashboard integration
        break;
      case 'copy':
        navigator.clipboard.writeText(metricValue).then(
          () => message.success(`Copied: ${metricValue}`),
          () => message.error('Failed to copy')
        );
        break;
    }
  };

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleMenuClick }}
      trigger={['contextMenu', 'click']}
      placement="bottomLeft"
    >
      <div
        onMouseEnter={() => onHover?.(highlightKey)}
        onMouseLeave={() => onHover?.(null)}
        className="cursor-pointer"
      >
        {children}
      </div>
    </Dropdown>
  );
}
