import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { PageContextProvider } from './hooks/usePageContext';
import { ThemeProvider } from './hooks/useTheme';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import DashboardLayout, { ApiKeysPage } from './pages/Dashboard';
import { AgentMgmtLayout } from './pages/agent';
import AgentSetup from './pages/agent/Setup';
import APMServiceSetup from './pages/apm/ServiceSetup';
import { OrgLayout, UsersPage, SettingsPage } from './pages/Organization';
import Infrastructure from './pages/Infrastructure';
import APMPage from './pages/apm';
import APMSettingsPage, { IngestionControlPage, RetentionFiltersPage, GenerateMetricsPage, RecommendationsPage } from './pages/apm/Settings';
import TraceDetailPage from './pages/apm/TraceDetail';
import ServiceDetailPage from './pages/apm/ServiceDetail';
import PricingPage from './pages/Pricing';
import { BillingLayout, BillingOverview, BillingPlan, BillingHistory, BillingUsagePage } from './pages/billing/PlanAndUsage';
import { BillingSeats, TrialManagement, UsageAttribution } from './pages/billing/Addons';
import Monitors from './pages/Monitors';
import MetricsPage from './pages/Metrics';
import { EventsPage, IncidentsPage, WatchdogPage, SLOsPage, ErrorTrackingPage, ProfilingPage } from './pages/product/CorePages';
import { DashboardsPage, DigitalExperiencePage, SoftwareDeliveryPage, CloudCostPage, AutomationPage, DataObservabilityPage, AIObservabilityPage, SecurityPage } from './pages/product/ProductPages';
import { LogsExplorerPage, TriggeredMonitorsPage, MonitorCreatePage, DowntimeManagementPage, APMSettingsPage as SubAPMSettings, IntegrationsPage } from './pages/product/SubPages';
import GuardianPanel from './components/GuardianPanel';

function PageLoader() {
  return (<div className="min-h-[100dvh] bg-bg-base flex items-center justify-center"><div className="space-y-6 w-full max-w-[400px] px-6"><div className="skeleton h-10 w-48 mx-auto rounded-xl"/><div className="skeleton h-5 w-64 mx-auto rounded-lg"/><div className="space-y-3 mt-8"><div className="skeleton h-12 w-full rounded-xl"/><div className="skeleton h-12 w-full rounded-xl"/><div className="skeleton h-11 w-full rounded-xl"/></div></div></div>);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <PageLoader/>; if (!user) return <Navigate to="/login" replace/>; return <>{children}</>; }
function GuestRoute({ children }: { children: React.ReactNode }) { const { user, loading } = useAuth(); if (loading) return <PageLoader/>; if (user) return <Navigate to="/infrastructure" replace/>; return <>{children}</>; }

function AppRoutes() {
  return (<Routes>
    <Route path="/login" element={<GuestRoute><Login/></GuestRoute>}/>
    <Route path="/register" element={<GuestRoute><Register/></GuestRoute>}/>
    <Route path="/pricing" element={<PricingPage/>}/>
    <Route element={<ProtectedRoute><DashboardLayout/></ProtectedRoute>}>
      <Route index element={<Navigate to="/infrastructure" replace/>}/>
      {/* Infrastructure */}
      <Route path="infrastructure" element={<Infrastructure/>}/>
      <Route path="infrastructure/map" element={<Infrastructure/>}/>
      {/* APM */}
      <Route path="apm" element={<APMPage/>}/>
      <Route path="apm/intro" element={<APMPage/>}/>
      <Route path="apm/services/:serviceName" element={<ServiceDetailPage/>}/>
      <Route path="apm/traces/:traceId" element={<TraceDetailPage/>}/>
      <Route path="apm/settings" element={<APMSettingsPage/>}/>
      <Route path="apm/settings/generate-metrics" element={<GenerateMetricsPage/>}/>
      <Route path="apm/settings/ingestion-control" element={<IngestionControlPage/>}/>
      <Route path="apm/settings/retention-filters" element={<RetentionFiltersPage/>}/>
      <Route path="apm/service-setup" element={<APMServiceSetup/>}/>
      <Route path="apm/settings/ingestion" element={<IngestionControlPage/>}/>
      <Route path="apm/settings/retention" element={<RetentionFiltersPage/>}/>
      <Route path="apm/recommendations" element={<RecommendationsPage/>}/>
      {/* Logs */}
      <Route path="logs" element={<LogsExplorerPage/>}/>
      {/* Monitors */}
      <Route path="monitors" element={<Monitors/>}/>
      <Route path="monitors/triggered" element={<TriggeredMonitorsPage/>}/>
      <Route path="monitors/create" element={<MonitorCreatePage/>}/>
      <Route path="monitors/downtimes" element={<DowntimeManagementPage/>}/>
      {/* Metrics */}
      <Route path="metrics" element={<MetricsPage/>}/>
      {/* Dashboards */}
      <Route path="dashboards" element={<DashboardsPage/>}/>
      {/* Events */}
      <Route path="events" element={<EventsPage/>}/>
      <Route path="incidents" element={<IncidentsPage/>}/>
      <Route path="slos" element={<SLOsPage/>}/>
      <Route path="errors" element={<ErrorTrackingPage/>}/>
      <Route path="profiling" element={<ProfilingPage/>}/>
      {/* Product pages */}
      <Route path="digital-experience" element={<DigitalExperiencePage/>}/>
      <Route path="software-delivery" element={<SoftwareDeliveryPage/>}/>
      <Route path="cloud-cost" element={<CloudCostPage/>}/>
      <Route path="automation" element={<AutomationPage/>}/>
      <Route path="data-observability" element={<DataObservabilityPage/>}/>
      <Route path="ai-observability" element={<AIObservabilityPage/>}/>
      <Route path="security" element={<SecurityPage/>}/>
      {/* Agents */}
      <Route path="agents" element={<AgentMgmtLayout/>}>
        <Route path="setup" element={<AgentSetup/>}/>
        <Route path="status" element={<AgentSetup/>}/>
      </Route>
      {/* Organization */}
      <Route path="org" element={<OrgLayout/>}>
        <Route index element={<Navigate to="/org/api-keys" replace/>}/>
        <Route path="api-keys" element={<ApiKeysPage/>}/>
        <Route path="users" element={<UsersPage/>}/>
        <Route path="billing" element={<BillingLayout/>}>
          <Route index element={<BillingOverview/>}/>
          <Route path="plan" element={<BillingPlan/>}/>
          <Route path="history" element={<BillingHistory/>}/>
          <Route path="usage" element={<BillingUsagePage/>}/>
          <Route path="seats" element={<BillingSeats/>}/>
          <Route path="trial" element={<TrialManagement/>}/>
          <Route path="attribution" element={<UsageAttribution/>}/>
        </Route>
        <Route path="settings" element={<SettingsPage/>}/>
      </Route>
      {/* Catch-all */}
      <Route path="*" element={<IntegrationsPage/>}/>
    </Route>
  </Routes>);
}

/** Listens for 402 Payment Required responses and redirects to Plan page */
function SubscriptionGate() {
  const navigate = useNavigate(); const location = useLocation();
  useEffect(() => {
    const handler = (e: Event) => {
      if (!location.pathname.startsWith('/org/billing')) {
        navigate('/org/billing/plan', { state: { from: location.pathname } });
      }
    };
    window.addEventListener('subscription-required', handler);
    return () => window.removeEventListener('subscription-required', handler);
  }, [navigate, location]);
  return null;
}

export default function App() {
  return (<ThemeProvider><AuthProvider><PageContextProvider><SubscriptionGate/><AppRoutes/><GuardianPanel/></PageContextProvider></AuthProvider></ThemeProvider>);
}
