use sqlx::{MySqlPool, mysql::MySqlPoolOptions};
use std::time::Duration;

pub type DbPool = MySqlPool;

pub async fn init_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .idle_timeout(Duration::from_secs(30))
        .max_lifetime(Duration::from_secs(300))
        .acquire_timeout(Duration::from_secs(10))
        .connect(database_url)
        .await?;

    tracing::info!("Connected to MySQL database");
    Ok(pool)
}

pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    // Run all migration files in order
    let migration_files: [&str; 3] = [
        include_str!("../migrations/001_initial.sql"),
        include_str!("../migrations/002_billing.sql"),
        include_str!("../migrations/003_billing_enhancements.sql"),
    ];

    for sql in &migration_files {
        for statement in sql.split(';') {
            let trimmed = statement.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Err(e) = sqlx::query(trimmed).execute(pool).await {
                let msg = e.to_string();
                if msg.contains("Duplicate column") ||
                    msg.contains("Duplicate key") ||
                    msg.contains("already exists") ||
                    msg.contains("1050") ||
                    msg.contains("1060") ||
                    msg.contains("1061") ||
                    msg.contains("1295") ||
                    msg.contains("not supported in the prepared statement")
                {
                    tracing::info!(
                        "Skipping already-applied migration: {}",
                        msg.lines().next().unwrap_or("")
                    );
                    continue;
                }
                return Err(e);
            }
        }
    }
    tracing::info!("Database migrations completed");
    Ok(())
}
