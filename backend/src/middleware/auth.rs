use crate::{db::DbPool, errors::AppError, models::session::Session};
use axum::{middleware::Next, response::Response};
use axum_extra::extract::cookie::CookieJar;

/// Context injected into request extensions after auth.
///
/// Data isolation: each org sees only data tagged with `team_id = org_id` in ClickHouse.
/// This maps the DeepFlow `team_id` column to our `org_id` concept — one team per org.
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: i64,
    pub org_id: i64,
    pub user_role: String,
}

/// Implement FromRequestParts so handlers can extract AuthContext directly.
impl<S: Send + Sync + 'static> axum::extract::FromRequestParts<S> for AuthContext {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthContext>()
            .cloned()
            .ok_or_else(|| AppError::unauthorized("authentication required"))
    }
}

/// Middleware: require a valid session cookie or API key in Authorization header.
/// Sets AuthContext in request extensions on success.
pub async fn require_auth(
    cookie_jar: CookieJar,
    axum::extract::State(pool): axum::extract::State<DbPool>,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, AppError> {
    // Try session cookie first
    if let Some(session_cookie) = cookie_jar.get("zt_session") {
        if let Some(session) = Session::find_valid(&pool, session_cookie.value()).await? {
            let user_role = load_user_role(&pool, session.user_id).await.unwrap_or_else(|_| "member".into());
            request.extensions_mut().insert(AuthContext {
                user_id: session.user_id,
                org_id: session.org_id,
                user_role,
            });
            return Ok(next.run(request).await);
        }
    }

    // Try Authorization: Bearer <token>
    if let Some(auth_header) = request.headers().get("Authorization").and_then(|v| v.to_str().ok())
    {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            // Try as session ID
            if let Some(session) = Session::find_valid(&pool, token).await? {
                let user_role = load_user_role(&pool, session.user_id).await.unwrap_or_else(|_| "member".into());
                request.extensions_mut().insert(AuthContext {
                    user_id: session.user_id,
                    org_id: session.org_id,
                    user_role,
                });
                return Ok(next.run(request).await);
            }

            // Try as API key
            let key_hash = crate::models::api_key::ApiKey::hash_key(token);
            if let Some(api_key) =
                crate::models::api_key::ApiKey::find_by_hash(&pool, &key_hash).await?
            {
                let _ = crate::models::api_key::ApiKey::touch(&pool, api_key.id).await;
                request.extensions_mut().insert(AuthContext {
                    user_id: api_key.user_id,
                    org_id: api_key.org_id,
                    user_role: "member".to_string(),
                });
                return Ok(next.run(request).await);
            }
        }
    }

    Err(AppError::unauthorized("invalid or expired authentication"))
}

/// Look up the user's actual role from the web_users table.
async fn load_user_role(pool: &sqlx::MySqlPool, user_id: i64) -> Result<String, sqlx::Error> {
    let row: (String,) = sqlx::query_as("SELECT role FROM web_users WHERE id = ?")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

/// Middleware: enforce that the org has at least one active subscription.
pub async fn require_subscription(
    axum::extract::State(pool): axum::extract::State<DbPool>,
    request: axum::extract::Request,
    next: Next,
) -> Result<Response, AppError> {
    let path = request.uri().path().to_string();
    if path.starts_with("/api/v1/billing") || path.starts_with("/api/v1/auth")
        || path.starts_with("/api/v1/api-keys") || path.starts_with("/api/v1/users")
        || path.starts_with("/api/v1/organization")
        || path.starts_with("/agent/") {
        return Ok(next.run(request).await);
    }

    let auth = match request.extensions().get::<AuthContext>() {
        Some(a) => a.clone(),
        None => return Err(AppError::unauthorized("authentication required")),
    };

    if auth.user_role == "super_admin" {
        return Ok(next.run(request).await);
    }

    let org_slug: Option<(String,)> = sqlx::query_as(
        "SELECT slug FROM organizations WHERE id = ?"
    )
    .bind(auth.org_id)
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);

    if let Some((slug,)) = org_slug {
        if slug == "zerotrace" {
            return Ok(next.run(request).await);
        }
    }

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM subscriptions WHERE org_id = ? AND status = 'active'"
    )
    .bind(auth.org_id)
    .fetch_one(&pool)
    .await
    .unwrap_or((0,));

    if count.0 == 0 {
        return Err(AppError::payment_required(
            "No active subscription. Please subscribe to a plan at /org/billing/plan to access this service.",
        ));
    }

    Ok(next.run(request).await)
}
