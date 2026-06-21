import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function AgentMgmtLayout() {
  const { t } = useTranslation();

  const subNav = [
    { to: '/agents/setup', label: t('agentMgmt.setup'), end: false },
    { to: '/agents/status', label: t('agentMgmt.status'), end: false },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{t('agentMgmt.title')}</h2>
        <p className="text-sm text-zinc-500 mt-1">{t('agentMgmt.subtitle')}</p>
      </div>

      <nav className="flex gap-1 mb-8 border-b border-zinc-200/60">
        {subNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium border-b-[2px] -mb-[2px] transition-colors duration-200 ${
                isActive
                  ? 'text-brand-600 border-brand-600'
                  : 'text-zinc-500 border-transparent hover:text-zinc-700 hover:border-zinc-300'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
