use crate::{
    billing::invoicer,
    errors::AppError,
    middleware::auth::AuthContext,
    models::{
        invoice::{Invoice, InvoiceDetail, InvoiceLineItem},
        plan::{CreatePlanInput, Plan, PlanAllotment, UpdatePlanInput},
        subscription::{CreateSubscriptionInput, Subscription},
        usage::UsageRecord,
        usage_alert::{CreateUsageAlertInput, UsageAlert},
    },
};
use axum::{
    Json,
    extract::{Path, State},
};
use chrono::Datelike;
use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

// ==========================================================
// Response types
// ==========================================================

#[derive(Serialize)]
pub struct PlansResponse {
    plans: Vec<PlanWithAllotments>,
}

#[derive(Serialize)]
pub struct PlanWithAllotments {
    #[serde(flatten)]
    plan: Plan,
    allotments: Vec<PlanAllotment>,
}

#[derive(Serialize)]
pub struct SubscriptionsResponse {
    subscriptions: Vec<SubscriptionWithPlan>,
}

#[derive(Serialize)]
pub struct SubscriptionWithPlan {
    #[serde(flatten)]
    subscription: Subscription,
    plan: Plan,
}

#[derive(Serialize)]
pub struct UsageResponse {
    org_id: i64,
    period_start: String,
    period_end: String,
    products: Vec<crate::models::usage::UsageSummary>,
}

#[derive(Serialize)]
pub struct HourlyUsageResponse {
    org_id: i64,
    product_key: String,
    records: Vec<HourlyDataPoint>,
}

#[derive(Serialize)]
pub struct HourlyDataPoint {
    hour: String,
    quantity: rust_decimal::Decimal,
}

#[derive(Serialize)]
pub struct EstimatedCostResponse {
    org_id: i64,
    estimated_total: rust_decimal::Decimal,
    currency: String,
    breakdown: Vec<EstimatedProductCost>,
}

#[derive(Serialize)]
pub struct EstimatedProductCost {
    product_key: String,
    estimated_cost: rust_decimal::Decimal,
    usage_total: rust_decimal::Decimal,
}

#[derive(Serialize)]
pub struct InvoicesResponse {
    invoices: Vec<Invoice>,
}

#[derive(Serialize)]
pub struct MessageResponse {
    message: String,
}

// ==========================================================
// Handlers
// ==========================================================

/// GET /api/v1/billing/plans — List all available plans with pricing and allotments
pub async fn list_plans(
    State(pool): State<MySqlPool>,
    _auth: AuthContext,
) -> Result<Json<PlansResponse>, AppError> {
    let plans = Plan::list_all(&pool).await?;
    let plan_ids: Vec<i64> = plans.iter().map(|p| p.id).collect();
    let all_allotments = PlanAllotment::list_by_plan_ids(&pool, &plan_ids).await?;

    let mut allotment_map: std::collections::HashMap<i64, Vec<PlanAllotment>> =
        std::collections::HashMap::new();
    for a in all_allotments {
        allotment_map.entry(a.plan_id).or_default().push(a);
    }

    let plans_with_allotments: Vec<PlanWithAllotments> = plans
        .into_iter()
        .map(|plan| {
            let allotments = allotment_map.remove(&plan.id).unwrap_or_default();
            PlanWithAllotments { plan, allotments }
        })
        .collect();

    Ok(Json(PlansResponse {
        plans: plans_with_allotments,
    }))
}

/// GET /api/v1/billing/subscriptions — List org's subscriptions
pub async fn list_subscriptions(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<SubscriptionsResponse>, AppError> {
    let subscriptions = Subscription::list_by_org(&pool, auth.org_id).await?;
    let all_plans = Plan::list_all(&pool).await?;
    let plan_map: std::collections::HashMap<i64, Plan> =
        all_plans.into_iter().map(|p| (p.id, p)).collect();

    let subs_with_plans: Vec<SubscriptionWithPlan> = subscriptions
        .into_iter()
        .filter_map(|sub| {
            plan_map.get(&sub.plan_id).cloned().map(|plan| SubscriptionWithPlan {
                subscription: sub,
                plan,
            })
        })
        .collect();

    Ok(Json(SubscriptionsResponse {
        subscriptions: subs_with_plans,
    }))
}

/// POST /api/v1/billing/subscriptions — Subscribe to a plan
pub async fn create_subscription(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Json(input): Json<CreateSubscriptionInput>,
) -> Result<Json<SubscriptionWithPlan>, AppError> {
    let plan = Plan::find_by_id(&pool, input.plan_id)
        .await?
        .ok_or_else(|| AppError::not_found("Plan not found"))?;

    // Determine the unit price based on commitment type
    let unit_price = match input.commitment_type.as_str() {
        "annual" => plan.unit_price_annual,
        "monthly" => plan.unit_price_monthly,
        "on_demand" => plan.unit_price_monthly * rust_decimal::Decimal::new(15, 1), // 1.5x
        _ =>
            return Err(AppError::bad_request(
                "Invalid commitment_type. Use 'annual', 'monthly', or 'on_demand'",
            )),
    };

    // Check if already subscribed to same product key
    if let Some(_existing) =
        Subscription::find_active_by_org_and_product(&pool, auth.org_id, &plan.product_key).await?
    {
        return Err(AppError::conflict(format!(
            "Already subscribed to {}",
            plan.product_key
        )));
    }

    // Prevent subscribing to multiple tiers of the same product family.
    // If a sibling exists, auto-upgrade: cancel the old one, create the new one.
    let family_prefix = plan.product_key.split('_').next().unwrap_or(&plan.product_key);
    let sibling: Option<(i64, String)> = sqlx::query_as(
        "SELECT s.id, p.product_key FROM plans p JOIN subscriptions s ON p.id = s.plan_id WHERE s.org_id = ? AND s.status = 'active' AND p.product_key LIKE ? AND p.product_key != ?"
    )
    .bind(auth.org_id)
    .bind(format!("{}%", family_prefix))
    .bind(&plan.product_key)
    .fetch_optional(&pool)
    .await?;

    if let Some((sibling_id, sibling_key)) = sibling {
        // Upgrade/downgrade based on tier_level, not price
        let sibling_plan = Plan::find_by_product_key(&pool, &sibling_key)
            .await?
            .ok_or_else(|| AppError::internal("sibling plan not found"))?;

        if sibling_plan.tier_level == 0 || plan.tier_level == 0 {
            return Err(AppError::conflict(format!(
                "You already have '{}' active. These plans are not tier-based — cancel the existing one first.",
                sibling_key
            )));
        }

        if plan.tier_level <= sibling_plan.tier_level {
            return Err(AppError::bad_request(format!(
                "You already have '{}' (tier {}). '{}' is tier {} — only upgrades to higher tiers are automatic. Cancel the current plan first to switch.",
                sibling_key, sibling_plan.tier_level,
                plan.product_key, plan.tier_level
            )));
        }

        tracing::info!(
            org_id = auth.org_id,
            from = %sibling_key,
            from_tier = sibling_plan.tier_level,
            to = %plan.product_key,
            to_tier = plan.tier_level,
            "Upgrading subscription (tier-based)"
        );
        sqlx::query("UPDATE subscriptions SET status = 'upgraded' WHERE id = ?")
            .bind(sibling_id)
            .execute(&pool)
            .await?;
    }

    // Check parent product requirement for add-ons
    if plan.is_addon {
        if let Some(ref parent_key) = plan.parent_product_key {
            let has_parent =
                Subscription::find_active_by_org_and_product(&pool, auth.org_id, parent_key)
                    .await?
                    .is_some();
            if !has_parent {
                return Err(AppError::bad_request(format!(
                    "This plan requires an active '{}' subscription first",
                    parent_key
                )));
            }
        }
    }

    let subscription = Subscription::create(
        &pool,
        auth.org_id,
        input.plan_id,
        &input.commitment_type,
        input.committed_quantity,
        unit_price,
    )
    .await?;

    Ok(Json(SubscriptionWithPlan { subscription, plan }))
}

/// DELETE /api/v1/billing/subscriptions/{id} — Cancel a subscription
pub async fn cancel_subscription(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Path(id): Path<i64>,
) -> Result<Json<MessageResponse>, AppError> {
    let cancelled = Subscription::cancel(&pool, id, auth.org_id).await?;
    if cancelled {
        Ok(Json(MessageResponse {
            message: "Subscription canceled".into(),
        }))
    } else {
        Err(AppError::not_found("Active subscription not found"))
    }
}

/// GET /api/v1/billing/usage — Current month usage summary
pub async fn current_usage(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<UsageResponse>, AppError> {
    let now = chrono::Utc::now();
    let month_start = now.date_naive().with_day(1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();

    let products =
        crate::models::usage::UsageRecord::current_month_summary(&pool, auth.org_id).await?;

    Ok(Json(UsageResponse {
        org_id: auth.org_id,
        period_start: month_start.to_rfc3339(),
        period_end: now.to_rfc3339(),
        products,
    }))
}

/// GET /api/v1/billing/usage/hourly?product_key=X — Hourly usage breakdown for a product
pub async fn hourly_usage(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<HourlyUsageResponse>, AppError> {
    let product_key = params
        .get("product_key")
        .ok_or_else(|| AppError::bad_request("product_key is required"))?;

    let now = chrono::Utc::now();
    let month_start = now.date_naive().with_day(1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();

    let records =
        UsageRecord::query_by_product(&pool, auth.org_id, product_key, month_start, now).await?;

    let data_points: Vec<HourlyDataPoint> = records
        .into_iter()
        .map(|r| HourlyDataPoint {
            hour: r.hour.to_rfc3339(),
            quantity: r.quantity,
        })
        .collect();

    Ok(Json(HourlyUsageResponse {
        org_id: auth.org_id,
        product_key: product_key.clone(),
        records: data_points,
    }))
}

/// GET /api/v1/billing/estimated-cost — Real-time estimated cost for current month (legacy, uses SUM)
#[allow(dead_code)]
pub async fn estimated_cost(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<EstimatedCostResponse>, AppError> {
    let summaries =
        crate::models::usage::UsageRecord::current_month_summary(&pool, auth.org_id).await?;
    let subscriptions = Subscription::find_active_by_org(&pool, auth.org_id).await?;
    let all_plans = Plan::list_all(&pool).await?;
    let plan_map: std::collections::HashMap<i64, &Plan> =
        all_plans.iter().map(|p| (p.id, p)).collect();

    let mut estimated_total = rust_decimal::Decimal::ZERO;
    let mut breakdown = Vec::new();

    for summary in &summaries {
        // Find matching subscription
        let matching_sub = subscriptions.iter().find(|s| {
            plan_map
                .get(&s.plan_id)
                .map(|p| p.product_key == summary.product_key)
                .unwrap_or(false)
        });

        let cost = if let Some(sub) = matching_sub {
            // Commitment + overage
            let committed = if summary.total_quantity < sub.committed_quantity {
                summary.total_quantity
            } else {
                sub.committed_quantity
            };
            let overage = if summary.total_quantity > sub.committed_quantity {
                summary.total_quantity - sub.committed_quantity
            } else {
                rust_decimal::Decimal::ZERO
            };

            let overage_rate = sub.unit_price * rust_decimal::Decimal::new(15, 1);
            (committed * sub.unit_price) + (overage * overage_rate)
        } else {
            // No subscription — all on-demand
            if let Some(plan) = all_plans.iter().find(|p| p.product_key == summary.product_key) {
                summary.total_quantity * plan.unit_price_monthly
            } else {
                rust_decimal::Decimal::ZERO
            }
        };

        breakdown.push(EstimatedProductCost {
            product_key: summary.product_key.clone(),
            estimated_cost: cost,
            usage_total: summary.total_quantity,
        });
        estimated_total += cost;
    }

    Ok(Json(EstimatedCostResponse {
        org_id: auth.org_id,
        estimated_total,
        currency: "USD".into(),
        breakdown,
    }))
}

/// GET /api/v1/billing/invoices — List invoices
pub async fn list_invoices(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<InvoicesResponse>, AppError> {
    let invoices = Invoice::list_by_org(&pool, auth.org_id).await?;
    Ok(Json(InvoicesResponse { invoices }))
}

/// GET /api/v1/billing/invoices/{id} — Invoice detail with line items
pub async fn invoice_detail(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Path(id): Path<i64>,
) -> Result<Json<InvoiceDetail>, AppError> {
    let invoice = Invoice::find_by_id(&pool, id, auth.org_id)
        .await?
        .ok_or_else(|| AppError::not_found("Invoice not found"))?;

    let line_items = InvoiceLineItem::list_by_invoice(&pool, invoice.id).await?;

    Ok(Json(InvoiceDetail {
        invoice,
        line_items,
    }))
}

pub async fn generate_invoice(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<MessageResponse>, AppError> {
    let target_org_id = if auth.user_role == "super_admin" {
        params.get("org_id").and_then(|v| v.parse::<i64>().ok()).unwrap_or(auth.org_id)
    } else {
        auth.org_id
    };

    // Generate for previous month
    let now = chrono::Utc::now().date_naive();
    let current_month_start = now.with_day(1).unwrap();
    let previous_month_start = if current_month_start.month() == 1 {
        chrono::NaiveDate::from_ymd_opt(current_month_start.year() - 1, 12, 1).unwrap()
    } else {
        chrono::NaiveDate::from_ymd_opt(
            current_month_start.year(),
            current_month_start.month() - 1,
            1,
        )
        .unwrap()
    };

    invoicer::generate_org_invoice(
        &pool,
        target_org_id,
        previous_month_start,
        current_month_start,
    )
    .await
    .map_err(|e| AppError::internal(e))?;

    Ok(Json(MessageResponse {
        message: format!(
            "Invoice generated for period {} to {}",
            previous_month_start, current_month_start
        ),
    }))
}

// ==========================================================
// Admin: Plan management
// ==========================================================

/// POST /api/v1/billing/plans — Create a new plan (admin)
pub async fn create_plan(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Json(input): Json<CreatePlanInput>,
) -> Result<Json<PlanWithAllotments>, AppError> {
    if auth.user_role != "super_admin" {
        return Err(AppError::forbidden("Admin access required"));
    }
    let plan = Plan::create(&pool, &input).await?;
    Ok(Json(PlanWithAllotments {
        plan,
        allotments: vec![],
    }))
}

/// PUT /api/v1/billing/plans/{id} — Update a plan (admin)
pub async fn update_plan(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Path(id): Path<i64>,
    Json(input): Json<UpdatePlanInput>,
) -> Result<Json<PlanWithAllotments>, AppError> {
    if auth.user_role != "super_admin" {
        return Err(AppError::forbidden("Admin access required"));
    }
    let plan = Plan::update(&pool, id, &input)
        .await?
        .ok_or_else(|| AppError::not_found("Plan not found"))?;
    let allotments = PlanAllotment::list_by_plan_id(&pool, plan.id).await?;
    Ok(Json(PlanWithAllotments { plan, allotments }))
}

/// DELETE /api/v1/billing/plans/{id} — Delete a plan (admin)
pub async fn delete_plan(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Path(id): Path<i64>,
) -> Result<Json<MessageResponse>, AppError> {
    if auth.user_role != "super_admin" {
        return Err(AppError::forbidden("Admin access required"));
    }
    let deleted = Plan::delete(&pool, id).await?;
    if deleted {
        Ok(Json(MessageResponse {
            message: "Plan deleted".into(),
        }))
    } else {
        Err(AppError::not_found("Plan not found"))
    }
}

// ==========================================================
// Subscription management
// ==========================================================

#[derive(Deserialize)]
pub struct ChangeQuantityInput {
    pub committed_quantity: rust_decimal::Decimal,
}

/// PATCH /api/v1/billing/subscriptions/{id} — Change committed quantity (upgrade/downgrade)
pub async fn update_subscription_quantity(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Path(id): Path<i64>,
    Json(input): Json<ChangeQuantityInput>,
) -> Result<Json<MessageResponse>, AppError> {
    let changed =
        Subscription::change_quantity(&pool, id, auth.org_id, input.committed_quantity).await?;
    if changed {
        Ok(Json(MessageResponse {
            message: "Subscription quantity updated".into(),
        }))
    } else {
        Err(AppError::not_found("Active subscription not found"))
    }
}

// ==========================================================
// Fixed estimated cost — use correct aggregation per product
// ==========================================================

/// GET /api/v1/billing/estimated-cost — Real-time estimated cost (correct aggregation)
pub async fn estimated_cost_v2(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<EstimatedCostResponse>, AppError> {
    use crate::billing::invoicer;

    let now = chrono::Utc::now();
    let month_start = now.date_naive().with_day(1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();

    let usage_records = UsageRecord::query(&pool, auth.org_id, month_start, now).await?;
    let subscriptions = Subscription::find_active_by_org(&pool, auth.org_id).await?;
    let all_plans = Plan::list_all(&pool).await?;
    let plan_map: std::collections::HashMap<i64, &Plan> =
        all_plans.iter().map(|p| (p.id, p)).collect();

    let mut estimated_total = rust_decimal::Decimal::ZERO;
    let mut breakdown: Vec<EstimatedProductCost> = Vec::new();

    // Group usage records by product_key
    let mut usage_by_product: std::collections::HashMap<String, Vec<&UsageRecord>> =
        std::collections::HashMap::new();
    for r in &usage_records {
        usage_by_product.entry(r.product_key.clone()).or_default().push(r);
    }

    for (product_key, records) in &usage_by_product {
        // Find matching subscription
        let matching_sub = subscriptions.iter().find(|s| {
            plan_map.get(&s.plan_id).map(|p| p.product_key == *product_key).unwrap_or(false)
        });

        // Find matching plan for aggregation method
        let plan = all_plans.iter().find(|p| p.product_key == *product_key);

        // Apply correct aggregation
        let agg_method = plan.map(|p| p.aggregation_method.as_str()).unwrap_or("sum");
        let billable = invoicer::aggregate_usage_for_estimation(agg_method, records);

        let cost = if let Some(sub) = matching_sub {
            let committed = if billable < sub.committed_quantity {
                billable
            } else {
                sub.committed_quantity
            };
            let overage = if billable > sub.committed_quantity {
                billable - sub.committed_quantity
            } else {
                rust_decimal::Decimal::ZERO
            };
            let overage_rate = sub.unit_price * rust_decimal::Decimal::new(15, 1);
            (committed * sub.unit_price) + (overage * overage_rate)
        } else if let Some(plan) = plan {
            billable * plan.unit_price_monthly
        } else {
            rust_decimal::Decimal::ZERO
        };

        breakdown.push(EstimatedProductCost {
            product_key: product_key.clone(),
            estimated_cost: cost,
            usage_total: billable,
        });
        estimated_total += cost;
    }

    Ok(Json(EstimatedCostResponse {
        org_id: auth.org_id,
        estimated_total,
        currency: "USD".into(),
        breakdown,
    }))
}

// ==========================================================
// Usage alerts
// ==========================================================

#[derive(Serialize)]
pub struct UsageAlertsResponse {
    alerts: Vec<UsageAlert>,
}

/// GET /api/v1/billing/alerts — List usage alerts for the org
pub async fn list_usage_alerts(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<UsageAlertsResponse>, AppError> {
    let alerts = UsageAlert::list_by_org(&pool, auth.org_id).await?;
    Ok(Json(UsageAlertsResponse { alerts }))
}

/// POST /api/v1/billing/alerts — Create a usage alert
pub async fn create_usage_alert(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Json(input): Json<CreateUsageAlertInput>,
) -> Result<Json<UsageAlert>, AppError> {
    let alert = UsageAlert::create(&pool, auth.org_id, &input).await?;
    Ok(Json(alert))
}

/// DELETE /api/v1/billing/alerts/{id} — Delete a usage alert
pub async fn delete_usage_alert(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
    Path(id): Path<i64>,
) -> Result<Json<MessageResponse>, AppError> {
    let deleted = UsageAlert::delete(&pool, id, auth.org_id).await?;
    if deleted {
        Ok(Json(MessageResponse {
            message: "Alert deleted".into(),
        }))
    } else {
        Err(AppError::not_found("Alert not found"))
    }
}

// ==========================================================
// Dashboard summary: single endpoint for the Datadog-style billing page
// ==========================================================

#[derive(Serialize)]
pub struct BillingSummary {
    org_id: i64,
    period_start: String,
    period_end: String,
    committed_monthly_spend: String,
    on_demand_spend: String,
    projected_total: String,
    currency: String,
    subscriptions: Vec<SubscriptionWithPlan>,
    products: Vec<ProductUsageRow>,
    invoices: Vec<Invoice>,
}

#[derive(Serialize)]
pub struct ProductUsageRow {
    product_key: String,
    product_name: String,
    billing_dimension: String,
    unit: String,
    committed_quantity: rust_decimal::Decimal,
    committed_unit_price: rust_decimal::Decimal,
    committed_total: rust_decimal::Decimal,
    on_demand_quantity: rust_decimal::Decimal,
    on_demand_unit_price: rust_decimal::Decimal,
    on_demand_total: rust_decimal::Decimal,
    line_total: rust_decimal::Decimal,
    usage_total: rust_decimal::Decimal,
    allotments: Vec<ProductAllotmentInfo>,
    is_addon: bool,
    parent_product_key: Option<String>,
}

#[derive(Serialize)]
pub struct ProductAllotmentInfo {
    product_key: String,
    free_quantity: rust_decimal::Decimal,
    used_quantity: rust_decimal::Decimal,
}

/// GET /api/v1/billing/summary — Single endpoint returning everything needed
/// for the Datadog-style Plan & Usage dashboard.
pub async fn billing_summary(
    State(pool): State<MySqlPool>,
    auth: AuthContext,
) -> Result<Json<BillingSummary>, AppError> {
    use crate::billing::invoicer;

    let now = chrono::Utc::now();
    let month_start = now
        .date_naive()
        .with_day(1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc();

    // Load all data in parallel
    let (subscriptions, usage_records, all_plans, invoices) = futures::try_join!(
        async { Subscription::find_active_by_org(&pool, auth.org_id).await.map_err(AppError::from) },
        async { UsageRecord::query(&pool, auth.org_id, month_start, now).await.map_err(AppError::from) },
        async { Plan::list_all(&pool).await.map_err(AppError::from) },
        async { Invoice::list_by_org(&pool, auth.org_id).await.map_err(AppError::from) },
    )?;

    let allotments = PlanAllotment::list_by_plan_ids(
        &pool,
        &subscriptions.iter().map(|s| s.plan_id).collect::<Vec<_>>(),
    ).await?;

    let plan_map: std::collections::HashMap<i64, &Plan> =
        all_plans.iter().map(|p| (p.id, p)).collect();

    let mut allotment_map: std::collections::HashMap<i64, Vec<&PlanAllotment>> =
        std::collections::HashMap::new();
    for a in &allotments { allotment_map.entry(a.plan_id).or_default().push(a); }

    // Build subscription-with-plan list
    let subs_with_plans: Vec<SubscriptionWithPlan> = subscriptions
        .iter()
        .filter_map(|sub| plan_map.get(&sub.plan_id).map(|p| SubscriptionWithPlan {
            subscription: sub.clone(),
            plan: (*p).clone(),
        }))
        .collect();

    // Compute per-product rows
    let mut committed_monthly = rust_decimal::Decimal::ZERO;
    let mut on_demand_total = rust_decimal::Decimal::ZERO;
    let mut product_rows = Vec::new();

    // Group usage by product_key
    let mut usage_by_product: std::collections::HashMap<String, Vec<&UsageRecord>> =
        std::collections::HashMap::new();
    for r in &usage_records {
        usage_by_product.entry(r.product_key.clone()).or_default().push(r);
    }

    for sub in &subscriptions {
        let plan = match plan_map.get(&sub.plan_id) { Some(p) => p, None => continue };

        let records = usage_by_product.get(&plan.product_key).map(|v| v.as_slice()).unwrap_or(&[]);
        let agg_method = plan.aggregation_method.as_str();
        let raw_billable = invoicer::aggregate_usage_for_estimation(agg_method, &records.iter().map(|r| *r).collect::<Vec<_>>());

        let committed = if raw_billable < sub.committed_quantity { raw_billable } else { sub.committed_quantity };
        let overage = if raw_billable > sub.committed_quantity { raw_billable - sub.committed_quantity } else { rust_decimal::Decimal::ZERO };

        let committed_total = committed * sub.unit_price;
        let overage_rate = sub.unit_price * rust_decimal::Decimal::new(15, 1);
        let overage_total = overage * overage_rate;

        committed_monthly += committed_total;
        on_demand_total += overage_total;

        let mut allotment_info = Vec::new();
        if let Some(alts) = allotment_map.get(&sub.plan_id) {
            for alt in alts {
                let free_qty = if alt.per_unit == "per_host" { alt.allotted_quantity * committed } else { alt.allotted_quantity };
                let used = usage_by_product.get(&alt.allotted_product_key).map(|v| {
                    invoicer::aggregate_usage_for_estimation("sum", &v.iter().map(|r| *r).collect::<Vec<_>>())
                }).unwrap_or_default();
                allotment_info.push(ProductAllotmentInfo {
                    product_key: alt.allotted_product_key.clone(),
                    free_quantity: free_qty,
                    used_quantity: used,
                });
            }
        }

        product_rows.push(ProductUsageRow {
            product_key: plan.product_key.clone(),
            product_name: plan.name.clone(),
            billing_dimension: plan.billing_dimension.clone(),
            unit: plan.billing_dimension.replace("per_", ""),
            committed_quantity: committed,
            committed_unit_price: sub.unit_price,
            committed_total,
            on_demand_quantity: overage,
            on_demand_unit_price: overage_rate,
            on_demand_total: overage_total,
            line_total: committed_total + overage_total,
            usage_total: raw_billable,
            allotments: allotment_info,
            is_addon: plan.is_addon,
            parent_product_key: plan.parent_product_key.clone(),
        });
    }

    let projected_total = committed_monthly + on_demand_total;

    Ok(Json(BillingSummary {
        org_id: auth.org_id,
        period_start: month_start.format("%Y-%m-%d").to_string(),
        period_end: now.format("%Y-%m-%d").to_string(),
        committed_monthly_spend: committed_monthly.to_string(),
        on_demand_spend: on_demand_total.to_string(),
        projected_total: projected_total.to_string(),
        currency: "USD".into(),
        subscriptions: subs_with_plans,
        products: product_rows,
        invoices,
    }))
}
