use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Organization {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl Organization {
    pub async fn create(pool: &MySqlPool, name: &str, slug: &str) -> Result<Self, sqlx::Error> {
        sqlx::query("INSERT INTO organizations (name, slug) VALUES (?, ?)")
            .bind(name).bind(slug).execute(pool).await?;

        sqlx::query_as::<_, Self>("SELECT * FROM organizations WHERE slug = ?")
            .bind(slug).fetch_one(pool).await
    }
}
