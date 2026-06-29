use chrono::Datelike;
use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UsageRecord {
    pub id: i64,
    pub org_id: i64,
    pub product_key: String,
    pub hour: chrono::DateTime<chrono::Utc>,
    pub quantity: rust_decimal::Decimal,
    pub raw_values: Option<serde_json::Value>,
    pub collected_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageProductSnapshot {
    pub product_key: String,
    pub quantity: f64,
    pub raw_values: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSnapshot {
    pub org_id: i64,
    pub hour: chrono::DateTime<chrono::Utc>,
    pub products: Vec<UsageProductSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageSummary {
    pub product_key: String,
    pub total_quantity: rust_decimal::Decimal,
    pub hourly_count: i64,
}

impl UsageRecord {
    /// Bulk insert hourly usage snapshots
    pub async fn insert_snapshot(
        pool: &MySqlPool,
        snapshot: &UsageSnapshot,
    ) -> Result<(), sqlx::Error> {
        for product in &snapshot.products {
            sqlx::query(
                "INSERT INTO usage_records (org_id, product_key, hour, quantity, raw_values) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(snapshot.org_id)
            .bind(&product.product_key)
            .bind(snapshot.hour)
            .bind(rust_decimal::Decimal::from_f64_retain(product.quantity).unwrap_or_default())
            .bind(&product.raw_values)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    /// Query usage records for an org in a time range
    pub async fn query(
        pool: &MySqlPool,
        org_id: i64,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<UsageRecord>, sqlx::Error> {
        sqlx::query_as::<_, UsageRecord>(
            "SELECT * FROM usage_records WHERE org_id = ? AND hour >= ? AND hour < ? ORDER BY hour ASC",
        )
        .bind(org_id)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
    }

    /// Query usage records for a specific product in a time range
    pub async fn query_by_product(
        pool: &MySqlPool,
        org_id: i64,
        product_key: &str,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<UsageRecord>, sqlx::Error> {
        sqlx::query_as::<_, UsageRecord>(
            "SELECT * FROM usage_records WHERE org_id = ? AND product_key = ? AND hour >= ? AND hour < ? ORDER BY hour ASC",
        )
        .bind(org_id)
        .bind(product_key)
        .bind(start)
        .bind(end)
        .fetch_all(pool)
        .await
    }

    /// Get current month usage summary per product
    pub async fn current_month_summary(
        pool: &MySqlPool,
        org_id: i64,
    ) -> Result<Vec<UsageSummary>, sqlx::Error> {
        let now = chrono::Utc::now();
        let month_start =
            now.date_naive().with_day(1).unwrap().and_hms_opt(0, 0, 0).unwrap().and_utc();

        #[derive(sqlx::FromRow)]
        struct Row {
            product_key: String,
            total_quantity: rust_decimal::Decimal,
            hourly_count: i64,
        }

        let rows = sqlx::query_as::<_, Row>(
            "SELECT product_key, SUM(quantity) as total_quantity, COUNT(*) as hourly_count
             FROM usage_records
             WHERE org_id = ? AND hour >= ?
             GROUP BY product_key
             ORDER BY product_key",
        )
        .bind(org_id)
        .bind(month_start)
        .fetch_all(pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|r| UsageSummary {
                product_key: r.product_key,
                total_quantity: r.total_quantity,
                hourly_count: r.hourly_count,
            })
            .collect())
    }
}
