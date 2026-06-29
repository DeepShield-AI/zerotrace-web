use axum::{
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;
use std::path::PathBuf;
use tokio::fs;

#[derive(Serialize)]
pub struct ServerInfo {
    controller_ip: String,
    web_port: u16,
}

const INSTALL_SCRIPT: &str = "install.sh";

/// Resolve scripts directory at runtime via env var, falling back to
/// the compile-time CARGO_MANIFEST_DIR for local development, and
/// finally /app/agent-installer/scripts for Docker deployments.
fn scripts_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("SCRIPTS_DIR") {
        return PathBuf::from(dir);
    }
    // Try compile-time path first (local dev)
    let dev_path = PathBuf::from(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/agent-installer/scripts"
    ));
    if dev_path.exists() {
        return dev_path;
    }
    // Docker runtime path
    PathBuf::from("/app/agent-installer/scripts")
}

/// GET /agent/install.sh
///
/// Reads the install script from disk, prepends dynamically-resolved
/// `SERVER_URL` and `ZEROTRACE_CONTROLLER_IP` so the script points to
/// the correct endpoints, and returns it as `text/x-shellscript`.
pub async fn serve_install_script(headers: HeaderMap) -> Result<Response, InstallerError> {
    let script_path = scripts_dir().join(INSTALL_SCRIPT);

    let content = fs::read_to_string(&script_path).await.map_err(|e| {
        tracing::error!("Failed to read install script {:?}: {}", script_path, e);
        InstallerError::NotFound
    })?;

    // SERVER_URL → where to download the agent binary (always this web server).
    let host = headers.get(header::HOST).and_then(|v| v.to_str().ok()).unwrap_or("localhost");

    // ZEROTRACE_CONTROLLER_IP → where the agent connects (the server machine).
    // Use CONTROLLER_IP env var if set on deploy, otherwise fall back to Host header IP.
    let controller_ip = std::env::var("CONTROLLER_IP")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| host.split(':').next().unwrap_or("localhost").to_string());

    // When accessed via proxy/port-forward (Host is localhost), build the
    // correct download URL using CONTROLLER_IP if available.
    let host_only = host.split(':').next().unwrap_or("localhost");
    let server_url =
        if host_only == "localhost" && !controller_ip.is_empty() && controller_ip != "localhost" {
            format!(
                "http://{}:{}",
                controller_ip,
                host.split(':').nth(1).unwrap_or("5173")
            )
        } else {
            format!("http://{}", host)
        };

    // Prepend env overrides so install.sh picks up the dynamic values.
    let script = format!(
        "SERVER_URL=${{SERVER_URL:-\"{}\"}}\nZEROTRACE_CONTROLLER_IP=${{ZEROTRACE_CONTROLLER_IP:-\"{}\"}}\n{}",
        server_url, controller_ip, content
    );

    tracing::info!(
        "Served install.sh (server_url={}, controller_ip={})",
        server_url,
        controller_ip
    );

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/x-shellscript")
        .body(axum::body::Body::from(script))
        .unwrap())
}

/// GET /api/v1/server-info → public endpoint returning the real controller IP
/// and web port. Used by the frontend to show correct install commands even
/// when accessed via VSCode port forwarding (where window.location = localhost).
pub async fn server_info() -> Json<ServerInfo> {
    let controller_ip = std::env::var("CONTROLLER_IP")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "127.0.0.1".to_string());
    let web_port: u16 = std::env::var("WEB_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(5173);
    Json(ServerInfo {
        controller_ip,
        web_port,
    })
}

#[derive(Debug)]
pub enum InstallerError {
    NotFound,
}

impl IntoResponse for InstallerError {
    fn into_response(self) -> Response {
        match self {
            InstallerError::NotFound =>
                (StatusCode::NOT_FOUND, "Install script not found").into_response(),
        }
    }
}
