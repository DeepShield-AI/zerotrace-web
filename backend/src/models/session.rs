use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Session {
    pub id: String,
    pub user_id: i64,
    pub org_id: i64,
    pub data: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Session {
    pub async fn create(pool: &MySqlPool, user_id: i64, org_id: i64) -> Result<Self, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let expires_at = chrono::Utc::now().checked_add_signed(chrono::Duration::days(7)).unwrap();

        sqlx::query("INSERT INTO sessions (id, user_id, org_id, data, expires_at) VALUES (?, ?, ?, '{}', ?)")
            .bind(&id).bind(user_id).bind(org_id).bind(expires_at)
            .execute(pool).await?;

        Self::find_valid(pool, &id).await.map(|s| s.unwrap())
    }

    pub async fn find_valid(pool: &MySqlPool, id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM sessions WHERE id = ? AND expires_at > NOW()")
            .bind(id)
            .fetch_optional(pool)
            .await
    }

    pub async fn delete(pool: &MySqlPool, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM sessions WHERE id = ?").bind(id).execute(pool).await?;
        Ok(())
    }

    pub async fn cleanup_expired(pool: &MySqlPool) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM sessions WHERE expires_at <= NOW()")
            .execute(pool)
            .await?;
        Ok(())
    }
}
