-- Cause: migration 019 set EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES=30 while LLM history
-- cap defaults to ~48. First condense needs dropped_msgs >= 30 ⇒ total history ≈ 78+,
-- so ENABLED=1 never wrote companion_chat_condensed_v1 on typical profiles.
-- Align prod value with catalog default (8).

UPDATE ewa_platform_setting
SET value_text = '8',
    updated_at = now(),
    updated_by = 'migration_035_chat_condense_min_messages'
WHERE setting_key = 'EWA_COMPANION_CHAT_CONDENSE_MIN_MESSAGES'
  AND value_text IS DISTINCT FROM '8';
