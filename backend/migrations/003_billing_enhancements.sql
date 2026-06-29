-- Billing enhancements: usage alerts, retention cleanup, subscription audit
-- ============================================================

-- Usage alerts: threshold-based notifications for spend control
CREATE TABLE IF NOT EXISTS usage_alerts (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    org_id          INT NOT NULL,
    product_key     VARCHAR(64) NOT NULL,
    threshold_pct   INT NOT NULL DEFAULT 80,
    threshold_absolute DECIMAL(12,2) NULL,
    channel         VARCHAR(32) NOT NULL DEFAULT 'email',
    last_triggered_at TIMESTAMP NULL,
    is_enabled      TINYINT(1) NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_alerts_org (org_id, is_enabled)
);

-- Subscription audit log (track changes for compliance)
CREATE TABLE IF NOT EXISTS subscription_audit_log (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    subscription_id INT NOT NULL,
    org_id          INT NOT NULL,
    action          VARCHAR(64) NOT NULL,
    old_quantity    DECIMAL(12,2) NULL,
    new_quantity    DECIMAL(12,2) NULL,
    old_price       DECIMAL(10,4) NULL,
    new_price       DECIMAL(10,4) NULL,
    performed_by    INT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_sub (subscription_id),
    INDEX idx_audit_org (org_id, created_at)
);

-- Usage data retention: add index for cleanup
ALTER TABLE usage_records ADD INDEX idx_usage_collected (collected_at);
