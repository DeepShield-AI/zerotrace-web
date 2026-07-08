# Zerotrace Web — Deployment Guide

## Architecture Overview

Zerotrace is split across two independently maintained repositories:

| Project | Role | Contains |
|---|---|---|
| **zerotrace-web** (this repo) | UI / control plane | Frontend (React SPA) + Backend (Rust/Axum API) |
| **zerotrace-server** (separate repo) | Data plane | MySQL (metadata), ClickHouse (telemetry), Zerotrace controller API |

**How the pieces talk to each other:**

- The **frontend** never calls `zerotrace-server` directly. It only issues relative requests (`/api/*`, `/agent/*`) to the **backend**, which must be reachable on the same origin — via the Vite dev proxy locally, or because the backend serves the frontend's static build in production.
- The **backend** is the only component that talks to `zerotrace-server`: it forwards agent, infrastructure, and org-provisioning calls to the controller API, and reads/writes directly to the MySQL and ClickHouse instances that `zerotrace-server` provisions.

```
  zerotrace-web
  ┌────────────────────────────────────┐
  │  Frontend :5173 ─/api,/agent─▶ Backend :3001  │
  └──────────────────────┬─────────────┘
                          │  DATABASE_URL
                          │  CLICKHOUSE_URL
                          │  ZEROTRACE_SERVER_URL
                          ▼
  zerotrace-server
  ┌────────────────────────────────────┐
  │  MySQL :30130 · ClickHouse :8123/:9000 · Controller :30417  │
  └────────────────────────────────────┘
```

**Can Web be deployed standalone?**

Yes — `zerotrace-web` is a separate deployable unit and can be started or stopped independently of `zerotrace-server`. It is, however, **not self-sufficient**: at startup it needs three pieces of connection info that only a running `zerotrace-server` deployment can supply, passed in as environment variables:

| Needed from Server | Env var | Used for |
|---|---|---|
| MySQL address | `DATABASE_URL` | Users, orgs, API keys, billing |
| ClickHouse address | `CLICKHOUSE_URL` | APM traces, metrics, network flows |
| Controller API address | `ZEROTRACE_SERVER_URL` / `ZEROTRACE_METERING_URL` | Agent/vtap management, org provisioning, usage metering |

Without these, the backend still boots (ClickHouse and the controller are optional at startup — connection failures are logged as warnings, not fatal errors), but any page depending on infra, APM, or agent data returns empty results. Login and basic account pages only require `DATABASE_URL`.

> The **frontend** on its own has no notion of "Server" at all — it is a plain SPA that only knows how to reach the backend via relative paths. It can be hosted on a different origin from the backend only if a reverse proxy in front routes `/api/*` and `/agent/*` to wherever the backend runs; the codebase does not expose a configurable API base URL.

## Local Development Deployment

For setting up the full development environment on a local machine (dependencies, databases, running frontend/backend, troubleshooting), see the **[Local Development Guide](./local-development.md)**.

---

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
