-- Professional Worlds: media albums (campaign / artifact linkage), batch idempotency,
-- enhancement duplicate lookup index, Realtor photo presets seed, cross-app draft link index.

ALTER TABLE professional_media_albums
    ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES realtor_marketing_campaigns(id) ON DELETE SET NULL;
ALTER TABLE professional_media_albums
    ADD COLUMN IF NOT EXISTS artifact_id uuid REFERENCES professional_artifacts(id) ON DELETE SET NULL;

ALTER TABLE realtor_media_batch_items
    ADD COLUMN IF NOT EXISTS preset_key varchar(140);
ALTER TABLE realtor_media_batch_items
    ADD COLUMN IF NOT EXISTS review_decision varchar(40);

UPDATE realtor_media_batch_items bi
SET preset_key = j.preset_key
FROM realtor_media_batch_jobs j
WHERE bi.batch_job_id = j.id AND bi.preset_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_realtor_media_batch_user_idempotency
    ON realtor_media_batch_jobs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS ix_realtor_media_enhancement_dup_lookup
    ON realtor_media_enhancement_jobs (user_id, property_id, source_content_id, preset_key, status);

CREATE INDEX IF NOT EXISTS ix_prof_cross_app_drafts_artifact
    ON professional_cross_app_draft_links (artifact_id)
    WHERE artifact_id IS NOT NULL;

COMMENT ON COLUMN realtor_media_batch_items.review_decision IS
    'User before/after review: pending, accepted, rejected, skipped.';

COMMENT ON COLUMN professional_cross_app_draft_links.lifecycle_state IS
    'Cross-app lifecycle: created, opened, updated, published, cancelled, stale.';

INSERT INTO professional_photo_presets (
    vertical_slug, preset_key, display_name, description, category, action_type,
    ugs_type_key, prompt_template, parameters, is_active, sort_order
)
VALUES
(
    'realtor',
    'realtor_hero_cover',
    'Hero cover (фасад)',
    'Wide cinematic hero framing for marketplace cover; emphasizes facade and skyline.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Professionally crop and lightly enhance real estate facade photo as a cinematic hero banner. '
        'Preserve true geometry and colors; no fake windows or removals. Vertical instruction: '
        '{{instruction}}. Preset: {{preset_display_name}}.',
    '{"aspect_ratio_hint":"16:9","quality":"high"}'::jsonb,
    true,
    30
),
(
    'realtor',
    'marketplace_crop',
    'Marketplace crop pack',
    'Consistent square crop safe area for listing grids.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Crop to a balanced square composition with safe margins for UI overlays. Keep verticals straight. '
        '{{instruction}}. Preset: {{preset_display_name}}.',
    '{"aspect_ratio_hint":"1:1"}'::jsonb,
    true,
    31
),
(
    'realtor',
    'document_safe_cleanup',
    'Document-safe cleanup',
    'Neutral exposure and noise reduction suited for annexes and brochures.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Neutral document-style cleanup: moderate exposure correction, chroma noise reduction, no artistic stylization '
        'or object removal; suitable for annex use. {{instruction}}. Preset: {{preset_display_name}}.',
    '{"style":"neutral"}'::jsonb,
    true,
    32
),
(
    'realtor',
    'premium_gallery',
    'Premium gallery polish',
    'Warm daylight polish for flagship gallery carousel.',
    'enhance',
    'image_edit',
    'image_studio_image_edit',
    'Warm premium daylight enhancement for flagship gallery carousel; emphasize space and materials without '
        'hallucinating decor. {{instruction}}. Preset: {{preset_display_name}}.',
    '{"warmth_hint":0.12}'::jsonb,
    true,
    33
)
ON CONFLICT (vertical_slug, preset_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    action_type = EXCLUDED.action_type,
    ugs_type_key = EXCLUDED.ugs_type_key,
    prompt_template = EXCLUDED.prompt_template,
    parameters = EXCLUDED.parameters,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
