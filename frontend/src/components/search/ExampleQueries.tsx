import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ── Query builder types ─────────────────────────────────

interface ExampleQuery {
  title: string;
  description: string;
  /** Build query string dynamically from real data values */
  build: (ctx: QueryContext) => string;
  category: 'performance' | 'errors' | 'dependencies' | 'getting-started';
}

interface QueryContext {
  /** First available service name, or fallback */
  serviceA: string;
  serviceB: string;
  env: string;
  operation: string;
}

const SYNTAX_TIPS = [
  { prefix: 'service:', desc: 'Filter by service name', example: 'service:api-gateway', color: '#8c4fff' },
  { prefix: 'operation:', desc: 'Filter by operation/endpoint', example: 'operation:GET /api/users/:id', color: '#128fea' },
  { prefix: 'status:', desc: 'Filter by status (ok/error)', example: 'status:error', color: '#f27c00' },
  { prefix: 'duration:', desc: 'Filter by duration range', example: 'duration:>500ms', color: '#1cb96d' },
  { prefix: 'env:', desc: 'Filter by environment', example: 'env:prod', color: '#ed1978' },
  { prefix: '-service:', desc: 'Exclude a service from results', example: '-service:redis', color: '#6B7280' },
];

// ── Example queries (build functions use real data values) ─

/* Titles and descriptions use i18n keys; build() returns the language-independent query string */
const EXAMPLE_DEFS: { key: string; build: (ctx: QueryContext) => string; category: ExampleQuery['category'] }[] = [
  { key: 'findSlow', build: () => 'duration:>1s', category: 'performance' },
  { key: 'findAllErrors', build: () => 'status:error', category: 'errors' },
  { key: 'zoomService', build: (ctx) => `service:${ctx.serviceA}`, category: 'getting-started' },
  { key: 'twoServices', build: (ctx) => `service:${ctx.serviceA} service:${ctx.serviceB}`, category: 'dependencies' },
  { key: 'excludeNoisy', build: (ctx) => `-service:${ctx.serviceA} -service:${ctx.serviceB}`, category: 'dependencies' },
  { key: 'nplusone', build: (ctx) => `service:${ctx.serviceA} operation:${ctx.operation}`, category: 'performance' },
  { key: 'prodOnly', build: (ctx) => `env:${ctx.env}`, category: 'getting-started' },
  { key: 'errorsInService', build: (ctx) => `status:error service:${ctx.serviceA}`, category: 'errors' },
  { key: 'slowEndpoint', build: (ctx) => `operation:${ctx.operation} duration:>500ms`, category: 'performance' },
  { key: 'allProd', build: (ctx) => `env:${ctx.env}`, category: 'getting-started' },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  'getting-started': { label: 'Getting Started', icon: '🚀' },
  'performance': { label: 'Performance', icon: '⚡' },
  'errors': { label: 'Errors', icon: '🔴' },
  'dependencies': { label: 'Dependencies', icon: '🔗' },
};

// ── Component ────────────────────────────────────────────

export default function ExampleQueries({
  onSelect,
  services = [],
  operations = [],
  envs = [],
}: {
  onSelect: (query: string) => void;
  services?: string[];
  operations?: string[];
  envs?: string[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'examples' | 'syntax'>('examples');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Build query context from real data (with fallbacks)
  const ctx: QueryContext = useMemo(() => ({
    serviceA: services[0] || 'api-gateway',
    serviceB: services[1] || 'auth-svc',
    env: envs[0] || 'prod',
    operation: operations[0] || 'GET /api/users/:id',
  }), [services, operations, envs]);

  // Resolve all queries with real data + i18n
  const resolved = useMemo(() =>
    EXAMPLE_DEFS.map(def => ({
      query: def.build(ctx),
      title: t(`apm.ex${def.key.charAt(0).toUpperCase() + def.key.slice(1)}`, ''),
      description: t(`apm.ex${def.key.charAt(0).toUpperCase() + def.key.slice(1)}Desc`, ''),
      category: def.category,
    })),
  [ctx, t]);

  // Group by category
  const grouped = useMemo(() => {
    const g: Record<string, { query: string; title: string; description: string }[]> = {};
    resolved.forEach(ex => { (g[ex.category] ??= []).push(ex); });
    return g;
  }, [resolved]);

  // Dynamic syntax tip examples
  const syntaxTips = useMemo(() =>
    SYNTAX_TIPS.map(tip => ({
      ...tip,
      example: tip.prefix === 'service:' ? `service:${ctx.serviceA}`
        : tip.prefix === 'operation:' ? `operation:${ctx.operation}`
        : tip.prefix === 'env:' ? `env:${ctx.env}`
        : tip.prefix === '-service:' ? `-service:${ctx.serviceB}`
        : tip.example,
    })),
  [ctx]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="text-[12px] text-fg-tertiary hover:text-accent-primary transition-colors font-medium"
      >
        {t('apm.seeExampleQueries')}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-elevated border border-border rounded-xl shadow-2xl z-50 overflow-hidden" style={{ width: 640 }}>
          {/* Tabs */}
          <div className="flex border-b border-border-subtle">
            <button onClick={() => setTab('examples')}
              className={`flex-1 text-center py-2.5 text-[12px] font-medium transition-colors ${
                tab === 'examples' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}>{t('apm.exampleQueries')}</button>
            <button onClick={() => setTab('syntax')}
              className={`flex-1 text-center py-2.5 text-[12px] font-medium transition-colors ${
                tab === 'syntax' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}>{t('apm.syntaxHelp')}</button>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
            {tab === 'examples' && (
              <div className="p-4 space-y-4">
                {Object.entries(grouped).map(([cat, examples]) => {
                  const info = CATEGORY_LABELS[cat] || { label: cat, icon: '' };
                  return (
                    <div key={cat}>
                      <h4 className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        {info.icon} {info.label}
                      </h4>
                      <div className="space-y-1.5">
                        {examples.map((ex, i) => (
                          <button key={i}
                            onClick={() => { onSelect(ex.query); setOpen(false); }}
                            className="w-full text-left p-3 rounded-lg border border-border-subtle hover:border-accent-primary/30 hover:bg-accent-primary/3 transition-all group"
                          >
                            <p className="text-[12px] font-medium text-fg-primary group-hover:text-accent-primary transition-colors">
                              {ex.title}
                            </p>
                            <p className="text-[11px] text-fg-tertiary mt-0.5 leading-relaxed">{ex.description}</p>
                            <code className="inline-block mt-2 text-[11px] font-mono bg-bg-subtle text-fg-secondary px-2 py-0.5 rounded border border-border-subtle group-hover:border-accent-primary/20 group-hover:text-accent-primary transition-colors">
                              {ex.query}
                            </code>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'syntax' && (
              <div className="p-4 space-y-3">
                <p className="text-[11px] text-fg-tertiary leading-relaxed">
                  Combine filters to narrow traces. Press <kbd className="text-[10px] bg-bg-subtle border border-border-subtle rounded px-1 py-0.5 font-mono">Space</kbd> for natural language search.
                </p>
                {syntaxTips.map((tip, i) => (
                  <button key={i}
                    onClick={() => { onSelect(tip.example); setOpen(false); }}
                    className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-subtle transition-colors group"
                  >
                    <svg className="w-4 h-4 text-fg-tertiary shrink-0 group-hover:text-accent-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="7" cy="7" r="5.5"/><path d="M11 11l3.5 3.5"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-[12px] font-mono font-medium" style={{ color: tip.color }}>{tip.prefix}</code>
                        <span className="text-[11px] text-fg-tertiary">{tip.desc}</span>
                      </div>
                    </div>
                    <code className="text-[10px] font-mono text-fg-tertiary/60 bg-bg-muted px-1.5 py-0.5 rounded shrink-0 group-hover:text-fg-secondary">
                      {tip.example}
                    </code>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border-subtle px-4 py-2.5 flex items-center justify-between text-[11px]">
            <span className="text-fg-tertiary">{resolved.length} examples · {syntaxTips.length} syntax tips</span>
            <button onClick={() => setOpen(false)} className="text-fg-tertiary hover:text-fg-secondary font-medium">{t('apm.closeMenu')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
