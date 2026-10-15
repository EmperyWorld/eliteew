BEGIN;

ALTER TABLE marketing_ai_runs
    DROP CONSTRAINT IF EXISTS chk_marketing_ai_runs_scope;

ALTER TABLE marketing_ai_runs
    ADD CONSTRAINT chk_marketing_ai_runs_scope
    CHECK (project_id IS NOT NULL OR company_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_funnel_stages_funnel_stage_order_live
    ON marketing_funnel_stages (funnel_id, stage_order)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_segments_project_live
    ON marketing_segments (project_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_project_live
    ON marketing_campaigns (project_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_funnels_project_live
    ON marketing_funnels (project_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_tasks_project_live
    ON marketing_tasks (project_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_alerts_project_live
    ON marketing_alerts (project_id, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_ai_runs_project_live
    ON marketing_ai_runs (project_id, started_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_ai_runs_company_live
    ON marketing_ai_runs (company_id, started_at DESC)
    WHERE deleted_at IS NULL;

COMMIT;
