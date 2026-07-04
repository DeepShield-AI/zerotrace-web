import type { ReactNode } from 'react';

export function Tabs({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[];
  active: string; onChange: (key: string) => void;
}) {
  return (
    <nav className="flex items-center gap-0 border-b border-border">
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onChange(tab.key)}
          className={`relative px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            active === tab.key
              ? 'text-accent-primary border-accent-primary'
              : 'text-fg-secondary border-transparent hover:text-fg-primary hover:border-border-strong'
          }`}>
          {tab.label}
          {tab.count != null && (
            <span className={`ml-1.5 text-2xs px-1.5 py-0.5 rounded-full ${active === tab.key ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-muted text-fg-tertiary'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function TabPanel({ children }: { children: ReactNode }) {
  return <div className="py-3">{children}</div>;
}
