import { faker } from '@faker-js/faker';

const FINDINGS = [
  'Unexpected CPU pattern detected',
  'Memory leak identified in service',
  'Error rate anomaly detected',
  'Latency degradation in upstream dependency',
  'Database connection pool saturation',
  'Cache hit rate regression',
  'Disk I/O latency spike',
  'Network packet loss anomaly',
  'Garbage collection pause spike',
  'Thread pool exhaustion detected',
];

const ROOT_CAUSES = [
  'Recent deployment of {service} v{version} introduced a connection leak',
  'Upstream rate limiting from {service} causing retry storms',
  'Misconfigured connection pool size on {host}',
  'Database query plan changed after index rebuild on {table}',
  'Memory pressure from increased traffic to {service}',
  'Network partition between {host_a} and {host_b}',
  'Cache invalidation storm triggered by data migration',
  'Inefficient serialization in {service} response pipeline',
];

const SERVICES = ['api-gateway', 'auth-svc', 'payment-svc', 'user-svc', 'search-svc', 'billing-svc'];

export interface GuardianStory {
  id: string;
  title: string;
  severity: 'Critical' | 'Warning' | 'Info';
  service: string;
  status: 'new' | 'investigating' | 'resolved';
  finding: string;
  root_cause: string;
  affected_services: string[];
  time_detected: string;
  duration_minutes: number;
  confidence_pct: number;
  rca_nodes: GuardianRcaNode[];
}

export interface GuardianRcaNode {
  id: string;
  label: string;
  type: 'service' | 'infrastructure' | 'config' | 'external';
  probability: number;
  children?: GuardianRcaNode[];
}

export function genGuardianRcaNode(): GuardianRcaNode {
  return {
    id: faker.string.uuid(),
    label: faker.helpers.arrayElement([
      'Connection pool exhausted',
      'Upstream timeout',
      'GC pressure',
      'Network latency',
      'Disk I/O bottleneck',
      'Misconfigured timeout',
      'Rate limit hit',
      'Cache miss cascade',
    ]),
    type: faker.helpers.arrayElement(['service', 'infrastructure', 'config', 'external'] as const),
    probability: faker.number.float({ min: 0.1, max: 0.9, fractionDigits: 2 }),
  };
}

export function genGuardianStory(overrides: Partial<GuardianStory> = {}): GuardianStory {
  const serviceName = faker.helpers.arrayElement(SERVICES);
  const severity = faker.helpers.weightedArrayElement([
    { value: 'Warning' as const, weight: 50 },
    { value: 'Info' as const, weight: 35 },
    { value: 'Critical' as const, weight: 15 },
  ]);

  return {
    id: faker.string.uuid(),
    title: faker.helpers.arrayElement(FINDINGS) + ' on ' + serviceName,
    severity,
    service: serviceName,
    status: faker.helpers.weightedArrayElement([
      { value: 'new' as const, weight: 40 },
      { value: 'investigating' as const, weight: 35 },
      { value: 'resolved' as const, weight: 25 },
    ]),
    finding: faker.helpers.arrayElement(FINDINGS),
    root_cause: faker.helpers.arrayElement(ROOT_CAUSES)
      .replace('{service}', faker.helpers.arrayElement(SERVICES))
      .replace('{version}', faker.system.semver())
      .replace('{host}', faker.internet.domainName())
      .replace('{host_a}', faker.internet.domainName())
      .replace('{host_b}', faker.internet.domainName())
      .replace('{table}', faker.helpers.arrayElement(['orders', 'users', 'products', 'sessions'])),
    affected_services: faker.helpers.arrayElements(SERVICES, { min: 1, max: 4 }),
    time_detected: faker.date.recent({ days: 2 }).toISOString(),
    duration_minutes: faker.number.int({ min: 5, max: 480 }),
    confidence_pct: faker.number.float({ min: 60, max: 99, fractionDigits: 1 }),
    rca_nodes: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, genGuardianRcaNode),
    ...overrides,
  };
}
