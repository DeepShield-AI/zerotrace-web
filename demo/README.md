# zerotrace-web Demo 双节点 Kubernetes 部署文档

适用场景：两台阿里云 ECS组成一个 2 节点 K8s 集群，
在集群中部署本仓库的微服务故障注入 Demo（`demo/` 目录，`chaos-demo` 命名空间，共 6 个组件）。

### 本部署实际参数

| 角色 | 主机名 | 私网 IP | 公网 IP | 部署内容 |
| --- | --- | --- | --- | --- |
| K8s 控制平面 | worker1 | <worker1_private_ip> | <worker1_public_ip> | kubeadm init、Calico、demo 构建与部署都在此执行 |
| K8s 工作节点 | worker2 | <worker2_private_ip> | <worker2_public_ip> | kubeadm join、运行部分 demo Pod |

两台私网 IP 同 VPC（同一网段），集群内部通信走私网，公网 IP 仅用于 SSH 和对外访问。
若两台机器无私网互通，则改用公网 IP 组集群并放行节点间端口。

---

## 0. 总体架构

### 0.1 拓扑

```
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│ worker1（控制平面）                │◄────►│ worker2（工作节点）                │
│ 公网 <worker1_public_ip>          │      │ 公网 <worker2_public_ip>          │
│ 私网 <worker1_private_ip>         │      │ 私网 <worker2_private_ip>         │
│                                  │      │                                  │
│ chaos-demo 命名空间:              │      │ chaos-demo 命名空间:              │
│   gateway (NodePort 30300)       │      │   orders / chaos / redis        │
│   users / products               │      │                                  │
└──────────────────────────────────┘      └──────────────────────────────────┘
         │
         ▼  kubectl apply（在 worker1 上执行）
   浏览器/测试机 → gateway → orders → users + products
```

- 服务间调用链（HTTP）：`gateway → orders → users + products`，故障规则存 Redis 并广播。
- **Pod 分工已用 `nodeSelector` 固定**：worker1 跑 gateway/users/products，worker2 跑 orders/chaos/redis，保证每个服务调用都跨节点。

### 0.2 端口规划

| 端口 | 用途 | 放行方 |
| --- | --- | --- |
| 6443/tcp | kube-apiserver | worker2 → worker1 |
| 10250/tcp | kubelet | 双向 |
| 2379-2380/tcp | etcd | worker2 → worker1 |
| 179/tcp + IPIP(协议号 4) | Calico BGP / 数据封装 | 双向 |
| 10257/10259 | controller-manager / scheduler（可选） | worker1 |
| **30300/tcp** | **demo gateway（NodePort）** | 公网访问需放行；集群内/SSH 隧道不需要 |
| 22/tcp | SSH | 管理员 |

### 0.3 软件版本清单

| 软件 | 版本 | 位置 |
| --- | --- | --- |
| Ubuntu | 26.04 LTS（内核 7.0） | 两台 |
| containerd | 2.2.2（apt 自带） | 两台 |
| kubeadm / kubelet / kubectl | v1.28.2（阿里云源） | 两台 |
| Calico | v3.28.0 | 集群 |
| buildah | 1.42（apt 安装，构建 demo 镜像） | 两台 |
| demo 镜像 | `localhost/zerotrace-chaos-demo:latest` | 两台节点 containerd |
| redis 镜像 | `redis:7-alpine` | 两台节点 containerd |

---

## 1. 基础环境准备（两台机器）

### 1.1 设置主机名与 hosts

```bash
# worker1 (<worker1_public_ip>)
sudo hostnamectl set-hostname worker1
# worker2 (<worker2_public_ip>)
sudo hostnamectl set-hostname worker2
```

两台机器都追加 `/etc/hosts`：

```bash
sudo tee -a /etc/hosts <<EOF
<worker1_public_ip>  worker1
<worker2_public_ip> worker2
EOF
```

### 1.2 系统初始化（两台）

```bash
# 1) 关闭 swap
sudo swapoff -a
sudo sed -i '/swap/s/^/#/' /etc/fstab

# 2) 内核模块
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# 3) 内核参数
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# 4) 关闭防火墙（本方案所有放行走阿里云安全组）
sudo ufw disable

# 5) 时间同步
sudo apt-get update && sudo apt-get install -y chrony
sudo systemctl enable --now chrony
```

### 1.3 确认私网互通（关键）

```bash
hostname -I
# 两台都应看到私网 IP（同 VPC）；在 worker2 上验证：
ping -c 3 <worker1_private_ip>
```

> 集群内部通信用私网 IP。若两台不在同一 VPC（无私网互通），则参考 4.1/4.4 改用公网 IP，
> 并放行 0.2 节节点间端口（附录 B）。

---

## 2. 安装 containerd 并配置 crictl（两台机器）

### 2.1 安装并确认版本

```bash
sudo apt-get update && sudo apt-get install -y containerd
containerd --version    # 关键！决定配置方式
```

> - **containerd 2.x**（Ubuntu 25.04/26.04 自带 2.2.x）：按 2.2 配置；
> - **containerd 1.7.x**（Ubuntu 22.04/24.04）：按 2.3 配置。
>
> ⚠️ 实测坑：按 1.7 的方式在 `io.containerd.grpc.v1.cri` 段配置镜像加速，**在 2.x 上完全不生效**
> （2.x 插件已改名 `io.containerd.cri.v1.images`），且沙箱镜像默认指向被墙的
> `registry.k8s.io/pause:3.10.1`，kubelet 创建 Pod 时永远拉不到 → 控制面起不来（见 7.4）。

### 2.2 containerd 2.x 配置（Ubuntu 26.04 实测）

生成默认配置后**必须改两处**：

```bash
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml

# ① 沙箱镜像指向阿里云（默认 registry.k8s.io/pause:3.10.1 被墙；pause:3.9 与 kubelet 参数一致）
sudo sed -i "s|sandbox = 'registry.k8s.io/pause:3.10.1'|sandbox = 'registry.aliyuncs.com/google_containers/pause:3.9'|" /etc/containerd/config.toml

# ② 镜像加速改用 config_path + hosts.toml（2.1 已移除 mirrors 属性）
sudo sed -i "s|^      config_path = ''$|      config_path = '/etc/containerd/certs.d'|" /etc/containerd/config.toml
```

创建加速配置文件：

```bash
sudo mkdir -p /etc/containerd/certs.d/docker.io /etc/containerd/certs.d/registry.k8s.io /etc/containerd/certs.d/quay.io
sudo tee /etc/containerd/certs.d/docker.io/hosts.toml <<'EOF'
server = "https://registry-1.docker.io"

[host."https://docker.m.daocloud.io"]
  capabilities = ["pull", "resolve"]
EOF
sudo tee /etc/containerd/certs.d/registry.k8s.io/hosts.toml <<'EOF'
server = "https://registry.k8s.io"

[host."https://k8s.m.daocloud.io"]
  capabilities = ["pull", "resolve"]
EOF
sudo tee /etc/containerd/certs.d/quay.io/hosts.toml <<'EOF'
server = "https://quay.io"

[host."https://quay.m.daocloud.io"]
  capabilities = ["pull", "resolve"]
EOF
```

### 2.3 containerd 1.7.x 配置（22.04/24.04）

```bash
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
```

在 `[plugins."io.containerd.grpc.v1.cri".registry]` 段添加镜像加速：

```toml
  [plugins."io.containerd.grpc.v1.cri".registry.mirrors]
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."docker.io"]
      endpoint = ["https://docker.m.daocloud.io"]
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."registry.k8s.io"]
      endpoint = ["https://k8s.m.daocloud.io"]
    [plugins."io.containerd.grpc.v1.cri".registry.mirrors."quay.io"]
      endpoint = ["https://quay.m.daocloud.io"]
```

### 2.4 启动 containerd 并配置 crictl（两台）

```bash
sudo systemctl enable --now containerd
sudo systemctl status containerd          # active (running) 即正常
ls -l /run/containerd/containerd.sock

# 配置 crictl 指向 containerd（写 /etc/crictl.yaml，一次配置永久生效）
sudo crictl config --set runtime-endpoint=unix:///run/containerd/containerd.sock \
                   --set image-endpoint=unix:///run/containerd/containerd.sock

# 验证（成功即说明镜像加速生效；用 crictl 而非 ctr——ctr 走通用服务、不读 CRI 配置）
sudo crictl pull docker.io/library/redis:7-alpine
sudo crictl images | grep redis
```

> `crictl ps -a` 报 `dial unix /var/run/dockershim.sock ... no such file` 是**正常表象**：
> crictl 未配置 endpoint 时按默认列表逐个尝试、全失败时报第一个的错误，真正含义是 containerd 没在运行
> （`systemctl enable --now containerd` 后配置 `/etc/crictl.yaml` 即可，见 7.1）。

---

## 3. 安装 kubeadm / kubelet / kubectl（两台机器）

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://mirrors.aliyun.com/kubernetes/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://mirrors.aliyun.com/kubernetes/apt kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
kubeadm version        # 期望 1.28.x
```

> 阿里云 `kubernetes-xenial` 源最高 1.28.2，与 4.1 的 `--kubernetes-version v1.28.2` 配套；
> 实际版本以 `apt-cache madison kubeadm` 输出为准并同步改 4.1。

---

## 4. 初始化 2 节点 K8s 集群

### 4.1 worker1 执行 kubeadm init

```bash
sudo kubeadm init \
  --kubernetes-version v1.28.2 \
  --image-repository registry.aliyuncs.com/google_containers \
  --pod-network-cidr=10.244.0.0/16 \
  --apiserver-advertise-address=<worker1_private_ip>
```

> - `--image-repository` 走阿里云镜像仓库，否则拉不动 k8s 系统镜像；
> - `--apiserver-advertise-address` 填节点间通信 IP（有私网用私网，否则公网）；
> - 初始化成功后**保存输出的 `kubeadm join ...` 命令**，4.4 使用；token 24h 过期后可
>   `sudo kubeadm token create --print-join-command` 重新生成；
> - **重试前先清理**：若报 `FileAvailable--etc-kubernetes-manifests-...` / `Port 10250 is in use`，
>   说明之前 init 过，先 `sudo kubeadm reset -f && sudo rm -rf /etc/cni/net.d` 再重新 init。

### 4.2 配置 kubectl（worker1）

```bash
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
kubectl get nodes    # worker1 NotReady 属正常（还没装 CNI）
```

### 4.3 安装 Calico 网络插件（worker1）

```bash
# 下载 manifest（raw.githubusercontent.com 被墙时用 ghfast.top 代理；也可本机下载后 scp）
curl -fsSL -o /tmp/calico.yaml \
  https://ghfast.top/https://raw.githubusercontent.com/projectcalico/calico/v3.28.0/manifests/calico.yaml

# 关键：把默认的 192.168.0.0/16 池改成与 kubeadm init 一致的 10.244.0.0/16
#（manifest 里该行是注释状态，取消注释）：
sed -i 's|^            # - name: CALICO_IPV4POOL_CIDR|            - name: CALICO_IPV4POOL_CIDR|' /tmp/calico.yaml
sed -i 's|^            #   value: "10.244.0.0/16"|              value: "10.244.0.0/16"|' /tmp/calico.yaml

kubectl apply -f /tmp/calico.yaml
kubectl wait --for=condition=Ready pod -l k8s-app=calico-node -n kube-system --timeout=300s
```

> Calico 镜像在 quay.io，经 2.2 的加速自动拉取；拉取失败可手动预拉：
> `sudo ctr -n k8s.io images pull quay.io/calico/node:v3.28.0`（`ctr` 拉取需临时配置，直接重启 containerd 后等 kubelet 重试即可）。

### 4.4 worker2 加入集群

```bash
sudo kubeadm join <worker1_private_ip>:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

> **若 init 曾中断**（如 7.4 的 pause 问题导致 wait-control-plane 超时），join 会报
> `configmaps "cluster-info" is forbidden` / `kubeadm-config is forbidden` —— 中断时
> cluster-info、kubeadm-config 等 ConfigMap 没创建。在 worker1 补跑（无需 reset）：

```bash
kubeadm init phase bootstrap-token        # 创建 kube-public/cluster-info + bootstrap RBAC
kubeadm init phase upload-config kubeadm  # 上传 kubeadm-config
kubeadm init phase upload-config kubelet  # 上传 kubelet-config
```

### 4.5 验证集群

```bash
kubectl get nodes -o wide                 # 2 节点 Ready
kubectl get pods -n kube-system -o wide   # etcd/apiserver/calico/coredns/kube-proxy Running
```

> 本方案 worker1 未打 control-plane 污点（init 中断时未标记），demo Pod 可直接调度到两台；
> 若你手动完整 init 过（带污点），执行 `kubectl taint nodes --all node-role.kubernetes.io/control-plane-` 去污点。

---

## 5. 部署 Demo 微服务

### 5.1 获取代码（worker1）

```bash
git clone https://github.com/DeepShield-AI/zerotrace-web.git
```

### 5.2 安装 buildah 并配置镜像加速（两台）

```bash
sudo apt-get update && sudo apt-get install -y buildah
# buildah 不读 containerd 的 CRI 配置；不配加速会直连 docker.io 拉 node:20-alpine 超时（实测坑）
cat >> /etc/containers/registries.conf <<'EOF'

# docker.io → daocloud 加速
[[registry]]
location = "docker.io"

[[registry.mirror]]
location = "docker.m.daocloud.io"
EOF
```

### 5.3 构建并导入 demo 镜像

**worker1（构建 + 导入）**：

```bash
cd zerotrace-web/demo
sudo buildah bud -t zerotrace-chaos-demo:latest .        # 构建（含 npm install，几分钟）
# 构建产物名会被标记为 localhost/zerotrace-chaos-demo:latest，正好与 manifest 一致
sudo buildah push localhost/zerotrace-chaos-demo:latest docker-archive:/tmp/chaos-demo.tar
sudo ctr -n k8s.io images import /tmp/chaos-demo.tar
sudo ctr -n k8s.io images list | grep chaos-demo          # 应有 localhost/zerotrace-chaos-demo:latest
```

**worker2（从 worker1 传输导入）**：

```bash
scp root@<worker1_public_ip>:/tmp/chaos-demo.tar /tmp/         # 在 worker2 上执行
sudo ctr -n k8s.io images import /tmp/chaos-demo.tar
rm -f /tmp/chaos-demo.tar
sudo ctr -n k8s.io images list | grep chaos-demo
```

> manifest 里是私有镜像名 `localhost/zerotrace-chaos-demo:latest`（拉不到），
> **必须每台可能运行 Pod 的节点本地导入且名字完全一致**（见 7.5）。
> 若导入后名字不一致（如 `docker.io/library/...`），用 tag 对齐：
> `sudo ctr -n k8s.io images tag <实际名字> localhost/zerotrace-chaos-demo:latest`

### 5.4 redis 镜像（两台预拉，可选）

```bash
sudo crictl pull docker.io/library/redis:7-alpine   # 走 daocloud 加速
```

### 5.5 执行部署（worker1）

```bash
cd zerotrace-web/demo
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/services.yaml
kubectl get pods -n chaos-demo -o wide   # 期望 6 个 Running，分布见下
```

**Pod 分工（已在 manifests 用 nodeSelector 固定）**：

| 节点 | 服务 |
| --- | --- |
| worker1 | gateway、users、products |
| worker2 | orders、chaos、redis |

> 分工写在 [demo/k8s/services.yaml](demo/k8s/services.yaml)、[demo/k8s/redis.yaml](demo/k8s/redis.yaml)
> 的 `spec.template.spec.nodeSelector.kubernetes.io/hostname`，想调整改后重新 apply 即可。
> 为什么固定分工：调度器按"最少资源"分配，负载不均时新 Pod 会全挤在一台（重启也不均衡），固定后拓扑确定且调用链全部跨节点。

### 5.6 验证

```bash
# 业务接口（集群内验证用 localhost）
curl http://localhost:30300/health                # {"status":"ok","service":"gateway","activeFaults":0}
curl http://localhost:30300/api/users             # 用户列表
curl -X POST http://localhost:30300/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","productId":"p1","quantity":2}'   # 创建订单（级联 users+products）
```

### 5.7 流量生成与故障注入

**流量生成**（任意有 curl 的机器，指向网关）：

```bash
cd zerotrace-web/demo
GATEWAY_URL=http://localhost:30300 TOTAL=200 ./traffic-gen.sh
# 或 GATEWAY_URL=http://localhost:30300 npm run gen
```

**故障注入**（k8s 版 chaos API，实时生效、无需重启服务）：

```bash
# 给 users 注入 3s 网络延迟（orders 级联调用 users，可观察故障传播）
curl -X POST http://localhost:30300/api/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{"target":"users","type":"network","delayMs":3000,"duration":60}'

# 资源型故障：CPU / 内存 / 磁盘 I/O
curl -X POST http://localhost:30300/api/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{"target":"orders","type":"cpu","intensity":4,"duration":30}'
curl -X POST http://localhost:30300/api/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{"target":"products","type":"memory","megabytes":200,"duration":45}'
curl -X POST http://localhost:30300/api/chaos/inject \
  -H "Content-Type: application/json" \
  -d '{"target":"orders","type":"disk","fileSizeMB":500,"duration":30}'

# 请求级规则（延迟类）
curl -X POST http://localhost:30300/api/chaos/rule/set \
  -H "Content-Type: application/json" \
  -d '{"target":"users","type":"latency","delayMs":2000,"jitterMs":500}'

# 查看状态 / 释放
curl http://localhost:30300/api/chaos/status
curl -X POST http://localhost:30300/api/chaos/release-all
```

> k8s 版接口完整路由见
> [demo/services/chaos.service.js](demo/services/chaos.service.js)。
> 实测效果：users 注入 3s 延迟后订单创建 3.94s，释放后 0.058s。

---

## 6. 访问方式（三种任选）

### 6.1 公网直连（需放行安全组 30300）

两台节点安全组入方向放行 **30300/tcp** 后，浏览器访问：

```
http://<worker1_public_ip>:30300     # 或 http://<worker2_public_ip>:30300
```

### 6.2 SSH 隧道（无需放行任何端口，推荐）

在自己电脑上执行（只走已放行的 22 端口）：

```bash
ssh -N -L 30300:127.0.0.1:30300 root@<worker1_public_ip>
```

保持窗口开启，浏览器访问 **http://localhost:30300**。流量生成、故障注入的地址同理换成 `http://localhost:30300`。

### 6.3 kubectl port-forward

```bash
kubectl port-forward -n chaos-demo svc/gateway 3000:3000   # worker1 上执行
# 配合 ssh -L 3000:127.0.0.1:3000 隧道使用
```

---

## 7. 常见问题排查（全部为实测踩坑）

### 7.1 crictl 报 `dockershim.sock ... no such file or directory`

见 2.4：crictl 未配置 endpoint 时按默认列表尝试、全失败时报第一个的错误。根因是 containerd 没运行，
`sudo systemctl enable --now containerd` + 配置 `/etc/crictl.yaml` 即可。

### 7.2 kubeadm init 报 `FileAvailable--etc-kubernetes-manifests-...` / `Port 10250 is in use`

之前 init 的残留状态。`sudo kubeadm reset -f && sudo rm -rf /etc/cni/net.d` 后重新 init。

### 7.3 kubeadm init 超时 `wait-control-plane ... timed out waiting for the condition`

多为沙箱镜像拉不到（见 7.4）。修复后 kubelet 会自动重试拉起控制面，无需 reset；
但 init 中断残留的"缺阶段"问题按 4.4 的补跑命令处理（bootstrap-token / upload-config），
缺少的 addon（kube-proxy/coredns）用 `kubeadm init phase addon kube-proxy` / `kubeadm init phase addon coredns` 补。

### 7.4 kubelet 日志报 `registry.k8s.io/pause:3.10.1 ... i/o timeout`

containerd 2.x 沙箱镜像默认指向被墙的 registry.k8s.io（kubelet 的 `--pod-infra-container-image` 参数不生效，
沙箱镜像以 containerd 配置为准）。按 2.2 改 `sandbox` 指向阿里云 pause:3.9 后重启 containerd。

### 7.5 demo Pod 报 ImagePullBackOff / ErrImageNeverPull

`localhost/zerotrace-chaos-demo:latest` 是私有镜像名，必须本地导入且名字完全一致：

```bash
kubectl describe pod -n chaos-demo <pod名> | grep -A3 Events
sudo ctr -n k8s.io images list | grep chaos-demo
# 名字不对就 tag 对齐（见 5.3），对齐后 Pod 会在 kubelet 下一轮重试时自动恢复
```

### 7.6 buildah 构建报 `docker.io/library/node:20-alpine ... i/o timeout`

buildah 不读 containerd 的 CRI 配置，需在 `/etc/containers/registries.conf` 配置 docker.io 加速（见 5.2）。

### 7.7 Pod 全部挤在同一台节点

调度器按"最少资源"分配，负载不均时新 Pod 全去空闲节点，重启也不均衡。已用 nodeSelector 固定分工（见 5.5）。

### 7.8 浏览器访问 30300 不通

安全组未放行 → 用 6.2 的 SSH 隧道，或放行 30300/tcp。集群内验证用 `curl http://localhost:30300/health`。

### 7.9 节点 NotReady

- Calico Pod 没起来：`kubectl get pods -n kube-system`，镜像拉不下来见 2.2/4.3；
- calico-node init 容器 CrashLoop：多为 kube-proxy 尚未就绪导致连不上 10.96.0.1，等 kube-proxy Running 后自动重试成功。

### 7.10 kubeadm join 报 token 过期 / 错误

在 worker1 重新生成：`sudo kubeadm token create --print-join-command`。

---

## 附录 A：部署顺序速查表

```text
第 1 章  两台机器基础环境（hostname/hosts/内核参数/ufw/chrony）      (~15min)
第 2 章  containerd + crictl（2.2 配置 + 加速验证）                 (~15min)
第 3 章  kubeadm / kubelet / kubectl                               (~5min)
第 4 章  worker1 init + Calico + worker2 join + 验证                (~20min)
第 5 章  两台构建/导入镜像 + apply + 验证调用链                       (~20min)
第 6 章  SSH 隧道访问 + 流量生成 + 故障注入演示
```

## 附录 B：安全组端口清单（阿里云控制台）

**worker1（<worker1_public_ip>）入方向**：

| 用途 | 端口 | 来源 |
| --- | --- | --- |
| kube-apiserver | 6443/tcp | <worker2_public_ip> |
| kubelet | 10250/tcp | <worker2_public_ip>、本机 |
| etcd | 2379-2380/tcp | <worker2_public_ip> |
| Calico BGP | 179/tcp | <worker2_public_ip> |
| Calico 数据封装 | IPIP（协议号 4） | <worker2_public_ip> |
| demo gateway（可选，公网直连才需要） | 30300/tcp | 0.0.0.0/0 或测试机 IP |
| SSH | 22/tcp | 管理员 IP |

**worker2（<worker2_public_ip>）入方向**：

| 用途 | 端口 | 来源 |
| --- | --- | --- |
| kubelet | 10250/tcp | <worker1_public_ip>、本机 |
| Calico BGP | 179/tcp | <worker1_public_ip> |
| Calico 数据封装 | IPIP（协议号 4） | <worker1_public_ip> |
| demo gateway（可选） | 30300/tcp | 0.0.0.0/0 或测试机 IP |
| SSH | 22/tcp | 管理员 IP |

> 同 VPC 且同安全组时，节点间端口（6443/10250/2379/179/IPIP）可免配，只需保留 22（与 30300 按需）。
