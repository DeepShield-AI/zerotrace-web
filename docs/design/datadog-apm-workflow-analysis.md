# Datadog APM 使用逻辑与案例深度分析

## 一、Datadog APM 核心页面流转

```
APM Home (Welcome)
  ├─ Services 列表 → 选择服务 → Service Detail
  ├─ Traces → 搜索/筛选 → Trace Detail (瀑布图)
  ├─ Service Map → 拓扑图
  └─ Settings → 采样/保留/指标
```

## 二、关键使用场景

### 场景 1：发现慢请求
1. 进入 Traces 页
2. 在搜索框输入 `duration:>500ms` 或点击快捷标签
3. 查看慢请求列表，按延迟排序
4. 点击具体 trace 查看 span 瀑布图 —— **定位是哪个 span 耗时最长**
5. 根据 span 的 service/operation 去优化代码

### 场景 2：排查错误
1. 进入 Traces 页
2. 搜索 `status:error`
3. Facet 侧栏按 Service / Error Type 分组
4. 点击错误 trace → 查看 error message 和 stack trace
5. 关联到 APM/Logs 查看完整上下文

### 场景 3：服务性能监控
1. Services 页 → 查看所有服务健康状态
2. 点击服务 → Service Detail (throughput, latency p50/p95/p99, error rate)
3. 点击 Operations 查看每个 API 的性能
4. 热力图对比不同版本/环境的性能

## 三、Datadog 的 UX 模式

### 3.1 快捷查询语法
```
service:api-gateway          → 筛选服务
operation:POST+/users        → 筛选操作
status:error                 → 筛选错误
duration:>1s                 → 筛选慢请求
tag:env:production           → 按标签筛选
```

### 3.2 Facet 侧栏设计
- **Status**: All / OK / Error — 带计数
- **Duration**: <10ms / 10-100ms / 100ms-1s / >1s — 可点击
- **Top Services**: 按请求数排名，带健康状态点
- **Duration Distribution**: 直方图，可拖拽选择范围

### 3.3 数据可视化
- 直方图 (Duration Distribution)
- 折线图 (Latency/Throughput trend)
- 柱状图 (Error count by service)
- 热力图 (Latency by version × time)
- 拓扑图 (Service dependencies)

## 四、我们已实现 vs 待实现

| 功能 | Datadog | 我们 | 状态 |
|------|---------|------|------|
| 服务列表 | ✅ | ✅ | 已实现 |
| 服务详情 | ✅ | ✅ | 已实现 |
| Trace 搜索 | ✅ | ✅ | 已实现 |
| Facet 侧栏 | ✅ | ✅ | 已实现 |
| 慢请求面板 | ✅ | ✅ | 刚实现 |
| 错误分析面板 | ✅ | ✅ | 刚实现 |
| Trace 瀑布图 | ✅ | ❌ | 无法实现 (无 span 数据) |
| Live Tail | ✅ | ❌ | 需 WebSocket |
| Duration 分布直方图 | ✅ | ⚠️ | 有 API 无交互拖拽 |
| 快捷查询按钮 | ✅ | ⚠️ | 有 Slow/Error tabs，缺语法提示 |

## 五、建议下一步

1. **Trace 搜索框增加语法提示** — placeholder 示例: `service:xxx duration:>500ms status:error`
2. **Duration 直方图支持拖拽** — 选择延迟范围自动更新查询
3. **Trace 行增加错误堆栈展示** — 展开显示 error_message
4. **服务对比视图** — 并排比较多个服务的延迟趋势
