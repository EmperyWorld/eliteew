-- MusicForge lyrics craft wave 2: single-cliché fail + abstract noun chant in lyrics_gate.

UPDATE music_forge_pipeline_stages
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{fail_on}',
  '["empty_lyrics","json_leak","missing_sections","stack_leak","meta_music_jargon","empty_pop_cliche","weak_cliche_fill","abstract_noun_chant"]'::jsonb,
  true
)
WHERE stage_type = 'lyrics_gate';
