import { http, HttpResponse, delay } from 'msw';
import { faker } from '@faker-js/faker';
import {
  genApmService, genApmServices, genApmTrace, genApmSpan, genSpanTree, genApmTopology, genApmServiceDetail, genApmStats,
  genDataOverview, genInfraHost, genInfraProcess,
  genLogEntry, genMetricsList, genMetricPoints, genMetricTags,
  genMonitor, genMonitorHistory,
  genBillingSummary, genBillingPlans, genBillingSubscriptions,
  genBillingUsage, genBillingHourlyUsage, genBillingInvoices,
  genBillingInvoiceDetail, genBillingEstimatedCost, genBillingAlerts,
  genGuardianStory,
  genUser, genApiKey, genApiKeyReveal, genOrganization, genAgentStatus,
} from './generators';

const BASE = '/api/v1';

/** Simulate network latency (80-300ms) */
const respond = async (data: unknown, ms = faker.number.int({ min: 80, max: 300 })) => {
  await delay(ms);
  return HttpResponse.json(data as Record<string, unknown>);
};

/** Fixed seed keeps data stable within a dev session */
faker.seed(42);

export const handlers = [
  // ═══════════════════ Auth ═══════════════════
  http.post(`${BASE}/auth/register`, async () =>
    respond({ user: genUser(), token: 'mock-jwt-token' })
  ),
  http.post(`${BASE}/auth/login`, async () =>
    respond({ user: genUser({ email: 'demo@zerotrace.io', name: 'Demo User' }), token: 'mock-jwt-token' })
  ),
  http.post(`${BASE}/auth/logout`, async () =>
    respond({ ok: true })
  ),
  http.get(`${BASE}/auth/me`, async () =>
    respond({ user: genUser({ email: 'demo@zerotrace.io', name: 'Demo User', role: 'admin' }) })
  ),

  // ═══════════════════ API Keys ═══════════════════
  http.get(`${BASE}/api-keys`, async () =>
    respond({ api_keys: Array.from({ length: 3 }, () => genApiKey()) })
  ),
  http.post(`${BASE}/api-keys`, async () =>
    respond({ api_key: genApiKeyReveal() })
  ),
  http.delete(`${BASE}/api-keys/:id`, async () =>
    respond({ ok: true })
  ),
  http.post(`${BASE}/api-keys/:id/reveal`, async () =>
    respond(genApiKeyReveal())
  ),

  // ═══════════════════ Agents ═══════════════════
  http.get(`${BASE}/agents/status`, async () =>
    respond(genAgentStatus())
  ),

  // ═══════════════════ Data Overview ═══════════════════
  http.get(`${BASE}/data/overview`, async () =>
    respond(genDataOverview())
  ),

  // ═══════════════════ Infra ═══════════════════
  http.get(`${BASE}/infra/hosts`, async () =>
    respond({ hosts: Array.from({ length: 40 }, () => genInfraHost()) })
  ),
  http.get(`${BASE}/infra/processes`, async () =>
    respond({ processes: Array.from({ length: 100 }, () => genInfraProcess()) })
  ),

  // ═══════════════════ APM ═══════════════════
  http.get(`${BASE}/apm/tags`, async () =>
    respond({
      tags: [
        { key: 'env', values: ['prod', 'staging', 'dev'] },
        { key: 'region', values: ['us-east-1', 'ap-northeast-1', 'eu-west-1'] },
        { key: 'http.status_code', values: ['200', '201', '400', '500'] },
      ],
      services: genApmServices(18),
    })
  ),

  http.get(`${BASE}/apm/services`, async () =>
    respond({ services: genApmServices(24) })
  ),

  http.get(`${BASE}/apm/services/:serviceName`, async ({ params }) =>
    respond(genApmServiceDetail(params.serviceName as string))
  ),

  http.get(`${BASE}/apm/operations`, async () =>
    respond({
      operations: Array.from({ length: 15 }, () => ({
        name: faker.helpers.arrayElement(['GET /api/orders', 'POST /api/orders', 'GET /api/users/:id', 'POST /api/auth/login']),
        request_count: faker.number.int({ min: 100, max: 10_000 }),
        error_count: faker.number.int({ min: 0, max: 100 }),
      })),
    })
  ),

  http.get(`${BASE}/apm/stats`, async () =>
    respond(genApmStats())
  ),

  http.get(`${BASE}/apm/traces`, async () => {
    const traces = Array.from({ length: 50 }, () => genApmTrace());
    const total = faker.number.int({ min: 200, max: 500 });
    const errorTotal = traces.filter((t) => t.status === 'error').length;
    return respond({ traces, total, ok_total: total - errorTotal, error_total: errorTotal, limit: 50, offset: 0 });
  }),

  http.get(`${BASE}/apm/traces/:traceId`, async ({ params }) => {
    const traceId = params.traceId as string;
    const spans = genSpanTree(traceId, 18);
    const trace = genApmTrace({ trace_id: traceId, span_count: spans.length, error_span_count: spans.filter((s) => s.span_status === 'error').length });
    return respond({ ...trace, spans });
  }),

  http.get(`${BASE}/apm/spans/:spanId`, async ({ params }) =>
    respond({ span: genApmSpan({ span_id: params.spanId as string, parent_span_id: faker.string.hexadecimal({ length: 16, prefix: '' }) }) })
  ),

  http.get(`${BASE}/apm/topology`, async () =>
    respond(genApmTopology())
  ),

  http.get(`${BASE}/apm/services/:serviceName/dependencies`, async ({ params }) =>
    respond({
      service_name: params.serviceName as string,
      downstream: Array.from({ length: 4 }, () => ({
        downstream_service: faker.helpers.arrayElement(['auth-svc', 'payment-svc', 'user-svc', 'notification-svc']),
        call_count: faker.number.int({ min: 100, max: 5000 }),
        avg_latency_ms: faker.number.float({ min: 2, max: 200, fractionDigits: 1 }),
        error_count: faker.number.int({ min: 0, max: 50 }),
      })),
      upstream: Array.from({ length: 3 }, () => ({
        upstream_service: faker.helpers.arrayElement(['api-gateway', 'webhook-svc', 'search-svc']),
        call_count: faker.number.int({ min: 100, max: 5000 }),
        avg_latency_ms: faker.number.float({ min: 2, max: 200, fractionDigits: 1 }),
        error_count: faker.number.int({ min: 0, max: 50 }),
      })),
    })
  ),

  // ═══════════════════ Metrics ═══════════════════
  http.get(`${BASE}/metrics/list`, async () =>
    respond(genMetricsList())
  ),

  http.get(`${BASE}/metrics/query`, async ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name') ?? 'system.cpu.usage';
    const agg = url.searchParams.get('agg') || undefined;
    const by = url.searchParams.get('by') || undefined;
    return respond(genMetricPoints(name, 60, agg, by));
  }),

  http.get(`${BASE}/metrics/tags`, async ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name') ?? '';
    return respond(genMetricTags(name));
  }),

  // ═══════════════════ Billing ═══════════════════
  http.get(`${BASE}/billing/summary`, async () => respond(genBillingSummary())),
  http.get(`${BASE}/billing/plans`, async () => respond(genBillingPlans())),
  http.get(`${BASE}/billing/subscriptions`, async () => respond(genBillingSubscriptions())),
  http.post(`${BASE}/billing/subscriptions`, async () => respond({ id: faker.number.int({ min: 100, max: 999 }), status: 'active' })),
  http.delete(`${BASE}/billing/subscriptions/:id`, async () => respond({ ok: true })),
  http.patch(`${BASE}/billing/subscriptions/:id`, async () => respond({ ok: true })),
  http.get(`${BASE}/billing/usage`, async () => respond(genBillingUsage())),
  http.get(`${BASE}/billing/usage/hourly`, async ({ request }) => {
    const url = new URL(request.url);
    const productKey = url.searchParams.get('product_key') ?? 'apm_host';
    return respond(genBillingHourlyUsage(productKey));
  }),
  http.get(`${BASE}/billing/estimated-cost`, async () => respond(genBillingEstimatedCost())),
  http.get(`${BASE}/billing/invoices`, async () => respond(genBillingInvoices())),
  http.get(`${BASE}/billing/invoices/:id`, async ({ params }) => respond(genBillingInvoiceDetail(Number(params.id)))),
  http.post(`${BASE}/billing/invoices/generate`, async () => respond({ invoice: genBillingInvoiceDetail(faker.number.int({ min: 100, max: 999 })) })),
  http.post(`${BASE}/billing/plans`, async () => respond({ id: faker.number.int({ min: 100, max: 999 }) })),
  http.put(`${BASE}/billing/plans/:id`, async () => respond({ ok: true })),
  http.delete(`${BASE}/billing/plans/:id`, async () => respond({ ok: true })),
  http.get(`${BASE}/billing/alerts`, async () => respond(genBillingAlerts())),
  http.post(`${BASE}/billing/alerts`, async () => respond({ id: faker.number.int({ min: 1, max: 100 }), threshold_pct: 80 })),
  http.delete(`${BASE}/billing/alerts/:id`, async () => respond({ ok: true })),

  // ═══════════════════ Organization + Users ═══════════════════
  http.get(`${BASE}/organization`, async () => respond(genOrganization())),
  http.put(`${BASE}/organization`, async () => respond(genOrganization())),
  http.get(`${BASE}/users`, async () =>
    respond({ users: Array.from({ length: 8 }, () => genUser()), stats: { total: 8, active: 7, invited: 1 }, current_user_role: 'admin' })
  ),
  http.put(`${BASE}/users/:id`, async () => respond({ ok: true })),

  // ═══════════════════ Guardian ═══════════════════
  http.post(`${BASE}/guardian/analyze`, async () =>
    respond({ stories: Array.from({ length: 5 }, () => genGuardianStory()), analyzed_services: 24, analysis_window_secs: 3600 })
  ),
  http.get(`${BASE}/guardian/stories`, async () =>
    respond({ stories: Array.from({ length: 10 }, () => genGuardianStory()) })
  ),
  http.get(`${BASE}/guardian/stories/:storyId`, async ({ params }) =>
    respond(genGuardianStory({ id: params.storyId as string }))
  ),
];
