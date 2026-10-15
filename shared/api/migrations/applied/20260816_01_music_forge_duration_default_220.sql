-- MusicForge: align active product duration_default with Ideal TOP (220–240s)
-- and harden lyrics_gate fail_on (+ optional retry_once) on seeded stage instances.

UPDATE music_forge_product_settings
SET duration_default = 220
WHERE duration_default < 220
  AND duration_max >= 220;

UPDATE music_forge_pipeline_stages
SET settings = jsonb_set(
  jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{fail_on}',
    '["empty_lyrics","json_leak","missing_sections","stack_leak"]'::jsonb,
    true
  ),
  '{retry_once}',
  'true'::jsonb,
  true
)
WHERE stage_type = 'lyrics_gate';
