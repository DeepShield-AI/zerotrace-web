# APM 页面差距分析 — 我们 vs Datadog

## 一、总览

| 页面 | 行数 | style={{}} | 使用 ui/ | 状态 |
|------|------|-----------|---------|------|
| `APM.tsx` | 227 | 4 ✅ | 1 ⚠️ | 主体完成 |
| `ServiceDetail.tsx` | 320 | 6 ⚠️ | 0 ❌ | 需迁移 |
| `TraceDetail.tsx` | 620 | 17 ❌ | 0 ❌ | 需重写 |
| `TracesExplorer.tsx` | 243 | 34 ❌ | 0 ❌ | 最严重 |
| `ApmServicesView.tsx` | 178 | 0 ✅ | 0 ⚠️ | 样式OK |
| `ApmDemos.tsx` | 241 | 0 ✅ | 0 ⚠️ | 样式OK |
| `TopologyMap.tsx` | 448 | 5 ⚠️ | - | 画布组件 |
| **总计** | **2,277** | **66** | **1** | |

## 二、逐页分析

### 1. APM.tsx (227 行) — 75% 完成

✅ **已实现**:
- Intro Page (Getting Started) — Tailwind 类名
- Tab Bar + 搜索框 + 快捷筛选胶囊
- Services/Traces/Topology 视图切换
- Facets 侧栏 (StatusDot + 面筛按钮)
- 状态机 (loading/empty/error/data)

❌ **差距**:
- Services 页缺少图表行（Request Rate/Latency/Errors 迷你图）
- Traces 页缺少 Duration Distribution 直方图
- 表格没有粘性表头 (sticky header)
- 缺少 "Load more" 的无限滚动
- Tab 切换没有 URL 参数同步
- 时间选择器不能自定义范围

### 2. ServiceDetail.tsx (320 行) — 40% 完成

✅ **已实现**:
- Overview 指标卡片
- Operations 表格
- 延迟趋势图 (eCharts)

❌ **差距**:
- 全部使用内联 style={{}}
- Resources tab 未实现
- Traces tab 未实现（需要按 service 筛选 traces）
- Infrastructure tab 未实现
- 缺少 Apdex 指标
- 缺少部署标记 (deployment markers)
- 表格无排序

### 3. TraceDetail.tsx (620 行) — 50% 完成

✅ **已实现**:
- Flame Graph (SVG 瀑布图)
- Span 列表
- Segmented 视图切换 (Waterfall/Table/Flame Graph)
- 错误标记

❌ **差距**:
- 17 处内联 style={{}}
- Span 详情 popover 未实现
- Logs tab (关联日志) 未实现
- Host Metrics tab 未实现
- SQL Query tab 未实现
- Span 着色不够细粒度 (Datadog 按 service/method 着色)
- 缺少 span tooltip (点 span → 显示 tags/duration/service)

### 4. TracesExplorer.tsx (243 行) — 30% 完成, 最差

✅ **已实现**:
- Facet sidebar (Status, Duration, Services)
- Traces 表格 (Date/Service/Resource/Duration/Status)
- "Load more" 分页
- 加载/空/错误状态

❌ **差距**:
- **34 处 style={{}}** — 最严重
- Duration 进度条是内联 style
- 缺少 Distribution 直方图 (可拖拽选择范围)
- 缺少快捷筛选下拉 (Service autocomplete)
- 没有 LIVE 实时模式
- 没有 "Pause/Play" 控件
- State 嵌套 condition 多，可读性差

### 5. TopologyMap.tsx (448 行) — 80% 完成

✅ **已实现**:
- 节点/边渲染
- 缩放/平移
- Hover 高亮
- Layout 切换 (force/circular)
- Sizing 切换 (requests/latency/errors)

❌ **差距**:
- 5 处 style={{}}
- 节点大小不能按指标动态变化
- 边粗度不按流量变化
- 无 tooltip
- 无 legend

## 三、交互模式差距

| 交互 | Datadog | 我们 | 差距 |
|------|---------|------|------|
| 表格行 hover | 浅紫背景 + 行末操作按钮浮现 | 浅紫背景 | 缺操作按钮 |
| 面筛点击 | URL参数更新 + 表格重新加载 | 仅表格重新加载 | 缺 URL 持久化 |
| 时间选择 | 拖拽选择 / 快捷按钮 / 自定义 | 快捷按钮 | 缺拖拽 |
| Load More | 无限滚动 | 手动按钮 | 需无限滚动 |
| Trace 行点击 | 右侧滑出详情面板 | 页面跳转 | 应为滑出面板 |
| 表格列排序 | 点击列头 ↑↓ | 部分实现 | 缺面筛表头 |
| 搜索 | 实时语法高亮 + 建议下拉 | 延迟搜索 | 缺语法建议 |

## 四、修复优先级

### P0 — 本周
1. **TracesExplorer** — 34 个 style={{}} → 迁移到 Tailwind + ui/ 组件
2. **TraceDetail** — 17 个 style={{}} → 迁移到 Tailwind
3. 表格粘性表头 (sticky header)
4. 所有表格统一使用 `Table` 组件

### P1 — 下周
5. ServiceDetail — 6 个 style={{}} → 迁移
6. Duration Distribution 直方图 (可拖拽)
7. Trace 行点击 → 右侧滑出面板 (SlidePanel)
8. 面筛 URL 参数同步

### P2 — 后续
9. LIVE 实时模式
10. Span 详情 tooltip
11. 搜索语法建议
12. Service Detail Resources/Traces/Infrastructure tabs
