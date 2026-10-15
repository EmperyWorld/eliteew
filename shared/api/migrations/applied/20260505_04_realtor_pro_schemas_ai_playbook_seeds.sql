-- Realtor Pro: JSON schemas, AI action seeds, generation types, extra playbook stubs.
-- Idempotent inserts aligned with Professional Worlds next expansion.

INSERT INTO professional_vertical_schemas (vertical_slug, schema_key, version, title, schema_json, ui_schema, is_active)
VALUES
    (
        'realtor',
        'realtor_lead',
        1,
        'Realtor lead v1',
        '{
            "type": "object",
            "required": ["name", "status"],
            "properties": {
                "name": {"type": "string", "maxLength": 220},
                "status": {"type": "string"},
                "source": {"type": ["string", "null"]},
                "contact": {"type": ["string", "null"]},
                "notes": {"type": ["string", "null"]}
            }
        }'::jsonb,
        '{"sections": ["intake", "qualification"]}'::jsonb,
        true
    ),
    (
        'realtor',
        'realtor_buyer_requirement',
        1,
        'Buyer requirement v1',
        '{
            "type": "object",
            "required": ["title"],
            "properties": {
                "title": {"type": "string", "maxLength": 220},
                "budget_max": {"type": ["number", "string", "null"]},
                "districts": {"type": "array", "items": {"type": "string"}},
                "rooms": {"type": ["integer", "null"]},
                "notes": {"type": ["string", "null"]}
            }
        }'::jsonb,
        '{"sections": ["needs", "constraints"]}'::jsonb,
        true
    ),
    (
        'realtor',
        'realtor_seller_profile',
        1,
        'Seller profile v1',
        '{
            "type": "object",
            "required": ["motivation"],
            "properties": {
                "motivation": {"type": "string"},
                "target_price": {"type": ["number", "string", "null"]},
                "timeline": {"type": ["string", "null"]},
                "campaign_ready": {"type": "boolean", "default": false},
                "notes": {"type": ["string", "null"]}
            }
        }'::jsonb,
        '{"sections": ["context", "pricing", "go_to_market"]}'::jsonb,
        true
    )
ON CONFLICT (vertical_slug, schema_key, version) DO UPDATE SET
    title = EXCLUDED.title,
    schema_json = EXCLUDED.schema_json,
    ui_schema = EXCLUDED.ui_schema,
    is_active = EXCLUDED.is_active,
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
        'structured_output', false
    )
FROM (
    VALUES
        ('professional_worlds_realtor_lead_qualification', 'PW — lead qualification', 'Score and summarize inbound Realtor leads.', 75),
        ('professional_worlds_realtor_buyer_match_explain', 'PW — buyer match explain', 'Explain fit between buyer requirements and a listing.', 85),
        ('professional_worlds_realtor_seller_valuation_narrative', 'PW — seller valuation narrative', 'Narrative for seller expectations vs market context.', 95),
        ('professional_worlds_realtor_showing_followup', 'PW — showing follow-up', 'Draft follow-up after a property showing.', 70),
        ('professional_worlds_realtor_negotiation_prep', 'PW — negotiation prep', 'Prepare talking points for offer/negotiation.', 90),
        ('professional_worlds_realtor_document_checklist_explain', 'PW — document checklist', 'Explain document checklist items to clients.', 65),
        ('professional_worlds_realtor_listing_quality_audit', 'PW — listing quality audit', 'Audit listing presentation and gaps.', 100),
        ('professional_worlds_realtor_weekly_sales_plan', 'PW — weekly sales plan', 'Weekly pipeline and activities plan.', 110),
        ('professional_worlds_realtor_objection_variants', 'PW — objection handling', 'Variants for common buyer/seller objections.', 80)
) AS seed(type_key, display_name, description, estimated_time)
WHERE NOT EXISTS (SELECT 1 FROM generation_types gt WHERE gt.type_key = seed.type_key);

INSERT INTO professional_ai_actions (
    vertical_slug, module_key, action_key, display_name, description, ugs_type_key, workflow_slug,
    prompt_template, input_schema, output_schema, safety_rules, artifact_kind, billing_hint, sort_order, is_active
)
VALUES
    (
        'realtor', 'realtor_leads', 'lead_qualification', 'Lead qualification',
        'Summarize intent, risk flags and suggested next actions for a lead.',
        'professional_worlds_realtor_lead_qualification', NULL,
        'You are a Realtor CRM assistant. Lead JSON: {{lead}}. Respond with a concise qualification summary and next actions. No legal promises.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["No guarantees", "Flag missing contact as risk"]'::jsonb, 'message_draft', '{"type":"text"}'::jsonb, 110, true
    ),
    (
        'realtor', 'realtor_buyers', 'buyer_match_explain', 'Buyer match explain',
        'Explain why a property fits buyer requirements.',
        'professional_worlds_realtor_buyer_match_explain', NULL,
        'Buyer requirements JSON: {{buyer}}. Property JSON: {{property}}. Explain fit, gaps, and suggested showing angle. Factual tone.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["Do not invent property facts"]'::jsonb, 'sales_copy', '{"type":"text"}'::jsonb, 111, true
    ),
    (
        'realtor', 'realtor_sellers', 'seller_valuation_narrative', 'Seller valuation narrative',
        'Narrate valuation context for sellers.',
        'professional_worlds_realtor_seller_valuation_narrative', NULL,
        'Seller context JSON: {{seller}}. Produce a respectful valuation narrative with assumptions and what data is still needed.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["No price guarantee"]'::jsonb, 'message_draft', '{"type":"text"}'::jsonb, 112, true
    ),
    (
        'realtor', 'realtor_pipeline', 'showing_followup_message', 'Showing follow-up',
        'Draft follow-up message after a showing.',
        'professional_worlds_realtor_showing_followup', NULL,
        'Showing JSON: {{showing}}. Client JSON: {{client}}. Property JSON: {{property}}. Draft a short follow-up message. No pressure tactics.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["Respect consent"]'::jsonb, 'message_draft', '{"type":"text"}'::jsonb, 113, true
    ),
    (
        'realtor', 'realtor_pipeline', 'negotiation_prep', 'Negotiation preparation',
        'Outline positions, trade-offs and questions before negotiation.',
        'professional_worlds_realtor_negotiation_prep', NULL,
        'Deal JSON: {{deal}}. Property JSON: {{property}}. Prepare bullet list for negotiation: objectives, risks, BATNA hints. No legal advice.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["No legal advice"]'::jsonb, 'message_draft', '{"type":"text"}'::jsonb, 114, true
    ),
    (
        'realtor', 'realtor_documents', 'document_checklist_explain', 'Document checklist explain',
        'Explain checklist items in plain language.',
        'professional_worlds_realtor_document_checklist_explain', NULL,
        'Document row JSON: {{document}}. Explain the checklist_state to the client; keep calm and precise.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["Do not claim legal validity"]'::jsonb, 'message_draft', '{"type":"text"}'::jsonb, 115, true
    ),
    (
        'realtor', 'realtor_insights', 'listing_quality_audit', 'Listing quality audit',
        'Audit listing copy and media readiness.',
        'professional_worlds_realtor_listing_quality_audit', NULL,
        'Property JSON: {{property}}. Score narrative: headlines, facts completeness, photo readiness. Actionable bullets.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["Facts only"]'::jsonb, 'sales_copy', '{"type":"text"}'::jsonb, 116, true
    ),
    (
        'realtor', 'realtor_playbooks', 'weekly_sales_plan', 'Weekly sales plan',
        'Generate a weekly plan from pipeline snapshot.',
        'professional_worlds_realtor_weekly_sales_plan', NULL,
        'Pipeline JSON: {{pipeline}}. Produce a weekly plan with priorities and outreach cadence.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["Realistic workload"]'::jsonb, 'brand_pack', '{"type":"text"}'::jsonb, 117, true
    ),
    (
        'realtor', 'realtor_playbooks', 'objection_handling_variants', 'Objection handling',
        'Draft response variants for a stated objection.',
        'professional_worlds_realtor_objection_variants', NULL,
        'Objection key: {{objection_key}}. Context JSON: {{context}}. Provide 2–3 calm response variants.',
        '{}'::jsonb, '{"type":"object"}'::jsonb,
        '["No manipulation"]'::jsonb, 'message_draft', '{"type":"text"}'::jsonb, 118, true
    )
ON CONFLICT (vertical_slug, action_key) DO UPDATE SET
    module_key = EXCLUDED.module_key,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    ugs_type_key = EXCLUDED.ugs_type_key,
    prompt_template = EXCLUDED.prompt_template,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    safety_rules = EXCLUDED.safety_rules,
    artifact_kind = EXCLUDED.artifact_kind,
    billing_hint = EXCLUDED.billing_hint,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO professional_ai_playbooks (
    vertical_slug, playbook_key, display_name, description, config, is_active, sort_order
)
VALUES
    (
        'realtor', 'seller_onboarding_to_campaign', 'Seller onboarding → campaign',
        'Valuation narrative then outbound campaign copy.', '{}'::jsonb, true, 4
    ),
    (
        'realtor', 'buyer_match_to_showing_plan', 'Buyer match → showing plan',
        'Explain match then draft showing follow-up.', '{}'::jsonb, true, 5
    )
ON CONFLICT (vertical_slug, playbook_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 1, 'seller_valuation_narrative', '{}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'seller_onboarding_to_campaign'
ON CONFLICT (playbook_id, step_order) DO NOTHING;

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 2, 'sales_copy', '{"tone":"campaign"}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'seller_onboarding_to_campaign'
ON CONFLICT (playbook_id, step_order) DO NOTHING;

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 1, 'buyer_match_explain', '{}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'buyer_match_to_showing_plan'
ON CONFLICT (playbook_id, step_order) DO NOTHING;

INSERT INTO professional_ai_playbook_steps (playbook_id, step_order, action_key, input_mapping, stop_on_error)
SELECT p.id, 2, 'showing_followup_message', '{}'::jsonb, true
FROM professional_ai_playbooks p
WHERE p.vertical_slug = 'realtor' AND p.playbook_key = 'buyer_match_to_showing_plan'
ON CONFLICT (playbook_id, step_order) DO NOTHING;
