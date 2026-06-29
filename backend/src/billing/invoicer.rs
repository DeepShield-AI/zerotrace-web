use crate::models::{
    invoice::{Invoice, InvoiceLineItem},
    plan::{Plan, PlanAllotment},
    subscription::Subscription,
    usage::UsageRecord,
};
use chrono::Datelike;
use sqlx::MySqlPool;
use tracing;

/// Generate monthly invoices for all orgs for a given billing period.
/// Called by the collector when a month rollover is detected.
pub async fn generate_monthly_invoices(
    pool: &MySqlPool,
    period_start: chrono::NaiveDate,
) -> Result<usize, String> {
    let period_end = next_month_start(period_start);

    #[derive(sqlx::FromRow)]
    struct OrgRow {
        id: i64,
    }
    let orgs: Vec<OrgRow> = sqlx::query_as::<_, OrgRow>("SELECT id FROM organizations ORDER BY id")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query orgs: {}", e))?;

    let mut generated = 0;
    for org in &orgs {
        match generate_org_invoice(pool, org.id, period_start, period_end).await {
            Ok(_) => generated += 1,
            Err(e) => {
                tracing::warn!(
                    "Invoice generation failed for org {} (period {}): {}",
                    org.id,
                    period_start,
                    e
                );
            },
        }
    }

    Ok(generated)
}

/// Check for any uninvoiced months since the earliest usage record.
/// Called on startup to catch gaps caused by downtime.
pub async fn generate_missing_invoices(pool: &MySqlPool) -> Result<usize, String> {
    // Find the earliest month with usage but no invoice
    let now = chrono::Utc::now().date_naive();
    let current_month_start = now.with_day(1).unwrap();

    // Get all months that have generated invoices
    #[derive(sqlx::FromRow)]
    struct InvoicedPeriod {
        period_start: chrono::NaiveDate,
    }
    let invoiced: Vec<InvoicedPeriod> = sqlx::query_as::<_, InvoicedPeriod>(
        "SELECT DISTINCT period_start FROM invoices ORDER BY period_start",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query invoiced periods: {}", e))?;

    let invoiced_set: std::collections::HashSet<chrono::NaiveDate> =
        invoiced.into_iter().map(|p| p.period_start).collect();

    // Find earliest usage record month
    #[derive(sqlx::FromRow)]
    struct EarliestUsage {
        earliest: Option<chrono::DateTime<chrono::Utc>>,
    }
    let earliest: EarliestUsage =
        sqlx::query_as::<_, EarliestUsage>("SELECT MIN(hour) as earliest FROM usage_records")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Failed to query earliest usage: {}", e))?;

    let first_month = match earliest.earliest {
        Some(dt) => dt.date_naive().with_day(1).unwrap(),
        None => return Ok(0), // No usage data yet
    };

    let mut generated = 0;
    let mut month = first_month;
    while month < current_month_start {
        if !invoiced_set.contains(&month) {
            tracing::info!("Generating missing invoice for period: {}", month);
            match generate_monthly_invoices(pool, month).await {
                Ok(n) => generated += n,
                Err(e) => tracing::warn!("Failed to generate missing invoice for {}: {}", month, e),
            }
        }
        month = next_month_start(month);
    }

    // Also expire subscriptions past their period end
    Subscription::expire_ended(pool)
        .await
        .map_err(|e| format!("Failed to expire subscriptions: {}", e))?;

    if generated > 0 {
        tracing::info!("Generated {} missing invoices", generated);
    }
    Ok(generated)
}

/// Convert raw usage quantity to billable units based on plan's billing_dimension.
/// e.g., spans (count) → GB for `per_gb` plans using avg span size of 5KB.
fn convert_to_billing_unit(
    raw_quantity: rust_decimal::Decimal,
    plan: &Plan,
) -> rust_decimal::Decimal {
    match plan.billing_dimension.as_str() {
        "per_gb" if plan.product_key.contains("span") => {
            // Convert span count to GB: each span ≈ 5KB
            // 1 GB = 1e9 bytes, 1 span ≈ 5000 bytes → 200,000 spans per GB
            raw_quantity / rust_decimal::Decimal::from(200_000u64)
        },
        "per_gb" => raw_quantity, // Already in GB (e.g., log_ingestion_gb)
        "per_million_events" => raw_quantity / rust_decimal::Decimal::from(1_000_000u64),
        _ => raw_quantity, // per_host, per_container, per_metric — no conversion needed
    }
}

/// Generate a single org's invoice for the given period
pub async fn generate_org_invoice(
    pool: &MySqlPool,
    org_id: i64,
    period_start: chrono::NaiveDate,
    period_end: chrono::NaiveDate,
) -> Result<Invoice, String> {
    // Check for existing draft
    if let Some(existing) = Invoice::find_draft_for_period(pool, org_id, period_start)
        .await
        .map_err(|e| e.to_string())?
    {
        return Ok(existing);
    }

    // Load active subscriptions (only those active during this period)
    let all_subscriptions = Subscription::find_active_by_org(pool, org_id)
        .await
        .map_err(|e| format!("Failed to load subscriptions: {}", e))?;

    // Filter: only subscriptions active during the billing period
    let period_end_dt_utc = period_end.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let period_start_dt_utc = period_start.and_hms_opt(0, 0, 0).unwrap().and_utc();
    let subscriptions: Vec<Subscription> = all_subscriptions
        .into_iter()
        .filter(|s| {
            s.current_period_start <= period_end_dt_utc &&
                s.current_period_end >= period_start_dt_utc
        })
        .collect();

    if subscriptions.is_empty() {
        return Err("No active subscriptions for this period".to_string());
    }

    // Load plans & allotments
    let all_plans =
        Plan::list_all(pool).await.map_err(|e| format!("Failed to load plans: {}", e))?;
    let plan_ids: Vec<i64> = subscriptions.iter().map(|s| s.plan_id).collect();
    let allotments = PlanAllotment::list_by_plan_ids(pool, &plan_ids)
        .await
        .map_err(|e| format!("Failed to load allotments: {}", e))?;

    // Load usage for the period
    let usage_records = UsageRecord::query(pool, org_id, period_start_dt_utc, period_end_dt_utc)
        .await
        .map_err(|e| format!("Failed to load usage: {}", e))?;

    // Build a plan lookup
    let plan_map: std::collections::HashMap<i64, &Plan> =
        all_plans.iter().map(|p| (p.id, p)).collect();

    // Build allotment lookup: plan_id -> Vec<(product_key, quantity, per_unit)>
    let mut allotment_map: std::collections::HashMap<i64, Vec<&PlanAllotment>> =
        std::collections::HashMap::new();
    for a in &allotments {
        allotment_map.entry(a.plan_id).or_default().push(a);
    }

    // Create invoice
    let invoice = Invoice::create(pool, org_id, period_start, period_end)
        .await
        .map_err(|e| format!("Failed to create invoice: {}", e))?;

    let mut subtotal = rust_decimal::Decimal::ZERO;

    // Compute pro-rating factor: what fraction of the billing period is covered?
    // Full month in days:
    let days_in_period = (period_end - period_start).num_days();
    let period_days = rust_decimal::Decimal::from(days_in_period as i64);

    // For each subscription, compute charges
    for sub in &subscriptions {
        let plan = match plan_map.get(&sub.plan_id) {
            Some(p) => p,
            None => continue,
        };

        // Get usage for this product (only the ones matching the plan's product_key)
        let product_usage: Vec<&UsageRecord> =
            usage_records.iter().filter(|r| r.product_key == plan.product_key).collect();

        // Compute raw billable quantity using the plan's aggregation method
        let raw_billable = aggregate_usage(&plan.aggregation_method, &product_usage);

        // Convert to billing unit (e.g., span count → GB)
        let billable_quantity = convert_to_billing_unit(raw_billable, plan);

        // Pro-rating: compute how many days the subscription was active in this period
        let sub_start = sub.current_period_start.date_naive().max(period_start);
        let sub_end = sub.current_period_end.date_naive().min(period_end);
        let active_days = rust_decimal::Decimal::from((sub_end - sub_start).num_days() as i64);
        let prorate_factor = if period_days > rust_decimal::Decimal::ZERO {
            active_days / period_days
        } else {
            rust_decimal::Decimal::ONE
        };

        // Apply pro-rating to committed quantity
        let prorated_commitment = sub.committed_quantity * prorate_factor;

        // Split into commitment and overage (with pro-rated commitment)
        let committed = if billable_quantity < prorated_commitment {
            billable_quantity
        } else {
            prorated_commitment
        };
        let overage = if billable_quantity > prorated_commitment {
            billable_quantity - prorated_commitment
        } else {
            rust_decimal::Decimal::ZERO
        };

        let commitment_total = committed * sub.unit_price;
        let overage_rate = if sub.commitment_type == "annual" || sub.commitment_type == "monthly" {
            // On-demand rate = ~1.5x the committed rate
            sub.unit_price * rust_decimal::Decimal::new(15, 1) // * 1.5
        } else {
            sub.unit_price
        };
        let overage_total = overage * overage_rate;
        let line_total = commitment_total + overage_total;

        if line_total > rust_decimal::Decimal::ZERO {
            let desc = if prorate_factor < rust_decimal::Decimal::ONE {
                format!(
                    "{} — {} commitment (prorated {:.0}/{:.0} days: {} {} @ {} each)",
                    plan.name,
                    sub.commitment_type,
                    active_days,
                    period_days,
                    committed,
                    plan.billing_dimension,
                    sub.unit_price
                )
            } else {
                format!("{} — {} commitment", plan.name, sub.commitment_type)
            };

            InvoiceLineItem::create(
                pool,
                invoice.id,
                &plan.product_key,
                &desc,
                committed,
                sub.unit_price,
                commitment_total,
                overage,
                overage_rate,
                overage_total,
                line_total,
            )
            .await
            .map_err(|e| format!("Failed to create line item: {}", e))?;

            subtotal += line_total;
        }

        // Handle allotments: free containers/metrics from host plans
        if let Some(allotments) = allotment_map.get(&sub.plan_id) {
            for allotment in allotments {
                // Compute how much is free based on committed host count
                let free_qty = if allotment.per_unit == "per_host" {
                    allotment.allotted_quantity * committed
                } else {
                    allotment.allotted_quantity
                };

                // Get usage for the allotted product
                let allotted_usage: Vec<&UsageRecord> = usage_records
                    .iter()
                    .filter(|r| r.product_key == allotment.allotted_product_key)
                    .collect();

                let allotted_billable = aggregate_usage("sum", &allotted_usage);
                let allotted_overage = if allotted_billable > free_qty {
                    allotted_billable - free_qty
                } else {
                    rust_decimal::Decimal::ZERO
                };

                if allotted_overage > rust_decimal::Decimal::ZERO {
                    // Find the overage plan for this product
                    if let Some(overage_plan) =
                        all_plans.iter().find(|p| p.product_key == allotment.allotted_product_key)
                    {
                        let line_total = allotted_overage * overage_plan.unit_price_annual;

                        InvoiceLineItem::create(
                            pool,
                            invoice.id,
                            &allotment.allotted_product_key,
                            &format!(
                                "{} (overage: {} free, {} used)",
                                allotment.allotted_product_key, free_qty, allotted_billable
                            ),
                            rust_decimal::Decimal::ZERO,
                            rust_decimal::Decimal::ZERO,
                            rust_decimal::Decimal::ZERO,
                            allotted_overage,
                            overage_plan.unit_price_annual,
                            line_total,
                            line_total,
                        )
                        .await
                        .map_err(|e| format!("Failed to create allotment overage line: {}", e))?;

                        subtotal += line_total;
                    }
                }
            }
        }
    }

    let discount = rust_decimal::Decimal::ZERO; // No discount for now
    let total = subtotal - discount;

    Invoice::update_totals(pool, invoice.id, subtotal, discount, total)
        .await
        .map_err(|e| format!("Failed to update totals: {}", e))?;

    Invoice::finalize(pool, invoice.id)
        .await
        .map_err(|e| format!("Failed to finalize invoice: {}", e))?;

    tracing::info!(
        "Invoice #{} generated for org {}: {} {} (period {} - {})",
        invoice.id,
        org_id,
        total,
        "USD",
        period_start,
        period_end
    );

    Ok(invoice)
}

/// Aggregate usage records using the specified method (public for estimated cost)
pub fn aggregate_usage_for_estimation(
    method: &str,
    records: &[&UsageRecord],
) -> rust_decimal::Decimal {
    aggregate_usage(method, records)
}

/// Aggregate usage records using the specified method
fn aggregate_usage(method: &str, records: &[&UsageRecord]) -> rust_decimal::Decimal {
    if records.is_empty() {
        return rust_decimal::Decimal::ZERO;
    }

    match method {
        "hwmp_99p" => {
            // High Watermark 99th percentile: sort hourly values, discard top 1%, take max
            let mut values: Vec<rust_decimal::Decimal> =
                records.iter().map(|r| r.quantity).collect();
            values.sort();
            let discard = (values.len() as f64 * 0.01).ceil() as usize;
            let keep = values.len().saturating_sub(discard);
            if keep == 0 {
                values.last().copied().unwrap_or_default()
            } else {
                // Take max of the remaining 99%
                let kept: Vec<&rust_decimal::Decimal> = values.iter().take(keep).collect();
                kept.last().copied().copied().unwrap_or_default()
            }
        },
        "sum" => {
            let total: rust_decimal::Decimal = records.iter().map(|r| r.quantity).sum();
            total
        },
        "average" => {
            let total: rust_decimal::Decimal = records.iter().map(|r| r.quantity).sum();
            let count = rust_decimal::Decimal::from(records.len() as i64);
            if count > rust_decimal::Decimal::ZERO {
                total / count
            } else {
                rust_decimal::Decimal::ZERO
            }
        },
        _ => {
            // Default to sum
            let total: rust_decimal::Decimal = records.iter().map(|r| r.quantity).sum();
            total
        },
    }
}

fn next_month_start(date: chrono::NaiveDate) -> chrono::NaiveDate {
    let month = date.month();
    let year = date.year();
    if month == 12 {
        chrono::NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    }
}

// ==========================================================
// Tests
// ==========================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{plan::Plan, usage::UsageRecord};
    use chrono::{NaiveDate, Utc};
    use rust_decimal::Decimal;

    fn make_usage_records(values: &[f64]) -> Vec<UsageRecord> {
        values
            .iter()
            .map(|&v| UsageRecord {
                id: 0,
                org_id: 1,
                product_key: "test".into(),
                hour: Utc::now(),
                quantity: Decimal::from_f64_retain(v).unwrap(),
                raw_values: None,
                collected_at: Utc::now(),
            })
            .collect()
    }

    fn as_refs(records: &[UsageRecord]) -> Vec<&UsageRecord> {
        records.iter().collect()
    }

    fn make_plan(product_key: &str, billing_dimension: &str) -> Plan {
        Plan {
            id: 1,
            product_key: product_key.into(),
            name: "Test Plan".into(),
            description: "".into(),
            billing_dimension: billing_dimension.into(),
            aggregation_method: "sum".into(),
            unit_price_monthly: Decimal::new(10, 0),
            unit_price_annual: Decimal::new(8, 0),
            currency: "USD".into(),
            is_addon: false,
            tier_level: 0,
            parent_product_key: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // ---- next_month_start ----

    #[test]
    fn test_next_month_start_normal() {
        let jan = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        assert_eq!(
            next_month_start(jan),
            NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()
        );
    }

    #[test]
    fn test_next_month_start_december() {
        let dec = NaiveDate::from_ymd_opt(2026, 12, 1).unwrap();
        assert_eq!(
            next_month_start(dec),
            NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()
        );
    }

    // ---- aggregate_usage: sum ----

    #[test]
    fn test_sum_empty() {
        let records: Vec<UsageRecord> = vec![];
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("sum", &refs), Decimal::ZERO);
    }

    #[test]
    fn test_sum_single() {
        let records = make_usage_records(&[42.0]);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("sum", &refs), Decimal::from(42u64));
    }

    #[test]
    fn test_sum_multiple() {
        let records = make_usage_records(&[10.0, 20.0, 30.0]);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("sum", &refs), Decimal::from(60u64));
    }

    #[test]
    fn test_sum_with_decimals() {
        // f64 → Decimal can lose precision; test with integer-convertible values
        let records = make_usage_records(&[1.0, 2.0, 3.0]);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("sum", &refs), Decimal::from(6u64));
    }

    // ---- aggregate_usage: average ----

    #[test]
    fn test_average_empty() {
        let records: Vec<UsageRecord> = vec![];
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("average", &refs), Decimal::ZERO);
    }

    #[test]
    fn test_average_single() {
        let records = make_usage_records(&[100.0]);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("average", &refs), Decimal::from(100u64));
    }

    #[test]
    fn test_average_multiple() {
        let records = make_usage_records(&[10.0, 20.0, 30.0, 40.0]);
        let refs = as_refs(&records);
        // (10+20+30+40)/4 = 25
        assert_eq!(aggregate_usage("average", &refs), Decimal::from(25u64));
    }

    // ---- aggregate_usage: hwmp_99p ----

    #[test]
    fn test_hwmp_empty() {
        let records: Vec<UsageRecord> = vec![];
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::ZERO);
    }

    #[test]
    fn test_hwmp_single_hour() {
        let records = make_usage_records(&[50.0]);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::from(50u64));
    }

    #[test]
    fn test_hwmp_all_same_no_spike() {
        // 100 hours all at 10: discard 1 (=1% of 100), keep 99, max = 10
        let values: Vec<f64> = (0..100).map(|_| 10.0).collect();
        let records = make_usage_records(&values);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::from(10u64));
    }

    #[test]
    fn test_hwmp_single_spike_discarded() {
        // 99 hours at 10, 1 spike at 1000 → spike discarded, max = 10
        let mut values: Vec<f64> = (0..99).map(|_| 10.0).collect();
        values.push(1000.0);
        let records = make_usage_records(&values);
        let refs = as_refs(&records);
        // Sorted: [10...10, 1000]. 1% of 100 = 1 discarded. Keep 99 → max = 10.
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::from(10u64));
    }

    #[test]
    fn test_hwmp_multiple_spikes_not_all_discarded() {
        // 90 hours at 10, 10 spikes at 1000 → 1% of 100 = 1 discarded, 9 spikes remain → max = 1000
        let mut values: Vec<f64> = (0..90).map(|_| 10.0).collect();
        (0..10).for_each(|_| values.push(1000.0));
        let records = make_usage_records(&values);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::from(1000u64));
    }

    #[test]
    fn test_hwmp_small_sample() {
        // 10 hours: discard 1 (=ceil(10*0.01)), keep 9, spike at 100 should be discarded
        let values: Vec<f64> = vec![5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 100.0];
        let records = make_usage_records(&values);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::from(5u64));
    }

    #[test]
    fn test_hwmp_very_small_sample() {
        // 3 hours: discard ceil(3*0.01) = 1, keep 2, max of kept 2
        let values: Vec<f64> = vec![10.0, 50.0, 200.0];
        let records = make_usage_records(&values);
        let refs = as_refs(&records);
        // Sorted: [10, 50, 200]. Discard 1 (200). Keep 2 → max = 50.
        assert_eq!(aggregate_usage("hwmp_99p", &refs), Decimal::from(50u64));
    }

    // ---- aggregate_usage: unknown method defaults to sum ----

    #[test]
    fn test_unknown_method_defaults_to_sum() {
        let records = make_usage_records(&[10.0, 20.0, 30.0]);
        let refs = as_refs(&records);
        assert_eq!(aggregate_usage("bogus_method", &refs), Decimal::from(60u64));
    }

    // ---- convert_to_billing_unit ----

    #[test]
    fn test_span_count_to_gb() {
        let plan = make_plan("apm_ingested_spans", "per_gb");
        // 200,000 spans × 5KB each = 1 GB
        let raw = Decimal::from(200_000u64);
        let result = convert_to_billing_unit(raw, &plan);
        assert_eq!(result, Decimal::from(1u64));
    }

    #[test]
    fn test_large_span_count_to_gb() {
        let plan = make_plan("apm_ingested_spans", "per_gb");
        // 2,000,000 spans = 10 GB
        let raw = Decimal::from(2_000_000u64);
        let result = convert_to_billing_unit(raw, &plan);
        assert_eq!(result, Decimal::from(10u64));
    }

    #[test]
    fn test_per_host_no_conversion() {
        let plan = make_plan("infra_pro", "per_host");
        let raw = Decimal::from(50u64);
        let result = convert_to_billing_unit(raw, &plan);
        assert_eq!(result, Decimal::from(50u64));
    }

    #[test]
    fn test_log_gb_no_conversion() {
        let plan = make_plan("log_ingestion", "per_gb");
        let raw = Decimal::from(100u64);
        let result = convert_to_billing_unit(raw, &plan);
        // Log ingestion is already in GB
        assert_eq!(result, Decimal::from(100u64));
    }

    #[test]
    fn test_per_million_events_conversion() {
        let plan = make_plan("apm_indexed_spans", "per_million_events");
        let raw = Decimal::from(1_000_000u64);
        let result = convert_to_billing_unit(raw, &plan);
        assert_eq!(result, Decimal::from(1u64));
    }

    #[test]
    fn test_partial_million_events() {
        let plan = make_plan("log_indexing_15d", "per_million_events");
        // 500,000 events = 0.5 million
        let raw = Decimal::from(500_000u64);
        let result = convert_to_billing_unit(raw, &plan);
        assert_eq!(result, Decimal::new(5, 1)); // 0.5
    }
}
