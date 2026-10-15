-- MusicForge: repair LLM generation type provider to live stack2 provider.
-- Prod UGS provider registry uses `llama`, not `ollama`.

BEGIN;

UPDATE generation_types
SET
    provider = 'llama',
    updated_at = NOW(),
    type_metadata = COALESCE(type_metadata, '{}'::jsonb) || jsonb_build_object(
        'provider_repair', '20260628_03_music_forge_llm_provider_repair',
        'previous_provider', provider
    )
WHERE type_key IN (
    'music_generator_forge_blueprint',
    'music_generator_forge_lyrics',
    'music_generator_forge_style'
)
  AND provider IS DISTINCT FROM 'llama';

COMMIT;
