BEGIN;

CREATE TABLE IF NOT EXISTS marketing_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    segment_type TEXT NOT NULL DEFAULT 'icp',
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'medium',
    estimated_reach INTEGER NOT NULL DEFAULT 0,
    fit_score NUMERIC(5,2) NULL,
    linked_job_story_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    linked_content_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    linked_competitor_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    pain_points TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    gains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_segments_project_id ON marketing_segments (project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_company_id ON marketing_segments (company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_segments_status ON marketing_segments (status);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    name TEXT NOT NULL,
    objective TEXT NULL,
    channel TEXT NOT NULL DEFAULT 'organic',
    status TEXT NOT NULL DEFAULT 'draft',
    priority TEXT NOT NULL DEFAULT 'medium',
    owner_name TEXT NULL,
    hypothesis TEXT NULL,
    budget NUMERIC(14,2) NULL,
    target_metric_name TEXT NULL,
    target_metric NUMERIC(14,4) NULL,
    actual_metric NUMERIC(14,4) NULL,
    linked_segment_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    linked_value_prop_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_project_id ON marketing_campaigns (project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_company_id ON marketing_campaigns (company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns (status);

CREATE TABLE IF NOT EXISTS marketing_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    primary_goal TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_funnels_project_id ON marketing_funnels (project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_funnels_company_id ON marketing_funnels (company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_funnels_status ON marketing_funnels (status);

CREATE TABLE IF NOT EXISTS marketing_funnel_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES marketing_funnels (id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    stage_order INTEGER NOT NULL DEFAULT 0,
    visitors BIGINT NOT NULL DEFAULT 0,
    conversions BIGINT NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(8,4) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_funnel_stages_funnel_id ON marketing_funnel_stages (funnel_id);
CREATE INDEX IF NOT EXISTS idx_marketing_funnel_stages_stage_order ON marketing_funnel_stages (funnel_id, stage_order);

CREATE TABLE IF NOT EXISTS marketing_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    owner_name TEXT NULL,
    due_at TIMESTAMP NULL,
    source_type TEXT NULL,
    source_id UUID NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_tasks_project_id ON marketing_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_company_id ON marketing_tasks (company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status ON marketing_tasks (status);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_due_at ON marketing_tasks (due_at);

CREATE TABLE IF NOT EXISTS marketing_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    owner_name TEXT NULL,
    source_type TEXT NULL,
    source_id UUID NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_alerts_project_id ON marketing_alerts (project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_company_id ON marketing_alerts (company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_status ON marketing_alerts (status);
CREATE INDEX IF NOT EXISTS idx_marketing_alerts_severity ON marketing_alerts (severity);

CREATE TABLE IF NOT EXISTS marketing_ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    request_id UUID NULL,
    tool_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    prompt_excerpt TEXT NULL,
    result_excerpt TEXT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_marketing_ai_runs_project_id ON marketing_ai_runs (project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_runs_company_id ON marketing_ai_runs (company_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_runs_status ON marketing_ai_runs (status);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_runs_tool_key ON marketing_ai_runs (tool_key);

CREATE TABLE IF NOT EXISTS marketing_overview_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by UUID NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_overview_snapshots_project_id ON marketing_overview_snapshots (project_id, computed_at DESC);

UPDATE projects
SET enabled_modules = ARRAY(
    SELECT DISTINCT module_name
    FROM unnest(
        COALESCE(enabled_modules, ARRAY[]::VARCHAR[])
        || ARRAY[
            'jtbd',
            'value_proposition',
            'swot',
            'competitors',
            'researches',
            'content_ai',
            'context_chat',
            'segments',
            'campaigns',
            'funnel',
            'tasks',
            'alerts',
            'ai_studio'
        ]::VARCHAR[]
    ) AS module_name
)
WHERE deleted_at IS NULL;

COMMIT;
