# Metrics Explorer — Datadog 截图精确分析（vision 工具验证版）

**截图**：`datadog-capture/outputs/screenshots/metrics-explorer-viewport-2026-07-05T05-50-36-408Z.png`
**全页截图**：`datadog-capture/outputs/screenshots/metrics-full-2026-07-05T05-43-20-982Z.png`
**分析方法**：`node tools/vision/vision.js` 逐区域描述
**分辨率**：2880×1800 (2x DPR, 逻辑 1440×900)

## 页面完整布局

### 区域 A：顶部全局导航栏（Datadog 全局，非页面内容）

- 深色背景
- 左：Datadog logo + "Upgrade" 按钮 + "5 days left in your free trial"
- 中：全局搜索框 "Search Datadog" + `Ctrl K` 快捷键提示
- 右："Ask Bits" 紫色 AI 按钮

### 区域 B：页面头部

- **标签页**：`Overview` | `Explorer`（Explorer 选中，加粗 + 下划线）
- **标题**：`Metrics`（左侧，带折线图小图标）
- **时间选择器**：右侧，`Past 1 Hour` 下拉
- 时间选择器右侧：暂停/播放按钮、快进按钮、全屏/更多选项图标

### 区域 C：左侧全局图标导航栏（Datadog 全局，非页面内容）

- 垂直图标列：Dashboards、Logs、Traces、APM、Network、Cloud Cost、Security、Incidents、Users、Notebooks、Watchdog、Bits Chat、Help
- 宽度很窄，仅图标
- **注意：这不是指标浏览器侧边栏！Datadog Metrics Explorer 页面没有专用的指标侧边栏。**

### 区域 D：Query Builder（查询构建器）

单行横向排列，紧凑：

```
a  [Metrics ▾]  [system.cpu.user]  from [everywhere ▾]  [avg ▾]  by [everything ▾]  [Σ Modify]  [✨]  [</>]  [🎨]  [as...]
```

关键元素：
- **a** — 查询标签，深蓝色，等宽字体，bold
- **[Metrics ▾]** — 数据源类型下拉
- **[system.cpu.user]** — 指标名输入框（带 autocomplete）
- **from [everywhere ▾]** — 作用域过滤
- **[avg ▾] by [everything ▾]** — 聚合函数 + 分组维度
- **[Σ Modify]** — 修改聚合逻辑按钮
- **[✨]** — 魔法棒，智能建议
- **[</>]** — 代码模式切换（显示原始查询语句编辑）
- **[🎨]** — 颜色方案
- **[as...]** — 别名设置

下方按钮行：
- `+ Add Query`（蓝色边框）
- `+ Add Formula`（灰色边框）

### 区域 E：Display 选项

```
Display [Lines ▾]  Style [Solid ▾]  Stroke [Normal ▾]
```

仅三组下拉：显示类型、线型、线宽。无 Color、Order by、Reverse、Split Graph 等额外选项。

### 区域 F：图表

- **标题**：左上角显示查询表达式 `avg:system.cpu.user{*}`
- **右上角**：导出图标 + 全屏图标
- **图表类型**：简单折线图（单条蓝色线，不是 stacked area）
- **Y 轴**：Percent，刻度 0-25，间隔 5
- **X 轴**：时间，12:55 ~ 13:50，间隔 5 分钟
- **背景网格**：浅灰色水平虚线
- **图例**：图表左下角，`■ avg:system.cpu.user{*}`

### 区域 G：图表下方

- **没有 Summary 表**
- **没有 Distribution 面板**
- **没有 Top List 面板**
- **没有 Stat Cards**

### 区域 H：页面底部

- Datadog 全局 footer：版权声明、Master Subscription Agreement、Privacy Policy、Cookie Policy、系统状态 `● All Systems Operational`

---

## 与当前实现的差异（2026-07-05 校正版）

| # | 差异 | Datadog | 当前实现 | 状态 |
|---|------|---------|----------|------|
| 1 | 下拉框组件 | pill 风格紧凑下拉 | CompactSelect（已自建）| ✅ 已修复 |
| 2 | 查询表达式显示 | 图表标题 `avg:system.cpu.user{*}` | 图表上方 code 标签显示 | ✅ 已修复 |
| 3 | 图例 | 图表底部始终显示 | legend 已改为始终显示 | ✅ 已修复 |
| 4 | Display 选项 | 仅 Lines/Solid/Normal 三组 | 同，已简化 | ✅ 已修复 |
| 5 | 图表默认类型 | 折线图 (Lines) | 折线图 (line)，可选 Area | ✅ 已修复 |
| 6 | 指标选择方式 | query builder 中的 autocomplete 输入框 | MetricSelector 下拉（功能一致）| ✅ |
| 7 | `</>` 代码切换 | 有 | 有 | ✅ |
| 8 | 左侧指标浏览器 | ❌ 没有（不是页面一部分）| ❌ 没有 | ✅ 正确 |
| 9 | Summary 表 | ❌ 没有 | ❌ 没有 | ✅ 正确 |
| 10 | Distribution/TopList | ❌ 不在 Explorer 主视图 | ❌ 没有 | ✅ 正确 |

---

## 已确认不需要的功能

以下功能经 vision 工具验证**不在 Datadog Metrics Explorer 主视图中**：
- ~~左侧指标浏览器侧边栏~~（Datadog 左侧是全局图标导航）
- ~~Summary 数据表~~
- ~~Distribution 面板~~
- ~~Top List 面板~~
- ~~"Graph your data [sum ▾] by [host ▾] over [1m ▾]" 聚合行~~
- ~~Color / Order by / Reverse / Split Graph~~（这些选项不在 Datadog Explorer 的基本视图里）

---

## 优化方向（正确版）

1. **保持简洁** — Datadog Explorer 本质上就是：query builder + 简洁 display 选项 + 图表
2. **不需要加侧边栏** — 指标选择通过 metric name 输入框的 autocomplete 完成
3. **不需要加 Summary/Distribution/TopList** — 这些是 Dashboard widgets 的功能，不属于 Explorer
4. **继续打磨细节**：CompactSelect pill 风格、等宽字体查询表达式、图例位置、间距对齐
