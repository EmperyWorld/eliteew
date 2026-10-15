-- Категории системных шаблонов пресетов AMKA (фильтр в UI, GET .../preset-templates)

ALTER TABLE marketing_amka_preset_templates
    ADD COLUMN IF NOT EXISTS category VARCHAR(64) NOT NULL DEFAULT 'general';

UPDATE marketing_amka_preset_templates SET category = 'basics' WHERE slug = 'empty';
UPDATE marketing_amka_preset_templates SET category = 'imc' WHERE slug = 'imc_after_evidence';
UPDATE marketing_amka_preset_templates
SET category = 'autofill'
WHERE slug IN ('generate_jtbd', 'generate_segments_after_jtbd');
UPDATE marketing_amka_preset_templates SET category = 'agent' WHERE slug = 'tool_agent_segments';

COMMENT ON COLUMN marketing_amka_preset_templates.category IS 'Ключ группы: basics|imc|autofill|agent|general';
