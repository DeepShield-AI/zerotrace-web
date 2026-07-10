# APM Service Detail 页

**路径**: `/apm/services/:serviceName`
**参考图**: `datadog-capture/screenshots/apm-full/014_12_service_detail.png`
**HTML 抓取**: `datadog-capture/screenshots/apm-full/014_12_service_detail.html`
**分析文档**: `docs/design/datadog-apm-complete-analysis.md` §4

## 区块划分

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|
| 1 | breadcrumb | 页面顶部 | ← APM / Services / serviceName + Refresh |
| 2 | tab-nav | breadcrumb 下方 | [Overview] [Resources (N)] [Traces (N)] [Errors (N)] |
| 3 | kpi-cards | Overview tab | 5 张指标卡片横排 (Requests, Avg Latency, P99, Error Rate, P95) |
| 4 | charts-row | KPI 下方 | 3 列: Request Rate / Latency / Errors 趋势图 |
| 5 | operations+deps | charts 下方 | 左: Top Operations 表, 右: Upstream/Downstream 依赖 |
| 6 | topology | 最下方 | Service Map 拓扑图 |

## KPI 卡片

| 卡片 | 指标 | 告警条件 |
|---|---|---|
| Total Requests | fmtN(total_requests) | — |
| Avg Latency | fmtLatency(avg) + P95 sub | — |
| P99 Latency | fmtLatency(p99) | >1s = text-accent-danger |
| Error Rate | x.xx% + N errors | >5% = text-accent-danger |
| P95 Latency | fmtLatency(p95) | — |

样式: bg-bg-elevated, border, rounded-lg, px-4 py-3, title=11px uppercase, value=font-mono text-xl bold

## Operations 表格

列: Operation | Requests | Avg Latency | P95 | Errors
- 点击 "View all" → 切换到 Resources tab
- 最多显示 10 条

## Dependencies

- Upstream (Callers): 绿色圆点, 上游服务名 + calls + latency
- Downstream (Dependencies): 紫色圆点, 下游服务名
- 点击 → 跳转到对应 Service Detail

## Resources Tab

全量 Operations 表, 比 Overview 多了 Error Rate 列

## Traces Tab (新增)

按 service 过滤的 traces 列表:
- 列: Date | Root Operation | Duration | Spans | Status
- 点击行 → /apm/traces/:traceId

## Errors Tab

按 service + status:error 过滤的 error traces
- 表头: Date | Root Operation | Duration | Spans | Errors
- 行 hover: bg-accent-danger-bg/30
- 空态: 绿色勾 + "No errors found"
