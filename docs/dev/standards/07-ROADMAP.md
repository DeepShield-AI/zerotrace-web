# 执行路线（给下一个 agent）

**读者**：在目标机器上执行的开发者或 AI agent（**没有** Claude CLI，用普通编辑器 + terminal）。

**目标**：一步一步落地 `docs/frontend-standards/00-06` 里描述的所有规范。

**原则**：每步做完都能 `pnpm dev` 起来；每步都能独立 commit / 回滚。

---

## 里程碑总览

```
M0. 环境准备           ← 半天
M1. Token 系统落地     ← 1 天
M2. Mock 数据层        ← 1 天
M3. 参考图重组         ← 半天
M4. Storybook 集成     ← 1 天（可选）
M5. 组件规范化（渐进） ← 持续
```

---

## M0. 环境准备（0.5 天）

### 任务

- [ ] 阅读 `docs/frontend-standards/00-06` 所有 doc（30 分钟）
- [ ] 在项目根跑一次 `pnpm install`（frontend 和根 backend 分别）
- [ ] 确认能启动 dev server：`cd frontend && pnpm dev`
- [ ] 确认能启动后端（可选，如果要联调）
- [ ] 熟悉现有代码：
  - [ ] 读 `frontend/src/App.tsx`
  - [ ] 读 `frontend/src/hooks/useTheme.tsx`
  - [ ] 读 `frontend/src/theme.ts`
  - [ ] 读 `frontend/src/index.css`
  - [ ] 读 1-2 个页面（`pages/APM.tsx`、`pages/Infrastructure.tsx`）

### 验收
- [ ] 能说出：项目为什么保持 Vite 不迁 Next.js
- [ ] 能说出：为什么不删 Ant Design
- [ ] 能说出：token 唯一真相源应该是哪个文件

---

## M1. Token 系统落地（1 天）

按 `docs/frontend-standards/03-MIGRATION-PLAYBOOK.md` 的 Phase 0-3 顺序执行。

### Step 1.1：拷贝新配置（30 分钟）

```bash
cd frontend

# 1. tokens.css 落地
mkdir -p src/styles
cp ../docs/frontend-standards/proposed-files/tokens.css src/styles/tokens.css

# 2. tokens.ts 落地（给 ECharts 用）
mkdir -p src/lib
cp ../docs/frontend-standards/proposed-files/tokens.ts src/lib/tokens.ts

# 3. tailwind config 替换（先备份）
mv tailwind.config.js tailwind.config.old.bak.js
cp ../docs/frontend-standards/proposed-files/tailwind.config.js tailwind.config.js

# 4. main.tsx 加 import
# 手动改：在 import './index.css' 上一行加：
# import './styles/tokens.css';
```

**验收**：
- [ ] `pnpm dev` 能起
- [ ] 页面视觉零变化（Tailwind config 里有 legacy 兼容层）
- [ ] Console 无红字

git commit: `chore: introduce tokens.css and new tailwind config with legacy layer`

### Step 1.2：主题切换机制（1 小时）

按 `03-MIGRATION-PLAYBOOK.md` Phase 1 改 `useTheme` hook。

**验收**：
- [ ] DevTools 里 `document.documentElement.classList.add('dark')` 立即切深色
- [ ] Sidebar / TopBar 里加了主题切换按钮
- [ ] 刷新后主题保持

git commit: `feat: theme toggle via CSS variables`

### Step 1.3：消灭 `theme.ts`（2-4 小时）

按 `03-MIGRATION-PLAYBOOK.md` Phase 2：

1. `grep -rn "from '../theme'" frontend/src/` 找所有引用
2. 逐个替换：`style={{ color: T.brand.error }}` → `className="text-accent-danger"`
3. 全部替换完毕后 `rm frontend/src/theme.ts`
4. 视觉对比：迁移前后每个页面截图（可选：用 Playwright）

**验收**：
- [ ] `grep -rn "from '../theme'"` 返回空
- [ ] `grep -rn "tokens\."` 返回空（除了 `src/lib/tokens.ts` 内部）
- [ ] 深色模式所有页面视觉正确

git commit: `refactor: replace theme.ts inline styles with Tailwind tokens`

### Step 1.4：清理 `index.css` hardcoded 色（1-2 小时）

按 `03-MIGRATION-PLAYBOOK.md` Phase 3。**抽 antd override 到独立文件**：

```bash
# 新建
touch frontend/src/styles/antd-overrides.css
touch frontend/src/styles/globals.css
```

- `index.css` 保留（或改名为 `globals.css`）只放 `@tailwind` 三行 + `@layer base/components`
- `antd-overrides.css` 放所有 `.dark .ant-*` 规则
- 在 `main.tsx` 里三个都 import

**验收**：
- [ ] `grep -nE '#[0-9a-fA-F]{3,6}\b' frontend/src/styles/*.css` 返回 0（除 tokens.css）
- [ ] 视觉零回归

git commit: `refactor: extract antd overrides, purge hardcoded hex from globals`

---

## M2. Mock 数据层（1 天）

按 `docs/frontend-standards/05-MOCK-DATA.md` 执行。

### Step 2.1：安装 MSW（15 分钟）

```bash
cd frontend
pnpm add -D msw
pnpm dlx msw init public/
```

### Step 2.2：创建 mocks 目录结构（30 分钟）

```bash
mkdir -p frontend/src/mocks/generators
touch frontend/src/mocks/browser.ts
touch frontend/src/mocks/handlers.ts
touch frontend/src/mocks/generators/{index,apm,infra,logs,metrics,monitors,billing,guardian}.ts
```

### Step 2.3：填充 generators（4-6 小时）

按 `05-MOCK-DATA.md` 里的示例写。每个 domain 至少覆盖：
- 主列表接口（`getServices`, `getHosts`, `getLogs`）
- 详情接口（`getServiceDetail`, `getTraceDetail`）
- 时序数据（`queryMetrics`）

**关键**：`api/client.ts` 每一个 method 都要有对应 handler（40+ 个）。可以按优先级：
- 高：APM / Infra / Logs / Metrics（日常开发要用）
- 中：Monitors / Billing / Guardian
- 低：Auth（用简化 mock 返固定 user）

### Step 2.4：main.tsx 里挂 MSW（15 分钟）

按 `05-MOCK-DATA.md` 里 "安装 + 初始化" 段。

### Step 2.5：加 npm script（10 分钟）

```json
{
  "scripts": {
    "dev:mock": "VITE_USE_MOCKS=true vite",
    "dev": "vite"
  }
}
```

**验收**：
- [ ] `pnpm dev:mock` 启动后关掉 Rust 后端，APM/Logs/Infra 页面都能看到数据
- [ ] Network 面板显示请求被 MSW 拦截
- [ ] 关掉 mock 用 `pnpm dev` 走真后端也正常

git commit: `feat: mock data layer with MSW + faker for offline dev`

---

## M3. 参考图重组（0.5 天）

### Step 3.1：清理 `screenshots/`（1 小时）

```bash
mkdir -p datadog-capture/outputs/screenshots
# 把根目录 screenshots/ 里有意义的移过去，按 kebab-case 命名
mv screenshots/apm-detail2/* datadog-capture/outputs/screenshots/apm/
# 删除 image3.bmp / test.png / 等无意义文件
```

**命名规约**：`<page>-<component-or-state>.png`

例：`dashboard-metric-card.png`、`apm-services-list.png`、`monitor-alert-triggered.png`

### Step 3.2：整理 `datadog-capture/scripts/`（2 小时）

按 `06-PIPELINE-SALVAGE.md` A 段执行：

```bash
cd datadog-capture

# 备份现有一坨
mkdir -p .old
mv scripts/cap_dd*.js scripts/cap_final.js scripts/cap_apm_full_interact.js .old/

# 拉进 pipeline 的脚本
cp /path/to/token-pipeline/scripts/scrape-datadog.mjs   scripts/scrape-css.mjs
cp /path/to/token-pipeline/scripts/scrape-js-colors.mjs scripts/scrape-js.mjs
cp /path/to/token-pipeline/scripts/merge-scans.mjs      scripts/merge-scans.mjs
cp /path/to/token-pipeline/scripts/1-normalize.mjs      scripts/normalize.mjs
```

写 `datadog-capture/README.md`（内容见 `06-PIPELINE-SALVAGE.md`）。

**验收**：
- [ ] `datadog-capture/scripts/` 只剩 4-5 个明确职责的脚本
- [ ] `datadog-capture/README.md` 有完整用法
- [ ] `screenshots/` 里所有文件都能对应到组件

git commit: `chore: reorganize datadog-capture with clean scripts and named screenshots`

### Step 3.3：写 `components-catalog.md`（1-2 小时）

在 `docs/frontend-standards/components-catalog.md` 列出 10-15 个核心组件，每条包含：位置、Props、变体、参考图路径。

模板见 `06-PIPELINE-SALVAGE.md` E 段。

git commit: `docs: add components catalog with datadog references`

---

## M4. Storybook 集成（1 天，可选但强烈推荐）

### Step 4.1：安装 Storybook 或 Ladle

**推荐 Ladle**（更快，配置更少）：

```bash
cd frontend
pnpm add -D @ladle/react
```

在 `package.json` 加：
```json
{
  "scripts": {
    "story": "ladle serve",
    "story:build": "ladle build"
  }
}
```

### Step 4.2：为每个 UI 原语建 story

```
src/components/ui/StatusBadge.stories.tsx
src/components/ui/Badge.stories.tsx
src/components/ui/Button.stories.tsx
...
```

模板：

```tsx
import { StatusBadge } from './StatusBadge';

export const Ok = () => <StatusBadge status="ok" />;
export const Warn = () => <StatusBadge status="warn" />;
export const Alert = () => <StatusBadge status="alert" />;
export const Critical = () => <StatusBadge status="critical" />;
export const NoData = () => <StatusBadge status="no-data" />;
export const Pulse = () => <StatusBadge status="alert" pulse />;
```

### Step 4.3：为业务组件建 story（用 mock 数据）

```tsx
import { MetricCard } from './MetricCard';
import { faker } from '@faker-js/faker';

faker.seed(1);

export const Default = () => (
  <MetricCard title="Requests" value={12345} delta={5.2} trend="up" />
);

export const Critical = () => (
  <MetricCard title="Error Rate" value="3.8" unit="%" delta={-1.2} trend="down" status="critical" />
);

export const Loading = () => (
  <MetricCard title="Latency" value={0} loading />
);
```

**验收**：
- [ ] `pnpm story` 打开能看到 UI 原语和至少 5 个业务组件
- [ ] 深色模式切换在 story 里也能用（加 decorators）

git commit: `feat: Ladle stories for ui primitives and core components`

---

## M5. 组件规范化（持续）

不是一次性任务，而是**日常开发的约定**。

### 长期规则

每次接触一个组件时：
- [ ] 检查是否用了 `style={{ ... }}` inline 颜色 → 换成 Tailwind class
- [ ] 检查是否用了 legacy class（`bg-brand-500`）→ 换成语义 class（`bg-accent-primary`）
- [ ] 检查是否有 `#hex` 字面量 → 加到 tokens.css 或换成变量
- [ ] 检查文件大小 → 超过 300 行就拆
- [ ] 补一个 `.stories.tsx`

### CI 检查（可选）

在 `frontend/package.json` 加：

```json
{
  "scripts": {
    "check:no-hex":   "! grep -rEn '#[0-9a-fA-F]{3,8}' tailwind.config.js src/theme.ts 2>/dev/null",
    "check:no-inline-color": "! grep -rn 'style={{[^}]*\\(color\\|background\\)' src/components src/pages"
  }
}
```

pre-commit hook（`.husky/pre-commit`）：
```bash
pnpm check:no-hex && pnpm check:no-inline-color
```

---

## 总时间线

| 里程碑 | 独立工时 | 关键交付 |
|---|---|---|
| M0 | 0.5 天 | 环境就绪 |
| M1 | 1 天 | Token 统一 + 主题切换可用 |
| M2 | 1 天 | 无后端也能开发 |
| M3 | 0.5 天 | 参考图 + 抓取脚本井然有序 |
| M4 | 1 天 | Storybook 组件隔离环境 |
| M5 | 持续 | 组件质量渐进提升 |

**并行度**：M2 和 M3 可以并行做；M4 依赖 M1 完成。

**关键路径**：M0 → M1 → M2 → M4，最短 3.5 天可以见到明显改善。

---

## 每步 commit 建议

```
M1.1  chore: introduce tokens.css and new tailwind config with legacy layer
M1.2  feat: theme toggle via CSS variables
M1.3  refactor: replace theme.ts inline styles with Tailwind tokens
M1.4  refactor: extract antd overrides, purge hardcoded hex from globals

M2.1  chore: add MSW dependency and service worker
M2.2  feat: mock data layer scaffolding
M2.3  feat: apm/infra/logs mock generators
M2.4  feat: mount MSW in dev via VITE_USE_MOCKS

M3.1  chore: consolidate datadog-capture scripts
M3.2  chore: rename and organize reference screenshots
M3.3  docs: components catalog with datadog references

M4.1  chore: add Ladle for component stories
M4.2  feat: stories for ui primitives
M4.3  feat: stories for business components
```

---

## 遇到问题去哪查

| 问题 | 查什么 |
|---|---|
| Token 该怎么起名？ | `02-DESIGN-SYSTEM.md` § "Token 分层" |
| 怎么迁一个用了 theme.ts 的组件？ | `03-MIGRATION-PLAYBOOK.md` § Phase 2 |
| 什么时候用 antd 什么时候用自研？ | `04-COMPONENT-STANDARDS.md` § 1 |
| 加新组件的模板？ | `04-COMPONENT-STANDARDS.md` § 4 |
| Mock 数据怎么加？ | `05-MOCK-DATA.md` § Generators |
| 抓 Datadog 参考图怎么做？ | `06-PIPELINE-SALVAGE.md` § A / B |

---

## 完成信号

全部里程碑完成后，项目状态应该是：

- 前端可以**不依赖后端**独立开发（MSW mock）
- 主题切换**一键完成**，无组件视觉回归
- 新组件开发**有明确模板**，AI 或人都能按套路做
- Datadog 参考图**能对上号**（catalog + 命名）
- 有 Storybook 做**组件隔离验收**
- **文档齐全**，新人 30 分钟能上手
