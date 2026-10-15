-- Realtor Pro: dedicated task/next-action rows and reminders on generic professional_tasks.

CREATE TABLE IF NOT EXISTS realtor_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(220) NOT NULL,
    status varchar(60) NOT NULL DEFAULT 'open',
    priority varchar(40) NOT NULL DEFAULT 'normal',
    due_at timestamp without time zone,
    reminder_at timestamp without time zone,
    next_action varchar(280),
    notes text,
    property_id uuid REFERENCES realtor_properties(id) ON DELETE SET NULL,
    client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    showing_id uuid REFERENCES realtor_property_showings(id) ON DELETE SET NULL,
    deal_id uuid REFERENCES professional_deals(id) ON DELETE SET NULL,
    task_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realtor_tasks_user_due ON realtor_tasks(user_id, due_at NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_realtor_tasks_user_status ON realtor_tasks(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_tasks_property ON realtor_tasks(property_id) WHERE property_id IS NOT NULL;

ALTER TABLE professional_tasks ADD COLUMN IF NOT EXISTS reminder_at timestamp without time zone;
