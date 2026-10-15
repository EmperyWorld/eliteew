-- Взаимодействие руководителя проекта с представителем заказчика:
-- согласование документов, запросы на удаление, шаринг EWRP-презентаций.

CREATE TABLE IF NOT EXISTS marketing_client_doc_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES unified_content(id) ON DELETE CASCADE,
    sent_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mcda_project_content UNIQUE (project_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_mcda_project ON marketing_client_doc_approvals (project_id);
CREATE INDEX IF NOT EXISTS idx_mcda_company ON marketing_client_doc_approvals (company_id);

CREATE TABLE IF NOT EXISTS marketing_client_doc_removal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID NOT NULL REFERENCES marketing_client_doc_approvals(id) ON DELETE CASCADE,
    initiated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcdrr_approval_pending
    ON marketing_client_doc_removal_requests (approval_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_mcdrr_approval ON marketing_client_doc_removal_requests (approval_id);

CREATE TABLE IF NOT EXISTS marketing_client_pres_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ewrp_job_id UUID NOT NULL REFERENCES ewrp_jobs(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mcps_project_job UNIQUE (project_id, ewrp_job_id)
);

CREATE INDEX IF NOT EXISTS idx_mcps_project ON marketing_client_pres_shares (project_id);
