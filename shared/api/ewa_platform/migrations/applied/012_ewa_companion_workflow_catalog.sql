-- WF-6: operator-editable action workflow catalog + audit trail (EWA_DATABASE_URL).

CREATE TABLE IF NOT EXISTS ewa_companion_workflow_catalog (
    workflow_id text NOT NULL,
    version int NOT NULL,
    definition jsonb NOT NULL,
    enabled boolean NOT NULL DEFAULT false,
    source text NOT NULL DEFAULT 'admin',
    created_by text,
    updated_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workflow_id, version)
);

CREATE TABLE IF NOT EXISTS ewa_companion_workflow_catalog_audit (
    id bigserial PRIMARY KEY,
    workflow_id text NOT NULL,
    version int NOT NULL,
    action text NOT NULL,
    actor_sub text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_workflow_catalog_enabled_idx
    ON ewa_companion_workflow_catalog (workflow_id, enabled, version DESC);

CREATE INDEX IF NOT EXISTS ewa_companion_workflow_catalog_audit_wf_created_idx
    ON ewa_companion_workflow_catalog_audit (workflow_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ewa_companion_workflow_catalog_one_enabled
    ON ewa_companion_workflow_catalog (workflow_id)
    WHERE enabled = true;
