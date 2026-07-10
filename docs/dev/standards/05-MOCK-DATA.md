# 假数据方案（Faker + MSW）

**目标**：让前端开发不依赖 Rust 后端 + MySQL + ClickHouse 就能跑。`pnpm dev` 直接 mock。

---

## 架构

```
┌────────────────┐
│ 组件 useQuery  │
│ api.getXxx()   │
└────────┬───────┘
         │ fetch('/api/v1/xxx')
         ▼
┌────────────────┐
│ MSW (Service   │  ← 拦截 fetch，返回 mock
│  Worker)       │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ handlers.ts    │
│  → generators  │ ← Faker 生成假数据
│  → schema.ts   │ ← 数据形状定义
└────────────────┘
```

**关键**：MSW **拦截 HTTP 层**，`api/client.ts` 一个字都不用改。开发/生产切换只在 `main.tsx` 加/删一行。

---

## 目录结构（新增）

```
frontend/src/mocks/
├── README.md
├── browser.ts          # MSW browser 启动器
├── handlers.ts         # 所有 URL → 响应 handler
├── schema.ts           # 所有 API 响应的 TypeScript 类型（可以复用 src/api/types.ts）
├── generators/         # Faker 生成器（按 domain 拆）
│   ├── index.ts
│   ├── apm.ts
│   ├── infra.ts
│   ├── logs.ts
│   ├── metrics.ts
│   ├── monitors.ts
│   ├── billing.ts
│   └── guardian.ts
└── fixtures/           # 固定的种子数据（用于测试）
    ├── services.json
    └── trace.json
```

---

## 安装 + 初始化

```bash
cd frontend
pnpm add -D msw
pnpm dlx msw init public/  # 生成 public/mockServiceWorker.js
```

在 `frontend/src/main.tsx` 里：

```tsx
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',  // 未 mock 的请求正常发到后端
  });
}
```

在 `frontend/.env.local`（gitignore）加：
```
VITE_USE_MOCKS=true    # 打开 mock；不设或 false 走真后端
```

---

## `browser.ts`

```typescript
// frontend/src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

---

## `handlers.ts`（示例，实际按端点扩展）

```typescript
// frontend/src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';
import { faker } from '@faker-js/faker';
import {
  genApmService, genApmTrace, genApmTopology,
  genInfraHost, genInfraProcess,
  genLogEntry, genMetricPoint,
  genMonitor, genBillingSummary, genGuardianStory,
} from './generators';

const BASE = '/api/v1';

/** 通用：加个小延迟模拟真实网络 */
const respond = <T>(data: T, ms = 200) => delay(ms).then(() => HttpResponse.json(data));

/** 固定种子，保证同一次 dev 会话内数据稳定 */
faker.seed(42);

export const handlers = [
  // ─── Auth ─────────────────────────────────────────
  http.get(`${BASE}/auth/me`, () =>
    respond({ user: { id: 1, name: 'Demo User', email: 'demo@zerotrace.io' } })
  ),

  // ─── Data overview ───────────────────────────────
  http.get(`${BASE}/data/overview`, () =>
    respond({
      agents: Array.from({ length: 12 }, () => ({
        id: faker.string.uuid(),
        hostname: faker.internet.domainName(),
        status: faker.helpers.arrayElement(['online', 'stale', 'offline']),
        last_seen: faker.date.recent().toISOString(),
      })),
      total_traces: faker.number.int({ min: 100_000, max: 5_000_000 }),
      total_metrics: faker.number.int({ min: 10_000, max: 500_000 }),
    })
  ),

  // ─── APM ──────────────────────────────────────────
  http.get(`${BASE}/apm/services`, () =>
    respond({ services: Array.from({ length: 24 }, genApmService) })
  ),

  http.get(`${BASE}/apm/services/:name`, ({ params }) =>
    respond({
      service_name: params.name,
      overview: Array.from({ length: 60 }, (_, i) => ({
        ts: new Date(Date.now() - (60 - i) * 60_000).toISOString(),
        request_count: faker.number.int({ min: 100, max: 5000 }),
        error_count: faker.number.int({ min: 0, max: 100 }),
        p95_ms: faker.number.float({ min: 20, max: 800, fractionDigits: 1 }),
      })),
      operations: Array.from({ length: 12 }, () => ({
        name: faker.hacker.verb() + '_' + faker.hacker.noun(),
        p50_ms: faker.number.float({ min: 5, max: 200 }),
        p95_ms: faker.number.float({ min: 20, max: 800 }),
        request_count: faker.number.int({ min: 100, max: 10000 }),
      })),
      rate: Array.from({ length: 60 }, () => faker.number.float({ min: 0, max: 100 })),
    })
  ),

  http.get(`${BASE}/apm/traces`, () => {
    const total = 200;
    return respond({
      traces: Array.from({ length: 50 }, genApmTrace),
      total,
      ok_total: total - 15,
      error_total: 15,
      limit: 50,
      offset: 0,
    });
  }),

  http.get(`${BASE}/apm/traces/:traceId`, ({ params }) =>
    respond({ ...genApmTrace(), trace_id: params.traceId as string })
  ),

  http.get(`${BASE}/apm/topology`, () => respond(genApmTopology(8, 20))),

  // ─── Infra ────────────────────────────────────────
  http.get(`${BASE}/infra/hosts`, () =>
    respond({ hosts: Array.from({ length: 40 }, genInfraHost) })
  ),

  http.get(`${BASE}/infra/processes`, () =>
    respond({ processes: Array.from({ length: 100 }, genInfraProcess) })
  ),

  // ─── Logs ─────────────────────────────────────────
  http.get(`${BASE}/logs`, () =>
    respond({
      logs: Array.from({ length: 200 }, genLogEntry),
      total: 12_345,
    })
  ),

  // ─── Metrics ──────────────────────────────────────
  http.get(`${BASE}/metrics/list`, () =>
    respond({
      metrics: [
        { name: 'system.cpu.usage',    display_name: 'CPU Usage',    type: 'gauge',   unit: '%',   description: 'CPU %', category: 'system' },
        { name: 'system.memory.usage', display_name: 'Memory Usage', type: 'gauge',   unit: '%',   description: 'Mem %', category: 'system' },
        { name: 'system.net.rx',       display_name: 'Network RX',   type: 'counter', unit: 'B/s', description: 'RX bps', category: 'network' },
      ],
    })
  ),

  http.get(`${BASE}/metrics/query`, ({ request }) => {
    const url = new URL(request.url);
    const name = url.searchParams.get('name') ?? 'system.cpu.usage';
    return respond({
      metric: name,
      display_name: name,
      unit: '%',
      points: Array.from({ length: 60 }, (_, i) => genMetricPoint(i)),
    });
  }),

  // ─── Monitors ─────────────────────────────────────
  http.get(`${BASE}/monitors`, () =>
    respond({ monitors: Array.from({ length: 30 }, genMonitor) })
  ),

  // ─── Billing ──────────────────────────────────────
  http.get(`${BASE}/billing/summary`, () => respond(genBillingSummary())),

  http.get(`${BASE}/billing/usage`, () =>
    respond({
      org_id: 1,
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      products: [
        { key: 'apm', name: 'APM', usage: 234_567,   included: 300_000, cost: 0 },
        { key: 'logs', name: 'Logs', usage: 1_234_567, included: 1_000_000, cost: 234.5 },
        { key: 'infra', name: 'Infrastructure', usage: 42, included: 50, cost: 0 },
      ],
    })
  ),

  // ─── Guardian ─────────────────────────────────────
  http.post(`${BASE}/guardian/analyze`, () =>
    respond({
      stories: Array.from({ length: 5 }, genGuardianStory),
      analyzed_services: 24,
      analysis_window_secs: 3600,
    })
  ),

  http.get(`${BASE}/guardian/stories`, () =>
    respond({ stories: Array.from({ length: 10 }, genGuardianStory) })
  ),

  // ─── 未匹配的走真后端（onUnhandledRequest: 'bypass'）─────
];
```

---

## `generators/apm.ts`（示例）

```typescript
// frontend/src/mocks/generators/apm.ts
import { faker } from '@faker-js/faker';

const SERVICES = [
  'api-gateway', 'auth-svc', 'user-svc', 'billing-svc', 'notification-svc',
  'search-svc', 'payment-svc', 'inventory-svc', 'order-svc', 'catalog-svc',
];

const ENV = ['prod', 'staging', 'dev'];

export function genApmService() {
  const requestCount = faker.number.int({ min: 500, max: 50_000 });
  const errorRate = faker.number.float({ min: 0, max: 8, fractionDigits: 2 });
  return {
    service_name: faker.helpers.arrayElement(SERVICES),
    env: faker.helpers.arrayElement(ENV),
    request_count: requestCount,
    error_count: Math.floor(requestCount * (errorRate / 100)),
    error_rate_pct: errorRate,
    p50_ms: faker.number.float({ min: 5, max: 100, fractionDigits: 1 }),
    p95_ms: faker.number.float({ min: 20, max: 800, fractionDigits: 1 }),
    p99_ms: faker.number.float({ min: 50, max: 2000, fractionDigits: 1 }),
    // 60 个点的 sparkline
    sparkline: Array.from({ length: 60 }, () => faker.number.int({ min: 10, max: 100 })),
  };
}

export function genApmTrace() {
  const services = faker.helpers.arrayElements(SERVICES, { min: 2, max: 5 });
  const spanCount = faker.number.int({ min: 5, max: 40 });
  return {
    trace_id: faker.string.alphanumeric(32),
    root_service: services[0],
    span_count: spanCount,
    error_count: faker.number.int({ min: 0, max: 3 }),
    duration_us: faker.number.int({ min: 1000, max: 5_000_000 }),
    start_time: faker.date.recent().toISOString(),
    end_time: faker.date.recent().toISOString(),
    status: faker.helpers.weightedArrayElement([
      { value: 'ok', weight: 8 },
      { value: 'error', weight: 2 },
    ]),
    services,
    tag_keys: ['http.method', 'http.status', 'db.type', 'env'],
  };
}

export function genApmTopology(nodeCount = 8, edgeCount = 20) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `svc-${i}`,
    name: SERVICES[i % SERVICES.length],
    request_count: faker.number.int({ min: 100, max: 10_000 }),
    error_rate_pct: faker.number.float({ min: 0, max: 5 }),
  }));
  const edges = Array.from({ length: edgeCount }, () => ({
    source: `svc-${faker.number.int({ min: 0, max: nodeCount - 1 })}`,
    target: `svc-${faker.number.int({ min: 0, max: nodeCount - 1 })}`,
    request_count: faker.number.int({ min: 10, max: 5000 }),
  })).filter((e) => e.source !== e.target);
  return { nodes, edges };
}
```

---

## `generators/logs.ts`

```typescript
// frontend/src/mocks/generators/logs.ts
import { faker } from '@faker-js/faker';

const LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'] as const;
const SERVICES = ['api-gateway', 'worker', 'auth-svc', 'billing'];

const TEMPLATES = [
  'Request completed in {ms}ms',
  'Cache hit for key={key}',
  'Database query took {ms}ms',
  'Retrying {op} attempt {n}',
  'Failed to connect to {host}',
  'User {user} logged in',
  'Rate limit exceeded for {user}',
];

export function genLogEntry() {
  const template = faker.helpers.arrayElement(TEMPLATES);
  return {
    ts: faker.date.recent().toISOString(),
    level: faker.helpers.weightedArrayElement([
      { value: 'INFO',  weight: 60 },
      { value: 'WARN',  weight: 25 },
      { value: 'ERROR', weight: 10 },
      { value: 'DEBUG', weight: 5 },
    ]),
    service: faker.helpers.arrayElement(SERVICES),
    message: template
      .replace('{ms}', String(faker.number.int({ min: 1, max: 5000 })))
      .replace('{key}', faker.string.alphanumeric(8))
      .replace('{op}', faker.hacker.verb())
      .replace('{n}', String(faker.number.int({ min: 1, max: 5 })))
      .replace('{host}', faker.internet.domainName())
      .replace('{user}', faker.internet.username()),
    trace_id: faker.helpers.maybe(() => faker.string.alphanumeric(16), { probability: 0.5 }),
  };
}
```

---

## `generators/metrics.ts`

```typescript
// frontend/src/mocks/generators/metrics.ts
import { faker } from '@faker-js/faker';

// 随机游走 + 周期波动，比随机数看起来真实
let lastValue = 50;

export function genMetricPoint(i: number) {
  lastValue += faker.number.float({ min: -3, max: 3 });
  // 加入日周期
  const wave = Math.sin(i * 0.1) * 10;
  const value = Math.max(0, Math.min(100, lastValue + wave));
  return {
    ts: new Date(Date.now() - (60 - i) * 60_000).toISOString(),
    value: parseFloat(value.toFixed(2)),
  };
}
```

---

## 其他生成器骨架

见 `docs/dev/standards/proposed-files/mocks/`（下一步产出）。

**约定**：
- 每个 `gen<Domain><Entity>()` 函数返回**一个**该实体
- 想要一组：`Array.from({ length: N }, genXxx)`
- 用 `faker.seed(42)` 保证同一 dev session 数据稳定
- 时序数据用**随机游走**而不是纯随机（看起来真实）

---

## 什么时候要真数据

某些场景 mock 是不够的：

| 场景 | 用 mock | 用真后端 |
|---|---|---|
| 首次开发 UI 组件 | ✅ | ❌ |
| 布局验证 | ✅ | ❌ |
| 交互设计 | ✅ | ❌ |
| API 合约验证 | ❌ | ✅ |
| 大数据量渲染性能 | ✅（generator 造 10k 行）| ✅ |
| 深度依赖后端状态（如 Guardian 分析）| ❌ | ✅ |

**建议**：日常 UI 开发 90% 用 mock，只有联调阶段切到真后端。

---

## 验收清单

- [ ] `frontend/src/mocks/browser.ts` `handlers.ts` `schema.ts` 存在
- [ ] `frontend/src/mocks/generators/` 至少覆盖 apm/infra/logs/metrics/monitors 5 个 domain
- [ ] `main.tsx` 里根据 env 变量条件启动 MSW
- [ ] `.env.local.example` 里注释了 `VITE_USE_MOCKS=true`
- [ ] `pnpm dev` 后不启动 Rust 后端，也能看到 APM 服务列表、日志、指标图
- [ ] Network 面板能看到请求被 MSW 拦截（响应头有 `x-powered-by: msw`）
