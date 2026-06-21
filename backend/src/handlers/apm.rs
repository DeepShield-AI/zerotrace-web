use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{db::DbPool, errors::AppError, middleware::auth::AuthContext};

// ---------------------------------------------------------------------------
// ClickHouse query helper
// ---------------------------------------------------------------------------

fn urlencoding(s: &str) -> String {
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

async fn ch_query(client: &reqwest::Client, sql: &str) -> Value {
    let url = format!("http://127.0.0.1:8123/?query={}", urlencoding(sql));
    tracing::info!(url = %url, "ClickHouse query");
    match client.get(&url).send().await {
        Ok(r) => {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            tracing::info!(status = %status, text_len = text.len(), text_first = %text.chars().take(200).collect::<String>(), "ClickHouse response");
            let rows: Vec<Value> = text
                .lines()
                .filter(|l| !l.is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect();
            if rows.is_empty() && !text.is_empty() {
                tracing::warn!(text = %text, "ClickHouse returned non-JSONLines response");
            }
            Value::Array(rows)
        }
        Err(e) => {
            tracing::error!(error = %e, "ClickHouse request failed");
            json!([{"error": e.to_string()}])
        }
    }
}

fn ch_client() -> Result<reqwest::Client, AppError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::internal(e.to_string()))
}

/// ClickHouse JSONEachRow returns all values as JSON strings (including numbers).
/// This helper parses a Value as i64 regardless of whether it's a JSON number or string.
fn val_i64(v: &Value) -> Option<i64> {
    match v {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn val_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

fn val_str(v: &Value) -> Option<&str> {
    v.as_str()
}

fn default_window() -> (i64, i64) {
    let now = chrono::Utc::now();
    let start = now - chrono::Duration::hours(1);
    (start.timestamp(), now.timestamp())
}

/// service expression: use app_service if not empty, otherwise request_domain
const SERVICE_EXPR: &str = "if(app_service != '', app_service, request_domain)";

/// Qualified service expression for joins: expects table alias prefix like "a.app_service"
const Q_SERVICE_EXPR_A: &str = "if(a.app_service != '', a.app_service, a.request_domain)";
const Q_SERVICE_EXPR_B: &str = "if(b.app_service != '', b.app_service, b.request_domain)";
const Q_SERVICE_EXPR_P: &str = "if(p.app_service != '', p.app_service, p.request_domain)";
const Q_SERVICE_EXPR_C: &str = "if(c.app_service != '', c.app_service, c.request_domain)";

/// trace_id expression: use trace_id if not empty, otherwise use syscall_trace_id_request as fallback
const TRACE_ID_EXPR: &str = "if(trace_id != '', trace_id, if(syscall_trace_id_request != 0, concat('sys-', hex(syscall_trace_id_request)), ''))";

/// span_id expression: use span_id if not empty, otherwise use flow_id as fallback
const SPAN_ID_EXPR: &str = "if(span_id != '', span_id, toString(flow_id))";

// ---------------------------------------------------------------------------
// Datadog-style query expression parser
// ---------------------------------------------------------------------------

/// Parsed conditions from a query string like:
///   service:api-gateway operation:GET+/users status:error duration:>100ms tag:env:production
#[derive(Debug, Default)]
pub struct ParsedQuery {
    pub service: Option<String>,
    pub operation: Option<String>,
    pub status: Option<String>,         // "ok" | "error"
    pub min_duration_us: Option<i64>,
    pub max_duration_us: Option<i64>,
    pub trace_id: Option<String>,
    pub free_text: Option<String>,
    /// tag filters: (key, value)
    pub tags: Vec<(String, String)>,
    /// span_kind filter
    pub span_kind: Option<String>,
}

fn parse_query(raw: &str) -> ParsedQuery {
    let mut pq = ParsedQuery::default();
    let mut free_parts: Vec<String> = Vec::new();

    let tokens = tokenize_query(raw);
    for token in &tokens {
        if let Some((key, op, value)) = parse_key_value(token) {
            match key {
                "service" => pq.service = Some(value.to_string()),
                "operation" | "resource" => pq.operation = Some(value.to_string()),
                "status" => {
                    let v = value.to_lowercase();
                    if v == "ok" || v == "error" {
                        pq.status = Some(v);
                    }
                }
                "duration" => {
                    let (min_d, max_d) = parse_duration_filter(op, &value);
                    pq.min_duration_us = min_d;
                    pq.max_duration_us = max_d;
                }
                "trace_id" | "traceid" => pq.trace_id = Some(value.to_string()),
                "span_kind" => pq.span_kind = Some(value.to_string()),
                "tag" => {
                    // tag:env:production OR tag:env
                    if let Some((k, v)) = value.split_once(':') {
                        pq.tags.push((k.to_string(), v.to_string()));
                    } else {
                        pq.tags.push((value.to_string(), String::new()));
                    }
                }
                _ => {
                    // Unknown key → treat as free text
                    free_parts.push(token.to_string());
                }
            }
        } else {
            free_parts.push(token.to_string());
        }
    }

    if !free_parts.is_empty() {
        pq.free_text = Some(free_parts.join(" "));
    }

    pq
}

/// Tokenize a query string, respecting quoted strings
fn tokenize_query(raw: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quote = false;
    let mut quote_char = '"';

    for ch in raw.chars() {
        match ch {
            '"' | '\'' if !in_quote => {
                in_quote = true;
                quote_char = ch;
            }
            c if in_quote && c == quote_char => {
                in_quote = false;
            }
            ' ' | '\t' if !in_quote => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            _ => {
                current.push(ch);
            }
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

/// Parse "key:value" or "key:>value" or "key:>=value" or "key:<=value"
fn parse_key_value(token: &str) -> Option<(&str, &str, &str)> {
    if let Some(col_pos) = token.find(':') {
        let key = &token[..col_pos];
        let rest = &token[col_pos + 1..];

        // Check for operator prefix: >, >=, <, <=
        let (op, value) = if rest.starts_with(">=") {
            (">=", &rest[2..])
        } else if rest.starts_with("<=") {
            ("<=", &rest[2..])
        } else if rest.starts_with('>') {
            (">", &rest[1..])
        } else if rest.starts_with('<') {
            ("<", &rest[1..])
        } else if rest.starts_with('!') {
            ("!", &rest[1..])
        } else {
            ("=", rest)
        };

        if key.is_empty() || value.is_empty() {
            return None;
        }
        Some((key, op, value))
    } else {
        None
    }
}

/// Parse duration value like "100ms", "1s", "500us"
fn parse_duration_value(s: &str) -> Option<i64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    if let Some(num_part) = s.strip_suffix("us") {
        num_part.parse::<f64>().ok().map(|v| v as i64)
    } else if let Some(num_part) = s.strip_suffix("ms") {
        num_part.parse::<f64>().ok().map(|v| (v * 1000.0) as i64)
    } else if let Some(num_part) = s.strip_suffix('s') {
        num_part.parse::<f64>().ok().map(|v| (v * 1_000_000.0) as i64)
    } else {
        // bare number → treat as ms
        s.parse::<f64>().ok().map(|v| (v * 1000.0) as i64)
    }
}

fn parse_duration_filter(op: &str, value: &str) -> (Option<i64>, Option<i64>) {
    let us = parse_duration_value(value);
    match op {
        ">" => (us.map(|v| v + 1), None),
        ">=" => (us, None),
        "<" => (None, us.map(|v| v - 1)),
        "<=" => (None, us),
        "!" => (None, None), // negation not meaningful for range
        _ => {
            // equals: treat as range ±10%
            us.map(|v| (Some((v as f64 * 0.9) as i64), Some((v as f64 * 1.1) as i64)))
                .unwrap_or((None, None))
        }
    }
}

// ---------------------------------------------------------------------------
// Build ClickHouse WHERE clause from ParsedQuery + time range
// ---------------------------------------------------------------------------

fn build_where(
    start: i64,
    end: i64,
    pq: &ParsedQuery,
    svc_filter: Option<&str>,
    op_filter: Option<&str>,
    status_filter: Option<&str>,
    extra: Option<&str>,
) -> String {
    let mut conditions: Vec<String> = vec![format!(
        "time >= toDateTime({}) AND time <= toDateTime({})",
        start, end
    )];

    // Parsed query conditions
    if let Some(ref svc) = pq.service {
        conditions.push(format!(
            "{SERVICE_EXPR} = '{}'",
            svc.replace('\'', "''")
        ));
    }
    if let Some(ref op) = pq.operation {
        conditions.push(format!(
            "request_resource = '{}'",
            op.replace('\'', "''")
        ));
    }
    if let Some(ref status) = pq.status {
        match status.as_str() {
            "ok" => conditions.push("response_code < 500 AND response_code != 0".into()),
            "error" => conditions.push("(response_code >= 500 OR response_code = 0)".into()),
            _ => {}
        }
    }
    if let Some(min_d) = pq.min_duration_us {
        conditions.push(format!("response_duration >= {}", min_d));
    }
    if let Some(max_d) = pq.max_duration_us {
        conditions.push(format!("response_duration <= {}", max_d));
    }
    if let Some(ref tid) = pq.trace_id {
        let esc = tid.replace('\'', "''");
        // Support both real trace_ids and syscall-fallback trace_ids (prefixed with "sys-")
        if let Some(hex_part) = tid.strip_prefix("sys-") {
            let hex_esc = hex_part.replace('\'', "''");
            conditions.push(format!(
                "(trace_id = '{esc}' OR hex(syscall_trace_id_request) = '{hex_esc}')"
            ));
        } else {
            conditions.push(format!(
                "(trace_id = '{esc}' OR toString(trace_id_index) = '{esc}')"
            ));
        }
    }
    if let Some(ref sk) = pq.span_kind {
        conditions.push(format!("toString(span_kind) = '{}'", sk.replace('\'', "''")));
    }
    if let Some(ref ft) = pq.free_text {
        let escaped = ft.replace('\'', "''");
        conditions.push(format!(
            "(trace_id LIKE '%{0}%' OR request_resource LIKE '%{0}%' OR request_domain LIKE '%{0}%' OR app_service LIKE '%{0}%')",
            escaped
        ));
    }

    // Tag filters via attribute_names / attribute_values arrays
    for (tag_key, tag_value) in &pq.tags {
        let ek = tag_key.replace('\'', "''");
        if tag_value.is_empty() {
            // hasTag(tag_key)
            conditions.push(format!("has(attribute_names, '{}')", ek));
        } else {
            let ev = tag_value.replace('\'', "''");
            conditions.push(format!(
                "indexOf(attribute_names, '{}') > 0 AND attribute_values[indexOf(attribute_names, '{}')] = '{}'",
                ek, ek, ev
            ));
        }
    }

    // Extra filters from query params (override parsed)
    if let Some(svc) = svc_filter {
        conditions.push(format!(
            "{SERVICE_EXPR} = '{}'",
            svc.replace('\'', "''")
        ));
    }
    if let Some(op) = op_filter {
        conditions.push(format!(
            "request_resource = '{}'",
            op.replace('\'', "''")
        ));
    }
    if let Some(st) = status_filter {
        match st {
            "ok" => conditions.push("response_code < 500 AND response_code != 0".into()),
            "error" => conditions.push("(response_code >= 500 OR response_code = 0)".into()),
            _ => {}
        }
    }
    if let Some(e) = extra {
        conditions.push(e.to_string());
    }

    conditions.join(" AND ")
}

// ---------------------------------------------------------------------------
// Query parameter types (query params take precedence over parsed query)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
pub struct TracesQuery {
    /// Datadog-style query expression
    pub query: Option<String>,
    /// Individual filters (override query)
    pub service: Option<String>,
    pub operation: Option<String>,
    pub status: Option<String>,
    pub min_duration_us: Option<i64>,
    pub max_duration_us: Option<i64>,
    pub trace_id: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    /// Sort order: "duration", "spans", "time" (default)
    pub sort: Option<String>,
    /// Sort direction: "asc" or "desc" (default: "desc")
    pub sort_dir: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ServicesQuery {
    pub query: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct StatsQuery {
    pub query: Option<String>,
    pub service: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct OperationsQuery {
    pub query: Option<String>,
    pub service: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct TagsQuery {
    pub start: Option<i64>,
    pub end: Option<i64>,
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/tags — discover available tag keys
// ---------------------------------------------------------------------------

pub async fn apm_tags(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Query(q): Query<TagsQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let time_filter = format!(
        "time >= toDateTime({}) AND time <= toDateTime({})",
        start, end
    );

    // Get distinct attribute names across all rows
    // Also get app_service values for the "service:" autocomplete
    let sql = format!(
        "SELECT \
            arrayJoin(attribute_names) AS tag_key, \
            COUNT(*) AS cnt \
         FROM flow_log.l7_flow_log \
         WHERE {time_filter} AND length(attribute_names) > 0 \
         GROUP BY tag_key \
         ORDER BY cnt DESC \
         LIMIT 100 FORMAT JSONEachRow"
    );

    let rows = ch_query(&client, &sql).await;

    // Also get available services for autocomplete
    let services_sql = format!(
        "SELECT {SERVICE_EXPR} AS name, COUNT(*) AS cnt \
         FROM flow_log.l7_flow_log \
         WHERE {time_filter} \
         GROUP BY name \
         HAVING name != '' \
         ORDER BY cnt DESC \
         LIMIT 50 FORMAT JSONEachRow"
    );

    let services = ch_query(&client, &services_sql).await;

    Ok(Json(json!({
        "tags": rows,
        "services": services,
    })).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/services
// ---------------------------------------------------------------------------

pub async fn apm_services(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Query(q): Query<ServicesQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let pq = q.query.as_deref().map(parse_query).unwrap_or_default();
    let where_clause = build_where(start, end, &pq, None, None, None, None);

    let sql = format!(
        "SELECT \
            {SERVICE_EXPR} AS service_name, \
            COUNT(*) AS request_count, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            quantile(0.50)(response_duration) / 1000 AS p50_ms, \
            quantile(0.95)(response_duration) / 1000 AS p95_ms, \
            quantile(0.99)(response_duration) / 1000 AS p99_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_count, \
            if(request_count > 0, round(error_count / request_count * 100, 2), 0) AS error_rate_pct, \
            count(DISTINCT {TRACE_ID_EXPR}) AS trace_count, \
            min(time) AS first_seen, \
            max(time) AS last_seen \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} \
         GROUP BY service_name \
         HAVING service_name != '' \
         ORDER BY request_count DESC \
         LIMIT 50 FORMAT JSONEachRow"
    );

    let rows = ch_query(&client, &sql).await;
    Ok(Json(json!({ "services": rows })).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/operations
// ---------------------------------------------------------------------------

pub async fn apm_operations(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Query(q): Query<OperationsQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let pq = q.query.as_deref().map(parse_query).unwrap_or_default();
    let where_clause = build_where(start, end, &pq, q.service.as_deref(), None, None, None);

    let sql = format!(
        "SELECT \
            request_resource AS operation_name, \
            COUNT(*) AS request_count, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            quantile(0.95)(response_duration) / 1000 AS p95_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_count \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} AND request_resource != '' \
         GROUP BY operation_name \
         ORDER BY request_count DESC \
         LIMIT 100 FORMAT JSONEachRow"
    );

    let rows = ch_query(&client, &sql).await;
    Ok(Json(json!({ "operations": rows })).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/stats
// ---------------------------------------------------------------------------

pub async fn apm_stats(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Query(q): Query<StatsQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let pq = q.query.as_deref().map(parse_query).unwrap_or_default();
    let where_clause = build_where(start, end, &pq, q.service.as_deref(), None, None, None);

    // Overall stats
    let overall_sql = format!(
        "SELECT \
            COUNT(*) AS total_requests, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            quantile(0.50)(response_duration) / 1000 AS p50_ms, \
            quantile(0.95)(response_duration) / 1000 AS p95_ms, \
            quantile(0.99)(response_duration) / 1000 AS p99_ms, \
            max(response_duration) / 1000 AS max_latency_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_count, \
            if(total_requests > 0, round(error_count / total_requests * 100, 2), 0) AS error_rate_pct, \
            count(DISTINCT {TRACE_ID_EXPR}) AS trace_count, \
            count(DISTINCT {SERVICE_EXPR}) AS service_count \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} FORMAT JSONEachRow"
    );

    // Time-series: request rate per minute
    let rate_sql = format!(
        "SELECT \
            toStartOfMinute(time) AS ts, \
            COUNT(*) AS cnt, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_cnt \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} \
         GROUP BY ts \
         ORDER BY ts FORMAT JSONEachRow"
    );

    // Latency histogram
    let histogram_sql = format!(
        "SELECT \
            multiIf( \
                response_duration < 10000, '0–10ms', \
                response_duration < 50000, '10–50ms', \
                response_duration < 100000, '50–100ms', \
                response_duration < 250000, '100–250ms', \
                response_duration < 500000, '250–500ms', \
                response_duration < 1000000, '500ms–1s', \
                response_duration < 5000000, '1–5s', \
                '5s+' \
            ) AS bucket, \
            COUNT(*) AS cnt \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} \
         GROUP BY bucket \
         ORDER BY \
            multiIf( \
                bucket = '0–10ms', 1, \
                bucket = '10–50ms', 2, \
                bucket = '50–100ms', 3, \
                bucket = '100–250ms', 4, \
                bucket = '250–500ms', 5, \
                bucket = '500ms–1s', 6, \
                bucket = '1–5s', 7, \
                8 \
            ) FORMAT JSONEachRow"
    );

    let overall = ch_query(&client, &overall_sql).await;
    let rate = ch_query(&client, &rate_sql).await;
    let histogram = ch_query(&client, &histogram_sql).await;

    Ok(Json(json!({
        "overall": overall,
        "rate": rate,
        "latency_histogram": histogram,
    }))
    .into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/traces
// ---------------------------------------------------------------------------

pub async fn apm_traces(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Query(q): Query<TracesQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let limit = q.limit.unwrap_or(50).min(500);
    let offset = q.offset.unwrap_or(0);
    let sort_col = match q.sort.as_deref() {
        Some("duration") => "duration_us",
        Some("spans") => "span_count",
        _ => "start_time",
    };
    let sort_dir = match q.sort_dir.as_deref() {
        Some("asc") => "ASC",
        _ => "DESC",
    };

    // Parse query expression but allow individual params to override
    let mut pq = q.query.as_deref().map(parse_query).unwrap_or_default();
    if q.service.is_some() {
        pq.service = q.service;
    }
    if q.operation.is_some() {
        pq.operation = q.operation;
    }
    if q.status.is_some() {
        pq.status = q.status;
    }
    if q.min_duration_us.is_some() {
        pq.min_duration_us = q.min_duration_us;
    }
    if q.max_duration_us.is_some() {
        pq.max_duration_us = q.max_duration_us;
    }
    if q.trace_id.is_some() {
        pq.trace_id = q.trace_id;
    }

    let where_clause = build_where(start, end, &pq, None, None, None, None);

    // Use subquery to pre-compute synthetic trace_id, then count.
    let count_sql = format!(
        "SELECT COUNT() AS total FROM \
         (SELECT _trace_id FROM (SELECT {TRACE_ID_EXPR} AS _trace_id FROM flow_log.l7_flow_log WHERE {where_clause}) WHERE _trace_id != '' GROUP BY _trace_id) \
         FORMAT JSONEachRow"
    );

    let traces_sql = format!(
        "SELECT \
            _trace_id AS trace_id, \
            min(time) AS start_time, \
            max(time) AS end_time, \
            dateDiff('microsecond', min(time), max(time)) AS duration_us, \
            any(_svc) AS root_service, \
            any(request_resource) AS root_operation, \
            COUNT(*) AS span_count, \
            countIf(response_code >= 500 OR response_code = 0) AS error_span_count, \
            if(countIf(response_code >= 500 OR response_code = 0) > 0, 'error', 'ok') AS status, \
            groupArray(DISTINCT _svc) AS services, \
            any(app_instance) AS app_instance, \
            any(l7_protocol) AS l7_protocol, \
            any(biz_protocol) AS biz_protocol \
         FROM ( \
             SELECT *, \
                 {TRACE_ID_EXPR} AS _trace_id, \
                 {SERVICE_EXPR} AS _svc \
             FROM flow_log.l7_flow_log \
             WHERE {where_clause} \
         ) \
         WHERE _trace_id != '' \
         GROUP BY _trace_id \
         ORDER BY {sort_col} {sort_dir} \
         LIMIT {limit} OFFSET {offset} FORMAT JSONEachRow"
    );

    let count_result = ch_query(&client, &count_sql).await;
    let traces = ch_query(&client, &traces_sql).await;

    let total: i64 = count_result
        .as_array()
        .and_then(|a| a.first())
        .and_then(|r| r.get("total"))
        .and_then(val_i64)
        .unwrap_or(0);

    Ok(Json(json!({
        "traces": traces,
        "total": total,
        "limit": limit,
        "offset": offset,
    }))
    .into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/traces/:trace_id
// ---------------------------------------------------------------------------

pub async fn apm_trace_detail(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Path(trace_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let safe_tid = trace_id.replace('\'', "''");

    // Fetch all spans for this trace
    // Handle both real trace_ids and syscall-fallback trace_ids (prefixed with "sys-")
    let trace_filter = if let Some(hex_part) = trace_id.strip_prefix("sys-") {
        format!(
            "(trace_id = '{safe_tid}' OR hex(syscall_trace_id_request) = '{hex}')",
            safe_tid = safe_tid,
            hex = hex_part.replace('\'', "''")
        )
    } else {
        format!(
            "(trace_id = '{safe_tid}' OR toString(trace_id_index) = '{safe_tid}')",
            safe_tid = safe_tid
        )
    };

    let spans_sql = format!(
        "SELECT \
            {TRACE_ID_EXPR} AS trace_id, \
            {SPAN_ID_EXPR} AS span_id, \
            if({TRACE_ID_EXPR} != {SPAN_ID_EXPR} AND parent_span_id != '', parent_span_id, '') AS parent_span_id, \
            toString(span_kind) AS span_kind, \
            {SERVICE_EXPR} AS service_name, \
            request_resource AS operation_name, \
            request_type AS request_type, \
            response_duration AS duration_us, \
            response_code AS status_code, \
            response_status AS response_status, \
            response_exception AS error_message, \
            time AS start_time, \
            start_time AS start_time_us, \
            end_time AS end_time_us, \
            if(response_code >= 500 OR response_code = 0, 'error', 'ok') AS span_status, \
            toString(flow_id) AS flow_id, \
            request_domain AS request_domain, \
            endpoint AS endpoint, \
            app_service AS app_service_name, \
            app_instance AS app_instance, \
            x_request_id_0, \
            x_request_id_1, \
            attribute_names, \
            attribute_values, \
            toString(l7_protocol) AS l7_protocol, \
            biz_protocol, \
            syscall_trace_id_request, \
            syscall_trace_id_response \
         FROM flow_log.l7_flow_log \
         WHERE {trace_filter} \
         ORDER BY start_time_us ASC \
         LIMIT 10000 FORMAT JSONEachRow"
    );

    let spans = ch_query(&client, &spans_sql).await;
    let mut span_list = spans.as_array().cloned().unwrap_or_default();

    // Compute synthetic parent_span_id when none exist (no real trace headers).
    //
    // Strategies (in order):
    // 1. Syscall correlation: match syscall_trace_id_request → syscall_trace_id_response
    // 2. W3C trace: for traces with real trace_id but no parent_span_id, group unique
    //    span_ids within the trace — the outermost (first) span is root, others are its children.
    // 3. Fallback server/client: spans with syscall_resp != 0 are roots for resp == 0 spans
    {
        let mut any_real_parent = false;

        for span in &span_list {
            let pid = span.get("parent_span_id").and_then(|v| v.as_str()).unwrap_or("");
            if !pid.is_empty() && pid != "0" { any_real_parent = true; break; }
        }

        if !any_real_parent {
            // First, deduplicate by span_id: keep the entry with the longest duration
            let mut best_by_sid: std::collections::HashMap<String, (usize, i64)> = std::collections::HashMap::new();
            for (idx, span) in span_list.iter().enumerate() {
                let sid = span.get("span_id").and_then(|v| v.as_str()).unwrap_or("");
                let dur = span.get("duration_us")
                    .and_then(|v| val_i64(v))
                    .unwrap_or(0);
                if let Some(&(_, existing_dur)) = best_by_sid.get(sid) {
                    if dur > existing_dur {
                        best_by_sid.insert(sid.to_string(), (idx, dur));
                    }
                } else {
                    best_by_sid.insert(sid.to_string(), (idx, dur));
                }
            }

            // Get unique span_ids and sort by service + start_time to find the root
            let mut unique_spans: Vec<(String, String, String)> = Vec::new(); // (span_id, service, start_time)
            for (sid, &(_idx, _dur)) in &best_by_sid {
                let span = &span_list.iter().find(|s| s.get("span_id").and_then(|v| v.as_str()) == Some(sid));
                let svc = span.and_then(|s| s.get("service_name").and_then(|v| v.as_str())).unwrap_or("");
                let st = span.and_then(|s| s.get("start_time_us").and_then(|v| v.as_str())).unwrap_or("");
                unique_spans.push((sid.clone(), svc.to_string(), st.to_string()));
            }

            let mut linked: usize;
            // Strategy 1: Syscall correlation
            {
                let mut resp_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
                for span in &span_list {
                    let resp = span.get("syscall_trace_id_response")
                        .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                        .unwrap_or(0);
                    if resp != 0 {
                        if let Some(sid) = span.get("span_id").and_then(|v| v.as_str()) {
                            resp_map.entry(resp.to_string()).or_default().push(sid.to_string());
                        }
                    }
                }

                linked = 0usize;
                for span in &mut span_list {
                    let req = span.get("syscall_trace_id_request")
                        .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                        .unwrap_or(0);
                    if req == 0 { continue; }
                    if let Some(parents) = resp_map.get(&req.to_string()) {
                        let own_sid = span.get("span_id").and_then(|v| v.as_str()).unwrap_or("");
                        if let Some(parent_sid) = parents.iter().find(|p| *p != own_sid) {
                            if let Some(obj) = span.as_object_mut() {
                                obj.insert("parent_span_id".to_string(), serde_json::Value::String(parent_sid.clone()));
                                linked += 1;
                            }
                        }
                    }
                }
            }

            // Strategy 2: Time-envelope nesting.
            // A span B is a child of span A iff:
            //   A.start_time <= B.start_time  AND  A.end_time >= B.end_time
            //   AND A.span_id != B.span_id
            // Among all potential parents, pick the tightest-enclosing one
            // (smallest time interval that still contains B).
            // This guarantees: parent fully contains child in the time dimension.
            if unique_spans.len() >= 2 {
                // Build time info for each unique span: (span_id, start_us, end_us)
                // start_time_us is stored in the "start_time_us" or "start_time" field
                let mut span_times: Vec<(String, i64, i64)> = Vec::new(); // (sid, start_us, end_us)
                for span in &span_list {
                    let sid = span.get("span_id").and_then(|v| v.as_str()).unwrap_or("");
                    if span_times.iter().any(|(s, _, _)| s == sid) { continue; }
                    let start = span.get("start_time_us")
                        .and_then(|v| v.as_str())
                        .and_then(|s| parse_time_us(s))
                        .or_else(|| {
                            // Fallback: parse "start_time" (DateTime string without micros)
                            span.get("start_time").and_then(|v| v.as_str()).and_then(|s| {
                                parse_time_us(&format!("{}.0", s))
                            })
                        })
                        .unwrap_or(0);
                    let dur = span.get("duration_us").and_then(|v| val_i64(v)).unwrap_or(0);
                    let end = if dur > 0 { start + dur } else { start + 1000 }; // min 1ms for nesting
                    span_times.push((sid.to_string(), start, end));
                }

                // Sort by start ascending, then by end descending (largest envelope first)
                span_times.sort_by(|a, b| a.1.cmp(&b.1).then(b.2.cmp(&a.2)));

                // For each span, find its tightest-enclosing parent
                for span in &mut span_list {
                    let own_sid = span.get("span_id").and_then(|v| v.as_str()).unwrap_or("");
                    let existing_pid = span.get("parent_span_id").and_then(|v| v.as_str()).unwrap_or("");
                    if !existing_pid.is_empty() { continue; }

                    if let Some(&(_, ref own_start, ref own_end)) = span_times.iter().find(|(s, _, _)| s == own_sid) {
                        // Find candidates: earlier spans that fully contain this one
                        let mut best: Option<(&str, i64)> = None; // (parent_sid, tightness)
                        for (pid, p_start, p_end) in &span_times {
                            if pid == own_sid { continue; }
                            if *p_start <= *own_start && *p_end >= *own_end {
                                // Encloses — pick tightest (smallest parent interval)
                                let tightness = *p_end - *p_start;
                                if best.is_none() || tightness < best.unwrap().1 {
                                    best = Some((pid, tightness));
                                }
                            }
                        }
                        if let Some((parent_sid, _)) = best {
                            if let Some(obj) = span.as_object_mut() {
                                obj.insert("parent_span_id".to_string(), serde_json::Value::String(parent_sid.to_string()));
                                linked = 1;
                            }
                        }
                    }
                }
            }

            // Strategy 3: Server/client heuristic for syscall traces
            if linked == 0 && unique_spans.len() < 2 {
                let server_spans: Vec<String> = span_list.iter()
                    .filter_map(|s| {
                        let resp = s.get("syscall_trace_id_response")
                            .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s2| s2.parse().ok())))
                            .unwrap_or(0);
                        if resp != 0 { s.get("span_id").and_then(|v| v.as_str().map(|x| x.to_string())) }
                        else { None }
                    })
                    .collect();

                if !server_spans.is_empty() {
                    let default_parent = &server_spans[0];
                    for span in &mut span_list {
                        let resp = span.get("syscall_trace_id_response")
                            .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s2| s2.parse().ok())))
                            .unwrap_or(0);
                        let own_sid = span.get("span_id").and_then(|v| v.as_str()).unwrap_or("");
                        if resp == 0 && !server_spans.contains(&own_sid.to_string()) {
                            if let Some(obj) = span.as_object_mut() {
                                obj.insert("parent_span_id".to_string(), serde_json::Value::String(default_parent.clone()));
                            }
                        }
                    }
                }
            }
        }
    }

    // Build trace summary
    let first_span = span_list.first();
    let last_span = span_list.last();

    let start_time = first_span
        .and_then(|s| s.get("start_time"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let end_time = last_span
        .and_then(|s| s.get("start_time"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let root_service = span_list
        .iter()
        .find(|s| {
            let parent = s.get("parent_span_id").and_then(|v| v.as_str()).unwrap_or("");
            parent.is_empty() || parent == "0"
        })
        .and_then(|s| s.get("service_name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let error_count = span_list
        .iter()
        .filter(|s| s.get("span_status").and_then(|v| v.as_str()) == Some("error"))
        .count();

    // Duration from first to last span
    let duration_us: i64 = if let (Some(first), Some(last)) = (first_span, last_span) {
        let t1 = first
            .get("start_time_us")
            .and_then(|v| v.as_str())
            .and_then(|s| parse_time_us(s))
            .unwrap_or(0);
        let t2 = last
            .get("start_time_us")
            .and_then(|v| v.as_str())
            .and_then(|s| parse_time_us(s))
            .unwrap_or(0);
        (t2 - t1).max(0)
    } else {
        0
    };

    // Collect all unique services and attribute keys
    let mut services: Vec<String> = Vec::new();
    let mut tag_keys: Vec<String> = Vec::new();
    let mut seen_svc = std::collections::HashSet::new();
    let mut seen_tags = std::collections::HashSet::new();

    for span in &span_list {
        if let Some(svc) = span.get("service_name").and_then(|v| v.as_str()) {
            if !svc.is_empty() && seen_svc.insert(svc.to_string()) {
                services.push(svc.to_string());
            }
        }
        if let Some(arr) = span.get("attribute_names").and_then(|v| v.as_array()) {
            for name in arr {
                if let Some(n) = name.as_str() {
                    if seen_tags.insert(n.to_string()) {
                        tag_keys.push(n.to_string());
                    }
                }
            }
        }
    }

    Ok(Json(json!({
        "trace_id": trace_id,
        "start_time": start_time,
        "end_time": end_time,
        "duration_us": duration_us,
        "root_service": root_service,
        "span_count": span_list.len(),
        "error_count": error_count,
        "status": if error_count > 0 { "error" } else { "ok" },
        "services": services,
        "tag_keys": tag_keys,
        "spans": span_list,
    }))
    .into_response())
}

/// Parse a ClickHouse DateTime64 string to microseconds
fn parse_time_us(s: &str) -> Option<i64> {
    // Format: "2026-06-09 19:22:37.670296"
    if let Some(dot_pos) = s.find('.') {
        let secs_part = &s[..dot_pos];
        let micros_part = &s[dot_pos + 1..];
        let dt = chrono::NaiveDateTime::parse_from_str(secs_part, "%Y-%m-%d %H:%M:%S").ok()?;
        let micros: i64 = micros_part
            .chars()
            .take(6)
            .collect::<String>()
            .parse()
            .unwrap_or(0);
        Some(dt.and_utc().timestamp_micros() + micros)
    } else {
        let dt = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok()?;
        Some(dt.and_utc().timestamp_micros())
    }
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/spans/:span_id
// ---------------------------------------------------------------------------

pub async fn apm_span_detail(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Path(span_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let safe_sid = span_id.replace('\'', "''");

    let sql = format!(
        "SELECT \
            {TRACE_ID_EXPR} AS trace_id, \
            {SPAN_ID_EXPR} AS span_id, \
            parent_span_id, \
            toString(span_kind) AS span_kind, \
            {SERVICE_EXPR} AS service_name, \
            request_resource AS operation_name, \
            request_type AS request_type, \
            response_duration AS duration_us, \
            response_code AS status_code, \
            response_status AS response_status, \
            response_exception AS error_message, \
            time AS start_time, \
            start_time AS start_time_us, \
            end_time AS end_time_us, \
            syscall_trace_id_request, \
            syscall_trace_id_response, \
            toString(flow_id) AS flow_id, \
            request_domain AS request_domain, \
            app_instance AS app_instance, \
            x_request_id_0, \
            x_request_id_1, \
            attribute_names, \
            attribute_values \
         FROM flow_log.l7_flow_log \
         WHERE (span_id = '{safe_sid}' OR toString(flow_id) = '{safe_sid}') \
         LIMIT 1 FORMAT JSONEachRow"
    );

    let rows = ch_query(&client, &sql).await;
    let span = rows
        .as_array()
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or(Value::Null);

    Ok(Json(json!({ "span": span })).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/services/:service_name — details for a single service
// ---------------------------------------------------------------------------

pub async fn apm_service_detail(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Path(service_name): Path<String>,
    Query(q): Query<StatsQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let pq = q.query.as_deref().map(parse_query).unwrap_or_default();
    let safe_svc = service_name.replace('\'', "''");
    let where_clause = build_where(start, end, &pq, Some(&safe_svc), None, None, None);

    // Service overview
    let overview_sql = format!(
        "SELECT \
            COUNT(*) AS total_requests, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            quantile(0.95)(response_duration) / 1000 AS p95_ms, \
            quantile(0.99)(response_duration) / 1000 AS p99_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_count, \
            if(total_requests > 0, round(error_count / total_requests * 100, 2), 0) AS error_rate_pct \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} FORMAT JSONEachRow"
    );

    // Top operations
    let ops_sql = format!(
        "SELECT \
            request_resource AS operation_name, \
            COUNT(*) AS cnt, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            quantile(0.95)(response_duration) / 1000 AS p95_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_count \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} \
         GROUP BY operation_name \
         ORDER BY cnt DESC \
         LIMIT 20 FORMAT JSONEachRow"
    );

    // Rate per minute
    let rate_sql = format!(
        "SELECT \
            toStartOfMinute(time) AS ts, \
            COUNT(*) AS cnt, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_cnt \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} \
         GROUP BY ts \
         ORDER BY ts FORMAT JSONEachRow"
    );

    let overview = ch_query(&client, &overview_sql).await;
    let operations = ch_query(&client, &ops_sql).await;
    let rate = ch_query(&client, &rate_sql).await;

    Ok(Json(json!({
        "service_name": service_name,
        "overview": overview,
        "operations": operations,
        "rate": rate,
    })).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/topology — service dependency graph
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
pub struct TopologyQuery {
    pub query: Option<String>,
    pub service: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
}

pub async fn apm_topology(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Query(q): Query<TopologyQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let pq = q.query.as_deref().map(parse_query).unwrap_or_default();
    let where_clause = build_where(start, end, &pq, q.service.as_deref(), None, None, None);

    // Service-to-service edges: correlation via syscall_trace_id
    // When service A calls service B: A.syscall_trace_id_request == B.syscall_trace_id_response
    // Also try span parent-child for services that do have real trace context
    let edges_sql = format!(
        "SELECT \
            source, \
            target, \
            SUM(call_count) AS call_count, \
            AVG(avg_latency) / 1000 AS avg_latency_ms, \
            max(p95_latency) / 1000 AS p95_latency_ms, \
            SUM(error_count) AS error_count \
         FROM ( \
             SELECT \
                 {Q_SERVICE_EXPR_A} AS source, \
                 {Q_SERVICE_EXPR_B} AS target, \
                 COUNT(*) AS call_count, \
                 AVG(b.response_duration) AS avg_latency, \
                 quantile(0.95)(b.response_duration) AS p95_latency, \
                 countIf(b.response_code >= 500 OR b.response_code = 0) AS error_count \
             FROM flow_log.l7_flow_log AS a \
             INNER JOIN flow_log.l7_flow_log AS b \
                 ON a.syscall_trace_id_request = b.syscall_trace_id_response \
                 AND a.syscall_trace_id_request != 0 \
                 AND b.syscall_trace_id_response != 0 \
             WHERE a.time >= toDateTime({start}) AND a.time <= toDateTime({end}) \
               AND b.time >= toDateTime({start}) AND b.time <= toDateTime({end}) \
               AND {Q_SERVICE_EXPR_A} != '' AND {Q_SERVICE_EXPR_B} != '' \
               AND {Q_SERVICE_EXPR_A} != {Q_SERVICE_EXPR_B} \
             GROUP BY source, target \
             UNION ALL \
             SELECT \
                 {Q_SERVICE_EXPR_P} AS source, \
                 {Q_SERVICE_EXPR_C} AS target, \
                 COUNT(*) AS call_count, \
                 AVG(c.response_duration) AS avg_latency, \
                 quantile(0.95)(c.response_duration) AS p95_latency, \
                 countIf(c.response_code >= 500 OR c.response_code = 0) AS error_count \
             FROM flow_log.l7_flow_log AS c \
             INNER JOIN flow_log.l7_flow_log AS p \
                 ON c.parent_span_id = p.span_id \
                 AND c.trace_id = p.trace_id \
             WHERE p.time >= toDateTime({start}) AND p.time <= toDateTime({end}) \
               AND c.time >= toDateTime({start}) AND c.time <= toDateTime({end}) \
               AND c.parent_span_id != '' AND c.parent_span_id != '0' \
               AND {Q_SERVICE_EXPR_P} != '' AND {Q_SERVICE_EXPR_C} != '' \
               AND {Q_SERVICE_EXPR_P} != {Q_SERVICE_EXPR_C} \
             GROUP BY source, target \
         ) \
         GROUP BY source, target \
         HAVING call_count >= 1 \
         ORDER BY call_count DESC \
         LIMIT 200 FORMAT JSONEachRow"
    );

    // Node stats: per-service summaries
    let nodes_sql = format!(
        "SELECT \
            {SERVICE_EXPR} AS service_name, \
            COUNT(*) AS request_count, \
            AVG(response_duration) / 1000 AS avg_latency_ms, \
            quantile(0.95)(response_duration) / 1000 AS p95_latency_ms, \
            quantile(0.99)(response_duration) / 1000 AS p99_latency_ms, \
            countIf(response_code >= 500 OR response_code = 0) AS error_count, \
            if(request_count > 0, round(error_count / request_count * 100, 2), 0) AS error_rate_pct \
         FROM flow_log.l7_flow_log \
         WHERE {where_clause} AND {SERVICE_EXPR} != '' \
         GROUP BY service_name \
         ORDER BY request_count DESC \
         LIMIT 100 FORMAT JSONEachRow"
    );

    let edges = ch_query(&client, &edges_sql).await;
    let nodes = ch_query(&client, &nodes_sql).await;

    Ok(Json(json!({
        "nodes": nodes,
        "edges": edges,
    })).into_response())
}

// ---------------------------------------------------------------------------
// GET /api/v1/apm/services/:service_name/dependencies — upstream/downstream
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
pub struct DependenciesQuery {
    pub query: Option<String>,
    pub start: Option<i64>,
    pub end: Option<i64>,
}

pub async fn apm_service_dependencies(
    State(_pool): State<DbPool>,
    _auth: AuthContext,
    Path(service_name): Path<String>,
    Query(q): Query<DependenciesQuery>,
) -> Result<axum::response::Response, AppError> {
    let client = ch_client()?;

    let start = q.start.unwrap_or(default_window().0);
    let end = q.end.unwrap_or(default_window().1);
    let safe_svc = service_name.replace('\'', "''");

    // Downstream: services THIS service calls
    // Use syscall_trace_id correlation: this service's request side matched to target's response side
    let downstream_sql = format!(
        "SELECT \
            target AS downstream_service, \
            SUM(call_count) AS call_count, \
            AVG(avg_latency_ms) AS avg_latency_ms, \
            max(p95_latency_ms) AS p95_latency_ms, \
            SUM(error_count) AS error_count \
         FROM ( \
             SELECT \
                 {Q_SERVICE_EXPR_B} AS target, \
                 COUNT(*) AS call_count, \
                 AVG(b.response_duration) / 1000 AS avg_latency_ms, \
                 quantile(0.95)(b.response_duration) / 1000 AS p95_latency_ms, \
                 countIf(b.response_code >= 500 OR b.response_code = 0) AS error_count \
             FROM flow_log.l7_flow_log AS a \
             INNER JOIN flow_log.l7_flow_log AS b \
                 ON a.syscall_trace_id_request = b.syscall_trace_id_response \
                 AND a.syscall_trace_id_request != 0 \
                 AND b.syscall_trace_id_response != 0 \
             WHERE a.time >= toDateTime({start}) AND a.time <= toDateTime({end}) \
               AND b.time >= toDateTime({start}) AND b.time <= toDateTime({end}) \
               AND {Q_SERVICE_EXPR_A} = '{safe_svc}' \
               AND {Q_SERVICE_EXPR_B} != '' AND {Q_SERVICE_EXPR_B} != '{safe_svc}' \
             GROUP BY target \
             UNION ALL \
             SELECT \
                 {Q_SERVICE_EXPR_C} AS target, \
                 COUNT(*) AS call_count, \
                 AVG(c.response_duration) / 1000 AS avg_latency_ms, \
                 quantile(0.95)(c.response_duration) / 1000 AS p95_latency_ms, \
                 countIf(c.response_code >= 500 OR c.response_code = 0) AS error_count \
             FROM flow_log.l7_flow_log AS c \
             INNER JOIN flow_log.l7_flow_log AS p \
                 ON c.parent_span_id = p.span_id \
                 AND c.trace_id = p.trace_id \
             WHERE p.time >= toDateTime({start}) AND p.time <= toDateTime({end}) \
               AND c.time >= toDateTime({start}) AND c.time <= toDateTime({end}) \
               AND c.parent_span_id != '' AND c.parent_span_id != '0' \
               AND {Q_SERVICE_EXPR_P} = '{safe_svc}' \
               AND {Q_SERVICE_EXPR_C} != '' AND {Q_SERVICE_EXPR_C} != '{safe_svc}' \
             GROUP BY target \
         ) \
         GROUP BY downstream_service \
         ORDER BY call_count DESC \
         LIMIT 30 FORMAT JSONEachRow"
    );

    // Upstream: services that call THIS service
    // Use syscall_trace_id correlation: caller's request side matched to our response side
    let upstream_sql = format!(
        "SELECT \
            source AS upstream_service, \
            SUM(call_count) AS call_count, \
            AVG(avg_latency_ms) AS avg_latency_ms, \
            max(p95_latency_ms) AS p95_latency_ms, \
            SUM(error_count) AS error_count \
         FROM ( \
             SELECT \
                 {Q_SERVICE_EXPR_A} AS source, \
                 COUNT(*) AS call_count, \
                 AVG(b.response_duration) / 1000 AS avg_latency_ms, \
                 quantile(0.95)(b.response_duration) / 1000 AS p95_latency_ms, \
                 countIf(b.response_code >= 500 OR b.response_code = 0) AS error_count \
             FROM flow_log.l7_flow_log AS a \
             INNER JOIN flow_log.l7_flow_log AS b \
                 ON a.syscall_trace_id_request = b.syscall_trace_id_response \
                 AND a.syscall_trace_id_request != 0 \
                 AND b.syscall_trace_id_response != 0 \
             WHERE a.time >= toDateTime({start}) AND a.time <= toDateTime({end}) \
               AND b.time >= toDateTime({start}) AND b.time <= toDateTime({end}) \
               AND {Q_SERVICE_EXPR_B} = '{safe_svc}' \
               AND {Q_SERVICE_EXPR_A} != '' AND {Q_SERVICE_EXPR_A} != '{safe_svc}' \
             GROUP BY source \
             UNION ALL \
             SELECT \
                 {Q_SERVICE_EXPR_P} AS source, \
                 COUNT(*) AS call_count, \
                 AVG(c.response_duration) / 1000 AS avg_latency_ms, \
                 quantile(0.95)(c.response_duration) / 1000 AS p95_latency_ms, \
                 countIf(c.response_code >= 500 OR c.response_code = 0) AS error_count \
             FROM flow_log.l7_flow_log AS c \
             INNER JOIN flow_log.l7_flow_log AS p \
                 ON c.parent_span_id = p.span_id \
                 AND c.trace_id = p.trace_id \
             WHERE p.time >= toDateTime({start}) AND p.time <= toDateTime({end}) \
               AND c.time >= toDateTime({start}) AND c.time <= toDateTime({end}) \
               AND c.parent_span_id != '' AND c.parent_span_id != '0' \
               AND {Q_SERVICE_EXPR_C} = '{safe_svc}' \
               AND {Q_SERVICE_EXPR_P} != '' AND {Q_SERVICE_EXPR_P} != '{safe_svc}' \
             GROUP BY source \
         ) \
         GROUP BY upstream_service \
         ORDER BY call_count DESC \
         LIMIT 30 FORMAT JSONEachRow"
    );

    let downstream = ch_query(&client, &downstream_sql).await;
    let upstream = ch_query(&client, &upstream_sql).await;

    Ok(Json(json!({
        "service_name": service_name,
        "downstream": downstream,
        "upstream": upstream,
    })).into_response())
}
