-- UGS: публичная подпись канала (UI) + пересчёт энергии (cost_credits)
-- Apply via shared/api/migrations/apply_migrations.sh

ALTER TABLE generation_providers
ADD COLUMN IF NOT EXISTS display_label VARCHAR(120);

COMMENT ON COLUMN generation_providers.display_label IS 'Подпись в UI UGS (например «Текст», «Медиа»); если NULL — фронт подставляет по provider_type';

UPDATE generation_providers SET display_label = 'Текст'
WHERE display_label IS NULL AND LOWER(provider_type) IN ('ollama', 'openai', 'anthropic', 'groq');

UPDATE generation_providers SET display_label = 'Медиа'
WHERE display_label IS NULL AND LOWER(provider_type) IN ('comfyui', 'stable_diffusion', 'sdxl');

UPDATE generation_providers SET display_label = 'Аудио'
WHERE display_label IS NULL AND LOWER(provider_type) IN ('faster_whisper', 'whisper', 'tts', 'silero');

UPDATE generation_providers SET display_label = 'Видео'
WHERE display_label IS NULL AND LOWER(provider_type) IN ('ffmpeg', 'video');

UPDATE generation_providers SET display_label = 'Сервис'
WHERE display_label IS NULL;

UPDATE generation_types SET cost_credits = ROUND(
  (
    CASE LOWER(TRIM(category))
      WHEN 'text' THEN 5
      WHEN 'image' THEN 18
      WHEN 'audio' THEN 22
      WHEN 'video' THEN 48
      WHEN 'document' THEN 8
      WHEN 'composite' THEN 28
      ELSE 12
    END
  )::numeric
  * (CASE LOWER(TRIM(complexity))
      WHEN 'low' THEN 0.88
      WHEN 'high' THEN 1.28
      ELSE 1.0
    END)
  * (1.0 + LEAST(COALESCE(estimated_time, 30), 600)::numeric / 420.0)
, 2);
