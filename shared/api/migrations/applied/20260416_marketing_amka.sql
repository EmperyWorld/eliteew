-- AMKA: staged audit/execution runtime for marketing cabinet
-- Separate persistence from IMC/marketing_ai_runs so the audit can keep section reports,
-- approved master plan, execution steps and final assessment in one run timeline.

CREATE TABLE IF NOT EXISTS marketing_amka_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope_key VARCHAR(64) NOT NULL DEFAULT 'all_visible',
    status VARCHAR(32) NOT NULL DEFAULT 'planning',
    current_stage VARCHAR(64),
    progress INTEGER NOT NULL DEFAULT 0,
    progress_message TEXT,
    master_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    master_plan_summary TEXT,
    final_summary_markdown TEXT,
    final_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics_before JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics_after JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    context_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_marketing_amka_runs_project_created_at
    ON marketing_amka_runs(project_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_amka_runs_status
    ON marketing_amka_runs(status)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS marketing_amka_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES marketing_amka_runs(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    stage_kind VARCHAR(64) NOT NULL,
    section_key VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    plan_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    report_markdown TEXT,
    report_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    applied_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    metrics_before JSONB NOT NULL DEFAULT '{}'::jsonb,
    metrics_after JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_amka_run_steps_run_ordinal
    ON marketing_amka_run_steps(run_id, ordinal);

CREATE INDEX IF NOT EXISTS idx_marketing_amka_run_steps_run_status
    ON marketing_amka_run_steps(run_id, status);

-- Enable the new module for existing non-archived projects so AMKA appears in the cabinet
-- once frontend/backend code is deployed.
UPDATE projects
SET enabled_modules = ARRAY(
    SELECT DISTINCT module_name
    FROM unnest(
        COALESCE(enabled_modules, ARRAY[]::VARCHAR[])
        || ARRAY['amka']::VARCHAR[]
    ) AS module_name
)
WHERE deleted_at IS NULL;
