-- Seed Workflow Engine v2 platform settings (Phase 2.5 operator flags).
-- Idempotent: existing rows are preserved (ON CONFLICT DO UPDATE metadata).

INSERT INTO ewa_platform_setting (
    setting_key,
    value_text,
    value_type,
    category,
    description_ru,
    description_en,
    default_value,
    allowed_values,
    affects_ru,
    affects_en,
    is_secret,
    sort_order
) VALUES
    (
        'EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED',
        '0',
        'bool',
        'companion',
        'DAG v2: состояние в Postgres (plan_payload.dag_state) и один узел на Celery task. Требует EWA_COMPANION_WF_ENGINE_ENABLED=1 и EWA_COMPANION_ASYNC_JOBS_ENABLED=1.',
        'DAG v2: Postgres dag_state (plan_payload.dag_state) and one node per Celery task. Requires EWA_COMPANION_WF_ENGINE_ENABLED=1 and EWA_COMPANION_ASYNC_JOBS_ENABLED=1.',
        '0',
        '0|1',
        'dag_state_store.py, dag_node_executor.py, step_kind=dag_node.',
        'dag_state_store.py, dag_node_executor.py, step_kind=dag_node.',
        false,
        32
    ),
    (
        'EWA_COMPANION_WORKFLOW_ENGINE_V2_ENABLED',
        '0',
        'bool',
        'companion',
        'Маршрут schema_version:2 user workflows через start_dag_workflow_v2. Требует EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED=1.',
        'Route schema_version:2 user workflows through start_dag_workflow_v2. Requires EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED=1.',
        '0',
        '0|1',
        'user_workflow_triggers.py, action/starter.py, dag_workflow_starter.py.',
        'user_workflow_triggers.py, action/starter.py, dag_workflow_starter.py.',
        false,
        33
    ),
    (
        'EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED',
        '0',
        'bool',
        'companion',
        'Tool-backed DAG nodes (image_gen и др.) через tool_registry с async resume от child run.',
        'Tool-backed DAG nodes (image_gen etc.) via tool_registry with async resume from child run.',
        '0',
        '0|1',
        'tool_registry_adapter.py, companion_image_generation.py, dag_async_resume.py.',
        'tool_registry_adapter.py, companion_image_generation.py, dag_async_resume.py.',
        false,
        34
    )
ON CONFLICT (setting_key) DO UPDATE SET
    value_type = EXCLUDED.value_type,
    category = EXCLUDED.category,
    description_ru = EXCLUDED.description_ru,
    description_en = EXCLUDED.description_en,
    default_value = EXCLUDED.default_value,
    allowed_values = EXCLUDED.allowed_values,
    affects_ru = EXCLUDED.affects_ru,
    affects_en = EXCLUDED.affects_en,
    is_secret = EXCLUDED.is_secret,
    sort_order = EXCLUDED.sort_order;

-- Enable Workflow Engine v2 chain (Phase 2.5 operator rollout; idempotent).
UPDATE ewa_platform_setting
SET
    value_text = '1',
    updated_by = 'migration_022_workflow_v2_settings',
    updated_at = now()
WHERE setting_key IN (
    'EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED',
    'EWA_COMPANION_WORKFLOW_ENGINE_V2_ENABLED',
    'EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED'
)
AND value_text IS DISTINCT FROM '1';
