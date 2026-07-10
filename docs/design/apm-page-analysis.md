# APM 页面布局与内容分析

## 一、页面结构

```
APM.tsx (222 行)
├── Intro Page (无数据时)
│   ├── Header: "APM" + 时间选择器
│   ├── Left Sidebar: Setup / Rules / Errors 导航
│   └── Main Content:
│       ├── Setup: Hero + 语言选择 + CTA按钮 + 功能卡片(3张)
│       ├── Rules: 空状态
│       └── Errors: 空状态
│
└── Data Views (有数据时)
    ├── Header: "APM" + 时间选择器
    ├── Tab Bar: Services | Traces | Service Map | Settings
    ├── Search Bar (仅 Traces 可见)
    ├── Filter Pills (仅 Traces 可见)
    │
    ├── Services View
    │   └── ApmServicesView 组件 (服务列表 + 排序 + 筛选 + 收藏)
    │
    ├── Traces View
    │   ├── Demo Tabs: All Traces | Slow Requests | Error Analysis
    │   ├── Facet Sidebar (Status + Duration 面筛)
    │   ├── Traces Table (DATE/SERVICE/RESOURCE/DURATION/STATUS)
    │   ├── SlowRequestsPanel (慢请求列表 + 延迟分布)
    │   └── ErrorAnalysisPanel (错误聚合 + Top错误端点)
    │
    └── Topology View
        ├── TopologySidebar
        └── TopologyMap
```

## 二、数据流

```
用户操作 → URL Params → State → API → ClickHouse → 渲染
                                           ↑
                                        每 10s 轮询
```

| 视图 | API | 数据源 |
|------|-----|--------|
| Services | `GET /apm/services` + `GET /apm/stats` | `l7_flow_log` 按 `request_domain` 聚合 |
| Traces | `GET /apm/traces` | `l7_flow_log` 按 `flow_id` 分组 |
| Slow Requests | `GET /apm/slow-requests` | `l7_flow_log` WHERE `response_duration > 500ms` |
| Error Summary | `GET /apm/error-summary` | `l7_flow_log` WHERE `response_code >= 400` |
| Topology | `GET /apm/topology` | `l7_flow_log` 自关联 |

## 三、使用的 12 个组件

| 组件 | 文件 | 使用位置 |
|------|------|---------|
| `ApmServicesView` | ApmServicesView.tsx | Services 列表 |
| `SlowRequestsPanel` | ApmDemos.tsx | 慢请求 Demo |
| `ErrorAnalysisPanel` | ApmDemos.tsx | 错误分析 Demo |
| `SearchInput` | ui/Table.tsx | 搜索框 |
| `FilterBar` | ui/Filter.tsx | 快捷筛选胶囊 |
| `Badge` | ui/Table.tsx | 状态徽章 |
| `StatusDot` | ui/Indicators.tsx | 面筛状态点 |
| `EmptyState` | ui/Table.tsx | 空/错误状态 |
| `TableSkeleton` | ui/Table.tsx | 加载骨架 |
| `TimeRangePicker` | TimeRangePicker.tsx | 时间选择 |
| `TopologyMap` + `TopologySidebar` | TopologyMap.tsx | 拓扑图 |

## 四、状态管理 (23 个 state)

| 用途 | 变量 | 类型 |
|------|------|------|
| 视图 | `view`, `demoView`, `activeNav` | services/traces/topology |
| 数据 | `services`, `traces`, `stats`, `topoNodes/Edges` | API 响应 |
| 状态 | `svcState`, `trState`, `topoLoading` | loading/empty/error/data |
| 筛选 | `rawQuery`, `facetStatus/Service/Duration` | 搜索 + 面筛 |
| 分页 | `traceOffset`, `traceTotal` | 加载更多 |
| 拓扑 | `topoSizing/Layout/Highlighted` | 图表配置 |

## 五、当前状态

### ✅ 可用
- Services 列表 (真实 ClickHouse 数据)
- Traces 表格 (按 flow_id 分组)
- 慢请求面板 (按延迟筛选)
- 错误分析面板 (按状态码聚合)
- 面筛侧栏 (Status + Duration)
- 快捷筛选胶囊 (All/Slow/Errors)
- Demo 标签切换

### ❌ 缺失
- Trace 详情瀑布图 (无 span 数据)
- 服务对比视图
- Live Tail 实时流
- 部署关联
- APM Recommendations
