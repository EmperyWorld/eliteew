-- IMC roadmap: версия промпта в type_metadata для снимка в input_payload и сопоставления прогонов.
-- Доп. ключи imc_response_format / imc_streaming обрабатываются в коде (ImcService → провайдер).

UPDATE generation_types
SET type_metadata = COALESCE(type_metadata, '{}'::jsonb) || '{"imc_prompt_version": 1}'::jsonb
WHERE type_key LIKE 'imc_rag_%'
  AND is_active = TRUE
  AND type_metadata->>'imc_prompt_version' IS NULL;
