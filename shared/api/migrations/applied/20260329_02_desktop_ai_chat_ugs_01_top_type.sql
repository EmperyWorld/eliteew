-- Desktop AI Chat: тип UGS для картинок (Comfy workflow slug 01_top) + defaults.
-- apply_migrations.sh; при необходимости перезапуск API. Провайдер: как у существующего comfy-типа или имя `comfyui`.

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
    'desktop_ai_chat_image_01_top',
    'image',
    'Desktop AI Chat — Comfy 01 Top',
    'Генерация изображения для чата: workflow в UGS с slug 01_top (UnifiedGenerationService → Comfy).',
    COALESCE(
        (
            SELECT g.provider
            FROM generation_types g
            WHERE g.provider IS NOT NULL
              AND g.provider IN (SELECT provider_name FROM generation_providers WHERE provider_type = 'comfyui')
            ORDER BY g.updated_at DESC NULLS LAST
            LIMIT 1
        ),
        (
            SELECT gp.provider_name
            FROM generation_providers gp
            WHERE gp.provider_type = 'comfyui'
              AND gp.enabled IS TRUE
            ORDER BY gp.fallback_priority DESC NULLS LAST
            LIMIT 1
        ),
        'comfyui'
    ),
    COALESCE(
        (SELECT model_name FROM generation_types WHERE provider IN (SELECT provider_name FROM generation_providers WHERE provider_type = 'comfyui') LIMIT 1),
        'comfyui'
    ),
    jsonb_build_object(
        'workflow_template', '01_top'
    ),
    'medium',
    180,
    3,
    5,
    1.0,
    TRUE,
    jsonb_build_object(
        'desktop_ai_chat', TRUE,
        'comfy_workflow_slug', '01_top'
    )
WHERE NOT EXISTS (
    SELECT 1 FROM generation_types WHERE type_key = 'desktop_ai_chat_image_01_top'
);

UPDATE desktop_ai_chat_config
SET
    defaults = COALESCE(defaults, '{}'::jsonb)
        || jsonb_build_object(
            'image_generation_type_key', 'desktop_ai_chat_image_01_top',
            'image_generation_workflow_slug', '01_top'
        ),
    updated_at = NOW()
WHERE id = 1;

COMMIT;
