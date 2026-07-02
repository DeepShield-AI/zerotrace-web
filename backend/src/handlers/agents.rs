use crate::{db::DbPool, errors::AppError, middleware::auth::AuthContext};
use axum::{Json, extract::State, response::IntoResponse};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize)]
pub struct AgentRegisterRequest {
    ctrl_ip: String,
    ctrl_mac: String,
    hostname: String,
}

/// POST /api/v1/agents/register — register an agent for an org via API key.
/// Inserts a vtap record into the org's DeepFlow MySQL database so the
/// zerotrace-server can associate this agent with the correct org.
/// Called by the install script before starting the agent.
pub async fn agent_register(
    State(pool): State<DbPool>,
    headers: axum::http::HeaderMap,
    Json(body): Json<AgentRegisterRequest>,
) -> Result<axum::response::Response, AppError> {
    // Extract API key from X-API-Key header
    let api_key = headers
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::unauthorized("missing X-API-Key header"))?;

    // Look up org_id from API key
    let key_hash = crate::models::api_key::ApiKey::hash_key(api_key);
    let api_key_row = crate::models::api_key::ApiKey::find_by_hash(&pool, &key_hash)
        .await?
        .ok_or_else(|| AppError::unauthorized("invalid API key"))?;

    let org_id = api_key_row.org_id;
    if org_id <= 1 {
        return Ok(Json(json!({"ok": false, "error": "invalid org_id"})).into_response());
    }

    // Upsert vtap by unique key (ctrl_ip, ctrl_mac).
    // One machine = one agent = one vtap = one org (Datadog model).
    // Reinstalling with a different API key updates the vtap's org_id.
    let vtap_name = format!("auto-{}-{}", body.ctrl_ip, body.hostname);
    let result = sqlx::query(
        "INSERT INTO vtap (name, type, ctrl_ip, ctrl_mac, org_id, enable, state, \
         launch_server, launch_server_id, controller_ip, cur_controller_ip, \
         analyzer_ip, cur_analyzer_ip) \
         VALUES (?, 3, ?, ?, ?, 1, 1, ?, (SELECT id FROM controller WHERE ip=? LIMIT 1), ?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE org_id=VALUES(org_id), name=VALUES(name), enable=1, state=1"
    )
    .bind(&vtap_name)
    .bind(&body.ctrl_ip)
    .bind(&body.ctrl_mac)
    .bind(org_id)
    .bind(&body.ctrl_ip)
    .bind(&body.ctrl_ip)
    .bind(&body.ctrl_ip)
    .bind(&body.ctrl_ip)
    .bind(&body.ctrl_ip)
    .bind(&body.ctrl_ip)
    .execute(&pool)
    .await;

    match result {
        Ok(_) => {
            tracing::info!(org_id, ctrl_ip=%body.ctrl_ip, "Agent registered in org database");
            Ok(Json(json!({"ok": true, "org_id": org_id})).into_response())
        },
        Err(e) => {
            tracing::warn!(org_id, error=%e, "Agent vtap insert failed");
            Ok(
                Json(json!({"ok": false, "error": format!("vtap insert failed: {}", e)}))
                    .into_response(),
            )
        },
    }
}

/// GET /api/v1/agents/status — proxy to DeepFlow controller vtap API.
/// Fetches ALL vtaps, then filters by org_id in Rust. This avoids the
/// zerotrace-server's database-level org scoping which may not have the
/// vtap record in the org-specific database yet.
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
    let resp = client.get(&url).header("Content-Type", "application/json").send().await;

    match resp {
        Ok(r) if r.status().is_success() => {
            let body = r.text().await.unwrap_or_default();
            if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(&body) {
                // Filter by org_id — only return agents belonging to this org.
                // The zerotrace-server returns ORG_ID in the JSON (gorm column:org_id).
                if let Some(data) = val.get_mut("DATA").and_then(|d| d.as_array_mut()) {
                    data.retain(|vtap| {
                        vtap.get("ORG_ID").and_then(|v| v.as_i64()).unwrap_or(1) == auth.org_id
                    });
                }
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
