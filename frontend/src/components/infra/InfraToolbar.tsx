import { UnorderedListOutlined, GlobalOutlined, DownloadOutlined } from '@ant-design/icons';

export type InfraToolbarProps = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  groupBy: string;
  onGroupByChange: (g: string) => void;
  infraView: 'table' | 'map';
  onViewChange: (v: 'table' | 'map') => void;
  onExport: (format: 'csv' | 'json') => void;
  searchRef: React.Ref<HTMLInputElement>;
};

export default function InfraToolbar({
  searchQuery, onSearchChange, groupBy, onGroupByChange,
  infraView, onViewChange, onExport, searchRef,
}: InfraToolbarProps) {
  return (
    <div className="flex items-center justify-between bg-bg-elevated border border-border rounded-md px-3 py-1.5">
      <div className="flex items-center gap-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input ref={searchRef} type="text" value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Filter hosts..."
            className="w-[260px] h-8 pl-8 pr-3 text-[13px] border border-border rounded bg-bg-elevated placeholder:text-fg-disabled focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/10 transition-all"
          />
        </div>
        <div className="flex items-center rounded border border-border overflow-hidden">
          <button onClick={() => onGroupByChange('none')}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${groupBy === 'none' ? 'bg-bg-muted text-fg-primary' : 'bg-bg-elevated text-fg-tertiary hover:text-fg-secondary'}`}>
            No Grouping
          </button>
          <button onClick={() => onGroupByChange('status')}
            className={`px-2.5 py-1 text-[11px] font-medium border-l border-border transition-colors ${groupBy === 'status' ? 'bg-bg-muted text-fg-primary' : 'bg-bg-elevated text-fg-tertiary hover:text-fg-secondary'}`}>
            Status
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative group">
          <button className="flex items-center gap-1 px-2.5 h-7 text-[11px] font-medium text-fg-tertiary hover:text-fg-secondary border border-border rounded bg-bg-elevated hover:bg-bg-subtle transition-colors">
            <DownloadOutlined style={{ fontSize: 12 }} />
            Export
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor"><path d="M6 8L2 4h8z" /></svg>
          </button>
          <div className="absolute right-0 top-full mt-1 bg-bg-elevated border border-border rounded-md shadow-lg z-20 hidden group-hover:block py-1 min-w-[120px]">
            <button onClick={() => onExport('csv')} className="w-full text-left px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-subtle transition-colors">Export CSV</button>
            <button onClick={() => onExport('json')} className="w-full text-left px-3 py-1.5 text-[12px] text-fg-secondary hover:bg-bg-subtle transition-colors">Export JSON</button>
          </div>
        </div>

        <div className="flex items-center rounded border border-border overflow-hidden">
          <button onClick={() => onViewChange('table')}
            className={`p-1.5 transition-colors ${infraView === 'table' ? 'bg-bg-muted text-fg-secondary' : 'bg-bg-elevated text-fg-tertiary hover:text-fg-secondary'}`}
            title="Table"><UnorderedListOutlined style={{ fontSize: 14 }} /></button>
          <button onClick={() => onViewChange('map')}
            className={`p-1.5 border-l border-border transition-colors ${infraView === 'map' ? 'bg-bg-muted text-fg-secondary' : 'bg-bg-elevated text-fg-tertiary hover:text-fg-secondary'}`}
            title="Map"><GlobalOutlined style={{ fontSize: 14 }} /></button>
        </div>
      </div>
    </div>
  );
}
