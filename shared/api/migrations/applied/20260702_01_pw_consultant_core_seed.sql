-- Professional Worlds — consultant core vertical (reference pilot, idempotent).

INSERT INTO profession_verticals (slug, name, description, icon_key, is_active, profile_schema, workspace_template)
VALUES (
    'consultant',
    'Consultant',
    'Core professional workspace for independent consultants.',
    'briefcase',
    true,
    '{"required": ["display_name"], "fields": ["display_name", "city", "specialization"]}'::jsonb,
    '{"recommended_apps": ["ProfessionalWorlds", "ContentManager"], "workspace_profile": "consultant"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_key = EXCLUDED.icon_key,
    is_active = EXCLUDED.is_active,
    profile_schema = EXCLUDED.profile_schema,
    workspace_template = EXCLUDED.workspace_template,
    updated_at = now();

INSERT INTO professional_vertical_modules (vertical_slug, module_key, config, sort_order, is_enabled)
VALUES
    ('consultant', 'profile', '{}'::jsonb, 10, true),
    ('consultant', 'clients', '{}'::jsonb, 20, true),
    ('consultant', 'deals', '{}'::jsonb, 30, true),
    ('consultant', 'learning', '{}'::jsonb, 40, true),
    ('consultant', 'public-presence', '{"draft_only": true}'::jsonb, 50, true),
    ('consultant', 'artifacts', '{}'::jsonb, 60, true)
ON CONFLICT (vertical_slug, module_key) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

INSERT INTO professional_vertical_schemas (vertical_slug, schema_key, version, title, schema_json, ui_schema, is_active)
VALUES (
    'consultant',
    'consultant_profile',
    1,
    'Consultant Profile v1',
    '{"type": "object", "required": ["display_name"], "properties": {"display_name": {"type": "string"}, "city": {"type": ["string", "null"]}, "specialization": {"type": "array", "items": {"type": "string"}}}}'::jsonb,
    '{"sections": ["identity", "positioning"]}'::jsonb,
    true
)
ON CONFLICT (vertical_slug, schema_key, version) DO UPDATE SET
    title = EXCLUDED.title,
    schema_json = EXCLUDED.schema_json,
    ui_schema = EXCLUDED.ui_schema,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO professional_ai_actions (
    vertical_slug, module_key, action_key, display_name, description, ugs_type_key, workflow_slug,
    prompt_template, input_schema, output_schema, safety_rules, artifact_kind, billing_hint, sort_order, is_active
)
VALUES (
    'consultant',
    'profile',
    'brand_pack',
    'Personal brand pack',
    'Positioning, bio and weekly content starters for consultants.',
    'professional_worlds_consultant_brand_pack',
    NULL,
    'runtime:consultant_brand_pack',
    '{}'::jsonb,
    '{"type":"object"}'::jsonb,
    '["Do not invent credentials"]'::jsonb,
    'brand_pack',
    '{"type": "text", "estimated_units": 2}'::jsonb,
    10,
    true
)
ON CONFLICT (vertical_slug, action_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    ugs_type_key = EXCLUDED.ugs_type_key,
    billing_hint = EXCLUDED.billing_hint,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO professional_learning_courses (vertical_slug, course_key, title, description, level, sort_order)
VALUES (
    'consultant',
    'consultant-start',
    'Consultant start',
    'First steps for independent consultants.',
    'beginner',
    10
)
ON CONFLICT (vertical_slug, course_key) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    'professional_worlds_consultant_brand_pack',
    'text',
    'Professional Worlds — consultant brand pack',
    'Personal brand positioning for consultants.',
    COALESCE((SELECT provider FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 'ollama'),
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'medium',
    120,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'product_area', 'professional_worlds',
        'vertical_slug', 'consultant',
        'skip_queue', false,
        'structured_output', false
    )
WHERE NOT EXISTS (
    SELECT 1 FROM generation_types gt WHERE gt.type_key = 'professional_worlds_consultant_brand_pack'
);
