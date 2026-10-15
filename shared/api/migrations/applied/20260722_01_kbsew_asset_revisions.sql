-- KBSEW asset revision lineage (indexed content snapshots)
-- Version: 20260722_01

CREATE SCHEMA IF NOT EXISTS kbsew;

CREATE TABLE IF NOT EXISTS kbsew.asset_revisions (
    id UUID PRIMARY KEY,
    asset_id UUID NOT NULL REFERENCES kbsew.assets (id) ON DELETE CASCADE,
    content_sha256 TEXT NOT NULL,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    chunk_count INT NOT NULL DEFAULT 0,
    embed_model TEXT,
    pipeline_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kbsew_asset_revisions_asset_indexed
    ON kbsew.asset_revisions (asset_id, indexed_at DESC);

CREATE INDEX IF NOT EXISTS idx_kbsew_asset_revisions_content_sha256
    ON kbsew.asset_revisions (content_sha256)
    WHERE content_sha256 IS NOT NULL;

ALTER TABLE kbsew.assets
    ADD COLUMN IF NOT EXISTS active_revision_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_kbsew_assets_active_revision'
    ) THEN
        ALTER TABLE kbsew.assets
            ADD CONSTRAINT fk_kbsew_assets_active_revision
            FOREIGN KEY (active_revision_id)
            REFERENCES kbsew.asset_revisions (id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kbsew_assets_active_revision
    ON kbsew.assets (active_revision_id)
    WHERE active_revision_id IS NOT NULL;
