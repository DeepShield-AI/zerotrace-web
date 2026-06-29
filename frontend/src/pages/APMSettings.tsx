import { Link } from 'react-router-dom';

const settingsItems = [
  { title: 'Ingestion Control', desc: 'Configure sampling rates and volume controls for APM data', to: '/apm/settings/ingestion-control' },
  { title: 'Retention Filters', desc: 'Manage trace retention policies and storage costs', to: '/apm/settings/retention-filters' },
  { title: 'Generate Metrics', desc: 'Create custom metrics from span data for alerting and dashboards', to: '/apm/settings/generate-metrics' },
  { title: 'Recommendations', desc: 'View optimization recommendations for your APM setup', to: '/apm/recommendations' },
];

export default function APMSettingsPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#1C2B34]">APM Settings</h1>
        <p className="text-sm text-[#506e81] mt-0.5">Configure ingestion, retention, and metric generation</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {settingsItems.map((item, i) => (
          <Link key={i} to={item.to}
            className="bg-white border border-[#d1d9e0] rounded-lg p-6 hover:border-[#adb5bd] hover:shadow-sm transition-all no-underline">
            <h3 className="text-sm font-semibold text-[#1C2B34] mb-1">{item.title}</h3>
            <p className="text-[13px] text-[#506e81]">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Sub-page shells for individual settings */
export function IngestionControlPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      <div className="mb-6"><h1 className="text-xl font-bold text-[#1C2B34]">Ingestion Control</h1><p className="text-sm text-[#506e81] mt-0.5">Configure APM data ingestion rates</p></div>
      <div className="bg-white border border-[#d1d9e0] rounded-lg p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#8b9bb4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
        </div>
        <h3 className="text-base font-semibold text-[#1C2B34] mb-1">Default ingestion settings applied</h3>
        <p className="text-[13px] text-[#506e81]">100% of traces are ingested. Configure sampling rules to reduce volume.</p>
      </div>
    </div>
  );
}

export function RetentionFiltersPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      <div className="mb-6"><h1 className="text-xl font-bold text-[#1C2B34]">Retention Filters</h1><p className="text-sm text-[#506e81] mt-0.5">Manage how long traces are retained</p></div>
      <div className="bg-white border border-[#d1d9e0] rounded-lg p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#8b9bb4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
        </div>
        <h3 className="text-base font-semibold text-[#1C2B34] mb-1">No retention filters configured</h3>
        <p className="text-[13px] text-[#506e81]">Create retention filters to control which traces are stored and for how long.</p>
      </div>
    </div>
  );
}

export function GenerateMetricsPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      <div className="mb-6"><h1 className="text-xl font-bold text-[#1C2B34]">Generate Metrics</h1><p className="text-sm text-[#506e81] mt-0.5">Create custom metrics from span data</p></div>
      <div className="bg-white border border-[#d1d9e0] rounded-lg p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#8b9bb4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <h3 className="text-base font-semibold text-[#1C2B34] mb-1">No metrics generated from spans</h3>
        <p className="text-[13px] text-[#506e81]">Create span-based metrics to monitor business KPIs and application performance.</p>
      </div>
    </div>
  );
}

export function RecommendationsPage() {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 1100 }}>
      <div className="mb-6"><h1 className="text-xl font-bold text-[#1C2B34]">Recommendations</h1><p className="text-sm text-[#506e81] mt-0.5">Optimization recommendations for your APM setup</p></div>
      <div className="bg-white border border-[#d1d9e0] rounded-lg p-10 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#8b9bb4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        </div>
        <h3 className="text-base font-semibold text-[#1C2B34] mb-1">No recommendations yet</h3>
        <p className="text-[13px] text-[#506e81]">Recommendations will appear as Zerotrace analyzes your service patterns.</p>
      </div>
    </div>
  );
}
