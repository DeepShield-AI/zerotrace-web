# =============================================================================
# Stage 1: Build React frontend
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY public/ ./public/
COPY src/ ./src/

RUN npm run build

# =============================================================================
# Stage 2: Nginx
# =============================================================================
FROM nginx:alpine

RUN apk update && apk add --no-cache tzdata

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
