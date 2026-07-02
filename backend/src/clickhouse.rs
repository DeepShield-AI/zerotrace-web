// Shared ClickHouse query helpers used across handlers and the guardian module.

use crate::errors::AppError;
use serde_json::Value;
use std::{
    collections::HashSet,
    sync::{Mutex, OnceLock},
};

// ---------------------------------------------------------------------------
// Org-scoped database name
// ---------------------------------------------------------------------------

/// Returns the org-scoped flow_log database name.
/// org_id=1 → "flow_log" (default / admin)
/// org_id=N → "{:04}_flow_log" (e.g., org 3 → "0003_flow_log")
///
/// Each org database is automatically initialised with cloned MergeTree tables
/// and materialized views from the shared `flow_log` database on first access.
/// See `ensure_org_database`.
pub fn flow_log_db(org_id: i64) -> String {
    if org_id <= 1 {
        "flow_log".to_string()
    } else {
        format!("{:04}_flow_log", org_id)
    }
}

pub fn effective_flow_log_db(org_id: i64) -> String {
    flow_log_db(org_id)
}

// ---------------------------------------------------------------------------
// Org database initialisation
// ---------------------------------------------------------------------------

/// Tables to clone from `flow_log` into each org database.
/// Only tables with a `team_id` column are cloned — this ensures org isolation.
/// `span_with_trace_id` and `trace_tree` are deepflow-server internal tables
/// without team_id; they stay in the shared `flow_log` database.
/// Our backend queries traces via `l7_flow_log` (which has team_id), not these tables.
const CLONE_TABLES: &[(&str, &str)] = &[
    ("l7_flow_log_local", "l7_flow_log"),
    ("l4_flow_log_local", "l4_flow_log"),
];

/// Create a ClickHouse database via HTTP POST (DDL).
pub async fn create_database_http(client: &reqwest::Client, db_name: &str) -> Result<(), String> {
    let sql = format!("CREATE DATABASE IF NOT EXISTS {}", db_name);
    ch_post(client, &sql).await
}

/// Initialise an org's ClickHouse database with cloned tables and Materialized View
/// routing from the shared `flow_log` database, filtered by `team_id = org_id`.
///
/// For each table (e.g. `l7_flow_log_local`):
///   1. CREATE TABLE {org_db}.{table} AS flow_log.{src_local}
///   2. Backfill: INSERT INTO {org_db}.{table} SELECT * FROM flow_log.{src_local}
///      WHERE team_id = {org_id}
///   3. CREATE MATERIALIZED VIEW in `flow_log` that auto-routes new rows
///      matching `team_id = org_id` into the org database.
///
/// Idempotent — safe to call multiple times.
pub async fn ensure_org_database(client: &reqwest::Client, org_id: i64) -> Result<(), String> {
    if org_id <= 1 {
        return Ok(());
    }

    let db = flow_log_db(org_id);

    // 1. Create database
    create_database_http(client, &db).await?;

    // 2. For each table, create clone + backfill + MV
    for (src_local, dst_table) in CLONE_TABLES {
        let create_sql =
            format!("CREATE TABLE IF NOT EXISTS {db}.{dst_table} AS flow_log.{src_local}");
        if let Err(e) = ch_post(client, &create_sql).await {
            tracing::warn!(%db, %dst_table, error = %e, "Failed to create cloned table");
            continue;
        }

        // Backfill: copy existing rows matching this org's team_id (= org_id)
        let backfill_sql = format!(
            "INSERT INTO {db}.{dst_table} \
             SELECT * FROM flow_log.{src_local} \
             WHERE team_id = {org_id}"
        );
        if let Err(e) = ch_post(client, &backfill_sql).await {
            tracing::warn!(%db, %dst_table, error = %e,
                "Backfill INSERT may have partially failed (OK if already populated)");
        }

        // Materialized View: auto-route new rows with team_id = org_id
        let mv_name = format!("{}_org{}_mv", src_local, org_id);
        let mv_sql = format!(
            "CREATE MATERIALIZED VIEW IF NOT EXISTS flow_log.{mv_name} \
             TO {db}.{dst_table} \
             AS SELECT * FROM flow_log.{src_local} \
             WHERE team_id = {org_id}"
        );
        if let Err(e) = ch_post(client, &mv_sql).await {
            tracing::warn!(%mv_name, error = %e, "Failed to create materialized view");
        } else {
            tracing::info!(%mv_name, %db, "Materialized view created — data routing active");
        }
    }

    // 3. Create service_edges table (for topology — populated via refresh, not MV)
    //    Avoids the O(n²) syscall JOIN on every query by pre-computing edges.
    let edges_sql = format!(
        "CREATE TABLE IF NOT EXISTS {db}.service_edges \
         (source String, target String, call_count UInt64, \
          avg_latency_ms Float64, p95_latency_ms Float64, error_count UInt64) \
         ENGINE = SummingMergeTree ORDER BY (source, target)"
    );
    if let Err(e) = ch_post(client, &edges_sql).await {
        tracing::warn!(%db, error = %e, "Failed to create service_edges table");
    }

    tracing::info!(%db, org_id, "Org ClickHouse database initialised");
    Ok(())
}

/// Refresh service_edges for an org by joining syscall-trace-correlated spans.
/// Runs the expensive O(n²) query once so the topology handler can do O(1) SELECT.
pub async fn refresh_service_edges(client: &reqwest::Client, org_id: i64) -> Result<(), String> {
    if org_id <= 1 { return Ok(()); }
    let db = flow_log_db(org_id);

    // Insert edges by joining on syscall trace correlation.
    // Limit to recent 1h to avoid memory explosion.
    let sql = format!(
        "INSERT INTO {db}.service_edges \
         SELECT \
           if(a.app_service != '', a.app_service, a.request_domain) AS source, \
           if(b.app_service != '', b.app_service, b.request_domain) AS target, \
           count() AS call_count, \
           avg(b.response_duration) / 1000 AS avg_latency_ms, \
           quantile(0.95)(b.response_duration) / 1000 AS p95_latency_ms, \
           countIf(b.response_code >= 500 OR b.response_code = 0) AS error_count \
         FROM {db}.l7_flow_log AS a \
         INNER JOIN {db}.l7_flow_log AS b \
           ON a.syscall_trace_id_response = b.syscall_trace_id_request \
         WHERE a.time > now() - INTERVAL 1 HOUR \
           AND b.time > now() - INTERVAL 1 HOUR \
           AND a.syscall_trace_id_response != 0 \
           AND b.syscall_trace_id_request != 0 \
         GROUP BY source, target \
         HAVING source != target AND source != '' AND target != ''"
    );

    ch_post(client, &sql).await
}

// ---------------------------------------------------------------------------
// Lazy org database initialisation (called on first query for each org)
// ---------------------------------------------------------------------------

static INITIALIZED_ORGS: OnceLock<Mutex<HashSet<i64>>> = OnceLock::new();

fn is_org_initialized(org_id: i64) -> bool {
    let set = INITIALIZED_ORGS.get_or_init(|| Mutex::new(HashSet::new()));
    set.lock().unwrap().contains(&org_id)
}

fn mark_org_initialized(org_id: i64) {
    let set = INITIALIZED_ORGS.get_or_init(|| Mutex::new(HashSet::new()));
    set.lock().unwrap().insert(org_id);
}

/// Ensure the ClickHouse org database exists and has tables.  Idempotent —
/// safe to call multiple times.  Returns true if init was attempted.
/// Lazy init skips backfill (tables already have data via Materialized Views) so
/// it completes quickly on the first query.
pub async fn init_org_db_if_needed(client: &reqwest::Client, org_id: i64) -> bool {
    if org_id <= 1 || is_org_initialized(org_id) {
        return false;
    }
    let db = flow_log_db(org_id);
    match create_database_http(client, &db).await {
        Ok(()) => {
            // Only CREATE TABLE — skip backfill (MVs already route live data).
            // The startup init handles full backfill for existing orgs.
            for (src_local, dst_table) in CLONE_TABLES {
                let sql =
                    format!("CREATE TABLE IF NOT EXISTS {db}.{dst_table} AS flow_log.{src_local}");
                if let Err(e) = ch_post(client, &sql).await {
                    tracing::warn!(%db, %dst_table, error = %e, "Lazy create table failed");
                }
            }
            mark_org_initialized(org_id);
            tracing::info!(
                org_id,
                "Lazy org ClickHouse database initialised (tables only)"
            );
            true
        },
        Err(e) => {
            tracing::warn!(org_id, error = %e, "Lazy org ClickHouse init failed — will retry");
            false
        },
    }
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

/// Execute a ClickHouse DDL statement via HTTP POST.
async fn ch_post(client: &reqwest::Client, sql: &str) -> Result<(), String> {
    let url = format!("{}/", clickhouse_url());
    tracing::info!(sql = %sql, "ClickHouse DDL");
    let resp = client
        .post(&url)
        .body(sql.to_string())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        let body = resp.text().await.unwrap_or_default();
        // "already exists" errors are harmless for idempotent init
        if body.to_lowercase().contains("already exists") {
            Ok(())
        } else {
            Err(body)
        }
    }
}

/// Execute a ClickHouse query via HTTP, returning JSONEachRow rows as a Value::Array.
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

            let lower = text.to_lowercase();
            if lower.contains("database") &&
                (lower.contains("doesn't exist") ||
                    lower.contains("does not exist") ||
                    lower.contains("not found"))
            {
                if let Some(db_name) = extract_db_from_error(&text) {
                    tracing::info!(db = %db_name, "Auto-creating ClickHouse database");
                    if let Err(e) = create_database_http(client, &db_name).await {
                        tracing::warn!(db = %db_name, error = %e, "Failed to auto-create database");
                    } else {
                        tracing::info!(db = %db_name, "Database created — run org init for tables");
                        // Return structured error so frontend can show appropriate message
                        return serde_json::json!([{
                            "error": "org_database_not_ready",
                            "message": "Data store initializing. Retry in a few seconds.",
                            "detail": text
                        }]);
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
                    "message": "Data table not yet created. Run org init.",
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

fn extract_db_from_error(text: &str) -> Option<String> {
    let start = text.find('`')?;
    let end = text[start + 1..].find('`')?;
    Some(text[start + 1..start + 1 + end].to_string())
}

// ---------------------------------------------------------------------------
// URL encoding
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
// Value extractors
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
// Org-based data isolation (maps to ClickHouse `team_id` column)
// ---------------------------------------------------------------------------

/// Returns a SQL filter clause that restricts queries to the org's data.
/// Maps `auth.org_id` → ClickHouse `team_id` column.
/// org_id ≤ 1 (super_admin / zerotrace) sees all data.
pub fn org_filter(org_id: i64) -> String {
    if org_id <= 1 {
        String::new()
    } else {
        format!("AND team_id = {} ", org_id)
    }
}
