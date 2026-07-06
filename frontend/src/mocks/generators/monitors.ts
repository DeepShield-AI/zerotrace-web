import { faker } from '@faker-js/faker';

// ── White-listed vocabulary ──────────────────────────────

const MONITOR_NAMES = [
  'High CPU on {host}',
  'Memory usage above threshold on {host}',
  'Disk space low on {host}',
  'Error rate spike on {service}',
  'P95 latency high on {service}',
  'SSL Certificate Expiry for {domain}',
  'Kubernetes Pod CrashLoop on {cluster}',
  'Connection pool exhausted on {service}',
  'Cache hit rate low on {service}',
  'Queue depth critical on {queue}',
];

const HOSTS = ['web-01.prod', 'web-02.prod', 'db-01.prod', 'db-02.prod', 'cache-01.prod', 'worker-01.prod', 'api-01.prod'];
const SERVICES = ['api-gateway', 'auth-svc', 'payment-svc', 'user-svc', 'search-svc'];
const QUEUES = ['orders', 'notifications', 'emails', 'indexing'];

function fillName(template: string): string {
  return template
    .replace('{host}', faker.helpers.arrayElement(HOSTS))
    .replace('{service}', faker.helpers.arrayElement(SERVICES))
    .replace('{domain}', faker.internet.domainName())
    .replace('{cluster}', faker.helpers.arrayElement(['k8s-prod-1', 'k8s-staging', 'k8s-us-east']))
    .replace('{queue}', faker.helpers.arrayElement(QUEUES));
}

// ── Generator ───────────────────────────────────────────

export interface Monitor {
  id: number;
  name: string;
  type: 'Metric' | 'APM' | 'Log' | 'Integration';
  status: 'ok' | 'triggered' | 'muted' | 'no-data';
  severity: 'critical' | 'high' | 'medium' | 'low';
  triggered_at: string | null;
  host: string;
  message: string;
  tags: string[];
  query: string;
}

export function genMonitor(overrides: Partial<Monitor> = {}): Monitor {
  const severity = faker.helpers.weightedArrayElement([
    { value: 'critical' as const, weight: 5 },
    { value: 'high' as const, weight: 15 },
    { value: 'medium' as const, weight: 40 },
    { value: 'low' as const, weight: 40 },
  ]);
  const status = faker.helpers.weightedArrayElement([
    { value: 'ok' as const, weight: 50 },
    { value: 'triggered' as const, weight: 20 },
    { value: 'muted' as const, weight: 10 },
    { value: 'no-data' as const, weight: 20 },
  ]);
  const type = faker.helpers.arrayElement(['Metric', 'APM', 'Log', 'Integration'] as const);

  return {
    id: faker.number.int({ min: 1, max: 10000 }),
    name: fillName(faker.helpers.arrayElement(MONITOR_NAMES)),
    type,
    status,
    severity,
    triggered_at: status === 'triggered' ? faker.date.recent({ days: 1 }).toISOString() : null,
    host: faker.helpers.arrayElement(HOSTS),
    message: `${severity === 'critical' ? 'CRITICAL: ' : ''}${faker.lorem.sentence()}`,
    tags: faker.helpers.arrayElements(['production', 'staging', 'k8s', 'database', 'frontend', 'infrastructure'], { min: 1, max: 4 }),
    query: `${type === 'Metric' ? 'avg:system.' + faker.helpers.arrayElement(['cpu', 'mem', 'disk']) + '.usage' : type === 'APM' ? 'avg:trace.' + faker.helpers.arrayElement(['errors', 'latency', 'hits']) + '.rate' : 'service:' + faker.helpers.arrayElement(SERVICES)} > ${faker.number.int({ min: 80, max: 99 })}`,
    ...overrides,
  };
}

export function genMonitorHistory(monitorId: number, count = 60) {
  let v = faker.number.float({ min: 20, max: 80 });
  return Array.from({ length: count }, (_, i) => {
    v = Math.max(0, Math.min(100, v + faker.number.float({ min: -5, max: 5 })));
    return {
      ts: new Date(Date.now() - (count - i) * 60_000).toISOString(),
      monitor_id: monitorId,
      value: parseFloat(v.toFixed(2)),
      status: v > 90 ? 'triggered' : v > 75 ? 'warning' : 'ok',
    };
  });
}
