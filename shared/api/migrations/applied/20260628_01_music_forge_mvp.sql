-- MusicForge MVP: separate backend-first song generation contour.
BEGIN;

CREATE TABLE IF NOT EXISTS music_forge_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    idea TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'en')),
    style_hint TEXT,
    constraints TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 150 CHECK (duration_seconds BETWEEN 60 AND 220),
    normalized_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    song_blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
    lyrics_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    style_capsule JSONB NOT NULL DEFAULT '{}'::jsonb,
    render_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_id UUID REFERENCES unified_content(id) ON DELETE SET NULL,
    ugs_request_id UUID REFERENCES generation_requests(id) ON DELETE SET NULL,
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 8,
    idempotency_key TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_forge_runs_user_created
    ON music_forge_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_music_forge_runs_status
    ON music_forge_runs (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_music_forge_runs_user_idempotency
    ON music_forge_runs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> '';

CREATE TABLE IF NOT EXISTS music_forge_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES music_forge_runs(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL CHECK (step_index >= 1),
    step_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'skipped')),
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_music_forge_run_steps_run_index UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_music_forge_run_steps_run_index
    ON music_forge_run_steps (run_id, step_index);

CREATE TABLE IF NOT EXISTS music_forge_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_id UUID REFERENCES music_forge_runs(id) ON DELETE SET NULL,
    content_id UUID NOT NULL,
    rating TEXT NOT NULL CHECK (rating IN ('like', 'dislike')),
    reason_code TEXT,
    reason_custom TEXT,
    recipe_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT music_forge_dislike_reason_required CHECK (
        rating <> 'dislike'
        OR reason_code IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_music_forge_feedback_user_content
    ON music_forge_feedback (user_id, content_id);

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_forge_blueprint',
    'text',
    'MusicForge — song blueprint',
    'Structured song blueprint for the separate backend-first MusicForge app.',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'low',
    60,
    3,
    5,
    5.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'music_forge')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_forge_blueprint');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_forge_lyrics',
    'text',
    'MusicForge — lyrics',
    'Sung lyrics from the structured MusicForge blueprint.',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'medium',
    90,
    3,
    5,
    10.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'music_forge')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_forge_lyrics');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_forge_style',
    'text',
    'MusicForge — ACE style capsule',
    'ACE Step style caption derived from MusicForge lyrics and blueprint.',
    'ollama',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'ollama' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'medium',
    90,
    3,
    5,
    10.0,
    TRUE,
    jsonb_build_object('skip_queue', true, 'product_area', 'music_forge')
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_forge_style');

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'music_generator_forge_ace15_mvp',
    'audio',
    'MusicForge — ACE 1.5 MVP lane',
    'Dedicated MusicForge ACE Step 1.5 SFT single-lane audio render.',
    'comfyui',
    COALESCE((SELECT model_name FROM generation_types WHERE provider = 'comfyui' LIMIT 1), 'comfyui'),
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    COALESCE(
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_generate_ace_v4' LIMIT 1),
        (SELECT cost_credits FROM generation_types WHERE type_key = 'music_generator_generate_ace_v2_base_companion' LIMIT 1),
        250.0
    ),
    TRUE,
    jsonb_build_object(
        'skip_queue', true,
        'product_area', 'music_forge',
        'billing_mode', 'music_forge_mvp',
        'workflow_file', 'music_forge_ace15_mvp.json',
        'source', 'music_forge_app'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'music_generator_forge_ace15_mvp');

INSERT INTO desktop_app_catalog (
    app_id,
    name,
    description,
    app_component,
    category,
    gradient,
    color,
    sort_order,
    is_system
) VALUES (
    'app-music-forge',
    'MusicForge',
    'Новая backend-first студия песен: один качественный ACE lane, пошаговый прогресс и оценка результата.',
    'MusicForgeApp',
    'home',
    'from-slate-950 via-fuchsia-700 to-amber-400',
    'text-amber-200',
    131,
    false
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

COMMENT ON TABLE music_forge_runs IS
    'Separate backend-first MusicForge song generation runs.';
COMMENT ON TABLE music_forge_run_steps IS
    'Visible backend pipeline steps for MusicForge thin frontend progress.';
COMMENT ON TABLE music_forge_feedback IS
    'MusicForge result like/dislike feedback with recipe snapshots.';

COMMIT;
