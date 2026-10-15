-- EliteEW Professional Worlds Expansion: admin-managed modules, AI actions and realtor AI/media jobs.
-- Apply with shared/api/migrations/apply_migrations.sh or the operator migration wrapper.

CREATE TABLE IF NOT EXISTS professional_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_key varchar(120) NOT NULL UNIQUE,
    name varchar(180) NOT NULL,
    description text,
    category varchar(80) NOT NULL DEFAULT 'workspace',
    icon_key varchar(80) NOT NULL DEFAULT 'squares',
    default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_vertical_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    module_key varchar(120) NOT NULL REFERENCES professional_modules(module_key) ON DELETE CASCADE,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    sort_order integer NOT NULL DEFAULT 0,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_vertical_modules_vertical_module UNIQUE (vertical_slug, module_key)
);

CREATE TABLE IF NOT EXISTS professional_vertical_schemas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    schema_key varchar(120) NOT NULL,
    version integer NOT NULL DEFAULT 1,
    title varchar(180) NOT NULL,
    schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    ui_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_vertical_schemas_vertical_key_version UNIQUE (vertical_slug, schema_key, version)
);

CREATE TABLE IF NOT EXISTS professional_ai_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    module_key varchar(120) NOT NULL,
    action_key varchar(160) NOT NULL,
    display_name varchar(180) NOT NULL,
    description text,
    ugs_type_key varchar(120) NOT NULL DEFAULT 'text_chat',
    workflow_slug varchar(160),
    prompt_template text NOT NULL,
    input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    safety_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
    artifact_kind varchar(80) NOT NULL DEFAULT 'text',
    billing_hint jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_ai_actions_vertical_action UNIQUE (vertical_slug, action_key)
);

CREATE TABLE IF NOT EXISTS professional_ai_action_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    action_key varchar(160) NOT NULL,
    source_type varchar(80),
    source_id uuid,
    status varchar(60) NOT NULL DEFAULT 'queued',
    idempotency_key varchar(160),
    input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    output_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    ugs_request_id uuid,
    artifact_id uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_photo_presets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    preset_key varchar(140) NOT NULL,
    display_name varchar(180) NOT NULL,
    description text,
    category varchar(80) NOT NULL DEFAULT 'enhance',
    action_type varchar(80) NOT NULL DEFAULT 'image_edit',
    ugs_type_key varchar(120) NOT NULL DEFAULT 'image_studio_image_edit',
    prompt_template text NOT NULL,
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_photo_presets_vertical_key UNIQUE (vertical_slug, preset_key)
);

CREATE TABLE IF NOT EXISTS professional_integration_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    integration_key varchar(120) NOT NULL,
    display_name varchar(180) NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_integration_bindings_vertical_key UNIQUE (vertical_slug, integration_key)
);

CREATE TABLE IF NOT EXISTS professional_admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(120) NOT NULL,
    entity_type varchar(120) NOT NULL,
    entity_key varchar(240) NOT NULL,
    before_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    after_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_object_intake_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid REFERENCES realtor_properties(id) ON DELETE SET NULL,
    status varchar(60) NOT NULL DEFAULT 'preview',
    source_text text NOT NULL,
    extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    idempotency_key varchar(160),
    ugs_request_id uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_media_enhancement_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    source_content_id uuid,
    output_content_id uuid,
    preset_key varchar(140) NOT NULL,
    status varchar(60) NOT NULL DEFAULT 'queued',
    instruction text,
    provider_result jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key varchar(160),
    ugs_request_id uuid,
    accepted_at timestamp without time zone,
    rejected_at timestamp without time zone,
    error text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

ALTER TABLE professional_artifacts
    ADD COLUMN IF NOT EXISTS parent_artifact_id uuid,
    ADD COLUMN IF NOT EXISTS module_key varchar(120),
    ADD COLUMN IF NOT EXISTS artifact_kind varchar(80) NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS source_media_id uuid,
    ADD COLUMN IF NOT EXISTS export_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_professional_vertical_modules_vertical ON professional_vertical_modules(vertical_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_professional_vertical_schemas_active ON professional_vertical_schemas(vertical_slug, schema_key, is_active);
CREATE INDEX IF NOT EXISTS idx_professional_ai_actions_runtime ON professional_ai_actions(vertical_slug, module_key, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_professional_ai_action_runs_user ON professional_ai_action_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_professional_photo_presets_runtime ON professional_photo_presets(vertical_slug, category, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_professional_integrations_runtime ON professional_integration_bindings(vertical_slug, is_enabled);
CREATE INDEX IF NOT EXISTS idx_professional_admin_audit_created ON professional_admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_object_intake_user ON realtor_object_intake_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_media_enhancement_property ON realtor_media_enhancement_jobs(user_id, property_id, created_at DESC);

COMMENT ON TABLE professional_modules IS 'Admin-managed reusable module registry. Product configuration, not user data.';
COMMENT ON TABLE professional_vertical_modules IS 'Admin-managed module assignments for profession verticals.';
COMMENT ON TABLE professional_vertical_schemas IS 'Admin-managed versioned schemas for profile/object/client payloads.';
COMMENT ON TABLE professional_ai_actions IS 'Admin-managed AI actions. Prompt templates must not be exposed to normal users.';
COMMENT ON TABLE professional_ai_action_runs IS 'User-scoped AI action run history.';
COMMENT ON TABLE professional_photo_presets IS 'Admin-managed high-level photo presets mapped to Image Studio / UGS types.';
COMMENT ON TABLE professional_integration_bindings IS 'Admin-managed cross-app integration feature flags and mappings.';
COMMENT ON TABLE professional_admin_audit_log IS 'Admin mutation audit log for Professional Worlds configuration.';
COMMENT ON TABLE realtor_object_intake_jobs IS 'User-scoped raw object text extraction previews and commits.';
COMMENT ON TABLE realtor_media_enhancement_jobs IS 'User-scoped real estate media enhancement jobs.';

INSERT INTO professional_modules (module_key, name, description, category, icon_key, default_config, is_active)
VALUES
    ('profile', 'Профиль специалиста', 'Позиционирование, специализация и публичная готовность профиля.', 'core', 'user-circle', '{}'::jsonb, true),
    ('objects', 'Объекты', 'Объекты недвижимости, AI-разбор текста и карточки для продажи.', 'core', 'home-modern', '{}'::jsonb, true),
    ('clients', 'Клиенты', 'CRM-lite: лиды, потребности, мотивы и следующий шаг.', 'crm', 'users', '{}'::jsonb, true),
    ('deals', 'Сделки', 'Воронка сделок и next-action по объектам/клиентам.', 'crm', 'briefcase', '{}'::jsonb, true),
    ('learning', 'Обучение', 'Курсы и role-play тренажёры под профессию.', 'growth', 'academic-cap', '{}'::jsonb, true),
    ('artifacts', 'Артефакты', 'Сохранённые тексты, презентации, медиа и черновики.', 'content', 'archive-box', '{}'::jsonb, true),
    ('media-studio', 'Медиа-студия', 'Фото-пресеты и улучшение изображений через Image Studio / UGS.', 'content', 'sparkles', '{}'::jsonb, true),
    ('public-presence', 'Публичное присутствие', 'Черновики сайтов, презентаций и сообщений без автопубликации.', 'growth', 'globe-alt', '{}'::jsonb, true)
ON CONFLICT (module_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon_key = EXCLUDED.icon_key,
    default_config = EXCLUDED.default_config,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO professional_vertical_modules (vertical_slug, module_key, config, sort_order, is_enabled)
VALUES
    ('realtor', 'profile', '{}'::jsonb, 10, true),
    ('realtor', 'objects', '{"default_city": "Владивосток"}'::jsonb, 20, true),
    ('realtor', 'media-studio', '{"supports_before_after": true}'::jsonb, 30, true),
    ('realtor', 'artifacts', '{}'::jsonb, 40, true),
    ('realtor', 'clients', '{}'::jsonb, 50, true),
    ('realtor', 'deals', '{}'::jsonb, 60, true),
    ('realtor', 'learning', '{}'::jsonb, 70, true),
    ('realtor', 'public-presence', '{"draft_only": true}'::jsonb, 80, true)
ON CONFLICT (vertical_slug, module_key) DO UPDATE SET
    config = EXCLUDED.config,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

INSERT INTO professional_vertical_schemas (vertical_slug, schema_key, version, title, schema_json, ui_schema, is_active)
VALUES
    (
        'realtor',
        'realtor_property',
        1,
        'Realtor Property v1',
        '{
            "type": "object",
            "required": ["title", "property_type", "deal_type", "city"],
            "properties": {
                "title": {"type": "string", "maxLength": 220},
                "property_type": {"type": "string"},
                "deal_type": {"type": "string"},
                "city": {"type": "string"},
                "district": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
                "price": {"type": ["number", "string", "null"]},
                "area_m2": {"type": ["number", "string", "null"]},
                "rooms": {"type": ["integer", "null"]},
                "floor": {"type": ["integer", "null"]},
                "total_floors": {"type": ["integer", "null"]},
                "view": {"type": ["string", "null"]},
                "infrastructure": {"type": "array", "items": {"type": "string"}},
                "facts": {"type": "object"}
            }
        }'::jsonb,
        '{"sections": ["basic", "price", "features", "jtbd"]}'::jsonb,
        true
    ),
    (
        'realtor',
        'realtor_profile',
        1,
        'Realtor Profile v1',
        '{"type": "object", "required": ["display_name", "city"], "properties": {"display_name": {"type": "string"}, "city": {"type": "string"}, "agency_name": {"type": ["string", "null"]}, "specialization": {"type": "array", "items": {"type": "string"}}}}'::jsonb,
        '{"sections": ["identity", "positioning", "proof"]}'::jsonb,
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
VALUES
    ('realtor', 'objects', 'object_extract', 'Разобрать текст объекта', 'Извлекает поля объекта, confidence и warnings из сырого описания.', 'professional_worlds_realtor_object_extract', NULL, 'runtime:realtor_object_extract', '{}'::jsonb, '{"type":"object"}'::jsonb, '["Не выдумывать факты", "Помечать юридические и инвестиционные утверждения как требующие проверки"]'::jsonb, 'intake_preview', '{"type": "text"}'::jsonb, 10, true),
    ('realtor', 'objects', 'sales_copy', 'Продающий текст', 'Готовит описание, заголовки и преимущества объекта.', 'professional_worlds_realtor_sales_copy', NULL, 'runtime:realtor_sales_copy', '{}'::jsonb, '{"type":"object"}'::jsonb, '["Отделять факты от эмоций", "Не обещать доходность"]'::jsonb, 'sales_copy', '{"type": "text"}'::jsonb, 20, true),
    ('realtor', 'objects', 'safety_rewrite', 'Безопасная редактура', 'Переписывает рискованные формулировки без юридических обещаний.', 'professional_worlds_realtor_safety_rewrite', NULL, 'runtime:realtor_safety_rewrite', '{}'::jsonb, '{"type":"object"}'::jsonb, '["Снимать гарантии", "Сохранять фактический смысл"]'::jsonb, 'message_draft', '{"type": "text"}'::jsonb, 30, true),
    ('realtor', 'profile', 'brand_pack', 'Личный бренд риэлтора', 'Генерирует позиционирование, bio и weekly content calendar.', 'professional_worlds_realtor_brand_pack', NULL, 'runtime:realtor_brand_pack', '{}'::jsonb, '{"type":"object"}'::jsonb, '["Не приписывать опыт без данных"]'::jsonb, 'brand_pack', '{"type": "text"}'::jsonb, 40, true)
ON CONFLICT (vertical_slug, action_key) DO UPDATE SET
    module_key = EXCLUDED.module_key,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    ugs_type_key = EXCLUDED.ugs_type_key,
    workflow_slug = EXCLUDED.workflow_slug,
    prompt_template = EXCLUDED.prompt_template,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    safety_rules = EXCLUDED.safety_rules,
    artifact_kind = EXCLUDED.artifact_kind,
    billing_hint = EXCLUDED.billing_hint,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO professional_photo_presets (
    vertical_slug, preset_key, display_name, description, category, action_type, ugs_type_key, prompt_template, parameters, sort_order, is_active
)
VALUES
    ('realtor', 'brighten', 'Светлее и чище', 'Мягко улучшить яркость, контраст и чистоту кадра.', 'enhance', 'image_edit', 'image_studio_image_edit', 'Make the real estate photo brighter, cleaner, natural, without changing layout or factual details.', '{"strength": 0.35}'::jsonb, 10, true),
    ('realtor', 'premium-interior', 'Премиальный интерьер', 'Сделать интерьер более дорогим и аккуратным без изменения планировки.', 'enhance', 'image_edit', 'image_studio_image_edit', 'Enhance interior photo with premium natural look, better light and color, keep all real objects and layout unchanged.', '{"strength": 0.45}'::jsonb, 20, true),
    ('realtor', 'remove-clutter', 'Убрать лишнее', 'Аккуратно убрать визуальный мусор по инструкции пользователя.', 'cleanup', 'inpaint', 'image_studio_image_edit', 'Remove distracting clutter specified by the user while keeping real estate layout and surfaces natural.', '{"requires_instruction": true}'::jsonb, 30, true),
    ('realtor', 'sea-view-boost', 'Подчеркнуть вид', 'Улучшить вид из окна/на море без подмены факта.', 'enhance', 'image_edit', 'image_studio_image_edit', 'Enhance sea or city view visibility naturally, do not add non-existing view or objects.', '{"strength": 0.3}'::jsonb, 40, true),
    ('realtor', 'social-cover', 'Обложка для соцсетей', 'Кадр под обложку поста/сторис с выразительной композицией.', 'social', 'image_edit', 'image_studio_image_edit', 'Create a polished social media cover version of the real estate photo, natural and factual.', '{"aspect_ratio": "16:9"}'::jsonb, 50, true),
    ('realtor', 'perspective-cleanup', 'Выравнивание перспективы', 'Сделать кадр ровнее и аккуратнее.', 'cleanup', 'image_edit', 'image_studio_image_edit', 'Clean perspective and lines subtly for real estate listing photo, keep geometry believable.', '{}'::jsonb, 60, true),
    ('realtor', 'upscale', 'Повысить качество', 'Upscale/quality restoration через доступный UGS/Image Studio контур.', 'quality', 'upscale', 'image_studio_image_edit', 'Upscale and improve quality of the source real estate image while preserving all details.', '{"mode": "upscale"}'::jsonb, 70, true),
    ('realtor', 'restoration', 'Восстановить фото', 'Убрать шумы и артефакты старого кадра.', 'quality', 'restoration', 'image_studio_image_edit', 'Restore noisy or low-quality real estate photo naturally, no invented features.', '{"mode": "restoration"}'::jsonb, 80, true)
ON CONFLICT (vertical_slug, preset_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    action_type = EXCLUDED.action_type,
    ugs_type_key = EXCLUDED.ugs_type_key,
    prompt_template = EXCLUDED.prompt_template,
    parameters = EXCLUDED.parameters,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO professional_integration_bindings (vertical_slug, integration_key, display_name, config, is_enabled)
VALUES
    ('realtor', 'image_studio', 'Image Studio (UGS)', '{"product_area": "image_studio", "note": "UGS image pipelines back realtor photo presets (see professional_photo_presets.ugs_type_key)."}'::jsonb, true),
    (
        'realtor',
        'unified_content',
        'Unified Content',
        '{"attach_media": true, "source_service": "professional_worlds", "asset_kind": "unified_professional_media"}'::jsonb,
        true
    ),
    ('realtor', 'ewrp', 'EWRP presentations', '{"draft_only": true, "draft_type": "ewrp_property_presentation"}'::jsonb, true),
    ('realtor', 'site_studio', 'Site Studio landing drafts', '{"draft_only": true, "publish_requires_user_action": true}'::jsonb, true),
    (
        'realtor',
        'gaf_chat',
        'GAF Chat drafts',
        '{"auto_send": false, "recipient_context_source": "professional_property_export_metadata"}'::jsonb,
        true
    ),
    (
        'realtor',
        'ewdesk',
        'EWDesk note suggestions',
        '{"auto_publish": false, "operator_publish_only": true}'::jsonb,
        true
    )
ON CONFLICT (vertical_slug, integration_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    config = EXCLUDED.config,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

INSERT INTO generation_types (
    type_key, category, display_name, description, provider, model_name,
    parameters, complexity, estimated_time, max_retries, priority, cost_credits, is_active, type_metadata
)
SELECT
    seed.type_key,
    'text',
    seed.display_name,
    seed.description,
    COALESCE((SELECT provider FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 'ollama'),
    COALESCE((SELECT model_name FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 'ollama'),
    '{}'::jsonb,
    'medium',
    seed.estimated_time,
    COALESCE((SELECT max_retries FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 3),
    COALESCE((SELECT priority FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 5),
    COALESCE((SELECT cost_credits FROM generation_types WHERE type_key = 'text_chat' LIMIT 1), 1.0),
    TRUE,
    jsonb_build_object(
        'product_area', 'professional_worlds',
        'vertical_slug', 'realtor',
        'skip_queue', false,
        'structured_output', seed.structured_output
    )
FROM (
    VALUES
        ('professional_worlds_realtor_object_extract', 'Professional Worlds — разбор объекта', 'Извлечение структурированных полей объекта из сырого текста.', 90, true),
        ('professional_worlds_realtor_sales_copy', 'Professional Worlds — продающий текст', 'Продающее описание и контент-пак объекта недвижимости.', 120, false),
        ('professional_worlds_realtor_safety_rewrite', 'Professional Worlds — безопасная редактура', 'Снятие рискованных обещаний и юридических гарантий из текста.', 80, false),
        ('professional_worlds_realtor_brand_pack', 'Professional Worlds — личный бренд', 'Позиционирование и контент-план специалиста.', 140, false)
) AS seed(type_key, display_name, description, estimated_time, structured_output)
WHERE NOT EXISTS (SELECT 1 FROM generation_types gt WHERE gt.type_key = seed.type_key);
