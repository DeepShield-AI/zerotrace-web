# Zerotrace Web — 本地开发指南

本文档详细说明如何在本地搭建 Zerotrace Web 的开发环境，包括依赖安装、后端与前端启动、以及常见问题排查。

---

## 目录

- [环境要求](#环境要求)
- [项目结构概览](#项目结构概览)
- [第一步：安装依赖](#第一步安装依赖)
  - [配置 npm 源](#配置-npm-源)
  - [前端依赖](#前端依赖)
  - [后端依赖](#后端依赖)
  - [外部服务（数据库）](#外部服务数据库)
- [第二步：配置环境变量](#第二步配置环境变量)
- [第三步：初始化数据库](#第三步初始化数据库)
- [第四步：启动开发服务器](#第四步启动开发服务器)
  - [方式 A：只启动前端（推荐日常使用）](#方式-a只启动前端推荐日常使用)
  - [方式 B：前后端联调](#方式-b前后端联调)
- [项目脚本说明](#项目脚本说明)
- [常见问题](#常见问题)
- [生产构建](#生产构建)

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|---|---|---|
| **Node.js** | 18+（推荐 22+） | 前端运行时与包管理 |
| **pnpm** | 8+ | 前端包管理器（**不要**使用 npm/yarn） |
| **Rust** | 1.80+ | 后端编译与运行 |
| **Cargo** | 随 Rust 安装 | Rust 构建工具与包管理器 |
| **MySQL** | 8.0+ | 元数据存储（用户、组织、计费等） |
| **ClickHouse** | （可选） | 遥测数据存储（APM、日志、指标查询） |
| **Git** | 任意 | 版本控制 |

### 安装 Rust

```bash
# 推荐使用 rustup 安装
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装后重新加载 shell 环境
source ~/.cargo/env

# 验证安装
rustc --version   # 应显示 >= 1.80
cargo --version
```

### 安装 pnpm

```bash
# 方式 1：通过 npm 全局安装
npm install -g pnpm

# 方式 2：通过 corepack（Node 16.13+ 内置）
corepack enable
corepack prepare pnpm@latest --activate

# 验证
pnpm --version
```

---

## 项目结构概览

```
zerotrace-web/
├── frontend/                 ← React 18 + Vite + TypeScript + Tailwind + Ant Design
│   ├── src/
│   │   ├── api/              ← 后端 API 调用（client.ts）
│   │   ├── components/       ← 业务组件 + ui/ 底层原语
│   │   ├── pages/            ← 路由级页面
│   │   ├── hooks/            ← 自定义钩子
│   │   ├── i18n/             ← 中英双语翻译
│   │   ├── styles/           ← tokens.css（设计 token）
│   │   ├── lib/              ← tokens.ts（ECharts 色板常量）
│   │   └── mocks/            ← MSW mock 数据（规划中）
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── backend/                  ← Rust + Axum + SQLx
│   ├── src/
│   │   ├── handlers/         ← REST 端点（auth、apm、infra、billing…）
│   │   ├── models/           ← 数据模型
│   │   ├── middleware/       ← 认证/鉴权中间件
│   │   ├── guardian/         ← AI 异常检测引擎
│   │   ├── billing/          ← 用量采集与账单生成
│   │   └── main.rs           ← 入口
│   ├── migrations/           ← 数据库迁移脚本（SQL）
│   └── Cargo.toml
├── docs/
│   ├── user/                 ← 用户文档（你正在读的）
│   └── changelog/            ← 版本变更日志
├── docker-compose.yml        ← 生产部署
├── Dockerfile                ← 生产镜像构建
└── scripts/
    └── prepare-docker-build.sh ← 构建准备脚本
```

---

## 第一步：安装依赖

### 配置 npm 源

前端依赖通过私有 Verdaccio 源分发，安装前需先配置 pnpm 使用该源：

```bash
pnpm config set registry http://47.97.67.233:4873/
```

本项目使用 **pnpm workspace** 管理依赖，仓库根目录的 `pnpm-workspace.yaml` 需包含 `packages` 字段：

```yaml
# zerotrace-web/pnpm-workspace.yaml
packages:
  - 'frontend'

allowBuilds:
  '@swc/core': true
  esbuild: true
  msw: true
```

`allowBuilds` 用于预先批准 `@swc/core`、`esbuild`、`msw` 三个需要执行 postinstall 构建脚本的包。pnpm v10+ 出于供应链安全默认会拦截这些脚本，缺少此配置会导致依赖安装不完整。

### 前端依赖

> **重要**：请在**工作区根目录**（`zerotrace-web/`）执行 `pnpm install`，而不是在 `frontend/` 下。lockfile 和 virtual store 都存放在根目录。

```bash
cd zerotrace-web
pnpm install
```

如果看到 `[ERR_PNPM_IGNORED_BUILDS]` 警告，运行 `pnpm approve-builds` 后重新安装：

```bash
pnpm approve-builds   # 交互式批准 @swc/core、esbuild、msw
pnpm install          # 重新安装 — 此次会执行构建脚本
```

安装完成后，`frontend/node_modules/` 应包含所有依赖。关键依赖一览：

| 类别 | 包 | 用途 |
|---|---|---|
| 框架 | `react`, `react-dom` | UI 框架 |
| 路由 | `react-router-dom` | 客户端路由 |
| 数据 | `@tanstack/react-query` | 服务端状态管理 |
| UI | `antd`, `@ant-design/icons` | 组件库 |
| UI | `lucide-react` | 图标库 |
| 图表 | `echarts`, `echarts-for-react` | 数据可视化 |
| 样式 | `tailwindcss`, `tailwind-merge` | 原子化 CSS |
| 国际化 | `i18next`, `react-i18next` | 中英文切换 |
| 工具 | `date-fns`, `clsx`, `zustand` | 日期/样式/状态 |
| Mock | `@faker-js/faker` | 假数据生成（规划中） |

### 后端依赖

```bash
cd backend

# 首次编译会自动下载并编译所有 Rust 依赖。
# 耗时较长（约 2-5 分钟），耐心等待。
cargo build
```

Rust 依赖通过 `Cargo.toml` 管理，核心依赖：

| 包 | 用途 |
|---|---|
| `axum` | HTTP 框架 |
| `tokio` | 异步运行时 |
| `sqlx` | MySQL 数据库驱动 |
| `serde` / `serde_json` | 序列化 |
| `jsonwebtoken` | JWT 认证 |
| `argon2` | 密码哈希 |
| `tower-http` | HTTP 中间件（CORS、静态文件） |
| `tracing` | 结构化日志 |
| `reqwest` | HTTP 客户端（调用 zerotrace-server） |

### 外部服务（数据库）

项目需要两个外部数据存储，均由 `zerotrace-server` 仓库提供容器化部署配置：

**1. MySQL（必需）**—— 存储用户、组织、会话、计费等元数据。

**2. ClickHouse（可选）**—— 存储 APM 遥测数据。不影响用户登录、页面浏览等基础功能，但数据显示需要此服务。后端启动时如果连不上 ClickHouse 会打 warning 日志，不会 crash。

推荐直接使用 `zerotrace-server` 仓库中的 Docker Compose 配置一次性启动两者（无需手动 `docker run`）。如果本机还没有该仓库，先克隆：

```bash
git clone https://github.com/DeepShield-AI/zerotrace-server.git
cd zerotrace-server/manifests

# 只启动 mysql 和 clickhouse，不启动 server / web（本项目的后端在本地用 cargo run 启动）
docker compose up -d mysql clickhouse
```

这会启动两个容器：

| 容器 | 端口 | 说明 |
|---|---|---|
| `zerotrace-mysql` | `30130` | MySQL 8.0，root 密码 `deepflow`，自动执行 `init.sql` 创建 `grafana` 库 |
| `zerotrace-clickhouse` | `8123`（HTTP）/ `9000`（Native） | ClickHouse |

数据持久化在宿主机 `/opt/deepflow/{mysql,clickhouse}`，容器重启不会丢数据。停止服务用 `docker compose down`（加 `-v` 会删除数据卷）。

> 具体的容器镜像、配置文件挂载等定义见 `zerotrace-server` 仓库下的 `manifests/docker-compose.yml`。

---

## 第二步：配置环境变量

后端通过环境变量或 `backend/.env` 文件读取配置。项目已包含一份开发用默认值，可直接使用。

**backend/.env（开发环境）**：

```bash
DATABASE_URL=mysql://root:deepflow@127.0.0.1:30130/deepflow
JWT_SECRET=zerotrace-dev-secret-change-in-production
SESSION_COOKIE_NAME=zt_session
BIND_ADDR=0.0.0.0:3001
DEEPFLOW_SERVER_URL=http://127.0.0.1:30417
```

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `mysql://root:deepflow@127.0.0.1:30130/deepflow` | MySQL 连接串。格式：`mysql://用户名:密码@主机:端口/库名` |
| `JWT_SECRET` | `zerotrace-dev-secret-...` | JWT 签名密钥，**生产环境务必更换** |
| `SESSION_COOKIE_NAME` | `zt_session` | 会话 Cookie 名称 |
| `BIND_ADDR` | `0.0.0.0:3001` | 后端监听地址。如果端口冲突，改成 `0.0.0.0:3002` 之类 |
| `DEEPFLOW_SERVER_URL` | `http://127.0.0.1:30417` | zerotrace-server 地址（基础设施数据查询） |
| `ZEROTRACE_METERING_URL` | 同 `DEEPFLOW_SERVER_URL` | 用量计量 API 地址 |
| `CLICKHOUSE_URL` | （无默认值） | ClickHouse HTTP 接口地址。格式：`http://host:8123` |
| `RUST_LOG` | `info` | 日志级别（`debug` / `info` / `warn` / `error`） |
| `STATIC_DIR` | 自动指向 `frontend/dist` | 生产模式前端静态文件路径。开发模式不用关心 |

> **提示**：如果 MySQL 不在本地或端口不同，修改 `DATABASE_URL` 即可。其他变量通常无需改动。

---

## 第三步：初始化数据库

后端启动时会**自动执行数据库迁移**（`backend/migrations/*.sql`），无需手动执行 SQL 文件。

但需确保 MySQL 中存在 `deepflow` 数据库。`zerotrace-server` 的 Compose 配置默认只会自动创建 `grafana` 库（供其自身使用），因此需要手动创建 `deepflow`：

```bash
mysql -h 127.0.0.1 -P 30130 -u root -pdeepflow -e "CREATE DATABASE IF NOT EXISTS deepflow;"
```

迁移内容包括：
- `001_initial.sql` — 组织、用户、API 密钥、会话表 + 种子账号
- `002_billing.sql` — 计费方案、订阅、用量记录、账单表 + 种子定价数据

**种子账号**（迁移自动创建）：

| 邮箱 | 密码 | 角色 |
|---|---|---|
| `test@zerotrace.com` | `netsys206` | 超级管理员 |

---

## 第四步：启动开发服务器

### 方式 A：只启动前端（推荐日常使用）

如果只开发 UI 组件、页面布局、样式，不需要后端：

```bash
cd frontend
pnpm dev:mock
```

浏览器打开 `http://localhost:5173`。


### 方式 B：前后端联调

需要两个终端：

**终端 1 — 后端**：

```bash
cd backend
cargo run
```

首次编译较慢（约 1-3 分钟），后续增量编译只需几秒。

启动成功后应看到：

```
INFO Connecting to database: mysql://root:deepflow@127.0.0.1:30130/deepflow
INFO Zerotrace Web API listening on 0.0.0.0:3001
```

**终端 2 — 前端**：

```bash
cd frontend
pnpm dev
```

浏览 `http://localhost:5173`，前端会自动将 `/api/*` 和 `/agent/*` 请求代理到 `localhost:3001`（见 `frontend/vite.config.ts` 中的 proxy 配置）。

---

## 项目脚本说明

### 前端脚本（`frontend/`）

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 Vite 开发服务器，HMR 热更新，端口 5173 |
| `pnpm build` | TypeScript 类型检查 + Vite 生产构建，输出到 `frontend/dist/` |
| `pnpm preview` | 本地预览生产构建结果 |

### 后端命令（`backend/`）

| 命令 | 说明 |
|---|---|
| `cargo run` | 编译并启动开发服务器（debug 模式），端口 3001 |
| `cargo build` | 仅编译（不运行），产物在 `target/debug/zerotrace-web` |
| `cargo build --release` | 生产优化编译，耗时较长，产物在 `target/release/zerotrace-web` |
| `cargo test` | 运行测试 |
| `cargo check` | 快速检查代码能否编译（比 `cargo build` 快，不产生二进制） |
| `cargo fmt` | 格式化代码（需安装 `rustfmt`：`rustup component add rustfmt`） |
| `cargo clippy` | 静态检查 + 代码建议（需安装：`rustup component add clippy`） |

### 构建辅助脚本（`scripts/`）

| 命令 | 说明 |
|---|---|
| `./scripts/prepare-docker-build.sh` | 收集编译产物准备 Docker 镜像构建（详见下方生产构建） |

---

## 常见问题

### Q1：`pnpm install` 报错 "package not found"

确保在**工作区根目录**（`zerotrace-web/`）下执行 `pnpm install`，且已按[配置 npm 源](#配置-npm-源)设置 registry。

如果遇到 `esbuild` 二进制下载失败，查看根目录 `pnpm-workspace.yaml` 中的 `allowBuilds` 配置。

### Q2：`cargo build` 卡住或报错

Rust 首次编译需下载所有依赖，耗时 2-5 分钟正常。如果网络不好，可配置国内镜像：

在 `~/.cargo/config.toml` 中添加：

```toml
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
```

### Q3：后端启动报 "Can't connect to MySQL"

确认：
1. MySQL 服务在运行（`docker ps | grep mysql` 或 `systemctl status mysql`）
2. `backend/.env` 中的 `DATABASE_URL` 主机和端口正确
3. MySQL 允许来自本机的连接
4. `deepflow` 数据库已创建

### Q4：前端页面空白，控制台报 API 404

前端 `pnpm dev` 默认将 `/api` 代理到 `localhost:3001`。如果后端未启动，所有 API 调用会返回代理错误。

**解决方案**：启动后端（`cd backend && cargo run`），或等待 `pnpm dev:mock` 支持后使用 mock 模式。

### Q5：端口冲突（3001 或 5173 已占用）

**后端端口冲突**：修改 `backend/.env` 中 `BIND_ADDR=0.0.0.0:3002`，同时修改 `frontend/vite.config.ts` 中 proxy target 为 `http://localhost:3002`。

**前端端口冲突**：Vite 会自动尝试下一个可用端口（5174、5175…），也可以手动指定：
```bash
pnpm dev --port 5300
```

### Q6：登录失败或密码错误

种子账号为 `test@zerotrace.com` / `netsys206`。如果仍然无法登录，可能是迁移没有正确执行，尝试：

```bash
# 删除并重新创建数据库（会丢失所有数据）
mysql -u root -p -e "DROP DATABASE deepflow; CREATE DATABASE deepflow;"
# 重启后端，迁移会自动重新执行
cd backend && cargo run
```

### Q7：需要什么 Rust 版本？如何升级？

项目使用 Rust 2024 edition，需要 Rust 1.80+。升级命令：

```bash
rustup update stable
rustc --version  # 确认版本
```

### Q8：`cargo run` 报 linking 错误（缺少系统库）

Ubuntu/Debian：
```bash
sudo apt install build-essential pkg-config libssl-dev
```

Fedora/CentOS：
```bash
sudo dnf install gcc gcc-c++ openssl-devel
```

macOS：
```bash
xcode-select --install
```

---

## 生产构建

如果需要在本地模拟生产环境构建：

### 1. 构建前端

```bash
cd frontend
pnpm build
# 输出到 frontend/dist/
```

### 2. 构建后端

```bash
cd backend
cargo build --release
# 输出到 backend/target/release/zerotrace-web
```

### 3. 运行生产模式

```bash
cd backend
STATIC_DIR=../frontend/dist \
DATABASE_URL=mysql://root:deepflow@127.0.0.1:30130/deepflow \
JWT_SECRET=your-production-secret \
./target/release/zerotrace-web
```

后端在生产模式下会同时提供 API 和前端静态文件，访问 `http://localhost:3001` 即可。

### 4. Docker 构建（需要私有 registry 权限）

```bash
./scripts/prepare-docker-build.sh
docker build -t zerotrace-web:latest .
```

详见 [deployment.md](./deployment.md)。

---

## 相关文档

- [部署指南](./deployment.md) — 生产环境部署
- [CLAUDE.md](../../CLAUDE.md) — 项目入口文档（AI 辅助开发）
- `docs/dev/standards/` — 前端编码规范（磁盘保留，不跟踪）
- `docs/design/` — Datadog 参考研究报告（磁盘保留，不跟踪）
