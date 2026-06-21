use axum::{
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use std::path::PathBuf;
use tokio::fs;

/// Absolute paths resolved at compile time relative to the backend crate root.
const SCRIPTS_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/agent-installer/scripts");
const INSTALL_SCRIPT: &str = "install.sh";

/// GET /agent/install.sh
///
/// Reads the install script from disk, prepends a dynamically-resolved
/// `SERVER_URL` so the script knows where to download binaries from,
/// and returns it as `text/x-shellscript`.
pub async fn serve_install_script(
    headers: HeaderMap,
) -> Result<Response, InstallerError> {
    let script_path = PathBuf::from(SCRIPTS_DIR).join(INSTALL_SCRIPT);

    let content = fs::read_to_string(&script_path).await.map_err(|e| {
        tracing::error!("Failed to read install script {:?}: {}", script_path, e);
        InstallerError::NotFound
    })?;

    // Build the server URL from the Host header so the script
    // automatically downloads binaries from the same server.
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("localhost");
    let scheme = "http";
    let server_url = format!("{}://{}", scheme, host);

    // Prepend SERVER_URL override so the script uses us as binary repo.
    let script = format!(
        "SERVER_URL=${{SERVER_URL:-\"{}\"}}\n{}",
        server_url, content
    );

    tracing::info!("Served install.sh (server_url={})", server_url);

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
