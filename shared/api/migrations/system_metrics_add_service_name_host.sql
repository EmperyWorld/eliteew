-- Add service_name and host to system_metrics (used by metrics_storage / Prometheus-style ingestion).
-- Run once on the DB that serves the API (e.g. stack1 postgres).
-- Idempotent: safe to run multiple times.

ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS service_name VARCHAR(255) NULL;

ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS host VARCHAR(255) NULL;

ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS value NUMERIC(15, 4) NULL;

ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NULL;

-- Prometheus-style aliases (avoid further UndefinedColumnError from metrics writers)
ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS name VARCHAR(255) NULL;

ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NULL;

ALTER TABLE system_metrics
  ADD COLUMN IF NOT EXISTS tags JSONB NULL;
