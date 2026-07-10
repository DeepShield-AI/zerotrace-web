import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/tokens.css'
import '@fontsource/geist-sans'
import '@fontsource/geist-mono'
import './index.css'
import './i18n'

/** Reads a CSS variable from :root, falls back to light-mode default. */
function cssVar(name: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || ''
  } catch { return '' }
}

/** Ant Design theme that reads from tokens.css at mount time. */
function AntTheme({ children }: { children: React.ReactNode }) {
  const theme = useMemo(() => ({
    token: {
      colorPrimary: cssVar('--accent-primary') || '#632ca6',
      colorSuccess: cssVar('--accent-success') || '#2db88d',
      colorWarning: cssVar('--accent-warning') || '#e2903c',
      colorError: cssVar('--accent-danger') || '#e65c5c',
      colorInfo: cssVar('--accent-primary') || '#632ca6',
      borderRadius: 4,
      borderRadiusLG: 8,
      fontFamily: 'Geist Sans, system-ui, -apple-system, sans-serif',
      fontSize: 13,
      colorBgContainer: cssVar('--bg-elevated') || '#ffffff',
      colorBorder: cssVar('--border-default') || '#d1d9e0',
      colorBorderSecondary: cssVar('--border-subtle') || '#e9ecef',
      controlHeight: 36,
      paddingContentHorizontal: 16,
    },
    components: {
      Button: {
        borderRadius: 6,
        controlHeight: 40,
        paddingContentHorizontal: 20,
      },
      Input: {
        borderRadius: 6,
        controlHeight: 40,
      },
      Card: {
        borderRadiusLG: 8,
        paddingLG: 24,
      },
      Table: {
        borderRadiusLG: 8,
        headerBg: '#f9fafb',
        headerColor: '#71717a',
      },
      Tag: {
        borderRadiusSM: 6,
      },
    },
  }), [])

  return <ConfigProvider theme={theme}>{children}</ConfigProvider>
}

async function bootstrap() {
  // Conditionally start MSW mock service worker in dev mode
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
    });
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
  });

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AntTheme>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AntTheme>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

bootstrap();
