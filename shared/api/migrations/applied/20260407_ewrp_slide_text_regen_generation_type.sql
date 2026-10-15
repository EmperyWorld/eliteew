-- EWRP: платная перегенерация текста одного слайда (списание в POST .../regenerate-text).
BEGIN;

INSERT INTO generation_types (
    type_key,
    category,
    display_name,
    description,
    provider,
    model_name,
    parameters,
    complexity,
    estimated_time,
    max_retries,
    priority,
    cost_credits,
    is_active,
    type_metadata
)
SELECT
    'ewrp_slide_text_regen',
    'document',
    'EWRP — перегенерация текста слайда',
    'Переписывание заголовка и буллетов одного слайда; списание в POST /api/v1/ewrp/{id}/slides/{n}/regenerate-text.',
    'composite',
    'ewrp_slide_text',
    '{}'::jsonb,
    'medium',
    120,
    2,
    5,
    40.0,
    TRUE,
    jsonb_build_object(
        'product_area', 'presentations',
        'api_billing_only', true,
        'note', 'Credits deducted in POST /api/v1/ewrp/.../regenerate-text'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'ewrp_slide_text_regen');

COMMIT;
