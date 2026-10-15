-- KBSEW durable ingestion worker fields
-- Version: 20260706_01

CREATE SCHEMA IF NOT EXISTS kbsew;

ALTER TABLE kbsew.assets
    ADD COLUMN IF NOT EXISTS content_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kbsew_assets_barrel_idempotency
    ON kbsew.assets (barrel_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kbsew_assets_content_sha256
    ON kbsew.assets (content_sha256)
    WHERE content_sha256 IS NOT NULL;

ALTER TABLE kbsew.ingestion_jobs
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by TEXT,
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS trace_id TEXT,
    ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'url',
    ADD COLUMN IF NOT EXISTS driver_type TEXT,
    ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_kbsew_jobs_claim
    ON kbsew.ingestion_jobs (status, scheduled_at, created_at)
    WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_kbsew_jobs_locked
    ON kbsew.ingestion_jobs (status, locked_at)
    WHERE status = 'running';
