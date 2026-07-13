#!/usr/bin/env bash
# ==============================================================
# 流量生成脚本 — 对 Demo 微服务发送混合请求
# 包含正确的请求和各类错误的请求，用于观察 eBPF 调用链
# ==============================================================

set -uo pipefail

# 可配置的网关地址
GATEWAY="${GATEWAY_URL:-http://localhost:3000}"
# 请求间隔（毫秒），默认随机 200~800
MIN_DELAY_MS=${MIN_DELAY_MS:-200}
MAX_DELAY_MS=${MAX_DELAY_MS:-800}
# 总请求数（0 = 无限循环）
TOTAL=${TOTAL:-100}
# 是否注入 Chaos 故障（yes/no）
CHAOS="${CHAOS:-no}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

count_total=0
count_ok=0
count_err=0
count_chaos=0

usage() {
  cat <<EOF
用法: $0 [选项]

发送混合流量到 Demo 微服务，模拟真实用户请求 + 异常请求。

选项:
  --gateway URL    网关地址（默认 http://localhost:3000）
  --total N        总请求数，0=无限循环（默认 100）
  --min-delay N    最小请求间隔毫秒（默认 200）
  --max-delay N    最大请求间隔毫秒（默认 800）
  --chaos          先注入故障规则再发送流量
  --no-chaos       不注入故障（默认）
  -h, --help       显示帮助

示例:
  $0 --gateway http://192.168.1.100:3000 --total 200 --chaos
  TOTAL=500 MIN_DELAY_MS=100 $0
EOF
  exit 0
}

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --gateway) GATEWAY="$2"; shift 2 ;;
    --total) TOTAL="$2"; shift 2 ;;
    --min-delay) MIN_DELAY_MS="$2"; shift 2 ;;
    --max-delay) MAX_DELAY_MS="$2"; shift 2 ;;
    --chaos) CHAOS="yes"; shift ;;
    --no-chaos) CHAOS="no"; shift ;;
    -h|--help) usage ;;
    *) echo "未知参数: $1"; usage ;;
  esac
done

# 清理后台进程
cleanup() {
  echo ""
  echo -e "${YELLOW}正在清理...${NC}"
  # 重置所有故障规则
  curl -s -o /dev/null -w "" -X POST "$GATEWAY/api/chaos/reset" 2>/dev/null || true
  echo -e "${YELLOW}已重置故障规则${NC}"
  print_summary
  exit 0
}
trap cleanup SIGINT SIGTERM

# ==============================================================
# 工具函数
# ==============================================================

rand() {
  local min=$1 max=$2
  echo $(( RANDOM % (max - min + 1) + min ))
}

rand_float() {
  awk -v min="$1" -v max="$2" 'BEGIN{srand(); print min + rand() * (max - min)}'
}

delay_ms() {
  local ms=$(rand "$MIN_DELAY_MS" "$MAX_DELAY_MS")
  sleep "$(echo "scale=3; $ms / 1000" | bc)"
}

ok() {
  local method="$1" url="$2" status="$3"
  count_ok=$((count_ok + 1))
  echo -e "${GREEN}✓${NC} $method $url → $status"
}

err() {
  local method="$1" url="$2" status="$3"
  count_err=$((count_err + 1))
  echo -e "${RED}✗${NC} $method $url → $status"
}

chaos_hit() {
  local method="$1" url="$2" status="$3"
  count_chaos=$((count_chaos + 1))
  echo -e "${CYAN}⚡${NC} $method $url → $status (chaos)"
}

# 发送请求并检查状态
request() {
  local method="$1" url="$2" expected_status="${3:-}" body_json="${4:-}" expected_chaos="${5:-no}"
  local curl_args=()
  if [[ -n "$body_json" ]]; then
    curl_args=(-H "Content-Type: application/json" -d "$body_json")
  fi

  local resp_file tmp_http_code
  resp_file=$(mktemp)
  tmp_http_code=$(curl -s -o "$resp_file" -w "%{http_code}" -X "$method" \
    "$GATEWAY$url" "${curl_args[@]}" 2>/dev/null || true)
  local http_code="${tmp_http_code:-000}"
  rm -f "$resp_file"

  if [[ "$expected_chaos" == "yes" ]]; then
    chaos_hit "$method" "$url" "$http_code"
  elif [[ -n "$expected_status" ]] && [[ "$http_code" == "$expected_status" ]]; then
    ok "$method" "$url" "$http_code"
  elif [[ -n "$expected_status" ]] && [[ "$http_code" != "$expected_status" ]]; then
    err "$method" "$url" "$http_code (预期 $expected_status)"
  else
    # 无预期值 — 正常代码 2xx 算对
    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
      ok "$method" "$url" "$http_code"
    else
      err "$method" "$url" "$http_code"
    fi
  fi
}

print_summary() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════${NC}"
  echo -e "${CYAN}  流量统计${NC}"
  echo -e "${CYAN}══════════════════════════════════${NC}"
  echo -e "  总请求:     ${count_total}"
  echo -e "${GREEN}  正确响应:   ${count_ok}${NC}"
  echo -e "${RED}  错误响应:   ${count_err}${NC}"
  if [[ "$CHAOS" == "yes" ]]; then
    echo -e "${CYAN}  故障命中:   ${count_chaos}${NC}"
  fi
  echo -e "${CYAN}══════════════════════════════════${NC}"
}

# ==============================================================
# 故障规则注入
# ==============================================================
inject_chaos() {
  echo -e "${YELLOW}[chaos] 注入故障规则...${NC}"

  # 1. orders.createOrder 有 30% 概率延迟 2~3 秒
  curl -s -X POST "$GATEWAY/api/chaos/set" \
    -H "Content-Type: application/json" \
    -d '{"target":"orders.createOrder","type":"latency","delayMs":2500,"jitterMs":500,"probability":0.3,"enabled":true}' \
    -o /dev/null
  echo -e "${CYAN}  → orders.createOrder: 30% 概率延迟 2.5s±0.5s${NC}"

  # 2. users.get 有 20% 概率返回 500 错误
  curl -s -X POST "$GATEWAY/api/chaos/set" \
    -H "Content-Type: application/json" \
    -d '{"target":"users.get","type":"error","errorCode":500,"errorType":"DB_TIMEOUT","errorMessage":"Database connection timeout","probability":0.2,"enabled":true}' \
    -o /dev/null
  echo -e "${CYAN}  → users.get: 20% 概率返回 500 DB_TIMEOUT${NC}"

  # 3. products.checkStock 有 15% 概率宕机
  curl -s -X POST "$GATEWAY/api/chaos/set" \
    -H "Content-Type: application/json" \
    -d '{"target":"products.checkStock","type":"down","errorCode":503,"errorType":"SERVICE_DOWN","errorMessage":"Stock service temporarily unavailable","probability":0.15,"enabled":true}' \
    -o /dev/null
  echo -e "${CYAN}  → products.checkStock: 15% 概率 503 宕机${NC}"

  echo -e "${CYAN}  当前规则:${NC}"
  curl -s "$GATEWAY/api/chaos/list" | python3 -m json.tool 2>/dev/null || curl -s "$GATEWAY/api/chaos/list"
  echo ""
}

# ==============================================================
# 请求场景定义
# ==============================================================

# ---- 正确请求 ----
correct_requests() {
  # 用户服务 — 列表
  request GET "/api/users" "200"
  delay_ms

  # 用户服务 — 查有效用户
  for uid in u1 u2 u3; do
    request GET "/api/users/$uid" "200"
    delay_ms
  done

  # 商品服务 — 列表
  request GET "/api/products" "200"
  delay_ms

  # 商品服务 — 查有效商品
  for pid in p1 p2 p3; do
    request GET "/api/products/$pid" "200"
    delay_ms
  done

  # 商品服务 — 库存检查（有效）
  request POST "/api/products/p1/checkStock" "200" '{"quantity":2}'
  delay_ms
  request POST "/api/products/p3/checkStock" "200" '{"quantity":10}'
  delay_ms

  # 订单服务 — 列表（可能空，但正确）
  request GET "/api/orders" "200"
  delay_ms

  # 订单服务 — 创建有效订单
  request POST "/api/orders" "201" '{"userId":"u1","productId":"p1","quantity":1}'
  delay_ms
  request POST "/api/orders" "201" '{"userId":"u2","productId":"p2","quantity":3}'
  delay_ms
  request POST "/api/orders" "201" '{"userId":"u3","productId":"p3","quantity":1}'
  delay_ms

  # 查询刚创建的订单
  request GET "/api/orders/o1000" "200"
  delay_ms
  request GET "/api/orders/o1001" "200"
  delay_ms

  # 网关健康检查
  request GET "/health" "200"
  delay_ms

  # Chaos 控制面
  request GET "/api/chaos/list" "200"
  delay_ms
}

# ---- 错误请求 ----
error_requests() {
  # 404 — 不存在的用户
  request GET "/api/users/nonexistent" "404"
  delay_ms
  request GET "/api/users/999" "404"
  delay_ms

  # 404 — 不存在的商品
  request GET "/api/products/foo" "404"
  delay_ms
  request GET "/api/products/p999" "404"
  delay_ms

  # 404 — 不存在的订单
  request GET "/api/orders/invalid" "404"
  delay_ms

  # 404 — 不存在的路径
  request GET "/api/nonexistent" "404"
  delay_ms

  # 400 — 缺少 userId
  request POST "/api/orders" "400" '{"productId":"p1","quantity":1}'
  delay_ms

  # 400 — 缺少 productId
  request POST "/api/orders" "400" '{"userId":"u1","quantity":1}'
  delay_ms

  # 400 — 空 body
  request POST "/api/orders" "400" '{}'
  delay_ms

  # 400 — 无效 userId（非 u1/u2/u3）
  request POST "/api/orders" "400" '{"userId":"u999","productId":"p1","quantity":1}'
  delay_ms

  # 409 — 库存不足（p2 库存 300，请求 999）
  request POST "/api/orders" "409" '{"userId":"u1","productId":"p2","quantity":999}'
  delay_ms

  # 404 — 不存在的商品库存检查
  request POST "/api/products/p999/checkStock" "404" '{"quantity":1}'
  delay_ms

  # POST 到 GET 端点（405 或 404）
  request POST "/api/users" "404"
  delay_ms

  # 无效 JSON body
  local http_code
  http_code=$(curl -s -o /tmp/traffic_resp.json -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "this is not json" \
    "$GATEWAY/api/orders" 2>/dev/null || echo "000")
  if [[ "$http_code" =~ ^4[0-9][0-9]$ ]]; then
    ok "POST" "/api/orders (bad json)" "$http_code"
  else
    err "POST" "/api/orders (bad json)" "$http_code"
  fi
  delay_ms

  # GET 带 body（语法上没问题，但不是所有服务都处理）
  request GET "/api/users?foo=bar" "200"
  delay_ms
}

# ---- Chaos 故障触发请求 ----
chaos_trigger_requests() {
  # 反复调用带有故障注入概率的端点，触发故障
  for i in $(seq 1 10); do
    request POST "/api/orders" "201" '{"userId":"u1","productId":"p1","quantity":1}' "yes"
    delay_ms
  done

  # 触发 users.get 故障（20% 概率，多试几次）
  for i in $(seq 1 10); do
    request GET "/api/users/u1" "200" "yes"
    delay_ms
  done

  # 触发 products.checkStock 故障（15% 概率）
  for i in $(seq 1 10); do
    request POST "/api/products/p1/checkStock" "200" '{"quantity":1}' "yes"
    delay_ms
  done
}

# ==============================================================
# 主循环
# ==============================================================

echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}   Zerotrace Demo 流量生成器${NC}"
echo -e "${CYAN}   Gateway: ${GATEWAY}${NC}"
echo -e "${CYAN}   总请求: ${TOTAL}${NC}"
echo -e "${CYAN}   间隔: ${MIN_DELAY_MS}~${MAX_DELAY_MS}ms${NC}"
echo -e "${CYAN}   Chaos: ${CHAOS}${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"
echo ""

# 先检查网关是否可达
if ! curl -s -o /dev/null "$GATEWAY/health" 2>/dev/null; then
  echo -e "${RED}错误: 无法连接到网关 $GATEWAY/health${NC}"
  echo "请确保 demo 服务正在运行，或通过 --gateway 指定地址"
  exit 1
fi
echo -e "${GREEN}网关可达 ✓${NC}"
echo ""

# 可选：注入故障
if [[ "$CHAOS" == "yes" ]]; then
  inject_chaos
fi

# 请求场景池 — 按比例分配
# 场景 0-3: 正确请求
# 场景 4-5: 错误请求
# 场景 6:   Chaos 触发（仅当 CHAOS=yes）
SCENARIOS=(0 0 1 1 2 2 3 3 4 5)

if [[ "$TOTAL" -eq 0 ]]; then
  echo -e "${YELLOW}无限循环模式 (Ctrl+C 停止)${NC}"
  echo ""
  i=0
  while true; do
    scene=${SCENARIOS[$(( RANDOM % ${#SCENARIOS[@]} ))]}
    case $scene in
      0|1|2|3) correct_requests ;;
      4|5)     error_requests ;;
      6)       [[ "$CHAOS" == "yes" ]] && chaos_trigger_requests ;;
    esac
    count_total=$((count_total + 1))
  done
else
  while [[ $count_total -lt $TOTAL ]]; do
    scene=${SCENARIOS[$(( RANDOM % ${#SCENARIOS[@]} ))]}
    case $scene in
      0|1|2|3)
        correct_requests
        count_total=$((count_total + 1))
        ;;
      4|5)
        error_requests
        count_total=$((count_total + 1))
        ;;
      6)
        if [[ "$CHAOS" == "yes" ]]; then
          chaos_trigger_requests
          count_total=$((count_total + 1))
        fi
        ;;
    esac
  done
fi

# 重置故障规则
if [[ "$CHAOS" == "yes" ]]; then
  curl -s -o /dev/null -X POST "$GATEWAY/api/chaos/reset" 2>/dev/null || true
  echo -e "${YELLOW}已重置故障规则${NC}"
fi

print_summary
