use crate::{
    db::DbPool,
    errors::AppError,
    middleware::auth::AuthContext,
    models::api_key::{ApiKey, ApiKeyRow},
};
use axum::{Json, extract::State, response::IntoResponse};
use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyInput {
    pub name: String,
    #[serde(default = "default_scopes")]
    pub scopes: Vec<String>,
}

fn default_scopes() -> Vec<String> {
    vec!["*".to_string()]
}

/// POST /api/v1/api-keys — create a new key
pub async fn create_api_key(
    State(pool): State<DbPool>,
    auth: AuthContext,
    Json(input): Json<CreateApiKeyInput>,
) -> Result<axum::response::Response, AppError> {
    let scopes = serde_json::to_string(&input.scopes)
        .map_err(|e| AppError::bad_request(format!("invalid scopes: {}", e)))?;

    let (created, _full_key) =
        ApiKey::create(&pool, auth.org_id, auth.user_id, &input.name, &scopes).await?;

    Ok(Json(json!({
        "api_key": {
            "id": created.id,
            "name": created.name,
            "key": created.key,              // full key — shown here AND storable for later reveal
            "key_prefix": created.key_prefix,
            "scopes": created.scopes,
            "created_at": created.created_at,
        },
        "warning": "Store this key securely. You can also copy it later from the key list."
    }))
    .into_response())
}

/// GET /api/v1/api-keys — list keys (no full key returned)
pub async fn list_api_keys(
    State(pool): State<DbPool>,
    auth: AuthContext,
) -> Result<axum::response::Response, AppError> {
    let keys = ApiKey::list_by_org(&pool, auth.org_id).await?;
    let rows: Vec<ApiKeyRow> = keys.into_iter().map(|k| k.into()).collect();
    Ok(Json(json!({ "api_keys": rows })).into_response())
}

/// POST /api/v1/api-keys/:id/reveal — decrypt and return the full key (like Datadog "Copy" button)
pub async fn reveal_api_key(
    State(pool): State<DbPool>,
    auth: AuthContext,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<axum::response::Response, AppError> {
    let key = ApiKey::find_by_id(&pool, id, auth.org_id)
        .await?
        .ok_or_else(|| AppError::not_found("api key not found or already revoked"))?;

    let raw = key.reveal().map_err(|e| AppError::internal(e))?;

    Ok(Json(json!({ "key": raw })).into_response())
}

/// DELETE /api/v1/api-keys/:id — revoke a key
pub async fn revoke_api_key(
    State(pool): State<DbPool>,
    auth: AuthContext,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<axum::response::Response, AppError> {
    let revoked = ApiKey::revoke(&pool, id, auth.org_id).await?;
    if !revoked {
        return Err(AppError::not_found("api key not found or already revoked"));
    }
    Ok(Json(json!({ "ok": true })).into_response())
}
