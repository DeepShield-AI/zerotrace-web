# Datadog 视觉对齐方法论

**目标**：定义"和 Datadog 基本一致"的可度量标准，让 agent 有明确的**验收 gate**。

---

## 度量

### 3 个层级的对齐度（从低到高）

| 层级 | 名称 | 度量方式 | 目标 |
|---|---|---|---|
| L1 | **结构对齐** | 人眼比对区块位置、层级数量 | 100% |
| L2 | **色彩对齐** | Token 引用检查（无 hardcoded）| 100% |
| L3 | **像素对齐** | pixelmatch 差异比例 | < 15% |

**关键**：L1 + L2 达标 = "基本一致"（≈85% 相似）。L3 是锦上添花，不追求完美。

### 为什么不是 100% 像素

- 字体渲染跨 OS 差异（macOS SF vs Linux fallback）
- 图表反锯齿的细微差别
- 我们用 Geist Sans + Geist Mono，Datadog 用 SF Pro/Mono
- Icon 集不同（lucide-react vs Datadog 内部）

**接受的偏差**：
- ✅ 字体不同、字号一致
- ✅ 图标形状略异、位置一致
- ✅ 颜色语义一致（都是"错误红"），具体色号可有 5-10 单位差
- ❌ 布局错位、组件缺失、层级颠倒 → 不接受

---

## L1 结构对齐：手工审查表

对每个页面填一份 audit table。位置：`docs/frontend-standards/pages/<name>.parity.md`

```markdown
## L1 结构审查

| 区块 | Datadog 参考 | 本项目实现 | 一致？ | 备注 |
|---|---|---|---|---|
| 顶部工具栏高度 | 48px | 48px | ✅ | |
| 顶部工具栏元素数 | 5 | 5 | ✅ | 面包屑/搜索/时间/环境/头像 |
| Filter Bar 位置 | topbar 下方 | 同 | ✅ | |
| Filter Bar 高度 | 40px | 44px | ⚠️ | 我们的 chip 多了 4px padding |
| Metric Strip 卡片数 | 4 | 4 | ✅ | |
| Metric Strip 卡片布局 | grid-cols-4 | grid-cols-4 | ✅ | |
| 主表格列数 | 8 | 7 | ❌ | 少了 "Env" 列 |
| 主表格行密度 | 32px/行 | 40px/行 | ⚠️ | 太宽松，改 py-2 → py-1 |
| Sidebar 折叠状态 | 有 | 有 | ✅ | |
| Sidebar 宽度 | 160px | 160px | ✅ | |
```

**通过标准**：所有 ✅ 或 ⚠️（可接受的微差）。任何 ❌ 必须修。

---

## L2 色彩对齐：自动检查

### 检查项 1：无 hardcoded hex

```bash
# 项目根跑
grep -rEn '#[0-9a-fA-F]{6}\b' frontend/src \
  --include='*.tsx' --include='*.ts' \
  --exclude-dir=mocks --exclude-dir=lib | \
  grep -v '// ' | grep -v '/\*'
# 期望：0 行输出
```

### 检查项 2：无 Tailwind 默认色

```bash
grep -rEn '(bg|text|border|ring)-(red|green|blue|slate|zinc|gray|neutral|stone|amber|orange|purple|pink|violet|indigo|emerald|lime|teal|cyan|sky|rose|fuchsia)-[0-9]+' frontend/src \
  --include='*.tsx' | \
  head -20
# 期望：0 行输出（或有历史遗留，逐步清理）
```

### 检查项 3：无 inline style 颜色

```bash
grep -rnE 'style=\{\{[^}]*(color|background|border)' frontend/src \
  --include='*.tsx' | \
  head -20
# 期望：0 行输出
```

### 加入 `package.json`

```json
{
  "scripts": {
    "check:parity:l2": "bash scripts/check-l2-parity.sh"
  }
}
```

`frontend/scripts/check-l2-parity.sh`：
```bash
#!/usr/bin/env bash
set -e

HEX=$(grep -rEn '#[0-9a-fA-F]{6}\b' src --include='*.tsx' --include='*.ts' \
  --exclude-dir=mocks --exclude-dir=lib | grep -v '// ' | wc -l | tr -d ' ')
DEFAULT_COLORS=$(grep -rEn '(bg|text|border|ring)-(red|green|blue|slate|zinc|gray|neutral|stone|amber|orange|purple|pink|violet|indigo|emerald|lime|teal|cyan|sky|rose|fuchsia)-[0-9]+' src --include='*.tsx' | wc -l | tr -d ' ')
INLINE=$(grep -rnE 'style=\{\{[^}]*(color|background|border)' src --include='*.tsx' | wc -l | tr -d ' ')

echo "L2 Parity Check:"
echo "  Hardcoded hex:      $HEX  (target 0)"
echo "  Tailwind default:   $DEFAULT_COLORS  (target 0)"
echo "  Inline style color: $INLINE  (target 0)"

if [ "$HEX" -gt 0 ] || [ "$DEFAULT_COLORS" -gt 0 ] || [ "$INLINE" -gt 0 ]; then
  exit 1
fi
```

---

## L3 像素对齐：Playwright + pixelmatch

### 单页对比脚本

`datadog-capture/scripts/page-parity.mjs`：

```javascript
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const PAGE_URL = args[0];    // http://localhost:5173/apm/services
const REF_PATH = args[1];    // outputs/screenshots/apm-services.png
const OUT_DIR  = args[2] || 'outputs/parity';

const THRESHOLD = 15;  // 百分比

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// 用 mock 模式跑 dev，保证数据稳定
await page.goto(PAGE_URL, { waitUntil: 'networkidle' });

// 等待关键元素（防止未加载完就截图）
await page.waitForSelector('[data-testid="page-ready"], main', { timeout: 10_000 });
await page.waitForTimeout(500);  // 等动画

const mine = await page.screenshot({ fullPage: false });

const ref = PNG.sync.read(fs.readFileSync(REF_PATH));
const minePng = PNG.sync.read(mine);
const w = Math.min(ref.width, minePng.width);
const h = Math.min(ref.height, minePng.height);
const diff = new PNG({ width: w, height: h });
const count = pixelmatch(ref.data, minePng.data, diff.data, w, h, {
  threshold: 0.15,   // 单像素颜色阈值
  alpha: 0.3,
});
const pct = (count / (w * h)) * 100;

const name = path.basename(REF_PATH, '.png');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(`${OUT_DIR}/${name}.mine.png`, mine);
fs.writeFileSync(`${OUT_DIR}/${name}.diff.png`, PNG.sync.write(diff));

const result = {
  page: PAGE_URL,
  ref: REF_PATH,
  diffPct: parseFloat(pct.toFixed(2)),
  pass: pct < THRESHOLD,
  threshold: THRESHOLD,
  timestamp: new Date().toISOString(),
};

fs.writeFileSync(`${OUT_DIR}/${name}.report.json`, JSON.stringify(result, null, 2));

console.log(`${result.pass ? '✅' : '❌'} ${name}  diff=${pct.toFixed(2)}% (threshold ${THRESHOLD}%)`);
console.log(`   mine: ${OUT_DIR}/${name}.mine.png`);
console.log(`   diff: ${OUT_DIR}/${name}.diff.png`);

await browser.close();
process.exit(result.pass ? 0 : 1);
```

**用法**：
```bash
# 起前端（mock 模式）
cd frontend && pnpm dev:mock &

# 跑对比
cd datadog-capture
node scripts/page-parity.mjs \
  http://localhost:5173/apm/services \
  outputs/screenshots/apm-services.png
```

### 批量对比

`datadog-capture/scripts/parity-all.mjs`：

```javascript
const PAGES = [
  { url: 'http://localhost:5173/apm/services',   ref: 'outputs/screenshots/apm-services.png' },
  { url: 'http://localhost:5173/apm/traces',     ref: 'outputs/screenshots/apm-traces.png'   },
  { url: 'http://localhost:5173/infrastructure', ref: 'outputs/screenshots/infra.png'        },
  { url: 'http://localhost:5173/logs',           ref: 'outputs/screenshots/logs.png'         },
  { url: 'http://localhost:5173/monitors',       ref: 'outputs/screenshots/monitors.png'     },
  { url: 'http://localhost:5173/metrics',        ref: 'outputs/screenshots/metrics.png'      },
];

const results = [];
for (const p of PAGES) {
  // ... 调用 page-parity 逻辑
  results.push({ ...p, pct: ..., pass: ... });
}

// 汇总报告
console.log('\n═══ Parity Report ═══');
console.log(`Passed: ${results.filter(r => r.pass).length}/${results.length}`);
results.forEach((r) => console.log(`  ${r.pass ? '✅' : '❌'} ${r.url}  diff=${r.pct.toFixed(2)}%`));

// 写 Markdown 报告
const md = `# Parity Report — ${new Date().toISOString()}
${results.map(r => `- ${r.pass ? '✅' : '❌'} \`${r.url}\` — ${r.pct.toFixed(2)}%`).join('\n')}
`;
fs.writeFileSync('outputs/parity/REPORT.md', md);
```

---

## 差异归因矩阵

看到 diff 图后按下面表定位问题：

| 差异位置 | 常见原因 | 修法 | 影响 Level |
|---|---|---|---|
| 全屏偏暗 | Token `--bg-base` 值不对 | 改 tokens.css | L2 |
| 卡片背景漂白 | 用了 `bg-white` 而非 `bg-bg-elevated` | 改组件 class | L2 |
| 文字对比度低 | 用了 `text-gray-400` 默认色 | 换 `text-fg-tertiary` | L2 |
| 主色不对 | `--accent-primary` 值差 | 改 tokens.css | L2 |
| 布局错位 | Flex/Grid 结构错 | 对照参考重排 | L1 |
| 组件缺失 | Phase 2 遗漏 | 补组件 | L1 |
| 列数不对 | Table 定义错 | 改 columns 定义 | L1 |
| 字号阶梯错 | 用了错级 h4/h5 | 对照 fontSize 阶梯 | L2 |
| 间距不齐 | 用了 p-3 而不是 p-4 | 对齐 4pt 网格 | L2 |
| 图表色调乱 | ECharts option 里 hardcode 色 | 用 chartColors[] | L2 |
| 表格行高不同 | py-2 vs py-3 | 对齐 Datadog 32px 行 | L2 |
| 时间轴刻度不同 | ECharts 未指定 interval | 加 xAxis interval | L1 |
| icon 形状小差 | 图标库不同 | 忽略（除非严重） | L3（可接受）|
| 字体略糊 | Anti-aliasing 差异 | 忽略 | L3（可接受）|

---

## Agent 使用 Parity 的流程

**在 [`08-PAGE-DEV-WORKFLOW.md`](./08-PAGE-DEV-WORKFLOW.md) Phase 6 里已经嵌入了 parity 检查**。这里补充 agent 循环：

```
1. Agent 完成 Phase 5 集成
2. 跑 L2 检查：pnpm check:parity:l2
   ├─ ❌ → Agent 读错误列表，逐条修（改 tokens / 换 class）
   └─ ✅ → 继续
3. 跑 L3 检查：node datadog-capture/scripts/page-parity.mjs URL REF
   ├─ diff < 15% → 通过，PR 可提
   ├─ 15%-30% → Agent 读 diff.png，按归因矩阵找原因，修 3-5 处后重跑
   └─ > 30% → 结构错误，回 Phase 2 重新拆解
```

**Agent 反馈公式**：
```
如果 diff 图上红色区域在:
  - 卡片背景 → 检查 bg-bg-elevated
  - 文字 → 检查 text-fg-*
  - 表格边框 → 检查 border-border-subtle
  - 图表 → 检查 chartColors 顺序
```

---

## 参考图管理规范

### 命名

`datadog-capture/outputs/screenshots/<page-slug>.png`

其中 `<page-slug>` 是 `App.tsx` 里路由的 kebab 版本：
- `/apm/services` → `apm-services.png`
- `/apm/services/:name` → `apm-service-detail.png`（详情用 detail 后缀）
- `/monitors/manage` → `monitors-manage.png`

### 变体

同一页面有明显不同状态的（如 monitors 页面 alert 触发 vs 正常），用后缀：

```
monitors-manage.png             ← 默认（有 mixed 状态）
monitors-manage.all-ok.png
monitors-manage.mostly-alert.png
```

### 分辨率约定

- 视口：**1440 × 900**（标准 laptop）
- fullPage：**否**（截屏只截视口，避免因数据量不同导致长度差）
- 保存质量：PNG（无损）

### 抓取时机

- Datadog 页面加载完毕（`networkidle`）
- 等 500ms 让动画收尾
- 关掉 tooltips / dropdowns（用 `page.mouse.move(0, 0)` 移开鼠标）

---

## 什么时候可以"降标"

**允许放宽 15% 阈值到 25%** 的场景：

- 页面有大量随机数据（如 logs stream）——因为 mock 数据永远和真实不完全一样
- 图表页面（数据形状不同必然导致像素差）
- 有 SVG icon 大量存在的页面

**永远不放宽**的检查：

- L1 结构（区块数量、位置）—— 100%
- L2 色彩（token 引用）—— 100%
- 深色模式基本可用 —— 100%

---

## 检查清单

页面提交前：

```
□ L1 结构审查表填写完毕，所有 ❌ 已修复
□ pnpm check:parity:l2 全绿
□ node datadog-capture/scripts/page-parity.mjs 通过（< 15%）
□ 深色主题下也做了一次 L3 对比
□ mine.png / diff.png 存到 docs/frontend-standards/pages/<name>-parity/
□ parity.md 报告已更新（diff 值 + 时间戳）
```
