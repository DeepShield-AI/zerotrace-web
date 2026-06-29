import type { DataOverviewResponse } from './types';

const BASE = '/api/v1';

async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers,
    },
    credentials: 'include',
  });

  const data = await res.json();

  if (!res.ok) {
    // 402 Payment Required → redirect to subscription page (skip billing/auth paths)
    if (res.status === 402 && !path.startsWith('/billing') && !path.startsWith('/auth')) {
      window.dispatchEvent(new CustomEvent('subscription-required', { detail: { path } }));
      // Throw a user-friendly error so the caller can handle it gracefully
      throw new Error('Subscription required. Please subscribe to a plan.');
    }
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  register: (body: { name: string; email: string; password: string; org_name: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  me: () =>
    request('/auth/me'),

  // API Keys
  listApiKeys: () =>
    request('/api-keys'),

  createApiKey: (body: { name: string; scopes: string[] }) =>
    request('/api-keys', { method: 'POST', body: JSON.stringify(body) }),

  revokeApiKey: (id: number) =>
    request(`/api-keys/${id}`, { method: 'DELETE' }),

  revealApiKey: (id: number) =>
    request<{ key: string }>(`/api-keys/${id}/reveal`, { method: 'POST' }),

  getAgentStatus: () =>
    request<{ agents: any[]; DATA?: any[] }>('/agents/status'),

  getDataOverview: (params?: { start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.start != null) qs.set('start', String(params.start));
    if (params?.end != null) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<DataOverviewResponse>(`/data/overview${s ? '?' + s : ''}`);
  },

  // APM
  getApmTags: (params?: { start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ tags: any[]; services: any[] }>(`/apm/tags${s ? '?' + s : ''}`);
  },

  getApmServices: (params?: { query?: string; start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ services: any[] }>(`/apm/services${s ? '?' + s : ''}`);
  },

  getApmServiceDetail: (serviceName: string, params?: { query?: string; start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ service_name: string; overview: any[]; operations: any[]; rate: any[] }>(`/apm/services/${encodeURIComponent(serviceName)}${s ? '?' + s : ''}`);
  },

  getApmOperations: (params?: { query?: string; service?: string; start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.service) qs.set('service', params.service);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ operations: any[] }>(`/apm/operations${s ? '?' + s : ''}`);
  },

  getApmStats: (params?: { query?: string; service?: string; start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.service) qs.set('service', params.service);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ overall: any[]; rate: any[]; latency_histogram: any[] }>(`/apm/stats${s ? '?' + s : ''}`);
  },

  getApmTraces: (params?: {
    query?: string;
    service?: string; operation?: string; status?: string;
    min_duration_us?: number; max_duration_us?: number;
    trace_id?: string; start?: number; end?: number;
    limit?: number; offset?: number;
    sort?: string; sort_dir?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.service) qs.set('service', params.service);
    if (params?.operation) qs.set('operation', params.operation);
    if (params?.status) qs.set('status', params.status);
    if (params?.min_duration_us) qs.set('min_duration_us', String(params.min_duration_us));
    if (params?.max_duration_us) qs.set('max_duration_us', String(params.max_duration_us));
    if (params?.trace_id) qs.set('trace_id', params.trace_id);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.sort_dir) qs.set('sort_dir', params.sort_dir);
    const s = qs.toString();
    return request<{ traces: any[]; total: number; limit: number; offset: number }>(`/apm/traces${s ? '?' + s : ''}`);
  },

  getApmTraceDetail: (traceId: string) =>
    request<{
      trace_id: string; start_time: string | null; end_time: string | null;
      duration_us: number; root_service: string | null; span_count: number;
      error_count: number; status: string; services: string[]; tag_keys: string[];
      spans: any[];
    }>(`/apm/traces/${encodeURIComponent(traceId)}`),

  getApmSpanDetail: (spanId: string) =>
    request<{ span: any }>(`/apm/spans/${encodeURIComponent(spanId)}`),

  getApmTopology: (params?: { query?: string; service?: string; start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.service) qs.set('service', params.service);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ nodes: any[]; edges: any[] }>(`/apm/topology${s ? '?' + s : ''}`);
  },

  getApmServiceDependencies: (serviceName: string, params?: { query?: string; start?: number; end?: number }) => {
    const qs = new URLSearchParams();
    if (params?.query) qs.set('query', params.query);
    if (params?.start) qs.set('start', String(params.start));
    if (params?.end) qs.set('end', String(params.end));
    const s = qs.toString();
    return request<{ service_name: string; downstream: any[]; upstream: any[] }>(
      `/apm/services/${encodeURIComponent(serviceName)}/dependencies${s ? '?' + s : ''}`
    );
  },

  // Metrics
  getMetricsList: () =>
    request<{ metrics: Array<{ name: string; display_name: string; type: string; unit: string; description: string; category: string }> }>('/metrics/list'),

  queryMetrics: (params: { name: string; start?: number; end?: number; interval?: number }) => {
    const qs = new URLSearchParams();
    qs.set('name', params.name);
    if (params.start) qs.set('start', String(params.start));
    if (params.end) qs.set('end', String(params.end));
    if (params.interval) qs.set('interval', String(params.interval));
    const s = qs.toString();
    return request<{ metric: string; display_name: string; unit: string; points: Array<{ ts: string; value: number }> }>(`/metrics/query${s ? '?' + s : ''}`);
  },

  // Billing
  getBillingSummary: () =>
    request<any>('/billing/summary'),

  getBillingPlans: () =>
    request<{ plans: any[] }>('/billing/plans'),

  getBillingSubscriptions: () =>
    request<{ subscriptions: any[] }>('/billing/subscriptions'),

  createBillingSubscription: (body: { plan_id: number; commitment_type: string; committed_quantity: number }) =>
    request('/billing/subscriptions', { method: 'POST', body: JSON.stringify(body) }),

  cancelBillingSubscription: (id: number) =>
    request(`/billing/subscriptions/${id}`, { method: 'DELETE' }),

  getBillingUsage: () =>
    request<{ org_id: number; period_start: string; period_end: string; products: any[] }>('/billing/usage'),

  getBillingHourlyUsage: (productKey: string) =>
    request<{ org_id: number; product_key: string; records: any[] }>(`/billing/usage/hourly?product_key=${encodeURIComponent(productKey)}`),

  getBillingEstimatedCost: () =>
    request<{ org_id: number; estimated_total: string; currency: string; breakdown: any[] }>('/billing/estimated-cost'),

  getBillingInvoices: () =>
    request<{ invoices: any[] }>('/billing/invoices'),

  getBillingInvoiceDetail: (id: number) =>
    request<{ invoice: any; line_items: any[] }>(`/billing/invoices/${id}`),

  generateBillingInvoice: () =>
    request('/billing/invoices/generate', { method: 'POST' }),

  // Billing — plan management (admin)
  createBillingPlan: (body: any) =>
    request('/billing/plans', { method: 'POST', body: JSON.stringify(body) }),

  updateBillingPlan: (id: number, body: any) =>
    request(`/billing/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deleteBillingPlan: (id: number) =>
    request(`/billing/plans/${id}`, { method: 'DELETE' }),

  // Billing — subscription management
  updateBillingSubscription: (id: number, committed_quantity: number) =>
    request(`/billing/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify({ committed_quantity }) }),

  // Billing — usage alerts
  getBillingAlerts: () =>
    request<{ alerts: any[] }>('/billing/alerts'),

  createBillingAlert: (body: { product_key: string; threshold_pct: number }) =>
    request('/billing/alerts', { method: 'POST', body: JSON.stringify(body) }),

  deleteBillingAlert: (id: number) =>
    request(`/billing/alerts/${id}`, { method: 'DELETE' }),

  // Organization
  getOrganization: () =>
    request<{ organization: { id: number; name: string; slug: string; created_at: string; updated_at: string }; stats: { users: number; active_subscriptions: number }; current_user_role: string }>('/organization'),

  updateOrganization: (body: { name?: string }) =>
    request('/organization', { method: 'PUT', body: JSON.stringify(body) }),

  // Users
  listUsers: () =>
    request<{ users: Array<{ id: number; email: string; name: string; role: string; status: string; created_at: string }>; stats: any; current_user_role: string }>('/users'),

  updateUser: (id: number, body: { role?: string; status?: string }) =>
    request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Guardian
  guardianAnalyze: (body?: { start?: number; end?: number }) =>
    request<{ stories: any[]; analyzed_services: number; analysis_window_secs: number }>('/guardian/analyze', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  guardianStories: () =>
    request<{ stories: any[] }>('/guardian/stories'),

  guardianStoryDetail: (id: string) =>
    request<any>(`/guardian/stories/${encodeURIComponent(id)}`),
};
