# 指标浏览器（Metrics Explorer）

**路径**：`/metrics`
**Datadog 原始 URL**：`https://app.datadoghq.com/metric/explorer`
**估算工时**：8 小时

## 区块划分

Datadog Metrics Explorer 是左右两栏布局：左侧 280px 指标浏览器，右侧为图表和详情区域。

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|
| A | `page-header` | 顶部 | 页面标题 "Metrics Explorer"、时间选择器、刷新按钮 |
| B | `metric-browser` | 左侧 280px | 搜索框、按分类折叠的指标树、每项显示名称+类型、"Compare" 切换 |
| C | `metric-header` | 右侧上部 | 选中指标的名称、完整路径、类型标签、描述、操作按钮(Copy/Dashboard) |
| D | `stat-strip` | 右侧上部 | 4 个 StatCard：Latest/Average/Maximum/Minimum，Latest 含 MiniSparkline |
| E | `chart-toolbar` | 图表区顶部 | 聚合选择器 (avg/sum/min/max/count by host/service/env/...)、Tag 筛选下拉、概要文字 |
| F | `timeseries-chart` | 图表区中部 | 时序折线图，可多条叠加。选择 "by" 维度时分多条系列。含 area fill |
| G | `comparison-bar` | 图表区底部 | 正在对比的指标列表，每项可移除 |
| H | `tag-distribution` | 图表区下方 | 水平柱状图，展示所选指标的 Tag 分布 Top 15 |

## 组件清单

| 区块 | 组件 | 状态 | 位置 | 备注 |
|---|---|---|---|---|
| A | TimeRangePicker | 已有 | `components/shared/TimeRangePicker.tsx` | 直接用 |
| B | MetricBrowser | 新建 | `pages/Metrics/index.tsx` 内联 | 含搜索+折叠分类树+Compare 按钮 |
| C | MetricHeader | 新建 | `pages/Metrics/index.tsx` 内联 | 指标名、路径、类型、操作按钮 |
| D | StatCard | 已有 | `components/ui/StatCard.tsx` | 直接用，含 sparkline |
| D | MiniSparkline | 已有 | `components/ui/MiniSparkline.tsx` | StatCard 内部使用 |
| E | AggregationSelector | 新建 | `pages/Metrics/index.tsx` 内联 | Select × 2：聚合函数 + by 维度 |
| E | TagFilterDropdown | 新建 | `pages/Metrics/index.tsx` 内联 | 基于 tag API 的多选下拉 |
| F | TimeseriesChart | 改造 | 用 `ReactECharts` + `buildChartOption()` | 支持单系列(area fill)和多系列(分组+对比) |
| G | ComparisonOverlay | 新建 | `pages/Metrics/index.tsx` 内联 | 对比列表+移除按钮 |
| H | TagDistributionChart | 新建 | `pages/Metrics/index.tsx` 内联 | 水平柱状图 Top 15 |

## 数据依赖

| API | 返回形状 | Mock generator |
|---|---|---|
| `GET /metrics/list` | `{ metrics: MetricDef[] }` | `genMetricsList()` |
| `GET /metrics/query?name=X&agg=avg&by=host&filter=...` | `{ points: MetricPoint[], groups?: string[] }` | `genMetricPoints(name, count, agg, by)` |
| `GET /metrics/tags?name=X` | `{ tags: TagDef[] }` | `genMetricTags(name)` |

## 交互

- 左侧点击指标 → 右侧更新图表、统计、tag 分布
- 搜索框输入 → 实时过滤指标列表
- "by" 维度选择 → 图表从 1 条线变为按维度分组的 N 条线
- Tag 筛选 → 过滤图表数据，queryKey 变化触发 useQuery 重取
- "+ Compare" → 叠加其他指标，最多 3 条
- 时间范围改变 → 所有关联 query 重取
- 聚合函数改变 → query 重取

## Known Deviations（与 Datadog 的有意差异）

- 没有公式编辑器（Datadog 支持算术表达式）
- "Add to Dashboard" 跳转到仪表板页面而非直接嵌入
- 没有表格视图切换
- 没有导出 CSV 功能
- Tag 分布图用 ECharts 水平柱状图而非 Datadog 的专用 UI

## Parity Report

| 检查项 | 状态 |
|--------|------|
| L1 布局 (左280px右自适应、StatCards 4列、chart区) | ✅ |
| L2 Token (语义 token 全链路、无 hardcoded 色) | ✅ |
| L3 交互 (选指标刷新图、by host 分组、对比叠加) | ✅ |
