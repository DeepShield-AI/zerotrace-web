use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Subscription {
    pub id: i64,
    pub org_id: i64,
    pub plan_id: i64,
    pub commitment_type: String,
    pub committed_quantity: rust_decimal::Decimal,
    pub unit_price: rust_decimal::Decimal,
    pub status: String,
    pub current_period_start: chrono::DateTime<chrono::Utc>,
    pub current_period_end: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSubscriptionInput {
    pub plan_id: i64,
    pub commitment_type: String, // "annual", "monthly", "on_demand"
    pub committed_quantity: rust_decimal::Decimal,
}

impl Subscription {
    pub async fn create(
        pool: &MySqlPool,
        org_id: i64,
        plan_id: i64,
        commitment_type: &str,
        committed_quantity: rust_decimal::Decimal,
        unit_price: rust_decimal::Decimal,
    ) -> Result<Self, sqlx::Error> {
        let now = chrono::Utc::now();
        let period_end = match commitment_type {
            "annual" => now + chrono::Duration::days(365),
            _ => now + chrono::Duration::days(30),
        };

        sqlx::query(
            "INSERT INTO subscriptions (org_id, plan_id, commitment_type, committed_quantity, unit_price, status, current_period_start, current_period_end) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)"
        )
        .bind(org_id)
        .bind(plan_id)
        .bind(commitment_type)
        .bind(&committed_quantity)
        .bind(&unit_price)
        .bind(now)
        .bind(period_end)
        .execute(pool)
        .await?;

        sqlx::query_as::<_, Self>(
            "SELECT * FROM subscriptions WHERE org_id = ? AND plan_id = ? ORDER BY id DESC LIMIT 1",
        )
        .bind(org_id)
        .bind(plan_id)
        .fetch_one(pool)
        .await
    }

    pub async fn list_by_org(
        pool: &MySqlPool,
        org_id: i64,
    ) -> Result<Vec<Subscription>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM subscriptions WHERE org_id = ? ORDER BY created_at DESC",
        )
        .bind(org_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_active_by_org(
        pool: &MySqlPool,
        org_id: i64,
    ) -> Result<Vec<Subscription>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT * FROM subscriptions WHERE org_id = ? AND status = 'active' ORDER BY plan_id ASC",
        )
        .bind(org_id)
        .fetch_all(pool)
        .await
    }

    pub async fn cancel(pool: &MySqlPool, id: i64, org_id: i64) -> Result<bool, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE subscriptions SET status = 'canceled' WHERE id = ? AND org_id = ? AND status = 'active'",
        )
        .bind(id)
        .bind(org_id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn find_active_by_org_and_product(
        pool: &MySqlPool,
        org_id: i64,
        product_key: &str,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "SELECT s.* FROM subscriptions s
             JOIN plans p ON s.plan_id = p.id
             WHERE s.org_id = ? AND p.product_key = ? AND s.status = 'active'
             LIMIT 1",
        )
        .bind(org_id)
        .bind(product_key)
        .fetch_optional(pool)
        .await
    }

    /// Mark subscriptions as expired when `current_period_end` has passed
    pub async fn expire_ended(pool: &MySqlPool) -> Result<u64, sqlx::Error> {
        let result = sqlx::query(
            "UPDATE subscriptions SET status = 'expired'
             WHERE status = 'active' AND current_period_end < NOW()",
        )
        .execute(pool)
        .await?;
        Ok(result.rows_affected())
    }

    /// Change committed quantity (upgrade/downgrade) — creates a new period
    pub async fn change_quantity(
        pool: &MySqlPool,
        id: i64,
        org_id: i64,
        new_quantity: rust_decimal::Decimal,
    ) -> Result<bool, sqlx::Error> {
        let now = chrono::Utc::now();
        let period_end = now + chrono::Duration::days(30);
        let result = sqlx::query(
            "UPDATE subscriptions
             SET committed_quantity = ?, current_period_start = ?, current_period_end = ?
             WHERE id = ? AND org_id = ? AND status = 'active'",
        )
        .bind(&new_quantity)
        .bind(now)
        .bind(period_end)
        .bind(id)
        .bind(org_id)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }
}
