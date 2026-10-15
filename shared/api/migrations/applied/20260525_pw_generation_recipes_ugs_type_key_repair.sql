-- ---
-- EliteEW · Empery World
-- https://eliteew.ru
-- Author: po&T <keysray70@gmail.com>
-- ---
-- Purpose:
-- Repair legacy Professional Worlds generation_recipes that still point at generic text_chat.
-- Invariants:
-- - Idempotent: only rows with ugs_type_key = text_chat are updated.
-- Related:
-- - api/routers/professional_worlds.py (stream routes use professional_ai_actions.ugs_type_key)
-- ---

BEGIN;

UPDATE professional_generation_recipes
SET
    ugs_type_key = CASE recipe_key
        WHEN 'realtor_property_description_jtbd' THEN 'professional_worlds_realtor_sales_copy'
        WHEN 'realtor_property_content_pack' THEN 'professional_worlds_realtor_sales_copy'
        WHEN 'realtor_learning_roleplay' THEN 'professional_worlds_realtor_safety_rewrite'
        ELSE ugs_type_key
    END,
    updated_at = NOW()
WHERE vertical_slug = 'realtor'
  AND ugs_type_key = 'text_chat';

COMMIT;
