# 组件开发规范

面向：新增组件、重构现有组件的开发者（或 AI agent）。

---

## 1. 何时用什么

### Ant Design vs 自研 UI vs Tailwind 原生

| 场景 | 用法 | 理由 |
|---|---|---|
| 复杂表单（多字段校验、动态字段）| **antd `<Form>`** | 校验、联动、无障碍已解决 |
| 弹窗 / 抽屉 | **antd `<Modal> <Drawer>`** | 已有深色 override，直接可用 |
| 消息 / 通知 | **antd `message` / `notification`** | 现成的 |
| 数据表格（可排序、可筛选、大量行）| **antd `<Table>`** 或**自研 `<Table>`** | 二选一，别混用 |
| **原语（Badge、Button、Card、Divider）** | **自研 `src/components/ui/`** | 完全走 Tailwind class，样式可控 |
| **业务组件**（MetricCard、StatusBadge 等）| **自研，在 `src/components/`** | 见下面 §2 |
| 布局（Grid、Flex、间距）| **Tailwind 原生 class** | 不引入组件抽象 |

### 决策树

```
需要新组件？
  ├─ 是纯布局？ → Tailwind class 拼
  ├─ 是原语（Badge、Button）？ → src/components/ui/
  ├─ 是业务组件（MetricCard、AlertRow）？ → src/components/
  ├─ 是复杂交互（Form、Modal）？ → antd 优先，样式覆盖走 antd-overrides.css
  └─ 是页面？ → src/pages/
```

---

## 2. 组件文件结构

### 单文件组件（推荐用于简单原语）

```
src/components/ui/StatusBadge.tsx
```

### 组件夹（复杂业务组件）

```
src/components/MetricCard/
├── index.tsx           # 主组件
├── MetricCard.types.ts # Props / 内部类型（超过 30 行就拆出）
├── MetricCard.utils.ts # 纯函数（超过 3 个就拆）
└── README.md           # 可选，用途/变体/坑
```

**规模阈值**：单文件 ≤ 300 行；超过就必须拆 `types` / `utils`。

---

## 3. 编码规则（DO / DON'T）

### 颜色

```tsx
// ✅ DO
<div className="bg-bg-elevated text-fg-primary border border-border">
  <span className="text-accent-danger">Error</span>
</div>

// ❌ DON'T
<div style={{ backgroundColor: '#292e39', color: '#fff' }}>
<div style={{ color: T.brand.error }}>       // 绕过 Tailwind，主题切不动
<div className="text-red-500">               // Tailwind 默认色，不走 token
<div className="text-[#eb364b]">             // hardcoded
```

### 尺寸 / 间距

```tsx
// ✅ DO — 用 4/8 倍数（Tailwind 阶梯）
<div className="p-4 gap-2 mt-6">

// ❌ DON'T — 任意值
<div className="p-[15px] gap-[7px]">
<div style={{ padding: 15, gap: 7 }}>
```

### 状态色（动态）

```tsx
// ✅ DO
type Severity = 'ok' | 'warn' | 'alert' | 'critical';
const bgClass = {
  ok:       'bg-severity-ok',
  warn:     'bg-severity-warn',
  alert:    'bg-severity-alert',
  critical: 'bg-severity-critical',
}[severity];
<span className={clsx('w-2 h-2 rounded-full', bgClass)} />

// ❌ DON'T
const color = severity === 'alert' ? '#eb364b' : '#41c464';
<span style={{ backgroundColor: color }} />
```

### Client 组件（Vite SPA 都是 client，不需要 'use client'）

Vite 项目**没有** SSR 边界，所有组件都可以用 hooks。不要复制 Next.js 的 `'use client'` 到这里。

### Props 类型

```tsx
// ✅ DO — 用 type 别用 interface（团队一致性）
export type MetricCardProps = {
  title: string;
  value: number | string;
  delta?: number;
  status?: 'ok' | 'warn' | 'alert';
};

export default function MetricCard(props: MetricCardProps) { ... }

// ❌ DON'T — any
export default function MetricCard(props: any) { ... }
```

### 事件命名

```tsx
// ✅ DO — 用 on<Verb> 前缀
onClick, onSelect, onRemove, onRangeChange

// ❌ DON'T
handleClick, click, changeRange
```

### 数据获取

```tsx
// ✅ DO — 用 React Query（项目已经装了）
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['apm-services', range],
  queryFn: () => api.getApmServices({ start: range.from, end: range.to }),
  staleTime: 30_000,
});

// ❌ DON'T — 手动 useEffect + fetch
useEffect(() => {
  fetch('/api/v1/apm/services').then(...);  // 没有缓存、没有并发去重、没有错误处理
}, []);
```

### 三态处理（loading / empty / error）

```tsx
// ✅ DO — 明确处理
if (isLoading) return <TableSkeleton rows={6} />;
if (error) return <EmptyState variant="error" message={error.message} onRetry={refetch} />;
if (!data?.length) return <EmptyState variant="empty" message="No services in this time range" />;
return <ServicesTable data={data} />;

// ❌ DON'T — 假设永远有数据
return <ServicesTable data={data} />;  // 加载中会崩，空数据会崩
```

---

## 4. 组件模板（复制即用）

### 4.1 原语模板

```tsx
// src/components/ui/StatusBadge.tsx
import { clsx } from 'clsx';

export type StatusBadgeProps = {
  status: 'ok' | 'warn' | 'alert' | 'critical' | 'no-data';
  label?: string;
  pulse?: boolean;
  className?: string;
};

const DOT_COLOR: Record<StatusBadgeProps['status'], string> = {
  ok:        'bg-severity-ok',
  warn:      'bg-severity-warn',
  alert:     'bg-severity-alert',
  critical:  'bg-severity-critical',
  'no-data': 'bg-severity-no-data',
};

const LABEL: Record<StatusBadgeProps['status'], string> = {
  ok:        'OK',
  warn:      'Warn',
  alert:     'Alert',
  critical:  'Critical',
  'no-data': 'No Data',
};

export function StatusBadge({ status, label, pulse, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs text-fg-secondary',
        className
      )}
    >
      <span
        className={clsx(
          'inline-block w-2 h-2 rounded-full',
          DOT_COLOR[status],
          pulse && 'animate-pulse'
        )}
      />
      {label ?? LABEL[status]}
    </span>
  );
}
```

### 4.2 业务组件模板（含数据 + 三态）

```tsx
// src/components/MetricCard/index.tsx
import { clsx } from 'clsx';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { MetricCardProps } from './MetricCard.types';
import { formatValue, formatDelta } from './MetricCard.utils';

const ACCENT_BAR: Record<NonNullable<MetricCardProps['status']>, string> = {
  ok:       'bg-severity-ok',
  warn:     'bg-severity-warn',
  critical: 'bg-severity-critical',
};

export function MetricCard({
  title, value, unit, delta, trend = 'flat', status = 'ok',
  loading, error,
}: MetricCardProps) {
  if (loading) {
    return <div className="skeleton h-24 rounded-md" />;
  }
  if (error) {
    return (
      <div className="rounded-md border border-border bg-bg-elevated p-4 text-sm text-fg-tertiary">
        Failed to load
      </div>
    );
  }

  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const trendClass = clsx({
    'text-severity-ok':    trend === 'up',
    'text-severity-alert': trend === 'down',
    'text-fg-tertiary':    trend === 'flat',
  });

  return (
    <div className="relative rounded-md border border-border bg-bg-elevated p-4">
      <div className={clsx('absolute inset-y-0 left-0 w-0.5 rounded-l-md', ACCENT_BAR[status])} />
      <div className="text-xs uppercase tracking-wide text-fg-tertiary">{title}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tabular-nums text-fg-primary">
          {formatValue(value)}
        </span>
        {unit && <span className="text-sm text-fg-tertiary">{unit}</span>}
      </div>
      {delta != null && (
        <div className={clsx('mt-1 flex items-center gap-1 text-xs', trendClass)}>
          <TrendIcon className="w-3 h-3" />
          <span className="tabular-nums">{formatDelta(delta)}</span>
        </div>
      )}
    </div>
  );
}
```

```typescript
// src/components/MetricCard/MetricCard.types.ts
export type MetricCardProps = {
  title: string;
  value: number | string;
  unit?: string;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  status?: 'ok' | 'warn' | 'critical';
  loading?: boolean;
  error?: Error | null;
};
```

```typescript
// src/components/MetricCard/MetricCard.utils.ts
export function formatValue(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

export function formatDelta(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
```

---

## 5. ECharts 组件规范

### 5.1 别在页面里堆 `option`

```tsx
// ❌ DON'T
export function ApmPage() {
  const option = {
    xAxis: { ... 20 行 ... },
    yAxis: { ... 20 行 ... },
    series: [{ ... 50 行 ... }],
  };
  return <ReactECharts option={option} />;
}
```

### 5.2 拆到 `charts/` 子目录

```
src/components/charts/
├── TimeSeriesChart.tsx      # 通用时序图
├── HeatmapChart.tsx
├── TopologyChart.tsx
└── shared/
    ├── theme.ts             # ECharts 主题（网格、tooltip、字体）
    └── options.ts           # 通用 option 生成器
```

```tsx
// src/components/charts/shared/theme.ts
import { chartTheme } from '@/lib/tokens';

export function makeChartOption(overrides: any = {}) {
  return {
    grid: { top: 10, right: 10, bottom: 30, left: 40, ...overrides.grid },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: chartTheme.gridColor() } },
      axisLabel: { color: chartTheme.axisColor(), fontSize: 11 },
      ...overrides.xAxis,
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: chartTheme.gridColor(), type: 'dashed' } },
      axisLabel: { color: chartTheme.axisColor(), fontSize: 11 },
      ...overrides.yAxis,
    },
    tooltip: {
      backgroundColor: chartTheme.tooltipBg(),
      borderColor: chartTheme.tooltipBorder(),
      textStyle: { color: 'var(--fg-primary)', fontSize: 12 },
      ...overrides.tooltip,
    },
    ...overrides,
  };
}
```

---

## 6. 提交前自查清单

```
[ ] 无 style={{ color / background / border }} 的 hardcoded 值
[ ] 无 text-red-500 / bg-slate-200 等 Tailwind 默认色
[ ] 无 #hex 字面量（除 tokens.css / tokens.ts）
[ ] Props 有 TypeScript 类型
[ ] 数据获取用 useQuery，处理 loading/empty/error 三态
[ ] 单文件 < 300 行
[ ] 复杂组件拆 index.tsx + types + utils 三个文件
[ ] 用了 antd 的组件不覆盖内部 class（除非在 antd-overrides.css）
[ ] i18n 文本用 t('key')，不 hardcode 中文
```

---

## 7. 常见反模式（真实代码示例）

### 反模式 1：在 JSX 里做数据聚合

```tsx
// ❌ 页面里
{services.filter(s => s.error > 5).sort((a,b) => b.rps - a.rps).slice(0, 10).map(...)}

// ✅ 抽到 useMemo
const criticalServices = useMemo(
  () => services.filter(s => s.error > 5).sort((a,b) => b.rps - a.rps).slice(0, 10),
  [services]
);
{criticalServices.map(...)}
```

### 反模式 2：条件渲染嵌套 3 层

```tsx
// ❌ 4 层三元
{loading ? <Skel/> : error ? <Err/> : data ? data.length ? <Table/> : <Empty/> : null}

// ✅ 早退
if (loading) return <Skel/>;
if (error) return <Err/>;
if (!data?.length) return <Empty/>;
return <Table data={data}/>;
```

### 反模式 3：inline 定义 style 对象

```tsx
// ❌ 每次渲染新对象，破坏 React memo
<div style={{ padding: 16, background: '#fff' }} />

// ✅ Tailwind
<div className="p-4 bg-bg-elevated" />
```

---

## 8. 何时用 `clsx` vs 字符串拼接

```tsx
// ✅ 用 clsx（条件多 or 复杂）
<div className={clsx(
  'flex items-center gap-2',
  isActive && 'bg-accent-primary/10 text-accent-primary',
  size === 'lg' && 'text-base',
  className, // 允许外部覆盖
)} />

// ✅ 字符串（无条件）
<div className="flex items-center gap-2" />

// ❌ 拼接
<div className={`flex items-center ${isActive ? 'bg-blue-500' : ''}`} />
```
