import { faker } from '@faker-js/faker';

// ── Helpers ─────────────────────────────────────────────

function fmtUSD(n: number): string {
  return '$' + n.toFixed(2);
}

// ── Generators ──────────────────────────────────────────

export function genBillingSummary() {
  const products = [
    { key: 'apm_host', name: 'APM Hosts', usage: faker.number.int({ min: 10, max: 100 }), included: 50, unit_price: 15, cost: 0 },
    { key: 'logs_gb', name: 'Logs (GB)', usage: faker.number.int({ min: 500, max: 5000 }), included: 1000, unit_price: 0.1, cost: 0 },
    { key: 'infra_host', name: 'Infra Hosts', usage: faker.number.int({ min: 20, max: 200 }), included: 100, unit_price: 10, cost: 0 },
    { key: 'rum_sessions', name: 'RUM Sessions', usage: faker.number.int({ min: 1000, max: 100_000 }), included: 5000, unit_price: 0.01, cost: 0 },
  ];
  return {
    org_id: 1,
    current_period: { start: new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10), end: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10) },
    products: products.map((p) => {
      const overage = Math.max(0, p.usage - p.included);
      const cost = parseFloat((overage * p.unit_price).toFixed(2));
      return { ...p, overage, cost, cost_formatted: fmtUSD(cost) };
    }),
    total: 0,
  };
}

export function genBillingPlans() {
  return {
    plans: [
      { id: 1, name: 'Free', price_per_unit: 0, commitment_types: ['monthly'], features: ['5 hosts', '5 GB logs', '1-day retention', 'Community support'] },
      { id: 2, name: 'Pro', price_per_unit: 15, commitment_types: ['monthly', 'annual'], features: ['Unlimited hosts', '100 GB logs', '15-month retention', 'ML alerts', 'SSO'] },
      { id: 3, name: 'Enterprise', price_per_unit: null, commitment_types: ['annual'], features: ['Everything in Pro', 'Unlimited storage', 'Custom retention', 'Dedicated support', 'HIPAA'] },
    ],
  };
}

export function genBillingSubscriptions() {
  return {
    subscriptions: [{
      id: 1, plan_id: 2, plan_name: 'Pro', commitment_type: 'monthly',
      committed_quantity: 10, status: 'active',
      current_period_start: new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10),
      current_period_end: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),
    }],
  };
}

export function genBillingUsage() {
  const products = [
    { product_key: 'apm_host', name: 'APM Hosts', quantity: faker.number.int({ min: 10, max: 100 }), included_quantity: 50, unit: 'hosts', cost: 0 },
    { product_key: 'logs_gb', name: 'Logs (GB)', quantity: faker.number.int({ min: 500, max: 5000 }), included_quantity: 1000, unit: 'GB', cost: 0 },
    { product_key: 'infra_host', name: 'Infra Hosts', quantity: faker.number.int({ min: 20, max: 200 }), included_quantity: 100, unit: 'hosts', cost: 0 },
  ];

  return {
    org_id: 1,
    period_start: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
    period_end: new Date(Date.now()).toISOString().slice(0, 10),
    products: products.map((p) => {
      const overage = Math.max(0, p.quantity - p.included_quantity);
      return { ...p, overage };
    }),
  };
}

export function genBillingHourlyUsage(productKey: string) {
  const now = new Date();
  const records = Array.from({ length: 168 }, (_, i) => ({
    hour: new Date(now.getTime() - (168 - i) * 3600_000).toISOString(),
    quantity: faker.number.int({ min: 1, max: 10 }),
    estimated_cost: '0.00',
  }));
  return { org_id: 1, product_key: productKey, records };
}

export function genBillingInvoices() {
  return {
    invoices: Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      invoice_number: `INV-${String(i + 1).padStart(4, '0')}`,
      period_start: new Date(Date.now() - (12 - i) * 30 * 864e5).toISOString().slice(0, 10),
      period_end: new Date(Date.now() - (11 - i) * 30 * 864e5).toISOString().slice(0, 10),
      total: String(faker.number.float({ min: 50, max: 5000, fractionDigits: 2 })),
      status: i < 10 ? 'paid' : 'pending',
      created_at: new Date(Date.now() - (11 - i) * 30 * 864e5).toISOString(),
    })),
  };
}

export function genBillingInvoiceDetail(id: number) {
  const total = faker.number.float({ min: 50, max: 5000, fractionDigits: 2 });
  return {
    invoice: {
      id, invoice_number: `INV-${String(id).padStart(4, '0')}`,
      period_start: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
      period_end: new Date(Date.now()).toISOString().slice(0, 10),
      total: String(total), status: 'paid',
      created_at: new Date(Date.now() - 5 * 864e5).toISOString(),
    },
    line_items: [
      { description: 'APM Hosts (10 x $15)', quantity: 10, unit_price: 15, amount: '150.00' },
      { description: 'Logs overage (234 GB)', quantity: 234, unit_price: 0.1, amount: '23.40' },
      { description: 'Infra Hosts (50 x $10)', quantity: 50, unit_price: 10, amount: '500.00' },
    ],
  };
}

export function genBillingEstimatedCost() {
  return {
    org_id: 1,
    estimated_total: fmtUSD(faker.number.float({ min: 100, max: 5000, fractionDigits: 2 })),
    currency: 'USD',
    breakdown: [
      { product_key: 'apm_host', estimated_cost: fmtUSD(faker.number.float({ min: 50, max: 500 })) },
      { product_key: 'logs_gb', estimated_cost: fmtUSD(faker.number.float({ min: 50, max: 500 })) },
      { product_key: 'infra_host', estimated_cost: fmtUSD(faker.number.float({ min: 50, max: 500 })) },
    ],
  };
}

export function genBillingAlerts() {
  return {
    alerts: [
      { id: 1, product_key: 'apm_host', threshold_pct: 80, enabled: true },
      { id: 2, product_key: 'logs_gb', threshold_pct: 90, enabled: true },
    ],
  };
}
