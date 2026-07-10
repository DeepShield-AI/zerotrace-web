# Zerotrace Web — 本地开发指南

## 环境要求

| 工具 | 最低版本 | 说明 |
|---|---|---|
| Node.js | 18+（推荐 22+） | 运行时 |
| pnpm | 8+ | 包管理器（**不要**使用 npm / yarn） |
| DeepShield-Server | — | 后端 API，[独立仓库](https://github.com/DeepShield-AI/deepshield-server) |
| MySQL | 8.0+ | 元数据存储（DeepShield-Server 依赖） |
| ClickHouse | — | 遥测存储（DeepShield-Server 依赖） |

### 安装 pnpm

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

## 项目结构

```
zerotrace-web/
├── src/
│   ├── api/client.ts       # 后端 API 调用
│   ├── pages/              # 路由页面
│   ├── components/         # 业务组件
│   ├── hooks/              # useAuth / useTheme
│   ├── styles/tokens.css   # 设计 Token
│   ├── mocks/              # MSW Mock 数据
│   └── i18n/               # 国际化
├── public/                 # 静态资源
├── index.html              # SPA 入口
├── vite.config.ts           # Vite 构建 & Proxy 配置
├── Dockerfile               # 生产镜像
├── nginx.conf               # 生产 Nginx 配置
├── docs/                    # 文档 & 前端规范
└── tests/                   # E2E 测试
```

## 第一步：安装依赖

在项目根目录执行：

```bash
pnpm install
```

如果看到 `[ERR_PNPM_IGNORED_BUILDS]` 警告（pnpm v10+ 默认拦截 postinstall 脚本），运行：

```bash
pnpm approve-builds   # 交互式批准 @swc/core、esbuild、msw
pnpm install          # 重新安装
```

## 第二步：配置后端地址

创建 `.env` 文件：

```bash
echo 'DEEPSHIELD_SERVER_URL=http://<server-ip>:30417' > .env
```

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DEEPSHIELD_SERVER_URL` | `http://127.0.0.1:30417` | DeepShield-Server HTTP 地址（含端口） |
| `VITE_USE_MOCKS` | `false` | 设为 `true` 启用 MSW Mock，无需后端 |

Vite 开发服务器会将 `/api/*` 和 `/agent/*` 请求代理到 `DEEPSHIELD_SERVER_URL`。

## 第三步：启动开发服务器

```bash
# 连接真实后端
pnpm dev --host

# Mock 模式（无需后端）
VITE_USE_MOCKS=true pnpm dev --host
```

浏览器打开 `http://localhost:5173`。

## 第四步：部署 DeepShield-Server（后端）

本项目是纯前端，需要 DeepShield-Server 提供 API。快速启动：

```bash
git clone https://github.com/DeepShield-AI/DeepShield-Server.git
cd DeepShield-Server

# 编译
export PATH=$PATH:$(go env GOPATH)/bin
make server

# 启动
K8S_NODE_NAME_FOR_DEEPFLOW=$(hostname) \
K8S_NODE_IP_FOR_DEEPFLOW=$(hostname -I | awk '{print $1}') \
DEEPFLOW_SERVER_RUNNING_MODE=STANDALONE \
CONTROLLER_IP=<external-ip> \
./bin/deepshield-server -f ./server.yaml
```

确保配置中 `zerotrace.enabled: true`，MySQL 和 ClickHouse 已启动。

## 生产构建

```bash
pnpm build
# 产出 dist/
```

部署方式详见 [README.md](../../README.md#5-生产构建)。

## 常见问题

**Q：端口冲突（5173 已占用）**

```bash
pnpm dev --host --port 5300
```

**Q：`pnpm install` 报 "package not found"**

终端执行 `pnpm config set registry https://registry.npmmirror.com` 切换国内镜像。

**Q：前端页面空白，控制台报 API 错误**

确认 `DEEPSHIELD_SERVER_URL` 指向正确地址，DeepShield-Server 已启动，且 CORS 中间件已启用。
