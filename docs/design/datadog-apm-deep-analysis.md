# Datadog APM 深度分析 — 真实使用流程与逻辑

## 一、Datadog APM 产品架构

### 1.1 数据采集层
```
应用程序 (Java/Python/Go/Node.js...)
    │ dd-trace 库自动注入
    ▼
Datadog Agent (本地进程)
    │ 收集 traces + metrics
    ▼
Datadog Backend (SaaS)
    ├─ Live Search: 15分钟窗口，100% 数据，实时流
    ├─ Retention Filter: 保留关键 traces (error, high-latency)
    └─ Intelligent Retention: 自动保留多样化样本 (30天免费)
```

### 1.2 用户界面层
```
APM 模块
  ├─ Services 页: 服务健康总览 (throughput, latency, error rate)
  ├─ Traces 页 (Trace Explorer):
  │   ├─ Live Search (最近15分钟，100%数据)
  │   ├─ Indexed Search (保留数据，最长30天)
  │   ├─ 搜索查询语法: service:xxx, operation:xxx, status:error, duration:>1s
  │   ├─ Facet 侧栏: Status, Duration, Service, Tags
  │   └─ 直方图: Duration Distribution (可拖拽选择范围)
  ├─ Service Detail: 单服务深度分析
  ├─ Trace Detail: 单条 trace 的瀑布图/flame graph
  └─ Service Map: 服务依赖拓扑图
```

## 二、典型用户使用流程

### 2.1 新人上手 (Onboarding)
```
1. 安装 Agent + 开启 APM → 等待 2-5 分钟
2. 访问 APM Home → 看到 "Get Started" 引导页
3. 点击 "Start Instrumenting" → 选择语言 (Java/Python/Node.js...)
4. 复制安装命令 → 粘贴到终端
5. 等待服务上线 → Services 页出现服务卡片
6. 点击服务 → 查看 Service Detail (延迟/吞吐/错误仪表板)
```

### 2.2 日常监控 (Daily Monitoring)
```
1. Services 页 → 按错误率/延迟排序 → 红色标记异常服务
2. 点击异常服务 → Service Detail:
   - Overview: 延迟 p50/p75/p95/p99, 错误率, 请求量
   - Operations: 每个 API endpoint 的性能
   - Resources: 每个 URL path 的指标
3. 时间对比: 选择时间范围 → 与上周同期对比
```

### 2.3 排查慢请求 (Slow Request Investigation)
```
1. Traces 页 → 搜索 duration:>1s
2. Duration Distribution 直方图 → 拖拽选择 500ms-5s 范围
3. 按延迟排序 → 点击最慢的 trace
4. Trace Detail:
   ├─ Flame Graph: 瀑布图可视化每个 span 的耗时
   ├─ 红色标记: 错误 span 高亮
   ├─ Span 详情: 点击 span → 查看 logs, host metrics, SQL 查询
   └─ 关联信息: 同一 trace 的 logs, 同一 host 的 CPU/memory
5. 定位根因: 看哪个 span 耗时最长 → 跳到对应代码行
```

### 2.4 排查错误 (Error Investigation)
```
1. Traces 页 → 搜索 status:error
2. Facet 侧栏: 按 Service / Error Type 分组
3. 错误趋势: Timeseries 图看错误率是否突增
4. 点击错误 trace → 查看 error.message 和 stack trace
5. 关联部署: 查看 Deployment Tracking → 是否与最近部署相关
6. 关联日志: 从 trace 跳转到相关 logs → 查看完整上下文
```

### 2.5 服务依赖分析 (Topology Analysis)
```
1. Service Map → 全览所有服务依赖关系
2. 节点大小: 按请求量/延迟/错误率缩放
3. 边: 服务间的调用关系和流量方向
4. 点击节点 → 跳转到 Service Detail
5. 点击边 → 查看调用的延迟和错误率
```

### 2.6 性能优化 (Performance Optimization)
```
1. APM Recommendations → 自动发现:
   - N+1 Query: 重复数据库查询
   - Sequential Calls: 串行 API 调用
   - Slow Endpoints: 延迟最高的端点
2. Latency Investigator:
   - 选择慢 vs 快的 trace 集群
   - 对比 self-time (自身耗时) vs downstream-time (下游耗时)
   - 关联部署事件 → 是否新版本引入的性能退化
```

## 三、与我们系统的差距分析

| 功能 | Datadog | 我们 | 差距原因 |
|------|---------|------|---------|
| **Flame Graph** | ✅ 完整 span 层级 | ❌ | 无 span 数据 (eBPF 只抓 L7 流量) |
| **Span 详情** | ✅ 每个 span 的日志/指标 | ❌ | 同上 |
| **APM Recommendations** | ✅ N+1/串行检测 | ❌ | 需要 span 依赖分析 |
| **Latency Investigator** | ✅ 慢vs快对比 | ❌ | 需要 span 粒度数据 |
| **Deployment Tracking** | ✅ 部署事件关联 | ❌ | 无部署事件源 |
| **Live Search (流式)** | ✅ WebSocket 实时 | ⚠️ 可轮询实现 | 前端定时刷新 |
| **Saved Views** | ✅ 保存筛选条件 | ❌ | 未实现 |
| **Trace-Waterfall** | ✅ 瀑布图 | ⚠️ 可模拟 | 按 flow_id 分组展示 |
| **Error Stack Trace** | ✅ 代码级堆栈 | ⚠️ 有 error_count | 无堆栈信息 |
| **Duration 直方图(可拖拽)** | ✅ 交互式 | ⚠️ 有静态版 | 需加拖拽事件 |

## 四、我们可以实现的优先级

### P0 — 立即可做 (基于现有 l7_flow_log 数据)
1. ✅ **Services 列表 + 详情** — 已实现
2. ✅ **Traces 列表 + Facet** — 已实现
3. ✅ **慢请求面板** — 已实现
4. ✅ **错误分析面板** — 已实现
5. ✅ **快捷筛选** — 已实现
6. ✅ **拓扑图** — 已实现

### P1 — 可模拟 (用 flow_id 模拟 trace)
7. **Trace Detail 页** — 按 flow_id 分组展示请求时间线 (不是真 span 瀑布图，但可展示时序)
8. **Duration 直方图(可拖拽)** — 加鼠标拖拽选择范围
9. **Saved Views** — 保存筛选条件到 localStorage

### P2 — 需 Agent 改进
10. **真 Flame Graph** — 需要 Agent 支持分布式 tracing 协议 (W3C traceparent)
11. **代码级错误堆栈** — 需要应用层 instrumentation
