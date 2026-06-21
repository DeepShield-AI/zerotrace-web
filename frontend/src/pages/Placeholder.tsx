import { useTranslation } from 'react-i18next';

interface Props {
  title: string;
  description: string;
  icon: string;
}

export default function PlaceholderPage({ title, description, icon }: Props) {
  const { t } = useTranslation();

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
            <path d={icon} />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h2>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
      </div>

      <div className="bento-card flex flex-col items-center justify-center py-24 text-center">
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" className="text-zinc-300">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-brand-400 dot-live" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-600 mb-2">{t('placeholder.comingSoon')}</h3>
        <p className="text-sm text-zinc-400 max-w-sm">
          {t('placeholder.underDevelopment')}
        </p>

        <div className="mt-8 flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-zinc-300"
              style={{ animation: i === 0 ? 'pulseSoft 2s ease-in-out infinite' : 'none', animationDelay: `${i * 400}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
