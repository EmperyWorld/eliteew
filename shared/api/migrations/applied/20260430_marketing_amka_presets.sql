-- Именованные пресеты AMKA «АМКА-{имя}» на проект: дополнительные шаги плана (фаза A — те же execution_mode, что у базового плана).

CREATE TABLE IF NOT EXISTS marketing_amka_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    slug VARCHAR(128) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_marketing_amka_presets_project_slug UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_marketing_amka_presets_project_alive
    ON marketing_amka_presets (project_id, updated_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE marketing_amka_runs
    ADD COLUMN IF NOT EXISTS preset_id UUID NULL REFERENCES marketing_amka_presets(id) ON DELETE SET NULL;
