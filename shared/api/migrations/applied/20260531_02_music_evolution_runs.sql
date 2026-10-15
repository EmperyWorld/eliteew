-- Music Evolution: durable backend-first run state in the main API database.
BEGIN;

CREATE TABLE IF NOT EXISTS music_evolution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    theme TEXT NOT NULL,
    vocal TEXT NOT NULL DEFAULT 'auto',
    genre TEXT NOT NULL DEFAULT 'pop',
    language TEXT NOT NULL DEFAULT 'ru',
    mood TEXT NOT NULL DEFAULT 'warm',
    meaning_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    extra_context TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 90 CHECK (duration_seconds BETWEEN 30 AND 240),
    normalized_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    corpus_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    creative_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
    final_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_id UUID REFERENCES unified_content(id) ON DELETE SET NULL,
    ugs_request_id UUID REFERENCES generation_requests(id) ON DELETE SET NULL,
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 11,
    idempotency_key TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_music_evolution_runs_user_created
    ON music_evolution_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_music_evolution_runs_status
    ON music_evolution_runs (status);

CREATE INDEX IF NOT EXISTS idx_music_evolution_runs_content
    ON music_evolution_runs (content_id)
    WHERE content_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_music_evolution_runs_user_idempotency
    ON music_evolution_runs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND btrim(idempotency_key) <> '';

COMMENT ON TABLE music_evolution_runs IS
    'Backend-first XL Base song generation runs for the Music Evolution desktop app.';

COMMIT;
