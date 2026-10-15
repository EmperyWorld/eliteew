-- KBSEW: admin-regulated chunks_per_barrel + optional rerank in kbsew_search_settings.

BEGIN;

UPDATE desktop_ai_chat_config
SET defaults = jsonb_set(
    defaults,
    '{kbsew_search_settings}',
    COALESCE(defaults -> 'kbsew_search_settings', '{}'::jsonb)
        || jsonb_build_object(
            'chunks_per_barrel',
            COALESCE(
                (defaults -> 'kbsew_search_settings' ->> 'chunks_per_barrel')::int,
                5
            ),
            'rerank_enabled',
            COALESCE(
                (defaults -> 'kbsew_search_settings' ->> 'rerank_enabled')::boolean,
                false
            )
        ),
    true
),
updated_at = NOW()
WHERE id = 1;

COMMIT;
