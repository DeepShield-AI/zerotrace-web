# 现状分析

**范围**：`zerotrace-web/frontend/`（React + Vite + Tailwind + Ant Design + ECharts 混栈）
**版本**：截至本次分析时点
**总规模**：`pages/` 7714 行 · `components/` 6435 行 · 30+ 组件、20+ 页面

## 问题清单（按修复优先级）

### 🔴 P0（阻碍长期维护，必须修）

#### 1. 设计 token 有 3 个真相源

| 位置 | 内容 | 消费者 |
|---|---|---|
| `frontend/src/theme.ts` | RGB 字符串（`rgb(41,46,57)`）| 组件里通过 `style={{ backgroundColor: T.brand.error }}` 用 |
| `frontend/tailwind.config.js` | Hex（`#632CA6`）| Tailwind class（`bg-brand-600`）|
| `frontend/src/index.css` | CSS 变量（`--sidebar-bg: #292e39`）| 全局 CSS 规则 |

**症状**：想改主色要同时改 3 处；深色模式在第三份里 hardcode 一堆 antd override（80+ 行）；`theme.ts` 里的 `brand.error = '#E65C5C'` 和 tailwind 里的 `status.danger = '#E65C5C'` 值一样但字段名不同，将来必然漂移。

**证据**：`grep tokens\. frontend/src/` 显示只有 2 个文件用 `theme.ts`（`ApmServicesView.tsx`、可能还有一个），但里面写了 40+ 处 `style={{ backgroundColor: T.xxx }}`——这些**完全绕开了 Tailwind**，主题切换永远无效。

#### 2. faker 装了但**一行都没用**

```json
"@faker-js/faker": "^10.5.0"   // package.json
```

```bash
grep -r "@faker-js/faker" frontend/src → 0 matches
```

**症状**：所有 mock 数据要么写死在组件里，要么依赖后端启动才能开发。新组件开发必须先跑 Rust 后端 + MySQL + ClickHouse，门槛过高。

#### 3. `CLAUDE.md` 几乎没有内容

当前内容：15 行，全部是关于 `tools/vision/vision.js` 识图工具的说明。**没有**：
- 开发工作流（怎么跑起来、怎么加组件、怎么改 token）
- 代码规范（何时用 Tailwind vs `style={{}}` vs `theme.ts`）
- Ant Design 何时用、何时别用
- 提交前检查项

**后果**：AI agent 每次进项目都要重新推断规范，产出漂移。

---

### 🟠 P1（会持续拖慢开发速度）

#### 4. Ant Design 和自研 UI 层并存但无边界

- 18 个文件 `from 'antd'`
- `src/components/ui/` 是自研原语（`Table`、`Badge`、`Modal` 等）
- **两套东西同名**：`ui/Table.tsx` 里有 `<Table>`，antd 也有 `<Table>`；`ui/Modal` 和 antd `<Modal>` 并存

**症状**：新页面写的人随手挑，风格漂移；深色模式要为 antd 单独写 override，`index.css` 尾部 100 行都是 antd 补丁。

#### 5. `datadog-capture/` 是 20+ 个 ad-hoc 脚本

```
scripts/cap_dd.js, cap_dd2.js, cap_dd3.js ... cap_dd9.js
scripts/cap_final.js, cap_apm_full.js, cap_apm_full_interact.js
```

**症状**：命名无规律，找不到入口；`libs/` 里塞了 Ubuntu Chromium 系统库（几十 MB），仓库体积膨胀；`datadog-capture/outputs/screenshots/` 混着 `image3.bmp / test.png / apm-detail2/` 各种命名。

#### 6. 没有组件隔离环境（Storybook / Ladle）

开发一个 `MetricCard` 变体，只能开完整应用、跳到用到它的页面、看效果。**这直接决定了 AI 生成组件后没法自验收**。

#### 7. 视觉参考图无组织

`datadog-capture/outputs/screenshots/` 目录扁平堆放，文件名如 `image20.bmp`、`test.png`，看不出哪个是哪个页面的参考。

---

### 🟡 P2（可以晚点做）

#### 8. `index.css` 338 行，混装 5 类内容

变量、base、components、utilities、antd override 全混一起。深色模式的规则也散落其中，没法按主题拆分。

#### 9. 页面文件过大

`ZerotracePricing.tsx` 773 行、`AgentSetup.tsx` 691 行、`TraceDetail.tsx` 620 行。业务逻辑、UI、格式化函数全塞一起。

#### 10. `api/client.ts` 一个文件所有接口

单文件 300+ 行、40+ 个端点，找一个接口靠 Ctrl+F。

---

## 现状**做对了**的地方（保留）

不是全盘否定，以下值得保留：

- ✅ **技术栈选型合理**：React + Vite + TS + Tailwind + ECharts 是这类场景的行业主流
- ✅ **i18n 已就位**：`i18next` + zh-CN/en-US 齐全，别拆
- ✅ **有真实后端 API**：Rust/Axum 后端和 40+ REST endpoint，比纯前端 demo 靠谱
- ✅ **有 Guardian AI 检测模块**：这是产品差异化的核心
- ✅ **有 `useAuth / usePageContext / useTheme` 三个 provider**：结构合理
- ✅ **Tailwind 配置里的字号、阴影、动画曲线设计克制**：`h1-h6` 的字号阶梯、`spring` 缓动曲线都能保留

---

## 修复不需要做的事（先说清楚）

| 反直觉但正确的决定 | 理由 |
|---|---|
| ❌ 不迁移到 Next.js | 详见 `01-STACK-DECISION.md`，迁移成本 > 收益 |
| ❌ 不删 Ant Design | 深度依赖，拆除成本极高。改为**规范其使用边界** |
| ❌ 不重写现有 30+ 组件 | 只做增量迁移（新组件用新规范，旧的慢慢重构）|
| ❌ 不引入 CSS-in-JS（styled-components / emotion）| 会和 Tailwind 打架，且 SSR 无关不需要 |

---

## 影响面总结

| 修复项 | 需要改动的文件数（估）| 风险 |
|---|---|---|
| Token 三源合一 → CSS 变量 | 5-8（config、theme.ts、index.css、`ApmServicesView.tsx` 等）| 低（增量迁移）|
| 加 faker mock 层 | 新建 3-5 个文件 | 无（不影响运行）|
| 写 CLAUDE.md + 规范文档 | 新建 6-8 个 doc | 无 |
| Storybook 集成 | 新建 `.storybook/` + 每组件加 `.stories.tsx` | 低 |
| Antd/自研 UI 边界 | 只改文档，不动代码 | 无 |
| 参考图重组 | 移动文件 | 无 |

**总结**：多数是**加东西 + 写文档**，真正改代码的部分范围可控。
