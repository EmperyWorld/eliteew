-- Site Manager Ops durable audit events.
CREATE TABLE IF NOT EXISTS site_manager_ops_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NULL,
    action VARCHAR(96) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) NULL,
    before_json JSONB NULL,
    after_json JSONB NULL,
    result_json JSONB NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_manager_ops_audit_events_created
    ON site_manager_ops_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_manager_ops_audit_events_target
    ON site_manager_ops_audit_events (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_manager_ops_audit_events_actor
    ON site_manager_ops_audit_events (actor_user_id, created_at DESC)
    WHERE actor_user_id IS NOT NULL;
