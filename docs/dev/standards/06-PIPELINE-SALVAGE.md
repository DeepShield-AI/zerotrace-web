# 从 token-pipeline / component-pipeline 借鉴什么

前面在 `/Users/smore/Workspace/web/token-pipeline` 和 `component-pipeline` 建的完整自动化 pipeline，**目标机器没有 claude CLI，无法直接跑**。但里面有价值的部分可以借鉴到 `zerotrace-web` 里。

---

## 明确保留 / 明确丢弃

| 组件 | 保留？ | 落到 zerotrace-web 的哪里 |
|---|---|---|
| `scrape-datadog.mjs`（HTML/CSS 抓取）| ✅ 保留 | `datadog-capture/scripts/scrape-css.mjs`（替代现有一堆 cap_dd*.js）|
| `scrape-js-colors.mjs`（JS bundle 色板抓取）| ✅ 保留 | `datadog-capture/scripts/scrape-js.mjs`（新的能力）|
| `merge-scans.mjs`（合并多次扫描）| ✅ 保留 | `datadog-capture/scripts/merge-scans.mjs` |
| `1-normalize.mjs`（颜色聚类）| ✅ 保留 | `datadog-capture/scripts/normalize.mjs`（未来更新 token 用）|
| `3-generate.mjs`（生成 tailwind config）| ❌ 丢弃 | 项目已经有自定义 tailwind config，别覆盖 |
| `2-classify.sh`（调 claude CLI）| ❌ 丢弃 | 目标机没 claude |
| `prompts/classify-tokens.md` | ⚠️ 参考 | 存为 doc，人工按此规则更新 tokens.css |
| `gen-components.sh`（AI 循环生成）| ❌ 丢弃 | 目标机没 claude |
| `gen-pages.sh` | ❌ 丢弃 | 同上 |
| `verify-visual.mjs`（Playwright 视觉回归）| ✅ 保留 | `datadog-capture/scripts/visual-regress.mjs`（很有用）|
| `components.manifest.ts` 概念 | ✅ 保留 | 变成 `docs/frontend-standards/components-catalog.md` |
| `routes.ts` 概念 | 已存在 | 项目已有 `src/App.tsx` 里的路由声明 |

---

## 具体落地计划

### A. 整合到 `datadog-capture/`

**现状**：20+ 个 `cap_dd*.js` 无序脚本 + Chromium libs。

**目标**：只保留 4 个明确职责的脚本 + 1 个 README。

```
datadog-capture/
├── README.md                    # 一次说清楚：抓什么、怎么用、cookie 怎么放
├── package.json                 # 只依赖 playwright
├── scripts/
│   ├── scrape-css.mjs           # HTML + external CSS 抓取（当前 scrape-datadog.mjs）
│   ├── scrape-js.mjs            # JS bundle 抓取 + 色板提取（当前 scrape-js-colors.mjs）
│   ├── merge-scans.mjs          # 合并多次扫描
│   ├── normalize.mjs            # 颜色聚类归一化
│   └── visual-regress.mjs       # Playwright 视觉回归（后面加）
├── inputs/                      # gitignore，存 cookies.txt / 环境变量
├── outputs/
│   ├── raw/                     # 每次扫描的原始 JSON
│   ├── merged/                  # 合并后的 JSON
│   └── screenshots/             # 参考截图（现在的 screenshots/ 挪过来）
└── libs/                        # 可选：Chromium 系统库（如果要跑 playwright）
```

**删除**：`cap_dd.js` `cap_dd2.js` ... `cap_dd9.js` 全部（备份到 `.old/` 或直接 git 里查）。

### B. 添加 `datadog-capture/README.md`

```markdown
# Datadog UI Reference Capture

工具：抓 Datadog UI 的 CSS / JS 里的设计 token + 组件截图，作为 zerotrace-web 前端参考。

## Setup

```bash
cd datadog-capture
pnpm install

# Chrome 里登录 Datadog，DevTools → Application → Cookies 导出
export COOKIE='dogweb=xxx; dogweb_v=xxx; dogwebu=xxx'
```

## 用法

### 1. 抓 CSS token

```bash
node scripts/scrape-css.mjs 'https://ap1.datadoghq.com/dashboard/lists' outputs/raw/dashboard.json
```

### 2. 抓 JS 色板

```bash
node scripts/scrape-js.mjs 'https://ap1.datadoghq.com/dashboard/lists' outputs/raw/dashboard-js.json
```

### 3. 合并

```bash
node scripts/merge-scans.mjs outputs/raw/*.json outputs/merged/all.json
```

### 4. 归一化

```bash
node scripts/normalize.mjs outputs/merged/all.json outputs/merged/normalized.json
```

### 5. 更新 tokens.css

**人工**：查看 `outputs/merged/normalized.json`，按 `docs/frontend-standards/02-DESIGN-SYSTEM.md` 里的规则更新 `frontend/src/styles/tokens.css`。

### 6. 抓参考截图

```bash
node scripts/scrape-screenshots.mjs  # 遍历一堆 URL，存到 outputs/screenshots/
```

### 7. 视觉回归

```bash
node scripts/visual-regress.mjs      # 对比 outputs/screenshots/ vs zerotrace-web 自己的截图
```
```

### C. 视觉回归脚本（新增能力）

**目的**：在 Storybook 或本地 dev 上跑 zerotrace-web，对每个组件截图，和 Datadog 参考图做像素 diff。

**放置**：`datadog-capture/scripts/visual-regress.mjs`

**依赖**：`playwright`, `pixelmatch`, `pngjs`

**逻辑**（伪代码）：
```javascript
// 1. 读取 datadog-capture/outputs/screenshots/*.png（Datadog 参考图）
// 2. 每张对应到一个 URL 或 Storybook story
//    比如 metric-card.png → http://localhost:6006/?path=/story/metriccard--default
// 3. Playwright 截图，pixelmatch 对比
// 4. 差异 > 5% 时输出 diff.png 和一份报告
```

具体实现见 `token-pipeline` 里的 `verify-visual.mjs`，直接搬过来改一下路径即可。

---

## D. 前端里加个"参考图对照"面板（可选）

在开发环境提供一个隐藏页面，比如 `/__reference/metric-card`，同时显示：
- 左边：zerotrace 自己的 MetricCard 组件
- 右边：`/reference/metric-card.png` 静态图

方便人眼对比调 UI。

**放置**：`frontend/src/pages/__reference/` （只在 DEV 环境挂载）

```tsx
// frontend/src/pages/__reference/Compare.tsx
import { useParams } from 'react-router-dom';

export default function Compare() {
  const { name } = useParams();
  return (
    <div className="grid grid-cols-2 gap-4 p-8">
      <div>
        <h2>My Component</h2>
        {/* 动态 import 对应组件 */}
      </div>
      <div>
        <h2>Datadog Reference</h2>
        <img src={`/reference/${name}.png`} alt={name} />
      </div>
    </div>
  );
}
```

`frontend/public/reference/` 存参考图（gitignore，或者只提交小尺寸的）。

---

## E. `components-catalog.md`

把之前 `component-pipeline/config/components.manifest.ts` 的**契约思想**保留下来，但是转成**给人看**的 catalog：

```
docs/frontend-standards/components-catalog.md
```

内容：列出所有组件、状态、变体、Props、参考图路径。开发者写新组件前先查这里。

**示例**：

```markdown
## MetricCard

**位置**：`src/components/MetricCard/`
**用途**：仪表盘顶部 KPI 卡片
**变体**：default | ok | warn | critical | no-data

### Props

| Name | Type | Default | 说明 |
|---|---|---|---|
| title | string | - | 卡片标题（例："RPS"）|
| value | number \| string | - | 主数字 |
| unit | string? | - | 单位（例："req/s"）|
| delta | number? | - | 变化百分比 |
| trend | 'up'\|'down'\|'flat'? | flat | 趋势方向 |
| status | 'ok'\|'warn'\|'critical'? | ok | 左侧 accent bar 颜色 |

### Reference

- Datadog 截图：`datadog-capture/outputs/screenshots/dashboard-metric-card.png`
- 内部 Storybook：（Story 建好后填）

### Known Uses

- `pages/Dashboard.tsx`
- `pages/APM.tsx`
```

---

## F. 明确写下"不引入 claude CLI"

在新 `CLAUDE.md` 里明确：

> 本项目**不依赖** Anthropic Claude CLI 参与开发工作流。所有工具都是普通 Node 脚本 + 前端 dev server。
>
> 如果你在别的项目里见过 `claude --print` 之类的 gen-component 脚本，那是外挂 AI 生成的用法，本项目不采用。
>
> 用 AI 辅助开发的方式：直接在你自己的 AI IDE / 桌面客户端里粘贴代码/规范上下文，然后手动应用生成结果。

---

## 时间估算

| 任务 | 工时 |
|---|---|
| 整理 `datadog-capture/` 到 4 个脚本 | 2 h |
| 从 token-pipeline 复制 3 个脚本 + 调路径 | 1 h |
| 写 `datadog-capture/README.md` | 1 h |
| 写 `visual-regress.mjs`（如果需要）| 3 h |
| 写 `components-catalog.md` 首批 5-10 个组件条目 | 2 h |

**总计**：一天工作量。

---

## 不要引入的东西（明确列出以免混淆）

- ❌ `gen-components.sh` / `gen-pages.sh` — 依赖 claude CLI
- ❌ `2-classify.sh` — 同上
- ❌ `split-output.mjs` — AI 输出解析，本项目不用
- ❌ `.gen-cache/` 缓存目录
- ❌ `run.sh` 一键脚本（合并 AI + 生成，本项目分开做）
