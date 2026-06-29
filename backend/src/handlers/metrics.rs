use crate::{clickhouse, db::DbPool, errors::AppError, middleware::auth::AuthContext};
use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

/* ---------- Types ---------- */

#[derive(Deserialize, Default)]
pub struct MetricsQueryParams {
    pub name: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
    pub interval: Option<i64>, // seconds, default 60
}

#[derive(Serialize)]
pub struct MetricDef {
    pub name: String,
    pub display_name: String,
    #[serde(rename = "type")]
    pub metric_type: String,
    pub unit: String,
    pub description: String,
    pub category: String,
}

#[derive(Serialize)]
pub struct MetricPoint {
    pub ts: String,
    pub value: f64,
}

#[derive(Serialize)]
pub struct MetricSeries {
    pub metric: String,
    pub display_name: String,
    pub unit: String,
    pub points: Vec<MetricPoint>,
}

/* ---------- Metric definitions ---------- */

fn metric_definitions() -> Vec<MetricDef> {
    vec![
        MetricDef {
            name: "l4.flow_count".into(),
            display_name: "L4 Flow Count".into(),
            metric_type: "count".into(),
            unit: "flows".into(),
            description: "Total number of L4 network flows per interval".into(),
            category: "Network".into(),
        },
        MetricDef {
            name: "l4.tx_bytes".into(),
            display_name: "L4 TX Bytes".into(),
            metric_type: "count".into(),
            unit: "bytes".into(),
            description: "Total bytes transmitted on L4 per interval".into(),
            category: "Network".into(),
        },
        MetricDef {
            name: "l4.rx_bytes".into(),
            display_name: "L4 RX Bytes".into(),
            metric_type: "count".into(),
            unit: "bytes".into(),
            description: "Total bytes received on L4 per interval".into(),
            category: "Network".into(),
        },
        MetricDef {
            name: "l7.request_count".into(),
            display_name: "L7 Request Count".into(),
            metric_type: "count".into(),
            unit: "requests".into(),
            description: "Total number of L7 HTTP/gRPC requests per interval".into(),
            category: "Application".into(),
        },
        MetricDef {
            name: "l7.avg_latency".into(),
            display_name: "L7 Avg Latency".into(),
            metric_type: "gauge".into(),
            unit: "μs".into(),
            description: "Average response duration for L7 requests".into(),
            category: "Application".into(),
        },
        MetricDef {
            name: "l7.p95_latency".into(),
            display_name: "L7 P95 Latency".into(),
            metric_type: "gauge".into(),
            unit: "μs".into(),
            description: "95th percentile response duration for L7 requests".into(),
            category: "Application".into(),
        },
        MetricDef {
            name: "l7.error_count".into(),
            display_name: "L7 Error Count".into(),
            metric_type: "count".into(),
            unit: "errors".into(),
            description: "Number of L7 requests with 4xx/5xx status per interval".into(),
            category: "Application".into(),
        },
        MetricDef {
            name: "l7.error_rate".into(),
            display_name: "L7 Error Rate %".into(),
            metric_type: "gauge".into(),
            unit: "%".into(),
            description: "Percentage of L7 requests that resulted in errors".into(),
            category: "Application".into(),
        },
    ]
}

/* ---------- Build ClickHouse SQL for each metric ---------- */

fn metric_sql(
    name: &str,
    start: Option<i64>,
    end: Option<i64>,
    interval_secs: i64,
    db: &str,
    team_clause: &str,
) -> Option<String> {
    let tf = clickhouse::time_filter(start, end, "1 HOUR");
    let interval_s = format!("{} SECOND", interval_secs.max(10));

    match name {
        "l4.flow_count" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, COUNT(*) AS value FROM {}.l4_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l4.tx_bytes" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, SUM(byte_tx) AS value FROM {}.l4_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l4.rx_bytes" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, SUM(byte_rx) AS value FROM {}.l4_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l7.request_count" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, COUNT(*) AS value FROM {}.l7_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l7.avg_latency" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, AVG(response_duration) AS value FROM {}.l7_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l7.p95_latency" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, quantile(0.95)(response_duration) AS value FROM {}.l7_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l7.error_count" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, COUNT(*) AS value FROM {}.l7_flow_log WHERE {} AND response_code >= 400 {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        "l7.error_rate" => Some(format!(
            "SELECT toStartOfInterval(time, INTERVAL {}) AS ts, (COUNTIf(response_code >= 400) * 100.0 / GREATEST(COUNT(*), 1)) AS value FROM {}.l7_flow_log WHERE {} {} GROUP BY ts ORDER BY ts FORMAT JSONEachRow",
            interval_s, db, tf, team_clause
        )),
        _ => None,
    }
}

/* ---------- Handlers ---------- */

/// GET /api/v1/metrics/list — returns available metric definitions
pub async fn metrics_list(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
) -> Result<axum::response::Response, AppError> {
    Ok(Json(json!({ "metrics": metric_definitions() })).into_response())
}

/// GET /api/v1/metrics/query?name=X&start=&end=&interval=60 — returns timeseries
pub async fn metrics_query(
    State(_pool): State<DbPool>,
    auth: AuthContext,
    Query(params): Query<MetricsQueryParams>,
) -> Result<axum::response::Response, AppError> {
    let name = params.name.unwrap_or_default();
    let interval = params.interval.unwrap_or(60);
    let db = clickhouse::effective_flow_log_db(auth.org_id);
    let team_clause = clickhouse::team_filter(&auth.team_ids);

    let display_name = metric_definitions()
        .iter()
        .find(|m| m.name == name)
        .map(|d| d.display_name.clone())
        .unwrap_or_default();
    let unit = metric_definitions()
        .iter()
        .find(|m| m.name == name)
        .map(|d| d.unit.clone())
        .unwrap_or_default();

    let sql = match metric_sql(&name, params.start, params.end, interval, &db, &team_clause) {
        Some(s) => s,
        None =>
            return Ok(Json(json!({ "error": "Unknown metric", "metric": name })).into_response()),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))?;

    let rows = clickhouse::ch_query(&client, &sql).await;
    let points: Vec<MetricPoint> = rows
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|row| {
            Some(MetricPoint {
                ts: row.get("ts")?.as_str()?.to_string(),
                value: row.get("value")?.as_f64()?,
            })
        })
        .collect();

    Ok(Json(json!({
        "metric": name,
        "display_name": display_name,
        "unit": unit,
        "points": points,
    }))
    .into_response())
}
