-- MusicForge: lyrics craft — reject sung ритм/пульс filler; update lyrics prompt on all revisions.

UPDATE music_forge_pipeline_stages
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{fail_on}',
  '["empty_lyrics","json_leak","missing_sections","stack_leak","meta_music_jargon","weak_cliche_fill"]'::jsonb,
  true
)
WHERE stage_type = 'lyrics_gate';

UPDATE music_forge_prompt_templates
SET
  system_prompt = system_prompt
    || CASE
         WHEN system_prompt ILIKE '%Never sing production words%' THEN ''
         ELSE ' Never sing production words: ритм, пульс, бит, такт, BPM, drop, rhythm, pulse, beat.'
       END,
  rules = CASE
    WHEN rules @> '["style_hint is arrangement only — never copy ритм/пульс/бит/BPM into sung lines."]'::jsonb
      THEN rules
    ELSE rules || '["style_hint is arrangement only — never copy ритм/пульс/бит/BPM into sung lines."]'::jsonb
  END
WHERE kind = 'lyrics';
