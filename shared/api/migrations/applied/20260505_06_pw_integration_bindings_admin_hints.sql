-- Professional Worlds: integration bindings aligned with desktop admin advisory checks.
-- Ensures realtor photo presets pass Image Studio linkage and enabled integrations carry minimal config hints.

INSERT INTO professional_integration_bindings (vertical_slug, integration_key, display_name, config, is_enabled)
VALUES
    (
        'realtor',
        'image_studio',
        'Image Studio (UGS)',
        '{"product_area": "image_studio", "note": "UGS image pipelines back realtor photo presets (see professional_photo_presets.ugs_type_key)."}'::jsonb,
        true
    )
ON CONFLICT (vertical_slug, integration_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    config = professional_integration_bindings.config || EXCLUDED.config,
    is_enabled = COALESCE(EXCLUDED.is_enabled, professional_integration_bindings.is_enabled),
    updated_at = now();

UPDATE professional_integration_bindings
SET
    config = config || '{"draft_type": "ewrp_property_presentation"}'::jsonb,
    updated_at = now()
WHERE vertical_slug = 'realtor' AND integration_key = 'ewrp';

UPDATE professional_integration_bindings
SET
    config = config || '{"recipient_context_source": "professional_property_export_metadata"}'::jsonb,
    updated_at = now()
WHERE vertical_slug = 'realtor' AND integration_key = 'gaf_chat';

UPDATE professional_integration_bindings
SET
    config = config || '{"operator_publish_only": true}'::jsonb,
    updated_at = now()
WHERE vertical_slug = 'realtor' AND integration_key = 'ewdesk';

UPDATE professional_integration_bindings
SET
    config = config || '{"asset_kind": "unified_professional_media"}'::jsonb,
    updated_at = now()
WHERE vertical_slug = 'realtor' AND integration_key = 'unified_content';
