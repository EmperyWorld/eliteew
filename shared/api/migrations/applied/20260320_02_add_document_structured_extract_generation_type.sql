BEGIN;

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
VALUES (
    'document_structured_extract',
    COALESCE((SELECT category FROM generation_types WHERE type_key = 'text_chat'), 'text'),
    'Document Structured Extract',
    'Structured document extraction for marketing cabinet autofill and document-aware AI flows.',
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
)
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
