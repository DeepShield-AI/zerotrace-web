import { useTranslation } from 'react-i18next';

interface HostMapLegendProps {
  onlineCount: number;
  staleCount: number;
  offlineCount: number;
}

export default function HostMapLegend({ onlineCount, staleCount, offlineCount }: HostMapLegendProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22c55e' }} />{onlineCount} {t('hostTable.on')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />{staleCount} {t('hostTable.stale')}
      </span>
      {offlineCount > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#ef4444' }} />{offlineCount} {t('hostTable.offline')}
        </span>
      )}
    </div>
  );
}
