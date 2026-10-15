-- История прогонов диагностики заказчика: компания, попытки по модулям, согласования перепрохождения.

CREATE TABLE IF NOT EXISTS marketing_diagnostic_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    representative_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    run_index INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    full_completed_at TIMESTAMPTZ,
    initiated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    aggregate_results JSONB,
    CONSTRAINT uq_mdr_project_rep_run UNIQUE (project_id, representative_user_id, run_index)
);

CREATE INDEX IF NOT EXISTS idx_mdr_company_project ON marketing_diagnostic_run (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_mdr_rep ON marketing_diagnostic_run (representative_user_id);

CREATE TABLE IF NOT EXISTS marketing_diagnostic_module_attempt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES marketing_diagnostic_run(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    attempt_no INT NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::JSONB,
    computed_module JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lead_user_id_snapshot UUID REFERENCES users(id) ON DELETE SET NULL,
    previous_attempt_id UUID REFERENCES marketing_diagnostic_module_attempt(id) ON DELETE SET NULL,
    delta_vs_previous JSONB,
    CONSTRAINT uq_mdma_run_module_attempt UNIQUE (run_id, module_key, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_mdma_run ON marketing_diagnostic_module_attempt (run_id);
CREATE INDEX IF NOT EXISTS idx_mdma_module ON marketing_diagnostic_module_attempt (run_id, module_key);

CREATE TABLE IF NOT EXISTS marketing_diagnostic_retake_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES marketing_diagnostic_run(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'consumed')),
    resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mdrr_one_pending
    ON marketing_diagnostic_retake_request (run_id, module_key)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mdrr_run_status ON marketing_diagnostic_retake_request (run_id, status);

ALTER TABLE marketing_customer_diagnostic_session
    ADD COLUMN IF NOT EXISTS active_run_id UUID REFERENCES marketing_diagnostic_run(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mcds_active_run ON marketing_customer_diagnostic_session (active_run_id);

-- Backfill: один прогон на существующую сессию
INSERT INTO marketing_diagnostic_run (
    project_id,
    company_id,
    representative_user_id,
    run_index,
    full_completed_at,
    aggregate_results,
    initiated_by_user_id
)
SELECT
    s.project_id,
    p.company_id,
    s.user_id,
    1,
    s.completed_at,
    s.computed_results,
    NULL
FROM marketing_customer_diagnostic_session s
INNER JOIN projects p ON p.id = s.project_id AND p.deleted_at IS NULL
WHERE NOT EXISTS (
    SELECT 1 FROM marketing_diagnostic_run r
    WHERE r.project_id = s.project_id
      AND r.representative_user_id = s.user_id
      AND r.run_index = 1
);

UPDATE marketing_customer_diagnostic_session s
SET active_run_id = r.id
FROM marketing_diagnostic_run r
WHERE s.active_run_id IS NULL
  AND r.project_id = s.project_id
  AND r.representative_user_id = s.user_id
  AND r.run_index = 1;
