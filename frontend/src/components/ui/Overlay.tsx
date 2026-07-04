import { useEffect, useCallback, type ReactNode } from 'react';

// ════════════════════════ MODAL (druids_dialogs) ════════════════════════
export function Modal({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) { window.addEventListener('keydown', h); document.body.style.overflow = 'hidden'; }
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-modal border border-edge animate-scale-in overflow-hidden" style={{ width, maxWidth: '90vw' }}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-edge-light">
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ════════════════════════ SLIDE PANEL (right-side drawer) ════════════════════════
export function SlidePanel({ open, onClose, title, children, width = 480 }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-panel" onClick={onClose}>
        <div className="absolute inset-0 bg-black/15" />
      </div>
      <div className="fixed right-0 top-0 h-full z-panel bg-white border-l border-edge shadow-xl flex flex-col animate-slide-left" style={{ width }}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-edge-light shrink-0">
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

// ════════════════════════ TOOLTIP (druids_lockup) ════════════════════════
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-2xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-tooltip whitespace-nowrap">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
      </div>
    </div>
  );
}

// ════════════════════════ TOP TOOLTIP (for charts) ════════════════════════
export function ChartTooltip({ x, y, visible, children }: { x: number; y: number; visible: boolean; children: ReactNode }) {
  if (!visible) return null;
  return (
    <div className="fixed z-tooltip pointer-events-none" style={{ left: x + 12, top: y - 8 }}>
      <div className="bg-gray-900 text-white text-2xs font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap">
        {children}
      </div>
    </div>
  );
}
