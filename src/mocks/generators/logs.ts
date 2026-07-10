import { faker } from '@faker-js/faker';

// ── White-listed vocabulary ──────────────────────────────

const SERVICES = ['api-gateway', 'worker', 'auth-svc', 'billing-svc', 'search-svc', 'payment-svc', 'webhook-svc'];

const INFO_TEMPLATES = [
  'Request {method} {path} completed in {ms}ms',
  'Cache hit for key={key}',
  'User {user} logged in from {ip}',
  'Scheduled job {job} completed successfully',
  'Health check passed for {service}',
  'Config reloaded ({n} keys)',
  'Connection pool: {n} active, {m} idle',
];

const WARN_TEMPLATES = [
  'Rate limit approaching for IP {ip}',
  'Slow query detected: {ms}ms on {table}',
  'Retrying {op} attempt {n}/5',
  'Connection pool at {pct}% capacity',
  'Certificate expiring in {days} days',
  'Memory usage above {pct}% threshold',
];

const ERROR_TEMPLATES = [
  'Connection timeout to {host}:{port} after {ms}ms',
  'Database query failed: {error}',
  'Failed to process message from queue {queue}',
  'Authentication failed for user {user}',
  'Disk space critically low on {mount}',
  'OOM killer invoked on process {proc}',
];

const DEBUG_TEMPLATES = [
  'Trace sampling decision: {decision} for trace_id={id}',
  'Span {span} completed in {ms}μs',
  'GC pause: {ms}ms, heap: {heap}MB',
];

// ── Helpers ─────────────────────────────────────────────

function fillTemplate(template: string): string {
  return template
    .replace('{method}', faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']))
    .replace('{path}', faker.helpers.arrayElement(['/api/orders', '/api/users', '/api/products', '/api/search', '/api/checkout']))
    .replace(/\{ms\}/g, String(faker.number.int({ min: 1, max: 5000 })))
    .replace(/\{key\}/g, faker.string.alphanumeric(8))
    .replace(/\{user\}/g, faker.internet.username())
    .replace(/\{ip\}/g, faker.internet.ip())
    .replace(/\{job\}/g, faker.helpers.arrayElement(['daily_report', 'cleanup', 'backup', 'index_rebuild']))
    .replace(/\{service\}/g, faker.helpers.arrayElement(SERVICES))
    .replace(/\{n\}/g, String(faker.number.int({ min: 1, max: 100 })))
    .replace(/\{m\}/g, String(faker.number.int({ min: 1, max: 50 })))
    .replace(/\{op\}/g, faker.hacker.verb())
    .replace(/\{pct\}/g, String(faker.number.int({ min: 80, max: 99 })))
    .replace(/\{days\}/g, String(faker.number.int({ min: 1, max: 30 })))
    .replace(/\{table\}/g, faker.helpers.arrayElement(['orders', 'users', 'products', 'sessions', 'events']))
    .replace(/\{host\}/g, faker.internet.domainName())
    .replace(/\{port\}/g, String(faker.number.int({ min: 1024, max: 65535 })))
    .replace(/\{error\}/g, faker.helpers.arrayElement(['deadlock detected', 'connection refused', 'timeout', 'out of memory']))
    .replace(/\{queue\}/g, faker.helpers.arrayElement(['orders', 'notifications', 'emails', 'indexing']))
    .replace(/\{mount\}/g, faker.helpers.arrayElement(['/', '/data', '/var/log', '/tmp']))
    .replace(/\{proc\}/g, faker.helpers.arrayElement(['java', 'node', 'python3', 'mysqld', 'redis-server']))
    .replace(/\{decision\}/g, faker.helpers.arrayElement(['sampled', 'dropped', 'kept']))
    .replace(/\{id\}/g, faker.string.alphanumeric(16))
    .replace(/\{span\}/g, faker.string.hexadecimal({ length: 8, prefix: '' }))
    .replace(/\{heap\}/g, String(faker.number.int({ min: 50, max: 2048 })));
}

// ── Generator ───────────────────────────────────────────

export interface LogEntry {
  ts: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  service: string;
  message: string;
  trace_id?: string;
  host?: string;
}

export function genLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  const level = faker.helpers.weightedArrayElement([
    { value: 'INFO' as const, weight: 60 },
    { value: 'WARN' as const, weight: 25 },
    { value: 'ERROR' as const, weight: 10 },
    { value: 'DEBUG' as const, weight: 5 },
  ]);

  const templates = level === 'ERROR' ? ERROR_TEMPLATES
    : level === 'WARN' ? WARN_TEMPLATES
    : level === 'DEBUG' ? DEBUG_TEMPLATES
    : INFO_TEMPLATES;

  return {
    ts: faker.date.recent({ days: 1 }).toISOString(),
    level,
    service: faker.helpers.arrayElement(SERVICES),
    message: fillTemplate(faker.helpers.arrayElement(templates)),
    trace_id: faker.helpers.maybe(() => faker.string.hexadecimal({ length: 32, prefix: '' }), { probability: 0.3 }),
    host: faker.helpers.maybe(() => faker.internet.domainName(), { probability: 0.5 }),
    ...overrides,
  };
}
