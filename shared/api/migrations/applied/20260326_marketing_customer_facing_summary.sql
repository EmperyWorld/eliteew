-- Сводка для кабинета заказчика (редактирует руководитель в «Взаимодействие с заказчиком»).

CREATE TABLE IF NOT EXISTS marketing_customer_facing_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcfs_project ON marketing_customer_facing_summary (project_id);
