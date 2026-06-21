use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: i64, pub org_id: i64, pub email: String,
    #[serde(skip_serializing)] pub password_hash: String,
    pub name: String, pub role: String, pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>, pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterInput { pub name: String, pub email: String, pub password: String, pub org_name: String, }
#[derive(Debug, Deserialize)]
pub struct LoginInput { pub email: String, pub password: String, }

#[derive(Debug, Serialize)]
pub struct UserResponse { pub id: i64, pub org_id: i64, pub email: String, pub name: String, pub role: String, pub status: String, pub created_at: chrono::DateTime<chrono::Utc>, }

impl From<User> for UserResponse {
    fn from(u: User) -> Self { Self { id: u.id, org_id: u.org_id, email: u.email, name: u.name, role: u.role, status: u.status, created_at: u.created_at } }
}

impl User {
    pub fn hash_password(p: &str) -> Result<String, argon2::password_hash::Error> {
        let salt = SaltString::generate(&mut OsRng);
        Ok(Argon2::default().hash_password(p.as_bytes(), &salt)?.to_string())
    }
    pub fn verify_password(p: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
        Ok(Argon2::default().verify_password(p.as_bytes(), &PasswordHash::new(hash)?).is_ok())
    }
    pub async fn create(pool: &MySqlPool, org_id: i64, email: &str, hash: &str, name: &str) -> Result<Self, sqlx::Error> {
        sqlx::query("INSERT INTO web_users (org_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'admin')")
            .bind(org_id).bind(email).bind(hash).bind(name).execute(pool).await?;
        Self::find_by_email(pool, email).await.map(|u| u.unwrap())
    }
    pub async fn find_by_email(pool: &MySqlPool, email: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM web_users WHERE email = ? AND status = 'active'")
            .bind(email).fetch_optional(pool).await
    }
    pub async fn find_by_id(pool: &MySqlPool, id: i64) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM web_users WHERE id = ? AND status = 'active'")
            .bind(id).fetch_optional(pool).await
    }
}
