CREATE TABLE IF NOT EXISTS user_site_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    template_key VARCHAR(100) NOT NULL DEFAULT 'olenti',
    site_slug VARCHAR(150) NOT NULL UNIQUE,
    site_title VARCHAR(255) NOT NULL,
    site_topic VARCHAR(255) NOT NULL DEFAULT '',
    brief_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'provisioning', 'running', 'stopped', 'failed', 'redeploying', 'starting', 'stopping')),
    public_url TEXT NULL,
    api_base_url TEXT NULL,
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
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_site_instances_status
    ON user_site_instances (status);

CREATE INDEX IF NOT EXISTS idx_user_site_instances_created_at
    ON user_site_instances (created_at DESC);
