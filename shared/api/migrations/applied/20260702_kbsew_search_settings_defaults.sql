-- Desktop AI Chat: KBSEW barrel search feature toggles in config.defaults JSONB.
-- Idempotent merge; does not remove legacy tools_knowledge_base_search_enabled.

BEGIN;

UPDATE desktop_ai_chat_config
SET defaults = defaults || jsonb_build_object(
    'kbsew_search_settings',
    COALESCE(defaults -> 'kbsew_search_settings', '{}'::jsonb)
        || jsonb_build_object(
            'enabled',
            COALESCE(
                (defaults -> 'kbsew_search_settings' ->> 'enabled')::boolean,
                COALESCE((defaults ->> 'tools_knowledge_base_search_enabled')::boolean, false)
            ),
            'allowed_barrels',
            COALESCE(defaults -> 'kbsew_search_settings' -> 'allowed_barrels', '[]'::jsonb)
        )
),
updated_at = NOW()
WHERE id = 1;

COMMIT;
