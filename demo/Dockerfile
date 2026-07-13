# =========================================================
# 微服务故障注入 Demo — Dockerfile
# 基于 Moleculer 框架，各服务（gateway/users/products/orders/chaos）
# 均使用同一份镜像，仅通过 docker-compose 的 command 区分启动哪个服务
# =========================================================
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev:gateway"]
