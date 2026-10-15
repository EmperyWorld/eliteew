-- EWA companion durable task orchestration + per-user quick action presets.
-- Mirrors schema init in persistence_pg/companion_asyncpg._COMPANION_SCHEMA_STATEMENTS.

CREATE TABLE IF NOT EXISTS ewa_companion_task_runs (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    intent_kind text NOT NULL DEFAULT 'unknown',
    user_message text NOT NULL DEFAULT '',
    plan_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    confirmation_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    result_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS ewa_companion_task_steps (
    id text PRIMARY KEY,
    run_id text NOT NULL REFERENCES ewa_companion_task_runs (id) ON DELETE CASCADE,
    step_index integer NOT NULL DEFAULT 0,
    step_kind text NOT NULL DEFAULT 'tool',
    status text NOT NULL DEFAULT 'pending',
    title text NOT NULL DEFAULT '',
    input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    error_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ewa_companion_task_runs_principal_status_created_idx
    ON ewa_companion_task_runs (principal_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ewa_companion_task_steps_run_index_idx
    ON ewa_companion_task_steps (run_id, step_index);

CREATE TABLE IF NOT EXISTS ewa_companion_quick_action_presets (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    label text NOT NULL,
    prompt_text text NOT NULL,
    sort_order integer NOT NULL DEFAULT 100,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_quick_presets_principal_order_idx
    ON ewa_companion_quick_action_presets (principal_id, sort_order, updated_at DESC);
