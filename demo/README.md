# 微服务故障注入 Demo（Moleculer + Chaos Engineering）

一个可以直接本地启动的开源微服务 Demo，内置**故障注入（Chaos Engineering）**能力，
用于学习/验证微服务架构在异常状态下的行为（延迟、宕机、异常响应）。

## 1. 技术选型

| 组件 | 说明 |
| --- | --- |
| [Moleculer](https://moleculer.services/) | 常见的开源 Node.js 微服务框架，内置服务发现、负载均衡、断路器等能力 |
| [moleculer-web](https://github.com/moleculerjs/moleculer-web) | Moleculer 官方 API Gateway，负责统一暴露 REST 接口 |
| Redis | 服务间通信总线（Transporter）+ 故障规则的共享存储（Pub/Sub 实时广播规则变更） |
| Docker Compose | 一键本地启动全部微服务与依赖 |

## 2. 架构与服务拓扑

```
                          ┌──────────────┐
        HTTP Client ───▶  │   gateway    │  (API Gateway, :3000)
                          └──────┬───────┘
                                 │ (Moleculer RPC, over Redis)
              ┌──────────────────┼──────────────────┬───────────────┐
              ▼                  ▼                  ▼               ▼
         ┌─────────┐       ┌───────────┐       ┌─────────┐     ┌─────────┐
         │  users  │       │ products  │       │ orders  │     │  chaos  │
         └─────────┘       └───────────┘       └────┬────┘     └─────────┘
                                                     │ 级联调用
                                          调用 users.get / products.checkStock

         chaos 服务 = 故障注入的"控制面"，通过 Redis 存储/广播故障规则
         chaos-middleware = 全局中间件，包裹所有 action，实时读取规则并注入故障
```

- `orders.createOrder` 会级联调用 `users.get` 与 `products.checkStock`，
  用于演示"故障传播"：即使故障没有直接打在 `orders` 服务上，下游服务的故障
  依然会影响 `orders` 的响应（延迟变慢、报错等），这正是分布式链路排查要面对的典型场景。
- `chaos` 服务与 `chaos-middleware`（`lib/chaos-middleware.js`）共同构成故障注入机制：
  中间件会在每次本地 action 执行前，查询 Redis 中的规则表，决定是否注入故障。
  规则变更通过 Redis Pub/Sub 实时广播到所有服务进程，**无需重启任何服务**。

## 3. 目录结构

```
demo/
├── docker-compose.yml       # 一键本地启动配置（redis + 5 个微服务容器）
├── Dockerfile               # 所有服务共用的镜像构建文件
├── moleculer.config.js      # Moleculer Broker 全局配置（transporter、中间件注册等）
├── package.json
├── lib/
│   ├── redis-client.js      # 共享 Redis 连接封装
│   ├── chaos-store.js       # 故障规则存取（Redis Hash + Pub/Sub 广播）
│   └── chaos-middleware.js  # 故障注入核心中间件（延迟/宕机/异常响应）
└── services/
    ├── gateway.service.js   # API Gateway，统一 REST 入口
    ├── users.service.js     # 用户服务
    ├── products.service.js  # 商品服务
    ├── orders.service.js    # 订单服务（级联调用 users / products）
    └── chaos.service.js     # 故障注入控制面（REST 接口）
```

## 4. 本地启动方式

### 方式一：Docker Compose（推荐，一键启动全部服务）

```bash
cd demo
docker compose up --build -d

# 查看日志
docker compose logs -f gateway

# 停止
docker compose down
```

启动后：
- API Gateway： `http://localhost:3000`
- Redis： `localhost:6379`

### 方式二：Docker Swarm（多主机集群部署）

适用于在多台主机上部署微服务，由各主机上的 **eBPF Agent** 捕获服务间通信流量。

**前提：已初始化 Docker Swarm 集群**（1 个 manager + N 个 worker 节点）。

```bash
# 1. 在 manager 节点上构建镜像
cd demo
docker build -t zerotrace-chaos-demo:latest .

# 2. 将镜像分发到所有 worker 节点
#    方式 A（推荐）：推送到私有镜像仓库
docker tag zerotrace-chaos-demo:latest 47.97.67.233:5000/deepshield/zerotrace-chaos-demo:latest
docker push 47.97.67.233:5000/deepshield/zerotrace-chaos-demo:latest

# 3. 给 worker 节点打标，控制各服务的调度位置
docker node update --label-add role=worker node2
docker node update --label-add role=worker node3
docker node update --label-add role=worker node4

# 4. 部署
docker stack deploy -c demo/docker-compose.swarm.yml chaos-demo

# 5. 查看状态
docker stack services chaos-demo
docker service logs chaos-demo_gateway -f

# 6. 停止 / 删除
docker stack rm chaos-demo
```

**多主机上的流量模式：**
```
Manager 节点:        Redis
Worker 节点 A:       gateway
Worker 节点 B:       orders, chaos
Worker 节点 C:       users, products
```

各服务通过 Redis Transporter（Moleculer 内置 RPC）跨主机通信，
所有网络流量被各主机上的 eBPF Agent 捕获 → DeepShield-Server → 前端展示。

**注意：** Swarm 模式下 `docker compose up --build` 的 build 参数不生效，
需要先手动 `docker build` 并确保镜像在所有节点可用（推送到仓库或手动 load）。

### 方式三：本地 Node.js 直接运行（需自行准备 Redis）

```bash
cd demo
npm install

# 需要本机已有 Redis 监听 6379，或修改 REDIS_URL / TRANSPORTER 环境变量指向已有 Redis

# 分别在 5 个终端窗口启动（也可用 npm run dev:all 通过 concurrently 一次性并行启动）
npm run dev:gateway
npm run dev:users
npm run dev:products
npm run dev:orders
npm run dev:chaos

# 或者一条命令并行启动全部（需要本机已有 Redis）
npm run dev:all
```

## 5. 业务接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 网关健康检查 |
| GET | `/api/users` | 用户列表 |
| GET | `/api/users/:id` | 用户详情 |
| GET | `/api/products` | 商品列表 |
| GET | `/api/products/:id` | 商品详情 |
| GET | `/api/orders` | 订单列表 |
| POST | `/api/orders` | 创建订单（级联调用 users + products） |

创建订单示例：

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","productId":"p1","quantity":2}'
```

## 6. 故障注入接口（Chaos API）

故障规则的 **target** 支持三种粒度（优先级从高到低）：

- `"<service>.<action>"` — 精确到某个 action，如 `orders.createOrder`
- `"<service>"` — 整个服务级别，如 `users`
- `"*"` — 全局，对所有服务生效

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/chaos/list` | 查看当前所有生效的故障规则 |
| POST | `/api/chaos/set` | 设置/更新某个 target 的故障规则 |
| POST | `/api/chaos/clear` | 清除某个 target 的故障规则 |
| POST | `/api/chaos/reset` | 一键清空所有故障规则，恢复系统正常 |

### 6.1 场景一：模拟延迟（网络慢/下游拥塞）

```bash
# 给 users 服务注入 2 秒延迟（+ 0~500ms 随机抖动）
curl -X POST http://localhost:3000/api/chaos/set \
  -H "Content-Type: application/json" \
  -d '{"target":"users","type":"latency","delayMs":2000,"jitterMs":500}'

# 触发验证：创建订单会级联调用 users.get，响应会明显变慢
time curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","productId":"p1","quantity":1}'
```

### 6.2 场景二：模拟服务宕机

```bash
# 让 products 服务直接"宕机"（返回 503）
curl -X POST http://localhost:3000/api/chaos/set \
  -H "Content-Type: application/json" \
  -d '{"target":"products","type":"down"}'

# 直接调用 products 会返回 503
curl -i http://localhost:3000/api/products

# 通过 orders 级联调用同样会因下游宕机而失败（验证故障传播）
curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","productId":"p1","quantity":1}'
```

### 6.3 场景三：模拟异常响应（自定义错误码/错误信息）

```bash
# 仅对 orders.createOrder 这个 action 注入 400 异常，模拟下游校验失败
curl -X POST http://localhost:3000/api/chaos/set \
  -H "Content-Type: application/json" \
  -d '{
    "target": "orders.createOrder",
    "type": "error",
    "errorCode": 400,
    "errorType": "CHAOS_BAD_REQUEST",
    "errorMessage": "模拟：下游支付网关校验失败"
  }'

curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","productId":"p1","quantity":1}'

# 注意：其他接口（如 /api/users）不受影响，因为 target 精确到了 action 级别
curl -i http://localhost:3000/api/users/u1
```

### 6.4 概率触发（模拟偶发性故障，而非每次必发）

```bash
# 只有 30% 概率触发延迟，其余 70% 正常响应，用于模拟"偶发抖动"
curl -X POST http://localhost:3000/api/chaos/set \
  -H "Content-Type: application/json" \
  -d '{"target":"products","type":"latency","delayMs":3000,"probability":0.3}'
```

### 6.5 恢复正常

```bash
# 清除单个规则
curl -X POST http://localhost:3000/api/chaos/clear \
  -H "Content-Type: application/json" -d '{"target":"products"}'

# 或者一键清空全部故障规则
curl -X POST http://localhost:3000/api/chaos/reset
```

## 7. 故障规则字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `target` | string | 规则作用目标（`*` / `<service>` / `<service>.<action>`） |
| `type` | `latency` \| `error` \| `down` | 故障类型 |
| `enabled` | boolean | 是否启用，默认 `true` |
| `probability` | number(0~1) | 触发概率，默认 `1`（每次必触发） |
| `delayMs` | number | `latency` 类型的基础延迟（毫秒） |
| `jitterMs` | number | `latency` 类型附加的随机抖动上限（毫秒） |
| `errorCode` | number | `error`/`down` 类型返回的 HTTP 状态码 |
| `errorType` | string | 错误类型标识 |
| `errorMessage` | string | 错误提示信息 |

## 8. 实现原理简述

`lib/chaos-middleware.js` 是一个标准的 Moleculer `localAction` 中间件，
它会包裹 broker 内**所有**服务的 action handler（除了 `api.*` / `chaos.*` / `$node.*`
等基础设施本身），在真正执行业务逻辑前：

1. 根据 `action.service.fullName`（服务名）与 `action.name`（action 全名），
   到 `ChaosStore` 本地缓存中按优先级（action 级 > 服务级 > 全局）查找匹配的规则；
2. 按 `probability` 做一次随机数判定是否本次触发；
3. 若触发：
   - `latency` → `await sleep(delayMs + random(0, jitterMs))` 后继续正常执行；
   - `down` / `error` → 直接 `throw new MoleculerError(...)`，中断本次调用；
4. 未命中规则或未触发时，直接放行到原始 handler。

`ChaosStore`（`lib/chaos-store.js`）用 Redis Hash 持久化规则、Redis Pub/Sub 广播变更，
因此这套机制天然支持多进程/多容器部署下的**实时统一生效**——在任意一个服务/网关上
调用 `chaos.set`，所有服务进程会在毫秒级收到广播并更新本地缓存。

## 9. 常见排查

- 若 `docker compose up` 时提示无法拉取 `redis:7-alpine` 或 `node:20-alpine`，
  说明本机 Docker 无法直连 Docker Hub，可改用国内镜像加速站后重试，例如：
  ```bash
  docker pull docker.m.daocloud.io/library/redis:7-alpine
  docker tag docker.m.daocloud.io/library/redis:7-alpine redis:7-alpine
  docker pull docker.m.daocloud.io/library/node:20-alpine
  docker tag docker.m.daocloud.io/library/node:20-alpine node:20-alpine
  docker compose up --build -d
  ```
- 若接口一直报 `ServiceNotAvailableError`，通常是服务还没完成 Redis 服务发现注册，
  等待 2~3 秒重试即可（`docker compose logs -f <service>` 查看是否已打印 `Node 'xxx' connected.`）。
