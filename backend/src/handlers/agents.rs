use crate::{db::DbPool, errors::AppError, middleware::auth::AuthContext};
use axum::{Json, extract::State, response::IntoResponse};
use serde_json::json;

/// GET /api/v1/agents/status — proxy to DeepFlow controller vtap API.
/// Sends X-Org-Id so the server scopes agents to the user's organization.
/// Requires agent registration via HTTP (POST /api/v1/agent/register) with
/// API key for correct org assignment; gRPC-registered agents default to org 1.
pub async fn agent_status(
    State(_pool): State<DbPool>,
    auth: AuthContext,
) -> Result<axum::response::Response, AppError> {
    let zerotrace_api_url = std::env::var("ZEROTRACE_SERVER_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:30417".to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))?;

    let url = format!("{}/v1/vtaps/", zerotrace_api_url);
    let resp = client
        .get(&url)
        .header("Content-Type", "application/json")
        .header("X-Org-Id", auth.org_id.to_string())
        .send()
        .await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let body = r.text().await.unwrap_or_default();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&body) {
                return Ok(Json(val).into_response());
            }
            Ok(Json(json!({ "agents": [], "error": "unparseable response" })).into_response())
        },
        Ok(r) => Ok(Json(json!({
            "agents": [],
            "error": format!("upstream returned {}", r.status().as_u16())
        }))
        .into_response()),
        Err(e) => Ok(Json(json!({
            "agents": [],
            "info": "zerotrace-server unreachable",
            "detail": e.to_string()
        }))
        .into_response()),
    }
}
