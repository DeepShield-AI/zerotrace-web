#!/bin/bash
# ============================================================
# 微服务资源故障注入 Demo — K8s 一键部署脚本
# 支持 buildah (推荐，无需 Docker daemon) / nerdctl / docker
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NAMESPACE="chaos-demo"
IMAGE="zerotrace-chaos-demo:latest"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ─── 检测容器工具 ──────────────────────────────────────────

BUILD_TOOL=""

if command -v buildah &>/dev/null; then
  BUILD_TOOL="buildah"
elif command -v nerdctl &>/dev/null; then
  BUILD_TOOL="nerdctl"
elif command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  BUILD_TOOL="docker"
else
  error "未找到可用的容器构建工具。"
  error ""
  error "推荐安装 buildah（无需 daemon，不与 K8s 冲突）:"
  error "  sudo apt-get install -y buildah"
  error ""
  error "其他选择:"
  error "  - nerdctl + buildkitd"
  error "  - docker.io"
  exit 1
fi

info "使用构建工具: ${BUILD_TOOL}"

# ─── 1. 构建镜像 ────────────────────────────────────────────

info "构建镜像: ${IMAGE}"
cd "$SCRIPT_DIR"

case "$BUILD_TOOL" in
  buildah)
    # buildah 从 Dockerfile 构建镜像
    # 步骤: bud(构建) -> push(导出为 docker-archive) -> ctr(导入 containerd)
    TAR_FILE="/tmp/chaos-demo-image-$$.tar"
    buildah bud -t "$IMAGE" .
    info "导出镜像为 docker-archive..."
    buildah push "$IMAGE" "docker-archive:${TAR_FILE}"
    info "导入镜像到 containerd (k8s.io namespace)..."
    sudo ctr -n k8s.io images import "$TAR_FILE"
    buildah rmi "$IMAGE" 2>/dev/null || true
    rm -f "$TAR_FILE"
    info "镜像构建 + 导入完成"
    ;;

  nerdctl)
    nerdctl --namespace k8s.io build -t "$IMAGE" .
    info "镜像构建完成 (containerd k8s.io namespace)"
    ;;

  docker)
    docker build -t "$IMAGE" .
    info "导出并导入 containerd..."
    docker save "$IMAGE" | sudo ctr -n k8s.io images import -
    info "镜像构建 + 导入完成"
    ;;
esac

# ─── 2. 部署到 K8s ─────────────────────────────────────────

info "部署到 Kubernetes (namespace: ${NAMESPACE})"

kubectl apply -f "$SCRIPT_DIR/k8s/namespace.yaml"
kubectl apply -f "$SCRIPT_DIR/k8s/redis.yaml"
kubectl apply -f "$SCRIPT_DIR/k8s/services.yaml"

info "等待 Pod 就绪..."
kubectl wait --for=condition=ready pod -l app=redis     -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Redis 未就绪"
kubectl wait --for=condition=ready pod -l app=gateway   -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Gateway 未就绪"
kubectl wait --for=condition=ready pod -l app=users     -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Users 未就绪"
kubectl wait --for=condition=ready pod -l app=products  -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Products 未就绪"
kubectl wait --for=condition=ready pod -l app=orders    -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Orders 未就绪"
kubectl wait --for=condition=ready pod -l app=chaos     -n "$NAMESPACE" --timeout=120s 2>/dev/null || warn "Chaos 未就绪"

NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "<node-ip>")

echo ""
info "============================================"
info "  部署完成!"
info "============================================"
info "  Namespace:  ${NAMESPACE}"
info "  Gateway:    http://${NODE_IP}:30300"
info "  Chaos API:  http://${NODE_IP}:30300/api/chaos"
echo ""
info "  Pod 状态:"
kubectl get pods -n "$NAMESPACE" -o wide
echo ""
info "  启动请求发生器:"
info "    cd demo && GATEWAY_URL=http://${NODE_IP}:30300 npm run gen"
echo ""
info "  手动注入故障示例:"
echo ""
info "    # CPU 压力到 orders (4 workers, 30s)"
info "    curl -XPOST http://${NODE_IP}:30300/api/chaos/inject \\"
info "      -H 'Content-Type: application/json' \\"
info "      -d '{\"target\":\"orders\",\"type\":\"cpu\",\"intensity\":4,\"duration\":30}'"
echo ""
info "    # 网络延迟到 users (3s延迟+1s抖动, 60s)"
info "    curl -XPOST http://${NODE_IP}:30300/api/chaos/inject \\"
info "      -H 'Content-Type: application/json' \\"
info "      -d '{\"target\":\"users\",\"type\":\"network\",\"delayMs\":3000,\"jitterMs\":1000,\"duration\":60}'"
echo ""
info "    # 内存压力到 products (200MB, 45s)"
info "    curl -XPOST http://${NODE_IP}:30300/api/chaos/inject \\"
info "      -H 'Content-Type: application/json' \\"
info "      -d '{\"target\":\"products\",\"type\":\"memory\",\"megabytes\":200,\"duration\":45}'"
echo ""
info "    # 磁盘 I/O 压力到 orders (500MB, 30s)"
info "    curl -XPOST http://${NODE_IP}:30300/api/chaos/inject \\"
info "      -H 'Content-Type: application/json' \\"
info "      -d '{\"target\":\"orders\",\"type\":\"disk\",\"fileSizeMB\":500,\"duration\":30}'"
echo ""
