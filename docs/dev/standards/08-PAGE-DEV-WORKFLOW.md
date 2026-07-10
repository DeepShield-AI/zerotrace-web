# 页面开发流程（Datadog 视觉对齐版）

**目标**：让任意 agent / 开发者按同一个套路做出**和 Datadog 基本一致**的页面。

**成功标准**：新页面上线后，把它和 Datadog 同类页面**并排截图**，视觉差异小于 15%（用 pixelmatch 度量）。

**核心原则**：**不要凭空想象 UI**。所有决策都从**参考图 + 已有组件**推导，禁止自由发挥。

---

## 6 个 Phase 全景

```
Phase 1  参考对齐     ── 拉截图，标注区块
   ↓
Phase 2  组件拆解     ── 列组件清单，识别已有 vs 新建
   ↓
Phase 3  Mock 契约    ── 定义 API + 数据形状
   ↓
Phase 4  Story 先行   ── 组件在 Storybook 里独立跑通
   ↓
Phase 5  集成落地     ── 拼装页面、挂路由、加 i18n
   ↓
Phase 6  视觉回归     ── Playwright 截图对比 Datadog 参考
```

**总工时**：一个中等复杂度页面（如 APM Services 列表）约 6-10 小时。

---

## Phase 1：参考对齐（30-60 分钟）

### 任务

1. **确认目标页面**。例如："做 APM Services 列表页"。
2. **拉参考图**：
   ```bash
   ls datadog-capture/outputs/screenshots/apm-*
   ```
   如果缺，用 datadog-capture 抓一张（见 [06-PIPELINE-SALVAGE.md](./06-PIPELINE-SALVAGE.md)）。
3. **在 `docs/dev/standards/pages/<page-name>.md` 建页面档案**（新目录，示例见 [附录 A](#附录-a页面档案模板)）。
4. **在参考图上手动"划分区"**：截图打开，脑内切成 5-10 个矩形区块，命名如：
   - `topbar`（顶部工具栏）
   - `filter-bar`（过滤条）
   - `metric-strip`（顶部 KPI 卡片行）
   - `main-table`（主数据表）
   - `right-panel`（右侧详情，可选）

### 产出

`docs/dev/standards/pages/apm-services.md`：

```markdown
# APM Services 列表页

**路径**：`/apm/services`
**参考图**：`datadog-capture/outputs/screenshots/apm-services.png`
**Datadog 原始 URL**：`https://app.datadoghq.com/apm/services`

## 区块划分

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|
| 1 | topbar | 顶部 48px | 面包屑 · 时间选择器 · 环境切换 · 设置菜单 |
| 2 | filter-bar | topbar 下 40px | search input · env pill · service pill · custom facet |
| 3 | metric-strip | 主内容顶部 | 4 张 KPI 卡（总服务数、错误率、请求速率、p95）|
| 4 | main-table | 剩余空间 | 服务表格：服务名、请求数、错误率、延迟、依赖数 |
| 5 | right-panel | 右侧固定 320px（可折叠）| 选中服务的快速详情 |
```

### 检查项

- [ ] 参考图存在且清晰（分辨率 ≥ 1440 宽）
- [ ] 区块划分明确，每块有名字
- [ ] 页面档案落到 `docs/dev/standards/pages/`

---

## Phase 2：组件拆解（30-60 分钟）

### 任务

对每个区块，列出**用到的组件**，标注**已有 / 需新建 / 需改造**。

### 产出（追加到页面档案）

```markdown
## 组件清单

| 区块 | 组件 | 状态 | 位置 |
|---|---|---|---|
| topbar | `<PageBreadcrumbs>` | ✅ 已有 | `src/components/ui/Breadcrumbs.tsx` |
| topbar | `<TimeRangePicker>` | ✅ 已有 | `src/components/TimeRangePicker.tsx` |
| topbar | `<EnvSwitcher>` | ⚠️ 需新建 | 计划 `src/components/ui/EnvSwitcher.tsx` |
| filter-bar | `<SearchInput>` | ✅ 已有 | `src/components/ui/Table.tsx` (export) |
| filter-bar | `<FilterChip>` | ✅ 已有 | `src/components/ui/Filter.tsx` |
| filter-bar | `<FacetPanel>` | ✅ 已有 | `src/components/FacetPanel.tsx` |
| metric-strip | `<MetricCard>` × 4 | ⚠️ 需改造 | 现有实现在 pages 里，抽到 `src/components/MetricCard/` |
| main-table | `<ServicesTable>` | ⚠️ 需新建 | `src/components/apm/ServicesTable.tsx` |
| main-table | `<StatusDot>` | ✅ 已有 | `src/components/ui/Indicators.tsx` |
| main-table | `<Sparkline>` | ⚠️ 需新建 | `src/components/charts/Sparkline.tsx` |
| right-panel | `<ServiceQuickView>` | ⚠️ 需新建 | `src/components/apm/ServiceQuickView.tsx` |
```

### 决策规则

**已有能直接用**：
- 组件名、Props 已能覆盖需求 → ✅
- 只是文案不同 → ✅（通过 i18n 或 props 传入）

**需改造**：
- 需要新 variant / 新 prop → 在原地增
- 需要调用不同数据 → 保持组件纯，数据在外层传

**需新建**：
- 领域概念不同（如 `ServicesTable` vs 通用 `Table`）→ 新建业务组件
- 复用性高（如 `Sparkline`）→ 新建原语

**慎重决定**：能不能在自研 UI 里做（Tailwind class）？还是必须用 antd？规则见 [04-COMPONENT-STANDARDS.md](./04-COMPONENT-STANDARDS.md) §1。

### 检查项

- [ ] 每个区块都列了组件
- [ ] 每个组件标注了状态和位置
- [ ] 需新建/改造的组件数 ≤ 5（超过就说明拆解粗，或该拆成多个页面）

---

## Phase 3：Mock 契约（60-90 分钟）

### 任务

1. **找到 `api/client.ts` 里对应的 method**，读它的返回类型
2. **在 `mocks/handlers.ts` 加对应的 handler**（如果还没）
3. **在 `mocks/generators/` 加数据生成器**（见 [09-FAKER-CONVENTIONS.md](./09-FAKER-CONVENTIONS.md)）
4. **写 fixture**（可选）：如果需要一份稳定的种子数据用于视觉回归

### 产出

`frontend/src/mocks/generators/apm.ts` 新增：

```typescript
export function genApmService() {
  // ... 见 05-MOCK-DATA.md 里的完整示例
}
```

`frontend/src/mocks/handlers.ts` 新增：

```typescript
http.get(`${BASE}/apm/services`, () => 
  respond({ services: Array.from({ length: 24 }, genApmService) })
),
```

### 验证

```bash
cd frontend && pnpm dev:mock
curl http://localhost:5173/api/v1/apm/services | jq .services[0]
# 应返回一个 mock 服务对象
```

### 检查项

- [ ] 数据 shape 与 `src/api/types.ts` 里的 TypeScript 类型一致
- [ ] `faker.seed(...)` 已设置，每次 dev 数据稳定
- [ ] 时序数据（如 sparkline）用随机游走而非纯随机
- [ ] 有 `edge case` 覆盖（错误率 0、错误率 100%、无数据）

---

## Phase 4：Story 先行（2-3 小时）

**核心思想**：**先在 Storybook 里把每个组件调好**，再拼页面。避免"页面全拼好才发现某个组件不对"。

### 顺序

按组件依赖倒序：先做叶子（原语），再做业务组件。

```
1. Sparkline           ← 叶子
2. MetricCard          ← 用 Sparkline
3. EnvSwitcher         ← 独立
4. StatusDot           ← 已有
5. ServicesTable       ← 用上面所有
6. ServiceQuickView    ← 独立
7. (最后拼页面)
```

### 每个组件的循环

```
[1. 写/改组件 index.tsx]
        ↓
[2. 写 .stories.tsx（所有 variants）]
        ↓
[3. pnpm story 打开，肉眼对比参考图]
        ↓
[4. 差异 > 15% → 回 1；否则 → 下一个组件]
```

### Story 规范

见 [10-STORYBOOK-CONVENTIONS.md](./10-STORYBOOK-CONVENTIONS.md)。摘要：

- 文件名：`ComponentName.stories.tsx`（和组件同目录）
- 每个 variant 一个 `export const`
- 每个 story 都要有 `Default` `Loading` `Error` `Empty` 四态（业务组件必须）
- 用 `.decorators` 包裹主题切换、模拟不同 viewport

### 验证

- 打开 `pnpm story`，点击每个 story，视觉正常
- 装饰器切换深色主题，颜色正确
- Console 无 warning / error

### 检查项

- [ ] 每个新建/改造的组件都有 `.stories.tsx`
- [ ] 每个业务组件都有 loading / empty / error 三态 story
- [ ] 图表组件的 story 用 mock generator 产数据

---

## Phase 5：集成落地（1-2 小时）

现在所有组件已经在 Storybook 里独立跑通了。这一步就是**拼装**。

### 任务

#### 5.1 创建页面文件

```tsx
// src/pages/apm/Services.tsx
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { MetricCard } from '@/components/MetricCard';
import { ServicesTable } from '@/components/apm/ServicesTable';
import { FilterBar, EmptyState, TableSkeleton } from '@/components/ui';
import { TimeRangePicker, parseRange } from '@/components/TimeRangePicker';

export default function ApmServicesPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const range = parseRange(params.get('range') ?? '1h');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['apm-services', range],
    queryFn: () => api.getApmServices({ start: range.from, end: range.to }),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-4 p-6 bg-bg-base min-h-full">
      {/* topbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-fg-primary">{t('apm.services.title')}</h1>
        <TimeRangePicker />
      </div>

      {/* filter-bar */}
      <FilterBar>{/* ... */}</FilterBar>

      {/* metric-strip */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title={t('apm.metric.total_services')} value={data?.total ?? 0} />
        <MetricCard title={t('apm.metric.error_rate')} value={data?.error_rate_pct ?? 0} unit="%" status="warn" />
        <MetricCard title={t('apm.metric.rps')} value={data?.rps ?? 0} unit="req/s" />
        <MetricCard title={t('apm.metric.p95')} value={data?.p95_ms ?? 0} unit="ms" />
      </div>

      {/* main-table */}
      {isLoading ? (
        <TableSkeleton rows={12} />
      ) : error ? (
        <EmptyState variant="error" message={error.message} onRetry={refetch} />
      ) : !data?.services?.length ? (
        <EmptyState variant="empty" message={t('apm.services.empty')} />
      ) : (
        <ServicesTable services={data.services} />
      )}
    </div>
  );
}
```

#### 5.2 挂路由

```tsx
// src/App.tsx
<Route path="apm/services" element={<ApmServicesPage/>}/>
```

#### 5.3 SidebarNav 加入口

```tsx
// src/components/SidebarNav.tsx
{ path: '/apm/services', label: t('nav.apm.services'), icon: 'Boxes' },
```

#### 5.4 i18n 文案

```json
// src/i18n/locales/zh-CN.json
{
  "apm": {
    "services": {
      "title": "服务",
      "empty": "所选时间范围内暂无服务"
    },
    "metric": {
      "total_services": "服务总数",
      "error_rate": "错误率",
      "rps": "请求速率",
      "p95": "P95 延迟"
    }
  }
}

// src/i18n/locales/en-US.json
{
  "apm": {
    "services": {
      "title": "Services",
      "empty": "No services in the selected time range"
    },
    "metric": {
      "total_services": "Total Services",
      "error_rate": "Error Rate",
      "rps": "Requests/s",
      "p95": "P95 Latency"
    }
  }
}
```

### 检查项

- [ ] 页面文件 ≤ 500 行（超过就抽子组件）
- [ ] 用 `useQuery` 而不是 `useEffect + fetch`
- [ ] 三态（loading / empty / error）都处理
- [ ] 所有文案走 `t()`
- [ ] 所有颜色是 `bg-bg-*` / `text-fg-*` / `bg-accent-*` 系列
- [ ] `pnpm dev:mock` 能打开该页面

---

## Phase 6：视觉回归（30-60 分钟）

### 任务

1. 打开 `http://localhost:5173/apm/services`（走 mock 数据）
2. 用 Playwright 截图（脚本见下）
3. 与 `datadog-capture/outputs/screenshots/apm-services.png` 做 pixelmatch diff
4. 差异 > 15% → 分析差异原因，回 Phase 4 或 5 修
5. 差异 < 15% → 记录 diff 图到 `docs/dev/standards/pages/<name>.parity.png`

### 截图 + diff 脚本

`datadog-capture/scripts/parity-check.mjs`（在 M3 完成后已有基础脚本）：

```javascript
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';

const PAGE = 'http://localhost:5173/apm/services';
const REF = 'outputs/screenshots/apm-services.png';
const OUT_DIR = 'outputs/parity';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(PAGE, { waitUntil: 'networkidle' });
const mine = await page.screenshot({ fullPage: true });
fs.writeFileSync(`${OUT_DIR}/apm-services.mine.png`, mine);

const refPng = PNG.sync.read(fs.readFileSync(REF));
const minePng = PNG.sync.read(mine);
const w = Math.min(refPng.width, minePng.width);
const h = Math.min(refPng.height, minePng.height);
const diff = new PNG({ width: w, height: h });
const count = pixelmatch(refPng.data, minePng.data, diff.data, w, h, { threshold: 0.15 });
const pct = (count / (w * h)) * 100;

fs.writeFileSync(`${OUT_DIR}/apm-services.diff.png`, PNG.sync.write(diff));
console.log(`Diff: ${pct.toFixed(2)}%  ${pct < 15 ? '✅' : '❌'}`);

await browser.close();
```

### 差异归因

看 `diff.png`（红色区域是差异所在）：

| 差异类型 | 原因 | 修法 |
|---|---|---|
| 大片色块偏移 | Token 值不对 | 改 `tokens.css` 里对应变量 |
| 局部字号错 | Tailwind class 用错 | 换 `text-h4` `text-h5` 等 |
| 布局错位 | Grid / Flex 结构不对 | 对照参考图重新排布 |
| 缺组件 | 忘了实现 | 补 |
| 数据条数不同 | mock 数据太多/太少 | 调 `Array.from({ length: N })` 里 N |
| 字体不同 | 参考图用了 SF Pro，本地用 Geist | 已知问题，忽略字形微差 |

**不追求 100% 像素级**：字体渲染、抗锯齿在不同 OS 下天然有差异。目标是**布局结构 + 色板 + 排版层级**一致。

### 检查项

- [ ] 差异率 < 15%
- [ ] 深色主题下也做一次对比（Datadog 深色截图 vs 本项目深色）
- [ ] 关键结构（列数、卡片数、按钮位置）无缺失
- [ ] diff 图和 mine 图存到 `docs/dev/standards/pages/<name>-parity/`

---

## 完整示例：APM Services 页面

**结束状态**：

```
frontend/src/
├── pages/apm/Services.tsx                    ← 新
├── components/apm/
│   ├── ServicesTable.tsx                     ← 新
│   ├── ServicesTable.stories.tsx             ← 新
│   ├── ServiceQuickView.tsx                  ← 新
│   └── ServiceQuickView.stories.tsx          ← 新
├── components/MetricCard/
│   ├── index.tsx                             ← 改造（从 pages 抽离）
│   ├── MetricCard.types.ts                   ← 新
│   ├── MetricCard.utils.ts                   ← 新
│   └── MetricCard.stories.tsx                ← 新
├── components/charts/Sparkline.tsx           ← 新
├── components/charts/Sparkline.stories.tsx   ← 新
├── components/ui/EnvSwitcher.tsx             ← 新
├── components/ui/EnvSwitcher.stories.tsx     ← 新
├── mocks/generators/apm.ts                   ← 加 genApmService
├── mocks/handlers.ts                         ← 加 /apm/services handler
├── i18n/locales/zh-CN.json                   ← 加 apm.services.* keys
└── i18n/locales/en-US.json                   ← 加 apm.services.* keys

docs/dev/standards/pages/
├── apm-services.md                           ← 页面档案
└── apm-services-parity/
    ├── mine.png                              ← 本项目截图
    ├── ref.png                               ← Datadog 参考
    └── diff.png                              ← pixelmatch 差异图
```

---

## 附录 A：页面档案模板

放置：`docs/dev/standards/pages/<page-name>.md`

```markdown
# <页面中文名>（<Page English Name>）

**路径**：`/xxx/yyy`
**参考图**：`datadog-capture/outputs/screenshots/xxx-yyy.png`
**Datadog 原始 URL**：`https://app.datadoghq.com/xxx/yyy`
**估算工时**：X 小时

## 区块划分

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|

## 组件清单

| 区块 | 组件 | 状态 | 位置 | 备注 |
|---|---|---|---|---|

## 数据依赖

| API | 返回形状 | Mock generator |
|---|---|---|

## 交互

- 点击某行 → 打开右侧详情面板
- 搜索框输入 → debounce 300ms 后过滤
- 时间选择器改变 → 触发 useQuery 重取

## Known Deviations（与 Datadog 的有意差异）

- 我们没有 Watchdog 检测，右上角图标改成 Guardian
- ...

## Parity Report

Diff: X.X%（阈值 15%）
最新时间：YYYY-MM-DD
```

---

## 附录 B：agent 执行 checklist（一页纸）

```
□ Phase 1: 参考图存在，页面档案已建
□ Phase 2: 组件清单每项状态明确（已有/改造/新建）
□ Phase 3: mock generator 已加，pnpm dev:mock 能返回数据
□ Phase 4: 每个组件有 .stories.tsx，story 里视觉正常
□ Phase 5: 页面文件 ≤ 500 行，useQuery 三态齐全，i18n 完整
□ Phase 6: parity diff < 15%，diff.png 存档
```

**任意一项 ❌ 就不能提 PR**。
