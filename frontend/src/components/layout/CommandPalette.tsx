import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ── Types ── */

interface PaletteItem {
  label: string;
  description?: string;
  path: string;
  group: string;
  icon: React.ReactNode;
}

/* ── Pages registry ── */

function usePages(): PaletteItem[] {
  const { t } = useTranslation();

  return [
    // Observe
    { label: t('sidebar.infrastructure'), path: '/infrastructure', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
    )},
    { label: 'APM Services', description: 'Application Performance Monitoring', path: '/apm', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    )},
    { label: 'Metrics Explorer', path: '/metrics', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
    )},
    { label: t('sidebar.dashboards'), path: '/dashboards', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/></svg>
    )},
    { label: t('sidebar.monitors'), path: '/monitors', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
    )},
    { label: t('sidebar.logs'), path: '/logs', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    )},
    { label: t('sidebar.errors'), path: '/errors', group: 'Observe', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    )},

    // Security
    { label: t('sidebar.security'), path: '/security', group: 'Security', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    )},

    // AI
    { label: t('sidebar.bitsAI'), path: '/guardian', group: 'AI', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2a7 7 0 017 7c0 2.38-.95 4.55-2.5 6.16"/></svg>
    )},

    // Management
    { label: t('sidebar.agentManagement'), path: '/agents/setup', group: 'Management', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12v0"/></svg>
    )},
    { label: t('sidebar.organization'), path: '/org/api-keys', group: 'Management', icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
    )},
  ];
}

/* ── CommandPalette ── */

export default function CommandPalette() {
  const pages = usePages();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return pages;
    const q = query.toLowerCase();
    return pages.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.path.toLowerCase().includes(q) ||
      p.group.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [pages, query]);

  // Group filtered results
  const grouped = useMemo(() => {
    const groups = new Map<string, PaletteItem[]>();
    filtered.forEach(p => {
      const list = groups.get(p.group) || [];
      list.push(p);
      groups.set(p.group, list);
    });
    return groups;
  }, [filtered]);

  const flatList = useMemo(() => filtered, [filtered]);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelectedIdx(0);
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const navigateTo = useCallback((path: string) => {
    closePalette();
    navigate(path);
  }, [closePalette, navigate]);

  // Listen for custom event from "Go To" button click
  useEffect(() => {
    const handler = () => openPalette();
    window.addEventListener('open-command-palette' as any, handler);
    return () => window.removeEventListener('open-command-palette' as any, handler);
  }, [openPalette]);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
      if (e.key === 'Escape' && open) {
        closePalette();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, openPalette, closePalette]);

  // Keyboard navigation within palette
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(prev + 1, flatList.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatList[selectedIdx];
        if (item) navigateTo(item.path);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, selectedIdx, flatList, navigateTo]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIdx]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm" onClick={closePalette} />

      {/* Palette */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-[540px] bg-bg-elevated rounded-xl shadow-2xl border border-border overflow-hidden animate-fade-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <svg className="w-5 h-5 text-fg-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Jump to a page..."
            className="flex-1 text-[15px] text-fg-primary bg-transparent outline-none placeholder:text-fg-tertiary"
          />
          <kbd className="text-[11px] text-fg-tertiary bg-bg-muted px-2 py-0.5 rounded font-mono">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
          {flatList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-fg-tertiary">No pages found</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">
                  {group}
                </div>
                {items.map(item => {
                  const idx = flatIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={item.path}
                      data-idx={idx}
                      onClick={() => navigateTo(item.path)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-[#F3F0FA] text-accent-primary'
                          : 'text-fg-secondary hover:bg-bg-subtle'
                      }`}
                    >
                      <span className={`shrink-0 ${isSelected ? 'text-accent-primary' : 'text-fg-tertiary'}`}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{item.label}</p>
                        {item.description && (
                          <p className="text-[11px] text-fg-tertiary truncate">{item.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <svg className="w-4 h-4 shrink-0 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M5 12h14" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border-subtle bg-bg-subtle/50 text-[11px] text-fg-tertiary">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded text-[10px] font-mono">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded text-[10px] font-mono">⏎</kbd> Open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded text-[10px] font-mono">esc</kbd> Close
          </span>
        </div>
      </div>
    </>
  );
}
