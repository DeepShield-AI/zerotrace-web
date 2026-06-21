mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod guardian;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post},
    Router,
};
use tower_http::services::ServeDir;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::config::Config;
use crate::handlers::{agents, api_keys, apm, auth, data, installer, metrics};
use crate::guardian::{guardian_analyze, guardian_stories, guardian_story_detail};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();

    // Initialize database
    tracing::info!("Connecting to database: {}", config.database_url);
    let pool = db::init_pool(&config.database_url).await?;
    db::run_migrations(&pool).await?;

    // Build CORS layer — cannot use Any with allow_credentials
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::mirror_request())
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::COOKIE,
        ])
        .allow_credentials(true);

    // === Public routes (no auth required) ===
    let public_routes = Router::new()
        .route("/api/v1/auth/register", post(auth::register_handler))
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/logout", post(auth::logout))
        .route("/api/v1/auth/me", get(auth::me))
        .route("/agent/install.sh", get(installer::serve_install_script))
        .nest_service("/agent/binaries", ServeDir::new(concat!(env!("CARGO_MANIFEST_DIR"), "/agent-installer/binaries")));

    // === Protected routes (auth required) ===
    let protected_routes = Router::new()
        .route(
            "/api/v1/api-keys",
            get(api_keys::list_api_keys).post(api_keys::create_api_key),
        )
        .route("/api/v1/api-keys/:id", delete(api_keys::revoke_api_key))
        .route(
            "/api/v1/api-keys/:id/reveal",
            post(api_keys::reveal_api_key),
        )
        .route("/api/v1/agents/status", get(agents::agent_status))
        .route("/api/v1/data/overview", get(data::data_overview))
        // Metrics
        .route("/api/v1/metrics/list", get(metrics::metrics_list))
        .route("/api/v1/metrics/query", get(metrics::metrics_query))
        // APM
        .route("/api/v1/apm/tags", get(apm::apm_tags))
        .route("/api/v1/apm/topology", get(apm::apm_topology))
        .route("/api/v1/apm/services", get(apm::apm_services))
        .route("/api/v1/apm/services/:service_name", get(apm::apm_service_detail))
        .route("/api/v1/apm/services/:service_name/dependencies", get(apm::apm_service_dependencies))
        .route("/api/v1/apm/operations", get(apm::apm_operations))
        .route("/api/v1/apm/stats", get(apm::apm_stats))
        .route("/api/v1/apm/traces", get(apm::apm_traces))
        .route("/api/v1/apm/traces/:trace_id", get(apm::apm_trace_detail))
        .route("/api/v1/apm/spans/:span_id", get(apm::apm_span_detail))
        // Guardian
        .route("/api/v1/guardian/analyze", post(guardian_analyze))
        .route("/api/v1/guardian/stories", get(guardian_stories))
        .route("/api/v1/guardian/stories/:id", get(guardian_story_detail))
        .route_layer(axum_middleware::from_fn_with_state(
            pool.clone(),
            middleware::auth::require_auth,
        ));

    // === Merge routers ===
    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(pool);

    // Start server
    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!("Zerotrace Web API listening on {}", config.bind_addr);

    axum::serve(listener, app).await?;

    Ok(())
}
