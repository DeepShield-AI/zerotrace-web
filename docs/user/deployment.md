# Zerotrace Web — Deployment Guide

## Local Development Deployment

This section covers how to set up the full Zerotrace Web development environment on a local Linux machine, including databases, backend, and frontend.

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Local Development Environment                           │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Frontend    │   │  Backend      │   │  Databases   │  │
│  │  (Vite)      │──▶│  (Rust/Axum)  │──▶│  MySQL       │  │
│  │  :5173       │   │  :3001        │   │  :30130      │  │
│  └─────────────┘   └──────┬───────┘   │  ClickHouse   │  │
│                           │            │  :8123/:9000  │  │
│                           ▼            └──────────────┘  │
│                    ┌──────────────┐                      │
│                    │  ZT Server   │                      │
│                    │  :30417      │                      │
│                    └──────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

### 1. Prerequisites

| Dependency | Version | How to Install |
|---|---|---|
| Node.js | ≥ 22 | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt install -y nodejs` |
| pnpm | ≥ 11 | `npm install -g pnpm` |
| Rust | ≥ 1.96 (edition 2024) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Docker Engine | ≥ 20.10 | `sudo apt install docker.io` (or follow [official docs](https://docs.docker.com/engine/install/)) |
| Docker Compose | ≥ 2.0 | Bundled with Docker, or `sudo apt install docker-compose-v2` |

Verify installations:

```bash
node --version    # ≥ v22
pnpm --version    # ≥ 11
rustc --version   # ≥ 1.96
docker --version  # ≥ 20.10
```

### 2. Deploy Databases (MySQL + ClickHouse) and Zerotrace Server

The databases and Zerotrace Server are deployed via Docker from the `zerotrace-server` repository. **Web (frontend + backend) runs locally** — we only start the infrastructure containers from docker compose.

> **Note**: Images are pulled from the private registry at `47.97.67.233:5000`. Configure Docker to allow this insecure registry before proceeding (see [Docker Compose Deployment](#docker-compose-deployment) prerequisites).

```bash
# 1. Clone the server repo
cd ~
git clone https://github.com/DeepShield-AI/zerotrace-server.git
cd zerotrace-server/manifests

# 2. (Optional) Adjust host IP if the auto-detect doesn't match your setup
export HOST_IP=$(ip route get 1 | awk '{print $7; exit}')
echo "HOST_IP=$HOST_IP" > .env

# 3. IMPORTANT: Only start infrastructure services, NOT the web container.
#    Web (frontend + backend) will run locally in the following steps.
docker compose up -d mysql clickhouse server
```

This starts 3 containers:

| Container | Port | Description |
|---|---|---|
| `zerotrace-mysql` | `30130` | MySQL 8.0 (root password: `deepflow`) |
| `zerotrace-clickhouse` | `8123` / `9000` | ClickHouse HTTP / Native |
| `zerotrace-server` | `30417` / `30035` / `30033` | DeepFlow Server (controller + gRPC) |

> **Why not `docker compose up -d`?** The full compose file also starts `zerotrace-web`, which would occupy port 5173 and conflict with the locally-run frontend. We start only the three infrastructure services and run web locally.

**Initialization**: MySQL automatically runs `init.sql` on first start, creating the `grafana` database and setting up users. On subsequent starts, data persists in `/opt/deepflow/mysql`.

### 3. Setup npm Registry

The frontend dependencies are served from a private Verdaccio registry. Configure pnpm to use it:

```bash
pnpm config set registry http://47.97.67.233:4873/
```

### 4. Configure pnpm Workspace

This project uses **pnpm workspace** to manage dependencies. Before installing, verify that `pnpm-workspace.yaml` at the repository root contains the `packages` field:

```yaml
# zerotrace-web/pnpm-workspace.yaml
packages:
  - 'frontend'

allowBuilds:
  '@swc/core': true
  esbuild: true
  msw: true
```

The `allowBuilds` section pre-approves postinstall scripts for three packages that need native build steps (`@swc/core`, `esbuild`, `msw`). Without this, pnpm v10+ blocks them by default for supply-chain security.

### 5. Install Frontend Dependencies

> **Important**: Run `pnpm install` from the **workspace root** (`zerotrace-web/`), NOT from `frontend/`. The lockfile and virtual store live at the root.

```bash
cd zerotrace-web
pnpm install
```

If you see `[ERR_PNPM_IGNORED_BUILDS]` warnings, run `pnpm approve-builds` and re-install:

```bash
pnpm approve-builds   # interactively approve @swc/core, esbuild, msw
pnpm install          # re-run — build scripts execute this time
```

Key dependencies that will be installed:

| Package | Purpose |
|---|---|
| React 19 + React Router 7 | UI framework + routing |
| Ant Design 6 + `@ant-design/icons` | UI component library |
| Tailwind CSS 4 | Utility-first CSS |
| ECharts 6 + Recharts 3 | Charts and data viz |
| `@tanstack/react-query` | Server-state management |
| Zustand 5 | Client-state management |
| i18next | Internationalization |
| MSW 2 | Mock API (dev dependency) |

### 6. Start the Frontend

Two modes are available. Add `--host` to make the dev server accessible from other machines on the network:

**Mock mode** — no backend or database needed, uses MSW to simulate API responses:

```bash
cd zerotrace-web/frontend
pnpm dev:mock --host
# → http://localhost:5173  +  http://<your-ip>:5173
```

Set via `VITE_USE_MOCKS=true` in `frontend/.env.local`:

```
VITE_USE_MOCKS=true
```

**Real backend mode** — connects to the backend at `localhost:3001`:

```bash
cd zerotrace-web/frontend
pnpm dev --host
# → http://localhost:5173  +  http://<your-ip>:5173
```

The Vite dev server proxies `/api/*` and `/agent/*` requests to `http://localhost:3001`.

### 7. Install Rust Toolchain and Build the Backend

```bash
cd zerotrace-web/backend

# Compile in debug mode (fast iteration, ~2-5s rebuild)
cargo build

# Or compile in release mode (optimized, slower build but faster runtime)
cargo build --release
```

Key Rust dependencies (from `Cargo.toml`):

| Crate | Purpose |
|---|---|
| `axum` 0.8 | HTTP framework |
| `tokio` 1 | Async runtime |
| `sqlx` 0.9 (MySQL) | Database driver + migration runner |
| `reqwest` 0.13 | HTTP client (ClickHouse, ZT Server API) |
| `jsonwebtoken` 10 | JWT auth |
| `argon2` 0.5 | Password hashing |
| `serde` / `serde_json` | Serialization |

### 8. Start the Backend

The backend reads its configuration from environment variables, with sensible defaults:

```bash
cd zerotrace-web/backend

# All env vars are optional — defaults are shown below
export DATABASE_URL="mysql://root:deepflow@127.0.0.1:30130/deepflow"
export CLICKHOUSE_URL="http://127.0.0.1:8123"
export ZEROTRACE_SERVER_URL="http://127.0.0.1:30417"
export JWT_SECRET="zerotrace-dev-secret-change-in-production"
export BIND_ADDR="0.0.0.0:3001"

cargo run
# → Zerotrace Web API listening on 0.0.0.0:3001
```

**Environment Variables Reference:**

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `mysql://root:deepflow@127.0.0.1:30130/deepflow` | MySQL connection string |
| `CLICKHOUSE_URL` | `http://127.0.0.1:8123` | ClickHouse HTTP endpoint |
| `ZEROTRACE_SERVER_URL` | `http://127.0.0.1:30417` | ZT Server controller API |
| `ZEROTRACE_METERING_URL` | `http://127.0.0.1:30417` | Usage metering endpoint |
| `JWT_SECRET` | `zerotrace-dev-secret-change-in-production` | JWT signing key |
| `BIND_ADDR` | `0.0.0.0:3001` | API listen address |
| `SESSION_COOKIE_NAME` | `zt_session` | Auth cookie name |
| `STATIC_DIR` | `../frontend/dist` | SPA static files (production) |
| `BINARIES_DIR` | `agent-installer/binaries` | Agent binary downloads |

On startup, the backend:
1. Connects to MySQL and runs embedded migrations (creating tables if they don't exist)
2. Initializes org-scoped ClickHouse databases in a background task
3. Starts the usage collector background task

### 9. Verify the Full Stack

```bash
# 1. Backend health check
curl http://localhost:3001/api/v1/auth/me
# → {"error":"unauthorized"}  (expected — no session cookie)

# 2. Frontend is serving
curl -sI http://localhost:5173 | head -1
# → HTTP/1.1 200 OK

# 3. MySQL is accessible
mysql -h 127.0.0.1 -P 30130 -u root -pdeepflow -e "SHOW DATABASES;"

# 4. ClickHouse is accessible
curl "http://127.0.0.1:8123/?query=SELECT+version()"

# 5. ZT Server is accessible
curl http://127.0.0.1:30417/v1/vtaps/
```

Open `http://localhost:5173` in a browser. Register a new account, then log in.

### 10. Database Initialization Details

The backend embeds three migration files that run automatically on startup (`src/db.rs`):

| Migration | Purpose |
|---|---|
| `001_initial.sql` | Core tables: users, organizations, API keys, agents |
| `002_billing.sql` | Billing tables: plans, subscriptions, invoices |
| `003_billing_enhancements.sql` | Usage alerts and metering enhancements |

Migrations are idempotent — duplicate columns/keys are safely skipped. The `deepflow` database must exist in MySQL (it does by default from the Docker setup).

### 11. Stopping Services

```bash
# Stop backend: Ctrl+C in the cargo run terminal

# Stop frontend: Ctrl+C in the pnpm dev terminal

# Stop databases and server
cd ~/zerotrace-server/manifests
docker compose down           # keep data volumes
docker compose down -v        # also delete data (WARNING: destroys all data)
```

### 12. Quick Start Summary

Once Docker is running with databases:

```bash
# Terminal 1: Databases + ZT Server (infra only)
cd ~/zerotrace-server/manifests && docker compose up -d mysql clickhouse server

# Terminal 2: Backend
cd ~/zerotrace-web/backend && cargo run

# Terminal 3: Frontend (externally accessible)
cd ~/zerotrace-web/frontend && pnpm dev:mock --host
```

Access from any browser: `http://<your-server-ip>:5173`

Or for frontend-only development (no backend needed):

```bash
cd ~/zerotrace-web/frontend && pnpm dev:mock --host
```

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
