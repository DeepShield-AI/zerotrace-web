import { useTranslation } from 'react-i18next';

interface HostMapLegendProps {
  onlineCount: number;
  staleCount: number;
  offlineCount: number;
}

export default function HostMapLegend({ onlineCount, staleCount, offlineCount }: HostMapLegendProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-[11px] text-fg-tertiary">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-severity-ok" />{onlineCount} {t('hostTable.on')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-severity-warn" />{staleCount} {t('hostTable.stale')}
      </span>
      {offlineCount > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-severity-alert" />{offlineCount} {t('hostTable.offline')}
        </span>
      )}
    </div>
  );
}
