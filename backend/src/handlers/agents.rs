use axum::{extract::State, response::IntoResponse, Json};
use serde_json::json;

use crate::{db::DbPool, errors::AppError, middleware::auth::AuthContext};

/// GET /api/v1/agents/status — proxy to DeepFlow controller vtap API.
/// Returns agent list with connection state from the database.
pub async fn agent_status(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
) -> Result<axum::response::Response, AppError> {
    let deepflow_url =
        std::env::var("DEEPFLOW_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:30417".to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))?;

    let url = format!("{}/v1/vtaps/", deepflow_url);
    let resp = client.get(&url).header("Content-Type", "application/json").send().await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let body = r.text().await.unwrap_or_default();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                return Ok(Json(val).into_response());
            }
            Ok(Json(json!({ "agents": [], "error": "unparseable response" })).into_response())
        }
        Ok(r) => Ok(Json(json!({
            "agents": [],
            "error": format!("upstream returned {}", r.status().as_u16())
        })).into_response()),
        Err(e) => Ok(Json(json!({
            "agents": [],
            "info": "zerotrace-server unreachable",
            "detail": e.to_string()
        })).into_response()),
    }
}
