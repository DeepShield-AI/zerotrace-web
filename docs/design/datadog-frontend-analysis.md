# Datadog 前端分析 vs 我们的可行性

## 一、Datadog 前端架构

### 设计系统
Datadog 使用自研组件库 **Druids**：
```
组件：  druids_table, druids_typography, druids_onboarding_billboard
CSS：   CSS Modules (text-module_F1UDOq_druids_typography_text)
字号：  16px body, 13px data, 10px labels
配色：  侧栏 rgb(41,46,57) 深灰蓝, 主内容 #fff, 强调 #632CA6 紫
字体：  NotoSans, Lucida Grande, sans-serif
```

### 基础设施 Host List 页面结构
```
┌─────────────────────────────────────┐
│ H2 "Host List"          [时间选择器] │
├─────────────────────────────────────┤
│ [搜索框 + Filter by tag] [Group by] │
├─────────────────────────────────────┤
│ Hostname | Status | CPU | IOWait   │
│          |        |     | Load 15  │
│          |        |     | Apps     │
│ ...表格行...                        │
├─────────────────────────────────────┤
│ Billboard: "Get started with the   │
│            new Host List"          │
└─────────────────────────────────────┘
```

## 二、我们 vs Datadog 差距

| 维度 | Datadog | 我们 | 可行？ |
|------|---------|------|--------|
| 表格列 | Hostname/Status/CPU%/IOWait/Load15/Apps | Hostname/IP/OS/RAM/TX/RX | ✅ 改列即可 |
| 数据密度 | 紧凑，每列带迷你进度条 | 稀疏，缺少可视化 | ⚠️ 需要 CPU% 等实时指标 |
| 搜索/筛选 | 标签过滤、分组、排序 | 基础搜索 | ✅ 可实现 |
| 空状态 | 精美插图 + 清晰文案 | 基础文字 | ✅ 可加 SVG 插图 |
| 配色 | 专业深灰蓝侧栏 + 白主内容 | 相同 | ✅ 已有 |
| 字号体系 | 10/13/16/24 四级 | 11/12/13/15 随意 | ✅ 统一即可 |
| 间距 | 16px 内边距, 8px 间距 | 不统一 | ✅ 统一即可 |
| 设计系统 | Druids | Tailwind | ✅ Tailwind 够用 |
| CPU 实时数据 | 有 | ❌ 只有静态核数 | ❌ 需 Agent 采集 |
| IOWait | 有 | ❌ | ❌ 需 Agent 采集 |
| Load 15 | 有 | ❌ | ❌ 需 Agent 采集 |
| 容器/K8s | 有 | ❌ 占位 | ❌ 需 K8s 连接 |

## 三、可行性评估

### ✅ 立即可以改进（纯前端）
1. **统一字号体系**：label=10px, data=13px, heading=16px, metric=24px
2. **统一间距**：card padding=16px, gap=8px
3. **改进表格**：紧凑行高、对齐、排序图标、状态颜色
4. **改进空状态**：SVG 插图
5. **改进 Metric 卡片**：大数字 + 小标签 Datadog 风格
6. **改进 Overview**：系统信息 + 指标 + 相关链接 分区展示

### ⚠️ 需要 Agent 配合（中期）
1. **CPU 使用率** — Agent 读 `/proc/stat`
2. **内存使用率** — Agent 读 `/proc/meminfo`
3. **Load Average** — Agent 读 `/proc/loadavg`

### ❌ 需要基础设施（后期）
1. **容器/K8s 数据** — 连接 K8s API

## 四、结论

**Tailwind CSS 完全可以达到 Datadog 90% 的视觉效果**。差距不在技术，在于：
1. 我们没有 Druids 那样的统一设计规范 → 统一 Tailwind 即可
2. 缺少 CPU%/Mem%/Load 实时数据 → 需要 Agent 采集
3. 数据密度不够 → 需要更多数据点填充页面

**建议优先做纯前端改进**，同时 Agent 采集 P0 指标补齐数据。
