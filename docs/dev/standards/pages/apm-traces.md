# APM Traces Explorer 页

**路径**: `/apm?view=traces`
**参考图**: `datadog-capture/screenshots/apm-full-v2/02_04_traces_list.png`
**结构数据**: `datadog-capture/screenshots/apm-full-v2/02_04_traces_list_structure.json`

## 区块划分

| # | 名称 | 位置 | 主要内容 |
|---|---|---|---|
| 1 | top-bar | 顶部 36px | Upgrade + Search + Ask Bits |
| 2 | sidebar | 左侧 160px | 全局导航 |
| 3 | page-tabs | 主内容顶部 | [Services] [Traces] [Service Map] [Settings] |
| 4 | search-bar | tabs 下方 | 搜索框 (语法: service:/operation:/status:/duration:) |
| 5 | filter-pills | search 下方 | All / OK / Error / Slow 快捷筛选 |
| 6 | facet-panel | 左侧 200px | Status facet + Duration facet |
| 7 | traces-table | 主内容 | 5列表格: Date | Service | Resource | Duration | Status |
| 8 | footer | 底部 | 分页 "Showing 1-50 of N" + Load More |

## Traces 表格列定义

| 列 | 内容 | 格式 |
|---|---|---|
| Date | start_time.slice(11,19) | 11px font-mono text-fg-tertiary |
| Service | root_service | 13px font-medium text-accent-primary |
| Resource | root_operation | 11px font-mono truncate max-w-[300px] |
| Duration | 进度条 + 数字 | 12px progress bar + font-mono, >1s=red |
| Status | OK/ERR badge | 10px rounded-full, green/red |

## Facet 面板

- **Status**: All / OK / Error (with StatusDot indicators)
- **Duration**: <10ms / 10-100ms / 100ms-1s / >1s
- 点击 facet → 筛选生效, 再次点击 → 取消筛选

## Datadog 有但我们缺的

- Duration Distribution 可拖拽直方图
- Timeseries/List/Top List/Table 多视图切换
- 搜索语法高亮 + 自动补全
- LIVE 实时模式 (Pause/Play)
