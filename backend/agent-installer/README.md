# Zerotrace Agent Installer

One-line agent installation — Datadog-style. Pass your API key, pipe to bash, done.

## One-Liner

```bash
ZEROTRACE_API_KEY="zt_your_key_here" curl -fsSL http://<host>:5173/agent/install.sh | bash
```

What it does:
1. Detects OS / architecture automatically
2. Downloads the correct agent binary
3. Writes the config and API key (secured, 0600)
4. Installs a systemd service (`zerotrace-agent`)
5. Starts the agent immediately

After 30–60 seconds the agent appears in **Agent Management → Verify & Continue**.

## With Tags

```bash
ZT_TAGS="env:prod team:backend" ZEROTRACE_API_KEY="zt_xxx" curl -fsSL http://<host>:5173/agent/install.sh | bash
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZEROTRACE_API_KEY` | — | API key for agent authentication |
| `ZEROTRACE_CONTROLLER_IP` | `202.112.237.37` | Controller IP |
| `ZEROTRACE_CONTROLLER_PORT` | `30035` | Controller gRPC port |
| `ZT_TAGS` | — | Agent tags (e.g. `env:prod team:backend`) |
| `ZEROTRACE_INSTALL_SYSTEMD` | `true` | Set to `false` to skip systemd |

## Managing the Agent

```bash
sudo systemctl status zerotrace-agent   # check status
sudo systemctl restart zerotrace-agent  # restart
sudo journalctl -u zerotrace-agent -f   # follow logs
```

## Supported Platforms

| OS | Arch | systemd |
|----|------|---------|
| Linux | amd64, arm64 | yes |
| macOS | amd64, arm64 | no (brew service) |
