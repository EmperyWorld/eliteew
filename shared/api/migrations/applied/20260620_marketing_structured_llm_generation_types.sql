BEGIN;

-- SWOT and JTBD extraction: same stack2 JSON-object mode as document_structured_extract.
INSERT INTO generation_types (
    type_key,
    category,
    display_name,
    description,
    provider,
    model_name,
    parameters,
    complexity,
    estimated_time,
    max_retries,
    priority,
    cost_credits,
    is_active,
    type_metadata
)
SELECT
    v.type_key,
    COALESCE((SELECT category FROM generation_types WHERE type_key = 'text_chat'), 'text'),
    v.display_name,
    v.description,
    COALESCE((SELECT provider FROM generation_types WHERE type_key = 'text_chat'), 'ollama'),
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'text_chat'), 'rscr/vikhr_llama3.1_8b:Q4_K_M'),
    COALESCE((SELECT parameters FROM generation_types WHERE type_key = 'text_chat'), '{}'::jsonb),
    COALESCE((SELECT complexity FROM generation_types WHERE type_key = 'text_chat'), 'medium'),
    GREATEST(COALESCE((SELECT estimated_time FROM generation_types WHERE type_key = 'text_chat'), 60), 60),
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'text_chat'), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'text_chat'), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'text_chat'), 1.0),
    TRUE,
    COALESCE((SELECT type_metadata FROM generation_types WHERE type_key = 'text_chat'), '{}'::jsonb)
        || jsonb_build_object('marketing_cabinet', TRUE, 'structured_output', TRUE)
FROM (
    VALUES
        (
            'marketing_swot_analysis',
            'Marketing SWOT Analysis',
            'Structured SWOT JSON for marketing cabinet analysis module.'
        ),
        (
            'marketing_jtbd_extract',
            'Marketing JTBD Extract',
            'Structured JTBD job-story extraction JSON for marketing cabinet.'
        )
) AS v(type_key, display_name, description)
ON CONFLICT (type_key) DO UPDATE
SET category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    provider = EXCLUDED.provider,
    model_name = EXCLUDED.model_name,
    parameters = EXCLUDED.parameters,
    complexity = EXCLUDED.complexity,
    estimated_time = EXCLUDED.estimated_time,
    max_retries = EXCLUDED.max_retries,
    priority = EXCLUDED.priority,
    cost_credits = EXCLUDED.cost_credits,
    is_active = TRUE,
    type_metadata = EXCLUDED.type_metadata,
    updated_at = NOW();

COMMIT;
