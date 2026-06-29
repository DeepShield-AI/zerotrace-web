// Shared ClickHouse query helpers used across handlers and the guardian module.
// Consolidates duplicated helpers previously scattered across apm.rs, data.rs,
// metrics.rs, baseline.rs, and correlator.rs.

use crate::errors::AppError;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Org-scoped database name
// ---------------------------------------------------------------------------

/// Returns the org-scoped flow_log database name.
/// org_id=1 → "flow_log" (the default DeepFlow database)
/// org_id=N → "{:04}_flow_log" (e.g., org 2 → "0002_flow_log")
pub fn flow_log_db(org_id: i64) -> String {
    if org_id <= 1 {
        "flow_log".to_string()
    } else {
        format!("{:04}_flow_log", org_id)
    }
}

/// Returns the effective database to query.
///
/// org_id=1 → "flow_log" (the default DeepFlow database)
/// org_id>1 → "{:04}_flow_log" (e.g., org 2 → "0002_flow_log")
///
/// The DeepFlow ingester auto-creates org-scoped ClickHouse databases when it
/// discovers a new org (polls GetORGIDs every 60s). If the database doesn't
/// exist yet, ch_query_raw auto-creates it and retries. If tables don't exist
/// yet (brand-new org), a structured error is returned so the frontend can
/// show an appropriate message.
pub fn effective_flow_log_db(org_id: i64) -> String {
    flow_log_db(org_id)
}

// ---------------------------------------------------------------------------
// ClickHouse HTTP client
// ---------------------------------------------------------------------------

pub fn clickhouse_url() -> String {
    std::env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://127.0.0.1:8123".to_string())
}

pub fn ch_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))
}

/// Execute a ClickHouse query via HTTP, returning JSONEachRow rows as a Value::Array.
///
/// Detects common error conditions:
/// - Database not found → auto-creates it and retries
/// - Table not found → returns structured error (schema not yet created)
pub async fn ch_query(client: &reqwest::Client, sql: &str) -> Value {
    ch_query_raw(client, sql).await
}

/// Low-level query execution with auto-retry for missing databases.
async fn ch_query_raw(client: &reqwest::Client, sql: &str) -> Value {
    let url = format!("{}/?query={}", clickhouse_url(), urlencoding(sql));
    tracing::info!(url = %url, "ClickHouse query");
    match client.get(&url).send().await {
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            tracing::info!(status = %status, text_len = text.len(), "ClickHouse response");

            // Detect database not found → auto-create, then retry once
            let lower = text.to_lowercase();
            if lower.contains("database") && (lower.contains("doesn't exist") ||
                lower.contains("does not exist") || lower.contains("not found"))
            {
                if let Some(db_name) = extract_db_from_error(&text) {
                    tracing::info!(db = %db_name, "Auto-creating ClickHouse database");
                    if let Err(e) = create_database(client, &db_name).await {
                        tracing::warn!(db = %db_name, error = %e, "Failed to auto-create database");
                    } else {
                        tracing::info!(db = %db_name, "Retrying query after db creation");
                        return Box::pin(ch_query_raw(client, sql)).await;
                    }
                }
                return serde_json::json!([{
                    "error": "org_database_not_ready",
                    "message": "Data store initializing. Retry in a few seconds.",
                    "detail": text
                }]);
            }
            if lower.contains("table") && lower.contains("doesn't exist") {
                return serde_json::json!([{
                    "error": "table_not_found",
                    "message": "Data table not yet created.",
                    "detail": text
                }]);
            }
            if status.is_server_error() || status.is_client_error() {
                return serde_json::json!([{"error": "clickhouse_error", "detail": text}]);
            }

            let rows: Vec<Value> = text
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect();
            if rows.is_empty() && !text.is_empty() {
                tracing::warn!(text = %text, "ClickHouse returned non-JSONLines response");
            }
            Value::Array(rows)
        },
        Err(e) => {
            tracing::error!(error = %e, "ClickHouse request failed");
            serde_json::json!([{"error": e.to_string()}])
        },
    }
}

/// Extract the database name from a ClickHouse error message like:
/// "Database `0003_flow_log` does not exist."
fn extract_db_from_error(text: &str) -> Option<String> {
    // Match `database_name` in backticks
    let start = text.find('`')?;
    let end = text[start + 1..].find('`')?;
    Some(text[start + 1..start + 1 + end].to_string())
}

/// Create a ClickHouse database via HTTP POST (DDL requires POST, not GET).
async fn create_database(client: &reqwest::Client, db_name: &str) -> Result<(), String> {
    let sql = format!("CREATE DATABASE IF NOT EXISTS {}", db_name);
    let url = format!("{}/", clickhouse_url());
    let resp = client
        .post(&url)
        .body(sql)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(resp.text().await.unwrap_or_default())
    }
}

// ---------------------------------------------------------------------------
// URL encoding for ClickHouse SQL over HTTP GET
// ---------------------------------------------------------------------------

pub fn urlencoding(s: &str) -> String {
    s.replace(' ', "+")
        .replace('\'', "%27")
        .replace('(', "%28")
        .replace(')', "%29")
        .replace('>', "%3E")
        .replace('<', "%3C")
        .replace('!', "%21")
        .replace('"', "%22")
        .replace('=', "%3D")
        .replace('#', "%23")
        .replace('&', "%26")
}

// ---------------------------------------------------------------------------
// Value extractors (ClickHouse JSONEachRow returns all values as strings)
// ---------------------------------------------------------------------------

pub fn val_i64(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

pub fn val_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

pub fn val_str<'a>(v: &'a Value) -> Option<&'a str> {
    v.as_str()
}

// ---------------------------------------------------------------------------
// Time filter builder
// ---------------------------------------------------------------------------

/// Build a ClickHouse time filter clause.
/// When both start and end are provided, uses a bounded range;
/// otherwise falls back to a relative interval.
pub fn time_filter(start: Option<i64>, end: Option<i64>, default_interval: &str) -> String {
    match (start, end) {
        (Some(s), Some(e)) => {
            format!("time >= toDateTime({}) AND time <= toDateTime({})", s, e)
        },
        _ => {
            format!("time > now() - INTERVAL {}", default_interval)
        },
    }
}

// ---------------------------------------------------------------------------
// Team-based data isolation (same-org user isolation)
// ---------------------------------------------------------------------------

/// Build a team filter clause for ClickHouse WHERE conditions.
/// - If team_ids is empty → returns empty string (user sees all teams in the org).
/// - If team_ids is non-empty → returns "AND team_id IN (1, 2, 3)".
///
/// This implements same-org user isolation: users only see data from teams
/// they belong to, unless they are org admins (team_ids is empty).
pub fn team_filter(team_ids: &[i64]) -> String {
    if team_ids.is_empty() {
        String::new()
    } else {
        let ids: Vec<String> = team_ids.iter().map(|id| id.to_string()).collect();
        format!("AND team_id IN ({}) ", ids.join(", "))
    }
}
