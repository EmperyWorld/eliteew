-- Системный шаблон пресета AMKA: экспертная группа для evidence и analysis

INSERT INTO marketing_amka_preset_templates (slug, display_name, description, config, sort_order, category)
VALUES
(
    'ensemble_synthesis_evidence_analysis',
    'Экспертная группа: evidence + analysis',
    'Дополнительные шаги desktop_ensemble с blueprint-шаблонами для плана исследования и стратегического outline.',
    '{
        "schema_version": 1,
        "extra_plan_tasks": [
            {
                "insert_after_section_key": "evidence",
                "task": {
                    "section_key": "evidence",
                    "execution_mode": "desktop_ensemble",
                    "title": "План исследования (экспертная группа)",
                    "ensemble_template_hint": "research_plan_v1",
                    "ensemble_hero_ids": ["likiy_sorrento", "arlyqueen", "viktor_engineer"]
                }
            },
            {
                "insert_after_section_key": "analysis",
                "task": {
                    "section_key": "analysis",
                    "execution_mode": "desktop_ensemble",
                    "title": "Стратегический outline (экспертная группа)",
                    "ensemble_template_hint": "business_plan_v1",
                    "ensemble_hero_ids": ["likiy_sorrento", "arlyqueen", "dr_vereskov"]
                }
            }
        ]
    }'::jsonb,
    45,
    'agent'
)
ON CONFLICT (slug) DO UPDATE
SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    config = EXCLUDED.config,
    sort_order = EXCLUDED.sort_order,
    category = EXCLUDED.category;
