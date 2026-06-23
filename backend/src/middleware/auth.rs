use axum::{
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::CookieJar;

use crate::{
    db::DbPool,
    errors::AppError,
    models::session::Session,
};

/// Context injected into request extensions after auth
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: i64,
    pub org_id: i64,
    pub user_role: String,
}

/// Implement FromRequestParts so handlers can extract AuthContext directly.
/// The middleware must have already inserted it into request extensions.
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
            request.extensions_mut().insert(AuthContext {
                user_id: session.user_id,
                org_id: session.org_id,
                user_role: "member".to_string(),
            });
            return Ok(next.run(request).await);
        }
    }

    // Try Authorization: Bearer <token>
    if let Some(auth_header) = request
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
    {
        if let Some(token) = auth_header.strip_prefix("Bearer ") {
            // Try as session ID
            if let Some(session) = Session::find_valid(&pool, token).await? {
                request.extensions_mut().insert(AuthContext {
                    user_id: session.user_id,
                    org_id: session.org_id,
                    user_role: "member".to_string(),
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
