-- KIRS: project-scoped Site Studio instances (marketing project -> one site, operator-owned).
CREATE TABLE IF NOT EXISTS project_site_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    marketing_project_id UUID NOT NULL,
    template_key VARCHAR(100) NOT NULL DEFAULT 'olenti',
    site_slug VARCHAR(150) NOT NULL UNIQUE,
    site_title VARCHAR(255) NOT NULL,
    site_topic VARCHAR(255) NOT NULL DEFAULT '',
    brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'provisioning', 'running', 'stopped', 'failed', 'redeploying', 'starting', 'stopping')),
    public_hostname VARCHAR(255) NOT NULL UNIQUE,
    publication_state VARCHAR(16) NOT NULL DEFAULT 'open',
    public_url TEXT NULL,
    api_base_url TEXT NULL,
    opened_at TIMESTAMP NULL,
    closed_at TIMESTAMP NULL,
    admin_email VARCHAR(255) NULL,
    admin_password_encrypted TEXT NULL,
    runtime_dir TEXT NULL,
    source_dir TEXT NULL,
    env_dir TEXT NULL,
    compose_file_path TEXT NULL,
    compose_project_name VARCHAR(120) NULL,
    ports_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    db_name VARCHAR(120) NULL,
    last_error TEXT NULL,
    last_provisioned_at TIMESTAMP NULL,
    client_access_json JSONB NOT NULL DEFAULT '{"allow_public_site": true, "allow_admin_embed": false}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_site_instances_project UNIQUE (marketing_project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_site_instances_owner
    ON project_site_instances (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_project_site_instances_status
    ON project_site_instances (status);
