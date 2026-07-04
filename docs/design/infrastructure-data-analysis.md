# ZeroTrace 基础设施数据采集分析

## 一、数据库已有的主机信息

### 1. vtap（Agent 主机元数据）— 来源：zerotrace-server `/v1/vtaps/`

| 字段 | 当前值 | 说明 |
|------|--------|------|
| NAME | auto-vm-202.112.237.37-W8 | 主机名 |
| CTRL_IP | 202.112.237.37 | Agent IP |
| CTRL_MAC | 14:18:77:53:e9:8e | 物理 MAC |
| CPU_NUM | 12 | CPU 核数（静态容量，非实时使用率） |
| MEMORY_SIZE | 130,449,580,032 (~121.5GB) | 内存总容量（静态，非实时使用率） |
| OS | Ubuntu 26.04 | 操作系统 |
| KERNEL_VERSION | 7.0.0-14-generic | 内核版本 |
| ARCH | x86_64 | CPU 架构 |
| STATE | 1 | 1=Online, 2=Stale, 3=Offline |
| SYNCED_CONTROLLER_AT | 2026-07-02 07:28:02 | Agent 最后同步时间 |
| REVISION | dev 12597 | Agent 版本 |
| ORG_ID | 56 | 所属组织 |

### 2. vm 表（虚拟机清单）— 来源：DeepFlow MySQL `deepflow.vm`

| 字段 | 说明 |
|------|------|
| name | 虚拟机名称（如 `auto-vm-202.112.237.37`） |
| ip | VM IP 地址 |
| hostname | 主机名 |
| state | 状态 |

当前有 8 条 VM 记录，包括：
- `auto-vm-202.112.237.37`（3条，不同网段）
- `auto-vm-172.17.0.1`
- `auto-vm-172.18.0.1`

### 3. 网络流量指标 — 来源：ClickHouse `flow_metrics.network.1m`

| 指标 | 当前值（1小时） | 说明 |
|------|----------------|------|
| byte_tx | 309.4 MB | 发送流量 |
| byte_rx | 659.0 MB | 接收流量 |
| new_flow | 71,628 | 新建连接数 |
| flow_load | — | 并发连接负载 |

粒度：1秒 / 1分钟 / 1小时 / 1天

### 4. 进程列表 — 来源：ClickHouse `l7_flow_log.process_kname`

| 进程 | 请求数（1小时） | 平均延迟 | 说明 |
|------|----------------|---------|------|
| mysqld | 101,473 | 0.19ms | MySQL 数据库 |
| zerotrace-serve | 8,428 | 5.99ms | DeepFlow 控制器 |
| clickhouse-serv | 5,170 | 64.10ms | ClickHouse 数据库 |
| node | 2,508 | 200ms | Vite 前端开发服务器 |
| zerotrace-web | 319 | 0.01ms | Rust 后端 |

> 注意：这里的"进程"是 eBPF agent 从网络流量中解析出来的，不是系统进程列表。只包含产生了 L7 HTTP/gRPC 请求的进程。

---

## 二、对比 Datadog 缺失的指标

| Datadog 基础设施页 | 我们 | 缺失原因 | 采集方案 |
|-------------------|------|---------|---------|
| **CPU 使用率 %** | ❌ 只有静态核数 | eBPF agent 不采集 CPU | Agent 添加 procfs `/proc/stat` 读取 |
| **CPU IOWait %** | ❌ | 同上 | `/proc/stat` |
| **Load Average (1/5/15)** | ❌ | 同上 | `/proc/loadavg` |
| **内存使用率 %** | ❌ 只有静态容量 | eBPF agent 不采集内存 | `/proc/meminfo` |
| **磁盘使用率** | ❌ | 无磁盘采集 | `statfs()` 系统调用 |
| **磁盘 I/O** | ❌ | 同上 | `/proc/diskstats` |
| **网络速率（实时）** | ⚠️ 有汇总值 | host_id=0 无法按主机拆分 | Agent 上报时带 host_id |
| **网络丢包/重传** | ⚠️ flow_metrics 有字段 | 同上 | 同网络速率 |
| **进程 CPU/内存占用** | ❌ | 无进程级资源采集 | `/proc/[pid]/stat` |
| **容器列表** | ❌ | 未连接 K8s | 连接 K8s API 或采集 containerd/docker socket |
| **K8s Pod/Node** | ❌ MySQL 表结构存在但无数据 | 无 K8s 集群 | 连接 K8s API Server |
| **主机标签/Tag** | ❌ | 无标签来源 | 前端支持自定义 tag，写在 vtap 表 |

---

## 三、采集优先级建议

### P0（阻塞基础设施页面展示）

| 指标 | 方案 | 工作量 |
|------|------|--------|
| CPU 使用率 | Agent 添加 procfs 定时采集（每 10s 读 `/proc/stat`） | 小 |
| 内存使用率 | Agent 读 `/proc/meminfo` | 小 |
| 网络速率按主机拆分 | 修复 flow_metrics 的 host_id 映射 | 中 |

### P1（完善主机详情页）

| 指标 | 方案 |
|------|------|
| Load Average | Agent 读 `/proc/loadavg` |
| 磁盘使用率 | Agent `statfs()` 调用 |
| 进程 CPU/内存 | Agent 读 `/proc/[pid]/stat`（前 20 进程） |
| 主机标签 | 前端 + Rust 后端支持自定义 tag 增删 |

### P2（容器/K8s 生态）

| 指标 | 方案 |
|------|------|
| 容器列表 | 连接 Docker socket 或 containerd |
| K8s Pod/Node/Service | 连接 K8s API Server |
| K8s 资源指标 | 部署 K8s metrics-server |

---

## 四、当前前端展示能力

基于已有数据，基础设施页面已可实现：

| 功能 | 状态 | 数据来源 |
|------|------|---------|
| 主机列表（名称/IP/OS/CPU/RAM） | ✅ 已实现 | vtap API + flow_metrics |
| 主机在线状态 | ✅ | vtap STATE |
| 网络 TX/RX 汇总 | ✅ | flow_metrics.network.1m |
| 进程列表（L7 流量进程） | ✅ | l7_flow_log.process_kname |
| 主机详情面板 | ⚠️ 部分（无 CPU%/Mem%/Disk） | vtap + flow_metrics |
| 主机地图 | ✅ 已有组件 | HostMap 组件 |
| 容器列表 | ❌ 占位页 | 无数据 |
