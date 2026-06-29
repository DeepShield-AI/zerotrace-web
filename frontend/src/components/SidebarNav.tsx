import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';

// ════════════════════════ TYPES ════════════════════════
export interface NavCategory {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

export interface NavItem {
  label: string;
  to: string;
  badge?: string; // 'new' | 'preview' | undefined
  exact?: boolean;
}

// ════════════════════════ ZEROTRACE NAVIGATION STRUCTURE ════════════════════════
export const DD_NAVIGATION: NavCategory[] = [
  {
    id: 'infrastructure', label: 'Infrastructure', icon: '◈',
    items: [
      { label: 'Infrastructure', to: '/infrastructure', exact: true },
      { label: 'Containers', to: '/infrastructure/containers' },
      { label: 'Kubernetes', to: '/infrastructure/kubernetes' },
      { label: 'Serverless', to: '/infrastructure/serverless' },
      { label: 'Network', to: '/infrastructure/network' },
      { label: 'Processes', to: '/infrastructure/processes' },
      { label: 'Cloud Cost', to: '/cloud-cost' },
    ],
  },
  {
    id: 'apm', label: 'APM', icon: '◇',
    items: [
      { label: 'Services', to: '/apm', exact: true },
      { label: 'Traces', to: '/apm/traces' },
      { label: 'Service Map', to: '/apm?view=topology' },
      { label: 'Database Monitoring', to: '/apm/databases' },
      { label: 'Profiling', to: '/profiling' },
      { label: 'Settings', to: '/apm/settings' },
    ],
  },
  {
    id: 'logs', label: 'Logs', icon: '☰',
    items: [
      { label: 'Explorer', to: '/logs', exact: true },
      { label: 'Live Tail', to: '/logs/livetail' },
      { label: 'Pipelines', to: '/logs/pipelines' },
      { label: 'Indexes', to: '/logs/indexes' },
    ],
  },
  {
    id: 'metrics', label: 'Metrics', icon: 'Σ',
    items: [
      { label: 'Explorer', to: '/metrics', exact: true },
      { label: 'Summary', to: '/metrics/summary' },
      { label: 'Volume', to: '/metrics/volume' },
    ],
  },
  {
    id: 'security', label: 'Security', icon: '⬢',
    items: [
      { label: 'Cloud SIEM', to: '/security/siem' },
      { label: 'Code Security', to: '/code-security' },
      { label: 'CSM', to: '/security/csm' },
      { label: 'Sensitive Data', to: '/sensitive-data' },
    ],
  },
  {
    id: 'digital-experience', label: 'Digital Experience', icon: '◉',
    items: [
      { label: 'RUM', to: '/rum' },
      { label: 'Synthetics', to: '/synthetic-tests' },
      { label: 'Session Replay', to: '/digital-experience/session-replay' },
    ],
  },
  {
    id: 'software-delivery', label: 'Software Delivery', icon: '◆',
    items: [
      { label: 'CI Visibility', to: '/software-delivery', exact: true },
      { label: 'Feature Flags', to: '/software-delivery/feature-flags' },
      { label: 'Code Coverage', to: '/software-delivery/code-coverage' },
      { label: 'Test Optimization', to: '/software-delivery/test-optimization' },
    ],
  },
  {
    id: 'data-observability', label: 'Data Observability', icon: '⬡',
    items: [
      { label: 'Catalog', to: '/data-observability', exact: true },
      { label: 'Jobs Monitoring', to: '/data-observability/jobs' },
      { label: 'Lineage', to: '/data-observability/lineage' },
    ],
  },
  {
    id: 'monitoring', label: 'Monitoring', icon: '⚠',
    items: [
      { label: 'Monitors', to: '/monitors', exact: true },
      { label: 'SLOs', to: '/slos' },
      { label: 'Incidents', to: '/incidents' },
      { label: 'Events', to: '/events' },
      { label: 'Watchdog', to: '/watchdog' },
    ],
  },
  {
    id: 'dashboards', label: 'Dashboards', icon: '▣',
    items: [
      { label: 'Dashboard List', to: '/dashboards', exact: true },
    ],
  },
  {
    id: 'ai', label: 'Bits AI', icon: '✦',
    items: [
      { label: 'Ask Bits', to: '/guardian', exact: true },
      { label: 'Investigations', to: '/guardian/investigations' },
      { label: 'Settings', to: '/guardian/settings' },
    ],
  },
  {
    id: 'automation', label: 'Automation', icon: '⚙',
    items: [
      { label: 'Workflows', to: '/automation', exact: true },
      { label: 'App Builder', to: '/automation/app-builder' },
      { label: 'Actions', to: '/automation/actions' },
    ],
  },
  {
    id: 'integrations', label: 'Integrations', icon: '⊕',
    items: [
      { label: 'Integrations', to: '/integrations', exact: true },
      { label: 'IDE Plugins', to: '/integrations/ide' },
      { label: 'Source Code', to: '/integrations/source-code' },
    ],
  },
  {
    id: 'management', label: 'Management', icon: '⚙',
    items: [
      { label: 'Agents', to: '/agents/setup', exact: true },
      { label: 'Agent Status', to: '/agents/status' },
      { label: 'Organization', to: '/org' },
      { label: 'Billing', to: '/org/billing' },
    ],
  },
];

// ════════════════════════ SIDEBAR COMPONENT ════════════════════════
export function DDSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([
    'infrastructure', 'apm', 'logs', 'metrics', 'monitoring',
  ]));

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (collapsed) {
    return (
      <nav className="flex-shrink-0 w-16 bg-[#1a0a2e] min-h-screen flex flex-col items-center py-4 gap-3">
        {DD_NAVIGATION.map(cat => (
          <div key={cat.id} className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title={cat.label}>
            <span className="text-lg">{cat.icon}</span>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex-shrink-0 w-60 bg-[#1a0a2e] min-h-screen overflow-y-auto flex flex-col">
      {/* Logo area */}
      <div className="px-4 py-4 border-b border-white/5 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-brand-600 rounded-md flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">DD</span>
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">ZEROTRACE</span>
      </div>

      {/* Navigation items */}
      <div className="flex-1 px-2 py-3 space-y-0.5">
        {DD_NAVIGATION.map(cat => {
          const isExpanded = expandedCategories.has(cat.id);
          return (
            <div key={cat.id}>
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors"
              >
                <span className="text-base w-5 text-center">{cat.icon}</span>
                <span className="flex-1 text-left font-medium text-[13px]">{cat.label}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {isExpanded && (
                <div className="ml-8 mt-0.5 space-y-0">
                  {cat.items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.exact}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 text-[13px] rounded-md transition-colors ${
                          isActive
                            ? 'text-white bg-brand-600/40 font-medium'
                            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                        }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {item.label}
                        {item.badge && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${
                            item.badge === 'new' ? 'bg-purple-500/30 text-purple-200' : 'bg-amber-500/30 text-amber-200'
                          }`}>{item.badge.toUpperCase()}</span>
                        )}
                      </span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t border-white/5 space-y-1">
        <NavLink to="/org" className="block px-3 py-2 text-[13px] text-white/50 hover:text-white/80 hover:bg-white/5 rounded-md transition-colors">
          ⚙ Organization
        </NavLink>
        <NavLink to="/org/billing" className="block px-3 py-2 text-[13px] text-white/50 hover:text-white/80 hover:bg-white/5 rounded-md transition-colors">
          💳 Plan &amp; Usage
        </NavLink>
      </div>
    </nav>
  );
}
