BEGIN;

CREATE TABLE IF NOT EXISTS imc_research_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
    type_key VARCHAR(100) NOT NULL,
    workflow_key VARCHAR(100),
    ugs_request_id UUID REFERENCES generation_requests (id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    idempotency_key VARCHAR(120),
    input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_text TEXT,
    parsed_data JSONB,
    steps JSONB,
    errors JSONB,
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT chk_imc_research_runs_status CHECK (
        status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'partial')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_imc_research_runs_user_idempotency
    ON imc_research_runs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imc_research_runs_company_created
    ON imc_research_runs (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imc_research_runs_project_created
    ON imc_research_runs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imc_research_runs_user_created
    ON imc_research_runs (user_id, created_at DESC);

COMMIT;
