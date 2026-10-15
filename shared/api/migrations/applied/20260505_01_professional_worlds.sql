-- EliteEW Professional Worlds: modular specialist ecosystem and first realtor vertical.
-- Apply with shared/api/migrations/apply_migrations.sh or the operator migration wrapper.

CREATE TABLE IF NOT EXISTS profession_verticals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug varchar(80) NOT NULL UNIQUE,
    name varchar(160) NOT NULL,
    description text,
    icon_key varchar(80) NOT NULL DEFAULT 'briefcase',
    is_active boolean NOT NULL DEFAULT true,
    profile_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    workspace_template jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS specialist_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE RESTRICT,
    display_name varchar(180),
    headline varchar(240),
    city varchar(120),
    agency_name varchar(180),
    specialization jsonb NOT NULL DEFAULT '[]'::jsonb,
    profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_public_ready boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_specialist_profiles_user_vertical UNIQUE (user_id, vertical_slug)
);

CREATE TABLE IF NOT EXISTS professional_generation_recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    recipe_key varchar(120) NOT NULL,
    display_name varchar(180) NOT NULL,
    description text,
    ugs_type_key varchar(120) NOT NULL DEFAULT 'text_chat',
    input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    prompt_template text NOT NULL,
    safety_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
    output_kind varchar(80) NOT NULL DEFAULT 'text',
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_generation_recipes_vertical_key UNIQUE (vertical_slug, recipe_key)
);

CREATE TABLE IF NOT EXISTS professional_artifacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    source_type varchar(80) NOT NULL,
    source_id uuid,
    recipe_key varchar(120),
    title varchar(240) NOT NULL,
    content text,
    artifact_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    unified_content_id uuid,
    ugs_request_id uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_learning_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    course_key varchar(120) NOT NULL,
    title varchar(220) NOT NULL,
    description text,
    level varchar(80) NOT NULL DEFAULT 'starter',
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_courses_vertical_key UNIQUE (vertical_slug, course_key)
);

CREATE TABLE IF NOT EXISTS professional_learning_lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES professional_learning_courses(id) ON DELETE CASCADE,
    lesson_key varchar(120) NOT NULL,
    title varchar(220) NOT NULL,
    summary text,
    content_md text NOT NULL,
    exercise jsonb NOT NULL DEFAULT '{}'::jsonb,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_lessons_course_key UNIQUE (course_id, lesson_key)
);

CREATE TABLE IF NOT EXISTS professional_learning_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id uuid NOT NULL REFERENCES professional_learning_lessons(id) ON DELETE CASCADE,
    status varchar(40) NOT NULL DEFAULT 'completed',
    score integer,
    notes text,
    completed_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_professional_learning_progress_user_lesson UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS professional_clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    name varchar(180) NOT NULL,
    contact varchar(240),
    need_summary text,
    budget_from numeric(14, 2),
    budget_to numeric(14, 2),
    preferred_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
    emotional_motive text,
    next_action text,
    status varchar(80) NOT NULL DEFAULT 'lead',
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    title varchar(220) NOT NULL,
    stage varchar(80) NOT NULL DEFAULT 'new',
    amount numeric(14, 2),
    next_action text,
    deal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    title varchar(220) NOT NULL,
    status varchar(60) NOT NULL DEFAULT 'open',
    due_at timestamp without time zone,
    related_type varchar(80),
    related_id uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(220) NOT NULL,
    property_type varchar(80) NOT NULL DEFAULT 'apartment',
    deal_type varchar(80) NOT NULL DEFAULT 'sale',
    city varchar(120) NOT NULL DEFAULT 'Владивосток',
    district varchar(160),
    address varchar(240),
    price numeric(14, 2),
    area_m2 numeric(10, 2),
    rooms integer,
    floor integer,
    total_floors integer,
    view varchar(220),
    infrastructure jsonb NOT NULL DEFAULT '[]'::jsonb,
    jtbd_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    facts jsonb NOT NULL DEFAULT '{}'::jsonb,
    status varchar(80) NOT NULL DEFAULT 'draft',
    is_deleted boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_property_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    unified_content_id uuid NOT NULL,
    caption varchar(240),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_showings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    scheduled_at timestamp without time zone NOT NULL,
    status varchar(80) NOT NULL DEFAULT 'planned',
    notes text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialist_profiles_user ON specialist_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_artifacts_user_vertical ON professional_artifacts(user_id, vertical_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_professional_clients_user_vertical ON professional_clients(user_id, vertical_slug, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_professional_deals_user_vertical ON professional_deals(user_id, vertical_slug, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_properties_user_active ON realtor_properties(user_id, is_deleted, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtor_property_media_property ON realtor_property_media(property_id, sort_order);

INSERT INTO profession_verticals (slug, name, description, icon_key, profile_schema, workspace_template)
VALUES (
    'realtor',
    'Риэлтор',
    'Профессиональная среда для специалиста по продаже и аренде недвижимости.',
    'home-modern',
    '{
        "required": ["display_name", "city"],
        "fields": ["agency_name", "specialization", "areas", "languages", "social_links", "achievements"]
    }'::jsonb,
    '{
        "recommended_apps": ["app-professional-worlds", "app-ewrp", "app-content", "app-site-studio", "app-gaf-chat"],
        "workspace_profile": "realtor"
    }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_key = EXCLUDED.icon_key,
    profile_schema = EXCLUDED.profile_schema,
    workspace_template = EXCLUDED.workspace_template,
    updated_at = now();

INSERT INTO professional_generation_recipes (
    vertical_slug, recipe_key, display_name, description, ugs_type_key, prompt_template, safety_rules, output_kind, sort_order
)
VALUES
    ('realtor', 'realtor_property_description_jtbd', 'JTBD-описание объекта', 'Описание объекта через контекст, результат и эмоциональное преображение.', 'text_chat', 'runtime:build_realtor_prompt', '["Не выдумывать факты", "Не обещать доходность", "Не гарантировать ипотеку"]'::jsonb, 'text', 10),
    ('realtor', 'realtor_property_content_pack', 'Контент-пак объекта', 'Пост, сценарий видео, аудио-тур и план презентации объекта.', 'text_chat', 'runtime:build_realtor_prompt_content_pack', '["Отделять факты от подачи", "Проверять юридические формулировки"]'::jsonb, 'bundle', 20),
    ('realtor', 'realtor_learning_roleplay', 'Тренажер возражений', 'Этичный role-play для переговоров с покупателем или продавцом.', 'text_chat', 'runtime:build_coach_prompt', '["Не использовать манипулятивные техники", "Фокус на доверии и следующем шаге"]'::jsonb, 'coach', 30)
ON CONFLICT (vertical_slug, recipe_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    ugs_type_key = EXCLUDED.ugs_type_key,
    prompt_template = EXCLUDED.prompt_template,
    safety_rules = EXCLUDED.safety_rules,
    output_kind = EXCLUDED.output_kind,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO desktop_app_catalog (
    app_id, name, description, app_component, category, gradient, color, sort_order,
    allow_multiple_windows, max_window_instances, is_system, is_factory, ew_monthly_price,
    is_featured_new
)
VALUES (
    'app-professional-worlds',
    'Professional Worlds',
    'Профессиональные рабочие среды: профиль, обучение, CRM-lite и AI-инструменты для специалистов.',
    'ProfessionalWorlds',
    'productivity',
    'from-emerald-500 to-sky-700',
    'text-emerald-300',
    320,
    false,
    1,
    false,
    false,
    0,
    true
)
ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    allow_multiple_windows = EXCLUDED.allow_multiple_windows,
    max_window_instances = EXCLUDED.max_window_instances,
    is_featured_new = EXCLUDED.is_featured_new,
    updated_at = now();

WITH default_group AS (
    SELECT id FROM app_access_groups WHERE name = 'default' LIMIT 1
), catalog AS (
    SELECT id FROM desktop_app_catalog WHERE app_id = 'app-professional-worlds'
)
INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT catalog.id, default_group.id
FROM catalog, default_group
ON CONFLICT DO NOTHING;

WITH starter_course AS (
    INSERT INTO professional_learning_courses (vertical_slug, course_key, title, description, level, sort_order)
    VALUES (
        'realtor',
        'realtor-start',
        'Старт риэлтора во Владивостоке',
        'Первые навыки: профиль, объект, клиент, показ и безопасная коммуникация.',
        'starter',
        10
    )
    ON CONFLICT (vertical_slug, course_key) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        level = EXCLUDED.level,
        sort_order = EXCLUDED.sort_order,
        updated_at = now()
    RETURNING id
)
INSERT INTO professional_learning_lessons (course_id, lesson_key, title, summary, content_md, exercise, sort_order)
SELECT starter_course.id, lesson_key, title, summary, content_md, exercise, sort_order
FROM starter_course
CROSS JOIN (
    VALUES
        ('profile-positioning', 'Позиционирование специалиста', 'Сформулируйте, кому и чем вы полезны.', 'Опишите 3 сегмента клиентов и одну причину доверять вам.', '{"kind":"reflection"}'::jsonb, 10),
        ('object-jtbd', 'Объект через JTBD', 'Переведите характеристики объекта в работу клиента.', 'Заполните когда/хочу/чтобы почувствовать для одного объекта.', '{"kind":"jtbd"}'::jsonb, 20),
        ('objection-roleplay', 'Возражения без давления', 'Тренировка спокойного ответа на сомнения клиента.', 'Выберите возражение и пройдите role-play.', '{"kind":"roleplay"}'::jsonb, 30)
) AS lessons(lesson_key, title, summary, content_md, exercise, sort_order)
ON CONFLICT (course_id, lesson_key) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    content_md = EXCLUDED.content_md,
    exercise = EXCLUDED.exercise,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
