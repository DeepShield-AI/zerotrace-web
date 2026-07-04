# Datadog 产品依赖关系图

## 版本一：完整依赖树（适合详细分析）

```mermaid
graph TB
    INFRA["🔴 Infrastructure Monitoring<br/>$15-23/host/月<br/>（必选入口产品）"]

    %% 依赖 Infra 的产品
    INFRA --> APM["🟠 APM<br/>$31-40/host/月"]
    INFRA --> DBM["🟠 Database Monitoring<br/>$70/host/月"]
    INFRA --> NPM["🟠 Network Monitoring<br/>$5/host/月"]
    INFRA --> PROFILER["🟠 Continuous Profiler<br/>$12/host/月"]
    INFRA --> SECURITY["🟠 Security Pro<br/>$10-25/host/月"]

    %% APM 的子依赖
    APM --> LLM["🟡 LLM Observability<br/>$8/10K 请求/月"]

    %% 独立产品
    LOGS["🟢 Log Management<br/>$0.10/GB + 索引费"]
    RUM["🟢 RUM<br/>$1.50/1K 会话"]
    SYNTH["🟢 Synthetics<br/>$5/10K API 测试<br/>$12/1K 浏览器测试"]
    SIEM["🟢 Cloud SIEM<br/>$0.20/GB 分析"]
    AI["🟢 AI Credits<br/>$500/500 Credits"]
    SERVERLESS["🟢 Serverless<br/>$7.50/百万调用"]
    CI["🟢 CI Visibility<br/>$8/committer"]

    %% 样式
    classDef infra fill:#e74c3c,color:#fff,stroke:#c0392b,stroke-width:3px
    classDef dependent fill:#e67e22,color:#fff,stroke:#d35400,stroke-width:2px
    classDef subdependent fill:#f1c40f,color:#333,stroke:#f39c12,stroke-width:2px
    classDef standalone fill:#2ecc71,color:#fff,stroke:#27ae60,stroke-width:2px

    class INFRA infra
    class APM,DBM,NPM,PROFILER,SECURITY dependent
    class LLM subdependent
    class LOGS,RUM,SYNTH,SIEM,AI,SERVERLESS,CI standalone
```

---

## 版本二：简化版（适合 PPT 展示）

```mermaid
graph TD
    INFRA["🔴 Infrastructure Monitoring"]

    INFRA -->|"必须捆绑"| A["APM $31-40"]
    INFRA -->|"必须捆绑"| B["DBM $70"]
    INFRA -->|"必须捆绑"| C["NPM $5"]
    INFRA -->|"必须捆绑"| D["Profiler $12"]
    INFRA -->|"必须捆绑"| E["Security $10-25"]

    A -->|"必须捆绑"| A1["LLM Observability"]

    独立["🟢 独立产品<br/>（不捆绑 Infra）"] -.-> L["Log Management"]
    独立 -.-> R["RUM / Synthetics"]
    独立 -.-> S["Cloud SIEM"]
    独立 -.-> AI_["AI Credits"]
    独立 -.-> SV["Serverless"]
    独立 -.-> CI_["CI Visibility"]

    style INFRA fill:#e74c3c,color:#fff
    style A fill:#e67e22,color:#fff
    style B fill:#e67e22,color:#fff
    style C fill:#e67e22,color:#fff
    style D fill:#e67e22,color:#fff
    style E fill:#e67e22,color:#fff
    style A1 fill:#f39c12,color:#333
    style L fill:#2ecc71,color:#fff
    style R fill:#2ecc71,color:#fff
    style S fill:#2ecc71,color:#fff
    style AI_ fill:#2ecc71,color:#fff
    style SV fill:#2ecc71,color:#fff
    style CI_ fill:#2ecc71,color:#fff
```

---

## 版本三：计费叠加视图（适合成本分析）

```mermaid
graph LR
    subgraph 免费层
        FREE["Free Tier<br/>5 主机 / 1天保留<br/>无告警"]
    end

    subgraph 必选入口
        PRO["Infra Pro $15"]
        ENT["Infra Enterprise $23"]
        DEVPRO["DevSecOps Pro $22"]
        DEVENT["DevSecOps Enterprise $34"]
    end

    subgraph 必须捆绑的可选层
        APM2["APM +$31~40"]
        DBM2["DBM +$70"]
        NPM2["NPM +$5"]
        SEC2["Security +$10~25"]
        PROF2["Profiler +$12"]
    end

    subgraph APM子层
        LLM2["LLM Obs +$8/10K"]
    end

    subgraph 独立可选层
        LOGS2["Logs 按量"]
        RUM2["RUM 按量"]
        SYNTH2["Synthetics 按量"]
        SIEM2["Cloud SIEM 按量"]
        AI2["AI Credits 按量"]
    end

    FREE --> PRO
    FREE --> ENT
    PRO --> APM2
    ENT --> APM2
    PRO --> DBM2
    ENT --> DBM2
    APM2 --> LLM2
    PRO --> LOGS2
    ENT --> RUM2

    style FREE fill:#95a5a6,color:#fff
    style PRO fill:#e74c3c,color:#fff
    style ENT fill:#e74c3c,color:#fff
    style APM2 fill:#e67e22,color:#fff
    style DBM2 fill:#e67e22,color:#fff
    style LLM2 fill:#f1c40f,color:#333
    style LOGS2 fill:#2ecc71,color:#fff
```

---

## 版本四：文字版 ASCII（适合纯文本环境）

```
┌─────────────────────────────────────────────────────────────┐
│                  🔴 Infrastructure Monitoring                │
│                    $15-23/host/月 (必选)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  🟠 APM       │  │  🟠 DBM       │  │  🟠 NPM       │
│  $31-40/host  │  │  $70/host     │  │  $5/host      │
└───────┬───────┘  └───────────────┘  └───────────────┘
        │
        ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  🟡 LLM Obs   │  │  🟠 Profiler  │  │  🟠 Security   │
│  $8/10K req   │  │  $12/host     │  │  $10-25/host  │
└───────────────┘  └───────────────┘  └───────────────┘


    🟢 独立产品 (不依赖 Infra，可直接购买)

┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ Log Mgmt  │ │   RUM     │ │Synthetics │ │Cloud SIEM │
│ 按量计费  │ │ 按量计费  │ │ 按量计费  │ │ 按量计费  │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
┌───────────┐ ┌───────────┐ ┌───────────┐
│AI Credits │ │Serverless │ │CI Visibl. │
│ 按量计费  │ │ 按量计费  │ │ 按量计费  │
└───────────┘ └───────────┘ └───────────┘
```

---

## 图例

| 颜色 | 含义 |
|------|------|
| 🔴 红色 | 必选入口产品 |
| 🟠 橙色 | 必须捆绑 Infra 的产品 |
| 🟡 黄色 | 二级依赖（捆绑 APM） |
| 🟢 绿色 | 独立产品，可直接购买 |

---

> 提示：Mermaid 流程图可在 VS Code（安装 Mermaid 插件）、GitHub Markdown、Typora、Notion 等工具中直接渲染。复制对应代码块即可使用。
