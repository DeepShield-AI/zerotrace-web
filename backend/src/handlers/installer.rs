use axum::{
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use std::path::PathBuf;
use tokio::fs;

const INSTALL_SCRIPT: &str = "install.sh";

/// Resolve scripts directory at runtime via env var, falling back to
/// the compile-time CARGO_MANIFEST_DIR for local development.
fn scripts_dir() -> PathBuf {
    std::env::var("SCRIPTS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/agent-installer/scripts"
            ))
        })
}

/// GET /agent/install.sh
///
/// Reads the install script from disk, prepends dynamically-resolved
/// `SERVER_URL` and `ZEROTRACE_CONTROLLER_IP` so the script points to
/// the correct endpoints, and returns it as `text/x-shellscript`.
pub async fn serve_install_script(
    headers: HeaderMap,
) -> Result<Response, InstallerError> {
    let script_path = scripts_dir().join(INSTALL_SCRIPT);

    let content = fs::read_to_string(&script_path).await.map_err(|e| {
        tracing::error!("Failed to read install script {:?}: {}", script_path, e);
        InstallerError::NotFound
    })?;

    // SERVER_URL → where to download the agent binary (always this web server).
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("localhost");
    let server_url = format!("http://{}", host);

    // ZEROTRACE_CONTROLLER_IP → where the agent connects (the server machine).
    // Use CONTROLLER_IP env var if set, otherwise fall back to the Host header IP.
    let controller_ip = std::env::var("CONTROLLER_IP")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| {
            host.split(':').next().unwrap_or("localhost").to_string()
        });

    // Prepend env overrides so install.sh picks up the dynamic values.
    let script = format!(
        "SERVER_URL=${{SERVER_URL:-\"{}\"}}\nZEROTRACE_CONTROLLER_IP=${{ZEROTRACE_CONTROLLER_IP:-\"{}\"}}\n{}",
        server_url, controller_ip, content
    );

    tracing::info!("Served install.sh (server_url={}, controller_ip={})", server_url, controller_ip);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/x-shellscript")
        .body(axum::body::Body::from(script))
        .unwrap())
}

#[derive(Debug)]
pub enum InstallerError {
    NotFound,
}

impl IntoResponse for InstallerError {
    fn into_response(self) -> Response {
        match self {
            InstallerError::NotFound => {
                (StatusCode::NOT_FOUND, "Install script not found").into_response()
            }
        }
    }
}
