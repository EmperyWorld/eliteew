-- EWA companion: durable user plans (goals + tasks) — server-first roadmap slice.
-- Mirrors init in persistence_pg/companion_plans_asyncpg companion_plans schema helpers.

CREATE TABLE IF NOT EXISTS ewa_companion_plans (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'wait',
    progress real NOT NULL DEFAULT 0.0,
    source_turn_id text,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_plans_principal_active_idx
    ON ewa_companion_plans (principal_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS ewa_companion_plans_principal_status_idx
    ON ewa_companion_plans (principal_id, status);

CREATE TABLE IF NOT EXISTS ewa_companion_plan_goals (
    id text PRIMARY KEY,
    plan_id text NOT NULL REFERENCES ewa_companion_plans (id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    category text NOT NULL DEFAULT 'general',
    progress real NOT NULL DEFAULT 0.0,
    status text NOT NULL DEFAULT 'active',
    priority text NOT NULL DEFAULT 'medium',
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_plan_goals_plan_order_idx
    ON ewa_companion_plan_goals (plan_id, sort_order);

CREATE TABLE IF NOT EXISTS ewa_companion_plan_tasks (
    id text PRIMARY KEY,
    plan_id text NOT NULL REFERENCES ewa_companion_plans (id) ON DELETE CASCADE,
    goal_id text REFERENCES ewa_companion_plan_goals (id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'pending',
    priority text NOT NULL DEFAULT 'medium',
    due_date date,
    sort_order integer NOT NULL DEFAULT 0,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_plan_tasks_plan_status_idx
    ON ewa_companion_plan_tasks (plan_id, status, sort_order);

CREATE INDEX IF NOT EXISTS ewa_companion_plan_tasks_goal_idx
    ON ewa_companion_plan_tasks (goal_id);
