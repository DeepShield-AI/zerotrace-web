# Faker 使用规范

**范围**：`frontend/src/mocks/generators/`（配合 MSW，见 [05-MOCK-DATA.md](./05-MOCK-DATA.md)）
**目的**：让 mock 数据"看起来像真的"，且**不同 agent 生成的数据风格一致**

---

## 硬性规则

### R1：种子必须固定

```typescript
// frontend/src/mocks/handlers.ts 顶部
import { faker } from '@faker-js/faker';
faker.seed(42);  // 一次开发会话内数据稳定，方便调试和视觉回归
```

**违反**：每次刷新数据都变 → visual regression 无法做

### R2：文件按 domain 分

一个 domain 一个文件，禁止混装：

```
mocks/generators/
├── apm.ts        ← genApmService, genApmTrace, genApmSpan, genApmTopology
├── infra.ts      ← genInfraHost, genInfraProcess, genInfraContainer
├── logs.ts       ← genLogEntry, genLogFacet
├── metrics.ts    ← genMetricPoint, genMetricDefinition
├── monitors.ts   ← genMonitor, genMonitorHistory
├── billing.ts    ← genBillingSummary, genInvoice, genUsageRow
├── guardian.ts   ← genGuardianStory, genGuardianRcaNode
├── org.ts        ← genUser, genApiKey, genOrganization
└── index.ts      ← re-export 所有
```

### R3：函数命名 `gen<Domain><Entity>()`

```typescript
// ✅ DO
genApmService()
genLogEntry()
genGuardianStory()

// ❌ DON'T
createService()      // 模糊，看不出是 mock
makeApmData()        // 太粗
mockService()        // 冗余（在 mocks/ 目录里已经知道是 mock）
```

### R4：一次生成一个实体，用 `Array.from` 复制

```typescript
// ✅ DO
export function genApmService() {
  return { service_name: '...', request_count: ... };
}

// 调用方
const services = Array.from({ length: 24 }, genApmService);

// ❌ DON'T
export function genApmServices(n: number) {  // 别把数量藏在生成器里
  return Array.from({ length: n }, () => ({ ... }));
}
```

**理由**：外层控制数量便于测试；Storybook / handler 各自决定 N。

### R5：所有随机值有边界

```typescript
// ✅ DO
requests: faker.number.int({ min: 100, max: 50_000 })
latency:  faker.number.float({ min: 5, max: 800, fractionDigits: 1 })

// ❌ DON'T
requests: Math.random() * 100000       // 会有 0 和无限小数
latency:  faker.number.float()          // 默认 0-1，跟真实数据脱节
```

### R6：领域词汇用**枚举白名单**，不用 faker 随机词

```typescript
// ✅ DO — 保持看起来专业
const SERVICES = [
  'api-gateway', 'auth-svc', 'user-svc', 'billing-svc', 'notification-svc',
  'search-svc', 'payment-svc', 'inventory-svc', 'order-svc', 'catalog-svc',
];
service_name: faker.helpers.arrayElement(SERVICES)

// ❌ DON'T — 会出现 "MoribundLachrymoseGoat" 之类
service_name: faker.hacker.noun() + '-' + faker.hacker.verb()
```

**为什么**：DevOps 场景的服务名有明显命名习惯（kebab-case、短、领域词），faker 随机出来看不像真的。

### R7：时序数据用**随机游走**，不用纯随机

```typescript
// ✅ DO
export function genTimeSeries(n = 60, initial = 50, drift = 3) {
  let v = initial;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, Math.min(100, v + faker.number.float({ min: -drift, max: drift })));
    return {
      ts: new Date(Date.now() - (n - i) * 60_000).toISOString(),
      value: parseFloat(v.toFixed(2)),
    };
  });
}

// ❌ DON'T — 折线图会像心电图一样锯齿
Array.from({ length: 60 }, () => faker.number.float({ min: 0, max: 100 }))
```

**加分**：叠加正弦波模拟日周期：
```typescript
const wave = Math.sin(i * (Math.PI * 2 / 24)) * 10;  // 24 小时周期
value: Math.max(0, Math.min(100, v + wave))
```

### R8：错误率类字段用**加权分布**

```typescript
// ✅ DO — 大多数正常，少数异常
level: faker.helpers.weightedArrayElement([
  { value: 'INFO',  weight: 70 },
  { value: 'WARN',  weight: 20 },
  { value: 'ERROR', weight: 8 },
  { value: 'DEBUG', weight: 2 },
])

// ❌ DON'T — 均匀分布看起来假
level: faker.helpers.arrayElement(['INFO', 'WARN', 'ERROR', 'DEBUG'])
```

### R9：**关联字段要一致**

```typescript
// ✅ DO
export function genApmService() {
  const requestCount = faker.number.int({ min: 500, max: 50_000 });
  const errorRatePct = faker.number.float({ min: 0, max: 8, fractionDigits: 2 });
  return {
    request_count: requestCount,
    error_count:   Math.floor(requestCount * (errorRatePct / 100)),  // 派生
    error_rate_pct: errorRatePct,
  };
}

// ❌ DON'T — 各自独立随机，error_count 可能 > request_count
{
  request_count: faker.number.int({ min: 500, max: 50_000 }),
  error_count:   faker.number.int({ min: 0, max: 1_000 }),
}
```

### R10：**留下"故意异常"的样本**

生成一组数据时，明确让 5-10% 命中异常状态：

```typescript
// ✅ DO — 前 3 个 service 高错误率（用于 UI 验证 alert 徽章）
export function genApmServices(n = 24) {
  return Array.from({ length: n }, (_, i) => {
    const isBadSample = i < 3;
    const errorRate = isBadSample
      ? faker.number.float({ min: 5, max: 15 })
      : faker.number.float({ min: 0, max: 2 });
    return genApmService(errorRate);
  });
}
```

**为什么**：视觉回归时能同时看到"正常样式"和"警告样式"。

---

## 结构化模板

**每个 generator 都遵守下面结构**：

```typescript
// mocks/generators/<domain>.ts

// ── 1. 白名单词汇 ─────────────────────────────
const SERVICES = ['...', '...'] as const;
const ENVS = ['prod', 'staging', 'dev'] as const;
const REGIONS = ['us-east-1', 'ap-northeast-1', 'eu-west-1'] as const;

// ── 2. 单实体生成器 ───────────────────────────
/**
 * 生成一个 APM Service 记录。
 * 关联字段一致：error_count = round(request_count * error_rate / 100)
 */
export function genApmService(overrides: Partial<ApmService> = {}): ApmService {
  const requestCount = faker.number.int({ min: 500, max: 50_000 });
  const errorRatePct = faker.number.float({ min: 0, max: 8, fractionDigits: 2 });
  return {
    service_name: faker.helpers.arrayElement(SERVICES),
    env:          faker.helpers.arrayElement(ENVS),
    region:       faker.helpers.arrayElement(REGIONS),
    request_count: requestCount,
    error_count:   Math.floor(requestCount * (errorRatePct / 100)),
    error_rate_pct: errorRatePct,
    p50_ms:  faker.number.float({ min: 5,  max: 100, fractionDigits: 1 }),
    p95_ms:  faker.number.float({ min: 20, max: 800, fractionDigits: 1 }),
    p99_ms:  faker.number.float({ min: 50, max: 2000, fractionDigits: 1 }),
    sparkline: genTimeSeries(60).map((p) => p.value),
    ...overrides,   // ← 允许调用方覆盖任意字段
  };
}

// ── 3. 派生 / 关联生成器 ──────────────────────
/**
 * 生成 APM Topology（服务依赖图）
 * 保证 edges.source/target 都在 nodes 里
 */
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
  })).filter((e) => e.source !== e.target);   // 去自环
  return { nodes, edges };
}

// ── 4. 私有工具（不 export）──────────────────
function genTimeSeries(n: number) { /* R7 里的实现 */ }
```

---

## `overrides` 参数（重要）

**所有主生成器**必须支持 `overrides` 参数：

```typescript
// Storybook 里想固定 error_rate = 15% 展示 critical 状态
const service = genApmService({ error_rate_pct: 15 });

// 或造 3 个高错误率、20 个正常
const services = [
  ...Array.from({ length: 3 }, () => genApmService({ error_rate_pct: 12 })),
  ...Array.from({ length: 20 }, genApmService),
];
```

**理由**：Storybook 需要**确定的**数据展示特定 variant；不给 overrides 就只能靠 seed 试错。

---

## Type-safe：generators 必须返回**明确类型**

```typescript
// ✅ DO — 从 api/types.ts 导入或本地定义
import type { ApmService } from '@/api/types';
export function genApmService(overrides: Partial<ApmService> = {}): ApmService { ... }

// ❌ DON'T
export function genApmService() { return { ... } as any; }
```

**理由**：mock 和真接口 shape 漂移是最大坑；类型强制约束才能发现漂移。

---

## Fixtures：稳定数据 vs 生成数据

有些场景需要**每次都一样**的数据（视觉回归、E2E 测试）。这时用 fixture 而非 generator：

```
mocks/fixtures/
├── apm-services-baseline.json    ← 用 generator 生成一次，存下来
├── logs-error-cluster.json       ← 手工整理的典型日志集
└── monitor-alert-scenario.json   ← 模拟一次 alert 触发的完整数据
```

```typescript
// handlers.ts 里选择用 generator 或 fixture
import baselineServices from './fixtures/apm-services-baseline.json';

http.get(`${BASE}/apm/services`, ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get('scenario') === 'baseline') {
    return respond({ services: baselineServices });
  }
  return respond({ services: Array.from({ length: 24 }, genApmService) });
})
```

**规则**：
- fixture 用于**可重复的对比测试**
- generator 用于**日常开发浏览**
- 一个页面同时支持两种模式（用 URL 参数 `?scenario=baseline` 切）

---

## 反模式（真实案例）

### 反模式 1：直接从组件里 import faker

```tsx
// ❌ frontend/src/components/MetricCard.stories.tsx
import { faker } from '@faker-js/faker';
export const Default = () => (
  <MetricCard title="RPS" value={faker.number.int()} />
);
```

**问题**：每次 Storybook 刷新数值都变，无法做像素级验证；faker 被到处 import 之后依赖关系混乱。

**正确**：
```tsx
import { genApmService } from '@/mocks/generators/apm';

// 用固定 seed
faker.seed(1);
const service = genApmService();

export const Default = () => (
  <MetricCard title="RPS" value={service.request_count} />
);
```

### 反模式 2：generator 里做 UI 逻辑

```typescript
// ❌ 别在 generator 里处理 UI 状态
export function genApmService() {
  const errorRate = faker.number.float(...);
  return {
    error_rate: errorRate,
    statusBadgeColor: errorRate > 5 ? 'red' : 'green',   // ← 别！
    displayText: 'RPS: ' + faker.number.int(),           // ← 别！
  };
}
```

**问题**：把展示逻辑漏进数据层，切换主题/i18n 时会出乱子。

**正确**：数据层只给**原始数值**，UI 逻辑在组件里做。

### 反模式 3：一个 generator 造整个页面数据

```typescript
// ❌ genApmServicesPageData()
export function genApmServicesPageData() {
  return {
    services: [...],
    metrics: {...},
    filters: [...],
    user: {...},
  };
}
```

**问题**：耦合过强，改一处影响全页；无法给单个组件的 Story 用。

**正确**：粒度小、独立、可组合。页面里分别调多个 generator。

---

## Faker 常用 API 备忘

按场景速查：

```typescript
// 数字
faker.number.int({ min, max })
faker.number.float({ min, max, fractionDigits })

// 字符串 / ID
faker.string.uuid()
faker.string.alphanumeric(16)
faker.string.hexadecimal({ length: 32, prefix: '' })   // trace_id 用

// 日期
faker.date.recent({ days: 1 })       // 过去 1 天内
faker.date.past()
faker.date.future()
faker.date.between({ from, to })

// 网络
faker.internet.domainName()
faker.internet.ip()
faker.internet.userAgent()
faker.internet.email()
faker.internet.url()

// 人名 / 组织
faker.person.fullName()
faker.person.jobTitle()
faker.company.name()

// 随机选择
faker.helpers.arrayElement(['a', 'b', 'c'])
faker.helpers.weightedArrayElement([
  { value: 'x', weight: 8 },
  { value: 'y', weight: 2 },
])
faker.helpers.arrayElements(SERVICES, { min: 2, max: 5 })  // 多个不重复
faker.helpers.maybe(() => 'value', { probability: 0.5 })   // 50% 概率有值

// 版本 / 语义化
faker.system.semver()      // "5.24.1"
faker.system.commonFileName()
```

---

## 检查清单

新加/改 generator 时：

- [ ] 文件位置：`mocks/generators/<domain>.ts`
- [ ] 命名：`gen<Domain><Entity>`
- [ ] 返回类型明确（不用 `any`）
- [ ] 支持 `overrides` 参数
- [ ] 关联字段一致（如 error_count ≤ request_count）
- [ ] 时序数据用随机游走
- [ ] 加权分布替代均匀分布
- [ ] 领域词汇用白名单
- [ ] 有边界（min/max）
- [ ] 不掺 UI 逻辑
