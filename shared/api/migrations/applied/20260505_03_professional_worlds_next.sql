-- EliteEW Professional Worlds "Next" expansion: vertical packs, rollouts, activations,
-- Realtor Pro CRM-lite extensions, AI playbooks, evaluation, media batches, cross-app draft links.
-- Apply with api/migrations/apply_migrations.sh

-- ---------------------------------------------------------------------------
-- Registry extensions
-- ---------------------------------------------------------------------------
ALTER TABLE professional_modules
    ADD COLUMN IF NOT EXISTS depends_on jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE professional_modules
    ADD COLUMN IF NOT EXISTS capability_scopes jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE professional_admin_audit_log
    ADD COLUMN IF NOT EXISTS risk_level varchar(40);

-- ---------------------------------------------------------------------------
-- Vertical pack versioning, releases, import jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professional_vertical_pack_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    version_label varchar(80) NOT NULL,
    changelog_md text,
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_vertical_pack_version_label UNIQUE (vertical_slug, version_label)
);

CREATE TABLE IF NOT EXISTS professional_vertical_pack_releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    pack_version_id uuid REFERENCES professional_vertical_pack_versions(id) ON DELETE SET NULL,
    status varchar(40) NOT NULL DEFAULT 'draft',
    manifest_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    snapshot_hash varchar(128),
    approved_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamp without time zone,
    published_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_prof_pack_releases_vertical_status
    ON professional_vertical_pack_releases (vertical_slug, status);

CREATE TABLE IF NOT EXISTS professional_vertical_rollouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    release_id uuid NOT NULL REFERENCES professional_vertical_pack_releases(id) ON DELETE CASCADE,
    mode varchar(40) NOT NULL DEFAULT 'all',
    percentage integer NOT NULL DEFAULT 100 CHECK (percentage >= 0 AND percentage <= 100),
    is_paused boolean NOT NULL DEFAULT false,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_prof_rollouts_vertical ON professional_vertical_rollouts (vertical_slug);

CREATE TABLE IF NOT EXISTS professional_vertical_rollout_allowlist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rollout_id uuid NOT NULL REFERENCES professional_vertical_rollouts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_rollout_allowlist UNIQUE (rollout_id, user_id)
);

CREATE TABLE IF NOT EXISTS professional_pack_import_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    status varchar(40) NOT NULL DEFAULT 'pending',
    dry_run boolean NOT NULL DEFAULT true,
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    validation_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_pack_rollback_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    label varchar(160) NOT NULL,
    manifest_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- User activation & runtime epoch (cache bust)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professional_user_vertical_activations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
    entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_user_vertical_activation UNIQUE (user_id, vertical_slug)
);

CREATE TABLE IF NOT EXISTS professional_vertical_runtime_epoch (
    vertical_slug varchar(80) PRIMARY KEY REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    epoch bigint NOT NULL DEFAULT 1,
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Operator / analytics / billing (lightweight event log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professional_operator_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type varchar(120) NOT NULL,
    entity_key varchar(240) NOT NULL,
    note text NOT NULL,
    admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_user_notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    professional_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    event_type varchar(120) NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_prof_analytics_user_created
    ON professional_analytics_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS professional_billing_rollups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    rollup jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_billing_rollup UNIQUE (user_id, vertical_slug, period_start, period_end)
);

-- ---------------------------------------------------------------------------
-- Realtor Pro extensions (leads, requirements, pipeline events, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS realtor_leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL DEFAULT 'realtor',
    name varchar(180) NOT NULL,
    contact varchar(240),
    source varchar(120),
    status varchar(80) NOT NULL DEFAULT 'new',
    notes text,
    converted_client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    lead_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_realtor_leads_user ON realtor_leads (user_id, status);

CREATE TABLE IF NOT EXISTS realtor_buyer_requirements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    title varchar(220) NOT NULL,
    requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_seller_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id uuid REFERENCES professional_clients(id) ON DELETE SET NULL,
    seller_context jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_deal_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_id uuid NOT NULL REFERENCES professional_deals(id) ON DELETE CASCADE,
    stage_from varchar(80),
    stage_to varchar(80) NOT NULL,
    note text,
    event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_realtor_deal_events_deal ON realtor_deal_events (deal_id, created_at);

CREATE TABLE IF NOT EXISTS realtor_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_id uuid REFERENCES professional_deals(id) ON DELETE SET NULL,
    property_id uuid REFERENCES realtor_properties(id) ON DELETE SET NULL,
    title varchar(220) NOT NULL,
    doc_type varchar(120) NOT NULL DEFAULT 'other',
    checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
    unified_content_id uuid,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_price_analysis_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_marketing_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid REFERENCES realtor_properties(id) ON DELETE SET NULL,
    title varchar(220) NOT NULL,
    channels jsonb NOT NULL DEFAULT '[]'::jsonb,
    status varchar(80) NOT NULL DEFAULT 'draft',
    campaign_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_communication_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    related_type varchar(80) NOT NULL,
    related_id uuid,
    channel varchar(80) NOT NULL,
    body text NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_realtor_comm_log_user ON realtor_communication_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS realtor_objection_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    objection_key varchar(160) NOT NULL,
    reply_text text NOT NULL,
    tags jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_realtor_objection_reply_key UNIQUE (user_id, objection_key)
);

CREATE TABLE IF NOT EXISTS realtor_publication_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    channel_key varchar(120) NOT NULL,
    status varchar(80) NOT NULL DEFAULT 'pending',
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_realtor_pub_channel UNIQUE (property_id, channel_key)
);

CREATE TABLE IF NOT EXISTS realtor_listing_quality_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    score numeric(5, 2) NOT NULL,
    breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_realtor_lqs_property ON realtor_listing_quality_scores (property_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- AI playbooks & evaluation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professional_ai_playbooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    playbook_key varchar(160) NOT NULL,
    display_name varchar(180) NOT NULL,
    description text,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_ai_playbooks_vertical_key UNIQUE (vertical_slug, playbook_key)
);

CREATE TABLE IF NOT EXISTS professional_ai_playbook_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    playbook_id uuid NOT NULL REFERENCES professional_ai_playbooks(id) ON DELETE CASCADE,
    step_order integer NOT NULL,
    action_key varchar(160) NOT NULL,
    input_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
    stop_on_error boolean NOT NULL DEFAULT true,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_playbook_step_order UNIQUE (playbook_id, step_order)
);

CREATE TABLE IF NOT EXISTS professional_ai_playbook_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    playbook_key varchar(160) NOT NULL,
    status varchar(60) NOT NULL DEFAULT 'queued',
    idempotency_key varchar(160),
    step_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
    error text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_prof_playbook_runs_user ON professional_ai_playbook_runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS professional_ai_eval_datasets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_slug varchar(80) NOT NULL REFERENCES profession_verticals(slug) ON DELETE CASCADE,
    name varchar(180) NOT NULL,
    cases jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_ai_eval_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id uuid NOT NULL REFERENCES professional_ai_eval_datasets(id) ON DELETE CASCADE,
    target_type varchar(40) NOT NULL,
    target_key varchar(160) NOT NULL,
    status varchar(40) NOT NULL DEFAULT 'pending',
    scores jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Media albums, batch jobs, brand kits; cross-app draft links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS professional_media_albums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    title varchar(220) NOT NULL,
    property_id uuid REFERENCES realtor_properties(id) ON DELETE SET NULL,
    unified_content_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    album_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_media_batch_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES realtor_properties(id) ON DELETE CASCADE,
    preset_key varchar(140) NOT NULL,
    status varchar(60) NOT NULL DEFAULT 'queued',
    instruction text,
    idempotency_key varchar(160),
    batch_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS realtor_media_batch_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id uuid NOT NULL REFERENCES realtor_media_batch_jobs(id) ON DELETE CASCADE,
    source_content_id uuid NOT NULL,
    enhancement_job_id uuid REFERENCES realtor_media_enhancement_jobs(id) ON DELETE SET NULL,
    status varchar(60) NOT NULL DEFAULT 'pending',
    error text,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_realtor_media_batch_items_batch ON realtor_media_batch_items (batch_job_id);

CREATE TABLE IF NOT EXISTS professional_brand_visual_kits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    kit jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_prof_brand_kit_user_vertical UNIQUE (user_id, vertical_slug)
);

CREATE TABLE IF NOT EXISTS professional_cross_app_draft_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vertical_slug varchar(80) NOT NULL,
    draft_kind varchar(80) NOT NULL,
    artifact_id uuid REFERENCES professional_artifacts(id) ON DELETE SET NULL,
    external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
    lifecycle_state varchar(40) NOT NULL DEFAULT 'created',
    stale_reason text,
    source_digest varchar(128),
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_prof_cross_app_drafts_user ON professional_cross_app_draft_links (user_id, created_at DESC);

ALTER TABLE realtor_media_enhancement_jobs
    ADD COLUMN IF NOT EXISTS batch_job_id uuid REFERENCES realtor_media_batch_jobs(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Seeds: Realtor Pro modules & playbook stubs (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO professional_modules (module_key, name, description, category, icon_key, default_config, is_active)
VALUES
    ('realtor_leads', 'Leads', 'Lead inbox and qualification', 'crm', 'users', '{}'::jsonb, true),
    ('realtor_buyers', 'Buyers', 'Buyer requirements & matching', 'crm', 'user-search', '{}'::jsonb, true),
    ('realtor_sellers', 'Sellers', 'Seller onboarding context', 'crm', 'home', '{}'::jsonb, true),
    ('realtor_pipeline', 'Deals pipeline', 'Stages, events, next actions', 'crm', 'kanban', '{}'::jsonb, true),
    ('realtor_documents', 'Documents', 'Checklist & attachments', 'workspace', 'file-text', '{}'::jsonb, true),
    ('realtor_marketing', 'Marketing', 'Campaigns & publication channels', 'growth', 'megaphone', '{}'::jsonb, true),
    ('realtor_insights', 'Insights', 'Price snapshots & listing quality', 'analytics', 'chart', '{}'::jsonb, true),
    ('realtor_playbooks', 'AI playbooks', 'Multi-step AI workflows', 'ai', 'sparkles', '{}'::jsonb, true)
ON CONFLICT (module_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    icon_key = EXCLUDED.icon_key,
    is_active = true,
    updated_at = now();

INSERT INTO professional_vertical_modules (vertical_slug, module_key, config, sort_order, is_enabled)
VALUES
    ('realtor', 'realtor_leads', '{}'::jsonb, 15, true),
    ('realtor', 'realtor_buyers', '{}'::jsonb, 16, true),
    ('realtor', 'realtor_sellers', '{}'::jsonb, 17, true),
    ('realtor', 'realtor_pipeline', '{}'::jsonb, 18, true),
    ('realtor', 'realtor_documents', '{}'::jsonb, 19, true),
    ('realtor', 'realtor_marketing', '{}'::jsonb, 20, true),
    ('realtor', 'realtor_insights', '{}'::jsonb, 21, true),
    ('realtor', 'realtor_playbooks', '{}'::jsonb, 22, true)
ON CONFLICT (vertical_slug, module_key) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    is_enabled = true,
    updated_at = now();

INSERT INTO professional_ai_playbooks (
    vertical_slug, playbook_key, display_name, description, config, is_active, sort_order
)
VALUES
    ('realtor', 'object_to_sales_package', 'Object to sales package', 'Description + media + drafts', '{}'::jsonb, true, 1),
    ('realtor', 'lead_to_first_contact', 'Lead to first contact', 'Qualify and draft outreach', '{}'::jsonb, true, 2),
    ('realtor', 'weekly_pipeline_review', 'Weekly pipeline review', 'Summarize deals and tasks', '{}'::jsonb, true, 3)
ON CONFLICT (vertical_slug, playbook_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 1, 'sales_copy', '{}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'object_to_sales_package'
ON CONFLICT (playbook_id, step_order) DO NOTHING;

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 1, 'safety_rewrite', '{}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'lead_to_first_contact'
ON CONFLICT (playbook_id, step_order) DO NOTHING;

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 1, 'brand_pack', '{}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'weekly_pipeline_review'
ON CONFLICT (playbook_id, step_order) DO NOTHING;

INSERT INTO professional_vertical_runtime_epoch (vertical_slug, epoch)
VALUES ('realtor', 1)
ON CONFLICT (vertical_slug) DO NOTHING;
