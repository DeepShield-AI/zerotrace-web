use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Invoice {
    pub id: i64,
    pub org_id: i64,
    pub period_start: chrono::NaiveDate,
    pub period_end: chrono::NaiveDate,
    pub subtotal: rust_decimal::Decimal,
    pub discount: rust_decimal::Decimal,
    pub total: rust_decimal::Decimal,
    pub currency: String,
    pub status: String,
    pub issued_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InvoiceLineItem {
    pub id: i64,
    pub invoice_id: i64,
    pub product_key: String,
    pub description: String,
    pub commitment_quantity: rust_decimal::Decimal,
    pub commitment_unit_price: rust_decimal::Decimal,
    pub commitment_total: rust_decimal::Decimal,
    pub overage_quantity: rust_decimal::Decimal,
    pub overage_unit_price: rust_decimal::Decimal,
    pub overage_total: rust_decimal::Decimal,
    pub line_total: rust_decimal::Decimal,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InvoiceDetail {
    #[serde(flatten)]
    pub invoice: Invoice,
    pub line_items: Vec<InvoiceLineItem>,
}

impl Invoice {
    pub async fn create(
        pool: &MySqlPool,
        org_id: i64,
        period_start: chrono::NaiveDate,
        period_end: chrono::NaiveDate,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query(
            "INSERT INTO invoices (org_id, period_start, period_end, status) VALUES (?, ?, ?, 'draft')",
        )
        .bind(org_id)
        .bind(period_start)
        .bind(period_end)
        .execute(pool)
        .await?;

        sqlx::query_as::<_, Self>(
            "SELECT * FROM invoices WHERE org_id = ? AND period_start = ? ORDER BY id DESC LIMIT 1",
        )
        .bind(org_id)
        .bind(period_start)
        .fetch_one(pool)
        .await
    }

    pub async fn update_totals(
        pool: &MySqlPool,
        id: i64,
        subtotal: rust_decimal::Decimal,
        discount: rust_decimal::Decimal,
        total: rust_decimal::Decimal,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE invoices SET subtotal = ?, discount = ?, total = ? WHERE id = ?")
            .bind(&subtotal)
            .bind(&discount)
            .bind(&total)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn finalize(pool: &MySqlPool, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE invoices SET status = 'open', issued_at = NOW() WHERE id = ? AND status = 'draft'",
        )
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn list_by_org(pool: &MySqlPool, org_id: i64) -> Result<Vec<Invoice>, sqlx::Error> {
        sqlx::query_as::<_, Invoice>(
            "SELECT * FROM invoices WHERE org_id = ? ORDER BY period_start DESC LIMIT 24",
        )
        .bind(org_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(
        pool: &MySqlPool,
        id: i64,
        org_id: i64,
    ) -> Result<Option<Invoice>, sqlx::Error> {
        sqlx::query_as::<_, Invoice>("SELECT * FROM invoices WHERE id = ? AND org_id = ?")
            .bind(id)
            .bind(org_id)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_draft_for_period(
        pool: &MySqlPool,
        org_id: i64,
        period_start: chrono::NaiveDate,
    ) -> Result<Option<Invoice>, sqlx::Error> {
        sqlx::query_as::<_, Invoice>(
            "SELECT * FROM invoices WHERE org_id = ? AND period_start = ? AND status = 'draft' LIMIT 1",
        )
        .bind(org_id)
        .bind(period_start)
        .fetch_optional(pool)
        .await
    }
}

impl InvoiceLineItem {
    pub async fn create(
        pool: &MySqlPool,
        invoice_id: i64,
        product_key: &str,
        description: &str,
        commitment_quantity: rust_decimal::Decimal,
        commitment_unit_price: rust_decimal::Decimal,
        commitment_total: rust_decimal::Decimal,
        overage_quantity: rust_decimal::Decimal,
        overage_unit_price: rust_decimal::Decimal,
        overage_total: rust_decimal::Decimal,
        line_total: rust_decimal::Decimal,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query(
            "INSERT INTO invoice_line_items (invoice_id, product_key, description, commitment_quantity, commitment_unit_price, commitment_total, overage_quantity, overage_unit_price, overage_total, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(invoice_id)
        .bind(product_key)
        .bind(description)
        .bind(&commitment_quantity)
        .bind(&commitment_unit_price)
        .bind(&commitment_total)
        .bind(&overage_quantity)
        .bind(&overage_unit_price)
        .bind(&overage_total)
        .bind(&line_total)
        .execute(pool)
        .await?;

        sqlx::query_as::<_, Self>(
            "SELECT * FROM invoice_line_items WHERE invoice_id = ? AND product_key = ? ORDER BY id DESC LIMIT 1",
        )
        .bind(invoice_id)
        .bind(product_key)
        .fetch_one(pool)
        .await
    }

    pub async fn list_by_invoice(
        pool: &MySqlPool,
        invoice_id: i64,
    ) -> Result<Vec<InvoiceLineItem>, sqlx::Error> {
        sqlx::query_as::<_, InvoiceLineItem>(
            "SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY product_key ASC",
        )
        .bind(invoice_id)
        .fetch_all(pool)
        .await
    }
}
