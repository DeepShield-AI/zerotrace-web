use crate::{
    db::DbPool,
    errors::AppError,
    models::{
        organization::Organization,
        session::Session,
        user::{LoginInput, RegisterInput, User, UserResponse},
    },
    zerotrace,
};
use axum::{Json, extract::State, response::IntoResponse};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use serde_json::json;

fn build_session_cookie(session_id: &str) -> Cookie<'static> {
    Cookie::build(("zt_session", session_id.to_string()))
        .path("/")
        .http_only(true)
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .max_age(time::Duration::days(7))
        .build()
}

/// POST /api/v1/auth/register
///
/// Creates a new organization AND the admin user in a single flow:
/// 1. Allocates an org ID from DeepFlow and creates the org-scoped MySQL database
///    (so agents can immediately register and data has a home).
/// 2. Falls back to auto-increment ID if DeepFlow is unreachable (with a warning).
/// 3. Creates the organizations record, admin user, and session in a transaction.
pub async fn register_handler(
    State(pool): State<DbPool>,
    Json(input): Json<RegisterInput>,
) -> Result<axum::response::Response, AppError> {
    // Validate
    if input.email.is_empty() || input.password.is_empty() || input.org_name.is_empty() {
        return Err(AppError::bad_request(
            "email, password, org_name are required",
        ));
    }
    if input.password.len() < 8 {
        return Err(AppError::bad_request(
            "password must be at least 8 characters",
        ));
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

    // Check org slug uniqueness
    let existing_org: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM organizations WHERE slug = ?")
            .bind(&slug)
            .fetch_optional(&pool)
            .await?;
    if existing_org.is_some() {
        return Err(AppError::conflict(
            "an organization with this name already exists",
        ));
    }

    // ── Provision org in DeepFlow ──
    // This allocates a consistent org_id AND creates the org-scoped MySQL database
    // so agents can immediately register and the ClickHouse ingester has a home.
    let (org_id, zerotrace_provisioned) =
        match zerotrace::provision_org(&pool, &input.org_name).await {
            Ok(id) => {
                tracing::info!(org_id = id, org_name = %input.org_name, "DeepFlow org provisioned");
                (id, true)
            },
            Err(e) => {
                // DeepFlow may be unreachable in dev / single-node setups.
                // Fall back to auto-increment — the org can be manually set up later.
                let err_msg = format!("{:?}", e);
                tracing::warn!(
                    error = %err_msg,
                    org_name = %input.org_name,
                    "DeepFlow provisioning failed; falling back to auto-increment org_id. \
                     The org will need manual DB setup before agents can connect."
                );
                (0_i64, false)
            },
        };

    // ── Create local records in a transaction ──
    let mut tx = pool.begin().await?;

    // Create org — use the DeepFlow-allocated ID if available, else auto-increment
    let org = if zerotrace_provisioned {
        sqlx::query("INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)")
            .bind(org_id)
            .bind(&input.org_name)
            .bind(&slug)
            .execute(&mut *tx)
            .await?;
        sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE id = ?")
            .bind(org_id)
            .fetch_one(&mut *tx)
            .await?
    } else {
        sqlx::query("INSERT INTO organizations (name, slug) VALUES (?, ?)")
            .bind(&input.org_name)
            .bind(&slug)
            .execute(&mut *tx)
            .await?;
        sqlx::query_as::<_, Organization>("SELECT * FROM organizations WHERE slug = ?")
            .bind(&slug)
            .fetch_one(&mut *tx)
            .await?
    };

    // Hash password
    let password_hash = User::hash_password(&input.password)
        .map_err(|e| AppError::internal(format!("password hashing failed: {}", e)))?;

    // Determine role: first user of an org becomes admin, subsequent users are members
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM web_users WHERE org_id = ?")
        .bind(org.id)
        .fetch_one(&mut *tx)
        .await?;
    let role = if user_count.0 == 0 { "admin" } else { "member" };

    sqlx::query(
        "INSERT INTO web_users (org_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(org.id)
    .bind(&input.email)
    .bind(&password_hash)
    .bind(&input.name)
    .bind(role)
    .execute(&mut *tx)
    .await?;
    let user = sqlx::query_as::<_, User>("SELECT * FROM web_users WHERE email = ?")
        .bind(&input.email)
        .fetch_one(&mut *tx)
        .await?;

    // Create session
    let session_id = uuid::Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now().checked_add_signed(chrono::Duration::days(7)).unwrap();
    sqlx::query(
        "INSERT INTO sessions (id, user_id, org_id, data, expires_at) VALUES (?, ?, ?, '{}', ?)",
    )
    .bind(&session_id)
    .bind(user.id)
    .bind(org.id)
    .bind(expires_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // If DeepFlow provisioning failed during the initial attempt (e.g. server
    // unreachable or alloc-org-id not available), retry now that we have the
    // auto-increment org id. This ensures the org-scoped MySQL database is
    // created even when the full provisioning pipeline wasn't available.
    if !zerotrace_provisioned {
        let org_id = org.id;
        let org_name = org.name.clone();
        tokio::spawn(async move {
            tracing::info!(
                org_id,
                org_name,
                "retrying DeepFlow org DB creation post-registration"
            );
            match zerotrace::create_zerotrace_org_db(org_id).await {
                Ok(()) => tracing::info!(org_id, "DeepFlow org DB created on retry"),
                Err(e) =>
                    tracing::warn!(org_id, error = ?e, "DeepFlow org DB creation still failed (will be auto-created on first agent registration)"),
            }
        });
    }

    // Initialise ClickHouse org database (tables + materialized views) in background.
    // This ensures new orgs have their data routed immediately after registration.
    {
        let ch_org_id = org.id;
        tokio::spawn(async move {
            if let Ok(client) = crate::clickhouse::ch_client() {
                tracing::info!(org_id = ch_org_id, "Initialising ClickHouse org database");
                match crate::clickhouse::ensure_org_database(&client, ch_org_id).await {
                    Ok(()) =>
                        tracing::info!(org_id = ch_org_id, "ClickHouse org database initialised"),
                    Err(e) =>
                        tracing::warn!(org_id = ch_org_id, error = ?e, "ClickHouse org init failed — will be lazily initialised on first query"),
                }
            }
        });
    }

    // Sync vtap records: set team_id = org_id for any agent that belongs to this org.
    // This is what makes per-org data isolation work — the DeepFlow ingester
    // reads vtap.team_id and tags every ClickHouse row with it.
    {
        let vtap_org_id = org.id;
        let vtap_pool = pool.clone();
        tokio::spawn(async move {
            if let Err(e) = crate::zerotrace::sync_vtap_org_id(&vtap_pool, vtap_org_id).await {
                tracing::warn!(org_id = vtap_org_id, error = ?e, "Failed to sync vtap team_id");
            }
        });
    }

    let user_response: UserResponse = user.into();
    let cookie = build_session_cookie(&session_id);
    let warning: Option<&str> = if zerotrace_provisioned {
        None
    } else {
        Some(
            "Organization created. Backend database is being provisioned in the background — agents can connect once it's ready.",
        )
    };

    let mut resp_body = json!({
        "user": user_response,
        "org": { "id": org.id, "name": org.name, "slug": org.slug }
    });
    if let Some(w) = warning {
        resp_body["warning"] = json!(w);
    }

    let mut response = Json(resp_body).into_response();
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
