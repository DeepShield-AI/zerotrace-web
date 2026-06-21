use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;

pub type DbPool = MySqlPool;

pub async fn init_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;

    tracing::info!("Connected to MySQL database");
    Ok(pool)
}

pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    let sql = include_str!("../migrations/001_initial.sql");

    for statement in sql.split(';') {
        let trimmed = statement.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Err(e) = sqlx::query(trimmed).execute(pool).await {
            let msg = e.to_string();
            // Duplicate column / index — already applied, skip
            if msg.contains("Duplicate column") || msg.contains("Duplicate key") {
                tracing::info!("Skipping already-applied migration: {}", msg.lines().next().unwrap_or(""));
                continue;
            }
            return Err(e);
        }
    }
    tracing::info!("Database migrations completed");
    Ok(())
}
