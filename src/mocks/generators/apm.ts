import { faker } from '@faker-js/faker';

// ── 1. White-listed domain vocabulary ─────────────────────

const SERVICES = [
  'api-gateway', 'auth-svc', 'user-svc', 'billing-svc', 'notification-svc',
  'search-svc', 'payment-svc', 'inventory-svc', 'order-svc', 'catalog-svc',
  'shipping-svc', 'recommendation-svc', 'analytics-svc', 'reporting-svc',
  'webhook-svc', 'scheduler-svc', 'ml-inference', 'data-pipeline',
] as const;

const ENVS = ['prod', 'staging', 'dev'] as const;
const REGIONS = ['us-east-1', 'ap-northeast-1', 'eu-west-1'] as const;

const OPERATIONS = [
  'GET /api/orders', 'POST /api/orders', 'GET /api/users/:id',
  'POST /api/auth/login', 'GET /api/products', 'GET /api/search',
  'POST /api/checkout', 'GET /api/catalog', 'PUT /api/users/:id',
  'DELETE /api/sessions', 'GET /api/recommendations', 'POST /api/payments',
] as const;

// ── 2. Time-series helper (random walk + sine wave) ──────

function genTimeSeries(n = 60, initial = 50, drift = 3) {
  let v = initial;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, Math.min(100, v + faker.number.float({ min: -drift, max: drift })));
    const wave = Math.sin(i * (Math.PI * 2 / 24)) * 10;
    return {
      ts: new Date(Date.now() - (n - i) * 60_000).toISOString(),
      value: parseFloat(Math.max(0, v + wave).toFixed(2)),
    };
  });
}

// ── 3. Single-entity generators ──────────────────────────

export interface ApmService {
  service_name: string;
  env: string;
  region: string;
  request_count: number;
  error_count: number;
  error_rate_pct: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  trace_count: number;
  sparkline: number[];
}

export function genApmService(overrides: Partial<ApmService> = {}): ApmService {
  const requestCount = faker.number.int({ min: 500, max: 50_000 });
  const errorRatePct = faker.number.float({ min: 0, max: 8, fractionDigits: 2 });
  return {
    service_name: faker.helpers.arrayElement(SERVICES),
    env: faker.helpers.arrayElement(ENVS),
    region: faker.helpers.arrayElement(REGIONS),
    request_count: requestCount,
    error_count: Math.floor(requestCount * (errorRatePct / 100)),
    error_rate_pct: errorRatePct,
    p50_ms: faker.number.float({ min: 5, max: 100, fractionDigits: 1 }),
    p95_ms: faker.number.float({ min: 20, max: 800, fractionDigits: 1 }),
    p99_ms: faker.number.float({ min: 50, max: 2000, fractionDigits: 1 }),
    trace_count: faker.number.int({ min: 100, max: 20_000 }),
    sparkline: genTimeSeries(60, requestCount / 500).map((p) => Math.round(p.value)),
    ...overrides,
  };
}

export interface ApmTrace {
  trace_id: string;
  root_service: string;
  root_operation: string;
  span_count: number;
  error_span_count: number;
  status: 'ok' | 'error';
  services: string[];
  tag_keys: string[];
  start_time: string;
  end_time: string;
  duration_us: number;
}

export function genApmTrace(overrides: Partial<ApmTrace> = {}): ApmTrace {
  const services = faker.helpers.arrayElements(SERVICES as unknown as string[], { min: 2, max: 5 }) as string[];
  const spanCount = faker.number.int({ min: 5, max: 40 });
  const status = faker.helpers.weightedArrayElement([
    { value: 'ok' as const, weight: 80 },
    { value: 'error' as const, weight: 20 },
  ]);
  return {
    trace_id: faker.string.hexadecimal({ length: 32, prefix: '' }),
    root_service: services[0],
    root_operation: faker.helpers.arrayElement(OPERATIONS),
    span_count: spanCount,
    error_span_count: status === 'error' ? faker.number.int({ min: 1, max: spanCount }) : 0,
    status,
    services,
    tag_keys: ['http.method', 'http.status_code', 'db.type', 'env', 'region'],
    start_time: faker.date.recent({ days: 1 }).toISOString(),
    end_time: faker.date.recent({ days: 1 }).toISOString(),
    duration_us: faker.number.int({ min: 1000, max: 5_000_000 }),
    ...overrides,
  };
}

export interface ApmSpan {
  span_id: string;
  trace_id: string;
  parent_span_id: string;
  span_kind: string;
  operation_name: string;
  service_name: string;
  request_type: string;
  start_time: string;
  duration_us: number;
  status_code: number;
  span_status: string;
  flow_id: string;
  error_message: string | null;
  tags: Record<string, string>;
}

export function genApmSpan(overrides: Partial<ApmSpan> = {}): ApmSpan {
  const isError = faker.helpers.weightedArrayElement([
    { value: false, weight: 85 }, { value: true, weight: 15 },
  ]);
  return {
    span_id: faker.string.hexadecimal({ length: 16, prefix: '' }),
    trace_id: '',  // set by caller
    parent_span_id: '',  // set by caller
    span_kind: faker.helpers.arrayElement(['server', 'client', 'internal', 'producer', 'consumer']),
    operation_name: faker.helpers.arrayElement(OPERATIONS),
    service_name: faker.helpers.arrayElement(SERVICES),
    request_type: faker.helpers.arrayElement(['HTTP', 'gRPC', 'DB', 'CACHE', 'MQ']),
    start_time: faker.date.recent({ days: 1 }).toISOString(),
    duration_us: faker.number.int({ min: 10, max: 1_000_000 }),
    status_code: isError ? 2 : 0,
    span_status: isError ? 'error' : 'ok',
    flow_id: faker.string.hexadecimal({ length: 16, prefix: '' }),
    error_message: isError ? faker.lorem.sentence() : null,
    tags: {
      'http.method': faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
      'http.status_code': String(faker.helpers.weightedArrayElement([
        { value: 200, weight: 70 }, { value: 201, weight: 10 },
        { value: 400, weight: 8 }, { value: 500, weight: 7 }, { value: 302, weight: 5 },
      ])),
      'db.type': faker.helpers.arrayElement(['mysql', 'postgresql', 'redis', 'mongodb']),
    },
    ...overrides,
  };
}

// ── 4. Derived / collection generators ───────────────────

/** Generate N services with guaranteed unique names. */
export function genApmServices(n = 24): ApmService[] {
  // Shuffle all services and cycle if we need more than available
  const shuffled = faker.helpers.shuffle([...SERVICES]);
  return Array.from({ length: n }, (_, i) =>
    genApmService({ service_name: shuffled[i % shuffled.length] + (i >= shuffled.length ? `-${Math.floor(i / shuffled.length)}` : '') })
  );
}

export function genApmTopology(nodeCount = 8, edgeCount = 20) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `svc-${i}`,
    name: SERVICES[i % SERVICES.length],
    request_count: faker.number.int({ min: 100, max: 10_000 }),
    error_rate_pct: faker.number.float({ min: 0, max: 5, fractionDigits: 2 }),
  }));
  const edges = Array.from({ length: edgeCount }, () => ({
    source: `svc-${faker.number.int({ min: 0, max: nodeCount - 1 })}`,
    target: `svc-${faker.number.int({ min: 0, max: nodeCount - 1 })}`,
    request_count: faker.number.int({ min: 10, max: 5000 }),
    avg_latency_ms: faker.number.float({ min: 2, max: 200, fractionDigits: 1 }),
  })).filter((e) => e.source !== e.target);
  return { nodes, edges };
}

export function genApmServiceDetail(serviceName: string) {
  const totalRequests = faker.number.int({ min: 10_000, max: 500_000 });
  const avgLatency = faker.number.float({ min: 20, max: 200, fractionDigits: 1 });
  const p95 = avgLatency * faker.number.float({ min: 1.5, max: 4, fractionDigits: 1 });
  const p99 = p95 * faker.number.float({ min: 1.3, max: 2.5, fractionDigits: 1 });
  const errorRate = faker.number.float({ min: 0.1, max: 8, fractionDigits: 2 });

  // KPI summary (component reads overview[0])
  const summary = {
    total_requests: totalRequests,
    avg_latency_ms: avgLatency,
    p95_ms: p95,
    p99_ms: p99,
    error_rate_pct: errorRate,
    error_count: Math.round(totalRequests * (errorRate / 100)),
  };

  // Full overview array (60 data points with all fields for tooltip/detail)
  const overview = genTimeSeries(60, totalRequests / 60, totalRequests / 600).map((p) => ({
    ts: p.ts,
    request_count: Math.round(p.value),
    avg_latency_ms: faker.number.float({ min: avgLatency * 0.8, max: avgLatency * 1.2, fractionDigits: 1 }),
    p95_ms: faker.number.float({ min: p95 * 0.8, max: p95 * 1.2, fractionDigits: 1 }),
    error_count: Math.round(p.value * (errorRate / 100)),
  }));

  // Timeseries for charts (component reads rate[].cnt, rate[].avg_latency_ms, rate[].error_cnt)
  const rate = overview.map((p) => ({
    ts: p.ts,
    cnt: Math.round(p.request_count / 60),
    avg_latency_ms: p.avg_latency_ms,
    error_cnt: p.error_count,
  }));

  // Operations list
  const operations = Array.from({ length: faker.number.int({ min: 8, max: 16 }) }, () => {
    const reqs = faker.number.int({ min: 100, max: Math.round(totalRequests / 5) });
    const opAvg = faker.number.float({ min: 5, max: avgLatency * 2, fractionDigits: 1 });
    return {
      name: faker.helpers.arrayElement(OPERATIONS),
      avg_latency_ms: opAvg,
      p50_ms: opAvg * 0.7,
      p95_ms: opAvg * faker.number.float({ min: 1.5, max: 5, fractionDigits: 1 }),
      p99_ms: opAvg * faker.number.float({ min: 3, max: 8, fractionDigits: 1 }),
      request_count: reqs,
      error_count: Math.round(reqs * faker.number.float({ min: 0, max: 0.05 })),
    };
  });

  return {
    service_name: serviceName,
    overview: [summary, ...overview],
    operations,
    rate,
  };
}

/**
 * Generate a proper span tree for a trace.
 * Builds a realistic call tree: root span → child spans → grandchild spans.
 * Every parent_span_id references an actual span_id — no orphans.
 */
export function genSpanTree(traceId: string, maxSpans = 20) {
  const spans: ApmSpan[] = [];

  // Root span
  const root = genApmSpan({ trace_id: traceId, parent_span_id: '', span_kind: 'server' });
  spans.push(root);

  // Build children under each span
  const addChildren = (parentId: string, depth: number) => {
    if (spans.length >= maxSpans || depth > 3) return;
    const childCount = faker.helpers.weightedArrayElement([
      { value: 0, weight: 30 },
      { value: 1, weight: 30 },
      { value: 2, weight: 25 },
      { value: 3, weight: 15 },
    ]);
    for (let i = 0; i < childCount && spans.length < maxSpans; i++) {
      const child = genApmSpan({
        trace_id: traceId,
        parent_span_id: parentId,
        span_kind: 'client',
        duration_us: faker.number.int({ min: 10, max: Math.max(11, num(root.duration_us) / 2) }),
      });
      spans.push(child);
      addChildren(child.span_id, depth + 1);
    }
  };

  addChildren(root.span_id, 1);
  return spans;
}

function num(v: number | string): number {
  return typeof v === 'string' ? parseFloat(v) : v;
}

export function genApmStats() {
  return {
    overall: genTimeSeries(60, 50, 3),
    rate: genTimeSeries(60, 2500, 100),
    latency_histogram: [
      { bucket: '0-10ms', cnt: faker.number.int({ min: 100, max: 1000 }) },
      { bucket: '10-50ms', cnt: faker.number.int({ min: 500, max: 5000 }) },
      { bucket: '50-100ms', cnt: faker.number.int({ min: 200, max: 2000 }) },
      { bucket: '100-500ms', cnt: faker.number.int({ min: 50, max: 500 }) },
      { bucket: '500ms-1s', cnt: faker.number.int({ min: 10, max: 100 }) },
      { bucket: '1s+', cnt: faker.number.int({ min: 0, max: 20 }) },
    ],
  };
}
