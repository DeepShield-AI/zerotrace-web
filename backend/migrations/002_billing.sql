-- Zerotrace Billing — MySQL
-- Plans (product & pricing catalog)
CREATE TABLE IF NOT EXISTS plans (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    product_key         VARCHAR(64) NOT NULL UNIQUE,
    name                VARCHAR(256) NOT NULL,
    description         VARCHAR(1024) NOT NULL DEFAULT '',
    billing_dimension   VARCHAR(64) NOT NULL,
    aggregation_method  VARCHAR(32) NOT NULL,
    unit_price_monthly  DECIMAL(10,4) NOT NULL,
    unit_price_annual   DECIMAL(10,4) NOT NULL,
    currency            VARCHAR(8) NOT NULL DEFAULT 'USD',
    is_addon            TINYINT(1) NOT NULL DEFAULT 0,
    parent_product_key  VARCHAR(64) NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Plan allotments (bundled free usage when buying a plan)
CREATE TABLE IF NOT EXISTS plan_allotments (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    plan_id                 INT NOT NULL,
    allotted_product_key    VARCHAR(64) NOT NULL,
    allotted_quantity       DECIMAL(12,2) NOT NULL,
    per_unit                VARCHAR(64) NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Subscriptions (what each org has purchased)
CREATE TABLE IF NOT EXISTS subscriptions (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    org_id                  INT NOT NULL,
    plan_id                 INT NOT NULL,
    commitment_type         VARCHAR(32) NOT NULL,
    committed_quantity      DECIMAL(12,2) NOT NULL,
    unit_price              DECIMAL(10,4) NOT NULL,
    status                  VARCHAR(32) NOT NULL DEFAULT 'active',
    current_period_start    TIMESTAMP NOT NULL,
    current_period_end      TIMESTAMP NOT NULL,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
);

-- Usage records (hourly usage snapshots collected from zerotrace-server)
CREATE TABLE IF NOT EXISTS usage_records (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    org_id          INT NOT NULL,
    product_key     VARCHAR(64) NOT NULL,
    hour            TIMESTAMP NOT NULL,
    quantity        DECIMAL(12,2) NOT NULL,
    raw_values      JSON NULL,
    collected_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usage_org_period (org_id, hour),
    INDEX idx_usage_product_hour (product_key, hour)
);

-- Invoices (monthly billing)
CREATE TABLE IF NOT EXISTS invoices (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    org_id          INT NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    currency        VARCHAR(8) NOT NULL DEFAULT 'USD',
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    issued_at       TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    INDEX idx_invoices_org (org_id, period_start)
);

-- Invoice line items (per-product charges)
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id                      INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id              INT NOT NULL,
    product_key             VARCHAR(64) NOT NULL,
    description             VARCHAR(256) NOT NULL DEFAULT '',
    commitment_quantity     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    commitment_unit_price   DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    commitment_total        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    overage_quantity        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    overage_unit_price      DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
    overage_total           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- ============================================================
-- Seed data: default plans (Datadog-comparable pricing)
-- ============================================================

-- Infrastructure Monitoring
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('infra_pro', 'Infrastructure Pro', 'Core infrastructure monitoring — metrics, dashboards, alerts', 'per_host', 'hwmp_99p', 18.0000, 15.0000, 0, NULL),
('infra_enterprise', 'Infrastructure Enterprise', 'Enterprise infrastructure with advanced RBAC, SSO, audit trail', 'per_host', 'hwmp_99p', 27.0000, 23.0000, 0, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- APM (requires Infrastructure)
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('apm_standard', 'APM Standard', 'Distributed tracing, service maps, code-level visibility', 'per_host', 'hwmp_99p', 48.0000, 31.0000, 1, 'infra_pro'),
('apm_enterprise', 'APM Enterprise', 'APM with continuous profiler, data streams monitoring', 'per_host', 'hwmp_99p', 60.0000, 40.0000, 1, 'infra_enterprise')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- APM Span Overage
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('apm_ingested_spans', 'APM Ingested Spans (overage)', 'Ingested spans beyond included 150 GB/host/mo', 'per_gb', 'sum', 0.1500, 0.1000, 0, NULL),
('apm_indexed_spans', 'APM Indexed Spans (overage)', 'Indexed spans beyond included 1M/host/mo', 'per_million_events', 'sum', 2.5500, 1.7000, 0, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Log Management
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('log_ingestion', 'Log Ingestion', 'Log data ingested into the platform', 'per_gb', 'sum', 0.1200, 0.1000, 0, NULL),
('log_indexing_15d', 'Log Indexing (15-day retention)', 'Indexed log events, 15-day retention', 'per_million_events', 'sum', 2.5500, 1.7000, 0, NULL),
('log_indexing_30d', 'Log Indexing (30-day retention)', 'Indexed log events, 30-day retention', 'per_million_events', 'sum', 3.7500, 2.5000, 0, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Custom Metrics
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('custom_metrics', 'Custom Metrics', 'Custom metric timeseries beyond included allotment', 'per_metric', 'average', 0.0750, 0.0500, 0, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Container Monitoring
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('containers', 'Container Monitoring', 'Per-container monitoring beyond included allotment', 'per_container', 'average', 1.5000, 1.0000, 0, NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Database Monitoring
INSERT INTO plans (product_key, name, description, billing_dimension, aggregation_method, unit_price_monthly, unit_price_annual, is_addon, parent_product_key)
VALUES
('dbm', 'Database Monitoring', 'Query analytics, performance monitoring, alerting', 'per_host', 'hwmp_99p', 84.0000, 70.0000, 1, 'infra_pro')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ============================================================
-- Seed data: product allotments
-- ============================================================
INSERT INTO plan_allotments (plan_id, allotted_product_key, allotted_quantity, per_unit)
SELECT p.id, 'containers', 5, 'per_host' FROM plans p WHERE p.product_key = 'infra_pro'
UNION ALL
SELECT p.id, 'custom_metrics', 100, 'per_host' FROM plans p WHERE p.product_key = 'infra_pro'
UNION ALL
SELECT p.id, 'containers', 10, 'per_host' FROM plans p WHERE p.product_key = 'infra_enterprise'
UNION ALL
SELECT p.id, 'custom_metrics', 200, 'per_host' FROM plans p WHERE p.product_key = 'infra_enterprise'
UNION ALL
SELECT p.id, 'apm_ingested_spans', 150, 'per_host' FROM plans p WHERE p.product_key = 'apm_standard'
UNION ALL
SELECT p.id, 'apm_indexed_spans', 1, 'per_host' FROM plans p WHERE p.product_key = 'apm_standard'
UNION ALL
SELECT p.id, 'apm_ingested_spans', 150, 'per_host' FROM plans p WHERE p.product_key = 'apm_enterprise'
UNION ALL
SELECT p.id, 'apm_indexed_spans', 1, 'per_host' FROM plans p WHERE p.product_key = 'apm_enterprise';
-- tier_level column added (already present in DB)
