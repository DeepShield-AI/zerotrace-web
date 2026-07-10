import { useState } from 'react';
import type { ProductNavItem, PricingPlan, ProductSection } from './data';
import {
  productNavItems, infrastructurePlans, devsecopsPlans, infraFeaturesTable,
  CheckIcon, ZerotraceLogo, StarIcon, HexagonIcon, AppIcon, DataIcon,
  DigitalIcon, DeliveryIcon, SecurityIcon, ServiceIcon, categoryIcons,
} from './data';


// ─────────────────── Sub-Components ───────────────────

function TopNav() {
  return (
    <nav className="sticky top-0 z-50 bg-bg-elevated border-b border-border-subtle">
      <div className="max-w-[1344px] mx-auto px-6 h-[72px] flex items-center justify-between">
        {/* Left links */}
        <div className="flex items-center gap-8">
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            PRODUCT
          </a>
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            CUSTOMERS
          </a>
          <a href="#" className="text-sm font-bold text-accent-primary tracking-wide">
            PRICING
          </a>
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            SOLUTIONS
          </a>
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            DOCS
          </a>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-[34px] h-[34px] bg-accent-primary rounded flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-fg-inverse" fill="currentColor">
              <path d="M8 18c-1 0-2-.5-2.5-1.5-.5-1 0-2 .5-2.5L12 9l3 3-4.5 4.5c-.5.5-1.5 1.5-2.5 1.5z"/>
              <circle cx="14" cy="12" r="2"/>
              <path d="M18 8h-4l4-4 4 4z"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-accent-primary tracking-tight">ZEROTRACE</span>
        </div>

        {/* Right links */}
        <div className="flex items-center gap-8">
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            ABOUT
          </a>
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            BLOG
          </a>
          <a href="#" className="text-sm font-medium text-fg-secondary hover:text-fg-primary transition-colors tracking-wide">
            LOGIN
          </a>
          <button className="text-sm text-fg-tertiary hover:text-fg-secondary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            className="px-5 py-2 text-sm font-semibold rounded-full border-2 border-accent-primary text-fg-primary hover:bg-accent-primary/10 transition-all tracking-wide"
          >
            GET STARTED FREE
          </button>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="w-full bg-accent-primary-bg/50">
      <div className="max-w-[1344px] mx-auto px-6 py-20 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-fg-secondary mb-4">PRICING</p>
        <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold text-fg-primary leading-tight mb-4 max-w-[900px] mx-auto">
          Flexible, transparent pricing designed to scale with your business
        </h1>
        <p className="text-base text-fg-tertiary mb-10">Multi-Year/Volume discounts available</p>
        <div className="flex items-center justify-center gap-4">
          <button className="px-8 py-3 bg-accent-primary text-fg-inverse font-semibold rounded-lg hover:opacity-90 transition-colors text-sm tracking-wide">
            FREE TRIAL
          </button>
          <a href="#" className="text-accent-primary font-semibold text-sm hover:underline">
            CONTACT US →
          </a>
        </div>
      </div>
    </header>
  );
}

function SidebarNav({ activeProduct, onSelect }: { activeProduct: string; onSelect: (id: string, item?: string) => void }) {
  const [expandedCategory, setExpandedCategory] = useState<string>('infrastructure');

  return (
    <aside className="w-[300px] flex-shrink-0 pr-8 pt-8 pb-16 border-r border-border-subtle sticky top-[72px] h-[calc(100vh-72px)] overflow-y-auto">
      {/* Site selector */}
      <div className="mb-6">
        <label className="block text-[11px] font-semibold text-fg-tertiary tracking-wider mb-2">ZEROTRACE SITE</label>
        <select className="w-full px-3 py-2 text-sm border border-border rounded-md text-fg-secondary bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-accent-primary-bg focus:border-accent-primary">
          <option>US (US1, US3, US5)</option>
          <option>US1-FED</option>
          <option>EU1</option>
          <option>AP1</option>
          <option>AP2</option>
        </select>
        <div className="mt-4 border-t border-border-subtle" />
      </div>

      {/* Product navigation */}
      <nav className="space-y-5">
        {productNavItems.map((cat) => (
          <div key={cat.id}>
            <button
              onClick={() => {
                setExpandedCategory(expandedCategory === cat.id ? '' : cat.id);
                onSelect(cat.id, cat.subItems?.[0]);
              }}
              className="flex items-center gap-2.5 text-sm font-semibold text-fg-primary hover:text-accent-primary transition-colors w-full text-left"
            >
              <span className="text-fg-secondary">{categoryIcons[cat.id]}</span>
              {cat.label}
            </button>
            <div className="ml-7 mt-1.5 space-y-0.5">
              {cat.subItems?.map((item) => (
                <button
                  key={item}
                  onClick={() => onSelect(cat.id, item)}
                  className={`block text-sm py-1 text-left w-full transition-colors ${
                    activeProduct === cat.id
                      ? 'font-medium text-accent-primary'
                      : 'text-fg-secondary hover:text-fg-primary'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function PricingCard({ plan, featured }: { plan: PricingPlan; featured?: boolean }) {
  return (
    <div
      className={`flex-1 rounded-xl p-8 flex flex-col ${
        featured
          ? 'border-2 border-accent-primary shadow-lg relative bg-bg-elevated'
          : 'border border-border bg-bg-elevated hover:shadow-md transition-shadow'
      }`}
    >
      <h3 className="text-lg font-bold text-fg-primary mb-1">{plan.name}</h3>
      <div className="mb-3">
        <span className="text-3xl font-bold text-fg-primary">{plan.price}</span>
        {plan.unit && <span className="text-sm text-fg-tertiary ml-1">{plan.unit}</span>}
      </div>
      <p className="text-sm text-fg-secondary mb-6 leading-relaxed">{plan.description}</p>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feat, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-fg-secondary">
            <CheckIcon />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      {plan.note && <p className="text-xs text-fg-tertiary mb-4 -mt-4">{plan.note}</p>}

      <button
        className={`w-full py-3 rounded-lg font-semibold text-sm tracking-wide transition-all ${
          plan.ctaStyle === 'primary'
            ? 'bg-accent-primary text-fg-inverse hover:opacity-90'
            : 'border-2 border-accent-primary text-accent-primary hover:bg-accent-primary/10'
        }`}
      >
        {plan.ctaText}
      </button>
    </div>
  );
}

function PricingSection({ product }: { product: ProductSection }) {
  const [activeView, setActiveView] = useState<'pricing' | 'features' | 'support' | 'faq'>('pricing');

  const tabs = [
    { key: 'pricing' as const, label: 'Pricing' },
    { key: 'features' as const, label: 'Features' },
    { key: 'support' as const, label: 'Support Plans & Post Sales Services' },
    { key: 'faq' as const, label: 'Common Questions' },
  ];

  return (
    <section id={product.id} className="py-10">
      {/* Product header */}
      <h2 className="text-2xl font-bold text-fg-primary text-center mb-2">{product.title}</h2>
      <p className="text-base text-fg-tertiary text-center mb-10 max-w-[600px] mx-auto leading-relaxed">
        {product.subtitle}
      </p>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-0 border-b border-border mb-10">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
              activeView === tab.key
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-fg-tertiary hover:text-fg-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pricing Cards */}
      {activeView === 'pricing' && (
        <div>
          {/* Main 3-column cards */}
          <div className="flex gap-5 mb-6">
            {product.plans.slice(0, 3).map((plan, i) => (
              <PricingCard key={plan.name} plan={plan} featured={i === 1} />
            ))}
          </div>
          {/* DevSecOps row */}
          {product.plans.length > 3 && (
            <div className="flex gap-5 justify-center">
              {product.plans.slice(3).map((plan) => (
                <div key={plan.name} className="flex-1 max-w-[calc(50%-10px)]">
                  <PricingCard plan={plan} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Features Table */}
      {activeView === 'features' && product.featuresTable && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-fg-secondary w-[40%]">Feature</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-fg-secondary">Free</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-fg-secondary">Pro</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-fg-secondary">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {product.featuresTable.map((row, i) => (
                <tr key={i} className={`border-b border-border-subtle ${i % 2 === 0 ? 'bg-bg-subtle/50' : 'bg-bg-elevated'}`}>
                  <td className="py-3 px-4 text-sm text-fg-secondary">{row.feature}</td>
                  <td className="py-3 px-4 text-sm text-center text-fg-secondary">
                    {row.free === true ? <span className="text-accent-success">✓</span> : row.free === false ? <span className="text-fg-disabled">—</span> : row.free}
                  </td>
                  <td className="py-3 px-4 text-sm text-center text-fg-secondary">
                    {row.pro === true ? <span className="text-accent-success">✓</span> : row.pro === false ? <span className="text-fg-disabled">—</span> : row.pro}
                  </td>
                  <td className="py-3 px-4 text-sm text-center text-fg-secondary">
                    {row.enterprise === true ? <span className="text-accent-success">✓</span> : row.enterprise === false ? <span className="text-fg-disabled">—</span> : row.enterprise}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Support Plans */}
      {activeView === 'support' && (
        <div className="max-w-[600px] mx-auto text-center py-8">
          <p className="text-fg-secondary mb-6 leading-relaxed">
            From basic plans to bespoke offerings, Zerotrace offers the right level of support &amp; services for any organization.
          </p>
          <div className="flex gap-4 justify-center">
            <button className="px-6 py-3 border-2 border-accent-primary text-accent-primary font-semibold rounded-lg text-sm hover:bg-accent-primary/10 transition-colors">
              SUPPORT PLANS
            </button>
            <button className="px-6 py-3 border-2 border-accent-primary text-accent-primary font-semibold rounded-lg text-sm hover:bg-accent-primary/10 transition-colors">
              SERVICES &amp; ENABLEMENT
            </button>
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeView === 'faq' && product.questions && (
        <div className="max-w-[700px] mx-auto space-y-4 py-4">
          {product.questions.map((item, i) => (
            <details key={i} className="group border border-border rounded-lg overflow-hidden">
              <summary className="px-6 py-4 text-sm font-medium text-fg-primary cursor-pointer hover:bg-bg-subtle list-none flex items-center justify-between">
                {item.q}
                <svg className="w-4 h-4 text-fg-tertiary group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm text-fg-secondary leading-relaxed">{item.a}</div>
            </details>
          ))}
        </div>
      )}
      {activeView === 'faq' && !product.questions && (
        <div className="text-center py-12 text-fg-tertiary text-sm">Frequently asked questions about {product.title} pricing and features.</div>
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-bg-inverse text-white/70 mt-16">
      <div className="max-w-[1344px] mx-auto px-6 py-16">
        <div className="grid grid-cols-5 gap-10 mb-12">
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Product</h4>
            <div className="space-y-2.5">
              {['Infrastructure', 'APM', 'Log Management', 'Security', 'RUM', 'Synthetics', 'Network Monitoring', 'Database Monitoring'].map((item) => (
                <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Solutions</h4>
            <div className="space-y-2.5">
              {['DevOps', 'Security', 'IT Operations', 'Developer', 'SRE', 'Cloud Migration', 'Compliance'].map((item) => (
                <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Resources</h4>
            <div className="space-y-2.5">
              {['Documentation', 'Blog', 'Customers', 'Partners', 'Events', 'Webinars', 'Case Studies'].map((item) => (
                <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Company</h4>
            <div className="space-y-2.5">
              {['About', 'Careers', 'Contact', 'Press', 'Investors', 'Trust & Security'].map((item) => (
                <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 tracking-wide uppercase">Pricing</h4>
            <div className="space-y-2.5">
              {['Pricing', 'Free Trial', 'Volume Discounts', 'Multi-Year Plans'].map((item) => (
                <a key={item} href="#" className="block text-sm text-white/50 hover:text-white transition-colors">{item}</a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-[30px] h-[30px] bg-accent-primary rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">DD</span>
            </div>
            <span className="text-sm text-white/40">© 2026 Zerotrace. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#" className="hover:text-white/70 transition-colors">Terms</a>
            <a href="#" className="hover:text-white/70 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/70 transition-colors">Cookies</a>
            <a href="#" className="hover:text-white/70 transition-colors">Status</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────── Main Component ───────────────────

// FAQ data
const infraQuestions = [
  { q: 'What counts as a host?', a: 'A host is any physical or virtual machine, including cloud instances. Each host running the Zerotrace Agent counts toward your host count.' },
  { q: 'How does high-water mark billing work?', a: 'Zerotrace counts hosts hourly, drops the top 1% of hours, and bills the entire month at the peak of the remaining 99%. This ensures you only pay for sustained usage.' },
  { q: 'Can I switch between plans?', a: 'Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately, and downgrades apply at the next billing cycle.' },
  { q: 'Is there a free trial?', a: 'Yes, Zerotrace offers a 14-day free trial with full access to Pro features. No credit card required.' },
];

// Product sections data
const productSections: ProductSection[] = [
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    subtitle: 'See inside any stack, any app, at any scale, anywhere',
    plans: [...infrastructurePlans, ...devsecopsPlans],
    featuresTable: infraFeaturesTable,
    questions: infraQuestions,
  },
  {
    id: 'apm',
    title: 'Application Performance Monitoring',
    subtitle: 'Trace requests from end to end across distributed systems',
    plans: [
      {
        name: 'APM',
        price: '$31',
        unit: 'Per host, per month*',
        description: 'Distributed tracing and service health monitoring',
        features: ['150 GB ingested spans/month', '1M indexed spans/month', 'Service maps', 'Trace search & analytics'],
        ctaText: 'START FREE TRIAL',
        ctaStyle: 'primary',
        note: '*Billed annually or $36 on-demand',
      },
      {
        name: 'APM Pro',
        price: '$35',
        unit: 'Per host, per month*',
        description: 'Advanced tracing with data streams monitoring',
        features: ['Everything in APM', 'Data Streams Monitoring', 'Pipeline visibility', 'End-to-end latency tracking'],
        ctaText: 'START FREE TRIAL',
        ctaStyle: 'primary',
        note: '*Billed annually or $42 on-demand',
      },
      {
        name: 'APM Enterprise',
        price: '$40',
        unit: 'Per host, per month*',
        description: 'Full-stack profiling and advanced diagnostics',
        features: ['Everything in APM Pro', 'Continuous Profiler', 'Code-level visibility', '4 profiled containers included'],
        ctaText: 'START FREE TRIAL',
        ctaStyle: 'primary',
        note: '*Billed annually or $48 on-demand',
      },
    ],
  },
  {
    id: 'logs',
    title: 'Log Management',
    subtitle: 'Analyze and explore log data in context with flexible retention',
    plans: [
      {
        name: 'Ingestion',
        price: '$0.10',
        unit: 'Per GB ingested',
        description: 'Collect logs from any source',
        features: ['Unlimited sources', 'Automatic parsing', 'Live tail', 'Archiving'],
        ctaText: 'START FREE TRIAL',
        ctaStyle: 'primary',
      },
      {
        name: 'Standard Indexing',
        price: '$1.70',
        unit: 'Per million events',
        description: 'Full-text search with 15-day retention',
        features: ['15-day retention', 'Full-text search', 'Faceted search', 'Log analytics'],
        ctaText: 'START FREE TRIAL',
        ctaStyle: 'primary',
      },
      {
        name: 'Flex Logs',
        price: '$0.05',
        unit: 'Per million events',
        description: 'Cost-effective cold storage for long-term retention',
        features: ['Long-term storage', 'On-demand rehydration', 'Pattern analysis', 'Compliance archiving'],
        ctaText: 'START FREE TRIAL',
        ctaStyle: 'primary',
        note: '*Flex Logs Starter: $0.60/million events',
      },
    ],
  },
];

export default function PricingPage() {
  const [activeProduct, setActiveProduct] = useState('infrastructure');

  const handleProductSelect = (categoryId: string, _item?: string) => {
    setActiveProduct(categoryId);
  };

  const currentProduct = productSections.find((p) => p.id === activeProduct) || productSections[0];

  return (
    <div className="min-h-screen bg-bg-base">
      <TopNav />
      <Hero />

      {/* Main content area */}
      <main className="max-w-[1344px] mx-auto px-6">
        <div className="flex">
          <SidebarNav activeProduct={activeProduct} onSelect={handleProductSelect} />
          <div className="flex-1 min-w-0 pl-10 pt-8 pb-16">
            <PricingSection key={currentProduct.id} product={currentProduct} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
