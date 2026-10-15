-- Пометить уже загруженные голосовые GAF (имя gaf-voice-*) как sub_type gaf_chat_voice — не показывать в Content Manager.
BEGIN;

UPDATE unified_content
SET sub_type = 'gaf_chat_voice'
WHERE deleted_at IS NULL
  AND COALESCE(sub_type, '') <> 'gaf_chat_voice'
  AND (
    LOWER(COALESCE(original_filename, '')) LIKE 'gaf-voice-%'
    OR LOWER(COALESCE(name, '')) LIKE 'gaf-voice-%'
  );

COMMIT;
