-- Optional: set metadata.product_area on generation_types for UGS Hub tariff grouping.
-- Apply with shared/api/migrations/apply_migrations.sh when ready.
-- Safe to re-run: only fills product_area when missing.

UPDATE generation_types
SET type_metadata = COALESCE(type_metadata, '{}'::jsonb) || '{"product_area":"marketing"}'::jsonb
WHERE (type_metadata->>'product_area') IS NULL
  AND (
    type_key ILIKE '%imc%'
    OR type_key ILIKE '%miso%'
    OR type_key ILIKE '%cabinet_filler%'
    OR type_key ILIKE '%marketing%'
  );

UPDATE generation_types
SET type_metadata = COALESCE(type_metadata, '{}'::jsonb) || '{"product_area":"presentations"}'::jsonb
WHERE (type_metadata->>'product_area') IS NULL
  AND (
    type_key ILIKE '%ewrp%'
    OR type_key ILIKE '%slide%'
    OR type_key ILIKE '%presentation%'
    OR type_key ILIKE '%deck%'
  );

UPDATE generation_types
SET type_metadata = COALESCE(type_metadata, '{}'::jsonb) || '{"product_area":"desktop"}'::jsonb
WHERE (type_metadata->>'product_area') IS NULL
  AND (
    type_key ILIKE '%desktop%'
    OR type_key ILIKE '%ensemble%'
    OR type_key ILIKE '%ai_chat%'
  );

UPDATE generation_types
SET type_metadata = COALESCE(type_metadata, '{}'::jsonb) || '{"product_area":"content"}'::jsonb
WHERE (type_metadata->>'product_area') IS NULL
  AND (
    type_key ILIKE '%document%'
    OR type_key ILIKE '%ultimate%'
    OR type_key ILIKE '%editor%'
    OR type_key ILIKE '%content%'
  );
