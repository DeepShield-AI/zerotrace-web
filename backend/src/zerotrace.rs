// DeepFlow server integration: org provisioning and lifecycle.
//
// When a new organization is registered through zerotrace-web, we must also:
// 1. Allocate an org ID from DeepFlow's ID manager
// 2. Create the org-scoped MySQL database (with all schema tables)
// 3. Insert the org record into DeepFlow's org table
//
// This module provides helpers that call DeepFlow's HTTP API.

use crate::errors::AppError;
use reqwest::Client;
use serde_json::Value;

/// Returns the DeepFlow server base URL from environment.
pub fn zerotrace_server_url() -> String {
    std::env::var("ZEROTRACE_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:30417".to_string())
}

fn df_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::internal(format!("http client: {}", e)))
}

/// Allocate a new org ID from DeepFlow's ID manager.
/// Returns the allocated org ID, or an error if DeepFlow is unreachable.
pub async fn alloc_org_id() -> Result<i64, AppError> {
    let client = df_client()?;
    let url = format!("{}/v1/alloc-org-id/", zerotrace_server_url());
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::internal(format!("DeepFlow alloc-org-id failed: {}", e)))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::internal(format!(
            "DeepFlow alloc-org-id returned {}: {}",
            status.as_u16(),
            body
        )));
    }

    let json: Value = resp
        .json()
        .await
        .map_err(|e| AppError::internal(format!("DeepFlow alloc-org-id parse error: {}", e)))?;

    // Response format: {"DATA": {"ORG_ID": 3}}
    let org_id = json
        .get("DATA")
        .and_then(|d| d.get("ORG_ID"))
        .and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::internal("DeepFlow alloc-org-id: unexpected response format"))?;

    if org_id <= 1 {
        return Err(AppError::internal(format!(
            "DeepFlow allocated invalid org_id: {}",
            org_id
        )));
    }

    Ok(org_id)
}

/// Create the org-scoped MySQL database in DeepFlow.
/// This copies the schema tables and controller/analyzer records from the default org.
pub async fn create_zerotrace_org_db(org_id: i64) -> Result<(), AppError> {
    let client = df_client()?;
    let url = format!("{}/v1/org/", zerotrace_server_url());
    let body = serde_json::json!({"ORGANIZATION_ID": org_id});

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::internal(format!("DeepFlow create org DB failed: {}", e)))?;

    let status = resp.status();
    let body_text = resp.text().await.unwrap_or_default();

    if !status.is_success() {
        // If the database already exists, this is not fatal — it may have been
        // created by a previous registration attempt.
        if body_text.contains("already exists") {
            tracing::warn!(
                org_id,
                "DeepFlow org database already exists (likely from a prior registration)"
            );
            return Ok(());
        }
        return Err(AppError::internal(format!(
            "DeepFlow create org DB returned {}: {}",
            status.as_u16(),
            body_text
        )));
    }

    tracing::info!(org_id, "DeepFlow org database created successfully");
    Ok(())
}

/// Insert a record into DeepFlow's `org` table in the default database.
/// This is needed so the ingester discovers the new org and creates ClickHouse
/// databases for it. Uses zerotrace-web's existing MySQL connection pool.
pub async fn insert_org_record(
    pool: &sqlx::MySqlPool,
    org_id: i64,
    org_name: &str,
) -> Result<(), AppError> {
    let lcuuid = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT IGNORE INTO org (org_id, name, lcuuid, owner_user_id) VALUES (?, ?, ?, 0)")
        .bind(org_id)
        .bind(org_name)
        .bind(&lcuuid)
        .execute(pool)
        .await
        .map_err(|e| AppError::internal(format!("insert org record: {}", e)))?;

    tracing::info!(
        org_id,
        org_name,
        lcuuid,
        "org record inserted for ingester discovery"
    );
    Ok(())
}

/// Provision a new org in DeepFlow: allocate ID + insert org table record +
/// create MySQL database. Returns the allocated org_id on success.
///
/// This is called during registration so the org is immediately ready for:
/// - Agent registration (the org-scoped MySQL database exists)
/// - Data ingestion (the ingester discovers the org and creates ClickHouse tables)
/// - Web queries (the org-scoped ClickHouse databases will be auto-created)
pub async fn provision_org(pool: &sqlx::MySqlPool, org_name: &str) -> Result<i64, AppError> {
    let org_id = alloc_org_id().await?;
    // Insert into the org table first so the ingester can discover this org
    // (it polls GetORGIDs every 60 seconds to pick up new orgs).
    insert_org_record(pool, org_id, org_name).await?;
    create_zerotrace_org_db(org_id).await?;
    tracing::info!(
        org_id,
        org_name,
        "DeepFlow org fully provisioned: org record + MySQL DB created"
    );
    Ok(org_id)
}

/// Update all vtap (agent) records for this org to have `org_id` set correctly.
/// This ensures ClickHouse rows are tagged with the correct org_id
/// so per-org Materialized View routing works correctly.
/// Safe to call multiple times — just updates existing vtap records.
pub async fn sync_vtap_org_id(pool: &sqlx::MySqlPool, org_id: i64) -> Result<(), AppError> {
    if org_id <= 1 {
        return Ok(());
    }
    let result = sqlx::query("UPDATE vtap SET org_id = ? WHERE org_id IS NULL OR org_id = 1 LIMIT 1")
        .bind(org_id)
        .execute(pool)
        .await;
    match result {
        Ok(r) => {
            if r.rows_affected() > 0 {
                tracing::info!(
                    org_id,
                    affected = r.rows_affected(),
                    "Updated vtap team_id to match org_id"
                );
            }
            Ok(())
        },
        Err(e) => {
            tracing::warn!(org_id, error = ?e, "Failed to update vtap team_id");
            Err(AppError::internal(e.to_string()))
        },
    }
}
