-- Site Studio custom domain bindings (internal-only MVP).
CREATE TABLE IF NOT EXISTS site_studio_domain_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_scope VARCHAR(16) NOT NULL
        CHECK (instance_scope IN ('user', 'project')),
    instance_id UUID NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_dns'
        CHECK (status IN ('draft', 'pending_dns', 'verified', 'route_pending', 'active', 'failed', 'disabled')),
    verification_method VARCHAR(32) NOT NULL DEFAULT 'dns_txt'
        CHECK (verification_method IN ('dns_txt', 'dns_cname')),
    verification_name VARCHAR(255) NOT NULL,
    verification_token_hash VARCHAR(128) NOT NULL,
    verification_token_preview VARCHAR(32) NOT NULL,
    expected_cname VARCHAR(255) NULL,
    verified_at TIMESTAMP NULL,
    last_checked_at TIMESTAMP NULL,
    route_ready_at TIMESTAMP NULL,
    tls_status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (tls_status IN ('pending', 'operator_required', 'ready', 'failed')),
    last_error TEXT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_user_id UUID NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_site_studio_domain_bindings_hostname_active
    ON site_studio_domain_bindings (hostname)
    WHERE status IN ('pending_dns', 'verified', 'route_pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS ux_site_studio_domain_bindings_one_active_per_instance
    ON site_studio_domain_bindings (instance_scope, instance_id)
    WHERE status IN ('route_pending', 'active');

CREATE INDEX IF NOT EXISTS idx_site_studio_domain_bindings_instance
    ON site_studio_domain_bindings (instance_scope, instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_studio_domain_bindings_status
    ON site_studio_domain_bindings (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS site_studio_domain_binding_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binding_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    actor_user_id UUID NULL,
    before_json JSONB NULL,
    after_json JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_studio_domain_binding_audit_binding
    ON site_studio_domain_binding_audit (binding_id, created_at DESC);

CREATE TABLE IF NOT EXISTS site_studio_domain_dns_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    binding_id UUID NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    target_hostname VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'applied', 'failed', 'cancelled')),
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMP NULL,
    last_error TEXT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_site_studio_domain_dns_outbox_status
    ON site_studio_domain_dns_outbox (status, requested_at ASC);
