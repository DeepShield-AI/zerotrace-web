import type React from 'react';

// ── Types ────────────────────────────────────────────────

export interface ProductNavItem {
  label: string;
  subItems?: string[];
  id: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  unit: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaStyle: 'primary' | 'outline';
  note?: string;
}

export interface ProductSection {
  id: string;
  title: string;
  subtitle: string;
  plans: PricingPlan[];
  featuresTable?: { feature: string; free: string | boolean; pro: string | boolean; enterprise: string | boolean }[];
  questions?: { q: string; a: string }[];
}

// ── Navigation ───────────────────────────────────────────

export const productNavItems: ProductNavItem[] = [
  { id: 'ai', label: 'AI', subItems: ['AI Credits', 'Agent Observability'] },
  { id: 'infrastructure', label: 'Infrastructure', subItems: ['Infrastructure', 'Storage Management', 'Edge Device Monitoring', 'Kubernetes Autoscaling', 'Serverless Monitoring', 'Network Monitoring', 'Zerotrace Multi-Region', 'Cloud Cost Management'] },
  { id: 'application', label: 'Application', subItems: ['APM', 'Database Monitoring', 'Data Streams Monitoring', 'Service Catalog', 'Continuous Profiler'] },
  { id: 'logs', label: 'Logs', subItems: ['Log Management', 'Log Pipelines', 'Logging without Limits'] },
  { id: 'digital', label: 'Digital Experience', subItems: ['Real User Monitoring', 'Synthetic Monitoring', 'Session Replay', 'Mobile App Monitoring'] },
  { id: 'security', label: 'Security', subItems: ['Cloud SIEM', 'Cloud Security Management', 'Application Security', 'Sensitive Data Scanner', 'Code Security'] },
  { id: 'software', label: 'Software Delivery', subItems: ['CI Visibility', 'DORA Metrics', 'Pipeline Tracking', 'Test Optimization'] },
  { id: 'monitoring', label: 'Monitoring', subItems: ['Monitors', 'SLOs', 'Incident Management', 'Notebooks', 'Watchdog'] },
  { id: 'platform', label: 'Platform', subItems: ['Dashboards', 'Metrics', 'Events', 'Traces', 'Service Map', 'Fleet Automation'] },
];

// ── Pricing plans ────────────────────────────────────────

export const infrastructurePlans: PricingPlan[] = [
  { name: 'Free', price: '$0', unit: '/mo', description: 'For hobbyists and small projects monitoring up to 5 hosts', features: ['Up to 5 hosts', '5 GB log storage', '1-day metric retention', 'Community support', 'Email alerts'], ctaText: 'Get Started Free', ctaStyle: 'outline' },
  { name: 'Pro', price: '$15', unit: '/host/mo', description: 'Advanced monitoring, custom dashboards, and team collaboration', features: ['Unlimited hosts', '100 GB log storage', '15-month metric retention', 'ML-powered alerts & Watchdog', 'Unlimited dashboards', 'Team collaboration', 'SSO / SAML auth'], ctaText: 'Start Free Trial', ctaStyle: 'primary' },
  { name: 'Enterprise', price: '', unit: 'Custom', description: 'Dedicated support, HIPAA compliance, and volume discounting', features: ['Everything in Pro', 'Unlimited log storage', 'Custom metric retention', 'Dedicated support', 'HIPAA / FedRAMP', 'Private Locations', 'Custom SLAs', 'Volume pricing'], ctaText: 'Contact Sales', ctaStyle: 'outline', note: 'Flexible pricing for large-scale deployments' },
];

export const devsecopsPlans: PricingPlan[] = [
  { name: 'Free', price: '$0', unit: '/mo', description: 'For small teams getting started with DevSecOps', features: ['5 team members', 'Basic CI visibility', 'Community support', 'Public dashboards'], ctaText: 'Get Started Free', ctaStyle: 'outline' },
  { name: 'Pro', price: '$22', unit: '/user/mo', description: 'Advanced pipeline tracking, security scanning, and team management', features: ['Unlimited team members', 'Full CI visibility', 'DORA Metrics', 'Test optimization', 'Code security scanning', 'Software composition analysis'], ctaText: 'Start Free Trial', ctaStyle: 'primary' },
  { name: 'Enterprise', price: '', unit: 'Custom', description: 'Enterprise-grade DevSecOps with SSO, audit trails, and dedicated support', features: ['Everything in Pro', 'SSO / SAML', 'Audit trails', 'Custom policies', 'Dedicated support', 'Volume discounting'], ctaText: 'Contact Sales', ctaStyle: 'outline' },
];

export const infraFeaturesTable = [
  { feature: 'Hosts monitored', free: 'Up to 5', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Log storage', free: '5 GB', pro: '100 GB', enterprise: 'Unlimited' },
  { feature: 'Metric retention', free: '1 day', pro: '15 months', enterprise: 'Custom' },
  { feature: 'Dashboards', free: '5', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'ML-powered alerts', free: false, pro: true, enterprise: true },
  { feature: 'SSO / SAML', free: false, pro: true, enterprise: true },
  { feature: 'HIPAA / FedRAMP', free: false, pro: false, enterprise: true },
  { feature: 'Dedicated support', free: false, pro: false, enterprise: true },
  { feature: 'API access', free: 'Limited', pro: 'Full', enterprise: 'Full' },
  { feature: 'Data retention', free: '1 day', pro: '15 months', enterprise: 'Custom' },
];

// ── Icons ─────────────────────────────────────────────────

export const CheckIcon = () => (
  <svg className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
);

export const ZerotraceLogo = () => (
  <span className="text-lg font-bold tracking-tight" style={{ color: '#632CA6' }}>ZEROTRACE</span>
);

export const StarIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>);
export const HexagonIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>);
export const AppIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>);
export const DataIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>);
export const DigitalIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>);
export const DeliveryIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>);
export const SecurityIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
export const ServiceIcon = () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>);

export const categoryIcons: Record<string, React.ReactNode> = {
  infrastructure: <HexagonIcon />, application: <AppIcon />, logs: <DataIcon />,
  digital: <DigitalIcon />, software: <DeliveryIcon />, security: <SecurityIcon />,
  ai: <StarIcon />, monitoring: <AppIcon />, platform: <ServiceIcon />,
};
