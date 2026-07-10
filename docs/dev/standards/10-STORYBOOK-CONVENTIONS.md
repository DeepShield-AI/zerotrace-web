# Storybook / Ladle 使用规范

**推荐选型**：**Ladle**（`@ladle/react`）。理由：启动快（< 3s vs Storybook 30s+）、配置 0（无 `.storybook/main.ts`）、原生 Vite 兼容。

**兼容说明**：本规范里的 story 文件也能被官方 Storybook 直接识别（`Meta`/`StoryObj` 语法 = 通用 CSF3）。将来切 Storybook 无痛。

**目标**：所有组件在 Story 里**独立跑通** + **多态可见** + **视觉可回归**。

---

## 硬性规则

### R1：**每个可复用组件都必须有 story**

```
src/components/MetricCard/
├── index.tsx
├── MetricCard.stories.tsx   ← 必须
└── ...
```

**例外**（可以不写）：
- 页面组件（`src/pages/*.tsx`）——但如果拆出了页面级子组件，那些要写
- 一次性组件（明显只有 1 处用）
- 纯布局容器（`<PageShell>` 这种）

### R2：**文件命名**：`<ComponentName>.stories.tsx`

大小写和组件同名，同目录。

### R3：**每个业务组件必须覆盖 4 态**：Default / Loading / Empty / Error

```tsx
// MetricCard.stories.tsx
export const Default = () => <MetricCard title="RPS" value={12345} />;
export const Loading = () => <MetricCard title="RPS" value={0} loading />;
export const Empty   = () => <MetricCard title="RPS" value={0} />;
export const Error_  = () => <MetricCard title="RPS" value={0} error={new Error('Failed')} />;
```

**为什么**：三态是最常见的显示 bug 来源，Story 里直接可视化。

### R4：**每个 variant 一个 export const**

```tsx
// ✅ DO — 每个 variant 独立
export const Ok = () => <StatusBadge status="ok" />;
export const Warn = () => <StatusBadge status="warn" />;
export const Alert = () => <StatusBadge status="alert" />;
export const Critical = () => <StatusBadge status="critical" />;
export const Pulse = () => <StatusBadge status="alert" pulse />;

// ❌ DON'T — 一个 story 塞所有
export const AllStates = () => (
  <>
    <StatusBadge status="ok" />
    <StatusBadge status="warn" />
    <StatusBadge status="alert" />
  </>
);
```

**理由**：一个 export = 一个 Story ID = 一个可 URL 直达的截图目标。视觉回归时能针对某个 variant 单独 diff。

### R5：**必须用 mock generator，不能内联假数据**

```tsx
// ✅ DO
import { faker } from '@faker-js/faker';
import { genApmService } from '@/mocks/generators/apm';

faker.seed(1);  // Story 里锁定种子，保证每次 render 相同

const okService = genApmService({ error_rate_pct: 0.5 });
const alertService = genApmService({ error_rate_pct: 12 });

export const Ok    = () => <ServiceRow service={okService} />;
export const Alert = () => <ServiceRow service={alertService} />;

// ❌ DON'T
export const Ok = () => (
  <ServiceRow service={{ service_name: 'foo', request_count: 100, error_count: 1, ... }} />
);
```

**理由**：类型漂移能被 TypeScript 捕获；数据形状和 mocks/handlers 一致。

### R6：**图表 / 时序数据的 Story 用**`useMemo`**锁值**

```tsx
// ✅ DO
import { useMemo } from 'react';
faker.seed(2);

export const MultiSeries = () => {
  const series = useMemo(() => [
    { name: 'p50', data: genTimeSeries(60) },
    { name: 'p95', data: genTimeSeries(60) },
    { name: 'p99', data: genTimeSeries(60) },
  ], []);
  return <TimeSeriesChart series={series} />;
};
```

**理由**：不 useMemo 每次 render 都生成新数组，图表会闪。

---

## 目录约定

```
frontend/
├── .ladle/
│   └── config.mjs                    ← Ladle 配置
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── StatusBadge.stories.tsx     ← ✅
│   │   │   ├── Badge.tsx
│   │   │   ├── Badge.stories.tsx
│   │   │   └── ...
│   │   ├── MetricCard/
│   │   │   ├── index.tsx
│   │   │   ├── MetricCard.stories.tsx      ← ✅
│   │   │   └── MetricCard.types.ts
│   │   └── apm/
│   │       ├── ServicesTable.tsx
│   │       ├── ServicesTable.stories.tsx   ← ✅
│   │       └── ...
│   └── pages/
│       └── APM.tsx                          ← 页面不写 story
```

---

## Ladle 配置

**安装**：
```bash
cd frontend
pnpm add -D @ladle/react
```

**package.json 加脚本**：
```json
{
  "scripts": {
    "story": "ladle serve",
    "story:build": "ladle build",
    "story:test": "ladle preview"
  }
}
```

**`frontend/.ladle/config.mjs`**：
```javascript
export default {
  stories: 'src/**/*.stories.{ts,tsx,js,jsx,mdx}',
  addons: {
    theme: {
      enabled: true,
      defaultState: 'dark',        // 默认深色，和产品主题一致
    },
    width: {
      enabled: true,
      options: {
        xsmall: 375,
        small: 640,
        medium: 1024,
        large: 1440,
        xlarge: 1920,
      },
      defaultState: 1440,
    },
    rtl: { enabled: false },
    a11y: { enabled: true },       // 无障碍检查
  },
  outDir: 'build',
};
```

**`frontend/.ladle/components.tsx`**（全局装饰器）：
```tsx
import '../src/styles/tokens.css';
import '../src/index.css';
import type { GlobalProvider } from '@ladle/react';
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../src/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

export const Provider: GlobalProvider = ({ children, globalState }) => {
  // 主题切换：Ladle theme addon 传的 'light' | 'dark'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', globalState.theme === 'dark');
  }, [globalState.theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <div className="p-6 bg-bg-base min-h-screen">
          {children}
        </div>
      </I18nextProvider>
    </QueryClientProvider>
  );
};
```

---

## Story 模板

### 模板 A：原语（Ui Primitives）

```tsx
// src/components/ui/StatusBadge.stories.tsx
import type { Story } from '@ladle/react';
import { StatusBadge, type StatusBadgeProps } from './StatusBadge';

/** meta */
export default {
  title: 'UI/StatusBadge',
};

export const Ok:       Story = () => <StatusBadge status="ok" />;
export const Warn:     Story = () => <StatusBadge status="warn" />;
export const Alert:    Story = () => <StatusBadge status="alert" />;
export const Critical: Story = () => <StatusBadge status="critical" />;
export const NoData:   Story = () => <StatusBadge status="no-data" />;
export const Pulse:    Story = () => <StatusBadge status="alert" pulse />;
export const WithLabel:Story = () => <StatusBadge status="ok" label="Healthy" />;

/** 允许 args 用于测试互动 */
export const Interactive: Story<StatusBadgeProps> = (args) => <StatusBadge {...args} />;
Interactive.args = {
  status: 'ok',
  label: 'Change me in the panel',
  pulse: false,
};
Interactive.argTypes = {
  status: { control: { type: 'select' }, options: ['ok', 'warn', 'alert', 'critical', 'no-data'] },
  pulse:  { control: { type: 'boolean' } },
};
```

### 模板 B：业务组件（有数据、有三态）

```tsx
// src/components/MetricCard/MetricCard.stories.tsx
import type { Story } from '@ladle/react';
import { useMemo } from 'react';
import { faker } from '@faker-js/faker';
import { MetricCard } from './';
import { genTimeSeries } from '@/mocks/generators/shared';

export default { title: 'Business/MetricCard' };

faker.seed(1);

// ── 三态 ───────────────────────────────────────────
export const Default: Story = () => (
  <MetricCard title="Requests" value={12_345} unit="req/s" delta={5.2} trend="up" />
);

export const Loading: Story = () => (
  <MetricCard title="Requests" value={0} loading />
);

export const Empty: Story = () => (
  <MetricCard title="Requests" value={0} />
);

export const Error_: Story = () => (
  <MetricCard title="Requests" value={0} error={new Error('Failed to load')} />
);

// ── Variants ──────────────────────────────────────
export const StatusOk:       Story = () => <MetricCard title="RPS" value={12345} delta={5.2} trend="up"   status="ok" />;
export const StatusWarn:     Story = () => <MetricCard title="RPS" value={12345} delta={-2.1} trend="down" status="warn" />;
export const StatusCritical: Story = () => <MetricCard title="Errors" value="3.8" unit="%" delta={12} trend="up" status="critical" />;

// ── 带 Sparkline ──────────────────────────────────
export const WithSparkline: Story = () => {
  const sparkline = useMemo(() => genTimeSeries(30).map((p) => p.value), []);
  return <MetricCard title="P95 Latency" value={124} unit="ms" delta={-8.3} trend="down" sparkline={sparkline} />;
};

// ── 网格布局（真实业务场景）────────────────────────
export const Grid4Up: Story = () => {
  return (
    <div className="grid grid-cols-4 gap-4 w-full max-w-6xl">
      <MetricCard title="Services" value={24} status="ok" />
      <MetricCard title="Error Rate" value="0.42" unit="%" delta={-0.1} trend="down" status="ok" />
      <MetricCard title="Requests" value={1_234_567} unit="/hr" delta={12.3} trend="up" status="ok" />
      <MetricCard title="P95" value={124} unit="ms" delta={5.2} trend="up" status="warn" />
    </div>
  );
};
```

### 模板 C：需要 React Query 的组件

```tsx
// src/components/apm/ServicesTable.stories.tsx
import type { Story } from '@ladle/react';
import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw';
import { useEffect, useState } from 'react';
import { ServicesTable } from './ServicesTable';
import { genApmService } from '@/mocks/generators/apm';

export default { title: 'APM/ServicesTable' };

// 每个 Story 独立起 MSW handler
function useMockWorker(handler: any) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const worker = setupWorker(handler);
    worker.start({ quiet: true }).then(() => setReady(true));
    return () => worker.stop();
  }, [handler]);
  return ready;
}

export const HappyPath: Story = () => {
  const ready = useMockWorker(
    http.get('/api/v1/apm/services', () =>
      HttpResponse.json({ services: Array.from({ length: 24 }, genApmService) })
    )
  );
  return ready ? <ServicesTable /> : null;
};

export const OneCriticalService: Story = () => {
  const ready = useMockWorker(
    http.get('/api/v1/apm/services', () =>
      HttpResponse.json({
        services: [
          genApmService({ error_rate_pct: 15, service_name: 'billing-svc' }),
          ...Array.from({ length: 20 }, genApmService),
        ],
      })
    )
  );
  return ready ? <ServicesTable /> : null;
};

export const SlowLoading: Story = () => {
  const ready = useMockWorker(
    http.get('/api/v1/apm/services', async () => {
      await new Promise((r) => setTimeout(r, 3000));
      return HttpResponse.json({ services: [] });
    })
  );
  return ready ? <ServicesTable /> : null;
};

export const EmptyResult: Story = () => {
  const ready = useMockWorker(
    http.get('/api/v1/apm/services', () => HttpResponse.json({ services: [] }))
  );
  return ready ? <ServicesTable /> : null;
};

export const ServerError: Story = () => {
  const ready = useMockWorker(
    http.get('/api/v1/apm/services', () =>
      new HttpResponse('Server error', { status: 500 })
    )
  );
  return ready ? <ServicesTable /> : null;
};
```

### 模板 D：图表组件

```tsx
// src/components/charts/TimeSeriesChart.stories.tsx
import type { Story } from '@ladle/react';
import { useMemo } from 'react';
import { faker } from '@faker-js/faker';
import { TimeSeriesChart } from './TimeSeriesChart';
import { genTimeSeries } from '@/mocks/generators/shared';

export default { title: 'Charts/TimeSeriesChart' };

faker.seed(3);

export const SingleSeries: Story = () => {
  const series = useMemo(() => [{ name: 'CPU', data: genTimeSeries(60) }], []);
  return <div className="w-full h-80"><TimeSeriesChart series={series} /></div>;
};

export const MultiSeries: Story = () => {
  const series = useMemo(() => [
    { name: 'p50', data: genTimeSeries(60, 30) },
    { name: 'p95', data: genTimeSeries(60, 100) },
    { name: 'p99', data: genTimeSeries(60, 300) },
  ], []);
  return <div className="w-full h-80"><TimeSeriesChart series={series} /></div>;
};

export const Stacked: Story = () => {
  const series = useMemo(() => [
    { name: 'us-east', data: genTimeSeries(60, 20) },
    { name: 'us-west', data: genTimeSeries(60, 30) },
    { name: 'eu-central', data: genTimeSeries(60, 25) },
  ], []);
  return <div className="w-full h-80"><TimeSeriesChart series={series} stacked /></div>;
};

export const Empty: Story = () => (
  <div className="w-full h-80"><TimeSeriesChart series={[]} /></div>
);

export const SinglePoint: Story = () => {
  const series = useMemo(() => [{ name: 'X', data: [{ ts: new Date().toISOString(), value: 42 }] }], []);
  return <div className="w-full h-80"><TimeSeriesChart series={series} /></div>;
};
```

---

## Story 命名规范

**Story ID = 文件路径 + export 名称**（Ladle 自动生成）：

```
src/components/ui/StatusBadge.stories.tsx  →  ui-statusbadge
  export const Ok        → ui-statusbadge--ok
  export const Warn      → ui-statusbadge--warn
```

**export 命名**：
- 三态：`Default` `Loading` `Empty` `Error_` （`Error` 是 JS 保留词，用下划线）
- 变体：直接语义名 `Ok` `Warn` `Alert` `Critical`
- 交互：`Interactive`
- 布局：`Grid4Up` `Grid2x2` `WithSidebar`
- 数据场景：`HappyPath` `OneCriticalService` `EmptyResult` `SlowLoading` `ServerError`

**title 分组**（在 `default export` 里）：
```typescript
export default {
  title: 'UI/StatusBadge',        // UI/ 原语
  title: 'Business/MetricCard',   // Business/ 业务组件
  title: 'APM/ServicesTable',     // 按 domain
  title: 'Charts/TimeSeries',     // Charts/ 图表
  title: 'Layout/Sidebar',        // Layout/ 布局
};
```

---

## 视觉回归工作流

**目标**：Story 的截图 vs Datadog 参考图，pixel diff。

### Setup

```bash
cd datadog-capture
# scripts/story-visual-regress.mjs（新增）
```

### 脚本骨架

```javascript
// datadog-capture/scripts/story-visual-regress.mjs
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';

const LADLE = 'http://localhost:61000';  // Ladle 默认端口
const REFS  = './outputs/screenshots/components';
const OUT   = './outputs/parity/components';

// 映射：story ID → 参考图
const MAP = {
  'business-metriccard--default':    'metric-card-default.png',
  'business-metriccard--statusok':   'metric-card-ok.png',
  'business-metriccard--statuswarn': 'metric-card-warn.png',
  'ui-statusbadge--ok':              'status-badge-ok.png',
  // ...
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const [storyId, refFile] of Object.entries(MAP)) {
  const url = `${LADLE}/?story=${storyId}&mode=preview`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const mine = await page.screenshot();

  const ref = PNG.sync.read(fs.readFileSync(`${REFS}/${refFile}`));
  const minePng = PNG.sync.read(mine);
  const w = Math.min(ref.width, minePng.width);
  const h = Math.min(ref.height, minePng.height);
  const diff = new PNG({ width: w, height: h });
  const count = pixelmatch(ref.data, minePng.data, diff.data, w, h, { threshold: 0.15 });
  const pct = (count / (w * h)) * 100;

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/${storyId}.mine.png`, mine);
  fs.writeFileSync(`${OUT}/${storyId}.diff.png`, PNG.sync.write(diff));

  console.log(`${pct < 15 ? '✅' : '❌'} ${storyId}  diff=${pct.toFixed(2)}%`);
}

await browser.close();
```

**用法**：
```bash
# 起 Ladle
cd frontend && pnpm story &

# 跑对比
cd datadog-capture && node scripts/story-visual-regress.mjs
```

---

## 反模式

### 反模式 1：Story 里做数据获取

```tsx
// ❌
export const Default = () => {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/x').then(r => r.json()).then(setData); }, []);
  return data ? <Component data={data} /> : <Skeleton />;
};
```

**问题**：Story 依赖真实网络，脆弱、慢、非确定性。

**正确**：用 MSW（模板 C）或直接传 mock 数据。

### 反模式 2：Story 之间共享 state

```tsx
// ❌
let sharedCount = 0;
export const First = () => { sharedCount++; return <Counter n={sharedCount} />; };
```

**问题**：Story ID 应该是纯的，每次访问一样。

### 反模式 3：Story 里直接改 DOM

```tsx
// ❌
export const WithScroll = () => {
  document.body.style.overflow = 'hidden';  // ← 会污染下一个 Story
  return <Modal />;
};
```

**正确**：用 `useEffect` + cleanup。

---

## 检查清单

写 Story 时：

- [ ] 文件位置：和组件同目录，`.stories.tsx` 后缀
- [ ] `default export` 有 `title`
- [ ] 每个 variant 独立 `export const`
- [ ] 业务组件覆盖 Default / Loading / Empty / Error 四态
- [ ] 数据来自 `mocks/generators/`
- [ ] `faker.seed(...)` 已设置
- [ ] 图表数据用 `useMemo` 锁定
- [ ] 需要 API 的 Story 用 MSW 拦截
- [ ] Story 不直接修改 DOM 或全局 state
