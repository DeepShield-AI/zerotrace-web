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
    return {
      ts: new Date(Date.now() - (n - i) * 60_000).toISOString(),
      value: parseFloat(Math.max(0, v + wave).toFixed(2)),
    };
  });
}

// ── Generators ──────────────────────────────────────────

export function genMetricsList() {
  return { metrics: METRICS_DB };
}

export function genMetricPoints(metricName: string, count = 60) {
  const def = METRICS_DB.find((m) => m.name === metricName);
  const unit = def?.unit ?? '';
  const display_name = def?.display_name ?? metricName;

  // Use different initial values per metric for visual variety
  const initials: Record<string, number> = {
    'system.cpu.usage': 45,
    'system.mem.pct_usage': 72,
    'apm.request.count': 2500,
    'apm.error.rate': 2,
    'apm.request.latency_p95': 120,
    'system.net.bytes_rcvd': 500,
  };
  const initial = initials[metricName] ?? 50;

  return {
    metric: metricName,
    display_name,
    unit,
    points: genTimeSeries(count, initial, initial > 100 ? initial * 0.02 : 3),
  };
}
