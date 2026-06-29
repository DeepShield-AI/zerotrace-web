use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::MySqlPool;

fn encryption_key() -> [u8; 32] {
    let key_str = std::env::var("ZT_ENCRYPTION_KEY")
        .unwrap_or_else(|_| "zerotrace-dev-key-32-bytes-xxxx".to_string());
    let mut key = [0u8; 32];
    let bytes = key_str.as_bytes();
    let len = bytes.len().min(32);
    key[..len].copy_from_slice(&bytes[..len]);
    key
}

fn encrypt_key(raw: &str) -> Result<String, String> {
    let cipher =
        Aes256Gcm::new_from_slice(&encryption_key()).map_err(|e| format!("cipher: {}", e))?;
    let mut nonce_bytes = [0u8; 12];
    rand::rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext =
        cipher.encrypt(nonce, raw.as_bytes()).map_err(|e| format!("encrypt: {}", e))?;
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(BASE64.encode(&combined))
}

fn decrypt_key(encrypted: &str) -> Result<String, String> {
    let cipher =
        Aes256Gcm::new_from_slice(&encryption_key()).map_err(|e| format!("cipher: {}", e))?;
    let combined = BASE64.decode(encrypted).map_err(|e| format!("base64: {}", e))?;
    if combined.len() < 12 {
        return Err("invalid encrypted key".to_string());
    }
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher.decrypt(nonce, ciphertext).map_err(|e| format!("decrypt: {}", e))?;
    String::from_utf8(plaintext).map_err(|e| format!("utf8: {}", e))
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApiKey {
    pub id: i64,
    pub org_id: i64,
    pub user_id: i64,
    pub name: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    #[serde(skip_serializing)]
    pub key_encrypted: String,
    pub key_prefix: String,
    pub scopes: String,
    pub team_id: Option<i64>,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub revoked_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyCreated {
    pub id: i64,
    pub name: String,
    pub key: String,
    pub key_prefix: String,
    pub scopes: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyRow {
    pub id: i64,
    pub name: String,
    pub key_prefix: String,
    pub scopes: String,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<ApiKey> for ApiKeyRow {
    fn from(k: ApiKey) -> Self {
        Self {
            id: k.id,
            name: k.name,
            key_prefix: k.key_prefix,
            scopes: k.scopes,
            last_used_at: k.last_used_at,
            status: if k.revoked_at.is_some() {
                "revoked"
            } else {
                "active"
            }
            .into(),
            created_at: k.created_at,
        }
    }
}

impl ApiKey {
    pub fn generate_key() -> String {
        format!("zt_{}", hex::encode(rand::rng().random::<[u8; 32]>()))
    }

    pub fn hash_key(key: &str) -> String {
        hex::encode(Sha256::digest(key.as_bytes()))
    }

    pub fn key_prefix(key: &str) -> String {
        key.chars().take(12).collect::<String>() + "..."
    }

    pub fn reveal(&self) -> Result<String, String> {
        decrypt_key(&self.key_encrypted)
    }

    pub async fn create(
        pool: &MySqlPool,
        org_id: i64,
        user_id: i64,
        name: &str,
        scopes: &str,
    ) -> Result<(ApiKeyCreated, String), sqlx::Error> {
        let full_key = Self::generate_key();
        let key_hash = Self::hash_key(&full_key);
        let key_prefix = Self::key_prefix(&full_key);
        let key_encrypted = encrypt_key(&full_key).unwrap_or_else(|_| "enc_error".into());

        sqlx::query(
            "INSERT INTO api_keys (org_id, user_id, name, key_hash, key_encrypted, key_prefix, scopes)
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(org_id).bind(user_id).bind(name)
         .bind(&key_hash).bind(&key_encrypted).bind(&key_prefix).bind(scopes)
         .execute(pool).await?;

        let row = Self::find_by_hash(pool, &key_hash).await?.unwrap();
        let created = ApiKeyCreated {
            id: row.id,
            name: row.name,
            key: full_key.clone(),
            key_prefix: row.key_prefix,
            scopes: row.scopes,
            created_at: row.created_at,
        };
        Ok((created, full_key))
    }

    pub async fn list_by_org(pool: &MySqlPool, org_id: i64) -> Result<Vec<ApiKey>, sqlx::Error> {
        sqlx::query_as::<_, ApiKey>("SELECT * FROM api_keys WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC")
            .bind(org_id).fetch_all(pool).await
    }

    pub async fn find_by_id(
        pool: &MySqlPool,
        id: i64,
        org_id: i64,
    ) -> Result<Option<ApiKey>, sqlx::Error> {
        sqlx::query_as::<_, ApiKey>(
            "SELECT * FROM api_keys WHERE id = ? AND org_id = ? AND revoked_at IS NULL",
        )
        .bind(id)
        .bind(org_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_hash(
        pool: &MySqlPool,
        key_hash: &str,
    ) -> Result<Option<ApiKey>, sqlx::Error> {
        sqlx::query_as::<_, ApiKey>(
            "SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
        )
        .bind(key_hash)
        .fetch_optional(pool)
        .await
    }

    pub async fn revoke(pool: &MySqlPool, id: i64, org_id: i64) -> Result<bool, sqlx::Error> {
        let r = sqlx::query("UPDATE api_keys SET revoked_at = NOW() WHERE id = ? AND org_id = ? AND revoked_at IS NULL")
            .bind(id).bind(org_id).execute(pool).await?;
        Ok(r.rows_affected() > 0)
    }

    pub async fn touch(pool: &MySqlPool, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE api_keys SET last_used_at = NOW() WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
