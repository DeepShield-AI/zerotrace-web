use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UsageAlert {
    pub id: i64,
    pub org_id: i64,
    pub product_key: String,
    pub threshold_pct: i32,
    pub threshold_absolute: Option<rust_decimal::Decimal>,
    pub channel: String,
    pub last_triggered_at: Option<chrono::DateTime<chrono::Utc>>,
    pub is_enabled: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUsageAlertInput {
    pub product_key: String,
    pub threshold_pct: Option<i32>,
    pub threshold_absolute: Option<rust_decimal::Decimal>,
    pub channel: Option<String>,
}

impl UsageAlert {
    pub async fn create(
        pool: &MySqlPool,
        org_id: i64,
        input: &CreateUsageAlertInput,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query(
            "INSERT INTO usage_alerts (org_id, product_key, threshold_pct, threshold_absolute, channel)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(org_id)
        .bind(&input.product_key)
        .bind(input.threshold_pct.unwrap_or(80))
        .bind(&input.threshold_absolute)
        .bind(input.channel.as_deref().unwrap_or("email"))
        .execute(pool)
        .await?;

        sqlx::query_as::<_, Self>(
            "SELECT * FROM usage_alerts WHERE org_id = ? AND product_key = ? ORDER BY id DESC LIMIT 1",
        )
        .bind(org_id)
        .bind(&input.product_key)
        .fetch_one(pool)
        .await
    }

    pub async fn list_by_org(
        pool: &MySqlPool,
        org_id: i64,
    ) -> Result<Vec<UsageAlert>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM usage_alerts WHERE org_id = ? ORDER BY created_at DESC",
        )
        .bind(org_id)
        .fetch_all(pool)
        .await
    }

    pub async fn delete(pool: &MySqlPool, id: i64, org_id: i64) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM usage_alerts WHERE id = ? AND org_id = ?")
            .bind(id)
            .bind(org_id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Check if any alert should trigger and update last_triggered_at
    pub async fn touch(pool: &MySqlPool, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE usage_alerts SET last_triggered_at = NOW() WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
