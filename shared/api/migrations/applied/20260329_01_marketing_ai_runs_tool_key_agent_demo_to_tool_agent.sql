-- Legacy: переименование tool_key после смены контракта эндпоинта (agent_demo -> tool_agent).
-- Идемпотентно: затрагивает только строки с tool_key = 'agent_demo'.

UPDATE marketing_ai_runs
SET
    tool_key = 'tool_agent',
    updated_at = NOW()
WHERE tool_key = 'agent_demo';
