# Frontend Standards

**背景**：项目的前端（`frontend/`）经历过多轮迭代，形成了 token 分散、组件规范不统一、mock 数据缺失等历史遗留。这套文档给出**分析 + 决策 + 执行路线**，用于把项目带到工程化基线。

**读者**：项目开发者、AI agent、Code reviewer。

**约束**：目标机器**没有** Claude CLI，本套文档所有工具链都是普通 Node 脚本。

---

## 阅读顺序

**新入项目**：按顺序读一遍，1 小时全部读完。

| # | 文档 | 目的 |
|---|---|---|
| 0 | [00-ANALYSIS.md](./00-ANALYSIS.md) | 现状问题清单，按 P0/P1/P2 分级 |
| 1 | [01-STACK-DECISION.md](./01-STACK-DECISION.md) | 为什么不迁 Next.js（简答：不需要 SSR）|
| 2 | [02-DESIGN-SYSTEM.md](./02-DESIGN-SYSTEM.md) | Token 分层 + tokens.css 规范 |
| 3 | [03-MIGRATION-PLAYBOOK.md](./03-MIGRATION-PLAYBOOK.md) | 现有代码迁移到新 token 系统的 diff 级步骤 |
| 4 | [04-COMPONENT-STANDARDS.md](./04-COMPONENT-STANDARDS.md) | 组件开发规范：模板、DO/DON'T、反模式 |
| 5 | [05-MOCK-DATA.md](./05-MOCK-DATA.md) | MSW + Faker 假数据方案 |
| 6 | [06-PIPELINE-SALVAGE.md](./06-PIPELINE-SALVAGE.md) | 从外部 token-pipeline 借鉴什么、丢弃什么 |
| 7 | [07-ROADMAP.md](./07-ROADMAP.md) | 项目现代化的有序任务清单 |
| 8 | [08-PAGE-DEV-WORKFLOW.md](./08-PAGE-DEV-WORKFLOW.md) | **页面开发全流程**（6 Phase）：从 Datadog 参考到上线的完整套路 |
| 9 | [09-FAKER-CONVENTIONS.md](./09-FAKER-CONVENTIONS.md) | Faker mock 数据规范：命名、结构、种子、时序游走 |
| 10 | [10-STORYBOOK-CONVENTIONS.md](./10-STORYBOOK-CONVENTIONS.md) | Ladle/Storybook 使用规范 + 4 类 Story 模板 |
| 11 | [11-PARITY-METHOD.md](./11-PARITY-METHOD.md) | Datadog 视觉对齐方法：L1 结构 / L2 色彩 / L3 像素三级度量 |

**日常查阅**：项目根 `CLAUDE.md` 是索引，按需跳转。

---

## proposed-files/

可直接落到项目里的产品级文件（复制粘贴即可）：

- `tokens.css`         — 完整 CSS 变量表（放到 `frontend/src/styles/tokens.css`）
- `tailwind.config.js` — 消费 CSS 变量的 Tailwind 配置（覆盖 `frontend/tailwind.config.js`）
- `tokens.ts`          — ECharts 用的 JS 常量（放到 `frontend/src/lib/tokens.ts`）

**用法**：不要一次全部拷贝并 push。按 [07-ROADMAP.md](./07-ROADMAP.md) M1 的顺序，一个 commit 一步。

---

## 关键决策速查

| 问题 | 答案 | 详情 |
|---|---|---|
| 迁 Next.js？ | ❌ 不迁 | [01](./01-STACK-DECISION.md) |
| 删 Ant Design？ | ❌ 不删 | [00 § 保留](./00-ANALYSIS.md) |
| Token 存哪？ | `frontend/src/styles/tokens.css` | [02](./02-DESIGN-SYSTEM.md) |
| ECharts 颜色从哪拿？ | `frontend/src/lib/tokens.ts` | [02 § tokens.ts](./02-DESIGN-SYSTEM.md) |
| mock 数据用什么？ | MSW + `@faker-js/faker` | [05](./05-MOCK-DATA.md), [09](./09-FAKER-CONVENTIONS.md) |
| Storybook？ | 推荐 Ladle | [10](./10-STORYBOOK-CONVENTIONS.md) |
| datadog-capture 怎么整？ | 保留 4 个脚本 + README | [06 § A](./06-PIPELINE-SALVAGE.md) |
| 用不用 Claude CLI？ | ❌ 目标机器没有，不引入 | [06 § F](./06-PIPELINE-SALVAGE.md) |
| 做新页面从哪开始？ | 从 [08](./08-PAGE-DEV-WORKFLOW.md) Phase 1 | 6 Phase 走完 |
| 怎么判断"和 Datadog 一致"？ | L1 结构 100% + L2 色彩 100% + L3 像素 <15% | [11](./11-PARITY-METHOD.md) |

## 场景速查

**我要做新页面** → 主线 [08](./08-PAGE-DEV-WORKFLOW.md)，配合 [09](./09-FAKER-CONVENTIONS.md) 造数据、[10](./10-STORYBOOK-CONVENTIONS.md) 写 Story、[11](./11-PARITY-METHOD.md) 验收

**我要改颜色/字号/间距** → [02](./02-DESIGN-SYSTEM.md) 找规范 → 改 `tokens.css`

**我要迁老组件到新 token** → [03](./03-MIGRATION-PLAYBOOK.md) 按步骤

**我要加 mock 数据** → [09](./09-FAKER-CONVENTIONS.md) 规范 + [05](./05-MOCK-DATA.md) 结构

**我要写 Storybook** → [10](./10-STORYBOOK-CONVENTIONS.md) 4 类模板

---

## 交付验收（全流程完成后）

- [ ] `frontend/src/styles/tokens.css` 存在，包含 Layer 1/2/3 三层变量 + `.dark` 覆盖
- [ ] `frontend/tailwind.config.js` 所有 color 都是 `var(--...)`
- [ ] `frontend/src/theme.ts` 已删除
- [ ] `frontend/src/lib/tokens.ts` 只放 chartColors + severityColors
- [ ] `frontend/src/mocks/` 存在，`pnpm dev:mock` 能不依赖后端跑通所有页面
- [ ] `frontend/src/hooks/useTheme.tsx` 支持一键切换深浅色
- [ ] `datadog-capture/scripts/` 只有 4-5 个明确命名的脚本
- [ ] `datadog-capture/README.md` 完整
- [ ] `datadog-capture/outputs/screenshots/` 按 `<page>-<component>.png` 命名
- [ ] `docs/dev/standards/components-catalog.md` 覆盖 10+ 组件
- [ ] 根 `CLAUDE.md` 更新为规范索引
- [ ] `pnpm check:no-hex` `pnpm check:no-inline-color` 通过
- [ ] （可选）Ladle 或 Storybook 集成，UI 原语有 story
