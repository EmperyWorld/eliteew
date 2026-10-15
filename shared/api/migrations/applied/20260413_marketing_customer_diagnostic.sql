-- Диагностика для кабинета заказчика (celzrel): флаг проекта + сессия ответов.
-- Идемпотентно: безопасно повторить, если таблицы уже есть.

CREATE TABLE IF NOT EXISTS marketing_project_customer_diagnostic (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_customer_diagnostic_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}'::JSONB,
    progress_percent INT NOT NULL DEFAULT 0,
    computed_results JSONB,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mcds_project ON marketing_customer_diagnostic_session (project_id);
CREATE INDEX IF NOT EXISTS idx_mcds_user ON marketing_customer_diagnostic_session (user_id);
