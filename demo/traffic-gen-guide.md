# 流量生成脚本使用指南

## 概述

`traffic-gen.sh` 是一个 bash 脚本，向 Zerotrace Demo 微服务发送混合 HTTP 流量，包含正确请求和各种异常/错误请求。用于：

- 验证微服务是否正常运行
- 为 eBPF Agent 提供可观测的调用链数据
- 测试故障注入（Chaos Engineering）场景下的系统行为

脚本在 Docker Swarm 和 Docker Compose 模式下均可使用，只需指定正确的网关地址。

---

## 前提

- `curl`、`bc`（用于随机延迟）、`python3`（可选，用于格式化 Chaos 规则输出）
- Demo 网关可达（默认 `http://localhost:3000`，Swarm 环境可能是 `http://<node-ip>:3000`）

---

## 快速开始

```bash
cd demo

# 默认运行 100 个请求
./traffic-gen.sh

# 指定 Swarm 环境中的网关
./traffic-gen.sh --gateway http://202.112.237.40:3000 --total 200

# 带 Chaos 故障注入
./traffic-gen.sh --chaos

# 无限循环模式（Ctrl+C 停止）
./traffic-gen.sh --total 0
```

---

## 选项

| 选项 | 默认值 | 说明 |
|---|---|---|
| `--gateway URL` | `http://localhost:3000` | 网关地址。Swarm 用节点 IP + 端口 |
| `--total N` | `100` | 总请求数（`0` = 无限循环） |
| `--min-delay N` | `200` | 请求间最小间隔（毫秒） |
| `--max-delay N` | `800` | 请求间最大间隔（毫秒） |
| `--chaos` | 关闭 | 先注入故障规则再发送流量 |
| `--no-chaos` | 默认 | 不注入故障 |

所有选项也可通过环境变量设置：

```bash
GATEWAY_URL=http://10.0.0.5:3000 TOTAL=500 MIN_DELAY_MS=50 MAX_DELAY_MS=200 ./traffic-gen.sh
```

---

## 请求场景

### ✅ 正确请求（~60%）

模拟正常用户操作，期望返回 2xx。涵盖所有微服务的健康路径：

| 服务 | 请求 | 预期状态 | 说明 |
|---|---|---|---|
| **Gateway** | `GET /health` | 200 | 网关健康检查 |
| **Users** | `GET /api/users` | 200 | 用户列表（3 人：张三、李四、王五） |
| | `GET /api/users/u1` | 200 | 查张三 |
| | `GET /api/users/u2` | 200 | 查李四 |
| | `GET /api/users/u3` | 200 | 查王五 |
| **Products** | `GET /api/products` | 200 | 商品列表（3 件） |
| | `GET /api/products/p1` | 200 | 查机械键盘 |
| | `GET /api/products/p2` | 200 | 查无线鼠标 |
| | `GET /api/products/p3` | 200 | 查 4K 显示器 |
| | `POST /api/products/p1/checkStock` | 200 | 检查库存（qty=2） |
| | `POST /api/products/p3/checkStock` | 200 | 检查库存（qty=10） |
| **Orders** | `GET /api/orders` | 200 | 订单列表 |
| | `POST /api/orders` {u1,p1,1} | 201 | 创建订单（张三买键盘） |
| | `POST /api/orders` {u2,p2,3} | 201 | 创建订单（李四买 3 个鼠标） |
| | `POST /api/orders` {u3,p3,1} | 201 | 创建订单（王五买显示器） |
| | `GET /api/orders/o1000` | 200 | 查询刚创建的订单 |
| **Chaos** | `GET /api/chaos/list` | 200 | 查看当前故障规则 |

### ❌ 错误请求（~40%）

模拟客户端错误，验证服务正确拒绝非法输入：

| 错误类型 | 请求 | 预期状态 | 说明 |
|---|---|---|---|
| 资源不存在 | `GET /api/users/nonexistent` | 404 | 不存在的用户 |
| | `GET /api/products/p999` | 404 | 不存在的商品 |
| | `GET /api/orders/invalid` | 404 | 不存在的订单 |
| | `GET /api/nonexistent` | 404 | 不存在的路径 |
| | `POST /api/products/p999/checkStock` | 404 | 不存在商品的库存检查 |
| 参数缺失 | `POST /api/orders` {缺 userId} | 400 | 缺少用户 |
| | `POST /api/orders` {缺 productId} | 400 | 缺少商品 |
| | `POST /api/orders` {} | 400 | 空 body |
| 无效参数 | `POST /api/orders` {userId:u999} | 400 | 无效用户 ID |
| | `POST /api/orders` {p2, qty:999} | 409 | 库存不足 |
| 方法错误 | `POST /api/users` | 404 | POST 到 GET 端点 |
| 语法错误 | `POST /api/orders` (非法 JSON) | 400 | body 不是合法 JSON |

### ⚡ Chaos 故障触发（仅 `--chaos` 模式）

`--chaos` 模式下脚本首先注入 3 条故障规则，然后反复调用受影响的端点以触发故障：

| 规则 | 概率 | 效果 | 针对的端点 |
|---|---|---|---|
| `orders.createOrder` → `latency` | 30% | 延迟 2.5s ± 0.5s | `POST /api/orders` |
| `users.get` → `error` | 20% | 返回 500 "Database connection timeout" | `GET /api/users/:id` |
| `products.checkStock` → `down` | 15% | 返回 503 "Service unavailable" | `POST /api/products/:id/checkStock` |

故障规则的 target 粒度从精确到宽泛逐级匹配：`"<service>.<action>"` → `"<service>"` → `"*"`。脚本使用最精确的 `<service>.<action>` 粒度的规则，因此不会影响其他端点的正常运行。

脚本退出时（包括 Ctrl+C）自动调用 `POST /api/chaos/reset` 清除所有故障规则。

---

## 输出示例

```text
══════════════════════════════════════
   Zerotrace Demo 流量生成器
   Gateway: http://localhost:3000
   总请求: 15
   间隔: 200~800ms
   Chaos: yes
══════════════════════════════════════

网关可达 ✓

[chaos] 注入故障规则...
  → orders.createOrder: 30% 概率延迟 2.5s±0.5s
  → users.get: 20% 概率返回 500 DB_TIMEOUT
  → products.checkStock: 15% 概率 503 宕机

✓ GET /api/users → 200
✓ GET /api/users/u1 → 200
✗ GET /api/users/nonexistent → 404
⚡ POST /api/orders → 201 (chaos)
⚡ GET /api/users/u1 → 500 (chaos)
✓ GET /api/products → 200
✓ POST /api/orders → 201 (chaos)
✗ GET /api/orders/invalid → 404
✗ POST /api/orders {"quantity":1} → 400 (预期 400)
✓ POST /api/orders {u1,p1,1} → 201
...

已重置故障规则

══════════════════════════════════
  流量统计
══════════════════════════════════
  总请求:     15
  正确响应:   11
  错误响应:    4
  故障命中:    3
══════════════════════════════════
```

输出中每行前缀表示请求结果：

| 图标 | 含义 |
|---|---|
| `✓` 绿色 | 请求返回了预期的正确状态码 |
| `✗` 红色 | 请求返回了意外的状态码（或预期的错误状态码） |
| `⚡` 青色 | 请求触发了 Chaos 故障规则 |

---

## 用例

### 1. 验证服务部署

Swarm 启动后，快速检查所有服务是否正常工作：

```bash
./traffic-gen.sh --gateway http://<swarm-node>:3000 --total 50
```

如果大部分请求显示 `✓`，说明部署成功。

### 2. 生成 eBPF 调用链数据

在没有真实用户流量时，用脚本为 eBPF Agent 生成可观测数据：

```bash
# 持续生成流量
./traffic-gen.sh --gateway http://10.0.0.5:3000 --total 0
```

配合 Zerotrace Web 前端可观察到实时的调用链拓扑。

### 3. Chaos Engineering 演示

在演示或测试中展示故障注入对系统的影响：

```bash
./traffic-gen.sh --gateway http://10.0.0.5:3000 --chaos --total 200
```

观察哪些请求触发了延迟/错误/宕机，以及 orders 服务在级联调用 users 和 products 时的异常处理是否正确。

### 4. 压力测试

用高频率、大数据量来测试系统稳定性：

```bash
TOTAL=1000 MIN_DELAY_MS=50 MAX_DELAY_MS=100 \
  ./traffic-gen.sh --gateway http://10.0.0.5:3000
```

---

## 故障排查

| 现象 | 可能原因 | 检查方式 |
|---|---|---|
| `网关不可达` | 网关地址错误或服务未启动 | `curl <gateway>/health` |
| 所有请求都是 `✗` | 网关地址指向了错误的服务 | 检查 `--gateway` 参数 |
| Chaos 相关请求全是 2xx | 故障规则未注入成功 | `curl <gateway>/api/chaos/list` |
| 订单创建总是 400 | 订单序列号被重置 | 脚本预期 `o1000` 开头，重启后序列号重置，后续订单 ID 不同 |
| 输出停在某处 | 某次 Chaos 延迟太长 | 按 Ctrl+C 可立即停止，脚本会自动清理 |

---

## 命令行速查

```bash
# Docker Compose 本地环境
./traffic-gen.sh

# Docker Swarm 环境（以 192.168.1.100 为例）
./traffic-gen.sh --gateway http://192.168.1.100:3000 --total 200 --chaos

# 通过环境变量快速调整
GATEWAY_URL=http://192.168.1.100:3000 TOTAL=500 ./traffic-gen.sh

# 静默模式（输出重定向）
./traffic-gen.sh --gateway http://192.168.1.100:3000 > /dev/null
```
