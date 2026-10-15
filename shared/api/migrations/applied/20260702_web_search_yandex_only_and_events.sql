-- Yandex-only web search: normalize legacy settings + operational events table.

BEGIN;

UPDATE search_runtime_config
SET settings_json = (
    (settings_json - 'searxng_url' - 'provider_mode')
    || jsonb_build_object(
        'cache_enabled', COALESCE((settings_json->>'cache_enabled')::boolean, true),
        'cache_ttl_sec', COALESCE((settings_json->>'cache_ttl_sec')::int, 300),
        'cache_empty_ttl_sec', COALESCE((settings_json->>'cache_empty_ttl_sec')::int, 60)
    )
)
WHERE id = 1;

CREATE TABLE IF NOT EXISTS web_search_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    surface VARCHAR(32) NOT NULL DEFAULT 'global',
    status VARCHAR(32) NOT NULL,
    provider VARCHAR(16) NOT NULL DEFAULT 'yandex',
    latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
    hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
    error_code VARCHAR(64),
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_fingerprint VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_web_search_events_created_at
    ON web_search_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_events_surface_created
    ON web_search_events (surface, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_search_events_status_created
    ON web_search_events (status, created_at DESC);

COMMIT;
