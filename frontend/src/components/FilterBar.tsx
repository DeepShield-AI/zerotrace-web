import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchOutlined, CloseOutlined } from '@ant-design/icons';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  groupBy: string;
  onGroupByChange: (g: string) => void;
  totalCount: number;
  onlineCount: number;
  staleCount: number;
  lastUpdated: Date | null;
}

export default function FilterBar({
  searchQuery, onSearchChange, groupBy, onGroupByChange,
  totalCount, onlineCount, staleCount, lastUpdated,
}: FilterBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const offlineCount = totalCount - onlineCount - staleCount;

  const handleChange = useCallback((val: string) => {
    setLocalQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(val), 150);
  }, [onSearchChange]);

  useEffect(() => { setLocalQuery(searchQuery); }, [searchQuery]);
  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  const freshnessText = useMemo(() => {
    if (!lastUpdated) return '';
    const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (secs < 5) return t('infrastructure.justNow');
    if (secs < 60) return t('infrastructure.secondsAgo', { secs });
    return t('infrastructure.minutesAgo', { mins: Math.floor(secs / 60) });
  }, [lastUpdated, t]);

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search — Datadog-style with integrated count */}
      <div className="relative flex-1 max-w-[420px]">
        <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300 text-[13px]" />
        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={e => handleChange(e.target.value)}
          placeholder={`${t('infrastructure.filterHostsPlaceholder')}  (${totalCount})`}
          className="w-full h-9 pl-9 pr-8 text-[13px] border border-zinc-200 rounded-md bg-white
            placeholder:text-zinc-300 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-50 transition-all"
        />
        {localQuery && (
          <button
            onClick={() => { setLocalQuery(''); onSearchChange(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-300 hover:text-zinc-500"
          >
            <CloseOutlined className="text-[10px]" />
          </button>
        )}
      </div>

      {/* Group by toggle — subtle Datadog style */}
      <div className="flex items-center rounded-md border border-zinc-200 overflow-hidden">
        <button
          onClick={() => onGroupByChange('none')}
          className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
            groupBy === 'none' ? 'bg-zinc-100 text-zinc-800' : 'bg-white text-zinc-400 hover:text-zinc-600'
          }`}
        >
          {t('infrastructure.noGrouping')}
        </button>
        <button
          onClick={() => onGroupByChange('status')}
          className={`px-3 py-1.5 text-[11px] font-medium border-l border-zinc-200 transition-colors ${
            groupBy === 'status' ? 'bg-zinc-100 text-zinc-800' : 'bg-white text-zinc-400 hover:text-zinc-600'
          }`}
        >
          {t('infrastructure.byStatus')}
        </button>
      </div>

      {/* Metric summary — Datadog inline stats */}
      <div className="flex items-center gap-3 ml-auto text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="font-mono font-semibold text-zinc-500">{totalCount}</span> hosts
        </span>
        <span className="text-zinc-200">|</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
          <span className="font-mono text-zinc-500">{onlineCount}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="font-mono text-zinc-500">{staleCount}</span>
        </span>
        {offlineCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="font-mono text-zinc-500">{offlineCount}</span>
          </span>
        )}
        {lastUpdated && (
          <>
            <span className="text-zinc-200">|</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-live" />
              {t('infrastructure.updated')} {freshnessText}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
