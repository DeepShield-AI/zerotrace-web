# APM Demo 规划 — 基于现有数据

## 一、Datadog APM 核心业务场景

| 场景 | Datadog 怎么做 | 我们的数据 | 可行性 |
|------|---------------|-----------|--------|
| **慢请求分析** | `duration:>500ms` 筛选，按延迟排序，瀑布图定位瓶颈 | `l7_flow_log.response_duration` ✅ | ✅ 可实现 |
| **错误追踪** | `status:error` 筛选，显示错误分布和 error message | `l7_flow_log.response_code` ✅ | ✅ 可实现 |
| **服务性能总览** | 每服务 throughput/latency/error 仪表板 | 已有 Services 页 ✅ | ✅ 已实现 |
| **Trace 搜索** | 全文搜索 trace_id/operation/resource | `l7_flow_log.request_resource` | ✅ 可实现 |
| **Trace 瀑布图** | 展示 spans 层级时间线 | ❌ 无 span/trace_id | ❌ 无法实现 |
| **实时 Live Tail** | 实时 streaming traces | 可轮询最近数据 | ⚠️ 可实现 |
| **服务依赖拓扑** | 自动发现上下游调用关系 | 已有 TopologyMap ✅ | ✅ 已实现 |

## 二、三个 Demo 设计

### Demo 1: 慢请求分析面板

**数据源**：`l7_flow_log` WHERE `response_duration > 500000` (500ms)

**展示**：
- 慢请求列表 (timestamp, service, resource, duration, status)
- 延迟分布直方图 (0-10ms, 10-100ms, 100ms-1s, >1s)
- 按服务分组统计慢请求占比
- 时间趋势图 (慢请求数 per minute)

**查询示例**：
```sql
SELECT time, request_domain AS service, request_resource, 
       response_duration/1000 AS latency_ms, response_code
FROM l7_flow_log 
WHERE response_duration > 500000 AND time > now() - INTERVAL 1 HOUR
ORDER BY response_duration DESC LIMIT 100
```

### Demo 2: 错误分析面板

**数据源**：`l7_flow_log` WHERE `response_code >= 500`

**展示**：
- 错误列表 (timestamp, service, resource, status_code, duration)
- 错误率趋势图
- 按服务/错误码分组统计
- Top error endpoints

**查询示例**：
```sql
SELECT request_resource, COUNT(*) AS cnt, 
       AVG(response_duration)/1000 AS avg_ms
FROM l7_flow_log
WHERE response_code >= 500 AND time > now() - INTERVAL 1 HOUR
GROUP BY request_resource ORDER BY cnt DESC LIMIT 20
```

### Demo 3: 服务对比视图

**数据源**：已有 `GET /api/v1/apm/services` + `GET /api/v1/apm/stats`

**展示**：
- 多选服务对比 (throughput, latency p50/p95/p99, error rate)
- 时间叠图 (各服务延迟趋势对比)
- 服务健康评分 (基于错误率)

## 三、需要修改的文件

### 后端

| 文件 | 改动 |
|------|------|
| `handlers/apm.rs` | 新增 `GET /api/v1/apm/slow-requests` (带 duration 阈值参数) |
| `handlers/apm.rs` | 新增 `GET /api/v1/apm/error-summary` (错误聚合) |
| `main.rs` | 注册新路由 |

### 前端

| 文件 | 改动 |
|------|------|
| `pages/APM.tsx` | 新增 "Slow Requests" / "Error Analysis" 子 tab |
| `pages/APM.tsx` | 或作为 Traces view 的快捷筛选按钮 |
| `components/TracesExplorer.tsx` | 增强筛选面板：duration 滑块、status 切换 |
| 新增 `components/SlowRequests.tsx` | 慢请求面板 |
| 新增 `components/ErrorAnalysis.tsx` | 错误分析面板 |

## 四、Datadog 的 UX 模式

1. **快捷筛选标签**：Traces 页顶部有 `duration:>1s`, `status:error` 等快捷按钮
2. **分布图**：Duration Distribution 直方图，可拖拽选择范围
3. **Facet 侧栏**：Service / Operation / Status / Duration 分组统计
4. **行内迷你图**：每个 trace 行显示 duration bar
5. **详情滑出**：点击 trace → 右侧滑出 span 瀑布图

## 五、实施优先级

| 优先级 | Demo | 工作量 |
|--------|------|--------|
| P0 | 慢请求列表 + 延迟分布直方图 | 后端 1h + 前端 2h |
| P0 | 错误分析面板 | 后端 0.5h + 前端 1h |
| P1 | 快捷筛选标签 (duration/status) | 前端 1h |
| P1 | 服务对比视图 | 前端 2h |
