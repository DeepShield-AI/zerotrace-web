use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Plan {
    pub id: i64,
    pub product_key: String,
    pub name: String,
    pub description: String,
    pub billing_dimension: String,
    pub aggregation_method: String,
    pub unit_price_monthly: rust_decimal::Decimal,
    pub unit_price_annual: rust_decimal::Decimal,
    pub currency: String,
    pub is_addon: bool,
    pub tier_level: i32,
    pub parent_product_key: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlanAllotment {
    pub id: i64,
    pub plan_id: i64,
    pub allotted_product_key: String,
    pub allotted_quantity: rust_decimal::Decimal,
    pub per_unit: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePlanInput {
    pub product_key: String,
    pub name: String,
    pub description: String,
    pub billing_dimension: String,
    pub aggregation_method: String,
    pub unit_price_monthly: rust_decimal::Decimal,
    pub unit_price_annual: rust_decimal::Decimal,
    pub currency: Option<String>,
    pub is_addon: Option<bool>,
    pub parent_product_key: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePlanInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub billing_dimension: Option<String>,
    pub aggregation_method: Option<String>,
    pub unit_price_monthly: Option<rust_decimal::Decimal>,
    pub unit_price_annual: Option<rust_decimal::Decimal>,
    pub is_addon: Option<bool>,
    pub parent_product_key: Option<String>,
}

impl Plan {
    pub async fn list_all(pool: &MySqlPool) -> Result<Vec<Plan>, sqlx::Error> {
        sqlx::query_as::<_, Plan>("SELECT * FROM plans ORDER BY is_addon ASC, id ASC")
            .fetch_all(pool)
            .await
    }

    pub async fn create(pool: &MySqlPool, input: &CreatePlanInput) -> Result<Self, sqlx::Error> {
        sqlx::query(
            "INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, currency, is_addon, parent_product_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&input.product_key)
        .bind(&input.name)
        .bind(&input.description)
        .bind(&input.billing_dimension)
        .bind(&input.aggregation_method)
        .bind(&input.unit_price_monthly)
        .bind(&input.unit_price_annual)
        .bind(input.currency.as_deref().unwrap_or("USD"))
        .bind(input.is_addon.unwrap_or(false))
        .bind(&input.parent_product_key)
        .execute(pool)
        .await?;

        Self::find_by_product_key(pool, &input.product_key).await.map(|p| p.unwrap())
    }

    pub async fn update(
        pool: &MySqlPool,
        id: i64,
        input: &UpdatePlanInput,
    ) -> Result<Option<Self>, sqlx::Error> {
        // Build dynamic update
        let existing = Self::find_by_id(pool, id).await?;
        if existing.is_none() {
            return Ok(None);
        }

        let name = input.name.as_deref().unwrap_or(&existing.as_ref().unwrap().name);
        let desc = input.description.as_deref().unwrap_or(&existing.as_ref().unwrap().description);
        let dim = input
            .billing_dimension
            .as_deref()
            .unwrap_or(&existing.as_ref().unwrap().billing_dimension);
        let agg = input
            .aggregation_method
            .as_deref()
            .unwrap_or(&existing.as_ref().unwrap().aggregation_method);
        let monthly = input
            .unit_price_monthly
            .unwrap_or(existing.as_ref().unwrap().unit_price_monthly);
        let annual =
            input.unit_price_annual.unwrap_or(existing.as_ref().unwrap().unit_price_annual);
        let addon = input.is_addon.unwrap_or(existing.as_ref().unwrap().is_addon);
        let parent = input.parent_product_key.as_deref().or(existing
            .as_ref()
            .unwrap()
            .parent_product_key
            .as_deref());

        sqlx::query(
            "UPDATE plans SET name = ?, description = ?, billing_dimension = ?, aggregation_method = ?, unit_price_monthly = ?, unit_price_annual = ?, is_addon = ?, parent_product_key = ? WHERE id = ?",
        )
        .bind(name)
        .bind(desc)
        .bind(dim)
        .bind(agg)
        .bind(&monthly)
        .bind(&annual)
        .bind(addon)
        .bind(parent)
        .bind(id)
        .execute(pool)
        .await?;

        Self::find_by_id(pool, id).await
    }

    pub async fn delete(pool: &MySqlPool, id: i64) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM plans WHERE id = ?").bind(id).execute(pool).await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn find_by_product_key(
        pool: &MySqlPool,
        product_key: &str,
    ) -> Result<Option<Plan>, sqlx::Error> {
        sqlx::query_as::<_, Plan>("SELECT * FROM plans WHERE product_key = ?")
            .bind(product_key)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_id(pool: &MySqlPool, id: i64) -> Result<Option<Plan>, sqlx::Error> {
        sqlx::query_as::<_, Plan>("SELECT * FROM plans WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await
    }
}

impl PlanAllotment {
    pub async fn list_by_plan_id(
        pool: &MySqlPool,
        plan_id: i64,
    ) -> Result<Vec<PlanAllotment>, sqlx::Error> {
        sqlx::query_as::<_, PlanAllotment>("SELECT * FROM plan_allotments WHERE plan_id = ?")
            .bind(plan_id)
            .fetch_all(pool)
            .await
    }

    pub async fn list_by_plan_ids(
        pool: &MySqlPool,
        plan_ids: &[i64],
    ) -> Result<Vec<PlanAllotment>, sqlx::Error> {
        if plan_ids.is_empty() {
            return Ok(vec![]);
        }
        // Load all allotments and filter (plan count is small)
        let all = sqlx::query_as::<_, PlanAllotment>("SELECT * FROM plan_allotments")
            .fetch_all(pool)
            .await?;
        Ok(all.into_iter().filter(|a| plan_ids.contains(&a.plan_id)).collect())
    }
}
