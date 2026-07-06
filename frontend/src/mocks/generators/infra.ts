import { faker } from '@faker-js/faker';

// ── White-listed vocabulary ──────────────────────────────

const HOST_PREFIXES = ['web', 'db', 'cache', 'worker', 'queue', 'api', 'bastion', 'monitor'] as const;
const CONTAINER_NAMES = ['nginx', 'redis', 'postgres', 'kafka', 'zookeeper', 'fluentd', 'prometheus', 'grafana'] as const;
const PROCESS_NAMES = ['nginx', 'java', 'node', 'python3', 'mysqld', 'redis-server', 'kafka', 'postgres', 'gunicorn', 'celery'] as const;

// ── Helpers ─────────────────────────────────────────────
function genTimeSeries(n = 60, initial = 50, drift = 3) {
  let v = initial;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, v + faker.number.float({ min: -drift, max: drift }));
    return {
      ts: new Date(Date.now() - (n - i) * 60_000).toISOString(),
      value: parseFloat(v.toFixed(2)),
    };
  });
}

function genHostname(): string {
  const prefix = faker.helpers.arrayElement(HOST_PREFIXES);
  const num = faker.number.int({ min: 1, max: 99 });
  const env = faker.helpers.arrayElement(['prod', 'staging', 'dev']);
  return `${prefix}-${String(num).padStart(2, '0')}.${env}`;
}

function genStatus(): 'online' | 'stale' | 'offline' {
  return faker.helpers.weightedArrayElement([
    { value: 'online' as const, weight: 80 },
    { value: 'stale' as const, weight: 15 },
    { value: 'offline' as const, weight: 5 },
  ]);
}

// ── Single-entity generators ─────────────────────────────

export interface InfraHost {
  ID: number;
  NAME: string;
  CTRL_IP: string;
  STATE: number;
  SYNCED_CONTROLLER_AT: string;
  status: 'online' | 'stale' | 'offline';
  os: string;
  cpu_cores: number;
  cpu_pct: number;
  memory_total_gb: number;
  memory_pct: number;
  disk_total_gb: number;
  disk_pct: number;
  network_rx_mbps: number;
  network_tx_mbps: number;
  agent_version: string;
  tags: string[];
}

let hostIdCounter = 1;
export function genInfraHost(overrides: Partial<InfraHost> = {}): InfraHost {
  const status = genStatus();
  return {
    ID: hostIdCounter++,
    NAME: genHostname(),
    CTRL_IP: faker.internet.ip(),
    STATE: status === 'online' ? 1 : status === 'stale' ? 1 : 0,
    SYNCED_CONTROLLER_AT: status === 'online'
      ? new Date(Date.now() - faker.number.int({ min: 1, max: 60 }) * 1000).toISOString().replace('T', ' ').slice(0, 19)
      : status === 'stale'
        ? new Date(Date.now() - faker.number.int({ min: 5, max: 60 }) * 60_000).toISOString().replace('T', ' ').slice(0, 19)
        : new Date(Date.now() - faker.number.int({ min: 1, max: 24 }) * 3600_000).toISOString().replace('T', ' ').slice(0, 19),
    status,
    os: faker.helpers.arrayElement(['Ubuntu 22.04', 'Ubuntu 24.04', 'Debian 12', 'CentOS 9', 'Amazon Linux 2023']),
    cpu_cores: faker.number.int({ min: 2, max: 64 }),
    cpu_pct: faker.number.float({ min: 5, max: 95, fractionDigits: 1 }),
    memory_total_gb: faker.number.float({ min: 4, max: 256, fractionDigits: 1 }),
    memory_pct: faker.number.float({ min: 10, max: 90, fractionDigits: 1 }),
    disk_total_gb: faker.number.int({ min: 50, max: 2000 }),
    disk_pct: faker.number.float({ min: 10, max: 85, fractionDigits: 1 }),
    network_rx_mbps: faker.number.float({ min: 0.1, max: 1000, fractionDigits: 1 }),
    network_tx_mbps: faker.number.float({ min: 0.1, max: 500, fractionDigits: 1 }),
    agent_version: faker.system.semver(),
    tags: faker.helpers.arrayElements(['production', 'staging', 'us-east-1', 'k8s', 'docker', 'bare-metal'], { min: 1, max: 4 }),
    ...overrides,
  };
}

export interface InfraProcess {
  process_name: string;
  host_id: string;
  request_count: number;
  avg_latency_ms: number;
  error_count: number;
  pid: number;
  cpu_pct: number;
  memory_mb: number;
  status: string;
}

export function genInfraProcess(overrides: Partial<InfraProcess> = {}): InfraProcess {
  const reqs = faker.number.int({ min: 0, max: 50_000 });
  return {
    process_name: faker.helpers.arrayElement(PROCESS_NAMES),
    host_id: genHostname(),
    request_count: reqs,
    avg_latency_ms: faker.number.float({ min: 1, max: 500, fractionDigits: 1 }),
    error_count: reqs > 0 ? faker.number.int({ min: 0, max: Math.floor(reqs * 0.1) }) : 0,
    pid: faker.number.int({ min: 100, max: 65535 }),
    cpu_pct: faker.number.float({ min: 0.1, max: 80, fractionDigits: 1 }),
    memory_mb: faker.number.int({ min: 10, max: 8192 }),
    status: faker.helpers.weightedArrayElement([
      { value: 'running', weight: 85 }, { value: 'sleeping', weight: 10 }, { value: 'zombie', weight: 5 },
    ]),
    ...overrides,
  };
}

// ── Collection generators ───────────────────────────────

export function genDataOverview() {
  const agents = Array.from({ length: 24 }, genInfraHost);
  const online = agents.filter((a) => a.status === 'online').length;
  const flowRate = genTimeSeries(60, 200, 30);
  const l4Bandwidth = genTimeSeries(60, 500, 50);

  return {
    agents: { list: agents, online },
    l4_stats: [{ cnt: faker.number.int({ min: 1000, max: 100_000 }), tx: faker.number.int({ min: 1e9, max: 1e12 }), rx: faker.number.int({ min: 1e9, max: 1e12 }) }],
    l7_stats: [{ cnt: faker.number.int({ min: 500, max: 50_000 }), avg_latency: faker.number.float({ min: 5, max: 200 }), p50: faker.number.float({ min: 3, max: 100 }), p95: faker.number.float({ min: 20, max: 500 }), p99: faker.number.float({ min: 50, max: 1000 }) }],
    top_l7: Array.from({ length: 5 }, (_, i) => ({
      name: `${faker.helpers.arrayElement(['GET', 'POST'])} /api/${faker.helpers.arrayElement(['orders', 'users', 'products', 'search', 'checkout'])}`,
      cnt: faker.number.int({ min: 500, max: 5000 }),
      avg_latency: faker.number.float({ min: 5, max: 200, fractionDigits: 1 }),
    })),
    top_l4: Array.from({ length: 5 }, () => ({
      src: faker.internet.ip(),
      dst: faker.internet.ip(),
      cnt: faker.number.int({ min: 100, max: 5000 }),
    })),
    flow_rate: flowRate.map((p) => ({ ts: p.ts, cnt: Math.round(p.value * 5) })),
    l4_bandwidth: l4Bandwidth.map((p) => ({ ts: p.ts, tx: Math.round(p.value * 1e6), rx: Math.round(p.value * 5e5) })),
    l7_rate: flowRate.map((p) => ({ ts: p.ts, cnt: Math.round(p.value * 3) })),
  };
}
