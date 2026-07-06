import { faker } from '@faker-js/faker';

// ── Metric definitions ──────────────────────────────────

const METRICS_DB = [
  { name: 'system.cpu.usage', display_name: 'CPU Usage', type: 'gauge', unit: '%', description: 'Overall CPU usage percentage', category: 'system' },
  { name: 'system.cpu.user', display_name: 'CPU User', type: 'gauge', unit: '%', description: 'CPU time spent in user space', category: 'system' },
  { name: 'system.mem.pct_usage', display_name: 'Memory Usage', type: 'gauge', unit: '%', description: 'Physical memory usage percentage', category: 'system' },
  { name: 'system.mem.used', display_name: 'Memory Used', type: 'gauge', unit: 'GB', description: 'Physical memory used in GB', category: 'system' },
  { name: 'system.disk.pct_usage', display_name: 'Disk Usage', type: 'gauge', unit: '%', description: 'Disk usage percentage', category: 'system' },
  { name: 'system.disk.free', display_name: 'Disk Free', type: 'gauge', unit: 'GB', description: 'Free disk space in GB', category: 'system' },
  { name: 'system.net.bytes_rcvd', display_name: 'Network RX', type: 'counter', unit: 'bytes/s', description: 'Network bytes received per second', category: 'network' },
  { name: 'system.net.bytes_sent', display_name: 'Network TX', type: 'counter', unit: 'bytes/s', description: 'Network bytes sent per second', category: 'network' },
  { name: 'apm.request.count', display_name: 'Request Count', type: 'counter', unit: 'req/s', description: 'HTTP requests per second', category: 'apm' },
  { name: 'apm.request.latency_p95', display_name: 'P95 Latency', type: 'gauge', unit: 'ms', description: '95th percentile request latency', category: 'apm' },
  { name: 'apm.error.rate', display_name: 'Error Rate', type: 'gauge', unit: '%', description: 'Percentage of requests resulting in errors', category: 'apm' },
  { name: 'custom.orders.per_minute', display_name: 'Orders/min', type: 'gauge', unit: 'count', description: 'Orders created per minute', category: 'custom' },
];

// ── Time-series helper ──────────────────────────────────

function genTimeSeries(n = 60, initial = 50, drift = 3) {
  let v = initial;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, Math.min(100, v + faker.number.float({ min: -drift, max: drift })));
    const wave = Math.sin(i * (Math.PI * 2 / 24)) * 10;
    // Occasional anomaly spike (every ~15 points)
    const spike = (i % 17 === 3) ? faker.number.float({ min: 20, max: 40 }) * (faker.number.int({ min: 0, max: 1 }) ? 1 : -1) : 0;
    return {
      ts: new Date(Date.now() - (n - i) * 60_000).toISOString(),
      value: parseFloat(Math.max(0, v + wave + spike).toFixed(2)),
    };
  });
}

// ── Generators ──────────────────────────────────────────

export function genMetricsList() {
  return { metrics: METRICS_DB };
}

export function genMetricPoints(metricName: string, count = 60, _agg?: string, by?: string) {
  const def = METRICS_DB.find((m) => m.name === metricName);
  const unit = def?.unit ?? '';
  const display_name = def?.display_name ?? metricName;

  const initials: Record<string, number> = {
    'system.cpu.usage': 45, 'system.mem.pct_usage': 72,
    'apm.request.count': 2500, 'apm.error.rate': 2,
    'apm.request.latency_p95': 120, 'system.net.bytes_rcvd': 500,
  };
  const initial = initials[metricName] ?? 50;

  const result: any = {
    metric: metricName, display_name, unit,
    points: genTimeSeries(count, initial, initial > 100 ? initial * 0.02 : 3),
  };

  // If grouping by a tag (e.g. "host", "service"), generate grouped series
  if (by) {
    const groups = by === 'host'
      ? ['web-01.prod', 'web-02.prod', 'db-01.prod', 'cache-01.prod']
      : by === 'service' ? ['api-gateway', 'auth-svc', 'payment-svc']
        : by === 'env' ? ['prod', 'staging']
          : [by + '-1', by + '-2', by + '-3'];
    result.groups = groups;
  }

  return result;
}

const TAG_VALUES: Record<string, string[]> = {
  host: ['web-01.prod', 'web-02.prod', 'db-01.prod', 'db-02.prod', 'cache-01.prod', 'worker-01.prod', 'api-01.prod', 'bastion.prod'],
  service: ['api-gateway', 'auth-svc', 'user-svc', 'payment-svc', 'search-svc', 'notification-svc'],
  env: ['prod', 'staging', 'dev'],
  region: ['us-east-1', 'ap-northeast-1', 'eu-west-1'],
  deployment: ['canary', 'stable', 'latest'],
};

export function genMetricTags(_metricName: string) {
  // Return 2-4 tag keys with values + counts
  const keys = faker.helpers.shuffle(Object.keys(TAG_VALUES)).slice(0, faker.number.int({ min: 2, max: 4 }));
  return {
    tags: keys.map(key => ({
      key,
      values: TAG_VALUES[key].map(v => ({
        value: v,
        count: faker.number.int({ min: 100, max: 50000 }),
      })),
    })),
  };
}
