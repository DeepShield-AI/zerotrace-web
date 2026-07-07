# What is Zerotrace Web

**Zerotrace Web** is the observability frontend and API gateway for the Zerotrace platform. It provides a unified web interface for visualizing distributed traces, service topologies, application performance metrics, and network flow data — all collected non-intrusively by Zerotrace Agents via eBPF. Built with a Rust backend and React frontend, it serves as the central control plane for Agent lifecycle management, API key provisioning, and anomaly detection via the built-in Guardian engine.

# Key Features

### 1. Unified Observability Dashboard
Aggregates data from ClickHouse and the Zerotrace Server into a single interface. Exposes service maps, trace views, L4/L7 flow statistics, and time-series metrics through a consistent REST API. The frontend uses ECharts for high-performance rendering of large time-series datasets and Ant Design for a consistent, accessible UI.

### 2. Zero-Instrumentation APM
Visualizes application services, operations, traces, and dependencies automatically — no SDK integration needed. Supports multi-dimensional filtering by service name, operation, trace ID, status, and latency range.

### 3. Built-in Agent Installer
Embeds an agent installation service that dynamically generates install scripts. A single curl command downloads, configures, and starts the Zerotrace Agent on any Linux host. The installer auto-detects OS and architecture, and supports custom tags for data segmentation.

### 4. Guardian Anomaly Detection
Performs statistical baseline analysis on service latency and error rates, identifying anomalous behavior without predefined thresholds. Results are persisted as stories with severity scoring, affected services, and temporal context.

### 5. Multi-Tenant Foundation
Supports organization-scoped API keys and session management. All authenticated endpoints carry organization context, providing the foundation for tag-based data access control.

# Documentation

See [docs/deployment.md](docs/user/deployment.md) for deployment instructions.

# Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Rust / Axum / SQLx |
| Frontend | React / TypeScript / Vite / Ant Design / ECharts |
| Database | MySQL (metadata), ClickHouse (telemetry) |
