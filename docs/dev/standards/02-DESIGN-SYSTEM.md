# 设计系统规范

## 核心原则

**Token 唯一真相源：CSS 变量**。所有 Tailwind class 和内联样式都必须**引用 CSS 变量**，禁止 hardcoded hex / rgb。

```
┌────────────────────────────┐
│  src/styles/tokens.css     │  ← 唯一真相源
│  :root { --bg-base: ... }  │
└──────┬─────────────────┬───┘
       │                 │
       ▼                 ▼
┌─────────────┐    ┌──────────────┐
│  Tailwind   │    │  tokens.ts   │  ← 仅用于图表 JS 消费
│  config.js  │    │  (echarts)   │
│  (映射到    │    │              │
│   var(--x)) │    │              │
└─────────────┘    └──────────────┘
       │                 │
       ▼                 ▼
   组件用 class      ECharts 用常量
```

---

## Token 分层（4 层）

### Layer 1：Primitive（原始值）

物理颜色、尺寸。**只在 tokens.css 定义一次**，业务代码永远不直接引用。

```css
/* 命名：--<category>-<name>-<variant> */
--color-purple-500: #8c4fff;   /* Datadog 提取的真实主紫 */
--color-purple-700: #632ca6;   /* Datadog 品牌深紫 */
--size-4: 4px;
--size-8: 8px;
```

### Layer 2：Semantic（语义映射）

给 primitive 起业务名字。**这一层才允许业务代码引用**。

```css
/* 语义：--<role>-<state>-<variant> */
--bg-base:      var(--color-neutral-950);  /* app 主背景 */
--bg-elevated:  var(--color-neutral-800);  /* 浮层 */
--accent-primary: var(--color-purple-500);
--accent-danger:  var(--color-red-500);
```

### Layer 3：Component（组件专属，可选）

某个组件的独有 token，从 Layer 2 派生。

```css
--sidebar-bg:        var(--bg-elevated);
--sidebar-item-hover: rgba(255,255,255,0.05);
--sidebar-width:      160px;
```

### Layer 4：主题覆盖（`.dark` / `.light`）

同一 Layer 2 变量在不同主题下值不同。

```css
:root {
  --bg-base: #ffffff;
}
.dark {
  --bg-base: #17191f;
}
```

---

## 完整 tokens.css（基于 Datadog 真实提取数据）

**放置路径**：`frontend/src/styles/tokens.css`
**引入位置**：`frontend/src/main.tsx` 最顶部 `import './styles/tokens.css';`
**完整内容**：见 `proposed-files/tokens.css`

关键结构：

```css
:root {
  /* ── Primitives ── */
  --color-neutral-0: #ffffff;
  --color-neutral-50: #f3f9fc;
  --color-neutral-500: #6a7287;
  --color-neutral-800: #292e39;
  --color-neutral-900: #17191f;
  --color-neutral-950: #091222;

  --color-purple-500: #8c4fff;     /* Datadog primary (JS 频次 39) */
  --color-purple-700: #632ca6;     /* brand deep */
  --color-blue-500: #128fea;       /* info */
  --color-green-500: #1cb96d;      /* success */
  --color-amber-500: #f27c00;      /* warning */
  --color-red-500: #eb364b;        /* danger */
  --color-red-700: #ca0812;        /* critical */
  --color-pink-500: #ed1978;       /* brand pink */

  /* Chart series (Datadog 真实 palette) */
  --chart-1: #8c4fff;
  --chart-2: #128fea;
  --chart-3: #01a88d;
  --chart-4: #ed7100;
  --chart-5: #e7157b;
  --chart-6: #41eba4;
  --chart-7: #5bceff;
  --chart-8: #fec866;
  --chart-9: #c925d1;
  --chart-10: #7aa116;

  /* ── Semantic (默认 = 亮色主题) ── */
  --bg-base:      var(--color-neutral-0);
  --bg-subtle:    var(--color-neutral-50);
  --bg-muted:     #eeeeee;
  --bg-elevated:  var(--color-neutral-0);

  --fg-primary:   #1c2b34;
  --fg-secondary: #506e81;
  --fg-tertiary:  #8b9bb4;
  --fg-disabled:  #adb5bd;

  --border-default: #d1d9e0;
  --border-subtle:  #e9ecef;
  --border-strong:  #adb5bd;

  --accent-primary: var(--color-purple-700);  /* 亮色主题用深紫 */
  --accent-brand:   var(--color-purple-700);
  --accent-pink:    var(--color-pink-500);
  --accent-success: #2db88d;
  --accent-warning: var(--color-amber-500);
  --accent-danger:  #e65c5c;
  --accent-critical: var(--color-red-700);
  --accent-info:    #4799eb;

  /* Severity（监控专用色阶）*/
  --severity-ok:       #41c464;
  --severity-warn:     #deab3e;
  --severity-alert:    #eb364b;
  --severity-critical: #ca0812;
  --severity-no-data:  #828ba4;
  --severity-unknown:  #c4c4c4;

  /* Radius, spacing, shadow */
  --radius-sm: 2px;
  --radius-md: 4px;      /* Datadog 主流：usage 143 */
  --radius-lg: 6px;
  --radius-xl: 8px;
  --radius-full: 9999px;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px -4px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px -8px rgba(0,0,0,0.10);
  --shadow-focus: 0 0 0 3px rgba(140,79,255,0.3);

  /* Sidebar 组件 token */
  --sidebar-bg:              var(--color-neutral-800);
  --sidebar-fg:              rgba(255,255,255,0.76);
  --sidebar-fg-muted:        #babdbb;
  --sidebar-item-hover-bg:   rgba(255,255,255,0.05);
  --sidebar-item-active-bg:  rgba(255,255,255,0.08);
  --sidebar-width:           160px;
  --sidebar-width-collapsed: 52px;
}

/* ── 深色主题 ── */
.dark {
  --bg-base:      var(--color-neutral-900);   /* #17191f Datadog 真实 */
  --bg-subtle:    #202f38;
  --bg-muted:     #1d1c1f;
  --bg-elevated:  #373b46;

  --fg-primary:   var(--color-neutral-50);    /* #f3f9fc */
  --fg-secondary: #d4d1d6;
  --fg-tertiary:  #8f969a;
  --fg-disabled:  rgba(255,255,255,0.2);

  --border-default: rgba(255,255,255,0.2);
  --border-subtle:  rgba(255,255,255,0.12);
  --border-strong:  rgba(255,255,255,0.3);

  --accent-primary: var(--color-purple-500);  /* 深色主题用亮紫 #8c4fff */
}
```

---

## 新 tailwind.config.js

**规则**：每一个 color、radius、shadow **都指向 `var(--...)`**，禁止 hex 字面量。

放置路径：`frontend/tailwind.config.js`（覆盖现有）
完整内容：见 `proposed-files/tailwind.config.js`

关键片段：

```js
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'var(--bg-base)',
          subtle:   'var(--bg-subtle)',
          muted:    'var(--bg-muted)',
          elevated: 'var(--bg-elevated)',
        },
        fg: {
          primary:   'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          tertiary:  'var(--fg-tertiary)',
          disabled:  'var(--fg-disabled)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle:  'var(--border-subtle)',
          strong:  'var(--border-strong)',
        },
        accent: {
          primary:  'var(--accent-primary)',
          brand:    'var(--accent-brand)',
          pink:     'var(--accent-pink)',
          success:  'var(--accent-success)',
          warning:  'var(--accent-warning)',
          danger:   'var(--accent-danger)',
          critical: 'var(--accent-critical)',
          info:     'var(--accent-info)',
        },
        severity: {
          ok:       'var(--severity-ok)',
          warn:     'var(--severity-warn)',
          alert:    'var(--severity-alert)',
          critical: 'var(--severity-critical)',
          'no-data': 'var(--severity-no-data)',
          unknown:  'var(--severity-unknown)',
        },
        chart: {
          1: 'var(--chart-1)', 2: 'var(--chart-2)', 3: 'var(--chart-3)',
          4: 'var(--chart-4)', 5: 'var(--chart-5)', 6: 'var(--chart-6)',
          7: 'var(--chart-7)', 8: 'var(--chart-8)', 9: 'var(--chart-9)',
          10: 'var(--chart-10)',
        },
        // Legacy 兼容（迁移期间保留，迁完删除）
        brand: {
          500: 'var(--accent-primary)',
          600: 'var(--accent-brand)',
          // ... 只保留组件用到的
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)', md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)', focus: 'var(--shadow-focus)',
      },
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
      },
      // 保留：字号、字体、动画、z-index、aspectRatio
      // ... 从现有 config 拷贝这些不变
    },
  },
  plugins: [],
};
```

---

## `src/lib/tokens.ts`（JS 消费专用）

**用途**：ECharts / Canvas / 动画等**不能用 CSS class** 的场景。**其他任何场景禁止用这个文件**。

放置路径：`frontend/src/lib/tokens.ts`
完整内容：见 `proposed-files/tokens.ts`

```typescript
/**
 * 只用于 ECharts / Canvas 等 JS 场景。
 * UI 组件禁止 import 这个文件，请用 Tailwind class（bg-bg-base 等）。
 */

/** ECharts series 循环用 */
export const chartColors = [
  '#8c4fff', '#128fea', '#01a88d', '#ed7100', '#e7157b',
  '#41eba4', '#5bceff', '#fec866', '#c925d1', '#7aa116',
] as const;

/** 严重程度色（monitor 类组件）*/
export const severityColors = {
  ok:       '#41c464',
  warn:     '#deab3e',
  alert:    '#eb364b',
  critical: '#ca0812',
  'no-data': '#828ba4',
  unknown:  '#c4c4c4',
} as const;

/** 图表网格线 */
export const chartGridColor = 'var(--border-subtle)';

export type ChartColor = typeof chartColors[number];
export type SeverityKey = keyof typeof severityColors;
```

---

## 图片资源规范

**放置路径**：`frontend/public/tokens/` （用于 Story / 参考图）
**命名**：`<component-name>.<variant>.png`（kebab-case）

例：`metric-card.default.png` `metric-card.critical.png` `sidebar.expanded.png`

---

## 主题切换机制

现有 `useTheme` hook 需要改成写 CSS class：

```typescript
// hooks/useTheme.tsx 里的 toggleTheme
useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
}, [theme]);
```

这样切换主题**只改 `<html>` 上的 class**，所有 CSS 变量自动重算，无需重渲染组件。

---

## 验收标准

- [ ] `frontend/src/styles/tokens.css` 存在，涵盖所有 primitive + semantic + `.dark`
- [ ] `frontend/tailwind.config.js` 里所有 color 值都是 `var(--...)`，无 hex 字面量（`grep -E "#[0-9a-fA-F]{3,6}" frontend/tailwind.config.js` 应返回 0 匹配）
- [ ] `frontend/src/lib/tokens.ts` 只包含 chartColors / severityColors
- [ ] `frontend/src/theme.ts` **删除**（或标记 `@deprecated`）
- [ ] `frontend/src/main.tsx` 顶部 `import './styles/tokens.css';`
- [ ] `document.documentElement.classList` 上加 `.dark` 后深色主题可用
