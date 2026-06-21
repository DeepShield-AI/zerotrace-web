use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Metric snapshots from ClickHouse
// ---------------------------------------------------------------------------

/// Per-service metrics for a single time bucket
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetrics {
    pub service_name: String,
    pub request_count: f64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub p99_latency_ms: f64,
    pub error_count: f64,
    pub error_rate_pct: f64,
}

/// Time-series metrics for a single service over multiple buckets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetricsTs {
    pub service_name: String,
    pub buckets: Vec<MetricsBucket>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsBucket {
    pub ts: String,          // time label "HH:MM"
    pub timestamp: i64,      // unix seconds
    pub request_count: f64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub error_rate_pct: f64,
}

// ---------------------------------------------------------------------------
// Baselines
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceBaseline {
    pub service_name: String,
    pub window: String,          // "1h", "24h", "7d"
    pub bucket_count: usize,
    // Request rate
    pub request_mean: f64,
    pub request_stddev: f64,
    // Latency
    pub latency_mean: f64,
    pub latency_stddev: f64,
    // Error rate
    pub error_rate_mean: f64,
    pub error_rate_stddev: f64,
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    pub id: String,
    pub service_name: String,
    pub metric: AnomalyMetric,
    pub category: AnomalyCategory,
    pub current_value: f64,
    pub baseline_mean: f64,
    pub baseline_stddev: f64,
    pub z_score: f64,
    pub severity: Severity,
    pub detected_at: i64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AnomalyMetric {
    Latency,
    ErrorRate,
    RequestRate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AnomalyCategory {
    Spike,
    Drop,
    Drift,
    NewError,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Severity {
    Critical,
    Warning,
    Info,
}

impl Severity {
    pub fn from_z_score(z: f64) -> Self {
        if z >= 3.0 {
            Severity::Critical
        } else if z >= 2.0 {
            Severity::Warning
        } else {
            Severity::Info
        }
    }
}

// ---------------------------------------------------------------------------
// Root Cause Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RootCause {
    /// A specific upstream service is the likely cause
    DependencyFailure {
        upstream_service: String,
        evidence: String,
    },
    /// Traffic spike from clients
    TrafficSpike {
        factor: f64,         // how many times normal
        evidence: String,
    },
    /// Internal service degradation (code change, resource exhaustion)
    InternalDegradation {
        evidence: String,
    },
    /// Multiple services affected simultaneously
    WidespreadOutage {
        affected_count: usize,
        evidence: String,
    },
    /// Could not determine root cause
    Unknown {
        evidence: String,
    },
}

// ---------------------------------------------------------------------------
// Story (final output)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub detected_at: i64,
    pub anomalies: Vec<Anomaly>,
    pub affected_services: Vec<String>,
    pub root_cause: RootCause,
    pub suggested_actions: Vec<String>,
    pub evidence: StoryEvidence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryEvidence {
    pub baseline_window: String,
    pub analysis_window: String,
    pub total_services_analyzed: usize,
    pub anomalies_detected: usize,
}

// ---------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AnalyzeRequest {
    pub start: Option<i64>,
    pub end: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AnalyzeResponse {
    pub stories: Vec<Story>,
    pub analyzed_services: usize,
    pub analysis_window_secs: i64,
}

#[derive(Debug, Serialize)]
pub struct StoryListResponse {
    pub stories: Vec<StorySummary>,
}

#[derive(Debug, Serialize)]
pub struct StorySummary {
    pub id: String,
    pub title: String,
    pub severity: Severity,
    pub detected_at: i64,
    pub affected_services: Vec<String>,
    pub anomaly_count: usize,
}
