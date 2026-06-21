import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN';
    i18n.changeLanguage(next);
  };

  const isZh = i18n.language === 'zh-CN';
  const currentLabel = isZh ? '中文' : 'English';
  const nextLabel = isZh ? 'EN' : '中';

  if (collapsed) {
    return (
      <button
        onClick={toggleLanguage}
        className="w-7 h-7 flex items-center justify-center rounded-md text-[10px] font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
        title={isZh ? 'Switch to English' : '切换到中文'}
      >
        {nextLabel}
      </button>
    );
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium
        text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all group w-full"
      title={isZh ? 'Switch to English' : '切换到中文'}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
      <span className="flex-1 text-left whitespace-nowrap">{currentLabel}</span>
      <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded transition-colors group-hover:bg-zinc-700/60">
        {nextLabel}
      </span>
    </button>
  );
}
