# APM Services 列表页

**路径**: `/apm` (view=services)
**参考图**: `datadog-capture/screenshots/apm-full-v2/01_02_services_list.png`
**结构数据**: `datadog-capture/screenshots/apm-full-v2/01_02_services_list_structure.json`
**Datadog 原始 URL**: `https://ap1.datadoghq.com/apm/home`

## 区块划分

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|
| 1 | top-bar | 顶部 36px | Upgrade按钮 + Search Datadog + Ask Bits |
| 2 | sidebar | 左侧 160px | 全局导航 (APM 高亮) |
| 3 | page-header | 主内容顶部 | 标题 + tab 导航 + 时间选择器 |
| 4 | service-search | header 下方 | "Choose an APM Service" + 搜索框 |
| 5 | service-table | 主内容 | 4列表格: ★ | Service | P95 Latency | Error Rate | Requests |
| 6 | footer | 页面底部 | 版权 + 系统状态 |

## 精确表格列定义

| 列 | 内容 | 对齐 | 格式 |
|---|---|---|---|
| ★ | 收藏星标 (☆/★) | 左 | 12px, text-accent-primary / text-fg-disabled |
| Service | 服务名称 | 左 | 13px font-medium, text-accent-primary (可点击) |
| P95 Latency | P95 延迟 | 右 | 12px font-mono, 条件着色 (>500ms=red, >100ms=orange) |
| Error Rate | 错误率 + mini bar | 右 | 12px font-mono + 1px高 mini 进度条, 条件着色 |
| Requests | 请求速率 (/s) | 右 | 12px font-mono, text-fg-secondary |

## 关键样式细节

- 搜索框: h-8, pl-8 (搜索图标), placeholder "Filter services..."
- 表头: 10px uppercase tracking-wider text-fg-tertiary
- 行: 交替 bg-bg-elevated / bg-bg-subtle, hover:bg-accent-primary/5
- 排序: 点击表头切换 ↑↓, 当前排序列文字变色
- 收藏: 点击 ★ 切换, 不触发行导航

## 交互

- 点击行 → `/apm/services/:serviceName`
- 点击 ★ → 收藏/取消收藏 (localStorage)
- 搜索输入 → 实时过滤 (前端)
- 表头点击 → 排序切换 (asc/desc)
