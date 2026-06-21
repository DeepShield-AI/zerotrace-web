-- Zerotrace Web Auth — MySQL (same database as zerotrace-server: deepflow)

CREATE TABLE IF NOT EXISTS organizations (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS web_users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    org_id          BIGINT NOT NULL,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    role            VARCHAR(50) NOT NULL DEFAULT 'admin',
    status          VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_org_email (org_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Extend DeepFlow's api_keys table with web UI columns.
-- DeepFlow reads: id, user_id, key_hash, label, created_at, revoked_at
ALTER TABLE api_keys ADD COLUMN org_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE api_keys ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN key_encrypted TEXT NOT NULL;
ALTER TABLE api_keys ADD COLUMN key_prefix VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL;
ALTER TABLE api_keys ADD COLUMN last_used_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS sessions (
    id              VARCHAR(36) PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    org_id          BIGINT NOT NULL,
    data            TEXT NOT NULL,
    expires_at      DATETIME NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
