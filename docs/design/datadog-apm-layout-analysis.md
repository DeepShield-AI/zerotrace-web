# Datadog APM 全页面布局分析

## 一、全局架构

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar (36px) - Upgrade | Search ctrl+K | Ask Bits    │
├────────┬────────────────────────────────────────────────┤
│ Sidebar│  APM 主内容区                                   │
│ 160px  │                                                │
│        │  ┌─ APM Header: 标题 + 时间选择器 + 刷新 ──────┐│
│ 深色   │  │ Services | Traces | Service Map | Settings  ││
│ 导航   │  │ [搜索框 (仅 Traces)]                         ││
│        │  ├─────────────────────────────────────────────┤│
│        │  │                                             ││
│        │  │  内容区 (按选中 tab 切换)                     ││
│        │  │                                             ││
│        │  └─────────────────────────────────────────────┘│
│        │  Footer: 版权 + 状态                            │
└────────┴────────────────────────────────────────────────┘
```

## 二、五个核心页面

### 1. APM Home (Welcome / Getting Started)

```
┌──────────────────────────────────────────┐
│ Welcome to APM, [user]                    │
│ Get a real-time view of your system...    │
├──────────────────────────────────────────┤
│ [Services] [Endpoints] [Map]  选择视图    │
├──────────────────────────────────────────┤
│ Service List (表格)                       │
│ ┌──────┬─────────┬──────┬────────────┐   │
│ │ ★    │ Service │ Reqs │ P95 Latency│   │
│ │      │ Name    │      │            │   │
│ └──────┴─────────┴──────┴────────────┘   │
│                                          │
│ ⚡ Get Started banner (新用户)            │
│ "Instrument your application..."         │
│ [Select Language] [Copy Command]         │
└──────────────────────────────────────────┘
```

关键元素:
- Services/Endpoints/Map 三态切换
- 表格列: ★收藏 | 服务名 | 请求数 | P95延迟 | 错误率
- 新用户有 onboarding 横幅
- "View All in Software Catalog" 链接

### 2. Services (服务选择)

```
┌──────────────────────────────────────────┐
│ Choose an APM Service                     │
│ Search or select a favorited service       │
├──────────────────────────────────────────┤
│ 🔍 [Filter services...]                   │
├──────────────────────────────────────────┤
│ Service            Last Deploy            │
│ ★ zerotrace-web-fr  4d ago               │
│   node              5h ago               │
│   datadog-capture   5d ago               │
└──────────────────────────────────────────┘
```

关键元素:
- 搜索框
- 表格: Service 名 + 最后部署时间
- 收藏星标
- 每行可点击进入服务详情

### 3. Traces Explorer (链路搜索)

```
┌──────────────────────────────────────────┐
│ 🔍 [Search traces... service:name       │
│     status:error duration:>500ms] ⌘/    │
├──────┬───────────────────────────────────┤
│Facets│  ═══ 功能引导 Banner ═══          │
│      │  Search traces in one place       │
│Status│  Filter by custom span attributes │
│ ○ All│  Debug serverless problems fast   │
│ ○ OK │                                   │
│ ○ Err│  [Timeseries] [List] [Bar Chart]  │
│      │                                   │
│Duratn│  LIVE ●   Past 15 Minutes         │
│ <10ms│                                   │
│10-100│  No traces matching query          │
│100-1s│                                   │
│ >1s  │                                   │
├──────┴───────────────────────────────────┤
│ Top Services                              │
│ ○ api-gateway    12.3K ████████          │
│ ● user-service    8.1K ██████            │
└──────────────────────────────────────────┘
```

关键元素:
- 搜索框（语法高亮: service:/operation:/status:/duration:）
- Facet 侧栏 (200px): Status (All/OK/Error), Duration (<10ms/10-100ms/100ms-1s/>1s), Top Services
- 新用户引导 Banner: 3 个功能说明卡片
- 时间选择器: LIVE 模式 + 15分钟滚动窗口
- 可视化切换: Timeseries / List / Bar Chart
- 表格列: Date | Service | Resource | Duration (进度条) | Status (彩色徽章)

### 4. Traces (慢请求查询 duration:>500ms)

```
┌──────────────────────────────────────────┐
│ Query: duration:>500ms                    │
├──────┬───────────────────────────────────┤
│Facets│  Trace List                        │
│      │  ┌──────┬──────┬──────┬──────┬──┐ │
│      │  │ Time │ Srv  │ Res  │ Dur  │St│ │
│      │  ├──────┼──────┼──────┼──────┼──┤ │
│      │  │14:23 │ api  │/usr │1.2s  │OK│ │
│      │  │14:22 │ web  │/api │890ms │ER│ │
│      │  └──────┴──────┴──────┴──────┴──┘ │
└──────┴───────────────────────────────────┘
```

关键元素:
- 搜索框自动填入 `duration:>500ms`
- 表格按 Duration 降序排列
- Duration 列: 进度条 + 数字 (红色 > 1s)
- Status 列: OK (绿色徽章) / ERR (红色徽章)

### 5. Traces (错误查询 status:error)

```
┌──────────────────────────────────────────┐
│ Query: status:error                       │
├──────┬───────────────────────────────────┤
│Facets│  Error Trace List                  │
│      │  全部 trace 的 status=error         │
│      │  Duration Distribution 直方图       │
│      │  ▂▃▅█▇▄▂                           │
│      │  错误按 Service 分组统计            │
└──────┴───────────────────────────────────┘
```

关键元素:
- 错误 trace 列表 (红色高亮)
- Duration Distribution 直方图
- 按 Service 分组的错误统计

## 三、Datadog APM 页面流转

```
APM Home
  ├─ Services 列表 → 点击服务 → Service Detail (服务详情)
  │   ├─ Overview: 延迟/吞吐/错误仪表板
  │   ├─ Operations: 每个 API 的性能
  │   ├─ Resources: 每个 URL 的指标
  │   └─ Traces: 该服务的 trace 列表
  │
  ├─ Traces → 搜索筛选 → Trace Detail (trace 详情)
  │   ├─ Flame Graph (瀑布图)
  │   ├─ Span List (span 列表)
  │   ├─ Service Map (服务地图)
  │   └─ Logs (关联日志)
  │
  └─ Service Map → 点击节点 → Service Detail
```

## 四、与我们的实现对比

| Datadog | 我们 | 状态 |
|---------|------|------|
| APM Home (welcome) | 已实现 Intro Page | ✅ |
| Services 列表 | ApmServicesView | ✅ |
| Traces 搜索 | Traces view + SearchInput | ✅ |
| Facet 侧栏 | 内联 Facets (Status + Duration) | ✅ |
| 慢请求查询 | SlowRequestsPanel | ✅ |
| 错误查询 | ErrorAnalysisPanel | ✅ |
| 快捷筛选胶囊 | FilterBar + FilterPill | ✅ |
| Service Detail | ServiceDetail.tsx | ✅ 已有 |
| Trace Detail | TraceDetail.tsx | ✅ 已有 |
| Flame Graph (瀑布图) | ❌ 无 span 层级数据 | ❌ |
| Span List | ❌ 无 span 数据 | ❌ |
| APM Recommendations | ❌ 需 span 分析 | ❌ |
