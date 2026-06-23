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

    // MySQL supports multiple statements in one query call.
    for statement in sql.split(';') {
        let trimmed = statement.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Err(e) = sqlx::query(trimmed).execute(pool).await {
            let msg = e.to_string();
            // MySQL error codes/messages for objects that already exist.
            // ER_TABLE_EXISTS_ERROR = 1050, ER_DUP_KEYNAME = 1061, ER_DUP_FIELD = 1060.
            if msg.contains("Duplicate column")
                || msg.contains("Duplicate key")
                || msg.contains("already exists")
                || msg.contains("1050")
                || msg.contains("1060")
                || msg.contains("1061")
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
    tracing::info!("Database migrations completed");
    Ok(())
}
