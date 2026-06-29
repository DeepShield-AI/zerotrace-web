use crate::{
    billing::invoicer,
    models::usage::{UsageProductSnapshot, UsageSnapshot},
};
use chrono::{Datelike, Timelike};
use reqwest::Client;
use serde::Deserialize;
use sqlx::MySqlPool;
use std::time::Duration;
use tracing;

/// Response from zerotrace-server usage metering API
#[derive(Debug, Deserialize)]
struct MeteringResponse {
    org_id: i64,
    hour: String,
    products: std::collections::HashMap<String, f64>,
}

/// Collect usage data from zerotrace-server and store in usage_records.
/// Runs as a background task, polling every hour.
pub async fn run_collector(pool: MySqlPool, server_url: String) {
    let client = Client::new();

    // On startup, wait 30 seconds for services to stabilize
    tokio::time::sleep(Duration::from_secs(30)).await;
    tracing::info!("Usage collector started (server: {})", server_url);

    // Backfill any missing hours since the last recorded usage point
    if let Err(e) = backfill_missing_hours(&pool, &client, &server_url).await {
        tracing::warn!("Backfill attempt failed (non-fatal): {}", e);
    }

    // Check for any uninvoiced past months on startup
    if let Err(e) = invoicer::generate_missing_invoices(&pool).await {
        tracing::warn!("Missing invoice check on startup failed: {}", e);
    }

    // Purge usage records older than 13 months (retention policy)
    let cutoff = chrono::Utc::now() - chrono::Duration::days(395);
    match sqlx::query("DELETE FROM usage_records WHERE collected_at < ?")
        .bind(cutoff)
        .execute(&pool)
        .await
    {
        Ok(r) =>
            if r.rows_affected() > 0 {
                tracing::info!(
                    "Purged {} usage records older than 13 months",
                    r.rows_affected()
                );
            },
        Err(e) => tracing::warn!("Usage record purge failed: {}", e),
    }

    let mut last_month_check = chrono::Utc::now().date_naive().with_day(1).unwrap();

    loop {
        // Collect current hour's usage
        match collect_all_orgs(&pool, &client, &server_url).await {
            Ok(count) => {
                tracing::info!("Usage collection complete: {} orgs processed", count);
            },
            Err(e) => {
                tracing::error!("Usage collection failed: {}", e);
            },
        }

        // Check if month has rolled over — trigger invoice generation
        let now = chrono::Utc::now().date_naive();
        let current_month_start = now.with_day(1).unwrap();
        if current_month_start > last_month_check {
            tracing::info!("Month rollover detected, generating invoices...");
            match invoicer::generate_monthly_invoices(&pool, last_month_check).await {
                Ok(count) => tracing::info!("Invoices generated: {} orgs", count),
                Err(e) => tracing::error!("Invoice generation failed: {}", e),
            }
            last_month_check = current_month_start;
        }

        // Sleep until next hour — handle midnight wrap correctly
        let now_dt = chrono::Utc::now();
        let next_hour = now_dt + chrono::Duration::hours(1);
        let next_hour_start = next_hour
            .date_naive()
            .and_hms_opt(next_hour.time().hour(), 0, 0)
            .unwrap()
            .and_utc();
        let wait = (next_hour_start - now_dt).to_std().unwrap_or(Duration::from_secs(3600));
        tokio::time::sleep(wait).await;
    }
}

/// Backfill usage for hours since the last recorded entry
async fn backfill_missing_hours(
    pool: &MySqlPool,
    client: &Client,
    server_url: &str,
) -> Result<usize, String> {
    // Find most recent usage record timestamp
    #[derive(sqlx::FromRow)]
    struct LastHour {
        max_hour: Option<chrono::DateTime<chrono::Utc>>,
    }
    let last: LastHour =
        sqlx::query_as::<_, LastHour>("SELECT MAX(hour) as max_hour FROM usage_records")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Failed to query last usage: {}", e))?;

    let now = chrono::Utc::now();
    let current_hour = now.date_naive().and_hms_opt(now.time().hour(), 0, 0).unwrap().and_utc();

    // Determine the first missing hour
    let first_missing = match last.max_hour {
        Some(last_hour) => last_hour + chrono::Duration::hours(1),
        None => {
            // No records at all — start from beginning of current month
            let month_start =
                now.date_naive().with_day(1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();
            month_start
        },
    };

    let mut backfilled = 0;
    let mut hour = first_missing;
    while hour < current_hour {
        tracing::info!("Backfilling usage for hour: {}", hour);
        match collect_hour_for_all_orgs(pool, client, server_url, hour).await {
            Ok(count) => backfilled += count,
            Err(e) => tracing::warn!("Backfill failed for hour {}: {}", hour, e),
        }
        hour = hour + chrono::Duration::hours(1);
    }

    if backfilled > 0 {
        tracing::info!("Backfilled {} usage records", backfilled);
    }
    Ok(backfilled)
}

/// Collect usage for a specific hour across all orgs
async fn collect_hour_for_all_orgs(
    pool: &MySqlPool,
    client: &Client,
    server_url: &str,
    hour: chrono::DateTime<chrono::Utc>,
) -> Result<usize, String> {
    #[derive(sqlx::FromRow)]
    struct OrgRow {
        id: i64,
    }
    let orgs: Vec<OrgRow> = sqlx::query_as::<_, OrgRow>("SELECT id FROM organizations ORDER BY id")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to query orgs: {}", e))?;

    let mut collected = 0;
    for org in &orgs {
        match fetch_org_usage(client, server_url, org.id, hour).await {
            Ok(snapshot) => {
                if let Err(e) =
                    crate::models::usage::UsageRecord::insert_snapshot(pool, &snapshot).await
                {
                    tracing::warn!(
                        "Failed to store usage for org {} at {}: {}",
                        org.id,
                        hour,
                        e
                    );
                } else {
                    collected += 1;
                }
            },
            Err(e) => {
                tracing::warn!(
                    "Failed to fetch usage for org {} at {}: {}",
                    org.id,
                    hour,
                    e
                );
            },
        }
    }
    Ok(collected)
}

/// Fetch usage for all active orgs for the current hour
async fn collect_all_orgs(
    pool: &MySqlPool,
    client: &Client,
    server_url: &str,
) -> Result<usize, String> {
    let now = chrono::Utc::now();
    let hour_start = now.date_naive().and_hms_opt(now.time().hour(), 0, 0).unwrap().and_utc();

    collect_hour_for_all_orgs(pool, client, server_url, hour_start).await
}

/// Fetch usage for a single org from zerotrace-server
async fn fetch_org_usage(
    client: &Client,
    server_url: &str,
    org_id: i64,
    hour: chrono::DateTime<chrono::Utc>,
) -> Result<UsageSnapshot, String> {
    let url = format!(
        "{}/api/v1/usage/metering?org_id={}&hour={}",
        server_url,
        org_id,
        hour.format("%Y-%m-%dT%H:%M:%SZ")
    );

    let resp = client
        .get(&url)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("HTTP request failed for org {}: {}", org_id, e))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Usage API returned {} for org {}",
            resp.status(),
            org_id
        ));
    }

    let metering: MeteringResponse = resp.json().await.map_err(|e| {
        format!(
            "Failed to parse metering response for org {}: {}",
            org_id, e
        )
    })?;

    let products: Vec<UsageProductSnapshot> = metering
        .products
        .into_iter()
        .map(|(product_key, quantity)| UsageProductSnapshot {
            product_key,
            // Store the hourly value as raw_values JSON for HWMP audit trail
            raw_values: Some(serde_json::json!({"hourly_value": quantity})),
            quantity,
        })
        .collect();

    Ok(UsageSnapshot {
        org_id,
        hour,
        products,
    })
}
