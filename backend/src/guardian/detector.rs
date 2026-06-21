use super::types::{
    Anomaly, AnomalyCategory, AnomalyMetric, MetricsBucket, ServiceBaseline, Severity,
};

// ---------------------------------------------------------------------------
// Anomaly detection using Z-score method
// ---------------------------------------------------------------------------

/// Z-score threshold for anomaly detection
const Z_SCORE_THRESHOLD: f64 = 2.0;
/// Minimum number of data points required
const MIN_BUCKETS: usize = 3;
/// Minimum absolute latency deviation in ms to be considered anomalous
const MIN_LATENCY_DEVIATION_MS: f64 = 5.0;
/// Minimum error rate to be considered anomalous (percentage points)
const MIN_ERROR_RATE_DEVIATION: f64 = 0.5;

// ---------------------------------------------------------------------------
// Detect anomalies in current window vs baseline
// ---------------------------------------------------------------------------

pub fn detect_anomalies(
    service_name: &str,
    current_buckets: &[MetricsBucket],
    baseline: &ServiceBaseline,
    detected_at: i64,
) -> Vec<Anomaly> {
    if current_buckets.len() < MIN_BUCKETS || baseline.bucket_count < MIN_BUCKETS {
        return vec![];
    }

    let mut anomalies = Vec::new();
    let mut id_counter = 0u64;

    // Compute current window aggregates
    let n = current_buckets.len() as f64;
    let current_latency: f64 = current_buckets.iter().map(|b| b.avg_latency_ms).sum::<f64>() / n;
    let current_error_rate: f64 = current_buckets.iter().map(|b| b.error_rate_pct).sum::<f64>() / n;
    let current_request_rate: f64 = current_buckets.iter().map(|b| b.request_count).sum::<f64>() / n;

    let _ = next_id(&mut id_counter);

    // --- Latency anomalies ---
    if baseline.latency_stddev > 0.0 {
        let z_score = (current_latency - baseline.latency_mean) / baseline.latency_stddev;
        let abs_deviation = current_latency - baseline.latency_mean;

        if z_score > Z_SCORE_THRESHOLD && abs_deviation > MIN_LATENCY_DEVIATION_MS {
            let category = if z_score > 3.0 {
                AnomalyCategory::Spike
            } else {
                AnomalyCategory::Drift
            };

            anomalies.push(Anomaly {
                id: format!("{}-lat-{}", service_name, next_id(&mut id_counter)),
                service_name: service_name.to_string(),
                metric: AnomalyMetric::Latency,
                category,
                current_value: current_latency,
                baseline_mean: baseline.latency_mean,
                baseline_stddev: baseline.latency_stddev,
                z_score,
                severity: Severity::from_z_score(z_score),
                detected_at,
                description: format!(
                    "Latency is {:.1}ms (baseline {:.1}ms ± {:.1}ms, z={:.2})",
                    current_latency, baseline.latency_mean, baseline.latency_stddev, z_score
                ),
            });
        }
    }

    // --- Error rate anomalies ---
    // Always check error rate if current has meaningful errors, even when baseline is clean
    if baseline.error_rate_stddev > 0.0 || baseline.error_rate_mean > 0.0 || current_error_rate > MIN_ERROR_RATE_DEVIATION {
        let stddev = if baseline.error_rate_stddev > 0.0 {
            baseline.error_rate_stddev
        } else {
            0.1 // minimum stddev for services with 0 baseline errors
        };
        let z_score = if baseline.error_rate_mean < 0.01 && stddev == 0.1 {
            // Baseline is clean (0 errors), so any significant error rate is a strong signal
            current_error_rate / 0.5 // scale: 1% error = z=2, 5% = z=10, 25% = z=50
        } else {
            (current_error_rate - baseline.error_rate_mean) / stddev
        };
        let abs_deviation = current_error_rate - baseline.error_rate_mean;

        if z_score > Z_SCORE_THRESHOLD && abs_deviation > MIN_ERROR_RATE_DEVIATION {
            let category = if baseline.error_rate_mean < 0.1 && current_error_rate > 1.0 {
                AnomalyCategory::NewError
            } else if z_score > 3.0 {
                AnomalyCategory::Spike
            } else {
                AnomalyCategory::Drift
            };

            anomalies.push(Anomaly {
                id: format!("{}-err-{}", service_name, next_id(&mut id_counter)),
                service_name: service_name.to_string(),
                metric: AnomalyMetric::ErrorRate,
                category,
                current_value: current_error_rate,
                baseline_mean: baseline.error_rate_mean,
                baseline_stddev: stddev,
                z_score,
                severity: Severity::from_z_score(z_score),
                detected_at,
                description: format!(
                    "Error rate is {:.2}% (baseline {:.2}% ± {:.2}%, z={:.2})",
                    current_error_rate, baseline.error_rate_mean, stddev, z_score
                ),
            });
        }
    }

    // --- Request rate anomalies (spike or drop) ---
    if baseline.request_stddev > 0.0 {
        let z_score = (current_request_rate - baseline.request_mean).abs() / baseline.request_stddev;

        if z_score > Z_SCORE_THRESHOLD {
            let category = if current_request_rate > baseline.request_mean {
                AnomalyCategory::Spike
            } else {
                AnomalyCategory::Drop
            };

            // Only report significant request rate changes
            let ratio = current_request_rate / baseline.request_mean.max(1.0);
            if ratio > 2.0 || ratio < 0.5 {
                anomalies.push(Anomaly {
                    id: format!("{}-req-{}", service_name, next_id(&mut id_counter)),
                    service_name: service_name.to_string(),
                    metric: AnomalyMetric::RequestRate,
                    category,
                    current_value: current_request_rate,
                    baseline_mean: baseline.request_mean,
                    baseline_stddev: baseline.request_stddev,
                    z_score,
                    severity: Severity::from_z_score(z_score.min(5.0)),
                    detected_at,
                    description: format!(
                        "Request rate {:.0}/min vs baseline {:.0}/min ({:.1}x change)",
                        current_request_rate,
                        baseline.request_mean,
                        current_request_rate / baseline.request_mean.max(1.0)
                    ),
                });
            }
        }
    }

    anomalies
}

fn next_id(counter: &mut u64) -> u64 {
    *counter += 1;
    *counter
}
