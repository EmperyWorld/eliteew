-- UltimateDocEditor Q2 / Sprint 4
-- Plugin runtime compatibility and capability gates

ALTER TABLE IF EXISTS doc_editor_plugins
    ADD COLUMN IF NOT EXISTS min_editor_version VARCHAR(32) NOT NULL DEFAULT '0.0.0',
    ADD COLUMN IF NOT EXISTS max_editor_version VARCHAR(32) NULL,
    ADD COLUMN IF NOT EXISTS required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb;
