use crate::{db::DbPool, errors::AppError, middleware::auth::AuthContext};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, sqlx::FromRow)]
pub struct OrgUser {
    pub id: i64,
    pub email: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct UpdateUserInput {
    pub role: Option<String>,
    pub status: Option<String>,
}

/// GET /api/v1/users — List users in the current organization
pub async fn list_users(
    State(pool): State<DbPool>,
    auth: AuthContext,
) -> Result<Json<serde_json::Value>, AppError> {
    let users: Vec<OrgUser> = sqlx::query_as(
        "SELECT id, email, name, role, status, CAST(created_at AS CHAR) as created_at FROM web_users WHERE org_id = ? ORDER BY id"
    )
    .bind(auth.org_id)
    .fetch_all(&pool)
    .await?;

    let stats = serde_json::json!({
        "total": users.len(),
        "active": users.iter().filter(|u| u.status == "active").count(),
        "admins": users.iter().filter(|u| u.role == "admin").count(),
        "pending": users.iter().filter(|u| u.status == "pending").count(),
    });

    Ok(Json(serde_json::json!({
        "users": users,
        "stats": stats,
        "current_user_role": auth.user_role,
    })))
}

/// PUT /api/v1/users/:id — Update a user's role or status (admin only, same org)
pub async fn update_user(
    State(pool): State<DbPool>,
    auth: AuthContext,
    Path(user_id): Path<i64>,
    Json(input): Json<UpdateUserInput>,
) -> Result<Json<serde_json::Value>, AppError> {
    // super_admin can manage any user; org admin can only manage their own org
    let is_super = auth.user_role == "super_admin";
    if !is_super && auth.user_role != "admin" {
        return Err(AppError::forbidden("only admins can manage users"));
    }

    // Verify the user exists
    let target: (i64, String, String) =
        sqlx::query_as("SELECT org_id, role, email FROM web_users WHERE id = ?")
            .bind(user_id)
            .fetch_optional(&pool)
            .await?
            .ok_or_else(|| AppError::not_found("user not found"))?;

    // Org admin can only manage users in their own org; super_admin can manage anyone
    if !is_super && target.0 != auth.org_id {
        return Err(AppError::forbidden(
            "cannot manage users in other organizations",
        ));
    }

    // Don't allow demoting the last admin in an org (unless super_admin)
    if !is_super && target.1 == "admin" && input.role.as_deref() == Some("member") {
        let admin_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM web_users WHERE org_id = ? AND role = 'admin'")
                .bind(auth.org_id)
                .fetch_one(&pool)
                .await?;
        if admin_count.0 <= 1 {
            return Err(AppError::bad_request(
                "cannot remove the last admin of an organization",
            ));
        }
    }

    // Apply updates
    if let Some(ref role) = input.role {
        if role != "admin" && role != "member" {
            return Err(AppError::bad_request("role must be 'admin' or 'member'"));
        }
        sqlx::query("UPDATE web_users SET role = ? WHERE id = ?")
            .bind(role)
            .bind(user_id)
            .execute(&pool)
            .await?;
    }

    if let Some(ref status) = input.status {
        if status != "active" && status != "disabled" {
            return Err(AppError::bad_request(
                "status must be 'active' or 'disabled'",
            ));
        }
        sqlx::query("UPDATE web_users SET status = ? WHERE id = ?")
            .bind(status)
            .bind(user_id)
            .execute(&pool)
            .await?;
    }

    Ok(Json(
        serde_json::json!({ "ok": true, "message": "user updated" }),
    ))
}
