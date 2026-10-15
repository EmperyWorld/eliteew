-- MusicForge Phase 1: config generation stamp + run revision provenance.
BEGIN;

CREATE TABLE IF NOT EXISTS music_forge_config_meta (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    generation BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO music_forge_config_meta (id, generation)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE music_forge_runs
    ADD COLUMN IF NOT EXISTS config_revision_id UUID
        REFERENCES music_forge_config_revisions(id) ON DELETE SET NULL;

ALTER TABLE music_forge_runs
    ADD COLUMN IF NOT EXISTS config_version TEXT;

ALTER TABLE music_forge_runs
    ADD COLUMN IF NOT EXISTS config_generation BIGINT;

CREATE INDEX IF NOT EXISTS idx_music_forge_runs_config_revision
    ON music_forge_runs (config_revision_id)
    WHERE config_revision_id IS NOT NULL;

COMMIT;
