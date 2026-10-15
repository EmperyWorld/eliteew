-- Desktop AI Chat: seed generation budget keys into config.defaults JSONB.
-- Version: 20260805_desktop_ai_chat_generation_budgets
-- Idempotent: only fills missing keys; does not overwrite operator-set values.

BEGIN;

UPDATE desktop_ai_chat_config
SET defaults = defaults || jsonb_strip_nulls(
    jsonb_build_object(
        'desktop_chat_num_predict',
        CASE
            WHEN defaults ? 'desktop_chat_num_predict' THEN NULL
            ELSE to_jsonb(98304)
        END,
        'desktop_chat_timeout_sec',
        CASE
            WHEN defaults ? 'desktop_chat_timeout_sec' THEN NULL
            ELSE to_jsonb(300)
        END,
        'ensemble_separate_reply_max_tokens',
        CASE
            WHEN defaults ? 'ensemble_separate_reply_max_tokens' THEN NULL
            ELSE to_jsonb(32768)
        END,
        'ensemble_joint_section_max_tokens',
        CASE
            WHEN defaults ? 'ensemble_joint_section_max_tokens' THEN NULL
            ELSE to_jsonb(40960)
        END,
        'ensemble_blueprint_step_max_tokens',
        CASE
            WHEN defaults ? 'ensemble_blueprint_step_max_tokens' THEN NULL
            ELSE to_jsonb(40960)
        END
    )
),
updated_at = NOW()
WHERE id = 1;

COMMIT;
