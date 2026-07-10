# Zerotrace Web

Zerotrace 观测平台前端，提供 APM 服务监控、分布式追踪、基础设施主机/进程列表、Agent 生命周期管理等功能的 Web 界面。

## 技术栈

| 组件 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + Ant Design + ECharts |
| 后端 | DeepShield-Server（Go，独立部署） |
| 数据库 | MySQL（元数据）+ ClickHouse（遥测数据） |
| Agent | Zerotrace Agent（eBPF，独立部署） |

## 本地部署

### 环境要求

- Node.js >= 22
- pnpm >= 9

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置后端地址

```bash
# 创建 .env.local（或直接 export 环境变量）
echo 'DEEPSHIELD_SERVER_URL=http://<deepshield-server-ip>:30417' > .env.local
```

`DEEPSHIELD_SERVER_URL` 默认为 `http://127.0.0.1:30417`。

### 3. 启动开发服务器

```bash
# 连接真实后端
pnpm dev --host

# 使用 Mock 数据（无需后端）
pnpm dev:mock
```

浏览器打开 `http://localhost:5173`。

### 4. 生产构建

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

## 依赖服务

本项目是纯前端，需要以下后端服务已部署：

| 服务 | 说明 |
|---|---|
| [DeepShield-Server](https://github.com/DeepShield-AI/deepshield-server) | API 网关 + 业务逻辑 + 数据查询 |
| MySQL | 组织/用户/API Key/Agent 元数据 |
| ClickHouse | L4/L7 流量、追踪、指标等遥测数据 |
| [Zerotrace Agent](https://github.com/DeepShield-AI/zerotrace-agent) | eBPF 数据采集器，安装在被监控主机 |

## 开发指南

详见 [CLAUDE.md](CLAUDE.md) 和 [docs/dev/standards/](docs/dev/standards/)。

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
