-- EBrowser per-user HTTPS navigation policy + Desktop catalog row.
-- SoT: documentation/product/desktop/DESKTOP-EBROWSER.md

BEGIN;

CREATE TABLE IF NOT EXISTS ebrowser_user_policies (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(16) NOT NULL DEFAULT 'open',
    allow_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    deny_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    CONSTRAINT ebrowser_user_policies_mode_chk CHECK (mode IN ('open', 'allowlist', 'denylist'))
);

COMMENT ON TABLE ebrowser_user_policies IS
    'Per-user EBrowser navigation policy (open|allowlist|denylist). Client fail-closed on TTL.';

INSERT INTO desktop_app_catalog (
    app_id,
    name,
    description,
    app_component,
    category,
    gradient,
    color,
    sort_order,
    is_system,
    is_factory,
    ew_monthly_price,
    trial_duration_days,
    allow_multiple_windows,
    max_window_instances,
    is_featured_new
) VALUES (
    'app-ebrowser',
    'EBrowser',
    'Встроенный HTTPS-браузер клиента EliteEW: политика навигации и переключатели камеры, микрофона и звука.',
    'EBrowserApp',
    'productivity',
    'from-cyan-500 to-blue-700',
    'text-cyan-300',
    230,
    false,
    true,
    0,
    0,
    false,
    1,
    true
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_factory = EXCLUDED.is_factory,
    is_featured_new = EXCLUDED.is_featured_new;

COMMIT;
