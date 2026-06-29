import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Table, Modal, Form, Input, message, Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import CommandPalette from '../components/CommandPalette';

/* ── Types ── */
interface ApiKeyItem { id: number; name: string; key_prefix: string; scopes: string; last_used_at: string | null; status: string; created_at: string; }

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (<div className="space-y-2 p-1">{Array.from({ length: rows }).map((_, i) => (<div key={i} className="flex items-center gap-4 py-3"><div className="skeleton h-5 w-32" /><div className="skeleton h-5 w-48" /><div className="skeleton h-5 w-20" /><div className="skeleton h-5 w-16" /><div className="skeleton h-5 w-24" /><div className="skeleton h-5 w-20" /></div>))}</div>);
}

function EmptyApiKeys({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-zinc-400"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
      </div>
      <h3 className="text-lg font-semibold text-zinc-800 mb-1">{t('dashboard.noApiKeys')}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">{t('dashboard.noApiKeysDesc')}</p>
      <Button type="primary" onClick={onCreate} className="h-10 font-medium btn-tactile">{t('dashboard.createFirstKey')}</Button>
    </div>
  );
}

function KeyReveal({ value, onDone }: { value: string; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 animate-slide-up">
      <div className="flex items-start gap-3 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-amber-600 mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        <div><h4 className="font-semibold text-amber-800 text-sm">{t('dashboard.storeSecurely')}</h4><p className="text-amber-700 text-xs mt-0.5">{t('dashboard.storeSecurelyDesc')}</p></div>
      </div>
      <div className="bg-amber-100/60 rounded-xl p-3 mb-3"><code className="text-sm font-mono text-amber-900 break-all select-all">{value}</code></div>
      <div className="flex gap-2"><Button size="small" onClick={() => { navigator.clipboard.writeText(value); message.success(t('dashboard.keyCopied')); }}>{t('common.copy')}</Button><Button type="primary" size="small" onClick={onDone}>{t('dashboard.iHaveSavedIt')}</Button></div>
    </div>
  );
}

/* ═══════════════════════ ZEROTRACE HOVER FLYOUT SIDEBAR ═══════════════════════ */

interface NavSection { title: string; docsHref?: string; items: { label: string; to: string; badge?: string }[]; }
interface NavCategory { id: string; label: string; icon: string; to: string; sections: NavSection[]; }

const NAV_ITEMS: NavCategory[] = [
  { id: 'bits-ai', label: 'Bits AI', icon: 'M9.663 17h4.673M12 3v1m6.364 2.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707', to: '/guardian', sections: [{ title: 'Bits AI', docsHref: '#', items: [{ label: 'Ask Bits', to: '/guardian' },{ label: 'Investigations', to: '/guardian/investigations', badge: 'new' },{ label: 'Reports', to: '/guardian/reports' },{ label: 'Settings', to: '/guardian/settings' }] }] },
  { id: 'dashboards', label: 'Dashboards', icon: 'M3 3h7v7H3V3z M14 3h7v7h-7V3z M14 14h7v7h-7v-7z M3 14h7v7H3v-7z', to: '/dashboards', sections: [{ title: 'Dashboards', docsHref: '#', items: [{ label: 'Dashboard List', to: '/dashboards' },{ label: 'New Dashboard', to: '/dashboards/new' },{ label: 'Reports', to: '/dashboard/reports' },{ label: 'Notebooks', to: '/notebooks' },{ label: 'Sheets', to: '/sheets' }] }] },
  { id: 'monitoring', label: 'Monitoring', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01', to: '/monitors', sections: [{ title: 'Monitors', docsHref: '#', items: [{ label: 'Manage Monitors', to: '/monitors' },{ label: 'Triggered', to: '/monitors/triggered' },{ label: 'New Monitor', to: '/monitors/create' },{ label: 'Downtimes', to: '/monitors/downtimes' },{ label: 'Settings', to: '/monitors/settings' }] },{ title: 'Quality & SLOs', items: [{ label: 'Monitor Quality', to: '/monitors/quality' },{ label: 'SLOs', to: '/slos' }] },{ title: 'Incidents', items: [{ label: 'All Incidents', to: '/incidents' },{ label: 'Settings', to: '/incidents/settings' }] },{ title: 'Events', items: [{ label: 'Event Explorer', to: '/events' },{ label: 'Correlation', to: '/events/correlation' }] },{ title: 'Watchdog', items: [{ label: 'Watchdog', to: '/watchdog' },{ label: 'External Status', to: '/watchdog/external' }] }] },
  { id: 'dev-portal', label: 'Developer Portal', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75', to: '/idp', sections: [{ title: 'Developer Portal', docsHref: '#', items: [{ label: 'Catalog', to: '/idp' },{ label: 'Scorecards', to: '/idp/scorecards' },{ label: 'Reports', to: '/idp/reports' }] }] },
  { id: 'incident-response', label: 'Incident Response', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', to: '/incidents', sections: [{ title: 'Incident Response', items: [{ label: 'Incidents', to: '/incidents' },{ label: 'Settings', to: '/incidents/settings' }] },{ title: 'On-Call', items: [{ label: 'Teams', to: '/on-call/teams' },{ label: 'Pages', to: '/on-call/pages' },{ label: 'Send a Page', to: '/on-call/send' }] },{ title: 'Status Pages', items: [{ label: 'Status Pages', to: '/status-pages' }] }] },
  { id: 'automation', label: 'Automation', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', to: '/automation', sections: [{ title: 'Workflow Automation', items: [{ label: 'Workflows', to: '/automation' },{ label: 'Action Catalog', to: '/automation/actions' },{ label: 'New Workflow', to: '/automation/create' }] },{ title: 'App Builder', items: [{ label: 'Apps', to: '/automation/app-builder', badge: 'new' }] },{ title: 'Case Management', items: [{ label: 'Cases', to: '/cases' }] }] },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'M2 13.5h4l1-4h3l2 6h2.5l1.5-3h2.5l1 5h1.5M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z', to: '/infrastructure', sections: [{ title: 'Infrastructure', docsHref: '#', items: [{ label: 'Hosts', to: '/infrastructure' },{ label: 'Host Map', to: '/infrastructure/map' },{ label: 'Containers', to: '/infrastructure/containers' },{ label: 'Kubernetes', to: '/infrastructure/kubernetes' },{ label: 'Processes', to: '/infrastructure/processes' },{ label: 'Serverless', to: '/infrastructure/serverless' },{ label: 'GPU Monitoring', to: '/infrastructure/gpu' }] },{ title: 'Network', items: [{ label: 'Network Map', to: '/infrastructure/network' },{ label: 'Network Path', to: '/infrastructure/network-path' },{ label: 'Devices', to: '/infrastructure/devices' },{ label: 'NetFlow', to: '/infrastructure/netflow' }] },{ title: 'Storage & Cloud', items: [{ label: 'Storage Management', to: '/infrastructure/storage' },{ label: 'Cloud Cost', to: '/cloud-cost' }] }] },
  { id: 'apm', label: 'APM', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', to: '/apm', sections: [{ title: 'APM', docsHref: '#', items: [{ label: 'Services', to: '/apm' },{ label: 'Traces', to: '/apm/traces' },{ label: 'Service Map', to: '/apm?view=topology' },{ label: 'Settings', to: '/apm/settings' }] },{ title: 'Database', items: [{ label: 'DBM Overview', to: '/databases' },{ label: 'Data Streams', to: '/data-streams' }] },{ title: 'Profiling', items: [{ label: 'Continuous Profiler', to: '/profiling' },{ label: 'Comparison', to: '/profiling/comparison' }] }] },
  { id: 'digital-experience', label: 'Digital Experience', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9', to: '/digital-experience', sections: [{ title: 'Synthetics', items: [{ label: 'Tests', to: '/synthetic-tests' },{ label: 'Test Suites', to: '/synthetic-tests/suites' },{ label: 'Settings', to: '/synthetics/settings' }] },{ title: 'Real User Monitoring', items: [{ label: 'Performance', to: '/rum' },{ label: 'Session Replay', to: '/rum/session-replay' }] },{ title: 'Product Analytics', items: [{ label: 'Product Analytics', to: '/product-analytics' }] }] },
  { id: 'software-delivery', label: 'Software Delivery', icon: 'M13 10V3L4 14h7v7l9-11h-7z', to: '/software-delivery', sections: [{ title: 'CI Visibility', items: [{ label: 'Pipelines', to: '/software-delivery' },{ label: 'DORA Metrics', to: '/software-delivery/dora' },{ label: 'Deployment Gates', to: '/software-delivery/gates' },{ label: 'PR Gates', to: '/software-delivery/pr-gates' }] },{ title: 'Code Analysis', items: [{ label: 'Code Coverage', to: '/software-delivery/code-coverage' },{ label: 'Code Security', to: '/code-security' }] },{ title: 'Test Optimization', items: [{ label: 'Test Health', to: '/software-delivery/test-health' }] }] },
  { id: 'security', label: 'Security', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', to: '/security', sections: [{ title: 'Cloud SIEM', items: [{ label: 'Overview', to: '/security' },{ label: 'Signals', to: '/security/signals' },{ label: 'Security Feed', to: '/security/feed' }] },{ title: 'Cloud Security', items: [{ label: 'CSM', to: '/security/csm' },{ label: 'Workload Protection', to: '/security/workload' },{ label: 'AI Guard', to: '/security/ai-guard' }] },{ title: 'App Security', items: [{ label: 'AppSec', to: '/security/appsec' },{ label: 'Sensitive Data', to: '/sensitive-data' }] }] },
  { id: 'data-observability', label: 'Data Observability', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4', to: '/data-observability', sections: [{ title: 'Data Observability', docsHref: '#', items: [{ label: 'Catalog', to: '/data-observability' },{ label: 'Jobs', to: '/data-observability/jobs' },{ label: 'Lineage', to: '/data-observability/lineage' },{ label: 'Queries', to: '/data-observability/queries' },{ label: 'Monitors', to: '/data-observability/monitors' }] }] },
  { id: 'ai-observability', label: 'AI Observability', icon: 'M9.663 17h4.673M12 3v1m6.364 2.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707', to: '/ai-observability', sections: [{ title: 'LLM Observability', docsHref: '#', items: [{ label: 'Applications', to: '/ai-observability' },{ label: 'Traces', to: '/ai-observability/traces' },{ label: 'Evaluations', to: '/ai-observability/evaluations' },{ label: 'Experiments', to: '/ai-observability/experiments' }] },{ title: 'Agent Observability', items: [{ label: 'Overview', to: '/ai-observability/agents' },{ label: 'Agent Console', to: '/ai-observability/agents/console' }] }] },
  { id: 'errors', label: 'Errors', icon: 'M18.364 5.636a9 9 0 010 12.728 M5.636 18.364a9 9 0 010-12.728 M8.464 15.536a5 5 0 010-7.072 M15.536 8.464a5 5 0 010 7.072 M12 8v4l2 2', to: '/errors', sections: [{ title: 'Error Tracking', items: [{ label: 'Errors', to: '/errors' },{ label: 'Settings', to: '/errors/settings' }] }] },
  { id: 'metrics', label: 'Metrics', icon: 'M22 12h-4l-3 9L9 3l-3 9H2', to: '/metrics', sections: [{ title: 'Metrics', items: [{ label: 'Explorer', to: '/metrics' },{ label: 'Summary', to: '/metrics/summary' },{ label: 'Volume', to: '/metrics/volume' }] }] },
  { id: 'logs', label: 'Logs', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', to: '/logs', sections: [{ title: 'Logs', docsHref: '#', items: [{ label: 'Explorer', to: '/logs' },{ label: 'Live Tail', to: '/logs/livetail' },{ label: 'Archive Search', to: '/logs/archive' }] },{ title: 'Configuration', items: [{ label: 'Pipelines', to: '/logs/pipelines' },{ label: 'Indexes', to: '/logs/indexes' },{ label: 'Flex Logs', to: '/logs/flex' },{ label: 'Generate Metrics', to: '/logs/generate-metrics' }] }] },
  { id: 'integrations', label: 'Integrations', icon: 'M12 2l7 4.5v9L12 20l-7-4.5v-9L12 2z', to: '/integrations', sections: [{ title: 'Integrations', items: [{ label: 'Integrations', to: '/integrations' },{ label: 'Marketplace', to: '/integrations/marketplace' },{ label: 'Reference Tables', to: '/reference-tables' },{ label: 'Source Code', to: '/source-code' }] },{ title: 'Fleet Automation', items: [{ label: 'Fleet View', to: '/fleet' },{ label: 'Install Agents', to: '/agents/setup' },{ label: 'Upgrades', to: '/agents/upgrades' }] }] },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const isActive = (to: string) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  const handleMouseEnter = (catId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyoutTop(rect.top);
    setHoveredId(catId);
  };

  return (
    <aside className={`flex-shrink-0 bg-[#292e39] flex flex-col transition-[width] duration-200 ease-out h-screen sticky top-0 select-none ${collapsed ? 'w-[52px]' : 'w-[160px]'}`}>
      {/* Logo */}
      <div className="px-2.5 py-2 flex items-center border-b border-white/[0.06] shrink-0" style={{ height: 56 }}>
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-1.5">
          <div className="w-[18px] h-[18px] rounded-[4px] flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(0deg, #d671d0 0%, #7a71cb 100%)' }}>
            <span className="text-white text-[8px] font-bold">ZT</span>
          </div>
          {!collapsed && <span className="text-[13px] font-semibold text-white tracking-[-0.01em]">ZEROTRACE</span>}
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1">
        <button onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className={`flex items-center gap-1.5 text-white/40 hover:text-white/70 rounded-[4px] transition-colors ${collapsed ? 'justify-center w-9 h-9 mx-auto' : 'w-full px-2 py-[3px] h-6'}`}
          style={!collapsed ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          {!collapsed && <span className="flex-1 text-left text-[12px] leading-none">Search...</span>}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-0.5">
        {NAV_ITEMS.map(cat => {
          const hasActiveChild = cat.sections.some(sec => sec.items.some(item => isActive(item.to)));
          return (
            <div key={cat.id} className="relative" onMouseEnter={(e) => handleMouseEnter(cat.id, e)} onMouseLeave={() => setHoveredId(null)}>
              <NavLink to={cat.to} end
                className={`flex items-center gap-2 rounded-[4px] transition-colors ${collapsed ? 'justify-center h-9 w-9 mx-auto' : 'h-[28px] px-2'} ${
                  hasActiveChild || hoveredId === cat.id ? 'text-white/75 bg-white/[0.08]' : 'text-[#babdbb] hover:text-white/80 hover:bg-white/[0.05]'
                }`} title={collapsed ? cat.label : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={hasActiveChild ? 1.8 : 1.5} strokeLinecap="round" className={`shrink-0 ${collapsed ? 'w-[18px] h-[18px]' : 'w-[14px] h-[14px]'}`}><path d={cat.icon}/></svg>
                {!collapsed && <span className="flex-1 text-left text-[13px] truncate font-normal">{cat.label}</span>}
              </NavLink>

              {/* HOVER FLYOUT PANEL — rendered to body via portal to escape all stacking contexts */}
              {hoveredId === cat.id && !collapsed && cat.sections.length > 0 && createPortal(
                <div className="fixed overflow-y-auto" style={{ left: 160, top: flyoutTop, maxHeight: `calc(100vh - ${flyoutTop}px)`, width: 448, background: 'rgb(23, 25, 31)', borderRadius: 0, boxShadow: 'rgba(36,41,49,0.1) 0px 0px 1px 0px, rgba(9,9,11,0.88) 0px 2px 8px 0px', padding: '8px 0', zIndex: 99999 }}
                  onMouseEnter={() => setHoveredId(cat.id)} onMouseLeave={() => setHoveredId(null)}>
                  {cat.sections.map((sec, i) => (
                    <div key={i} className={i < cat.sections.length - 1 ? 'pb-1' : ''}>
                      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.06]">
                        <span className="text-[11px] font-semibold text-white/20 uppercase tracking-[0.05em]">{sec.title}</span>
                        {sec.docsHref && <a href={sec.docsHref} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-white/15 hover:text-white/30 uppercase no-underline flex items-center gap-0.5">Docs<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg></a>}
                      </div>
                      {sec.items.map(item => (
                        <NavLink key={item.to} to={item.to} end onClick={() => setHoveredId(null)}
                          className={({ isActive: a }) => `flex items-center gap-2 py-1 px-4 text-[13px] no-underline transition-colors ${a ? 'text-white bg-purple-500/[0.12] font-semibold' : 'text-white/60 hover:text-white/80 hover:bg-white/[0.04] font-normal'}`}>
                          <span className="flex items-center gap-1.5">{item.label}{item.badge && <span className={`text-[8px] px-1 py-0.5 rounded-[3px] font-bold ${item.badge === 'new' ? 'bg-purple-500/30 text-purple-200' : 'bg-amber-500/30 text-amber-200'}`}>{item.badge.toUpperCase()}</span>}</span>
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </div>,
                document.body
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/[0.06] shrink-0 py-1">
        <NavLink to="/org/billing" className={({ isActive: a }) => `flex items-center gap-1.5 rounded-[4px] transition-colors mx-1 ${collapsed ? 'justify-center h-7 w-7 mx-auto' : 'h-5 px-2'} ${a ? 'text-white/75 bg-white/[0.08]' : 'text-[#babdbb] hover:text-white/80 hover:bg-white/[0.05]'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`shrink-0 ${collapsed ? 'w-[16px] h-[16px]' : 'w-3 h-3'}`}><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="10" x2="12" y2="19"/></svg>
          {!collapsed && <span className="text-[10px] font-medium">Plan &amp; Usage</span>}
        </NavLink>
        {!collapsed && (
          <div className="flex gap-1 mx-1 mt-1">
            {[{ l:'Invite', a:()=>navigate('/organization-settings/users/invite'), d:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 7a4 4 0 100-8 4 4 0 000 8 M19 8v6 M22 11h-6' },{ l:'Support', a:()=>window.open('mailto:support@zerotrace.com'), d:'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },{ l:'Help', a:()=>navigate('/help'), d:'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01', accent:true }].map((t,i)=>(
              <button key={t.l} onClick={t.a} className="flex-1 flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-[4px] text-[#babdbb]/60 hover:text-white/60 hover:bg-white/[0.04] transition-colors relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4" style={t.accent?{color:'rgb(249,157,2)'}:{}}><path d={t.d}/></svg>
                <span className="text-[9px] font-medium leading-none">{t.l}</span>
                {i===2&&<span className="absolute -top-0.5 right-0 text-[7px] font-bold px-1 py-px rounded bg-amber-500/20 text-amber-300">NEW</span>}
              </button>
            ))}
          </div>
        )}
        {user && (
          <div className={`flex items-center mx-1 mt-1 pt-1 border-t border-white/[0.06] ${collapsed?'justify-center':'gap-1.5 px-2'}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{background:'linear-gradient(135deg,#632CA6,#8B5CF6)'}}>{user.email?.[0]?.toUpperCase()||'U'}</div>
            {!collapsed&&<><div className="flex-1 min-w-0"><p className="text-[11px] text-white/70 truncate font-medium">{user.name||user.email}</p></div><button onClick={async()=>{await logout();navigate('/login');}} className="text-white/20 hover:text-white/50 transition-colors"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button></>}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ═══════════════════════ API Keys Page ═══════════════════════ */

function ApiKeysPage() {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]); const [loading, setLoading] = useState(true); const [modalOpen, setModalOpen] = useState(false); const [newKey, setNewKey] = useState<string | null>(null); const [form] = Form.useForm();
  const loadKeys = useCallback(async () => { setLoading(true); try { const data = await api.listApiKeys(); setApiKeys(data.api_keys); } catch (err: any) { message.error(err.message); } finally { setLoading(false); } }, []);
  useEffect(() => { loadKeys(); }, [loadKeys]);
  const handleCreate = async (values: { name: string }) => { try { const data = await api.createApiKey({ name: values.name, scopes: ['*'] }); setNewKey(data.api_key.key); setModalOpen(false); form.resetFields(); loadKeys(); } catch (err: any) { message.error(err.message); } };
  const handleRevoke = async (id: number) => { Modal.confirm({ title: t('dashboard.revokeConfirm'), content: t('dashboard.revokeConfirmDesc'), okText: t('dashboard.revokeKey'), okButtonProps: { danger: true }, onOk: async () => { try { await api.revokeApiKey(id); message.success(t('dashboard.keyRevoked')); loadKeys(); } catch (err: any) { message.error(err.message); } } }); };
  const columns = [
    { title: t('dashboard.name'), dataIndex: 'name', key: 'name', render: (v: string) => <span className="font-medium text-zinc-800">{v}</span> },
    { title: t('dashboard.keyPrefix'), dataIndex: 'key_prefix', key: 'key_prefix', render: (prefix: string) => <code className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md">{prefix}</code> },
    { title: t('dashboard.scopes'), dataIndex: 'scopes', key: 'scopes', width: 160, render: (scopes: string) => { try { return <div className="flex flex-wrap gap-1">{JSON.parse(scopes).map((s: string) => <Tag key={s} className="text-[11px]">{s}</Tag>)}</div>; } catch { return <Tag className="text-[11px]">{scopes}</Tag>; } } },
    { title: t('dashboard.status'), dataIndex: 'status', key: 'status', width: 100, render: (status: string) => <div className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500 animate-pulse-soft' : 'bg-zinc-300'}`} /><span className={`text-xs font-medium ${status === 'active' ? 'text-emerald-600' : 'text-zinc-400'}`}>{status}</span></div> },
    { title: t('dashboard.lastUsed'), dataIndex: 'last_used_at', key: 'last_used_at', render: (v: string | null) => <span className="text-xs text-zinc-400">{v || t('dashboard.never')}</span> },
    { title: t('dashboard.created'), dataIndex: 'created_at', key: 'created_at', render: (v: string) => <span className="text-xs text-zinc-400">{v?.split('T')[0] || v}</span> },
    { title: '', key: 'action', width: 120, render: (_: any, record: ApiKeyItem) => record.status === 'active' ? (<div className="flex items-center gap-1"><Tooltip title={t('dashboard.copyKey')}><Button type="text" size="small" onClick={async () => { try { const data = await api.revealApiKey(record.id); await navigator.clipboard.writeText(data.key); message.success(t('dashboard.keyCopied')); } catch (err: any) { message.error(err.message || 'Failed to reveal key'); } }}>{t('common.copy')}</Button></Tooltip><Tooltip title={t('dashboard.revokeKey')}><Button type="text" size="small" danger onClick={() => handleRevoke(record.id)}>{t('dashboard.revokeKey')}</Button></Tooltip></div>) : null },
  ];
  return (
    <div className="animate-fade-in">
      {newKey && <div className="mb-8"><KeyReveal value={newKey} onDone={() => setNewKey(null)} /></div>}
      <div className="flex items-start justify-between mb-8"><div><h2 className="text-2xl font-bold tracking-tight text-zinc-900">{t('dashboard.apiKeys')}</h2><p className="text-sm text-zinc-500 mt-1 max-w-lg">{t('dashboard.apiKeysDesc')}</p></div><Button type="primary" onClick={() => setModalOpen(true)} className="h-10 font-medium shrink-0 btn-tactile">{t('dashboard.newKey')}</Button></div>
      <div className="bento-card p-0 overflow-hidden">{loading ? <div className="p-8"><TableSkeleton rows={apiKeys.length || 5} /></div> : apiKeys.length === 0 ? <EmptyApiKeys onCreate={() => setModalOpen(true)} /> : <Table dataSource={apiKeys} columns={columns} rowKey="id" pagination={false} className="api-keys-table" locale={{ emptyText: t('dashboard.tableEmpty') }} />}</div>
      <div className="mt-6 flex items-center gap-6 text-xs text-zinc-400"><span>{t('dashboard.keysCount', { count: apiKeys.length })}</span><span>{t('dashboard.activeCount', { count: apiKeys.filter(k => k.status === 'active').length })}</span></div>
      <Modal title={t('dashboard.createApiKey')} open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} footer={null} width={440}><Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false} className="mt-2"><Form.Item name="name" label={<span className="text-sm font-medium text-zinc-700">{t('dashboard.keyName')}</span>} rules={[{ required: true, message: t('dashboard.enterDescriptiveName') }]}><Input placeholder={t('dashboard.keyNamePlaceholder')} className="h-10" /></Form.Item><div className="flex gap-2 justify-end"><Button onClick={() => { setModalOpen(false); form.resetFields(); }}>{t('common.cancel')}</Button><Button type="primary" htmlType="submit">{t('dashboard.generate')}</Button></div></Form></Modal>
    </div>
  );
}

export default function DashboardLayout() {
  return (<div className="flex min-h-[100dvh] bg-zinc-50"><Sidebar /><main className="flex-1 min-w-0 p-6 lg:p-8"><Outlet /></main><CommandPalette /></div>);
}

export { ApiKeysPage };
