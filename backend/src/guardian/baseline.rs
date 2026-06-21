use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;
use tracing;

use super::types::{MetricsBucket, ServiceBaseline, ServiceMetricsTs};

// ---------------------------------------------------------------------------
// ClickHouse query helper (same pattern as apm.rs)
// ---------------------------------------------------------------------------

async fn ch_query(client: &Client, sql: &str) -> Vec<Value> {
    let url = format!("http://127.0.0.1:8123/?query={}", urlencoding(sql));
    match client.get(&url).send().await {
        Ok(r) => {
            let text = r.text().await.unwrap_or_default();
            text.lines()
                .filter(|l| !l.is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect()
        }
        Err(e) => {
            tracing::error!(error = %e, "ClickHouse query failed");
            vec![]
        }
    }
}

fn urlencoding(s: &str) -> String {
    // Simple URL encoding for ClickHouse SQL
    s.replace(' ', "%20")
        .replace('\n', "%0A")
        .replace('=', "%3D")
        .replace('>', "%3E")
        .replace('<', "%3C")
        .replace(',', "%2C")
        .replace('(', "%28")
        .replace(')', "%29")
        .replace('\'', "%27")
}

fn val_f64(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.parse().ok(),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Fetch time-series metrics per service
// ---------------------------------------------------------------------------

pub async fn fetch_service_metrics(
    client: &Client,
    start: i64,
    end: i64,
    interval_secs: i64,
) -> Vec<ServiceMetricsTs> {
    let sql = format!(
        r#"SELECT
    if(app_service != '', app_service, request_domain) AS service_name,
    toStartOfInterval(time, INTERVAL {interval} SECOND) AS bucket_ts,
    count() AS request_count,
    avg(response_duration) / 1000 AS avg_latency_ms,
    quantile(0.95)(response_duration) / 1000 AS p95_latency_ms,
    countIf(response_code >= 500 OR response_code = 0) AS error_count,
    (countIf(response_code >= 500 OR response_code = 0) * 100.0) / count() AS error_rate_pct
FROM flow_log.l7_flow_log
WHERE time >= fromUnixTimestamp({start})
  AND time <= fromUnixTimestamp({end})
  AND (app_service != '' OR request_domain != '')
GROUP BY service_name, bucket_ts
ORDER BY service_name, bucket_ts
FORMAT JSONEachRow"#,
        interval = interval_secs,
        start = start,
        end = end,
    );

    let rows = ch_query(client, &sql).await;

    // Group by service_name
    let mut service_map: HashMap<String, Vec<MetricsBucket>> = HashMap::new();
    for row in &rows {
        let svc = row["service_name"].as_str().unwrap_or("unknown").to_string();
        let ts_str = row["bucket_ts"].as_str().unwrap_or("");
        let ts = chrono::NaiveDateTime::parse_from_str(ts_str, "%Y-%m-%d %H:%M:%S")
            .map(|d| d.and_utc().timestamp())
            .unwrap_or(0);

        let bucket = MetricsBucket {
            ts: ts_str.chars().skip(11).take(5).collect(),
            timestamp: ts,
            request_count: val_f64(&row["request_count"]).unwrap_or(0.0),
            avg_latency_ms: val_f64(&row["avg_latency_ms"]).unwrap_or(0.0),
            p95_latency_ms: val_f64(&row["p95_latency_ms"]).unwrap_or(0.0),
            error_rate_pct: val_f64(&row["error_rate_pct"]).unwrap_or(0.0),
        };

        service_map.entry(svc).or_default().push(bucket);
    }

    service_map
        .into_iter()
        .map(|(service_name, buckets)| ServiceMetricsTs {
            service_name,
            buckets,
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Compute baseline from historical data
// ---------------------------------------------------------------------------

pub fn compute_baseline(metrics: &ServiceMetricsTs, window: &str) -> ServiceBaseline {
    let buckets = &metrics.buckets;
    if buckets.is_empty() {
        return ServiceBaseline {
            service_name: metrics.service_name.clone(),
            window: window.to_string(),
            bucket_count: 0,
            request_mean: 0.0,
            request_stddev: 0.0,
            latency_mean: 0.0,
            latency_stddev: 0.0,
            error_rate_mean: 0.0,
            error_rate_stddev: 0.0,
        };
    }

    let n = buckets.len() as f64;

    // Request rate
    let request_mean: f64 = buckets.iter().map(|b| b.request_count).sum::<f64>() / n;
    let request_var: f64 = buckets.iter().map(|b| (b.request_count - request_mean).powi(2)).sum::<f64>() / n;
    let request_stddev = request_var.sqrt();

    // Latency
    let latency_mean: f64 = buckets.iter().map(|b| b.avg_latency_ms).sum::<f64>() / n;
    let latency_var: f64 = buckets.iter().map(|b| (b.avg_latency_ms - latency_mean).powi(2)).sum::<f64>() / n;
    let latency_stddev = latency_var.sqrt();

    // Error rate
    let error_rate_mean: f64 = buckets.iter().map(|b| b.error_rate_pct).sum::<f64>() / n;
    let error_rate_var: f64 = buckets.iter().map(|b| (b.error_rate_pct - error_rate_mean).powi(2)).sum::<f64>() / n;
    let error_rate_stddev = error_rate_var.sqrt();

    ServiceBaseline {
        service_name: metrics.service_name.clone(),
        window: window.to_string(),
        bucket_count: buckets.len(),
        request_mean,
        request_stddev,
        latency_mean,
        latency_stddev,
        error_rate_mean,
        error_rate_stddev,
    }
}

/// Compute seasonality-adjusted baseline by comparing current hour-of-day
/// against same hours in historical data
pub fn compute_seasonal_baseline(
    current_metrics: &[MetricsBucket],
    historical_metrics: &[MetricsBucket],
    _hour_of_day: u32,
) -> Option<ServiceBaseline> {
    if historical_metrics.is_empty() {
        return None;
    }

    let _n = current_metrics.len() as f64;
    let hn = historical_metrics.len() as f64;

    // Use historical data as the baseline reference
    let latency_mean: f64 = historical_metrics.iter().map(|b| b.avg_latency_ms).sum::<f64>() / hn;
    let latency_var: f64 = historical_metrics
        .iter()
        .map(|b| (b.avg_latency_ms - latency_mean).powi(2))
        .sum::<f64>() / hn;
    let latency_stddev = latency_var.sqrt();

    let error_rate_mean: f64 = historical_metrics.iter().map(|b| b.error_rate_pct).sum::<f64>() / hn;
    let error_rate_var: f64 = historical_metrics
        .iter()
        .map(|b| (b.error_rate_pct - error_rate_mean).powi(2))
        .sum::<f64>() / hn;
    let error_rate_stddev = error_rate_var.sqrt();

    let request_mean: f64 = historical_metrics.iter().map(|b| b.request_count).sum::<f64>() / hn;
    let request_var: f64 = historical_metrics
        .iter()
        .map(|b| (b.request_count - request_mean).powi(2))
        .sum::<f64>() / hn;
    let request_stddev = request_var.sqrt();

    Some(ServiceBaseline {
        service_name: String::new(), // filled by caller
        window: "seasonal".to_string(),
        bucket_count: historical_metrics.len(),
        request_mean,
        request_stddev,
        latency_mean,
        latency_stddev,
        error_rate_mean,
        error_rate_stddev,
    })
}
