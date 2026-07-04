# 迁移剧本

**目标**：把现有代码里的 3 个 token 源合并成 1 个（`tokens.css`），保证迁移过程中应用永远可跑。

**原则**：不停机迁移。每一步之后 `pnpm dev` 都能起、界面视觉无回归。

---

## Phase 0：准备（30 分钟）

### Step 0.1 落盘新配置文件

从 `docs/dev/standards/proposed-files/` 复制到目标位置：

```bash
cd frontend

# 新增 3 个文件（不覆盖任何东西）
cp ../docs/dev/standards/proposed-files/tokens.css src/styles/tokens.css
cp ../docs/dev/standards/proposed-files/tokens.ts  src/lib/tokens.ts

# 备份现有 tailwind config，替换
mv tailwind.config.js tailwind.config.old.js.bak
cp ../docs/dev/standards/proposed-files/tailwind.config.js tailwind.config.js
```

### Step 0.2 在 main.tsx 引入 tokens.css

**位置**：`frontend/src/main.tsx`，`import './index.css'` **之前**。

```diff
+ import './styles/tokens.css';
  import './index.css';
```

### Step 0.3 验证

```bash
pnpm dev
```

打开 `http://localhost:5173`，页面应该完全和之前一样（新 config 有 legacy 兼容层）。如果视觉有变，回滚：
```bash
git checkout frontend/tailwind.config.js
mv frontend/tailwind.config.old.js.bak frontend/tailwind.config.js
```

**验收标准**：视觉零变化 + 无 console 报错。

---

## Phase 1：主题切换机制（1 小时）

### Step 1.1 改 `useTheme` hook

**位置**：`frontend/src/hooks/useTheme.tsx`

**目标**：切换主题只改 `<html class>`，不重渲染任何组件。

```typescript
// 在 ThemeProvider useEffect 里
useEffect(() => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  localStorage.setItem('theme', theme);
}, [theme]);
```

### Step 1.2 验证

在 DevTools Console 输入：
```js
document.documentElement.classList.add('dark')
```
整个界面颜色应立即切到深色。移除 class 立即恢复。**不需要刷新**。

### Step 1.3 加主题切换按钮到 SidebarNav 或 TopBar

```tsx
import { useTheme } from '@/hooks/useTheme';

const { theme, setTheme } = useTheme();
<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
  {theme === 'dark' ? '☀️' : '🌙'}
</button>
```

**验收标准**：点击按钮全站主题切换，刷新后保持。

---

## Phase 2：消灭 theme.ts（2-4 小时）

### Step 2.1 定位所有引用

```bash
cd frontend
grep -rn "from '../theme'" src/  # 引用 theme.ts 的文件
grep -rn "from '@/theme'" src/
grep -rn "tokens\." src/         # 用了 tokens.xxx 的地方
```

已知点：
- `frontend/src/components/ApmServicesView.tsx`
- 其他可能 1-2 个

### Step 2.2 每处替换（模式化）

**模式 A**：内联颜色 → Tailwind class

```diff
- <span style={{ backgroundColor: T.brand.error }} />
+ <span className="bg-accent-danger" />

- <div style={{ background: T.border.light }}>
+ <div className="bg-border-subtle">

- <div className="text-white" style={{ color: T.brand.primary }}>
+ <div className="text-accent-primary">
```

**模式 B**：动态色 → data-attribute + Tailwind

```diff
- const c = errorRate > 5 ? T.brand.error : T.brand.warning;
- <span style={{ backgroundColor: c }} />

+ const level = errorRate > 5 ? 'danger' : 'warning';
+ <span className={`bg-accent-${level}`} />
+ // 或者用 clsx:
+ <span className={clsx({
+   'bg-accent-danger': errorRate > 5,
+   'bg-accent-warning': errorRate > 1 && errorRate <= 5,
+   'bg-accent-success': errorRate <= 1,
+ })} />
```

**模式 C**：`tokens.brand.primary` 在 ECharts 里 → 从 `@/lib/tokens.ts` 或 CSS 变量取

```diff
  option = {
    series: [{
-     itemStyle: { color: T.brand.primary },
+     itemStyle: { color: 'var(--accent-primary)' },
    }],
  };
```

ECharts 支持 CSS 变量，但**需要在 SSR 环境验证**（当前是 Vite SPA，没问题）。

### Step 2.3 完成后删除 theme.ts

```bash
grep -rn "from '../theme'" src/  # 应返回空
grep -rn "tokens\." src/         # 应返回空
rm src/theme.ts
```

**验收标准**：
- [ ] `grep` 三条命令都返回空
- [ ] 视觉对比：迁移前后每个页面截图对比（用 Playwright，见 [05-mock-data.md](#) 附录）
- [ ] 深色模式切换正常

---

## Phase 3：消灭 index.css 里的 hardcoded 色（1-2 小时）

### Step 3.1 定位

```bash
grep -nE '#[0-9a-fA-F]{3,6}\b' frontend/src/index.css
grep -nE 'rgba?\(' frontend/src/index.css | grep -v var
```

### Step 3.2 逐条替换

**Before**（`index.css` 现状）：
```css
body {
  @apply font-sans bg-[#f9fafb] text-zinc-900 antialiased;
  accent-color: #632CA6;
}

.dark .host-row:hover {
  background-color: rgba(99, 44, 166, 0.08);
}

.dark .host-row-selected {
  background-color: #1E1035;
}
```

**After**：
```css
body {
  @apply font-sans bg-bg-base text-fg-primary antialiased;
  accent-color: var(--accent-primary);
}

/* 加到 tokens.css 里 */
.dark {
  --host-row-hover-bg:    rgba(99, 44, 166, 0.08);
  --host-row-selected-bg: #1E1035;
}

/* index.css */
.dark .host-row:hover {
  background-color: var(--host-row-hover-bg);
}
.dark .host-row-selected {
  background-color: var(--host-row-selected-bg);
}
```

**规则**：任何 hardcoded 值都要**先在 tokens.css 加一个变量**，再引用。

### Step 3.3 antd override 抽离

现有 `index.css` 尾部 100+ 行 antd `.dark` 补丁。建议**抽到独立文件**：

```
frontend/src/styles/
├── tokens.css       ← 单一真相源
├── antd-overrides.css   ← 新增，专门放 .dark .ant-* 规则
└── globals.css      ← 从 index.css 重命名，只放通用 base + components
```

**验收标准**：
- [ ] `grep -nE '#[0-9a-fA-F]{3,6}\b' frontend/src/index.css` 应返回 0（除注释）
- [ ] antd override 全部在 `antd-overrides.css`
- [ ] 深色模式所有页面视觉无变化

---

## Phase 4：Legacy 兼容层清理（渐进，可延后）

在 `tailwind.config.js` 里 `// ── Legacy 兼容层 ──` 段落是过渡期专用。

**策略**：每次接触一个用了 legacy 名（`brand-500`、`status-success` 等）的组件，就顺手改：

```diff
- <div className="bg-brand-500 text-status-danger">
+ <div className="bg-accent-primary text-accent-danger">
```

**目标**：3-6 个月内 legacy 段落清空。

**加入 CI 检查**（可选，见 [04-COMPONENT-STANDARDS.md](./04-COMPONENT-STANDARDS.md)）：

```bash
# 找新增文件里的 legacy class
git diff --name-only HEAD~1 -- 'frontend/src/**/*.tsx' | \
  xargs grep -lE '(bg|text|border)-(brand|status|surface|ink|edge)-' | \
  head -5
# 如果有输出，就打警告
```

---

## Phase 5：CI 检查加固（30 分钟）

在 `frontend/package.json` 加 script：

```json
{
  "scripts": {
    "check:tokens": "! grep -rEn \"'#[0-9a-fA-F]{3,8}'\" tailwind.config.js && ! grep -rEn '\"#[0-9a-fA-F]{3,8}\"' src/theme.ts 2>/dev/null || (echo '❌ 发现 hardcoded hex' && exit 1)",
    "check:no-inline-style": "! grep -rn 'style={{.*color\\|background' src/components src/pages || (echo '❌ 发现 inline style 颜色' && exit 1)"
  }
}
```

在 `pnpm build` 前跑，或加到 pre-commit hook。

---

## 时间估算总表

| Phase | 内容 | 工时 | 风险 |
|---|---|---|---|
| 0 | 新配置文件 + 引入 | 30 min | 低 |
| 1 | 主题切换机制 | 1 h | 低 |
| 2 | 消灭 theme.ts | 2-4 h | 中（需要逐处检查视觉）|
| 3 | 清理 index.css hardcode | 1-2 h | 低 |
| 4 | Legacy 清理 | 持续（3-6 月）| 无 |
| 5 | CI 检查 | 30 min | 无 |

**关键节点**：Phase 0-3 一天内可以做完，之后进入日常维护。

---

## 回滚方案

如果某一步出问题：

```bash
git checkout frontend/src/theme.ts frontend/src/index.css frontend/tailwind.config.js
rm frontend/src/styles/tokens.css frontend/src/lib/tokens.ts
git checkout main.tsx
```

**建议**：每个 Phase 结束都做一次 commit，方便回滚粒度控制在小范围。
