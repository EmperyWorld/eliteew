-- Marketing Cabinet performance fact tables: spend, leads/conversions, revenue.
-- These tables feed /api/v1/marketing-cabinet/projects/:id/performance-dashboard.

CREATE TABLE IF NOT EXISTS marketing_performance_spend_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    campaign_id UUID NULL REFERENCES marketing_campaigns (id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    geo TEXT NOT NULL DEFAULT 'unknown',
    fact_date DATE NOT NULL,
    amount NUMERIC(16, 2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    CONSTRAINT marketing_performance_spend_amount_nonnegative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_marketing_perf_spend_project_date
    ON marketing_performance_spend_facts (project_id, fact_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_spend_campaign_date
    ON marketing_performance_spend_facts (campaign_id, fact_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_spend_source_geo
    ON marketing_performance_spend_facts (project_id, source, geo, fact_date)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS marketing_performance_lead_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    campaign_id UUID NULL REFERENCES marketing_campaigns (id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    geo TEXT NOT NULL DEFAULT 'unknown',
    cohort_date DATE NOT NULL,
    event_date DATE NOT NULL,
    leads_count BIGINT NOT NULL DEFAULT 0,
    qualified_leads_count BIGINT NOT NULL DEFAULT 0,
    conversions_count BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    CONSTRAINT marketing_performance_leads_nonnegative CHECK (
        leads_count >= 0
        AND qualified_leads_count >= 0
        AND conversions_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_marketing_perf_leads_project_event
    ON marketing_performance_lead_facts (project_id, event_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_leads_campaign_event
    ON marketing_performance_lead_facts (campaign_id, event_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_leads_cohort
    ON marketing_performance_lead_facts (project_id, cohort_date, event_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_leads_source_geo
    ON marketing_performance_lead_facts (project_id, source, geo, event_date)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS marketing_performance_revenue_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    campaign_id UUID NULL REFERENCES marketing_campaigns (id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'unknown',
    geo TEXT NOT NULL DEFAULT 'unknown',
    cohort_date DATE NOT NULL,
    event_date DATE NOT NULL,
    revenue NUMERIC(16, 2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    customers_count BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP NULL,
    CONSTRAINT marketing_performance_revenue_nonnegative CHECK (
        revenue >= 0
        AND customers_count >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_marketing_perf_revenue_project_event
    ON marketing_performance_revenue_facts (project_id, event_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_revenue_campaign_event
    ON marketing_performance_revenue_facts (campaign_id, event_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_revenue_cohort
    ON marketing_performance_revenue_facts (project_id, cohort_date, event_date)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_perf_revenue_source_geo
    ON marketing_performance_revenue_facts (project_id, source, geo, event_date)
    WHERE deleted_at IS NULL;
