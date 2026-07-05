# 指标浏览器（Metrics Explorer）

**路径**：`/metrics`
**Datadog 原始 URL**：`https://app.datadoghq.com/metric/explorer`
**参考说明**：基于 Datadog Metrics Explorer 公开文档和产品截图分析。

## 精确布局

Datadog Metrics Explorer 是左右两栏布局：

```
┌──────────────────────────────────────────────────────────┐
│ Metrics Explorer                  [时间选择器]  [刷新]    │  A: header
├──────────────┬───────────────────────────────────────────┤
│ [🔍 搜索]    │  system.cpu.usage                         │  B: metric-browser
│              │  gauge · 指标描述                          │  C: metric-info
│ ▾ system(3)  │                                           │
│   cpu.usage   │  Agg: [avg ▼] by  [host ▼]              │  D: agg-controls
│   mem.used    │  ┌───────────────────────────────────┐   │
│   disk.free   │  │       Timeseries Chart             │   │  E: chart
│ ▸ network(2) │  │       (line + area fill)           │   │
│ ▸ apm(3)     │  └───────────────────────────────────┘   │
│ ▸ custom(1)  │                                           │
│              │  ┌───────────────────────────────────┐   │
│              │  │  Distribution                     │   │  F: distribution
│              │  │  host:web-01  ████████  45.2%     │   │
│              │  │  host:db-01   ██████    32.1%     │   │
│              │  │  host:cache   ████      12.8%     │   │
│              │  └───────────────────────────────────┘   │
│              │                                           │
│              │  ┌───────────────────────────────────┐   │
│              │  │  Top Values (when grouped)        │   │  G: top-list
│              │  │  web-01.prod   1,234   45.2%      │   │
│              │  │  db-01.prod      876   32.1%      │   │
│              │  └───────────────────────────────────┘   │
└──────────────┴───────────────────────────────────────────┘
```

| # | 名称 | 内容 | Datadog 精确行为 |
|---|---|---|---|
| A | header | 页面标题 + 时间选择器 + 刷新 | 无额外操作按钮 |
| B | metric-browser | 搜索 + 分类折叠树 | **无 Compare 按钮**。每项仅显示名称+类型标签 |
| C | metric-info | 指标名 + 路径 + 类型 + 描述 | **无 Copy/Dashboard 按钮**。纯信息展示 |
| D | agg-controls | 聚合下拉 + by 下拉 | 无 "Time Series" 大写标题。直接接图表 |
| E | chart | 时序折线图 area fill | 按"by"分组时显示多条线 |
| F | distribution | 水平柱状图 Tag 值分布 | **Datadog 核心面板**。每行 = tag值 + 百分比条 + 占比数字 |
| G | top-list | 分组后的 Top 值表格 | 仅当选择 "by" 维度时显示 |

## 与上一版的差异

| 上一版 | 本版（对齐 Datadog） |
|--------|---------------------|
| 有 "+ Compare" 对比按钮 | **去掉**。Datadog 无此功能 |
| 有 Copy/Dashboard 按钮 | **去掉** |
| 有 "Time Series" 大写标题 | **去掉** |
| 有 "Tag Distribution" 独立面板 | 改为 Distribution（精确样式） |
| 无 Top List | **新增**：按 by 分组时显示 |

## 组件清单

| 区块 | 组件 | 状态 |
|------|------|------|
| A | TimeRangePicker | 已有 |
| B | MetricBrowser | 重写（去掉 Compare 按钮） |
| C | MetricInfoBar | 重写（仅展示，无按钮） |
| D | AggregationControls | 改造成紧凑一行 |
| E | TimeseriesChart | 已有 ReactECharts + buildChartOption |
| F | DistributionPanel | **新建**：水平条 + 百分比 |
| G | TopListTable | **新建**：分组值表格 |

## 交互

- 左侧点击指标 → 右侧更新全部面板
- 搜索过滤 → 实时过滤左侧列表
- 聚合/by 改变 → 图表/分布/top list 重取
- 时间范围改变 → 全部重取
- **无"对比"交互**

## Parity Checklist

| 检查项 | 
|--------|
| L1 布局: 左260px + 右自适应，无多余 UI |
| L2 Token: 全链路语义 token |
| L3 交互: 点击指标同步更新 3 个面板（图表+分布+top list） |
