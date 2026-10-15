-- KBSEW schema: barrels, assets, ingestion jobs (ai_services)
-- Version: 20260703_01

CREATE SCHEMA IF NOT EXISTS kbsew;

CREATE TABLE IF NOT EXISTS kbsew.barrels (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    driver_type TEXT NOT NULL DEFAULT 'pdf',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    qdrant_collection TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kbsew_barrels_created_at ON kbsew.barrels (created_at DESC);

CREATE TABLE IF NOT EXISTS kbsew.assets (
    id UUID PRIMARY KEY,
    barrel_id UUID NOT NULL REFERENCES kbsew.barrels (id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    object_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    chunk_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kbsew_assets_barrel_id ON kbsew.assets (barrel_id);
CREATE INDEX IF NOT EXISTS idx_kbsew_assets_status ON kbsew.assets (status);

CREATE TABLE IF NOT EXISTS kbsew.ingestion_jobs (
    id UUID PRIMARY KEY,
    barrel_id UUID NOT NULL REFERENCES kbsew.barrels (id) ON DELETE CASCADE,
    asset_id UUID REFERENCES kbsew.assets (id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    progress_pct INT NOT NULL DEFAULT 0,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kbsew_jobs_barrel_status ON kbsew.ingestion_jobs (barrel_id, status);
