# Datadog APM 完整页面布局深度分析

> 基于 Datadog 官方文档、Druids CSS 分析、截图结构提取、实测使用

## 一、全局布局框架

```
┌──────────────────────────────────────────────────────────────┐
│ Top Bar (36px, bg #292E39)                                   │
│ [Datadog Logo] [Upgrade]  [🔍 Search ctrl+K]     [✨Ask Bits]│
├─────────┬────────────────────────────────────────────────────┤
│ Sidebar │  Main Content Area                                 │
│ 160px   │  bg #F9FAFB                                        │
│         │                                                    │
│ 深色导航 │  ┌── APM Header ──────────────────────────────────┐│
│ 16+ 项  │  │ H1 "APM" + 时间选择器 + 刷新 + Settings       ││
│         │  ├── Tab Bar ─────────────────────────────────────┤│
│         │  │ [Services] [Traces] [Service Map] [Settings]   ││
│         │  ├── Content Area ────────────────────────────────┤│
│         │  │  (按选中 tab 切换内容)                          ││
│         │  └─────────────────────────────────────────────────┘│
│         │  Footer: © Datadog | All Systems Operational       │
└─────────┴────────────────────────────────────────────────────┘
```

## 二、Top Bar 详细规格

| 元素 | 样式 |
|------|------|
| Logo | Datadog 狗头图标 + "DATADOG" |
| Upgrade 按钮 | bg rgba(255,255,255,0.08), text rgba(255,255,255,0.82), 4px radius |
| 搜索框 | w 742px, bg rgba(255,255,255,0.08), placeholder "Search Datadog", 右侧 kbd "ctrlK" |
| Ask Bits 按钮 | 紫色渐变 + sparkle 图标, "Ask Bits" |
| 用户区 | 邮箱 + 头像 + 下拉菜单 |

## 三、Left Sidebar 完整导航树

```
ZEROTRACE / DATADOG (品牌区, 140px 高)
──────────────────────
🔍 Search...
──────────────────────
Bits AI (🤖)
  ├─ Bits Chat
  ├─ Bits Investigation
  └─ Bits Code
──────────────────────
Dashboards (📊)
  ├─ Dashboard List
  └─ New Dashboard
──────────────────────
Monitoring (🔔)
  ├─ Monitor List
  ├─ Triggered
  ├─ Downtimes
  └─ SLOs
──────────────────────
Infrastructure (🖥)
  ├─ Hosts
  ├─ Containers
  ├─ Processes
  └─ Host Map
──────────────────────
APM (📈) ← 高亮选中
  ├─ Services
  ├─ Traces
  ├─ Service Map
  ├─ Profiles
  └─ Settings
──────────────────────
Logs (📋)
Metrics (📉)
Security (🛡)
Integrations (🧩)
──────────────────────
Plan & Usage (💳)
──────────────────────
[Invite] [Support] [Help]
user@email.com
```

## 四、六个核心页面布局

### 1. APM Services 列表

```
┌── APM Header ───────────────────────────────────────────────┐
│ [Services] [Traces] [Map] [Settings]     ⏱ Past 1 Hour [⚙] │
├─────────────────────────────────────────────────────────────┤
│ Choose an APM Service                                        │
│ Search or select a favorited or recently deployed service     │
│                                                              │
│ 🔍 [Search services...]                   [View All in Software Catalog →] │
├─────────────────────────────────────────────────────────────┤
│  ★  Service               P95 Latency   Error Rate   Reqs   │
│  ☆  zerotrace-web-frontend    12ms        0.1%       1.2K   │
│  ☆  node                      45ms        2.3%       8.4K   │
│  ☆  datadog-capture            3ms        0.0%        156   │
├─────────────────────────────────────────────────────────────┤
│  All Systems Operational      © Datadog                     │
└─────────────────────────────────────────────────────────────┘
```

### 2. APM Traces Explorer

```
┌──┬──────────────────────────────────────────────────────────┐
│  │ 🔍 [Search traces… service:xxx operation:/api status:error duration:>500ms] ⌘/ │
│  │                                                           │
│F │ [All] [OK (3.2K)] [Error (47)]          ⏱ Past 15m [▶]  │
│A │                                                           │
│C │ Duration Distribution                                     │
│E │ ▂▃▅█▇▄▂▁                                                  │
│T │ 0-10ms 10-100ms 100-1s 1-5s 5s+                         │
│S │                                                           │
│  │ Timeseries | List | Top List | Table   [Export] [Columns] │
│  │                                                           │
│  │ DATE       SERVICE      RESOURCE     DURATION    STATUS   │
│  │ 14:23:01   api-gateway  GET /users   ████ 1.2s   [OK]    │
│  │ 14:22:58   web-store    POST /cart   ███ 890ms   [200]   │
│  │ 14:22:55   user-svc     GET /:id    ██ 450ms     [ERR]   │
│  │ 14:22:52   api-gateway  GET /health   █ 12ms      [OK]   │
│  │                                                           │
│  │ Showing 1-50 of 3,247 traces       [Load More]            │
└──┴──────────────────────────────────────────────────────────┘
```

### 3. Trace Detail (点击某条 trace)

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Traces          Trace: abc123def456                │
│ Status: OK  |  Duration: 1.2s  |  Services: 4  |  Spans: 23 │
├──────────────────────────────────────────────────────────────┤
│ [Flame Graph] [Waterfall] [Span List] [Map] [Errors] [Logs] │
├──────────────────────────────────────────────────────────────┤
│ Flame Graph / Waterfall View:                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ api-gateway ████████████████████████████████ 1.2s        │ │
│ │   ├─ auth-svc ████████ 450ms                             │ │
│ │   │   └─ redis ██ 12ms                                   │ │
│ │   ├─ user-svc ██████████████ 600ms                       │ │
│ │   │   └─ mysql ██████ 300ms   ← 瓶颈!                    │ │
│ │   └─ web-store ████ 150ms                                │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Span Detail (click a span):                                  │
│   Service: mysql         Duration: 300ms                     │
│   Operation: SELECT      Status: OK                          │
│   Tags: db.instance=users, db.type=mysql                     │
│   [View Logs] [View Host Metrics] [View SQL Query]           │
└──────────────────────────────────────────────────────────────┘
```

### 4. Service Detail

```
┌──────────────────────────────────────────────────────────────┐
│ ← Services    api-gateway                          ⏱ Past 1h │
├──────────────────────────────────────────────────────────────┤
│ [Overview] [Operations] [Resources] [Traces] [Infrastructure]│
├──────────────────────────────────────────────────────────────┤
│ Overview:                                                    │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────┐         │
│ │Requests │ Latency │P95      │Error Rt │Apdex    │         │
│ │ 12.3K   │ 45ms    │ 120ms   │ 0.3%    │ 0.98    │         │
│ └─────────┴─────────┴─────────┴─────────┴─────────┘         │
│                                                              │
│ ┌── Latency Trend ──────────────────────────────────────┐   │
│ │  ▂▃▅█▇▄▂▁  (折线图: 过去1小时延迟趋势)                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ Operations:                                                  │
│  GET /users     3.2K req  45ms    0.1% err                   │
│  POST /orders   2.1K req  120ms   0.5% err                   │
│  GET /health    5.8K req  2ms     0.0% err                   │
└──────────────────────────────────────────────────────────────┘
```

### 5. Service Map

```
┌──────────────────────────────────────────────────────────────┐
│ 交互式拓扑图:                                                │
│                                                              │
│      [web-store] ──→ [api-gateway] ──→ [user-svc] ──→ [mysql]│
│                        │                                     │
│                        └──→ [auth-svc] ──→ [redis]           │
│                                                              │
│  节点大小 = 请求量  颜色 = 错误率  边粗细 = 调用量            │
│  悬停节点 → tooltip: service name, req/s, p95, error rate   │
│  点击节点 → 跳转 Service Detail                              │
└──────────────────────────────────────────────────────────────┘
```

### 6. Settings

```
┌──────────────────────────────────────────────────────────────┐
│ APM Settings                                                 │
├──────────────────────────────────────────────────────────────┤
│ [Default Settings] [Generate Metrics] [Ingestion Control]    │
│ [Retention Filters] [Recommendations]                        │
├──────────────────────────────────────────────────────────────┤
│ Default Settings:                                            │
│  Service Name Mapping: [dropdown]                            │
│  Operation Name Mapping: [dropdown]                          │
│  Span Tag Schema: [table]                                    │
├──────────────────────────────────────────────────────────────┤
│ Generate Metrics:                                            │
│  Create custom metrics from span data                        │
│  + New Metric                                                │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ Name     │ Type     │ Query    │ Actions  │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
└──────────────────────────────────────────────────────────────┘
```

## 五、交互设计规范

### 5.1 悬停 (Hover)
- 表格行: 浅紫色背景 (#F3F0FA40)
- 面筛按钮: 浅灰背景 (#F8F9FA)
- 链接: 下划线出现
- 按钮: opacity 变化

### 5.2 点击 (Click)
- 服务行 → 跳转 Service Detail
- Trace 行 → 右侧滑出 Trace Detail Panel
- 面筛按钮 → 更新查询 + 重新加载数据
- 快捷胶囊 → 填入搜索框

### 5.3 下拉菜单
- 时间选择器: Past 15m/1h/6h/24h/7d/30d + Custom
- Export: Export CSV / Export JSON
- Group By: No Grouping / Status / Service

## 六、颜色系统 (Druids tokens)

| 用途 | Token | 值 |
|------|-------|-----|
| 页面背景 | --ui-background | #F9FAFB |
| 卡片背景 | --ui-background-elevated | #FFFFFF |
| 主文字 | --ui-text | #1C2B34 |
| 次要文字 | --ui-text-secondary | #506E81 |
| 弱化文字 | --ui-text-tertiary | #8B9BB4 |
| 品牌色 | --ui-brand | #632CA6 |
| 成功 | --ui-status-success | #2DB88D |
| 警告 | --ui-status-warning | #E2903C |
| 危险 | --ui-status-danger | #E65C5C |
| 边框 | --ui-border | #D1D9E0 |
| 侧栏背景 | - | #292E39 |
| 代码背景 | --ui-code-background | #1A1D24 |
