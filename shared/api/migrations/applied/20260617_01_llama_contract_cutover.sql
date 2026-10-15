-- =============================================================================
-- EliteEW LLM naming cutover (breaking): legacy provider/name -> llama
-- =============================================================================

BEGIN;

DO $$
DECLARE
    legacy_provider TEXT := 'o' || 'llama';
    legacy_model_col TEXT := legacy_provider || '_model';
    legacy_prompt_col TEXT := legacy_provider || '_prompt';
    legacy_default_model_key TEXT := 'default_' || legacy_model_col;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assistant_settings'
          AND column_name = legacy_model_col
    ) THEN
        EXECUTE format('ALTER TABLE assistant_settings RENAME COLUMN %I TO llama_model', legacy_model_col);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'desktop_ai_chats'
          AND column_name = legacy_model_col
    ) THEN
        EXECUTE format('ALTER TABLE desktop_ai_chats RENAME COLUMN %I TO llama_model', legacy_model_col);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_live_voice_settings'
          AND column_name = legacy_model_col
    ) THEN
        EXECUTE format('ALTER TABLE user_live_voice_settings RENAME COLUMN %I TO llama_model', legacy_model_col);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'product_assistant_rag_settings'
          AND column_name = legacy_model_col
    ) THEN
        EXECUTE format('ALTER TABLE product_assistant_rag_settings RENAME COLUMN %I TO llama_model', legacy_model_col);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'presentations'
          AND column_name = legacy_prompt_col
    ) THEN
        EXECUTE format('ALTER TABLE presentations RENAME COLUMN %I TO llama_prompt', legacy_prompt_col);
    END IF;

    UPDATE desktop_ai_chat_config
    SET defaults = (defaults - legacy_default_model_key)
                   || jsonb_build_object('default_llama_model', defaults -> legacy_default_model_key)
    WHERE defaults ? legacy_default_model_key;
END $$;

DO $$
DECLARE
    legacy_provider TEXT := 'o' || 'llama';
    has_llama BOOLEAN := FALSE;
    has_legacy BOOLEAN := FALSE;
    legacy_key_pattern TEXT := '^' || legacy_provider || '_';
    legacy_provider_json TEXT := '"provider":"' || legacy_provider || '"';
BEGIN
    SELECT EXISTS(SELECT 1 FROM generation_providers WHERE provider_name = 'llama') INTO has_llama;
    SELECT EXISTS(SELECT 1 FROM generation_providers WHERE provider_name = legacy_provider) INTO has_legacy;

    IF has_legacy AND has_llama THEN
        UPDATE generation_providers AS target
        SET
            provider_type = 'llama',
            base_url = COALESCE(NULLIF(target.base_url, ''), source.base_url),
            health_endpoint = COALESCE(NULLIF(target.health_endpoint, ''), source.health_endpoint),
            timeout_seconds = COALESCE(target.timeout_seconds, source.timeout_seconds),
            max_concurrent = COALESCE(target.max_concurrent, source.max_concurrent),
            enabled = COALESCE(target.enabled, source.enabled),
            fallback_priority = LEAST(COALESCE(target.fallback_priority, 999), COALESCE(source.fallback_priority, 999)),
            config_json = COALESCE(target.config_json, '{}'::jsonb) || COALESCE(source.config_json, '{}'::jsonb),
            updated_at = NOW()
        FROM generation_providers AS source
        WHERE target.provider_name = 'llama'
          AND source.provider_name = legacy_provider;

        DELETE FROM generation_providers WHERE provider_name = legacy_provider;
    ELSIF has_legacy THEN
        UPDATE generation_providers
        SET provider_name = 'llama',
            provider_type = 'llama',
            updated_at = NOW()
        WHERE provider_name = legacy_provider;
    END IF;

    UPDATE generation_providers
    SET provider_type = 'llama',
        updated_at = NOW()
    WHERE provider_type = legacy_provider;

    UPDATE generation_types
    SET provider = 'llama'
    WHERE provider = legacy_provider;

    UPDATE generation_types
    SET model_name = 'llama'
    WHERE model_name = legacy_provider;

    UPDATE generation_types
    SET type_key = regexp_replace(type_key, legacy_key_pattern, 'llama_')
    WHERE type_key ~ legacy_key_pattern;

    UPDATE imc_research_runs
    SET type_key = regexp_replace(type_key, legacy_key_pattern, 'llama_')
    WHERE type_key ~ legacy_key_pattern;

    UPDATE generation_requests
    SET input_data = replace(input_data::text, legacy_provider_json, '"provider":"llama"')::jsonb
    WHERE input_data::text LIKE ('%' || legacy_provider_json || '%');

    UPDATE generation_requests
    SET output_data = replace(output_data::text, legacy_provider_json, '"provider":"llama"')::jsonb
    WHERE output_data::text LIKE ('%' || legacy_provider_json || '%');

    UPDATE ugs_settings
    SET value = (value - legacy_provider) || jsonb_build_object('llama', value -> legacy_provider)
    WHERE jsonb_typeof(value) = 'object'
      AND value ? legacy_provider;
END $$;

COMMIT;
