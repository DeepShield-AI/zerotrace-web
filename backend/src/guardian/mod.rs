mod baseline;
mod correlator;
mod detector;
mod rca;
pub mod types;

use crate::{clickhouse, errors::AppError, middleware::auth::AuthContext};
use axum::{Json, extract::State, response::IntoResponse};
use std::{
    collections::HashMap,
    sync::{Arc, OnceLock},
};
use tokio::sync::Mutex;
use tracing;
use types::{
    AnalyzeRequest, AnalyzeResponse, ServiceMetricsTs, Story, StoryListResponse, StorySummary,
};

// ---------------------------------------------------------------------------
// Global story store
// ---------------------------------------------------------------------------

static STORY_STORE: OnceLock<Arc<Mutex<Vec<Story>>>> = OnceLock::new();

fn get_story_store() -> &'static Arc<Mutex<Vec<Story>>> {
    STORY_STORE.get_or_init(|| Arc::new(Mutex::new(Vec::new())))
}

// ---------------------------------------------------------------------------
// ClickHouse client helper
// ---------------------------------------------------------------------------

fn ch_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to create HTTP client: {}", e)))
}

fn default_window() -> (i64, i64) {
    let now = chrono::Utc::now();
    let start = now - chrono::Duration::hours(1);
    (start.timestamp(), now.timestamp())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /api/v1/guardian/analyze
pub async fn guardian_analyze(
    State(_pool): State<crate::db::DbPool>,
    auth: AuthContext,
    Json(req): Json<AnalyzeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let client = ch_client()?;
    let db = clickhouse::effective_flow_log_db(auth.org_id);
    let (start, end) = match (req.start, req.end) {
        (Some(s), Some(e)) => (s, e),
        _ => default_window(),
    };

    let window_secs = end - start;
    let interval_secs = if window_secs <= 3600 {
        60 // 1-min buckets for <= 1h window
    } else if window_secs <= 86400 {
        300 // 5-min buckets for <= 24h window
    } else {
        900 // 15-min buckets for larger windows
    };

    tracing::info!(
        start,
        end,
        window_secs,
        interval_secs,
        org_id = auth.org_id,
        "Guardian analysis started"
    );

    // ── Step 1: Fetch current window metrics ──
    let current_metrics: Vec<ServiceMetricsTs> =
        baseline::fetch_service_metrics(&client, start, end, interval_secs, &db).await;

    // ── Step 2: Fetch historical baseline (previous period of same length) ──
    let baseline_start = start - window_secs;
    let baseline_end = start;
    let baseline_metrics =
        baseline::fetch_service_metrics(&client, baseline_start, baseline_end, interval_secs, &db)
            .await;

    // Build a lookup map for baseline by service
    let baseline_map: HashMap<String, ServiceMetricsTs> =
        baseline_metrics.into_iter().map(|m| (m.service_name.clone(), m)).collect();

    // ── Step 3: Compute baselines and detect anomalies ──
    let mut all_anomalies = Vec::new();
    let analyzed_count = current_metrics.len();

    for svc_metrics in &current_metrics {
        let svc_name = &svc_metrics.service_name;

        // Compute baseline from historical data for this service
        if let Some(hist_metrics) = baseline_map.get(svc_name) {
            let baseline = baseline::compute_baseline(hist_metrics, "historical");
            let anomalies =
                detector::detect_anomalies(svc_name, &svc_metrics.buckets, &baseline, end);
            all_anomalies.extend(anomalies);
        }
    }

    let anomaly_count = all_anomalies.len();
    tracing::info!(
        services = analyzed_count,
        anomalies = anomaly_count,
        "Anomaly detection complete"
    );

    // ── Step 4: Fetch topology for correlation ──
    let edges = correlator::fetch_topology(&client, start, end, &db).await;

    // ── Step 5: Correlate anomalies ──
    let correlation = correlator::correlate_anomalies(&all_anomalies, &edges, 300); // 5-min window

    // ── Step 6-7: RCA + Story generation per cluster ──
    let mut stories: Vec<Story> = Vec::new();
    for (i, cluster) in correlation.clusters.iter().enumerate() {
        if cluster.anomalies.is_empty() {
            continue;
        }
        let root_cause = rca::classify_root_cause(cluster, &edges, &all_anomalies);
        let story = rca::generate_story(
            cluster,
            &root_cause,
            "historical",
            "current",
            analyzed_count,
            i + 1,
            end,
            auth.org_id,
        );
        stories.push(story);
    }

    // ── Step 8: Store stories ──
    {
        let store = get_story_store();
        let mut guard = store.lock().await;
        let mut all = stories.clone();
        all.append(&mut guard.clone());
        all.truncate(100);
        *guard = all;
    }

    tracing::info!(stories = stories.len(), "Guardian analysis complete");

    Ok(Json(AnalyzeResponse {
        stories,
        analyzed_services: analyzed_count,
        analysis_window_secs: window_secs,
    }))
}

/// GET /api/v1/guardian/stories — org-scoped: only returns stories for the
/// authenticated user's organization.
pub async fn guardian_stories(
    State(_pool): State<crate::db::DbPool>,
    auth: AuthContext,
) -> Result<impl IntoResponse, AppError> {
    let store = get_story_store().lock().await;
    let summaries: Vec<StorySummary> = store
        .iter()
        .filter(|s| s.org_id == auth.org_id)
        .map(|s| StorySummary {
            id: s.id.clone(),
            title: s.title.clone(),
            severity: s.severity.clone(),
            detected_at: s.detected_at,
            affected_services: s.affected_services.clone(),
            anomaly_count: s.anomalies.len(),
        })
        .collect();

    Ok(Json(StoryListResponse { stories: summaries }))
}

/// GET /api/v1/guardian/stories/:id — org-scoped: only finds stories belonging
/// to the authenticated user's organization.
pub async fn guardian_story_detail(
    State(_pool): State<crate::db::DbPool>,
    auth: AuthContext,
    axum::extract::Path(story_id): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let store = get_story_store().lock().await;
    let story = store
        .iter()
        .find(|s| s.id == story_id && s.org_id == auth.org_id)
        .cloned()
        .ok_or_else(|| AppError::NotFound("Story not found".into()))?;

    Ok(Json(story))
}
