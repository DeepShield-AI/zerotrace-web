use axum::{extract::State, response::IntoResponse, Json};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use serde_json::json;

use crate::{
    db::DbPool,
    errors::AppError,
    models::{
        organization::Organization,
        session::Session,
        user::{LoginInput, RegisterInput, User, UserResponse},
    },
};

fn build_session_cookie(session_id: &str) -> Cookie<'static> {
    Cookie::build(("zt_session", session_id.to_string()))
        .path("/")
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build()
}

/// POST /api/v1/auth/register
pub async fn register_handler(
    State(pool): State<DbPool>,
    Json(input): Json<RegisterInput>,
) -> Result<axum::response::Response, AppError> {
    // Validate
    if input.email.is_empty() || input.password.is_empty() || input.org_name.is_empty() {
        return Err(AppError::bad_request("email, password, org_name are required"));
    }
    if input.password.len() < 8 {
        return Err(AppError::bad_request("password must be at least 8 characters"));
    }

    // Check if email already exists
    if (User::find_by_email(&pool, &input.email).await?).is_some() {
        return Err(AppError::conflict("a user with this email already exists"));
    }

    let slug = input
        .org_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>();

    // Use transaction
    let mut tx = pool.begin().await?;

    // Check org slug uniqueness
    let existing_org: Option<(i64,)> = sqlx::query_as("SELECT id FROM organizations WHERE slug = ?")
        .bind(&slug)
        .fetch_optional(&mut *tx)
        .await?;
    if existing_org.is_some() {
        return Err(AppError::conflict("an organization with this name already exists"));
    }

    // Create org
    sqlx::query("INSERT INTO organizations (name, slug) VALUES (?, ?)")
        .bind(&input.org_name).bind(&slug).execute(&mut *tx).await?;
    let org = sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE slug = ?")
        .bind(&slug).fetch_one(&mut *tx).await?;

    // Hash password
    let password_hash = User::hash_password(&input.password)
        .map_err(|e| AppError::internal(format!("password hashing failed: {}", e)))?;

    // Create user
    sqlx::query("INSERT INTO web_users (org_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'admin')")
        .bind(org.id).bind(&input.email).bind(&password_hash).bind(&input.name)
        .execute(&mut *tx).await?;
    let user = sqlx::query_as::<_, User>("SELECT * FROM web_users WHERE email = ?")
        .bind(&input.email).fetch_one(&mut *tx).await?;

    // Create session
    let session_id = uuid::Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(7))
        .unwrap();
    sqlx::query("INSERT INTO sessions (id, user_id, org_id, data, expires_at) VALUES (?, ?, ?, '{}', ?)")
        .bind(&session_id)
        .bind(user.id)
        .bind(org.id)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    let user_response: UserResponse = user.into();
    let cookie = build_session_cookie(&session_id);

    let mut response = Json(json!({
        "user": user_response,
        "org": { "id": org.id, "name": org.name, "slug": org.slug }
    }))
    .into_response();

    response
        .headers_mut()
        .insert("Set-Cookie", cookie.encoded().to_string().parse().unwrap());

    Ok(response)
}

/// POST /api/v1/auth/login
pub async fn login(
    State(pool): State<DbPool>,
    Json(input): Json<LoginInput>,
) -> Result<axum::response::Response, AppError> {
    if input.email.is_empty() || input.password.is_empty() {
        return Err(AppError::bad_request("email and password are required"));
    }

    let user = User::find_by_email(&pool, &input.email)
        .await?
        .ok_or_else(|| AppError::unauthorized("invalid email or password"))?;

    let valid = User::verify_password(&input.password, &user.password_hash)
        .map_err(|e| AppError::internal(format!("password verification failed: {}", e)))?;

    if !valid {
        return Err(AppError::unauthorized("invalid email or password"));
    }

    let session = Session::create(&pool, user.id, user.org_id).await?;
    let user_response: UserResponse = user.into();
    let cookie = build_session_cookie(&session.id);

    let mut response = Json(json!({ "user": user_response })).into_response();
    response
        .headers_mut()
        .insert("Set-Cookie", cookie.encoded().to_string().parse().unwrap());

    Ok(response)
}

/// POST /api/v1/auth/logout
pub async fn logout(
    cookie_jar: CookieJar,
    State(pool): State<DbPool>,
) -> Result<axum::response::Response, AppError> {
    if let Some(session_cookie) = cookie_jar.get("zt_session") {
        Session::delete(&pool, session_cookie.value()).await?;
    }

    let cookie = Cookie::build(("zt_session", ""))
        .path("/")
        .http_only(true)
        .max_age(time::Duration::seconds(0))
        .build();

    let mut response = Json(json!({ "ok": true })).into_response();
    response
        .headers_mut()
        .insert("Set-Cookie", cookie.encoded().to_string().parse().unwrap());

    Ok(response)
}

/// GET /api/v1/auth/me
pub async fn me(
    cookie_jar: CookieJar,
    State(pool): State<DbPool>,
) -> Result<axum::response::Response, AppError> {
    let session_id = cookie_jar
        .get("zt_session")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::unauthorized("not authenticated"))?;

    let session = Session::find_valid(&pool, &session_id)
        .await?
        .ok_or_else(|| AppError::unauthorized("session expired"))?;

    let user = User::find_by_id(&pool, session.user_id)
        .await?
        .ok_or_else(|| AppError::unauthorized("user not found"))?;

    let user_response: UserResponse = user.into();
    Ok(Json(json!({ "user": user_response })).into_response())
}
