-- EWRP: шаблон контентных слайдов, выбранный до генерации (применяется к слайдам 2..N в slides_json)
ALTER TABLE ewrp_jobs
  ADD COLUMN IF NOT EXISTS default_slide_layout VARCHAR(32);

COMMENT ON COLUMN ewrp_jobs.default_slide_layout IS 'Optional layout key for content slides (index >= 1); empty = auto';

ALTER TABLE ewrp_jobs
  ADD COLUMN IF NOT EXISTS presentation_theme VARCHAR(32);

COMMENT ON COLUMN ewrp_jobs.presentation_theme IS 'Visual theme for PDF HTML (classic, midnight, ember, aurora, paper)';
