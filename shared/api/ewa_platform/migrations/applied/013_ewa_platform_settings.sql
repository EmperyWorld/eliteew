-- EWA platform operator settings (companion/orchestration/persona flags).
-- Runtime source of truth replaces EWA_* keys in stack env files (except EWA_DATABASE_URL bootstrap).

CREATE TABLE IF NOT EXISTS ewa_platform_setting (
    setting_key text PRIMARY KEY,
    value_text text NOT NULL DEFAULT '',
    value_type text NOT NULL DEFAULT 'string',
    category text NOT NULL DEFAULT 'misc',
    description_ru text NOT NULL DEFAULT '',
    description_en text NOT NULL DEFAULT '',
    default_value text NOT NULL DEFAULT '',
    allowed_values text NOT NULL DEFAULT '',
    affects_ru text NOT NULL DEFAULT '',
    affects_en text NOT NULL DEFAULT '',
    is_secret boolean NOT NULL DEFAULT false,
    sort_order int NOT NULL DEFAULT 0,
    updated_by text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ewa_platform_setting_audit (
    id bigserial PRIMARY KEY,
    setting_key text NOT NULL,
    old_value text,
    new_value text NOT NULL,
    actor_sub text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_platform_setting_category_sort_idx
    ON ewa_platform_setting (category, sort_order, setting_key);

CREATE INDEX IF NOT EXISTS ewa_platform_setting_audit_key_created_idx
    ON ewa_platform_setting_audit (setting_key, created_at DESC);
