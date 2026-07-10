import '../src/styles/tokens.css';
import '../src/index.css';
import '../src/styles/antd-overrides.css';
import type { GlobalProvider } from '@ladle/react';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../src/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', globalState.theme === 'dark');
  }, [globalState.theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <div className="p-6 bg-bg-base min-h-screen text-fg-primary">
          {children}
        </div>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
