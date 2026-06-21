import { useEffect, useState, useCallback, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Table, Modal, Form, Input, message, Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';
import LanguageSwitcher from '../components/LanguageSwitcher';
import CommandPalette from '../components/CommandPalette';
import { useTheme } from '../hooks/useTheme';

/* ---------- Types ---------- */
interface ApiKeyItem {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string;
  last_used_at: string | null;
  status: string;
  created_at: string;
}

/* ---------- Skeleton loader ---------- */
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-5 w-48" />
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-5 w-16" />
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyApiKeys({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" className="text-zinc-400">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-zinc-800 mb-1">{t('dashboard.noApiKeys')}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">
        {t('dashboard.noApiKeysDesc')}
      </p>
      <Button type="primary" onClick={onCreate} className="h-10 font-medium btn-tactile">
        {t('dashboard.createFirstKey')}
      </Button>
    </div>
  );
}

/* ---------- Key reveal banner ---------- */
function KeyReveal({ value, onDone }: { value: string; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 animate-slide-up">
      <div className="flex items-start gap-3 mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" className="text-amber-600 mt-0.5 shrink-0">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <h4 className="font-semibold text-amber-800 text-sm">{t('dashboard.storeSecurely')}</h4>
          <p className="text-amber-700 text-xs mt-0.5">{t('dashboard.storeSecurelyDesc')}</p>
        </div>
      </div>
      <div className="bg-amber-100/60 rounded-xl p-3 mb-3">
        <code className="text-sm font-mono text-amber-900 break-all select-all">{value}</code>
      </div>
      <div className="flex gap-2">
        <Button size="small" onClick={() => { navigator.clipboard.writeText(value); message.success(t('dashboard.keyCopied')); }}>
          {t('common.copy')}
        </Button>
        <Button type="primary" size="small" onClick={onDone}>{t('dashboard.iHaveSavedIt')}</Button>
      </div>
    </div>
  );
}

/* ---------- Datadog-style sidebar ---------- */

interface FlyoutItem {
  label: string;
  to: string;
  end?: boolean;
  icon: string;
  statusDot?: 'green' | 'amber' | 'red' | 'purple';
  badge?: number;
}

interface NavItem {
  label: string;
  icon: string;
  to?: string;
  end?: boolean;
  statusDot?: 'green' | 'amber' | 'red' | 'purple';
  flyout?: FlyoutItem[];
}

function useSidebarItems(): { quickAccessItems: NavItem[]; productItems: NavItem[]; coreItems: NavItem[]; bottomItems: NavItem[] } {
  const { t } = useTranslation();

  const quickAccessItems: NavItem[] = [
    { label: t('sidebar.recently'), icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: t('sidebar.bitsAI'), icon: 'M9.663 17h4.673M12 3v1m6.364 2.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', to: '/guardian' },
    { label: t('sidebar.dashboards'), icon: 'M3 3h7v7H3V3z M14 3h7v7h-7V3z M14 14h7v7h-7v-7z M3 14h7v7H3v-7z', to: '/dashboards' },
    { label: t('sidebar.monitors'), icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01', to: '/monitors', statusDot: 'amber' },
    { label: t('sidebar.incidentResponse'), icon: 'M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z M12 9v2m0 4h.01', to: '/incidents' },
    { label: t('sidebar.automation'), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', to: '/automation' },
  ];

  const productItems: NavItem[] = [
    {
      label: t('sidebar.infrastructure'), icon: 'M2 13.5h4l1-4h3l2 6h2.5l1.5-3h2.5l1 5h1.5M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z', statusDot: 'green',
      flyout: [
        { label: t('sidebar.hosts'), to: '/infrastructure', end: true, icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
        { label: t('sidebar.containers'), to: '/infrastructure/containers', end: true, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      ],
    },
    { label: t('sidebar.cloudCost'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', to: '/cloud-cost' },
    {
      label: t('sidebar.apm'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      flyout: [
        { label: t('sidebar.services'), to: '/apm', end: true, icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
        { label: t('sidebar.traces'), to: '/apm?view=traces', end: true, icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8' },
        { label: t('sidebar.serviceMap'), to: '/apm?view=topology', end: true, icon: 'M3 3h18v18H3V3z M3 9h18 M9 3v18' },
      ],
    },
    { label: t('sidebar.digitalExperience'), icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9', to: '/digital-experience' },
    { label: t('sidebar.softwareDelivery'), icon: 'M13 10V3L4 14h7v7l9-11h-7z', to: '/software-delivery' },
    { label: t('sidebar.security'), icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', to: '/security' },
    { label: t('sidebar.dataObservability'), icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4', to: '/data-observability' },
    { label: t('sidebar.aiObservability'), icon: 'M9.663 17h4.673M12 3v1m6.364 2.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', to: '/ai-observability' },
  ];

  const coreItems: NavItem[] = [
    { label: t('sidebar.errors'), icon: 'M18.364 5.636a9 9 0 010 12.728 M5.636 18.364a9 9 0 010-12.728 M8.464 15.536a5 5 0 010-7.072 M15.536 8.464a5 5 0 010 7.072 M12 8v4l2 2', to: '/errors' },
    { label: t('sidebar.metrics'), icon: 'M22 12h-4l-3 9L9 3l-3 9H2', to: '/metrics' },
    { label: t('sidebar.logs'), icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', to: '/logs', statusDot: 'amber' },
  ];

  const bottomItems: NavItem[] = [
    { label: t('sidebar.agentManagement'), to: '/agents', icon: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm2 6h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2z' },
    { label: t('sidebar.organization'), to: '/org', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return { quickAccessItems, productItems, coreItems, bottomItems };
}

/* ── Theme toggle ── */

function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
        title={isDark ? 'Switch to Light' : 'Switch to Dark'}
      >
        {isDark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium
        text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all group w-full"
      title={isDark ? 'Switch to Light' : 'Switch to Dark'}
    >
      {isDark ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
      <span className="flex-1 text-left whitespace-nowrap">{isDark ? 'Dark' : 'Light'}</span>
      <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isDark ? 'bg-amber-400' : 'bg-zinc-400'}`} />
    </button>
  );
}

/* ── Sidebar ── */

function Sidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [goToOpen, setGoToOpen] = useState(false);

  const { quickAccessItems, productItems, coreItems, bottomItems } = useSidebarItems();

  const statusDotColor = (dot?: string) => {
    switch (dot) {
      case 'green': return 'bg-emerald-400';
      case 'amber': return 'bg-amber-400';
      case 'red': return 'bg-red-400';
      case 'purple': return 'bg-purple-400';
      default: return '';
    }
  };

  const isActive = (to: string, end?: boolean) => {
    if (end) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const hasActiveFlyout = (flyout?: FlyoutItem[]) => {
    if (!flyout) return false;
    return flyout.some(f => isActive(f.to, f.end));
  };

  const handleHover = (label: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoveredItem(label);
  };

  const handleHoverLeave = () => {
    hoverTimeout.current = setTimeout(() => setHoveredItem(null), 150);
  };

  const NavIcon = ({ d, active }: { d: string; active: boolean }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? '2' : '1.5'} strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0 transition-all duration-150">
      <path d={d} />
    </svg>
  );

  const renderItem = (item: NavItem) => {
    const active = item.to ? isActive(item.to, item.end) : hasActiveFlyout(item.flyout);
    const hasFlyout = !!item.flyout?.length;

    const itemContent = (
      <div
        className={`flex items-center w-full h-6 mx-1.5 rounded-sm text-[12px] font-medium transition-all duration-150 group relative ${
          collapsed ? 'justify-center px-0' : 'px-2 gap-1.5'
        } ${
          active
            ? 'bg-purple-500/12 text-purple-300'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
        }`}
        onMouseEnter={() => hasFlyout && handleHover(item.label)}
        onMouseLeave={handleHoverLeave}
      >
        {active && (
          <div className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full bg-purple-400" />
        )}
        <span className="relative shrink-0">
          <NavIcon d={item.icon} active={active} />
          {collapsed && item.statusDot && (
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDotColor(item.statusDot)} ring-1 ring-zinc-950`} />
          )}
        </span>
        <span className={`whitespace-nowrap transition-opacity duration-200 flex-1 text-left ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
          {item.label}
        </span>
        {!collapsed && item.statusDot && (
          <span className={`ml-auto w-1.5 h-1.5 rounded-full ${statusDotColor(item.statusDot)}`} />
        )}
        {!collapsed && hasFlyout && (
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="shrink-0 text-zinc-600 group-hover:text-zinc-400 ml-auto">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </div>
    );

    if (hasFlyout) {
      return (
        <div key={item.label} className="relative">
          <button
            onClick={() => {
              if (item.flyout?.[0]) navigate(item.flyout[0].to);
            }}
            className="w-full text-left"
          >
            {itemContent}
          </button>

          {hoveredItem === item.label && !collapsed && (
            <div
              className="absolute left-full top-0 ml-1 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl py-1 min-w-[180px] z-50"
              onMouseEnter={() => handleHover(item.label)}
              onMouseLeave={handleHoverLeave}
            >
              <div className="px-2 pb-0.5 mb-0.5 border-b border-zinc-800/60">
                <span className="text-[8px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{item.label}</span>
              </div>
              {item.flyout!.map((child) => {
                const childActive = isActive(child.to, child.end);
                return (
                  <NavLink
                    key={child.label}
                    to={child.to}
                    end={child.end}
                    className={`flex items-center gap-1.5 px-2 h-6 text-[11px] font-medium transition-all duration-100 ${
                      childActive
                        ? 'bg-purple-500/10 text-purple-300'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth={childActive ? '1.5' : '1'} strokeLinecap="round" strokeLinejoin="round"
                      className="shrink-0">
                      <path d={child.icon} />
                    </svg>
                    <span>{child.label}</span>
                    {child.statusDot && (
                      <span className={`ml-auto w-1 h-1 rounded-full ${statusDotColor(child.statusDot)}`} />
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.label}
        to={item.to || '/'}
        end={item.end}
        className="block"
      >
        {itemContent}
      </NavLink>
    );
  };

  return (
    <aside
      className={`shrink-0 flex flex-col bg-zinc-950 h-screen sticky top-0 transition-[width] duration-300 ease-spring select-none ${
        collapsed ? 'w-[60px]' : 'w-[232px]'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-10 border-b border-zinc-800/60 shrink-0 ${collapsed ? 'justify-center' : 'px-4'}`}>
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #632CA6, #8B5CF6)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 010 20" />
              <path d="M2 12h20" />
            </svg>
          </div>
          <span className={`text-[13px] font-semibold tracking-tight text-zinc-100 whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
            {t('common.appName')}
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-hidden pt-0.5">
        {/* Part 1: Go To */}
        <div className="px-2 mb-0.5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className={`flex items-center w-full h-6 rounded-sm text-[11px] font-medium transition-all duration-150 ${
              collapsed ? 'justify-center px-0' : 'px-2 gap-1.5'
            } text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className={`whitespace-nowrap transition-opacity duration-200 flex-1 text-left ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              {t('sidebar.goTo')}
            </span>
            {!collapsed && (
              <kbd className="text-[8px] text-zinc-600 bg-zinc-800/50 px-1 rounded font-mono">⌘K</kbd>
            )}
          </button>
        </div>

        {/* Part 2: Quick Access */}
        <div>
          {!collapsed && (
            <div className="px-3 pb-px">
              <span className="text-[8px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{t('sidebar.quickAccess')}</span>
            </div>
          )}
          {quickAccessItems.map(renderItem)}
        </div>

        {/* Part 3: Product Areas */}
        <div className="mt-1 pt-1 border-t border-zinc-800/60">
          {!collapsed && (
            <div className="px-3 pb-px">
              <span className="text-[8px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{t('sidebar.products')}</span>
            </div>
          )}
          {productItems.map(renderItem)}
        </div>

        {/* Part 4: Core Features */}
        <div className="mt-1 pt-1 border-t border-zinc-800/60">
          {!collapsed && (
            <div className="px-3 pb-px">
              <span className="text-[8px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{t('sidebar.core')}</span>
            </div>
          )}
          {coreItems.map(renderItem)}
        </div>

        {/* Part 5: Management */}
        <div className="mt-1 pt-1 border-t border-zinc-800/60">
          {!collapsed && (
            <div className="px-3 pb-px">
              <span className="text-[8px] font-semibold uppercase tracking-[0.06em] text-zinc-500">{t('sidebar.manage')}</span>
            </div>
          )}
          {bottomItems.map(renderItem)}
        </div>
      </nav>

      {/* Bottom section — Datadog-style compact */}
      <div className="border-t border-zinc-800/60 shrink-0 py-1 space-y-px">
        {/* Language + Theme row */}
        {collapsed ? (
          <div className="flex items-center justify-center gap-1 py-0.5">
            <LanguageSwitcher collapsed />
            <ThemeToggle collapsed />
          </div>
        ) : (
          <div className="space-y-px px-2">
            <div className="flex items-center h-7 px-1">
              <LanguageSwitcher />
            </div>
            <div className="flex items-center h-7 px-1">
              <ThemeToggle />
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="mx-3 border-t border-zinc-800/50" />

        {/* User row */}
        <button
          onClick={() => navigate('/org')}
          className={`flex items-center h-8 transition-all duration-200 rounded-md
            text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60
            ${collapsed ? 'justify-center w-7 h-7 mx-auto' : 'gap-2 px-2.5 py-1.5 mx-2'}`}
        >
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #632CA6, #8B5CF6)' }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-zinc-300 leading-tight truncate">{user?.name}</p>
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          title={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Sign out */}
        <button onClick={async () => { await logout(); navigate('/login'); }}
          className={`flex items-center w-full h-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors ${collapsed ? 'justify-center' : 'px-3 gap-2'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!collapsed && (
            <span className="text-[10px] whitespace-nowrap">{t('common.signOut')}</span>
          )}
        </button>
      </div>
    </aside>
  );
}

/* ---------- API Keys page content ---------- */
function ApiKeysPage() {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listApiKeys();
      setApiKeys(data.api_keys);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleCreate = async (values: { name: string }) => {
    try {
      const data = await api.createApiKey({ name: values.name, scopes: ['*'] });
      setNewKey(data.api_key.key);
      setModalOpen(false);
      form.resetFields();
      loadKeys();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleRevoke = async (id: number) => {
    Modal.confirm({
      title: t('dashboard.revokeConfirm'),
      content: t('dashboard.revokeConfirmDesc'),
      okText: t('dashboard.revokeKey'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.revokeApiKey(id);
          message.success(t('dashboard.keyRevoked'));
          loadKeys();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: t('dashboard.name'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span className="font-medium text-zinc-800">{v}</span>,
    },
    {
      title: t('dashboard.keyPrefix'),
      dataIndex: 'key_prefix',
      key: 'key_prefix',
      render: (prefix: string) => (
        <code className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md">{prefix}</code>
      ),
    },
    {
      title: t('dashboard.scopes'),
      dataIndex: 'scopes',
      key: 'scopes',
      width: 160,
      render: (scopes: string) => {
        try {
          return (
            <div className="flex flex-wrap gap-1">
              {JSON.parse(scopes).map((s: string) => (
                <Tag key={s} className="text-[11px]">{s}</Tag>
              ))}
            </div>
          );
        } catch {
          return <Tag className="text-[11px]">{scopes}</Tag>;
        }
      },
    },
    {
      title: t('dashboard.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500 animate-pulse-soft' : 'bg-zinc-300'}`} />
          <span className={`text-xs font-medium ${status === 'active' ? 'text-emerald-600' : 'text-zinc-400'}`}>
            {status}
          </span>
        </div>
      ),
    },
    {
      title: t('dashboard.lastUsed'),
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (v: string | null) => <span className="text-xs text-zinc-400">{v || t('dashboard.never')}</span>,
    },
    {
      title: t('dashboard.created'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v: string) => <span className="text-xs text-zinc-400">{v?.split('T')[0] || v}</span>,
    },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_: any, record: ApiKeyItem) =>
        record.status === 'active' ? (
          <div className="flex items-center gap-1">
            <Tooltip title={t('dashboard.copyKey')}>
              <Button
                type="text"
                size="small"
                onClick={async () => {
                  try {
                    const data = await api.revealApiKey(record.id);
                    await navigator.clipboard.writeText(data.key);
                    message.success(t('dashboard.keyCopied'));
                  } catch (err: any) {
                    message.error(err.message || 'Failed to reveal key');
                  }
                }}
              >
                {t('common.copy')}
              </Button>
            </Tooltip>
            <Tooltip title={t('dashboard.revokeKey')}>
              <Button type="text" size="small" danger onClick={() => handleRevoke(record.id)}>
                {t('dashboard.revokeKey')}
              </Button>
            </Tooltip>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="animate-fade-in">
      {newKey && (
        <div className="mb-8">
          <KeyReveal value={newKey} onDone={() => setNewKey(null)} />
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{t('dashboard.apiKeys')}</h2>
          <p className="text-sm text-zinc-500 mt-1 max-w-lg">
            {t('dashboard.apiKeysDesc')}
          </p>
        </div>
        <Button type="primary" onClick={() => setModalOpen(true)} className="h-10 font-medium shrink-0 btn-tactile">
          {t('dashboard.newKey')}
        </Button>
      </div>

      <div className="bento-card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8"><TableSkeleton rows={apiKeys.length || 5} /></div>
        ) : apiKeys.length === 0 ? (
          <EmptyApiKeys onCreate={() => setModalOpen(true)} />
        ) : (
          <Table
            dataSource={apiKeys}
            columns={columns}
            rowKey="id"
            pagination={false}
            className="api-keys-table"
            locale={{ emptyText: t('dashboard.tableEmpty') }}
          />
        )}
      </div>

      <div className="mt-6 flex items-center gap-6 text-xs text-zinc-400">
        <span>{t('dashboard.keysCount', { count: apiKeys.length })}</span>
        <span>{t('dashboard.activeCount', { count: apiKeys.filter(k => k.status === 'active').length })}</span>
      </div>

      <Modal
        title={t('dashboard.createApiKey')}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false} className="mt-2">
          <Form.Item
            name="name"
            label={<span className="text-sm font-medium text-zinc-700">{t('dashboard.keyName')}</span>}
            rules={[{ required: true, message: t('dashboard.enterDescriptiveName') }]}
          >
            <Input placeholder={t('dashboard.keyNamePlaceholder')} className="h-10" />
          </Form.Item>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit">{t('dashboard.generate')}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

/* ---------- Layout shell with sidebar ---------- */
export default function DashboardLayout() {
  return (
    <div className="flex min-h-[100dvh] bg-zinc-50">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  );
}

export { ApiKeysPage };
