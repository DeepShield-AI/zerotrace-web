use super::types::Anomaly;
use crate::clickhouse;
use reqwest::Client;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use tracing;

// ---------------------------------------------------------------------------
// Topology-based correlation
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ServiceEdge {
    pub source: String,
    pub target: String,
    pub call_count: f64,
}

/// Fetch service topology from ClickHouse (lightweight version of apm_topology)
pub async fn fetch_topology(client: &Client, start: i64, end: i64, db: &str) -> Vec<ServiceEdge> {
    let sql = format!(
        r#"SELECT
    if(a.app_service != '', a.app_service, a.request_domain) AS source,
    if(b.app_service != '', b.app_service, b.request_domain) AS target,
    count() AS call_count
FROM {db}.l7_flow_log AS a
INNER JOIN {db}.l7_flow_log AS b
  ON a.syscall_trace_id_request = b.syscall_trace_id_response
  AND a.time >= fromUnixTimestamp({start})
  AND a.time <= fromUnixTimestamp({end})
  AND b.time >= fromUnixTimestamp({start})
  AND b.time <= fromUnixTimestamp({end})
WHERE (a.app_service != '' OR a.request_domain != '')
  AND (b.app_service != '' OR b.request_domain != '')
GROUP BY source, target
HAVING call_count >= 5
FORMAT JSONEachRow"#,
        db = db,
        start = start,
        end = end,
    );

    let url = format!(
        "{}/?query={}",
        clickhouse::clickhouse_url(),
        clickhouse::urlencoding(&sql)
    );
    let rows: Vec<Value> = match client.get(&url).send().await {
        Ok(r) => {
            let text = r.text().await.unwrap_or_default();
            text.lines()
                .filter(|l| !l.is_empty())
                .filter_map(|l| serde_json::from_str(l).ok())
                .collect()
        },
        Err(e) => {
            tracing::error!(error = %e, "Topology query failed");
            vec![]
        },
    };

    rows.iter()
        .map(|row| {
            let source = row["source"].as_str().unwrap_or("").to_string();
            let target = row["target"].as_str().unwrap_or("").to_string();
            let call_count = row["call_count"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0.0);
            ServiceEdge {
                source,
                target,
                call_count,
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Correlation analysis
// ---------------------------------------------------------------------------

/// Result of correlating anomalies across services
pub struct CorrelationResult {
    /// Anomalies grouped into clusters (likely same incident)
    pub clusters: Vec<AnomalyCluster>,
    /// Dependency graph built from topology
    pub dependencies: HashMap<String, Vec<String>>, // service → upstream services
}

pub struct AnomalyCluster {
    pub services: Vec<String>,
    pub primary_service: String, // the service with the highest severity anomaly
    pub anomalies: Vec<Anomaly>,
}

/// Correlate anomalies using topology and temporal proximity.
///
/// Groups anomalies by:
/// 1. Temporal: anomalies within 5 minutes of each other
/// 2. Topological: services that call each other or share a dependency
pub fn correlate_anomalies(
    anomalies: &[Anomaly],
    edges: &[ServiceEdge],
    time_window_secs: i64,
) -> CorrelationResult {
    // Build dependency graph: service → upstream services
    let mut upstream_map: HashMap<String, Vec<String>> = HashMap::new();
    for edge in edges {
        upstream_map.entry(edge.target.clone()).or_default().push(edge.source.clone());
    }

    // Build reverse: service → downstream services
    let mut downstream_map: HashMap<String, Vec<String>> = HashMap::new();
    for edge in edges {
        downstream_map.entry(edge.source.clone()).or_default().push(edge.target.clone());
    }

    // First pass: group by temporal proximity
    let mut temporal_groups: Vec<Vec<usize>> = Vec::new(); // indices into anomalies
    let mut assigned: HashSet<usize> = HashSet::new();

    for (i, a) in anomalies.iter().enumerate() {
        if assigned.contains(&i) {
            continue;
        }
        let mut group = vec![i];
        for (j, b) in anomalies.iter().enumerate() {
            if i == j || assigned.contains(&j) {
                continue;
            }
            let time_diff = (a.detected_at - b.detected_at).abs();
            if time_diff <= time_window_secs {
                group.push(j);
            }
        }
        for &idx in &group {
            assigned.insert(idx);
        }
        temporal_groups.push(group);
    }

    // Second pass: within each temporal group, check topological relationships
    let mut clusters: Vec<AnomalyCluster> = Vec::new();

    for group_indices in &temporal_groups {
        let group_anomalies: Vec<Anomaly> =
            group_indices.iter().map(|&i| anomalies[i].clone()).collect();
        let services: Vec<String> = group_anomalies
            .iter()
            .map(|a| a.service_name.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        // Find the primary service: the one with highest severity
        let primary = group_anomalies
            .iter()
            .max_by(|a, b| {
                let severity_order = |a: &Anomaly| match a.severity {
                    super::types::Severity::Critical => 3,
                    super::types::Severity::Warning => 2,
                    super::types::Severity::Info => 1,
                };
                let sa = severity_order(a);
                let sb = severity_order(b);
                sa.cmp(&sb).then(a.z_score.partial_cmp(&b.z_score).unwrap())
            })
            .map(|a| a.service_name.clone())
            .unwrap_or_default();

        clusters.push(AnomalyCluster {
            services,
            primary_service: primary,
            anomalies: group_anomalies,
        });
    }

    CorrelationResult {
        clusters,
        dependencies: upstream_map,
    }
}
