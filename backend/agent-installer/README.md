# Zerotrace Agent Installer

One-click agent installation service embedded in Zerotrace Web.

## Usage

```bash
curl -fsSL http://<web-ip>:5173/agent/install.sh | bash
```

The install script auto-detects OS/architecture and downloads the correct binary from the Web server. Generated configuration points the Agent to the Zerotrace Server's controller and ingester endpoints.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZEROTRACE_CONTROLLER_IP` | Dynamic (from Host header) | Server IP |
| `ZEROTRACE_CONTROLLER_PORT` | `30035` | Server gRPC port |
| `ZT_TAGS` | — | Custom agent tags (e.g. `env:prod team:backend`) |

## Supported Platforms

| OS | Arch |
|----|------|
| Linux | amd64, arm64 |
| Darwin | amd64, arm64 (dev only) |

## Full Agent Documentation

See [github.com/DeepShield-AI/zerotrace-agent](https://github.com/DeepShield-AI/zerotrace-agent) for agent architecture, eBPF probe details, and configuration reference.
