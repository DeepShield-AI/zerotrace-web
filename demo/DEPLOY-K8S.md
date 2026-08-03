# 微服务资源故障注入 Demo — K8s 部署文档

本 demo 是一个 5 微服务 + Redis 的故障注入演示集群，部署在 Kubernetes 上，
支持 CPU / 内存 / 网络 / 磁盘四类资源级故障注入，配合请求发生器验证
可观测性平台对基础设施故障的捕获能力。

---

## 1. 架构

```
                     ┌───────────────────────────────┐
                     │         K8s Cluster           │
                     │     (单节点 worker1)           │
                     │                               │
   http://nodeIP:30300                              │
         │                                          │
         ▼              ┌───────────────────┐        │
   ┌──────────┐  HTTP   │       Redis       │        │
   │ gateway  │ ────────│  (chaos 规则共享)  │        │
   │ NodePort │         └───────────────────┘        │
   └────┬─────┘                                      │
        │ HTTP                                       │
   ┌────┼──────────┬──────────────┬──────────┐       │
   ▼    ▼          ▼              ▼          ▼       │
 users products  orders        chaos      (gateway) │
 :3001  :3002    :3003          :3004      :3000    │
        └──┬───┬─┘                                   │
           │   │ HTTP 级联调用                        │
           │   └──> products /checkStock            │
           └──────> users /:id                      │
   └───────────────────────────────────────────────┘
```

| 服务 | 端口 | 说明 |
|---|---|---|
| gateway | 3000 (NodePort 30300) | API 网关，唯一对外入口 |
| users | 3001 | 用户服务 |
| products | 3002 | 商品服务（含库存校验） |
| orders | 3003 | 订单服务（级联调用 users + products） |
| chaos | 3004 | 故障注入控制面 |
| redis | 6379 | 故障规则共享存储 + Pub/Sub 广播 |

所有服务共用一个镜像 `zerotrace-chaos-demo:latest`，通过 command 区分启动。

---

## 2. 环境要求

| 组件 | 要求 |
|---|---|
| Kubernetes | 任意版本，单节点即可 |
| 容器运行时 | containerd（K8s 标准运行时） |
| 镜像构建工具 | buildah（推荐，无需 daemon）或 nerdctl |
| 外部网络 | 可访问 Docker Hub（构建时拉基础镜像） |

> ⚠️ 本环境不使用 Docker：K8s 已使用 containerd，Docker 已卸载。
> buildah 直接构建 OCI 镜像，与 containerd/K8s 完全兼容，无冲突。

---

## 3. 准备工作

### 3.1 安装 buildah

```bash
sudo apt-get install -y buildah
buildah --version   # 验证
```

### 3.2 配置国内镜像加速（可选）

如果拉取 `node:20-alpine` 或 `redis:7-alpine` 超时（大陆网络），
编辑 `/etc/containers/registries.conf`，添加镜像加速：

```toml
[[registry]]
prefix = "docker.io"
location = "docker.io"

[[registry.mirror]]
location = "docker.m.daocloud.io"
```

---

## 4. 构建并导入镜像

### 4.1 构建应用镜像

```bash
cd /home/ubuntu/smore/zerotrace-web/demo

# 构建应用镜像（含 5 个微服务）
buildah bud -t zerotrace-chaos-demo:latest .
```

### 4.2 拉取 Redis 镜像

```bash
buildah pull redis:7-alpine
```

### 4.3 导出并导入 containerd

K8s 的 containerd 使用 `k8s.io` 命名空间，必须导入到这里：

```bash
# 导出为 tar
buildah push zerotrace-chaos-demo:latest docker-archive:/tmp/chaos-demo.tar
buildah push redis:7-alpine docker-archive:/tmp/redis.tar

# 导入 containerd (k8s.io namespace)
sudo ctr -n k8s.io images import /tmp/chaos-demo.tar
sudo ctr -n k8s.io images import /tmp/redis.tar
```

> ⚠️ 镜像名必须与 YAML 中完全一致：
> - `localhost/zerotrace-chaos-demo:latest`（buildah 默认前缀 localhost）
> - `redis:7-alpine`

验证导入成功：

```bash
sudo crictl images | grep -E "chaos|redis"
```

---

## 5. 部署到 K8s

### 5.1 一键部署（推荐）

```bash
cd /home/ubuntu/smore/zerotrace-web/demo
bash deploy.sh
```

脚本会自动：
1. 检测构建工具（buildah/nerdctl/docker）
2. 构建镜像 → 导入 containerd
3. `kubectl apply` 所有 YAML
4. 等待 Pod 就绪

### 5.2 手动部署（分步）

```bash
# 部署所有资源
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/services.yaml

# 查看状态
kubectl get pods -n chaos-demo -o wide

# 等待全部 Running
kubectl wait --for=condition=ready pod -l app=gateway -n chaos-demo --timeout=120s
```

### 5.3 确认部署成功

```bash
kubectl get pods -n chaos-demo
```

期望输出（全部 `1/1 Running`）：

```
NAME                       READY   STATUS    RESTARTS   AGE
chaos-55b57c9c79-qhhgg     1/1     Running   0          2m
gateway-66b4f96759-qhzh4   1/1     Running   0          2m
orders-55bb6b9bc9-ltphs    1/1     Running   0          2m
products-6d756b9c9-67hx9   1/1     Running   0          2m
redis-599c478d9c-n88l6     1/1     Running   0          2m
users-7dc495947d-54rbl     1/1     Running   0          2m
```

---

## 6. 验证服务

### 6.1 健康检查

```bash
NODE_IP=202.112.237.37   # 替换为你的节点 IP
curl http://$NODE_IP:30300/health
```

期望响应：

```json
{"status":"ok","service":"gateway","activeFaults":0}
```

### 6.2 业务接口

```bash
# 用户列表
curl http://$NODE_IP:30300/api/users

# 商品列表
curl http://$NODE_IP:30300/api/products

# 创建订单（级联调用 users + products）
curl -XPOST http://$NODE_IP:30300/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"userId":"u1","productId":"p1","quantity":2}'

# 订单列表
curl http://$NODE_IP:30300/api/orders
```

---

## 7. 请求发生器

### 7.1 基本用法

```bash
cd /home/ubuntu/smore/zerotrace-web/demo

# 默认参数：QPS=5, 每15s注入故障, 运行120s
GATEWAY_URL=http://202.112.237.37:30300 npm run gen
```

### 7.2 全部参数

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `GATEWAY_URL` | `http://localhost:30300` | 网关地址 |
| `CHAOS_URL` | `<gateway>/api/chaos` | 故障控制面地址 |
| `QPS` | 5 | 每秒请求数 |
| `DURATION` | 120 | 运行时长（秒），0=持续 |
| `FAULT_INTERVAL` | 15 | 故障注入间隔（秒） |
| `FAULT_COOLDOWN` | 30 | 同类型故障最小间隔（秒） |
| `FAULT_DURATION` | 20 | 单次故障持续时间（秒） |
| `TARGETS` | `users,products,orders,gateway,chaos` | 可注入目标 |
| `FAULT_TYPES` | `cpu,memory,network,disk` | 可注入类型 |
| `VERBOSE` | false | 打印每次请求详情 |

### 7.3 预设模式

```bash
npm run gen:fast     # QPS=20, 每5s注入, 持续10s (快速演示)
npm run gen:stress   # QPS=50, 每8s注入, 仅业务服务
npm run gen:verbose  # VERBOSE=true 打印每个请求
```

### 7.4 输出说明

运行中每 10s 打印一次报告：

```
[report] ⏱  30s | 总计: 150 | 成功: 148 | 错误: 2 (1.3%) | P50: 45ms | P95: 3200ms | P99: 5100ms | 故障注入: 2 次
```

故障注入日志：

```
[fault] 💥 注入故障: network → users | {"delayMs":3500,"jitterMs":1200} (20s)
```

---

## 8. 故障注入 API

### 8.1 手动注入故障

```bash
CHAOS=http://202.112.237.37:30300/api/chaos

# CPU 压力到 orders (4 worker 线程, 30秒)
curl -XPOST $CHAOS/inject -H 'Content-Type: application/json' \
  -d '{"target":"orders","type":"cpu","intensity":4,"duration":30}'

# 内存压力到 products (200MB, 45秒)
curl -XPOST $CHAOS/inject -H 'Content-Type: application/json' \
  -d '{"target":"products","type":"memory","megabytes":200,"duration":45}'

# 网络延迟到 users (3s延迟+1s抖动, 60秒)
curl -XPOST $CHAOS/inject -H 'Content-Type: application/json' \
  -d '{"target":"users","type":"network","delayMs":3000,"jitterMs":1000,"duration":60}'

# 磁盘 I/O 压力到 orders (500MB, 30秒)
curl -XPOST $CHAOS/inject -H 'Content-Type: application/json' \
  -d '{"target":"orders","type":"disk","fileSizeMB":500,"duration":30}'
```

### 8.2 管理故障

```bash
# 查看所有活跃故障
curl $CHAOS/status

# 释放指定故障
curl -XPOST $CHAOS/release -H 'Content-Type: application/json' \
  -d '{"faultId":"orders:cpu:1759xxxx:ab12"}'

# 释放目标服务所有故障
curl -XPOST $CHAOS/release -H 'Content-Type: application/json' \
  -d '{"target":"orders"}'

# 一键释放全部
curl -XPOST $CHAOS/release-all
```

### 8.3 故障参数说明

| 类型 | 参数 | 默认 | 说明 |
|---|---|---|---|
| cpu | `intensity` | 2 | worker 线程数（压满 CPU 用 4-8） |
| memory | `megabytes` | 100 | 分配内存 MB 数 |
| network | `delayMs` | 2000 | 每请求固定延迟 ms |
| network | `jitterMs` | 1000 | 附加随机抖动 ms |
| disk | `fileSizeMB` | 200 | 单文件大小 MB（循环写） |

所有故障自动在 `duration` 秒后释放。

---

## 9. 故障排查

### 9.1 Pod 一直 `ImagePullBackOff`

```
# 查看原因
kubectl describe pod -n chaos-demo <pod-name> | grep -A 5 Events
```

常见原因与修复：

| 错误信息 | 原因 | 修复 |
|---|---|---|
| `docker.io/library/zerotrace-chaos-demo` | 镜像名不匹配 | YAML 中必须用 `localhost/zerotrace-chaos-demo:latest` |
| `Failed to pull` (i/o timeout) | 尝试远程拉取 | 加 `imagePullPolicy: Never`，确保镜像已导入 containerd |
| `localhost/zerotrace-chaos-demo` not found | 未导入 | `sudo ctr -n k8s.io images import /tmp/chaos-demo.tar` |

### 9.2 Pod 一直 `CrashLoopBackOff`

```
kubectl logs -n chaos-demo <pod-name> --tail=30
```

| 日志 | 原因 | 修复 |
|---|---|---|
| `ECONNREFUSED <cluster-ip>:6379` | Redis 未就绪 | 检查 redis Pod 状态，等待就绪 |
| `MaxRetriesPerRequestError` | ioredis 连接失败 | Redis 未运行，先解决 Redis |
| `Cannot find module` | 镜像不完整 | 重新构建镜像 |

### 9.3 重新部署（镜像更新后）

```bash
# 重建镜像
buildah bud -t zerotrace-chaos-demo:latest .
buildah push zerotrace-chaos-demo:latest docker-archive:/tmp/chaos-demo.tar
sudo ctr -n k8s.io images import /tmp/chaos-demo.tar

# 重启所有 Pod（强制拉取新镜像）
kubectl rollout restart deployment -n chaos-demo

# 或者完全重新部署
kubectl delete ns chaos-demo
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/services.yaml
```

### 9.4 清理

```bash
kubectl delete ns chaos-demo    # 删除整个 demo
```

---

## 10. 文件结构

```
demo/
├── k8s/
│   ├── namespace.yaml      # 命名空间 chaos-demo
│   ├── redis.yaml          # Redis Deployment + Service
│   └── services.yaml       # 5 个微服务 Deployment + Service
├── lib/
│   ├── resource-stress.js  # 资源故障引擎 (CPU/内存/网络/磁盘)
│   ├── chaos-middleware.js # 故障注入中间件
│   ├── chaos-store.js      # 故障规则存储 (Redis)
│   └── redis-client.js     # Redis 连接封装
├── services/
│   ├── gateway.service.js  # API 网关
│   ├── users.service.js    # 用户服务
│   ├── products.service.js # 商品服务
│   ├── orders.service.js   # 订单服务
│   └── chaos.service.js    # 故障注入控制面
├── tools/
│   └── request-generator.js # 请求发生器 + 随机故障注入
├── Dockerfile
├── deploy.sh               # 一键部署脚本
└── DEPLOY-K8S.md           # 本文档
```
