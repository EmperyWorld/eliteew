-- MusicForge Pipeline Architect Wave A: Modes + ordered pipeline stages per mode.
-- Stage *types* stay in code; stage *instances* are DB-owned (Admin-composable later).
BEGIN;

CREATE TABLE IF NOT EXISTS music_forge_modes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL REFERENCES music_forge_config_revisions(id) ON DELETE CASCADE,
    mode_key TEXT NOT NULL,
    label_ru TEXT NOT NULL,
    label_en TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    style_hint_default TEXT,
    lane_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_forge_modes_revision_mode UNIQUE (revision_id, mode_key)
);

CREATE INDEX IF NOT EXISTS idx_music_forge_modes_revision
    ON music_forge_modes (revision_id, sort_order);

CREATE TABLE IF NOT EXISTS music_forge_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL REFERENCES music_forge_config_revisions(id) ON DELETE CASCADE,
    mode_key TEXT NOT NULL,
    stage_key TEXT NOT NULL,
    stage_type TEXT NOT NULL,
    title_ru TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_forge_pipeline_stages_rev_mode_stage
        UNIQUE (revision_id, mode_key, stage_key),
    CONSTRAINT fk_music_forge_pipeline_stages_mode
        FOREIGN KEY (revision_id, mode_key)
        REFERENCES music_forge_modes (revision_id, mode_key)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_music_forge_pipeline_stages_mode
    ON music_forge_pipeline_stages (revision_id, mode_key, sort_order);

-- Backfill Modes from existing lanes (one Mode per lane; slug mode_key).
INSERT INTO music_forge_modes (
    revision_id, mode_key, label_ru, label_en, description,
    enabled, is_default, sort_order, lane_key
)
SELECT
    l.revision_id,
    lower(replace(replace(l.lane_key, ' ', '_'), '-', '_')),
    l.lane_key,
    l.lane_key,
    NULL,
    TRUE,
    l.is_default,
    l.sort_order,
    l.lane_key
FROM music_forge_lanes l
WHERE NOT EXISTS (
    SELECT 1
    FROM music_forge_modes m
    WHERE m.revision_id = l.revision_id
      AND m.mode_key = lower(replace(replace(l.lane_key, ' ', '_'), '-', '_'))
)
ON CONFLICT (revision_id, mode_key) DO NOTHING;

-- Seed canonical pipeline (matches today's hardcoded execute_run sequence) for modes without stages.
WITH stage_defs AS (
    SELECT *
    FROM (
        VALUES
            (
                10,
                'intent_normalize',
                'intent_normalize',
                'Нормализация идеи',
                '{"corpus": true}'::jsonb
            ),
            (
                20,
                'song_blueprint',
                'llm_generate',
                'Blueprint песни',
                '{
                    "prompt_kind": "blueprint",
                    "ugs_type_key": "music_generator_forge_blueprint",
                    "persist_field": "song_blueprint",
                    "json_format": true,
                    "temperature": 0.45
                }'::jsonb
            ),
            (
                30,
                'lyrics_draft',
                'llm_generate',
                'Черновик текста',
                '{
                    "prompt_kind": "lyrics",
                    "ugs_type_key": "music_generator_forge_lyrics",
                    "persist_field": "lyrics_raw",
                    "json_format": false,
                    "temperature": 0.82
                }'::jsonb
            ),
            (
                40,
                'lyrics_gate',
                'lyrics_gate',
                'Проверка текста',
                '{"fail_on": ["empty_lyrics", "json_leak"]}'::jsonb
            ),
            (
                50,
                'style_capsule',
                'style_build',
                'Style capsule',
                '{
                    "prompt_kind": "style",
                    "ugs_type_key": "music_generator_forge_style",
                    "temperature": 0.58
                }'::jsonb
            ),
            (
                60,
                'lyrics_enrich',
                'lyrics_enrich',
                'ACE enrich',
                '{"structure_prepare": true}'::jsonb
            ),
            (
                70,
                'audio_render',
                'audio_comfy',
                'Рендер аудио',
                '{}'::jsonb
            ),
            (
                80,
                'content_persist',
                'content_persist',
                'Сохранение в библиотеку',
                '{}'::jsonb
            )
    ) AS t(sort_order, stage_key, stage_type, title_ru, settings)
)
INSERT INTO music_forge_pipeline_stages (
    revision_id, mode_key, stage_key, stage_type, title_ru, sort_order, enabled, settings
)
SELECT
    m.revision_id,
    m.mode_key,
    d.stage_key,
    d.stage_type,
    d.title_ru,
    d.sort_order,
    TRUE,
    CASE
        WHEN d.stage_type = 'audio_comfy' THEN jsonb_build_object('lane_key', m.lane_key)
        ELSE d.settings
    END
FROM music_forge_modes m
CROSS JOIN stage_defs d
WHERE NOT EXISTS (
    SELECT 1
    FROM music_forge_pipeline_stages s
    WHERE s.revision_id = m.revision_id
      AND s.mode_key = m.mode_key
)
ON CONFLICT (revision_id, mode_key, stage_key) DO NOTHING;

COMMIT;
