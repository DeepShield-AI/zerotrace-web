mod billing;
mod clickhouse;
mod config;
mod db;
mod errors;
mod guardian;
mod handlers;
mod middleware;
mod models;
mod zerotrace;

use crate::{
    config::Config,
    guardian::{guardian_analyze, guardian_stories, guardian_story_detail},
    handlers::{
        agents, api_keys, apm, auth, billing as billing_handlers, data, installer, metrics, organization, users,
    },
    middleware::auth::{require_auth, require_subscription},
};
use axum::{
    Router, middleware as axum_middleware,
    routing::{delete, get, post, put},
};
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();

    tracing::info!("Connecting to database: {}", config.database_url);
    let pool = db::init_pool(&config.database_url).await?;
    db::run_migrations(&pool).await?;

    // Initialise org-scoped ClickHouse databases in a background task.
    // This is non-blocking — the HTTP server starts immediately, and APM
    // handlers lazily init any org database that isn't ready on first query.
    {
        let pool_bg = pool.clone();
        tokio::spawn(async move {
            let ch = match clickhouse::ch_client() {
                Ok(c) => c,
                Err(e) => {
                    tracing::warn!(error = ?e, "Skipping background org DB init");
                    return;
                }
            };
            let orgs = match sqlx::query_as::<_, (i64,)>("SELECT DISTINCT org_id FROM web_users")
                .fetch_all(&pool_bg)
                .await
            {
                Ok(o) => o,
                Err(e) => {
                    tracing::warn!(error = ?e, "Skipping background org DB init");
                    return;
                }
            };
            for (org_id,) in orgs {
                if let Err(e) = clickhouse::ensure_org_database(&ch, org_id).await {
                    tracing::warn!(org_id, error = ?e, "Org database initialisation failed");
                }
                // Sync vtap team_id → org_id so existing agents get org routing
                if let Err(e) = crate::zerotrace::sync_vtap_org_id(&pool_bg, org_id).await {
                    tracing::warn!(org_id, error = ?e, "Vtap sync skipped");
                }
            }
            tracing::info!("Background org DB init complete");
        });
    }

    // Spawn usage collector background task
    {
        let collector_pool = pool.clone();
        let server_url = config.zerotrace_server_url.clone();
        tokio::spawn(async move {
            billing::collector::run_collector(collector_pool, server_url).await;
        });
    }

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

    // Public routes
    let public_routes = Router::new()
        .route("/api/v1/auth/register", post(auth::register_handler))
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/logout", post(auth::logout))
        .route("/api/v1/auth/me", get(auth::me))
        .route("/agent/install.sh", get(installer::serve_install_script))
        .route("/api/v1/server-info", get(installer::server_info))
        .nest_service(
            "/agent/binaries",
            ServeDir::new(std::env::var("BINARIES_DIR").unwrap_or_else(|_| {
                concat!(env!("CARGO_MANIFEST_DIR"), "/agent-installer/binaries").to_string()
            })),
        );

    // Protected routes
    let protected_routes = Router::new()
            .route("/api/v1/users", get(users::list_users))
            .route("/api/v1/users/{id}", put(users::update_user))
            .route("/api/v1/organization", get(organization::get_org).put(organization::update_org))
        .route(
            "/api/v1/api-keys",
            get(api_keys::list_api_keys).post(api_keys::create_api_key),
        )
        .route("/api/v1/api-keys/{id}", delete(api_keys::revoke_api_key))
        .route(
            "/api/v1/api-keys/{id}/reveal",
            post(api_keys::reveal_api_key),
        )
        .route("/api/v1/agents/status", get(agents::agent_status))
        .route("/api/v1/agents/register", post(agents::agent_register))
        .route("/api/v1/data/overview", get(data::data_overview))
        .route("/api/v1/metrics/list", get(metrics::metrics_list))
        .route("/api/v1/metrics/query", get(metrics::metrics_query))
        .route("/api/v1/apm/tags", get(apm::apm_tags))
        .route("/api/v1/apm/topology", get(apm::apm_topology))
        .route("/api/v1/apm/services", get(apm::apm_services))
        .route(
            "/api/v1/apm/services/{service_name}",
            get(apm::apm_service_detail),
        )
        .route(
            "/api/v1/apm/services/{service_name}/dependencies",
            get(apm::apm_service_dependencies),
        )
        .route("/api/v1/apm/operations", get(apm::apm_operations))
        .route("/api/v1/apm/stats", get(apm::apm_stats))
        .route("/api/v1/apm/traces", get(apm::apm_traces))
        .route("/api/v1/apm/traces/{trace_id}", get(apm::apm_trace_detail))
        .route("/api/v1/apm/spans/{span_id}", get(apm::apm_span_detail))
        .route("/api/v1/guardian/analyze", post(guardian_analyze))
        .route("/api/v1/guardian/stories", get(guardian_stories))
        .route("/api/v1/guardian/stories/{id}", get(guardian_story_detail))
        .route(
            "/api/v1/billing/plans",
            get(billing_handlers::list_plans).post(billing_handlers::create_plan),
        )
        .route(
            "/api/v1/billing/plans/{id}",
            put(billing_handlers::update_plan).delete(billing_handlers::delete_plan),
        )
        .route(
            "/api/v1/billing/summary",
            get(billing_handlers::billing_summary),
        )
        .route(
            "/api/v1/billing/subscriptions",
            get(billing_handlers::list_subscriptions).post(billing_handlers::create_subscription),
        )
        .route(
            "/api/v1/billing/subscriptions/{id}",
            delete(billing_handlers::cancel_subscription)
                .patch(billing_handlers::update_subscription_quantity),
        )
        .route(
            "/api/v1/billing/usage",
            get(billing_handlers::current_usage),
        )
        .route(
            "/api/v1/billing/usage/hourly",
            get(billing_handlers::hourly_usage),
        )
        .route(
            "/api/v1/billing/estimated-cost",
            get(billing_handlers::estimated_cost_v2),
        )
        .route(
            "/api/v1/billing/invoices",
            get(billing_handlers::list_invoices),
        )
        .route(
            "/api/v1/billing/invoices/{id}",
            get(billing_handlers::invoice_detail),
        )
        .route(
            "/api/v1/billing/invoices/generate",
            post(billing_handlers::generate_invoice),
        )
        .route(
            "/api/v1/billing/alerts",
            get(billing_handlers::list_usage_alerts).post(billing_handlers::create_usage_alert),
        )
        .route(
            "/api/v1/billing/alerts/{id}",
            delete(billing_handlers::delete_usage_alert),
        )
        .route_layer(axum_middleware::from_fn_with_state(
            pool.clone(),
            require_subscription,
        ))
        .route_layer(axum_middleware::from_fn_with_state(
            pool.clone(),
            require_auth,
        ));

    // Frontend SPA: serve dist/ with index.html fallback for client-side routing
    let static_dir = std::env::var("STATIC_DIR")
        .unwrap_or_else(|_| format!("{}/../frontend/dist", env!("CARGO_MANIFEST_DIR")));
    let index_html = format!("{}/index.html", static_dir);

    let spa = Router::new()
        .fallback_service(ServeDir::new(&static_dir).fallback(ServeFile::new(index_html)));

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .merge(spa)
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!("Zerotrace Web API listening on {}", config.bind_addr);
    axum::serve(listener, app).await?;

    Ok(())
}
