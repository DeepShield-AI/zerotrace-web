use super::{
    correlator::{AnomalyCluster, ServiceEdge},
    types::{Anomaly, AnomalyCategory, AnomalyMetric, RootCause, Severity, Story, StoryEvidence},
};
use std::collections::{HashMap, HashSet};

// ---------------------------------------------------------------------------
// Root Cause Analysis
// ---------------------------------------------------------------------------

/// Analyze a cluster of anomalies to determine the likely root cause.
///
/// Heuristic-based classification (production systems would use ML models):
///
/// 1. **Dependency Failure**: If a single upstream service shows high latency/errors
///    AND its downstream services also show correlated anomalies → likely the upstream
///    service is the root cause.
///
/// 2. **Traffic Spike**: If multiple services show request rate spikes simultaneously
///    → likely external traffic increase.
///
/// 3. **Widespread Outage**: If many services (≥3) show anomalies at the same time
///    → infrastructure/platform issue.
///
/// 4. **Internal Degradation**: Single service anomaly with no upstream correlation
///    → likely internal code/resource issue.
pub fn classify_root_cause(
    cluster: &AnomalyCluster,
    edges: &[ServiceEdge],
    all_anomalies: &[Anomaly],
) -> RootCause {
    let services: HashSet<&str> = cluster.services.iter().map(|s| s.as_str()).collect();
    let primary = &cluster.primary_service;

    // Build upstream/downstream maps
    let mut upstream_of: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut downstream_of: HashMap<&str, Vec<&str>> = HashMap::new();
    for edge in edges {
        upstream_of.entry(edge.target.as_str()).or_default().push(edge.source.as_str());
        downstream_of
            .entry(edge.source.as_str())
            .or_default()
            .push(edge.target.as_str());
    }

    // Check: do any upstream services of the affected services also have anomalies?
    let affected_with_upstream_anomalies: Vec<&str> = cluster
        .services
        .iter()
        .filter(|svc| {
            upstream_of.get(svc.as_str()).map_or(false, |upstreams| {
                upstreams.iter().any(|u| all_anomalies.iter().any(|a| a.service_name == *u))
            })
        })
        .map(|s| s.as_str())
        .collect();

    // Check: how many services have request rate spikes?
    let request_spike_count = cluster
        .anomalies
        .iter()
        .filter(|a| {
            matches!(a.metric, AnomalyMetric::RequestRate) &&
                matches!(a.category, AnomalyCategory::Spike)
        })
        .count();

    // Check: latency vs error anomalies
    let latency_anomalies: Vec<&Anomaly> = cluster
        .anomalies
        .iter()
        .filter(|a| matches!(a.metric, AnomalyMetric::Latency))
        .collect();
    let error_anomalies: Vec<&Anomaly> = cluster
        .anomalies
        .iter()
        .filter(|a| matches!(a.metric, AnomalyMetric::ErrorRate))
        .collect();

    // --- Classification ---

    // Rule 1: Dependency failure — downstream services affected by an upstream issue
    if !affected_with_upstream_anomalies.is_empty() && cluster.services.len() > 1 {
        // Find the upstream service with the highest severity
        let root_upstream = affected_with_upstream_anomalies
            .iter()
            .max_by(|a, b| {
                let severity_of = |s: &&str| -> i32 {
                    all_anomalies
                        .iter()
                        .filter(|an| an.service_name == **s)
                        .map(|an| match an.severity {
                            Severity::Critical => 3,
                            Severity::Warning => 2,
                            Severity::Info => 1,
                        })
                        .max()
                        .unwrap_or(0)
                };
                severity_of(a).cmp(&severity_of(b))
            })
            .copied()
            .unwrap_or(primary.as_str());

        return RootCause::DependencyFailure {
            upstream_service: root_upstream.to_string(),
            evidence: format!(
                "Service '{}' is an upstream dependency of {} affected services and shows correlated anomalies. The issue likely propagated downstream.",
                root_upstream,
                cluster.services.len()
            ),
        };
    }

    // Rule 2: Traffic spike
    if request_spike_count >= 2 {
        return RootCause::TrafficSpike {
            factor: cluster
                .anomalies
                .iter()
                .filter(|a| matches!(a.metric, AnomalyMetric::RequestRate))
                .map(|a| a.current_value / a.baseline_mean.max(1.0))
                .fold(1.0, f64::max),
            evidence: format!(
                "{} services show simultaneous request rate spikes, suggesting an external traffic surge.",
                request_spike_count
            ),
        };
    }

    // Rule 3: Widespread outage
    if cluster.services.len() >= 3 && !error_anomalies.is_empty() {
        return RootCause::WidespreadOutage {
            affected_count: cluster.services.len(),
            evidence: format!(
                "{} services show anomalies simultaneously, suggesting a platform-level or infrastructure issue.",
                cluster.services.len()
            ),
        };
    }

    // Rule 4: Internal degradation (single service, no upstream correlation)
    if cluster.services.len() <= 2 && affected_with_upstream_anomalies.is_empty() {
        let evidence_parts: Vec<String> = vec![];
        let mut evidence =
            String::from("Isolated anomaly with no correlated upstream service issues. ");

        if !latency_anomalies.is_empty() && error_anomalies.is_empty() {
            evidence.push_str("Only latency is affected (no error increase), suggesting resource saturation or slow dependency.");
        } else if !error_anomalies.is_empty() {
            evidence.push_str("Errors are elevated, suggesting a code-level issue, configuration change, or failing dependency.");
        }

        return RootCause::InternalDegradation { evidence };
    }

    // Default: Unknown
    RootCause::Unknown {
        evidence: format!(
            "Could not determine a clear root cause from the available data. {} services affected across {} anomalies.",
            cluster.services.len(),
            cluster.anomalies.len()
        ),
    }
}

// ---------------------------------------------------------------------------
// Generate Story
// ---------------------------------------------------------------------------

/// Generate a human-readable story from the RCA result
pub fn generate_story(
    cluster: &AnomalyCluster,
    root_cause: &RootCause,
    baseline_window: &str,
    analysis_window: &str,
    total_services: usize,
    story_index: usize,
    detected_at: i64,
    org_id: i64,
) -> Story {
    let max_severity = cluster
        .anomalies
        .iter()
        .map(|a| &a.severity)
        .max_by(|a, b| {
            let order = |s: &Severity| match s {
                Severity::Critical => 3,
                Severity::Warning => 2,
                Severity::Info => 1,
            };
            order(a).cmp(&order(b))
        })
        .unwrap_or(&Severity::Info)
        .clone();

    let title = match &root_cause {
        RootCause::DependencyFailure {
            upstream_service, ..
        } => {
            format!(
                "Upstream failure in '{}' affecting downstream services",
                upstream_service
            )
        },
        RootCause::TrafficSpike { factor, .. } => {
            format!("Traffic spike detected ({:.1}x normal)", factor)
        },
        RootCause::InternalDegradation { .. } => {
            format!("Performance degradation in '{}'", cluster.primary_service)
        },
        RootCause::WidespreadOutage { affected_count, .. } => {
            format!("Widespread issue affecting {} services", affected_count)
        },
        RootCause::Unknown { .. } => {
            format!(
                "Unusual activity detected across {} service(s)",
                cluster.services.len()
            )
        },
    };

    let description = generate_description(cluster, root_cause);
    let suggested_actions = generate_actions(cluster, root_cause);

    Story {
        id: format!("story-{:02}-{}-{}", story_index, detected_at, org_id),
        org_id,
        title,
        description,
        severity: max_severity,
        detected_at,
        anomalies: cluster.anomalies.clone(),
        affected_services: cluster.services.clone(),
        root_cause: root_cause.clone(),
        suggested_actions,
        evidence: StoryEvidence {
            baseline_window: baseline_window.to_string(),
            analysis_window: analysis_window.to_string(),
            total_services_analyzed: total_services,
            anomalies_detected: cluster.anomalies.len(),
        },
    }
}

fn generate_description(cluster: &AnomalyCluster, root_cause: &RootCause) -> String {
    let mut desc = String::new();

    // Summary
    desc.push_str(&format!(
        "**{} service(s) affected** — detected {} anomaly(s).\n\n",
        cluster.services.len(),
        cluster.anomalies.len()
    ));

    // List anomalies
    for a in &cluster.anomalies {
        let icon = match a.severity {
            Severity::Critical => "🔴",
            Severity::Warning => "🟡",
            Severity::Info => "🔵",
        };
        let metric_name = match a.metric {
            AnomalyMetric::Latency => "Latency",
            AnomalyMetric::ErrorRate => "Error Rate",
            AnomalyMetric::RequestRate => "Request Rate",
        };
        desc.push_str(&format!(
            "{} **{}** — {}: {}\n",
            icon, a.service_name, metric_name, a.description
        ));
    }

    // Root cause
    desc.push_str("\n**Analysis:** ");
    match root_cause {
        RootCause::DependencyFailure {
            upstream_service,
            evidence,
            ..
        } => {
            desc.push_str(&format!(
                "The issue likely originates from **{}**. {}",
                upstream_service, evidence
            ));
        },
        RootCause::TrafficSpike { evidence, .. } => {
            desc.push_str(evidence);
        },
        RootCause::InternalDegradation { evidence } => {
            desc.push_str(evidence);
        },
        RootCause::WidespreadOutage { evidence, .. } => {
            desc.push_str(evidence);
        },
        RootCause::Unknown { evidence } => {
            desc.push_str(evidence);
        },
    }

    desc
}

fn generate_actions(cluster: &AnomalyCluster, root_cause: &RootCause) -> Vec<String> {
    let mut actions = Vec::new();

    match root_cause {
        RootCause::DependencyFailure {
            upstream_service, ..
        } => {
            actions.push(format!(
                "Investigate **{}** first — view its [Service Detail](/apm/services/{})",
                upstream_service,
                url_encode(upstream_service)
            ));
            actions.push(
                "Check traces from affected services for errors correlated with upstream calls"
                    .into(),
            );
        },
        RootCause::TrafficSpike { .. } => {
            actions.push(
                "Check if a recent deployment or config change caused the traffic increase".into(),
            );
            actions
                .push("Verify autoscaling policies are adequate for the new traffic level".into());
        },
        RootCause::InternalDegradation { .. } => {
            let svc = &cluster.primary_service;
            actions.push(format!(
                "View **{}** traces — look for slow spans and error stack traces",
                svc
            ));
            actions.push(
                "Check for recent deployments, configuration changes, or resource constraints"
                    .into(),
            );
        },
        RootCause::WidespreadOutage { .. } => {
            actions
                .push("Check infrastructure health — CPU, memory, disk on affected hosts".into());
            actions.push("Verify network connectivity and external dependencies".into());
        },
        RootCause::Unknown { .. } => {
            actions.push(
                "Review [APM Traces](/apm) for the affected services around the anomaly time"
                    .into(),
            );
            actions.push("Check if any deployments or config changes occurred recently".into());
        },
    }

    // Add common actions
    actions.push(format!(
        "View affected services in [APM](/apm) — {} service(s)",
        cluster.services.len()
    ));

    actions
}

fn url_encode(s: &str) -> String {
    s.replace(' ', "%20")
        .replace('/', "%2F")
        .replace('?', "%3F")
        .replace('&', "%26")
}
