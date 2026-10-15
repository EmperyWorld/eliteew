-- Professional Worlds: catalog + realtor assignment for four Realtor Pro addon modules
-- (panels already in runtimeModuleRegistry; missing from professional_modules until this seed).
-- Idempotent: safe to re-run.

INSERT INTO professional_modules (module_key, name, description, category, icon_key, default_config, is_active)
VALUES
    (
        'realtor_showings',
        'Showings',
        'Showing calendar and outcome capture.',
        'crm',
        'calendar',
        '{}'::jsonb,
        true
    ),
    (
        'realtor_tasks',
        'Tasks',
        'Grouped next actions from clients and deals.',
        'crm',
        'clipboard-document-list',
        '{}'::jsonb,
        true
    ),
    (
        'realtor_communications',
        'Communications',
        'Logged outreach and cross-channel follow-up history.',
        'crm',
        'chat-bubble-left-right',
        '{}'::jsonb,
        true
    ),
    (
        'realtor_objections',
        'Objection library',
        'Reusable objection handling variants.',
        'growth',
        'chat-bubble-bottom-center-text',
        '{}'::jsonb,
        true
    )
ON CONFLICT (module_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon_key = EXCLUDED.icon_key,
    is_active = true,
    updated_at = now();

INSERT INTO professional_vertical_modules (vertical_slug, module_key, config, sort_order, is_enabled)
VALUES
    ('realtor', 'realtor_showings', '{}'::jsonb, 23, true),
    ('realtor', 'realtor_tasks', '{}'::jsonb, 24, true),
    ('realtor', 'realtor_communications', '{}'::jsonb, 25, true),
    ('realtor', 'realtor_objections', '{}'::jsonb, 26, true)
ON CONFLICT (vertical_slug, module_key) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = now();

INSERT INTO professional_vertical_runtime_epoch (vertical_slug, epoch)
VALUES ('realtor', 1)
ON CONFLICT (vertical_slug) DO UPDATE SET
    epoch = professional_vertical_runtime_epoch.epoch + 1,
    updated_at = now();
