-- Site Studio lifecycle observability: durable jobs + worker heartbeat.
CREATE TABLE IF NOT EXISTS site_studio_lifecycle_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_scope VARCHAR(16) NOT NULL
        CHECK (instance_scope IN ('user', 'project')),
    instance_id UUID NOT NULL,
    site_slug VARCHAR(150) NULL,
    task_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'queued', 'running', 'succeeded', 'failed', 'cancelled')),
    stage VARCHAR(120) NULL,
    queued BOOLEAN NOT NULL DEFAULT FALSE,
    worker_id VARCHAR(160) NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    queued_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    finished_at TIMESTAMP NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    duration_ms INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_site_studio_lifecycle_jobs_instance
    ON site_studio_lifecycle_jobs (instance_scope, instance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_studio_lifecycle_jobs_status
    ON site_studio_lifecycle_jobs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_studio_lifecycle_jobs_task_type
    ON site_studio_lifecycle_jobs (task_type, created_at DESC);

CREATE TABLE IF NOT EXISTS site_studio_worker_heartbeats (
    worker_id VARCHAR(160) PRIMARY KEY,
    queue_name VARCHAR(120) NOT NULL DEFAULT 'site_studio',
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_studio_worker_heartbeats_queue_seen
    ON site_studio_worker_heartbeats (queue_name, last_seen_at DESC);
