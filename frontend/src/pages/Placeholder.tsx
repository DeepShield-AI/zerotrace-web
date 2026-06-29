import { NavLink } from 'react-router-dom';

interface Props {
  title: string; description: string; icon: string;
  features?: string[];
  relatedLinks?: { label: string; to: string }[];
}

export default function PlaceholderPage({ title, description, icon, features, relatedLinks }: Props) {
  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Page header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600">
            <path d={icon} />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>

      {/* Main content card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Card header with status */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Overview</h3>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Coming Soon
          </span>
        </div>

        {/* Card body */}
        <div className="p-6">
          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center flex-shrink-0">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-gray-300">
                <path d={icon} />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                This feature is currently under development and will be available soon. It will provide comprehensive monitoring and observability capabilities for your infrastructure.
              </p>

              {features && features.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Planned Capabilities</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-brand-500 flex-shrink-0"><path d="M5 13l4 4L19 7"/></svg>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {relatedLinks && relatedLinks.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Related Pages</h4>
                  <div className="flex flex-wrap gap-2">
                    {relatedLinks.map((link, i) => (
                      <NavLink key={i} to={link.to}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
                        {link.label}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 ml-1"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </NavLink>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom note */}
      <p className="text-xs text-gray-300 text-center mt-6">
        Have questions? <a href="mailto:support@zerotrace.com" className="text-brand-600 hover:underline">Contact support</a>
      </p>
    </div>
  );
}
