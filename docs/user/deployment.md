# Zerotrace Web — Deployment Guide

## Docker Compose Deployment

### Prerequisites

Zerotrace Web images are distributed via a private Docker registry. The target machine must be configured to access it.

**Step 1 — Configure private registry**

Add the following to `/etc/docker/daemon.json` (create the file if it doesn't exist):

```json
{
  "insecure-registries": ["47.97.67.233:5000"]
}
```

Restart Docker to apply:

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

**Step 2 — Login**

```bash
docker login 47.97.67.233:5000
```

### 1. Start

```bash
docker compose up -d
```

This pulls the `zerotrace-web` image from the private registry and starts a single container that serves the API, frontend SPA, and agent installer on port 5173 (configurable via `WEB_PORT`).

### 2. Verify

```bash
curl http://localhost:5173/api/v1/auth/me
# → {"error":"unauthorized"}  (expected — no session)
```

Open `http://<host-ip>:5173` in a browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `mysql://root:deepflow@zerotrace-mysql:30130/deepflow` | MySQL connection |
| `DEEPFLOW_SERVER_URL` | `http://zerotrace-server:20417` | Server API endpoint |
| `JWT_SECRET` | `change-me-in-production` | JWT signing key |
| `WEB_PORT` | `5173` | Host port for web UI |

---

## Building Docker Image from Source

### 1. Build on Host

```bash
cd backend && cargo build --release
cd ../frontend && npm run build
```

### 2. Prepare Build Context

```bash
./scripts/prepare-docker-build.sh
```

This collects the compiled binary, frontend dist, glibc libraries, migrations, and agent installer into the `build/` directory.

### 3. Build Image

```bash
docker build -t zerotrace-web:latest .
```

### 4. Push to Private Registry

```bash
docker tag zerotrace-web:latest 47.97.67.233:5000/deepshield/zerotrace-web:latest
docker push 47.97.67.233:5000/deepshield/zerotrace-web:latest
```

---

## Related Documentation

- [Zerotrace Server Deployment](https://github.com/DeepShield-AI/zerotrace-server/blob/main/docs/deployment.md)
- [Zerotrace Agent](https://github.com/DeepShield-AI/zerotrace-agent)
