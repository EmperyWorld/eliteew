-- EWRP: одна генерация презентации = 500 энергии; списание в POST /ewrp (BillingService).
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
    'ewrp_presentation',
    'document',
    'EWRP — генерация презентации',
    'Полный пайплайн: структура, визуалы, PDF (списание при запуске).',
    'composite',
    'ewrp_pipeline',
    '{}'::jsonb,
    'high',
    600,
    3,
    5,
    500.0,
    TRUE,
    jsonb_build_object(
        'product_area', 'presentations',
        'api_billing_only', true,
        'note', 'Credits deducted in POST /api/v1/ewrp, not via UGS generate()'
    )
WHERE NOT EXISTS (SELECT 1 FROM generation_types WHERE type_key = 'ewrp_presentation');

COMMIT;
