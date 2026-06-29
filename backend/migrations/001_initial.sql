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

-- api_keys: ensure web columns exist on top of DeepFlow's table
ALTER TABLE api_keys ADD COLUMN org_id INT NOT NULL DEFAULT 1;
ALTER TABLE api_keys ADD COLUMN name VARCHAR(256) NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN key_encrypted TEXT NOT NULL;
ALTER TABLE api_keys ADD COLUMN key_prefix VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL;
ALTER TABLE api_keys ADD COLUMN last_used_at TIMESTAMP NULL;
ALTER TABLE api_keys ADD COLUMN team_id INT NULL;

CREATE TABLE IF NOT EXISTS sessions (
    id              VARCHAR(256) PRIMARY KEY,
    user_id         INT NOT NULL,
    org_id          INT NOT NULL,
    data            TEXT NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO organizations (id, name, slug) VALUES (1, 'Default', 'default'), (2, 'ZeroTrace', 'zerotrace');

-- Seed super_admin user: test@zerotrace.com / netsys206 (platform-wide admin)
INSERT IGNORE INTO web_users (id, org_id, email, password_hash, name, role, status) VALUES (1, 2, 'test@zerotrace.com', '$argon2id$v=19$m=19456,t=2,p=1$Z2iDPtbe36+o7aTW0NHo7w$u+eHra+Drtd/M0VidDx3PbcLX+JGhur+0+wvpOaFns0', 'Super Admin', 'super_admin', 'active');
