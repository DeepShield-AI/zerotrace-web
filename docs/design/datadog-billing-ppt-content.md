# Datadog License & 计费模型 —— PPT 内容稿

> 适用于 30-45 分钟深度介绍演示 | 约 20-25 页幻灯片
> 每页包含：标题 / 核心要点 / 视觉建议 / 演讲备注

---

## Slide 1 | 封面

**标题：** Datadog 产品计费与 License 模型深度解析

**副标题：** 从 Infrastructure 到 AI —— 全方位理解「可观测性」的定价逻辑

**视觉：** Datadog 品牌紫+深色背景，左侧 Logo，右侧产品图标矩阵（Infra/APM/Logs/AI/Security）

**备注：** 今天我们从产品架构、计费维度、License 设计哲学、AI 能力定价、隐藏成本五个层面，系统拆解 Datadog 的商业模型。目标是让你不仅知道价格数字，更理解背后的设计逻辑。

---

## Slide 2 | 议程概览

**标题：** Agenda

| 模块 | 内容 | 时间 |
|------|------|------|
| 01 | 产品矩阵总览 | 3 min |
| 02 | 核心计费哲学：高水位线 (HWMP) | 5 min |
| 03 | License 设计模式：不是 SaaS，是「用量税」 | 5 min |
| 04 | Infrastructure & APM 深度拆解 | 5 min |
| 05 | Log Management 双重计费 | 3 min |
| 06 | Custom Metrics：沉默的账单放大器 | 3 min |
| 07 | 全产品线速览（RUM/Synthetics/DBM/NPM/Serverless） | 5 min |
| 08 | 🔥 AI 能力定价（Bits AI / LLM Observability / AI Credits） | 5 min |
| 09 | Commit vs 按需：如何省钱 | 3 min |
| 10 | 隐藏成本 Top 5 | 3 min |
| 11 | 真实场景成本测算 | 5 min |
| 12 | 竞品对比 & 关键决策建议 | 3 min |

**视觉：** 时间轴/流程条样式

---

## Slide 3 | Datadog 产品矩阵全景

**标题：** 20+ 产品，一个平台 —— 但每个产品独立计费

**核心要点：**
- Datadog 采用 **模块化产品架构**：每启用一个产品，增加一条**独立的并行计费线**
- 不存在「全平台一口价」—— 总账单 = 所有启用产品的费用之和
- 产品分为三大类：**按主机** / **按用量** / **按事件**

```
产品分类架构图（建议用三层卡片布局）：

┌─────────────── 按主机计费 ───────────────┐
│ Infrastructure │ APM        │ DBM        │
│ $15-23/host   │ $31-40/host│ $70/host   │
│ NPM $5/host   │ Profiler   │ Security   │
│               │ $12/host   │ $10-25/host│
└──────────────────────────────────────────┘

┌─────────────── 按用量计费 ───────────────┐
│ Log Ingest    │ Log Index   │ Custom Metrics │
│ $0.10/GB     │ $1.70/M events│ $0.05/metric │
│ Cloud SIEM    │ RUM          │ Serverless     │
│ $0.20/GB     │ $1.50/1K sess│ $7.50/M invoc  │
└──────────────────────────────────────────┘

┌─────────────── 按事件/会话计费 ───────────┐
│ Synthetics   │ CI Visibility │ AI Credits  │
│ $5/10K runs │ $8/committer  │ $500/500cr  │
└──────────────────────────────────────────┘
```

**备注：** 关键认知 —— Datadog 不是「一个产品 N 个功能」，而是「N 个独立计费产品的聚合平台」。这个设计使得 ARPU 可以随客户成熟度持续增长。

---

## Slide 4 | 核心计费哲学：高水位线 (High-Watermark Plan)

**标题：** HWMP —— Datadog 最精妙（也最危险）的计费设计

**核心机制：**
```
每小时记录主机数 → 月底剔除最高 1%（~7h/月）
→ 剩余 99% 中的峰值 = 当月全月计费基数
```

**可视化（建议用面积图 + 标注线）：**
```
主机数
 200│         ████████
    │        █        █
  50│■■■■■■■■          ■■■■■■■■■■
    └──────────────────────────────→ 时间
          ↑                    ↑
      正常运营期          7小时+ 扩容峰值
      50台计费           → 整月按 200 台计费！
```

**影响量化：**
| 场景 | 预期按平均计费 | 实际 HWMP 计费 | 放大倍数 |
|------|-------------|---------------|---------|
| 平时 50 台，峰值 200 台持续 8h | ~$2,260 | ~$6,200 | 2.7x |
| 平时 100 台，峰值 500 台持续 10h | ~$5,700 | ~$15,500 | 2.7x |

**适用范围：** Infrastructure / APM / DBM / Continuous Profiler / NPM — **仅主机类产品**

**不适用：** Log Management / Custom Metrics / RUM / Synthetics / Cloud SIEM — 按实际用量计费

**备注：** 这是 Datadog 收入模型的核心引擎。客户无法通过「平均用量」来预估成本，每次扩容若超过 7 小时就会锁定整月峰值。这个机制在实际中导致账单比预期高 2-3 倍。

---

## Slide 5 | License 设计哲学（一）：不是卖「席位」，是卖「规模」

**标题：** 传统 SaaS vs Datadog —— 完全不同的 License 思维

| 维度 | 传统 SaaS（Slack/Jira/Salesforce） | Datadog |
|------|-----------------------------------|---------|
| **计费单位** | 按用户/席位 (Per-Seat) | 按基础设施规模 (Per-Host/Per-GB) |
| **用户数** | 限制，超量加钱 | **无限用户，免费** |
| **增长驱动** | 客户员工数增长 | 客户基础设施和数据量增长 |
| **成本认知** | 可预测，线性增长 | 难以预测，阶梯式跳变 |
| **定价杠杆** | 功能差异（Pro/Enterprise） | 规模 × 产品数量 × 用量 |

**核心洞察：**
> Datadog 本质上是 **「基础设施规模税」** —— 你的云账单越大，Datadog 账单越大。它不关心你有多少工程师，只关心你有多少台机器、产生多少日志和指标。

**License 设计四大支柱：**

```
        ┌──────────────────────────┐
        │   Datadog License 模型    │
        ├──────────────────────────┤
        │ ① 按主机（HWMP 峰值锁定） │ ← 基础层
        │ ② 按数据量（GB/事件）    │ ← 用量层
        │ ③ 按产品模块叠加         │ ← 扩展层
        │ ④ 按 AI 消费（Credits）  │ ← 智能层
        └──────────────────────────┘
```

**备注：** 「无限用户」是一个极聪明的设计 —— 它消除了采购审批中的用户数博弈，让工程师可以自由邀请同事使用平台，从而加深组织依赖。但真正的成本锚点从「人」变成了「机器」，而机器的增长曲线远比人头数陡峭。

---

## Slide 6 | License 设计哲学（二）：捆绑依赖与锁定

**标题：** 前置依赖链 —— APM 不能单独买，DBM 不能单独买

**依赖关系图（建议用流程图）：**
```
Infrastructure Monitoring（必选，入口产品）
    ├── APM ($31-40/host)          ← 必须捆绑 Infra
    │   └── LLM Observability      ← 必须捆绑 APM
    ├── Database Monitoring ($70)   ← 必须捆绑 Infra
    ├── Network Monitoring ($5)     ← 必须捆绑 Infra
    ├── Continuous Profiler ($12)   ← 必须捆绑 Infra（APM Enterprise 已含）
    └── Security Pro ($10)          ← 必须捆绑 Infra

独立产品（不依赖 Infra）：
    ├── Log Management
    ├── RUM / Synthetics
    ├── Cloud SIEM
    └── AI Credits
```

**实际影响：**
- 想用 APM？实际单价 = Infra($15) + APM($31) = **$46/host/月起**
- 想用 DBM？实际单价 = Infra($15) + DBM($70) = **$85/host/月起**
- 三件套 (Infra + APM + DBM) = **$120/host/月**，50 台 = $72,000/年

**备注：** 这种捆绑依赖设计使 Datadog 的 ARPU 具备强大的自然增长动力。客户一旦采用了某个上层产品，就必须持续为底层 Infra 付费。这是典型的「平台税」模型 —— 参考 AWS 的计费逻辑。

---

## Slide 7 | Infrastructure Monitoring 深度拆解

**标题：** Infra —— 一切计费的起点

| 参数 | Pro | Enterprise |
|------|-----|------------|
| 年付价格 | **$15/主机/月** | **$23/主机/月** |
| 月付价格 | $18 | $27 |
| 免费自定义指标 | 100/主机 | 200/主机 |
| 内含容器 | 5/主机 | 10/主机 |
| 容器超额 | $1/容器/月 | $1/容器/月 |
| 指标保留 | 15 个月 | 15 个月 |
| 关键差异 | 基础告警 | ML 告警 + 基于角色的访问控制 |

**什么算一个「主机」？**
- ✅ 物理服务器、VM、Kubernetes **Node**（不是 Pod！）
- ✅ AWS EC2、Azure VM、GCP Compute Engine 实例
- ✅ Azure App Service Plan 实例
- ❌ Kubernetes Pod（但 sidecar 模式会导致 Pod = Host）

**容器陷阱计算：**
```
集群: 10 Nodes, 200 Pods
├── DaemonSet（每 Node 一个 Agent）→ 计费 10 主机 ✅
└── Sidecar（每 Pod 一个 Agent）  → 计费 200 主机 ❌ 费用 20x！
```

**备注：** 很多团队在 K8s 中误用 sidecar 模式部署 Agent，导致主机数被放大 10-20 倍。Datadog 官方文档明确声明：容器内直接安装 Agent = 每个容器单独计为主机。这是 GitHub issue #28963 等真实案例反复出现的问题。

---

## Slide 8 | APM 深度拆解

**标题：** APM —— 最赚钱的产品线，也是最容易超支的

| 层级 | 年付（$/主机/月） | 月付 | 内含 |
|------|-----------------|------|------|
| Standard | **$31** | $48 | 分布式追踪 + 100万索引 span |
| Pro | **$35** | $42 | + Data Streams Monitoring |
| Enterprise | **$40** | $60 | + Continuous Profiler |

**关键约束：**
- 🔗 **必须捆绑 Infrastructure Monitoring**（不能独立购买）
- 📊 内含 100 万索引 span/主机/月 + 150GB 摄取 span
- 💰 Span 超额：**$1.70/百万 span**（年付）

**Span 成本放大场景：**
```
1 个微服务请求 → 经过 5 个服务 → 产生 15 个 span
100 RPS × 86,400 秒 × 15 span = 1.296 亿 span/天
月 span 量 ≈ 39 亿  → 天价账单！
```

**备注：** APM 的成本陷阱在于 span 数量不可预测。微服务架构的调用链越深，span 越多。加上 LLM 应用每个请求可能产生 10+ span（chat → tool call → embedding → response），成本放大更加显著。

---

## Slide 9 | Log Management 双重计费

**标题：** 日志 —— 收两次钱，第一次是「进门费」

**双账单模型：**
```
                    ┌──────────────┐
   日志数据 ──────→ │ 摄取费       │ ──────→ $0.10/GB
                    │ (Ingestion)  │          （必须付，逃不掉）
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ 索引费       │ ──────→ $1.70/百万事件 (15天)
                    │ (Indexing)   │          （搜得着就要多付）
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌───────▼───────┐        ┌────────▼───────┐
     │ Standard Index │        │  Flex Logs     │
     │ $1.70/M events │        │ $0.05/M events │
     │ (可搜索+告警)   │        │ (仅存储，34x便宜)│
     └───────────────┘        └────────────────┘
```

**用户应对策略与代价：**
- 仅索引 10-20% 日志 → **80-90% 日志在故障时不可搜索**
- 全部用 Flex Logs → 便宜但不支持实时告警
- 日志外发到外部 SIEM → 再加 **$0.25/GB** 出口费

**成本示例（日产 100GB）：**
| 策略 | 月成本 |
|------|-------|
| 全部索引 | $300 (摄取) + $510 (索引 3亿事件) = **$810** |
| 20% 索引 + 80% Flex | $300 + $102 + $12 = **$414** |
| 仅摄取不索引 | $300（但日志不可搜索） |

**备注：** 日志双重计费是 Datadog 在用户社区中被批评最多的地方。摄取费就像一个「入场税」，而索引费决定了你能否真正使用这些数据。

---

## Slide 10 | Custom Metrics：沉默的账单杀手

**标题：** 一个 `customer_id` 标签 = 10,000 条计费指标

**免费额度与超额：**
| 层级 | 免费额度 | 超额价格 |
|------|---------|---------|
| Pro | 100 指标/主机 | **$5/100 指标/月** |
| Enterprise | 200 指标/主机 | **$5/100 指标/月** |

**标签基数爆炸原理：**
```
指标：http.request.latency
├── 标签: endpoint (50个), status_code (5个), region (3个)
│   → 50 × 5 × 3 = 750 个唯一组合 = 750 条计费指标
│
├── 加上 customer_id（10万用户）
│   → 750 × 100,000 = 75,000,000 条计费指标
│   → $375,000/月！！！
```

**Datadog 的解法 —— 「Metrics without Limits™」：**
- 允许你选择哪些标签维度被索引
- 未索引的标签组合按 **$0.10/100 指标** 低价计费
- **但这仍然是额外成本**，只是从「极度昂贵」降到「比较昂贵」

**K8s 场景典型放大：**
```
50 Node K8s 集群
├── 每个 Node 产生 ~200 个自动指标
├── 每个 Pod 产生 ~50 个自动指标 (200 Pods)
├── 总计: (50×200) + (200×50) = 20,000 指标
├── 免费额度: 50×100 = 5,000
└── 超额: 15,000 × $0.05 = $750/月（仅此一项）
```

**备注：** 自定义指标在大规模部署中经常成为最大的单项支出，超过 Infra + APM 之和。OpenTelemetry 指标是否全部算作自定义指标存在争议（BetterStack 声称是，但未经官方充分确认）。

---

## Slide 11 | 全产品线速览（一）

**标题：** Database Monitoring / Network / Serverless / RUM

**Database Monitoring：**
| 参数 | 值 |
|------|---|
| 价格 | **$70/主机/月**（年付） |
| 依赖 | 必须先有 Infra |
| 支持 | Postgres, MySQL, SQL Server, Oracle, MongoDB 等 |

**Network Performance Monitoring：**
| 参数 | 值 |
|------|---|
| 价格 | **$5/主机/月**（年付） |
| 依赖 | 必须先有 Infra |
| 能力 | 流量可视化、DNS 追踪、网络拓扑 |

**Serverless Monitoring：**
| 参数 | 值 |
|------|---|
| Lambda | **$7.50/百万调用**（年付） |
| Fargate | ~$1/task/月 (Infra) + ~$2.60/task/月 (APM) |
| 计费方式 | 按调用次数，不是按主机 |

**Real User Monitoring (RUM）：**
| 层级 | 价格（年付/1000 会话） |
|------|---------------------|
| Browser RUM | **$1.50** |
| RUM + Session Replay | **$1.80** |
| Mobile RUM | **$1.50** |

**备注：** RUM 和 Synthetics 不依赖 Infra，可以独立购买。这是 Datadog 少数可以不捆绑 Infra 的产品。

---

## Slide 12 | 全产品线速览（二）

**标题：** Synthetics / Cloud SIEM / CI Visibility

**Synthetic Monitoring（成本与频率 × 位置强相关）：**
| 测试类型 | 价格（年付） |
|---------|------------|
| API 测试 | **$5/10,000 次运行** |
| 浏览器测试 | **$12/1,000 次运行** |

临界案例：100 个 API 检查 × 每 1 分钟 × 5 个位置 = **~$15,552/月**

**Cloud SIEM：**
| 计费模式 | 价格 |
|---------|------|
| 按分析量 | **$0.20/GB** |
| 按主机 | **$10-25/主机/月** |

**CI Pipeline Visibility：**
- **$8/committer/月**（年付）
- 按提交代码的唯一开发者数量计费

**其他：**
| 产品 | 价格 |
|------|------|
| Continuous Profiler | $12/主机/月（如不含在 APM Enterprise 中） |
| Error Tracking | 免费（含在 APM 中） |
| Incident Management | 免费 |
| Feature Flags | $55/百万请求 |

---

## Slide 13 | 🔥 AI 能力全景：Bits AI 产品矩阵

**标题：** Datadog 的 AI 战略 —— 从 Copilot 到自主 Agent 平台

**Bits AI 产品矩阵（2025-2026）：**

| Agent | 状态 | 功能 |
|-------|------|------|
| **Bits Investigation** | GA (2025.12) | 自主告警调查、根因分析、假设验证 |
| **Bits Security Analyst** | GA (2026.03) | 自主分流 Cloud SIEM 信号，MITRE ATT&CK |
| **Bits Chat** | GA | 自然语言搜索、Dashboard 创建、Monitor 检查 |
| **Bits Code** | GA | AI 辅助代码生成、Review、Debug |
| **Bits Agent Builder** | Preview | 自定义 AI Agent（2000+ 预置动作） |
| **Bits Dev Agent** | 部分 GA | 代码修复生成、PR 创建、CI 监控迭代 |

**自研模型 —— Toto：**
- Time Series Optimized Transformer for Observability
- 基于 1 万亿匿名数据点训练
- Apache 2.0 开源（4M - 2.5B 参数）
- 驱动 Watchdog 异常检测和 Bits AI

**备注：** Datadog 在 AI 上的投入很大，Bits AI 已经从简单的 ChatBot 演进为多 Agent 平台。关键是，这些都是**额外收费**的 —— AI 不是免费附加功能，而是独立的收入线。

---

## Slide 14 | 🔥 AI 定价：AI Credits 体系

**标题：** AI 不免费 —— 按「智能工作单元」计费

**AI Credits 概念：1 Credit = 1 单位智能工作**

| 计费方式 | 结构 |
|---------|------|
| 年度 Commit | 12 个月，按月计费，**500 Credits/月起** |
| 月度 Commit | 按月购买，500 Credits/月起 |
| 按需 (On-Demand) | 无承诺，按实际用量，~$1.30/Credit |

**各功能 Credit 消耗：**
| 功能 | 每次消耗 |
|------|---------|
| Bits Chat — 搜索/探索遥测数据 | 0.6 Credit |
| Bits Chat — Dashboard 创建 | 0.7 Credit |
| Bits Chat — Monitor 创建 | 0.5 Credit |
| Bits Agent Builder — 消息 | 0.3 Credit |
| Bits Code — 代码修复 | 5.0 Credit |
| **Bits Investigation — 自主调查** | **6.5 Credit** |

**Bits AI SRE 定价（每 20 次结论性调查）：**
| 计费方式 | 价格 |
|---------|------|
| 年付 | **$500/月** |
| 月付 | $600/月 |
| 按需 | ~$25-30/次（仅结论性调查计费） |

**备注：** 「非结论性调查不收费」是一个有意思的设计 —— 只有 AI 找到了根因才收钱。这降低了用户的试用门槛，但也意味着成功率和用量增长直接转化为收入。

---

## Slide 15 | 🔥 LLM Observability —— 为 AI 应用监控而生的新产品

**标题：** LLM 应用产生 10-50x 更多遥测数据 —— 也需要专属定价

**产品定价：**
| 产品 | 价格（年付） |
|------|------------|
| LLM Observability | **$8/10,000 LLM 请求/月** |
| 包含 | 端到端追踪、Token 用量、Guardrails、敏感数据扫描 (1GB/10K 请求) |

**前置依赖链：**
```
Infrastructure Pro ($15) → APM ($31-40) → LLM Observability ($8/10K req)
总基础成本: $46-55/host/月 + LLM 请求费
```

**为什么成本会爆炸？**
```
1 次用户消息 → AI Agent
├── 1 个 Chat Span
├── 3-5 个 Tool Execution Span
├── 2 个 Retrieval Span（含 Embedding）
├── 1 个 Parent Coordination Span
└── 合计：10+ Span → 10x 于传统微服务调用！
```

**真实成本对比：**
| 规模 | LLM 请求/月 | Datadog 年成本（列表价） | 自建年成本 |
|------|-----------|----------------------|---------|
| 小型 | 1 千万 | **~$96K** | ~$2,600 |
| 中型 | 1 亿 | **~$960K** | ~$17,500 |
| 大型 | 10 亿 | **~$9.6M** | ~$175K |

**备注：** LLM Observability 是 Datadog 最新的增长引擎。AI 应用的遥测密度远超传统应用，这意味着 Datadog 在 AI 时代的 ARPU 还有巨大上升空间。但这也意味着客户的账单会以超线性速度增长 —— 已有团队报告加入 LLM 监控后账单增长 40-200%。

---

## Slide 16 | 用户如何被收费？—— 计费流程全景

**标题：** 从部署到账单 —— 一条数据的「收费之旅」

**计费流程图：**
```
                    每月 1 号
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
   │ 主机计数 │    │ 用量统计  │   │ 事件统计  │
   │ (每小时)│    │ (GB/月)  │   │ (条数/月) │
   └────┬────┘    └─────┬─────┘   └─────┬─────┘
        │               │               │
   ┌────▼────┐          │               │
   │ HWMP 99%│          │               │
   │ 峰值锁定│          │               │
   └────┬────┘          │               │
        │               │               │
        └───────────────┼───────────────┘
                        │
                ┌───────▼───────┐
                │  月底汇总账单  │
                │  = Σ(各产品)  │
                └───────────────┘
```

**用户付款方式：**
| 方式 | 特点 |
|------|------|
| **年度 Commit** | 承诺年消费额，享 10-40% 折扣，按月结算 |
| **月度 Commit** | 按月承诺，折扣少 |
| **按需 (On-Demand)** | 不承诺，溢价 20-50% |
| **Enterprise Agreement** | 1-3 年大合同，定制折扣（不公开） |

**备注：** Datadog 按年签约但按月结算，这平滑了现金流同时锁定了年度承诺。超额部分按 On-Demand 价格自动计费 —— 用户不需要「升级」就会自动多付钱。

---

## Slide 17 | Commit 合约 vs 按需：对比分析

**标题：** 年付省钱但锁规模，月付灵活但贵 20-50%

| 维度 | 按需/月付 | 年度 Commit | Enterprise 合同 |
|------|----------|------------|----------------|
| 单价 | 溢价 20-50% | 列表价 | 定制折扣 |
| 折扣空间 | 无 | 10-40% | 更大（不公开） |
| 灵活性 | 随时增减 | 锁定最低年消费 | 锁定 1-3 年 |
| 超额计费 | 按需价 | 按需价 | 协商价 |
| 适用场景 | POC/小团队 | 有稳定规模预测 | 100+ 节点大型部署 |

**实际成交数据（Vendr 1,111 笔交易）：**
```
中位年支出:        $153,839
典型区间:          $21,000 – $688,800
通过采购平台节省:     ~10%
企业合同额外折扣:    10-25%（估算）
```

**谈判要点：**
1. 按 **总承诺消费额** 谈折扣，不按单个 SKU
2. 多年合同中默认年涨幅 **8-15%**，可谈判压低
3. 续约时通常涨价 **25-50%**，可压到 **20-35%** 区间
4. 承诺包含未来产品采用（如 AI）可获更好条件

**备注：** Datadog 的销售策略是「先用按需让客户进来，用量增长后用账单痛苦驱动 commit 签约」。历史数据显示客户年支出增长 30-50% 是常态。

---

## Slide 18 | 隐藏成本 Top 5

**标题：** 这些坑，大部分用户都踩过

**① K8s Agent Sidecar 误配（影响：10x+）**
- 用 sidecar 而非 DaemonSet → 每个 Pod 算一个主机
- 50 节点 / 500 Pod → 50 vs 500 台计费

**② 未过滤的日志摄取（影响：3-5x）**
- 默认没有日志过滤 → DEBUG 日志也被计费
- 解决：部署时即配置摄入过滤规则

**③ 无节制的自定义指标（影响：2-5x）**
- 高基数标签（user_id, session_id）→ 指标数爆炸
- 解决：使用 Metrics without Limits、定期审计

**④ HWMP 峰值锁定（影响：2-3x）**
- 一次持续 7h+ 的扩容 = 整月峰值计费
- 解决：扩容策略中管理时间窗口

**⑤ 产品蔓延 (Product Sprawl)（影响：累加）**
```
仅 Infra Pro:              $15/host/月
+ APM:                     $46/host/月
+ DBM:                     $116/host/月
+ NPM:                     $121/host/月
+ Security Pro:            $131/host/月
+ Profiler:                $143/host/月
50 台 = $85,800/年（不含日志/指标/RUM/Synthetics/AI）
```

**备注：** 隐藏成本的核心问题不是 Datadog「乱收费」，而是计费模型足够复杂，以至于用户发现不了成本来源。建议每月审计 Usage 页面。

---

## Slide 19 | 真实场景成本测算

**标题：** 三个典型规模，三个真实账单

**场景 A：小型团队（10 台主机，起步阶段）**
| 产品 | 月成本 |
|------|-------|
| Infra Pro (10 hosts) | $150 |
| APM Standard (10 hosts) | $310 |
| Log Management (~50GB/天) | ~$235 |
| 自定义指标（少量超额） | ~$50 |
| **合计** | **~$745/月 ($8,940/年)** |

**场景 B：中型团队（50 台主机，业务增长期）**
| 产品 | 月成本 |
|------|-------|
| Infra Enterprise (50 hosts) | $1,150 |
| APM Pro (50 hosts) | $1,750 |
| Log Management (~200GB/天) | ~$1,875 |
| 自定义指标 (~30,000 超额) | ~$1,250 |
| RUM (50万 会话) | $75 |
| Synthetics (中等) | $540 |
| NPM (50 hosts) | $250 |
| DBM (5 数据库) | $350 |
| **合计** | **~$7,240/月 ($86,880/年)** |

**场景 C：大型团队（200 台主机 + AI）**
| 产品 | 月成本 |
|------|-------|
| Infra Enterprise (200 hosts) | $4,600 |
| APM Enterprise (200 hosts) | $8,000 |
| Log Management (~1TB/天) | ~$7,500 |
| 自定义指标 (~100,000 超额) | ~$4,750 |
| RUM (500万 会话) | $750 |
| Synthetics (全面) | $2,500 |
| NPM (200 hosts) | $1,000 |
| DBM (20 数据库) | $1,400 |
| Cloud SIEM | $2,000 |
| Bits AI SRE (100 次/月) | $2,500 |
| LLM Observability (5000万 req) | $4,000 |
| **合计** | **~$39,000/月 ($468,000/年)** |

> 💡 以上为列表价。年度 Commit 合同通常可获得 20-35% 折扣。

---

## Slide 20 | 竞品定价对比

**标题：** Datadog 在可观测性市场的定价定位

| 产品 | Infra (每主机/月) | APM (每主机/月) | 日志 ($/GB) | 备注 |
|------|------------------|----------------|-------------|------|
| **Datadog** | $15-23 | $31-40 | $0.10 + 索引 | 功能最全 |
| **Grafana Cloud** | $8-15 | $20-30 | ~$0.05 | OSS 基因 |
| **New Relic** | $0.30/GB | 含在用量 | $0.30/GB | 纯用量模型 |
| **Dynatrace** | $60-80/8GB | 含在 Infra | 含在 Infra | 全栈一体 |
| **SigNoz** | 开源免费 | 开源免费 | 自建 | OSS 替代 |
| **Uptrace** | 开源免费 | 开源免费 | 自建 | OSS 替代 |

**成本倍数（同等规模 vs Datadog）：**
- Grafana Cloud: ~0.5x (便宜一半)
- New Relic: ~0.6-0.8x
- SigNoz (自建): ~0.05-0.1x (便宜 10-20x)
- 自建 OTel + ClickHouse + Grafana: ~0.01-0.02x

**备注：** Datadog 的定价在市场上处于高端，但其产品集成度和开箱即用体验也是最好的。价值判断取决于团队规模和已有基础设施投入。

---

## Slide 21 | 关键决策框架

**标题：** 什么时候选 Datadog？什么时候不该选？

**✅ Datadog 适合你，如果：**
- 基础设施规模可预测，不会频繁大规模弹性伸缩
- 团队规模大（50+ 工程师），需要统一平台减少工具碎片化
- 全额使用多个产品线（APM + Logs + RUM + Synthetics），发挥集成价值
- 有专职 FinOps/采购人员管理年度合同谈判
- 需要开箱即用的 AI 能力（Bits AI / LLM Observability）

**❌ Datadog 可能不适合你，如果：**
- 基础设施弹性伸缩频繁（每次峰值 >7h 锁死整月账单）
- 早期创业公司，年 IT 预算 < $50K
- 日志量大但只需少量搜索（日志双重计费太贵）
- 需要完全可预测的月度账单
- 核心需求只是基础监控 + 少量 APM（过度购买）

**💡 混合策略：**
- 核心生产环境用 Datadog（利用集成优势）
- 开发/测试环境用 OSS（Grafana + Prometheus）
- 日志冷存储用 Flex Logs 或外发到 S3

---

## Slide 22 | 总结：Datadog 计费的「底层逻辑」

**标题：** 五个核心认知

```
┌─────────────────────────────────────────────┐
│  ① 入口低价，叠加高价                        │
│     $15/host 看起来很便宜                    │
│     加上 APM + DBM + NPM → $120+/host       │
├─────────────────────────────────────────────┤
│  ② 峰值锁定，平均无用                        │
│     不是按月均用量计费，是按 99% 峰值         │
│     7 小时以上的扩容 = 整月付费               │
├─────────────────────────────────────────────┤
│  ③ 数据越多，税越重                          │
│     日志、指标、Span 都是按量计费             │
│     业务增长 → 数据增长 → 账单增长 (超线性)   │
├─────────────────────────────────────────────┤
│  ④ AI 不是福利，是新产品线                    │
│     Bits AI / LLM Observability 都独立计费   │
│     每个 AI 能力都有对应的 Credits 消耗       │
├─────────────────────────────────────────────┤
│  ⑤ License = 基础设施规模税                   │
│     不按人头，但你的云账单越大                 │
│     Datadog 账单越大，且不设上限              │
└─────────────────────────────────────────────┘
```

**一句总结：**
> Datadog 卖的不是「监控工具」，而是**按照你的基础设施规模和数据量征收的可观测性税**。用得越深、长得越快、付得越多。

---

## Slide 23 | 附录 & 参考来源

**主要数据源：**
- [Datadog Official Pricing](https://datadoghq.com/pricing/list/)
- [Datadog Billing Documentation](https://docs.datadoghq.com/account_management/billing/)
- [Datadog AI Credits Documentation](https://docs.datadoghq.com/account_management/billing/ai_credits/)
- [DoiT — Datadog Pricing Explained](https://www.doit.com/blog/datadog-pricing-explained)
- [BetterStack — Datadog Pricing Gotchas](https://betterstack.com/community/comparisons/datadog-pricing-gotchas/)
- [Obsium — Datadog Billing: How It Actually Works](https://obsium.io/blog/datadog-billing-how-it-actually-works/)
- [Vendr — Datadog Marketplace Data (1,111 transactions)](https://www.vendr.com/marketplace/datadog)
- [OneUptime — How Datadog Pricing Actually Works (2026)](https://oneuptime.com/blog/post/2026-03-13-how-datadog-pricing-actually-works/view)
- [Last9 — Datadog Pricing All Your Questions Answered](https://last9.io/blog/datadog-pricing-all-your-questions-answered/)
- [SigNoz — Datadog Pricing Main Caveats Explained](https://signoz.io/blog/datadog-pricing/)
- [CloudZero — Datadog Pricing Full Cost Breakdown 2026](https://www.cloudzero.com/blog/datadog-pricing/)

**调研方法论：**
- 5 条搜索角度并行搜索
- 18 个来源提取 45 条声明
- 每条声明经 3 轮对抗性验证（需 2/3 反对才能被驳斥）
- 最终确认 16 条高置信度结论，驳斥 9 条错误信息，合成 8 条核心发现

---

*文档生成于 2026 年 6 月 22 日。所有价格均为当时列表价，实际成交价因合同规模和谈判而异。*
