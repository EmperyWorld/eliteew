-- Phase 4.1: register reflect_week metadata in action workflow catalog (chat_llm tag; runner stays in chat/runner).

INSERT INTO ewa_companion_workflow_catalog (
    workflow_id,
    version,
    definition,
    enabled,
    source,
    created_by,
    updated_by
)
VALUES (
    'reflect_week',
    1,
    '{
      "workflow_id": "reflect_week",
      "version": 1,
      "title_ru": "Итоги недели",
      "title_en": "Weekly reflection",
      "description_ru": "LLM-only chat workflow: подведи итоги недели",
      "description_en": "LLM-only chat workflow triggered by weekly review phrases",
      "enabled": false,
      "execution_mode": "sync",
      "env_gate": "EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED",
      "tags": ["chat_llm", "reflection"],
      "triggers": [
        {
          "type": "regex",
          "pattern": "(?is)(?:\\bподвед(?:и|ите)\\s+итог(?:и)?\\s+недел\\w*|\\bитоги\\s+недел\\w*|\\bweekly\\s+review\\b|\\breflect\\s+on\\s+(?:the\\s+)?week\\b)"
        }
      ],
      "steps": [
        {
          "step_key": "llm_reflect",
          "kind": "llm_compose",
          "title_ru": "Сводка недели",
          "title_en": "Weekly summary"
        }
      ]
    }'::jsonb,
    false,
    'migration',
    'phase4.1',
    'phase4.1'
)
ON CONFLICT (workflow_id, version) DO NOTHING;
