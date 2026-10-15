-- Черновики шаблонов blueprint ensemble: хранение JSON плана в БД, подмешивание к файловому каталогу.
-- Админ: /api/v1/desktop/admin/ai-chat/ensemble-plan-templates

BEGIN;

CREATE TABLE IF NOT EXISTS desktop_ensemble_plan_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    body JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_desktop_ensemble_plan_templates_template_id
    ON desktop_ensemble_plan_templates (template_id);

CREATE INDEX IF NOT EXISTS idx_desktop_ensemble_plan_templates_active_sort
    ON desktop_ensemble_plan_templates (is_active, sort_order, created_at);

COMMIT;
