-- Zerotrace Web Auth — MySQL (production)
CREATE TABLE IF NOT EXISTS organizations (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    name        VARCHAR(256) NOT NULL,
    slug        VARCHAR(256) NOT NULL UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS web_users (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    org_id          INT NOT NULL,
    email           VARCHAR(256) NOT NULL,
    password_hash   VARCHAR(256) NOT NULL,
    name            VARCHAR(256) NOT NULL DEFAULT '',
    role            VARCHAR(64) NOT NULL DEFAULT 'admin',
    status          VARCHAR(64) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_email (org_id, email)
);

-- api_keys already exists in deepflow from server DDL — skip creation
CREATE TABLE IF NOT EXISTS api_keys (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    org_id          INT NOT NULL DEFAULT 1,
    user_id         INT NOT NULL DEFAULT 0,
    name            VARCHAR(256) NOT NULL DEFAULT '',
    key_hash        CHAR(64) NOT NULL,
    key_encrypted   TEXT NOT NULL,
    key_prefix      VARCHAR(32) NOT NULL DEFAULT '',
    scopes          TEXT NOT NULL,
    label           VARCHAR(256) DEFAULT '',
    last_used_at    TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at      TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id              VARCHAR(256) PRIMARY KEY,
    user_id         INT NOT NULL,
    org_id          INT NOT NULL,
    data            TEXT NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO organizations (id, name, slug) VALUES (1, 'Default', 'default'), (2, 'ZeroTrace', 'zerotrace');
