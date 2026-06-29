use crate::{clickhouse, db::DbPool, errors::AppError, middleware::auth::AuthContext};
use axum::{
    Json,
    extract::{Query, State},
    response::IntoResponse,
};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize, Default)]
pub struct OverviewParams {
    pub start: Option<i64>,
    pub end: Option<i64>,
}

pub async fn data_overview(
    State(_pool): State<DbPool>,
    auth: AuthContext,
    Query(params): Query<OverviewParams>,
) -> Result<axum::response::Response, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))?;

    let db = clickhouse::effective_flow_log_db(auth.org_id);
    let team_clause = clickhouse::team_filter(&auth.team_ids);

    // Agents from vtap API — scoped to the authenticated user's org via X-Org-Id.
    let df_url = std::env::var("ZEROTRACE_SERVER_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:30417".to_string());
    let agents_val: Value = match client
        .get(&format!("{}/v1/vtaps/", df_url))
        .header("Content-Type", "application/json")
        .header("X-Org-Id", auth.org_id.to_string())
        .send()
        .await
    {
        Ok(r) => r.json().await.unwrap_or(json!({})),
        Err(_) => json!({}),
    };
    let agent_list: Vec<Value> =
        agents_val.get("DATA").and_then(|d| d.as_array()).cloned().unwrap_or_default();
    // Online = STATE==1 AND heartbeated within last 5 minutes
    // DB stores UTC timestamps without timezone — treat as UTC consistent with frontend
    let now_utc = chrono::Utc::now();
    let ts_formats = [
        "%Y-%m-%d %H:%M:%S",     // MySQL standard
        "%Y-%m-%dT%H:%M:%S",     // ISO 8601 without TZ
        "%Y-%m-%d %H:%M:%S%.f",  // with fractional seconds
        "%Y-%m-%dT%H:%M:%S%.f",  // ISO with fractional
        "%Y-%m-%dT%H:%M:%S%.fZ", // ISO with fractional + Z
    ];
    let online = agent_list
        .iter()
        .filter(|a: &&Value| {
            if a.get("STATE").and_then(|s| s.as_i64()) != Some(1) {
                return false;
            }
            if let Some(ts) = a.get("SYNCED_CONTROLLER_AT").and_then(|s| s.as_str()) {
                for fmt in &ts_formats {
                    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(ts, fmt) {
                        let age = (now_utc - dt.and_utc()).num_seconds().abs();
                        return age < 300; // 5 min threshold — matches AgentSetup page
                    }
                }
            }
            false
        })
        .count();

    let tf_1h = clickhouse::time_filter(params.start, params.end, "1 HOUR");
    let tf_30m = clickhouse::time_filter(params.start, params.end, "30 MINUTE");

    // L4 stats
    let l4 = clickhouse::ch_query(&client, &format!("SELECT SUM(byte_tx) AS tx, SUM(byte_rx) AS rx, COUNT(*) AS cnt FROM {db}.l4_flow_log WHERE {} {team_clause} FORMAT JSONEachRow", tf_1h, db = db)).await;

    // L7 stats
    let l7 = clickhouse::ch_query(&client, &format!("SELECT COUNT(*) AS cnt FROM {db}.l7_flow_log WHERE {} {team_clause} FORMAT JSONEachRow", tf_1h, db = db)).await;

    // Top L7 endpoints
    let top_l7 = clickhouse::ch_query(&client, &format!("SELECT request_resource AS name, COUNT(*) AS cnt, AVG(response_duration) AS avg_latency FROM {db}.l7_flow_log WHERE {} {team_clause} AND request_resource != '' {team_clause} GROUP BY request_resource ORDER BY cnt DESC LIMIT 8 FORMAT JSONEachRow", tf_1h, db = db)).await;

    // Top L4 talkers (external only, exclude localhost)
    let top_l4 = clickhouse::ch_query(&client, &format!("SELECT ip4_0 AS src, ip4_1 AS dst, COUNT(*) AS cnt, SUM(byte_tx) AS tx_bytes FROM {db}.l4_flow_log WHERE {} {team_clause} AND ip4_0 != '127.0.0.1' {team_clause} GROUP BY src, dst ORDER BY cnt DESC LIMIT 8 FORMAT JSONEachRow", tf_1h, db = db)).await;

    // Flow rate per minute
    let flow_rate = clickhouse::ch_query(&client, &format!("SELECT toStartOfMinute(time) AS ts, COUNT(*) AS cnt FROM {db}.l4_flow_log WHERE {} {team_clause} GROUP BY ts ORDER BY ts FORMAT JSONEachRow", tf_30m, db = db)).await;

    // L4 bandwidth per minute — for timeseries chart
    let l4_bandwidth = clickhouse::ch_query(&client, &format!("SELECT toStartOfMinute(time) AS ts, SUM(byte_tx) AS tx, SUM(byte_rx) AS rx FROM {db}.l4_flow_log WHERE {} {team_clause} GROUP BY ts ORDER BY ts FORMAT JSONEachRow", tf_30m, db = db)).await;

    // L7 request rate per minute
    let l7_rate = clickhouse::ch_query(&client, &format!("SELECT toStartOfMinute(time) AS ts, COUNT(*) AS cnt FROM {db}.l7_flow_log WHERE {} {team_clause} GROUP BY ts ORDER BY ts FORMAT JSONEachRow", tf_30m, db = db)).await;

    Ok(Json(json!({
        "agents": { "online": online, "total": agent_list.len(), "list": agent_list },
        "l4_stats": l4,
        "l7_stats": l7,
        "top_l7": top_l7,
        "top_l4": top_l4,
        "flow_rate": flow_rate,
        "l4_bandwidth": l4_bandwidth,
        "l7_rate": l7_rate,
    }))
    .into_response())
}
