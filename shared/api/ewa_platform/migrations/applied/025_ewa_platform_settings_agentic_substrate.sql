-- Seed EWA_AGENTIC_SUBSTRATE_ENABLED in platform settings (DB-backed master switch).
-- Runtime: os.getenv shim reads ewa_platform_setting after bootstrap (compose env ignored).
-- Idempotent: existing value_text preserved on conflict.

INSERT INTO ewa_platform_setting (
    setting_key,
    value_text,
    value_type,
    category,
    description_ru,
    description_en,
    default_value,
    allowed_values,
    affects_ru,
    affects_en,
    is_secret,
    sort_order
) VALUES (
    'EWA_AGENTIC_SUBSTRATE_ENABLED',
    '0',
    'bool',
    'companion',
    'Вкл (1): префикс /agent и длинные work-session промпты создают durable agentic-сессию (Postgres + Celery). Требует EWA_COMPANION_ASYNC_JOBS_ENABLED=1 для фоновых тиков.',
    'On (1): /agent prefix and long work-session prompts start durable agentic sessions (Postgres + Celery). Requires EWA_COMPANION_ASYNC_JOBS_ENABLED=1 for background ticks.',
    '0',
    '0|1',
    'agentic/starter.py, chat_bridge.py, POST /api/v1/ewa/agentic/sessions, routing AGENTIC_SESSION.',
    'agentic/starter.py, chat_bridge.py, POST /api/v1/ewa/agentic/sessions, routing AGENTIC_SESSION.',
    false,
    45
)
ON CONFLICT (setting_key) DO UPDATE SET
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description_ru = EXCLUDED.description_ru,
    description_en = EXCLUDED.description_en,
    default_value = EXCLUDED.default_value,
    allowed_values = EXCLUDED.allowed_values,
    affects_ru = EXCLUDED.affects_ru,
    affects_en = EXCLUDED.affects_en,
    is_secret = EXCLUDED.is_secret,
    sort_order = EXCLUDED.sort_order;
