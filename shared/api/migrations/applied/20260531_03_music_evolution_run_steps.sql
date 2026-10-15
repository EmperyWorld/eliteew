-- Music Evolution: per-step timeline for animated frontend progress.
BEGIN;

CREATE TABLE IF NOT EXISTS music_evolution_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES music_evolution_runs(id) ON DELETE CASCADE,
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
    CONSTRAINT uq_music_evolution_run_steps_run_index UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_music_evolution_run_steps_run_index
    ON music_evolution_run_steps (run_id, step_index);

CREATE INDEX IF NOT EXISTS idx_music_evolution_run_steps_status
    ON music_evolution_run_steps (status);

CREATE INDEX IF NOT EXISTS idx_music_evolution_run_steps_kind
    ON music_evolution_run_steps (step_kind);

COMMENT ON TABLE music_evolution_run_steps IS
    'Visible backend pipeline steps for the Music Evolution desktop app.';

COMMIT;
