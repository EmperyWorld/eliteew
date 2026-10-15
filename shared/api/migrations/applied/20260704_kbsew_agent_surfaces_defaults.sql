-- KBSEW: per-AI-surface agent toggles in kbsew_search_settings.agents (mirrors web-search surfaces).

BEGIN;

UPDATE desktop_ai_chat_config
SET defaults = jsonb_set(
    defaults,
    '{kbsew_search_settings}',
    COALESCE(defaults -> 'kbsew_search_settings', '{}'::jsonb)
        || jsonb_build_object(
            'agents',
            COALESCE(defaults -> 'kbsew_search_settings' -> 'agents', '{}'::jsonb)
                || jsonb_build_object(
                    'desktop',
                    COALESCE(
                        (defaults -> 'kbsew_search_settings' -> 'agents' ->> 'desktop')::boolean,
                        COALESCE(
                            (defaults -> 'kbsew_search_settings' ->> 'enabled')::boolean,
                            COALESCE((defaults ->> 'tools_knowledge_base_search_enabled')::boolean, false)
                        )
                    ),
                    'ewa',
                    COALESCE((defaults -> 'kbsew_search_settings' -> 'agents' ->> 'ewa')::boolean, false),
                    'marketing',
                    COALESCE((defaults -> 'kbsew_search_settings' -> 'agents' ->> 'marketing')::boolean, false),
                    'imperorg',
                    COALESCE((defaults -> 'kbsew_search_settings' -> 'agents' ->> 'imperorg')::boolean, false),
                    'ugs',
                    COALESCE((defaults -> 'kbsew_search_settings' -> 'agents' ->> 'ugs')::boolean, false)
                )
        ),
    true
),
updated_at = NOW()
WHERE id = 1;

COMMIT;
