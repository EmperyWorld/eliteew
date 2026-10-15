BEGIN;

CREATE TABLE IF NOT EXISTS music_batch_approaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('draft', 'queued', 'running', 'completed', 'partial_failed', 'failed', 'cancelled')),
    workflow_key TEXT NOT NULL CHECK (workflow_key IN ('v2', 'v2_base', 'v2_sft', 'v3')),
    style TEXT NOT NULL DEFAULT 'pop',
    genre_label TEXT,
    demo_block_type TEXT NOT NULL DEFAULT 'verse_chorus'
        CHECK (demo_block_type IN ('verse_chorus', 'drop', 'hook', 'instrumental_motif', 'custom_short_block')),
    requested_count INTEGER NOT NULL CHECK (requested_count BETWEEN 1 AND 50),
    duration_seconds INTEGER NOT NULL DEFAULT 30 CHECK (duration_seconds BETWEEN 1 AND 30),
    fixed_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    random_params_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
    base_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
    limits_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    progress_total INTEGER NOT NULL DEFAULT 0,
    progress_done INTEGER NOT NULL DEFAULT 0,
    progress_failed INTEGER NOT NULL DEFAULT 0,
    progress_cancelled INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS music_batch_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approach_id UUID NOT NULL REFERENCES music_batch_approaches(id) ON DELETE CASCADE,
    row_index INTEGER NOT NULL CHECK (row_index >= 1),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'retrying')),
    content_id UUID REFERENCES unified_content(id) ON DELETE SET NULL,
    ugs_request_id UUID REFERENCES generation_requests(id) ON DELETE SET NULL,
    seed_used BIGINT,
    effective_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ugs_input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    cost_credits NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT music_batch_generations_approach_row_unique UNIQUE (approach_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_music_batch_approaches_user_created
    ON music_batch_approaches(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_music_batch_approaches_status
    ON music_batch_approaches(status);

CREATE INDEX IF NOT EXISTS idx_music_batch_generations_approach_row
    ON music_batch_generations(approach_id, row_index);

CREATE INDEX IF NOT EXISTS idx_music_batch_generations_status
    ON music_batch_generations(status);

CREATE INDEX IF NOT EXISTS idx_music_batch_generations_content
    ON music_batch_generations(content_id)
    WHERE content_id IS NOT NULL;

COMMIT;
