use axum::{Json, extract::State};
use serde::{Deserialize, Serialize};
use crate::{db::DbPool, errors::AppError, middleware::auth::AuthContext};

#[derive(Serialize, sqlx::FromRow)]
struct OrgInfo {
    id: i64,
    name: String,
    slug: String,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
pub struct UpdateOrgInput {
    pub name: Option<String>,
}

/// GET /api/v1/organization — Get current org info
pub async fn get_org(
    State(pool): State<DbPool>,
    auth: AuthContext,
) -> Result<Json<serde_json::Value>, AppError> {
    let org: OrgInfo = sqlx::query_as(
        "SELECT id, name, slug, CAST(created_at AS CHAR) as created_at, CAST(updated_at AS CHAR) as updated_at FROM organizations WHERE id = ?"
    )
    .bind(auth.org_id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::not_found("Organization not found"))?;

    let user_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM web_users WHERE org_id = ?"
    )
    .bind(auth.org_id)
    .fetch_one(&pool)
    .await?;

    let sub_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM subscriptions WHERE org_id = ? AND status = 'active'"
    )
    .bind(auth.org_id)
    .fetch_one(&pool)
    .await?;

    Ok(Json(serde_json::json!({
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "created_at": org.created_at,
            "updated_at": org.updated_at,
        },
        "stats": {
            "users": user_count.0,
            "active_subscriptions": sub_count.0,
        },
        "current_user_role": auth.user_role,
    })))
}

/// PUT /api/v1/organization — Update org name (admin only)
pub async fn update_org(
    State(pool): State<DbPool>,
    auth: AuthContext,
    Json(input): Json<UpdateOrgInput>,
) -> Result<Json<serde_json::Value>, AppError> {
    if auth.user_role != "admin" && auth.user_role != "super_admin" {
        return Err(AppError::forbidden("Only admins can update organization settings"));
    }

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err(AppError::bad_request("Organization name cannot be empty"));
        }
        sqlx::query("UPDATE organizations SET name = ? WHERE id = ?")
            .bind(name.trim())
            .bind(auth.org_id)
            .execute(&pool)
            .await?;
    }

    Ok(Json(serde_json::json!({ "ok": true, "message": "Organization updated" })))
}
