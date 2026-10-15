-- Video Studio: repair AI motion-prompt UGS type to live stack2 provider `llama`.
-- Prod registry has no enabled `ollama` provider (see image_studio_image_prompt / music_generator_lyrics).

BEGIN;

UPDATE generation_types
SET
    provider = 'llama',
    model_name = '',
    updated_at = NOW(),
    description = 'Помощь в формулировке motion prompt для Wan 2.2 I2V (Llama stack2).',
    type_metadata = COALESCE(type_metadata, '{}'::jsonb) || jsonb_build_object(
        'provider_repair', '20260628_05_video_studio_image_prompt_llama_provider_repair',
        'previous_provider', provider
    )
WHERE type_key = 'video_studio_image_prompt'
  AND provider IS DISTINCT FROM 'llama';

COMMIT;
