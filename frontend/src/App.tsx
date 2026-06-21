import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PageContextProvider } from './hooks/usePageContext';
import { ThemeProvider } from './hooks/useTheme';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout, { ApiKeysPage } from './pages/Dashboard';
import { AgentMgmtLayout } from './pages/AgentMgmt';
import AgentSetup from './pages/AgentSetup';
import { OrgLayout } from './pages/Organization';
import Infrastructure from './pages/Infrastructure';
import APMPage from './pages/APM';
import TraceDetailPage from './pages/TraceDetail';
import ServiceDetailPage from './pages/ServiceDetail';
import PlaceholderPage from './pages/Placeholder';
import MetricsPage from './pages/Metrics';
import GuardianPanel from './components/GuardianPanel';

function PageLoader() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 flex items-center justify-center">
      <div className="space-y-6 w-full max-w-[400px] px-6">
        <div className="skeleton h-10 w-48 mx-auto rounded-xl" />
        <div className="skeleton h-5 w-64 mx-auto rounded-lg" />
        <div className="space-y-3 mt-8">
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/infrastructure" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { t } = useTranslation();

  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route
        element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}
      >
        {/* Default: redirect to Infrastructure */}
        <Route index element={<Navigate to="/infrastructure" replace />} />

        {/* === Observe === */}
        <Route path="automation" element={
          <PlaceholderPage title={t('placeholder.automation')} description={t('placeholder.automationDesc')}
            icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        } />
        <Route path="guardian" element={
          <PlaceholderPage title={t('placeholder.bitsAI')} description={t('placeholder.bitsAIDesc')}
            icon="M9.663 17h4.673M12 3v1m6.364 2.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707" />
        } />
        <Route path="cloud-cost" element={
          <PlaceholderPage title={t('placeholder.cloudCost')} description={t('placeholder.cloudCostDesc')}
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        } />
        <Route path="digital-experience" element={
          <PlaceholderPage title={t('placeholder.digitalExperience')} description={t('placeholder.digitalExperienceDesc')}
            icon="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9" />
        } />
        <Route path="software-delivery" element={
          <PlaceholderPage title={t('placeholder.softwareDelivery')} description={t('placeholder.softwareDeliveryDesc')}
            icon="M13 10V3L4 14h7v7l9-11h-7z" />
        } />
        <Route path="security" element={
          <PlaceholderPage title={t('placeholder.security')} description={t('placeholder.securityDesc')}
            icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        } />
        <Route path="data-observability" element={
          <PlaceholderPage title={t('placeholder.dataObservability')} description={t('placeholder.dataObservabilityDesc')}
            icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7" />
        } />
        <Route path="ai-observability" element={
          <PlaceholderPage title={t('placeholder.aiObservability')} description={t('placeholder.aiObservabilityDesc')}
            icon="M9.663 17h4.673M12 3v1m6.364 2.636l-.707.707" />
        } />
        <Route path="errors" element={
          <PlaceholderPage title={t('placeholder.errors')} description={t('placeholder.errorsDesc')}
            icon="M18.364 5.636a9 9 0 010 12.728 M5.636 18.364a9 9 0 010-12.728" />
        } />
        <Route path="dashboards" element={
          <PlaceholderPage title={t('placeholder.dashboards')} description={t('placeholder.dashboardsDesc')}
            icon="M3 3h7v7H3V3z M14 3h7v7h-7V3z M14 14h7v7h-7v-7z M3 14h7v7H3v-7z" />
        } />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="integrations" element={
          <PlaceholderPage title={t('placeholder.integrations')} description={t('placeholder.integrationsDesc')}
            icon="M12 2l7 4.5v9L12 20l-7-4.5v-9L12 2z" />
        } />
        <Route path="rum" element={
          <PlaceholderPage title={t('placeholder.rum')} description={t('placeholder.rumDesc')}
            icon="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        } />
        <Route path="synthetic-tests" element={
          <PlaceholderPage title={t('placeholder.syntheticTests')} description={t('placeholder.syntheticTestsDesc')}
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        } />
        <Route path="code-security" element={
          <PlaceholderPage title={t('placeholder.codeSecurity')} description={t('placeholder.codeSecurityDesc')}
            icon="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04" />
        } />
        <Route path="sensitive-data" element={
          <PlaceholderPage title={t('placeholder.sensitiveData')} description={t('placeholder.sensitiveDataDesc')}
            icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        } />
        <Route path="infrastructure" element={<Infrastructure />} />
        <Route path="infrastructure/containers" element={
          <PlaceholderPage title={t('placeholder.containers')} description={t('placeholder.containersDesc')}
            icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        } />
        <Route path="apm" element={<APMPage />} />
        <Route path="apm/services/:serviceName" element={<ServiceDetailPage />} />
        <Route path="apm/traces/:traceId" element={<TraceDetailPage />} />
        <Route path="logs" element={
          <PlaceholderPage title={t('placeholder.logs')} description={t('placeholder.logsDesc')}
            icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        } />
        <Route path="monitors" element={
          <PlaceholderPage title={t('placeholder.monitors')} description={t('placeholder.monitorsDesc')}
            icon="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01" />
        } />
        <Route path="slos" element={
          <PlaceholderPage title={t('placeholder.slos')} description={t('placeholder.slosDesc')}
            icon="M22 12h-4l-3 9L9 3l-3 9H2" />
        } />
        <Route path="watchdog" element={
          <PlaceholderPage title={t('placeholder.watchdog')} description={t('placeholder.watchdogDesc')}
            icon="M12 2a7 7 0 017 7c0 2.38-.95 4.55-2.5 6.16M12 2a7 7 0 00-7 7c0 2.38.95 4.55 2.5 6.16M12 2v20" />
        } />
        <Route path="events" element={
          <PlaceholderPage title={t('placeholder.events')} description={t('placeholder.eventsDesc')}
            icon="M13 10V3L4 14h7v7l9-11h-7z" />
        } />
        <Route path="incidents" element={
          <PlaceholderPage title={t('placeholder.incidents')} description={t('placeholder.incidentsDesc')}
            icon="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z M12 9v2m0 4h.01" />
        } />
        <Route path="profiling" element={
          <PlaceholderPage title={t('placeholder.profiling')} description={t('placeholder.profilingDesc')}
            icon="M17.66 17.66A8 8 0 006.34 6.34M17.66 6.34a8 8 0 00-11.32 11.32M2 12h2m16 0h2M12 2v2m0 16v2" />
        } />

        {/* === Management: Agent === */}
        <Route path="agents" element={<AgentMgmtLayout />}>
          <Route index element={<Navigate to="/agents/setup" replace />} />
          <Route path="setup" element={<AgentSetup />} />
          <Route path="status" element={
            <PlaceholderPage title={t('placeholder.agentStatus')} description={t('placeholder.agentStatusDesc')}
              icon="M22 12h-4l-3 9L9 3l-3 9H2" />
          } />
        </Route>

        {/* === Management: Organization === */}
        <Route path="org" element={<OrgLayout />}>
          <Route index element={<Navigate to="/org/api-keys" replace />} />
          <Route path="api-keys" element={<ApiKeysPage />} />
          <Route path="users" element={
            <PlaceholderPage title={t('placeholder.users')} description={t('placeholder.usersDesc')}
              icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 11a4 4 0 100-8 4 4 0 000 8z" />
          } />
          <Route path="settings" element={
            <PlaceholderPage title={t('placeholder.settings')} description={t('placeholder.settingsDesc')}
              icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          } />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PageContextProvider>
          <AppRoutes />
          <GuardianPanel />
        </PageContextProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
