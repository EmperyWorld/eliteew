-- Seed EWA_COMPANION_REACTIVE_CHROME_ENABLED (companion window mood/work aura tint).
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
    'EWA_COMPANION_REACTIVE_CHROME_ENABLED',
    '1',
    'bool',
    'companion',
    'Вкл (1): окно спутника плавно меняет оформление (aura/свечение) от настроения и активных операций. Выкл (0): статичная палитра персоны.',
    'On (1): companion window smoothly shifts decoration (aura/glow) with mood and active operations. Off (0): static persona palette.',
    '1',
    '0|1',
    'EwaCompanionChatPanel CSS vars (--companion-*), presence canvas, operations load tint.',
    'EwaCompanionChatPanel CSS vars (--companion-*), presence canvas, operations load tint.',
    false,
    235
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
