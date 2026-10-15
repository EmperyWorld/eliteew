-- MusicForge: friendly Mode display names for user picker (label_ru / label_en).
-- Only rewrites technical backfill labels (label == lane_key / mode_key); custom Admin labels stay.
BEGIN;

UPDATE music_forge_modes
SET
    label_ru = CASE mode_key
        WHEN 'sft_xl' THEN 'SFT XL — основной'
        WHEN 'base_xl' THEN 'BASE XL'
        WHEN 'turbo_xl' THEN 'TURBO XL — быстрее'
        ELSE label_ru
    END,
    label_en = CASE mode_key
        WHEN 'sft_xl' THEN 'SFT XL — recommended'
        WHEN 'base_xl' THEN 'BASE XL'
        WHEN 'turbo_xl' THEN 'TURBO XL — faster'
        ELSE label_en
    END,
    updated_at = NOW()
WHERE mode_key IN ('sft_xl', 'base_xl', 'turbo_xl')
  AND (
      label_ru = mode_key
      OR label_ru = lane_key
      OR label_en = mode_key
      OR label_en = lane_key
  );

COMMIT;
