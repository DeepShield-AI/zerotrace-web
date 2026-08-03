# =========================================================
# 微服务资源故障注入 Demo — Dockerfile (K8s 版)
# 所有服务共享同一镜像，通过 command 区分启动哪个服务
# =========================================================
FROM node:20-alpine

# 为 disk 故障类型提供可写临时目录
RUN mkdir -p /tmp/stress && chmod 777 /tmp/stress
ENV STRESS_TMP_DIR=/tmp/stress

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000 3001 3002 3003 3004

CMD ["npm", "run", "dev:gateway"]
