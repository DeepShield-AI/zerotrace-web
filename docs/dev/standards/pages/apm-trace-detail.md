# APM Trace Detail 页

**路径**: `/apm/traces/:traceId`
**分析文档**: `docs/design/datadog-apm-complete-analysis.md` §3

## 区块划分

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|
| 1 | trace-header | 页面顶部 | 面包屑 + trace ID + Copy ID + 状态标签 + 统计信息 |
| 2 | service-pills | header 下方 | 每个参与 service 的彩色圆点 + 名称 |
| 3 | tab-nav | 内容区顶部 | [Flame Graph] [Waterfall] [Span List] |
| 4 | main-view | tab 下方 | 根据选中的 tab 切换视图 |
| 5 | span-sidebar | 右侧 340px | 点击 span 后出现的详情面板 |
| 6 | footer-bar | 视图底部 | span 统计 + legend |

## TraceHeader 布局

```
← Traces / abc123def456...        [Copy ID]
● OK | 1.2s | 23 spans | across 4 services
         Root: api-gateway                    2024-01-01 14:23:01
```

- 状态标签: rounded-full, bg-accent-success-bg / bg-accent-danger-bg
- Duration: font-mono, bg-bg-muted, rounded-full
- Service pills: 彩色圆点 + 名称, rounded-full border

## Waterfall View (默认)

```
[Service & Operation          ] [Duration timeline with markers]
 api-gateway ████████████████    1.2s
   ├ auth-svc ████████           450ms
   │   └ redis ██                 12ms
   ├ user-svc ██████████████     600ms
   │   └ mysql ██████            300ms  ← 瓶颈!
   └ web-store ████              150ms
```

关键参数:
- ROW_H = 36px
- INDENT_W = 14px
- 左侧面板 w=400px
- Duration bar: minWidth=4px, rounded-full
- 错误 span: 红色背景 + 警告图标
- 选中 span: bg-accent-primary/8
- 时间刻度线: border-l border-border-subtle
- Status code badge: 分组着色 (2xx=green, 4xx=orange, 5xx=red)

## Flame Graph View

Canvas 渲染:
- ROW = 25px, 渐变色填充
- Hover → 白色描边 + tooltip
- Selected → 紫色描边 2px
- Error → 右上角红色三角
- Search → 黄色虚线高亮匹配
- Click → zoom in, Esc → zoom out
- Breadcrumb toolbar 显示 zoom 路径

## Span List View

- 每行: 缩进 + 彩色圆点 + Service · Operation + [mini bar] + [duration + time]
- 选中态: bg-accent-primary/8
- 错误态: bg-accent-danger-bg/30

## Span Detail Sidebar (340px)

```
┌─ Service · Operation ─────── [×] ─┐
│ ⚠ Error message (if error)        │
│                                    │
│ SPAN INFO                          │
│ Service      api-gateway           │
│ Operation    GET /users            │
│ Duration     450.00ms              │
│ Start Time   2024-01-01 14:23:01   │
│ Span Kind    server                │
│ Request Type HTTP                  │
│ Status       ok [badge]            │
│ Status Code  200                   │
│                                    │
│ IDs                                │
│ Span ID      abc123...             │
│ Parent ID    def456...             │
│ Trace ID     xxx...                │
│                                    │
│ ATTRIBUTES (N)                     │
│ http.method = GET                  │
│ http.status_code = 200             │
│ db.type = mysql                    │
└────────────────────────────────────┘
```

- 分组卡片: Span Info / IDs / Attributes
- 代码块: bg-bg-subtle rounded-lg px-3 py-2 font-mono
- Error 区: bg-accent-danger-bg border border-accent-danger/20
