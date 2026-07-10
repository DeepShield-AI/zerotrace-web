# Zerotrace Web

Zerotrace 观测平台前端，提供 APM 服务监控、分布式追踪、基础设施主机/进程列表、Agent 生命周期管理等功能的 Web 界面。

## 本地部署

### 环境要求

| 工具 | 最低版本 | 说明 |
|---|---|---|
| Node.js | 18+（推荐 22+） | 运行时 |
| pnpm | 8+ | 包管理器（**不要**使用 npm / yarn） |

### 1. 安装 pnpm

```bash
# 方式 A：通过 npm 全局安装
sudo apt install nodejs npm
sudo npm install -g n
sudo n stable
sudo npm install -g pnpm

# 方式 B：通过 corepack（Node 16.13+ 内置）
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# 验证
pnpm --version
```

### 2. 安装依赖

在项目根目录执行：

```bash
pnpm install
```

如果看到 `[ERR_PNPM_IGNORED_BUILDS]` 警告，需运行：

```bash
pnpm approve-builds   # 交互式批准 @swc/core、esbuild、msw
pnpm install          # 重新安装，此次执行构建脚本
```

关键依赖一览：

| 类别 | 包 | 用途 |
|---|---|---|
| 框架 | `react`, `react-dom` | UI |
| 路由 | `react-router-dom` | 客户端路由 |
| 数据 | `@tanstack/react-query` | 请求缓存与状态管理 |
| UI | `antd`, `lucide-react` | 组件库 + 图标 |
| 图表 | `echarts`, `echarts-for-react` | 可视化 |
| 样式 | `tailwindcss` | 原子化 CSS |
| 国际化 | `i18next`, `react-i18next` | 中英文切换 |
| Mock | `msw`, `@faker-js/faker` | Mock API |

### 3. 配置后端地址

创建 `.env` 文件，指定 DeepShield-Server 地址和端口：

```bash
echo 'DEEPSHIELD_SERVER_URL=http://<server-ip>' > .env
```

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEEPSHIELD_SERVER_URL` | `http://127.0.0.1` | DeepShield-Server 地址 |
| `VITE_USE_MOCKS` | `false` | 设为 `true` 可启用 MSW Mock 模式 |

也可以在启动时直接传入：

```bash
DEEPSHIELD_SERVER_URL=http://<server-ip> pnpm dev --host
```

### 4. 启动开发服务器

```bash
pnpm dev --host
```

浏览器打开 `http://localhost:5173`。

### 5. 生产构建

```bash
pnpm build
```

产出在 `dist/` 目录，用 nginx 部署：

```nginx
server {
    listen 80;
    root /path/to/dist;
    location / { try_files $uri /index.html; }
    location /api/ { proxy_pass http://deepshield-server:30417; }
    location /agent/ { proxy_pass http://deepshield-server:30417; }
}
```

或使用 Docker：

```bash
docker build -t zerotrace-web .
docker run -p 80:80 zerotrace-web
```

### 常见问题

**Q：`pnpm install` 报 "package not found"**

确认 pnpm 版本 >= 8。如果网络受限，可执行 `pnpm config set registry https://registry.npmmirror.com` 切换国内镜像。

**Q：前端页面空白，控制台报 API 错误**

确认 `DEEPSHIELD_SERVER_URL` 指向已启动的 DeepShield-Server，且 CORS 已正确配置。

**Q：端口冲突（5173 已占用）**

```bash
pnpm dev --host --port 5300
```

## 依赖服务

本项目是纯前端，需要以下后端服务已部署：

| 服务 | 说明 |
|---|---|
| [DeepShield-Server](https://github.com/DeepShield-AI/deepshield-server) | API 网关 + 业务逻辑 + 数据查询 |
| MySQL | 组织/用户/API Key/Agent 元数据 |
| ClickHouse | L4/L7 流量、追踪、指标等遥测数据 |
| [Zerotrace Agent](https://github.com/DeepShield-AI/zerotrace-agent) | eBPF 数据采集器，安装在被监控主机 |

## 目录结构

```
├── src/
│   ├── api/client.ts       # 后端 API 调用
│   ├── pages/              # 路由页面
│   ├── components/         # 业务组件
│   ├── hooks/              # useAuth / useTheme
│   ├── styles/tokens.css   # 设计 Token
│   ├── mocks/              # MSW Mock 数据
│   └── i18n/               # 国际化
├── vite.config.ts           # Vite 构建 & Proxy 配置
├── Dockerfile               # 生产镜像
├── nginx.conf               # 生产 Nginx 配置
└── docs/                    # 设计文档 & 前端规范
```

## 开发指南

详见 [CLAUDE.md](CLAUDE.md) 和 [docs/user/local-development.md](docs/user/local-development.md)。