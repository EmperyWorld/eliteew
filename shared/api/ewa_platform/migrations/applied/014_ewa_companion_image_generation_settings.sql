-- Seed companion image generation platform settings (operator UI + runtime cache).
-- Idempotent: existing rows are preserved (ON CONFLICT DO NOTHING).

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
) VALUES
    (
        'EWA_COMPANION_IMAGE_GENERATION_ENABLED',
        '0',
        'bool',
        'companion',
        'Генерация картинок спутником через UGS (фоновый tool image_generation).',
        'Companion image generation via UGS (background image_generation tool).',
        '0',
        '0|1',
        'tool_registry image_generation, companion_image_generation.py.',
        'tool_registry image_generation, companion_image_generation.py.',
        false,
        271
    ),
    (
        'EWA_COMPANION_IMAGE_GENERATION_TYPE_KEY',
        'desktop_ai_chat_image_01_top',
        'string',
        'companion',
        'UGS type_key для генерации картинки из чата спутника.',
        'UGS type_key for companion chat image generation.',
        'desktop_ai_chat_image_01_top',
        '',
        'UnifiedGenerationService.generate_and_wait type_key.',
        'UnifiedGenerationService.generate_and_wait type_key.',
        false,
        272
    ),
    (
        'EWA_COMPANION_IMAGE_GENERATION_WORKFLOW_SLUG',
        '01_top',
        'string',
        'companion',
        'ComfyUI workflow template slug для companion image UGS.',
        'ComfyUI workflow template slug for companion image UGS.',
        '01_top',
        '',
        'input_data workflow_template в companion_image_generation.',
        'input_data workflow_template in companion_image_generation.',
        false,
        273
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
