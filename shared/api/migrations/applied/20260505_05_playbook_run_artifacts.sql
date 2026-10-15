-- Links playbook run steps to persisted professional artifacts.

CREATE TABLE IF NOT EXISTS professional_ai_playbook_run_artifacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES professional_ai_playbook_runs(id) ON DELETE CASCADE,
    step_order integer NOT NULL,
    artifact_id uuid REFERENCES professional_artifacts(id) ON DELETE SET NULL,
    artifact_kind varchar(120),
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_playbook_run_step UNIQUE (run_id, step_order)
);

CREATE INDEX IF NOT EXISTS ix_prof_playbook_run_artifacts_run
    ON professional_ai_playbook_run_artifacts (run_id);
